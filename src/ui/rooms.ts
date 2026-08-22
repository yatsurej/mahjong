/**
 * Room identity for the lobby.
 *
 * A room is just a short code. Everything else — the friendly name shown on the
 * landing screen — is derived from that code, so anyone who opens the same invite
 * link sees the same room. Live shared play is a later step; today the code is a
 * shareable identity, not a network session.
 */

// No 0/O/1/I — the code has to survive being read aloud and typed by a friend.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const ROOM_CODE_LENGTH = 4

/** Filter typed input down to characters a real code can contain, capped at length. */
export function sanitizeRoomInput(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => ALPHABET.includes(c))
    .join('')
    .slice(0, ROOM_CODE_LENGTH)
}

/** A code is valid only if it is the right length and every character is legal. */
export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && code.split('').every((c) => ALPHABET.includes(c))
}

export function generateRoomCode(len = 4): string {
  const out: string[] = []
  try {
    const buf = new Uint32Array(len)
    crypto.getRandomValues(buf)
    for (let i = 0; i < len; i++) out.push(ALPHABET[buf[i] % ALPHABET.length])
  } catch {
    for (let i = 0; i < len; i++) out.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)])
  }
  return out.join('')
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

/** FNV-1a — small, stable, good enough to scatter codes across the word lists. */
function hash(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

const ADJECTIVES = [
  'Jade', 'Golden', 'Crimson', 'Lucky', 'Ivory', 'Lantern', 'Bamboo',
  'Vermilion', 'Silk', 'Twin', 'Lotus', 'Monsoon', 'Sampaguita', 'Pearl',
]
const NOUNS = [
  'Sparrow', 'Dragon', 'Pavilion', 'Blossom', 'Courtyard', 'Wind', 'Harbor',
  'Terrace', 'Lantern', 'Table', 'Gate', 'Veranda', 'Bahay', 'Garden',
]

export function roomNameFromCode(code: string): string {
  const h = hash(code)
  return `${ADJECTIVES[h % ADJECTIVES.length]} ${NOUNS[(h >>> 8) % NOUNS.length]}`
}

/** Read a room out of the current URL's ?room= parameter, if there is one. */
export function currentRoomFromUrl(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('room')
    if (!raw) return null
    const code = normalizeRoomCode(raw)
    return code || null
  } catch {
    return null
  }
}

/** The link a friend opens to land in this room. */
export function inviteLink(code: string): string {
  try {
    const { origin, pathname } = window.location
    const base = origin && origin !== 'null' ? `${origin}${pathname}` : ''
    return `${base}?room=${code}`
  } catch {
    return `?room=${code}`
  }
}
