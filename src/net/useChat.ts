import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { clientId, realtimeReady, supabase } from './supabase'

export interface ChatMessage {
  id: string
  fromId: string
  name: string
  kind: 'text' | 'image'
  text?: string
  url?: string
  ts: number
}

const rand = () => Math.random().toString(36).slice(2, 10)

/**
 * Room chat over a Supabase broadcast channel. Text and images (data URLs or
 * pasted links) ride the same ephemeral channel — no storage, no database.
 * History isn't persisted, so a late joiner starts with an empty log.
 */
export function useChat({ code, name, active }: { code: string; name: string; active: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // Monotonic count of messages received from others — drives the unread badge
  // reliably even after the message list hits its cap.
  const [inbound, setInbound] = useState(0)
  const chan = useRef<RealtimeChannel | null>(null)
  const nameRef = useRef(name)
  nameRef.current = name
  const id = clientId()

  useEffect(() => {
    if (!active || !realtimeReady() || !supabase) {
      chan.current = null
      return
    }
    const client = supabase
    const ch = client.channel(`chat-${code}`, { config: { broadcast: { self: false } } })
    chan.current = ch
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      setMessages((m) => [...m.slice(-79), payload as ChatMessage])
      setInbound((n) => n + 1)
    })
    ch.subscribe()
    return () => {
      chan.current = null
      void client.removeChannel(ch)
    }
  }, [code, active])

  const push = (msg: ChatMessage) => {
    setMessages((m) => [...m.slice(-79), msg]) // local echo (self:false on the channel)
    const ch = chan.current
    if (ch) void ch.send({ type: 'broadcast', event: 'msg', payload: msg })
  }

  const sendText = (text: string) => {
    const t = text.trim()
    if (t) push({ id: rand(), fromId: id, name: nameRef.current || 'Player', kind: 'text', text: t, ts: Date.now() })
  }
  const sendImage = (url: string) => {
    push({ id: rand(), fromId: id, name: nameRef.current || 'Player', kind: 'image', url, ts: Date.now() })
  }

  return { messages, sendText, sendImage, myId: id, inbound }
}
