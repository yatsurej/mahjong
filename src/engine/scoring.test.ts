import { describe, expect, it } from 'vitest'
import { instantPayment, scoreWin, type ScoreContext } from './scoring'
import { defaultRules } from './rules'
import type { TileId } from './tiles'

const hand = (s: string): TileId[] => s.split(/\s+/).filter(Boolean) as TileId[]

const ctx = (over: Partial<ScoreContext> = {}): ScoreContext => ({
  rules: defaultRules(),
  winner: 0,
  feeder: null,
  winningTile: 'd5',
  discardCount: 40,
  flowersDrawn: 1,
  grabbedKong: false,
  bisaklat: false,
  allTiles: [],
  ...over,
})

const CHOWS = hand('c1 c2 c3 c4 c5 c6 b1 b2 b3 b4 b5 b6 d1 d2 d3 d9 d9')
const PUNGS = hand('c1 c1 c1 c5 c5 c5 b3 b3 b3 d9 d9 d9 we we we dr dr')

describe('who pays whom', () => {
  it('a self-draw collects the hand value from all three opponents', () => {
    const r = scoreWin({ concealed: CHOWS, melds: [], jokersAllowed: false }, ctx({ allTiles: CHOWS }))!
    expect(r.payments[0]).toBeCloseTo(r.units * 3)
    expect(r.payments[1]).toBeCloseTo(-r.units)
    expect(r.payments[2]).toBeCloseTo(-r.units)
    expect(r.payments[3]).toBeCloseTo(-r.units)
  })

  it('the feeder pays double and the other two pay single', () => {
    const r = scoreWin({ concealed: CHOWS, melds: [], jokersAllowed: false }, ctx({ feeder: 2, allTiles: CHOWS }))!
    expect(r.payments[2]).toBeCloseTo(-r.units * 2)
    expect(r.payments[1]).toBeCloseTo(-r.units)
    expect(r.payments[3]).toBeCloseTo(-r.units)
    expect(r.payments[0]).toBeCloseTo(r.units * 4)
  })

  it('always balances to zero across the table', () => {
    for (const feeder of [null, 1, 2, 3] as const) {
      const r = scoreWin({ concealed: PUNGS, melds: [], jokersAllowed: false }, ctx({ feeder, allTiles: PUNGS }))!
      expect(r.payments.reduce((a, b) => a + b, 0)).toBeCloseTo(0)
    }
  })
})

describe('the ambition menu', () => {
  it('scores a plain all-chows self-draw as base + concealed + all chows', () => {
    const r = scoreWin({ concealed: CHOWS, melds: [], jokersAllowed: false }, ctx({ allTiles: CHOWS }))!
    const ids = r.lines.map((l) => l.id)
    expect(ids).toContain('baseWin')
    expect(ids).toContain('concealed')
    expect(ids).toContain('allChows')
    expect(ids).not.toContain('allPungs')
    expect(r.units).toBeCloseTo(1 + 0.25 + 0.25)
  })

  it('scores all pungs, not all chows', () => {
    const r = scoreWin({ concealed: PUNGS, melds: [], jokersAllowed: false }, ctx({ allTiles: PUNGS }))!
    const ids = r.lines.map((l) => l.id)
    expect(ids).toContain('allPungs')
    expect(ids).not.toContain('allChows')
  })

  it('pays no-flowers only when the winner never turned one up', () => {
    const dry = scoreWin({ concealed: PUNGS, melds: [], jokersAllowed: false }, ctx({ flowersDrawn: 0, allTiles: PUNGS }))!
    expect(dry.lines.map((l) => l.id)).toContain('noFlowers')
    const wet = scoreWin({ concealed: PUNGS, melds: [], jokersAllowed: false }, ctx({ flowersDrawn: 2, allTiles: PUNGS }))!
    expect(wet.lines.map((l) => l.id)).not.toContain('noFlowers')
  })

  it('stacks escalera and full flush on a single-suit staircase', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 c1 c1 c1 c2 c2 c2 c3 c3')
    const r = scoreWin({ concealed: h, melds: [], jokersAllowed: false }, ctx({ allTiles: h }))!
    const ids = r.lines.map((l) => l.id)
    expect(ids).toContain('escalera')
    expect(ids).toContain('fullFlush')
  })

  it('pays quick wins only inside the opening discards', () => {
    const fast = scoreWin({ concealed: PUNGS, melds: [], jokersAllowed: false }, ctx({ discardCount: 2, allTiles: PUNGS }))!
    expect(fast.lines.map((l) => l.id)).toContain('quickWin')
  })

  it('bisaklat is a flat jackpot that replaces the whole score', () => {
    const r = scoreWin({ concealed: PUNGS, melds: [], jokersAllowed: false }, ctx({ bisaklat: true, allTiles: PUNGS }))!
    expect(r.flat).toBe(true)
    expect(r.units).toBe(20)
    expect(r.lines).toHaveLength(1)
    expect(r.payments[0]).toBeCloseTo(60)
  })

  it('honours a disabled ambition', () => {
    const rules = defaultRules()
    rules.enabled.allChows = false
    const r = scoreWin({ concealed: CHOWS, melds: [], jokersAllowed: false }, ctx({ rules, allTiles: CHOWS }))!
    expect(r.lines.map((l) => l.id)).not.toContain('allChows')
  })

  it('reads an ambiguous hand the way that pays best', () => {
    // Seven pairs plus a set is also five sets and a pair here; siete pares pays more.
    const h = hand('c1 c1 c2 c2 c3 c3 c4 c4 c5 c5 c6 c6 c7 c7 d5 d5 d5')
    const r = scoreWin({ concealed: h, melds: [], jokersAllowed: false }, ctx({ allTiles: h }))!
    expect(r.lines.map((l) => l.id)).toContain('sietePares')
  })
})

describe('instant ambitions', () => {
  it('are paid by everyone at the table, on the spot', () => {
    const rules = defaultRules()
    const p = instantPayment(rules, 1, 'concealedKong')
    expect(p[1]).toBeCloseTo(1.5)
    expect(p[0]).toBeCloseTo(-0.5)
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(0)
  })

  it('pay nothing when the table has switched them off', () => {
    const rules = defaultRules()
    rules.enabled.concealedKong = false
    expect(instantPayment(rules, 1, 'concealedKong').every((n) => n === 0)).toBe(true)
  })

  it('flowers pay nothing by default until the table sets an amount', () => {
    expect(instantPayment(defaultRules(), 0, 'flower').every((n) => n === 0)).toBe(true)
  })
})
