/**
 * 16-tile win detection.
 *
 * A Filipino hand is 16 tiles and goes out on the 17th: FIVE sets plus one pair.
 * That is genuinely different logic from the 13-tile, four-sets-and-a-pair hand,
 * so none of the usual Hong Kong shortcuts apply.
 *
 * Siete pares (seven pairs + one set) is an alternative shape for the same 17 tiles.
 * Jokers, when the table plays them, substitute for any tile inside a set or pair.
 */

import { idOf, indexOf, isSuit, rankOf, suitOf, type TileId } from './tiles'

export const SETS_TO_WIN = 5
export const HAND_SIZE = 16

export type GroupKind = 'chow' | 'pung' | 'kong' | 'pair'

export interface Group {
  kind: GroupKind
  /** Tile-kind indices (0..33). A chow is [i, i+1, i+2]. */
  tiles: number[]
  /** How many of the slots above were filled by a joker. */
  jokers: number
  concealed: boolean
}

/** Shape of a completed hand. */
export type WinShape = 'standard' | 'sietePares'

export interface Decomposition {
  shape: WinShape
  groups: Group[]
}

const firstNonZero = (c: number[]): number => {
  for (let i = 0; i < 34; i++) if (c[i] > 0) return i
  return -1
}

/** A chow can only start where the suit has room for i+1 and i+2. */
const canStartChow = (i: number): boolean => i < 27 && i % 9 <= 6

/**
 * Consume the whole count vector into exactly `setsLeft` sets and `pairsLeft`
 * pairs, spending every joker. Returns the groups, or null if impossible.
 */
function search(c: number[], setsLeft: number, pairsLeft: number, jokers: number): Group[] | null {
  if (setsLeft === 0 && pairsLeft === 0) {
    return c.every((n) => n === 0) && jokers === 0 ? [] : null
  }

  const i = firstNonZero(c)
  if (i === -1) {
    // Only jokers are left — they can stand in for whole sets and pairs.
    if (jokers !== setsLeft * 3 + pairsLeft * 2) return null
    const groups: Group[] = []
    for (let s = 0; s < setsLeft; s++) groups.push({ kind: 'pung', tiles: [], jokers: 3, concealed: true })
    for (let p = 0; p < pairsLeft; p++) groups.push({ kind: 'pair', tiles: [], jokers: 2, concealed: true })
    return groups
  }

  // Pair using the lowest remaining tile.
  if (pairsLeft > 0) {
    for (let useJ = 0; useJ <= Math.min(1, jokers); useJ++) {
      const need = 2 - useJ
      if (c[i] < need) continue
      c[i] -= need
      const rest = search(c, setsLeft, pairsLeft - 1, jokers - useJ)
      c[i] += need
      if (rest) return [{ kind: 'pair', tiles: [i, i], jokers: useJ, concealed: true }, ...rest]
    }
  }

  if (setsLeft > 0) {
    // Pung.
    for (let useJ = 0; useJ <= Math.min(2, jokers); useJ++) {
      const need = 3 - useJ
      if (c[i] < need) continue
      c[i] -= need
      const rest = search(c, setsLeft - 1, pairsLeft, jokers - useJ)
      c[i] += need
      if (rest) return [{ kind: 'pung', tiles: [i, i, i], jokers: useJ, concealed: true }, ...rest]
    }

    // Chow. `i` itself is always a real tile — it is the lowest one left.
    if (canStartChow(i)) {
      for (const j1 of [0, 1]) {
        for (const j2 of [0, 1]) {
          const useJ = j1 + j2
          if (useJ > jokers) continue
          if (!j1 && c[i + 1] < 1) continue
          if (!j2 && c[i + 2] < 1) continue
          c[i]--
          if (!j1) c[i + 1]--
          if (!j2) c[i + 2]--
          const rest = search(c, setsLeft - 1, pairsLeft, jokers - useJ)
          c[i]++
          if (!j1) c[i + 1]++
          if (!j2) c[i + 2]++
          if (rest) return [{ kind: 'chow', tiles: [i, i + 1, i + 2], jokers: useJ, concealed: true }, ...rest]
        }
      }
    }
  }

  return null
}

/**
 * Seven pairs plus one set. The seven pairs must be seven *distinct* kinds —
 * a four-of-a-kind does not quietly count as two pairs.
 */
