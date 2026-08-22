/**
 * Bot policy. Deliberately simple and readable: tiles are scored by how much
 * shape they already have around them, and the lowest-value tile goes out.
 * Good enough to make a table feel alive; not trying to be a champion.
 */

import {
  canDeclareWin, concealedKongOptions, extendKongOptions, handIds, offerFor,
  type ClaimChoice, type GameState, type Move, type Seat,
} from './game'
import { counts, idOf, indexOf, isJoker, rankOf, type Tile, type TileId } from './tiles'

const HONOR_START = 27

function tileValue(id: TileId, c: number[]): number {
  if (isJoker(id)) return 10_000
  const i = indexOf(id)
  if (i < 0) return 0
  const n = c[i]
  let v = n >= 4 ? 220 : n >= 3 ? 180 : n === 2 ? 80 : 22

  if (i >= HONOR_START) {
    // A lone honor is the classic first discard; a pair is worth holding.
    if (n === 1) v = 6
    return v
  }

  const r = rankOf(id)
  const at = (offset: number): number => {
    const rr = r + offset
    if (rr < 1 || rr > 9) return 0
    return c[i + offset]
  }
  v += (at(-1) + at(1)) * 16
  v += (at(-2) + at(2)) * 7
  // Middle tiles connect in more directions, so they are worth a little more.
  v += [0, 0, 2, 4, 6, 7, 6, 4, 2, 0][r]
  if (n === 1 && at(-1) + at(1) + at(-2) + at(2) === 0) v -= 10
  return v
}

/** Small stable jitter so identical tiles are not always shed in the same order. */
const jitter = (t: Tile): number => ((t.uid * 2654435761) % 97) / 400

const idAt = (index: number): TileId => idOf(index)

export function chooseDiscard(s: GameState, seat: Seat): Tile | null {
  const p = s.players[seat]
  if (p.concealed.length === 0) return null
  const c = counts(handIds(p))
  let best: Tile | null = null
  let bestScore = Infinity
  for (const t of p.concealed) {
    const score = tileValue(t.id, c) + jitter(t)
    if (score < bestScore) {
      bestScore = score
      best = t
    }
  }
  return best
}

/** What a bot does when it is its turn and it holds the extra tile. */
export function botTurnMove(s: GameState, seat: Seat): Move | null {
  if (s.phase !== 'action' || s.turn !== seat) return null
  if (canDeclareWin(s, seat)) return { type: 'declareWin' }

  const p = s.players[seat]
  const c = counts(handIds(p))

  for (const id of concealedKongOptions(p)) {
    // Keep the kong unless the tile is doing real work inside runs.
    const i = indexOf(id)
    const runUse = i < HONOR_START ? (c[i - 1] ?? 0) + (c[i + 1] ?? 0) : 0
    if (runUse < 2) return { type: 'concealedKong', tile: id }
  }
  const extend = extendKongOptions(p)[0]
  if (extend) return { type: 'extendKong', tile: extend }

  const tile = chooseDiscard(s, seat)
  return tile ? { type: 'discard', uid: tile.uid } : null
}

/** What a bot does with a tile someone just threw. */
export function botClaimChoice(s: GameState, seat: Seat): ClaimChoice {
  const offer = offerFor(s, seat)
  if (!offer) return { kind: 'pass' }
  if (offer.win) return { kind: 'win' }

  const claim = s.claim!
  const p = s.players[seat]
  const c = counts(handIds(p))
  const i = indexOf(claim.tile.id)
  const isHonor = i >= HONOR_START
  const neighbours = isHonor ? 0 : (c[i - 1] ?? 0) + (c[i + 1] ?? 0)

  if (offer.kong && (isHonor || neighbours === 0)) return { kind: 'kong' }
  if (offer.pung && (isHonor || neighbours <= 1 || p.melds.length > 0)) return { kind: 'pung' }

  if (offer.chows.length > 0) {
    // Take a run only when the tiles it consumes are not better used elsewhere.
    const ranked = offer.chows
      .map((pair) => ({ pair, cost: tileValue(idAt(pair[0]), c) + tileValue(idAt(pair[1]), c) }))
      .sort((a, b) => a.cost - b.cost)
    const pick = ranked[0]
    const eager = p.melds.length > 0 || s.wall.length < 40
    if (pick.cost < 140 || eager) return { kind: 'chow', with: pick.pair }
  }
  return { kind: 'pass' }
}
