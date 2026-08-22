import { Fragment, useEffect, useState } from 'react'
import {
  canDeclareWin, concealedKongOptions, extendKongOptions, offerFor,
  WIND_SHORT, type GameState, type Move, type Seat,
} from '../engine/game'
import { formatUnits } from '../engine/rules'
import { idOf, nameOf, type TileId } from '../engine/tiles'
import { MeldView } from './Table'
import { TileFace } from './TileFace'
import { displayName } from './names'

interface Props {
  state: GameState
  seat: Seat
  dispatch: (move: Move) => void
  /** False while a bot is thinking or another person holds the screen. */
  interactive: boolean
  youSeat: Seat | null
}

export function YourSide({ state, seat, dispatch, interactive, youSeat }: Props) {
  const p = state.players[seat]
  const [selected, setSelected] = useState<number | null>(null)

  const offer = interactive ? offerFor(state, seat) : null
  const myTurn = interactive && state.phase === 'action' && state.turn === seat
  const canWin = myTurn && canDeclareWin(state, seat)
  const bisaklat = canWin && state.bisaklatOffered && seat === state.dealer
  const kongs = myTurn ? concealedKongOptions(p) : []
  const extends_ = myTurn ? extendKongOptions(p) : []

  // Never leave a stale selection pointing at a tile that has left the hand.
  useEffect(() => {
    if (selected !== null && !p.concealed.some((t) => t.uid === selected)) setSelected(null)
  }, [p.concealed, selected])

  const drawnUid = state.justDrawn && state.turn === seat ? state.justDrawn.uid : null
  const selectedTile = p.concealed.find((t) => t.uid === selected) ?? null

  // Tapping selects (or deselects) a tile — it never discards. Discard is the button.
  const tapTile = (uid: number) => {
    if (!myTurn) return
    setSelected((cur) => (cur === uid ? null : uid))
  }

  return (
    <div className="you">
      <div className="you-head">
        <span className={`who${seat === state.dealer ? ' dealer' : ''}`}>
          <span className="seat-wind">{WIND_SHORT[seat]}</span>
          <span className="name">{displayName(p.name, seat === youSeat)}</span>
        </span>
        {seat === state.dealer && <span className="tag">dealer</span>}
        {p.bonuses.length > 0 && (
          <span className="tiles tight" aria-label="flowers and seasons">
            {p.bonuses.map((t) => <TileFace key={t.uid} id={t.id} size="xs" />)}
          </span>
        )}
        <span className="spacer" />
        <span className={`you-balance ${p.balance > 0 ? 'up' : p.balance < 0 ? 'down' : 'flat'}`}>
          {formatUnits(p.balance)}
        </span>
      </div>

      {p.melds.length > 0 && (
        <div className="you-melds">
          {p.melds.map((m, i) => <MeldView key={i} meld={m} size="sm" />)}
        </div>
      )}

      <div className="hand" role="group" aria-label="Your hand">
        {p.concealed.map((t, i) => {
          const isDrawn = t.uid === drawnUid
          const prevIsDrawn = i > 0 && p.concealed[i - 1].uid === drawnUid
          return (
            <Fragment key={t.uid}>
              {(isDrawn || prevIsDrawn) && <span className="drawn-gap" aria-hidden="true" />}
              <TileFace
                id={t.id}
                fresh={isDrawn}
                selected={t.uid === selected}
                onClick={myTurn ? () => tapTile(t.uid) : undefined}
                disabled={!myTurn}
                label={`${nameOf(t.id)}${t.uid === selected ? ' — selected, use the discard button' : ''}`}
              />
            </Fragment>
          )
        })}
      </div>

      {offer ? (
        <div className="claimbar">
          <span className="lead">
            <TileFace id={state.claim!.tile.id} size="sm" />
            {state.claim!.fromKongExtension ? 'Grab the kong?' : 'Claim it?'}
          </span>
          <span className="spacer" />
          <span className="actions">
            {offer.win && (
              <button className="btn win" onClick={() => dispatch({ type: 'respond', seat, choice: { kind: 'win' } })}>
                Win on it
              </button>
            )}
            {offer.kong && (
              <button className="btn" onClick={() => dispatch({ type: 'respond', seat, choice: { kind: 'kong' } })}>
                Kong
              </button>
            )}
            {offer.pung && (
              <button className="btn" onClick={() => dispatch({ type: 'respond', seat, choice: { kind: 'pung' } })}>
                Pung
              </button>
            )}
            {offer.chows.map((pair, i) => (
              <button
                key={i}
                className="btn"
                onClick={() => dispatch({ type: 'respond', seat, choice: { kind: 'chow', with: pair } })}
              >
                Chow
                <span className="tiles tight" aria-hidden="true">
                  <TileFace id={idOf(pair[0]) as TileId} size="xs" />
                  <TileFace id={idOf(pair[1]) as TileId} size="xs" />
                </span>
              </button>
            ))}
            <button className="btn ghost" onClick={() => dispatch({ type: 'respond', seat, choice: { kind: 'pass' } })}>
              Pass
            </button>
          </span>
        </div>
      ) : (
        <div className="prompt">
          <Status state={state} seat={seat} myTurn={myTurn} selected={selectedTile?.id ?? null} />
          <span className="spacer" />
          <span className="actions">
            {kongs.map((id) => (
              <button key={`k${id}`} className="btn sm" onClick={() => dispatch({ type: 'concealedKong', tile: id })}>
                Concealed kong <TileFace id={id} size="xs" />
              </button>
            ))}
            {extends_.map((id) => (
              <button key={`e${id}`} className="btn sm" onClick={() => dispatch({ type: 'extendKong', tile: id })}>
                Extend kong <TileFace id={id} size="xs" />
              </button>
            ))}
            {canWin && (
              <button className="btn win" onClick={() => dispatch({ type: 'declareWin' })}>
                {bisaklat ? 'Declare bisaklat' : 'Declare the win'}
              </button>
            )}
            {myTurn && selectedTile && (
              <button className="btn primary" onClick={() => dispatch({ type: 'discard', uid: selectedTile.uid })}>
                Discard {nameOf(selectedTile.id)}
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

function Status({ state, seat, myTurn, selected }: {
  state: GameState; seat: Seat; myTurn: boolean; selected: TileId | null
}) {
  if (state.phase === 'handOver') return <span className="lead">Hand over.</span>
  if (state.phase === 'claim') {
    return <span className="hint">Waiting on the table to answer the discard…</span>
  }
  if (!myTurn) {
    return <span className="hint">{state.players[state.turn].name} is on turn.</span>
  }
  if (selected) {
    return (
      <>
        <span className="lead">{nameOf(selected)} selected.</span>
        <span className="hint">Press Discard to throw it, or tap another tile.</span>
      </>
    )
  }
  const p = state.players[seat]
  const needed = 17 - 3 * p.melds.length
  return (
    <>
      <span className="lead">Your turn.</span>
      <span className="hint">
        {p.concealed.length >= needed ? 'Pick a tile to discard.' : 'Waiting for the wall…'}
      </span>
    </>
  )
}
