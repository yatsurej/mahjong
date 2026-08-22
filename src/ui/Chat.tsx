import { useEffect, useRef, useState } from 'react'
import { useChat, type ChatMessage } from '../net/useChat'
import { supabase } from '../net/supabase'
import { AttachIcon, ChatIcon } from './icons'

const BUCKET = 'chat-media'

/** Upload a file to Supabase Storage and return its public URL, or null if the
 *  bucket isn't set up / the upload fails (callers fall back to an inline copy). */
async function uploadMedia(file: File): Promise<string | null> {
  if (!supabase) return null
  try {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'bin'}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (error) return null
    return supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? null
  } catch {
    return null
  }
}

const IMG_URL = /^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i
const GIF_HOST = /^https?:\/\/\S*(giphy\.com|tenor\.com|media\.tenor|media\d?\.giphy)\/\S+/i
const isImageUrl = (t: string) => IMG_URL.test(t.trim()) || GIF_HOST.test(t.trim())

// Keep broadcast payloads well under the realtime message-size limit.
const MAX_DATAURL = 200_000

function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('read failed'))
    r.readAsDataURL(file)
  })
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('image failed'))
    img.src = src
  })
}

/** Turn a picked file into a small shareable data URL, or an error to show. */
async function toShareable(file: File): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith('image/')) return { error: 'Only images and GIFs can be shared.' }
  if (file.type === 'image/gif') {
    const url = await readDataUrl(file)
    if (url.length > MAX_DATAURL) return { error: 'That GIF is too big — paste its link instead.' }
    return { url }
  }
  const raw = await readDataUrl(file)
  const img = await loadImage(raw)
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { error: 'Could not process that image.' }
  ctx.drawImage(img, 0, 0, w, h)
  for (const q of [0.7, 0.5, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length <= MAX_DATAURL) return { url }
  }
  return { error: 'That image is too large to send.' }
}

interface Props {
  code: string
  name: string
  online: boolean
}

export function Chat({ code, name, online }: Props) {
  const { messages, sendText, sendImage, myId, inbound } = useChat({ code, name, active: online })
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [seen, setSeen] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Unread = messages from others since the panel was last open.
  const unread = open ? 0 : Math.max(0, inbound - seen)

  useEffect(() => {
    if (!open) return
    setSeen(inbound)
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [open, inbound])

  if (!online) return null

  const send = () => {
    const t = draft.trim()
    if (!t) return
    if (isImageUrl(t)) sendImage(t)
    else sendText(t)
    setDraft('')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setNote('Only images and GIFs can be shared.'); return }
    setNote('Sending…')
    try {
      // Storage first — no size limit, keeps GIFs animated. Falls back to a small
      // inline copy when the storage bucket isn't set up.
      const uploaded = await uploadMedia(file)
      if (uploaded) { sendImage(uploaded); setNote(null); return }
      const res = await toShareable(file)
      if ('error' in res) setNote(`${res.error} (Enable chat storage to send big files.)`)
      else { sendImage(res.url); setNote(null) }
    } catch {
      setNote('Could not send that file.')
    }
  }

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Open chat">
          <ChatIcon />
          {unread > 0 && (
            <span className="chat-badge" aria-label={`${unread} unread messages`}>{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
      )}
      {open && (
        <aside className="chat" aria-label="Table chat">
          <div className="chat-head">
            <h3>Table chat</h3>
            <button className="btn sm ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="chat-log" ref={listRef}>
            {messages.length === 0 && <p className="chat-empty">No messages yet — say hello 👋</p>}
            {messages.map((m) => <Bubble key={m.id} m={m} mine={m.fromId === myId} />)}
          </div>
          {note && <div className="chat-note">{note}</div>}
          <div className="chat-input">
            <button className="chat-attach" onClick={() => fileRef.current?.click()} aria-label="Add an image or GIF"><AttachIcon /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            <input
              className="field"
              value={draft}
              placeholder="Message, or paste a GIF link"
              aria-label="Message"
              onChange={(e) => { setDraft(e.target.value); setNote(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            />
            <button className="btn sm primary" onClick={send} disabled={!draft.trim()}>Send</button>
          </div>
        </aside>
      )}
    </>
  )
}

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  return (
    <div className={`chat-msg${mine ? ' mine' : ''}`}>
      {!mine && <span className="chat-from">{m.name}</span>}
      {m.kind === 'image'
        ? <a className="chat-img" href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="shared" loading="lazy" /></a>
        : <span className="chat-text">{m.text}</span>}
    </div>
  )
}