function searchSietePares(c: number[], jokers: number): Group[] | null {
  /** After the one set is removed, the rest must be seven distinct pairs. */
  const sevenPairs = (spareJokers: number): Group[] | null => {
    let spare = spareJokers
    const pairs: Group[] = []
    for (let i = 0; i < 34; i++) {
      if (c[i] === 0) continue
      if (c[i] === 2) pairs.push({ kind: 'pair', tiles: [i, i], jokers: 0, concealed: true })
      else if (c[i] === 1 && spare > 0) {
        spare--
        pairs.push({ kind: 'pair', tiles: [i, i], jokers: 1, concealed: true })
      } else return null // a singleton with no joker, or a count of 3 or 4
    }
    while (pairs.length < 7 && spare >= 2) {
      spare -= 2
      pairs.push({ kind: 'pair', tiles: [], jokers: 2, concealed: true })
    }
    return pairs.length === 7 && spare === 0 ? pairs : null
  }

  for (let i = 0; i < 34; i++) {
    // Pung as the one set.
    for (let useJ = 0; useJ <= Math.min(2, jokers); useJ++) {
      const need = 3 - useJ
      if (c[i] < need) continue
      c[i] -= need
      const pairs = sevenPairs(jokers - useJ)
      c[i] += need
      if (pairs) return [{ kind: 'pung', tiles: [i, i, i], jokers: useJ, concealed: true }, ...pairs]
    }

    // Chow as the one set.
    if (!canStartChow(i)) continue
    for (const j0 of [0, 1]) {
      for (const j1 of [0, 1]) {
        for (const j2 of [0, 1]) {
          const useJ = j0 + j1 + j2
          if (useJ > jokers) continue
          if (!j0 && c[i] < 1) continue
          if (!j1 && c[i + 1] < 1) continue
          if (!j2 && c[i + 2] < 1) continue
          if (!j0) c[i]--
          if (!j1) c[i + 1]--
          if (!j2) c[i + 2]--
          const pairs = sevenPairs(jokers - useJ)
          if (!j0) c[i]++
          if (!j1) c[i + 1]++
          if (!j2) c[i + 2]++
          if (pairs) {
            return [{ kind: 'chow', tiles: [i, i + 1, i + 2], jokers: useJ, concealed: true }, ...pairs]
          }
        }
      }
    }
  }
  return null
}

export interface WinInput {
  /** Concealed tiles including the winning tile. */
  concealed: TileId[]
  /** Sets already exposed (or declared concealed kongs), as tile-kind indices. */
  melds: { kind: GroupKind; tiles: number[]; concealed: boolean }[]
  jokersAllowed: boolean
}

/** Every valid way to read the hand, best-scoring first is decided by the caller. */
export function decompose(input: WinInput): Decomposition[] {
  const c = new Array(34).fill(0)
  let jokers = 0
  for (const id of input.concealed) {
    if (id === 'jk') {
      if (input.jokersAllowed) jokers++
      continue
    }
    const i = indexOf(id)
    if (i >= 0) c[i]++
  }

  const out: Decomposition[] = []
  const meldGroups: Group[] = input.melds.map((m) => ({
    kind: m.kind,
    tiles: m.tiles,
    jokers: 0,
    concealed: m.concealed,
  }))

  const setsLeft = SETS_TO_WIN - input.melds.length
  if (setsLeft >= 0) {
    const std = search(c.slice(), setsLeft, 1, jokers)
    if (std) out.push({ shape: 'standard', groups: [...meldGroups, ...std] })
  }

  // Siete pares replaces the whole shape, so it needs a fully concealed hand.
  if (input.melds.length === 0) {
    const sp = searchSietePares(c.slice(), jokers)
    if (sp) out.push({ shape: 'sietePares', groups: sp })
  }

  return out
}

export function isWinningHand(input: WinInput): boolean {
  return decompose(input).length > 0
}

/**
 * Escalera: the hand contains a full 1–9 of one suit read as three chows,
 * with the remainder still completing the hand.
 */
export function hasEscalera(input: WinInput): boolean {
  const c = new Array(34).fill(0)
  let jokers = 0
  for (const id of input.concealed) {
    if (id === 'jk') { if (input.jokersAllowed) jokers++; continue }
    const i = indexOf(id)
    if (i >= 0) c[i]++
  }
  for (const m of input.melds) for (const t of m.tiles) c[t]++

  for (let s = 0; s < 3; s++) {
    const base = s * 9
    let spend = 0
    const copy = c.slice()
    let ok = true
    for (let r = 0; r < 9; r++) {
      if (copy[base + r] > 0) copy[base + r]--
      else if (spend < jokers) spend++
      else { ok = false; break }
    }
    if (!ok) continue
    // Three of the five sets are spoken for; the rest must still resolve.
    if (search(copy, SETS_TO_WIN - 3, 1, jokers - spend)) return true
  }
  return false
}

/** Full flush: every tile in the hand belongs to one suit. Honors disqualify it. */
export function isFullFlush(all: TileId[]): boolean {
  let suit: string | null = null
  for (const id of all) {
    if (id === 'jk') continue
    if (!isSuit(id)) return false
    const s = suitOf(id)!
    if (suit === null) suit = s
    else if (suit !== s) return false
  }
  return suit !== null
}

/** Paníngit: the winning tile filled the gap in the middle of a run. */
export function isMiddleWait(groups: Group[], winningTile: TileId): boolean {
  const w = indexOf(winningTile)
  if (w < 0 || !isSuit(winningTile)) return false
  const r = rankOf(winningTile)
  if (r === 1 || r === 9) return false
  return groups.some((g) => g.kind === 'chow' && g.tiles[1] === w)
}

export function groupLabel(g: Group): string {
  if (g.tiles.length === 0) return 'all-joker set'
  const ids = g.tiles.map((t) => idOf(t))
  return ids.join(' ')
}
