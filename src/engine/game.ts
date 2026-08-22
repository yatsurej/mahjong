/**
 * The game as pure functions: state + move -> new state.
 *
 * Nothing in here knows about React, timers, or the network. The UI renders
 * state and sends moves; a driver (see bot.ts) supplies moves for empty seats.
 */

import {
  buildWall, counts, idOf, indexOf, isBonus, isJoker, makeRng, shuffle, sortTiles,
  type Tile, type TileId,
} from './tiles'
import { defaultRules, type AmbitionId, type RuleConfig } from './rules'
import { instantPayment, scoreWin, type WinResult } from './scoring'
import { HAND_SIZE, isWinningHand, type GroupKind, type WinInput } from './win'

export type Seat = 0 | 1 | 2 | 3
export type SeatKind = 'human' | 'bot'
export const SEATS: Seat[] = [0, 1, 2, 3]
export const WIND_NAMES = ['East', 'South', 'West', 'North'] as const
export const WIND_SHORT = ['E', 'S', 'W', 'N'] as const

export const next = (s: Seat): Seat => ((s + 1) % 4) as Seat
/** The player on your left — the only one you may chow from, by default. */
export const prev = (s: Seat): Seat => ((s + 3) % 4) as Seat

export interface Meld {
  kind: Exclude<GroupKind, 'pair'>
  tiles: Tile[]
  concealed: boolean
  /** Seat the claimed tile came from, or null when formed from hand. */
  from: Seat | null
  /** A pung later promoted to a kong — the tile that promoted it is grabbable. */
  extended?: boolean
}

export interface Player {
  seat: Seat
  name: string
  kind: SeatKind
  concealed: Tile[]
  melds: Meld[]
  bonuses: Tile[]
  discards: Tile[]
  /** Running total in units across the whole session. */
  balance: number
  flowersDrawn: number
}

export interface ClaimOffer {
  seat: Seat
  win: boolean
  pung: boolean
  kong: boolean
  /** Each entry is the pair of tile-kind indices from hand that complete a run. */
  chows: [number, number][]
}

export type ClaimChoice =
  | { kind: 'pass' }
  | { kind: 'win' }
  | { kind: 'pung' }
  | { kind: 'kong' }
  | { kind: 'chow'; with: [number, number] }

export interface ClaimState {
  tile: Tile
  from: Seat
  /** True when the tile was exposed by promoting a pung — a win here grabs the kong. */
  fromKongExtension: boolean
  offers: ClaimOffer[]
  answers: Partial<Record<Seat, ClaimChoice>>
}

export type Phase = 'action' | 'claim' | 'handOver'

export interface LogEntry {
  id: number
  seat: Seat | null
  text: string
  tone: 'plain' | 'money' | 'win' | 'call'
  units?: number
}

export interface HandResult {
  kind: 'win' | 'draw'
  winner?: Seat
  feeder?: Seat | null
  result?: WinResult
}

export interface GameState {
  rules: RuleConfig
  seed: number
  handNumber: number
  dealer: Seat
  turn: Seat
  phase: Phase
  wall: Tile[]
  players: [Player, Player, Player, Player]
  claim: ClaimState | null
  /** The most recent tile thrown, kept on the table so the pond is never blank. */
  lastDiscard: { tile: Tile; from: Seat } | null
  /** Tile just drawn or claimed, kept apart so the UI can highlight it. */
  justDrawn: Tile | null
  discardCount: number
  /** Dealer's opening 17 is already a winning hand — bisaklat is on the table. */
  bisaklatOffered: boolean
  log: LogEntry[]
  result: HandResult | null
  nextLogId: number
}

export interface NewGameOptions {
  rules?: RuleConfig
  seats?: { name: string; kind: SeatKind }[]
  seed?: number
  dealer?: Seat
  balances?: [number, number, number, number]
  handNumber?: number
}

const DEFAULT_SEATS: { name: string; kind: SeatKind }[] = [
  { name: 'You', kind: 'human' },
  { name: 'Marisol', kind: 'bot' },
  { name: 'Ador', kind: 'bot' },
  { name: 'Bea', kind: 'bot' },
]

/* ------------------------------------------------------------------ */
/* setup                                                               */
/* ------------------------------------------------------------------ */

