function authError(x) {
  const m = (x && x.message) || '';
  if (/Invalid login credentials/i.test(m)) return 'Email atau password salah.';
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Buka email konfirmasi dari RPI lalu coba lagi.';
  if (/already registered|already been registered/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (/Password should be at least/i.test(m)) return 'Password terlalu pendek.';
  if (/rate limit|too many/i.test(m)) return 'Terlalu banyak percobaan. Tunggu beberapa menit.';
  return friendlyError(x);
}

function AuthScreen({ recovery, onRecovered }) {
  const [mode, setMode] = useState(recovery ? 'recovery' : 'login');
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (recovery) setMode('recovery'); }, [recovery]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = (m) => { setMode(m); setMsg(null); };

  async function submit(e) {
    e.preventDefault(); if (busy) return;
    setMsg(null);
    const email = f.email.trim();
    if (mode !== 'recovery' && !email) return setMsg({ kind: 'bad', text: 'Isi alamat email.' });
    setBusy(true);
    try {
      if (mode === 'login') {
        const r = await sb.auth.signInWithPassword({ email, password: f.password });
        if (r.error) throw r.error;
      } else if (mode === 'signup') {
        if (!f.name.trim()) throw new Error('Nama lengkap wajib diisi.');
        if (f.password.length < 8) throw new Error('Password minimal 8 karakter.');
        const r = await sb.auth.signUp({ email, password: f.password, options: { data: { full_name: f.name.trim(), phone: f.phone.trim() } } });
        if (r.error) throw r.error;
        if (!r.data.session) { setMode('login'); setMsg({ kind: 'ok', text: 'Pendaftaran berhasil. Cek email Anda untuk konfirmasi, lalu masuk.' }); }
      } else if (mode === 'forgot') {
        const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
        if (r.error) throw r.error;
        setMsg({ kind: 'ok', text: 'Tautan reset password sudah dikirim ke email Anda.' });
      } else {
        if (f.password.length < 8) throw new Error('Password minimal 8 karakter.');
        const r = await sb.auth.updateUser({ password: f.password });
        if (r.error) throw r.error;
        onRecovered();
      }
    } catch (x) { setMsg({ kind: 'bad', text: authError(x) }); }
    setBusy(false);
  }

  const title = { login: 'Masuk', signup: 'Daftar relawan', forgot: 'Lupa password', recovery: 'Buat password baru' }[mode];
  return (
    <div className="min-h-screen hero-grad flex items-center justify-center gutter" style={{ paddingBlock: '24px' }}>
      <div className="w-full max-w-md bg-surface text-ink rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-16 h-14 rounded-xl bg-white border border-line flex items-center justify-center p-1 shrink-0"><img src={LOGO} alt="Logo RPI" className="max-h-full max-w-full object-contain" /></div>
          <div className="min-w-0"><div className="font-display font-bold text-[19px] leading-tight">Rumah Pelopor Indonesia</div><div className="text-[13px] text-muted">Laporan kunjungan & donasi lapangan</div></div>
        </div>
        <h1 className="font-display font-bold text-[24px] mb-4">{title}</h1>
        <form className="grid gap-3.5" onSubmit={submit} noValidate>
          {mode === 'signup' ? (
            <>
              <div><label className={LABEL} htmlFor="a-name">Nama lengkap</label><input id="a-name" className={INPUT} autoComplete="name" value={f.name} onChange={set('name')} /></div>
              <div><label className={LABEL} htmlFor="a-phone">Nomor WhatsApp</label><input id="a-phone" className={INPUT} inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></div>
            </>
          ) : null}
          {mode !== 'recovery' ? <div><label className={LABEL} htmlFor="a-email">Email</label><input id="a-email" type="email" className={INPUT} autoComplete="email" value={f.email} onChange={set('email')} /></div> : null}
          {mode !== 'forgot' ? <div><label className={LABEL} htmlFor="a-pass">{mode === 'recovery' ? 'Password baru' : 'Password'}</label><input id="a-pass" type="password" className={INPUT} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} /></div> : null}
          {msg ? <div role="alert" className={'rounded-xl px-4 py-3 text-[14px] font-semibold ' + (msg.kind === 'ok' ? 'bg-okbg text-okfg' : 'bg-badbg text-badfg')}>{msg.text}</div> : null}
          <button type="submit" disabled={busy} className={CTA + ' w-full min-h-[50px] text-[16px]'}>{busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : mode === 'signup' ? 'Daftar' : mode === 'forgot' ? 'Kirim tautan reset' : 'Simpan password'}</button>
        </form>
        <div className="mt-4 grid gap-1 text-[14px]">
          {mode === 'login' ? (
            <>
              <button className="text-brand font-semibold min-h-[40px] text-left" onClick={() => go('forgot')}>Lupa password?</button>
              <button className="text-brand font-semibold min-h-[40px] text-left" onClick={() => go('signup')}>Belum punya akun? Daftar sebagai relawan</button>
            </>
          ) : mode !== 'recovery' ? <button className="text-brand font-semibold min-h-[40px] text-left" onClick={() => go('login')}>Kembali ke halaman masuk</button> : null}
        </div>
      </div>
    </div>
  );
}

