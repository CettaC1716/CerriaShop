// ============================================================================
// CERRIA TOWN — STORE DATA MANAGER (Smart Cache 0 ms · Stale-While-Revalidate)
// ----------------------------------------------------------------------------
// Single runtime owner of every piece of store UI data (toko1 … toko7):
// info-card text, catalog products, prices, promos, events, FAQs …
//
//   1. SYNCHRONOUS boot (0 ms): localStorage `cerria_stores_cache` → else the
//      bundled offline copy `/data/fallback-stores.js`. Store modules read the
//      LIVE objects exported here, so a store opens instantly with no loading.
//   2. BACKGROUND revalidation (Stale-While-Revalidate):
//      - Priority A (if Supabase is configured in `/js/config.js`): fetch live
//        rows from `public.stores` & `public.products` via `/js/supabase-client.js`.
//      - Priority B (Zero-Crash Fallback): fetch `/data/stores-data.json`.
//      When the fresh dataset differs from what is on screen, `localStorage` is
//      rewritten and the live objects are patched IN PLACE (object identities
//      preserved, so modules holding a reference keep working).
//   3. SAFE ORDER CHECKOUT (`submitOrder`): validates prices & stock on the
//      server via Supabase RPC `create_safe_order`, falling back automatically
//      to local canonical catalog validation when Supabase is unconfigured/offline.
//
// System IDs (`toko1` … `toko7`) are permanent; everything inside the JSON / DB
// is display data and may be edited freely without touching any code.
// ============================================================================
import FALLBACK_STORES from '../data/fallback-stores.js?v=124';
import { STORE_IDS, STORE_SLOT, normalizeStoreId } from '../store_ids.js?v=124';
import {
  fetchStoresFromSupabase,
  submitSafeOrder,
  isSupabaseConfigured
} from './supabase-client.js?v=124';

export const STORES_CACHE_KEY = 'cerria_stores_cache_v3';
const DATA_URL = new URL('../data/stores-data.json', import.meta.url);
const SCHEMA_VERSION = FALLBACK_STORES.schemaVersion;

const clone = v => JSON.parse(JSON.stringify(v));
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A dataset is usable only if it matches the schema and contains card + catalog for all 7 permanent IDs. */
function isValidDataset(d) {
  return (
    isPlainObject(d) &&
    d.schemaVersion === SCHEMA_VERSION &&
    isPlainObject(d.stores) &&
    STORE_IDS.every(id => isPlainObject(d.stores[id]?.card) && isPlainObject(d.stores[id]?.catalog))
  );
}

function readCache() {
  try {
    const raw = localStorage.getItem(STORES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidDataset(parsed) ? parsed : null;
  } catch {
    return null; // private mode / quota / corrupted JSON → fall back silently
  }
}

function writeCache(dataset) {
  try {
    localStorage.setItem(STORES_CACHE_KEY, JSON.stringify(dataset));
  } catch {
    /* storage unavailable — the in-memory state is still authoritative */
  }
}

// ---------------------------------------------------------------------------
// 1. Synchronous boot — runs before any store module evaluates.
// ---------------------------------------------------------------------------
const cached = readCache();
let dataSource = cached ? 'cache' : 'fallback';
const live = clone(cached || FALLBACK_STORES);
let liveSignature = JSON.stringify(live);

/** Live per-store state: `{ toko1: { card, catalog }, … }` (mutated in place on refresh). */
export const STORES = live.stores;

/** Live catalog object of a store (legacy aliases accepted). Modules keep this reference. */
export function storeCatalog(storeId) {
  const id = normalizeStoreId(storeId);
  if (!id) throw new Error(`[store-data] Unknown store ID: ${storeId}`);
  return STORES[id].catalog;
}

/** Live info-card object of a store (legacy aliases accepted). */
export function storeCard(storeId) {
  const id = normalizeStoreId(storeId);
  if (!id) throw new Error(`[store-data] Unknown store ID: ${storeId}`);
  return STORES[id].card;
}

/**
 * Info-card rows ordered by PHYSICAL 3D LOT (index === village `stores[]` index).
 * Each row is `{ id, ...card }`. Rows are long-lived objects patched in place.
 */
export const BUILDINGS_BY_LOT = (() => {
  const rows = [];
  STORE_IDS.forEach(id => {
    rows[STORE_SLOT[id]] = { id, ...STORES[id].card };
  });
  return rows;
})();

// ---------------------------------------------------------------------------
// 2. In-place patching (keeps object identities stable for running modules).
// ---------------------------------------------------------------------------
function syncInPlace(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    const n = Math.min(target.length, source.length);
    for (let i = 0; i < n; i++) {
      if (isPlainObject(target[i]) && isPlainObject(source[i])) syncInPlace(target[i], source[i]);
      else if (Array.isArray(target[i]) && Array.isArray(source[i])) syncInPlace(target[i], source[i]);
      else target[i] = clone(source[i]);
    }
    if (target.length > source.length) target.length = source.length;
    for (let i = n; i < source.length; i++) target.push(clone(source[i]));
    return;
  }
  // Plain objects: only enumerable keys are managed (non-enumerable system wiring is preserved).
  Object.keys(target).forEach(k => {
    if (!(k in source)) delete target[k];
  });
  Object.keys(source).forEach(k => {
    const s = source[k];
    const t = target[k];
    if ((isPlainObject(t) && isPlainObject(s)) || (Array.isArray(t) && Array.isArray(s))) syncInPlace(t, s);
    else target[k] = clone(s);
  });
}

