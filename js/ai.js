'use strict';
/* MerchBoard Studio — vector assets (SVG → editable paths) + AI Studio (OpenAI with the user's own API key) */
(function (MB) {

/* ======================= SVG → vector asset ======================= */
const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
function arcToCubic(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  if (!rx || !ry) return [['L', x2, y2]];
  const rad = phi * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / (den || 1)));
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx, cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2))), d = dt / segs, k = 4 / 3 * Math.tan(d / 4), out = [];
  const map = (ux, uy) => [cx + cos * rx * ux - sin * ry * uy, cy + sin * rx * ux + cos * ry * uy];
  for (let s = 0; s < segs; s++) {
    const a1 = t1 + s * d, a2 = a1 + d;
    out.push(['C', ...map(Math.cos(a1) - k * Math.sin(a1), Math.sin(a1) + k * Math.cos(a1)), ...map(Math.cos(a2) + k * Math.sin(a2), Math.sin(a2) - k * Math.cos(a2)), ...map(Math.cos(a2), Math.sin(a2))]);
  }
  return out;
}
/* any SVG path data -> absolute M / L / C / Z */
function parsePath(d) {
  const toks = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const out = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const n = () => { const v = parseFloat(toks[i++]); if (isNaN(v)) throw new Error('bad path'); return v; };
  const isNum = () => i < toks.length && !/[a-zA-Z]/.test(toks[i]);
  try {
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++]; else if (!cmd) break;
      const rel = cmd !== cmd.toUpperCase(), C = cmd.toUpperCase(); let nlc = null, nlq = null;
      if (C === 'Z') { out.push(['Z']); x = sx; y = sy; lc = lq = null; continue; }
      if (!isNum()) { cmd = ''; continue; }
      if (C === 'M') { x = n() + (rel ? x : 0); y = n() + (rel ? y : 0); sx = x; sy = y; out.push(['M', x, y]); cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') { x = n() + (rel ? x : 0); y = n() + (rel ? y : 0); out.push(['L', x, y]); }
      else if (C === 'H') { x = n() + (rel ? x : 0); out.push(['L', x, y]); }
      else if (C === 'V') { y = n() + (rel ? y : 0); out.push(['L', x, y]); }
      else if (C === 'C' || C === 'S') {
        let x1, y1;
        if (C === 'C') { x1 = n() + (rel ? x : 0); y1 = n() + (rel ? y : 0); } else { x1 = lc ? 2 * x - lc[0] : x; y1 = lc ? 2 * y - lc[1] : y; }
        const x2 = n() + (rel ? x : 0), y2 = n() + (rel ? y : 0), ex = n() + (rel ? x : 0), ey = n() + (rel ? y : 0);
        out.push(['C', x1, y1, x2, y2, ex, ey]); nlc = [x2, y2]; x = ex; y = ey;
      } else if (C === 'Q' || C === 'T') {
        let qx, qy;
        if (C === 'Q') { qx = n() + (rel ? x : 0); qy = n() + (rel ? y : 0); } else { qx = lq ? 2 * x - lq[0] : x; qy = lq ? 2 * y - lq[1] : y; }
        const ex = n() + (rel ? x : 0), ey = n() + (rel ? y : 0);
        out.push(['C', x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey), ex, ey]); nlq = [qx, qy]; x = ex; y = ey;
      } else if (C === 'A') {
        const rx = n(), ry = n(), rot = n(), fa = n(), fs = n(), ex = n() + (rel ? x : 0), ey = n() + (rel ? y : 0);
        out.push(...arcToCubic(x, y, rx, ry, rot, fa ? 1 : 0, fs ? 1 : 0, ex, ey)); x = ex; y = ey;
      } else { i++; }
      lc = nlc; lq = nlq;
    }
  } catch (e) { /* keep what parsed so far */ }
  return out;
}
const circlePath = (cx, cy, rx, ry) => { const k = 0.5523; return [['M', cx + rx, cy], ['C', cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry], ['C', cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy], ['C', cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry], ['C', cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy], ['Z']]; };
function rectPath(x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2); if (!r) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  const k = 0.5523 * r;
  return [['M', x + r, y], ['L', x + w - r, y], ['C', x + w - r + k, y, x + w, y + r - k, x + w, y + r], ['L', x + w, y + h - r], ['C', x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h],
    ['L', x + r, y + h], ['C', x + r - k, y + h, x, y + h - r + k, x, y + h - r], ['L', x, y + r], ['C', x, y + r - k, x + r - k, y, x + r, y], ['Z']];
}
/* transforms: matrix [a b c d e f] */
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function parseTransform(t) {
  let m = [1, 0, 0, 1, 0, 0];
  String(t || '').replace(/(\w+)\s*\(([^)]*)\)/g, (_, f, args) => {
    const a = (args.match(NUM) || []).map(Number); let n = null;
    if (f === 'matrix' && a.length === 6) n = a;
    else if (f === 'translate') n = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (f === 'scale') n = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
    else if (f === 'rotate') { const r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); n = [c, s, -s, c, 0, 0]; if (a.length === 3) n = mul(mul([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]); }
    else if (f === 'skewX') n = [1, 0, Math.tan(a[0] * Math.PI / 180), 1, 0, 0];
    else if (f === 'skewY') n = [1, Math.tan(a[0] * Math.PI / 180), 0, 1, 0, 0];
    if (n) m = mul(m, n);
    return '';
  });
  return m;
}
const applyM = (d, m) => d.map(c => { if (c[0] === 'Z') return c; const o = [c[0]]; for (let i = 1; i < c.length; i += 2) o.push(m[0] * c[i] + m[2] * c[i + 1] + m[4], m[1] * c[i] + m[3] * c[i + 1] + m[5]); return o; });
const cctx = document.createElement('canvas').getContext('2d');
function normColor(v, gradients) {
  if (!v || v === 'none' || v === 'transparent') return null;
  const u = /url\(#([^)]+)\)/.exec(v); if (u) return gradients[u[1]] || '#888888';
  if (v === 'currentColor') return '#000000';
  cctx.fillStyle = '#000000'; cctx.fillStyle = v; const c = cctx.fillStyle;
  if (c.startsWith('#')) return c.toUpperCase();
  const m = c.match(/[\d.]+/g); return m ? MB.rgbHex(+m[0], +m[1], +m[2]) : '#000000';
}
/* parse an SVG string into {w, h, shapes:[{d, fill, stroke, sw, op, rule}]}, normalised to its own bounds */
MB.svgToVector = (svg) => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), root = doc.querySelector('svg');
  if (!root) throw new Error('ไม่ใช่ SVG');
  const gradients = {};
  doc.querySelectorAll('linearGradient,radialGradient').forEach(g => { const s = g.querySelector('stop'); if (s) gradients[g.id] = normColor(s.getAttribute('stop-color') || (s.style && s.style.stopColor) || '#888', {}); });
  const shapes = [];
  const attr = (el, k, inh) => { const sv = el.style && el.style[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; return sv || el.getAttribute(k) || inh; };
  const walk = (el, m, inh) => {
    const tag = el.tagName.toLowerCase();
    if (['defs', 'title', 'desc', 'style', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'text', 'image'].includes(tag)) return;
    const mm = el.getAttribute('transform') ? mul(m, parseTransform(el.getAttribute('transform'))) : m;
    const st = { fill: attr(el, 'fill', inh.fill), stroke: attr(el, 'stroke', inh.stroke), sw: attr(el, 'stroke-width', inh.sw), op: inh.op * parseFloat(attr(el, 'opacity', 1)) * parseFloat(attr(el, 'fill-opacity', 1)), rule: attr(el, 'fill-rule', inh.rule) };
    const num = (k) => parseFloat(el.getAttribute(k)) || 0;
    let d = null;
    if (tag === 'path') d = parsePath(el.getAttribute('d'));
    else if (tag === 'rect') d = rectPath(num('x'), num('y'), num('width'), num('height'), num('rx') || num('ry'));
    else if (tag === 'circle') d = circlePath(num('cx'), num('cy'), num('r'), num('r'));
    else if (tag === 'ellipse') d = circlePath(num('cx'), num('cy'), num('rx'), num('ry'));
    else if (tag === 'polygon' || tag === 'polyline' || tag === 'line') {
      const pts = tag === 'line' ? [num('x1'), num('y1'), num('x2'), num('y2')] : (el.getAttribute('points') || '').match(NUM).map(Number);
      d = []; for (let i = 0; i + 1 < pts.length; i += 2) d.push([i ? 'L' : 'M', pts[i], pts[i + 1]]);
      if (tag === 'polygon') d.push(['Z']);
    }
    if (d && d.length > 1) {
      const fill = tag === 'line' || tag === 'polyline' && !el.getAttribute('fill') ? null : normColor(st.fill == null ? '#000000' : st.fill, gradients);
      const stroke = normColor(st.stroke, gradients), scale = Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2])) || 1;
      if (fill || stroke) shapes.push({ d: applyM(d, mm), fill, stroke, sw: stroke ? (parseFloat(st.sw) || 1) * scale : 0, op: MB.clamp(isNaN(st.op) ? 1 : st.op, 0, 1), rule: st.rule === 'evenodd' ? 'evenodd' : undefined });
    }
    [...el.children].forEach(ch => walk(ch, mm, st));
  };
  walk(root, [1, 0, 0, 1, 0, 0], { fill: null, stroke: null, sw: 1, op: 1, rule: null });
  if (!shapes.length) throw new Error('SVG ไม่มีรูปทรง');
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  shapes.forEach(s => s.d.forEach(c => { for (let i = 1; i < c.length; i += 2) { x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]); y0 = Math.min(y0, c[i + 1]); y1 = Math.max(y1, c[i + 1]); } }));
  const pad = Math.max(...shapes.map(s => s.sw / 2), 0);
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  shapes.forEach(s => { s.d = s.d.map(c => c[0] === 'Z' ? c : [c[0], ...c.slice(1).map((v, i) => MB.round(v - (i % 2 ? y0 : x0), 3))]); });
  return { w: MB.round(x1 - x0, 3) || 1, h: MB.round(y1 - y0, 3) || 1, shapes };
};
MB.addVectorAsset = (vec, name, role) => {
  const a = { id: MB.uid('a'), name: name || 'vector', kind: 'vec', role: role || 'decor', mime: 'application/x-mb-vector', vec, w: vec.w, h: vec.h };
  MB.assets[a.id] = a;
  const st = MB.state; st.vecLib = st.vecLib || []; st.vecLib.push(a.id);
  return a;
};
MB.vecAspect = (id) => { const a = MB.assets[id]; return a && a.vec ? a.vec.w / a.vec.h : 1; };
/* vector asset -> path primitives fitted into a box.
   style: 'original' | 'main' (largest shape → color) | 'mono' (everything → color) | 'outline' (line art in color) | 'sticker' (thick color2 edge behind) */