function Splash({ text, children }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center gutter" style={{ paddingBlock: '24px' }}>
      <div className="text-center max-w-sm">
        <img src={LOGO} alt="" className="h-16 mx-auto mb-4" />
        <div className="font-display font-bold text-[18px]">{text}</div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [toast, setToast] = useState(null);
  const notify = useCallback((msg, kind) => setToast({ msg, kind: kind || 'ok', k: Date.now() }), []);
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  const [tab, setTab] = useState(null);
  const [receipt, openReceipt] = useState(null);
  const [proof, openProof] = useState(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [waiting, setWaiting] = useState(null);
  const install = useInstall();
  const online = useOnline();
  const user = session ? session.user : null;
  const { db, ready, actions } = useStore(user, notify);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then((r) => setSession(r.data.session || null));
    const sub = sb.auth.onAuthStateChange((ev, s) => { setSession(s); if (ev === 'PASSWORD_RECOVERY') setRecovery(true); });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);

  useEffect(() => { // service worker + notifikasi versi baru
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      const watch = (w) => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w); });
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => { if (reg.installing) watch(reg.installing); });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) return; refreshing = true; location.reload(); });
  }, []);

  if (!sb) return <Splash text="Konfigurasi Supabase belum diisi">{<p className="text-[14px] text-muted mt-2">Isi SUPABASE_URL dan SUPABASE_ANON_KEY di berkas config.js.</p>}</Splash>;
  if (session === undefined) return <Splash text="Memuat…" />;
  if (!session || recovery) return <AuthScreen recovery={recovery} onRecovered={() => setRecovery(false)} />;
  if (!ready) return <Splash text="Memuat data…" />;
  const me = db.profiles.find((p) => p.id === user.id);
  const signOut = () => { sb.auth.signOut(); };
  if (!me) return <Splash text="Profil Anda belum tersedia"><p className="text-[14px] text-muted mt-2">Hubungi admin RPI untuk mengaktifkan akun ini.</p><button className={GHOST + ' mt-4'} onClick={signOut}>Keluar</button></Splash>;

  const role = me.role;
  const nav = NAV[role];
  const cur = nav.some((n) => n.id === tab) ? tab : nav[0].id;
  const goTab = (t) => { setTab(t); window.scrollTo(0, 0); };
  const ctx = { db, actions, notify, me, role, setTab: goTab, openReceipt, openProof, openInstall: () => setInstallOpen(true) };
  const titles = { home: 'Beranda', report: 'Laporan Kunjungan', history: 'Riwayat Kunjungan', monitor: 'Monitoring Tim', moves: 'Pergerakan Lapangan', dash: 'Executive Dashboard', verify: 'Verifikasi Donasi', master: 'Master Data & Setting', export: 'Ekspor Data' };

  let view = null;
  if (role === 'volunteer') view = cur === 'home' ? <VolunteerHome /> : cur === 'report' ? <ReportForm /> : <History />;
  else if (role === 'coordinator') view = cur === 'monitor' ? <Monitoring /> : <Moves />;
  else view = cur === 'dash' ? <Dashboard /> : cur === 'verify' ? <Verify /> : cur === 'master' ? <MasterData /> : <ExportView />;

  const pendingCount = db.donations.filter((d) => d.verification_status === 'Pending').length;

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-bg text-ink">
        <header className="hero-grad text-white">
          <div className="gutter max-w-6xl mx-auto" style={{ paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))', paddingBottom: '14px' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-12 rounded-xl bg-white flex items-center justify-center p-1 shrink-0"><img src={db.settings.org_logo_url || LOGO} alt="Logo RPI" className="max-h-full max-w-full object-contain" /></div>
                <div className="min-w-0"><div className="font-display font-bold text-[18px] leading-tight truncate">{db.settings.org_name}</div><div className="text-[12.5px] opacity-90 truncate">{me.full_name} · {ROLE_LABEL[role]}</div></div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/20 text-[12.5px] font-semibold px-3 min-h-[32px]"><Icon name={online ? 'Wifi' : 'WifiOff'} size={14} />{online ? 'Online' : 'Offline'}</span>
                <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[12.5px] font-semibold px-3 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Keluar"><Icon name="LogOut" size={15} />Keluar</button>
              </div>
            </div>
          </div>
        </header>
        {!online ? <div role="status" className="bg-warnbg text-warnfg text-center text-[13.5px] font-semibold py-2 gutter">Tidak ada internet. Data terbaru tidak dapat dimuat atau dikirim.</div> : null}

        <div className="gutter max-w-6xl mx-auto md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-6" style={{ paddingBlock: '16px 112px' }}>
          <aside className="hidden md:block">
            <nav className="sticky top-4 grid gap-1" aria-label="Navigasi utama">
              {nav.map((n) => (
                <button key={n.id} onClick={() => goTab(n.id)} aria-current={cur === n.id ? 'page' : undefined} className={'flex items-center gap-3 min-h-[46px] px-3 rounded-xl text-[15px] font-semibold text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' + (cur === n.id ? 'bg-infobg text-infofg' : 'text-ink-2 hover:bg-surface-2')}>
                  <Icon name={n.icon} size={19} />{n.label}{n.id === 'verify' && pendingCount ? <span className="ml-auto bg-pink-600 text-white text-[11.5px] rounded-full px-2 py-0.5 num">{pendingCount}</span> : null}
                </button>
              ))}
            </nav>
          </aside>
          <main className="min-w-0">
            {waiting ? (
              <div className="rounded-2xl p-4 mb-4 flex items-center gap-3 border border-line bg-okbg text-okfg">
                <Icon name="RefreshCw" size={20} className="shrink-0" />
                <div className="min-w-0 flex-1 font-bold text-[14.5px]">Versi baru aplikasi tersedia</div>
                <button className={SMALL + ' bg-pink-600 hover:bg-pink-700 text-white shrink-0'} onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}>Muat ulang</button>
              </div>
            ) : null}
            {install.show ? (
              <div className="rounded-2xl p-4 mb-4 flex items-center gap-3 border border-line bg-infobg text-infofg">
                <Icon name="Smartphone" size={22} className="shrink-0" />
                <div className="min-w-0 flex-1"><div className="font-bold text-[14.5px]">Pasang RPI di layar utama</div><div className="text-[12.5px] opacity-90">Buka lebih cepat, tampil layar penuh.</div></div>
                <button className={SMALL + ' bg-pink-600 hover:bg-pink-700 text-white shrink-0'} onClick={() => install.deferred ? install.prompt() : setInstallOpen(true)}>Pasang</button>
                <button className={SMALL + ' shrink-0 px-2'} onClick={install.dismiss} aria-label="Tutup banner"><Icon name="X" size={16} /></button>
              </div>
            ) : null}
            <h1 className="font-display font-bold text-[24px] md:text-[28px] leading-tight mb-4 text-balance">{titles[cur]}</h1>
            {view}
          </main>
        </div>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line" aria-label="Navigasi utama" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))', paddingRight: 'max(8px, env(safe-area-inset-right, 0px))' }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(' + nav.length + ', minmax(0, 1fr))' }}>
            {nav.map((n) => {
              const on = cur === n.id; const cta = n.id === 'report';
              return (
                <button key={n.id} onClick={() => goTab(n.id)} aria-current={on ? 'page' : undefined} className="relative flex flex-col items-center justify-center gap-0.5 min-h-[58px] text-[11.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl" style={{ color: on ? 'var(--brand)' : 'var(--muted)' }}>
                  {cta ? <span className="w-11 h-11 -mt-5 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg border-4" style={{ borderColor: 'var(--surface)' }}><Icon name="Plus" size={22} /></span> : <Icon name={n.icon} size={22} />}
                  {n.label}
                  {n.id === 'verify' && pendingCount ? <span className="absolute top-1.5 right-[22%] bg-pink-600 text-white text-[10.5px] rounded-full px-1.5 num">{pendingCount}</span> : null}
                </button>
              );
            })}
          </div>
        </nav>

        {toast ? <div key={toast.k} role="status" className="fixed z-40 left-1/2 -translate-x-1/2 max-w-[92%] rounded-xl px-4 py-3 text-[14px] font-semibold shadow-xl flex items-center gap-2" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', background: toast.kind === 'bad' ? '#be123c' : '#0f172a', color: '#fff' }}><Icon name={toast.kind === 'bad' ? 'AlertCircle' : 'CheckCircle2'} size={18} className="shrink-0" /><span>{toast.msg}</span></div> : null}
        {receipt ? <ReceiptModal id={receipt} onClose={() => openReceipt(null)} /> : null}
        {proof ? <ProofModal id={proof} onClose={() => openProof(null)} /> : null}
        {installOpen ? <InstallGuide onClose={() => setInstallOpen(false)} deferred={install.deferred} onPrompt={() => { install.prompt(); setInstallOpen(false); }} /> : null}
      </div>
    </Ctx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
