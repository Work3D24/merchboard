'use strict';
/* MerchBoard Studio — PSD / PSB written straight from the browser (ag-psd), no Photoshop needed.
   Every primitive becomes its own pixel layer (cropped to its content), scene groups become layer groups,
   plain text is also an editable type layer. Combined: one document, one artboard per page in a grid. */
(function (MB) {

const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const fxPad = (fx) => !fx ? 0 : ((fx.stroke && fx.stroke.on !== false && fx.stroke.w) || 0) + ((fx.shadow && fx.shadow.on !== false) ? (fx.shadow.dist || 0) + (fx.shadow.blur || 0) * 2 : 0)
  + ((fx.glow && fx.glow.on !== false && fx.glow.size) || 0) * 2 + ((fx.bevel && fx.bevel.on && fx.bevel.size) || 0);

/* rough box of a primitive in U (generous — the rendered pixels are trimmed afterwards) */
function boxOf(p, s, mctx) {
  let x0, y0, x1, y1;
  if (p.t === 'path') {
    x0 = y0 = Infinity; x1 = y1 = -Infinity;
    p.d.forEach(c => { for (let i = 1; i + 1 < c.length; i += 2) { x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]); y0 = Math.min(y0, c[i + 1]); y1 = Math.max(y1, c[i + 1]); } });
    if (!isFinite(x0)) return null;
  } else if (p.t === 'text') {
    const lines = String(p.text).split('\n'), lh = p.size * (p.lh || 1.15);
    mctx.font = MB.fontCss(p.font, p.size * s);
    const w = Math.max(...lines.map(l => mctx.measureText(l).width)) / s * 1.1 + Math.abs(p.track || 0) * p.size / 1000 * 40;
    x0 = p.align === 'center' ? p.x - w / 2 : p.align === 'right' || p.align === 'end' ? p.x - w : p.x; x1 = x0 + w;
    y0 = p.y - p.size * 1.2; y1 = p.y + (lines.length - 1) * lh + p.size * 0.5;
  } else { x0 = p.x; y0 = p.y; x1 = p.x + p.w; y1 = p.y + p.h; }
  if (p.rot) { // rotated corners around the same pivot drawPrims uses
    const cx = p.cx != null ? p.cx : (p.t === 'text' || p.t === 'path' ? (x0 + x1) / 2 : p.x + p.w / 2), cy = p.cy != null ? p.cy : (p.t === 'text' || p.t === 'path' ? (y0 + y1) / 2 : p.y + p.h / 2);
    const a = p.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), xs = [], ys = [];
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y]) => { xs.push(cx + (x - cx) * co - (y - cy) * si); ys.push(cy + (x - cx) * si + (y - cy) * co); });
    x0 = Math.min(...xs); x1 = Math.max(...xs); y0 = Math.min(...ys); y1 = Math.max(...ys);
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.12 + fxPad(p.fx) + (p.sw || 0) + (p.t === 'text' ? p.size * 0.3 : 0) + 4 / s;
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}
/* draw prims (opacity left to the layer) into a canvas cropped to their box, then trim to the visible pixels */
function rasterize(prims, s, pageH) {
  const m = mkCanvas(1, 1).getContext('2d');
  let b = null;
  prims.forEach(p => { const q = boxOf(p, s, m); if (q) b = b ? { x0: Math.min(b.x0, q.x0), y0: Math.min(b.y0, q.y0), x1: Math.max(b.x1, q.x1), y1: Math.max(b.y1, q.y1) } : q; });
  if (!b) return null;
  const X0 = Math.max(0, Math.floor(b.x0 * s)), Y0 = Math.max(0, Math.floor(b.y0 * s));
  const X1 = Math.min(Math.ceil(1000 * s), Math.ceil(b.x1 * s)), Y1 = Math.min(Math.ceil(pageH * s), Math.ceil(b.y1 * s));
  if (X1 <= X0 || Y1 <= Y0) return null;
  const c = mkCanvas(X1 - X0, Y1 - Y0), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.translate(-X0, -Y0);
  MB.drawPrims(ctx, prims.length === 1 ? [Object.assign({}, prims[0], { op: 1 })] : prims, s, { full: true });
  const W = c.width, H = c.height, d = ctx.getImageData(0, 0, W, H).data;
  let l = W, t = H, r = -1, btm = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) if (d[row + x * 4 + 3]) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; btm = y; }
  }
  if (r < 0) { c.width = c.height = 1; return null; }
  const out = mkCanvas(r - l + 1, btm - t + 1);
  out.getContext('2d').drawImage(c, l, t, out.width, out.height, 0, 0, out.width, out.height);
  c.width = c.height = 1;
  return { canvas: out, left: X0 + l, top: Y0 + t };
}
const onlyPaths = (g) => g.children.length > 1 && g.children.every(c => c.t === 'path');
const JUST = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right' };

