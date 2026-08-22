import { WIND_NAMES, type GameState, type Seat } from '../engine/game'
import { TileBack } from './TileFace'

/** Hotseat privacy screen — nobody sees a hand that is not theirs. */
export function Gate({ state, seat, onReady }: { state: GameState; seat: Seat; onReady: () => void }) {
  const p = state.players[seat]
  const waiting = state.phase === 'claim'
  return (
    <div className="scrim">
      <div className="sheet">
        <div className="gate">
          <span className="eyebrow">Pass the screen</span>
          <h2>{p.name}, you're up</h2>
          <div className="rack" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => <TileBack key={i} size="sm" />)}
          </div>
          <p>
            Sitting {WIND_NAMES[seat]}.{' '}
            {waiting
              ? 'Someone has thrown a tile you can claim — take the device before you look.'
              : 'It is your turn to draw and discard. Take the device before you tap ready.'}
          </p>
          <button className="btn primary" onClick={onReady}>I'm {p.name} — show my hand</button>
        </div>
      </div>
    </div>
  )
}
