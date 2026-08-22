import { useState } from 'react'
import { isValidRoomCode, ROOM_CODE_LENGTH, sanitizeRoomInput } from './rooms'

interface Props {
  roomName: string
  /** Did this visitor arrive by opening someone's invite link? */
  joined: boolean
  userName: string
  onUserName: (name: string) => void
  onCreate: () => void
  onJoin: (code: string) => void
  /** The room carried in on an invite link (only meaningful when `joined`). */
  initialJoinCode?: string
}

export function Lobby({ roomName, joined, userName, onUserName, onCreate, onJoin, initialJoinCode }: Props) {
  const [joinCode, setJoinCode] = useState(() => sanitizeRoomInput(initialJoinCode ?? ''))
  const [nameError, setNameError] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const nameOk = userName.trim().length > 0

  const create = () => {
    if (!nameOk) { setNameError(true); return }
    onCreate()
  }
  const join = () => {
    if (!nameOk) { setNameError(true); return }
    if (!isValidRoomCode(joinCode)) { setCodeError(`A room code is ${ROOM_CODE_LENGTH} characters.`); return }
    onJoin(joinCode)
  }
  const enterInvited = () => {
    if (!nameOk) { setNameError(true); return }
    onJoin(sanitizeRoomInput(initialJoinCode ?? ''))
  }

  return (
    <div className="lobby">
      <div className="lobby-inner">
        <h1>
          {joined
            ? <>Join <span className="accent">{roomName}</span></>
            : <>Set up your <span className="accent">table</span></>}
        </h1>
        <p className="lede">
          {joined ? `Enter your name to join ${roomName}.` : 'Enter your name, then start a room or join a friend.'}
        </p>

        <div className="room-card">
          <label className="name-field">
            <span className="invite-label">Your name</span>
            <div className="field-wrap">
              {nameError && <span className="bubble" role="alert">Enter your name</span>}
              <input
                className="field"
                value={userName}
                maxLength={18}
                placeholder="Your name"
                aria-label="Your name"
                onChange={(e) => { onUserName(e.target.value); setNameError(false) }}
                onKeyDown={(e) => { if (joined && e.key === 'Enter') enterInvited() }}
              />
            </div>
          </label>

          {joined ? (
            <button type="button" className="btn primary big block" onClick={enterInvited}>
              Enter room →
            </button>
          ) : (
            <>
              <button type="button" className="btn primary big block" onClick={create}>
                Create room →
              </button>

              <div className="or"><span>or join a friend</span></div>

              <div className="join-row">
                <div className="field-wrap">
                  {codeError && <span className="bubble" role="alert">{codeError}</span>}
                  <input
                    className="field"
                    value={joinCode}
                    placeholder="Enter room code"
                    aria-label="Enter room code"
                    onChange={(e) => { setJoinCode(sanitizeRoomInput(e.target.value)); setCodeError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') join() }}
                  />
                </div>
                <button type="button" className="btn" onClick={join}>Join</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