/* scene prims -> ag-psd layers (bottom first), offset (ox, oy) px inside the document */
function toLayers(list, s, pageH, ox, oy) {
  const out = [];
  for (const p of list) {
    if (p.t === 'ph') continue;
    if (p.t === 'group') {
      if (onlyPaths(p)) { // a vector icon / ornament: one layer, not dozens of path slivers
        const r = rasterize(p.children, s, pageH);
        if (r) out.push({ name: p.name || 'Vector', canvas: r.canvas, left: ox + r.left, top: oy + r.top });
        continue;
      }
      const children = toLayers(p.children, s, pageH, ox, oy);
      if (children.length) out.push({ name: p.name || 'Group', opened: false, children });
      continue;
    }
    const r = rasterize([p], s, pageH);
    if (!r) continue;
    const L = { name: p.name || (p.t === 'text' ? String(p.text).split('\n')[0].slice(0, 40) : p.t), canvas: r.canvas, left: ox + r.left, top: oy + r.top };
    if (p.op != null && p.op < 1) L.opacity = p.op;
    if (p.t === 'text' && !p.fx && p.font && p.font.ps) { // editable type layer; the pixels above are what shows until it is edited
      const [cr, cg, cb] = MB.hexRgb(p.color || '#000000'), a = (p.rot || 0) * Math.PI / 180;
      L.text = {
        text: String(p.text).replace(/\n/g, '\r'),
        transform: [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), ox + p.x * s, oy + p.y * s],
        style: { font: { name: p.font.ps }, fontSize: p.size * s, fillColor: { r: cr, g: cg, b: cb }, autoLeading: false, leading: p.size * (p.lh || 1.15) * s, tracking: p.track || 0 },
        paragraphStyle: { justification: JUST[p.align] || 'left' },
      };
    }
    out.push(L);
  }
  return out;
}

/* -> { blob, name, fmt } ; pids = pages to export, combine = one file with an artboard per page */
MB.buildPsd = async (st, pids, base, opts, say) => {
  const G = MB.pageGeom(st);
  // iPad Safari can't allocate a canvas over 16.7 MP: render the pages just under it
  const k = IOS ? Math.min(1, Math.sqrt(16.5e6 / (G.Wpx * G.Hpx))) : 1;
  const W = Math.round(G.Wpx * k), H = Math.round(G.Hpx * k), s = W / 1000, dpi = Math.round(st.page.dpi * k);
  if (k < 1) say(`iPad วาดได้สูงสุด ~16.7 ล้านพิกเซล → ไฟล์นี้ ${W}×${H}px ต่อหน้า (${dpi} dpi) · ไฟล์พิมพ์จริงให้ส่งออกจากคอม`, 'warn');
  await document.fonts.ready;
  const combine = opts.combine && pids.length > 1;
  const cols = combine ? Math.ceil(Math.sqrt(pids.length)) : 1, rows = Math.ceil(pids.length / cols), gap = combine ? Math.round(W * 0.06) : 0;
  const DW = combine ? cols * W + (cols - 1) * gap : W, DH = combine ? rows * H + (rows - 1) * gap : H;
  const psb = opts.fmt === 'psb' || DW > 30000 || DH > 30000;
  if (psb && opts.fmt !== 'psb') say('ขนาดรวมเกิน 30,000 px (ขีดจำกัด PSD) — บันทึกเป็น PSB แทน', 'warn');
  const children = [];
  for (let i = 0; i < pids.length; i++) {
    say(`กำลังแยกเลเยอร์ ${MB.pageLabel(st, pids[i])} …`);
    await new Promise(r => setTimeout(r, 20));
    const ox = combine ? (i % cols) * (W + gap) : 0, oy = combine ? Math.floor(i / cols) * (H + gap) : 0;
    const layers = toLayers(MB.buildScene(st, pids[i]).groups, s, G.HU, ox, oy);
    if (combine) children.push({ name: MB.pageLabel(st, pids[i]), opened: true, artboard: { rect: { top: oy, left: ox, bottom: oy + H, right: ox + W }, presetName: '', color: { r: 255, g: 255, b: 255 }, backgroundType: 1 }, children: layers });
    else children.push(...layers);
  }
  say('กำลังเขียนไฟล์ ' + (psb ? 'PSB' : 'PSD') + ' …');
  await new Promise(r => setTimeout(r, 20));
  const res = { horizontalResolution: dpi, horizontalResolutionUnit: 'PPI', widthUnit: 'Inches', verticalResolution: dpi, verticalResolutionUnit: 'PPI', heightUnit: 'Inches' };
  const u8 = window.agPsd.writePsdUint8Array({ width: DW, height: DH, imageResources: { resolutionInfo: res }, children }, { psb, invalidateTextLayers: false });
  const free = (ls) => ls.forEach(l => { if (l.canvas) l.canvas.width = l.canvas.height = 1; if (l.children) free(l.children); });
  free(children);
  return { blob: new Blob([u8], { type: 'image/vnd.adobe.photoshop' }), name: base + (psb ? '.psb' : '.psd') };
};

})(window.MB);
