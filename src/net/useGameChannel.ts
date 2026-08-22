import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameState, Move, Seat } from '../engine/game'
import { realtimeReady, supabase } from './supabase'

interface Params {
  code: string
  active: boolean
  isHost: boolean
  /** Has the host actually started a hand? Nothing is broadcast before this. */
  started: boolean
  /** The host's authoritative state (pass null on clients). */
  state: GameState | null
  /** Client: a fresh state snapshot arrived from the host. */
  onRemoteState: (s: GameState) => void
  /** Host: a player is requesting a move. */
  onRemoteMove: (seat: Seat, move: Move) => void
}

/**
 * Broadcast sync for a game. The host publishes full state snapshots on every
 * change; clients render them and send move requests back. No database — it all
 * rides on a Supabase broadcast channel. Inert when realtime isn't available, so
 * the offline/solo game is unaffected.
 */
export function useGameChannel({ code, active, isHost, started, state, onRemoteState, onRemoteMove }: Params) {
  const chan = useRef<RealtimeChannel | null>(null)
  const isHostRef = useRef(isHost)
  const startedRef = useRef(started)
  const stateRef = useRef(state)
  const onState = useRef(onRemoteState)
  const onMove = useRef(onRemoteMove)
  const lastSent = useRef('')
  isHostRef.current = isHost
  startedRef.current = started
  stateRef.current = state
  onState.current = onRemoteState
  onMove.current = onRemoteMove

  useEffect(() => {
    if (!active || !realtimeReady() || !supabase) {
      chan.current = null
      return
    }
    const client = supabase
    const ch = client.channel(`game-${code}`, { config: { broadcast: { self: false } } })
    chan.current = ch

    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (!isHostRef.current && payload?.state) onState.current(payload.state as GameState)
    })
    ch.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (isHostRef.current && payload?.move) onMove.current(payload.seat as Seat, payload.move as Move)
    })
    // A late joiner asks for the current state; the host answers only once a hand is live.
    ch.on('broadcast', { event: 'hello' }, () => {
      if (isHostRef.current && startedRef.current && stateRef.current) {
        void ch.send({ type: 'broadcast', event: 'state', payload: { state: stateRef.current } })
      }
    })

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED' && !isHostRef.current) {
        void ch.send({ type: 'broadcast', event: 'hello', payload: {} })
      }
    })

    return () => {
      chan.current = null
      void client.removeChannel(ch)
    }
    // Only re-subscribe when the room or activity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, active])

  // Host: broadcast state on every change, but only once a hand has started
  // (the engine holds a dealt game from mount — that must not leak pre-start).
  useEffect(() => {
    const ch = chan.current
    if (!ch || !isHost || !started || !state) return
    const snap = JSON.stringify(state)
    if (snap === lastSent.current) return
    lastSent.current = snap
    void ch.send({ type: 'broadcast', event: 'state', payload: { state } })
  }, [state, isHost, started])

  const sendMove = useCallback((seat: Seat, move: Move) => {
    const ch = chan.current
    if (ch) void ch.send({ type: 'broadcast', event: 'move', payload: { seat, move } })
  }, [])

  return { sendMove }
}
