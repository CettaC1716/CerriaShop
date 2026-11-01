// ============================================================================
// CERRIA TOWN — SUPABASE CONFIGURATION (Phase 2)
// ----------------------------------------------------------------------------
// Paste your Supabase Project URL and Anon Public Key below when ready.
// ZERO-CRASH FALLBACK: If left empty (''), Cerria Town automatically runs 100%
// off /data/stores-data.json and localStorage Smart Cache without any errors.
// ============================================================================

export const SUPABASE_URL = 'https://penfodwizsqxitafhfcf.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlbmZvZHdpenNxeGl0YWZoZmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzQyMzgsImV4cCI6MjEwODYxMDIzOH0.Ym3LWe0S7zKFFsj2z2rF94uwMjII7mSA-LoKs8w7bNY';

/**
 * Resolve active Supabase credentials (supports runtime override via
 * `window.__CERRIA_CONFIG__` or localStorage for testing without editing code).
 */
export function getSupabaseConfig() {
  const winCfg = (typeof window !== 'undefined' && window.__CERRIA_CONFIG__) || {};
  let storedUrl = '';
  let storedKey = '';
  try {
    storedUrl = localStorage.getItem('cerria_supabase_url') || '';
    storedKey = localStorage.getItem('cerria_supabase_anon_key') || '';
  } catch {
    /* private browsing / storage disabled */
  }
  const url = String(winCfg.SUPABASE_URL || SUPABASE_URL || storedUrl || '').trim().replace(/\/+$/, '');
  const anonKey = String(winCfg.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || storedKey || '').trim();
  const enabled = /^https?:\/\/.+/i.test(url) && anonKey.length > 10;
  return { url, anonKey, enabled };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().enabled;
}
