/** Small inline SVG icons — crisp at any size, coloured via currentColor. */

export function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" role="img" aria-hidden="true">
      <path d="M5 16 L4 8 L9 12 L12 6 L15 12 L20 8 L19 16 Z" fill="currentColor" />
      <rect x="4.8" y="16.2" width="14.4" height="2.7" rx="0.8" fill="currentColor" />
    </svg>
  )
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" role="img" aria-hidden="true">
      <path
        d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="currentColor"
      />
      <circle cx="8.5" cy="10" r="1.15" fill="var(--jade, #0E5B45)" />
      <circle cx="12" cy="10" r="1.15" fill="var(--jade, #0E5B45)" />
      <circle cx="15.5" cy="10" r="1.15" fill="var(--jade, #0E5B45)" />
    </svg>
  )
}

export function AttachIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3 3 0 0 1 4.24 4.24l-8.49 8.49a1 1 0 0 1-1.41-1.41l7.78-7.78" />
    </svg>
  )
}

export function SoundIcon({ muted, className }: { muted: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1.2em" height="1.2em" role="img" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {muted ? (
        <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <>
          <path d="M15.6 9.2a4.2 4.2 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M18 6.9a7.6 7.6 0 0 1 0 10.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
