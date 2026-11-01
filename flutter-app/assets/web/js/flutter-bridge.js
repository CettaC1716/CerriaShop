// ============================================================================
// CERRIA TOWN — TWO-WAY HYBRID NATIVE FLUTTER <-> THREE.JS 3D CANVAS BRIDGE
// ----------------------------------------------------------------------------
// Activated automatically (and specially styled when `?mode=flutter-3d-canvas`).
// Exposes `window.FlutterBridge` with:
//   - Incoming commands from Native Flutter UI:
//       goToStore(index), prevStore(), nextStore(),
//       setTimeOfDay(mode), setWeather(type), setCityLightIntensity(val),
//       setSimSpeed(mult), toggleMusic(), setMacroDOF(val),
//       setMusicVolume(val), setAutoCycle(enabled), enterStore(id), exitStore()
//   - Outgoing events from Three.js 3D Canvas to Flutter:
//       FlutterBridge.postMessage(JSON.stringify(payload))
//       (supports webview_flutter JavaScriptChannel, flutter_inappwebview, & postMessage)
// ============================================================================

const nativeFlutterChannel =
  typeof window !== 'undefined' &&
  window.FlutterBridge &&
  typeof window.FlutterBridge.postMessage === 'function'
    ? window.FlutterBridge
    : null;

if (typeof window !== 'undefined' && nativeFlutterChannel) {
  window.__NativeFlutterBridge__ = nativeFlutterChannel;
}

export function isFlutter3DCanvasMode() {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.classList.contains('flutter-3d-canvas')) return true;
  const sp = new URLSearchParams(window.location.search);
  return sp.get('mode') === 'flutter-3d-canvas' || sp.get('flutter_canvas') === 'true';
}

let hostHandlers = null;
const pendingCommands = [];

export function postToFlutter(payload) {
  if (typeof window === 'undefined') return;
  const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  try {
    // 1. webview_flutter JavaScriptChannel named 'FlutterBridgeChannel' or preserved native 'FlutterBridge'
    if (window.FlutterBridgeChannel && typeof window.FlutterBridgeChannel.postMessage === 'function') {
      window.FlutterBridgeChannel.postMessage(jsonStr);
    } else if (window.__NativeFlutterBridge__ && typeof window.__NativeFlutterBridge__.postMessage === 'function') {
      window.__NativeFlutterBridge__.postMessage(jsonStr);
    }
    // 2. flutter_inappwebview handler
    if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
      window.flutter_inappwebview.callHandler('FlutterBridge', jsonStr);
    }
    // 3. Parent window / iframe postMessage (useful for Flutter Web / desktop WebView)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(jsonStr, '*');
    }
    window.dispatchEvent(new CustomEvent('cerria:flutter-event', { detail: payload }));
  } catch {
    // Ignore transport errors when running standalone in browser
  }
}

export function registerFlutterBridgeHost(handlers) {
  hostHandlers = handlers;
  while (pendingCommands.length > 0) {
    const fn = pendingCommands.shift();
    try {
      fn(hostHandlers);
    } catch {
      /* ignore */
    }
  }
  if (hostHandlers && typeof hostHandlers.emitInitialState === 'function') {
    hostHandlers.emitInitialState();
  }
}

function invokeHost(fn) {
  if (hostHandlers) {
    return fn(hostHandlers);
  }
  pendingCommands.push(fn);
  return null;
}

const flutterBridgeApi = {
  /**
   * Sends a JSON string (or object) from Three.js to Flutter WebView channel.
   */
  postMessage(message) {
    postToFlutter(message);
  },

  /**
   * Navigate 3D camera to a store by 0-based nav index (0..6), 1-based store number, or 'toko1'..'toko7'.
   */
  goToStore(indexOrId) {
    return invokeHost(h => h.goToStore?.(indexOrId));
  },

  prevStore() {
    return invokeHost(h => h.prevStore?.());
  },

  nextStore() {
    return invokeHost(h => h.nextStore?.());
  },

  setTimeOfDay(modeOrHour) {
    return invokeHost(h => h.setTimeOfDay?.(modeOrHour));
  },

  setWeather(type) {
    return invokeHost(h => h.setWeather?.(type));
  },

  setCityLightIntensity(val) {
    return invokeHost(h => h.setCityLightIntensity?.(val));
  },

  setSimSpeed(mult) {
    return invokeHost(h => h.setSimSpeed?.(mult));
  },

  toggleMusic(forceState) {
    return invokeHost(h => h.toggleMusic?.(forceState));
  },

  setMusicVolume(val) {
    return invokeHost(h => h.setMusicVolume?.(val));
  },

  setMacroDOF(val) {
    return invokeHost(h => h.setMacroDOF?.(val));
  },

  setAutoCycle(enabled) {
    return invokeHost(h => h.setAutoCycle?.(enabled));
  },

  enterStore(indexOrId) {
    return invokeHost(h => h.enterStore?.(indexOrId));
  },

  exitStore() {
    return invokeHost(h => h.exitStore?.());
  },

  getState() {
    return hostHandlers?.getState ? hostHandlers.getState() : null;
  }
};

if (typeof window !== 'undefined') {
  // If webview_flutter injected `window.FlutterBridge` with `postMessage` before module load,
  // preserve its native `postMessage` while attaching all command methods onto `window.FlutterBridge`.
  if (window.FlutterBridge && typeof window.FlutterBridge === 'object') {
    const origPost =
      typeof window.FlutterBridge.postMessage === 'function'
        ? window.FlutterBridge.postMessage.bind(window.FlutterBridge)
        : null;
    if (origPost) {
      window.__NativeFlutterBridge__ = { postMessage: origPost };
    }
    Object.assign(window.FlutterBridge, flutterBridgeApi);
  } else {
    window.FlutterBridge = flutterBridgeApi;
  }

  // Also accept JSON messages posted via `window.postMessage` from Flutter Web / Desktop WebView
  window.addEventListener('message', ev => {
    try {
      const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      if (!data || typeof data !== 'object' || data.source === 'CerriaFlutterBridge') return;
      const cmd = data.command || data.type;
      if (cmd && typeof window.FlutterBridge[cmd] === 'function') {
        window.FlutterBridge[cmd](data.value ?? data.payload);
      }
    } catch {
      /* ignore non-JSON messages */
    }
  });
}