function applyDataset(next) {
  live.schemaVersion = next.schemaVersion;
  live.version = next.version;
  STORE_IDS.forEach(id => {
    syncInPlace(STORES[id].card, next.stores[id].card);
    syncInPlace(STORES[id].catalog, next.stores[id].catalog);
    const row = BUILDINGS_BY_LOT[STORE_SLOT[id]];
    syncInPlace(row, { id, ...next.stores[id].card });
  });
  liveSignature = JSON.stringify(live);
}

// ---------------------------------------------------------------------------
// 3. Listeners & background revalidation.
// ---------------------------------------------------------------------------
const listeners = new Set();

/** Subscribe to data refreshes. Returns an unsubscribe function. */
export function onStoresUpdated(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitUpdated() {
  const detail = { version: live.version, source: dataSource };
  listeners.forEach(cb => {
    try {
      cb(detail);
    } catch (err) {
      console.warn('[store-data] listener failed', err);
    }
  });
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('cerria:stores-updated', { detail }));
  }
}

let revalidatePromise = null;

/**
 * Revalidate store data in the background (Supabase first if configured, else
 * `/data/stores-data.json`) and apply it in place if it differs from live state.
 * Resolves to `true` when the on-screen data changed. Never throws.
 */
export function revalidateStores() {
  if (revalidatePromise) return revalidatePromise;
  revalidatePromise = (async () => {
    try {
      let next = null;
      let nextSource = 'network';

      if (isSupabaseConfigured()) {
        const supaDataset = await fetchStoresFromSupabase(FALLBACK_STORES);
        if (supaDataset && isValidDataset(supaDataset)) {
          STORE_IDS.forEach(id => {
            const fbStore = FALLBACK_STORES.stores?.[id];
            const spStore = supaDataset.stores?.[id];
            if (fbStore && spStore) {
              spStore.card = {
                ...spStore.card,
                subtitle: fbStore.card.subtitle,
                checks: clone(fbStore.card.checks),
                cardMeta: fbStore.card.cardMeta
              };
              if (spStore.catalog && fbStore.catalog?.brandSub) {
                spStore.catalog.brandSub = fbStore.catalog.brandSub;
              }
            }
          });
          next = supaDataset;
          nextSource = 'supabase';
        }
      }

      if (!next) {
        const res = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const jsonDataset = await res.json();
        if (!isValidDataset(jsonDataset)) throw new Error('invalid schema');
        next = jsonDataset;
        nextSource = 'network';
      }

      writeCache(next);
      if (JSON.stringify(next) === liveSignature) {
        dataSource = nextSource;
        return false;
      }
      applyDataset(next);
      dataSource = nextSource;
      emitUpdated();
      return true;
    } catch (err) {
      console.info(`[store-data] revalidate skipped (${err.message}); using ${dataSource} data`);
      return false;
    } finally {
      revalidatePromise = null;
    }
  })();
  return revalidatePromise;
}

// ---------------------------------------------------------------------------
// 4. Safe Order Checkout (Supabase RPC `create_safe_order` + Zero-Crash Fallback)
// ---------------------------------------------------------------------------
const lastOrderByStore = {};

/**
 * Submit an order for `storeId` (`toko1` … `toko7`, legacy aliases accepted).
 * - If Supabase is configured, calls `public.create_safe_order` on PostgreSQL
 *   so unit prices & totals are recalculated on the server and stock is checked.
 * - If Supabase is unconfigured or unreachable, falls back automatically to
 *   canonical local price validation (`source: 'local_fallback'`) with zero crash.
 */
export async function submitOrder(storeId, items = [], customerInfo = {}) {
  const id = normalizeStoreId(storeId);
  if (!id) {
    return { ok: false, error: `Unknown store ID: ${storeId}` };
  }
  const receipt = await submitSafeOrder({
    storeId: id,
    items,
    customerInfo,
    liveStores: STORES
  });
  lastOrderByStore[id] = receipt;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('cerria:order-submitted', { detail: receipt }));
  }
  return receipt;
}

export function getLastOrderReceipt(storeId) {
  const id = normalizeStoreId(storeId);
  return id ? lastOrderByStore[id] || null : null;
}

/** Deep, detached snapshot of one store for external consumers (Unity bridge, analytics…). */
export function getStoreData(storeId) {
  const id = normalizeStoreId(storeId);
  if (!id) return null;
  return { id, number: STORE_IDS.indexOf(id) + 1, ...clone(STORES[id]) };
}

export const getStoresVersion = () => live.version;
export const getStoresSource = () => dataSource;

// Kick off SWR immediately in browser contexts; never blocks initial 0ms rendering.
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  revalidateStores();
}
