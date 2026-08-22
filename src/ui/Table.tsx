import { formatUnits } from '../engine/rules'
import { WIND_SHORT, type GameState, type Meld, type Seat } from '../engine/game'
import { TileBack, TileFace } from './TileFace'
import { displayName } from './names'

function balanceClass(v: number): string {
  return v > 0.0001 ? 'up' : v < -0.0001 ? 'down' : 'flat'
}

export function MeldView({ meld, size = 'sm' }: { meld: Meld; size?: 'xs' | 'sm' }) {
  // A concealed kong lies face-down at both ends — that is how the table reads it.
  const hidden = meld.concealed && meld.kind === 'kong'
  return (
    <div className={`meld${meld.concealed ? ' concealed' : ''}`}>
      {meld.tiles.map((t, i) =>
        hidden && (i === 0 || i === meld.tiles.length - 1)
          ? <TileBack key={t.uid} size={size} />
          : <TileFace key={t.uid} id={t.id} size={size} />,
      )}
    </div>
  )
}

interface SeatProps {
  state: GameState
  seat: Seat
  area: 'l' | 'top' | 'r'
  youSeat: Seat | null
}

export function SeatPanel({ state, seat, area, youSeat }: SeatProps) {
  const p = state.players[seat]
  const name = displayName(p.name, seat === youSeat)
  const isTurn = state.phase === 'action' && state.turn === seat
  const isWaiting = state.phase === 'claim' && !!state.claim && !state.claim.answers[seat]
    && state.claim.offers.some((o) => o.seat === seat)
  const recent = p.discards.slice(-16)

  return (
    <div className={[
      'seat', `seat-${area}`,
      isTurn ? 'active' : '',
      isWaiting ? 'waiting' : '',
      seat === state.dealer ? 'dealer' : '',
    ].filter(Boolean).join(' ')}>
      <div className="seat-head">
        <span className="seat-wind" title={seat === state.dealer ? 'Dealer' : undefined}>{WIND_SHORT[seat]}</span>
        <span className="seat-name" title={name}>{name}</span>
        <span className={`seat-balance ${balanceClass(p.balance)}`}>{formatUnits(p.balance)}</span>
      </div>

      <div className="seat-row">
        <span className="seat-kind">{p.kind === 'bot' ? 'Bot' : 'Person'}</span>
        {isTurn && <span className="seat-kind" style={{ color: 'var(--on-felt)' }}>· thinking</span>}
        {isWaiting && <span className="seat-kind" style={{ color: 'var(--on-felt)' }}>· deciding</span>}
      </div>

      <div className="hand-back" aria-label={`${p.concealed.length} tiles in hand`}>
        {p.concealed.map((t) => <TileBack key={t.uid} />)}
      </div>

      {p.melds.length > 0 && (
        <div className="seat-row">
          <span className="seat-label">Exposed</span>
          {p.melds.map((m, i) => <MeldView key={i} meld={m} size="xs" />)}
        </div>
      )}

      {p.bonuses.length > 0 && (
        <div className="seat-row">
          <span className="seat-label">Flowers</span>
          <div className="tiles tight">
            {p.bonuses.map((t) => <TileFace key={t.uid} id={t.id} size="xs" />)}
          </div>
        </div>
      )}

      <div className="seat-row">
        <span className="seat-label">Discards · {p.discards.length}</span>
        <div className="tiles tight seat-discards">
          {recent.map((t) => <TileFace key={t.uid} id={t.id} size="xs" dim />)}
        </div>
      </div>
    </div>
  )
}

export function Pond({ state }: { state: GameState }) {
  const claimed = state.claim
  const live = claimed?.tile ?? state.lastDiscard?.tile ?? null
  const fromSeat = claimed?.from ?? state.lastDiscard?.from ?? null
  const from = fromSeat === null ? null : state.players[fromSeat].name
  const total = state.rules.jokers ? 152 : 144
  const pct = Math.max(0, Math.min(100, (state.wall.length / total) * 100))

  const caption = () => {
    if (!claimed) return <><b>{from}</b> threw this</>
    if (claimed.fromKongExtension) return <><b>{from}</b> is extending a kong with this</>
    return <><b>{from}</b> threw this — the table is deciding</>
  }

  return (
    <div className="pond">
      <div className="pond-wall">
        <b className="mono">{state.wall.length}</b> tiles left in the wall
      </div>
      <div className="pond-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>

      {live ? (
        <div className="pond-live">
          <TileFace key={live.uid} id={live.id} size="lg" fresh={!!claimed} dim={!claimed} />
          <span className="cap">{caption()}</span>
        </div>
      ) : (
        <div className="pond-live">
          <span className="pond-empty">Nothing has been thrown yet.</span>
        </div>
      )}

      <span className="cap" style={{ opacity: .72, fontSize: '.78rem' }}>
        Hand {state.handNumber} ·{' '}
        {state.phase === 'handOver' ? 'the hand is over' : `${state.players[state.turn].name} is on turn`}
      </span>
    </div>
  )
}
