import { useEffect, useRef, useState } from 'react'
import { inviteLink } from './rooms'

/** The shareable invite link with a copy button. Reused wherever a room is shown. */
export function InviteLinkRow({ code }: { code: string }) {
  const link = inviteLink(code)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flash = () => {
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1800)
  }

  const copy = async () => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link)
        flash()
        return
      } catch {
        /* fall through to a manual selection */
      }
    }
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
      try {
        if (typeof document.execCommand === 'function' && document.execCommand('copy')) flash()
      } catch {
        /* leave it selected so it can be copied by hand */
      }
    }
  }

  return (
    <div className="invite">
      <span className="invite-label">Invite link</span>
      <div className="invite-row">
        <input
          ref={inputRef}
          className="field"
          readOnly
          value={link}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className={`btn${copied ? ' primary' : ''}`} onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
