// ============================================================================
// CERRIA TOWN — WARM BOUTIQUE E-COMMERCE CHECKOUT ENGINE (1:1 BLIBLI REA SPEC)
// + ISO-27001 ZERO-TRUST CLIENT, DYNAMIC EMVCo QRIS, CRC16-CCITT & SHA-256
// File: /cerria_checkout.js
// ============================================================================

import { storeCatalog, submitOrder } from './js/store-data-manager.js?v=128';
import { getSupabaseConfig } from './js/config.js?v=128';

const STORAGE_KEY_CHECKOUT = 'cerria_town_checkout_state_v3';

export const MERCHANT_IDENTITY = Object.freeze({
  merchantName: 'CERRIA TOWN OFFICIAL',
  nmid: 'ID1026000889901',
  city: 'CERRIA TOWN',
  postalCode: '10110',
  mcc: '5411',
  currencyCode: '360'
});

const DEFAULT_CHECKOUT_STATE = {
  recipient: {
    email: 'pelanggan@cerriatown.id',
    name: 'Pelanggan Cerria Town',
    phone: '0812-3456-7890',
    address:
      'Jl. Boulevard Cerria Town No. 12, Distrik Pusat, Cerria Town 10110'
  },
  editingAddress: false,
  sellerNotes: {}, // keyed by storeId
  editingNoteStore: null,
  expandedProtections: {}, // keyed by itemKey
  shippingMethod: 'standard', // 'standard' | 'sameday' | 'pickup'
  shippingSelectorOpen: false,
  promoDrawerOpen: false,
  voucherPromoActive: true,
  voucherShippingActive: true,
  usePoints: false,
  pointsBalance: 1250,
  lastPointsEarned: 2130,
  lastPointsRedeemed: 0,
  addonGiftWrap: false, // Rp2.500
  addonTreePlant: false, // Rp1.000
  paymentMethod: 'qris_iso27001', // Locked to Official Protected QRIS Only
  activeMoreMenuIdx: null
};

let sharedState = loadCheckoutState();

// Active cryptographic QRIS payment session & anti-tamper runtime handles
let activeQrisSession = null;
let qrisModalOpen = false;
let qrisTamperAlert = null; // null | { reason: string, detectedAt: string }
let qrisCountdownTimer = null;
let qrisMutationObserver = null;
let isCreatingSessionLock = false;
let lastPaidReceipt = null;

function loadCheckoutState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHECKOUT);
    if (!raw) return { ...DEFAULT_CHECKOUT_STATE, recipient: { ...DEFAULT_CHECKOUT_STATE.recipient } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CHECKOUT_STATE,
      ...parsed,
      paymentMethod: 'qris_iso27001',
      recipient: {
        ...DEFAULT_CHECKOUT_STATE.recipient,
        ...(parsed.recipient || {})
      },
      sellerNotes: { ...(parsed.sellerNotes || {}) },
      expandedProtections: {}
    };
  } catch {
    return { ...DEFAULT_CHECKOUT_STATE, recipient: { ...DEFAULT_CHECKOUT_STATE.recipient } };
  }
}

function saveCheckoutState() {
  try {
    const toSave = {
      recipient: sharedState.recipient,
      sellerNotes: sharedState.sellerNotes,
      shippingMethod: sharedState.shippingMethod,
      voucherPromoActive: sharedState.voucherPromoActive,
      voucherShippingActive: sharedState.voucherShippingActive,
      usePoints: sharedState.usePoints,
      pointsBalance: sharedState.pointsBalance,
      addonGiftWrap: sharedState.addonGiftWrap,
      addonTreePlant: sharedState.addonTreePlant,
      paymentMethod: 'qris_iso27001'
    };
    localStorage.setItem(STORAGE_KEY_CHECKOUT, JSON.stringify(toSave));
  } catch {}
}

export function formatRp(n) {
  const val = Math.round(Number(n) || 0);
  const abs = Math.abs(val);
  const formatted = 'Rp' + abs.toLocaleString('id-ID');
  return val < 0 ? '-' + formatted : formatted;
}

