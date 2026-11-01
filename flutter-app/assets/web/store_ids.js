// ============================================================================
// CERRIA TOWN — PERMANENT STORE ID REGISTRY (single source of truth)
// ----------------------------------------------------------------------------
// System IDs `toko1` … `toko7` are PERMANENT and must never be renamed.
// Display names, categories, banners and products are UI data that may change
// at any time (Phase 1 moves them to /data/stores-data.json) without touching
// camera choreography, 3D modules, URL hashes or (later) Supabase `store_id`.
// ============================================================================

export const STORE_IDS = Object.freeze(['toko1', 'toko2', 'toko3', 'toko4', 'toko5', 'toko6', 'toko7']);

// Physical 3D lot (index into BUILDINGS_DATA / village `stores[]`) of each permanent ID.
// The town layout is superblock-locked (Apex tennis court + closed N-S road on lot 4,
// Strawberry plaza + Urban Pocket Park + closed E-W road on lot 5), so `toko5`
// (Strawberry Corner) lives on lot 5 and `toko6` (Apex Sport) on lot 4.
export const STORE_SLOT = Object.freeze({ toko1: 0, toko2: 1, toko3: 2, toko4: 3, toko5: 5, toko6: 4, toko7: 6 });

// Backward-compatible aliases (old internal IDs, old URL hashes & brand short names).
export const LEGACY_ID_MAP = Object.freeze({
  budi: 'toko1', glow: 'toko1',
  fauna: 'toko2', cozy: 'toko2',
  botani: 'toko3', atelier: 'toko3',
  sains: 'toko4', circuit: 'toko4',
  strawberry: 'toko5',
  karya: 'toko6', apex: 'toko6',
  mayor: 'toko7', balai: 'toko7'
});

/** Resolve any canonical/legacy ID or URL hash (`#budi`, `toko3`, `Strawberry`) to `tokoN`, or `null`. */
export function normalizeStoreId(raw) {
  const key = String(raw ?? '').trim().replace(/^#/, '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(STORE_SLOT, key)) return key;
  return Object.prototype.hasOwnProperty.call(LEGACY_ID_MAP, key) ? LEGACY_ID_MAP[key] : null;
}

/** 1-based display number of a store (`toko5` → 5), or 0 when unknown. */
export const storeNumber = id => STORE_IDS.indexOf(normalizeStoreId(id)) + 1;

/** Physical lot index of a store ID (legacy IDs accepted), or `undefined` when unknown. */
export const slotOf = id => STORE_SLOT[normalizeStoreId(id)];

/** Navigation order (toko1 → toko7) expressed as physical lot indices: [0, 1, 2, 3, 5, 4, 6]. */
export const NAV_ORDER = Object.freeze(STORE_IDS.map(id => STORE_SLOT[id]));
