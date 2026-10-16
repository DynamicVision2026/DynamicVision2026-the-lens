// Runs in the page (Chromium) before printing. LensScene draws on a fixed 480×600 screen canvas; on paper
// each figure is cropped to what is actually drawn. A word problem's story text (the problem sentence,
// already printed beside the figure) and a formula line that repeats a printed lens step are removed, and a
// figure left empty by that is hidden. Figure text never prints under 7 pt.
// Pure layout: nothing is computed from the problem's numbers.
export const CROP_SCRIPT = `
var PAD = 10;
var MIN_PT = 7;
function hidden(el, root) {
  for (var e = el; e && e !== root; e = e.parentNode) {
    var cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return true;
    if (e.getAttribute && e.getAttribute('opacity') === '0') return true;
  }
  return false;
}
/** Element user space → the svg's own (viewBox) units. */
function toRoot(el, svg) {
  var m = el.getCTM && el.getCTM(), r = svg.getCTM && svg.getCTM();
  return m && r ? r.inverse().multiply(m) : null;
}
/** A local box through a matrix: the axis-aligned box of its four corners. */
function box(b, m) {
  if (!m) return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
  var xs = [], ys = [];
  [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].forEach(function (p) {
    xs.push(m.a * p[0] + m.c * p[1] + m.e);
    ys.push(m.b * p[0] + m.d * p[1] + m.f);
  });
  return { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
}
/** The intersection of every clip-path on the element and its ancestors, in svg units (null: none). */
function clipOf(el, svg) {
  var out = null;
  for (var e = el; e && e !== svg; e = e.parentNode) {
    var ref = e.getAttribute && e.getAttribute('clip-path');
    var id = ref && /url\\(#([^)]+)\\)/.exec(ref);
    var cp = id && svg.querySelector('clipPath[id="' + id[1] + '"]');
    if (!cp) continue;
    var c = null;
    Array.prototype.forEach.call(cp.children, function (k) {
      if (typeof k.getBBox !== 'function') return;
      var kb = box(k.getBBox(), toRoot(e, svg));
      c = c ? { x0: Math.min(c.x0, kb.x0), y0: Math.min(c.y0, kb.y0), x1: Math.max(c.x1, kb.x1), y1: Math.max(c.y1, kb.y1) } : kb;
    });
    if (!c) continue;
    out = out ? { x0: Math.max(out.x0, c.x0), y0: Math.max(out.y0, c.y0), x1: Math.min(out.x1, c.x1), y1: Math.min(out.y1, c.y1) } : c;
  }
  return out;
}
function norm(s) {
  return (s || '').replace(/\s/g, '');
}
function cropFigures() {
  document.querySelectorAll('.fig > svg').forEach(function (svg) {
    var label = (svg.getAttribute('aria-label') || '').replace(/\\s/g, '');
    svg.querySelectorAll('g').forEach(function (g) {
      if (g.querySelector(':scope > :not(text)')) return;
      var t = g.textContent.replace(/\\s/g, '');
      if (t && t === label) g.remove();
    });
    // A formula line that repeats a lens step printed beside the figure (WO-026 §7: it set the figure's width).
    var section = svg.closest('section');
    var steps = {};
    if (section) section.querySelectorAll('ol.steps li').forEach(function (li) {
      var c = li.cloneNode(true);
      c.querySelectorAll('.badge').forEach(function (x) { x.remove(); });
      steps[norm(c.textContent)] = true;
    });
    svg.querySelectorAll('text').forEach(function (t) {
      if (steps[norm(t.textContent)]) t.remove();
    });
    if (!crop(svg)) { svg.parentNode.style.display = 'none'; return; }
    // Text floor, then crop again (bigger labels can reach past the first crop).
    for (var i = 0; i < 3 && floorText(svg); i++) crop(svg);
  });
  document.documentElement.setAttribute('data-cropped', '1');
}
/** Sets the viewBox to what is drawn; false when nothing is. */
function crop(svg) {
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  svg.querySelectorAll('*').forEach(function (el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'g' || tag === 'tspan' || tag === 'defs' || el.closest('defs, clipPath, mask, pattern, filter')) return;
    if (typeof el.getBBox !== 'function' || hidden(el, svg)) return;
    var b;
    try { b = el.getBBox(); } catch (e) { return; }
    if (b.width === 0 && b.height === 0) return;
    // In the figure's own units (transforms applied), and only the part its clip paths let through: a
    // parabola runs far past the plane but is clipped to it (WO-026 §7: Stage 3 graphs printed tiny or empty).
    var r = box(b, toRoot(el, svg));
    var c = clipOf(el, svg);
    if (c) r = { x0: Math.max(r.x0, c.x0), y0: Math.max(r.y0, c.y0), x1: Math.min(r.x1, c.x1), y1: Math.min(r.y1, c.y1) };
    if (r.x1 < r.x0 || r.y1 < r.y0) return;
    x0 = Math.min(x0, r.x0); y0 = Math.min(y0, r.y0); x1 = Math.max(x1, r.x1); y1 = Math.max(y1, r.y1);
  });
  if (!isFinite(x0)) return false;
  svg.setAttribute('viewBox', [x0 - PAD, y0 - PAD, x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD].join(' '));
  return true;
}
/**
 * WO-026 §7: no figure text (axis and tick numbers, labels) prints under MIN_PT at its printed size. The
 * scenes size text for a screen canvas; on a smaller printed figure a too-small label is enlarged in place.
 */
function floorText(svg) {
  var vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
  if (!vb || !vb.width || !r.width) return false;
  var k = Math.min(r.width / vb.width, r.height / vb.height);
  var floor = (MIN_PT * 96) / 72 / k;
  var changed = false;
  svg.querySelectorAll('text').forEach(function (t) {
    // A transformed label (e.g. scaled) prints at its size times the transform's scale.
    var m = toRoot(t, svg), s = m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1 : 1;
    var fs = parseFloat(getComputedStyle(t).fontSize) * s;
    if (fs && fs < floor - 0.01) { t.style.fontSize = floor / s + 'px'; changed = true; }
  });
  return changed;
}
(document.fonts ? document.fonts.ready : Promise.resolve()).then(cropFigures);
`;