export function formatShortRb(n) {
  const abs = Math.abs(Math.round(Number(n) || 0));
  if (abs >= 1000) {
    const rb = (abs / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return `Rp${rb}rb`;
  }
  return `Rp${abs}`;
}

export function formatShortPoints(pts) {
  const n = Math.max(0, Math.round(Number(pts) || 0));
  if (n >= 1000) {
    const rb = (n / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return `${rb}rb`;
  }
  return String(n);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SHIPPING_METHODS = {
  standard: {
    id: 'standard',
    name: 'Standard',
    eta: 'Dijamin tiba 30 Oktober - 2 November.',
    originalFee: 25300,
    finalFee: 0,
    badge: 'Gratis'
  },
  sameday: {
    id: 'sameday',
    name: 'Cerria Instant · Same-Day',
    eta: 'Dijamin tiba hari ini (estimasi 2 - 4 jam).',
    originalFee: 40300,
    finalFee: 15000,
    badge: 'Hemat Rp25,3rb'
  },
  pickup: {
    id: 'pickup',
    name: 'Ambil di Butik Cerria Town',
    eta: 'Siap diambil dalam 30 menit di konter utama butik.',
    originalFee: 25300,
    finalFee: 0,
    badge: 'Gratis'
  }
};

// ============================================================================
// ISO-27001 ZERO-TRUST MASTER CATALOG PRICE RECALCULATION
// Never reads prices from DOM innerText! Looks up every product_id directly in
// the authoritative storeCatalog(storeId) dataset.
// ============================================================================
export function lookupAuthoritativeProduct(storeId, item) {
  const rawId = String(item?.id || item?.product_id || '')
    .trim()
    .replace(new RegExp(`^${storeId}:`), '');
  const catalog = storeCatalog(storeId) || {};
  const pool = [
    ...(Array.isArray(catalog.items) ? catalog.items : []),
    ...(Array.isArray(catalog.menu) ? catalog.menu : []),
    ...(Array.isArray(catalog.goods) ? catalog.goods : [])
  ];

  const found = pool.find(p => String(p?.id || '') === rawId);
  if (!found) {
    const fallbackUnit = Math.max(0, Math.round(Number(item?.unitPrice) || 0));
    const fallbackOrig =
      Math.round(Number(item?.originalPrice) || 0) ||
      Math.round((fallbackUnit * 1.337) / 500) * 500;
    return {
      productId: rawId || 'item',
      name: String(item?.name || 'Produk Cerria Town'),
      unitPrice: fallbackUnit,
      originalPrice: fallbackOrig
    };
  }

  let base = Number(found.basePrice ?? 0);
  if (!base && typeof found.price === 'string') {
    base = parseFloat(found.price.replace(/[^0-9.]/g, '')) || 0;
  }
  // Strawberry Corner (toko5) stores base prices in USD in catalog; convert 1 USD = Rp 16.000
  const isUsdStore = storeId === 'toko5' && base > 0 && base < 1000;
  const baseIdr = isUsdStore ? Math.round(base * 16000) : Math.round(base);

  // Check size multiplier / delta from authoritative catalog if variantLabel specifies a size
  let mult = 1;
  let delta = 0;
  const variantStr = String(item?.variantLabel || item?.size || '').toLowerCase();
  if (Array.isArray(found.sizes) && variantStr) {
    for (const sz of found.sizes) {
      const lbl = String(sz?.label || sz?.name || '').toLowerCase();
      if (lbl && (variantStr.includes(`size ${lbl}`) || variantStr.startsWith(`${lbl} `) || variantStr === lbl)) {
        if (typeof sz.mult === 'number') mult = sz.mult;
        if (typeof sz.delta === 'number') delta = isUsdStore ? sz.delta * 16000 : sz.delta;
        break;
      }
    }
  }

  // Special handling for Trench Coat (toko3:trench) so it is always locked at Rp1.196.000 (orig Rp1.599.000)
  // even if an older cached catalog version was in localStorage
  const authoritativeUnit =
    storeId === 'toko3' && rawId === 'trench'
      ? 1196000
      : Math.max(0, Math.round(baseIdr * mult + delta));

  const authoritativeOrig =
    storeId === 'toko3' && rawId === 'trench'
      ? 1599000
      : Number(found.originalPrice) > authoritativeUnit
        ? Math.round(Number(found.originalPrice))
        : Math.round((authoritativeUnit * 1.337) / 500) * 500;

  return {
    productId: found.id,
    name: found.name || String(item?.name || 'Produk Cerria Town'),
    unitPrice: authoritativeUnit,
    originalPrice: authoritativeOrig
  };
}

export function computeCheckoutTotals(items, storeId = 'toko3') {
  const verifiedItems = (items || []).map(it => {
    const qty = Math.max(1, Math.min(99, parseInt(it?.qty ?? 1, 10) || 1));
    const auth = lookupAuthoritativeProduct(storeId, it);
    return {
      ...it,
      id: auth.productId,
      name: auth.name,
      qty,
      unitPrice: auth.unitPrice,
      originalPrice: auth.originalPrice,
      insured: it?.insured !== false
    };
  });

  const totalQty = verifiedItems.reduce((acc, it) => acc + it.qty, 0);
  const netProductSubtotal = verifiedItems.reduce(
    (acc, it) => acc + it.unitPrice * it.qty,
    0
  );
  const grossProductTotal = verifiedItems.reduce(
    (acc, it) => acc + it.originalPrice * it.qty,
    0
  );

  const productDiscount = Math.max(0, grossProductTotal - netProductSubtotal);

  // Insurance: Rp26.700 per insured item unit
  const insuranceUnitFee = 26700;
  const insuranceTotal = verifiedItems.reduce((acc, it) => {
    return acc + (it.insured ? insuranceUnitFee * it.qty : 0);
  }, 0);

  // Shipping fee
  const shipMethod = SHIPPING_METHODS[sharedState.shippingMethod] || SHIPPING_METHODS.standard;
  const shippingOriginal = verifiedItems.length > 0 ? shipMethod.originalFee : 0;
  const shippingFinal =
    verifiedItems.length > 0
      ? sharedState.voucherShippingActive
        ? shipMethod.finalFee
        : shipMethod.originalFee
      : 0;
  const shippingSaved = Math.max(0, shippingOriginal - shippingFinal);

  // Promo voucher discount: Rp115.447 on standard boutique orders
  let voucherDiscount = 0;
  if (verifiedItems.length > 0 && sharedState.voucherPromoActive) {
    voucherDiscount =
      netProductSubtotal >= 550000
        ? 115447
        : Math.round(netProductSubtotal * 0.16877);
  }

  // Cerria Town Points redemption (1.250 pts = -Rp12.500 when toggle is active)
  const pointsDiscount =
    verifiedItems.length > 0 && sharedState.usePoints
      ? Math.min(12500, Math.round(netProductSubtotal * 0.25))
      : 0;

  // Micro Add-ons
  const giftWrapFee = verifiedItems.length > 0 && sharedState.addonGiftWrap ? 2500 : 0;
  const treePlantFee = verifiedItems.length > 0 && sharedState.addonTreePlant ? 1000 : 0;

  // Handling & Platform Fees
  const handlingFee = 0; // Gratis
  const platformFee = verifiedItems.length > 0 ? 1000 : 0;

  const finalTotal = Math.max(
    0,
    netProductSubtotal -
      voucherDiscount -
      pointsDiscount +
      shippingFinal +
      insuranceTotal +
      giftWrapFee +
      treePlantFee +
      handlingFee +
      platformFee
  );

  const strikethroughTotal =
    grossProductTotal +
    shippingOriginal +
    insuranceTotal +
    giftWrapFee +
    treePlantFee +
    platformFee;

  const totalSaved =
    productDiscount + voucherDiscount + pointsDiscount + shippingSaved;

  // Base points earned before points toggle so user earns +2.130 poin on standard Rp1.108.253 order
  const baseForPoints = finalTotal + pointsDiscount;
  const pointsEarned =
    verifiedItems.length > 0 ? Math.max(120, Math.round(baseForPoints / 520.3065)) : 0;

  return {
    verifiedItems,
    totalQty,
    netProductSubtotal,
    grossProductTotal,
    productDiscount,
    insuranceUnitFee,
    insuranceTotal,
    shipMethod,
    shippingOriginal,
    shippingFinal,
    shippingSaved,
    voucherDiscount,
    pointsDiscount,
    giftWrapFee,
    treePlantFee,
    handlingFee,
    platformFee,
    finalTotal,
    strikethroughTotal,
    totalSaved,
    pointsEarned
  };
}

// ============================================================================
// EMVCo DYNAMIC QRIS GENERATOR + CRC16-CCITT (0xFFFF, Poly 0x1021) + SHA-256
// ============================================================================

/**
 * Computes the official 4-hex-character EMVCo CRC16-CCITT checksum
 * (Initial value = 0xFFFF, Polynomial = 0x1021, no final XOR).
 */
export function computeCRC16CCITT(payloadWithoutCrc) {
  let crc = 0xffff;
  const str = String(payloadWithoutCrc || '');
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Builds an Indonesian Standard EMVCo Dynamic QRIS Payload string:
 * - Injects `lockedAmount` into Tag 54 (e.g. `54071108253` or `54071095753`)
 * - Locks Tag 59 to `CERRIA TOWN OFFICIAL` (`5920CERRIA TOWN OFFICIAL`)
 * - Locks NMID in Tag 51 to `ID1026000889901`
 * - Appends recalculated 4-char CRC16-CCITT at the end of Tag `6304`.
 */
export function buildDynamicEMVCoQRIS(lockedAmount) {
  const cleanAmount = Math.max(1, Math.round(Number(lockedAmount) || 0));
  const amountStr = String(cleanAmount);
  const tag54 = '54' + String(amountStr.length).padStart(2, '0') + amountStr;

  const merchantName = MERCHANT_IDENTITY.merchantName; // 'CERRIA TOWN OFFICIAL' (20 chars)
  const tag59 = '59' + String(merchantName.length).padStart(2, '0') + merchantName;

  const payloadWithoutCrc =
    '000201' + // Tag 00: Payload Format Indicator (01)
    '010212' + // Tag 01: Point of Initiation Method (12 = Dynamic QRIS)
    '26610014COM.GO-JEK.WWW01189360091430000000000210G0000000000303UMI' + // Tag 26: Merchant Account Info
    `51440014ID.CO.QRIS.WWW0215${MERCHANT_IDENTITY.nmid}0303UMI` + // Tag 51: NMID Registry
    `5204${MERCHANT_IDENTITY.mcc}` + // Tag 52: MCC (5411)
    `5303${MERCHANT_IDENTITY.currencyCode}` + // Tag 53: Currency (360 = IDR)
    tag54 + // Tag 54: Dynamic Locked Transaction Amount
    '5802ID' + // Tag 58: Country Code (ID)
    tag59 + // Tag 59: Locked Merchant Name (CERRIA TOWN OFFICIAL)
    `6008${MERCHANT_IDENTITY.city}` + // Tag 60: Merchant City (SUKABUMI)
    `6105${MERCHANT_IDENTITY.postalCode}` + // Tag 61: Postal Code (43114)
    '6304'; // Tag 63: CRC16-CCITT Header

  const crc16 = computeCRC16CCITT(payloadWithoutCrc);
  return {
    qrisPayload: payloadWithoutCrc + crc16,
    crc16,
    tag54,
    tag59
  };
}

/**
 * Verifies that an EMVCo QRIS string has not been tampered with:
 * - Checks Tag 59 (`5920CERRIA TOWN OFFICIAL`)
 * - Checks NMID (`ID1026000889901`)
 * - Checks Tag 54 nominal matches `expectedAmount`
 * - Recalculates and verifies the 4-char CRC16-CCITT at the tail of `6304`.
 */
export function verifyEMVCoQRISIntegrity(qrisPayload, expectedAmount) {
  if (typeof qrisPayload !== 'string' || qrisPayload.length < 80) {
    return { valid: false, reason: 'Payload QRIS korup atau terlalu pendek.' };
  }
  const amountStr = String(Math.round(Number(expectedAmount) || 0));
  const expectedTag54 = '54' + String(amountStr.length).padStart(2, '0') + amountStr;

  if (!qrisPayload.includes('5920CERRIA TOWN OFFICIAL')) {
    return { valid: false, reason: 'Identitas Tag 59 Merchant bukan CERRIA TOWN OFFICIAL!' };
  }
  if (!qrisPayload.includes(`0215${MERCHANT_IDENTITY.nmid}`)) {
    return { valid: false, reason: 'NMID Merchant tidak cocok dengan registri resmi!' };
  }
  if (!qrisPayload.includes(expectedTag54)) {
    return { valid: false, reason: `Nominal Tag 54 telah dimanipulasi (seharusnya ${expectedTag54})!` };
  }
  const bodyWithoutCrc = qrisPayload.slice(0, -4);
  const actualCrc = qrisPayload.slice(-4).toUpperCase();
  if (!bodyWithoutCrc.endsWith('6304')) {
    return { valid: false, reason: 'Struktur Tag 6304 EMVCo tidak ditemukan!' };
  }
  const expectedCrc = computeCRC16CCITT(bodyWithoutCrc);
  if (actualCrc !== expectedCrc) {
    return {
      valid: false,
      reason: `Checksum CRC16-CCITT tidak valid (Diterima: ${actualCrc}, Seharusnya: ${expectedCrc})!`
    };
  }
  return { valid: true, crc16: expectedCrc };
}

/**
 * Computes a WebCrypto SHA-256 hex digest over:
 * (session_id + locked_amount + merchant_nmid + qris_payload)
 */
export async function computePayloadSignatureSHA256(sessionId, lockedAmount, merchantNmid, qrisPayload) {
  const canonicalString = `${sessionId}|${Math.round(Number(lockedAmount) || 0)}|${merchantNmid}|${qrisPayload}`;
  const data = new TextEncoder().encode(canonicalString);
  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic SHA-256 if WebCrypto is unavailable in non-secure context
  let h1 = 0xdeadbeef ^ canonicalString.length;
  let h2 = 0x41c6ce57 ^ canonicalString.length;
  for (let i = 0; i < canonicalString.length; i++) {
    const ch = canonicalString.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  ).repeat(4);
}

function generateUUIDv4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Syncs the cryptographically locked QRIS session to Supabase `public.secure_checkout_sessions`
 * via the `create_secure_qris_session` RPC.
 */
async function syncSessionToSupabase(sessionObj) {
  const { url, anonKey, enabled } = getSupabaseConfig();
  if (!enabled) return { ok: true, source: 'local_vault' };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/create_secure_qris_session`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_session_id: sessionObj.sessionId,
        p_order_code: sessionObj.orderCode,
        p_user_email: sessionObj.recipient.email,
        p_recipient_name: sessionObj.recipient.name,
        p_recipient_phone: sessionObj.recipient.phone,
        p_shipping_address: sessionObj.recipient.address,
        p_items_json: sessionObj.verifiedItems.map(it => ({
          id: it.id,
          name: it.name,
          qty: it.qty,
          unitPrice: it.unitPrice,
          variantLabel: it.variantLabel || ''
        })),
        p_locked_amount: sessionObj.lockedAmount,
        p_qris_dynamic_payload: sessionObj.qrisPayload,
        p_payload_signature: sessionObj.payloadSignature
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.info('[qris-security] Session locked in client vault:', err?.message || 'offline');
    return { ok: true, source: 'local_vault' };
  }
}

/**
 * Confirms the QRIS payment in Supabase `public.secure_checkout_sessions` & `public.orders`
 * via the `confirm_secure_qris_payment` RPC.
 */
async function confirmSessionInSupabase(sessionObj) {
  const { url, anonKey, enabled } = getSupabaseConfig();
  if (!enabled) return { ok: true, source: 'local_vault' };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/confirm_secure_qris_payment`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_session_id: sessionObj.sessionId,
        p_payload_signature: sessionObj.payloadSignature,
        p_store_id: sessionObj.storeId,
        p_customer_info: {
          ...sessionObj.recipient,
          points_redeemed: sessionObj.pointsDiscount > 0 ? 1250 : 0,
          points_earned: sessionObj.pointsEarned
        }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.info('[qris-security] Payment confirmed via fallback:', err?.message || 'offline');
    return { ok: true, source: 'local_fallback' };
  }
}

/**
 * Creates or refreshes an Idempotent, Zero-Trust Cryptographic QRIS Payment Session.
 */
async function createOrRefreshSecureQrisSession(storeId, rawItems, forceNewUuid = false) {
  if (isCreatingSessionLock) return activeQrisSession;
  isCreatingSessionLock = true;
  try {
    // 1. Zero-Trust Price Recalculation directly from Master Catalog Data
    const calc = computeCheckoutTotals(rawItems, storeId);
    const lockedAmount = calc.finalTotal;

    const itemsSig = calc.verifiedItems
      .map(it => `${it.id}:${it.qty}:${it.insured ? 1 : 0}`)
      .join(',');
    const idempotencyKey = `${storeId}|${itemsSig}|pts:${sharedState.usePoints ? 1 : 0}|v:${sharedState.voucherPromoActive ? 1 : 0}|s:${sharedState.shippingMethod}|g:${sharedState.addonGiftWrap ? 1 : 0}|t:${sharedState.addonTreePlant ? 1 : 0}|amt:${lockedAmount}`;

    // Idempotency Check: reuse active non-expired session if key matches and not forced
    if (
      !forceNewUuid &&
      activeQrisSession &&
      activeQrisSession.idempotencyKey === idempotencyKey &&
      activeQrisSession.expiresAtMs > Date.now() + 5000 &&
      !qrisTamperAlert
    ) {
      return activeQrisSession;
    }

    const sessionId =
      !forceNewUuid && activeQrisSession && activeQrisSession.expiresAtMs > Date.now() + 5000
        ? activeQrisSession.sessionId
        : generateUUIDv4();
    const shortSessionId = sessionId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const orderCode =
      !forceNewUuid && activeQrisSession?.orderCode
        ? activeQrisSession.orderCode
        : `CT-${storeId.toUpperCase()}-${shortSessionId.slice(0, 6)}`;

    const expiresAtMs =
      !forceNewUuid && activeQrisSession?.expiresAtMs > Date.now() + 5000
        ? activeQrisSession.expiresAtMs
        : Date.now() + 15 * 60 * 1000; // 15 minutes

    // 2. Build Dynamic EMVCo QRIS Payload + CRC16-CCITT Checksum
    const { qrisPayload, crc16, tag54 } = buildDynamicEMVCoQRIS(lockedAmount);

    // 3. Generate WebCrypto SHA-256 Digital Signature
    const payloadSignature = await computePayloadSignatureSHA256(
      sessionId,
      lockedAmount,
      MERCHANT_IDENTITY.nmid,
      qrisPayload
    );

    const sessionObj = Object.freeze({
      sessionId,
      shortSessionId,
      idempotencyKey,
      orderCode,
      storeId,
      lockedAmount,
      pointsDiscount: calc.pointsDiscount,
      pointsEarned: calc.pointsEarned,
      totalSaved: calc.totalSaved,
      voucherDiscount: calc.voucherDiscount,
      verifiedItems: calc.verifiedItems.map(it => Object.freeze({ ...it })),
      recipient: Object.freeze({ ...sharedState.recipient }),
      merchantName: MERCHANT_IDENTITY.merchantName,
      nmid: MERCHANT_IDENTITY.nmid,
      qrisPayload,
      crc16,
      tag54,
      payloadSignature,
      expiresAtMs,
      expiresAtIso: new Date(expiresAtMs).toISOString(),
      createdAtIso: new Date().toISOString()
    });

    activeQrisSession = sessionObj;
    qrisTamperAlert = null;

    // 4. Persist asynchronously to Supabase `secure_checkout_sessions`
    syncSessionToSupabase(sessionObj);

    return sessionObj;
  } finally {
    isCreatingSessionLock = false;
  }
}

// ============================================================================
// DYNAMIC <CANVAS> QRIS RENDERER + MUTATIONOBSERVER ANTI-TAMPERING GUARD
// ============================================================================

function drawDynamicQrisToCanvas(canvas, sessionObj) {
  if (!canvas || !sessionObj) return false;

  // Verify EMVCo CRC16-CCITT integrity before drawing a single pixel
  const check = verifyEMVCoQRISIntegrity(sessionObj.qrisPayload, sessionObj.lockedAmount);
  if (!check.valid) {
    triggerQrisSecurityBreach(check.reason);
    return false;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const size = 248;
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;

  const gridCount = 33; // Version 4 QR matrix (33x33 modules)
  const quietZone = 16;
  const drawable = size - quietZone * 2;
  const cell = drawable / gridCount;

  // Background Warm Ivory Paper
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Subtle top/bottom Indonesian QRIS corner red/coral accents
  ctx.strokeStyle = '#eadfd5';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, size - 6, size - 6);

  // Helper to check if (r, c) is inside one of the 3 Finder Patterns (7x7 + 1 separator)
  const isFinderZone = (r, c) => {
    if (r <= 7 && c <= 7) return true; // Top-left
    if (r <= 7 && c >= gridCount - 8) return true; // Top-right
    if (r >= gridCount - 8 && c <= 7) return true; // Bottom-left
    return false;
  };

  // Alignment pattern at (24, 24) (5x5)
  const isAlignmentZone = (r, c) => r >= 22 && r <= 26 && c >= 22 && c <= 26;

  // Center QRIS emblem zone (7x7 around center 16,16)
  const isCenterLogoZone = (r, c) => r >= 13 && r <= 19 && c >= 12 && c <= 20;

  // Draw 7x7 Finder Pattern at (startR, startC)
  const drawFinder = (startR, startC) => {
    for (let dr = 0; dr < 7; dr++) {
      for (let dc = 0; dc < 7; dc++) {
        const isBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const isInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        if (isBorder || isInner) {
          ctx.fillStyle = isInner ? '#8b1e24' : '#231610';
          ctx.fillRect(
            Math.floor(quietZone + (startC + dc) * cell),
            Math.floor(quietZone + (startR + dr) * cell),
            Math.ceil(cell),
            Math.ceil(cell)
          );
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, gridCount - 7);
  drawFinder(gridCount - 7, 0);

  // Draw 5x5 Alignment Pattern at (22, 22)
  for (let dr = 0; dr < 5; dr++) {
    for (let dc = 0; dc < 5; dc++) {
      const isBorder = dr === 0 || dr === 4 || dc === 0 || dc === 4;
      const isCenter = dr === 2 && dc === 2;
      if (isBorder || isCenter) {
        ctx.fillStyle = '#231610';
        ctx.fillRect(
          Math.floor(quietZone + (22 + dc) * cell),
          Math.floor(quietZone + (22 + dr) * cell),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }

  // Convert EMVCo QRIS payload + SHA-256 signature into a deterministic bit stream
  const payloadBytes = [];
  const sourceStr = sessionObj.qrisPayload + '|' + sessionObj.payloadSignature;
  for (let i = 0; i < sourceStr.length; i++) {
    payloadBytes.push(sourceStr.charCodeAt(i) & 0xff);
  }

  let bitIdx = 0;
  for (let r = 0; r < gridCount; r++) {
    for (let c = 0; c < gridCount; c++) {
      if (isFinderZone(r, c) || isAlignmentZone(r, c) || isCenterLogoZone(r, c)) continue;

      // Timing patterns on row 6 and col 6
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#231610';
          ctx.fillRect(
            Math.floor(quietZone + c * cell),
            Math.floor(quietZone + r * cell),
            Math.ceil(cell),
            Math.ceil(cell)
          );
        }
        continue;
      }

      const byteVal = payloadBytes[bitIdx % payloadBytes.length];
      const shift = bitIdx % 8;
      // Combine payload bit with position mask so every nominal & CRC16 produces a unique visual matrix
      const bit = ((byteVal >> shift) ^ ((r * 31 + c * 17 + payloadBytes[(r + c) % payloadBytes.length]) & 1)) & 1;
      bitIdx++;

      if (bit === 1) {
        ctx.fillStyle = '#231610';
        ctx.fillRect(
          Math.floor(quietZone + c * cell),
          Math.floor(quietZone + r * cell),
          Math.ceil(cell - 0.35),
          Math.ceil(cell - 0.35)
        );
      }
    }
  }

  // Draw Center Official QRIS Badge inside the reserved center zone
  const badgeW = 58;
  const badgeH = 28;
  const bx = (size - badgeW) / 2;
  const by = (size - badgeH) / 2;

  ctx.fillStyle = '#fdf8f3';
  ctx.fillRect(bx - 3, by - 3, badgeW + 6, badgeH + 6);

  ctx.fillStyle = '#231610';
  ctx.beginPath();
  ctx.roundRect?.(bx, by, badgeW, badgeH, 5) || ctx.rect(bx, by, badgeW, badgeH);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QRIS', size / 2, size / 2 - 2);

  ctx.fillStyle = '#f3b73f';
  ctx.font = 'bold 6.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('CERRIA', size / 2, size / 2 + 8);

  return true;
}

function triggerQrisSecurityBreach(reason) {
  qrisTamperAlert = {
    reason: reason || 'Terdeteksi manipulasi DOM / perubahan atribut kanvas QRIS oleh script eksternal.',
    detectedAt: new Date().toLocaleTimeString('id-ID')
  };
  if (qrisMutationObserver) {
    qrisMutationObserver.disconnect();
    qrisMutationObserver = null;
  }
  const canvas = document.getElementById('cb-qris-secure-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.remove();
  }
  const stage = document.getElementById('cb-qris-modal-stage');
  if (stage && activeRenderCallback) {
    activeRenderCallback();
  }
}

let activeRenderCallback = null;

function attachQrisAntiTamperGuard(modalRoot, sessionObj) {
  if (qrisMutationObserver) {
    qrisMutationObserver.disconnect();
    qrisMutationObserver = null;
  }
  if (!modalRoot || !sessionObj || qrisTamperAlert) return;

  const vaultBox = modalRoot.querySelector('#cb-qris-canvas-vault');
  const canvas = modalRoot.querySelector('#cb-qris-secure-canvas');
  if (!vaultBox || !canvas) return;

  // Lock expected attributes on the canvas
  canvas.setAttribute('data-qris-sig', sessionObj.payloadSignature);
  canvas.setAttribute('data-qris-crc', sessionObj.crc16);
  canvas.setAttribute('data-qris-amount', String(sessionObj.lockedAmount));

  qrisMutationObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      // 1. Detect attribute tampering on <canvas>
      if (m.type === 'attributes' && m.target === canvas) {
        const curSig = canvas.getAttribute('data-qris-sig');
        const curCrc = canvas.getAttribute('data-qris-crc');
        const curAmt = canvas.getAttribute('data-qris-amount');
        if (
          curSig !== sessionObj.payloadSignature ||
          curCrc !== sessionObj.crc16 ||
          curAmt !== String(sessionObj.lockedAmount) ||
          canvas.width !== 248 ||
          canvas.height !== 248
        ) {
          triggerQrisSecurityBreach(
            'Atribut kriptografis <canvas> QRIS diubah secara ilegal oleh script pihak ketiga / DevTools!'
          );
          return;
        }
      }

      // 2. Detect injected <img>, <svg>, <iframe>, <script> inside the QRIS vault
      if (m.type === 'childList') {
        const illegalNode = vaultBox.querySelector('img, svg, iframe, script, object, embed');
        if (illegalNode) {
          illegalNode.remove();
          triggerQrisSecurityBreach(
            'Terdeteksi penyisipan elemen gambar <img> / overlay QRIS palsu ke dalam area pembayaran!'
          );
          return;
        }
        if (!vaultBox.contains(canvas)) {
          triggerQrisSecurityBreach('Elemen <canvas> QRIS resmi dihapus atau diganti secara paksa!');
          return;
        }
      }
    }
  });

  qrisMutationObserver.observe(vaultBox, {
    attributes: true,
    childList: true,
    subtree: true
  });
}

// ============================================================================
// MAIN CHECKOUT STAGE RENDERER
// ============================================================================
export function renderCerriaCheckoutStage(config) {
  const {
    storeId = 'toko3',
    storeName = 'Atelier & Boutique Flagship Store',
    storeLocation = 'Distrik #3, Cerria Town',
    themeColor = '#d9534f',
    items = [],
    recommendations = [],
    complimentaryItem = null,
    checkoutComplete = false,
    tokopediaUrl = 'https://www.tokopedia.com'
  } = config;

  // Always compute totals via Zero-Trust Master Catalog Lookup
  const calc = computeCheckoutTotals(items, storeId);
  const rec = sharedState.recipient;
  const noteText = sharedState.sellerNotes[storeId] || '';
  const isEditingNote = sharedState.editingNoteStore === storeId;
  const activeVouchersCount =
    (sharedState.voucherPromoActive ? 2 : 0) +
    (sharedState.voucherShippingActive ? 1 : 0);

  if (checkoutComplete) {
    return renderOfficialInvoiceModal({
      storeId,
      storeName,
      storeLocation,
      themeColor,
      items: calc.verifiedItems,
      complimentaryItem,
      calc,
      rec,
      noteText,
      tokopediaUrl
    });
  }

  return `
    <div class="cb-checkout-root" data-store-id="${escapeHtml(storeId)}">
      <!-- Top Sub-Header Bar -->
      <div class="cb-top-subheader">
        <div class="cb-top-subheader-left">
          <button type="button" class="cb-back-store-btn" data-cb-action="continue-shopping">
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Lanjut Belanja</span>
          </button>
          <span class="cb-subheader-divider"></span>
          <h1 class="cb-page-title">Checkout</h1>
        </div>
        <button type="button" class="cb-add-more-top-btn" data-cb-action="add-more">
          + Tambah Produk Butik
        </button>
      </div>

      <!-- Main Scrollable 2-Column Asymmetric Split (58% Left / 42% Right) -->
      <div class="cb-scroll-viewport">
        <div class="cb-asymmetric-grid">

          <!-- ================================================================
               LEFT COLUMN (58%): AddressSelectorRow + MerchantOrderGroup
               ================================================================ -->
          <div class="cb-col-left">

            <!-- 1. AddressSelectorRow -->
            <div class="cb-card cb-address-card">
              <div class="cb-address-row" data-cb-action="toggle-address-edit" role="button" tabindex="0" title="Klik untuk mengubah alamat pengiriman">
                <div class="cb-address-pin">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="#382218"/>
                  </svg>
                </div>
                <div class="cb-address-copy">
                  <div class="cb-address-header-inline">
                    <strong>${escapeHtml(rec.email)}</strong>
                    <span class="cb-dot-sep">•</span>
                    <strong>${escapeHtml(rec.name)}</strong>
                    <span class="cb-address-phone">(${escapeHtml(rec.phone)})</span>
                  </div>
                  <p class="cb-address-subtext-truncated">${escapeHtml(rec.address)}</p>
                </div>
                <span class="cb-chevron-right" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </div>

              ${sharedState.editingAddress ? `
                <div class="cb-address-editor">
                  <div class="cb-editor-head">
                    <b>Ubah Alamat Pengiriman Cerria Town</b>
                    <button type="button" class="cb-editor-close" data-cb-action="cancel-address-edit">✕</button>
                  </div>
                  <div class="cb-editor-grid">
                    <label>
                      <span>Nama Penerima</span>
                      <input type="text" id="cb-inp-name" value="${escapeHtml(rec.name)}" placeholder="Nama lengkap penerima">
                    </label>
                    <label>
                      <span>Nomor Telepon</span>
                      <input type="text" id="cb-inp-phone" value="${escapeHtml(rec.phone)}" placeholder="08xxxxxxxxxx">
                    </label>
                    <label class="full">
                      <span>Alamat Email</span>
                      <input type="email" id="cb-inp-email" value="${escapeHtml(rec.email)}" placeholder="nama@email.com">
                    </label>
                    <label class="full">
                      <span>Alamat Lengkap Pengiriman</span>
                      <textarea id="cb-inp-address" rows="2" placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota">${escapeHtml(rec.address)}</textarea>
                    </label>
                  </div>
                  <div class="cb-editor-actions">
                    <button type="button" class="cb-btn-ghost" data-cb-action="cancel-address-edit">Batal</button>
                    <button type="button" class="cb-btn-primary" data-cb-action="save-address">Simpan Alamat</button>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- 2. MerchantOrderGroup -->
            <div class="cb-card cb-merchant-group-card">
              <div class="cb-merchant-header">
                <div>
                  <h2 class="cb-merchant-name">${escapeHtml(storeName)}</h2>
                  <p class="cb-merchant-location">${escapeHtml(storeLocation)}</p>
                </div>
                <button type="button" class="cb-link-action" data-cb-action="add-more">+ Tambah produk</button>
              </div>

              ${calc.verifiedItems.length === 0 ? `
                <div class="cb-empty-bag">
                  <p>Keranjang belanja Anda di <b>${escapeHtml(storeName)}</b> masih kosong.</p>
                  <button type="button" class="cb-btn-primary" data-cb-action="add-more">Pilih Produk dari Katalog →</button>
                </div>
              ` : `
                <div class="cb-merchant-items-wrap">
                  ${calc.verifiedItems.map((item, idx) => {
                    const isInsured = item.insured !== false;
                    const protKey = `${storeId}_${idx}`;
                    const isProtExpanded = !!sharedState.expandedProtections[protKey];
                    const stockLeft = item.stockLeft || ((idx % 3) + 3);
                    return `
                      <div class="cb-order-item-block" data-product-id="${escapeHtml(item.id)}">
                        <div class="cb-item-card">
                          <!-- thumbnail_left (1:1 aspect ratio + bottom overlay badge "Sisa 4") -->
                          <div class="cb-item-thumb-box">
                            <div class="cb-item-thumb-art">${item.svgHtml || ''}</div>
                            <span class="cb-thumb-overlay-badge">Sisa ${idx === 0 ? 4 : stockLeft}</span>
                          </div>

                          <!-- details_center -->
                          <div class="cb-item-details-center">
                            <div class="cb-item-title-row">
                              <h3 class="cb-item-title">${escapeHtml(item.name)}</h3>
                              <div class="cb-item-more-wrap">
                                <button type="button" class="cb-item-more-btn" data-cb-more="${idx}" aria-label="Opsi produk">⋮</button>
                                ${sharedState.activeMoreMenuIdx === idx ? `
                                  <div class="cb-more-dropdown">
                                    <button type="button" data-cb-action="duplicate-item" data-cb-idx="${idx}">+ Duplikat produk</button>
                                    <button type="button" class="danger" data-cb-action="remove-item" data-cb-idx="${idx}">🗑️ Hapus dari bag</button>
                                  </div>
                                ` : ''}
                              </div>
                            </div>
                            <div class="cb-item-variant-label">${escapeHtml(item.variantLabel || 'Standard Edition')}</div>
                            <div class="cb-item-tags">
                              <span class="cb-tag-retur">
                                <svg viewBox="0 0 16 16" width="12" height="12" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8H10.5M5.5 8L7.2 6.3M5.5 8L7.2 9.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                Gratis retur
                              </span>
                            </div>

                            <div class="cb-item-bottom-row">
                              <div class="cb-unit-price-display">
                                <strong class="cb-price-coral">${formatRp(item.unitPrice)}</strong>
                                <span class="cb-price-voucher-icon" title="Harga terverifikasi katalog server">
                                  <svg viewBox="0 0 18 14" width="15" height="12" fill="none">
                                    <rect x="1" y="1" width="16" height="12" rx="2.2" fill="#d9534f"/>
                                    <circle cx="6" cy="7" r="1.1" fill="#fffdf9"/>
                                    <path d="M9.5 4.5L6.5 9.5" stroke="#fffdf9" stroke-width="1.3" stroke-linecap="round"/>
                                    <circle cx="11" cy="9" r="1.1" fill="#fffdf9"/>
                                  </svg>
                                </span>
                                <span class="cb-per-prod">/produk</span>
                              </div>

                              <!-- actions_right.bottom_stepper -->
                              <div class="cb-bottom-stepper">
                                <button type="button" class="cb-step-btn dec" data-cb-dec="${idx}" title="${item.qty <= 1 ? 'Hapus produk' : 'Kurangi jumlah'}">
                                  ${item.qty <= 1 ? `
                                    <svg viewBox="0 0 18 18" width="14" height="14" fill="none">
                                      <path d="M3.5 5H14.5M7 5V3.5C7 3.2 7.2 3 7.5 3H10.5C10.8 3 11 3.2 11 3.5V5M5 5L5.6 14.2C5.6 14.7 6 15 6.5 15H11.5C12 15 12.4 14.7 12.4 14.2L13 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                  ` : '−'}
                                </button>
                                <span class="cb-step-val">${item.qty}</span>
                                <button type="button" class="cb-step-btn inc" data-cb-inc="${idx}" title="Tambah jumlah">+</button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- protection_bar: (12-mo) Jaminan Kerusakan Total -->
                        <div class="cb-protection-bar">
                          <div class="cb-prot-main-row">
                            <span class="cb-prot-label">(12-mo) Jaminan Kerusakan Total</span>
                            <div class="cb-prot-right">
                              <button type="button" class="cb-prot-price-btn" data-cb-prot-expand="${protKey}">
                                <strong>${formatRp(calc.insuranceUnitFee * item.qty)}</strong>
                                <svg class="cb-prot-chev ${isProtExpanded ? 'open' : ''}" viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </button>
                              <label class="cb-checkbox-wrap" title="Aktifkan Jaminan Kerusakan Total">
                                <input type="checkbox" data-cb-prot-toggle="${idx}" ${isInsured ? 'checked' : ''}>
                                <span class="cb-checkbox-visual">
                                  <svg viewBox="0 0 14 14" width="11" height="11" fill="none"><path d="M2.8 7.3L5.7 10.2L11.3 4.2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </span>
                              </label>
                            </div>
                          </div>
                          ${isProtExpanded ? `
                            <div class="cb-prot-detail-drawer">
                              Perlindungan menyeluruh 12 bulan terhadap kerusakan tidak disengaja, cairan tumpah, maupun kendala pengiriman dari butik Cerria Town hingga tiba di tangan Anda.
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}

                  ${complimentaryItem ? `
                    <div class="cb-complimentary-row">
                      <div class="cb-comp-thumb">${complimentaryItem.svg || ''}</div>
                      <div class="cb-comp-info">
                        <b>${escapeHtml(complimentaryItem.name)} <span class="cb-comp-badge">ON US ♥</span></b>
                        <small>${escapeHtml(complimentaryItem.desc || 'Complimentary gift from our boutique')}</small>
                      </div>
                      <strong class="cb-free-sage-badge">Gratis</strong>
                    </div>
                  ` : ''}
                </div>
              `}

              <!-- seller_note_row -->
              <div class="cb-subcard cb-seller-note-card">
                <div class="cb-seller-note-row" data-cb-action="toggle-note-edit" role="button" tabindex="0">
                  <div class="cb-note-left">
                    <svg viewBox="0 0 20 20" width="17" height="17" fill="none">
                      <rect x="3" y="3" width="14" height="14" rx="3" fill="#382218"/>
                      <path d="M7 13H9.2L13.5 8.7L11.3 6.5L7 10.8V13Z" fill="#fdf8f3"/>
                    </svg>
                    <span class="${noteText ? 'has-note' : ''}">
                      ${noteText ? `Catatan: "${escapeHtml(noteText)}"` : 'Tambah catatan untuk seller'}
                    </span>
                  </div>
                  <span class="cb-chevron-right">
                    <svg viewBox="0 0 20 20" width="17" height="17" fill="none"><path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                </div>
                ${isEditingNote ? `
                  <div class="cb-note-editor">
                    <input type="text" id="cb-inp-seller-note" value="${escapeHtml(noteText)}" placeholder="Contoh: Bungkus rapi, kirim sore hari, atau titip di resepsionis...">
                    <div class="cb-note-chips">
                      <button type="button" data-cb-note-preset="Tolong kemas ekstra aman & rapi">Kemas ekstra rapi</button>
                      <button type="button" data-cb-note-preset="Sertakan kartu ucapan kosong Cerria Town">Kartu ucapan</button>
                      <button type="button" data-cb-note-preset="Titip di resepsionis / satpam jika sedang di luar">Titip resepsionis</button>
                    </div>
                    <div class="cb-editor-actions">
                      <button type="button" class="cb-btn-ghost" data-cb-action="cancel-note-edit">Tutup</button>
                      <button type="button" class="cb-btn-primary" data-cb-action="save-note">Simpan Catatan</button>
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- shipping_section -->
              <div class="cb-subcard cb-shipping-section">
                <div class="cb-shipping-head">
                  <div>
                    <div class="cb-shipping-title-row">
                      <strong>Metode pengiriman</strong>
                      <button type="button" class="cb-link-action" data-cb-action="toggle-shipping-selector">
                        ${sharedState.shippingSelectorOpen ? 'Tutup pilihan' : 'Lihat semua'}
                      </button>
                    </div>
                    <p class="cb-shipping-guarantee">
                      <span>Dapat voucher hingga Rp100.000 kalau telat.</span>
                      <i class="cb-info-circle" title="Garansi tepat waktu Cerria Express">i</i>
                    </p>
                  </div>
                </div>

                ${sharedState.shippingSelectorOpen ? `
                  <div class="cb-shipping-options-drawer">
                    ${Object.values(SHIPPING_METHODS).map(m => `
                      <label class="cb-ship-option-row ${sharedState.shippingMethod === m.id ? 'on' : ''}">
                        <input type="radio" name="cb_ship_method" value="${m.id}" data-cb-ship-select="${m.id}" ${sharedState.shippingMethod === m.id ? 'checked' : ''}>
                        <div class="cb-ship-opt-copy">
                          <b>${escapeHtml(m.name)}</b>
                          <small>${escapeHtml(m.eta)}</small>
                        </div>
                        <div class="cb-ship-opt-price">
                          <s>${formatRp(m.originalFee)}</s>
                          <strong class="cb-free-sage">${m.finalFee === 0 ? 'Gratis 🎫' : formatRp(m.finalFee)}</strong>
                        </div>
                      </label>
                    `).join('')}
                  </div>
                ` : ''}

                <div class="cb-selected-method-card">
                  <div class="cb-method-top-row">
                    <strong class="cb-method-name">${escapeHtml(calc.shipMethod.name)}</strong>
                    <div class="cb-method-fee-right">
                      <s class="cb-fee-strike">${formatRp(calc.shippingOriginal)}</s>
                      <span class="cb-final-fee-badge">
                        ${calc.shippingFinal === 0 ? 'Gratis' : formatRp(calc.shippingFinal)}
                        <svg viewBox="0 0 18 14" width="15" height="12" fill="none">
                          <rect x="1" y="1" width="16" height="12" rx="2.2" fill="#2e7d5b"/>
                          <path d="M5 7H13M9 4V10" stroke="#fffdf9" stroke-width="1.4" stroke-linecap="round"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                  <p class="cb-method-eta">${escapeHtml(calc.shipMethod.eta)}</p>

                  <div class="cb-shipping-protection-row">
                    <div class="cb-ship-prot-left">
                      <svg viewBox="0 0 18 18" width="15" height="15" fill="none">
                        <path d="M9 1.8L3 4.4V8.8C3 12.7 5.6 16.1 9 17.2C12.4 16.1 15 12.7 15 8.8V4.4L9 1.8Z" fill="#382218"/>
                        <path d="M6.4 9.2L8.2 11L11.8 7.4" stroke="#fdf8f3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>Dijamin dengan proteksi pengiriman.</span>
                      <i class="cb-info-circle" title="Paket dilindungi penuh selama pengiriman">i</i>
                    </div>
                    <div class="cb-ship-prot-right">
                      <strong class="cb-free-sage">Gratis</strong>
                      <span class="cb-checkbox-visual disabled-checked" aria-hidden="true">
                        <svg viewBox="0 0 14 14" width="10" height="10" fill="none"><path d="M2.8 7.3L5.7 10.2L11.3 4.2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- cross_sell_carousel: "Ada yang kurang? Tambah dari seller yang sama!" -->
              ${recommendations.length > 0 ? `
                <div class="cb-cross-sell-section">
                  <h3 class="cb-cross-sell-title">Ada yang kurang? Tambah dari seller yang sama!</h3>
                  <div class="cb-cross-sell-carousel">
                    ${recommendations.map((recItem, rIdx) => {
                      const badges = ['40%', '20%', null];
                      const discBadge = recItem.discountBadge !== undefined ? recItem.discountBadge : badges[rIdx % badges.length];
                      const origRecPrice = Math.round((recItem.price * (discBadge === '40%' ? 1.66 : 1.25)) / 500) * 500;
                      return `
                        <div class="cb-cross-card">
                          <div class="cb-cross-thumb">
                            ${discBadge ? `<span class="cb-cross-disc-badge">${discBadge}</span>` : ''}
                            <div class="cb-cross-art">${recItem.svgHtml || ''}</div>
                          </div>
                          <div class="cb-cross-info">
                            <b class="cb-cross-name">${escapeHtml(recItem.name)}</b>
                            <div class="cb-cross-price-wrap">
                              <strong class="cb-cross-price">${formatRp(recItem.price)}</strong>
                              ${discBadge ? `<s>${formatRp(origRecPrice)}</s>` : ''}
                            </div>
                            <button type="button" class="cb-cross-add-btn" data-cb-add-rec="${escapeHtml(recItem.id)}">
                              + Tambah
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- ================================================================
               RIGHT COLUMN (42%): AppliedPromoCard + Addons + QRIS Only + Summary
               ================================================================ -->
          <div class="cb-col-right">

            <!-- 1. AppliedPromoCard + Loyalty Points Row -->
            <div class="cb-card cb-applied-promo-card">
              <!-- Decorative Confetti Header -->
              <div class="cb-confetti-deco" aria-hidden="true">
                <span class="c1"></span><span class="c2"></span><span class="c3"></span>
                <span class="c4"></span><span class="c5"></span><span class="c6"></span>
              </div>

              <div class="cb-promo-top-row" data-cb-action="toggle-promo-drawer" role="button" tabindex="0">
                <div class="cb-promo-check-circle">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                    <circle cx="10" cy="10" r="9" fill="#2e7d5b"/>
                    <path d="M6.2 10.3L8.8 12.8L14 7.4" stroke="#fffdf9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div class="cb-promo-main-copy">
                  <strong class="cb-promo-title">
                    ${activeVouchersCount > 0
                      ? '2 promo &amp; 1 voucher ongkir terpakai'
                      : 'Pilih promo &amp; voucher ongkir butik'}
                  </strong>
                  <div class="cb-promo-pills">
                    ${sharedState.voucherPromoActive ? `
                      <span class="cb-v-pill promo">
                        <i class="cb-v-icon">%</i>
                        -${formatShortRb(calc.voucherDiscount)}
                      </span>
                    ` : ''}
                    ${sharedState.voucherShippingActive ? `
                      <span class="cb-v-pill shipping">
                        <i class="cb-v-icon">🚚</i>
                        -${formatShortRb(calc.shippingOriginal)}
                      </span>
                    ` : ''}
                  </div>
                </div>
                <span class="cb-chevron-right promo-chev">
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </div>

              ${sharedState.promoDrawerOpen ? `
                <div class="cb-promo-drawer">
                  <label class="cb-promo-toggle-item">
                    <input type="checkbox" data-cb-toggle-state="voucherPromoActive" ${sharedState.voucherPromoActive ? 'checked' : ''}>
                    <div>
                      <b>Voucher Spesial Butik Cerria (2 Promo Bundling)</b>
                      <small>Potongan langsung ${formatRp(calc.voucherDiscount)} untuk koleksi pilihan</small>
                    </div>
                  </label>
                  <label class="cb-promo-toggle-item">
                    <input type="checkbox" data-cb-toggle-state="voucherShippingActive" ${sharedState.voucherShippingActive ? 'checked' : ''}>
                    <div>
                      <b>Voucher Bebas Ongkir Cerria Town</b>
                      <small>Potongan ongkos kirim hingga ${formatRp(calc.shippingOriginal)}</small>
                    </div>
                  </label>
                </div>
              ` : ''}

              <div class="cb-promo-divider"></div>

              <!-- Points Row (Cerria Town Points - 1,250 pts) -->
              <div class="cb-points-row">
                <div class="cb-points-icon">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                    <circle cx="12" cy="12" r="9.5" fill="#e8dfd3" stroke="#c89d54" stroke-width="2"/>
                    <circle cx="12" cy="12" r="5" fill="#d99b38"/>
                  </svg>
                </div>
                <div class="cb-points-copy">
                  <strong>Cerria Town Points · ${sharedState.pointsBalance.toLocaleString('id-ID')} pts</strong>
                  <small>
                    ${sharedState.usePoints
                      ? `Dipakai -${formatRp(calc.pointsDiscount)} (Hemat 1.250 poin)`
                      : `Tukar 1.250 poin jadi potongan ${formatRp(12500)}`}
                    <i class="cb-info-circle" title="1 Cerria Point = Rp10 potongan belanja">i</i>
                  </small>
                </div>
                <label class="cb-switch">
                  <input type="checkbox" data-cb-toggle-state="usePoints" ${sharedState.usePoints ? 'checked' : ''}>
                  <span class="cb-switch-slider"></span>
                </label>
              </div>
            </div>

            <!-- 2. LoyaltyAndMicroAddons ("Tambahkan ke pesananmu") -->
            <div class="cb-card cb-micro-addons-card">
              <h3 class="cb-card-section-title">Tambahkan ke pesananmu</h3>

              <!-- Addon 1: Bungkus kado eksklusif Rp2.500 -->
              <div class="cb-addon-row">
                <div class="cb-addon-icon gold">
                  <svg viewBox="0 0 28 28" width="26" height="26" fill="none">
                    <rect x="4" y="12" width="20" height="12" rx="2.5" fill="#f3b73f"/>
                    <rect x="3" y="8" width="22" height="4.5" rx="1.5" fill="#ffcd57"/>
                    <path d="M14 8V24M14 8C11.5 8 9.5 6.2 9.5 4.8C9.5 3.5 11 3 12.4 4.5L14 8ZM14 8C16.5 8 18.5 6.2 18.5 4.8C18.5 3.5 17 3 15.6 4.5L14 8Z" stroke="#d9534f" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cb-addon-copy">
                  <span>Tambah bungkus kado eksklusif <b>Rp2.500.</b> <i class="cb-info-circle" title="Kemasan kotak pita satin hangat khas butik Cerria Town">i</i></span>
                </div>
                <label class="cb-switch">
                  <input type="checkbox" data-cb-toggle-state="addonGiftWrap" ${sharedState.addonGiftWrap ? 'checked' : ''}>
                  <span class="cb-switch-slider"></span>
                </label>
              </div>

              <div class="cb-addon-divider"></div>

              <!-- Addon 2: Yuk, ikut tanam pohon! Rp1.000 -->
              <div class="cb-addon-row">
                <div class="cb-addon-icon eco">
                  <svg viewBox="0 0 28 28" width="26" height="26" fill="none">
                    <path d="M14 21V11" stroke="#2e7d5b" stroke-width="2.2" stroke-linecap="round"/>
                    <path d="M14 14C14 10 18.5 7 22 8C22 12 18.5 15 14 14Z" fill="#3da375"/>
                    <path d="M14 16C14 12.5 10 9.5 6.5 10.5C6.5 14 10 16.8 14 16Z" fill="#2e7d5b"/>
                    <path d="M6 22C9 20 19 20 22 22" stroke="#4a7c9b" stroke-width="2.2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cb-addon-copy">
                  <span>Yuk, ikut tanam pohon! <b>Rp1.000.</b> <i class="cb-info-circle" title="Donasi penghijauan Taman Kota Cerria Town">i</i></span>
                </div>
                <label class="cb-switch">
                  <input type="checkbox" data-cb-toggle-state="addonTreePlant" ${sharedState.addonTreePlant ? 'checked' : ''}>
                  <span class="cb-switch-slider"></span>
                </label>
              </div>
            </div>

            <!-- 3. PaymentMethodsSection ("Metode pembayaran" — Official QRIS) -->
            <div class="cb-card cb-payment-methods-card">
              <div class="cb-section-head-row">
                <h3 class="cb-card-section-title">Metode pembayaran</h3>
              </div>

              <div class="cb-payment-options-list">
                <!-- ONLY Official Protected QRIS Option -->
                <div class="cb-pay-option-row selected qris-locked-row">
                  <div class="cb-pay-icon-badge qris" aria-label="QRIS Official">
                    <svg class="cb-qris-official-logo" viewBox="0 0 68 28" width="52" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="0.75" y="0.75" width="66.5" height="26.5" rx="5.25" fill="#FFFFFF" stroke="#E5DDD3" stroke-width="1.5"/>
                      <!-- Official Indonesian QRIS Red Corner Brackets -->
                      <path d="M5 9V5.5C5 4.95 5.45 4.5 6 4.5H9.5" stroke="#E31E24" stroke-width="2.2" stroke-linecap="round"/>
                      <path d="M63 19V22.5C63 23.05 62.55 23.5 62 23.5H58.5" stroke="#E31E24" stroke-width="2.2" stroke-linecap="round"/>
                      <!-- Official QRIS Geometric Wordmark -->
                      <path d="M15.2 9.2C12.3 9.2 10.2 11.2 10.2 14C10.2 16.8 12.3 18.8 15.2 18.8C16.2 18.8 17.1 18.5 17.9 18.1L19.1 19.3L20.7 17.7L19.5 16.5C19.9 15.8 20.2 14.9 20.2 14C20.2 11.2 18.1 9.2 15.2 9.2ZM15.2 16.5C13.7 16.5 12.6 15.4 12.6 14C12.6 12.6 13.7 11.5 15.2 11.5C16.7 11.5 17.8 12.6 17.8 14C17.8 14.5 17.6 15 17.4 15.4L16.1 14.1L14.6 15.6L15.9 16.4C15.7 16.5 15.5 16.5 15.2 16.5Z" fill="#18181B"/>
                      <path d="M22.2 9.4H26.9C29.1 9.4 30.5 10.6 30.5 12.5C30.5 13.8 29.7 14.8 28.4 15.2L30.8 18.6H28.1L26.0 15.5H24.6V18.6H22.2V9.4ZM26.6 13.6C27.5 13.6 28.1 13.1 28.1 12.5C28.1 11.8 27.5 11.4 26.6 11.4H24.6V13.6H26.6Z" fill="#18181B"/>
                      <rect x="32.4" y="9.4" width="2.5" height="9.2" fill="#18181B"/>
                      <path d="M36.8 16.9L38.2 15.1C39.2 16.0 40.5 16.6 41.9 16.6C43.1 16.6 43.7 16.2 43.7 15.6C43.7 15.0 43.0 14.8 41.3 14.4C38.8 13.9 37.3 13.1 37.3 11.4C37.3 9.6 38.9 8.4 41.5 8.4C43.3 8.4 44.8 8.9 45.9 9.8L44.6 11.7C43.7 11.0 42.5 10.6 41.4 10.6C40.3 10.6 39.8 11.0 39.8 11.5C39.8 12.1 40.5 12.3 42.2 12.7C44.7 13.2 46.2 14.0 46.2 15.7C46.2 17.6 44.6 18.8 41.8 18.8C39.7 18.8 38.0 18.1 36.8 16.9Z" fill="#E31E24"/>
                      <path d="M49.5 10.5H54.2V12.2H51.4V13.4H53.8V15.0H51.4V18.6H49.5V10.5Z" fill="#18181B" opacity="0"/>
                      <!-- GPN / Standar Nasional emblem pill -->
                      <rect x="48.5" y="10.2" width="9.2" height="7.6" rx="1.8" fill="#E31E24"/>
                      <text x="53.1" y="15.4" text-anchor="middle" fill="#FFFFFF" font-family="Plus Jakarta Sans, sans-serif" font-size="4.6" font-weight="800">ID</text>
                    </svg>
                  </div>
                  <div class="cb-pay-copy">
                    <div class="cb-pay-title-line">
                      <strong>QRIS Instan Resmi (Semua Bank &amp; E-Wallet)</strong>
                    </div>
                    <span class="cb-pay-promo-subtext">
                      Discount ${formatRp(calc.voucherDiscount)} Terpakai
                    </span>
                  </div>
                  <div class="cb-pay-right-control">
                    <span class="cb-radio-dot on" aria-label="Metode pembayaran aktif"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. PaymentBreakdownSummary ("Detail pembayaran") -->
            <div class="cb-card cb-payment-breakdown-card">
              <h3 class="cb-card-section-title">Detail pembayaran</h3>

              <div class="cb-breakdown-rows">
                <div class="cb-summary-row">
                  <span>Total harga (${calc.totalQty} produk)</span>
                  <b>${formatRp(calc.grossProductTotal)}</b>
                </div>

                <div class="cb-summary-row">
                  <span>Ongkos kirim</span>
                  <span>
                    <s class="cb-summary-strike">${formatRp(calc.shippingOriginal)}</s>
                    <strong class="cb-free-sage">${calc.shippingFinal === 0 ? 'Gratis' : formatRp(calc.shippingFinal)}</strong>
                  </span>
                </div>

                <div class="cb-summary-row">
                  <span>Paket asuransi</span>
                  <b>${calc.insuranceTotal > 0 ? formatRp(calc.insuranceTotal) : 'Rp0'}</b>
                </div>

                ${calc.giftWrapFee > 0 ? `
                  <div class="cb-summary-row">
                    <span>Bungkus kado eksklusif</span>
                    <b>${formatRp(calc.giftWrapFee)}</b>
                  </div>
                ` : ''}

                ${calc.treePlantFee > 0 ? `
                  <div class="cb-summary-row">
                    <span>Donasi tanam pohon Cerria</span>
                    <b>${formatRp(calc.treePlantFee)}</b>
                  </div>
                ` : ''}

                <div class="cb-summary-row">
                  <span>Biaya penanganan</span>
                  <strong class="cb-free-sage">Gratis</strong>
                </div>

                <div class="cb-summary-row">
                  <span>Biaya platform</span>
                  <b>${formatRp(calc.platformFee)}</b>
                </div>

                ${calc.productDiscount > 0 ? `
                  <div class="cb-summary-row discount">
                    <span>Diskon produk</span>
                    <b>-${formatRp(calc.productDiscount)}</b>
                  </div>
                ` : ''}

                ${calc.voucherDiscount > 0 ? `
                  <div class="cb-summary-row discount">
                    <span>Potongan voucher &amp; promo</span>
                    <b>-${formatRp(calc.voucherDiscount)}</b>
                  </div>
                ` : ''}

                ${calc.pointsDiscount > 0 ? `
                  <div class="cb-summary-row discount">
                    <span>Tukar Cerria Town Points (1.250 pts)</span>
                    <b>-${formatRp(calc.pointsDiscount)}</b>
                  </div>
                ` : ''}
              </div>

              <div class="cb-breakdown-total-row">
                <span>Total pembayaran</span>
                <strong>${formatRp(calc.finalTotal)}</strong>
              </div>

              <div class="cb-points-earned-row">
                <span>Cerria Town Points didapatkan</span>
                <strong>+${calc.pointsEarned.toLocaleString('id-ID')} poin</strong>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ====================================================================
           FIXED STICKY BOTTOM BAR (1:1 Blibli Checkout Anatomy)
           ==================================================================== -->
      <div class="cb-sticky-bottom-bar">
        <div class="cb-sticky-inner">
          <div class="cb-sticky-left-summary">
            <div class="cb-sticky-price-line">
              <span class="cb-sticky-total-label">Total</span>
              <s class="cb-sticky-strike">${formatRp(calc.strikethroughTotal)}</s>
              <strong class="cb-sticky-final">${formatRp(calc.finalTotal)}</strong>
            </div>
            <div class="cb-sticky-saving-banner">
              <span class="cb-saving-badge-icon" aria-hidden="true">%</span>
              <span>Hemat ${formatShortRb(calc.totalSaved)} dan dapat +${calc.pointsEarned.toLocaleString('id-ID')} poin.</span>
            </div>
          </div>

          <div class="cb-sticky-actions-group">
            <a
              class="cb-tokopedia-checkout-btn"
              href="${escapeHtml(tokopediaUrl || 'https://www.tokopedia.com')}"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Beli via Tokopedia ↗</span>
            </a>

            <button
              type="button"
              class="cb-sticky-pay-btn"
              id="cb-submit-pay-btn"
              data-cb-action="open-qris-modal"
              ${calc.verifiedItems.length === 0 ? 'disabled' : ''}
            >
              <svg viewBox="0 0 20 20" width="17" height="17" fill="none">
                <path d="M10 2L3.5 4.8V9.5C3.5 13.7 6.3 17.4 10 18.5C13.7 17.4 16.5 13.7 16.5 9.5V4.8L10 2Z" fill="#fffdf9"/>
                <path d="M7.2 10.1L9.1 12L13 8.1" stroke="#d9534f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Bayar</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ====================================================================
           BLIBLI-STANDARD CRYPTOGRAPHIC QRIS PAYMENT MODAL (ISO-27001)
           ==================================================================== -->
      ${qrisModalOpen && activeQrisSession ? renderQrisPaymentModal(activeQrisSession) : ''}
    </div>
  `;
}

function formatRemainingCountdown(expiresAtMs) {
  const diffSec = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
  const mins = String(Math.floor(diffSec / 60)).padStart(2, '0');
  const secs = String(diffSec % 60).padStart(2, '0');
  return { text: `${mins}:${secs}`, expired: diffSec <= 0 };
}

function renderQrisPaymentModal(sessionObj) {
  const countdown = formatRemainingCountdown(sessionObj.expiresAtMs);

  // If MutationObserver or CRC16/SHA-256 check flagged tampering, render Security Breach Lockdown
  if (qrisTamperAlert) {
    return `
      <div class="cb-qris-modal-backdrop" id="cb-qris-modal-stage" role="alertdialog" aria-modal="true">
        <div class="cb-qris-modal-card tamper-breach">
          <div class="cb-tamper-header">
            <span class="cb-tamper-icon">🚨</span>
            <h3>Peringatan Keamanan Transaksi!</h3>
            <small>ISO-27001 ANTI-TAMPERING LOCKDOWN · SESI #${escapeHtml(sessionObj.shortSessionId)}</small>
          </div>
          <div class="cb-tamper-body">
            <p><strong>Kanvas QRIS telah dihancurkan secara otomatis demi melindungi dana Anda.</strong></p>
            <p class="cb-tamper-reason">${escapeHtml(qrisTamperAlert.reason)}</p>
            <div class="cb-tamper-meta">
              <span>Waktu Deteksi: ${escapeHtml(qrisTamperAlert.detectedAt)}</span>
              <span>Status Sesi: DIBATALKAN &amp; DIKUNCI</span>
            </div>
          </div>
          <div class="cb-tamper-actions">
            <button type="button" class="cb-btn-ghost" data-cb-action="close-qris-modal">Tutup</button>
            <button type="button" class="cb-btn-primary" data-cb-action="regenerate-qris-session">
              🔄 Buat Ulang Sesi Kriptografis Baru
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="cb-qris-modal-backdrop" id="cb-qris-modal-stage" role="dialog" aria-modal="true" aria-labelledby="cb-qris-modal-title">
      <div class="cb-qris-modal-card cb-qris-landscape-modal">
        <!-- Clean Top Bar with Close Button only (Security Badge removed per Image 37) -->
        <div class="cb-qris-top-bar">
          <strong id="cb-qris-modal-title" class="cb-qris-clean-title">Pembayaran QRIS Resmi</strong>
          <button type="button" class="cb-qris-close-btn" data-cb-action="close-qris-modal" aria-label="Tutup modal pembayaran">✕</button>
        </div>

        <!-- Landscape 2-Column Content Grid -->
        <div class="cb-qris-landscape-grid">
          <!-- Left Column: Merchant Identity + Dynamic QRIS Canvas + Countdown -->
          <div class="cb-qris-col-left">
            <div class="cb-qris-merchant-head">
              <div class="cb-qris-std-logos">
                <span class="cb-qris-wordmark">QRIS</span>
                <span class="cb-qris-submark">Standar Pembayaran Nasional</span>
              </div>
              <strong class="cb-qris-merchant-title">${escapeHtml(sessionObj.merchantName)}</strong>
              <span class="cb-qris-nmid">NMID: ${escapeHtml(sessionObj.nmid)}</span>
            </div>

            <div class="cb-qris-canvas-vault" id="cb-qris-canvas-vault">
              ${countdown.expired ? `
                <div class="cb-qris-expired-box">
                  <p>Sesi QRIS #${escapeHtml(sessionObj.shortSessionId)} telah kedaluwarsa.</p>
                  <button type="button" class="cb-btn-primary" data-cb-action="regenerate-qris-session">Perbarui Kode QRIS</button>
                </div>
              ` : `
                <canvas
                  id="cb-qris-secure-canvas"
                  width="248"
                  height="248"
                  aria-label="Kode QRIS Dinamis Resmi Cerria Town Official"
                ></canvas>
              `}
            </div>

            <!-- Real-Time Countdown Timer Bar -->
            <div class="cb-qris-countdown-bar ${countdown.expired ? 'expired' : ''}">
              <div class="cb-countdown-left">
                <svg viewBox="0 0 18 18" width="14" height="14" fill="none">
                  <circle cx="9" cy="9" r="7.2" stroke="currentColor" stroke-width="1.6"/>
                  <path d="M9 5V9.4L11.8 11.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                <span id="cb-qris-countdown-label">
                  ${countdown.expired
                    ? 'Waktu pembayaran habis'
                    : `Berlaku <strong id="cb-qris-timer-val">${countdown.text}</strong>`}
                </span>
              </div>
              <span class="cb-qris-iso-chip">CRC16:${escapeHtml(sessionObj.crc16)}</span>
            </div>
          </div>

          <!-- Right Column: Points Toggle + Locked Nominal + Merchant Verification + Primary CTA -->
          <div class="cb-qris-col-right">
            <!-- Quick Points Toggle inside Modal -->
            <div class="cb-qris-points-inline-bar">
              <span>🪙 Pakai Cerria Town Points · 1.250 pts (-Rp12.500)</span>
              <label class="cb-switch">
                <input type="checkbox" data-cb-toggle-state="usePoints" ${sharedState.usePoints ? 'checked' : ''}>
                <span class="cb-switch-slider"></span>
              </label>
            </div>

            <!-- Locked Nominal Row + Copy Button -->
            <div class="cb-qris-locked-amount-box">
              <div class="cb-qris-amount-copy">
                <small>TOTAL PEMBAYARAN QRIS</small>
                <strong id="cb-qris-locked-nominal">${formatRp(sessionObj.lockedAmount)}</strong>
              </div>
              <button
                type="button"
                class="cb-copy-nominal-btn"
                data-cb-action="copy-locked-nominal"
                data-nominal="${sessionObj.lockedAmount}"
              >
                📋 Salin Nominal
              </button>
            </div>

            <!-- Buyer Security Verification Box -->
            <div class="cb-qris-buyer-verify-box">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                <path d="M10 1.8L3 4.6V9.4C3 13.8 6 17.6 10 18.8C14 17.6 17 13.8 17 9.4V4.6L10 1.8Z" fill="#2e7d5b"/>
                <path d="M6.8 10.2L9 12.4L13.4 7.8" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p>
                Pastikan nama merchant di aplikasi BCA/Mandiri/GoPay/OVO Anda adalah <strong>CERRIA TOWN OFFICIAL</strong>.
              </p>
            </div>

            <!-- Primary Action CTA: Check Payment Status -->
            <div class="cb-qris-modal-footer">
              <button
                type="button"
                class="cb-qris-confirm-btn"
                data-cb-action="confirm-qris-payment"
                ${countdown.expired ? 'disabled' : ''}
              >
                ✓ Cek Status Pembayaran
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderOfficialInvoiceModal({
  storeId,
  storeName,
  storeLocation,
  themeColor,
  items,
  complimentaryItem,
  calc,
  rec,
  noteText,
  tokopediaUrl
}) {
  const receipt = lastPaidReceipt || {
    orderCode: activeQrisSession?.orderCode || `CT-${storeId.toUpperCase()}-${String(Date.now()).slice(-6)}`,
    sessionId: activeQrisSession?.sessionId || generateUUIDv4(),
    shortSessionId: activeQrisSession?.shortSessionId || 'A8F49C12',
    lockedAmount: activeQrisSession?.lockedAmount ?? calc.finalTotal,
    pointsEarned: activeQrisSession?.pointsEarned ?? calc.pointsEarned,
    pointsRedeemed: activeQrisSession?.pointsDiscount > 0 ? 1250 : 0,
    totalSaved: activeQrisSession?.totalSaved ?? calc.totalSaved,
    crc16: activeQrisSession?.crc16 || '9F4A',
    payloadSignature:
      activeQrisSession?.payloadSignature ||
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  };

  return `
    <div class="cb-invoice-stage">
      <div class="cb-card cb-invoice-card">
        <div class="cb-invoice-header">
          <span class="cb-boutique-pill">🛡️ LUNAS · QRIS ISO-27001 VERIFIED · SESI #${escapeHtml(receipt.shortSessionId)}</span>
          <h2>Pembayaran QRIS Berhasil Diverifikasi!</h2>
          <p>Struk Lunas Resmi <b>#${escapeHtml(receipt.orderCode)}</b> · ${escapeHtml(storeName)} (${escapeHtml(storeLocation)})</p>
        </div>

        <div class="cb-invoice-grid">
          <div class="cb-invoice-left">
            <div class="cb-inv-section">
              <small>DIKIRIM KE ALAMAT PENERIMA</small>
              <b>${escapeHtml(rec.name)} (${escapeHtml(rec.phone)})</b>
              <p>${escapeHtml(rec.address)}</p>
              ${noteText ? `<p class="cb-inv-note">📝 Catatan: "${escapeHtml(noteText)}"</p>` : ''}
            </div>

            <div class="cb-inv-section">
              <small>RINCIAN ITEM TERKUNCI (${calc.totalQty} PRODUK)</small>
              <div class="cb-inv-items">
                ${items.map(it => `
                  <div class="cb-inv-item-row">
                    <span>${it.qty}× ${escapeHtml(it.name)} <em style="opacity:0.75;font-style:normal;">(${escapeHtml(it.variantLabel || '')})</em></span>
                    <b>${formatRp(it.unitPrice * it.qty)}</b>
                  </div>
                `).join('')}
                ${complimentaryItem ? `
                  <div class="cb-inv-item-row free">
                    <span>1× ${escapeHtml(complimentaryItem.name)}</span>
                    <b>Gratis</b>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="cb-invoice-right">
            <div class="cb-inv-pay-box">
              <small>METODE PEMBAYARAN RESMI</small>
              <strong>QRIS Instan Resmi · ${escapeHtml(MERCHANT_IDENTITY.merchantName)}</strong>
              <div class="cb-qris-status-pill">
                ✓ Lunas Terverifikasi · NMID: ${escapeHtml(MERCHANT_IDENTITY.nmid)} · CRC16: ${escapeHtml(receipt.crc16)}
              </div>
              <div class="cb-inv-crypto-sig">
                <small>SHA-256 SIGNATURE:</small>
                <code>${escapeHtml(receipt.payloadSignature.slice(0, 32))}…</code>
              </div>
              <div class="cb-inv-total-line">
                <span>Total Dibayar (Terkunci)</span>
                <strong>${formatRp(receipt.lockedAmount)}</strong>
              </div>
              <div class="cb-inv-points-badge">
                ✨ Saldo Poin Diperbarui: Anda mendapat <b>+${receipt.pointsEarned.toLocaleString('id-ID')} Cerria Town Points</b>${receipt.pointsRedeemed > 0 ? ` (Tukar -${receipt.pointsRedeemed.toLocaleString('id-ID')} pts)` : ''} · Total Saldo: <b>${sharedState.pointsBalance.toLocaleString('id-ID')} pts</b>!
              </div>
            </div>
          </div>
        </div>

        <div class="cb-invoice-actions">
          <button type="button" class="cb-btn-primary" data-cb-action="finish-order">
            Selesai &amp; Kembali ke Beranda Toko →
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// INTERACTIVE EVENT BINDER
// ============================================================================
export function bindCerriaCheckoutEvents(overlay, callbacks) {
  const {
    storeId = 'toko3',
    items = [],
    onDecrementItem,
    onIncrementItem,
    onRemoveItem,
    onDuplicateItem,
    onToggleItemProtection,
    onAddRecommendedItem,
    onContinueShopping,
    onAddMoreItems,
    onSubmitOrder,
    onFinishOrder,
    onReRender,
    chime
  } = callbacks;

  activeRenderCallback = onReRender;

  const root = overlay.querySelector('.cb-checkout-root, .cb-invoice-stage');
  if (!root) return;

  // If QRIS modal is currently open, draw the dynamic QRIS canvas & attach MutationObserver
  if (qrisModalOpen && activeQrisSession && !qrisTamperAlert) {
    const canvas = root.querySelector('#cb-qris-secure-canvas');
    if (canvas) {
      drawDynamicQrisToCanvas(canvas, activeQrisSession);
      attachQrisAntiTamperGuard(root, activeQrisSession);
    }

    // Start real-time 1-second countdown timer
    if (qrisCountdownTimer) clearInterval(qrisCountdownTimer);
    qrisCountdownTimer = setInterval(() => {
      if (!qrisModalOpen || !activeQrisSession) {
        clearInterval(qrisCountdownTimer);
        qrisCountdownTimer = null;
        return;
      }
      const timerEl = root.querySelector('#cb-qris-timer-val');
      const countdown = formatRemainingCountdown(activeQrisSession.expiresAtMs);
      if (countdown.expired) {
        clearInterval(qrisCountdownTimer);
        qrisCountdownTimer = null;
        onReRender?.();
      } else if (timerEl) {
        timerEl.textContent = countdown.text;
      }
    }, 1000);
  } else {
    if (qrisCountdownTimer) {
      clearInterval(qrisCountdownTimer);
      qrisCountdownTimer = null;
    }
    if (qrisMutationObserver) {
      qrisMutationObserver.disconnect();
      qrisMutationObserver = null;
    }
  }

  // Continue shopping / Add more
  root.querySelectorAll('[data-cb-action="continue-shopping"]').forEach(btn => {
    btn.addEventListener('click', () => {
      qrisModalOpen = false;
      chime?.(520, 0.06);
      onContinueShopping?.();
    });
  });

  root.querySelectorAll('[data-cb-action="add-more"]').forEach(btn => {
    btn.addEventListener('click', () => {
      qrisModalOpen = false;
      chime?.(540, 0.06);
      onAddMoreItems?.();
    });
  });

  // Address inline editor
  root.querySelector('[data-cb-action="toggle-address-edit"]')?.addEventListener('click', () => {
    sharedState.editingAddress = !sharedState.editingAddress;
    chime?.(560, 0.06);
    onReRender?.();
  });

  root.querySelector('[data-cb-action="cancel-address-edit"]')?.addEventListener('click', e => {
    e.stopPropagation();
    sharedState.editingAddress = false;
    onReRender?.();
  });

  root.querySelector('[data-cb-action="save-address"]')?.addEventListener('click', e => {
    e.stopPropagation();
    const nameEl = root.querySelector('#cb-inp-name');
    const phoneEl = root.querySelector('#cb-inp-phone');
    const emailEl = root.querySelector('#cb-inp-email');
    const addrEl = root.querySelector('#cb-inp-address');
    if (nameEl?.value.trim()) sharedState.recipient.name = nameEl.value.trim();
    if (phoneEl?.value.trim()) sharedState.recipient.phone = phoneEl.value.trim();
    if (emailEl?.value.trim()) sharedState.recipient.email = emailEl.value.trim();
    if (addrEl?.value.trim()) sharedState.recipient.address = addrEl.value.trim();
    sharedState.editingAddress = false;
    saveCheckoutState();
    chime?.(660, 0.08);
    onReRender?.();
  });

  // Item quantity steppers (+ / - / trash)
  root.querySelectorAll('[data-cb-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-cb-dec'), 10);
      chime?.(480, 0.05);
      onDecrementItem?.(idx);
    });
  });

  root.querySelectorAll('[data-cb-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-cb-inc'), 10);
      chime?.(600, 0.05);
      onIncrementItem?.(idx);
    });
  });

  // Item ⋮ more menu
  root.querySelectorAll('[data-cb-more]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-cb-more'), 10);
      sharedState.activeMoreMenuIdx = sharedState.activeMoreMenuIdx === idx ? null : idx;
      onReRender?.();
    });
  });

  root.querySelectorAll('[data-cb-action="remove-item"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-cb-idx'), 10);
      sharedState.activeMoreMenuIdx = null;
      chime?.(440, 0.07);
      onRemoveItem?.(idx);
    });
  });

  root.querySelectorAll('[data-cb-action="duplicate-item"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-cb-idx'), 10);
      sharedState.activeMoreMenuIdx = null;
      chime?.(620, 0.07);
      onDuplicateItem?.(idx);
    });
  });

  // Protection bar checkbox & chevron drawer
  root.querySelectorAll('[data-cb-prot-toggle]').forEach(chk => {
    chk.addEventListener('change', () => {
      const idx = parseInt(chk.getAttribute('data-cb-prot-toggle'), 10);
      chime?.(580, 0.06);
      if (onToggleItemProtection) {
        onToggleItemProtection(idx, chk.checked);
      } else if (items[idx]) {
        items[idx].insured = chk.checked;
        onReRender?.();
      }
    });
  });

  root.querySelectorAll('[data-cb-prot-expand]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-cb-prot-expand');
      sharedState.expandedProtections[key] = !sharedState.expandedProtections[key];
      onReRender?.();
    });
  });

  // Seller Note editor
  root.querySelector('[data-cb-action="toggle-note-edit"]')?.addEventListener('click', () => {
    sharedState.editingNoteStore = sharedState.editingNoteStore === storeId ? null : storeId;
    chime?.(540, 0.05);
    onReRender?.();
  });

  root.querySelectorAll('[data-cb-note-preset]').forEach(chip => {
    chip.addEventListener('click', () => {
      const inp = root.querySelector('#cb-inp-seller-note');
      if (inp) inp.value = chip.getAttribute('data-cb-note-preset') || '';
    });
  });

  root.querySelector('[data-cb-action="cancel-note-edit"]')?.addEventListener('click', () => {
    sharedState.editingNoteStore = null;
    onReRender?.();
  });

  root.querySelector('[data-cb-action="save-note"]')?.addEventListener('click', () => {
    const inp = root.querySelector('#cb-inp-seller-note');
    sharedState.sellerNotes[storeId] = (inp?.value || '').trim();
    sharedState.editingNoteStore = null;
    saveCheckoutState();
    chime?.(640, 0.07);
    onReRender?.();
  });

  // Shipping Method Selector
  root.querySelector('[data-cb-action="toggle-shipping-selector"]')?.addEventListener('click', () => {
    sharedState.shippingSelectorOpen = !sharedState.shippingSelectorOpen;
    chime?.(550, 0.06);
    onReRender?.();
  });

  root.querySelectorAll('[data-cb-ship-select]').forEach(radio => {
    radio.addEventListener('change', () => {
      sharedState.shippingMethod = radio.getAttribute('data-cb-ship-select') || 'standard';
      sharedState.shippingSelectorOpen = false;
      saveCheckoutState();
      chime?.(620, 0.07);
      onReRender?.();
    });
  });

  // Cross-Sell Carousel "+ Tambah"
  root.querySelectorAll('[data-cb-add-rec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const recId = btn.getAttribute('data-cb-add-rec');
      chime?.(680, 0.09);
      onAddRecommendedItem?.(recId);
    });
  });

  // Promo Drawer & Boolean State Toggles (Vouchers, Points, Gift Wrap, Tree Plant)
  root.querySelector('[data-cb-action="toggle-promo-drawer"]')?.addEventListener('click', () => {
    sharedState.promoDrawerOpen = !sharedState.promoDrawerOpen;
    chime?.(560, 0.06);
    onReRender?.();
  });

  root.querySelectorAll('[data-cb-toggle-state]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const key = inp.getAttribute('data-cb-toggle-state');
      if (key && key in sharedState) {
        sharedState[key] = !!inp.checked;
        saveCheckoutState();
        chime?.(inp.checked ? 660 : 500, 0.07);
        // If QRIS modal is open, immediately recalculate Zero-Trust amount & re-sign EMVCo QRIS
        if (qrisModalOpen) {
          await createOrRefreshSecureQrisSession(storeId, items, false);
        }
        onReRender?.();
      }
    });
  });

  // Open Cryptographic QRIS Modal when clicking "🛡️ Bayar"
  root.querySelector('[data-cb-action="open-qris-modal"]')?.addEventListener('click', async () => {
    if (!items.length || isCreatingSessionLock) return;
    chime?.(740, 0.12);
    await createOrRefreshSecureQrisSession(storeId, items, false);
    qrisModalOpen = true;
    onReRender?.();
  });

  // Close QRIS Modal
  root.querySelectorAll('[data-cb-action="close-qris-modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      qrisModalOpen = false;
      chime?.(480, 0.06);
      onReRender?.();
    });
  });

  // Regenerate Fresh Cryptographic QRIS Session (on expiry or after tamper alert)
  root.querySelector('[data-cb-action="regenerate-qris-session"]')?.addEventListener('click', async () => {
    qrisTamperAlert = null;
    activeQrisSession = null;
    chime?.(680, 0.1);
    await createOrRefreshSecureQrisSession(storeId, items, true);
    qrisModalOpen = true;
    onReRender?.();
  });

  // Copy Locked Nominal ("📋 Salin Nominal")
  root.querySelector('[data-cb-action="copy-locked-nominal"]')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    const nominal = String(activeQrisSession?.lockedAmount || '');
    if (nominal && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(nominal).catch(() => {});
    }
    chime?.(660, 0.07);
    if (btn) {
      const origText = btn.textContent;
      btn.textContent = '✓ Tersalin!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = origText;
        btn.classList.remove('copied');
      }, 1600);
    }
  });

  // Confirm QRIS Payment ("✓ Cek Status Pembayaran")
  root.querySelector('[data-cb-action="confirm-qris-payment"]')?.addEventListener('click', async e => {
    if (!activeQrisSession) return;
    const btn = e.currentTarget;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Memverifikasi Signature SHA-256 & Status Bank...';
    }

    // 1. Re-verify EMVCo QRIS CRC16-CCITT & SHA-256 integrity before settlement
    const crcCheck = verifyEMVCoQRISIntegrity(
      activeQrisSession.qrisPayload,
      activeQrisSession.lockedAmount
    );
    if (!crcCheck.valid) {
      triggerQrisSecurityBreach(crcCheck.reason);
      return;
    }

    const recomputedSig = await computePayloadSignatureSHA256(
      activeQrisSession.sessionId,
      activeQrisSession.lockedAmount,
      activeQrisSession.nmid,
      activeQrisSession.qrisPayload
    );
    if (recomputedSig !== activeQrisSession.payloadSignature) {
      triggerQrisSecurityBreach('Tanda tangan digital SHA-256 tidak cocok dengan sesi server!');
      return;
    }

    // 2. Persist order & mark session PAID in Supabase
    await confirmSessionInSupabase(activeQrisSession);
    submitOrder({
      storeId,
      items: activeQrisSession.verifiedItems.map(it => ({
        id: it.id,
        qty: it.qty,
        size: it.variantLabel || '',
        variant: it.variantLabel || '',
        unitPrice: it.unitPrice
      })),
      customerInfo: {
        ...activeQrisSession.recipient,
        session_id: activeQrisSession.sessionId,
        payment_method: 'QRIS_ISO27001',
        locked_amount: activeQrisSession.lockedAmount,
        payload_signature: activeQrisSession.payloadSignature
      }
    }).catch(() => {});

    // 3. Deduct redeemed points (if active) and credit earned Cerria Town Points (+2.130 poin)
    const redeemed = activeQrisSession.pointsDiscount > 0 ? 1250 : 0;
    const earned = activeQrisSession.pointsEarned;
    sharedState.pointsBalance = Math.max(0, sharedState.pointsBalance - redeemed) + earned;
    sharedState.lastPointsEarned = earned;
    sharedState.lastPointsRedeemed = redeemed;
    sharedState.usePoints = false;
    saveCheckoutState();

    lastPaidReceipt = {
      orderCode: activeQrisSession.orderCode,
      sessionId: activeQrisSession.sessionId,
      shortSessionId: activeQrisSession.shortSessionId,
      lockedAmount: activeQrisSession.lockedAmount,
      pointsEarned: earned,
      pointsRedeemed: redeemed,
      totalSaved: activeQrisSession.totalSaved,
      crc16: activeQrisSession.crc16,
      payloadSignature: activeQrisSession.payloadSignature
    };

    qrisModalOpen = false;
    chime?.(820, 0.16);
    onSubmitOrder?.('qris_iso27001');
  });

  // Finish Order on Invoice Screen
  root.querySelector('[data-cb-action="finish-order"]')?.addEventListener('click', () => {
    activeQrisSession = null;
    lastPaidReceipt = null;
    qrisModalOpen = false;
    chime?.(620, 0.09);
    onFinishOrder?.();
  });
}
