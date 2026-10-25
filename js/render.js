'use strict';
/* MerchBoard Studio — canvas renderer + editor interaction (select / move / resize / rotate / pan / zoom / drop) */
(function (MB) {

/* ---------- primitive renderer (shared by editor + export) ---------- */
MB.drawPrims = function draw(ctx, list, s, opt) {
  for (const p of list) {
    if (p.t === 'group') { draw(ctx, p.children, s, opt); continue; }
    if (p.t === 'ph' && !opt.editor) continue;
    ctx.save();
    ctx.globalAlpha = p.op == null ? 1 : p.op;
    if (p.rot) {
      const cx = (p.cx != null ? p.cx : p.x + p.w / 2) * s, cy = (p.cy != null ? p.cy : p.y + p.h / 2) * s;
      ctx.translate(cx, cy); ctx.rotate(p.rot * Math.PI / 180); ctx.translate(-cx, -cy);
    }
    if (p.t === 'rect') {
      ctx.beginPath();
      ctx.roundRect(p.x * s, p.y * s, p.w * s, p.h * s, Math.max(0, Math.min(p.r || 0, p.w / 2, p.h / 2)) * s);
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
      if (p.stroke && p.sw) { ctx.lineWidth = p.sw * s; ctx.strokeStyle = p.stroke; ctx.stroke(); }
    } else if (p.t === 'path') {
      ctx.beginPath();
      p.d.forEach(c => {
        if (c[0] === 'M') ctx.moveTo(c[1] * s, c[2] * s); else if (c[0] === 'L') ctx.lineTo(c[1] * s, c[2] * s);
        else if (c[0] === 'C') ctx.bezierCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s, c[5] * s, c[6] * s); else if (c[0] === 'Z') ctx.closePath();
      });
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(p.rule === 'evenodd' ? 'evenodd' : 'nonzero'); }
      if (p.stroke && p.sw) { ctx.lineWidth = p.sw * s; ctx.strokeStyle = p.stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
    } else if (p.t === 'img') {
      const a = MB.assets[p.asset], src = a && (opt.full ? a.img : (a.view || a.img));
      if (src && p.fx) imgFx(ctx, p, s, src);
      else if (src) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, p.x * s, p.y * s, p.w * s, p.h * s); }
    } else if (p.t === 'glass') {
      glass(ctx, p, s, opt);
    } else if (p.t === 'text' && p.fx) {
      fxText(ctx, p, s);
    } else if (p.t === 'text') {
      ctx.font = MB.fontCss(p.font, p.size * s); ctx.fillStyle = p.color; ctx.textAlign = p.align; ctx.textBaseline = 'alphabetic';
      ctx.letterSpacing = p.track ? (p.track * p.size * s / 1000) + 'px' : '0px';
      String(p.text).split('\n').forEach((ln, i) => ctx.fillText(ln, p.x * s, (p.y + i * p.size * (p.lh || 1.15)) * s));
    } else if (p.t === 'ph') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(120,140,170,.10)'; ctx.strokeStyle = 'rgba(90,110,150,.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.roundRect(p.x * s, p.y * s, p.w * s, p.h * s, 4); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      const fs = MB.clamp(Math.min(p.w, p.h) * s * 0.22, 7, 16);
      ctx.fillStyle = 'rgba(70,90,130,.75)'; ctx.font = `600 ${fs}px "Leelawadee UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.label || '', (p.x + p.w / 2) * s, (p.y + p.h / 2) * s);
    }
    ctx.restore();
  }
};
/* text with layer-style effects, rendered on offscreen canvases then composited
   (stacked like Photoshop: glow, drop shadow, stroke (outside), fill / gradient, bevel) */
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const rgba = (hex, a) => { const [r, g, b] = MB.hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
function fxText(ctx, p, s) {
  const fx = p.fx, size = p.size * s, lines = String(p.text).split('\n'), lh = p.size * (p.lh || 1.15) * s;
  const font = MB.fontCss(p.font, size), track = (p.track || 0) * size / 1000;
  const setup = (c) => { c.font = font; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.letterSpacing = track + 'px'; c.lineJoin = 'round'; c.miterLimit = 2; };
  const m = mkCanvas(1, 1).getContext('2d'); setup(m);
  const widths = lines.map(l => m.measureText(l).width), W = Math.max(1, ...widths);
  const sw = fx.stroke.on ? fx.stroke.w * s : 0, bold = fx.bold ? size * 0.035 : 0;
  const pad = Math.ceil(sw + bold + size * 0.15 + 4), asc = size * 1.1, H = asc + lh * (lines.length - 1) + size * 0.4;
  const cw = W + pad * 2, ch = H + pad * 2;
  const xs = lines.map((l, i) => pad + (p.align === 'center' ? (W - widths[i]) / 2 : p.align === 'right' ? W - widths[i] : 0));
  const each = (fn) => lines.forEach((l, i) => fn(l, xs[i], pad + asc + i * lh));
  const off = mkCanvas(cw, ch), o = off.getContext('2d'); setup(o);
  if (sw > 0) { o.strokeStyle = fx.stroke.color; o.lineWidth = 2 * (sw + bold); each((l, x, y) => o.strokeText(l, x, y)); }
  const fl = mkCanvas(cw, ch), f = fl.getContext('2d'); setup(f);
  let fill = p.color;
  if (fx.grad.on) {
    const a = fx.grad.angle * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a), L = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
    const g = f.createLinearGradient(cw / 2 - dx * L, ch / 2 - dy * L, cw / 2 + dx * L, ch / 2 + dy * L);
    g.addColorStop(0, p.color); g.addColorStop(1, fx.grad.c2); fill = g;
  }
  const paint = (c, style, ox, oy) => {
    c.fillStyle = style; each((l, x, y) => c.fillText(l, x + ox, y + oy));
    if (bold) { c.strokeStyle = style; c.lineWidth = bold * 2; each((l, x, y) => c.strokeText(l, x + ox, y + oy)); }
  };
  paint(f, fill, 0, 0);
  if (fx.bevel.on) {
    const d = Math.max(0.5, fx.bevel.size * s * 0.45);
    const rim = (color, ox, oy) => { // edge = glyph minus shifted glyph, softened, kept inside the glyph
      const t = mkCanvas(cw, ch), tc = t.getContext('2d'); setup(tc);
      paint(tc, color, 0, 0); tc.globalCompositeOperation = 'destination-out'; tc.filter = `blur(${d * 0.7}px)`; paint(tc, '#000', ox, oy);
      f.save(); f.globalCompositeOperation = 'source-atop'; f.globalAlpha = 0.8; f.drawImage(t, 0, 0); f.restore();
    };
    rim(fx.bevel.hl, d, d); rim(fx.bevel.sh, -d, -d);
  }
  o.drawImage(fl, 0, 0);
  const left = p.x * s - (p.align === 'center' ? W / 2 : p.align === 'right' ? W : 0) - pad, top = p.y * s - pad - asc;
  const halo = (color, op, blur, ox, oy, passes) => {
    const b = Math.max(0, blur), e = Math.ceil(b * 2 + 2), h = mkCanvas(cw + e * 2, ch + e * 2), hc = h.getContext('2d');
    hc.filter = `blur(${b}px)`; for (let i = 0; i < passes; i++) hc.drawImage(off, e, e);
    hc.filter = 'none'; hc.globalCompositeOperation = 'source-in'; hc.fillStyle = rgba(color, 1); hc.fillRect(0, 0, h.width, h.height);
    ctx.save(); ctx.globalAlpha *= op; ctx.drawImage(h, left - e + ox, top - e + oy); ctx.restore();
  };
  if (fx.glow.on) halo(fx.glow.color, fx.glow.op, fx.glow.size * s * 0.5, 0, 0, 2);
  if (fx.shadow.on) { const a = fx.shadow.angle * Math.PI / 180, dd = fx.shadow.dist * s; halo(fx.shadow.color, fx.shadow.op, fx.shadow.blur * s * 0.5, -Math.cos(a) * dd, Math.sin(a) * dd, 1); }
  ctx.drawImage(off, left, top);
}

/* image / logo with layer-style effects from its alpha: outer stroke, drop shadow, outer glow.
   haloOnly = the effects without the picture itself (baked under the image for Illustrator) */
function imgFx(ctx, p, s, src, haloOnly) {
  const fx = p.fx, W = p.w * s, H = p.h * s, sw = fx.stroke.on ? fx.stroke.w * s : 0;
  const reach = Math.max(fx.glow.on ? fx.glow.size * s * 1.2 : 0, fx.shadow.on ? (fx.shadow.dist + fx.shadow.blur * 1.2) * s : 0);
  const pad = Math.ceil(sw + reach + 4), cw = W + pad * 2, ch = H + pad * 2;
  const pic = mkCanvas(cw, ch), pc = pic.getContext('2d');
  pc.imageSmoothingQuality = 'high'; pc.drawImage(src, pad, pad, W, H);
  const base = mkCanvas(cw, ch), bc = base.getContext('2d');
  if (sw > 0) { // dilate the alpha by stamping it around rings, then paint it the stroke colour
    for (const r of [sw, sw * 0.66, sw * 0.33]) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; bc.drawImage(pic, Math.cos(a) * r, Math.sin(a) * r); }
    bc.globalCompositeOperation = 'source-in'; bc.fillStyle = fx.stroke.color; bc.fillRect(0, 0, cw, ch); bc.globalCompositeOperation = 'source-over';
  }
  const shape = mkCanvas(cw, ch), sc = shape.getContext('2d'); sc.drawImage(base, 0, 0); sc.drawImage(pic, 0, 0);
  const left = p.x * s - pad, top = p.y * s - pad;
  const halo = (color, op, blur, ox, oy, passes) => {
    const h = mkCanvas(cw, ch), hc = h.getContext('2d');
    hc.filter = `blur(${Math.max(0, blur)}px)`; for (let i = 0; i < passes; i++) hc.drawImage(shape, 0, 0);
    hc.filter = 'none'; hc.globalCompositeOperation = 'source-in'; hc.fillStyle = rgba(color, 1); hc.fillRect(0, 0, cw, ch);
    ctx.save(); ctx.globalAlpha *= op; ctx.drawImage(h, left + ox, top + oy); ctx.restore();
  };
  if (fx.glow.on) halo(fx.glow.color, fx.glow.op, fx.glow.size * s * 0.5, 0, 0, 2);
  if (fx.shadow.on) { const a = fx.shadow.angle * Math.PI / 180, dd = fx.shadow.dist * s; halo(fx.shadow.color, fx.shadow.op, fx.shadow.blur * s * 0.5, -Math.cos(a) * dd, Math.sin(a) * dd, 1); }
  ctx.drawImage(base, left, top);
  if (!haloOnly) ctx.drawImage(pic, left, top);
}
/* effects of one image prim baked to a PNG → { data, x, y, w, h } in U */
MB.bakeImgFx = (p, s) => {
  const fx = p.fx, a = MB.assets[p.asset], src = a && a.img;
  const m = (fx.stroke.on ? fx.stroke.w : 0) + Math.max(fx.glow.on ? fx.glow.size * 1.2 : 0, fx.shadow.on ? fx.shadow.dist + fx.shadow.blur * 1.2 : 0) + 2;
  const D = p.rot ? Math.hypot(p.w, p.h) : 0; // rotated: square box that holds any angle
  const x = p.rot ? p.x + p.w / 2 - D / 2 - m : p.x - m, y = p.rot ? p.y + p.h / 2 - D / 2 - m : p.y - m;
  const w = (p.rot ? D : p.w) + m * 2, h = (p.rot ? D : p.h) + m * 2;
  const c = mkCanvas(w * s, h * s), cx = c.getContext('2d');
  cx.translate(-x * s, -y * s);
  if (p.rot) { const ox = (p.x + p.w / 2) * s, oy = (p.y + p.h / 2) * s; cx.translate(ox, oy); cx.rotate(p.rot * Math.PI / 180); cx.translate(-ox, -oy); }
  if (src) imgFx(cx, p, s, src, true);
  const data = c.toDataURL('image/png'); c.width = c.height = 1;
  return { data, x, y, w, h };
};

/* ---------- liquid glass card ---------- */
const shapeOf = (c, s, dx = 0, dy = 0) => {
  const P = new Path2D();
  if (c.t === 'rect') P.roundRect((c.x + dx) * s, (c.y + dy) * s, c.w * s, c.h * s, Math.max(0, Math.min(c.r || 0, c.w / 2, c.h / 2)) * s);
  else c.d.forEach(q => {
    if (q[0] === 'M') P.moveTo((q[1] + dx) * s, (q[2] + dy) * s); else if (q[0] === 'L') P.lineTo((q[1] + dx) * s, (q[2] + dy) * s);
    else if (q[0] === 'C') P.bezierCurveTo((q[1] + dx) * s, (q[2] + dy) * s, (q[3] + dx) * s, (q[4] + dy) * s, (q[5] + dx) * s, (q[6] + dy) * s); else if (q[0] === 'Z') P.closePath();
  });
  return P;
};
/* the whole backdrop blurred once per scale/settings, then every glass card clips into it */
const blurCache = new Map();
function blurredBackdrop(p, s, opt) {
  const g = p.g, key = [s, g.blur, g.sat, !!opt.full, JSON.stringify(p.src)].join('|');
  if (blurCache.has(key)) return blurCache.get(key);
  s = Math.min(s, Math.sqrt(8e6 / (1000 * p.pageH))); // blur needs no detail: cap at ~8 MP (iPad canvas limit, deep zoom), drawn scaled up
  const W = Math.ceil(1000 * s), H = Math.ceil(p.pageH * s), b = g.blur * s, e = Math.ceil(b * 2);
  const src = mkCanvas(W + e * 2, H + e * 2), sc = src.getContext('2d');
  sc.translate(e, e); MB.drawPrims(sc, p.src, s, Object.assign({}, opt, { editor: false }));
  // mirror-free edge padding: stretch the outer rows/cols so the blur doesn't fade to transparent at the page edge
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.drawImage(src, e, e, W, 1, e, 0, W, e); sc.drawImage(src, e, e + H - 1, W, 1, e, e + H, W, e);
  sc.drawImage(src, e, 0, 1, H + e * 2, 0, 0, e, H + e * 2); sc.drawImage(src, e + W - 1, 0, 1, H + e * 2, e + W, 0, e, H + e * 2);
  const out = mkCanvas(W, H), oc = out.getContext('2d');
  oc.filter = `blur(${b}px) saturate(${g.sat})`; oc.drawImage(src, -e, -e);
  src.width = src.height = 1;
  if (blurCache.size > 2) blurCache.delete(blurCache.keys().next().value);
  blurCache.set(key, out);
  return out;
}
function glass(ctx, p, s, opt) {
  const g = p.g, c = p.clip, path = shapeOf(c, s), m = Math.min(p.w, p.h);
  if (p.part === 'back') {
    if (g.shadow > 0) { // soft drop shadow, cut out under the card so the glass stays clear
      const bl = m * 0.06 * s, pad = Math.ceil(bl * 2.5), oy = m * 0.025;
      const sh = mkCanvas(p.w * s + pad * 2, p.h * s + pad * 2), x = sh.getContext('2d');
      x.translate(pad - p.x * s, pad - p.y * s);
      x.filter = `blur(${bl}px)`; x.fillStyle = `rgba(0,0,0,${0.55 * g.shadow})`; x.fill(shapeOf(c, s, 0, oy));
      x.filter = 'none'; x.globalCompositeOperation = 'destination-out'; x.fill(path);
      ctx.drawImage(sh, p.x * s - pad, p.y * s - pad);
    }
    if (!p.src) return;
    ctx.save(); ctx.clip(path);
    const bd = blurredBackdrop(p, s, opt), k = Math.ceil(1000 * s) / bd.width; // bd may be rendered smaller than the page
    ctx.drawImage(bd, 0, 0, bd.width * k, bd.height * k);
    if (g.frost > 0) { ctx.fillStyle = `rgba(255,255,255,${g.frost})`; ctx.fill(path); }
    ctx.restore();
    return;
  }
  // shine: top sheen, faint bottom bounce, bright rim on the top-left / bottom-right edges
  ctx.save(); ctx.clip(path);
  const y0 = p.y * s, y1 = (p.y + p.h) * s, x0 = p.x * s, x1 = (p.x + p.w) * s;
  if (g.shine > 0) {
    let gr = ctx.createLinearGradient(0, y0, 0, y0 + (y1 - y0) * 0.5);
    gr.addColorStop(0, `rgba(255,255,255,${0.3 * g.shine})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(x0, y0, x1 - x0, (y1 - y0) * 0.5);
    gr = ctx.createLinearGradient(0, y1, 0, y1 - (y1 - y0) * 0.18);
    gr.addColorStop(0, `rgba(255,255,255,${0.12 * g.shine})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(x0, y1 - (y1 - y0) * 0.18, x1 - x0, (y1 - y0) * 0.18);
  }
  if (g.edge > 0) {
    const rim = ctx.createLinearGradient(x0, y0, x1, y1), a = g.edge;
    rim.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); rim.addColorStop(0.3, `rgba(255,255,255,${0.25 * a})`);
    rim.addColorStop(0.6, `rgba(255,255,255,${0.08 * a})`); rim.addColorStop(1, `rgba(255,255,255,${0.6 * a})`);
    ctx.save(); ctx.filter = `blur(${m * 0.02 * s}px)`; ctx.strokeStyle = rim; ctx.globalAlpha *= 0.6; ctx.lineWidth = m * 0.07 * s; ctx.stroke(path); ctx.restore();
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, m * 0.012 * s) * 2; ctx.stroke(path);
  }
  ctx.restore();
}
/* bake one glass prim to a PNG (for Photoshop / Illustrator, which can't blur live) → { data, x, y, w, h } in U */
MB.bakeGlass = (p, s) => {
  const pad = p.part === 'back' && p.g.shadow > 0 ? Math.min(p.w, p.h) * 0.2 : 0;
  const x = p.x - pad, y = p.y - pad, w = p.w + pad * 2, h = p.h + pad * 2;
  const c = mkCanvas(w * s, h * s), cx = c.getContext('2d');
  cx.translate(-x * s, -y * s); MB.drawPrims(cx, [p], s, { full: true });
  const data = c.toDataURL('image/png'); c.width = c.height = 1;
  return { data, x, y, w, h };
};

/* final-resolution render */
MB.renderFull = (st, maxPx, pid, opt) => {
  const G = MB.pageGeom(st);
  let W = G.Wpx, H = G.Hpx;
  if (maxPx && Math.max(W, H) > maxPx) { const k = maxPx / Math.max(W, H); W = Math.round(W * k); H = Math.round(H * k); }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  MB.drawPrims(ctx, MB.buildScene(st, pid).groups, W / 1000, opt || { full: true });
  return c;
};

MB.renderThumb = (st, pid, maxPx) => MB.renderFull(st, maxPx, pid, { full: false });

/* ---------- editor ---------- */
const V = MB.view = { z: 0.5, ox: 40, oy: 40 };
const RULER = 18; // px, rulers along the top / left of the stage
let cv, ctx, stage, scene = null, dirty = true, drag = null, hover = null, hoverGutter = null, snapLines = [], spaceDown = false, distMarks = [];
MB.requestRender = () => { dirty = true; };

/* ---------- smooth card motion + drag-to-reorder (cards reflow like phone home-screen icons) ---------- */
const disp = {}; // card id -> currently displayed geometry, eased toward the real one each frame
const geomsOf = () => { const m = {}; MB.state.cards.forEach(c => { m[c.id] = { x: c.x, y: c.y, w: c.w, h: c.h }; }); return m; };
function easeFrom(before, skipId) {
  MB.state.cards.forEach(c => {
    const g = before[c.id]; if (!g || c.id === skipId) return;
    if (Math.abs(c.x - g.x) + Math.abs(c.y - g.y) + Math.abs(c.w - g.w) + Math.abs(c.h - g.h) > 0.5 && !disp[c.id]) disp[c.id] = Object.assign({}, g);
  });
  dirty = true;
}
MB.animateLayout = (fn) => { const before = geomsOf(); fn(); easeFrom(before); };
MB.applyOrder = (st, order) => { // order = ids of the current page's unlocked cards; every other card keeps its array slot
  const byId = {}, inOrder = new Set(order); st.cards.forEach(c => { byId[c.id] = c; });
  let k = 0; st.cards = st.cards.map(c => inOrder.has(c.id) ? byId[order[k++]] : c);
};
function previewSlots(order) {
  const st = MB.state, tmp = Object.assign({}, st, { cards: JSON.parse(JSON.stringify(st.cards)) });
  MB.applyOrder(tmp, order); MB.autoLayout(tmp);
  const m = {}; tmp.cards.forEach(c => { if (!c.locked) m[c.id] = { x: c.x, y: c.y, w: c.w, h: c.h }; });
  return m;
}
function reorderTo(d, order) {
  const before = geomsOf(), slots = previewSlots(order);
  MB.state.cards.forEach(c => { if (c.id !== d.obj.id && slots[c.id]) Object.assign(c, slots[c.id]); });
  easeFrom(before, d.obj.id);
  d.ro.order = order; d.ro.slot = slots[d.obj.id];
}
/* after a manual resize, remember the new size as the card's weight so auto layout keeps it (area ∝ load × weight) */
MB.rememberSizes = (before, ids) => {
  MB.state.cards.forEach(c => {
    const g = before[c.id]; if (!g || (ids && !ids.has(c.id))) return;
    const k = (c.w * c.h) / Math.max(1, g.w * g.h);
    if (Math.abs(k - 1) > 0.02) c.weight = MB.clamp(MB.round((c.weight || 1) * k, 3), 0.25, 6);
  });
};
MB.getScene = () => scene;

MB.initStage = () => {
  stage = document.getElementById('stage'); cv = document.getElementById('cv'); ctx = cv.getContext('2d');
  new ResizeObserver(() => { dirty = true; }).observe(stage);
  cv.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp); // iOS cancels touches (system gestures, alerts)
  ['gesturestart', 'gesturechange'].forEach(t => cv.addEventListener(t, e => e.preventDefault())); // no Safari page zoom on the canvas
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('dblclick', onDbl);
  stage.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; stage.classList.add('drop'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('drop'));
  stage.addEventListener('drop', onDrop);
  window.addEventListener('keydown', e => { if (e.code === 'Space' && !isTyping(e)) { spaceDown = true; cv.style.cursor = 'grab'; if (e.target === document.body) e.preventDefault(); } });
  window.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; cv.style.cursor = ''; } });
  const loop = () => { if (dirty) { dirty = false; draw(); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
};
const isTyping = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);

MB.fitView = () => {
  if (!stage) return;
  const G = MB.pageGeom(MB.state), r = stage.getBoundingClientRect();
  V.z = Math.min((r.width - 70 - RULER) / 1000, (r.height - 70 - RULER) / G.HU);
  V.ox = RULER + (r.width - RULER - 1000 * V.z) / 2; V.oy = RULER + (r.height - RULER - G.HU * V.z) / 2;
  dirty = true; MB.ui && MB.ui.zoomLabel();
};
MB.zoomBy = (k, cx, cy) => {
  const r = stage.getBoundingClientRect();
  if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
  const nz = MB.clamp(V.z * k, 0.05, 8);
  V.ox = cx - (cx - V.ox) * nz / V.z; V.oy = cy - (cy - V.oy) * nz / V.z; V.z = nz;
  dirty = true; MB.ui && MB.ui.zoomLabel();
};

function draw() {
  const st = MB.state; if (!st) return;
  const dpr = window.devicePixelRatio || 1, r = stage.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; }
  let moving = false;
  let cards = st.cards.map(c => {
    const g = disp[c.id]; if (!g) return c;
    ['x', 'y', 'w', 'h'].forEach(k => { g[k] += (c[k] - g[k]) * 0.26; });
    if (Math.abs(c.x - g.x) + Math.abs(c.y - g.y) + Math.abs(c.w - g.w) + Math.abs(c.h - g.h) < 0.4) { delete disp[c.id]; return c; }
    moving = true; return Object.assign({}, c, g);
  });
  if (drag && drag.ro) { const i = cards.findIndex(c => c.id === drag.obj.id); if (i >= 0) cards.push(cards.splice(i, 1)[0]); }
  scene = MB.buildScene(moving || (drag && drag.ro) ? Object.assign({}, st, { cards }) : st);
  if (moving) dirty = true;
  const G = scene.G, s = V.z;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#e4e8ef'; ctx.fillRect(0, 0, r.width, r.height);
  ctx.save(); ctx.translate(V.ox, V.oy);
  ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.22)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000 * s, G.HU * s); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1000 * s, G.HU * s); ctx.clip();
  MB.drawPrims(ctx, scene.groups, s, { editor: true });
  ctx.restore();
  if (st.layout.guides) drawGuides(st, G, s);
  drawUserGuides(st, G, s);
  drawSelection(s);
  ctx.restore();
  drawRulers(st, G, r);
}

function drawGuides(st, G, s) {
  const A = MB.contentArea(st);
  ctx.save(); ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(67,102,233,.55)'; ctx.setLineDash([5, 4]);
  ctx.strokeRect(A.x0 * s, A.y0 * s, A.W * s, A.H * s);
  if (st.footer.on) { const ft = MB.footerTop(st) * s; ctx.strokeStyle = 'rgba(233,120,67,.6)'; ctx.beginPath(); ctx.moveTo(0, ft); ctx.lineTo(1000 * s, ft); ctx.stroke(); }
  if (G.bleedU > 0) { ctx.setLineDash([]); ctx.strokeStyle = 'rgba(230,40,90,.7)'; ctx.strokeRect(G.bleedU * s, G.bleedU * s, (1000 - 2 * G.bleedU) * s, (G.HU - 2 * G.bleedU) * s); }
  ctx.setLineDash([]); ctx.fillStyle = 'rgba(67,102,233,.75)'; ctx.font = '600 10px "Leelawadee UI", sans-serif';
  ctx.fillText('พื้นที่จัดวางสินค้า', A.x0 * s + 4, A.y0 * s - 4);
  if (st.footer.on) { ctx.fillStyle = 'rgba(233,120,67,.85)'; ctx.fillText('โลโก้ค่าย (Footer)', A.x0 * s + 4, MB.footerTop(st) * s + 12); }
  ctx.restore();
}

/* ---------- rulers + user guides (drag from a ruler to add, back onto it to remove) ---------- */
const guidesOf = (st) => (st.guides = st.guides || { v: [], h: [] });
function drawUserGuides(st, G, s) {
  const g = guidesOf(st);
  ctx.save(); ctx.strokeStyle = '#00b3d6'; ctx.lineWidth = 1;
  g.v.forEach(x => { ctx.beginPath(); ctx.moveTo(x * s, -V.oy); ctx.lineTo(x * s, 5000); ctx.stroke(); });
  g.h.forEach(y => { ctx.beginPath(); ctx.moveTo(-V.ox, y * s); ctx.lineTo(5000, y * s); ctx.stroke(); });
  ctx.restore();
}
function drawRulers(st, G, r) {
  const du = MB.dispUnit(st), s = V.z, uPer = 1 / du.k; // U per display unit
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  const step = steps.find(v => v * uPer * s >= 55) || 2000;
  ctx.save();
  ctx.fillStyle = '#f7f8fb'; ctx.fillRect(0, 0, r.width, RULER); ctx.fillRect(0, 0, RULER, r.height);
  ctx.strokeStyle = '#c9d0dc'; ctx.fillStyle = '#7d889a'; ctx.font = '9px "Segoe UI", sans-serif'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, RULER - 0.5); ctx.lineTo(r.width, RULER - 0.5); ctx.moveTo(RULER - 0.5, 0); ctx.lineTo(RULER - 0.5, r.height); ctx.stroke();
  // selection extents
  const sel = selBounds();
  if (sel) { ctx.fillStyle = 'rgba(67,102,233,.18)'; ctx.fillRect(V.ox + sel.x * s, 0, sel.w * s, RULER - 1); ctx.fillRect(0, V.oy + sel.y * s, RULER - 1, sel.h * s); ctx.fillStyle = '#7d889a'; }
  const tick = (v) => { // v in display units
    const xs = V.ox + v * uPer * s;
    if (xs < RULER || xs > r.width) return;
    ctx.beginPath(); ctx.moveTo(xs + 0.5, RULER - 7); ctx.lineTo(xs + 0.5, RULER); ctx.stroke(); ctx.fillText(String(v), xs + 2, 9);
  };
  const tickY = (v) => {
    const ys = V.oy + v * uPer * s;
    if (ys < RULER || ys > r.height) return;
    ctx.beginPath(); ctx.moveTo(RULER - 7, ys + 0.5); ctx.lineTo(RULER, ys + 0.5); ctx.stroke();
    ctx.save(); ctx.translate(9, ys + 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'right'; ctx.fillText(String(v), 0, 0); ctx.restore();
  };
  const x0 = Math.floor((RULER - V.ox) / s / uPer / step) * step, x1 = (r.width - V.ox) / s / uPer;
  for (let v = x0; v <= x1; v += step) tick(Math.round(v));
  const y0 = Math.floor((RULER - V.oy) / s / uPer / step) * step, y1 = (r.height - V.oy) / s / uPer;
  for (let v = y0; v <= y1; v += step) tickY(Math.round(v));
  ctx.fillStyle = '#eef1f6'; ctx.fillRect(0, 0, RULER, RULER);
  ctx.fillStyle = '#9aa3b0'; ctx.fillText(du.name, 2, 12);
  ctx.restore();
}

/* ---------- selection geometry ---------- */
const rotPt = (x, y, cx, cy, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), dx = x - cx, dy = y - cy; return { x: cx + dx * c - dy * sn, y: cy + dx * sn + dy * c }; };
const hitOf = (sel) => scene && sel ? scene.hits.find(h => h.kind === sel.kind && h.id === sel.id) || null : null;
function selBox() { return MB.selAll().length === 1 ? hitOf(MB.sel) : null; }
function selBounds() {
  const hs = MB.selAll().map(hitOf).filter(Boolean); if (!hs.length) return null;
  const x0 = Math.min(...hs.map(h => h.x)), y0 = Math.min(...hs.map(h => h.y)), x1 = Math.max(...hs.map(h => h.x + h.w)), y1 = Math.max(...hs.map(h => h.y + h.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function handles(b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, out = [];
  const pts = b.kind === 'card'
    ? [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]]
    : [['nw', -1, -1], ['ne', 1, -1], ['se', 1, 1], ['sw', -1, 1]];
  pts.forEach(([id, sx, sy]) => out.push(Object.assign({ id, sx, sy }, rotPt(cx + sx * b.w / 2, cy + sy * b.h / 2, cx, cy, b.rot))));
  if (b.kind === 'el') out.push(Object.assign({ id: 'rot', sx: 0, sy: -1 }, rotPt(cx, b.y - 26 / V.z, cx, cy, b.rot)));
  return out;
}
function drawSelection(s) {
  const b = selBox(), all = MB.selAll();
  ctx.save();
  if (drag && drag.ro && drag.ro.slot) {
    const q = drag.ro.slot;
    ctx.fillStyle = 'rgba(67,102,233,.13)'; ctx.strokeStyle = '#4366e9'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.roundRect(q.x * s, q.y * s, q.w * s, q.h * s, 8); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  }
  if (hover && !MB.isSel(hover.id)) outline(hover, s, 'rgba(67,102,233,.45)', 1);
  if (all.length > 1) {
    all.map(hitOf).filter(Boolean).forEach(h => outline(h, s, '#4366e9', 1.5));
    const u = selBounds();
    if (u) { ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(67,102,233,.7)'; ctx.strokeRect(u.x * s - 3, u.y * s - 3, u.w * s + 6, u.h * s + 6); ctx.setLineDash([]);
      ctx.fillStyle = '#4366e9'; ctx.font = '600 11px "Leelawadee UI", sans-serif'; ctx.fillText(`เลือก ${all.length} ชิ้น`, u.x * s, u.y * s - 8); }
  } else if (b) {
    outline(b, s, '#4366e9', 1.5);
    const obj = MB.findSel(MB.sel);
    if (obj && obj.locked) { ctx.fillStyle = '#4366e9'; ctx.font = '600 11px sans-serif'; ctx.fillText('🔒 ล็อก', b.x * s, b.y * s - 6); }
    else handles(b).forEach(hd => {
      ctx.beginPath();
      if (hd.id === 'rot') { ctx.arc(hd.x * s, hd.y * s, 5, 0, Math.PI * 2); ctx.fillStyle = '#4366e9'; ctx.fill(); }
      else { ctx.rect(hd.x * s - 4.5, hd.y * s - 4.5, 9, 9); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#4366e9'; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
  }
  const gt = (drag && drag.mode === 'gutter') ? drag.g : hoverGutter;
  if (gt) { // gutter between cards: drag to resize both sides
    ctx.fillStyle = 'rgba(67,102,233,.35)';
    if (gt.axis === 'v') ctx.fillRect((gt.edge - 1.5 / s) * s, gt.a * s, 3, (gt.b - gt.a) * s);
    else ctx.fillRect(gt.a * s, (gt.edge - 1.5 / s) * s, (gt.b - gt.a) * s, 3);
  }
  if (drag && drag.mode === 'marquee') {
    const m = normRect(drag.p0, drag.p1);
    ctx.fillStyle = 'rgba(67,102,233,.08)'; ctx.strokeStyle = '#4366e9'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.fillRect(m.x * s, m.y * s, m.w * s, m.h * s); ctx.strokeRect(m.x * s, m.y * s, m.w * s, m.h * s); ctx.setLineDash([]);
  }
  ctx.strokeStyle = '#ff3d7f'; ctx.lineWidth = 1; ctx.setLineDash([]);
  snapLines.forEach(l => { ctx.beginPath(); if (l.x != null) { ctx.moveTo(l.x * s, -2000); ctx.lineTo(l.x * s, 4000); } else { ctx.moveTo(-2000, l.y * s); ctx.lineTo(4000, l.y * s); } ctx.stroke(); });
  // distance marks to the nearest neighbours while moving
  if (distMarks.length) {
    const du = MB.dispUnit(MB.state);
    ctx.strokeStyle = '#ff7a00'; ctx.fillStyle = '#ff7a00'; ctx.font = '600 10px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    distMarks.forEach(m => {
      ctx.beginPath(); ctx.moveTo(m.x0 * s, m.y0 * s); ctx.lineTo(m.x1 * s, m.y1 * s); ctx.stroke();
      const label = MB.round(m.d * du.k, du.d) + ' ' + du.name, lx = (m.x0 + m.x1) / 2 * s, ly = (m.y0 + m.y1) / 2 * s;
      const tw = ctx.measureText(label).width + 6;
      ctx.fillStyle = '#fff'; ctx.fillRect(lx - tw / 2, ly - 7, tw, 13); ctx.fillStyle = '#ff7a00'; ctx.fillText(label, lx, ly + 3);
    });
    ctx.textAlign = 'left';
  }
  ctx.restore();
}
function outline(b, s, color, lw) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.save(); ctx.translate(cx * s, cy * s); ctx.rotate((b.rot || 0) * Math.PI / 180);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.strokeRect(-b.w / 2 * s, -b.h / 2 * s, b.w * s, b.h * s);
  ctx.restore();
}
const normRect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
function computeDistances(box, ids) {
  distMarks = [];
  const others = scene.hits.filter(h => !ids.has(h.id) && h.kind !== 'flogo' && !h.rot);
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  const near = (cands, dist) => cands.reduce((best, h) => { const d = dist(h); return d >= -0.01 && (!best || d < best.d) ? { h, d } : best; }, null);
  const cy = box.y + box.h / 2, cx = box.x + box.w / 2;
  const L = near(others.filter(h => ov(h.y, h.y + h.h, box.y, box.y + box.h) > 0), h => box.x - (h.x + h.w));
  const R = near(others.filter(h => ov(h.y, h.y + h.h, box.y, box.y + box.h) > 0), h => h.x - (box.x + box.w));
  const T = near(others.filter(h => ov(h.x, h.x + h.w, box.x, box.x + box.w) > 0), h => box.y - (h.y + h.h));
  const B = near(others.filter(h => ov(h.x, h.x + h.w, box.x, box.x + box.w) > 0), h => h.y - (box.y + box.h));
  if (L) distMarks.push({ x0: box.x - L.d, y0: cy, x1: box.x, y1: cy, d: L.d });
  if (R) distMarks.push({ x0: box.x + box.w, y0: cy, x1: box.x + box.w + R.d, y1: cy, d: R.d });
  if (T) distMarks.push({ x0: cx, y0: box.y - T.d, x1: cx, y1: box.y, d: T.d });
  if (B) distMarks.push({ x0: cx, y0: box.y + box.h, x1: cx, y1: box.y + box.h + B.d, d: B.d });
}

/* ---------- pointer ---------- */
function toDoc(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - V.ox) / V.z, y: (e.clientY - r.top - V.oy) / V.z }; }
function toScreen(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function inBox(p, b) { const q = rotPt(p.x, p.y, b.x + b.w / 2, b.y + b.h / 2, -(b.rot || 0)); return q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h; }
function hitTest(p) { return scene ? scene.hits.find(h => inBox(p, h)) : null; }
function handleAt(p) {
  const b = selBox(); if (!b) return null;
  const obj = MB.findSel(MB.sel); if (!obj || obj.locked) return null;
  const tol = (fingerDown ? 22 : 8) / V.z; // fingers need a bigger target than a mouse / Pencil
  return handles(b).find(hd => Math.abs(hd.x - p.x) <= tol && Math.abs(hd.y - p.y) <= tol) || null;
}
function guideAt(p) {
  const g = guidesOf(MB.state), tol = 4 / V.z;
  let i = g.v.findIndex(x => Math.abs(x - p.x) <= tol); if (i >= 0) return { axis: 'v', i };
  i = g.h.findIndex(y => Math.abs(y - p.y) <= tol); if (i >= 0) return { axis: 'h', i };
  return null;
}
/* gutters: the gap between two neighbouring cards (same row) or between two rows */
function gutterAt(p) {
  const st = MB.state, cards = MB.pageCards(st).filter(c => !c.hidden && !c.locked), gap = st.layout.gap, tol = Math.max(gap * 0.6, 5 / V.z);
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  for (const A of cards) for (const B of cards) {
    if (A === B) continue;
    const gx = B.x - (A.x + A.w);
    if (gx > -1 && gx < gap * 2 + 2 && ov(A.y, A.y + A.h, B.y, B.y + B.h) > Math.min(A.h, B.h) * 0.5) {
      const mid = A.x + A.w + gx / 2, a = Math.max(A.y, B.y), b = Math.min(A.y + A.h, B.y + B.h);
      if (Math.abs(p.x - mid) <= tol && p.y >= a && p.y <= b) {
        const band = [Math.min(A.y, B.y), Math.max(A.y + A.h, B.y + B.h)];
        const left = cards.filter(c => Math.abs(c.x + c.w - (A.x + A.w)) < 0.6 && ov(c.y, c.y + c.h, band[0], band[1]) > 1);
        const right = cards.filter(c => Math.abs(c.x - B.x) < 0.6 && ov(c.y, c.y + c.h, band[0], band[1]) > 1);
        return { axis: 'v', edge: mid, a, b, left, right };
      }
    }
    const gy = B.y - (A.y + A.h);
    if (gy > -1 && gy < gap * 2 + 2 && ov(A.x, A.x + A.w, B.x, B.x + B.w) > 1) {
      const mid = A.y + A.h + gy / 2;
      if (Math.abs(p.y - mid) <= tol && p.x >= Math.min(A.x, B.x) && p.x <= Math.max(A.x + A.w, B.x + B.w)) {
        const top = cards.filter(c => Math.abs(c.y + c.h - (A.y + A.h)) < 0.6), bottom = cards.filter(c => Math.abs(c.y - B.y) < 0.6);
        const xs = top.concat(bottom);
        return { axis: 'h', edge: mid, a: Math.min(...xs.map(c => c.x)), b: Math.max(...xs.map(c => c.x + c.w)), left: top, right: bottom };
      }
    }
  }
  return null;
}
function imgHitAt(p) { return scene && scene.imgHits ? scene.imgHits.find(h => inBox(p, h)) : null; }
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', rot: 'crosshair' };

function geomOf(sel, obj) {
  if (sel.kind === 'flogo') return { dx: obj.dx || 0, dy: obj.dy || 0, scale: obj.scale || 1 };
  if (sel.kind === 'el' && obj.type === 'text') return { x: obj.x, y: obj.y, size: obj.size, rot: obj.rot || 0 };
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h, rot: obj.rot || 0 };
}

/* ---------- touch (iPad): 2 fingers = pinch zoom + pan, double-tap = same as double-click ---------- */
const fingers = new Map();
let pinch = null, lastTap = null, fingerDown = false;
MB.multiMode = false; // on-screen stand-in for Shift (toolbar toggle in the iPad app)
function fingerStart(e) {
  fingers.set(e.pointerId, toScreen(e));
  if (fingers.size === 2) { // second finger: abandon the one-finger action, start pinching
    if (drag && (drag.mode === 'move' || drag.mode === 'gmove')) {
      if (drag.mode === 'move' && drag.obj && drag.o && drag.kind !== 'flogo') { drag.obj.x = drag.o.x; drag.obj.y = drag.o.y; }
      if (drag.items) drag.items.forEach(x => { x.obj.x = x.o.x; x.obj.y = x.o.y; });
      if (drag.ro) { MB.applyOrder(MB.state, drag.ro.order); }
    }
    drag = null; snapLines = []; distMarks = [];
    const [a, b] = [...fingers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    lastTap = null; dirty = true;
    return true;
  }
  if (fingers.size > 2 || pinch) return true;
  const now = performance.now(), sp = toScreen(e);
  if (lastTap && now - lastTap.t < 320 && Math.hypot(sp.x - lastTap.x, sp.y - lastTap.y) < 30) { lastTap = null; onDbl(e); return true; }
  lastTap = { t: now, x: sp.x, y: sp.y };
  return false;
}
function fingerMove(e) {
  if (!fingers.has(e.pointerId)) return false;
  fingers.set(e.pointerId, toScreen(e));
  if (!pinch) return false;
  if (fingers.size < 2) return true;
  const [a, b] = [...fingers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (pinch.d > 0 && d > 0) MB.zoomBy(d / pinch.d, m.x, m.y);
  V.ox += m.x - pinch.m.x; V.oy += m.y - pinch.m.y;
  pinch.d = d; pinch.m = m; dirty = true;
  return true;
}
function fingerEnd(e) {
  if (!fingers.delete(e.pointerId)) return false;
  if (pinch) { if (!fingers.size) pinch = null; return true; } // ignore the leftover finger until all are lifted
  return false;
}

function onDown(e) {
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic / already-released pointer */ }
  fingerDown = e.pointerType === 'touch';
  if (fingerDown && fingerStart(e)) return;
  const p = toDoc(e), sp = toScreen(e), st = MB.state, multiKey = e.shiftKey || e.ctrlKey || e.metaKey || MB.multiMode;
  if (e.button === 1 || spaceDown || (e.button === 0 && e.altKey && e.shiftKey)) { drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: V.ox, oy: V.oy }; cv.style.cursor = 'grabbing'; return; }
  if (e.button !== 0) return;
  // rulers: pull out a new guide
  if (sp.y < RULER || sp.x < RULER) {
    const g = guidesOf(st), axis = sp.y < RULER ? 'h' : 'v';
    g[axis].push(axis === 'h' ? p.y : p.x);
    drag = { mode: 'guide', axis, i: g[axis].length - 1, isNew: true }; return;
  }
  const hd = handleAt(p);
  if (hd) {
    const obj = MB.findSel(MB.sel);
    drag = { mode: hd.id === 'rot' ? 'rotate' : 'resize', hd, p0: p, box: Object.assign({}, selBox()), o: geomOf(MB.sel, obj), obj, kind: MB.sel.kind, before: geomsOf() };
    return;
  }
  const gt = !multiKey && gutterAt(p);
  if (gt) { drag = { mode: 'gutter', g: gt, p0: p, o: new Map(gt.left.concat(gt.right).map(c => [c.id, { x: c.x, y: c.y, w: c.w, h: c.h }])), before: geomsOf() }; return; }
  const gd = guideAt(p);
  if (gd && !hitOf(MB.sel)) { drag = Object.assign({ mode: 'guide' }, gd); return; }
  if ((e.ctrlKey || e.metaKey) && e.altKey) { // Ctrl+Alt+drag on a product image = nudge that image inside its card
    const ih = imgHitAt(p);
    if (ih) { const c = st.cards.find(x => x.id === ih.card), v = c && c.variants.find(x => x.id === ih.vid); if (v) { drag = { mode: 'vimg', v, p0: p, o: { ox: v.ox || 0, oy: v.oy || 0 } }; return; } }
  }
  const h = hitTest(p);
  if (h) {
    const selObj = { kind: h.kind, id: h.id };
    if (multiKey && h.kind !== 'flogo') { MB.toggleSel(selObj); MB.ui && MB.ui.onSelect(); dirty = true; if (!MB.isSel(h.id)) return; }
    else if (!MB.isSel(h.id) || h.kind === 'flogo') { MB.sel = selObj; MB.ui && MB.ui.onSelect(); }
    else if (MB.sel.id !== h.id) { MB.promoteSel(selObj); MB.ui && MB.ui.onSelect(); }
    const all = MB.selAll();
    if (all.length > 1) {
      const items = all.map(s => ({ s, obj: MB.findSel(s) })).filter(x => x.obj && !x.obj.locked).map(x => Object.assign(x, { o: { x: x.obj.x, y: x.obj.y } }));
      drag = { mode: 'gmove', p0: p, items, box: selBounds(), moved: false };
    } else {
      const obj = MB.findSel(MB.sel);
      if (obj && !obj.locked) drag = { mode: 'move', p0: p, box: Object.assign({}, h), o: geomOf(MB.sel, obj), obj, kind: h.kind, moved: false };
    }
  } else {
    const G = scene.G;
    if (p.x < 0 || p.y < 0 || p.x > 1000 || p.y > G.HU) { drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: V.ox, oy: V.oy }; if (MB.sel && !multiKey) { MB.sel = null; MB.ui && MB.ui.onSelect(); } }
    else { drag = { mode: 'marquee', p0: p, p1: p, add: multiKey }; if (!multiKey && MB.sel) { MB.sel = null; MB.ui && MB.ui.onSelect(); } }
  }
  dirty = true;
}

function snapMove(dx, dy, box, kind, ids) {
  snapLines = [];
  if (box.rot) return { dx, dy };
  const st = MB.state, G = scene.G, A = MB.contentArea(st), thr = 6 / V.z, g = guidesOf(st);
  const xs = [A.x0, A.x1, 500, G.bleedU, 1000 - G.bleedU, ...g.v], ys = [A.y0, A.y1, G.HU / 2, ...g.h];
  if (kind === 'card' || kind === 'el') scene.hits.forEach(h => { if (ids.has(h.id) || h.kind === 'flogo' || h.rot) return; xs.push(h.x, h.x + h.w, h.x + h.w / 2); ys.push(h.y, h.y + h.h, h.y + h.h / 2); });
  const best = (vals, edges) => { let r = null; edges.forEach(ed => vals.forEach(v => { const d = v - ed; if (Math.abs(d) < thr && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, v }; })); return r; };
  const nx = box.x + dx, ny = box.y + dy;
  const sx = best(xs, [nx, nx + box.w / 2, nx + box.w]), sy = best(ys, [ny, ny + box.h / 2, ny + box.h]);
  if (sx) { dx += sx.d; snapLines.push({ x: sx.v }); }
  if (sy) { dy += sy.d; snapLines.push({ y: sy.v }); }
  return { dx, dy };
}
function dropPageAt(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY), pg = el && el.closest('[data-page]');
  const pid = pg ? pg.dataset.page : null;
  MB.ui && MB.ui.pageHover(pid);
  return pid;
}

function onMove(e) {
  if (!scene || !cv) return;
  if (e.pointerType === 'touch' && fingerMove(e)) return;
  const p = toDoc(e);
  if (!drag) {
    if (e.target !== cv) return;
    const sp = toScreen(e);
    if (sp.y < RULER || sp.x < RULER) { cv.style.cursor = sp.y < RULER ? 'row-resize' : 'col-resize'; return; }
    const hd = handleAt(p), gt = hd ? null : gutterAt(p), gd = hd || gt ? null : guideAt(p), h = hd || gt ? null : hitTest(p);
    cv.style.cursor = spaceDown ? 'grab' : hd ? CURSORS[hd.id] : gt ? (gt.axis === 'v' ? 'col-resize' : 'row-resize') : gd && !h ? (gd.axis === 'v' ? 'ew-resize' : 'ns-resize') : h ? 'move' : '';
    if ((gt && gt.edge) !== (hoverGutter && hoverGutter.edge)) { hoverGutter = gt; dirty = true; }
    if ((h && h.id) !== (hover && hover.id)) { hover = h; dirty = true; }
    return;
  }
  const d = drag, o = d.o, obj = d.obj, st = MB.state;
  if (d.mode === 'pan') { V.ox = d.ox + e.clientX - d.sx; V.oy = d.oy + e.clientY - d.sy; dirty = true; return; }
  if (d.mode === 'marquee') { d.p1 = p; dirty = true; return; }
  if (d.mode === 'guide') { guidesOf(st)[d.axis][d.i] = d.axis === 'v' ? p.x : p.y; d.out = d.axis === 'v' ? toScreen(e).x < RULER : toScreen(e).y < RULER; dirty = true; return; }
  if (d.mode === 'vimg') { d.v.ox = MB.round(o.ox + p.x - d.p0.x, 2); d.v.oy = MB.round(o.oy + p.y - d.p0.y, 2); dirty = true; MB.touch(); return; }
  if (d.mode === 'gutter') {
    const g = d.g, min = 30;
    let delta = g.axis === 'v' ? p.x - d.p0.x : p.y - d.p0.y;
    const key = g.axis === 'v' ? 'w' : 'h', pos = g.axis === 'v' ? 'x' : 'y';
    g.left.forEach(c => { delta = Math.max(delta, min - d.o.get(c.id)[key]); });
    g.right.forEach(c => { delta = Math.min(delta, d.o.get(c.id)[key] - min); });
    g.left.forEach(c => { c[key] = d.o.get(c.id)[key] + delta; });
    g.right.forEach(c => { const q = d.o.get(c.id); c[pos] = q[pos] + delta; c[key] = q[key] - delta; });
    g.edge = (d.g.edge0 = d.g.edge0 == null ? g.edge : d.g.edge0) + delta;
    dirty = true; MB.touch(); return;
  }
  if (d.mode === 'gmove') {
    let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    if (!d.moved && Math.hypot(dx, dy) * V.z < 3) return;
    d.moved = true;
    if (d.items.some(x => x.s.kind === 'card')) d.dropPage = dropPageAt(e);
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    const ids = new Set(d.items.map(x => x.s.id));
    ({ dx, dy } = snapMove(dx, dy, d.box, 'card', ids));
    d.items.forEach(x => { x.obj.x = x.o.x + dx; x.obj.y = x.o.y + dy; });
    computeDistances({ x: d.box.x + dx, y: d.box.y + dy, w: d.box.w, h: d.box.h }, ids);
    dirty = true; MB.touch(); return;
  }
  if (d.mode === 'move') {
    let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    if (d.kind === 'card' && d.moved) d.dropPage = dropPageAt(e); // hovering a page in the page bar = move the card there on release
    if (!d.moved && Math.hypot(dx, dy) * V.z < 3) return;
    if (!d.moved && d.kind === 'card' && st.layout.reflow && !e.altKey) {
      d.ro = { order: MB.pageCards(st).filter(c => !c.locked && !c.hidden).map(c => c.id), slot: { x: o.x, y: o.y, w: o.w, h: o.h }, last: null };
    }
    d.moved = true;
    if (d.ro) { // follow the pointer freely; swap into the slot of whichever card is under it
      obj.x = o.x + dx; obj.y = o.y + dy; snapLines = []; distMarks = [];
      const over = MB.pageCards(st).find(c => c.id !== obj.id && !c.locked && !c.hidden && p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
      if (over && over.id !== d.ro.last) {
        const at = d.ro.order.indexOf(over.id), ord = d.ro.order.filter(id => id !== obj.id);
        ord.splice(at, 0, obj.id);
        reorderTo(d, ord);
      }
      d.ro.last = over ? over.id : null;
      dirty = true; MB.touch(); return;
    }
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    ({ dx, dy } = snapMove(dx, dy, d.box, d.kind, new Set([MB.sel.id])));
    if (d.kind === 'flogo') { obj.dx = o.dx + dx; obj.dy = o.dy + dy; }
    else { obj.x = o.x + dx; obj.y = o.y + dy; if (!d.box.rot) computeDistances({ x: d.box.x + dx, y: d.box.y + dy, w: d.box.w, h: d.box.h }, new Set([MB.sel.id])); }
  } else if (d.mode === 'rotate') {
    const b = d.box, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let a = o.rot + (Math.atan2(p.y - cy, p.x - cx) - Math.atan2(d.p0.y - cy, d.p0.x - cx)) * 180 / Math.PI;
    a = ((a + 540) % 360) - 180;
    if (e.shiftKey) a = Math.round(a / 15) * 15; else if (Math.abs(a) < 2) a = 0;
    obj.rot = MB.round(a, 1);
  } else if (d.mode === 'resize') resize(p, e.shiftKey);
  dirty = true; MB.touch();
}

function resize(p, free) {
  const d = drag, o = d.o, obj = d.obj, hd = d.hd, b = d.box;
  if (d.kind === 'card') {
    let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h; const min = 20;
    if (hd.sx < 0) x0 = Math.min(p.x, x1 - min); if (hd.sx > 0) x1 = Math.max(p.x, x0 + min);
    if (hd.sy < 0) y0 = Math.min(p.y, y1 - min); if (hd.sy > 0) y1 = Math.max(p.y, y0 + min);
    Object.assign(obj, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    return;
  }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (d.kind === 'flogo') {
    const k = Math.hypot(p.x - cx, p.y - cy) / Math.max(1e-6, Math.hypot(d.p0.x - cx, d.p0.y - cy));
    obj.scale = MB.clamp(MB.round(o.scale * k, 3), 0.1, 6);
    return;
  }
  // uniform scale anchored at the opposite corner, in the element's rotated frame
  const rot = b.rot || 0, P = rotPt(cx - hd.sx * b.w / 2, cy - hd.sy * b.h / 2, cx, cy, rot);
  const q = rotPt(p.x, p.y, P.x, P.y, -rot), dx = q.x - P.x, dy = q.y - P.y;
  let kx = Math.max(0.02, dx * hd.sx / b.w), ky = Math.max(0.02, dy * hd.sy / b.h);
  const k = Math.max(0.02, (dx * hd.sx * b.w + dy * hd.sy * b.h) / (b.w * b.w + b.h * b.h));
  if (!(free && obj.type === 'image')) { kx = k; ky = k; }
  const nw = b.w * kx, nh = b.h * ky, c = rotPt(P.x + hd.sx * nw / 2, P.y + hd.sy * nh / 2, P.x, P.y, rot);
  if (obj.type === 'text') {
    obj.size = Math.max(1, o.size * k);
    const nb = MB.textBox(obj); // keep anchor semantics: shift x,y so the new box center lands on c
    obj.x += c.x - (nb.x + nb.w / 2); obj.y += c.y - (nb.y + nb.h / 2);
  } else Object.assign(obj, { w: nw, h: nh, x: c.x - nw / 2, y: c.y - nh / 2 });
}

function onUp(e) {
  if (e.pointerType === 'touch' && fingerEnd(e)) return;
  if (!drag) return;
  const was = drag, st = MB.state; drag = null; snapLines = []; distMarks = []; cv.style.cursor = spaceDown ? 'grab' : '';
  MB.ui && MB.ui.pageHover(null);
  if (was.mode === 'marquee') {
    const m = normRect(was.p0, was.p1);
    if (m.w * V.z > 4 || m.h * V.z > 4) {
      const hits = scene.hits.filter(h => (h.kind === 'card' || h.kind === 'el') && h.x < m.x + m.w && h.x + h.w > m.x && h.y < m.y + m.h && h.y + h.h > m.y);
      MB.selectMany(hits.map(h => ({ kind: h.kind, id: h.id })), was.add);
      MB.ui && MB.ui.onSelect();
    }
    dirty = true; return;
  }
  if (was.mode === 'guide') {
    if (was.out || was.isNew && was.out !== false) guidesOf(st)[was.axis].splice(was.i, 1);
    MB.commit(); dirty = true; return;
  }
  if (was.mode === 'vimg') { MB.commit(); MB.ui && MB.ui.refreshSel(); dirty = true; return; }
  if (was.mode === 'gutter') { MB.rememberSizes(was.before); MB.commit(); MB.ui && MB.ui.refreshSel(); dirty = true; return; }
  if (was.mode === 'gmove') {
    if (was.dropPage && was.items.some(x => x.s.kind === 'card' && x.obj.page !== was.dropPage)) {
      was.items.forEach(x => { x.obj.x = x.o.x; x.obj.y = x.o.y; });
      MB.ui.moveCardsToPage(was.items.filter(x => x.s.kind === 'card').map(x => x.obj), was.dropPage);
    } else if (was.moved) { MB.commit(); MB.ui && MB.ui.refreshSel(); }
    dirty = true; return;
  }
  if (was.dropPage && was.obj && was.dropPage !== was.obj.page) {
    if (was.ro) MB.applyOrder(st, was.ro.order);
    Object.assign(was.obj, { x: was.o.x, y: was.o.y });
    MB.ui.moveCardToPage(was.obj, was.dropPage);
    dirty = true; return;
  }
  if (was.ro) {
    const before = geomsOf();
    MB.applyOrder(st, was.ro.order); MB.autoLayout(st);
    easeFrom(before);
    MB.ui && MB.ui.rebuild();
  }
  if (was.mode === 'resize' && was.kind === 'card') { // keep the new size: neighbours make room
    MB.rememberSizes(was.before, new Set([was.obj.id]));
    if (MB.layoutMode(st) === 'bento') MB.bentoSpanFromSize(st, was.obj);
    if (st.layout.reflow && !was.obj.locked) { const before = geomsOf(); MB.autoLayout(st); easeFrom(before); }
  }
  if (was.mode !== 'pan' && (was.mode !== 'move' || was.moved)) { MB.commit(); MB.ui && MB.ui.refreshSel(); }
  dirty = true;
}

let wheelT = 0;
function onWheel(e) {
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  if (e.altKey && !e.ctrlKey) { // Alt+wheel over a product image = zoom that image inside its card
    const ih = imgHitAt(toDoc(e)), c = ih && MB.state.cards.find(x => x.id === ih.card), v = c && c.variants.find(x => x.id === ih.vid);
    if (v) { v.zoom = MB.clamp(MB.round((v.zoom || 1) * Math.exp(-e.deltaY * 0.0015), 3), 0.2, 4); MB.touch(); clearTimeout(wheelT); wheelT = setTimeout(() => { MB.commit(); MB.ui && MB.ui.refreshSel(); }, 400); return; }
  }
  if (e.ctrlKey || e.metaKey) MB.zoomBy(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
  else { V.ox -= e.shiftKey ? e.deltaY : e.deltaX; V.oy -= e.shiftKey ? 0 : e.deltaY; dirty = true; }
}

function onDbl(e) {
  const h = hitTest(toDoc(e)); if (!h) return;
  if (h.kind === 'card') MB.ui.addImagesToCard(MB.state.cards.find(c => c.id === h.id));
  else if (h.kind === 'el') { const el = MB.state.elements.find(x => x.id === h.id); if (el.type === 'text') MB.ui.focusText(); else if (el.type === 'image') MB.ui.replaceElementImage(el); }
}

async function onDrop(e) {
  e.preventDefault(); stage.classList.remove('drop');
  const files = [...(e.dataTransfer.files || [])].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name));
  if (!files.length) return;
  const p = toDoc(e), h = hitTest(p), st = MB.state;
  if (files.length > 1 && !h && e.shiftKey) { MB.ui.matchImageFiles(files); return; }
  if (h && h.kind === 'card') { MB.ui.addImagesToCard(st.cards.find(c => c.id === h.id), files); return; }
  if (st.footer.on && p.y >= MB.footerTop(st)) { await MB.ui.addFooterLogos(files); return; }
  let i = 0;
  for (const f of files) {
    const a = await MB.fileToAsset(f), w = 220, hh = w * a.h / a.w;
    st.elements.push({ id: MB.uid('e'), type: 'image', name: a.name, asset: a.id, x: p.x - w / 2 + i * 20, y: p.y - hh / 2 + i * 20, w, h: hh, rot: 0, op: 1, locked: false, behind: false });
    i++;
  }
  MB.sel = { kind: 'el', id: st.elements[st.elements.length - 1].id };
  MB.commit(); MB.ui.rebuild();
}

})(window.MB);
