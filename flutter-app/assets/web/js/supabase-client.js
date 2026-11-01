// ============================================================================
// CERRIA TOWN — LIGHTWEIGHT SUPABASE CLIENT & ZERO-CRASH FALLBACK (Phase 2)
// ----------------------------------------------------------------------------
// Connects to Supabase PostgREST (/rest/v1/stores, /rest/v1/products) and the
// server-side price validation RPC (/rest/v1/rpc/create_safe_order).
//
// ZERO-CRASH GUARANTEE:
// - If SUPABASE_URL / SUPABASE_ANON_KEY in /js/config.js are empty or offline,
//   every function resolves cleanly to its local fallback without throwing.
// ============================================================================
import { getSupabaseConfig, isSupabaseConfigured } from './config.js?v=124';
import { STORE_IDS, normalizeStoreId } from '../store_ids.js?v=124';

const clone = v => JSON.parse(JSON.stringify(v));

function buildHeaders(anonKey, extra = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

/**
 * Reconstruct the runtime `stores-data.json` structure from Supabase `stores`
 * and `products` table rows. Top-level column edits in Supabase (`name`,
 * `subtitle`, `category`, `hero_title`, `promo`, `theme`, `visitor_count`,
 * `products.name`, `products.price`) override the JSON fields automatically.
 */
export function buildDatasetFromSupabaseRows(storeRows, productRows, baseDataset) {
  if (!Array.isArray(storeRows) || storeRows.length === 0) return null;
  const out = clone(baseDataset);
  let maxUpdatedAt = '';

  const productsByStore = new Map();
  STORE_IDS.forEach(id => productsByStore.set(id, []));
  for (const p of productRows || []) {
    if (p && p.is_active !== false && productsByStore.has(p.store_id)) {
      productsByStore.get(p.store_id).push(p);
      if (p.updated_at && String(p.updated_at) > maxUpdatedAt) maxUpdatedAt = String(p.updated_at);
    }
  }

  for (const sRow of storeRows) {
    const id = normalizeStoreId(sRow?.id);
    if (!id || !out.stores[id]) continue;
    if (sRow.updated_at && String(sRow.updated_at) > maxUpdatedAt) maxUpdatedAt = String(sRow.updated_at);

    const card = { ...out.stores[id].card, ...(sRow.card_data || {}) };
    if (Array.isArray(card.modules)) {
      card.modules = card.modules.map(m => {
        if (m && typeof m.state === 'string' && m.state.trim().startsWith('$')) {
          const val = parseFloat(m.state.replace(/[^0-9.]/g, '')) || 0;
          const idr = val > 0 && val < 1000 ? Math.round(val * 10000) : Math.round(val);
          return { ...m, state: 'Rp ' + idr.toLocaleString('id-ID') };
        }
        return m;
      });
    }
    const catalog = { ...out.stores[id].catalog, ...(sRow.catalog_meta || {}) };

    // Apply top-level `stores` columns onto `card` and `catalog`
    if (sRow.name) {
      card.title = sRow.name;
      if (!catalog.brandTitle || catalog.brandTitle === out.stores[id].card.title) {
        catalog.brandTitle = sRow.name;
      }
    }
    if (sRow.subtitle) card.subtitle = sRow.subtitle;
    if (sRow.category) card.badge = sRow.category;
    if (typeof sRow.visitor_count === 'number') card.friends = sRow.visitor_count;
    if (Array.isArray(sRow.hero_tags) && sRow.hero_tags.length) card.valance = clone(sRow.hero_tags);
    if (sRow.hero_title) catalog.leftCalligraphy = sRow.hero_title;

    if (sRow.promo && typeof sRow.promo === 'object') {
      if (sRow.promo.eyebrow) catalog.heroEyebrow = sRow.promo.eyebrow;
      if (sRow.promo.headline) catalog.heroHeadline = sRow.promo.headline;
      if (sRow.promo.sub) catalog.heroSub = sRow.promo.sub;
      if (sRow.promo.desc !== undefined) catalog.heroDesc = sRow.promo.desc;
      if (sRow.promo.ctaLabel) catalog.ctaLabel = sRow.promo.ctaLabel;
    }

    if (sRow.theme && typeof sRow.theme === 'object') {
      if (sRow.theme.color) card.color = sRow.theme.color;
      if (sRow.theme.themeColor) catalog.themeColor = sRow.theme.themeColor;
      if (sRow.theme.themeDark) catalog.themeDark = sRow.theme.themeDark;
      if (sRow.theme.heroColor) catalog.heroColor = sRow.theme.heroColor;
      if (Array.isArray(sRow.theme.grad) && sRow.theme.grad.length) card.grad = clone(sRow.theme.grad);
      if (sRow.theme.wall) card.wall = sRow.theme.wall;
    }

    // Rebuild catalog product & event lists from `public.products` rows
    const rows = (productsByStore.get(id) || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (rows.length > 0) {
      const catalogItems = [];
      const scMenu = [];
      const scGoods = [];
      const scEventsByMonth = {};
      const treatments = [];
      const lookbooks = [];
      const specials = [];
      const mayorRoles = [];
      const mayorStamps = [];
      const mayorFaqs = [];

      for (const r of rows) {
        const meta = r.metadata && typeof r.metadata === 'object' ? clone(r.metadata) : {};
        const kind = meta.kind || '';
        const itemId = meta.item_id || meta.id || String(r.id).replace(`${id}:`, '');
        const rawPrice = Number(r.price ?? meta.basePrice ?? 0);
        const numericPrice = rawPrice > 0 && rawPrice < 1000 ? Math.round(rawPrice * 10000) : Math.round(rawPrice);

        if (kind === 'catalog_item' || (!kind && Array.isArray(out.stores[id].catalog.items) && r.section !== 'events')) {
          delete meta.kind;
          delete meta.item_id;
          catalogItems.push({
            ...meta,
            id: itemId,
            name: r.name || meta.name,
            basePrice: numericPrice,
            stock: typeof r.stock === 'number' ? r.stock : 100
          });
        } else if (kind === 'sc_menu') {
          delete meta.kind;
          delete meta.item_id;
          scMenu.push({
            ...meta,
            id: itemId,
            name: r.name || meta.name,
            basePrice: numericPrice,
            stock: typeof r.stock === 'number' ? r.stock : 100
          });
        } else if (kind === 'sc_good') {
          delete meta.kind;
          delete meta.item_id;
          scGoods.push({
            ...meta,
            id: itemId.replace(/^good_/, ''),
            name: r.name || meta.name,
            price: numericPrice > 0 ? 'Rp ' + numericPrice.toLocaleString('id-ID') : meta.price
          });
        } else if (kind === 'sc_event') {
          const monthKey = meta.monthKey || '2026-10';
          delete meta.kind;
          delete meta.monthKey;
          if (!scEventsByMonth[monthKey]) scEventsByMonth[monthKey] = [];
          scEventsByMonth[monthKey].push({
            ...meta,
            title: r.name || meta.title
          });
        } else if (kind === 'treatment') {
          delete meta.kind;
          treatments.push({ ...meta, title: r.name || meta.title });
        } else if (kind === 'lookbook') {
          delete meta.kind;
          lookbooks.push({ ...meta, title: r.name || meta.title });
        } else if (kind === 'special') {
          delete meta.kind;
          specials.push({ ...meta, title: r.name || meta.title });
        } else if (kind === 'mayor_role') {
          delete meta.kind;
          delete meta.item_id;
          mayorRoles.push({ ...meta, id: itemId.replace(/^role_/, ''), label: r.name || meta.label });
        } else if (kind === 'mayor_stamp') {
          delete meta.kind;
          delete meta.item_id;
          mayorStamps.push({ ...meta, id: itemId.replace(/^stamp_/, ''), name: r.name || meta.name });
        } else if (kind === 'mayor_faq') {
          delete meta.kind;
          mayorFaqs.push({ ...meta, q: r.name || meta.q });
        }
      }

      if (catalogItems.length) catalog.items = catalogItems;
      if (scMenu.length) catalog.menu = scMenu;
      if (scGoods.length) catalog.goods = scGoods;
      if (Object.keys(scEventsByMonth).length && catalog.events) {
        const monthMeta = catalog.eventMonths || {};
        for (const [mKey, evItems] of Object.entries(scEventsByMonth)) {
          catalog.events[mKey] = {
            ...(catalog.events[mKey] || monthMeta[mKey] || { label: mKey, offset: 0, days: 30 }),
            items: evItems
          };
        }
      }
      if (treatments.length) catalog.treatments = treatments;
      if (lookbooks.length) catalog.lookbooks = lookbooks;
      if (specials.length) catalog.specials = specials;
      if (mayorRoles.length) catalog.roles = mayorRoles;
      if (mayorStamps.length) catalog.stamps = mayorStamps;
      if (mayorFaqs.length) catalog.faqs = mayorFaqs;
    }

    out.stores[id] = { card, catalog };
  }

  out.version = maxUpdatedAt ? `supabase:${maxUpdatedAt}` : `supabase:${out.version}`;
  return out;
}

/**
 * Fetch `stores` and `products` from Supabase if configured.
 * Resolves to a full `stores-data` dataset or `null` when unconfigured/offline.
 */
export async function fetchStoresFromSupabase(baseDataset) {
  const { url, anonKey, enabled } = getSupabaseConfig();
  if (!enabled) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const headers = buildHeaders(anonKey);
    const [storesRes, productsRes] = await Promise.all([
      fetch(`${url}/rest/v1/stores?select=*&order=id.asc`, { headers, signal: controller.signal, cache: 'no-store' }),
      fetch(`${url}/rest/v1/products?select=*&is_active=eq.true&order=sort_order.asc`, {
        headers,
        signal: controller.signal,
        cache: 'no-store'
      })
    ]);
    if (!storesRes.ok || !productsRes.ok) {
      throw new Error(`Supabase HTTP ${storesRes.status}/${productsRes.status}`);
    }
    const [storeRows, productRows] = await Promise.all([storesRes.json(), productsRes.json()]);
    return buildDatasetFromSupabaseRows(storeRows, productRows, baseDataset);
  } catch (err) {
    console.info(`[supabase] Using local store data fallback (${err?.message || 'offline'})`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compute a canonical, price-validated order locally against the authoritative
 * catalog data when Supabase is not configured or offline.
 */
export function validateOrderLocally(storeId, items = [], customerInfo = {}, liveStores = {}) {
  const id = normalizeStoreId(storeId);
  if (!id || !liveStores[id]) {
    return { ok: false, error: `Unknown storeId: ${storeId}` };
  }
  const store = liveStores[id];
  const catalog = store.catalog || {};
  const pool = [...(catalog.items || []), ...(catalog.menu || []), ...(catalog.goods || [])];
  const currency = id === 'toko5' ? 'USD' : 'IDR';
  const packagingFee = id === 'toko5' ? 0.8 : id === 'toko3' ? 20000 : id === 'toko7' ? 0 : 15000;

  let subtotal = 0;
  const verifiedItems = [];

  for (const raw of items || []) {
    const rawId = String(raw?.product_id || raw?.id || '').trim();
    const qty = Math.max(1, Math.min(99, parseInt(raw?.qty ?? 1, 10) || 1));
    const sizeLabel = String(raw?.size || raw?.sizeLabel || '').trim();
    const variantName = String(raw?.variant || raw?.shadeName || raw?.colorName || raw?.variantName || '').trim();

    const prod = pool.find(p => p.id === rawId || `${id}:${p.id}` === rawId);
    const basePrice = prod
      ? typeof prod.basePrice === 'number'
        ? prod.basePrice
        : parseFloat(String(prod.price || '0').replace(/[^0-9.]/g, '')) || 0
      : Number(raw?.unitPrice || 0);

    let mult = 1;
    let delta = 0;
    if (prod && Array.isArray(prod.sizes) && sizeLabel) {
      const sz = prod.sizes.find(
        s => String(s.label || s.name || '').toLowerCase() === sizeLabel.toLowerCase()
      );
      if (sz) {
        if (typeof sz.mult === 'number') mult = sz.mult;
        if (typeof sz.delta === 'number') delta = sz.delta;
      }
    }

    const unitPrice =
      currency === 'USD'
        ? Math.round(((basePrice * mult) + delta) * 100) / 100
        : Math.round((basePrice * mult) + delta);
    const lineTotal =
      currency === 'USD' ? Math.round(unitPrice * qty * 100) / 100 : Math.round(unitPrice * qty);
    subtotal = currency === 'USD' ? Math.round((subtotal + lineTotal) * 100) / 100 : subtotal + lineTotal;

    verifiedItems.push({
      product_id: `${id}:${rawId || 'item'}`,
      item_id: rawId || 'item',
      name: prod?.name || raw?.name || rawId,
      qty,
      size: sizeLabel,
      variant: variantName,
      unit_price: unitPrice,
      line_total: lineTotal
    });
  }

  const finalPackaging = subtotal > 0 ? packagingFee : 0;
  const totalAmount =
    currency === 'USD' ? Math.round((subtotal + finalPackaging) * 100) / 100 : subtotal + finalPackaging;
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const orderCode = `CT-${id.toUpperCase()}-${suffix}`;

  return {
    ok: true,
    source: 'local_fallback',
    order_id: `local-${Date.now()}-${suffix}`,
    order_code: orderCode,
    store_id: id,
    store_name: store.card?.title || id,
    currency,
    subtotal,
    packaging_fee: finalPackaging,
    total_amount: totalAmount,
    customer_info: customerInfo || {},
    items: verifiedItems,
    created_at: new Date().toISOString()
  };
}

/**
 * Call the Supabase `create_safe_order` RPC for server-side price validation &
 * stock check, with automatic Zero-Crash fallback to `validateOrderLocally`.
 */
export async function submitSafeOrder({ storeId, items = [], customerInfo = {}, liveStores = {} }) {
  const id = normalizeStoreId(storeId);
  if (!id) return { ok: false, error: `Invalid storeId: ${storeId}` };

  const { url, anonKey, enabled } = getSupabaseConfig();
  if (enabled && Array.isArray(items) && items.length > 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const payload = {
        p_store_id: id,
        p_customer_info: customerInfo || {},
        p_items: items.map(it => ({
          id: it.id || it.product_id,
          qty: it.qty ?? 1,
          size: it.size || it.sizeLabel || '',
          variant: it.variant || it.shadeName || it.colorName || it.variantName || ''
        }))
      };
      const res = await fetch(`${url}/rest/v1/rpc/create_safe_order`, {
        method: 'POST',
        headers: buildHeaders(anonKey),
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`RPC HTTP ${res.status}: ${errBody.slice(0, 160)}`);
      }
      const rpcResult = await res.json();
      if (rpcResult && rpcResult.ok) return { source: 'supabase_rpc', ...rpcResult };
    } catch (err) {
      console.info(`[supabase] create_safe_order fallback to local validation (${err?.message || 'offline'})`);
    } finally {
      clearTimeout(timer);
    }
  }

  return validateOrderLocally(id, items, customerInfo, liveStores);
}

export { isSupabaseConfigured };
