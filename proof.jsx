function ProofModal({ id, onClose }) {
  const { donations } = useDerived();
  const d = donations.find((x) => x.id === id);
  const [url, setUrl] = useState(null);
  const [state, setState] = useState('loading');
  const path = d ? d.proof_url : null;
  useEffect(() => {
    let off = false;
    if (!path) { setState('none'); return; }
    if (/^https?:/.test(path)) { setUrl(path); setState('ok'); return; }
    setState('loading');
    sb.storage.from('proofs').createSignedUrl(path, 3600).then((r) => { if (off) return; if (r.error || !r.data) setState('error'); else { setUrl(r.data.signedUrl); setState('ok'); } });
    return () => { off = true; };
  }, [path]);
  if (!d) return null;
  return (
    <Sheet title="Bukti pembayaran" onClose={onClose}>
      {state === 'ok' ? <img src={url} alt="Bukti pembayaran" className="rounded-xl mx-auto max-h-[60vh]" /> : (
        <div className="rounded-xl bg-surface-2 border border-line p-8 text-center"><Icon name="Image" size={28} className="mx-auto text-muted" />
          <div className="font-semibold mt-2">{state === 'loading' ? 'Memuat bukti…' : state === 'error' ? 'Bukti tidak dapat dibuka' : 'Tidak ada bukti'}</div>
          {state === 'error' ? <p className="text-[13px] text-muted mt-1">Berkas tidak ditemukan atau izin akses ditolak.</p> : null}</div>
      )}
      <div className="text-[13.5px] text-ink-2 mt-3 text-center">{rupiah(d.amount)} · {d.payment_method} · {d.donor ? d.donor.name : ''}</div>
    </Sheet>
  );
}

