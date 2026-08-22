/**
 * Loading state: face-down tiles ripple as the wall is arranged.
 *   variant 'felt' — a scrim over the table (used when dealing a hand)
 *   variant 'page' — a solid page, matching the initial boot loader
 */
export function Dealing({
  label = 'Building the wall',
  variant = 'felt',
  fading = false,
}: {
  label?: string
  variant?: 'felt' | 'page'
  fading?: boolean
}) {
  return (
    <div className={`scrim dealing-scrim ${variant}${fading ? ' fade-out' : ''}`}>
      <div className="dealing">
        <div className="dealing-rack" aria-hidden="true">
          {Array.from({ length: 17 }, (_, i) => (
            <span className="dealing-tile" key={i} style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <p className="dealing-label">
          {label}
          <span className="ellipsis" aria-hidden="true"><i /><i /><i /></span>
        </p>
      </div>
    </div>
  )
}
