/** A sliding light/dark toggle — a knob that travels between a sun and a moon. */
export function ThemeToggle({ theme, setTheme }: {
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
}) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light' : 'Switch to dark'}
      className="theme-toggle"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <span className="tt-icon tt-sun" aria-hidden="true">☀</span>
      <span className="tt-icon tt-moon" aria-hidden="true">☾</span>
      <span className="tt-knob" aria-hidden="true" />
    </button>
  )
}

/** A plain sliding on/off switch. */
export function Switch({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="sw-knob" aria-hidden="true" />
    </button>
  )
}
