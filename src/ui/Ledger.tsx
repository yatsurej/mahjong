import { useEffect, useRef } from 'react'
import { formatUnits } from '../engine/rules'
import { SEATS, WIND_SHORT, type GameState, type Seat } from '../engine/game'
import { displayName } from './names'

interface Props {
  state: GameState
  open: boolean
  onClose: () => void
  onRoom: () => void
  onNewTable: () => void
  youSeat: Seat | null
  /** Only the host can send everyone back to the room or start a new table. */
  canManage: boolean
}

export function Ledger({ state, open, onClose, onRoom, onNewTable, youSeat, canManage }: Props) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.log.length])

  const cls = (v: number) => (v > 0.0001 ? 'up' : v < -0.0001 ? 'down' : 'flat')

  return (
    <>
      {open && <button className="ledger-scrim" aria-label="Close the ledger" onClick={onClose} />}
      <aside className={`ledger${open ? ' open' : ''}`} aria-label="Ledger">
        <div className="ledger-head">
          <h2>Scores</h2>
          <span className="sub">points</span>
        </div>

        <div className="standings">
          {SEATS.map((seat) => {
            const p = state.players[seat]
            return (
              <div key={seat} className={`standing${seat === state.dealer ? ' dealer' : ''}`}>
                <span className="w">{WIND_SHORT[seat]}</span>
                <span className="n">
                  {displayName(p.name, seat === youSeat)}
                  <small>{p.kind === 'bot' ? 'bot' : 'person'}{seat === state.dealer ? ' · dealer' : ''}</small>
                </span>
                <span className={`v ${cls(p.balance)}`}>
                  {formatUnits(p.balance)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="log" ref={logRef}>
          {state.log.length === 0 && (
            <div className="log-entry">The wall is built. Nothing has happened yet.</div>
          )}
          {state.log.map((e) => (
            <div key={e.id} className={`log-entry ${e.tone}`}>
              <span>{e.text}</span>
              {e.units !== undefined && (
                <span className={`amt ${cls(e.units)}`}>
                  {e.units > 0 ? '+' : ''}{formatUnits(e.units)}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="ledger-foot">
          {canManage && <button className="btn sm" onClick={onRoom}>Room</button>}
          {canManage && <button className="btn sm ghost" onClick={onNewTable}>New table</button>}
          <button className="btn sm ghost drawer-btn" onClick={onClose}>Close</button>
        </div>
      </aside>
    </>
  )
}
