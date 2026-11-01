// ============================================================================
// CERRIA TOWN — RUNTIME MODE FLAGS
// ----------------------------------------------------------------------------
// • `?ui_only=true`            → standalone store catalog UI only (no town HUD)
// • `?mode=unity-ui-overlay`   → full transparent HTML/CSS/JS Town HUD + Store
//                                Catalog overlay on top of Unity 3D engine
//                                (no WebGL renderer created; transparent body).
// ============================================================================

const params = new URLSearchParams(window.location.search);

export const UNITY_UI_OVERLAY =
  params.get('mode') === 'unity-ui-overlay' ||
  params.get('unity_overlay') === 'true' ||
  Boolean(window.__CERRIA_UNITY_UI_OVERLAY__);

export const UI_ONLY =
  params.get('ui_only') === 'true' || UNITY_UI_OVERLAY;

/**
 * WebGL-free replacement for the 360° product showcase used when UI_ONLY or
 * UNITY_UI_OVERLAY is active. Renders the store's own hand-drawn SVG illustration
 * into the canvas slot so the catalog layout stays identical.
 */
export function mountStaticProductArt(hostEl, svgMarkup) {
  if (!hostEl) return;
  let art = hostEl.querySelector(':scope > .ui-only-product-art');
  if (!art) {
    hostEl.querySelectorAll(':scope > canvas').forEach(c => c.remove());
    art = document.createElement('div');
    art.className = 'ui-only-product-art';
    hostEl.prepend(art);
  }
  art.innerHTML = svgMarkup;
}
