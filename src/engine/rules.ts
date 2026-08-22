/**
 * The house-rule config layer.
 *
 * Every number below is a *default to confirm*, not gospel — Filipino mahjong has
 * no canonical ruleset, so the whole ambition menu is data the settings screen edits.
 * Amounts are in units; the table decides what one unit is worth in pesos.
 */

export type AmbitionId =
  // special winning hands
  | 'escalera' | 'sietePares' | 'fullFlush' | 'bisaklat'
  // bonuses stacked onto a win
  | 'baseWin' | 'concealed' | 'quickWin' | 'allChows' | 'allPungs' | 'paningit'
  // instant / declared on the spot
  | 'concealedKong' | 'openKong' | 'noFlowers' | 'grabKong' | 'flower'

export type AmbitionGroup = 'hand' | 'bonus' | 'instant'

export interface Ambition {
  id: AmbitionId
  name: string
  /** Spanish-Filipino table name, shown in italics next to the English one. */
  alias?: string
  desc: string
  group: AmbitionGroup
  /** 'instant' pays the moment it is declared; 'win' settles with the hand. */
  timing: 'instant' | 'win'
  /** Default payout in units. */
  amount: number
  /** A flat hand value that replaces the base win entirely (bisaklat). */
  flat?: boolean
  enabled: boolean
}

export const AMBITIONS: Ambition[] = [
  {
    id: 'escalera', name: 'Escalera', alias: 'the staircase', group: 'hand', timing: 'win',
    desc: 'A full 1–9 run in one suit — three chows: 123 / 456 / 789.', amount: 0.5, enabled: true,
  },
  {
    id: 'sietePares', name: 'Siete Pares', alias: 'seven pairs', group: 'hand', timing: 'win',
    desc: 'Seven pairs plus one set, in place of the usual five-sets-and-a-pair.', amount: 0.5, enabled: true,
  },
  {
    id: 'fullFlush', name: 'Full Flush', alias: 'un solo palo', group: 'hand', timing: 'win',
    desc: 'The entire hand is a single suit — no honors mixed in.', amount: 0.5, enabled: true,
  },
  {
    id: 'bisaklat', name: 'Bisaklat', alias: 'the jackpot', group: 'hand', timing: 'win',
    desc: 'The starting player wins on the very first deal — nothing drawn, nothing discarded.',
    amount: 20, flat: true, enabled: true,
  },

  {
    id: 'baseWin', name: 'Base win', group: 'bonus', timing: 'win',
    desc: 'Simply completing a valid hand.', amount: 1, enabled: true,
  },
  {
    id: 'concealed', name: 'Concealed hand', group: 'bonus', timing: 'win',
    desc: 'You won with no exposed melds on the table (“all up”).', amount: 0.25, enabled: true,
  },
  {
    id: 'quickWin', name: 'Quick win', group: 'bonus', timing: 'win',
    desc: 'Going out within the first few discards.', amount: 0.5, enabled: true,
  },
  {
    id: 'allChows', name: 'All chows', group: 'bonus', timing: 'win',
    desc: 'Every set is a run — no triplets.', amount: 0.25, enabled: true,
  },
  {
    id: 'allPungs', name: 'All pungs', group: 'bonus', timing: 'win',
    desc: 'Every set is a triplet or kong.', amount: 0.25, enabled: true,
  },
  {
    id: 'paningit', name: 'Paníngit', alias: 'middle wait', group: 'bonus', timing: 'win',
    desc: 'Won on the one tile that fills the gap in a run.', amount: 0.25, enabled: true,
  },

  {
    id: 'concealedKong', name: 'Concealed kong', group: 'instant', timing: 'instant',
    desc: 'Forming a four-of-a-kind hidden in your hand.', amount: 0.5, enabled: true,
  },
  {
    id: 'openKong', name: 'Open / extended kong', group: 'instant', timing: 'instant',
    desc: 'A kong made from a discard, or extending a pung.', amount: 0.25, enabled: true,
  },
  {
    id: 'flower', name: 'Flower drawn', group: 'instant', timing: 'instant',
    desc: 'Every flower or season you turn up pays on the spot. Set to 0 if your table skips it.',
    amount: 0, enabled: true,
  },
  {
    id: 'noFlowers', name: 'No flowers', group: 'instant', timing: 'win',
    desc: 'Winning without ever drawing a flower or season.', amount: 0.25, enabled: true,
  },
  {
    id: 'grabKong', name: 'Grab the kong', group: 'instant', timing: 'win',
    desc: 'Winning off the tile another player uses to extend a kong.', amount: 1, enabled: true,
  },
]

export interface RuleConfig {
  /** Wild cards. Reshapes strategy, win-detection and scoring more than any other rule. */
  jokers: boolean
  /** What one unit is worth, in pesos. */
  unitValue: number
  /** A hand must clear this many units before a win can be declared. 0 = no minimum. */
  minimumToWin: number
  /** Chow from the player on your left only (the standard call), or from anyone. */
  chowFromLeftOnly: boolean
  /** How many total discards still count as a "quick win". */
  quickWinWithin: number
  /** Per-ambition on/off and amount, keyed by id. */
  amounts: Record<AmbitionId, number>
  enabled: Record<AmbitionId, boolean>
}

export function defaultRules(): RuleConfig {
  const amounts = {} as Record<AmbitionId, number>
  const enabled = {} as Record<AmbitionId, boolean>
  for (const a of AMBITIONS) {
    amounts[a.id] = a.amount
    enabled[a.id] = a.enabled
  }
  return {
    jokers: false,
    unitValue: 1,
    minimumToWin: 0,
    chowFromLeftOnly: true,
    quickWinWithin: 4,
    amounts,
    enabled,
  }
}

export function ambition(id: AmbitionId): Ambition {
  const a = AMBITIONS.find((x) => x.id === id)
  if (!a) throw new Error(`unknown ambition: ${id}`)
  return a
}

export function payout(rules: RuleConfig, id: AmbitionId): number {
  return rules.enabled[id] ? rules.amounts[id] : 0
}

/** Units → pesos, rendered the way the table actually says it. */
export function formatUnits(units: number): string {
  const sign = units < 0 ? '−' : ''
  const n = Math.abs(units)
  const whole = Math.floor(n + 1e-9)
  const frac = n - whole
  let fracStr = ''
  if (Math.abs(frac - 0.25) < 1e-6) fracStr = '¼'
  else if (Math.abs(frac - 0.5) < 1e-6) fracStr = '½'
  else if (Math.abs(frac - 0.75) < 1e-6) fracStr = '¾'
  else if (frac > 1e-6) fracStr = frac.toFixed(2).slice(1)
  if (whole === 0 && fracStr) return `${sign}${fracStr}`
  return `${sign}${whole}${fracStr}`
}

export function formatPesos(units: number, unitValue: number): string {
  const v = units * unitValue
  const sign = v < 0 ? '−' : ''
  const abs = Math.abs(v)
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(2)
  return `${sign}₱${str}`
}
