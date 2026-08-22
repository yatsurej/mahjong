import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyMove, awaitingSeats, newGame,
  type GameState, type Move, type NewGameOptions, type Seat,
} from '../engine/game'
import { botClaimChoice, botTurnMove } from '../engine/bot'

const BOT_TURN_MS = 620
const BOT_CLAIM_MS = 340

/**
 * Holds the game and lets the bots take their turns on a human timescale.
 * `paused` freezes them while the hotseat screen is being passed along.
 */
export function useGame(init: NewGameOptions, paused: boolean) {
  const [state, setState] = useState<GameState>(() => newGame(init))

  const dispatch = useCallback((move: Move) => {
    setState((s) => applyMove(s, move))
  }, [])

  const restart = useCallback((opts: NewGameOptions) => {
    setState(newGame(opts))
  }, [])

  /** Adopt an externally-supplied state — used when taking over as host. */
  const adopt = useCallback((next: GameState) => {
    setState(next)
  }, [])

  /** Which seat, if any, the interface is currently waiting on a person for. */
  const humanTurn: Seat | null = useMemo(() => {
    if (state.phase === 'handOver') return null
    if (state.phase === 'claim') {
      return awaitingSeats(state).find((s) => state.players[s].kind === 'human') ?? null
    }
    return state.players[state.turn].kind === 'human' ? state.turn : null
  }, [state])

  useEffect(() => {
    if (paused || state.phase === 'handOver') return

    if (state.phase === 'claim') {
      const seat = awaitingSeats(state).find((s) => state.players[s].kind === 'bot')
      if (seat === undefined) return
      const t = setTimeout(() => {
        dispatch({ type: 'respond', seat, choice: botClaimChoice(state, seat) })
      }, BOT_CLAIM_MS)
      return () => clearTimeout(t)
    }

    if (state.players[state.turn].kind !== 'bot') return
    const t = setTimeout(() => {
      const move = botTurnMove(state, state.turn)
      if (move) dispatch(move)
    }, BOT_TURN_MS)
    return () => clearTimeout(t)
  }, [state, paused, dispatch])

  return { state, dispatch, restart, humanTurn, adopt }
}
