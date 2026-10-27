tailwind.config = {
  theme: { extend: {
    colors: {
      bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)', ink: 'var(--ink)', 'ink-2': 'var(--ink-2)', muted: 'var(--muted)', line: 'var(--line)', brand: 'var(--brand)',
      okbg: 'var(--ok-bg)', okfg: 'var(--ok-fg)', warnbg: 'var(--warn-bg)', warnfg: 'var(--warn-fg)', badbg: 'var(--bad-bg)', badfg: 'var(--bad-fg)', infobg: 'var(--info-bg)', infofg: 'var(--info-fg)'
    },
    fontFamily: { display: ['"Bricolage Grotesque"', 'Figtree', 'system-ui', 'sans-serif'], sans: ['Figtree', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'] }
  } }
};
