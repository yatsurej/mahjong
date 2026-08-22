import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'

beforeAll(() => {
  // jsdom ships no matchMedia, and the theme toggle asks for it on first paint.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  })
})

/** React logs key/act/prop problems through console.error — none are acceptable. */
let consoleErrors: string[] = []
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  consoleErrors = []
  vi.spyOn(console, 'error').mockImplementation((...args) => { consoleErrors.push(String(args[0])) })
  vi.spyOn(console, 'warn').mockImplementation((...args) => { consoleErrors.push(String(args[0])) })
})
afterEach(() => {
  const errors = consoleErrors
  vi.restoreAllMocks()
  vi.useRealTimers()
  cleanup()
  localStorage.clear()
  try { window.history.replaceState(null, '', '/') } catch { /* jsdom */ }
  expect(errors, `React complained:\n${errors.join('\n')}`).toEqual([])
})

const tick = (ms = 900) => act(() => { vi.advanceTimersByTime(ms) })
/** Render, then advance past the ~2s intro boot loader so the app is interactive. */
const renderApp = () => {
  const r = render(<App />)
  tick(2200)
  return r
}
/** Welcome → entry → name → create the room. Lands on the room screen. */
const enterSetup = (name = 'You') => {
  renderApp()
  fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: /create room/i }))
}
/** Every tile in your rack — they render as plain spans when it is not your turn. */
const handTiles = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.hand .tile'))
/** Only the ones you can actually press right now. */
const liveTiles = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('.hand button.tile:not(:disabled)'))

/** Enter, break the wall, and wait out the dealing animation. */
function sitDown(name = 'You') {
  enterSetup(name)
  fireEvent.click(screen.getByRole('button', { name: /break the wall/i }))
  tick(1400)
}

describe('the welcome page', () => {
  it('opens behind a boot loader that fades into the welcome', () => {
    render(<App />) // raw render — do not skip the boot loader
    expect(screen.getByText(/building the wall/i)).toBeTruthy()
    tick(2200)
    expect(screen.queryByText(/building the wall/i)).toBeNull()
    expect(screen.getByRole('heading', { name: /let.?s play/i })).toBeTruthy()
  })

  it('is the first-ever screen, with no name field yet', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: /let.?s play/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /get started/i })).toBeTruthy()
    expect(screen.queryByLabelText(/your name/i)).toBeNull()
    expect(document.querySelector('.table')).toBeNull()
  })

  it('leads to the name-and-room entry screen', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(screen.getByLabelText(/your name/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /create room/i })).toBeTruthy()
    expect(screen.getByLabelText(/enter room code/i)).toBeTruthy()
  })
})

describe('the entry screen', () => {
  const gotoEntry = () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  }

  it('will not create a room until a name is entered', () => {
    gotoEntry()
    fireEvent.click(screen.getByRole('button', { name: /create room/i }))
    expect(screen.getByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/enter your name/i))
    expect(screen.queryByLabelText(/invite link/i)).toBeNull() // did not proceed
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Marco' } })
    fireEvent.click(screen.getByRole('button', { name: /create room/i }))
    expect(screen.getByText(/^room$/i)).toBeTruthy() // now in the room
  })

  it('checks the room code before joining', () => {
    gotoEntry()
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Marco' } })
    const code = screen.getByLabelText(/enter room code/i)
    fireEvent.change(code, { target: { value: 'ab' } })
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    expect(screen.getByText(/room code is 4 characters/i)).toBeTruthy()
    expect(screen.queryByLabelText(/invite link/i)).toBeNull() // did not proceed
    fireEvent.change(code, { target: { value: 'jade' } })
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    const link = screen.getByLabelText(/invite link/i) as HTMLInputElement
    expect(link.value).toContain('room=JADE')
  })

  it('drops non-code characters as you type', () => {
    gotoEntry()
    const code = screen.getByLabelText(/enter room code/i) as HTMLInputElement
    fireEvent.change(code, { target: { value: 'j0!a1o' } }) // 0, 1, O and ! are all illegal
    expect(code.value).toBe('JA')
  })

  it('strips emojis out of the name', () => {
    gotoEntry()
    const nameInput = screen.getByLabelText(/your name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Ma😀r🎉co👍🏽' } })
    expect(nameInput.value).toBe('Marco')
  })

  it('creating drops straight into the room, invite link and all', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Marco' } })
    fireEvent.click(screen.getByRole('button', { name: /create room/i }))
    expect(screen.getByText(/^room$/i)).toBeTruthy()
    const link = screen.getByLabelText(/invite link/i) as HTMLInputElement
    expect(link.value).toMatch(/room=[A-Z0-9]{4}/)
    expect(screen.getByRole('button', { name: /break the wall/i })).toBeTruthy()
  })

  it('joins by code straight into that room', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Marco' } })
    fireEvent.change(screen.getByLabelText(/enter room code/i), { target: { value: 'jade' } })
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    const link = screen.getByLabelText(/invite link/i) as HTMLInputElement
    expect(link.value).toContain('room=JADE')
  })

  it('an invite link goes straight to name + enter room, no create/code fields', () => {
    window.history.replaceState(null, '', '/?room=JADE')
    renderApp()
    expect(screen.getByRole('heading', { name: /join/i })).toBeTruthy()
    expect(screen.getByLabelText(/your name/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /enter room/i })).toBeTruthy()
    // the create/join-by-code choices are gone for an invited visitor
    expect(screen.queryByRole('button', { name: /create room/i })).toBeNull()
    expect(screen.queryByLabelText(/enter room code/i)).toBeNull()
  })

  it('an invited visitor enters the room after naming themselves', () => {
    window.history.replaceState(null, '', '/?room=JADE')
    renderApp()
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Marco' } })
    fireEvent.click(screen.getByRole('button', { name: /enter room/i }))
    expect(screen.getByText(/^room$/i)).toBeTruthy()
    const link = screen.getByLabelText(/invite link/i) as HTMLInputElement
    expect(link.value).toContain('room=JADE')
  })

  it('copies the invite link from the room screen', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    enterSetup('Marco')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^copy$/i }))
    })
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('room='))
    expect(screen.getByRole('button', { name: /copied/i })).toBeTruthy()
  })
})

