// ============================================================================
// CERRIA TOWN — ENTRY POINT
// ----------------------------------------------------------------------------
// 1. Store data (Smart Cache, synchronous) and the Unity bridge load first, so
//    `window.CerriaBridge` and `window.unityBridge` exist before any 3D work starts.
// 2. Then exactly one runtime is loaded:
//      • ?mode=unity-ui-overlay → unity-ui-overlay-app.js (full transparent HTML/CSS
//                                 Town HUD + Floating Callouts + Supabase Catalog
//                                 overlay on top of Unity 3D engine, no WebGL)
//      • ?ui_only=true          → ui-only-app.js          (store catalog only, no WebGL)
//      • default                → app.js                  (full Three.js 3D town)
// ============================================================================
import { UI_ONLY, UNITY_UI_OVERLAY } from './ui-mode.js?v=127';
import './config.js?v=124';
import './supabase-client.js?v=124';
import './store-data-manager.js?v=130';
import './unity-bridge.js?v=130';

if (UNITY_UI_OVERLAY) {
  await import('./unity-ui-overlay-app.js?v=135');
} else if (UI_ONLY) {
  await import('./ui-only-app.js?v=135');
} else {
  await import('../app.js?v=135');
}
