/// <reference types="vite/client" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The Supabase client, or null when the project isn't configured (e.g. tests,
 * or a build with no .env.local). Everything realtime degrades gracefully to the
 * local single-device game when this is null.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { realtime: { params: { eventsPerSecond: 8 } } }) : null

/** Realtime needs a configured client and a real browser — never under test. */
export function realtimeReady(): boolean {
  if (import.meta.env.MODE === 'test') return false
  return supabase !== null && typeof WebSocket !== 'undefined'
}

/**
 * A per-tab id, generated once per page load. Each browser tab loads its own JS
 * instance, so two windows always get distinct ids — even in the same browser.
 * (Deliberately NOT sessionStorage: that is shared when a tab is duplicated, which
 * would collapse two players into one presence entry and stack them on one seat.)
 */
const TAB_ID = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
export function clientId(): string {
  return TAB_ID
}