MB.VSTYLES = [['original', 'สีเดิม'], ['main', 'เปลี่ยนสีหลัก'], ['mono', 'สีเดียวทั้งหมด'], ['outline', 'เส้นขอบ (ไม่มีพื้น)'], ['sticker', 'สติกเกอร์ขอบขาว']];
MB.vecPrims = (id, x, y, w, h, o = {}) => {
  const a = MB.assets[id]; if (!a || !a.vec) return [];
  const style = o.style || (o.recolor === 'mono' ? 'mono' : o.recolor === 'main' ? 'main' : 'original');
  const v = a.vec, kx = w / v.w, ky = h / v.h, cx = x + w / 2, cy = y + h / 2, rot = (o.rot || 0) * Math.PI / 180, cs = Math.cos(rot), sn = Math.sin(rot);
  const edge = (o.ow == null ? 0.05 : o.ow) * Math.min(w, h);
  let main = -1;
  if (style === 'main') {
    let best = -1;
    v.shapes.forEach((s, i) => {
      if (!s.fill) return;
      let px = 1e9, py = 1e9, qx = -1e9, qy = -1e9;
      s.d.forEach(c => { for (let j = 1; j < c.length; j += 2) { px = Math.min(px, c[j]); qx = Math.max(qx, c[j]); py = Math.min(py, c[j + 1]); qy = Math.max(qy, c[j + 1]); } });
      const ar = (qx - px) * (qy - py); if (ar > best) { best = ar; main = i; }
    });
  }
  const tf = (d) => d.map(c => {
    if (c[0] === 'Z') return c;
    const out = [c[0]];
    for (let j = 1; j < c.length; j += 2) {
      let px = x + c[j] * kx, py = y + c[j + 1] * ky;
      if (rot) { const dx = px - cx, dy = py - cy; px = cx + dx * cs - dy * sn; py = cy + dx * sn + dy * cs; }
      out.push(px, py);
    }
    return out;
  });
  const nm = (o.name || a.name), multi = v.shapes.length > 1, op = (s) => (o.op == null ? 1 : o.op) * (s.op == null ? 1 : s.op);
  const prims = v.shapes.map((s, i) => {
    const base = { t: 'path', name: nm + (multi ? ' ' + (i + 1) : ''), d: tf(s.d), x, y, w, h, op: op(s), rule: s.rule };
    if (style === 'outline') return Object.assign(base, { fill: null, stroke: o.color, sw: Math.max(edge * 0.6, (s.sw || 0) * Math.min(kx, ky)) });
    const re = style === 'mono' || (style === 'main' && i === main);
    return Object.assign(base, { fill: s.fill ? (re ? o.color : s.fill) : null, stroke: s.stroke ? (style === 'mono' ? o.color : s.stroke) : null, sw: (s.sw || 0) * Math.min(kx, ky) });
  });
  if (style === 'sticker') { // die-cut edge: the same shapes, filled + thick stroke in color2, drawn behind
    const back = v.shapes.map((s, i) => ({ t: 'path', name: nm + ' edge' + (multi ? ' ' + (i + 1) : ''), d: tf(s.d), x, y, w, h, op: o.op == null ? 1 : o.op, rule: s.rule,
      fill: o.color2 || '#FFFFFF', stroke: o.color2 || '#FFFFFF', sw: edge * 2 + (s.sw || 0) * Math.min(kx, ky) }));
    return back.concat(prims);
  }
  return prims;
};
const thumbCache = {};
MB.vecThumb = (a, size = 96) => {
  const key = a.id + ':' + size; if (thumbCache[key]) return thumbCache[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const k = Math.min((size - 8) / a.vec.w, (size - 8) / a.vec.h), w = a.vec.w * k, h = a.vec.h * k;
  MB.drawPrims(x, MB.vecPrims(a.id, (size - w) / 2, (size - h) / 2, w, h), 1, {});
  return (thumbCache[key] = c.toDataURL());
};
const vecThumbRaw = MB.vecThumbRaw = (vec, size, mono) => { // thumbnail for a library item that is not in the project yet (mono = one-colour silhouette)
  const tmp = { id: '__tmp', name: '', vec }, keep = MB.assets.__tmp; MB.assets.__tmp = tmp;
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const k = Math.min((size - 8) / vec.w, (size - 8) / vec.h), w = vec.w * k, h = vec.h * k;
  MB.drawPrims(x, MB.vecPrims('__tmp', (size - w) / 2, (size - h) / 2, w, h, mono ? { style: 'mono', color: mono } : {}), 1, {});
  if (keep) MB.assets.__tmp = keep; else delete MB.assets.__tmp;
  return c.toDataURL();
};

/* flat-background removal for generated stickers: flood-fill from the borders with the border colour */
MB.removeFlatBg = async (dataUrl, tol = 30) => {
  const img = await MB.loadImage(dataUrl), W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, W, H), d = id.data;
  const corners = [0, W - 1, (H - 1) * W, H * W - 1];
  const bg = [0, 1, 2].map(k => corners.reduce((s, p) => s + d[p * 4 + k], 0) / 4);
  const dist = (p) => Math.hypot(d[p * 4] - bg[0], d[p * 4 + 1] - bg[1], d[p * 4 + 2] - bg[2]);
  const seen = new Uint8Array(W * H), q = new Int32Array(W * H); let qh = 0, qt = 0;
  const push = (p) => { if (!seen[p] && dist(p) < tol) { seen[p] = 1; q[qt++] = p; } };
  for (let i = 0; i < W; i++) { push(i); push((H - 1) * W + i); }
  for (let j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
  while (qh < qt) { const p = q[qh++], px = p % W; if (px > 0) push(p - 1); if (px < W - 1) push(p + 1); if (p >= W) push(p - W); if (p < W * (H - 1)) push(p + W); }
  for (let p = 0; p < W * H; p++) {
    if (seen[p]) { d[p * 4 + 3] = 0; continue; }
    const px = p % W; // soften the rim next to removed pixels
    if ((px > 0 && seen[p - 1]) || (px < W - 1 && seen[p + 1]) || (p >= W && seen[p - W]) || (p < W * (H - 1) && seen[p + W])) d[p * 4 + 3] = Math.min(d[p * 4 + 3], MB.clamp(dist(p) / (tol * 2.2), 0.25, 1) * 255);
  }
  x.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
};

/* ======================= AI window (floating, non-modal) ======================= */
const AI = MB.aiUI = { state: { tab: 'lib', cat: 'ทั้งหมด', status: null, sd: null, results: [], busy: false, kind: 'orn', prompt: '', style: 'pastel', n: 6, usePalette: true, quality: 'medium', sdQuality: 'fast' } };
const STYLES = [['pastel', 'พาสเทลน่ารัก', 'soft pastel kawaii'], ['gold', 'ทองหรูหรา', 'luxury gold, elegant'], ['y2k', 'Y2K', 'Y2K retro pop, glossy'], ['halloween', 'ฮาโลวีน', 'cute Halloween'],
  ['xmas', 'คริสต์มาส', 'cozy Christmas'], ['carnival', 'ม้าหมุน/สวนสนุก', 'carousel funfair, circus'], ['sky', 'ท้องฟ้า/เมฆ', 'dreamy sky, clouds, stars'], ['minimal', 'มินิมอล', 'minimal clean geometric']];
const KINDS = {
  orn: { label: 'สัญลักษณ์หัว/ท้ายชื่อ', vec: true, n: 6, role: 'orn', guide: 'Small decorative symbol placed before or after a product title / price (sparkle, star, heart, bow, wing, flower, crown, music note, ribbon end). Roughly square (1:1 to 1.4:1), bold simple silhouette readable at 20 px.' },
  tag: { label: 'ทรงป้ายราคา', vec: true, n: 4, role: 'tag', guide: 'Background shape for a PRICE TAG / badge. Wide, about 2.3:1. One dominant solid shape with a large flat EMPTY area in the centre for price text; small decorations only near the edges. The largest shape must be one solid colour.' },
  decor: { label: 'ลายตกแต่ง (เวกเตอร์)', vec: true, n: 4, role: 'decor', guide: 'Decorative sticker / doodle to scatter on a poster (sparkles, stars, clouds, hearts, confetti, bows, carousel motifs…). Cute, bold, flat.' },
  sticker: { label: 'สติกเกอร์ (ภาพพื้นใส)', vec: false, n: 2 },
  bg: { label: 'พื้นหลัง (ภาพ)', vec: false, n: 1 },
};
const SYSTEM_SVG = 'You design flat vector graphics for official merchandise posters (concerts, fan meetings, TV series goods).\n' +
  'Return ONLY a JSON object: {"items":[{"name":"<2-4 word English name>","svg":"<svg ...>...</svg>"}]}.\n' +
  'Rules for every svg: has a viewBox; uses only <path>, <circle>, <ellipse>, <rect>, <polygon>, <polyline>, <g>; ' +
  'no <text>, no images, no filters, no masks, no clipPath, no gradients, no <style> or CSS classes; solid fills as #RRGGBB; ' +
  'strokes allowed but prefer filled shapes; clean and crisp at small sizes; 3-25 shapes. Items must be clearly different from each other. ' +
  'Never draw real people, logos, brand marks or letters.';
const palette = () => {
  const t = MB.state.theme, set = new Set([t.title.color, t.price.fill, t.badge.fill, t.tag.fill, t.bar.fill].map(c => String(c).toUpperCase()));
  if (MB.ui._palette) MB.ui._palette.pal.slice(0, 5).forEach(c => set.add(c.hex));
  return [...set].filter(c => /^#[0-9A-F]{6}$/.test(c)).slice(0, 8);
};
const styleEn = () => (STYLES.find(s => s[0] === AI.state.style) || STYLES[0])[2];
const imgSize = () => { const G = MB.pageGeom(MB.state), asp = 1000 / G.HU; return asp > 1.2 ? 'landscape' : asp < 0.83 ? 'portrait' : 'square'; };

/* ----- floating panel shell ----- */
let panel = null;
function shell() {
  if (panel) return panel;
  const h = MB.h;
  panel = h('div', { class: 'aifloat', hidden: true },
    h('div', { class: 'aihead' }, h('b', null, MB.PWA ? '✦ คลังลาย' : '✨ AI & คลังลาย'), h('span', { class: 'grow' }), h('button', { class: 'x', title: 'ปิด', onclick: () => { panel.hidden = true; } }, '✕')),
    h('nav', { class: 'aitabs' }), h('div', { class: 'aibody' }));
  document.body.append(panel);
  // drag by the header
  const head = panel.querySelector('.aihead');
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = panel.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    const mv = (ev) => { panel.style.left = MB.clamp(ev.clientX - ox, 0, innerWidth - 120) + 'px'; panel.style.top = MB.clamp(ev.clientY - oy, 0, innerHeight - 60) + 'px'; panel.style.right = 'auto'; };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  return panel;
}
AI.open = async (kindOrTab) => {
  const S = AI.state;
  if (KINDS[kindOrTab]) {
    S.kind = kindOrTab; S.n = KINDS[kindOrTab].n;
    S.tab = 'lib'; S.cat = kindOrTab === 'tag' ? 'ป้ายราคา' : kindOrTab === 'orn' ? 'ดาว' : 'ทั้งหมด';
  } else if (kindOrTab) S.tab = kindOrTab;
  shell().hidden = false;
  render();
  if (MB.server.ok) {
    try { S.status = await MB.api('/api/ai/status'); } catch (e) { S.status = null; }
    try { S.sd = await MB.api('/api/sd/status'); } catch (e) { S.sd = { ok: true, running: false, error: e.message }; }
    render();
  }
};
// iPad app: library + SVG import only (no AI generation)
const TABS = MB.PWA ? [['lib', 'คลังลายฟรี']] : [['lib', 'คลังลายฟรี'], ['chatgpt', 'ChatGPT (ฟรี)'], ['local', 'AI ในเครื่อง (RTX)'], ['api', 'OpenAI API']];
function render() {
  if (!panel || panel.hidden) return;
  const h = MB.h, S = AI.state, nav = panel.querySelector('.aitabs'), body = panel.querySelector('.aibody'), sc = body.scrollTop;
  if (!TABS.some(t => t[0] === S.tab)) S.tab = 'lib';
  nav.hidden = TABS.length < 2;
  nav.innerHTML = ''; TABS.forEach(([id, l]) => nav.append(h('button', { class: S.tab === id ? 'on' : '', onclick: () => { S.tab = id; render(); } }, l)));
  body.innerHTML = '';
  const f = { lib: libTab, chatgpt: chatTab, local: localTab, api: apiTab }[S.tab];
  body.append(...[].concat(f()).filter(Boolean));
  if (S.tab !== 'lib') { const rv = resultsView(); if (rv) body.append(rv); }
  body.scrollTop = sc;
}
AI.render = render;

/* ----- shared bits ----- */
function kindPicker(kinds) {
  const h = MB.h, S = AI.state;
  if (!kinds.includes(S.kind)) { S.kind = kinds[0]; S.n = KINDS[S.kind].n; }
  return h('div', { class: 'aikinds' }, kinds.map(id => { const k = KINDS[id]; return h('button', { class: S.kind === id ? 'on' : '', onclick: () => { S.kind = id; S.n = k.n; render(); } }, k.label, h('small', null, k.vec ? 'เวกเตอร์ แก้ได้' : 'ภาพ PNG')); }));
}
function ideaBox(placeholder) {
  const h = MB.h, S = AI.state, pr = h('textarea', { rows: 2, placeholder });
  pr.value = S.prompt; pr.addEventListener('input', () => { S.prompt = pr.value; });
  const styles = h('div', { class: 'chips2' }, STYLES.map(([id, l]) => h('button', { class: 'small' + (S.style === id ? ' on' : ''), onclick: () => { S.style = id; render(); } }, l)));
  const pal = palette();
  return [pr, styles, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.usePalette, onchange: (e) => { S.usePalette = e.target.checked; } }), h('span', null, 'ใช้ชุดสีของงาน '),
    h('span', { class: 'swatches' }, pal.map(c => h('span', { class: 'sw', style: `background:${c};width:15px;height:15px` }))))];
}
const placeholderFor = (kind) => KINDS[kind].vec ? 'เช่น ดาวกากเพชรมีปีก, ริบบิ้นม้าหมุน, หัวใจคู่…' : kind === 'bg' ? 'เช่น ท้องฟ้ายามค่ำมีพลุสีพาสเทล ม้าหมุนไกล ๆ' : 'เช่น พลุกากเพชรสีชมพู, ดาวคริสตัล, หมีถือลูกโป่ง';

