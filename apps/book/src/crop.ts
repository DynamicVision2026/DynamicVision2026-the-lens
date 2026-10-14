// Runs in the page (Chromium) before printing. LensScene draws on a fixed 480×600 screen canvas; on paper
// each figure is cropped to what is actually drawn. A word problem's story text (the problem sentence,
// already printed beside the figure) is removed, and a figure left empty by that is hidden.
// Pure layout: nothing is computed from the problem's numbers.
export const CROP_SCRIPT = `
function cropFigures() {
  var PAD = 10;
  function hidden(el, root) {
    for (var e = el; e && e !== root; e = e.parentNode) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return true;
      if (e.getAttribute && e.getAttribute('opacity') === '0') return true;
    }
    return false;
  }
  document.querySelectorAll('.fig > svg').forEach(function (svg) {
    var label = (svg.getAttribute('aria-label') || '').replace(/\\s/g, '');
    svg.querySelectorAll('g').forEach(function (g) {
      if (g.querySelector(':scope > :not(text)')) return;
      var t = g.textContent.replace(/\\s/g, '');
      if (t && t === label) g.remove();
    });
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    svg.querySelectorAll('*').forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      if (tag === 'g' || tag === 'tspan' || tag === 'defs' || el.closest('defs, clipPath, mask, pattern, filter')) return;
      if (typeof el.getBBox !== 'function' || hidden(el, svg)) return;
      var b;
      try { b = el.getBBox(); } catch (e) { return; }
      if (b.width === 0 && b.height === 0) return;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    });
    if (!isFinite(x0)) { svg.parentNode.style.display = 'none'; return; }
    svg.setAttribute('viewBox', [x0 - PAD, y0 - PAD, x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD].join(' '));
  });
  document.documentElement.setAttribute('data-cropped', '1');
}
(document.fonts ? document.fonts.ready : Promise.resolve()).then(cropFigures);
`;
