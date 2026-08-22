import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultRules, type RuleConfig } from './engine/rules'
import { next, offerFor, prev, SEATS, type GameState, type Move, type Seat } from './engine/game'
import { useGame } from './ui/useGame'
import { Setup, type SeatSetup } from './ui/Setup'
import { Welcome } from './ui/Welcome'
import { Lobby } from './ui/Lobby'
import { Dealing } from './ui/Dealing'
import { ThemeToggle } from './ui/Switch'
import { SoundIcon } from './ui/icons'
import { Pond, SeatPanel } from './ui/Table'
import { YourSide } from './ui/YourSide'
import { Ledger } from './ui/Ledger'
import { HandOver } from './ui/HandOver'
import { Chat } from './ui/Chat'
import { isMuted, playCall, playClack, playLose, playWin, setMuted } from './ui/sound'
import { sanitizeName } from './ui/names'
import { currentRoomFromUrl, generateRoomCode, normalizeRoomCode, roomNameFromCode } from './ui/rooms'
import { useRoom, type RoomMember } from './net/useRoom'
import { useGameChannel } from './net/useGameChannel'
import { clientId } from './net/supabase'

type Screen = 'welcome' | 'entry' | 'setup' | 'table'

const DEALING_MS = 1300
const BOT_POOL = ['Marisol', 'Ador', 'Bea', 'Ising']

/** Seats occupied by real members become humans (with their names); the rest are bots. */
function buildSeats(members: RoomMember[], mySeat: Seat, userName: string, myId: string): SeatSetup[] {
  let b = 0
  return SEATS.map((s) => {
    const m = members.find((mm) => mm.seat === s)
    if (s === mySeat) return { name: userName.trim() || 'You', kind: 'human' as const }
    if (m) return { name: m.name || 'Player', kind: 'human' as const }
    void myId
    return { name: BOT_POOL[b++ % BOT_POOL.length], kind: 'bot' as const }
  })
}

