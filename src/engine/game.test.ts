import { describe, expect, it } from 'vitest'
import {
  applyMove, awaitingSeats, canDeclareWin, newGame, SEATS,
  type GameState, type Seat,
} from './game'
import { botClaimChoice, botTurnMove } from './bot'
import { defaultRules } from './rules'

const allBots = () => SEATS.map((s) => ({ name: `Bot ${s}`, kind: 'bot' as const }))

describe('the deal', () => {
  it('gives everyone 16 tiles and the dealer 17', () => {
    const s = newGame({ seed: 7, seats: allBots() })
    expect(s.players[s.dealer].concealed).toHaveLength(17)
    for (const seat of SEATS) {
      if (seat === s.dealer) continue
      expect(s.players[seat].concealed).toHaveLength(16)
    }
  })

  it('sets flowers aside and replaces them from the wall', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame({ seed, seats: allBots() })
      for (const p of s.players) {
        expect(p.concealed.some((t) => t.id.startsWith('f') || t.id.startsWith('s'))).toBe(false)
      }
    }
  })

  it('accounts for every one of the 144 tiles', () => {
    const s = newGame({ seed: 3, seats: allBots() })
    const held = s.players.reduce((n, p) => n + p.concealed.length + p.bonuses.length, 0)
    expect(held + s.wall.length).toBe(144)
  })

  it('starts the dealer on turn', () => {
    const s = newGame({ seed: 11, dealer: 2, seats: allBots() })
    expect(s.turn).toBe(2)
    expect(s.phase).toBe('action')
  })
})

describe('a discard', () => {
  it('drops the hand back to 16 when nobody claims', () => {
    let s = newGame({ seed: 5, seats: allBots() })
    const dealer = s.dealer
    const tile = s.players[dealer].concealed[0]
    s = applyMove(s, { type: 'discard', uid: tile.uid })
    expect(s.players[dealer].concealed).toHaveLength(16)
  })
})

/** Drives a whole hand with bots in every seat. */
function playOut(s: GameState, maxSteps = 4000): GameState {
  let steps = 0
  while (s.phase !== 'handOver' && steps++ < maxSteps) {
    if (s.phase === 'claim') {
      const seat = awaitingSeats(s)[0] as Seat | undefined
      if (seat === undefined) break
      s = applyMove(s, { type: 'respond', seat, choice: botClaimChoice(s, seat) })
      continue
    }
    const move = botTurnMove(s, s.turn)
    if (!move) break
    s = applyMove(s, move)
  }
  return s
}

describe('a full hand', () => {
  it('always reaches an ending', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = playOut(newGame({ seed, seats: allBots() }))
      expect(s.phase).toBe('handOver')
      expect(s.result).not.toBeNull()
    }
  })

  it('keeps the money balanced to zero no matter how it ends', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = playOut(newGame({ seed, seats: allBots() }))
      const total = s.players.reduce((n, p) => n + p.balance, 0)
      expect(total).toBeCloseTo(0)
    }
  })

  it('never loses or invents a tile', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = playOut(newGame({ seed, seats: allBots() }))
      const held = s.players.reduce(
        (n, p) => n + p.concealed.length + p.bonuses.length + p.discards.length
          + p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
        0,
      )
      expect(held + s.wall.length).toBe(144)
    }
  })

  it('keeps every concealed hand at a legal size', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let s = newGame({ seed, seats: allBots() })
      for (let step = 0; step < 400 && s.phase !== 'handOver'; step++) {
        for (const p of s.players) {
          const atRest = 16 - 3 * p.melds.length
          expect(p.concealed.length).toBeGreaterThanOrEqual(atRest)
          expect(p.concealed.length).toBeLessThanOrEqual(atRest + 1)
        }
        if (s.phase === 'claim') {
          const seat = awaitingSeats(s)[0] as Seat | undefined
          if (seat === undefined) break
          s = applyMove(s, { type: 'respond', seat, choice: botClaimChoice(s, seat) })
        } else {
          const move = botTurnMove(s, s.turn)
          if (!move) break
          s = applyMove(s, move)
        }
      }
    }
  })

  it('runs the same way twice from the same seed', () => {
    const a = playOut(newGame({ seed: 99, seats: allBots() }))
    const b = playOut(newGame({ seed: 99, seats: allBots() }))
    expect(a.players.map((p) => p.balance)).toEqual(b.players.map((p) => p.balance))
    expect(a.result?.kind).toBe(b.result?.kind)
  })

  it('plays through with jokers on the table', () => {
    const rules = defaultRules()
    rules.jokers = true
    for (let seed = 1; seed <= 15; seed++) {
      const s = playOut(newGame({ seed, seats: allBots(), rules }))
      expect(s.phase).toBe('handOver')
      expect(s.players.reduce((n, p) => n + p.balance, 0)).toBeCloseTo(0)
    }
  })
})

describe('the table minimum', () => {
  it('blocks a win that does not clear it', () => {
    const rules = defaultRules()
    rules.minimumToWin = 99
    let s = newGame({ seed: 4, seats: allBots(), rules })
    // Force a complete hand into a seat and check the minimum still refuses it.
    const ids = 'c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 b2 b2 b2 d5 d5'.split(' ')
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.turn ? { ...p, concealed: ids.map((id, uid) => ({ id: id as never, uid: 900 + uid })) } : p,
      ) as typeof s.players,
    }
    expect(canDeclareWin(s, s.turn)).toBe(false)
    expect(canDeclareWin({ ...s, rules: { ...rules, minimumToWin: 0 } }, s.turn)).toBe(true)
  })
})