export function newGame(opts: NewGameOptions = {}): GameState {
  const rules = opts.rules ?? defaultRules()
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31)
  const dealer = opts.dealer ?? 0
  const seatDefs = opts.seats ?? DEFAULT_SEATS
  const rng = makeRng(seed)
  const wall = shuffle(buildWall({ jokers: rules.jokers }), rng)

  const players = SEATS.map((seat) => ({
    seat,
    name: seatDefs[seat]?.name || WIND_NAMES[seat],
    kind: seatDefs[seat]?.kind ?? 'bot',
    concealed: [] as Tile[],
    melds: [] as Meld[],
    bonuses: [] as Tile[],
    discards: [] as Tile[],
    balance: opts.balances?.[seat] ?? 0,
    flowersDrawn: 0,
  })) as [Player, Player, Player, Player]

  const state: GameState = {
    rules,
    seed,
    handNumber: opts.handNumber ?? 1,
    dealer,
    turn: dealer,
    phase: 'action',
    wall,
    players,
    claim: null,
    lastDiscard: null,
    justDrawn: null,
    discardCount: 0,
    bisaklatOffered: false,
    log: [],
    result: null,
    nextLogId: 1,
  }

  // Deal 16 each, 17 to the dealer, replacing any bonus tiles as they turn up.
  for (let round = 0; round < HAND_SIZE; round++) {
    for (const seat of SEATS) drawInto(state, seat, false)
  }
  drawInto(state, dealer, false)
  for (const seat of SEATS) replaceBonuses(state, seat, false)
  for (const p of state.players) p.concealed = sortTiles(p.concealed)

  state.justDrawn = null
  log(state, dealer, `${state.players[dealer].name} deals and opens as ${WIND_NAMES[dealer]}.`, 'plain')

  if (canDeclareWin(state, dealer)) {
    state.bisaklatOffered = true
    log(state, dealer, 'The opening hand is already complete — bisaklat is live.', 'win')
  }
  return state
}

function log(s: GameState, seat: Seat | null, text: string, tone: LogEntry['tone'], units?: number) {
  s.log.push({ id: s.nextLogId++, seat, text, tone, units })
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200)
}

/* ------------------------------------------------------------------ */
/* drawing                                                             */
/* ------------------------------------------------------------------ */

function drawInto(s: GameState, seat: Seat, fromBack: boolean): Tile | null {
  const tile = fromBack ? s.wall.pop() : s.wall.shift()
  if (!tile) return null
  s.players[seat].concealed.push(tile)
  return tile
}

/** Flowers and seasons are set aside and replaced from the back of the wall. */
function replaceBonuses(s: GameState, seat: Seat, pay: boolean): void {
  const p = s.players[seat]
  for (let guard = 0; guard < 20; guard++) {
    const idx = p.concealed.findIndex((t) => isBonus(t.id))
    if (idx === -1) return
    const [tile] = p.concealed.splice(idx, 1)
    p.bonuses.push(tile)
    p.flowersDrawn++
    if (pay) {
      log(s, seat, `${p.name} turns up a flower.`, 'call')
      settleInstant(s, seat, 'flower')
    }
    if (!drawInto(s, seat, true)) return
  }
}

/** Move the turn on and draw. Returns false when the wall has run out. */
function beginTurn(s: GameState, seat: Seat): void {
  s.turn = seat
  s.claim = null
  const tile = drawInto(s, seat, false)
  if (!tile) {
    endHandAsDraw(s)
    return
  }
  s.justDrawn = tile
  if (isBonus(tile.id)) {
    const p = s.players[seat]
    p.concealed.pop()
    p.bonuses.push(tile)
    p.flowersDrawn++
    log(s, seat, `${p.name} turns up a flower.`, 'call')
    settleInstant(s, seat, 'flower')
    const replacement = drawInto(s, seat, true)
    if (!replacement) {
      endHandAsDraw(s)
      return
    }
    s.justDrawn = replacement
    replaceBonuses(s, seat, true)
    const last = s.players[seat].concealed[s.players[seat].concealed.length - 1]
    s.justDrawn = last ?? null
  }
  s.phase = 'action'
}

function endHandAsDraw(s: GameState): void {
  s.phase = 'handOver'
  s.result = { kind: 'draw' }
  log(s, null, 'The wall is exhausted — the hand is washed out.', 'plain')
}

