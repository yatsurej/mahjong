import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Seat } from '../engine/game'
import { clientId, realtimeReady, supabase } from './supabase'

export interface RoomMember {
  id: string
  name: string
  seat: Seat | null
  /** The room owner (whoever created it). */
  host: boolean
}

interface Params {
  code: string
  name: string
  seat: Seat
  /** True for the player who created this room. */
  host: boolean
  /** Only connect while we're actually in a room. */
  active: boolean
}

interface RoomState {
  /** Everyone currently present in the room, including you. */
  members: RoomMember[]
  /** True once the realtime channel is live. */
  online: boolean
  /** Whether realtime is even possible in this environment. */
  enabled: boolean
}

/**
 * Presence for a room: publishes {name, seat} and reports everyone else present.
 * When realtime isn't configured it stays quietly empty and the game runs locally.
 */
export function useRoom({ code, name, seat, host, active }: Params): RoomState {
  const [members, setMembers] = useState<RoomMember[]>([])
  const [online, setOnline] = useState(false)
  const idRef = useRef(clientId())
  const channelRef = useRef<RealtimeChannel | null>(null)

  const enabled = realtimeReady()

  // Subscribe once per room; re-tracking of name/seat happens in the effect below.
  useEffect(() => {
    const client = supabase
    if (!active || !enabled || !client) {
      setMembers([])
      setOnline(false)
      return
    }

    const channel = client.channel(`room-${code}`, {
      config: { presence: { key: idRef.current } },
    })
    channelRef.current = channel

    const readPresence = () => {
      const state = channel.presenceState<{ id: string; name: string; seat: Seat | null; host: boolean }>()
      const list: RoomMember[] = []
      for (const key of Object.keys(state)) {
        const metas = state[key]
        const meta = metas[metas.length - 1]
        if (meta) list.push({ id: meta.id ?? key, name: meta.name, seat: meta.seat ?? null, host: !!meta.host })
      }
      setMembers(list)
    }

    channel.on('presence', { event: 'sync' }, readPresence)

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setOnline(true)
        void channel.track({ id: idRef.current, name, seat, host })
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setOnline(false)
      }
    })

    return () => {
      setOnline(false)
      channelRef.current = null
      void client.removeChannel(channel)
    }
    // Intentionally only (re)subscribe on room/active/enabled changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, active, enabled])

  // Push name/seat updates without tearing down the channel.
  useEffect(() => {
    const channel = channelRef.current
    if (channel && online) void channel.track({ id: idRef.current, name, seat, host })
  }, [name, seat, host, online])

  return { members, online, enabled }
}
