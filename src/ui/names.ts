/** Append “(You)” to the local player — but never to the literal placeholder “You”. */
export function displayName(name: string, isYou: boolean): string {
  return isYou && name.trim().toLowerCase() !== 'you' ? `${name} (You)` : name
}

// Emoji, skin-tone modifiers, flags, and the joiners/selectors that assemble them.
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu

/** Keep names to plain text — no emoji. */
export function sanitizeName(raw: string): string {
  return raw.replace(EMOJI, '')
}