/* ------------------------------------------------------------------ */
/* money                                                               */
/* ------------------------------------------------------------------ */

function settleInstant(s: GameState, seat: Seat, id: AmbitionId): void {
  const pay = instantPayment(s.rules, seat, id)
  if (pay[seat] === 0) return
  for (const t of SEATS) s.players[t].balance += pay[t]
  const label: Record<string, string> = {
    concealedKong: 'concealed kong', openKong: 'kong', flower: 'flower',
  }
  log(s, seat, `${s.players[seat].name} collects for ${label[id] ?? id}.`, 'money', pay[seat])
}

/* ------------------------------------------------------------------ */
/* queries the UI and the bots both use                                */
/* ------------------------------------------------------------------ */

export function handIds(p: Player): TileId[] {
  return p.concealed.map((t) => t.id)
}

/** Every tile the player holds, melds included — used by the flush check. */
export function allIds(p: Player): TileId[] {
  return [...p.concealed.map((t) => t.id), ...p.melds.flatMap((m) => m.tiles.map((t) => t.id))]
}

function meldsForWin(p: Player): WinInput['melds'] {
  return p.melds.map((m) => ({
    kind: m.kind,
    tiles: m.kind === 'chow'
      ? m.tiles.map((t) => indexOf(t.id)).sort((a, b) => a - b)
      : [indexOf(m.tiles[0].id), indexOf(m.tiles[0].id), indexOf(m.tiles[0].id)],
    concealed: m.concealed,
  }))
}

export function winInputFor(s: GameState, seat: Seat, extra?: TileId): WinInput {
  const p = s.players[seat]
  const concealed = handIds(p)
  if (extra) concealed.push(extra)
  return { concealed, melds: meldsForWin(p), jokersAllowed: s.rules.jokers }
}

/** Would this hand go out right now, and clear any table minimum? */
export function canDeclareWin(s: GameState, seat: Seat, extra?: TileId): boolean {
  const input = winInputFor(s, seat, extra)
  if (!isWinningHand(input)) return false
  if (s.rules.minimumToWin <= 0) return true
  const preview = previewWin(s, seat, extra ?? null, null, false)
  return !!preview && preview.units >= s.rules.minimumToWin
}

function previewWin(
  s: GameState, seat: Seat, extra: TileId | null, feeder: Seat | null, grabbedKong: boolean,
): WinResult | null {
  const p = s.players[seat]
  const input = winInputFor(s, seat, extra ?? undefined)
  const all = allIds(p)
  if (extra) all.push(extra)
  return scoreWin(input, {
    rules: s.rules,
    winner: seat,
    feeder,
    winningTile: extra ?? (s.justDrawn?.id as TileId) ?? all[all.length - 1],
    discardCount: s.discardCount,
    flowersDrawn: p.flowersDrawn,
    grabbedKong,
    bisaklat: s.bisaklatOffered && seat === s.dealer && s.discardCount === 0,
    allTiles: all,
  })
}

/** Concealed kongs available from the tiles in hand right now. */
export function concealedKongOptions(p: Player): TileId[] {
  const seen = new Map<TileId, number>()
  for (const t of p.concealed) {
    if (isJoker(t.id) || isBonus(t.id)) continue
    seen.set(t.id, (seen.get(t.id) ?? 0) + 1)
  }
  const out: TileId[] = []
  for (const [id, n] of seen) if (n >= 4) out.push(id)
  return out
}

/** Pungs already on the table that the tile in hand could promote to a kong. */
export function extendKongOptions(p: Player): TileId[] {
  const held = new Set(p.concealed.map((t) => t.id))
  return p.melds.filter((m) => m.kind === 'pung' && held.has(m.tiles[0].id)).map((m) => m.tiles[0].id)
}

