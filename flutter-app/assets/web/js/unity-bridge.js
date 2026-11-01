// ============================================================================
// CERRIA TOWN — HYBRID UNITY BRIDGE  (window.CerriaBridge & window.unityBridge)
// ----------------------------------------------------------------------------
// Two-way JS <-> Unity C# Bridge (`CerriaHybridWebViewBridge.cs`):
//   • `window.unityBridge.send(JSON.stringify({ type, payload }))`
//   • `window.CerriaBridge.openStore('toko1')` / `closeStore()` / `getStoreData('toko1')`
//   • Supports native macOS WKWebView (`window.webkit.messageHandlers.unityControl`),
//     Android/iOS WebView (`window.Unity.call`, `window.vuplex`), React Native,
//     and the local Unity HTTP bridge (`http://127.0.0.1:17890/unity-cmd`).
// ============================================================================
import { STORE_IDS, normalizeStoreId } from '../store_ids.js?v=124';
import {
  getStoreData as snapshotStore,
  getStoresVersion,
  getStoresSource,
  onStoresUpdated,
  submitOrder as submitStoreOrder,
  getLastOrderReceipt
} from './store-data-manager.js?v=124';
import { UI_ONLY, UNITY_UI_OVERLAY } from './ui-mode.js?v=124';

let host = null; // { open(id) → bool, close() → bool, activeStoreId() → id|null, currentStoreId() → id|null, onUnityCommand?(msg) }
const queue = [];

/** True when the page runs inside a native WebView or Unity Hybrid Overlay. */
function hasNativeHost() {
  return Boolean(
    UNITY_UI_OVERLAY ||
    window.webkit?.messageHandlers?.unityControl?.postMessage ||
    window.Unity?.call ||
    window.vuplex?.postMessage ||
    window.ReactNativeWebView?.postMessage
  );
}

/**
 * Primary JS -> Unity C# sender required by Hybrid Overlay Architecture:
 * `window.unityBridge.send(JSON.stringify({ type, payload }))`
 */
function sendRawJsonToUnity(jsonString) {
  const str = typeof jsonString === 'string' ? jsonString : JSON.stringify(jsonString);
  let parsed = null;
  try {
    parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch {
    parsed = { type: String(jsonString), payload: {} };
  }

  // 1. macOS WKWebView messageHandler (`unityControl`)
  try {
    window.webkit?.messageHandlers?.unityControl?.postMessage?.(str);
  } catch (err) {
    console.warn('[unityBridge] webkit.messageHandlers.unityControl failed', err);
  }

  // 2. GREE unity-webview / Android / iOS `window.Unity.call`
  try {
    if (window.Unity?.call) {
      window.Unity.call(str);
    }
  } catch (err) {
    console.warn('[unityBridge] Unity.call failed', err);
  }

  // 3. Vuplex 3D WebView
  try {
    window.vuplex?.postMessage?.(str);
  } catch (err) {
    console.warn('[unityBridge] vuplex.postMessage failed', err);
  }

  // 4. ReactNativeWebView
  try {
    window.ReactNativeWebView?.postMessage?.(str);
  } catch (err) {
    console.warn('[unityBridge] ReactNativeWebView.postMessage failed', err);
  }

  // 5. Unity Editor / Desktop Local HTTP Bridge (`http://127.0.0.1:17890/unity-cmd`)
  if (UNITY_UI_OVERLAY || window.__CERRIA_ENABLE_LOCAL_UNITY_HTTP__) {
    try {
      fetch('http://127.0.0.1:17890/unity-cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: str,
        mode: 'cors',
        keepalive: true
      }).catch(() => {});
    } catch {}
  }

  window.dispatchEvent(new CustomEvent('cerria:bridge', { detail: parsed }));
  return true;
}

export const unityBridge = Object.freeze({
  send(jsonOrObject) {
    return sendRawJsonToUnity(jsonOrObject);
  }
});

if (typeof window !== 'undefined') {
  window.unityBridge = unityBridge;
}

/**
 * Post an event to every native channel that exists.
 */
export function postToNative(type, payload = {}) {
  const message = { type, payload, ...payload };
  return sendRawJsonToUnity(JSON.stringify(message));
}

function runOrQueue(fn) {
  if (host) return fn();
  queue.push(fn);
  return undefined;
}

