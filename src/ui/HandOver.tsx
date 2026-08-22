import { formatUnits } from '../engine/rules'
import { SEATS, WIND_SHORT, type GameState, type Seat } from '../engine/game'
import { idOf, type TileId } from '../engine/tiles'
import { TileBack, TileFace } from './TileFace'
import { displayName } from './names'
import type { Group } from '../engine/win'

const SHAPE_NAME = { standard: 'Five sets and a pair', sietePares: 'Siete pares' } as const

function GroupView({ g }: { g: Group }) {
  if (g.tiles.length === 0) {
    return (
      <div className="meld">
        {Array.from({ length: g.jokers }, (_, i) => <TileFace key={i} id={'jk'} size="sm" />)}
      </div>
    )
  }
  const real = g.tiles.length - g.jokers
  return (
    <div className={`meld${g.concealed ? ' concealed' : ''}`}>
      {g.tiles.map((t, i) =>
        i < real
          ? <TileFace key={i} id={idOf(t) as TileId} size="sm" />
          : <TileFace key={i} id={'jk'} size="sm" />,
      )}
    </div>
  )
}

interface Props {
  state: GameState
  youSeat: Seat | null
  onNextHand: () => void
}

export function HandOver({ state, youSeat, onNextHand }: Props) {
  const r = state.result
  if (!r) return null

  if (r.kind === 'draw') {
    return (
      <div className="scrim">
        <div className="sheet">
          <div className="sheet-head">
            <span className="eyebrow">Hand {state.handNumber}</span>
            <h2 style={{ marginTop: 10 }}>Washed out</h2>
            <p>The wall ran dry before anyone went out. Nobody pays, nobody collects — the deal passes on.</p>
          </div>
          <div className="sheet-body">
            <div className="tiles" style={{ justifyContent: 'center' }}>
              {Array.from({ length: 8 }, (_, i) => <TileBack key={i} size="sm" />)}
            </div>
          </div>
          <div className="sheet-foot">
            <button className="btn primary" onClick={onNextHand}>Deal the next hand →</button>
          </div>
        </div>
      </div>
    )
  }

  const winner = state.players[r.winner!]
  const win = r.result!
  const feeder = r.feeder === null || r.feeder === undefined ? null : state.players[r.feeder]
  const youWon = r.winner === youSeat
  const title = win.flat
    ? (youWon ? 'You take the jackpot!' : `${winner.name} takes the jackpot`)
    : (youWon ? 'You win!' : `${winner.name} wins the hand`)

  return (
    <div className="scrim">
      <div className="sheet">
        <div className="sheet-head">
          <span className="eyebrow">Hand {state.handNumber} · {SHAPE_NAME[win.shape]}</span>
          <h2 style={{ marginTop: 10 }}>{title}</h2>
          <p>
            {feeder
              ? <>Won on {feeder.name}'s discard — {feeder.name} pays double, the other two pay single.</>
              : <>Won off the wall, so all three opponents pay the full value.</>}
          </p>
        </div>

        <div className="sheet-body">
          <div className="tiles" style={{ gap: 8 }}>
            {win.groups.map((g, i) => <GroupView key={i} g={g} />)}
          </div>

          <div className="score-rows">
            {win.lines.map((l) => (
              <div className="score-row" key={l.id}>
                <span className="n">{l.name}</span>
                <span className="v">{l.units > 0 ? '+' : ''}{formatUnits(l.units)}</span>
              </div>
            ))}
            <div className="score-row total">
              <span className="n">Hand value</span>
              <span className="d">{win.flat ? 'flat jackpot' : 'before the feeder multiplier'}</span>
              <span className="v">{formatUnits(win.units)}</span>
            </div>
          </div>

          <div className="settle">
            {SEATS.map((seat) => {
              const p = state.players[seat]
              const delta = win.payments[seat]
              return (
                <div className="settle-row" key={seat}>
                  <span>
                    <span className="tag" style={{ marginRight: 8 }}>{WIND_SHORT[seat]}</span>
                    {displayName(p.name, seat === youSeat)}
                    {feeder && seat === r.feeder && <span className="tag" style={{ marginLeft: 8 }}>fed the tile</span>}
                  </span>
                  <b className={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}>
                    {delta > 0 ? '+' : ''}{formatUnits(delta)}
                  </b>
                </div>
              )
            })}
          </div>
        </div>

        <div className="sheet-foot">
          <button className="btn primary" onClick={onNextHand}>Deal the next hand →</button>
        </div>
      </div>
    </div>
  )
}