const createdKey = (code: string) => `mahjong-created-${code}`

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (currentRoomFromUrl() ? 'entry' : 'welcome'))
  const [started, setStarted] = useState(false)
  const [seats, setSeats] = useState<SeatSetup[]>(() => buildSeats([], 0, '', ''))
  const [rules] = useState<RuleConfig>(defaultRules)
  const [drawer, setDrawer] = useState(false)
  const [dealing, setDealing] = useState(false)
  const [theme, setTheme] = useTheme()

  const [room, setRoom] = useState<string>(() => currentRoomFromUrl() ?? generateRoomCode())
  const [joinedViaLink] = useState<boolean>(() => currentRoomFromUrl() !== null)
  const [userName, setUserName] = useState('')
  const [mySeat, setMySeat] = useState<Seat>(0)

  const myId = clientId()
  const youName = userName.trim() || 'You'

  // The room owner is whoever created this code (persisted per-tab so a reload keeps it).
  const amCreator = (() => {
    try { return sessionStorage.getItem(createdKey(room)) === '1' } catch { return false }
  })()

  // A brief intro loader on first open, then a soft fade into the welcome page.
  const [boot, setBoot] = useState<'show' | 'fade' | 'done'>('show')
  useEffect(() => {
    const fade = window.setTimeout(() => setBoot('fade'), 1600)
    const done = window.setTimeout(() => setBoot('done'), 2050)
    return () => { window.clearTimeout(fade); window.clearTimeout(done) }
  }, [])
  const bootEl = boot !== 'done' ? <Dealing variant="page" fading={boot === 'fade'} /> : null

  const inRoom = screen === 'setup' || screen === 'table'
  useEffect(() => {
    if (!inRoom) return
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('room') !== room) {
        url.searchParams.set('room', room)
        window.history.replaceState(null, '', url.toString())
      }
    } catch { /* no History API */ }
  }, [room, inRoom])

  // ---- realtime presence ----
  const presence = useRoom({ code: room, name: youName, seat: mySeat, host: amCreator, active: inRoom })
  const membersRef = useRef(presence.members)
  membersRef.current = presence.members

  // Who owns the game: the creator if present, else the lowest id present (host handoff).
  const hostMember = presence.members.find((m) => m.host)
  const hostId = hostMember?.id ?? (presence.members.length ? [...presence.members].map((m) => m.id).sort()[0] : myId)
  const isHost = amCreator || (presence.online ? hostId === myId : !joinedViaLink)

  // Slide off a seat a lower-id player already holds (deterministic, no ping-pong).
  useEffect(() => {
    const held = new Map<Seat, string>()
    for (const m of presence.members) {
      if (m.id === myId || m.seat === null) continue
      const cur = held.get(m.seat)
      if (cur === undefined || m.id < cur) held.set(m.seat, m.id)
    }
    const holder = held.get(mySeat)
    if (holder !== undefined && holder < myId) {
      const open = SEATS.find((s) => !held.has(s))
      if (open !== undefined) setMySeat(open)
    }
  }, [presence.members, myId, mySeat])

  // ---- the game: host runs the engine + bots; clients render broadcast state ----
  const { state, dispatch, restart, adopt } = useGame({ seats, rules }, !isHost || dealing)
  const stateRef = useRef(state)
  stateRef.current = state
  const [remoteState, setRemoteState] = useState<GameState | null>(null)

  const applyRemote = useCallback((seat: Seat, move: Move) => {
    const s = stateRef.current
    if (move.type === 'respond') { if (move.seat === seat) dispatch(move); return }
    if (move.type === 'nextHand') { if (s.phase === 'handOver') dispatch(move); return }
    if (s.turn === seat) dispatch(move) // action moves must come from the seat on turn
  }, [dispatch])

  const { sendMove } = useGameChannel({
    code: room,
    active: inRoom,
    isHost,
    started,
    state: isHost ? state : null,
    onRemoteState: setRemoteState,
    onRemoteMove: applyRemote,
  })

  // On becoming host (the old host left), take over from the last state we saw.
  const wasHost = useRef(isHost)
  useEffect(() => {
    if (isHost && !wasHost.current && remoteState) adopt(remoteState)
    wasHost.current = isHost
  }, [isHost, remoteState, adopt])

  // A client jumps to the table the moment the host's game arrives.
  useEffect(() => {
    if (!isHost && remoteState && screen === 'setup') setScreen('table')
  }, [isHost, remoteState, screen])

  const game = isHost ? state : (remoteState ?? state)
  const viewSeat: Seat = mySeat
  const youSeat: Seat = mySeat
  const clientDispatch = useCallback((m: Move) => sendMove(mySeat, m), [sendMove, mySeat])
  const act = isHost ? dispatch : clientDispatch

  const canAct = (() => {
    if (dealing) return false
    if (game.phase === 'action') return game.turn === mySeat && game.players[mySeat]?.kind === 'human'
    if (game.phase === 'claim') return !!offerFor(game, mySeat)
    return false
  })()

  // ---- room validity: exists only while its host is present, and has room to sit ----
  const hostPresent = presence.members.some((m) => m.host)
  const [roomStatus, setRoomStatus] = useState<'ok' | 'notfound' | 'closed' | 'full'>('ok')
  const sawHost = useRef(false)
  const hostPresentRef = useRef(hostPresent)
  hostPresentRef.current = hostPresent
  useEffect(() => {
    if (amCreator || !inRoom) { setRoomStatus('ok'); return }
    if (!presence.online) return // can't verify without realtime
    // Full: the other four players already hold all four seats and I have nowhere to sit.
    const othersSeated = new Set<Seat>()
    for (const m of presence.members) if (m.id !== myId && m.seat !== null) othersSeated.add(m.seat)
    if (othersSeated.size >= 4) { setRoomStatus('full'); return }
    if (hostPresent) { sawHost.current = true; setRoomStatus('ok'); return }
    if (sawHost.current) { setRoomStatus('closed'); return } // the host left
    const t = window.setTimeout(() => {
      if (!hostPresentRef.current && !sawHost.current) setRoomStatus('notfound')
    }, 3000)
    return () => window.clearTimeout(t)
  }, [amCreator, inRoom, presence.online, hostPresent, presence.members, myId])

  const leaveRoom = useCallback(() => {
    try {
      const u = new URL(window.location.href)
      u.searchParams.delete('room')
      window.history.replaceState(null, '', u.toString())
    } catch { /* no History API */ }
    sawHost.current = false
    setRoomStatus('ok')
    setRemoteState(null)
    setStarted(false)
    setRoom(generateRoomCode())
    setScreen('welcome')
  }, [])

  const start = useCallback(
    (balances?: [number, number, number, number]) => {
      const s = buildSeats(membersRef.current, mySeat, userName, myId)
      setSeats(s)
      setDrawer(false)
      setDealing(true)
      setStarted(true)
      setScreen('table')
      restart({ seats: s, rules, balances })
      window.setTimeout(() => setDealing(false), DEALING_MS)
    },
    [restart, mySeat, userName, myId, rules],
  )

  const nextHand = useCallback(() => { act({ type: 'nextHand' }) }, [act])

  const [muted, setMutedState] = useState(() => isMuted())
  const toggleMute = () => { const m = !muted; setMutedState(m); setMuted(m) }

  // Sound effects: a clack on each discard, a call tone on a pung/chow/kong, a
  // chime (or soft fall) when a hand ends.
  const prevDiscard = useRef<number | null>(null)
  const prevMelds = useRef<number | null>(null)
  const prevPhase = useRef<string>('')
  useEffect(() => {
    if (screen !== 'table') {
      prevDiscard.current = null
      prevMelds.current = null
      prevPhase.current = ''
      return
    }
    const uid = game.lastDiscard?.tile.uid ?? null
    if (uid !== null && prevDiscard.current !== null && uid !== prevDiscard.current) playClack()
    prevDiscard.current = uid

    // Any meld growing (pung/chow/kong, incl. extending a pung) is a call.
    const meldTiles = game.players.reduce((n, p) => n + p.melds.reduce((m, md) => m + md.tiles.length, 0), 0)
    if (prevMelds.current !== null && meldTiles > prevMelds.current) playCall()
    prevMelds.current = meldTiles

    if (game.phase === 'handOver' && prevPhase.current !== 'handOver') {
      if (game.result?.kind === 'win') { game.result.winner === mySeat ? playWin() : playLose() }
    }
    prevPhase.current = game.phase
  }, [game, screen, mySeat])

  if (screen === 'welcome') {
    return (
      <>
        <div className="app">
          <TopBar theme={theme} setTheme={setTheme} muted={muted} onToggleMute={toggleMute} />
          <Welcome onStart={() => setScreen('entry')} />
        </div>
        {bootEl}
      </>
    )
  }

  if (screen === 'entry') {
    return (
      <>
        <div className="app">
          <TopBar theme={theme} setTheme={setTheme} muted={muted} onToggleMute={toggleMute} onBack={() => setScreen('welcome')} />
          <Lobby
            roomName={roomNameFromCode(room)}
            joined={joinedViaLink}
            userName={userName}
            onUserName={(n) => setUserName(sanitizeName(n))}
            initialJoinCode={joinedViaLink ? room : ''}
            onCreate={() => {
              const code = generateRoomCode()
              try { sessionStorage.setItem(createdKey(code), '1') } catch { /* ignore */ }
              setRoom(code)
              setScreen('setup')
            }}
            onJoin={(c) => {
              const code = normalizeRoomCode(c)
              if (code) { setRoom(code); setScreen('setup') }
            }}
          />
        </div>
        {bootEl}
      </>
    )
  }

  const roomBlocked = roomStatus !== 'ok'

  if (screen === 'setup') {
    const balances = started
      ? (state.players.map((p) => p.balance) as [number, number, number, number])
      : undefined
    return (
      <>
        <div className="app">
          <TopBar theme={theme} setTheme={setTheme} muted={muted} onToggleMute={toggleMute} onBack={() => setScreen(started ? 'table' : 'entry')} />
          <Setup
            roomName={roomNameFromCode(room)}
            roomCode={room}
            mySeat={mySeat}
            onSeat={setMySeat}
            userName={userName}
            members={presence.members}
            myId={myId}
            isHost={isHost}
            onStart={() => start(balances)}
          />
        </div>
        {roomBlocked && <RoomClosed status={roomStatus} onLeave={leaveRoom} />}
        {bootEl}
      </>
    )
  }

  const right = next(viewSeat)
  const across = next(right)
  const left = prev(viewSeat)

  return (
    <div className="app">
      <TopBar
        theme={theme}
        setTheme={setTheme}
        muted={muted}
        onToggleMute={toggleMute}
        room={roomNameFromCode(room)}
        detail={{
          hand: game.handNumber,
          wall: game.wall.length,
          turn: game.phase === 'handOver' ? '—' : game.players[game.turn].name,
        }}
        onLedger={() => setDrawer((d) => !d)}
      />

      <div className="stage">
        <div className="play">
          <div className="table">
            <SeatPanel state={game} seat={left} area="l" youSeat={youSeat} />
            <SeatPanel state={game} seat={across} area="top" youSeat={youSeat} />
            <SeatPanel state={game} seat={right} area="r" youSeat={youSeat} />
            <Pond state={game} />
          </div>
          <YourSide state={game} seat={viewSeat} dispatch={act} interactive={canAct} youSeat={youSeat} />
        </div>

        <Ledger
          state={game}
          youSeat={youSeat}
          canManage={isHost}
          open={drawer}
          onClose={() => setDrawer(false)}
          onRoom={() => { setDrawer(false); setScreen('setup') }}
          onNewTable={() => { setDrawer(false); start() }}
        />
      </div>

      {dealing && <Dealing />}

      {game.phase === 'handOver' && !dealing && (
        <HandOver state={game} youSeat={youSeat} onNextHand={nextHand} />
      )}
      <Chat code={room} name={youName} online={presence.online} />
      {roomBlocked && <RoomClosed status={roomStatus} onLeave={leaveRoom} />}
      {bootEl}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function RoomClosed({ status, onLeave }: { status: 'notfound' | 'closed' | 'full'; onLeave: () => void }) {
  const title = status === 'closed' ? 'The host left' : status === 'full' ? 'Room is full' : 'Room not found'
  const body =
    status === 'closed' ? 'The player who owned this room has gone, so the table has closed.'
    : status === 'full' ? 'All four seats are taken. Ask your friends to start another room.'
    : "This room isn't open — the link or code is no longer valid."
  return (
    <div className="scrim">
      <div className="sheet">
        <div className="gate">
          <span className="eyebrow" style={{ color: 'var(--red)' }}>Room unavailable</span>
          <h2>{title}</h2>
          <p>{body}</p>
          <button className="btn primary" onClick={onLeave}>Back to start</button>
        </div>
      </div>
    </div>
  )
}

interface TopBarProps {
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
  detail?: { hand: number; wall: number; turn: string }
  room?: string
  muted?: boolean
  onToggleMute?: () => void
  onLedger?: () => void
  onBack?: () => void
}

function TopBar({ theme, setTheme, detail, room, muted, onToggleMute, onLedger, onBack }: TopBarProps) {
  return (
    <header className={`topbar${detail ? '' : ' bare'}`}>
      {onBack && <button className="btn sm ghost" onClick={onBack}>← Back</button>}
      {room && <span className="tag room-chip">{room}</span>}
      <span className="spacer" />
      {detail && (
        <>
          <span className="stat"><b>{detail.hand}</b>hand</span>
          <span className="stat"><b>{detail.wall}</b>wall</span>
          <span className="stat turn-stat"><b>{detail.turn}</b>on turn</span>
        </>
      )}
      {onLedger && <button className="btn sm drawer-btn" onClick={onLedger}>Scores</button>}
      {onToggleMute && (
        <button className="btn sm ghost sound-btn" onClick={onToggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'} title={muted ? 'Unmute' : 'Mute'}>
          <SoundIcon muted={!!muted} />
        </button>
      )}
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </header>
  )
}

function useTheme(): ['light' | 'dark', (t: 'light' | 'dark') => void] {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mahjong-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('mahjong-theme', theme)
  }, [theme])
  return [theme, setTheme]
}
