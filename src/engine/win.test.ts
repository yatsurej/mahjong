import { describe, expect, it } from 'vitest'
import { decompose, hasEscalera, isFullFlush, isMiddleWait, isWinningHand } from './win'
import { buildWall, indexOf, type TileId } from './tiles'

const hand = (s: string): TileId[] => s.split(/\s+/).filter(Boolean) as TileId[]
const plain = (tiles: TileId[], jokersAllowed = false) => ({ concealed: tiles, melds: [], jokersAllowed })

describe('the wall', () => {
  it('is 144 tiles without jokers', () => {
    expect(buildWall({ jokers: false })).toHaveLength(144)
  })
  it('adds 8 jokers when the table plays them', () => {
    expect(buildWall({ jokers: true })).toHaveLength(152)
  })
})

describe('standard 16-tile win: five sets and a pair', () => {
  it('accepts a complete 17-tile hand', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 b2 b2 b2 d5 d5')
    expect(h).toHaveLength(17)
    expect(isWinningHand(plain(h))).toBe(true)
  })

  it('rejects a hand that is one tile short', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 b2 b2 b2 d5')
    expect(isWinningHand(plain(h))).toBe(false)
  })

  it('rejects four sets and a pair — that is the 13-tile game', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 d5 d5')
    expect(isWinningHand(plain(h))).toBe(false)
  })

  it('accepts pungs, chows and honors mixed', () => {
    const h = hand('c1 c1 c1 c2 c2 c2 b3 b4 b5 d7 d8 d9 we we we dr dr')
    expect(isWinningHand(plain(h))).toBe(true)
  })

  it('counts exposed melds against the five sets needed', () => {
    // Two melds on the table, so the concealed part only owes three sets and a pair.
    const concealed = hand('c1 c2 c3 c4 c5 c6 we we we dr dr')
    const melds = [
      { kind: 'pung' as const, tiles: [indexOf('b1'), indexOf('b1'), indexOf('b1')], concealed: false },
      { kind: 'chow' as const, tiles: [indexOf('d7'), indexOf('d8'), indexOf('d9')], concealed: false },
    ]
    expect(isWinningHand({ concealed, melds, jokersAllowed: false })).toBe(true)
  })

  it('rejects a hand with no pair', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 b2 b2 b2 d5 d6')
    expect(isWinningHand(plain(h))).toBe(false)
  })
})

describe('siete pares', () => {
  it('accepts seven distinct pairs plus one set', () => {
    const h = hand('c1 c1 c2 c2 c3 c3 c4 c4 c5 c5 b1 b1 b2 b2 d5 d5 d5')
    expect(h).toHaveLength(17)
    const shapes = decompose(plain(h)).map((d) => d.shape)
    expect(shapes).toContain('sietePares')
  })

  it('does not let a four-of-a-kind stand in for two pairs', () => {
    const h = hand('c1 c1 c1 c1 c2 c2 c3 c3 c4 c4 c5 c5 b1 b1 d5 d5 d5')
    const shapes = decompose(plain(h)).map((d) => d.shape)
    expect(shapes).not.toContain('sietePares')
  })

  it('is off the table once a meld is exposed', () => {
    const concealed = hand('c1 c1 c2 c2 c3 c3 c4 c4 c5 c5 b1 b1 b2 b2')
    const melds = [{ kind: 'pung' as const, tiles: [indexOf('d5'), indexOf('d5'), indexOf('d5')], concealed: false }]
    const shapes = decompose({ concealed, melds, jokersAllowed: false }).map((d) => d.shape)
    expect(shapes).not.toContain('sietePares')
  })
})

describe('escalera', () => {
  it('spots a full 1-9 staircase in one suit', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 b2 b2 b2 d5 d5')
    expect(hasEscalera(plain(h))).toBe(true)
  })

  it('is not fooled by a 1-9 spread across suits', () => {
    const h = hand('c1 c2 c3 b4 b5 b6 d7 d8 d9 b1 b1 b1 b2 b2 b2 d5 d5')
    expect(hasEscalera(plain(h))).toBe(false)
  })
})

describe('full flush', () => {
  it('accepts one suit end to end', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 c1 c1 c1 c2 c2 c3 c3 c3')
    expect(isFullFlush(h)).toBe(true)
  })
  it('rejects a single honor mixed in', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 c1 c1 c1 c2 c2 dr dr dr')
    expect(isFullFlush(h)).toBe(false)
  })
})

describe('jokers as wild cards', () => {
  const h = hand('c1 c1 c1 c2 c2 c2 b3 b4 b5 d7 d8 d9 we we jk dr dr')

  it('completes a set when the table plays them', () => {
    expect(isWinningHand(plain(h, true))).toBe(true)
  })

  it('is dead weight when the table does not', () => {
    expect(isWinningHand(plain(h, false))).toBe(false)
  })

  it('lets three jokers stand as a whole set', () => {
    const j = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 jk jk jk d5 d5')
    expect(isWinningHand(plain(j, true))).toBe(true)
  })
})

describe('paníngit — the middle wait', () => {
  it('fires when the winning tile fills a gap in a run', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 b2 b2 b2 d5 d5')
    const d = decompose(plain(h))[0]
    expect(isMiddleWait(d.groups, 'c5')).toBe(true)
  })
  it('does not fire on a terminal', () => {
    const h = hand('c1 c2 c3 c4 c5 c6 c7 c8 c9 b1 b1 b1 b2 b2 b2 d5 d5')
    const d = decompose(plain(h))[0]
    expect(isMiddleWait(d.groups, 'c1')).toBe(false)
  })
})