/* ----- tab: free library ----- */
function libTab() {
  const h = MB.h, S = AI.state;
  const cats = h('div', { class: 'chips2' }, MB.VLIB_CATS.map(c => h('button', { class: 'small' + (S.cat === c ? ' on' : ''), onclick: () => { S.cat = c; render(); } }, c)));
  const items = MB.VLIB.filter(it => S.cat === 'ทั้งหมด' || it.cat === S.cat);
  const grid = h('div', { class: 'aires lib' }, items.map(it => {
    let src = ''; try { src = vecThumbRaw(MB.vlibVector(it.key), 110); } catch (e) { console.warn(it.key, e); }
    return h('div', { class: 'aicard' }, h('img', { src }), h('small', null, it.name), h('div', { class: 'aiact' }, vecActions(() => MB.vlibAsset(it.key).id, it.role)));
  }));
  const st = MB.state, mine = (st.vecLib || []).filter(id => MB.assets[id] && !MB.assets[id].libKey);
  return [h('div', { class: 'hint' }, 'ฟรี ใช้ได้ไม่จำกัด · หลังวางแล้ว เลือกชิ้นนั้นเพื่อเปลี่ยนสี / เส้นขอบ / สติกเกอร์ขอบขาวได้ที่แท็บ ที่เลือก'), cats, grid,
    h('div', { class: 'brow' }, h('button', { onclick: async () => { const f = await MB.ui.pickFiles('.svg,image/svg+xml'); if (f.length) { await AI.importSvgFiles(f, S.cat === 'ป้ายราคา' ? 'tag' : 'decor'); render(); } } }, '⬆ นำเข้าไฟล์ SVG ของคุณ')),
    mine.length ? h('details', { class: 'sec', open: true }, h('summary', null, `ลายของงานนี้ (สร้าง/นำเข้า ${mine.length})`),
      h('div', { class: 'aires lib' }, mine.slice().reverse().map(id => { const a = MB.assets[id]; return h('div', { class: 'aicard' }, h('img', { src: MB.vecThumb(a, 110) }), h('small', null, a.name),
        h('div', { class: 'aiact' }, vecActions(() => id, a.role), h('button', { class: 'small danger', onclick: () => { st.vecLib = st.vecLib.filter(x => x !== id); MB.commit(); render(); } }, 'ลบ'))); }))) : null];
}