const CerriaBridge = Object.freeze({
  version: 2,
  mode: UNITY_UI_OVERLAY ? 'unity-ui-overlay' : UI_ONLY ? 'ui_only' : '3d',
  storeIds: STORE_IDS,

  /** Send arbitrary { type, payload } command to Unity C#. */
  sendToUnity(type, payload = {}) {
    return sendRawJsonToUnity(JSON.stringify({ type, payload }));
  },

  /** Open the store catalog for `toko1` … `toko7` (legacy aliases accepted). Returns false for unknown IDs. */
  openStore(storeId) {
    const id = normalizeStoreId(storeId);
    if (!id) {
      console.warn('[CerriaBridge] openStore: unknown store ID', storeId);
      return false;
    }
    runOrQueue(() => host.open(id));
    return true;
  },

  /**
   * Close the open store. Native host present → it is notified (CLOSE_STORE);
   * plain browser 3D mode → the camera returns to the town.
   */
  closeStore() {
    return runOrQueue(() => {
      const closed = host.close();
      if (!closed) postToNative('CLOSE_STORE', { storeId: null });
      return closed;
    });
  },

  /** Detached data snapshot for a store; defaults to the open (or focused) store. */
  getStoreData(storeId) {
    const id = normalizeStoreId(storeId ?? host?.activeStoreId() ?? host?.currentStoreId());
    return id ? snapshotStore(id) : null;
  },

  /** ID of the store whose catalog is open, or null. */
  getActiveStoreId() {
    return host?.activeStoreId() ?? null;
  },

  /**
   * Submit a safe order for `storeId` (`toko1` … `toko7`) using Supabase RPC
   * `create_safe_order` (or local fallback if Supabase is unconfigured/offline).
   */
  async submitOrder(storeId, items = [], customerInfo = {}) {
    const id = normalizeStoreId(storeId ?? host?.activeStoreId() ?? host?.currentStoreId());
    const receipt = await submitStoreOrder(id, items, customerInfo);
    if (receipt?.ok) {
      postToNative('ORDER_SUBMITTED', {
        storeId: receipt.store_id,
        orderCode: receipt.order_code,
        totalAmount: receipt.total_amount,
        currency: receipt.currency,
        source: receipt.source
      });
    }
    return receipt;
  },

  getLastOrderReceipt,
  getDataVersion: getStoresVersion,
  getDataSource: getStoresSource,
  hasNativeHost,

  /** Trigger the Phase 3 Unity .GLB + scene metadata export when running in 3D mode. */
  exportToGLB(options = {}) {
    if (typeof window.exportCerriaTownToGLB === 'function') {
      return window.exportCerriaTownToGLB(options);
    }
    console.warn('[CerriaBridge] exportToGLB is only available in 3D town mode.');
    return Promise.resolve({ ok: false, error: 'not_in_3d_mode' });
  },

  /** Trigger the companion cerria-scene-metadata.json export when running in 3D mode. */
  exportSceneMetadata(options = {}) {
    if (typeof window.exportCerriaSceneMetadata === 'function') {
      return window.exportCerriaSceneMetadata(options);
    }
    console.warn('[CerriaBridge] exportSceneMetadata is only available in 3D town mode.');
    return null;
  }
});

// ---------------------------------------------------------------------------
// Runtime-side API (used by app.js / ui-only-app.js / unity-ui-overlay-app.js)
// ---------------------------------------------------------------------------

export function registerStoreHost(adapter) {
  host = adapter;
  while (queue.length) queue.shift()();
  postToNative('BRIDGE_READY', { mode: CerriaBridge.mode, storeIds: STORE_IDS, dataVersion: getStoresVersion() });
}

export function notifyStoreOpened(storeId) {
  if (location.hash !== '#' + storeId) {
    history.replaceState(null, '', location.pathname + location.search + '#' + storeId);
  }
  postToNative('STORE_OPENED', { storeId });
}

export function notifyStoreClosed(storeId) {
  postToNative('CLOSE_STORE', { storeId });
}

// Native Unity → Web messages
export function handleNativeMessage(raw) {
  let msg = raw;
  if (typeof raw === 'string') {
    try {
      msg = JSON.parse(raw);
    } catch {
      msg = { type: raw };
    }
  }
  const type = String(msg?.type || '').toUpperCase();
  if (type === 'OPEN_STORE') {
    CerriaBridge.openStore(msg.storeId || msg.payload?.storeId);
  } else if (type === 'CLOSE_STORE') {
    runOrQueue(() => host.close());
  } else if (host && typeof host.onUnityCommand === 'function') {
    host.onUnityCommand(msg);
  }
}

function attachVuplex() {
  window.vuplex?.addEventListener?.('message', e => handleNativeMessage(e.data));
}
if (window.vuplex) attachVuplex();
else window.addEventListener('vuplexready', attachVuplex, { once: true });
window.addEventListener('message', e => {
  if (e.source === window || e.source == null) handleNativeMessage(e.data);
});

onStoresUpdated(detail => postToNative('STORES_UPDATED', { dataVersion: detail.version }));

window.CerriaBridge = CerriaBridge;
export default CerriaBridge;