describe('the room screen', () => {
  it('shows the room and the name set on the home page — nothing editable', () => {
    enterSetup('Marco')
    expect(screen.getByText(/^room$/i)).toBeTruthy()
    expect(screen.getByText(/Marco \(You\)/)).toBeTruthy()
    expect(screen.queryByLabelText(/seat name/i)).toBeNull()
    // free and for fun: no unit/peso field, no house-rules panel
    expect(screen.queryByLabelText(/Pesos per unit/i)).toBeNull()
    expect(screen.queryByText(/house rules/i)).toBeNull()
  })

  it('lets you pick which cardinal seat you play', () => {
    enterSetup('Marco')
    // Marco starts at East; the other seats are open to sit in.
    expect(screen.getByRole('button', { name: /sit at south/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /sit at south/i }))
    // East is now open, and Marco has moved.
    expect(screen.getByRole('button', { name: /sit at east/i })).toBeTruthy()
    expect(screen.getByText(/Marco \(You\)/)).toBeTruthy()
  })
})

describe('the table', () => {
  it('deals the dealer 17 tiles and shows the felt', () => {
    sitDown()
    expect(document.querySelector('.table')).toBeTruthy()
    expect(handTiles()).toHaveLength(17) // seat East is the human and deals
    expect(screen.getByText(/tiles left in the wall/i)).toBeTruthy()
  })

  it('selects a tile, then only the Discard button throws it', () => {
    sitDown()
    const first = liveTiles()[0]
    fireEvent.click(first)
    expect(screen.getByText(/selected\./i)).toBeTruthy()
    // tapping again just deselects — it does not discard
    fireEvent.click(first)
    expect(handTiles()).toHaveLength(17)
    expect(screen.queryByRole('button', { name: /^discard/i })).toBeNull()
    // select again and use the button
    fireEvent.click(first)
    fireEvent.click(screen.getByRole('button', { name: /^discard/i }))
    expect(handTiles()).toHaveLength(16)
    expect(liveTiles()).toHaveLength(0) // the rack locks until the turn comes back
  })

  it('lets the bots take their turns on a timer and come back round', () => {
    sitDown()
    fireEvent.click(liveTiles()[0])
    fireEvent.click(screen.getByRole('button', { name: /^discard/i }))
    expect(handTiles()).toHaveLength(16)
    // Three bots draw and discard, then the turn is ours again.
    for (let i = 0; i < 12; i++) tick(1200)
    expect(document.querySelector('.table')).toBeTruthy()
    expect(screen.queryByText(/something went wrong/i)).toBeNull()
  })

  it('plays a whole hand out without falling over', () => {
    sitDown()
    for (let step = 0; step < 300; step++) {
      // Answer a claim if one is offered to us.
      const claim = document.querySelector('.claimbar')
      if (claim) {
        const pass = within(claim as HTMLElement).queryByRole('button', { name: /^pass$/i })
        const win = within(claim as HTMLElement).queryByRole('button', { name: /win on it/i })
        fireEvent.click((win ?? pass)!)
        tick(60)
        continue
      }
      const declare = screen.queryByRole('button', { name: /declare the win|declare bisaklat/i })
      if (declare) { fireEvent.click(declare); tick(60); continue }
      const tiles = liveTiles()
      if (tiles.length) {
        fireEvent.click(tiles[0])
        const discard = screen.queryByRole('button', { name: /^discard/i })
        if (discard) fireEvent.click(discard)
        tick(60)
        continue
      }
      tick(800)
      if (document.querySelector('.sheet-foot')) break
    }
    // Either the hand finished, or it is still legally in progress — never a crash.
    expect(document.querySelector('.app')).toBeTruthy()
    const wall = Number(screen.getAllByText(/tiles left in the wall/i)[0].textContent!.match(/\d+/)![0])
    expect(wall).toBeLessThan(80)
  })

  it('opens the score ledger with all four standings', () => {
    sitDown()
    const ledger = document.querySelector('.ledger')!
    expect(within(ledger as HTMLElement).getByText('Scores')).toBeTruthy()
    expect(ledger.querySelectorAll('.standing')).toHaveLength(4)
  })

  it('marks the local player with (You)', () => {
    sitDown('Marco')
    expect(screen.getAllByText(/Marco \(You\)/).length).toBeGreaterThan(0)
  })

  it('deals you into the seat you chose', () => {
    enterSetup('Marco')
    fireEvent.click(screen.getByRole('button', { name: /sit at south/i }))
    fireEvent.click(screen.getByRole('button', { name: /break the wall/i }))
    tick(1400)
    // South is not the dealer (East is), so you hold 16, not 17.
    expect(handTiles()).toHaveLength(16)
  })
})

describe('the dealing loader', () => {
  it('arranges tiles before the table appears', () => {
    enterSetup()
    fireEvent.click(screen.getByRole('button', { name: /break the wall/i }))
    expect(screen.getByText(/building the wall/i)).toBeTruthy()
    tick(1400)
    expect(screen.queryByText(/building the wall/i)).toBeNull()
    expect(document.querySelector('.table')).toBeTruthy()
  })
})
