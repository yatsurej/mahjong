/**
 * Tile model for a full 144-tile Filipino set:
 *   3 suits x 9 ranks x 4 = 108
 *   7 honors x 4          =  28
 *   4 flowers + 4 seasons =   8
 * Jokers (8) are an optional house rule and sit outside the 144.
 */

export type Suit = 'c' | 'b' | 'd' // characters (man), bamboo, dots (circles)

export type SuitId = `${Suit}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
export type WindId = 'we' | 'ws' | 'ww' | 'wn'
export type DragonId = 'dr' | 'dg' | 'dw'
export type HonorId = WindId | DragonId
export type BonusId = 'f1' | 'f2' | 'f3' | 'f4' | 's1' | 's2' | 's3' | 's4'
export type JokerId = 'jk'
export type TileId = SuitId | HonorId | BonusId | JokerId

/** A physical tile: an id plus a stable identity so the UI can animate it. */
export interface Tile {
  id: TileId
  uid: number
}

export const SUITS: Suit[] = ['c', 'b', 'd']
export const WINDS: WindId[] = ['we', 'ws', 'ww', 'wn']
export const DRAGONS: DragonId[] = ['dr', 'dg', 'dw']
export const HONORS: HonorId[] = [...WINDS, ...DRAGONS]
export const FLOWERS: BonusId[] = ['f1', 'f2', 'f3', 'f4']
export const SEASONS: BonusId[] = ['s1', 's2', 's3', 's4']
export const BONUSES: BonusId[] = [...FLOWERS, ...SEASONS]

/** The 34 tile kinds that can actually live in a hand, in canonical order. */
export const RANKED: TileId[] = [
  ...SUITS.flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => `${s}${r}` as SuitId)),
  ...HONORS,
]

const INDEX = new Map<TileId, number>(RANKED.map((id, i) => [id, i]))

/** 0..33 for hand tiles; -1 for bonuses and jokers, which never enter a set. */
export function indexOf(id: TileId): number {
  return INDEX.get(id) ?? -1
}

export function idOf(index: number): TileId {
  return RANKED[index]
}

export function isSuit(id: TileId): id is SuitId {
  return id.length === 2 && (id[0] === 'c' || id[0] === 'b' || id[0] === 'd') && id[1] >= '1' && id[1] <= '9'
}
export function isHonor(id: TileId): id is HonorId {
  return (HONORS as string[]).includes(id)
}
export function isBonus(id: TileId): id is BonusId {
  return (BONUSES as string[]).includes(id)
}
export function isJoker(id: TileId): id is JokerId {
  return id === 'jk'
}
export function isTerminal(id: TileId): boolean {
  return isSuit(id) && (id[1] === '1' || id[1] === '9')
}
export function suitOf(id: TileId): Suit | null {
  return isSuit(id) ? (id[0] as Suit) : null
}
export function rankOf(id: TileId): number {
  return isSuit(id) ? Number(id[1]) : 0
}

/* ---------- presentation ---------- */

const GLYPHS: Record<string, string> = {
  c1: '\u{1F007}', c2: '\u{1F008}', c3: '\u{1F009}', c4: '\u{1F00A}', c5: '\u{1F00B}',
  c6: '\u{1F00C}', c7: '\u{1F00D}', c8: '\u{1F00E}', c9: '\u{1F00F}',
  b1: '\u{1F010}', b2: '\u{1F011}', b3: '\u{1F012}', b4: '\u{1F013}', b5: '\u{1F014}',
  b6: '\u{1F015}', b7: '\u{1F016}', b8: '\u{1F017}', b9: '\u{1F018}',
  d1: '\u{1F019}', d2: '\u{1F01A}', d3: '\u{1F01B}', d4: '\u{1F01C}', d5: '\u{1F01D}',
  d6: '\u{1F01E}', d7: '\u{1F01F}', d8: '\u{1F020}', d9: '\u{1F021}',
  we: '\u{1F000}', ws: '\u{1F001}', ww: '\u{1F002}', wn: '\u{1F003}',
  dr: '\u{1F004}', dg: '\u{1F005}', dw: '\u{1F006}',
  f1: '\u{1F022}', f2: '\u{1F023}', f3: '\u{1F024}', f4: '\u{1F025}',
  s1: '\u{1F026}', s2: '\u{1F027}', s3: '\u{1F028}', s4: '\u{1F029}',
  jk: '\u{1F02A}',
}

/** U+FE0E keeps the mahjong block in text presentation instead of colour emoji. */
export function glyphOf(id: TileId): string {
  return (GLYPHS[id] ?? '?') + '︎'
}

const NAMES: Record<string, string> = {
  we: 'East Wind', ws: 'South Wind', ww: 'West Wind', wn: 'North Wind',
  dr: 'Red Dragon', dg: 'Green Dragon', dw: 'White Dragon',
  f1: 'Plum', f2: 'Orchid', f3: 'Chrysanthemum', f4: 'Bamboo',
  s1: 'Spring', s2: 'Summer', s3: 'Autumn', s4: 'Winter',
  jk: 'Joker',
}
const SUIT_NAMES: Record<Suit, string> = { c: 'Characters', b: 'Bamboo', d: 'Circles' }

export function nameOf(id: TileId): string {
  if (isSuit(id)) return `${rankOf(id)} ${SUIT_NAMES[id[0] as Suit]}`
  return NAMES[id] ?? id
}

/** Colour family used by the tile face. */
export function toneOf(id: TileId): 'red' | 'jade' | 'ink' | 'gold' {
  if (id === 'dr' || isJoker(id)) return 'red'
  if (id === 'dg' || suitOf(id) === 'b') return 'jade'
  if (isBonus(id)) return 'gold'
  return 'ink'
}

/* ---------- the wall ---------- */

export function buildWall(opts: { jokers: boolean }): Tile[] {
  const ids: TileId[] = []
  for (const id of RANKED) for (let i = 0; i < 4; i++) ids.push(id)
  for (const id of BONUSES) ids.push(id)
  if (opts.jokers) for (let i = 0; i < 8; i++) ids.push('jk')
  return ids.map((id, uid) => ({ id, uid }))
}

/** Mulberry32 — small, seedable, so a hand can be replayed exactly. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Sort into the order a player would actually rack up: suits, then honors. */
export function sortTiles(tiles: Tile[]): Tile[] {
  return tiles.slice().sort((a, b) => {
    const ia = indexOf(a.id)
    const ib = indexOf(b.id)
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    return a.uid - b.uid
  })
}

/** Count vector over the 34 hand-tile kinds. Bonuses/jokers are excluded. */
export function counts(ids: TileId[]): number[] {
  const c = new Array(34).fill(0)
  for (const id of ids) {
    const i = indexOf(id)
    if (i >= 0) c[i]++
  }
  return c
}

export function countJokers(ids: TileId[]): number {
  return ids.filter(isJoker).length
}