function offersFor(s: GameState, discarder: Seat, tile: Tile): ClaimOffer[] {
  const offers: ClaimOffer[] = []
  const ti = indexOf(tile.id)
  for (const seat of SEATS) {
    if (seat === discarder) continue
    const p = s.players[seat]
    const c = counts(handIds(p))
    const win = canDeclareWin(s, seat, tile.id)
    const pung = ti >= 0 && c[ti] >= 2
    const kong = ti >= 0 && c[ti] >= 3
    const chows: [number, number][] = []
    const mayChow = !s.rules.chowFromLeftOnly || discarder === prev(seat)
    if (mayChow && ti >= 0 && ti < 27) {
      const r = ti % 9
      const pairs: [number, number][] = [[ti - 2, ti - 1], [ti - 1, ti + 1], [ti + 1, ti + 2]]
      const bounds: boolean[] = [r >= 2, r >= 1 && r <= 7, r <= 6]
      pairs.forEach((pair, k) => {
        if (bounds[k] && c[pair[0]] > 0 && c[pair[1]] > 0) chows.push(pair)
      })
    }
    if (win || pung || kong || chows.length) offers.push({ seat, win, pung, kong, chows })
  }
  return offers
}

/* ------------------------------------------------------------------ */
/* moves                                                               */
/* ------------------------------------------------------------------ */

export type Move =
  | { type: 'discard'; uid: number }
  | { type: 'declareWin' }
  | { type: 'concealedKong'; tile: TileId }
  | { type: 'extendKong'; tile: TileId }
  | { type: 'respond'; seat: Seat; choice: ClaimChoice }
  | { type: 'nextHand' }

export function applyMove(state: GameState, move: Move): GameState {
  const s = clone(state)
  switch (move.type) {
    case 'discard': return doDiscard(s, move.uid)
    case 'declareWin': return doSelfDrawWin(s)
    case 'concealedKong': return doConcealedKong(s, move.tile)
    case 'extendKong': return doExtendKong(s, move.tile)
    case 'respond': return doRespond(s, move.seat, move.choice)
    case 'nextHand': return doNextHand(s)
  }
}

function doDiscard(s: GameState, uid: number): GameState {
  if (s.phase !== 'action') return s
  const p = s.players[s.turn]
  const idx = p.concealed.findIndex((t) => t.uid === uid)
  if (idx === -1) return s
  const [tile] = p.concealed.splice(idx, 1)
  p.concealed = sortTiles(p.concealed)
  p.discards.push(tile)
  s.discardCount++
  s.lastDiscard = { tile, from: s.turn }
  s.justDrawn = null
  s.bisaklatOffered = false

  const offers = offersFor(s, s.turn, tile)
  if (offers.length === 0) {
    beginTurn(s, next(s.turn))
    return s
  }
  s.phase = 'claim'
  s.claim = { tile, from: s.turn, fromKongExtension: false, offers, answers: {} }
  return s
}

function doSelfDrawWin(s: GameState): GameState {
  if (s.phase !== 'action') return s
  const seat = s.turn
  if (!canDeclareWin(s, seat)) return s
  const result = previewWin(s, seat, null, null, false)
  if (!result) return s
  return finishHand(s, seat, null, result)
}

function doConcealedKong(s: GameState, id: TileId): GameState {
  if (s.phase !== 'action') return s
  const p = s.players[s.turn]
  const picked: Tile[] = []
  p.concealed = p.concealed.filter((t) => {
    if (t.id === id && picked.length < 4) { picked.push(t); return false }
    return true
  })
  if (picked.length < 4) { p.concealed.push(...picked); p.concealed = sortTiles(p.concealed); return s }
  p.melds.push({ kind: 'kong', tiles: picked, concealed: true, from: null })
  log(s, s.turn, `${p.name} declares a concealed kong.`, 'call')
  settleInstant(s, s.turn, 'concealedKong')
  const replacement = drawInto(s, s.turn, true)
  if (!replacement) return (endHandAsDraw(s), s)
  s.justDrawn = replacement
  replaceBonuses(s, s.turn, true)
  p.concealed = sortTiles(p.concealed)
  return s
}

