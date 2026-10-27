function MasterData() {
  const { db, actions, notify, me, openInstall } = useApp();
  const st = db.settings;
  const [org, setOrg] = useState(st.org_name);
  const [foot, setFoot] = useState(st.receipt_footer_text || '');
  const [newCat, setNewCat] = useState('');
  const [bank, setBank] = useState({ bank: '', number: '', holder: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOrg(st.org_name); setFoot(st.receipt_footer_text || ''); }, [st.org_name, st.receipt_footer_text]);
  const logo = st.org_logo_url || LOGO;

  async function onLogo(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setBusy(true);
    try {
      const blob = dataUrlToBlob(await imageToDataUrl(f, 500, 'png'));
      const path = 'logo-' + Date.now() + '.png';
      const up = await sb.storage.from('branding').upload(path, blob, { contentType: 'image/png' });
      if (up.error) throw up.error;
      const url = sb.storage.from('branding').getPublicUrl(path).data.publicUrl;
      if (await actions.saveSettings({ org_logo_url: url })) notify('Logo diperbarui');
    } catch (x) { notify('Gagal mengunggah logo: ' + friendlyError(x), 'bad'); }
    setBusy(false);
  }
  async function saveOrg() {
    if (await actions.saveSettings({ org_name: org.trim() || 'Rumah Pelopor Indonesia', receipt_footer_text: foot })) notify('Profil lembaga disimpan');
  }
  async function addCat(e) {
    e.preventDefault(); if (!newCat.trim()) return;
    if (await actions.add('donation_categories', { id: uid(), name: newCat.trim(), is_active: true })) { setNewCat(''); notify('Kategori ditambahkan'); }
  }
  async function addBank(e) {
    e.preventDefault();
    if (!bank.bank.trim() || !bank.number.trim()) return notify('Isi nama bank dan nomor rekening', 'bad');
    if (await actions.saveSettings({ bank_accounts: [...st.bank_accounts, { bank: bank.bank.trim(), number: bank.number.trim(), holder: bank.holder.trim() || org }] })) { setBank({ bank: '', number: '', holder: '' }); notify('Rekening ditambahkan'); }
  }
  async function setRole(p, role) {
    if (await actions.update('profiles', p.id, { role })) notify(p.full_name + ' sekarang ' + ROLE_LABEL[role]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <section className={CARD + ' p-4 grid gap-4'}>
        <h2 className="font-display font-bold text-[18px]">Profil lembaga</h2>
        <div className="flex items-center gap-4">
          <div className="w-24 h-20 rounded-xl bg-white border border-line flex items-center justify-center p-1.5 shrink-0"><img src={logo} alt="Logo lembaga" className="max-h-full max-w-full object-contain" /></div>
          <div className="grid gap-2">
            <label htmlFor="logo-up" className={SMALL + ' bg-surface-2 text-ink border border-line cursor-pointer'}><Icon name="Upload" size={14} />{busy ? 'Mengunggah…' : 'Ganti logo'}</label>
            <input id="logo-up" type="file" accept="image/*" className="sr-only" onChange={onLogo} disabled={busy} />
            {st.org_logo_url ? <button className="text-[13px] font-semibold text-badfg text-left min-h-[28px]" onClick={() => actions.saveSettings({ org_logo_url: null })}>Pakai logo RPI</button> : null}
          </div>
        </div>
        <div><label className={LABEL} htmlFor="org-name">Nama lembaga</label><input id="org-name" className={INPUT} value={org} onChange={(e) => setOrg(e.target.value)} /></div>
        <div><label className={LABEL} htmlFor="org-foot">Teks penutup kuitansi</label><textarea id="org-foot" className={INPUT + ' py-2.5 min-h-[88px]'} value={foot} onChange={(e) => setFoot(e.target.value)} /></div>
        <button className={CTA} onClick={saveOrg}>Simpan perubahan</button>
      </section>

      <section className={CARD + ' p-4'}>
        <h2 className="font-display font-bold text-[18px] mb-2">Kategori donasi</h2>
        <ul>{db.donation_categories.map((c) => <CategoryRow key={c.id} c={c} />)}</ul>
        <form className="flex gap-2 mt-3" onSubmit={addCat}>
          <input id="new-cat" className={INPUT} placeholder="Kategori baru" aria-label="Kategori baru" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button type="submit" className={CTA + ' shrink-0'}><Icon name="Plus" size={18} />Tambah</button>
        </form>
      </section>

      <section className={CARD + ' p-4 lg:col-span-2'}>
        <h2 className="font-display font-bold text-[18px] mb-2">Rekening bank</h2>
        {!st.bank_accounts.length ? <p className="text-[14px] text-muted mb-2">Belum ada rekening. Tambahkan rekening resmi RPI di bawah.</p> : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {st.bank_accounts.map((b, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface-2 p-3 flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-display font-bold text-[16px]">{b.bank}</div><div className="num text-[14px] break-all">{b.number}</div><div className="text-[12.5px] text-muted break-words">{b.holder}</div></div>
              <button className={SMALL + ' bg-surface text-badfg border border-line shrink-0'} aria-label={'Hapus rekening ' + b.bank} onClick={async () => { if (await actions.saveSettings({ bank_accounts: st.bank_accounts.filter((_, j) => j !== i) })) notify('Rekening dihapus'); }}><Icon name="Trash2" size={14} /></button>
            </div>
          ))}
        </div>
        <form className="grid gap-2 sm:grid-cols-[1fr_1.2fr_1.4fr_auto] mt-3" onSubmit={addBank}>
          <input id="bk-name" className={INPUT} placeholder="Bank" aria-label="Nama bank" value={bank.bank} onChange={(e) => setBank({ ...bank, bank: e.target.value })} />
          <input id="bk-num" className={INPUT} inputMode="numeric" placeholder="Nomor rekening" aria-label="Nomor rekening" value={bank.number} onChange={(e) => setBank({ ...bank, number: e.target.value })} />
          <input id="bk-hold" className={INPUT} placeholder="Atas nama" aria-label="Atas nama" value={bank.holder} onChange={(e) => setBank({ ...bank, holder: e.target.value })} />
          <button type="submit" className={CTA}><Icon name="Plus" size={18} />Tambah</button>
        </form>
      </section>

      <section className={CARD + ' p-4 lg:col-span-2'}>
        <h2 className="font-display font-bold text-[18px]">Pengguna & peran</h2>
        <p className="text-[13.5px] text-muted mb-3">Orang yang mendaftar otomatis menjadi Relawan. Naikkan menjadi Koordinator atau Owner di sini.</p>
        <div className="grid gap-2">
          {db.profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-surface-2 p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1 basis-48"><div className="font-semibold truncate">{p.full_name || '(tanpa nama)'}{p.id === me.id ? ' (Anda)' : ''}</div><div className="text-[12.5px] text-muted truncate">{p.email || '-'}{p.phone ? ' · ' + p.phone : ''}</div></div>
              <select aria-label={'Peran ' + p.full_name} className={INPUT + ' max-w-[190px]'} value={p.role} disabled={p.id === me.id} onChange={(e) => setRole(p, e.target.value)}>
                {Object.keys(ROLE_LABEL).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className={CARD + ' p-4 lg:col-span-2 flex items-center justify-between gap-3 flex-wrap'}>
        <div className="min-w-0"><h2 className="font-display font-bold text-[18px]">Aplikasi di HP</h2><p className="text-[13.5px] text-muted">Panduan memasang RPI ke layar utama untuk relawan.</p></div>
        <button className={GHOST} onClick={openInstall}><Icon name="Smartphone" size={16} />Lihat panduan pasang</button>
      </section>
    </div>
  );
}

