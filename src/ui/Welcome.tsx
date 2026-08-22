import { TileFace } from './TileFace'
import type { TileId } from '../engine/tiles'

const RACK: TileId[] = ['dr', 'b1', 'c5', 'd9', 'we', 'dg', 'f1', 'c1']

/** The first-ever page: a warm welcome, then in to name your table. */
export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="lobby">
      <div className="lobby-inner">
        <span className="eyebrow welcome-eyebrow">Welcome</span>
        <h1>Let's <span className="accent">play</span></h1>
        <p className="lede">
          Sixteen tiles, five sets and a pair, and the ambition ledger where the money moves.
          Gather your table and play.
        </p>
        <div className="welcome-rack" aria-hidden="true">
          {RACK.map((id, i) => <TileFace key={i} id={id} />)}
        </div>
        <div className="lobby-actions">
          <button className="btn primary big" onClick={onStart}>Get started →</button>
        </div>
      </div>
    </div>
  )
}