/* ----- tab: ChatGPT bridge (no API cost) ----- */
let chatWin = null;
function chatPrompt() {
  const S = AI.state, K = KINDS[S.kind], pal = S.usePalette ? palette() : [], style = styleEn();
  if (K.vec) return `${SYSTEM_SVG.replace('Return ONLY a JSON object: {"items":[{"name":"<2-4 word English name>","svg":"<svg ...>...</svg>"}]}.', 'Reply with each design as its own ```svg code block (no other text).')}\n\nMake ${S.n} items.\nType: ${K.guide}\nTheme / idea: ${S.prompt || 'free choice that suits the style'}\nStyle: ${style}.` + (pal.length ? `\nUse only these colours (white allowed too): ${pal.join(', ')}.` : '');
  const shape = S.kind === 'sticker' ? 'square 1:1' : imgSize() === 'portrait' ? 'portrait 2:3' : imgSize() === 'landscape' ? 'landscape 3:2' : 'square 1:1';
  return S.kind === 'sticker'
    ? `Create an image (${shape}): ${S.prompt || 'a cute decorative sparkle sticker'}. A single decorative sticker element, centered, isolated on a TRANSPARENT background (PNG with alpha), no text, no letters, no logos, no real people, clean edges. Style: ${style}.` + (pal.length ? ` Colour palette: ${pal.join(', ')}.` : '')
    : `Create an image (${shape}): ${S.prompt || 'a dreamy festive background'}. Poster background artwork for an official merchandise lineup, no text, no letters, no logos, no people; keep the middle area calm and uncluttered for product cards. Style: ${style}.` + (pal.length ? ` Colour palette: ${pal.join(', ')}.` : '');
}
function chatTab() {
  const h = MB.h, S = AI.state;
  const open = () => {
    const w = Math.min(620, Math.round(screen.availWidth * 0.36)), left = screen.availWidth - w;
    chatWin = window.open('https://chatgpt.com/', 'mb_chatgpt', `popup=yes,width=${w},height=${screen.availHeight - 40},left=${left},top=0`);
    if (!chatWin) MB.ui.toast('เบราว์เซอร์บล็อกหน้าต่าง — อนุญาต pop-up ให้ 127.0.0.1 แล้วกดอีกครั้ง', 6000);
  };
  const copy = async () => {
    const txt = chatPrompt();
    try { await navigator.clipboard.writeText(txt); MB.ui.toast('คัดลอกคำสั่งแล้ว — ไปวาง (Ctrl+V) ในช่องแชตของ ChatGPT ได้เลย', 4000); }
    catch (e) { prompt('คัดลอกข้อความนี้ไปวางใน ChatGPT', txt); }
    if (chatWin && !chatWin.closed) chatWin.focus();
  };
  const paste = h('div', { class: 'pastebox', tabindex: 0, contenteditable: 'true', 'data-ph': 'คลิกที่นี่แล้วกด Ctrl+V — วางโค้ด SVG หรือรูปที่คัดลอกจาก ChatGPT (หรือลากไฟล์ PNG/SVG มาวาง)' });
  paste.addEventListener('paste', (e) => { e.preventDefault(); handleClipboard(e.clipboardData, true); });
  paste.addEventListener('drop', (e) => { e.preventDefault(); handleFiles([...e.dataTransfer.files], true); });
  paste.addEventListener('dragover', (e) => e.preventDefault());
  paste.addEventListener('input', () => { paste.textContent = ''; });
  return [
    h('div', { class: 'aistep' }, h('b', null, '1'), h('div', { class: 'col grow' }, h('span', null, 'เปิด ChatGPT ข้างจอ แล้วล็อกอินบัญชีของคุณเอง (ฟรีหรือ Plus ก็ได้)'),
      h('button', { class: 'primary', onclick: open }, '↗ เปิด ChatGPT ข้างจอ'))),
    h('div', { class: 'aistep' }, h('b', null, '2'), h('div', { class: 'col grow' }, h('span', null, 'เลือกสิ่งที่อยากได้ แล้วกดคัดลอกคำสั่ง (โปรแกรมเขียนให้ ใส่สีของงานให้)'),
      kindPicker(['orn', 'tag', 'decor', 'sticker', 'bg']), ...ideaBox(placeholderFor(S.kind)),
      KINDS[S.kind].vec ? MB.ui.row('จำนวน', MB.ui.sel(S, 'n', [2, 4, 6, 8].map(v => [v, v + ' แบบ']), null, true)) : null,
      h('button', { class: 'primary', onclick: copy }, '📋 คัดลอกคำสั่ง'),
      h('details', null, h('summary', { class: 'hint' }, 'ดูคำสั่งที่จะคัดลอก'), h('pre', { class: 'promptpre' }, chatPrompt())))),
    h('div', { class: 'aistep' }, h('b', null, '3'), h('div', { class: 'col grow' },
      h('span', null, KINDS[S.kind].vec ? 'ใน ChatGPT กดปุ่มคัดลอกที่มุมกล่องโค้ด (หรือคัดลอกทั้งคำตอบ) แล้ววางที่นี่' : 'ใน ChatGPT คลิกขวาที่รูป › คัดลอกรูปภาพ แล้ววางที่นี่ (หรือบันทึกรูปแล้วลากมาวาง)'),
      paste, h('div', { class: 'hint' }, 'ทางลัด: กด Ctrl+V บนหน้างานได้เลย — รูปจะวางเป็นรูปตกแต่ง, โค้ด SVG จะกลายเป็นเวกเตอร์'))),
  ];
}
/* clipboard / files → results (in the AI window) or straight onto the page */
async function handleClipboard(cd, toResults) {
  const files = [...(cd.files || [])].filter(f => /^image\//.test(f.type));
  if (files.length) return handleFiles(files, toResults);
  const txt = cd.getData('text/plain') || '';
  const svgs = txt.match(/<svg[\s\S]*?<\/svg>/gi);
  if (svgs && svgs.length) return importSvgTexts(svgs, toResults);
  if (txt.trim().startsWith('{')) { try { const items = JSON.parse(txt).items || []; return importSvgTexts(items.map(i => i.svg), toResults, items.map(i => i.name)); } catch (e) {} }
  MB.ui.toast('ไม่พบรูปหรือโค้ด SVG ในสิ่งที่วาง');
}
async function handleFiles(files, toResults) {
  const svgFiles = files.filter(f => /svg/.test(f.type) || /\.svg$/i.test(f.name)), imgs = files.filter(f => !svgFiles.includes(f) && /^image\//.test(f.type));
  if (svgFiles.length) await importSvgTexts(await Promise.all(svgFiles.map(f => f.text())), toResults, svgFiles.map(f => f.name.replace(/\.svg$/i, '')));
  for (const f of imgs) {
    const b64 = (await MB.readDataURL(f)).split(',')[1];
    if (toResults) AI.state.results.unshift({ type: 'img', b64, kind: AI.state.kind === 'bg' ? 'bg' : 'sticker' });
    else await AI.useImage({ b64, kind: 'sticker' }, 'place');
  }
  if (toResults) render();
}
function importSvgTexts(texts, toResults, names) {
  const K = KINDS[AI.state.kind] || KINDS.decor, role = toResults && K.vec ? K.role : 'decor'; let ok = 0;
  texts.forEach((t, i) => {
    try {
      const a = MB.addVectorAsset(MB.svgToVector(t), (names && names[i]) || (K.vec ? K.label : 'SVG') + ' ' + (i + 1), role); ok++;
      if (toResults) AI.state.results.unshift({ type: 'vec', id: a.id, kind: role }); else AI.placeVector(a.id);
    } catch (e) { console.warn('svg skipped', e); }
  });
  if (ok) { MB.commit(); MB.ui.toast(`นำเข้า ${ok} เวกเตอร์แล้ว`); } else MB.ui.toast('แปลงโค้ด SVG ไม่ได้ — ลองคัดลอกใหม่ทั้งกล่องโค้ด');
  if (toResults) render();
}
window.addEventListener('paste', (e) => { // Ctrl+V anywhere on the page (not while typing in a field)
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || !document.getElementById('modal').hidden) return;
  const cd = e.clipboardData; if (!cd) return;
  const hasImg = [...(cd.files || [])].some(f => /^image\//.test(f.type)), txt = cd.getData('text/plain') || '';
  if (!hasImg && !/<svg/i.test(txt)) return;
  e.preventDefault(); handleClipboard(cd, false);
});

/* ----- tab: local AI (ComfyUI on this PC) ----- */
function localTab() {
  const h = MB.h, S = AI.state, sd = S.sd;
  if (!MB.server.ok) return h('p', null, 'ต้องเปิดโปรแกรมผ่าน "MerchBoard Studio.bat"');
  if (!sd) return h('div', { class: 'hint' }, 'กำลังตรวจหา ComfyUI…');
  const recheck = h('button', { onclick: async () => { S.sd = null; render(); try { S.sd = await MB.api('/api/sd/status'); } catch (e) { S.sd = { running: false, error: e.message }; } render(); } }, 'ตรวจสอบอีกครั้ง');
  if (!sd.running) {
    const url = { v: sd.url || 'http://127.0.0.1:8188' };
    return h('div', { class: 'col' },
      h('div', { class: 'aistat warn' }, '○ ยังไม่พบ ComfyUI ที่ ' + url.v),
      h('h4', null, 'ติดตั้งครั้งเดียว (ฟรี ใช้การ์ดจอ RTX 5070 Ti ของคุณ)'),
      h('ol', { class: 'aisteps' },
        h('li', null, 'ดาวน์โหลด ComfyUI Portable (Windows / NVIDIA) ', h('button', { class: 'small', onclick: () => window.open('https://github.com/comfyanonymous/ComfyUI/releases', '_blank') }, 'เปิดหน้าดาวน์โหลด'), h('br'), h('small', null, 'การ์ดตระกูล RTX 50 ต้องใช้รุ่นใหม่ที่รองรับ CUDA 12.8 (ตัว portable รุ่นล่าสุดรองรับแล้ว) · แตกไฟล์ไว้ไดรฟ์ที่ว่างเยอะ (C เหลือ 231 GB, E 184 GB)')),
        h('li', null, 'ใส่โมเดลในโฟลเดอร์ ComfyUI\\models\\checkpoints — แนะนำ:', h('br'),
          h('small', null, '• FLUX.1 schnell (fp8, ราว 17 GB) — เก่งหลายสไตล์ เร็ว ', h('button', { class: 'small', onclick: () => window.open('https://huggingface.co/Comfy-Org/flux1-schnell', '_blank') }, 'เปิด')), h('br'),
          h('small', null, '• หรือโมเดล SDXL สายการ์ตูน/น่ารัก (ราว 6.5 GB) จาก Civitai / Hugging Face')),
        h('li', null, 'ดับเบิลคลิก run_nvidia_gpu.bat รอจนขึ้น "To see the GUI go to: http://127.0.0.1:8188"'),
        h('li', null, 'กลับมากด ตรวจสอบอีกครั้ง')),
      h('div', { class: 'pair' }, h('input', { type: 'text', value: url.v, oninput: (e) => { url.v = e.target.value.trim(); } }),
        h('button', { onclick: async () => { S.sd = await MB.api('/api/sd/config', { url: url.v }); render(); } }, 'บันทึกที่อยู่')), recheck,
      sd.error ? h('div', { class: 'hint' }, 'รายละเอียด: ' + sd.error) : null);
  }
  const ck = { v: sd.ckpt };
  const go = h('button', { class: 'primary big', disabled: S.busy, onclick: () => generateLocal() }, S.busy ? 'กำลังสร้าง…' : '✨ สร้างในเครื่อง (ฟรี)');
  return h('div', { class: 'col' },
    h('div', { class: 'aistat' }, '● เชื่อมต่อ ComfyUI แล้ว ', h('small', null, sd.device || ''), recheck),
    MB.ui.row('โมเดล', MB.ui.sel(ck, 'v', (sd.ckpts || []).map(c => [c, c]), async () => { S.sd = await MB.api('/api/sd/config', { ckpt: ck.v }); }, true)),
    kindPicker(['sticker', 'bg']), ...ideaBox(placeholderFor(S.kind)),
    h('div', { class: 'pair' }, MB.ui.row('จำนวน', MB.ui.sel(S, 'n', [1, 2, 3, 4].map(v => [v, v + ' รูป']), null, true)),
      MB.ui.row('คุณภาพ', MB.ui.sel(S, 'sdQuality', [['fast', 'เร็ว'], ['best', 'ละเอียด']], null, true))),
    h('div', { class: 'brow' }, go),
    h('div', { class: 'hint' }, 'สติกเกอร์: AI วาดบนพื้นเรียบ แล้วโปรแกรมลบพื้นให้อัตโนมัติตอนกดใช้ · ไม่เสียเงิน ไม่ต้องต่อเน็ต (หลังติดตั้งโมเดลแล้ว)'),
    !(sd.ckpts || []).length ? h('div', { class: 'aistat warn' }, 'ยังไม่มีโมเดลในโฟลเดอร์ checkpoints') : null);
}
async function generateLocal() {
  const S = AI.state, pal = S.usePalette ? palette() : [];
  S.busy = true; render();
  try {
    const r = await MB.api('/api/sd/generate', { kind: S.kind, prompt: S.prompt, style: styleEn(), palette: pal, n: S.n, quality: S.sdQuality, shape: S.kind === 'sticker' ? 'square' : imgSize() });
    r.images.forEach(b64 => S.results.unshift({ type: 'img', b64, kind: S.kind, flatBg: S.kind === 'sticker' }));
  } catch (e) { MB.ui.toast('✗ ' + e.message, 6000); }
  S.busy = false; render();
}

/* ----- tab: OpenAI API (pay per use) ----- */
function apiTab() {
  const h = MB.h, S = AI.state, st = S.status || {};
  if (!MB.server.ok) return h('p', null, 'ต้องเปิดโปรแกรมผ่าน "MerchBoard Studio.bat"');
  const note = h('div', { class: 'hint' }, 'เสียเงินตามการใช้จริงในบัญชี OpenAI ของคุณ — แนะนำเติมเครดิตทีละน้อยและปิด Auto-recharge (เวกเตอร์ ~ไม่ถึง 1 บาท/ครั้ง, ภาพ ~0.4–6 บาท/รูป) · ถ้าไม่อยากเสียเงิน ใช้แท็บ ChatGPT หรือ AI ในเครื่อง');
  if (!st.connected) return [note, connectForm()];
  const go = h('button', { class: 'primary big', disabled: S.busy, onclick: () => generate() }, S.busy ? 'กำลังสร้าง…' : '✨ สร้าง');
  const K = KINDS[S.kind];
  return [h('div', { class: 'aistat' },
      h('span', null, '● เชื่อมต่อ OpenAI แล้ว ', h('small', null, st.hint)),
      modelSel('text_model', st.text_models, 'โมเดลข้อความ (เวกเตอร์)'), modelSel('image_model', st.image_models, 'โมเดลภาพ'),
      h('button', { class: 'small danger', onclick: async () => { if (!confirm('ยกเลิกการเชื่อมต่อและลบ API key ออกจากเครื่องนี้?')) return; S.status = await MB.api('/api/ai/disconnect', {}); render(); } }, 'ยกเลิกการเชื่อมต่อ')),
    note, kindPicker(['orn', 'tag', 'decor', 'sticker', 'bg']), ...ideaBox(placeholderFor(S.kind)),
    h('div', { class: 'pair' },
      MB.ui.row('จำนวน', MB.ui.sel(S, 'n', (K.vec ? [2, 4, 6, 8] : [1, 2, 3, 4]).map(v => [v, v + ' แบบ']), null, true)),
      !K.vec ? MB.ui.row('คุณภาพ', MB.ui.sel(S, 'quality', [['low', 'ร่าง (ถูก/เร็ว)'], ['medium', 'กลาง'], ['high', 'สูง (แพงกว่า)']], null, true)) : null),
    h('div', { class: 'brow' }, go)];
}
function connectForm() {
  const h = MB.h, inp = h('input', { type: 'password', placeholder: 'sk-…', autocomplete: 'off' }), msg = h('div', { class: 'hint' });
  const go = h('button', { class: 'primary', onclick: async () => {
    go.disabled = true; msg.textContent = 'กำลังตรวจสอบ key กับ OpenAI…';
    try { AI.state.status = await MB.api('/api/ai/connect', { key: inp.value.trim() }); render(); }
    catch (e) { msg.textContent = '✗ ' + e.message; go.disabled = false; }
  } }, 'เชื่อมต่อ');
  return h('div', { class: 'col' },
    h('h4', null, 'เชื่อมต่อบัญชี OpenAI ของคุณ'),
    h('ol', { class: 'aisteps' },
      h('li', null, 'ล็อกอิน OpenAI ของคุณ แล้วสร้าง API key ', h('button', { class: 'small', onclick: () => window.open('https://platform.openai.com/api-keys', '_blank') }, 'เปิดหน้า API keys')),
      h('li', null, 'คัดลอก key (ขึ้นต้นด้วย sk-) มาวาง แล้วกด เชื่อมต่อ')),
    h('div', { class: 'pair' }, inp, go), msg,
    h('div', { class: 'hint' }, '• ChatGPT Plus/Pro ใช้กับ API แทนไม่ได้ · key เก็บใน config.json บนเครื่องนี้เท่านั้น หน้าเว็บและไฟล์ .mbproj ไม่มี key · ยกเลิกการเชื่อมต่อได้ตลอด'));
}
function modelSel(key, list, title) {
  const h = MB.h, S = AI.state, cur = S.status[key];
  const s = h('select', { title, class: 'aimodel' }, (list && list.length ? list : [cur]).map(m => h('option', { value: m, selected: m === cur }, m)));
  s.addEventListener('change', async () => { S.status = await MB.api('/api/ai/config', { [key]: s.value }); });
  return s;
}
async function generate() {
  const S = AI.state, K = KINDS[S.kind], style = styleEn(), pal = S.usePalette ? palette() : [];
  S.busy = true; render();
  try {
    if (K.vec) {
      const prompt = `Make ${S.n} items. Type: ${K.guide}\nTheme / idea: ${S.prompt || 'free choice that suits the style'}\nStyle: ${style}.` + (pal.length ? `\nUse only these colours (white allowed too): ${pal.join(', ')}.` : '');
      const r = await MB.api('/api/ai/svg', { system: SYSTEM_SVG, prompt });
      let items = [];
      try { items = JSON.parse(r.content).items || []; } catch (e) { throw new Error('AI ตอบกลับไม่ใช่ JSON'); }
      importSvgTexts(items.map(i => i.svg), true, items.map(i => i.name));
    } else {
      const sz = S.kind === 'sticker' ? '1024x1024' : { portrait: '1024x1536', landscape: '1536x1024', square: '1024x1024' }[imgSize()];
      const prompt = chatPrompt().replace(/^Create an image \([^)]*\): /, '');
      const r = await MB.api('/api/ai/image', { prompt, size: sz, n: S.n, background: S.kind === 'sticker' ? 'transparent' : 'opaque', quality: S.quality });
      r.images.forEach(b64 => S.results.unshift({ type: 'img', b64, kind: S.kind }));
    }
  } catch (e) { MB.ui.toast('✗ ' + e.message, 6000); }
  S.busy = false; render();
}

/* ----- applying results ----- */
const b64File = (b64, name) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name + '.png', { type: 'image/png' }); };
const resolveId = (idOrFn) => typeof idOrFn === 'function' ? idOrFn() : idOrFn;
AI.placeVector = (idOrFn) => {
  const id = resolveId(idOrFn), st = MB.state, A = MB.contentArea(st), a = MB.assets[id], w = 120, hh = w / MB.vecAspect(id);
  const el = { id: MB.uid('e'), type: 'vector', name: a.name, asset: id, x: A.x0 + A.W / 2 - w / 2, y: A.y0 + 20, w, h: hh, rot: 0, op: 1, locked: false, behind: false, vstyle: 'original', color: st.theme.title.color, color2: '#FFFFFF', ow: 0.05 };
  st.elements.push(el); MB.sel = { kind: 'el', id: el.id }; MB.commit(); MB.ui.rebuild(); MB.ui.toast('วางบนหน้างานแล้ว — ลากย้าย/ย่อขยาย/หมุน และเปลี่ยนสไตล์ได้ที่แท็บ ที่เลือก');
};
AI.setOrnament = (idOrFn, slot) => {
  const id = resolveId(idOrFn), t = MB.state.theme; t.orn = Object.assign({}, MB.defaultTheme().orn, t.orn);
  if (slot === 'title2') { t.orn.titlePre = id; t.orn.titlePost = id; } else if (slot === 'price2') { t.orn.pricePre = id; t.orn.pricePost = id; } else t.orn[slot] = id;
  MB.commit(); MB.ui.rebuild(); MB.ui.toast('ใส่สัญลักษณ์แล้ว — ปรับขนาด/สีได้ที่แท็บ สไตล์ › สัญลักษณ์หัว/ท้าย');
};
AI.setTag = (idOrFn) => { const id = resolveId(idOrFn), t = MB.state.theme; t.priceMode = 'pill'; t.price.shape = 'vec:' + id; MB.commit(); MB.ui.rebuild(); MB.ui.toast('ใช้เป็นป้ายราคาแล้ว'); };
AI.useImage = async (r, how) => {
  let file = b64File(r.b64, r.kind === 'bg' ? 'ai-background' : 'ai-sticker');
  if (r.flatBg && how !== 'bg') file = b64File((await MB.removeFlatBg('data:image/png;base64,' + r.b64)).split(',')[1], 'ai-sticker');
  const a = await MB.fileToAsset(file), st = MB.state;
  if (how === 'bg') { st.bg.asset = a.id; st.bg.fit = 'cover'; MB.ui.toast('ใช้เป็นพื้นหลังแล้ว'); }
  else {
    const A = MB.contentArea(st), w = 200, hh = w * a.h / a.w;
    st.elements.push({ id: MB.uid('e'), type: 'image', name: a.name, asset: a.id, x: A.x0 + A.W / 2 - w / 2, y: A.y0 + 20, w, h: hh, rot: 0, op: 1, locked: false, behind: false });
    MB.ui.toast('วางบนหน้างานแล้ว');
  }
  MB.commit(); MB.ui.rebuild();
};
function vecActions(idOrFn, role) {
  const h = MB.h, b = (l, fn) => h('button', { class: 'small', onclick: fn }, l);
  if (role === 'tag') return [b('ใช้เป็นป้ายราคา', () => AI.setTag(idOrFn)), b('วาง', () => AI.placeVector(idOrFn))];
  if (role === 'orn') return [b('หน้าชื่อ', () => AI.setOrnament(idOrFn, 'titlePre')), b('ท้ายชื่อ', () => AI.setOrnament(idOrFn, 'titlePost')), b('หน้า+ท้ายชื่อ', () => AI.setOrnament(idOrFn, 'title2')),
    b('หน้า+ท้ายราคา', () => AI.setOrnament(idOrFn, 'price2')), b('วาง', () => AI.placeVector(idOrFn))];
  return [b('วางบนหน้างาน', () => AI.placeVector(idOrFn)), b('หน้า+ท้ายชื่อ', () => AI.setOrnament(idOrFn, 'title2')), b('ป้ายราคา', () => AI.setTag(idOrFn))];
}
function resultsView() {
  const h = MB.h, S = AI.state;
  if (S.busy) return h('div', { class: 'aibusy' }, h('span', { class: 'spin' }), 'กำลังสร้าง…');
  if (!S.results.length) return null;
  return h('div', { class: 'col' }, h('h4', null, 'ผลลัพธ์'), h('div', { class: 'aires' }, S.results.slice(0, 24).map(r => {
    if (r.type === 'vec') { const a = MB.assets[r.id]; if (!a) return null; return h('div', { class: 'aicard' }, h('img', { src: MB.vecThumb(a, 120) }), h('small', null, a.name), h('div', { class: 'aiact' }, vecActions(r.id, r.kind))); }
    return h('div', { class: 'aicard img' }, h('img', { src: 'data:image/png;base64,' + r.b64 }),
      h('div', { class: 'aiact' }, r.kind === 'bg' ? h('button', { class: 'small', onclick: () => AI.useImage(r, 'bg') }, 'ใช้เป็นพื้นหลัง') : null,
        h('button', { class: 'small', onclick: () => AI.useImage(r, 'place') }, r.flatBg ? 'ลบพื้น + วาง' : 'วางบนหน้างาน'),
        h('button', { class: 'small', onclick: () => { const a = document.createElement('a'); a.href = 'data:image/png;base64,' + r.b64; a.download = 'ai-' + r.kind + '.png'; a.click(); } }, 'บันทึก PNG')));
  })));
}
/* SVG files can also be imported by hand */
AI.importSvgFiles = async (files, role) => {
  const ids = [];
  for (const f of files) { try { ids.push(MB.addVectorAsset(MB.svgToVector(await f.text()), f.name.replace(/\.svg$/i, ''), role || 'decor').id); } catch (e) { MB.ui.toast('อ่าน ' + f.name + ' ไม่ได้: ' + e.message); } }
  if (ids.length) { MB.commit(); MB.ui.rebuild(); MB.ui.toast(`เพิ่ม ${ids.length} เวกเตอร์เข้าคลังแล้ว`); }
  return ids;
};

})(window.MB);
