'use strict';
/* MerchBoard Studio — layout engine.
   State (U units) -> primitive tree {t:'group'|'rect'|'img'|'text'|'ph'}.
   The same tree feeds the canvas editor, PNG/JPG/PDF export and the Photoshop / Illustrator builders. */
(function (MB) {

const mctx = document.createElement('canvas').getContext('2d');
MB.measure = (text, f, size, track) => {
  mctx.font = MB.fontCss(f, 100);
  const s = String(text);
  return (mctx.measureText(s).width + (track ? track / 10 * Math.max(0, [...s].length - 1) : 0)) * size / 100;
};
MB.fitSize = (text, f, size, maxW, minK = 0.4, track) => {
  const w = MB.measure(text, f, size, track);
  if (w <= maxW || w <= 0) return size;
  return Math.max(size * minK, size * maxW / w);
};
const T = (text, font, size, color, x, y, align, name, extra) => Object.assign({ t: 'text', text: String(text), font, size, color, x, y, align: align || 'left', name }, extra || {});

/* ---------- vector shapes: path = [['M',x,y], ['L',x,y], ['C',x1,y1,x2,y2,x,y], ['Z']] (U) ---------- */
const KAPPA = 0.5523;
function corner(d, x0, y0, cx, cy, x1, y1, r) { // quarter round from (x0,y0) to (x1,y1) around the corner (cx,cy)
  d.push(['C', x0 + (cx - x0) * KAPPA, y0 + (cy - y0) * KAPPA, x1 + (cx - x1) * KAPPA, y1 + (cy - y1) * KAPPA, x1, y1]);
}
function bumps(d, px, py, qx, qy, n, b, nx, ny) { // n outward arcs from P to Q, bulging along (nx,ny)
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, ax = px + (qx - px) * t0, ay = py + (qy - py) * t0, bx = px + (qx - px) * t1, by = py + (qy - py) * t1;
    const k = b * (i % 2 ? 0.82 : 1) * 4 / 3;
    d.push(['C', ax + nx * k, ay + ny * k, bx + nx * k, by + ny * k, bx, by]);
  }
}
MB.shapePath = (kind, x, y, w, h, o = {}) => {
  const d = [];
  if (kind === 'cloud') {
    const b = Math.min(w, h) * (o.bump || 0.1), X0 = x + b, Y0 = y + b, X1 = x + w - b, Y1 = y + h - b, seg = b * 2.4;
    const nx = Math.max(2, Math.round((X1 - X0) / seg)), ny = Math.max(1, Math.round((Y1 - Y0) / seg));
    d.push(['M', X0, Y0]);
    bumps(d, X0, Y0, X1, Y0, nx, b, 0, -1); bumps(d, X1, Y0, X1, Y1, ny, b, 1, 0);
    bumps(d, X1, Y1, X0, Y1, nx, b, 0, 1); bumps(d, X0, Y1, X0, Y0, ny, b, -1, 0);
    d.push(['Z']);
  } else if (kind === 'ticket') {
    const rc = Math.min(o.r || 6, w / 4, h / 4), rn = Math.min(h * 0.07, w * 0.08, 16), ny = MB.clamp(o.notchY != null ? o.notchY : y + h / 2, y + rc + rn, y + h - rc - rn);
    d.push(['M', x + rc, y], ['L', x + w - rc, y]); corner(d, x + w - rc, y, x + w, y, x + w, y + rc, rc);
    d.push(['L', x + w, ny - rn], ['C', x + w - rn * 1.33, ny - rn, x + w - rn * 1.33, ny + rn, x + w, ny + rn], ['L', x + w, y + h - rc]);
    corner(d, x + w, y + h - rc, x + w, y + h, x + w - rc, y + h, rc);
    d.push(['L', x + rc, y + h]); corner(d, x + rc, y + h, x, y + h, x, y + h - rc, rc);
    d.push(['L', x, ny + rn], ['C', x + rn * 1.33, ny + rn, x + rn * 1.33, ny - rn, x, ny - rn], ['L', x, y + rc]);
    corner(d, x, y + rc, x, y, x + rc, y, rc); d.push(['Z']);
  } else if (kind === 'cut') {
    const c = Math.min(o.cut || Math.min(w, h) * 0.08, w / 3, h / 3);
    d.push(['M', x + c, y], ['L', x + w - c, y], ['L', x + w, y + c], ['L', x + w, y + h - c], ['L', x + w - c, y + h], ['L', x + c, y + h], ['L', x, y + h - c], ['L', x, y + c], ['Z']);
  } else if (kind === 'ribbon') {
    const n = h * 0.32;
    d.push(['M', x, y], ['L', x + w, y], ['L', x + w - n, y + h / 2], ['L', x + w, y + h], ['L', x, y + h], ['L', x + n, y + h / 2], ['Z']);
  } else if (kind === 'starburst') {
    const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2, N = o.points || 18, ri = R * 0.84;
    for (let i = 0; i < N * 2; i++) { const a = Math.PI * i / N - Math.PI / 2, r = i % 2 ? ri : R; d.push([i ? 'L' : 'M', cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    d.push(['Z']);
  } else if (kind === 'hangtag') {
    const p = h * 0.42, r = h * 0.2;
    d.push(['M', x, y + h / 2], ['L', x + p, y], ['L', x + w - r, y]); corner(d, x + w - r, y, x + w, y, x + w, y + r, r);
    d.push(['L', x + w, y + h - r]); corner(d, x + w, y + h - r, x + w, y + h, x + w - r, y + h, r);
    d.push(['L', x + p, y + h], ['Z']);
  }
  return d;
};
const pathPrim = (name, d, x, y, w, h, style) => Object.assign({ t: 'path', name, d, x, y, w, h }, style);
MB.CARD_SHAPES = [['rounded', 'มุมโค้ง'], ['cloud', 'ก้อนเมฆ'], ['ticket', 'ตั๋ว (มีรอยบาก)'], ['polaroid', 'กรอบโพลารอยด์'], ['cut', 'มุมตัด']];
MB.TAG_SHAPES = [['none', 'ไม่มีป้าย'], ['pill', 'แคปซูล'], ['ribbon', 'ริบบิ้น'], ['starburst', 'ดาวแตก'], ['hangtag', 'แท็กห้อย'], ['stamp', 'ตราปั๊ม']];
/* price tag of the given shape; returns its size so the header can make room */
const vecShape = (shape) => { const s = String(shape || ''); return s.startsWith('vec:') && MB.assets[s.slice(4)] ? s.slice(4) : null; };
function priceTagSize(shape, tw, ps) {
  const vid = vecShape(shape);
  if (vid) { const ph = ps * 1.75; return { pw: Math.max(tw * 1.18 + ps * 2.0, ph * MB.vecAspect(vid)), ph }; } // AI tags keep decorations near their edges
  if (shape === 'none') return { pw: tw + ps * 0.1, ph: ps * 1.3 };
  if (shape === 'ribbon') return { pw: tw + ps * 1.6, ph: ps * 1.45 };
  if (shape === 'hangtag') return { pw: tw + ps * 1.0 + ps * 1.45 * 0.42, ph: ps * 1.45 };
  if (shape === 'starburst') { const d = Math.max(ps * 2.0, tw * 1.02 + ps * 0.5); return { pw: d, ph: d }; }
  if (shape === 'stamp') return { pw: tw + ps * 1.2, ph: ps * 1.7 };
  return { pw: tw + ps * 0.95, ph: ps * 1.42 };
}
function priceTagPrims(shape, price, pf, ps, x, y, pw, ph, out) {
  const cx = x + pw / 2, cy = y + ph / 2, base = ps * 0.36, vid = vecShape(shape);
  if (vid) {
    out.push({ t: 'group', name: 'Price Tag', children: MB.vecPrims(vid, x, y, pw, ph, { recolor: pf.vecRecolor === false ? 'none' : 'main', color: pf.fill, name: 'Price Tag' }) });
    out.push(T(price, pf.font, ps, pf.color, cx, cy + base, 'center', 'Price'));
    return;
  }
  if (shape === 'none') { // price text only, in the tag colour (no backing)
    out.push(T(price, pf.font, ps, pf.fill, cx, cy + base, 'center', 'Price'));
  } else if (shape === 'ribbon') {
    out.push(pathPrim('Price Tag', MB.shapePath('ribbon', x, y, pw, ph), x, y, pw, ph, { fill: pf.fill, op: 1 }));
    out.push(T(price, pf.font, ps, pf.color, cx, cy + base, 'center', 'Price'));
  } else if (shape === 'hangtag') {
    out.push(pathPrim('Price Tag', MB.shapePath('hangtag', x, y, pw, ph), x, y, pw, ph, { fill: pf.fill, op: 1 }));
    const hr = ph * 0.11; out.push({ t: 'rect', name: 'Price Tag hole', x: x + ph * 0.3 - hr, y: cy - hr, w: hr * 2, h: hr * 2, r: hr, fill: '#FFFFFF', op: 1 });
    out.push(T(price, pf.font, ps, pf.color, x + ph * 0.21 + pw / 2, cy + base, 'center', 'Price'));
  } else if (shape === 'starburst') {
    out.push(pathPrim('Price Tag', MB.shapePath('starburst', x, y, pw, ph), x, y, pw, ph, { fill: pf.fill, op: 1 }));
    out.push(T(price, pf.font, ps, pf.color, cx, cy + base, 'center', 'Price', { rot: -8, cx, cy }));
  } else if (shape === 'stamp') {
    const sw = ps * 0.11, inset = ps * 0.2;
    out.push({ t: 'rect', name: 'Price Stamp', x, y, w: pw, h: ph, r: ps * 0.18, fill: null, stroke: pf.fill, sw, op: 1, rot: -6 });
    out.push({ t: 'rect', name: 'Price Stamp inner', x: x + inset, y: y + inset, w: pw - inset * 2, h: ph - inset * 2, r: ps * 0.1, fill: null, stroke: pf.fill, sw: sw * 0.5, op: 1, rot: -6 });
    out.push(T(price, pf.font, ps, pf.fill, cx, cy + base, 'center', 'Price', { rot: -6, cx, cy }));
  } else {
    out.push({ t: 'rect', name: 'Price Tag', x, y, w: pw, h: ph, r: ph / 2, fill: pf.fill, op: 1 });
    out.push(T(price, pf.font, ps, pf.color, cx, cy + base, 'center', 'Price'));
  }
}

MB.shapeTag = (kind, pf, out, x, y, w, h) => {
  const ps = h / 1.6; let pw = w, ph = kind === 'starburst' ? h + 4 : h * 0.8;
  if (kind === 'starburst') pw = ph;
  priceTagPrims(kind, '390', Object.assign({}, pf), ps, x + (w - pw) / 2, y + (h - ph) / 2, pw, ph, out);
};
MB.shapePanel = (th, x, y, w, h) => panelPrims(th, x, y, w, h, y + h * 0.35, y + h * 0.85, 4);

/* ---------- card header: title (multi-line), price, status tag, note ---------- */
const splitLines = (t) => String(t || '').replace(/\r/g, '').split('\n');
const widest = (lines, f, size, tk) => Math.max(0, ...lines.map(l => MB.measure(l, f, size, tk)));
const fitLines = (lines, f, size, maxW, tk) => Math.min(...lines.map(l => MB.fitSize(l || ' ', f, size, maxW, 0.4, tk)));
function tagPrims(text, tg, x, y, align, out) { // status pill (PRE-ORDER, DAY 2 ONLY…)
  const s = tg.size, w = MB.measure(text, tg.font, s) + s * 0.9, h = s * 1.45, bx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  out.push({ t: 'rect', name: 'Status Tag', x: bx, y, w, h, r: tg.radius != null ? Math.min(tg.radius, h / 2) : h / 2, fill: tg.fill, op: 1 });
  out.push(T(text, tg.font, s, tg.color, bx + w / 2, y + h / 2 + s * 0.36, 'center', 'Status'));
  return { w, h };
}
function headerBlock(c, th, x, w, y0, out) {
  const tf = th.title, pf = th.price, nf = th.note, tg = th.tag, al = th.align;
  const raw = (tf.upper ? String(c.name || '').toUpperCase() : String(c.name || '')).replace(/\r/g, '');
  let lines = splitLines(raw).map((l, i) => (i === 0 ? (th.bullet || '') : '') + l), title = lines.join('\n'), n = lines.length;
  const tfx = MB.fxActive(tf.fx) ? { fx: tf.fx, track: tf.fx.track || 0 } : null, tk = tfx ? tfx.track : 0;
  const wrapTo = (maxW) => { // word-wrap lines that would otherwise shrink below ~80 % (max 3 lines)
    const sz = tf.size * 0.8, out = [];
    lines.forEach(l => {
      if (MB.measure(l, tf.font, sz, tk) <= maxW || !/\s/.test(l.trim())) { out.push(l); return; }
      let cur = '';
      l.split(/\s+/).forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (cur && MB.measure(t, tf.font, sz, tk) > maxW) { out.push(cur); cur = wd; } else cur = t; });
      if (cur) out.push(cur);
    });
    if (out.length <= Math.max(3, lines.length)) { lines = out; title = lines.join('\n'); n = lines.length; }
  };
  /* ornaments (vector symbols) before / after the title and the price */
  const O = Object.assign({ size: 0.85, gap: 0.3 }, th.orn || {});
  const vOK = (id) => id && MB.assets[id] && MB.assets[id].vec ? id : null;
  const tPre = vOK(O.titlePre), tPost = vOK(O.titlePost), pPre = vOK(O.pricePre), pPost = vOK(O.pricePost);
  const oW = (id, sz) => id ? sz * O.size * MB.vecAspect(id) : 0;
  const oRes = (pre, post, sz) => oW(pre, sz) + oW(post, sz) + ((pre ? 1 : 0) + (post ? 1 : 0)) * sz * O.gap;
  const shiftL = (id, sz) => id ? oW(id, sz) + sz * O.gap : 0;
  const ornPrim = (id, xL, cy, sz, color, name) => { const hh = sz * O.size, ww = hh * MB.vecAspect(id); return { t: 'group', name, children: MB.vecPrims(id, xL, cy - hh / 2, ww, hh, { style: O.style || (O.mono ? 'mono' : 'original'), color, color2: '#FFFFFF', ow: 0.08, name }) }; };
  const decorate = (tp, pre, post, firstW, lastW, label) => {
    if (!tp || (!pre && !post)) return;
    const sz = tp.size, nl = String(tp.text).split('\n').length, c1 = tp.y - sz * 0.36, cN = c1 + (nl - 1) * sz * (tp.lh || 1.15), g = sz * O.gap;
    const left = (lw) => tp.align === 'center' ? tp.x - lw / 2 : tp.align === 'right' ? tp.x - lw : tp.x;
    if (pre) out.push(ornPrim(pre, left(firstW) - g - oW(pre, sz), c1, sz, tp.color, label + ' ornament before'));
    if (post) out.push(ornPrim(post, left(lastW) + lastW + g, cN, sz, tp.color, label + ' ornament after'));
  };
  const lw = (i, ts) => MB.measure(lines[i], tf.font, ts, tk);
  const price = MB.fmtPrice(c.price, pf.format), status = String(c.status || '').trim();
  const TLH = 1.15; // title line spacing
  let h = 0, lineW = 0, warn = false, tagBottom = 0;
  const titleH = (ts) => ts * 1.3 + (n - 1) * ts * TLH;
  if (price && th.priceMode === 'pill') {
    const ps = pf.size, shape = pf.shape || 'pill', ptw = MB.measure(price, pf.font, ps);
    const { pw, ph } = priceTagSize(shape, ptw + oRes(pPre, pPost, ps), ps);
    const R = w - pw - tf.size * 0.4, maxT = R - oRes(tPre, tPost, tf.size);
    wrapTo(maxT);
    const ts = fitLines(lines, tf.font, tf.size, maxT, tk); warn = ts < tf.size * 0.7;
    const tH = titleH(ts), lineH = Math.max(tH, ph);
    const c1 = y0 + (lineH - tH) / 2 + ts * 0.65; // centre of the first title line
    const tp = T(title, tf.font, ts, tf.color, al === 'center' ? x + R / 2 : x + shiftL(tPre, ts), c1 + ts * 0.36, al === 'center' ? 'center' : 'left', 'Title', Object.assign({ lh: TLH }, tfx));
    out.push(tp); decorate(tp, tPre, tPost, lw(0, ts), lw(n - 1, ts), 'Title');
    const py = Math.max(y0, c1 - ph / 2);
    priceTagPrims(shape, price, pf, ps, x + w - pw, py, pw, ph, out);
    if (pPre || pPost) { // keep "◆ 290.- ◆" centred in the tag
      const pp = out.filter(p => p.name === 'Price').pop();
      if (pp) { pp.x += (shiftL(pPre, ps) - shiftL(pPost, ps)) / 2; decorate(pp, pPre, pPost, ptw, ptw, 'Price'); }
    }
    h = lineH;
    if (status) { const r = tagPrims(status, tg, x + w, py + ph + tg.size * 0.3, 'right', out); tagBottom = py + ph + tg.size * 0.3 + r.h - y0; }
    lineW = w;
  } else if (price && th.priceMode === 'below') {
    const maxT = w - oRes(tPre, tPost, tf.size);
    wrapTo(maxT);
    const ts = fitLines(lines, tf.font, tf.size, maxT, tk); warn = ts < tf.size * 0.7;
    const aa = al === 'center' ? 'center' : 'left';
    const tp = T(title, tf.font, ts, tf.color, al === 'center' ? x + w / 2 : x + shiftL(tPre, ts), y0 + ts * 0.95, aa, 'Title', Object.assign({ lh: TLH }, tfx));
    out.push(tp); decorate(tp, tPre, tPost, lw(0, ts), lw(n - 1, ts), 'Title');
    const ps = MB.fitSize(price, pf.font, pf.size, w - oRes(pPre, pPost, pf.size)), pyb = y0 + titleH(ts) - ts * 0.05 + ps * 0.95, ptw = MB.measure(price, pf.font, ps);
    const pp = T(price, pf.font, ps, pf.fill, al === 'center' ? x + w / 2 + (shiftL(pPre, ps) - shiftL(pPost, ps)) / 2 : x + shiftL(pPre, ps), pyb, aa, 'Price');
    out.push(pp); decorate(pp, pPre, pPost, ptw, ptw, 'Price');
    h = titleH(ts) + ps * 1.25;
    lineW = Math.max(widest(lines, tf.font, ts, tk), ptw);
  } else { // price follows the last title line
    const gap = price ? tf.size * 0.7 : 0, pw = price ? MB.measure(price, pf.font, pf.size) : 0, pRes = price ? oRes(pPre, pPost, pf.size) : 0, tRes = oRes(tPre, tPost, tf.size);
    wrapTo(w - (gap + pw + pRes) * 0.8 - tRes);
    const head = lines.slice(0, -1), lastW = lw(n - 1, tf.size) + gap + pw + pRes + tRes;
    const blockW = Math.max(widest(head, tf.font, tf.size, tk) + tRes, lastW);
    const k = Math.min(1, w / (blockW || 1)); warn = k < 0.7;
    const ts = tf.size * k, ps = pf.size * k, big = Math.max(ts, ps * (n === 1 ? 1 : 0));
    const sx = al === 'center' ? x + (w - blockW * k) / 2 : x;
    const bl = y0 + Math.max(ts, big) * 0.65 + Math.max(ts, big) * 0.36;
    const tp = T(title, tf.font, ts, tf.color, sx + shiftL(tPre, ts), bl, 'left', 'Title', Object.assign({ lh: TLH }, tfx));
    out.push(tp); decorate(tp, tPre, tPost, lw(0, ts), lw(n - 1, ts), 'Title');
    const lastBl = bl + (n - 1) * ts * TLH;
    if (price) {
      const px = tp.x + lw(n - 1, ts) + shiftL(tPost, ts) + gap * k + shiftL(pPre, ps);
      const pp = T(price, pf.font, ps, pf.fill, px, lastBl, 'left', 'Price');
      out.push(pp); decorate(pp, pPre, pPost, pw * k, pw * k, 'Price');
    }
    h = Math.max(ts, big) * 1.3 + (n - 1) * ts * TLH; lineW = blockW * k;
  }
  if (status && !(price && th.priceMode === 'pill')) {
    const r = tagPrims(status, tg, al === 'center' ? x + w / 2 : x, y0 + h + tg.size * 0.15, al === 'center' ? 'center' : 'left', out);
    h += r.h + tg.size * 0.3; lineW = Math.max(lineW, r.w);
  }
  if (c.note) {
    const nl = splitLines(c.note), ns = fitLines(nl, nf.font, nf.size, w), NLH = 1.25;
    out.push(T(nl.join('\n'), nf.font, ns, nf.color, al === 'center' ? x + w / 2 : x, y0 + h + ns * 0.95, al === 'center' ? 'center' : 'left', 'Note', { lh: NLH }));
    h += ns * 1.3 + (nl.length - 1) * ns * NLH;
    lineW = Math.max(lineW, widest(nl, nf.font, ns));
  }
  h = Math.max(h, tagBottom); // the status tag sits beside the note, under the price
  return { h, lineW, warn };
}
/* conditions / terms: small multi-line text block */
function termsBlock(c, th, x, w) {
  const tm = th.terms, lines = splitLines(c.terms).filter((l, i, a) => l || i < a.length - 1);
  if (!String(c.terms || '').trim()) return null;
  const s = fitLines(lines, tm.font, tm.size, w), LH = 1.3;
  return { h: s * 1.25 + (lines.length - 1) * s * LH, draw: (y, out) => out.push(T(lines.join('\n'), tm.font, s, tm.color, th.align === 'center' ? x + w / 2 : x, y + s * 0.95, th.align === 'center' ? 'center' : 'left', 'Conditions', { lh: LH })) };
}

/* ---------- variant images grid ---------- */
function imagesBlock(c, th, x, y, w, h, out, capH) {
  const vs = c.variants || [];
  if (!vs.length || w <= 2 || h <= 2) { out.push({ t: 'ph', x, y, w: Math.max(w, 2), h: Math.max(h, 2), label: 'วางรูปสินค้า', card: c.id }); return 0; }
  const n = vs.length, g = th.imgGap, showB = th.badge.on && n > 1 && !c.noBadge;
  const bs = th.badge.size, bd = bs * 1.45, ss = th.sub.size;
  const hasSub = !c.noSub && vs.some(v => v.sub);
  const subBelow = th.subPos === 'below';
  const subL = hasSub ? Math.max(...vs.map(v => splitLines(v.sub).length)) : 0, subH = hasSub ? ss * (1.5 + 1.2 * (subL - 1)) : 0;
  const vps = th.price.size * 0.78, hasVP = vs.some(v => v.price !== '' && v.price != null), vpH = hasVP ? vps * 1.45 : 0;
  const topH = (showB ? bd + bs * 0.35 : 0) + (hasSub && !subBelow ? subH : 0), botH = (hasSub && subBelow ? subH : 0) + vpH;
  const asp = vs.map(v => { const a = MB.assets[v.asset]; return a && a.w ? a.w / a.h : 0.8; });
  let best = null;
  const r0 = c.rows > 0 ? Math.min(c.rows, n) : 1, r1 = c.rows > 0 ? r0 : n;
  for (let r = r0; r <= r1; r++) {
    const cols = Math.ceil(n / r), cw = (w - (cols - 1) * g) / cols, ch = (h - (r - 1) * g) / r - topH - botH;
    if (cw <= 1 || ch <= 1) continue;
    let area = 0;
    asp.forEach(a => { const fw = Math.min(cw, ch * a); area += fw * fw / a; });
    if (!best || area > best.area * 1.0001) best = { r, cols, cw, ch, area };
  }
  if (!best) best = { r: 1, cols: n, cw: Math.max(1, (w - (n - 1) * g) / n), ch: Math.max(1, h - topH - botH) };
  const { r, cols, cw, ch } = best, sc = c.imgScale || 1, nm = String(c.name || 'item').replace(/\s*\n\s*/g, ' ');
  let i = 0, natural = 0;
  for (let ri = 0; ri < r; ri++) {
    const m = Math.min(cols, n - ri * cols); if (m <= 0) break;
    const used = m * cw + (m - 1) * g, sx = x + (w - used) / 2, cy = y + ri * (ch + topH + botH + g);
    const prices = []; // per-variant prices of this row, grouped below
    for (let ci = 0; ci < m; ci++, i++) {
      const v = vs[i], a = asp[i], lab = v.label || MB.letter(i);
      let fw = Math.min(cw, ch * a) * sc, fh = fw / a;
      natural = Math.max(natural, fh);
      if (capH && fh > capH) { fh = capH; fw = fh * a; } // uniform image height across the page
      const icx = sx + ci * (cw + g) + cw / 2;
      const iy = th.imgAlign === 'bottom' ? cy + topH + ch - fh : cy + topH + (ch - fh) / 2;
      let ly = iy;
      const sl = splitLines(v.sub), subSize = v.sub ? fitLines(sl, th.sub.font, ss, cw + g * 0.8) : 0;
      let below = iy + fh;
      if (hasSub && subBelow) {
        if (v.sub && !c.noSub) out.push(T(sl.join('\n'), th.sub.font, subSize, th.sub.color, icx, below + ss * 1.15, 'center', 'Label ' + lab, { lh: 1.2 }));
        below += subH;
      } else if (hasSub) {
        if (v.sub && !c.noSub) out.push(T(sl.join('\n'), th.sub.font, subSize, th.sub.color, icx, ly - ss * 0.45 - (sl.length - 1) * subSize * 1.2, 'center', 'Label ' + lab, { lh: 1.2 }));
        ly -= subH;
      }
      if (v.price !== '' && v.price != null) prices.push({ price: String(v.price), x: icx, below, lab });
      if (showB) {
        const by = ly - bd - bs * 0.2;
        out.push({ t: 'rect', name: 'Badge ' + lab, x: icx - bd / 2, y: by, w: bd, h: bd, r: bd / 2, fill: th.badge.fill, op: 1 });
        out.push(T(lab, th.badge.font, bs, th.badge.color, icx, by + bd / 2 + bs * 0.36, 'center', 'Badge ' + lab + ' text'));
      }
      const z = v.zoom || 1, zw = fw * z, zh = fh * z, ix = icx - zw / 2 + (v.ox || 0), iy2 = iy + (fh - zh) / 2 + (v.oy || 0);
      if (v.asset && MB.assets[v.asset]) out.push({ t: 'img', name: nm + ' ' + lab, asset: v.asset, x: ix, y: iy2, w: zw, h: zh, card: c.id, vid: v.id });
      else out.push({ t: 'ph', x: ix, y: iy2, w: zw, h: zh, label: lab, card: c.id, vid: v.id });
    }
    // one price label per run of neighbouring designs with the same price (KEYCAP A–C 290 · D 490)
    for (let k = 0; k < prices.length;) {
      let e = k; while (e + 1 < prices.length && prices[e + 1].price === prices[k].price) e++;
      const ptx = MB.fmtPrice(prices[k].price, th.price.format), span = prices[e].x - prices[k].x + cw;
      out.push(T(ptx, th.price.font, MB.fitSize(ptx, th.price.font, vps, span + g * 0.8), th.price.fill, (prices[k].x + prices[e].x) / 2,
        Math.max(...prices.slice(k, e + 1).map(q => q.below)) + vps * 1.1, 'center', 'Price ' + prices[k].lab + (e > k ? '-' + prices[e].lab : '')));
      k = e + 1;
    }
  }
  return natural;
}

/* per-card colour overrides (highlight one product) */
const CARD_STYLE_KEYS = { shape: ['panel', 'shape'], priceShape: ['price', 'shape'], fill: ['panel', 'fill'], opacity: ['panel', 'opacity'], stroke: ['panel', 'stroke'], strokeW: ['panel', 'strokeW'], titleColor: ['title', 'color'], priceFill: ['price', 'fill'], priceColor: ['price', 'color'], badgeFill: ['badge', 'fill'], barFill: ['bar', 'fill'] };
MB.CARD_STYLE_KEYS = CARD_STYLE_KEYS;
function cardTheme(c, th) {
  const st = c.style; if (!st || !Object.keys(st).length) return th;
  const t = Object.assign({}, th);
  Object.entries(CARD_STYLE_KEYS).forEach(([k, [grp, prop]]) => {
    if (st[k] == null || st[k] === '') return;
    t[grp] = Object.assign({}, t[grp], { [prop]: st[k] });
    if (k === 'fill' || k === 'opacity') t.panel.on = true;
  });
  return t;
}

function panelPrims(th, x, y, w, h, imgTop, imgBot, pad) {
  const P = th.panel, shape = P.shape || 'rounded', st = { fill: P.fill, op: P.opacity, stroke: P.strokeW > 0 ? P.stroke : null, sw: P.strokeW }, out = [];
  if (shape === 'cloud') out.push(pathPrim('Card BG', MB.shapePath('cloud', x, y, w, h, { bump: P.bump }), x, y, w, h, st));
  else if (shape === 'ticket') out.push(pathPrim('Card BG', MB.shapePath('ticket', x, y, w, h, { r: P.radius, notchY: th.titlePos === 'bottom' ? imgBot + pad * 0.25 : imgTop - pad * 0.3 }), x, y, w, h, st));
  else if (shape === 'cut') out.push(pathPrim('Card BG', MB.shapePath('cut', x, y, w, h, { cut: P.radius }), x, y, w, h, st));
  else if (shape === 'polaroid') {
    const r = Math.min(P.radius, 4), m = pad * 0.6;
    out.push({ t: 'rect', name: 'Card shadow', x: x + 1.5, y: y + 2.5, w, h, r, fill: '#000000', op: 0.12 });
    out.push(Object.assign({ t: 'rect', name: 'Card BG', x, y, w, h, r }, st));
    out.push({ t: 'rect', name: 'Photo window', x: x + m, y: imgTop - pad * 0.3, w: w - m * 2, h: imgBot - imgTop + pad * 0.6, r: 1, fill: P.inner || '#F1F1F1', op: 1 });
  } else out.push(Object.assign({ t: 'rect', name: 'Card BG', x, y, w, h, r: P.radius }, st));
  const g = P.glass;
  if (g && g.on) { // liquid glass: blurred backdrop under the card fill, sheen + rim light on top
    const card = out.find(p => p.name === 'Card BG'), clip = Object.assign({}, card, { rot: 0 }), i = out.indexOf(card);
    out.splice(i, 0, { t: 'glass', part: 'back', name: 'Glass Blur', x, y, w, h, clip, g });
    out.splice(i + 2, 0, { t: 'glass', part: 'shine', name: 'Glass Shine', x, y, w, h, clip, g });
  }
  return out;
}
MB.cardPrims = (c, th0, capH) => {
  const th = cardTheme(c, th0), out = [], { x, y, w, h } = c;
  const pad = th.pad + (th.panel.on && th.panel.shape === 'cloud' ? Math.min(w, h) * (th.panel.bump || 0.1) * 0.9 : 0);
  const hx = x + pad, hw = Math.max(4, w - 2 * pad), txt = [];
  let imgTop, imgBot, hb, barY, barH;
  if (th.titlePos === 'bottom') {
    const probe = headerBlock(c, th, hx, hw, 0, []);
    barH = probe.h + pad * 0.9; barY = y + h - barH;
    hb = headerBlock(c, th, hx, hw, barY + pad * 0.45, txt);
    imgTop = y + pad; imgBot = barY - pad * 0.5;
  } else {
    hb = headerBlock(c, th, hx, hw, y + pad, txt);
    barY = y + pad * 0.55; barH = hb.h + pad * 0.9;
    imgTop = y + pad + hb.h + pad * 0.6; imgBot = y + h - pad;
  }
  if (th.bar.mode === 'full') out.push({ t: 'rect', name: 'Label Bar', x, y: barY, w, h: barH, r: th.bar.radius, fill: th.bar.fill, op: th.bar.opacity });
  else if (th.bar.mode === 'fit') {
    const bw = Math.min(w, hb.lineW + pad * 1.2), bx = th.align === 'center' ? x + (w - bw) / 2 : hx - pad * 0.6;
    out.push({ t: 'rect', name: 'Label Tag', x: bx, y: barY, w: bw, h: barH, r: th.bar.radius, fill: th.bar.fill, op: th.bar.opacity });
  }
  out.push(...txt);
  const tb = termsBlock(c, th, hx, hw);
  if (tb && th.terms.pos === 'top') { tb.draw(imgTop - pad * 0.2, out); imgTop += tb.h + pad * 0.4; }
  else if (tb) { imgBot -= tb.h + pad * 0.5; tb.draw(imgBot + pad * 0.5, out); }
  const imgH = imagesBlock(c, th, x + pad, imgTop, w - 2 * pad, imgBot - imgTop, out, capH);
  if (th.panel.on) out.unshift(...panelPrims(th, x, y, w, h, imgTop, imgBot, pad));
  return { prims: out, warn: hb.warn, imgH };
};

/* ---------- free elements ---------- */
MB.textBox = (e) => {
  const lines = String(e.text || ' ').split('\n');
  const tk = e.fx ? e.fx.track || 0 : 0;
  const w = Math.max(...lines.map(l => MB.measure(l || ' ', e.font, e.size, tk)), e.size * 0.3);
  const h = e.size * (1.2 + (e.lh || 1.15) * (lines.length - 1));
  const x = e.align === 'center' ? e.x - w / 2 : e.align === 'right' ? e.x - w : e.x;
  return { x, y: e.y, w, h };
};
function elementPrim(e) {
  if (e.type === 'vector') {
    if (!MB.assets[e.asset]) return null;
    return { prim: { t: 'group', name: e.name || 'Vector', children: MB.vecPrims(e.asset, e.x, e.y, e.w, e.h, { rot: e.rot || 0, op: e.op, style: e.vstyle || (e.recolor ? 'mono' : 'original'), color: e.color, color2: e.color2, ow: e.ow, name: e.name }) }, box: { x: e.x, y: e.y, w: e.w, h: e.h } };
  }
  if (e.type === 'image') {
    if (!MB.assets[e.asset]) return null;
    return { prim: { t: 'img', name: e.name || 'Image', asset: e.asset, x: e.x, y: e.y, w: e.w, h: e.h, rot: e.rot || 0, op: e.op, fx: MB.fxActive(e.fx) ? e.fx : null }, box: { x: e.x, y: e.y, w: e.w, h: e.h } };
  }
  const b = MB.textBox(e);
  return {
    prim: T(e.text, e.font, e.size, e.color, e.x, e.y + e.size * 0.95, e.align, e.name || 'Text', { lh: e.lh || 1.15, rot: e.rot || 0, op: e.op, cx: b.x + b.w / 2, cy: b.y + b.h / 2,
      fx: MB.fxActive(e.fx) ? e.fx : null, track: e.fx ? e.fx.track || 0 : 0 }),
    box: b,
  };
}

/* ---------- footer (label/company logos) ---------- */
MB.footerTop = (st) => MB.pageGeom(st).HU - MB.pageGeom(st).bleedU - st.footer.h;
function footerPrims(st, G, hits) {
  const f = st.footer, out = [];
  if (!f.on) return out;
  const top = G.HU - G.bleedU - f.h;
  if (f.opacity > 0) out.push({ t: 'rect', name: 'Footer BG', x: 0, y: top, w: 1000, h: G.HU - top, r: 0, fill: f.fill, op: f.opacity });
  const items = f.logos.filter(l => MB.assets[l.asset]).map(l => {
    const a = MB.assets[l.asset], hh = f.h * 0.62 * (l.scale || 1), ww = hh * (a.w && a.h ? a.w / a.h : 1);
    return { l, ww, hh };
  });
  if (!items.length) return out;
  const m = st.layout.margin + G.bleedU, total = items.reduce((s, i) => s + i.ww, 0);
  let sx, gap = f.gap;
  if (f.align === 'left') sx = m;
  else if (f.align === 'right') sx = 1000 - m - total - gap * (items.length - 1);
  else if (f.align === 'spread' && items.length > 1) { gap = (1000 - 2 * m - total) / (items.length - 1); sx = m; }
  else sx = (1000 - total - gap * (items.length - 1)) / 2;
  items.forEach(it => {
    const x = sx + (it.l.dx || 0), y = top + f.h / 2 - it.hh / 2 + (it.l.dy || 0);
    out.push({ t: 'img', name: 'Logo ' + (MB.assets[it.l.asset].name || ''), asset: it.l.asset, x, y, w: it.ww, h: it.hh });
    hits.push({ kind: 'flogo', id: it.l.id, x, y, w: it.ww, h: it.hh, rot: 0 });
    sx += it.ww + gap;
  });
  return out;
}

function bgPrims(st, G) {
  const out = [{ t: 'rect', name: 'BG Color', x: 0, y: 0, w: 1000, h: G.HU, r: 0, fill: st.bg.color, op: 1 }];
  const a = MB.assets[st.bg.asset];
  if (a && a.w) {
    const pa = 1000 / G.HU, ia = a.w / a.h;
    let w = 1000, h = G.HU;
    if (st.bg.fit === 'cover') { if (ia > pa) w = h * ia; else h = w / ia; }
    else if (st.bg.fit === 'contain') { if (ia > pa) h = w / ia; else w = h * ia; }
    out.push({ t: 'img', name: 'BG Image', asset: a.id, x: (1000 - w) / 2, y: (G.HU - h) / 2, w, h, op: st.bg.opacity });
  }
  return out;
}

/* full scene. hits are ordered top-most first */
MB.buildScene = (st, pid) => {
  pid = pid || st.curPage;
  const G = MB.pageGeom(st), hits = [], warns = {}, imgHits = [], cards = st.cards.filter(c => c.page === pid && !c.hidden);
  const groups = [{ t: 'group', name: 'Background', children: bgPrims(st, G) }];
  const behind = [], front = [], hitsBehind = [], hitsFront = [];
  st.elements.forEach(e => {
    if (!MB.onPage(e, pid) || e.hidden) return;
    const r = elementPrim(e); if (!r) return;
    (e.behind ? behind : front).push(r.prim);
    (e.behind ? hitsBehind : hitsFront).push(Object.assign({ kind: 'el', id: e.id, rot: e.rot || 0 }, r.box));
  });
  if (behind.length) groups.push({ t: 'group', name: 'Decor (behind)', children: behind });
  if (MB.layoutMode(st, pid) === 'shelf' && cards.length) groups.push({ t: 'group', name: 'Shelves', children: shelfPrims(st, cards) });
  // uniform image height: cap every card's images at the smallest card's natural image height
  let cap = 0;
  if (st.theme.uniformImg && cards.length > 1) cap = Math.min(...cards.map(c => MB.cardPrims(c, st.theme).imgH).filter(v => v > 0));
  const cardGroups = cards.map((c, i) => {
    const r = MB.cardPrims(c, st.theme, cap || 0);
    if (r.warn) warns[c.id] = 'ชื่อยาวเกิน — ตัวอักษรถูกย่อ';
    r.prims.forEach(p => { if ((p.t === 'img' || p.t === 'ph') && p.vid) imgHits.push({ card: c.id, vid: p.vid, x: p.x, y: p.y, w: p.w, h: p.h, rot: 0 }); });
    return { t: 'group', name: String(i + 1).padStart(2, '0') + ' ' + String(c.name || 'item').replace(/\s*\n\s*/g, ' ') + (c.price !== '' && c.price != null ? ' ' + c.price : ''), children: r.prims };
  });
  groups.push({ t: 'group', name: 'Products', children: cardGroups });
  const backdrop = groups.slice(0, -1); // what glass cards see through: BG, decor behind, shelves
  const feed = (l) => l.forEach(p => { if (p.t === 'group') feed(p.children); else if (p.t === 'glass') { p.src = backdrop; p.pageH = G.HU; } });
  feed(cardGroups);
  const fhits = [];
  const foot = footerPrims(st, G, fhits);
  if (foot.length) groups.push({ t: 'group', name: 'Footer Logos', children: foot });
  if (front.length) groups.push({ t: 'group', name: 'Logo & Text', children: front });
  hits.push(...hitsFront.reverse(), ...fhits.reverse());
  for (let i = cards.length - 1; i >= 0; i--) { const c = cards[i]; hits.push({ kind: 'card', id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, rot: 0 }); }
  hits.push(...hitsBehind.reverse());
  return { groups, hits, warns, G, imgHits: imgHits.reverse() };
};
/* wooden shelf under every row of cards (shelf layout) */
function shelfPrims(st, cards) {
  const A = MB.contentArea(st), L = st.layout, th = L.shelfH || 10, out = [], rows = new Map();
  cards.forEach(c => { const k = Math.round(c.y + c.h); rows.set(k, rows.has(k) ? rows.get(k) : c.y + c.h); });
  [...rows.values()].sort((a, b) => a - b).forEach((yb, i) => {
    out.push({ t: 'rect', name: 'Shelf ' + (i + 1), x: A.x0 - 6, y: yb, w: A.W + 12, h: th, r: 1.5, fill: L.shelfColor || '#8B5E3C', op: 1 });
    out.push({ t: 'rect', name: 'Shelf ' + (i + 1) + ' edge', x: A.x0 - 6, y: yb + th * 0.62, w: A.W + 12, h: th * 0.38, r: 1, fill: '#000000', op: 0.22 });
  });
  return out;
}

/* ---------- auto layout ---------- */
MB.contentArea = (st) => {
  const G = MB.pageGeom(st), L = st.layout, b = G.bleedU;
  const x0 = b + L.margin, x1 = 1000 - b - L.margin, y0 = b + L.top;
  const y1 = G.HU - b - (st.footer.on ? st.footer.h : 0) - L.margin * (st.footer.on ? 0.3 : 1);
  return { x0, y0, x1, y1, W: x1 - x0, H: y1 - y0 };
};
MB.LAYOUT_MODES = [
  ['justified', 'อัตโนมัติตามจำนวนแบบ'], ['grid', 'ตาราง (ช่องเท่ากัน)'], ['bento', 'Bento (กำหนดช่องกว้าง×สูงได้)'],
  ['hero', 'Hero (การ์ดเด่น 1 ใบใหญ่)'], ['shelf', 'ชั้นวาง (แถวสูงเท่ากัน + ชั้นไม้)'], ['masonry', 'Masonry (คอลัมน์ต่อลงล่าง)'],
];
MB.layoutMode = (st, pid) => { const p = MB.pageOf(st, pid); return (p && p.mode) || st.layout.mode || 'justified'; };
MB.layoutCols = (st, pid) => { const p = MB.pageOf(st, pid); return Math.max(1, (p && p.cols) || st.layout.cols || 3); };
/* candidate card shapes (w/h) for this card: its images laid out in 1…4 rows, plus the header strip */
function idealAspects(c) {
  const n = Math.max(1, c.variants.length);
  const as = c.variants.map(v => { const a = MB.assets[v.asset]; return a && a.w ? a.w / a.h : 0.8; });
  const a = as.reduce((s, v) => s + v, 0) / as.length || 0.8, out = [];
  for (let r = 1; r <= Math.min(n, 4); r++) out.push(Math.max(0.55, Math.ceil(n / r) * a / r * 0.78));
  return out;
}
const loadOf = (c) => Math.pow(Math.max(1, c.variants.length), 0.6) * (c.weight || 1);
const shapeCost = (c, asp) => Math.min(...idealAspects(c).map(id => Math.pow(Math.log(asp / id), 2)));

/* justified rows: each card's AREA follows its load, rows chosen by DP so each card's shape is close to a natural image grid */
function layJustified(cards, R, g) {
  const n = cards.length, W = R.W, H = R.H, load = cards.map(loadOf), total = load.reduce((s, v) => s + v, 0);
  const rowCost = (i, j) => {
    let L = 0; for (let k = i; k < j; k++) L += load[k];
    const h = L * H / total; let cost = 0;
    for (let k = i; k < j; k++) cost += shapeCost(cards[k], (W * load[k] / L) / h);
    return cost + 0.15;
  };
  const best = [0], cut = [0];
  for (let j = 1; j <= n; j++) {
    best[j] = Infinity;
    for (let i = Math.max(0, j - 8); i < j; i++) { const v = best[i] + rowCost(i, j); if (v < best[j]) { best[j] = v; cut[j] = i; } }
  }
  const rows = []; for (let j = n; j > 0; j = cut[j]) rows.unshift([cut[j], j]);
  const kH = (H - g * (rows.length - 1)) / H;
  let y = R.y0;
  rows.forEach(([i, j]) => {
    let L = 0; for (let k = i; k < j; k++) L += load[k];
    const h = L * H / total * kH, avail = W - g * (j - i - 1);
    let x = R.x0;
    for (let k = i; k < j; k++) { const w = avail * load[k] / L; Object.assign(cards[k], { x, y, w, h }); x += w + g; }
    y += h + g;
  });
}
function layGrid(cards, R, g, cols) {
  const n = cards.length; cols = MB.clamp(cols | 0, 1, n);
  const rows = Math.ceil(n / cols), cw = (R.W - (cols - 1) * g) / cols, ch = (R.H - (rows - 1) * g) / rows;
  cards.forEach((c, i) => {
    const r = Math.floor(i / cols), m = Math.min(cols, n - r * cols), off = (R.W - (m * cw + (m - 1) * g)) / 2;
    Object.assign(c, { x: R.x0 + off + (i % cols) * (cw + g), y: R.y0 + r * (ch + g), w: cw, h: ch });
  });
}
/* bento: cols-column grid, each card spans spanC × spanR cells (0 = automatic from its number of designs) */
const bentoAuto = (c, C) => {
  const n = c.variants.length;
  let sc = n >= 9 ? C : n >= 5 ? Math.ceil(C * 0.67) : n >= 3 ? Math.ceil(C / 2) : 1;
  if ((c.weight || 1) > 1.4) sc++;
  return { sc: MB.clamp(c.spanC > 0 ? c.spanC : sc, 1, C), sr: MB.clamp(c.spanR > 0 ? c.spanR : (n >= 10 ? 2 : 1), 1, 6) };
};
function layBento(cards, R, g, C) {
  const grid = [], place = [];
  const free = (r, c, sr, sc) => { for (let i = r; i < r + sr; i++) for (let j = c; j < c + sc; j++) if (grid[i] && grid[i][j]) return false; return true; };
  const mark = (r, c, sr, sc, v) => { for (let i = r; i < r + sr; i++) { grid[i] = grid[i] || []; for (let j = c; j < c + sc; j++) grid[i][j] = v; } };
  cards.forEach(card => {
    const { sc, sr } = bentoAuto(card, C);
    for (let r = 0; ; r++) { let done = false; for (let c = 0; c + sc <= C; c++) if (free(r, c, sr, sc)) { mark(r, c, sr, sc, card); place.push({ card, r, c, sr, sc }); done = true; break; } if (done) break; }
  });
  // stretch cards sideways into empty cells so rows have no holes
  place.forEach(p => { while (p.c + p.sc < C && free(p.r, p.c + p.sc, p.sr, 1)) { mark(p.r, p.c + p.sc, p.sr, 1, p.card); p.sc++; } });
  const rows = grid.length, cw = (R.W - g * (C - 1)) / C, rh = (R.H - g * (rows - 1)) / rows;
  place.forEach(p => Object.assign(p.card, { x: R.x0 + p.c * (cw + g), y: R.y0 + p.r * (rh + g), w: p.sc * cw + (p.sc - 1) * g, h: p.sr * rh + (p.sr - 1) * g }));
}
MB.bentoSpanFromSize = (st, card) => {
  const C = MB.layoutCols(st, card.page), A = MB.contentArea(st), g = st.layout.gap, cw = (A.W - g * (C - 1)) / C;
  const others = MB.pageCards(st, card.page).filter(c => c !== card && !c.hidden), minH = others.length ? Math.min(...others.map(c => c.h)) : card.h;
  card.spanC = MB.clamp(Math.round((card.w + g) / (cw + g)), 1, C);
  card.spanR = MB.clamp(Math.round((card.h + g) / (minH + g)), 1, 6);
};
function layHero(cards, R, g) {
  const hero = cards.find(c => c.hero) || cards[0], rest = cards.filter(c => c !== hero);
  if (!rest.length) { Object.assign(hero, { x: R.x0, y: R.y0, w: R.W, h: R.H }); return; }
  const landscape = R.W / R.H > 1.05, k = 0.56;
  if (landscape) {
    const hw = (R.W - g) * k;
    Object.assign(hero, { x: R.x0, y: R.y0, w: hw, h: R.H });
    layJustified(rest, { x0: R.x0 + hw + g, y0: R.y0, W: R.W - hw - g, H: R.H }, g);
  } else {
    const hh = (R.H - g) * k;
    Object.assign(hero, { x: R.x0, y: R.y0, w: R.W, h: hh });
    layJustified(rest, { x0: R.x0, y0: R.y0 + hh + g, W: R.W, H: R.H - hh - g }, g);
  }
}
/* shelf: equal-height rows (each row stands on a shelf plank), widths follow load */
function layShelf(cards, R, g, plank) {
  const n = cards.length, load = cards.map(loadOf);
  let best = null;
  for (let rowsN = 1; rowsN <= Math.min(n, 6); rowsN++) {
    const rowH = (R.H - g * (rowsN - 1)) / rowsN, h = rowH - plank;
    if (h <= 10) break;
    const cost = (i, j) => { let L = 0; for (let k = i; k < j; k++) L += load[k]; let c = 0; for (let k = i; k < j; k++) c += shapeCost(cards[k], (R.W * load[k] / L) / h); return c; };
    const dp = Array.from({ length: rowsN + 1 }, () => new Array(n + 1).fill(Infinity)), cut = Array.from({ length: rowsN + 1 }, () => new Array(n + 1).fill(0));
    dp[0][0] = 0;
    for (let r = 1; r <= rowsN; r++) for (let j = r; j <= n; j++) for (let i = r - 1; i < j; i++) { const v = dp[r - 1][i] + cost(i, j); if (v < dp[r][j]) { dp[r][j] = v; cut[r][j] = i; } }
    if (!best || dp[rowsN][n] < best.cost) { const rows = []; let j = n; for (let r = rowsN; r >= 1; r--) { const i = cut[r][j]; rows.unshift([i, j]); j = i; } best = { cost: dp[rowsN][n], rows, rowH, h }; }
  }
  let y = R.y0;
  best.rows.forEach(([i, j]) => {
    let L = 0; for (let k = i; k < j; k++) L += load[k];
    const avail = R.W - g * (j - i - 1); let x = R.x0;
    for (let k = i; k < j; k++) { const w = avail * load[k] / L; Object.assign(cards[k], { x, y, w, h: best.h }); x += w + g; }
    y += best.rowH + g;
  });
}
/* masonry: fixed columns, each card goes to the shortest column; columns are then stretched to the same bottom */
function layMasonry(cards, R, g, C) {
  C = MB.clamp(C | 0, 1, cards.length);
  const cw = (R.W - g * (C - 1)) / C, cols = Array.from({ length: C }, () => ({ h: 0, items: [] }));
  cards.forEach(c => {
    const ideal = idealAspects(c).reduce((a, b) => Math.abs(Math.log(b)) < Math.abs(Math.log(a)) ? b : a);
    const h = cw / ideal * Math.sqrt(c.weight || 1), col = cols.reduce((a, b) => b.h < a.h ? b : a);
    col.items.push({ c, h }); col.h += h + g;
  });
  cols.forEach((col, i) => {
    if (!col.items.length) return;
    const k = (R.H - g * (col.items.length - 1)) / col.items.reduce((s, it) => s + it.h, 0);
    let y = R.y0;
    col.items.forEach(it => { const h = it.h * k; Object.assign(it.c, { x: R.x0 + i * (cw + g), y, w: cw, h }); y += h + g; });
  });
}
MB.autoLayout = (st, pid) => {
  pid = pid || st.curPage;
  const cards = st.cards.filter(c => !c.locked && !c.hidden && c.page === pid);
  if (!cards.length) return;
  const A0 = MB.contentArea(st), g = st.layout.gap, mode = MB.layoutMode(st, pid), C = MB.layoutCols(st, pid);
  const R = { x0: A0.x0, y0: A0.y0, W: A0.W, H: A0.H };
  if (mode === 'grid') layGrid(cards, R, g, C);
  else if (mode === 'bento') layBento(cards, R, g, C);
  else if (mode === 'hero') layHero(cards, R, g);
  else if (mode === 'shelf') layShelf(cards, R, g, st.layout.shelfH || 10);
  else if (mode === 'masonry') layMasonry(cards, R, g, C);
  else layJustified(cards, R, g);
};

/* ---------- preflight ---------- */
MB.preflight = (st) => {
  const out = [];
  st.pages.forEach(pg => out.push(...preflightPage(st, pg.id).map(x => Object.assign(x, { page: pg.id, msg: (st.pages.length > 1 ? MB.pageLabel(st, pg.id) + ' — ' : '') + x.msg }))));
  if (!st.elements.some(e => e.type === 'image' && e.role === 'logo')) out.push({ lv: 'info', msg: 'ยังไม่ได้ใส่โลโก้งาน/คอน/ซีรีส์' });
  st.pages.forEach(pg => { if (!MB.pageCards(st, pg.id).length) out.push({ lv: 'info', msg: MB.pageLabel(st, pg.id) + ' ยังไม่มีสินค้า', page: pg.id }); });
  return out;
};
function preflightPage(st, pid) {
  const out = [], G = MB.pageGeom(st), sc = MB.buildScene(st, pid), cards = MB.pageCards(st, pid);
  const ix = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  cards.filter(c => !c.hidden).forEach((c, i) => {
    const nm = String(c.name || ('การ์ด ' + (i + 1))).replace(/\s*\n\s*/g, ' '), sel = { kind: 'card', id: c.id };
    if (!c.variants.length || c.variants.some(v => !v.asset)) out.push({ lv: 'warn', msg: `${nm}: ยังมีช่องที่ไม่ได้ใส่รูป (${c.variants.filter(v => !v.asset).length || 'ไม่มีรูป'})`, sel });
    if ((c.price === '' || c.price == null) && !c.variants.some(v => v.price)) out.push({ lv: 'warn', msg: `${nm}: ไม่มีราคา`, sel });
    if (sc.warns[c.id]) out.push({ lv: 'info', msg: `${nm}: ${sc.warns[c.id]}`, sel });
    if (c.x < -1 || c.y < -1 || c.x + c.w > 1001 || c.y + c.h > G.HU + 1) out.push({ lv: 'warn', msg: `${nm}: ล้นขอบกระดาษ`, sel });
    cards.slice(i + 1).forEach(d => { if (ix(c, d) > 40) out.push({ lv: 'warn', msg: `${nm} ทับกับ ${d.name}`, sel }); });
  });
  if (st.page.unit === 'mm') {
    const chk = (p) => {
      if (p.t === 'group') return p.children.forEach(chk);
      if (p.t !== 'img') return;
      const a = MB.assets[p.asset]; if (!a || !a.w) return;
      const inch = p.w * G.mmPerU / 25.4, dpi = a.w / inch;
      if (dpi < 150 && p.name !== 'BG Image') out.push({ lv: 'info', msg: `รูป "${a.name}" ความละเอียดต่ำ (~${Math.round(dpi)} dpi ที่ขนาดพิมพ์)` });
    };
    sc.groups.forEach(chk);
  }
  return out;
}

/* ---------- split cards over pages ----------
   load of a card ~ how much room it needs (a 14-design poster fills a page on its own) */
MB.cardLoad = (c) => Math.max(1, c.variants.length / 4);
MB.splitPages = (st, { perPage = 6, byCollection = true, onlyIds = null } = {}) => {
  const cards = onlyIds ? st.cards.filter(c => onlyIds.has(c.id)) : st.cards.slice();
  const groups = [], gi = {};
  cards.forEach(c => {
    const k = byCollection ? (c.collection || '') : '';
    if (gi[k] == null) { gi[k] = groups.length; groups.push({ name: k, cards: [] }); }
    groups[gi[k]].cards.push(c);
  });
  const keep = onlyIds ? st.pages.filter(p => st.cards.some(c => !onlyIds.has(c.id) && c.page === p.id)) : [];
  const pages = [];
  groups.forEach(g => {
    const total = g.cards.reduce((s, c) => s + MB.cardLoad(c), 0), nPages = Math.max(1, Math.ceil(total / perPage)), target = total / nPages;
    let cur = null, load = 0, made = 0;
    g.cards.forEach(c => {
      const l = MB.cardLoad(c);
      if (!cur || (load + l > target * 1.15 && load > 0 && made < nPages)) { cur = MB.newPage(g.name); pages.push(cur); load = 0; made++; }
      c.page = cur.id; load += l;
    });
  });
  // number pages that share a collection name: "DUANG GO ROUND 1/3"
  const byName = {}; pages.forEach(p => { (byName[p.name] = byName[p.name] || []).push(p); });
  Object.values(byName).forEach(list => { if (list.length > 1) list.forEach((p, i) => { p.name = `${p.name} ${i + 1}/${list.length}`.trim(); }); });
  st.pages = keep.concat(pages);
  if (!st.pages.length) st.pages = [MB.newPage()];
  st.curPage = (pages[0] || st.pages[0]).id;
  st.pages.forEach(p => MB.autoLayout(st, p.id));
  return pages.length;
};

})(window.MB);
