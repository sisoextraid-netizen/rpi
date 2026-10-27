#!/usr/bin/env python3
"""Merakit src/base.jsx + src/parts/*.jsx menjadi src/app.jsx (sumber tunggal)."""
import re, pathlib
root = pathlib.Path(__file__).parent
base = (root / 'src/base.jsx').read_text()
P = lambda n: (root / 'src/parts' / n).read_text()

def cut(a, b):
    i = base.index(a); j = base.index(b, i + 1) if b else len(base)
    return base[i:j]

def sub(text, old, new):
    assert old in text, 'pola tidak ditemukan: ' + old[:70]
    return text.replace(old, new, 1)

consts = cut('const STATUSES', '/* ---------- util ---------- */')
utils = cut('/* ---------- util ---------- */', '/* ---------- data contoh')
mid = cut('const Ctx = createContext(null);', 'function ReportForm()')
hist = cut('function History()', 'function CategoryRow')
cat = cut('function CategoryRow', 'function MasterData()')
exp = cut('function ExportView()', 'function ProofModal')
inst = cut('function InstallGuide', 'function ConnBadge')

hist = sub(hist, "const set = (d, s) => { actions.update('donations', d.id, { verification_status: s, verified_at: s === 'Pending' ? null : new Date().toISOString(), verified_by: s === 'Pending' ? null : me.id }); notify(s === 'Verified' ? 'Donasi disetujui, total dana bertambah' : s === 'Rejected' ? 'Donasi ditolak' : 'Dikembalikan ke status Pending', s === 'Rejected' ? 'bad' : 'ok'); };",
  "const set = async (d, s) => { const ok = await actions.update('donations', d.id, { verification_status: s, verified_at: s === 'Pending' ? null : new Date().toISOString(), verified_by: s === 'Pending' ? null : me.id }); if (ok) notify(s === 'Verified' ? 'Donasi disetujui, total dana bertambah' : s === 'Rejected' ? 'Donasi ditolak' : 'Dikembalikan ke status Pending', s === 'Rejected' ? 'bad' : 'ok'); };")

cat = sub(cat, "onClick={() => { if (!name.trim()) return; actions.update('donation_categories', c.id, { name: name.trim() }); setEdit(false); notify('Kategori diperbarui'); }}",
  "onClick={async () => { if (!name.trim()) return; if (await actions.update('donation_categories', c.id, { name: name.trim() })) { setEdit(false); notify('Kategori diperbarui'); } }}")
cat = sub(cat, "onClick={() => { actions.remove('donation_categories', c.id); notify('Kategori dihapus'); }}",
  "onClick={async () => { if (await actions.remove('donation_categories', c.id)) notify('Kategori dihapus'); }}")

exp = sub(exp, r"const text = [head, ...rows].map((r) => r.map(esc).join(sep)).join('\n');",
  r"""const text = [head, ...rows].map((r) => r.map(esc).join(sep)).join('\n');
  const download = () => { const blob = new Blob(['﻿' + text], { type: 'text/' + (fmt === 'csv' ? 'csv' : 'tab-separated-values') + ';charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rpi-' + ds + '-' + isoDay(Date.now()) + '.' + fmt; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };""")
exp = sub(exp, """<p className="text-[13px] text-muted max-w-xl">Unduhan file diblokir di halaman ini. Salin hasilnya, lalu tempel di Excel, Google Sheets, atau simpan sebagai file {fmt === 'csv' ? '.csv' : '.tsv'}.</p>""",
  """<p className="text-[13px] text-muted max-w-xl">Unduh sebagai file, atau salin lalu tempel ke Excel dan Google Sheets. File CSV terbuka langsung di Excel.</p>""")
exp = sub(exp, """<CopyButton text={text} label={'Salin ' + (fmt === 'csv' ? 'CSV' : 'untuk Excel')} className={CTA} />""",
  """<div className="flex gap-2 flex-wrap"><button className={CTA} onClick={download}><Icon name="Download" size={18} />Unduh {fmt === 'csv' ? '.csv' : '.tsv'}</button><CopyButton text={text} label="Salin" className={GHOST} /></div>""")
exp = sub(exp, 'className="grid gap-2 mt-4 sm:grid-cols-2"', 'className="grid gap-2 mt-4 sm:grid-cols-3"')
exp = sub(exp, """<CopyButton text={text} label="Salin teks kuitansi" className={GHOST} />""",
  """<button className={GHOST} onClick={() => { if (!printReceipt({ d, st, logo })) notify('Izinkan pop-up untuk mencetak kuitansi', 'bad'); }}><Icon name="Printer" size={16} />Cetak / PDF</button>
        <CopyButton text={text} label="Salin teks" className={GHOST} />""")
exp = sub(exp, """<p className="text-[12.5px] text-muted mt-3">Tombol cetak tidak tersedia di halaman ini. Simpan kuitansi dengan screenshot atau kirim teksnya lewat WhatsApp.</p>""", "")

out = P('head.jsx') + consts + utils + P('util2.jsx') + mid + P('report.jsx') + hist + cat + P('master.jsx') + exp + P('proof.jsx') + inst + P('app.jsx')
(root / 'src/app.jsx').write_text(out)
print('src/app.jsx', len(out), 'bytes')
