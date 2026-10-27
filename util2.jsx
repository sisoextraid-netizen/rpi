
function dataUrlToBlob(u) {
  const parts = u.split(',');
  const mime = (parts[0].match(/:(.*?);/) || [null, 'image/jpeg'])[1];
  const bin = atob(parts[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function friendlyError(e) {
  const m = (e && e.message) || String(e || '');
  if (e && (e.code === '42501' || /row-level security|permission denied/i.test(m))) return 'Izin ditolak. Peran Anda tidak boleh melakukan aksi ini.';
  if (e && e.code === '23503') return 'Data terkait tidak ditemukan atau masih dipakai.';
  if (e && e.code === '23505') return 'Data dengan nama yang sama sudah ada.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Tidak ada koneksi internet.';
  return m || 'Terjadi kesalahan';
}

function printReceipt(o) {
  const d = o.d, st = o.st;
  const w = window.open('', '_blank');
  if (!w) return false;
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const abs = new URL(o.logo, location.href).href;
  const verified = d.verification_status === 'Verified';
  const rows = [['Diterima dari', d.donor ? d.donor.name : '-'], ['Tanggal', fmtDT(d.created_at)], ['Kategori', d.category ? d.category.name : '-'], ['Metode', d.payment_method], ['Relawan', d.volunteer ? d.volunteer.full_name : '-']];
  if (d.volunteer && d.volunteer.phone) rows.push(['Kontak relawan', d.volunteer.phone]);
  const html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + e(receiptNo(d)) + '</title><style>'
    + 'body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;padding:24px}.box{max-width:560px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;padding:24px}'
    + '.hd{display:flex;gap:14px;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:12px}.hd img{height:56px}.hd b{font-size:17px;display:block}.hd span{font-size:12px;color:#64748b}'
    + '.no{display:flex;justify-content:space-between;margin-top:14px;font-size:13px;font-weight:bold}.st{padding:2px 8px;border-radius:4px;font-size:11px;text-transform:uppercase;background:' + (verified ? '#d1fae5;color:#065f46' : '#fef3c7;color:#92400e') + '}'
    + '.amt{font-size:32px;font-weight:bold;margin:8px 0 2px}.tb{font-style:italic;color:#475569;font-size:13px;margin-bottom:10px}'
    + 'table{width:100%;border-collapse:collapse;font-size:14px}td{padding:7px 0;border-top:1px dashed #cbd5e1;vertical-align:top}td:first-child{width:130px;color:#64748b}td:last-child{font-weight:bold}'
    + '.ft{margin-top:14px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:12.5px;color:#475569}@media print{body{padding:0}.box{border:0}}'
    + '</style></head><body><div class="box"><div class="hd"><img src="' + e(abs) + '" alt=""><div><b>' + e(st.org_name) + '</b><span>Kuitansi penerimaan donasi</span></div></div>'
    + '<div class="no"><span>' + e(receiptNo(d)) + '</span><span class="st">' + (verified ? 'Terverifikasi' : 'Menunggu verifikasi') + '</span></div>'
    + '<div class="amt">' + e(rupiah(d.amount)) + '</div><div class="tb">' + e(terbilang(d.amount)) + '</div>'
    + '<table>' + rows.map((r) => '<tr><td>' + e(r[0]) + '</td><td>' + e(r[1]) + '</td></tr>').join('') + '</table>'
    + (st.receipt_footer_text ? '<div class="ft">' + e(st.receipt_footer_text) + '</div>' : '') + '</div></body></html>';
  w.document.write(html); w.document.close();
  const go = () => { try { w.focus(); w.print(); } catch (x) { /* abaikan */ } };
  const img = w.document.querySelector('img');
  if (img && !img.complete) { img.onload = go; img.onerror = go; setTimeout(go, 1500); } else setTimeout(go, 150);
  return true;
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

/* ---------- store: Supabase (RLS membatasi data sesuai peran) ---------- */
function useStore(user, notify) {
  const [db, setDb] = useState(EMPTY_DB);
  const [ready, setReady] = useState(false);
  const dbRef = useRef(db); dbRef.current = db;
  const timer = useRef(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const names = ['profiles', 'donation_categories', 'donors', 'volunteer_visits', 'donations', 'app_settings'];
    const res = await Promise.all(names.map((n) => sb.from(n).select('*')));
    const bad = res.find((r) => r.error);
    if (bad) { notify('Gagal memuat data: ' + friendlyError(bad.error), 'bad'); setReady(true); return; }
    const st = res[5].data && res[5].data[0];
    setDb({
      profiles: res[0].data, donation_categories: res[1].data.slice().sort((a, b) => a.name.localeCompare(b.name)), donors: res[2].data,
      volunteer_visits: res[3].data, donations: res[4].data,
      settings: st ? { ...DEFAULT_SETTINGS, ...st, bank_accounts: Array.isArray(st.bank_accounts) ? st.bank_accounts : [] } : DEFAULT_SETTINGS
    });
    setReady(true);
  }, [notify]);

  const uid_ = user ? user.id : null;
  useEffect(() => {
    if (!uid_) { setDb(EMPTY_DB); setReady(false); return; }
    load();
    let ch = null;
    try {
      ch = sb.channel('rpi-' + uid_).on('postgres_changes', { event: '*', schema: 'public' }, () => { clearTimeout(timer.current); timer.current = setTimeout(load, 400); }).subscribe();
    } catch (e) { /* realtime opsional */ }
    return () => { clearTimeout(timer.current); try { if (ch) sb.removeChannel(ch); } catch (e) { /* abaikan */ } };
  }, [uid_, load]);

  const actions = useMemo(() => {
    const finish = async (r, needRows) => {
      if (r.error) { notify(friendlyError(r.error), 'bad'); return false; }
      if (needRows && (!r.data || !r.data.length)) { notify('Tidak ada data yang berubah. Cek izin peran Anda.', 'bad'); return false; }
      await load(); return true;
    };
    return {
      add: async (t, row) => finish(await sb.from(t).insert(row)),
      addMany: async (list) => {
        for (const item of list) { const r = await sb.from(item[0]).insert(item[1]); if (r.error) { notify(friendlyError(r.error), 'bad'); return false; } }
        await load(); return true;
      },
      update: async (t, id, patch) => finish(await sb.from(t).update(patch).eq('id', id).select('id'), true),
      remove: async (t, id) => finish(await sb.from(t).delete().eq('id', id).select('id'), true),
      saveSettings: async (patch) => finish(await sb.from('app_settings').upsert({ ...dbRef.current.settings, ...patch }).select('id'), true)
    };
  }, [load, notify]);

  return { db, ready, actions, reload: load };
}

