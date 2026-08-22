/**
 * Turning a completed hand into money.
 *
 * Two payment shapes, and the difference is the whole reason self-draw is prized:
 *   self-draw   — all three opponents pay the hand value
 *   off a discard — the feeder pays double, the other two pay single
 */

import { payout, type AmbitionId, type RuleConfig } from './rules'
import {
  decompose, hasEscalera, isFullFlush, isMiddleWait,
  type Decomposition, type Group, type WinInput,
} from './win'
import { idOf, type TileId } from './tiles'

export interface ScoreLine {
  id: AmbitionId
  name: string
  units: number
}

export interface WinResult {
  shape: Decomposition['shape']
  groups: Group[]
  lines: ScoreLine[]
  /** Total hand value in units, before the feeder multiplier. */
  units: number
  /** Per-seat change in units, index = seat. */
  payments: [number, number, number, number]
  flat: boolean
}

export interface ScoreContext {
  rules: RuleConfig
  winner: number
  /** Seat that discarded the winning tile, or null for a self-draw. */
  feeder: number | null
  winningTile: TileId
  /** Total discards made by everyone this hand. */
  discardCount: number
  /** Bonus tiles the winner turned up. */
  flowersDrawn: number
  /** Won off a tile someone used to extend a pung into a kong. */
  grabbedKong: boolean
  /** Dealer went out on the very first deal, nothing drawn or discarded. */
  bisaklat: boolean
  /** Every tile in the winner's hand, melds included, for the flush check. */
  allTiles: TileId[]
}

const NAMES: Record<AmbitionId, string> = {
  escalera: 'Escalera', sietePares: 'Siete Pares', fullFlush: 'Full Flush', bisaklat: 'Bisaklat',
  baseWin: 'Base win', concealed: 'Concealed hand', quickWin: 'Quick win',
  allChows: 'All chows', allPungs: 'All pungs', paningit: 'Paníngit',
  concealedKong: 'Concealed kong', openKong: 'Open / extended kong',
  noFlowers: 'No flowers', grabKong: 'Grab the kong', flower: 'Flower drawn',
}

const add = (lines: ScoreLine[], rules: RuleConfig, id: AmbitionId) => {
  const units = payout(rules, id)
  if (units > 0) lines.push({ id, name: NAMES[id], units })
}

/** Score one reading of the hand. */
function scoreDecomposition(d: Decomposition, input: WinInput, ctx: ScoreContext): WinResult {
  const { rules } = ctx
  const lines: ScoreLine[] = []

  if (ctx.bisaklat && rules.enabled.bisaklat) {
    const units = rules.amounts.bisaklat
    lines.push({ id: 'bisaklat', name: NAMES.bisaklat, units })
    return {
      shape: d.shape, groups: d.groups, lines, units, flat: true,
      payments: spread(ctx.winner, null, units, true),
    }
  }

  add(lines, rules, 'baseWin')

  const exposed = d.groups.filter((g) => !g.concealed)
  if (exposed.length === 0) add(lines, rules, 'concealed')

  if (ctx.discardCount <= rules.quickWinWithin) add(lines, rules, 'quickWin')

  const sets = d.groups.filter((g) => g.kind !== 'pair')
  if (sets.length > 0 && sets.every((g) => g.kind === 'chow')) add(lines, rules, 'allChows')
  if (sets.length > 0 && sets.every((g) => g.kind === 'pung' || g.kind === 'kong')) add(lines, rules, 'allPungs')

  if (isMiddleWait(d.groups, ctx.winningTile)) add(lines, rules, 'paningit')

  if (d.shape === 'sietePares') add(lines, rules, 'sietePares')
  if (isFullFlush(ctx.allTiles)) add(lines, rules, 'fullFlush')
  if (d.shape === 'standard' && hasEscalera(input)) add(lines, rules, 'escalera')

  if (ctx.flowersDrawn === 0) add(lines, rules, 'noFlowers')
  if (ctx.grabbedKong) add(lines, rules, 'grabKong')

  const units = lines.reduce((n, l) => n + l.units, 0)
  return {
    shape: d.shape, groups: d.groups, lines, units, flat: false,
    payments: spread(ctx.winner, ctx.feeder, units, false),
  }
}

/** Feeder pays double; a self-draw collects from everyone. */
function spread(winner: number, feeder: number | null, units: number, flat: boolean): [number, number, number, number] {
  const p: [number, number, number, number] = [0, 0, 0, 0]
  for (let s = 0; s < 4; s++) {
    if (s === winner) continue
    const mult = !flat && feeder !== null && s === feeder ? 2 : 1
    p[s] = -units * mult
    p[winner] += units * mult
  }
  return p
}

/** Best reading of the hand wins — the player is never punished for ambiguity. */
export function scoreWin(input: WinInput, ctx: ScoreContext): WinResult | null {
  const readings = decompose(input)
  if (readings.length === 0) return null
  const scored = readings.map((d) => scoreDecomposition(d, input, ctx))
  scored.sort((a, b) => b.units - a.units)
  return scored[0]
}

/** An instant ambition: everyone at the table pays the declarer, right now. */
export function instantPayment(rules: RuleConfig, seat: number, id: AmbitionId): [number, number, number, number] {
  const units = payout(rules, id)
  const p: [number, number, number, number] = [0, 0, 0, 0]
  if (units <= 0) return p
  for (let s = 0; s < 4; s++) {
    if (s === seat) continue
    p[s] = -units
    p[seat] += units
  }
  return p
}

export function describeGroups(groups: Group[]): string[] {
  return groups.map((g) => {
    if (g.tiles.length === 0) return `${g.kind} (jokers)`
    return g.tiles.map((t) => idOf(t)).join('')
  })
}
