function ReportForm() {
  const { db, actions, me, notify, setTab, openReceipt } = useApp();
  const donorsSorted = useMemo(() => [...db.donors].sort((a, b) => a.name.localeCompare(b.name)), [db.donors]);
  const activeCats = db.donation_categories.filter((c) => c.is_active);
  const [mode, setMode] = useState('existing');
  const [donorId, setDonorId] = useState('');
  const [nd, setNd] = useState({ name: '', wa: '', addr: '' });
  const [status, setStatus] = useState('Prospek');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(isoDay(Date.now()));
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('');
  const [method, setMethod] = useState('Cash Relawan');
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isWin = status === 'Berhasil';
  const needProof = isWin && method !== 'Cash Relawan';

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setBusy(true);
    try { setProof(await imageToDataUrl(f, 1000, 'jpeg')); setErr(''); } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (mode === 'existing' && !donorId) return setErr('Pilih donatur atau tambahkan donatur baru.');
    if (mode === 'new' && !nd.name.trim()) return setErr('Nama donatur wajib diisi.');
    const amt = Number(String(amount).replace(/\D/g, ''));
    if (isWin) {
      if (!amt) return setErr('Isi nominal donasi.');
      if (!cat) return setErr('Pilih kategori donasi.');
      if (needProof && !proof) return setErr('Unggah bukti transfer atau QRIS terlebih dahulu.');
    }
    setBusy(true); setErr('');
    try {
      const list = []; let did = donorId;
      if (mode === 'new') { did = uid(); list.push(['donors', { id: did, name: nd.name.trim(), whatsapp: nd.wa.trim(), address: nd.addr.trim(), created_by: me.id }]); }
      const vid = uid();
      list.push(['volunteer_visits', { id: vid, volunteer_id: me.id, donor_id: did, status, notes: notes.trim(), visit_date: new Date(date + 'T' + fmtTime(Date.now())).toISOString() }]);
      let donId = null;
      if (isWin) {
        donId = uid(); let path = null;
        if (method !== 'Cash Relawan') {
          path = me.id + '/' + donId + '.jpg';
          const up = await sb.storage.from('proofs').upload(path, dataUrlToBlob(proof), { contentType: 'image/jpeg' });
          if (up.error) throw new Error('Gagal mengunggah bukti: ' + friendlyError(up.error));
        }
        list.push(['donations', { id: donId, visit_id: vid, volunteer_id: me.id, donor_id: did, amount: amt, category_id: cat, payment_method: method, proof_url: path, verification_status: 'Pending' }]);
      }
      const ok = await actions.addMany(list);
      if (!ok) { setBusy(false); return; }
      setDonorId(''); setNd({ name: '', wa: '', addr: '' }); setStatus('Prospek'); setNotes(''); setAmount(''); setCat(''); setProof(null); setMethod('Cash Relawan'); setMode('existing');
      notify(isWin ? 'Laporan dan donasi tersimpan, menunggu verifikasi' : 'Laporan kunjungan tersimpan');
      setTab('history');
      if (donId) openReceipt(donId);
    } catch (x) { setErr(friendlyError(x)); }
    setBusy(false);
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <div className={CARD + ' p-4 grid gap-4'}>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-ink-2" htmlFor="donor-sel">Donatur</label>
            <button type="button" className="text-[13px] font-semibold text-brand min-h-[32px]" onClick={() => { setMode(mode === 'existing' ? 'new' : 'existing'); setErr(''); }}>{mode === 'existing' ? '+ Donatur baru' : 'Pilih dari daftar'}</button>
          </div>
          {mode === 'existing' ? (
            <select id="donor-sel" className={INPUT} value={donorId} onChange={(e) => setDonorId(e.target.value)}>
              <option value="">{donorsSorted.length ? 'Pilih donatur…' : 'Belum ada donatur, tambahkan donatur baru'}</option>
              {donorsSorted.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <div className="grid gap-3">
              <input id="nd-name" className={INPUT} placeholder="Nama lengkap donatur" value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} />
              <input id="nd-wa" className={INPUT} inputMode="tel" placeholder="Nomor WhatsApp, contoh 0812xxxxxxx" value={nd.wa} onChange={(e) => setNd({ ...nd, wa: e.target.value })} />
              <textarea id="nd-addr" className={INPUT + ' py-2.5 min-h-[72px]'} placeholder="Alamat" value={nd.addr} onChange={(e) => setNd({ ...nd, addr: e.target.value })} />
            </div>
          )}
        </div>
        <div>
          <span className={LABEL}>Status kunjungan</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUSES.map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
                className={'min-h-[48px] rounded-xl border text-[14px] font-semibold flex items-center justify-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' + (status === s ? TONE_CLASS[TONE_BY_STATUS[s]] + ' border-current' : 'bg-surface text-ink-2 border-line')}>
                <Icon name={STATUS_ICON[s]} size={16} />{s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="v-date">Tanggal kunjungan</label>
            <input id="v-date" type="date" className={INPUT} value={date} max={isoDay(Date.now())} onChange={(e) => setDate(e.target.value || isoDay(Date.now()))} />
          </div>
          <div>
            <label className={LABEL} htmlFor="v-notes">Catatan</label>
            <input id="v-notes" className={INPUT} placeholder="Hasil obrolan, tindak lanjut" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {isWin ? (
        <div className={CARD + ' p-4 grid gap-4'}>
          <h2 className="font-display font-bold text-[17px]">Detail donasi</h2>
          <div>
            <label className={LABEL} htmlFor="amt">Nominal (Rp)</label>
            <input id="amt" className={INPUT + ' text-[18px] font-bold num'} inputMode="numeric" placeholder="0" value={amount ? new Intl.NumberFormat('id-ID').format(Number(String(amount).replace(/\D/g, ''))) : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            <div className="flex flex-wrap gap-2 mt-2">
              {[50000, 100000, 250000, 500000, 1000000].map((n) => <button key={n} type="button" className={SMALL + ' bg-surface-2 text-ink border border-line'} onClick={() => setAmount(String(n))}>{shortRp(n)}</button>)}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="cat">Kategori</label>
              <select id="cat" className={INPUT} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Pilih kategori…</option>
                {activeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="mth">Metode pembayaran</label>
              <select id="mth" className={INPUT} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {method !== 'Cash Relawan' ? (
            <div>
              <span className={LABEL}>Bukti {method === 'QRIS' ? 'pembayaran QRIS' : 'transfer'}</span>
              <label htmlFor="proof" className="flex items-center justify-center gap-2 min-h-[88px] rounded-xl border-2 border-dashed border-line bg-surface-2 text-ink-2 font-semibold cursor-pointer text-center px-3">
                {proof ? <img src={proof} alt="Pratinjau bukti" className="max-h-24 rounded-lg" /> : <><Icon name="Upload" size={18} />Ketuk untuk unggah foto bukti</>}
              </label>
              <input id="proof" type="file" accept="image/*" className="sr-only" onChange={onFile} />
              {proof ? <button type="button" className="text-[13px] font-semibold text-badfg mt-2 min-h-[32px]" onClick={() => setProof(null)}>Hapus gambar</button> : null}
            </div>
          ) : <p className="text-[13px] text-muted">Uang tunai dicatat atas nama relawan dan baru dihitung setelah diverifikasi admin.</p>}
        </div>
      ) : null}

      {err ? <div role="alert" className="rounded-xl bg-badbg text-badfg px-4 py-3 text-[14px] font-semibold flex items-start gap-2"><Icon name="AlertCircle" size={18} className="shrink-0 mt-0.5" />{err}</div> : null}
      <button type="submit" disabled={busy} className={CTA + ' w-full min-h-[52px] text-[16px]'}><Icon name="Send" size={18} />{busy ? 'Menyimpan…' : 'Kirim Laporan'}</button>
    </form>
  );
}