function doExtendKong(s: GameState, id: TileId): GameState {
  if (s.phase !== 'action') return s
  const seat = s.turn
  const p = s.players[seat]
  const meld = p.melds.find((m) => m.kind === 'pung' && m.tiles[0].id === id)
  const idx = p.concealed.findIndex((t) => t.id === id)
  if (!meld || idx === -1) return s
  const [tile] = p.concealed.splice(idx, 1)

  // Anyone waiting on this tile may grab the kong before it lands.
  const offers = offersFor(s, seat, tile).filter((o) => o.win)
  if (offers.length > 0) {
    s.phase = 'claim'
    s.claim = {
      tile, from: seat, fromKongExtension: true,
      offers: offers.map((o) => ({ ...o, pung: false, kong: false, chows: [] })),
      answers: {},
    }
    meld.tiles.push(tile)
    meld.kind = 'kong'
    meld.extended = true
    return s
  }

  meld.tiles.push(tile)
  meld.kind = 'kong'
  meld.extended = true
  log(s, seat, `${p.name} extends a pung into a kong.`, 'call')
  settleInstant(s, seat, 'openKong')
  const replacement = drawInto(s, seat, true)
  if (!replacement) return (endHandAsDraw(s), s)
  s.justDrawn = replacement
  replaceBonuses(s, seat, true)
  p.concealed = sortTiles(p.concealed)
  return s
}

function doRespond(s: GameState, seat: Seat, choice: ClaimChoice): GameState {
  if (s.phase !== 'claim' || !s.claim) return s
  if (!s.claim.offers.some((o) => o.seat === seat)) return s
  s.claim.answers[seat] = choice
  const everyoneAnswered = s.claim.offers.every((o) => s.claim!.answers[o.seat])
  if (!everyoneAnswered) return s
  return resolveClaims(s)
}

const PRIORITY: Record<ClaimChoice['kind'], number> = { win: 4, kong: 3, pung: 2, chow: 1, pass: 0 }

function resolveClaims(s: GameState): GameState {
  const claim = s.claim!
  const order: Seat[] = [1, 2, 3].map((n) => ((claim.from + n) % 4) as Seat)
  let best: { seat: Seat; choice: ClaimChoice } | null = null
  for (const seat of order) {
    const choice = claim.answers[seat]
    if (!choice || choice.kind === 'pass') continue
    if (!best || PRIORITY[choice.kind] > PRIORITY[best.choice.kind]) best = { seat, choice }
  }

  if (!best) {
    if (claim.fromKongExtension) {
      // Nobody grabbed it — the kong stands and the turn continues.
      const p = s.players[claim.from]
      log(s, claim.from, `${p.name} extends a pung into a kong.`, 'call')
      settleInstant(s, claim.from, 'openKong')
      s.claim = null
      s.phase = 'action'
      const replacement = drawInto(s, claim.from, true)
      if (!replacement) return (endHandAsDraw(s), s)
      s.justDrawn = replacement
      replaceBonuses(s, claim.from, true)
      p.concealed = sortTiles(p.concealed)
      return s
    }
    beginTurn(s, next(claim.from))
    return s
  }

  const { seat, choice } = best
  const p = s.players[seat]

  if (choice.kind === 'win') {
    const result = previewWin(s, seat, claim.tile.id, claim.from, claim.fromKongExtension)
    if (!result) {
      // The claim does not actually stand up — treat it as a pass and re-resolve.
      claim.answers[seat] = { kind: 'pass' }
      return resolveClaims(s)
    }
    if (claim.fromKongExtension) {
      const meld = s.players[claim.from].melds.find(
        (m) => m.extended && m.tiles.some((t) => t.uid === claim.tile.uid),
      )
      if (meld) {
        meld.tiles = meld.tiles.filter((t) => t.uid !== claim.tile.uid)
        meld.kind = 'pung'
        meld.extended = false
      }
    } else {
      removeFromDiscards(s, claim.from, claim.tile.uid)
    }
    p.concealed.push(claim.tile)
    p.concealed = sortTiles(p.concealed)
    return finishHand(s, seat, claim.from, result)
  }

  /** Pull the named tiles out of hand, or put them all back and give up. */
  const take = (ids: TileId[]): Tile[] | null => {
    const picked: Tile[] = []
    for (const id of ids) {
      const i = p.concealed.findIndex((t) => t.id === id)
      if (i === -1) {
        p.concealed.push(...picked)
        p.concealed = sortTiles(p.concealed)
        return null
      }
      picked.push(p.concealed.splice(i, 1)[0])
    }
    return picked
  }

  let meld: Meld | null = null
  if (choice.kind === 'chow') {
    const picked = take([idOf(choice.with[0]), idOf(choice.with[1])])
    if (picked) {
      const tiles = [...picked, claim.tile].sort((x, y) => indexOf(x.id) - indexOf(y.id))
      meld = { kind: 'chow', tiles, concealed: false, from: claim.from }
      log(s, seat, `${p.name} chows.`, 'call')
    }
  } else if (choice.kind === 'pung') {
    const picked = take([claim.tile.id, claim.tile.id])
    if (picked) {
      meld = { kind: 'pung', tiles: [...picked, claim.tile], concealed: false, from: claim.from }
      log(s, seat, `${p.name} pungs.`, 'call')
    }
  } else {
    const picked = take([claim.tile.id, claim.tile.id, claim.tile.id])
    if (picked) {
      meld = { kind: 'kong', tiles: [...picked, claim.tile], concealed: false, from: claim.from }
      log(s, seat, `${p.name} kongs off the discard.`, 'call')
    }
  }

  if (!meld) {
    // Could not actually form the set — the tile stays where it fell.
    beginTurn(s, next(claim.from))
    return s
  }

  removeFromDiscards(s, claim.from, claim.tile.uid)
  p.melds.push(meld)
  p.concealed = sortTiles(p.concealed)
  s.claim = null
  s.turn = seat
  s.phase = 'action'
  s.justDrawn = null

  if (meld.kind === 'kong') {
    settleInstant(s, seat, 'openKong')
    const replacement = drawInto(s, seat, true)
    if (!replacement) return (endHandAsDraw(s), s)
    s.justDrawn = replacement
    replaceBonuses(s, seat, true)
    p.concealed = sortTiles(p.concealed)
  }
  return s
}

