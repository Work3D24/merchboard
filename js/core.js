'use strict';
/* MerchBoard Studio — core: state, units, fonts, assets, history, storage */
window.MB = window.MB || {};
(function (MB) {

/* iPad / offline app build (set by build_pwa.py; ?pwa on the PC server previews it) */
MB.PWA = window.MB_MODE === 'pwa' || /[?&]pwa\b/.test(location.search);

MB.uid =(p) => (p || 'i') + Math.random().toString(36).slice(2, 10);
MB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
MB.round = (v, d = 2) => { const k = Math.pow(10, d); return Math.round(v * k) / k; };
MB.letter = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
MB.hexRgb = (hex) => {
  hex = String(hex || '#000').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16) || 0;
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
MB.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
MB.fmtPrice = (p, fmt) => {
  if (p === '' || p == null) return '';
  const raw = String(p).replace(/,/g, '').trim();
  const n = Number(raw);
  const s = raw !== '' && !isNaN(n) ? n.toLocaleString('en-US') : String(p);
  return (fmt || '{p}.-').replace('{p}', s);
};

/* ---------- Paper ---------- */
MB.PAPERS = {
  A4: { unit: 'mm', w: 210, h: 297, dpi: 300 },
  A3: { unit: 'mm', w: 297, h: 420, dpi: 300 },
  A2: { unit: 'mm', w: 420, h: 594, dpi: 300 },
  A1: { unit: 'mm', w: 594, h: 841, dpi: 200 },
  'Post 4:5 (1080×1350)': { unit: 'px', w: 1080, h: 1350, dpi: 72 },
  'Post 4:5 HD (2160×2700)': { unit: 'px', w: 2160, h: 2700, dpi: 144 },
  'Square (2048×2048)': { unit: 'px', w: 2048, h: 2048, dpi: 72 },
  'Story 9:16 (1080×1920)': { unit: 'px', w: 1080, h: 1920, dpi: 72 },
};

/* Model unit "U": page (incl. bleed) width = 1000 U. Everything is stored in U,
   so changing DPI / paper never needs geometry conversion. */
MB.pageGeom = (st) => {
  const p = st.page;
  let Wpx, Hpx, wmm, hmm, bleedU = 0;
  if (p.unit === 'px') {
    Wpx = Math.max(16, Math.round(p.w)); Hpx = Math.max(16, Math.round(p.h));
    wmm = Wpx / p.dpi * 25.4; hmm = Hpx / p.dpi * 25.4;
  } else {
    const b = Math.max(0, +p.bleed || 0);
    wmm = p.w + 2 * b; hmm = p.h + 2 * b;
    Wpx = Math.round(wmm / 25.4 * p.dpi); Hpx = Math.round(hmm / 25.4 * p.dpi);
    bleedU = b / wmm * 1000;
  }
  return { Wpx, Hpx, wmm, hmm, HU: 1000 * Hpx / Wpx, bleedU, mmPerU: wmm / 1000, pxPerU: Wpx / 1000 };
};
/* display conversion for UI numbers: U <-> mm or px */
MB.dispUnit = (st) => {
  const G = MB.pageGeom(st);
  return st.page.unit === 'px' ? { k: G.pxPerU, name: 'px', d: 0 } : { k: G.mmPerU, name: 'mm', d: 1 };
};
/* font size display: pt for print, px for screen pages */
MB.fontUnit = (st) => {
  const G = MB.pageGeom(st);
  return st.page.unit === 'px' ? { k: G.pxPerU, name: 'px', d: 0 } : { k: G.mmPerU / 0.352778, name: 'pt', d: 1 };
};

/* ---------- Fonts ---------- */
MB.FONT_PRESETS = [
  { label: 'Leelawadee UI Bold', family: 'Leelawadee UI', ps: 'LeelawadeeUI-Bold', weight: 700 },
  { label: 'Leelawadee UI', family: 'Leelawadee UI', ps: 'LeelawadeeUI', weight: 400 },
  { label: 'Tahoma Bold', family: 'Tahoma', ps: 'Tahoma-Bold', weight: 700 },
  { label: 'Tahoma', family: 'Tahoma', ps: 'Tahoma', weight: 400 },
  { label: 'Segoe UI Black', family: 'Segoe UI Black', ps: 'SegoeUI-Black', weight: 900 },
  { label: 'Segoe UI Bold', family: 'Segoe UI', ps: 'SegoeUI-Bold', weight: 700 },
  { label: 'Arial Black', family: 'Arial Black', ps: 'Arial-Black', weight: 900 },
  { label: 'Arial Bold', family: 'Arial', ps: 'Arial-BoldMT', weight: 700 },
  { label: 'Georgia Bold', family: 'Georgia', ps: 'Georgia-Bold', weight: 700 },
  { label: 'Impact', family: 'Impact', ps: 'Impact', weight: 400 },
];
MB.F_BOLD = MB.FONT_PRESETS[0];
MB.F_REG = MB.FONT_PRESETS[1];
const fontFaces = {};
MB.registerFont = (f) => {
  if (!f || !f.local || fontFaces[f.ps] || MB.PWA) return; // iPad: only imported font files exist
  try {
    const src = [`local("${f.ps}")`, f.full ? `local("${f.full}")` : null].filter(Boolean).join(', ');
    const ff = new FontFace('MBF_' + f.ps, src);
    fontFaces[f.ps] = ff;
    document.fonts.add(ff);
    ff.load().then(() => MB.requestRender && MB.requestRender()).catch(() => console.warn('font not loadable', f.ps));
  } catch (e) { console.warn(e); }
};
/* font files imported into this device (iPad has none of the PC's fonts). Stored in IndexedDB, never in .mbproj.
   Registered under both "MBF_<ps>" (picked fonts) and the real family + weight (preset fonts like Leelawadee UI Bold). */
MB.fontLib = [];
const fontNames = (buf) => { // read family / subfamily / full / PostScript names from a TTF/OTF 'name' table
  const v = new DataView(buf), n = v.getUint16(4);
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    if (String.fromCharCode(v.getUint8(r), v.getUint8(r + 1), v.getUint8(r + 2), v.getUint8(r + 3)) !== 'name') continue;
    const t = v.getUint32(r + 8), cnt = v.getUint16(t + 2), so = t + v.getUint16(t + 4), out = {};
    for (let j = 0; j < cnt; j++) {
      const e = t + 6 + j * 12, pid = v.getUint16(e), id = v.getUint16(e + 6), len = v.getUint16(e + 8), off = so + v.getUint16(e + 10);
      if (![1, 2, 4, 6, 16, 17].includes(id) || (pid !== 3 && pid !== 1) || (out[id] && pid === 1)) continue;
      let s = '';
      if (pid === 3) for (let k = 0; k < len; k += 2) s += String.fromCharCode(v.getUint16(off + k));
      else for (let k = 0; k < len; k++) s += String.fromCharCode(v.getUint8(off + k));
      out[id] = s;
    }
    const family = out[16] || out[1], sub = out[17] || out[2] || 'Regular';
    return { family, sub, full: out[4] || family + ' ' + sub, ps: out[6] || (family + '-' + sub).replace(/\s+/g, '') };
  }
  throw new Error('ไม่ใช่ไฟล์ฟอนต์ TTF/OTF');
};
const subWeight = (s) => /black|heavy/i.test(s) ? 900 : /extra ?bold|ultra ?bold/i.test(s) ? 800 : /semi ?bold|demi/i.test(s) ? 600 : /bold/i.test(s) ? 700 : /medium/i.test(s) ? 500 : /light|thin/i.test(s) ? 300 : 400;
const registerFontBuffer = (meta, buf) => {
  const faces = [new FontFace('MBF_' + meta.ps, buf), new FontFace(meta.family, buf, { weight: String(subWeight(meta.sub)), style: /italic|oblique/i.test(meta.sub) ? 'italic' : 'normal' })];
  fontFaces[meta.ps] = faces[0];
  faces.forEach(ff => { document.fonts.add(ff); ff.load().then(() => MB.requestRender && MB.requestRender()).catch(() => {}); });
};
MB.importFontFiles = async (files) => {
  const added = [];
  for (const f of files) {
    try {
      const buf = await f.arrayBuffer(), meta = fontNames(buf);
      await MB.db.put('fontfile:' + meta.ps, buf);
      MB.fontLib = MB.fontLib.filter(x => x.ps !== meta.ps).concat([meta]);
      registerFontBuffer(meta, buf); added.push(meta);
    } catch (e) { console.warn(f.name, e); }
  }
  await MB.db.put('fontlib', MB.fontLib);
  return added;
};
MB.removeFontFile = async (ps) => { MB.fontLib = MB.fontLib.filter(x => x.ps !== ps); await MB.db.put('fontlib', MB.fontLib); await MB.db.put('fontfile:' + ps, null); };
MB.loadFontLib = async () => {
  try {
    MB.fontLib = (await MB.db.get('fontlib')) || [];
    for (const m of MB.fontLib) { const buf = await MB.db.get('fontfile:' + m.ps); if (buf) registerFontBuffer(m, buf); }
  } catch (e) { console.warn(e); }
};
MB.fontCss = (f, px) => {
  f = f || MB.F_BOLD;
  const fam = f.local ? `"MBF_${f.ps}"` : `"${f.family}"`;
  return `${f.local ? 400 : (f.weight || 400)} ${Math.max(0.1, px)}px ${fam}, "Leelawadee UI", Tahoma, sans-serif`;
};
MB.recentFonts = () => { try { return JSON.parse(localStorage.getItem('mb_fonts') || '[]'); } catch (e) { return []; } };
MB.rememberFont = (f) => {
  const list = MB.recentFonts().filter(x => x.ps !== f.ps);
  list.unshift(f);
  try { localStorage.setItem('mb_fonts', JSON.stringify(list.slice(0, 40))); } catch (e) {}
};

/* ---------- Assets ---------- */
MB.assets = {};
const VIEW_MAX = 1600;
/* onload-based (img.decode() can stall forever in some embedded Chromium views) */
MB.loadImage = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img); img.onerror = () => rej(new Error('cannot load image'));
  img.src = src;
  if (img.complete && img.naturalWidth) res(img);
});
MB.decodeAsset = async (a) => {
  if (a.kind === 'vec') { a.w = a.vec.w; a.h = a.vec.h; return a; } // vector assets have no bitmap
  let img;
  try { img = await MB.loadImage(a.data); } catch (e) { console.warn('decode failed', a.name); return a; }
  a.img = img; a.w = img.naturalWidth; a.h = img.naturalHeight;
  const m = Math.max(a.w, a.h);
  if (m > VIEW_MAX) {
    const k = VIEW_MAX / m, c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(a.w * k)); c.height = Math.max(1, Math.round(a.h * k));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    a.view = c;
  } else a.view = img;
  MB.requestRender && MB.requestRender();
  return a;
};
MB.readDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
/* PNG/JPEG kept byte-exact; anything else (webp, gif, bmp…) re-encoded to PNG so Photoshop/Illustrator can place it */
MB.fileToAsset = async (file) => {
  let data = await MB.readDataURL(file), mime = file.type || 'image/png';
  if (!/^image\/(png|jpeg)$/.test(mime)) {
    const img = await MB.loadImage(data);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0); data = c.toDataURL('image/png'); mime = 'image/png';
  }
  if (mime === 'image/png' && MB.trimPref()) { const t = await MB.trimTransparent(data); if (t) data = t.data; }
  const a = { id: MB.uid('a'), name: file.name.replace(/\.[^.]+$/, ''), mime, data };
  MB.assets[a.id] = a;
  await MB.decodeAsset(a);
  return a;
};
/* crop fully transparent margins of a PNG so products of different files look the same size */
MB.trimPref = () => { try { return localStorage.getItem('mb_trim') !== '0'; } catch (e) { return true; } };
MB.trimTransparent = async (data) => {
  const img = await MB.loadImage(data), W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) { const row = y * W * 4; for (let i = 0; i < W; i++) if (d[row + i * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; y1 = y; } }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (w * h > W * H * 0.96) return null;
  const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(img, -x0, -y0);
  return { data: o.toDataURL('image/png'), w, h };
};
/* ---------- colour helpers ---------- */
MB.rgbHex = (r, g, b) => '#' + [r, g, b].map(v => MB.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
MB.rgbHsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
};
MB.hslHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s = MB.clamp(s, 0, 1); l = MB.clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return MB.rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};
MB.luma = (hex) => { const [r, g, b] = MB.hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
/* dominant colours of images: 5-bit colour buckets, merged when close, ranked by area */
MB.extractPalette = (assetIds, max = 8) => {
  const bins = new Map();
  assetIds.forEach(id => {
    const a = MB.assets[id]; if (!a || !(a.view || a.img)) return;
    const src = a.view || a.img, k = 96 / Math.max(a.w, a.h, 1), w = Math.max(1, Math.round(a.w * k)), h = Math.max(1, Math.round(a.h * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const key = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
      const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; bins.set(key, b);
    }
  });
  const cands = [...bins.values()].map(b => ({ n: b.n, rgb: [b.r / b.n, b.g / b.n, b.b / b.n] })).sort((p, q) => q.n - p.n);
  const out = [];
  for (const c of cands) {
    const near = out.find(o => Math.hypot(o.rgb[0] - c.rgb[0], o.rgb[1] - c.rgb[1], o.rgb[2] - c.rgb[2]) < 48);
    if (near) { near.n += c.n; continue; }
    out.push(c); if (out.length >= max * 2) break;
  }
  return out.slice(0, max).map(c => { const [h, s, l] = MB.rgbHsl(c.rgb); return { hex: MB.rgbHex(...c.rgb), h, s, l, n: c.n }; });
};
MB.assetRecord = (a) => a.kind === 'vec' ? { name: a.name, mime: a.mime, kind: 'vec', role: a.role, libKey: a.libKey, vec: a.vec } : { name: a.name, mime: a.mime, data: a.data };
MB.usedAssetIds = (st) => {
  const s = new Set();
  if (st.bg.asset) s.add(st.bg.asset);
  st.cards.forEach(c => c.variants.forEach(v => v.asset && s.add(v.asset)));
  st.elements.forEach(e => e.asset && s.add(e.asset));
  st.footer.logos.forEach(l => l.asset && s.add(l.asset));
  (st.vecLib || []).forEach(id => s.add(id));
  const o = st.theme.orn || {}; [o.titlePre, o.titlePost, o.pricePre, o.pricePost].forEach(id => id && s.add(id));
  [st.theme.price.shape, st.theme.badge.shape].forEach(sh => { sh = String(sh || ''); if (sh.startsWith('vec:')) s.add(sh.slice(4)); });
  st.cards.forEach(c => { const cs = c.style && c.style.priceShape; if (cs && String(cs).startsWith('vec:')) s.add(cs.slice(4)); });
  return [...s].filter(id => MB.assets[id]);
};

/* ---------- Text effects (all sizes in U) ---------- */
MB.defaultFx = () => ({
  track: 0, bold: false,
  grad: { on: false, c2: '#FFFFFF', angle: -90 },
  stroke: { on: false, color: '#FFFFFF', w: 3 },
  shadow: { on: false, color: '#000000', op: 0.45, dist: 4, angle: 120, blur: 6 },
  glow: { on: false, color: '#FFFFFF', op: 0.8, size: 12 },
  bevel: { on: false, size: 4, hl: '#FFFFFF', sh: '#000000' },
});
MB.fixFx = (fx) => {
  const d = MB.defaultFx(); fx = fx || {};
  for (const k in d) d[k] = (d[k] && typeof d[k] === 'object') ? Object.assign(d[k], fx[k]) : (fx[k] != null ? fx[k] : d[k]);
  return d;
};
MB.fxActive = (fx) => !!fx && !!(fx.bold || fx.track || fx.grad.on || fx.stroke.on || fx.shadow.on || fx.glow.on || fx.bevel.on);

/* ---------- Defaults ---------- */
MB.defaultTheme = () => ({
  preset: 'panel', titlePos: 'top', subPos: 'above', uniformImg: false, priceMode: 'pill', align: 'left', bullet: '', imgAlign: 'center',
  pad: 12, imgGap: 8,
  panel: { on: true, fill: '#ffffff', opacity: 0.8, radius: 12, strokeW: 0, stroke: '#ffffff', shape: 'rounded', bump: 0.1, inner: '#F1F1F1',
    glass: { on: false, blur: 10, sat: 1.4, frost: 0.12, shine: 0.6, edge: 0.7, shadow: 0.3 } },
  bar: { mode: 'none', fill: '#cfe6ff', opacity: 0.95, radius: 6 },
  title: { font: MB.F_BOLD, size: 22, color: '#2A7EB1', upper: true, fx: MB.defaultFx() },
  price: { font: MB.F_BOLD, size: 19, color: '#ffffff', fill: '#29A3E3', format: '{p}.-', shape: 'pill', vecRecolor: true },
  orn: { titlePre: '', titlePost: '', pricePre: '', pricePost: '', size: 0.85, gap: 0.3, mono: false },
  note: { font: MB.F_REG, size: 11, color: '#2C3A4B' },
  badge: { on: true, font: MB.F_BOLD, size: 12, fill: '#29A3E3', color: '#ffffff', shape: 'circle', vscale: 1.4, ty: 0 },
  sub: { font: MB.F_BOLD, size: 8.5, color: '#2C3A4B' },
  tag: { font: MB.F_BOLD, size: 10, color: '#FFFFFF', fill: '#E8457A', radius: 20 },
  terms: { font: MB.F_REG, size: 8.5, color: '#5A6475', pos: 'bottom' },
});
MB.STYLE_PRESETS = {
  panel: { label: 'การ์ด + ป้ายราคา', apply: t => Object.assign(t, { titlePos: 'top', priceMode: 'pill', align: 'left', bullet: '' }, { panel: Object.assign(t.panel, { on: true }), bar: Object.assign(t.bar, { mode: 'none' }) }) },
  label: { label: 'แถบชื่อด้านล่าง', apply: t => Object.assign(t, { titlePos: 'bottom', priceMode: 'inline', align: 'left', bullet: '' }, { panel: Object.assign(t.panel, { on: false }), bar: Object.assign(t.bar, { mode: 'full' }) }) },
  header: { label: 'หัวข้อ ◆ บรรทัดเดียว', apply: t => Object.assign(t, { titlePos: 'top', priceMode: 'inline', align: 'left', bullet: '◆ ' }, { panel: Object.assign(t.panel, { on: false }), bar: Object.assign(t.bar, { mode: 'none' }) }) },
  shelf: { label: 'ป้ายชื่อแบบแท็ก', apply: t => Object.assign(t, { titlePos: 'top', priceMode: 'inline', align: 'left', bullet: '' }, { panel: Object.assign(t.panel, { on: false }), bar: Object.assign(t.bar, { mode: 'fit' }) }) },
};
MB.newCard = (o = {}) => Object.assign({
  id: MB.uid('c'), sku: '', name: 'NEW ITEM', price: '', note: '', status: '', terms: '',
  variants: [], x: 40, y: 260, w: 280, h: 220, locked: false, rows: 0, imgScale: 1, weight: 1, noBadge: false, noSub: false, collection: '', hidden: false, hero: false, spanC: 0, spanR: 0, style: {},
}, o);
/* ---------- Pages: cards belong to one page; logo / BG / footer / theme are shared ---------- */
MB.newPage = (name) => ({ id: MB.uid('p'), name: name || '' });
MB.pageOf = (st, pid) => st.pages.find(p => p.id === (pid || st.curPage)) || st.pages[0];
MB.pageIndex = (st, pid) => st.pages.findIndex(p => p.id === pid);
MB.pageCards = (st, pid) => st.cards.filter(c => c.page === (pid || st.curPage));
MB.pageLabel = (st, pid) => { const i = MB.pageIndex(st, pid), p = st.pages[i]; return `หน้า ${i + 1}` + (p && p.name ? ` · ${p.name}` : ''); };
MB.onPage = (e, pid) => !e.page || e.page === pid; // elements: page null = every page
MB.newVariant = (o = {}) => Object.assign({ id: MB.uid('v'), asset: null, label: '', sub: '', price: '', sku: '', zoom: 1, ox: 0, oy: 0 }, o);
MB.newState = () => {
  const st = {
    v: 1, name: 'Merch Board',
    page: { preset: 'A3', unit: 'mm', w: 297, h: 420, dpi: 300, bleed: 0 },
    bg: { color: '#EAF4FF', asset: null, fit: 'cover', opacity: 1 },
    layout: { margin: 28, top: 250, gap: 14, mode: 'justified', cols: 3, guides: true, reflow: true, shelfH: 10, shelfColor: '#8B5E3C' },
    theme: MB.defaultTheme(),
    cards: [], elements: [], pages: [], curPage: '', vecLib: [],
    footer: { on: true, h: 60, fill: '#ffffff', opacity: 0, align: 'center', gap: 40, logos: [] },
  };
  [['KEYCHAIN', 290, 6], ['RANDOM POLAROID', 169, 1], ['POCKET MIRROR', 390, 4], ['MAGSAFE GRIPTOK', 490, 6],
   ['PHOTOBOOK', 1490, 2], ['RANDOM PHOTOCARDS', 390, 1], ['MINI STANDEE', 390, 4], ['PHONE STRAP', 390, 1]]
    .forEach(([name, price, n]) => st.cards.push(MB.newCard({ name, price, variants: Array.from({ length: n }, () => MB.newVariant()) })));
  const p1 = MB.newPage(); st.pages = [p1]; st.curPage = p1.id; st.cards.forEach(c => { c.page = p1.id; });
  st.elements.push({ id: MB.uid('e'), type: 'text', role: 'title', name: 'Headline', text: 'OFFICIAL MERCHANDISE',
    font: MB.F_BOLD, size: 48, color: '#2A7EB1', align: 'center', lh: 1.15, x: 500, y: 150, rot: 0, op: 1, locked: false, behind: false, fx: MB.defaultFx() });
  return st;
};
/* fill any keys added in later versions */
MB.migrate = (st) => {
  const d = MB.newState();
  for (const k of ['page', 'bg', 'layout', 'footer']) st[k] = Object.assign({}, d[k], st[k]);
  const t = MB.defaultTheme();
  st.theme = Object.assign(t, st.theme || {});
  for (const k of ['panel', 'bar', 'title', 'price', 'note', 'badge', 'sub', 'tag', 'terms', 'orn']) st.theme[k] = Object.assign(MB.defaultTheme()[k], st.theme[k]);
  st.theme.panel.glass = Object.assign(MB.defaultTheme().panel.glass, st.theme.panel.glass);
  st.cards = (st.cards || []).map(c => Object.assign(MB.newCard(), c, { variants: (c.variants || []).map(v => MB.newVariant(v)) }));
  if (!Array.isArray(st.pages) || !st.pages.length) st.pages = [MB.newPage()];
  const pids = new Set(st.pages.map(p => p.id));
  st.cards.forEach(c => { if (!pids.has(c.page)) c.page = st.pages[0].id; });
  if (!pids.has(st.curPage)) st.curPage = st.pages[0].id;
  st.elements = (st.elements || []).map(e => e.type === 'text' ? Object.assign(e, { fx: MB.fixFx(e.fx) }) : e);
  st.theme.title.fx = MB.fixFx(st.theme.title.fx);
  st.footer.logos = st.footer.logos || [];
  st.guides = st.guides || { v: [], h: [] };
  st.vecLib = st.vecLib || [];
  return st;
};

/* ---------- History ---------- */
const H = { stack: [], i: -1 };
MB.resetHistory = () => { H.stack = [JSON.stringify(MB.state)]; H.i = 0; };
MB.touch = () => { MB.requestRender && MB.requestRender(); MB.ui && MB.ui.soft(); MB.scheduleSave(); };
MB.commit = () => {
  const s = JSON.stringify(MB.state);
  if (H.stack[H.i] !== s) {
    H.stack = H.stack.slice(0, H.i + 1); H.stack.push(s);
    if (H.stack.length > 120) H.stack.shift();
    H.i = H.stack.length - 1;
  }
  MB.touch();
};
const restore = (i) => {
  const keepPage = MB.state && MB.state.curPage;
  H.i = i; MB.state = JSON.parse(H.stack[i]);
  if (keepPage && MB.state.pages.some(p => p.id === keepPage)) MB.state.curPage = keepPage; // undo never jumps to another page
  if (MB.sel && !MB.findSel(MB.sel)) MB.sel = null;
  MB.extra = MB.extra.filter(s => MB.findSel(s));
  MB.touch(); MB.ui && MB.ui.rebuild(); MB.ui && MB.ui.renderPageBar && MB.ui.renderPageBar();
};
MB.undo = () => { if (H.i > 0) restore(H.i - 1); };
MB.redo = () => { if (H.i < H.stack.length - 1) restore(H.i + 1); };
MB.canUndo = () => H.i > 0;
MB.canRedo = () => H.i < H.stack.length - 1;

/* selection: MB.sel = primary item {kind:'card'|'el'|'flogo', id}; MB.extra = more cards / elements (Shift/Ctrl-click, marquee).
   Assigning MB.sel directly means "select only this" and clears the extras. */
let _sel = null;
MB.extra = [];
Object.defineProperty(MB, 'sel', { configurable: true, get: () => _sel, set: (v) => { _sel = v; if (!MB._keepExtra) MB.extra = []; } });
const withExtra = (fn) => { MB._keepExtra = true; try { fn(); } finally { MB._keepExtra = false; } };
MB.selAll = () => [_sel, ...MB.extra].filter(s => s && MB.findSel(s));
MB.isSel = (id) => !!id && ((_sel && _sel.id === id) || MB.extra.some(s => s.id === id));
MB.toggleSel = (s) => withExtra(() => {
  if (MB.isSel(s.id)) {
    if (_sel && _sel.id === s.id) MB.sel = MB.extra.shift() || null;
    else MB.extra = MB.extra.filter(x => x.id !== s.id);
  } else if (!_sel || _sel.kind === 'flogo') MB.sel = s;
  else MB.extra.push(s);
});
MB.promoteSel = (s) => withExtra(() => { const old = _sel; MB.extra = MB.extra.filter(x => x.id !== s.id); if (old) MB.extra.unshift(old); MB.sel = s; });
MB.selectMany = (list, add) => withExtra(() => {
  const cur = add ? MB.selAll() : [], seen = new Set(cur.map(s => s.id));
  list.forEach(s => { if (!seen.has(s.id)) { cur.push(s); seen.add(s.id); } });
  MB.sel = cur[0] || null; MB.extra = cur.slice(1);
});
MB.findSel = (sel) => {
  if (!sel) return null;
  const st = MB.state;
  if (sel.kind === 'card') return st.cards.find(c => c.id === sel.id);
  if (sel.kind === 'el') return st.elements.find(e => e.id === sel.id);
  if (sel.kind === 'flogo') return st.footer.logos.find(l => l.id === sel.id);
  return null;
};

/* ---------- Storage (IndexedDB autosave) ---------- */
MB.db = {
  _p: null,
  open() {
    return this._p || (this._p = new Promise((res, rej) => {
      const r = indexedDB.open('merchboard', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  },
  async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
};
const savedAssets = new Set();
MB.assetChanged = (id) => savedAssets.delete(id);
let saveTimer = 0;
MB.scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(MB.autosave, 1200); };
MB.autosave = async () => {
  try {
    const st = MB.state, ids = MB.usedAssetIds(st);
    for (const id of ids) if (!savedAssets.has(id)) {
      await MB.db.put('a:' + id, Object.assign({ id }, MB.assetRecord(MB.assets[id]))); savedAssets.add(id);
    }
    await MB.db.put('state', { state: st, assets: ids, t: Date.now() });
    MB.ui && MB.ui.status('บันทึกอัตโนมัติแล้ว ' + new Date().toLocaleTimeString('th-TH'));
  } catch (e) { console.warn('autosave failed', e); }
};
MB.restoreAutosave = async () => {
  try {
    const rec = await MB.db.get('state');
    if (!rec || !rec.state) return false;
    for (const id of rec.assets || []) {
      const a = await MB.db.get('a:' + id);
      if (a) { MB.assets[id] = a; savedAssets.add(id); }
    }
    await Promise.all(Object.values(MB.assets).map(a => a.img ? a : MB.decodeAsset(a)));
    MB.state = MB.migrate(rec.state);
    return true;
  } catch (e) { console.warn(e); return false; }
};
MB.loadProject = async (obj) => {
  MB.assets = {};
  for (const id in obj.assets || {}) MB.assets[id] = Object.assign({ id }, obj.assets[id]);
  await Promise.all(Object.values(MB.assets).map(MB.decodeAsset));
  MB.state = MB.migrate(obj.state);
  walkFonts(MB.state, MB.registerFont);
  MB.sel = null; MB.resetHistory(); MB.touch(); MB.ui && MB.ui.rebuild(); MB.ui && MB.ui.renderPageBar(); MB.fitView && MB.fitView();
};
MB.projectJSON = () => {
  const st = MB.state, assets = {};
  MB.usedAssetIds(st).forEach(id => { assets[id] = MB.assetRecord(MB.assets[id]); });
  return JSON.stringify({ mbproj: 1, saved: new Date().toISOString(), state: st, assets });
};
function walkFonts(st, fn) {
  const t = st.theme; ['title', 'price', 'note', 'badge', 'sub', 'tag', 'terms'].forEach(k => t[k] && fn(t[k].font));
  st.elements.forEach(e => e.font && fn(e.font));
}
MB.walkFonts = walkFonts;

/* ---------- Binary helpers: CRC32, ZIP (store), PNG/JPEG DPI ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
MB.crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
MB.zip = (files) => { // files: [{name, data:Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = MB.crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + sz;
  }
  const csz = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csz, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
};
MB.dataURLBytes = (d) => { const b = atob(d.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
MB.pngSetDpi = (u8, dpi) => { // insert pHYs after IHDR
  const ppm = Math.round(dpi / 0.0254), chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, MB.crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(u8.length + 21); out.set(u8.subarray(0, 33)); out.set(chunk, 33); out.set(u8.subarray(33), 54);
  return out;
};
MB.jpgSetDpi = (u8, dpi) => {
  if (u8[2] === 0xFF && u8[3] === 0xE0 && u8[6] === 0x4A && u8[7] === 0x46) { u8[13] = 1; u8[14] = dpi >> 8; u8[15] = dpi & 255; u8[16] = dpi >> 8; u8[17] = dpi & 255; }
  return u8;
};
const plainDownload = (blob, name) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
};
/* iPad: the share sheet (Save to Files / AirDrop / iCloud) instead of a download; must run inside a tap */
MB.shareFiles = async (files) => {
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  files.forEach(f => plainDownload(f, f.name));
  return true;
};
MB.download = (blob, name) => MB.PWA ? MB.shareFiles([new File([blob], name, { type: blob.type || 'application/octet-stream' })]) : plainDownload(blob, name);
MB.blobToB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
MB.safeName = (s) => String(s || 'untitled').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'untitled';

/* ---------- Local helper server (optional) ---------- */
MB.server = { ok: false, info: null };
MB.api = async (path, body) => {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'server error');
  return j;
};
MB.detectServer = async () => {
  if (location.protocol === 'file:' || MB.PWA) return false;
  try { MB.server.info = await MB.api('/api/status'); MB.server.ok = true; } catch (e) { MB.server.ok = false; }
  return MB.server.ok;
};

})(window.MB);
