import { SEATS, WIND_NAMES, WIND_SHORT, type Seat, type SeatKind } from '../engine/game'
import { InviteLinkRow } from './InviteLink'
import { CrownIcon } from './icons'
import { displayName } from './names'
import type { RoomMember } from '../net/useRoom'

export interface SeatSetup { name: string; kind: SeatKind }

interface Props {
  roomName?: string
  roomCode?: string
  mySeat: Seat
  onSeat: (seat: Seat) => void
  userName: string
  members: RoomMember[]
  myId: string
  isHost: boolean
  onStart: () => void
}

export function Setup({ roomName, roomCode, mySeat, onSeat, userName, members, myId, isHost, onStart }: Props) {
  const you = userName.trim() || 'You'
  const memberAt = (seat: Seat) => members.find((m) => m.seat === seat)

  return (
    <div className="room-setup solo">
      <div className="room-main">
        <div className="room-card">
          <div className="room-top">
            <div>
              <span className="room-label">Room</span>
              <div className="room-name">{roomName ?? 'The table'}</div>
            </div>
            {roomCode && (
              <div className="room-code" aria-label={`Room code ${roomCode.split('').join(' ')}`}>
                {roomCode.split('').map((ch, i) => <span className="code-chip" key={i} aria-hidden="true">{ch}</span>)}
              </div>
            )}
          </div>

          {roomCode && <InviteLinkRow code={roomCode} />}

          <div className="players" role="group" aria-label="Seats">
            {SEATS.map((seat) => {
              const mine = seat === mySeat
              const m = memberAt(seat)
              const other = m && m.id !== myId ? m : null
              const owner = !!m?.host || (mine && isHost)
              return (
                <div key={seat} className={`player-row${mine ? ' mine' : ''}${other ? ' taken' : ''}`}>
                  <span className="w" title={WIND_NAMES[seat]}>{WIND_SHORT[seat]}</span>
                  <span className="player-name">
                    <span className="pn-line">
                      {mine ? displayName(you, true) : other ? other.name : <span className="open">Open</span>}
                      {owner && <CrownIcon className="crown" />}
                    </span>
                    <small>{WIND_NAMES[seat]}{seat === 0 ? ' · deals' : ''}</small>
                  </span>
                  {mine
                    ? <span className="seat-you">Your seat</span>
                    : other
                      ? <span className="seat-here">In room</span>
                      : <button type="button" className="btn sm" aria-label={`Sit at ${WIND_NAMES[seat]}`} onClick={() => onSeat(seat)}>Sit here</button>}
                </div>
              )
            })}
          </div>

          <p className="hint-line">
            {isHost
              ? 'Pick your seat. Open seats fill with bots when you start — or share the invite link so friends can take one.'
              : 'Pick an open seat. The room owner starts the game when everyone is ready.'}
          </p>

          <div className="room-actions">
            {isHost
              ? <button className="btn primary big" type="button" onClick={onStart}>Break the wall →</button>
              : <span className="waiting-host"><span className="live-dot" aria-hidden="true" />Waiting for the host to start…</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