function removeFromDiscards(s: GameState, seat: Seat, uid: number): void {
  const d = s.players[seat].discards
  const at = d.findIndex((t) => t.uid === uid)
  if (at >= 0) d.splice(at, 1)
  if (s.lastDiscard?.tile.uid === uid) s.lastDiscard = null
}

function finishHand(s: GameState, winner: Seat, feeder: Seat | null, result: WinResult): GameState {
  for (const seat of SEATS) s.players[seat].balance += result.payments[seat]
  s.phase = 'handOver'
  s.claim = null
  s.justDrawn = null
  s.result = { kind: 'win', winner, feeder, result }
  const how = feeder === null ? 'off the wall' : `off ${s.players[feeder].name}`
  log(s, winner, `${s.players[winner].name} wins ${how}.`, 'win', result.payments[winner])
  return s
}

function doNextHand(s: GameState): GameState {
  const dealerKeeps = s.result?.kind === 'win' && s.result.winner === s.dealer
  const dealer = dealerKeeps ? s.dealer : next(s.dealer)
  return newGame({
    rules: s.rules,
    seats: s.players.map((p) => ({ name: p.name, kind: p.kind })),
    dealer,
    balances: s.players.map((p) => p.balance) as [number, number, number, number],
    handNumber: s.handNumber + 1,
  })
}

/* ------------------------------------------------------------------ */

function clone(s: GameState): GameState {
  return {
    ...s,
    wall: s.wall.slice(),
    players: s.players.map((p) => ({
      ...p,
      concealed: p.concealed.slice(),
      melds: p.melds.map((m) => ({ ...m, tiles: m.tiles.slice() })),
      bonuses: p.bonuses.slice(),
      discards: p.discards.slice(),
    })) as [Player, Player, Player, Player],
    lastDiscard: s.lastDiscard ? { ...s.lastDiscard } : null,
    claim: s.claim ? { ...s.claim, offers: s.claim.offers.map((o) => ({ ...o })), answers: { ...s.claim.answers } } : null,
    log: s.log.slice(),
    result: s.result ? { ...s.result } : null,
  }
}

/** Seats still owing an answer to the tile on the table. */
export function awaitingSeats(s: GameState): Seat[] {
  if (s.phase !== 'claim' || !s.claim) return []
  return s.claim.offers.filter((o) => !s.claim!.answers[o.seat]).map((o) => o.seat)
}

export function offerFor(s: GameState, seat: Seat): ClaimOffer | null {
  if (s.phase !== 'claim' || !s.claim) return null
  if (s.claim.answers[seat]) return null
  return s.claim.offers.find((o) => o.seat === seat) ?? null
}
