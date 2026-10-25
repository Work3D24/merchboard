'use strict';
/* MerchBoard Studio — UI panels, dialogs, shortcuts */
(function (MB) {
const $ = (s) => document.querySelector(s);
const UI = MB.ui = { tab: 'page' };

/* ---------- tiny DOM helper ---------- */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
MB.h = h;

/* ---------- field builders (mutate obj, live render, commit on change) ---------- */
const live = (silent) => { if (!silent) MB.touch(); };
const done = (silent) => { if (!silent) MB.commit(); };
UI.row = (label, ...ctrl) => h('div', { class: 'fld' }, h('span', { class: 'fl' }, label), h('div', { class: 'fc' }, ...ctrl));
UI.num = (o, k, { min, max, step = 1, scale = 1, digits = 1, onset, silent, suffix } = {}) => {
  const inp = h('input', { type: 'number', step, min, max, value: MB.round(o[k] * scale, digits) });
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (isNaN(v)) return; o[k] = v / scale; onset && onset(); live(silent); });
  inp.addEventListener('change', () => done(silent));
  return suffix ? h('div', { class: 'numu' }, inp, h('span', null, suffix)) : inp;
};
UI.rng = (o, k, min, max, step, { fmt, onset, silent } = {}) => {
  const out = h('span', { class: 'rv' }), inp = h('input', { type: 'range', min, max, step, value: o[k] });
  const upd = () => { out.textContent = fmt ? fmt(o[k]) : MB.round(o[k], 2); };
  upd();
  inp.addEventListener('input', () => { o[k] = parseFloat(inp.value); upd(); onset && onset(); live(silent); });
  inp.addEventListener('change', () => done(silent));
  return h('div', { class: 'rng' }, inp, out);
};
UI.col = (o, k, { onset } = {}) => {
  const hex = h('input', { type: 'text', class: 'hex', value: (o[k] || '').toUpperCase(), maxlength: 7 });
  const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(o[k]) ? o[k] : '#000000' });
  pick.addEventListener('input', () => { o[k] = pick.value.toUpperCase(); hex.value = o[k]; onset && onset(); MB.touch(); });
  pick.addEventListener('change', () => MB.commit());
  hex.addEventListener('change', () => { let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { o[k] = v.toUpperCase(); pick.value = v.length === 4 ? '#' + v.slice(1).split('').map(c => c + c).join('') : v; onset && onset(); MB.commit(); } else hex.value = o[k]; });
  return h('div', { class: 'colf' }, pick, hex);
};
UI.sel = (o, k, opts, onset, silent) => {
  const s = h('select', null, opts.map(([v, l]) => h('option', { value: v, selected: String(o[k]) === String(v) }, l)));
  s.addEventListener('change', () => { const raw = s.value, num = Number(raw); o[k] = typeof o[k] === 'number' && !isNaN(num) ? num : raw; onset && onset(); done(silent); });
  return s;
};
UI.chk = (o, k, label, onset, silent) => {
  const c = h('input', { type: 'checkbox', checked: !!o[k] });
  c.addEventListener('change', () => { o[k] = c.checked; onset && onset(); done(silent); });
  return h('label', { class: 'chk' }, c, h('span', null, label));
};
UI.txt = (o, k, { area, placeholder, onset } = {}) => {
  const t = h(area ? 'textarea' : 'input', { type: 'text', placeholder: placeholder || '', rows: area ? 2 : null });
  t.value = o[k] == null ? '' : o[k];
  t.addEventListener('input', () => { o[k] = t.value; onset && onset(); MB.touch(); });
  t.addEventListener('change', () => MB.commit());
  return t;
};
const btn = (label, onclick, cls) => h('button', { class: cls || '', onclick }, label);
const section = (title, ...kids) => h('details', { class: 'sec', open: true }, h('summary', null, title), h('div', { class: 'secb' }, ...kids));
const hint = (t) => h('div', { class: 'hint' }, t);
const thumb = (assetId, cls) => { const a = MB.assets[assetId]; return a ? h('img', { class: cls || 'th', src: a.kind === 'vec' ? MB.vecThumb(a) : a.data, alt: '' }) : h('div', { class: (cls || 'th') + ' empty' }, '—'); };

/* ---------- fonts ---------- */
UI.fontSel = (o, k, onset) => {
  const cur = o[k] || MB.F_BOLD;
  const list = [], seen = new Set();
  const add = (f) => { if (f && !seen.has(f.ps)) { seen.add(f.ps); list.push(f); } };
  add(cur); MB.FONT_PRESETS.forEach(add); MB.fontLib.forEach(m => add(libFont(m))); MB.recentFonts().forEach(add);
  const s = h('select', { class: 'fontsel' },
    list.map(f => h('option', { value: f.ps, selected: f.ps === cur.ps }, f.label + (f.local ? '' : ''))),
    h('option', { value: '__search' }, MB.PWA ? '🔍 ฟอนต์ / นำเข้าไฟล์ฟอนต์…' : '🔍 ค้นหาฟอนต์ในเครื่อง…'));
  s.addEventListener('change', async () => {
    if (s.value === '__search') {
      s.value = cur.ps;
      const f = await UI.pickLocalFont();
      if (f) { o[k] = f; MB.registerFont(f); MB.rememberFont(f); onset && onset(); MB.commit(); UI.rebuild(); }
      return;
    }
    const f = list.find(x => x.ps === s.value);
    o[k] = Object.assign({}, f); MB.registerFont(f); onset && onset(); MB.commit();
  });
  return s;
};
const libFont = (m) => ({ label: m.full, family: m.family, ps: m.ps, full: m.full, weight: 400, local: true });
/* fonts imported as files on this device (the iPad app's only fonts besides iOS's own) */
function fontFilesSec(finish) {
  const list = h('div', { class: 'fontlist' });
  const draw = () => {
    list.innerHTML = '';
    MB.fontLib.forEach(m => list.append(h('div', { class: 'fi', onclick: () => finish(libFont(m)) }, h('b', { style: `font-family:"MBF_${m.ps}"` }, m.full + ' กขค ABC'), h('small', null, m.ps))));
    if (!MB.fontLib.length) list.append(hint('ยังไม่มี — นำเข้าไฟล์ .ttf / .otf (เช่น ฟอนต์เดียวกับที่ใช้ในคอม)'));
  };
  draw();
  const sec = section('ฟอนต์ที่นำเข้าในเครื่องนี้', list,
    h('div', { class: 'brow' }, btn('＋ นำเข้าไฟล์ฟอนต์ (.ttf / .otf)', async () => {
      const files = await UI.pickFiles(MB.PWA ? '' : '.ttf,.otf,font/ttf,font/otf', true); if (!files.length) return;
      const added = await MB.importFontFiles(files);
      UI.toast(added.length ? 'นำเข้า ' + added.map(m => m.full).join(', ') : 'อ่านไฟล์ฟอนต์ไม่ได้ (รองรับ .ttf / .otf)');
      draw(); MB.requestRender();
    })),
    hint('ใช้ไฟล์ฟอนต์ตัวเดียวกับในคอม แล้วงานที่ส่งกลับไปทำ PSD จะได้ฟอนต์ตรงกัน · ฟอนต์เริ่มต้น Leelawadee UI ก็นำเข้าได้ (ไฟล์ LeelawUI.ttf / LeelaUIb.ttf)'));
  sec.open = MB.PWA || MB.fontLib.length > 0;
  return sec;
}
UI.pickLocalFont = () => new Promise((resolve) => {
  let fonts = MB._localFonts || null, done = false;
  const q = h('input', { type: 'text', placeholder: 'พิมพ์ชื่อฟอนต์ เช่น DB Heavent, Sarabun, Kanit…' });
  const listEl = h('div', { class: 'fontlist' });
  const finish = (f) => { if (done) return; done = true; UI.closeModal(); resolve(f); };
  const render = () => {
    listEl.innerHTML = '';
    if (!fonts) return;
    const t = q.value.trim().toLowerCase();
    const hits = fonts.filter(f => !t || f.fullName.toLowerCase().includes(t) || f.postscriptName.toLowerCase().includes(t)).slice(0, 300);
    hits.forEach(f => listEl.append(h('div', { class: 'fi', onclick: () => finish({ label: f.fullName, family: f.family, ps: f.postscriptName, full: f.fullName, weight: 400, local: true }) },
      h('b', null, f.fullName), h('small', null, f.postscriptName))));
    if (!hits.length) listEl.append(hint('ไม่พบฟอนต์'));
  };
  const load = async () => {
    try {
      const all = await window.queryLocalFonts();
      fonts = MB._localFonts = all.map(f => ({ fullName: f.fullName, family: f.family, postscriptName: f.postscriptName, style: f.style }));
      loadBtn.remove(); render();
    } catch (e) { listEl.innerHTML = ''; listEl.append(hint('เบราว์เซอร์ไม่อนุญาต: ' + e.message + ' — ใช้ Chrome/Edge แล้วกด Allow หรือกรอกชื่อด้านล่าง')); }
  };
  const loadBtn = h('button', { class: 'primary', onclick: load }, 'โหลดรายชื่อฟอนต์ในเครื่อง');
  q.addEventListener('input', render);
  const man = { family: '', ps: '' };
  const manual = section('กรอกเอง (ถ้าโหลดรายชื่อไม่ได้)',
    UI.row('ชื่อ Family', UI.txt(man, 'family', { placeholder: 'เช่น DB HeaventRounded' })),
    UI.row('PostScript name', UI.txt(man, 'ps', { placeholder: 'เช่น DBHeaventRounded-Bold' })),
    btn('ใช้ฟอนต์นี้', () => { if (man.ps || man.family) finish({ label: man.family || man.ps, family: man.family || man.ps, ps: man.ps || man.family.replace(/\s+/g, ''), full: man.family, weight: 400, local: true }); }));
  manual.open = !window.queryLocalFonts && !MB.PWA;
  UI.modal('เลือกฟอนต์', h('div', { class: 'fontpick' }, fontFilesSec(finish),
    MB.PWA ? null : [window.queryLocalFonts ? (fonts ? null : loadBtn) : hint('เบราว์เซอร์นี้ไม่รองรับการอ่านรายชื่อฟอนต์ — แนะนำ Chrome หรือ Edge'), q, listEl],
    manual, hint('PostScript name ถูกใช้ตอนสร้างไฟล์ PSD/AI ให้ฟอนต์ตรงกับในเครื่อง')),
    [btn('ยกเลิก', () => finish(null))], () => { if (!done) { done = true; resolve(null); } });
  if (fonts) render();
  setTimeout(() => q.focus(), 50);
});

/* ---------- modal / toast / status ---------- */
let modalClose = null;
UI.modal = (title, body, buttons, onClose) => {
  const m = $('#modal'); m.innerHTML = '';
  m.append(h('div', { class: 'mbox' }, h('div', { class: 'mhead' }, h('b', null, title), h('button', { class: 'x', onclick: () => UI.closeModal() }, '✕')),
    h('div', { class: 'mbody' }, body), buttons && buttons.length ? h('div', { class: 'mfoot' }, buttons) : null));
  m.hidden = false; modalClose = onClose || null;
};
UI.closeModal = () => { $('#modal').hidden = true; $('#modal').innerHTML = ''; const f = modalClose; modalClose = null; f && f(); };
let toastT = 0;
UI.toast = (msg, ms = 2600) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); };
UI.status = (msg) => { const s = $('#stSave'); if (s) s.textContent = msg; };
UI.zoomLabel = () => { $('#zoomLbl').textContent = Math.round(MB.view.z / MB.pageGeom(MB.state).pxPerU * 100) + '%'; };

/* ---------- file picking ---------- */
UI.pickFiles = (accept = 'image/*', multiple = true) => new Promise((res) => {
  const inp = h('input', { type: 'file', accept, multiple });
  inp.addEventListener('change', () => res([...inp.files]));
  inp.click();
});

/* ---------- actions on model ---------- */
UI.addImagesToCard = async (c, files) => {
  if (!c) return;
  files = files || await UI.pickFiles();
  if (!files.length) return;
  for (const f of files) {
    const a = await MB.fileToAsset(f);
    const slot = c.variants.find(v => !v.asset);
    if (slot) slot.asset = a.id; else c.variants.push(MB.newVariant({ asset: a.id }));
  }
  MB.sel = { kind: 'card', id: c.id }; UI.tab = 'sel';
  MB.commit(); UI.rebuild();
  UI.toast(`เพิ่ม ${files.length} รูปให้ ${c.name}`);
};
UI.addFooterLogos = async (files) => {
  files = files || await UI.pickFiles();
  for (const f of files) { const a = await MB.fileToAsset(f); MB.state.footer.logos.push({ id: MB.uid('l'), asset: a.id, scale: 1, dx: 0, dy: 0 }); }
  MB.state.footer.on = true;
  MB.commit(); UI.rebuild();
};
UI.replaceElementImage = async (el) => {
  const [f] = await UI.pickFiles('image/*', false); if (!f) return;
  const a = await MB.fileToAsset(f), cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  el.asset = a.id; el.h = el.w * a.h / a.w; el.x = cx - el.w / 2; el.y = cy - el.h / 2; el.name = el.role === 'logo' ? 'Event Logo' : a.name;
  MB.commit(); UI.rebuild();
};
UI.setEventLogo = async () => {
  const [f] = await UI.pickFiles('image/*', false); if (!f) return;
  const a = await MB.fileToAsset(f), st = MB.state, G = MB.pageGeom(st);
  let el = st.elements.find(e => e.role === 'logo');
  if (el) { const cx = el.x + el.w / 2, cy = el.y + el.h / 2; el.asset = a.id; el.h = el.w * a.h / a.w; el.x = cx - el.w / 2; el.y = cy - el.h / 2; }
  else {
    const maxH = Math.max(60, st.layout.top - G.bleedU - 30) * 0.75, ar = a.w / a.h;
    let w = Math.min(560, maxH * ar), hh = w / ar;
    el = { id: MB.uid('e'), type: 'image', role: 'logo', name: 'Event Logo', asset: a.id, x: 500 - w / 2, y: G.bleedU + (st.layout.top - G.bleedU - hh) / 2, w, h: hh, rot: 0, op: 1, locked: false, behind: false };
    st.elements.push(el);
    const title = st.elements.find(e => e.role === 'title');
    if (title && title.y < el.y + hh) title.y = el.y + hh + 4;
  }
  MB.sel = { kind: 'el', id: el.id };
  MB.commit(); UI.rebuild();
};
UI.addText = () => {
  const st = MB.state;
  const el = { id: MB.uid('e'), type: 'text', name: 'Text', text: 'ข้อความ', font: MB.F_BOLD, size: 28, color: '#2C3A4B', align: 'center', lh: 1.15, x: 500, y: 200, rot: 0, op: 1, locked: false, behind: false, fx: MB.defaultFx() };
  st.elements.push(el); MB.sel = { kind: 'el', id: el.id }; UI.tab = 'sel';
  MB.commit(); UI.rebuild(); UI.focusText();
};
UI.addDecor = async () => {
  const files = await UI.pickFiles(); if (!files.length) return;
  const st = MB.state; let i = 0;
  for (const f of files) {
    const a = await MB.fileToAsset(f), w = 200, hh = w * a.h / a.w;
    st.elements.push({ id: MB.uid('e'), type: 'image', name: a.name, asset: a.id, x: 400 + i * 24, y: 300 + i * 24, w, h: hh, rot: 0, op: 1, locked: false, behind: false });
    i++;
  }
  MB.sel = { kind: 'el', id: st.elements[st.elements.length - 1].id }; UI.tab = 'sel';
  MB.commit(); UI.rebuild();
};
UI.focusText = () => setTimeout(() => { const t = document.querySelector('#rbody textarea'); if (t) { t.focus(); t.select(); } }, 30);
UI.addCard = () => {
  const st = MB.state, A = MB.contentArea(st);
  const c = MB.newCard({ x: A.x0 + 10, y: A.y0 + 10, w: 260, h: 220, variants: [MB.newVariant()], page: st.curPage });
  st.cards.push(c); MB.sel = { kind: 'card', id: c.id }; UI.tab = 'sel';
  MB.commit(); UI.rebuild();
  setTimeout(() => { const t = document.querySelector('#rbody input[type=text]'); if (t) { t.focus(); t.select(); } }, 30);
};
UI.autoLayout = () => {
  const locked = MB.state.cards.filter(c => c.locked).length;
  MB.animateLayout(() => MB.autoLayout(MB.state)); MB.commit(); UI.rebuild();
  UI.toast('จัดวางอัตโนมัติแล้ว' + (locked ? ` (ข้าม ${locked} การ์ดที่ล็อกไว้)` : '') + ' — Ctrl+Z เพื่อย้อน');
};
const selObjs = () => MB.selAll().map(s => ({ s, o: MB.findSel(s) })).filter(x => x.o);
UI.deleteSel = () => {
  const st = MB.state, all = MB.selAll(); if (!all.length) return;
  const ids = new Set(all.map(s => s.id)), hadCards = all.some(s => s.kind === 'card');
  st.cards = st.cards.filter(c => !ids.has(c.id)); st.elements = st.elements.filter(e => !ids.has(e.id)); st.footer.logos = st.footer.logos.filter(l => !ids.has(l.id));
  if (hadCards && st.layout.reflow) MB.animateLayout(() => MB.autoLayout(st)); // the rest close the gap
  MB.sel = null; MB.commit(); UI.rebuild();
};
UI.duplicateSel = () => {
  const st = MB.state, out = [];
  selObjs().forEach(({ s, o }) => {
    if (s.kind === 'flogo') return;
    const c = JSON.parse(JSON.stringify(o)); c.id = MB.uid(s.kind === 'card' ? 'c' : 'e'); c.x += 20; c.y += 20; c.locked = false; delete c.role;
    if (s.kind === 'card') { c.variants.forEach(v => { v.id = MB.uid('v'); }); c.hero = false; st.cards.splice(st.cards.indexOf(o) + 1, 0, c); }
    else st.elements.splice(st.elements.indexOf(o) + 1, 0, c);
    out.push({ kind: s.kind, id: c.id });
  });
  if (!out.length) return;
  MB.selectMany(out); MB.commit(); UI.rebuild();
};
UI.selectAll = () => { MB.selectMany(MB.pageCards(MB.state).filter(c => !c.hidden).map(c => ({ kind: 'card', id: c.id }))); UI.onSelect(); MB.requestRender(); };
const boxOf = (s, o) => s.kind === 'el' && o.type === 'text' ? MB.textBox(o) : { x: o.x, y: o.y, w: o.w, h: o.h };
const unionBox = (bs) => { const x0 = Math.min(...bs.map(b => b.x)), y0 = Math.min(...bs.map(b => b.y)), x1 = Math.max(...bs.map(b => b.x + b.w)), y1 = Math.max(...bs.map(b => b.y + b.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
const movable = () => selObjs().filter(x => x.s.kind !== 'flogo' && !x.o.locked);
/* align to the selection's bounds (or to the product area when only one thing is selected) */
UI.align = (how) => {
  const items = movable(); if (!items.length) return;
  const bs = items.map(x => boxOf(x.s, x.o)), A = MB.contentArea(MB.state);
  const ref = items.length === 1 ? { x: A.x0, y: A.y0, w: A.W, h: A.H } : unionBox(bs);
  items.forEach((x, i) => {
    const b = bs[i]; let dx = 0, dy = 0;
    if (how === 'l') dx = ref.x - b.x; else if (how === 'c') dx = ref.x + ref.w / 2 - (b.x + b.w / 2); else if (how === 'r') dx = ref.x + ref.w - (b.x + b.w);
    else if (how === 't') dy = ref.y - b.y; else if (how === 'm') dy = ref.y + ref.h / 2 - (b.y + b.h / 2); else if (how === 'b') dy = ref.y + ref.h - (b.y + b.h);
    x.o.x += dx; x.o.y += dy;
  });
  MB.commit(); UI.refreshSel();
};
/* equal gaps between the selected items (or a fixed gap when given) */
UI.distribute = (axis, fixedGap) => {
  const items = movable().map(x => Object.assign(x, { b: boxOf(x.s, x.o) }));
  if (items.length < (fixedGap == null ? 3 : 2)) { UI.toast(fixedGap == null ? 'เลือกอย่างน้อย 3 ชิ้นเพื่อเว้นระยะเท่ากัน' : 'เลือกอย่างน้อย 2 ชิ้น'); return; }
  const P = axis === 'h' ? 'x' : 'y', S = axis === 'h' ? 'w' : 'h';
  items.sort((a, b) => a.b[P] - b.b[P]);
  const first = items[0].b, last = items[items.length - 1].b;
  const gap = fixedGap != null ? fixedGap : ((last[P] + last[S]) - first[P] - items.reduce((s, x) => s + x.b[S], 0)) / (items.length - 1);
  let pos = first[P];
  items.forEach(x => { x.o[P] += pos - x.b[P]; pos += x.b[S] + gap; });
  MB.commit(); UI.refreshSel();
};
/* same width / height as the last-clicked item */
UI.matchSize = (dim) => {
  const ref = MB.findSel(MB.sel), items = movable().filter(x => !(x.s.kind === 'el' && x.o.type === 'text'));
  if (!ref || items.length < 2) { UI.toast('เลือกอย่างน้อย 2 ชิ้น (ชิ้นที่คลิกล่าสุด = ขนาดอ้างอิง)'); return; }
  items.forEach(({ o }) => {
    if (o === ref) return;
    if (o.type === 'image') { const k = dim === 'h' ? ref.h / o.h : ref.w / o.w; o.w *= k; o.h *= k; }
    else { if (dim !== 'h') o.w = ref.w; if (dim !== 'w') o.h = ref.h; }
  });
  MB.commit(); UI.refreshSel();
};
let styleClip = null;
UI.copyStyle = () => {
  const c = MB.findSel(MB.sel); if (!c || MB.sel.kind !== 'card') { UI.toast('เลือกการ์ดที่จะคัดลอกสไตล์ก่อน'); return; }
  styleClip = JSON.parse(JSON.stringify({ style: c.style || {}, imgScale: c.imgScale, rows: c.rows, noBadge: c.noBadge, noSub: c.noSub }));
  UI.toast('คัดลอกสไตล์การ์ดแล้ว — เลือกการ์ดอื่นแล้วกด Ctrl+Shift+V');
};
UI.pasteStyle = () => {
  if (!styleClip) { UI.toast('ยังไม่ได้คัดลอกสไตล์ (Ctrl+Shift+C)'); return; }
  const cards = selObjs().filter(x => x.s.kind === 'card'); cards.forEach(({ o }) => Object.assign(o, JSON.parse(JSON.stringify(styleClip))));
  MB.commit(); UI.rebuild(); UI.toast(`วางสไตล์ให้ ${cards.length} การ์ด`);
};
UI.moveCardsToPage = (cards, pid) => {
  const st = MB.state, froms = new Set(cards.map(c => c.page));
  MB.animateLayout(() => {
    cards.forEach(c => { st.cards.splice(st.cards.indexOf(c), 1); st.cards.push(c); c.page = pid; });
    if (st.layout.reflow) { froms.forEach(p => MB.autoLayout(st, p)); MB.autoLayout(st, pid); }
    else { const A = MB.contentArea(st); cards.forEach((c, i) => { c.x = A.x0 + 10 + i * 15; c.y = A.y0 + 10 + i * 15; }); }
  });
  MB.sel = null; MB.commit(); UI.rebuild();
  UI.toast(`ย้าย ${cards.length} สินค้า → ${MB.pageLabel(st, pid)}`);
};
UI.trimAll = async () => {
  const st = MB.state, ids = MB.usedAssetIds(st).filter(id => id !== st.bg.asset && MB.assets[id].mime === 'image/png');
  UI.toast(`กำลังตัดขอบใส ${ids.length} รูป…`, 8000);
  let n = 0;
  for (const id of ids) {
    const a = MB.assets[id], t = await MB.trimTransparent(a.data); if (!t) continue;
    a.data = t.data; await MB.decodeAsset(a); MB.assetChanged(id); n++;
    st.elements.forEach(e => { if (e.asset === id && e.type === 'image') { const cy = e.y + e.h / 2; e.h = e.w * a.h / a.w; e.y = cy - e.h / 2; } });
  }
  MB.commit(); UI.rebuild(); UI.toast(`ตัดขอบใสแล้ว ${n} รูป`);
};
const moveIn = (arr, item, d) => { const i = arr.indexOf(item), j = MB.clamp(i + d, 0, arr.length - 1); if (i < 0 || i === j) return; arr.splice(i, 1); arr.splice(j, 0, item); };
UI.nudge = (dx, dy) => {
  selObjs().forEach(({ s, o }) => { if (o.locked) return; if (s.kind === 'flogo') { o.dx = (o.dx || 0) + dx; o.dy = (o.dy || 0) + dy; } else { o.x += dx; o.y += dy; } });
  MB.touch(); clearTimeout(UI._nt); UI._nt = setTimeout(() => { MB.commit(); UI.refreshSel(); }, 400);
};

/* ---------- pages ---------- */
UI.switchPage = (pid) => {
  const st = MB.state; if (!MB.pageOf(st, pid) || st.curPage === pid) return;
  st.curPage = pid; MB.sel = null; MB.touch(); UI.rebuild(); renderPageBar();
};
UI.moveCardToPage = (c, pid, before) => {
  const st = MB.state, from = c.page; if (!c) return;
  MB.animateLayout(() => {
    st.cards.splice(st.cards.indexOf(c), 1);
    let idx = before && before !== c ? st.cards.indexOf(before) : -1;
    if (idx < 0) { let last = -1; st.cards.forEach((x, k) => { if (x.page === pid) last = k; }); idx = last < 0 ? st.cards.length : last + 1; }
    st.cards.splice(idx, 0, c); c.page = pid;
    if (st.layout.reflow) { MB.autoLayout(st, from); if (pid !== from) MB.autoLayout(st, pid); }
    else if (pid !== from) { const A = MB.contentArea(st); c.x = A.x0 + 10; c.y = A.y0 + 10; }
  });
  if (MB.sel && MB.sel.id === c.id && pid !== st.curPage) MB.sel = null;
  MB.commit(); UI.rebuild();
  if (pid !== from) UI.toast(`ย้าย ${String(c.name).replace(/\n/g, ' ')} → ${MB.pageLabel(st, pid)}`);
};
UI.addPage = (after) => {
  const st = MB.state, p = MB.newPage(), i = after ? MB.pageIndex(st, after) + 1 : st.pages.length;
  st.pages.splice(i, 0, p); st.curPage = p.id; MB.sel = null;
  MB.commit(); UI.rebuild(); renderPageBar();
};
UI.duplicatePage = (pid) => {
  const st = MB.state, i = MB.pageIndex(st, pid), src = st.pages[i], p = MB.newPage(src.name ? src.name + ' (สำเนา)' : '');
  st.pages.splice(i + 1, 0, p);
  MB.pageCards(st, pid).forEach(c => { const d = JSON.parse(JSON.stringify(c)); d.id = MB.uid('c'); d.page = p.id; d.variants.forEach(v => { v.id = MB.uid('v'); }); st.cards.push(d); });
  st.curPage = p.id; MB.sel = null; MB.commit(); UI.rebuild(); renderPageBar();
};
UI.deletePage = (pid) => {
  const st = MB.state; if (st.pages.length < 2) { UI.toast('ต้องมีอย่างน้อย 1 หน้า'); return; }
  const i = MB.pageIndex(st, pid), n = MB.pageCards(st, pid).length, to = st.pages[i > 0 ? i - 1 : 1];
  if (n && !confirm(`ลบ ${MB.pageLabel(st, pid)}? สินค้า ${n} รายการในหน้านี้จะถูกย้ายไป ${MB.pageLabel(st, to.id)}`)) return;
  st.cards.forEach(c => { if (c.page === pid) c.page = to.id; });
  st.elements.forEach(e => { if (e.page === pid) e.page = null; });
  st.pages.splice(i, 1);
  if (st.layout.reflow && n) MB.autoLayout(st, to.id);
  st.curPage = to.id; MB.sel = null; MB.commit(); UI.rebuild(); renderPageBar();
};
UI.renamePage = (pid) => {
  const p = MB.pageOf(MB.state, pid), n = prompt('ชื่อหน้า (เช่น DUANG GO ROUND, BOKBEAR)', p.name || '');
  if (n == null) return; p.name = n.trim(); MB.commit(); UI.rebuild(); renderPageBar();
};
UI.movePage = (pid, beforePid) => {
  const st = MB.state, p = MB.pageOf(st, pid); if (pid === beforePid) return;
  st.pages.splice(MB.pageIndex(st, pid), 1);
  const j = beforePid ? MB.pageIndex(st, beforePid) : st.pages.length;
  st.pages.splice(j < 0 ? st.pages.length : j, 0, p);
  MB.commit(); UI.rebuild(); renderPageBar();
};
UI.splitDialog = (preset) => {
  const st = MB.state, hasCol = st.cards.some(c => c.collection);
  const o = Object.assign({ perPage: 6, byCollection: hasCol }, preset);
  const info = h('div', { class: 'hint' });
  const upd = () => {
    const tmp = JSON.parse(JSON.stringify(st)); const n = MB.splitPages(tmp, o);
    info.textContent = `จะได้ ${n} หน้า: ` + tmp.pages.map((p, i) => `${i + 1}) ${p.name || 'หน้า'} — ${tmp.cards.filter(c => c.page === p.id).length} สินค้า`).join(' · ');
  };
  const body = h('div', { class: 'col' },
    UI.row('สินค้าต่อหน้า (ประมาณ)', UI.num(o, 'perPage', { min: 1, max: 30, step: 1, digits: 0, silent: true, onset: upd })),
    hasCol ? UI.chk(o, 'byCollection', 'แยกหน้าตามคอลเลกชัน (เช่น DUANG GO ROUND / DMD CHARACTERS)', upd, true) : null,
    hint('การ์ดที่มีหลายแบบมาก (เช่น POSTER 14 แบบ) นับเป็นหลายช่อง จึงอาจได้หน้าของตัวเอง · ลำดับสินค้าตามรายการด้านซ้าย'),
    info, hint('⚠ จะจัดหน้าใหม่ทั้งหมด (Ctrl+Z ย้อนได้)'));
  upd();
  UI.modal('แบ่งหน้าอัตโนมัติ', body, [btn('ยกเลิก', () => UI.closeModal()), btn('แบ่งหน้า', () => {
    const n = MB.splitPages(st, o); MB.sel = null; UI.closeModal(); MB.commit(); UI.rebuild(); renderPageBar(); MB.fitView();
    UI.toast(`แบ่งเป็น ${n} หน้าแล้ว`);
  }, 'primary')]);
};
UI.pageHover = (pid) => { document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('drophover', !!pid && el.dataset.page === pid)); };
let menuEl = null;
UI.menu = (x, y, items) => {
  if (menuEl) menuEl.remove();
  menuEl = h('div', { class: 'ctxmenu', style: `left:${x}px;top:${y}px` }, items.map(([l, fn, cls]) => h('button', { class: cls || '', onclick: () => { menuEl.remove(); menuEl = null; fn(); } }, l)));
  document.body.append(menuEl);
  const r = menuEl.getBoundingClientRect(); if (r.bottom > innerHeight) menuEl.style.top = (y - r.height) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (menuEl && !menuEl.contains(e.target)) { menuEl.remove(); menuEl = null; } document.removeEventListener('mousedown', off); }), 0);
};
const pageMenu = (pid, e) => {
  e.preventDefault();
  const st = MB.state, i = MB.pageIndex(st, pid);
  UI.menu(e.clientX, e.clientY, [
    ['✎ เปลี่ยนชื่อหน้า', () => UI.renamePage(pid)],
    ['✦ จัดวางอัตโนมัติหน้านี้', () => { MB.animateLayout(() => MB.autoLayout(st, pid)); MB.commit(); }],
    ['⧉ ทำซ้ำหน้า', () => UI.duplicatePage(pid)],
    ['＋ แทรกหน้าว่างถัดไป', () => UI.addPage(pid)],
    ['◀ เลื่อนไปซ้าย', () => UI.movePage(pid, st.pages[i - 1] && st.pages[i - 1].id)],
    ['▶ เลื่อนไปขวา', () => UI.movePage(pid, st.pages[i + 2] ? st.pages[i + 2].id : null)],
    ['🗑 ลบหน้า', () => UI.deletePage(pid), 'danger'],
  ]);
};
/* drag & drop: cards (from list / canvas) onto pages; pages onto pages to reorder */
const DT_CARD = 'text/mb-card', DT_PAGE = 'text/mb-page';
function dropTarget(el, pid, beforeCard) {
  el.addEventListener('dragover', (e) => {
    const t = e.dataTransfer.types;
    if (t.includes(DT_CARD) || t.includes(DT_PAGE) || t.includes('Files')) { e.preventDefault(); el.classList.add('drophover'); }
  });
  el.addEventListener('dragleave', () => el.classList.remove('drophover'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('drophover');
    const cid = e.dataTransfer.getData(DT_CARD), pg = e.dataTransfer.getData(DT_PAGE);
    if (cid) { e.preventDefault(); e.stopPropagation(); const c = MB.state.cards.find(x => x.id === cid); if (c) UI.moveCardToPage(c, pid, beforeCard); }
    else if (pg) { e.preventDefault(); e.stopPropagation(); UI.movePage(pg, pid); }
  });
}
const thumbs = {};
let thumbT = 0;
function refreshThumbs() {
  clearTimeout(thumbT);
  thumbT = setTimeout(() => {
    const st = MB.state; if (!st) return;
    st.pages.forEach(p => { try { thumbs[p.id] = MB.renderThumb(st, p.id, 150).toDataURL('image/jpeg', 0.75); } catch (e) {} });
    document.querySelectorAll('#pagebar .pg').forEach(el => { const im = el.querySelector('img'); if (im && thumbs[el.dataset.page]) im.src = thumbs[el.dataset.page]; });
  }, 500);
}
function renderPageBar() {
  const st = MB.state, bar = $('#pagebar'); if (!bar) return;
  bar.innerHTML = '';
  const list = h('div', { class: 'pglist' });
  st.pages.forEach((p, i) => {
    const n = MB.pageCards(st, p.id).length;
    const el = h('div', { class: 'pg' + (p.id === st.curPage ? ' on' : ''), 'data-page': p.id, draggable: 'true', title: 'คลิก = เปิดหน้า · ดับเบิลคลิก = เปลี่ยนชื่อ · คลิกขวา = เมนู · ลากการ์ดมาวาง = ย้ายสินค้ามาหน้านี้',
      onclick: () => UI.switchPage(p.id), ondblclick: () => UI.renamePage(p.id), oncontextmenu: (e) => pageMenu(p.id, e) },
      h('div', { class: 'pgth' }, h('img', { src: thumbs[p.id] || '', alt: '' })),
      h('div', { class: 'pgl' }, h('b', null, String(i + 1)), h('span', null, p.name || 'หน้า ' + (i + 1)), h('small', null, n)));
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData(DT_PAGE, p.id); e.dataTransfer.effectAllowed = 'move'; });
    dropTarget(el, p.id);
    list.append(el);
  });
  bar.append(list, h('div', { class: 'pgact' },
    btn('＋ หน้าใหม่', () => UI.addPage()), btn('แบ่งหน้าอัตโนมัติ…', () => UI.splitDialog())));
  refreshThumbs();
}
UI.renderPageBar = renderPageBar;

/* ---------- left: product list (grouped by page) ---------- */
function reorderCard(c, d) {
  const st = MB.state, list = MB.pageCards(st, c.page), j = list.indexOf(c) + d;
  if (j < 0 || j >= list.length) return;
  const other = list[j], a = st.cards.indexOf(c), b = st.cards.indexOf(other);
  const swap = () => { st.cards[a] = other; st.cards[b] = c; if (st.layout.reflow && !c.locked) MB.autoLayout(st, c.page); };
  if (st.layout.reflow && !c.locked) MB.animateLayout(swap); else swap();
  MB.commit();
}
function renderList() {
  const st = MB.state, box = $('#cardList'), q = ($('#search').value || '').trim().toLowerCase();
  $('#cardCount').textContent = `(${st.cards.length})`;
  box.innerHTML = '';
  st.pages.forEach((pg) => {
    const all = MB.pageCards(st, pg.id), cards = all.filter(c => !q || `${c.name} ${c.sku} ${c.price} ${c.collection}`.toLowerCase().includes(q));
    if (q && !cards.length) return;
    const head = h('div', { class: 'pgh' + (pg.id === st.curPage ? ' on' : ''), 'data-page': pg.id, onclick: () => UI.switchPage(pg.id), oncontextmenu: (e) => pageMenu(pg.id, e) },
      h('b', null, MB.pageLabel(st, pg.id)), h('span', null, `${all.length} สินค้า`));
    dropTarget(head, pg.id);
    box.append(head);
    cards.forEach((c, i) => {
      const imgs = c.variants.filter(v => v.asset).length, first = c.variants.find(v => v.asset);
      const item = h('div', { class: 'ci' + (MB.isSel(c.id) ? ' on' : '') + (c.hidden ? ' hid' : '') + (imgs < c.variants.length || !c.variants.length ? ' miss' : ''), draggable: 'true',
        onclick: (e) => {
          if (st.curPage !== c.page) { st.curPage = c.page; MB.sel = null; renderPageBar(); }
          if ((e.shiftKey || e.ctrlKey || e.metaKey || MB.multiMode) && MB.sel) MB.toggleSel({ kind: 'card', id: c.id }); else MB.sel = { kind: 'card', id: c.id };
          UI.tab = 'sel'; MB.requestRender(); UI.rebuild();
        } },
        first ? thumb(first.asset) : h('div', { class: 'th empty' }, String(i + 1)),
        h('div', { class: 'cim' }, h('div', { class: 'cin' }, c.locked ? '🔒 ' : '', String(c.name || '(ไม่มีชื่อ)').replace(/\n/g, ' ')),
          h('div', { class: 'cid' }, [MB.fmtPrice(c.price, st.theme.price.format) || (c.variants.some(v => v.price) ? 'ราคาแยกแบบ' : 'ไม่มีราคา'), `${c.variants.length} แบบ`, `รูป ${imgs}/${c.variants.length}`].join(' · ')),
          c.flag ? h('div', { class: 'cflag' }, '● ' + c.flag) : null),
        h('div', { class: 'cia' },
          h('button', { title: 'เลื่อนขึ้น', onclick: (e) => { e.stopPropagation(); reorderCard(c, -1); } }, '▲'),
          h('button', { title: 'เลื่อนลง', onclick: (e) => { e.stopPropagation(); reorderCard(c, 1); } }, '▼')));
      item.addEventListener('dragstart', (e) => { e.dataTransfer.setData(DT_CARD, c.id); e.dataTransfer.effectAllowed = 'move'; });
      dropTarget(item, pg.id, c);
      item.addEventListener('drop', (e) => { const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); if (fs.length) { e.preventDefault(); UI.addImagesToCard(c, fs); } });
      box.append(item);
    });
  });
}

/* ---------- right panel ---------- */
const TABS = [['page', 'กระดาษ'], ['brand', 'โลโก้ & BG'], ['style', 'สไตล์'], ['layers', 'เลเยอร์'], ['sel', 'ที่เลือก']];
function renderTabs() {
  const nav = $('#rtabs'); nav.innerHTML = '';
  TABS.forEach(([id, l]) => nav.append(h('button', { class: UI.tab === id ? 'on' : '', onclick: () => { UI.tab = id; UI.rebuild(); } }, l)));
}
UI.rebuild = () => {
  if (!MB.state) return;
  renderTabs();
  const body = $('#rbody'), sc = body.scrollTop; body.innerHTML = '';
  const f = { page: tabPage, brand: tabBrand, style: tabStyle, layers: tabLayers, sel: tabSel }[UI.tab];
  body.append(...[].concat(f()).filter(x => x != null)); // append() would print null as text
  body.scrollTop = sc;
  renderList(); UI.soft();
};
UI.onSelect = () => { if (MB.sel && UI.tab !== 'layers') UI.tab = 'sel'; UI.rebuild(); };
UI.refreshSel = () => { if (UI.tab === 'sel' && !document.activeElement.closest('#rbody')) UI.rebuild(); else renderList(); };
let softQ = false;
UI.soft = () => {
  if (softQ) return; softQ = true;
  requestAnimationFrame(() => {
    softQ = false;
    if (!document.activeElement || !document.activeElement.closest('#left')) renderList();
    $('[data-act=undo]').disabled = !MB.canUndo(); $('[data-act=redo]').disabled = !MB.canRedo();
    const st = MB.state, G = MB.pageGeom(st);
    $('#stPage').textContent = (st.page.unit === 'mm' ? `${st.page.preset !== 'Custom' ? st.page.preset + ' · ' : ''}${MB.round(st.page.w, 1)}×${MB.round(st.page.h, 1)} mm · ` : '') + `${G.Wpx}×${G.Hpx} px · ${st.page.dpi} dpi`;
    if ($('#projName') !== document.activeElement) $('#projName').value = st.name;
    $('#stPageNo').textContent = `${MB.pageLabel(st, st.curPage)} / ${st.pages.length} หน้า`;
    if (!document.querySelector('#pagebar .pg') || document.querySelectorAll('#pagebar .pg').length !== st.pages.length) renderPageBar(); else refreshThumbs();
    clearTimeout(UI._pf); UI._pf = setTimeout(() => { const n = MB.preflight(MB.state).filter(x => x.lv === 'warn').length; const b = $('#preflightBtn'); b.textContent = n ? `ตรวจงาน (${n})` : 'ตรวจงาน ✓'; b.classList.toggle('warn', !!n); }, 300);
  });
};

/* ----- tab: page ----- */
function tabPage() {
  const st = MB.state, p = st.page, du = MB.dispUnit(st);
  const pageChanged = () => {
    MB.touch(); UI.zoomLabel();
    const G = MB.pageGeom(st), over = st.cards.some(c => c.y + c.h > G.HU || c.x + c.w > 1000);
    if (over && confirm('ขนาดกระดาษเปลี่ยน — จัดวางสินค้าใหม่ให้พอดีหรือไม่?')) MB.autoLayout(st);
    MB.commit(); MB.fitView(); UI.rebuild();
  };
  const preset = UI.sel(p, 'preset', [...Object.keys(MB.PAPERS).map(k => [k, k]), ['Custom', 'กำหนดเอง']], () => {
    const P = MB.PAPERS[p.preset]; if (P) Object.assign(p, { unit: P.unit, w: P.w, h: P.h, dpi: P.dpi });
  });
  preset.addEventListener('change', pageChanged);
  const unitSel = UI.sel(p, 'unit', [['mm', 'มิลลิเมตร (งานพิมพ์)'], ['px', 'พิกเซล (โซเชียล)']], () => {
    if (p.unit === 'px') { p.w = Math.round(p.w / 25.4 * p.dpi); p.h = Math.round(p.h / 25.4 * p.dpi); }
    else { p.w = MB.round(p.w / p.dpi * 25.4, 1); p.h = MB.round(p.h / p.dpi * 25.4, 1); }
    p.preset = 'Custom';
  });
  unitSel.addEventListener('change', pageChanged);
  const dimInput = (k) => { const inp = h('input', { type: 'number', value: p[k], step: p.unit === 'px' ? 1 : 0.1, min: 1 }); inp.addEventListener('change', () => { const v = parseFloat(inp.value); if (v > 0) { p[k] = v; p.preset = 'Custom'; pageChanged(); } }); return inp; };
  const dpi = h('input', { type: 'number', value: p.dpi, min: 36, max: 1200, step: 1 });
  dpi.addEventListener('change', () => { const v = parseInt(dpi.value, 10); if (v >= 36) { p.dpi = v; pageChanged(); } });
  const G = MB.pageGeom(st), L = st.layout;
  return [
    section('ขนาดกระดาษ',
      UI.row('ขนาด', preset), UI.row('หน่วย', unitSel),
      UI.row('กว้าง × สูง', h('div', { class: 'pair' }, dimInput('w'), h('span', null, '×'), dimInput('h'), h('span', null, p.unit))),
      UI.row('', btn('⟲ สลับแนวตั้ง/แนวนอน', () => { [p.w, p.h] = [p.h, p.w]; pageChanged(); })),
      UI.row('ความละเอียด', h('div', { class: 'pair' }, dpi, h('span', null, 'dpi'), ...[72, 150, 300].map(v => btn(String(v), () => { p.dpi = v; pageChanged(); }, 'small')))),
      p.unit === 'mm' ? UI.row('ตัดตก (bleed)', UI.num(p, 'bleed', { step: 0.5, min: 0, digits: 1, suffix: 'mm', onset: () => UI.zoomLabel() })) : null,
      hint(`ไฟล์ที่ได้: ${G.Wpx} × ${G.Hpx} px` + (p.unit === 'mm' ? ` · รวม bleed ${MB.round(G.wmm, 1)} × ${MB.round(G.hmm, 1)} mm` : ''))),
    section('พื้นที่จัดวางสินค้า',
      UI.row('ขอบกระดาษ', UI.num(L, 'margin', { scale: du.k, digits: du.d, step: du.d ? 0.5 : 1, suffix: du.name })),
      UI.row('พื้นที่หัว (โลโก้งาน)', UI.num(L, 'top', { scale: du.k, digits: du.d, step: du.d ? 1 : 5, suffix: du.name })),
      UI.row('ระยะห่างการ์ด', UI.num(L, 'gap', { scale: du.k, digits: du.d, step: du.d ? 0.5 : 1, suffix: du.name })),
      UI.row('รูปแบบหลัก (ทุกหน้า)', UI.sel(L, 'mode', MB.LAYOUT_MODES, () => UI.rebuild())),
      ['grid', 'bento', 'masonry'].includes(L.mode) ? UI.row('จำนวนคอลัมน์', UI.num(L, 'cols', { min: 1, max: 12, step: 1, digits: 0 })) : null,
      h('div', { class: 'brow' }, btn('✦ จัดวางอัตโนมัติ', UI.autoLayout, 'primary')),
      UI.chk(L, 'reflow', 'ลากสลับตำแหน่ง (การ์ดอื่นเลื่อนหลบให้อัตโนมัติ)'),
      UI.chk(L, 'guides', 'แสดงเส้นไกด์'),
      hint('ลากการ์ดไปวางทับการ์ดอื่น = สลับตำแหน่ง การ์ดที่เหลือเลื่อนหลบให้เอง · กด Alt ค้างขณะลาก = ย้ายอิสระ (มีเส้นไกด์ช่วยจัดแนว) · ลากมุมเพื่อย่อขยาย · การ์ดที่ล็อกไว้จะไม่ถูกจัดใหม่ · เปลี่ยน "น้ำหนักการ์ด" ในแท็บ ที่เลือก เพื่อให้การ์ดใหญ่ขึ้น')),
    pageLayoutSec(),
  ];
}

function pageLayoutSec() {
  const st = MB.state, pg = MB.pageOf(st), L = st.layout;
  if (pg.mode == null) pg.mode = '';
  if (pg.cols == null) pg.cols = 0;
  const pm = MB.layoutMode(st), relayout = () => { MB.animateLayout(() => MB.autoLayout(st)); UI.rebuild(); };
  return section('การจัดวางเฉพาะ ' + MB.pageLabel(st, st.curPage),
    UI.row('รูปแบบ', UI.sel(pg, 'mode', [['', 'ตามรูปแบบหลัก'], ...MB.LAYOUT_MODES], relayout)),
    ['grid', 'bento', 'masonry'].includes(pm) ? UI.row('คอลัมน์', UI.sel(pg, 'cols', [[0, 'ตามค่าหลัก (' + L.cols + ')'], ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, n + ' คอลัมน์'])], relayout)) : null,
    pm === 'shelf' ? [UI.row('ความหนาชั้นวาง', UI.rng(L, 'shelfH', 2, 40, 0.5, { onset: () => MB.autoLayout(st) })), UI.row('สีชั้นวาง', UI.col(L, 'shelfColor'))] : null,
    pm === 'bento' ? hint('Bento: กำหนด "ช่องกว้าง × ช่องสูง" ของแต่ละการ์ดในแท็บ ที่เลือก หรือย่อขยายการ์ดแล้วระบบปัดเข้าช่องให้') : null,
    pm === 'hero' ? hint('Hero: ติ๊ก "การ์ดเด่น" ในแท็บ ที่เลือก (ถ้าไม่ติ๊ก ใช้การ์ดแรกของหน้า)') : null,
    pm === 'masonry' ? hint('Masonry: การ์ดเรียงลงตามคอลัมน์ ความสูงตามรูปสินค้า') : null,
    h('div', { class: 'brow' }, btn('✦ จัดหน้านี้ใหม่', () => { MB.animateLayout(() => MB.autoLayout(st)); MB.commit(); }, 'primary'),
      btn('ใช้กับทุกหน้า', () => { st.pages.forEach(p => { p.mode = pg.mode; p.cols = pg.cols; MB.autoLayout(st, p.id); }); MB.commit(); UI.toast('ใช้รูปแบบนี้กับทุกหน้าแล้ว'); })),
    hint('ลากร่องระหว่างการ์ด (เคอร์เซอร์ ↔ / ↕) = ขยายใบหนึ่ง อีกใบหดให้ · ย่อขยายการ์ดแล้ว ระบบจำขนาดไว้ตอนจัดวางใหม่'));
}

/* ----- tab: brand (logo, bg, footer logos, decor) ----- */
function tabBrand() {
  const st = MB.state, du = MB.dispUnit(st), logo = st.elements.find(e => e.role === 'logo'), f = st.footer;
  const logoSec = section('โลโก้งาน / คอน / ซีรีส์',
    logo ? h('div', { class: 'assetrow' }, thumb(logo.asset, 'thb'), h('div', { class: 'col' },
      btn('เลือกเพื่อปรับบนหน้างาน', () => { MB.sel = { kind: 'el', id: logo.id }; UI.tab = 'sel'; MB.requestRender(); UI.rebuild(); }),
      btn('เปลี่ยนรูปโลโก้', UI.setEventLogo),
      btn('ลบ', () => { st.elements = st.elements.filter(e => e !== logo); MB.sel = null; MB.commit(); UI.rebuild(); }, 'danger'))) : null,
    logo ? [UI.row('ความกว้าง', UI.rng(logo, 'w', 40, 1000, 1, { fmt: v => Math.round(v / 10) + '%', onset: () => { const a = MB.assets[logo.asset]; const cx = logo.x + logo.w / 2, cy = logo.y + logo.h / 2; logo.h = logo.w * a.h / a.w; logo.x = cx - logo.w / 2; logo.y = cy - logo.h / 2; } })),
      UI.row('หมุน', UI.rng(logo, 'rot', -180, 180, 0.5, { fmt: v => v + '°' })),
      UI.row('ความทึบ', UI.rng(logo, 'op', 0, 1, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
      h('div', { class: 'brow' }, btn('จัดกึ่งกลางแนวนอน', () => { logo.x = 500 - logo.w / 2; MB.commit(); }), btn('รีเซ็ตการหมุน', () => { logo.rot = 0; MB.commit(); UI.rebuild(); }))]
      : h('div', { class: 'brow' }, btn('⬆ อัปโหลดโลโก้งาน', UI.setEventLogo, 'primary')),
    hint('PNG พื้นใส จะดีที่สุด · ลากโลโก้บนหน้างานเพื่อย้าย ลากมุมเพื่อย่อขยาย จุดกลมด้านบนเพื่อหมุน (Shift = ทีละ 15°)'));
  const bgSec = section('พื้นหลัง (ทำใน Photoshop แล้วนำมาใส่)',
    st.bg.asset ? h('div', { class: 'assetrow' }, thumb(st.bg.asset, 'thb'), h('div', { class: 'col' },
      btn('เปลี่ยนรูปพื้นหลัง', pickBg), btn('ลบรูปพื้นหลัง', () => { st.bg.asset = null; MB.commit(); UI.rebuild(); }, 'danger')))
      : h('div', { class: 'brow' }, btn('⬆ อัปโหลดพื้นหลัง', pickBg, 'primary')),
    UI.row('การวางรูป', UI.sel(st.bg, 'fit', [['cover', 'เต็มกระดาษ (ครอปส่วนเกิน)'], ['contain', 'พอดี (ไม่ครอป)'], ['stretch', 'ยืดให้เต็ม']])),
    UI.row('ความทึบรูป', UI.rng(st.bg, 'opacity', 0, 1, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
    UI.row('สีพื้น', UI.col(st.bg, 'color')),
    hint(`แนะนำให้ทำ BG ขนาด ${MB.pageGeom(st).Wpx}×${MB.pageGeom(st).Hpx} px แล้ว Export เป็น PNG/JPG`));
  const footSec = section('โลโก้ค่าย (ท้ายกระดาษ)',
    UI.chk(f, 'on', 'แสดงแถบโลโก้ท้ายกระดาษ', () => UI.rebuild()),
    f.on ? [
      h('div', { class: 'logolist' }, f.logos.map((l, i) => h('div', { class: 'lgi' + (MB.sel && MB.sel.id === l.id ? ' on' : '') },
        thumb(l.asset, 'ths'),
        h('div', { class: 'col grow' }, UI.rng(l, 'scale', 0.2, 3, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
        h('div', { class: 'cia' },
          h('button', { title: 'ซ้าย', onclick: () => { moveIn(f.logos, l, -1); MB.commit(); UI.rebuild(); } }, '◀'),
          h('button', { title: 'ขวา', onclick: () => { moveIn(f.logos, l, 1); MB.commit(); UI.rebuild(); } }, '▶'),
          h('button', { title: 'รีเซ็ตตำแหน่ง', onclick: () => { l.dx = 0; l.dy = 0; MB.commit(); } }, '⌖'),
          h('button', { title: 'ลบ', class: 'danger', onclick: () => { f.logos.splice(i, 1); MB.commit(); UI.rebuild(); } }, '✕'))))),
      h('div', { class: 'brow' }, btn('⬆ เพิ่มโลโก้ (เลือกได้หลายไฟล์)', () => UI.addFooterLogos(), 'primary')),
      UI.row('ความสูงแถบ', UI.num(f, 'h', { scale: du.k, digits: du.d, step: du.d ? 0.5 : 1, suffix: du.name })),
      UI.row('จัดวาง', UI.sel(f, 'align', [['center', 'กึ่งกลาง'], ['spread', 'กระจายเต็มแถบ'], ['left', 'ชิดซ้าย'], ['right', 'ชิดขวา']])),
      UI.row('ระยะห่างโลโก้', UI.rng(f, 'gap', 0, 200, 1)),
      UI.row('สีแถบ', UI.col(f, 'fill')), UI.row('ความทึบแถบ', UI.rng(f, 'opacity', 0, 1, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
      hint('ปรับขนาดแต่ละโลโก้ด้วยแถบเลื่อน หรือคลิกโลโก้บนหน้างานแล้วลากมุม / ลากเพื่อขยับตำแหน่ง')] : null);
  const decoSec = section('ตกแต่ง & ข้อความ',
    h('div', { class: 'brow' }, btn('+ รูปตกแต่ง / สติกเกอร์', UI.addDecor), btn('+ ข้อความ', UI.addText)),
    h('div', { class: 'brow' }, btn(MB.PWA ? '✦ คลังลายฟรี' : '✦ คลังลายฟรี / ✨ AI', () => MB.aiUI.open('decor')), btn('นำเข้า SVG…', async () => { const f = await UI.pickFiles('.svg,image/svg+xml'); if (f.length) { const ids = await MB.aiUI.importSvgFiles(f, 'decor'); ids.forEach(id => MB.aiUI.placeVector(id)); } })),
    h('div', { class: 'ellist' }, st.elements.map(e => h('div', { class: 'eli' + (MB.sel && MB.sel.id === e.id ? ' on' : ''), onclick: () => { MB.sel = { kind: 'el', id: e.id }; UI.tab = 'sel'; MB.requestRender(); UI.rebuild(); } },
      e.type !== 'text' ? thumb(e.asset, 'ths') : h('div', { class: 'ths tt' }, 'T'),
      h('span', null, (e.role === 'logo' ? '★ ' : '') + (e.type === 'text' ? e.text.split('\n')[0] : e.name)), e.behind ? h('small', null, 'หลังการ์ด') : null))));
  return [logoSec, bgSec, footSec, decoSec];
}
async function pickBg() {
  const [f] = await UI.pickFiles('image/*', false); if (!f) return;
  const a = await MB.fileToAsset(f); MB.state.bg.asset = a.id; MB.commit(); UI.rebuild();
}

/* visual picker: small drawings of each shape */
function shapeIcon(kind, mode) {
  const c = document.createElement('canvas'), dpr = window.devicePixelRatio || 1; c.width = 64 * dpr; c.height = 40 * dpr; c.style.width = '64px'; c.style.height = '40px';
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const t = MB.state.theme, fill = mode === 'card' ? '#FFFFFF' : t.price.fill, prims = [];
  if (mode === 'card') {
    const th = Object.assign({}, t, { panel: Object.assign({}, t.panel, { on: true, shape: kind, fill: '#FFFFFF', opacity: 1, stroke: '#9AA6BA', strokeW: 1.2 }) });
    if (kind === 'rounded') prims.push({ t: 'rect', x: 6, y: 5, w: 52, h: 30, r: 6, fill, stroke: '#9AA6BA', sw: 1.2 });
    else prims.push(...MB.shapePanel(th, 6, 5, 52, 30));
  } else MB.shapeTag(kind, t.price, prims, 4, 6, 56, 28);
  x.fillStyle = '#EEF2F8'; x.fillRect(0, 0, 64, 40);
  MB.drawPrims(x, prims, 1, { editor: true });
  return c;
}
const vecLibIds = (role) => (MB.state.vecLib || []).filter(id => MB.assets[id] && (!role || MB.assets[id].role === role));
const tagShapes = () => [...MB.TAG_SHAPES, ...vecLibIds('tag').map(id => ['vec:' + id, MB.assets[id].name])];
/* style controls for vector elements: recolour / outline / sticker edge */
function vecStyleRows(o, key) {
  if (o[key] == null) o[key] = o.recolor ? 'mono' : 'original';
  if (o.color2 == null) o.color2 = '#FFFFFF';
  if (o.ow == null) o.ow = 0.05;
  const s = o[key];
  return [UI.row('สไตล์', UI.sel(o, key, MB.VSTYLES, () => UI.rebuild())),
    s !== 'original' && s !== 'sticker' ? UI.row(s === 'outline' ? 'สีเส้น' : 'สี', UI.col(o, 'color')) : null,
    s === 'sticker' ? UI.row('สีขอบ', UI.col(o, 'color2')) : null,
    s === 'outline' || s === 'sticker' ? UI.row('ความหนาขอบ', UI.rng(o, 'ow', 0.01, 0.15, 0.005, { fmt: v => Math.round(v * 100) + '%' })) : null];
}
function ornSec(t) {
  t.orn = Object.assign({}, MB.defaultTheme().orn, t.orn);
  if (t.orn.style == null) t.orn.style = t.orn.mono ? 'mono' : 'original';
  const lib = vecLibIds(), opts = [['', '— ไม่มี —'], ...lib.map(id => [id, MB.assets[id].name])];
  const sec = section('สัญลักษณ์หัว / ท้าย ชื่อสินค้า และราคา',
    lib.length ? [UI.row('หน้าชื่อ', UI.sel(t.orn, 'titlePre', opts)), UI.row('ท้ายชื่อ', UI.sel(t.orn, 'titlePost', opts)),
      UI.row('หน้าราคา', UI.sel(t.orn, 'pricePre', opts)), UI.row('ท้ายราคา', UI.sel(t.orn, 'pricePost', opts)),
      UI.row('ขนาด', UI.rng(t.orn, 'size', 0.4, 1.6, 0.01, { fmt: v => Math.round(v * 100) + '%' })), UI.row('ระยะห่าง', UI.rng(t.orn, 'gap', 0, 1, 0.01)),
      UI.row('สไตล์', UI.sel(t.orn, 'style', MB.VSTYLES.filter(v => v[0] !== 'sticker').map(([k, l]) => [k, k === 'mono' || k === 'main' ? l + ' (สีตัวอักษร)' : k === 'outline' ? l + ' (สีตัวอักษร)' : l]), () => UI.rebuild()))] : hint(MB.PWA ? 'ยังไม่มีสัญลักษณ์ — เลือกจากคลังลายฟรี' : 'ยังไม่มีสัญลักษณ์ — เลือกจากคลังลายฟรี หรือสร้างด้วย AI'),
    h('div', { class: 'brow' }, btn(MB.PWA ? '✦ คลังลายฟรี' : '✦ คลังลายฟรี / ✨ AI', () => MB.aiUI.open('orn')), btn('นำเข้า SVG…', async () => { const f = await UI.pickFiles('.svg,image/svg+xml'); if (f.length) MB.aiUI.importSvgFiles(f, 'orn'); })));
  sec.open = !!(t.orn.titlePre || t.orn.titlePost || t.orn.pricePre || t.orn.pricePost);
  return sec;
}
/* A/B/C background: circle, none, or any library / imported vector as a one-colour silhouette */
const BADGE_NO_CATS = new Set(['ป้ายราคา']), badgeThumbs = new Map();
const badgeThumb = (key, vec, col) => { const k = key + '|' + col; if (!badgeThumbs.has(k)) badgeThumbs.set(k, MB.vecThumbRaw(vec, 44, col)); return badgeThumbs.get(k); };
function badgeShapePicker(b) {
  if (b.shape == null) b.shape = 'circle';
  const cur = String(b.shape), col = b.fill || '#29A3E3';
  const pick = (v) => { b.shape = v; if (v.startsWith('vec:') && (b.vscale == null)) b.vscale = 1.4; MB.commit(); UI.rebuild(); };
  const cell = (on, title, child, fn) => h('button', { class: 'bshape' + (on ? ' on' : ''), title, onclick: fn }, child);
  const circle = h('span', { style: `display:inline-block;width:22px;height:22px;border-radius:50%;background:${col}` });
  const libKeyOf = (id) => MB.assets[id] && MB.assets[id].libKey;
  const curLib = cur.startsWith('vec:') ? libKeyOf(cur.slice(4)) : null;
  const items = [
    cell(cur === 'circle', 'วงกลม', circle, () => pick('circle')),
    cell(cur === 'none', 'ไม่มีพื้น (ตัวอักษรอย่างเดียว)', h('span', { style: 'font-weight:700' }, 'A'), () => pick('none')),
    ...MB.VLIB.filter(it => !BADGE_NO_CATS.has(it.cat)).map(it => cell(curLib === it.key, it.name,
      h('img', { src: badgeThumb(it.key, MB.vlibVector(it.key), col), alt: '' }), () => pick('vec:' + MB.vlibAsset(it.key).id))),
    ...(MB.state.vecLib || []).filter(id => MB.assets[id] && !MB.assets[id].libKey).map(id => cell(cur === 'vec:' + id, MB.assets[id].name,
      h('img', { src: badgeThumb(id, MB.assets[id].vec, col), alt: '' }), () => pick('vec:' + id))),
  ];
  return h('div', { class: 'col' }, h('div', { class: 'lbl' }, 'พื้นหลังตัวอักษร (สีเดียว)'), h('div', { class: 'bshapes' }, items),
    h('div', { class: 'brow' }, btn('นำเข้า SVG ของตัวเอง…', async () => { const f = await UI.pickFiles('.svg,image/svg+xml'); if (!f.length) return; const ids = await MB.aiUI.importSvgFiles(f, 'decor'); if (ids && ids[0]) pick('vec:' + ids[0]); })));
}
/* liquid glass card: blurred backdrop + sheen + rim light */
function glassSec(P) {
  const g = P.glass = Object.assign({}, MB.defaultTheme().panel.glass, P.glass), pct = { fmt: v => Math.round(v * 100) + '%' };
  const sec = section('เอฟเฟกต์กระจก (Liquid Glass)',
    UI.chk(g, 'on', 'การ์ดกระจก — เบลอพื้นหลังที่อยู่ใต้การ์ด', () => {
      if (g.on) { P.on = true; if (P.opacity > 0.4) P.opacity = 0.18; }
      setTimeout(UI.rebuild);
    }),
    g.on ? [
      UI.row('เบลอพื้นหลัง', UI.rng(g, 'blur', 0, 40, 0.5)),
      UI.row('ความสดสี', UI.rng(g, 'sat', 0.5, 2.5, 0.05, pct)),
      UI.row('ฝ้าขาว', UI.rng(g, 'frost', 0, 0.6, 0.01, pct)),
      UI.row('แสงสะท้อน', UI.rng(g, 'shine', 0, 1, 0.01, pct)),
      UI.row('ขอบแสง', UI.rng(g, 'edge', 0, 1, 0.01, pct)),
      UI.row('เงาใต้การ์ด', UI.rng(g, 'shadow', 0, 1, 0.01, pct)),
      hint('สีพื้น + ความทึบ (ด้านบน) = สีย้อมกระจก · ทึบน้อย = ใสมาก'),
    ] : null);
  sec.open = g.on;
  return sec;
}
function shapePicker(o, k, list, mode) {
  return h('div', { class: 'shapes' }, list.map(([id, label]) => h('button', { class: 'shp' + ((o[k] || list[0][0]) === id ? ' on' : ''), title: label,
    onclick: () => { o[k] = id; MB.commit(); UI.rebuild(); } }, shapeIcon(id, mode), h('small', null, label))));
}
function trimRow() {
  const pref = { on: MB.trimPref() };
  return h('div', { class: 'col' },
    UI.chk(pref, 'on', 'ตัดขอบใสของ PNG อัตโนมัติตอนนำเข้ารูป', () => { try { localStorage.setItem('mb_trim', pref.on ? '1' : '0'); } catch (e) {} }, true),
    btn('ตัดขอบใสรูปที่มีอยู่ทั้งหมดตอนนี้', UI.trimAll));
}

/* ----- colour schemes from the logo / background ----- */
const textOn = (hex) => MB.luma(hex) > 0.62 ? '#2C2C3A' : '#FFFFFF';
function buildSchemes(pal) {
  if (!pal.length) return [];
  const vivid = pal.filter(c => c.s > 0.25 && c.l > 0.18 && c.l < 0.85);
  const p1 = (vivid[0] || pal[0]), hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const p2 = vivid.find(c => hueGap(c.h, p1.h) > 35) || { h: (p1.h + 40) % 360, s: p1.s, l: p1.l };
  const S = Math.max(p1.s, 0.45);
  const tone = (c, l, s) => MB.hslHex(c.h, s != null ? s : Math.max(c.s, 0.45), l);
  const mk = (name, o) => Object.assign({ name }, o, { priceColor: textOn(o.priceFill), badgeColor: textOn(o.badgeFill) });
  return [
    mk('สดใส', { panelFill: '#FFFFFF', panelOp: 0.88, title: tone(p1, 0.36), priceFill: tone(p1, 0.52), badgeFill: tone(p1, 0.52), bar: tone(p1, 0.9, 0.6), note: '#3A3F4D', sub: tone(p1, 0.3), tag: tone(p2, 0.55) }),
    mk('พาสเทล', { panelFill: tone(p1, 0.96, 0.6), panelOp: 0.92, title: tone(p1, 0.42), priceFill: tone(p2, 0.68, 0.7), badgeFill: tone(p2, 0.62, 0.65), bar: tone(p2, 0.9, 0.6), note: tone(p1, 0.35, 0.25), sub: tone(p1, 0.35), tag: tone(p2, 0.55) }),
    mk('เข้มหรู', { panelFill: tone(p1, 0.13, 0.35), panelOp: 0.88, title: tone(p2, 0.8, 0.75), priceFill: tone(p2, 0.6, 0.75), badgeFill: tone(p2, 0.6, 0.75), bar: tone(p1, 0.22, 0.4), note: '#E9E6F2', sub: '#F2EEF8', tag: tone(p1, 0.55, S) }),
    mk('คู่สี', { panelFill: '#FFFFFF', panelOp: 0.8, title: tone(p2, 0.34), priceFill: tone(p1, 0.5), badgeFill: tone(p2, 0.48), bar: tone(p2, 0.9, 0.55), note: '#3A3F4D', sub: tone(p2, 0.3), tag: tone(p1, 0.5) }),
  ];
}
function applyScheme(t, sc) {
  Object.assign(t.panel, { on: true, fill: sc.panelFill, opacity: sc.panelOp });
  t.title.color = sc.title; t.price.fill = sc.priceFill; t.price.color = sc.priceColor;
  t.badge.fill = sc.badgeFill; t.badge.color = sc.badgeColor; t.bar.fill = sc.bar;
  t.note.color = sc.note; t.sub.color = sc.sub; t.terms.color = sc.note; t.tag.fill = sc.tag; t.tag.color = textOn(sc.tag);
}
function schemePreview(sc) {
  const t = JSON.parse(JSON.stringify(MB.state.theme)); applyScheme(t, sc);
  const card = MB.newCard({ x: 4, y: 4, w: 232, h: 150, name: 'SAMPLE', price: 390, variants: [MB.newVariant(), MB.newVariant()] });
  const c = document.createElement('canvas'), dpr = window.devicePixelRatio || 1; c.width = 240 * dpr; c.height = 158 * dpr; c.style.width = '100%';
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  x.fillStyle = MB.state.bg.color || '#EEF2F8'; x.fillRect(0, 0, 240, 158);
  const bg = MB.assets[MB.state.bg.asset]; if (bg && bg.view) { x.globalAlpha = 0.9; x.drawImage(bg.view, 0, 0, 240, 158); x.globalAlpha = 1; }
  MB.drawPrims(x, MB.cardPrims(card, t).prims, 1, { editor: true });
  return c;
}
function paletteSec() {
  const st = MB.state, logo = st.elements.find(e => e.role === 'logo');
  const pick = (ids) => {
    if (!ids.length) { UI.toast('ยังไม่มีรูปให้ดึงสี — ใส่โลโก้งานหรือพื้นหลังก่อน'); return; }
    const pal = MB.extractPalette(ids); UI._palette = { pal, schemes: buildSchemes(pal) }; UI.rebuild();
  };
  const P = UI._palette;
  return section('ชุดสีจากโลโก้ / BG',
    h('div', { class: 'brow' },
      btn('ดึงจากโลโก้', () => pick(logo ? [logo.asset] : [])), btn('ดึงจาก BG', () => pick(st.bg.asset ? [st.bg.asset] : [])),
      btn('ทั้งคู่', () => pick([logo && logo.asset, st.bg.asset].filter(Boolean)))),
    P ? [
      h('div', { class: 'swatches' }, P.pal.map(c => h('span', { class: 'sw', style: `background:${c.hex}`, title: c.hex + ' (คลิกคัดลอก)', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(c.hex); UI.toast('คัดลอก ' + c.hex); } }))),
      h('div', { class: 'schemes' }, P.schemes.map(sc => h('button', { class: 'scheme', title: 'คลิกเพื่อใช้ชุดสีนี้', onclick: () => { applyScheme(st.theme, sc); MB.commit(); UI.rebuild(); UI.toast('ใช้ชุดสี "' + sc.name + '" แล้ว'); } },
        schemePreview(sc), h('b', null, sc.name)))),
      hint('คลิกการ์ดตัวอย่างเพื่อใช้ชุดสีนั้นกับพื้นการ์ด ชื่อสินค้า ป้ายราคา A/B/C และป้ายสถานะ · Ctrl+Z ย้อนได้')]
      : hint('ระบบจะหยิบสีเด่นจากรูปแล้วแนะนำชุดสี 4 แบบให้เลือก'));
}

/* ----- tab: card style ----- */
function tabStyle() {
  const st = MB.state, t = st.theme, fu = MB.fontUnit(st);
  const fsz = (o) => UI.num(o, 'size', { scale: fu.k, digits: fu.d, step: fu.d ? 0.5 : 1, suffix: fu.name, min: 1 });
  const presets = h('div', { class: 'presets' }, Object.entries(MB.STYLE_PRESETS).map(([id, p]) => h('button', { class: t.preset === id ? 'on' : '', onclick: () => { p.apply(t); t.preset = id; MB.commit(); UI.rebuild(); } }, p.label)));
  const saved = (() => { try { return JSON.parse(localStorage.getItem('mb_styles') || '{}'); } catch (e) { return {}; } })();
  const savedSec = section('สไตล์ที่บันทึกไว้ (ใช้ซ้ำข้ามงาน)',
    h('div', { class: 'ellist' }, Object.keys(saved).length ? Object.keys(saved).map(name => h('div', { class: 'eli' },
      h('span', { class: 'grow' }, name),
      btn('ใช้', () => { st.theme = MB.migrate(Object.assign({}, st, { theme: JSON.parse(JSON.stringify(saved[name])) })).theme; MB.walkFonts(st, MB.registerFont); MB.commit(); UI.rebuild(); }, 'small'),
      btn('✕', () => { delete saved[name]; localStorage.setItem('mb_styles', JSON.stringify(saved)); UI.rebuild(); }, 'small danger'))) : hint('ยังไม่มี')),
    btn('💾 บันทึกสไตล์ปัจจุบัน', () => { const n = prompt('ตั้งชื่อสไตล์', st.name); if (n) { saved[n] = t; localStorage.setItem('mb_styles', JSON.stringify(saved)); UI.rebuild(); } }));
  return [
    paletteSec(),
    section('รูปแบบการ์ด', presets,
      UI.row('ตำแหน่งชื่อสินค้า', UI.sel(t, 'titlePos', [['top', 'ด้านบน'], ['bottom', 'ด้านล่าง']])),
      UI.row('แสดงราคา', UI.sel(t, 'priceMode', [['pill', 'ป้ายราคาแยก'], ['inline', 'ต่อท้ายชื่อ'], ['below', 'บรรทัดใต้ชื่อ']])),
      UI.row('จัดชิด', UI.sel(t, 'align', [['left', 'ซ้าย'], ['center', 'กึ่งกลาง']])),
      UI.row('สัญลักษณ์หน้าชื่อ', UI.txt(t, 'bullet', { placeholder: 'เช่น ◆  หรือ ❖ ' })),
      UI.row('จัดรูปในช่อง', UI.sel(t, 'imgAlign', [['center', 'กึ่งกลาง'], ['bottom', 'ชิดล่าง (วางบนชั้น)']])),
      UI.chk(t, 'uniformImg', 'รูปสินค้าสูงเท่ากันทุกการ์ดในหน้า'),
      trimRow(),
      UI.row('ระยะขอบในการ์ด', UI.rng(t, 'pad', 0, 40, 0.5)),
      UI.row('ระยะห่างรูป', UI.rng(t, 'imgGap', 0, 40, 0.5))),
    section('พื้นการ์ด',
      UI.chk(t.panel, 'on', 'แสดงพื้นการ์ด'),
      shapePicker(t.panel, 'shape', MB.CARD_SHAPES, 'card'),
      t.panel.shape === 'cloud' ? UI.row('ขนาดปุยเมฆ', UI.rng(t.panel, 'bump', 0.04, 0.2, 0.005, { fmt: v => Math.round(v * 100) + '%' })) : null,
      t.panel.shape === 'polaroid' ? UI.row('สีช่องรูป', UI.col(t.panel, 'inner')) : null,
      UI.row('สีพื้น', UI.col(t.panel, 'fill')), UI.row('ความทึบ', UI.rng(t.panel, 'opacity', 0, 1, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
      UI.row('ความโค้งมุม', UI.rng(t.panel, 'radius', 0, 60, 0.5)),
      UI.row('เส้นขอบ', UI.rng(t.panel, 'strokeW', 0, 8, 0.1)), UI.row('สีเส้นขอบ', UI.col(t.panel, 'stroke'))),
    glassSec(t.panel),
    section('แถบชื่อสินค้า',
      UI.row('แบบ', UI.sel(t.bar, 'mode', [['none', 'ไม่มี'], ['full', 'เต็มความกว้างการ์ด'], ['fit', 'พอดีข้อความ (แท็ก)']])),
      UI.row('สีแถบ', UI.col(t.bar, 'fill')), UI.row('ความทึบ', UI.rng(t.bar, 'opacity', 0, 1, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
      UI.row('ความโค้งมุม', UI.rng(t.bar, 'radius', 0, 40, 0.5))),
    section('ชื่อสินค้า', UI.row('ฟอนต์', UI.fontSel(t.title, 'font')), UI.row('ขนาด', fsz(t.title)), UI.row('สี', UI.col(t.title, 'color')), UI.chk(t.title, 'upper', 'ตัวพิมพ์ใหญ่ทั้งหมด')),
    fxEditor(t.title, 'เอฟเฟกต์ชื่อสินค้า (ทุกการ์ด)'),
    ornSec(t),
    section('ราคา', t.priceMode === 'pill' ? [shapePicker(t.price, 'shape', tagShapes(), 'tag'),
      h('div', { class: 'brow' }, btn(MB.PWA ? '✦ ป้ายราคาจากคลังลาย' : '✦ ป้ายราคาจากคลังลาย / ✨ AI', () => MB.aiUI.open('tag'))),
      String(t.price.shape).startsWith('vec:') ? UI.chk(t.price, 'vecRecolor', 'ป้ายจาก AI ใช้สีป้ายของธีม') : null] : hint('ทรงป้ายราคาใช้กับแบบ "ป้ายราคาแยก" (ตั้งที่ รูปแบบการ์ด › แสดงราคา)'),
      UI.row('ฟอนต์', UI.fontSel(t.price, 'font')), UI.row('ขนาด', fsz(t.price)),
      UI.row('สีตัวเลขบนป้าย', UI.col(t.price, 'color')), UI.row('สีป้าย / สีราคาแบบไม่มีป้าย, ต่อท้าย', UI.col(t.price, 'fill')),
      UI.row('รูปแบบราคา', UI.sel(t.price, 'format', [['{p}.-', '290.-'], ['{p} THB', '290 THB'], ['{p}THB', '290THB'], ['฿{p}', '฿290'], ['{p} บาท', '290 บาท']]))),
    section('หมายเหตุใต้ชื่อ', UI.row('ฟอนต์', UI.fontSel(t.note, 'font')), UI.row('ขนาด', fsz(t.note)), UI.row('สี', UI.col(t.note, 'color'))),
    section('ป้ายสถานะ (PRE-ORDER, วันที่ ฯลฯ)', UI.row('ฟอนต์', UI.fontSel(t.tag, 'font')), UI.row('ขนาด', fsz(t.tag)),
      UI.row('สีป้าย', UI.col(t.tag, 'fill')), UI.row('สีตัวอักษร', UI.col(t.tag, 'color')), UI.row('ความโค้งมุม', UI.rng(t.tag, 'radius', 0, 20, 0.5)),
      hint('แบบป้ายราคาแยก: ป้ายสถานะอยู่ใต้ราคา · แบบอื่น: อยู่บรรทัดใต้ชื่อ')),
    section('เงื่อนไขสินค้า', UI.row('ตำแหน่ง', UI.sel(t.terms, 'pos', [['bottom', 'ท้ายการ์ด'], ['top', 'ใต้ชื่อ / ราคา']])),
      UI.row('ฟอนต์', UI.fontSel(t.terms, 'font')), UI.row('ขนาด', fsz(t.terms)), UI.row('สี', UI.col(t.terms, 'color'))),
    section('ตัวอักษร A / B / C', UI.chk(t.badge, 'on', 'แสดง (เมื่อมีมากกว่า 1 แบบ)'), UI.row('ฟอนต์', UI.fontSel(t.badge, 'font')), UI.row('ขนาด', fsz(t.badge)),
      badgeShapePicker(t.badge),
      UI.row(t.badge.shape === 'none' ? 'สี (ไม่ใช้)' : 'สีพื้นหลังตัวอักษร', UI.col(t.badge, 'fill')), UI.row('สีตัวอักษร', UI.col(t.badge, 'color')),
      String(t.badge.shape).startsWith('vec:') ? [UI.row('ขนาดรูปทรง', UI.rng(t.badge, 'vscale', 1, 2.4, 0.05, { fmt: v => Math.round(v * 100) + '%' })),
        UI.row('เลื่อนตัวอักษรขึ้น/ลง', UI.rng(t.badge, 'ty', -0.3, 0.3, 0.01))] : null),
    section('ชื่อแบบย่อย (เช่น 001, 002)', UI.row('ตำแหน่ง', UI.sel(t, 'subPos', [['above', 'บนรูป (ใต้ตัวอักษร A/B/C)'], ['below', 'ใต้รูป']])), UI.row('ฟอนต์', UI.fontSel(t.sub, 'font')), UI.row('ขนาด', fsz(t.sub)), UI.row('สี', UI.col(t.sub, 'color'))),
    savedSec,
  ];
}

/* ----- text effects editor (shared by text elements and card titles) ----- */
const FX_PRESETS = [
  ['ไม่มี', () => {}],
  ['สติกเกอร์', (fx) => { fx.stroke = { on: true, color: '#FFFFFF', w: 5 }; Object.assign(fx.shadow, { on: true, op: 0.35, dist: 3, blur: 6 }); }],
  ['นีออน', (fx, o) => { fx.glow = { on: true, color: o.color === '#FFFFFF' ? '#FF4FD8' : o.color, op: 0.95, size: 16 }; fx.stroke = { on: true, color: fx.glow.color, w: 1.2 }; o.color = '#FFFFFF'; }],
  ['ทอง', (fx, o) => { o.color = '#FFE9A3'; fx.grad = { on: true, c2: '#C58A1E', angle: -90 }; fx.bevel = { on: true, size: 4, hl: '#FFFFFF', sh: '#6B3E00' }; fx.stroke = { on: true, color: '#5A3300', w: 2 }; fx.shadow = { on: true, color: '#000000', op: 0.4, dist: 3, angle: 120, blur: 4 }; }],
  ['ไล่สีพาสเทล', (fx, o) => { o.color = '#FF8FD1'; fx.grad = { on: true, c2: '#7FB7FF', angle: 0 }; fx.stroke = { on: true, color: '#FFFFFF', w: 3 }; fx.shadow = { on: true, color: '#3A2A6B', op: 0.35, dist: 3, angle: 120, blur: 5 }; }],
  ['เงาลึก 3D', (fx) => { fx.shadow = { on: true, color: '#1A1A40', op: 0.85, dist: 6, angle: 120, blur: 0 }; fx.stroke = { on: true, color: '#FFFFFF', w: 2 }; }],
];
function fxEditor(o, title) {
  const fx = o.fx = MB.fixFx(o.fx);
  const pct = (v) => Math.round(v * 100) + '%', deg = (v) => v + '°';
  const sub = (label, key, ...rows) => h('div', { class: 'fxs' + (fx[key].on ? ' on' : '') },
    UI.chk(fx[key], 'on', label, () => UI.rebuild()), fx[key].on ? h('div', { class: 'fxb' }, ...rows) : null);
  return section(title || 'เอฟเฟกต์ข้อความ (Layer Style)',
    h('div', { class: 'presets fxp' }, FX_PRESETS.map(([n, fn]) => btn(n, () => {
      Object.assign(fx, MB.defaultFx()); fn(fx, o);
      const k = (o.size || 40) / 40; // preset sizes are tuned for a 40 U headline
      fx.stroke.w *= k; fx.shadow.dist *= k; fx.shadow.blur *= k; fx.glow.size *= k; fx.bevel.size *= k;
      MB.commit(); UI.rebuild();
    }))),
    UI.row('ระยะตัวอักษร', UI.rng(fx, 'track', -100, 600, 5)),
    UI.chk(fx, 'bold', 'ตัวหนาเพิ่ม (Faux Bold)'),
    sub('ไล่สี (Gradient)', 'grad', UI.row('สีเริ่ม', UI.col(o, 'color')), UI.row('สีจบ', UI.col(fx.grad, 'c2')), UI.row('มุม', UI.rng(fx.grad, 'angle', -180, 180, 1, { fmt: deg }))),
    sub('เส้นขอบ (Stroke)', 'stroke', UI.row('สี', UI.col(fx.stroke, 'color')), UI.row('ความหนา', UI.rng(fx.stroke, 'w', 0.2, 20, 0.1))),
    sub('เงา (Drop Shadow)', 'shadow', UI.row('สี', UI.col(fx.shadow, 'color')), UI.row('ความทึบ', UI.rng(fx.shadow, 'op', 0, 1, 0.01, { fmt: pct })),
      UI.row('ระยะ', UI.rng(fx.shadow, 'dist', 0, 40, 0.5)), UI.row('ทิศทางแสง', UI.rng(fx.shadow, 'angle', -180, 180, 1, { fmt: deg })), UI.row('ความเบลอ', UI.rng(fx.shadow, 'blur', 0, 40, 0.5))),
    sub('เรืองแสง (Outer Glow)', 'glow', UI.row('สี', UI.col(fx.glow, 'color')), UI.row('ความทึบ', UI.rng(fx.glow, 'op', 0, 1, 0.01, { fmt: pct })), UI.row('ขนาด', UI.rng(fx.glow, 'size', 1, 60, 0.5))),
    sub('นูน (Bevel & Emboss)', 'bevel', UI.row('ขนาด', UI.rng(fx.bevel, 'size', 0.5, 20, 0.1)), UI.row('สีไฮไลต์', UI.col(fx.bevel, 'hl')), UI.row('สีเงา', UI.col(fx.bevel, 'sh'))),
    hint('PSD/PSB: ส่งออกเป็น Layer Style จริง ดับเบิลคลิกแก้ต่อใน Photoshop ได้ · AI: มีเส้นขอบ ไล่สี เงา เรืองแสง แต่ไม่มี Bevel และเงาจะไม่เบลอ'));
}

/* ----- tab: selection ----- */
function tabSel() {
  if (MB.selAll().length > 1) return inspMulti();
  const s = MB.sel, o = MB.findSel(s);
  if (!o) return [hint('คลิกเลือกการ์ดสินค้า โลโก้ หรือข้อความบนหน้างาน'), hint('ทางลัด: ลากการ์ด = สลับตำแหน่ง (Alt+ลาก = ย้ายอิสระ) · Shift/Ctrl+คลิก หรือลากกรอบ = เลือกหลายชิ้น · Ctrl+A = การ์ดทั้งหน้า · Ctrl+Alt+ลากรูปในการ์ด = เลื่อนรูป · Alt+ล้อเมาส์บนรูป = ย่อขยายรูป · ลากจากไม้บรรทัด = เส้นไกด์ · Delete ลบ · Ctrl+D ทำซ้ำ · ลูกศร ขยับ (Shift = 10 เท่า) · Ctrl+Z ย้อน · Space+ลาก เลื่อนหน้างาน · Ctrl+ล้อเมาส์ ซูม · ดับเบิลคลิกการ์ด = เพิ่มรูป')];
  if (s.kind === 'card') return inspCard(o);
  if (s.kind === 'flogo') return inspLogo(o);
  return o.type === 'text' ? inspText(o) : inspImage(o);
}
function tabLayers() {
  const st = MB.state, pid = st.curPage, rows = [];
  const zMove = (sel, obj, d) => {
    if (sel.kind === 'card') { const list = MB.pageCards(st), j = list.indexOf(obj) + d; if (j >= 0 && j < list.length) { const a = st.cards.indexOf(obj), b = st.cards.indexOf(list[j]); st.cards[a] = list[j]; st.cards[b] = obj; if (st.layout.reflow) MB.animateLayout(() => MB.autoLayout(st)); } }
    else if (sel.kind === 'el') moveIn(st.elements, obj, d);
    else moveIn(st.footer.logos, obj, d);
    MB.commit(); UI.rebuild();
  };
  const row = (sel, obj, name, icon) => rows.push(h('div', { class: 'lyr' + (MB.isSel(sel.id) ? ' on' : '') + (obj.hidden ? ' hid' : ''),
    onclick: (e) => { if ((e.shiftKey || e.ctrlKey || e.metaKey || MB.multiMode) && sel.kind !== 'flogo' && MB.sel) MB.toggleSel(sel); else MB.sel = sel; MB.requestRender(); UI.rebuild(); } },
    h('button', { class: 'eye', title: 'ซ่อน / แสดง', onclick: (e) => { e.stopPropagation(); obj.hidden = !obj.hidden; if (sel.kind === 'card' && st.layout.reflow) MB.animateLayout(() => MB.autoLayout(st)); MB.commit(); UI.rebuild(); } }, obj.hidden ? '◌' : '👁'),
    sel.kind !== 'flogo' ? h('button', { class: 'eye', title: 'ล็อก / ปลดล็อก', onclick: (e) => { e.stopPropagation(); obj.locked = !obj.locked; MB.commit(); UI.rebuild(); } }, obj.locked ? '🔒' : '🔓') : h('span', { class: 'eye' }),
    h('span', { class: 'lic' }, icon), h('span', { class: 'lnm' }, name),
    h('div', { class: 'cia' }, h('button', { title: 'ขึ้นบน', onclick: (e) => { e.stopPropagation(); zMove(sel, obj, 1); } }, '▲'), h('button', { title: 'ลงล่าง', onclick: (e) => { e.stopPropagation(); zMove(sel, obj, -1); } }, '▼'))));
  const els = st.elements.filter(e => MB.onPage(e, pid));
  els.filter(e => !e.behind).slice().reverse().forEach(e => row({ kind: 'el', id: e.id }, e, e.type === 'text' ? String(e.text).split('\n')[0] : (e.role === 'logo' ? 'โลโก้งาน' : e.name), e.type === 'text' ? 'T' : '🖼'));
  if (st.footer.on) st.footer.logos.slice().reverse().forEach(l => row({ kind: 'flogo', id: l.id }, l, 'โลโก้ค่าย ' + ((MB.assets[l.asset] || {}).name || ''), '▭'));
  MB.pageCards(st).slice().reverse().forEach(c => row({ kind: 'card', id: c.id }, c, String(c.name).replace(/\n/g, ' '), '▦'));
  els.filter(e => e.behind).slice().reverse().forEach(e => row({ kind: 'el', id: e.id }, e, (e.type === 'text' ? String(e.text).split('\n')[0] : e.name) + ' (หลังการ์ด)', e.type === 'text' ? 'T' : '🖼'));
  return [section('เลเยอร์ · ' + MB.pageLabel(st, pid), h('div', { class: 'lyrs' }, rows, h('div', { class: 'lyr bgl' }, h('span', { class: 'lic' }, '▤'), h('span', { class: 'lnm' }, 'พื้นหลัง (ตั้งค่าที่แท็บ โลโก้ & BG)'))),
    hint('บนสุด = อยู่หน้าสุด · ลำดับการ์ดใช้เป็นลำดับตอนจัดวางอัตโนมัติด้วย · 👁 ซ่อนแล้วจะไม่ถูกส่งออก · Shift+คลิก = เลือกหลายชิ้น'))];
}
function pageSelect(cur, onPick) {
  const st = MB.state, s = h('select', null, st.pages.map(p => h('option', { value: p.id, selected: p.id === cur }, MB.pageLabel(st, p.id))));
  s.addEventListener('change', () => onPick(s.value));
  return s;
}
function elementPages(o) {
  const st = MB.state, s = h('select', null, h('option', { value: '', selected: !o.page }, 'ทุกหน้า'),
    st.pages.map(p => h('option', { value: p.id, selected: o.page === p.id }, 'เฉพาะ ' + MB.pageLabel(st, p.id))));
  s.addEventListener('change', () => { o.page = s.value || null; if (o.page && o.page !== st.curPage) { MB.sel = null; } MB.commit(); UI.rebuild(); renderPageBar(); });
  return s;
}
const alignBar = () => h('div', { class: 'alignbar' },
  [['l', '⇤', 'ชิดซ้าย'], ['c', '↔', 'กึ่งกลางแนวนอน'], ['r', '⇥', 'ชิดขวา'], ['t', '⤒', 'ชิดบน'], ['m', '↕', 'กึ่งกลางแนวตั้ง'], ['b', '⤓', 'ชิดล่าง']]
    .map(([k, l, t]) => h('button', { class: 'abtn', title: t, onclick: () => UI.align(k) }, l)));
function inspMulti() {
  const items = selObjs(), cards = items.filter(x => x.s.kind === 'card').map(x => x.o), du = MB.dispUnit(MB.state), gapObj = { g: MB.state.layout.gap };
  const batchSet = (k, v) => { cards.forEach(c => { c[k] = v; }); MB.commit(); UI.rebuild(); };
  const sc = { v: cards.length ? cards[0].imgScale || 1 : 1 };
  return [
    section(`เลือกอยู่ ${items.length} ชิ้น` + (cards.length ? ` · การ์ด ${cards.length}` : ''),
      alignBar(),
      h('div', { class: 'brow' }, btn('เว้นระยะเท่ากัน ↔', () => UI.distribute('h')), btn('เว้นระยะเท่ากัน ↕', () => UI.distribute('v'))),
      UI.row('ระยะห่างคงที่', h('div', { class: 'pair' }, UI.num(gapObj, 'g', { scale: du.k, digits: du.d, step: du.d ? 0.5 : 1, silent: true, suffix: du.name }),
        btn('↔', () => UI.distribute('h', gapObj.g), 'small'), btn('↕', () => UI.distribute('v', gapObj.g), 'small'))),
      h('div', { class: 'brow' }, btn('กว้างเท่ากัน', () => UI.matchSize('w')), btn('สูงเท่ากัน', () => UI.matchSize('h')), btn('ขนาดเท่ากัน', () => UI.matchSize('wh'))),
      hint('อ้างอิงขนาดจากชิ้นที่คลิกล่าสุด · ลากชิ้นใดชิ้นหนึ่ง = ย้ายทั้งกลุ่ม (ปล่อยบนภาพย่อหน้า = ย้ายไปหน้านั้น)')),
    cards.length ? section('ตั้งค่าการ์ดที่เลือกพร้อมกัน',
      UI.row('ขนาดรูป', UI.rng(sc, 'v', 0.4, 1.6, 0.01, { fmt: v => Math.round(v * 100) + '%', onset: () => cards.forEach(c => { c.imgScale = sc.v; }) })),
      h('div', { class: 'brow' }, btn('ซ่อน A/B/C', () => batchSet('noBadge', true)), btn('แสดง A/B/C', () => batchSet('noBadge', false))),
      h('div', { class: 'brow' }, btn('ซ่อนชื่อแบบ', () => batchSet('noSub', true)), btn('แสดงชื่อแบบ', () => batchSet('noSub', false))),
      h('div', { class: 'brow' }, btn('🔒 ล็อก', () => batchSet('locked', true)), btn('ปลดล็อก', () => batchSet('locked', false))),
      UI.row('ย้ายไปหน้า', pageSelect(MB.state.curPage, pid => UI.moveCardsToPage(cards, pid))),
      h('div', { class: 'brow' }, btn('วางสไตล์ที่คัดลอกไว้', UI.pasteStyle))) : null,
    h('div', { class: 'brow' }, btn('ทำซ้ำ (Ctrl+D)', UI.duplicateSel), btn('ลบที่เลือก', UI.deleteSel, 'danger')),
  ];
}
function cardStyleSec(c) {
  const t = MB.state.theme, cs = c.style = c.style || {};
  const view = Object.assign({ fill: t.panel.fill, opacity: t.panel.on ? t.panel.opacity : 0, stroke: t.panel.stroke, strokeW: t.panel.strokeW, titleColor: t.title.color, priceFill: t.price.fill, priceColor: t.price.color, badgeFill: t.badge.fill }, cs);
  const set = (k) => () => { cs[k] = view[k]; };
  const pct = v => Math.round(v * 100) + '%';
  const shapeSel = (key, list) => { const o = { v: cs[key] || '' }; return UI.sel(o, 'v', [['', 'ตามธีม'], ...list], () => { if (o.v) cs[key] = o.v; else delete cs[key]; MB.commit(); UI.rebuild(); }, true); };
  const sec = section('สีเฉพาะการ์ดนี้ (ไฮไลต์)',
    UI.row('ทรงการ์ด', shapeSel('shape', MB.CARD_SHAPES)), UI.row('ทรงป้ายราคา', shapeSel('priceShape', tagShapes())),
    UI.row('สีพื้นการ์ด', UI.col(view, 'fill', { onset: set('fill') })), UI.row('ความทึบพื้น', UI.rng(view, 'opacity', 0, 1, 0.01, { fmt: pct, onset: set('opacity') })),
    UI.row('สีชื่อสินค้า', UI.col(view, 'titleColor', { onset: set('titleColor') })),
    UI.row('สีป้ายราคา', UI.col(view, 'priceFill', { onset: set('priceFill') })), UI.row('สีตัวเลขราคา', UI.col(view, 'priceColor', { onset: set('priceColor') })),
    UI.row('สีพื้น A/B/C', UI.col(view, 'badgeFill', { onset: set('badgeFill') })),
    UI.row('เส้นขอบ', UI.rng(view, 'strokeW', 0, 8, 0.1, { onset: set('strokeW') })), UI.row('สีเส้นขอบ', UI.col(view, 'stroke', { onset: set('stroke') })),
    h('div', { class: 'brow' }, btn('คัดลอกสไตล์', UI.copyStyle), btn('วางสไตล์', UI.pasteStyle), btn('กลับไปใช้ธีม', () => { c.style = {}; MB.commit(); UI.rebuild(); })),
    hint('Ctrl+Shift+C / Ctrl+Shift+V = คัดลอก / วางสไตล์การ์ด (เลือกหลายการ์ดแล้ววางทีเดียวได้)'));
  sec.open = Object.keys(cs).length > 0;
  return sec;
}
function layoutExtras(c) {
  const st = MB.state, pm = MB.layoutMode(st, c.page), relayout = () => { if (st.layout.reflow) MB.animateLayout(() => MB.autoLayout(st, c.page)); };
  if (pm === 'hero') return UI.chk(c, 'hero', 'การ์ดเด่น (Hero) ของหน้านี้', () => { if (c.hero) MB.pageCards(st, c.page).forEach(x => { if (x !== c) x.hero = false; }); relayout(); });
  if (pm === 'bento') {
    const C = MB.layoutCols(st, c.page);
    return [UI.row('ช่องกว้าง (Bento)', UI.sel(c, 'spanC', [[0, 'อัตโนมัติ'], ...Array.from({ length: C }, (_, i) => [i + 1, (i + 1) + ' ช่อง'])], relayout)),
      UI.row('ช่องสูง (Bento)', UI.sel(c, 'spanR', [[0, 'อัตโนมัติ'], [1, '1 แถว'], [2, '2 แถว'], [3, '3 แถว'], [4, '4 แถว']], relayout))];
  }
  return null;
}
function geomSec(o, keys) {
  const du = MB.dispUnit(MB.state);
  return section('ตำแหน่ง & ขนาด',
    h('div', { class: 'fld' }, h('span', { class: 'fl' }, 'จัดในพื้นที่'), alignBar()),
    h('div', { class: 'grid2' }, keys.map(k => UI.row(k.toUpperCase(), UI.num(o, k, { scale: du.k, digits: du.d, step: du.d ? 0.5 : 1, suffix: du.name })))),
    UI.chk(o, 'locked', 'ล็อก (ไม่ให้ลาก / ไม่ถูกจัดอัตโนมัติ)', () => MB.requestRender()),
    UI.chk(o, 'hidden', 'ซ่อน (ไม่แสดง / ไม่ส่งออก)', () => { if (o.variants && MB.state.layout.reflow) MB.autoLayout(MB.state); MB.requestRender(); }));
}
function inspCard(c) {
  const st = MB.state;
  const vlist = h('div', { class: 'vlist' }, c.variants.map((v, i) => h('div', { class: 'vi' },
    h('div', { class: 'vth', title: 'คลิกเพื่อเปลี่ยนรูป', onclick: async () => { const [f] = await UI.pickFiles('image/*', false); if (f) { v.asset = (await MB.fileToAsset(f)).id; MB.commit(); UI.rebuild(); } } }, thumb(v.asset)),
    h('div', { class: 'col grow' },
      h('div', { class: 'pair' }, h('input', { type: 'text', class: 'lab', value: v.label, placeholder: MB.letter(i), oninput: (e) => { v.label = e.target.value; MB.touch(); }, onchange: () => MB.commit() }),
        h('input', { type: 'text', value: v.sub, placeholder: 'ชื่อแบบ เช่น 001 (ไม่บังคับ)', oninput: (e) => { v.sub = e.target.value; MB.touch(); }, onchange: () => MB.commit() }),
        h('input', { type: 'text', class: 'vprice', value: v.price || '', placeholder: 'ราคา', title: 'ราคาเฉพาะแบบนี้ (เว้นว่าง = ใช้ราคาการ์ด)', oninput: (e) => { v.price = e.target.value; MB.touch(); }, onchange: () => MB.commit() }),
        h('input', { type: 'number', class: 'vzoom', value: Math.round((v.zoom || 1) * 100), min: 20, max: 400, step: 5, title: 'ขนาดรูปนี้ % (หรือ Alt+ล้อเมาส์บนรูป)', oninput: (e) => { const z = parseFloat(e.target.value); if (z > 0) { v.zoom = z / 100; MB.touch(); } }, onchange: () => MB.commit() }))),
    h('div', { class: 'cia' },
      h('button', { onclick: () => { moveIn(c.variants, v, -1); MB.commit(); UI.rebuild(); } }, '▲'),
      h('button', { onclick: () => { moveIn(c.variants, v, 1); MB.commit(); UI.rebuild(); } }, '▼'),
      (v.ox || v.oy || (v.zoom && v.zoom !== 1)) ? h('button', { title: 'รีเซ็ตตำแหน่ง/ขนาดรูปนี้', onclick: () => { v.ox = 0; v.oy = 0; v.zoom = 1; MB.commit(); UI.rebuild(); } }, '⌖') : null,
      h('button', { class: 'danger', onclick: () => { c.variants.splice(i, 1); MB.commit(); UI.rebuild(); } }, '✕')))));
  return [
    c.flag ? h('div', { class: 'flag' }, h('span', null, '● อัปเดตจาก Excel: ' + c.flag), btn('รับทราบ', () => { c.flag = ''; MB.commit(); UI.rebuild(); }, 'small')) : null,
    section('ข้อมูลสินค้า',
      UI.row('ชื่อสินค้า', UI.txt(c, 'name', { area: true })), hint('กด Enter เพื่อขึ้นบรรทัดใหม่ในชื่อสินค้า'),
      UI.row('ราคา', UI.txt(c, 'price', { placeholder: 'เช่น 290' })),
      UI.row('ป้ายสถานะ', UI.txt(c, 'status', { placeholder: 'เช่น PRE-ORDER / DAY 2 ONLY' })),
      h('div', { class: 'chips' }, ['PRE-ORDER', 'NEW', 'LIMITED', 'SOLD OUT', 'DAY 1 ONLY', 'DAY 2 ONLY'].map(v => h('button', { class: 'small', onclick: () => { c.status = c.status === v ? '' : v; MB.commit(); UI.rebuild(); } }, v))),
      UI.row('หมายเหตุใต้ชื่อ', UI.txt(c, 'note', { area: true, placeholder: 'เช่น FREE 1 PHOTOCARD' })),
      UI.row('เงื่อนไขสินค้า', UI.txt(c, 'terms', { area: true, placeholder: 'เช่น\n*SINGLE BOX 490 / WHOLE SET 3,920\n*รับสินค้า 15 NOV' })),
      UI.row('SKU', UI.txt(c, 'sku')),
      UI.row('อยู่หน้า', pageSelect(c.page, (pid) => UI.moveCardToPage(c, pid)))),
    section(`รูปสินค้า (${c.variants.length} แบบ)`, vlist,
      h('div', { class: 'brow' }, btn('⬆ เพิ่มรูป (หลายไฟล์)', () => UI.addImagesToCard(c), 'primary'), btn('+ ช่องว่าง', () => { c.variants.push(MB.newVariant()); MB.commit(); UI.rebuild(); })),
      hint('ลากไฟล์รูปมาวางบนการ์ดในหน้างาน หรือบนรายการด้านซ้ายก็ได้')),
    section('การจัดรูปในการ์ด',
      UI.row('จำนวนแถวรูป', UI.sel(c, 'rows', [[0, 'อัตโนมัติ'], [1, '1 แถว'], [2, '2 แถว'], [3, '3 แถว'], [4, '4 แถว']])),
      UI.row('ขนาดรูป', UI.rng(c, 'imgScale', 0.4, 1.6, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
      UI.chk(c, 'noBadge', 'ซ่อน A / B / C ของการ์ดนี้'),
      UI.chk(c, 'noSub', 'ซ่อนชื่อแบบ (เช่น TEETEE, 001) ของการ์ดนี้'),
      UI.row('น้ำหนักการ์ด (Auto)', UI.rng(c, 'weight', 0.25, 6, 0.05, { fmt: v => '×' + MB.round(v, 2) })),
      layoutExtras(c),
      hint('น้ำหนักมาก = การ์ดได้พื้นที่มากขึ้นเมื่อจัดวางอัตโนมัติ (ย่อขยายการ์ดเอง ระบบปรับค่านี้ให้)')),
    cardStyleSec(c),
    geomSec(c, ['x', 'y', 'w', 'h']),
    h('div', { class: 'brow' }, btn('ทำซ้ำ (Ctrl+D)', UI.duplicateSel), btn('ลบการ์ด', UI.deleteSel, 'danger')),
  ];
}
function zSec(o) {
  const st = MB.state;
  return h('div', { class: 'brow' },
    btn('ไปหน้าสุด', () => { moveIn(st.elements, o, 999); MB.commit(); }), btn('ไปหลังสุด', () => { moveIn(st.elements, o, -999); MB.commit(); }),
    btn('ทำซ้ำ', UI.duplicateSel), btn('ลบ', UI.deleteSel, 'danger'));
}
function inspImage(o) {
  return [
    section(o.role === 'logo' ? 'โลโก้งาน' : o.type === 'vector' ? 'เวกเตอร์' : 'รูปภาพ',
      o.type === 'vector' ? vecStyleRows(o, 'vstyle') : null,
      h('div', { class: 'assetrow' }, thumb(o.asset, 'thb'), h('div', { class: 'col' }, btn('เปลี่ยนรูป', () => UI.replaceElementImage(o)), btn('รีเซ็ตสัดส่วน', () => { const a = MB.assets[o.asset]; o.h = o.w * a.h / a.w; MB.commit(); UI.rebuild(); }))),
      o.role === 'logo' ? null : UI.row('ชื่อเลเยอร์', UI.txt(o, 'name')),
      UI.row('หมุน', UI.rng(o, 'rot', -180, 180, 0.5, { fmt: v => v + '°' })),
      UI.row('ความทึบ', UI.rng(o, 'op', 0, 1, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
      UI.chk(o, 'behind', 'วางไว้หลังการ์ดสินค้า'),
      UI.row('แสดงใน', elementPages(o)),
      h('div', { class: 'brow' }, btn('กึ่งกลางแนวนอน', () => { o.x = 500 - o.w / 2; MB.commit(); UI.rebuild(); }))),
    o.type === 'image' ? imgFxEditor(o) : null,
    geomSec(o, ['x', 'y', 'w', 'h']), zSec(o),
    hint('ลากมุม = ย่อขยายตามสัดส่วน (Shift = ยืดอิสระ) · จุดกลมด้านบน = หมุน'),
  ];
}
/* drop shadow / glow / outline for logos and pictures (works from the PNG's transparency) */
const IMG_FX_PRESETS = [
  ['เงานุ่ม', fx => Object.assign(fx.shadow, { on: true, color: '#000000', op: 0.45, dist: 4, angle: 120, blur: 8 })],
  ['เงาลอย', fx => Object.assign(fx.shadow, { on: true, color: '#000000', op: 0.35, dist: 12, angle: 90, blur: 18 })],
  ['เรืองแสง', fx => Object.assign(fx.glow, { on: true, color: '#C9A7FF', op: 0.9, size: 18 })],
  ['ขอบขาวสติกเกอร์', fx => { Object.assign(fx.stroke, { on: true, color: '#FFFFFF', w: 4 }); Object.assign(fx.shadow, { on: true, color: '#000000', op: 0.3, dist: 3, angle: 120, blur: 6 }); }],
];
function imgFxEditor(o) {
  const fx = o.fx = MB.fixFx(o.fx), k = Math.max(0.3, Math.min(o.w, o.h) / 150); // presets scale with the picture
  const pct = (v) => Math.round(v * 100) + '%', deg = (v) => v + '°';
  const sub = (label, key, ...rows) => h('div', { class: 'fxs' + (fx[key].on ? ' on' : '') },
    UI.chk(fx[key], 'on', label, () => UI.rebuild()), fx[key].on ? h('div', { class: 'fxb' }, ...rows) : null);
  const sec = section(o.role === 'logo' ? 'เอฟเฟกต์โลโก้ (Layer Style)' : 'เอฟเฟกต์รูป (Layer Style)',
    h('div', { class: 'presets fxp' }, btn('ไม่มี', () => { o.fx = MB.defaultFx(); MB.commit(); UI.rebuild(); }), IMG_FX_PRESETS.map(([n, fn]) => btn(n, () => {
      Object.assign(fx, MB.defaultFx()); fn(fx);
      fx.stroke.w *= k; fx.shadow.dist *= k; fx.shadow.blur *= k; fx.glow.size *= k;
      MB.commit(); UI.rebuild();
    }))),
    sub('เงา (Drop Shadow)', 'shadow', UI.row('สี', UI.col(fx.shadow, 'color')), UI.row('ความทึบ', UI.rng(fx.shadow, 'op', 0, 1, 0.01, { fmt: pct })),
      UI.row('ระยะ', UI.rng(fx.shadow, 'dist', 0, 60, 0.5)), UI.row('ทิศทางแสง', UI.rng(fx.shadow, 'angle', -180, 180, 1, { fmt: deg })), UI.row('ความเบลอ', UI.rng(fx.shadow, 'blur', 0, 60, 0.5))),
    sub('เรืองแสง (Outer Glow)', 'glow', UI.row('สี', UI.col(fx.glow, 'color')), UI.row('ความทึบ', UI.rng(fx.glow, 'op', 0, 1, 0.01, { fmt: pct })), UI.row('ขนาด', UI.rng(fx.glow, 'size', 1, 80, 0.5))),
    sub('เส้นขอบ (Stroke)', 'stroke', UI.row('สี', UI.col(fx.stroke, 'color')), UI.row('ความหนา', UI.rng(fx.stroke, 'w', 0.2, 20, 0.1))),
    hint('ใช้ขอบใสของไฟล์ PNG · PSD: เป็น Layer Style จริง · AI: เอฟเฟกต์ถูกอบเป็นรูปใต้โลโก้'));
  sec.open = MB.fxActive(fx) || o.role === 'logo';
  return sec;
}
function inspText(o) {
  const fu = MB.fontUnit(MB.state);
  return [
    section('ข้อความ',
      UI.txt(o, 'text', { area: true }),
      UI.row('ฟอนต์', UI.fontSel(o, 'font')),
      UI.row('ขนาด', UI.num(o, 'size', { scale: fu.k, digits: fu.d, step: fu.d ? 0.5 : 1, suffix: fu.name, min: 1 })),
      UI.row('สี', UI.col(o, 'color')),
      UI.row('จัดชิด', UI.sel(o, 'align', [['left', 'ซ้าย'], ['center', 'กลาง'], ['right', 'ขวา']])),
      UI.row('ระยะบรรทัด', UI.rng(o, 'lh', 0.8, 2, 0.01)),
      UI.row('หมุน', UI.rng(o, 'rot', -180, 180, 0.5, { fmt: v => v + '°' })),
      UI.row('ความทึบ', UI.rng(o, 'op', 0, 1, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
      UI.chk(o, 'behind', 'วางไว้หลังการ์ดสินค้า'),
      UI.row('แสดงใน', elementPages(o)),
      h('div', { class: 'brow' }, btn('กึ่งกลางแนวนอน', () => { o.align = 'center'; o.x = 500; MB.commit(); UI.rebuild(); }))),
    fxEditor(o),
    geomSec(o, ['x', 'y']), zSec(o),
  ];
}
function inspLogo(l) {
  const f = MB.state.footer;
  return [section('โลโก้ค่าย',
    h('div', { class: 'assetrow' }, thumb(l.asset, 'thb'), h('div', { class: 'col' },
      btn('เปลี่ยนรูป', async () => { const [fl] = await UI.pickFiles('image/*', false); if (fl) { l.asset = (await MB.fileToAsset(fl)).id; MB.commit(); UI.rebuild(); } }),
      btn('รีเซ็ตตำแหน่ง', () => { l.dx = 0; l.dy = 0; MB.commit(); }),
      btn('ลบ', UI.deleteSel, 'danger'))),
    UI.row('ขนาด', UI.rng(l, 'scale', 0.2, 3, 0.01, { fmt: v => Math.round(v * 100) + '%' })),
    h('div', { class: 'brow' }, btn('◀ ย้ายซ้าย', () => { moveIn(f.logos, l, -1); MB.commit(); }), btn('ย้ายขวา ▶', () => { moveIn(f.logos, l, 1); MB.commit(); })),
    hint('ตั้งค่าแถบโลโก้ทั้งหมดได้ที่แท็บ โลโก้ & BG'))];
}

/* ---------- Excel / CSV import ----------
   Handles stock sheets like: title row above the header, COLLECTION + PRODUCT NAME grouping, CODE (A/B/C) +
   VARIANT 1 (design name) + VARIANT 2 (size), per-variant DETAILS / PRICE, STATUS (AVAILABLE / PRE-ORDER). */
const FIELDS = [ // [key, label, guesses in priority order]
  ['name', 'ชื่อสินค้า *', [/^product ?name$/i, /^(ชื่อสินค้า|สินค้า|รายการ)$/i, /^(name|product|item|title)$/i, /(product|ชื่อ)/i]],
  ['collection', 'คอลเลกชัน (แยกกลุ่ม)', [/^(collection|series|คอลเลกชัน|ซีรีส์|หมวด)/i]],
  ['price', 'ราคา', [/^price/i, /(price|ราคา)/i]],
  ['code', 'ตัวอักษรแบบ (A/B/C)', [/^(code|ตัวอักษร)$/i]],
  ['variant', 'ชื่อแบบ (Variant 1)', [/^variant ?1$/i, /^(variant|option|design|แบบ|ลาย|รุ่น|ชื่อแบบ)$/i]],
  ['size', 'ไซส์ (Variant 2) — ไม่แยกการ์ด', [/^variant ?2$/i, /^(size|ไซส์)$/i]],
  ['note', 'รายละเอียด / หมายเหตุ', [/^details?$/i, /(รายละเอียด|หมายเหตุ|note)/i]],
  ['status', 'สถานะ (PRE-ORDER…)', [/^(status|สถานะ)$/i]],
  ['terms', 'เงื่อนไขสินค้า', [/(condition|เงื่อนไข|terms?)/i]],
  ['sku', 'SKU / รหัส', [/^sku$/i, /^(รหัสสินค้า|รหัส)$/i, /sku/i]],
  ['count', 'จำนวนแบบ', [/(จำนวนแบบ|designs? ?count)/i]],
];
const SIZE_RE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|free ?size|one ?size|size ?\S+|ไซส์ ?\S+)$/i;
const AVAILABLE_RE = /^(available|in ?stock|on ?sale|พร้อมขาย|พร้อมส่ง|มีสินค้า|ok|-)?$/i;
function guessHeaderRow(rows) {
  let best = 0, bestScore = -1;
  rows.slice(0, 15).forEach((r, i) => {
    const cells = r.map(c => String(c).trim());
    const score = FIELDS.reduce((n, [, , res]) => n + (cells.some(c => res.some(re => re.test(c))) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best + 1;
}
function guessMap(hdr, rows) {
  const map = {}, used = new Set();
  FIELDS.forEach(([k, , res]) => {
    map[k] = -1;
    for (const re of res) { const i = hdr.findIndex((x, j) => !used.has(j) && re.test(x.trim())); if (i >= 0) { map[k] = i; used.add(i); break; } }
  });
  // purchase limits ("Limit to 2") are for the shop counter, not the artwork
  if (map.terms >= 0) {
    const vals = rows.map(r => String(r[map.terms] || '').trim()).filter(Boolean);
    if (vals.length && vals.filter(v => /^limit/i.test(v)).length / vals.length > 0.6) map.terms = -1;
  }
  return map;
}
UI.importExcel = async () => {
  const [file] = await UI.pickFiles('.xlsx,.xls,.csv', false); if (!file) return;
  let wb;
  try { wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }); } catch (e) { alert('อ่านไฟล์ไม่ได้: ' + e.message); return; }
  const o = { sheet: wb.SheetNames[0], header: 1, mode: 'merge', split: true, perPage: 6, byCollection: true };
  let map = {}, cols = {};
  const body = h('div', { class: 'imp' }), preview = h('div', { class: 'tblwrap' }), mapBox = h('div', { class: 'grid2' }), colBox = h('div', { class: 'colls' }), sumBox = h('div', { class: 'hint' });
  const allRows = () => XLSX.utils.sheet_to_json(wb.Sheets[o.sheet], { header: 1, defval: '', raw: false, blankrows: false });
  const dataRows = () => allRows().slice(o.header);
  const reguess = () => { const rows = allRows(); map = guessMap((rows[o.header - 1] || []).map(String), rows.slice(o.header)); };
  const drawCollections = () => {
    colBox.innerHTML = '';
    const groups = buildGroups(dataRows(), map, null), byCol = {};
    groups.forEach(g => { byCol[g.collection] = (byCol[g.collection] || 0) + 1; });
    Object.keys(byCol).forEach(k => { if (cols[k] == null) cols[k] = true; });
    if (map.collection >= 0) colBox.append(h('h4', null, 'เลือกคอลเลกชันที่จะนำเข้า'),
      ...Object.entries(byCol).map(([k, n]) => UI.chk(cols, k, `${k || '(ไม่ระบุ)'} — ${n} สินค้า`, updSum, true)));
    updSum();
  };
  const updSum = () => {
    const groups = buildGroups(dataRows(), map, cols);
    sumBox.textContent = `จะได้การ์ด ${groups.length} ใบ · ${groups.reduce((n, g) => n + g.variants.length, 0)} แบบ` +
      (map.terms < 0 && FIELDS.length ? '' : '');
  };
  const draw = () => {
    const rows = allRows(), hdr = (rows[o.header - 1] || []).map(String);
    preview.innerHTML = '';
    preview.append(h('table', null, rows.slice(0, 9).map((r, i) => h('tr', { class: i === o.header - 1 ? 'hdr' : '' }, h('td', { class: 'rn' }, i + 1), r.slice(0, 14).map(c => h('td', null, String(c).slice(0, 24)))))));
    mapBox.innerHTML = '';
    const opts = [[-1, '— ไม่ใช้ —'], ...hdr.map((x, i) => [i, `${XLSX.utils.encode_col(i)}: ${String(x).replace(/\s+/g, ' ') || '(ว่าง)'}`])];
    FIELDS.forEach(([k, l]) => mapBox.append(UI.row(l, UI.sel(map, k, opts, drawCollections, true))));
    drawCollections();
  };
  const resetSheet = () => { o.header = guessHeaderRow(allRows()); hdrInp.value = o.header; cols = {}; reguess(); draw(); };
  const sheetSel = UI.sel(o, 'sheet', wb.SheetNames.map(n => [n, n]), resetSheet, true);
  const hdrInp = h('input', { type: 'number', min: 1, step: 1, value: 1, onchange: () => { o.header = Math.max(1, parseInt(hdrInp.value, 10) || 1); cols = {}; reguess(); draw(); } });
  body.append(UI.row('Sheet', sheetSel), UI.row('แถวหัวตาราง', hdrInp), preview, h('h4', null, 'จับคู่คอลัมน์ (เดาให้อัตโนมัติ)'), mapBox, colBox,
    UI.row('การนำเข้า', UI.sel(o, 'mode', [['merge', 'อัปเดตสินค้าเดิม + เพิ่มใหม่ — รูปเดิมไม่หาย'], ['replace', 'แทนที่สินค้าทั้งหมด']], null, true)),
    UI.chk(o, 'split', 'แบ่งหน้าอัตโนมัติหลังนำเข้า', null, true),
    UI.row('สินค้าต่อหน้า', UI.num(o, 'perPage', { min: 1, max: 30, step: 1, digits: 0, silent: true })),
    UI.chk(o, 'byCollection', 'แยกหน้าตามคอลเลกชัน', null, true),
    sumBox,
    hint('• ชื่อสินค้าเดียวกันในคอลเลกชันเดียวกัน = การ์ดเดียว หลายแบบ · • ไซส์ (M/L/XL, SIZE 1) ไม่นับเป็นแบบ · • สถานะ AVAILABLE ไม่ขึ้นป้าย · • ราคาต่างกันในแบบเดียวกัน → ขึ้นราคาใต้รูปแต่ละแบบ · • รายละเอียดต่างกันต่อแบบ → ขึ้นใต้รูปแบบนั้น · • คอลัมน์ "Limit to …" (จำกัดการซื้อ) ไม่ใส่ในงานโดยอัตโนมัติ'));
  resetSheet();
  UI.modal('นำเข้า Excel / CSV — ' + file.name, body, [btn('ยกเลิก', () => UI.closeModal()), btn('นำเข้า', () => {
    if (map.name < 0) { alert('กรุณาเลือกคอลัมน์ชื่อสินค้า'); return; }
    const res = applyImport(buildGroups(dataRows(), map, cols), o.mode), st = MB.state;
    let pages = 0;
    if (o.split && res.added) pages = MB.splitPages(st, { perPage: o.perPage, byCollection: o.byCollection && map.collection >= 0, onlyIds: o.mode === 'replace' ? null : res.addedIds });
    else MB.autoLayout(st);
    UI.closeModal(); MB.sel = null; MB.commit(); UI.rebuild(); renderPageBar(); MB.fitView();
    UI.toast(`นำเข้าแล้ว: ใหม่ ${res.added} · อัปเดต ${res.updated}` + (pages ? ` · แบ่งเป็น ${pages} หน้า` : ''), 4000);
    if (res.changes.length) UI.changeReport(res.changes);
  }, 'primary')]);
};
function buildGroups(rows, map, cols) {
  const get = (r, k) => map[k] >= 0 ? String(r[map[k]] == null ? '' : r[map[k]]).trim() : '';
  const groups = new Map();
  rows.forEach(r => {
    const name = get(r, 'name'); if (!name) return;
    const collection = get(r, 'collection');
    if (cols && map.collection >= 0 && cols[collection] === false) return;
    const key = collection.toLowerCase() + '|' + name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, name, collection, sku: get(r, 'sku'), rows: [], count: 0 });
    const g = groups.get(key);
    const st = get(r, 'status');
    g.rows.push({ sku: get(r, 'sku'), code: get(r, 'code'), design: get(r, 'variant'), size: get(r, 'size'), price: get(r, 'price').replace(/[^\d.,]/g, ''), note: get(r, 'note'), status: AVAILABLE_RE.test(st) ? '' : st, terms: get(r, 'terms') });
    const n = parseInt(get(r, 'count'), 10); if (n > 0) g.count = Math.max(g.count, n);
  });
  return [...groups.values()].map(g => {
    // one variant per design; size rows (M/L/XL…) collapse into it
    const vmap = new Map();
    g.rows.forEach(r => {
      const isSize = SIZE_RE.test(r.design);
      // with a size column filled (T-SHIRT WHITE/M…), CODE counts sizes -> group by design; otherwise CODE is the design (POSTER A–N)
      const k = isSize ? '' : r.size ? r.design : (r.code || r.design);
      if (!vmap.has(k)) vmap.set(k, { design: isSize ? '' : r.design, codes: [], prices: [], notes: [], skus: [] });
      const v = vmap.get(k); if (r.code) v.codes.push(r.code); v.prices.push(r.price); v.notes.push(r.note); if (r.sku) v.skus.push(r.sku);
    });
    let vars = [...vmap.values()];
    if (vars.length === 1 && !vars[0].design && g.count > 1) vars = Array.from({ length: g.count }, () => ({ design: '', codes: [], prices: [], notes: [], skus: [] }));
    const codes = vars.map(v => v.codes.length && v.codes.every(c => c === v.codes[0]) ? v.codes[0] : '');
    const useCodes = codes.every(Boolean) && new Set(codes).size === codes.length;
    const prices = vars.map(v => v.prices.find(Boolean) || ''), samePrice = prices.every(p => p === prices[0]);
    const notes = vars.map(v => v.notes.find(Boolean) || ''), sameNote = notes.every(n => n === notes[0]);
    let status = (g.rows.find(r => r.status) || {}).status || '', note = sameNote ? notes[0] : '';
    if (status && /pre.?order/i.test(note)) { status = note; note = ''; } // "PRE-ORDER ONLY!" belongs on the tag
    const terms = [...new Set(g.rows.map(r => r.terms).filter(Boolean))].join('\n');
    return {
      key: g.key, name: g.name, collection: g.collection, sku: g.sku, status, note, terms,
      price: samePrice ? prices[0] : '',
      variants: vars.map((v, i) => ({
        label: useCodes ? codes[i].toUpperCase() : '',
        sub: [v.design && !(vars.length === 1) ? v.design : '', sameNote ? '' : notes[i]].filter(Boolean).join('\n'),
        price: samePrice ? '' : prices[i],
        sku: vars.length > 1 || g.rows.length === 1 ? (v.skus[0] || '') : '',
      })),
    };
  });
}
function applyImport(groups, mode) {
  const st = MB.state, addedIds = new Set(), changes = []; let added = 0, updated = 0;
  if (mode === 'replace') { st.cards = []; st.pages = [st.pages.find(p => p.id === st.curPage) || MB.newPage()]; st.curPage = st.pages[0].id; }
  const keyOf = (c) => String(c.collection || '').toLowerCase() + '|' + String(c.name || '').toLowerCase();
  groups.forEach(g => {
    const ex = st.cards.find(c => keyOf(c) === g.key || (!c.collection && String(c.name).toLowerCase() === g.name.toLowerCase()));
    const fields = { name: g.name, collection: g.collection, price: g.price, note: g.note, status: g.status, terms: g.terms, sku: g.sku };
    if (ex) {
      const ch = [], show = (p) => p === '' || p == null ? '—' : p;
      if (String(ex.price || '') !== String(g.price || '')) ch.push(`ราคา ${show(ex.price)} → ${show(g.price)}`);
      if (g.variants.some(v => v.price) && g.variants.map(v => v.price).join() !== ex.variants.map(v => v.price || '').join()) ch.push('ราคาแยกแบบเปลี่ยน');
      if ((ex.status || '') !== (g.status || '')) ch.push(`สถานะ ${show(ex.status)} → ${show(g.status)}`);
      if (ex.variants.length !== g.variants.length) ch.push(`จำนวนแบบ ${ex.variants.length} → ${g.variants.length}`);
      if ((ex.note || '') !== (g.note || '')) ch.push('รายละเอียดเปลี่ยน');
      if (ch.length && mode === 'merge') { ex.flag = ch.join(' · '); changes.push({ c: ex, msg: ex.flag }); }
      Object.assign(ex, fields);
      g.variants.forEach((v, i) => { if (!ex.variants[i]) ex.variants.push(MB.newVariant()); Object.assign(ex.variants[i], v); });
      while (ex.variants.length > g.variants.length && !ex.variants[ex.variants.length - 1].asset) ex.variants.pop(); // keep slots that already have images
      updated++;
    } else {
      const nc = MB.newCard(Object.assign(fields, { variants: g.variants.map(v => MB.newVariant(v)), page: st.curPage }));
      st.cards.push(nc); addedIds.add(nc.id);
      if (mode === 'merge') { nc.flag = 'สินค้าใหม่'; changes.push({ c: nc, msg: 'สินค้าใหม่' }); }
      added++;
    }
  });
  if (mode === 'merge') { // products of the imported collections that are no longer in the sheet
    const keys = new Set(groups.map(g => g.key)), cols = new Set(groups.map(g => g.collection.toLowerCase()));
    st.cards.forEach(c => { if (!addedIds.has(c.id) && cols.has(String(c.collection || '').toLowerCase()) && !keys.has(keyOf(c))) { c.flag = 'ไม่มีในไฟล์ Excel ล่าสุด'; changes.push({ c, msg: c.flag }); } });
  }
  return { added, updated, addedIds, changes };
}

UI.changeReport = (changes) => {
  const st = MB.state;
  UI.modal(`สิ่งที่เปลี่ยนจาก Excel (${changes.length})`, h('div', { class: 'pfl' }, changes.map(x => h('div', { class: 'pf warn', onclick: () => { st.curPage = x.c.page; MB.sel = { kind: 'card', id: x.c.id }; UI.tab = 'sel'; UI.closeModal(); UI.rebuild(); renderPageBar(); MB.requestRender(); } },
    h('span', null, '●'), h('b', null, String(x.c.name).replace(/\n/g, ' ')), h('span', null, ' — ' + x.msg + ' · ' + MB.pageLabel(st, x.c.page))))),
    [btn('ล้างเครื่องหมายทั้งหมด', () => { st.cards.forEach(c => { c.flag = ''; }); MB.commit(); UI.closeModal(); UI.rebuild(); }), btn('ตกลง', () => UI.closeModal(), 'primary')]);
};

/* ---------- batch match images by filename ---------- */
const norm = (s) => String(s || '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_\-.()[\]+&]+/g, '');
UI.matchImages = () => {
  UI.modal('จับคู่รูปจากชื่อไฟล์', h('div', { class: 'col' },
    h('div', { class: 'brow' },
      btn('เลือกไฟล์รูป…', async () => { const f = await UI.pickFiles(); if (f.length) UI.matchImageFiles(f); }, 'primary'),
      btn('เลือกทั้งโฟลเดอร์…', async () => { const f = await UI.pickFolder(); if (f.length) UI.matchImageFiles(f); })),
    hint('ลำดับการจับคู่จากชื่อไฟล์: ① SKU ของแต่ละแบบจาก Excel (เช่น 600300.png → KEYCHAIN แบบ C) ② SKU หรือชื่อสินค้า + ตัวอักษรท้ายไฟล์ (KEYCHAIN_C.png) ③ ช่องว่างถัดไปของสินค้านั้น'),
    hint('หรือ Shift + ลากหลายไฟล์มาวางบนพื้นที่ว่างของหน้างาน')), [btn('ปิด', () => UI.closeModal())]);
};
UI.pickFolder = () => new Promise((res) => {
  const inp = h('input', { type: 'file', multiple: true }); inp.webkitdirectory = true;
  inp.addEventListener('change', () => res([...inp.files].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name))));
  inp.click();
});
UI.matchImageFiles = async (files) => {
  const st = MB.state, miss = [], done = [];
  const vskus = []; st.cards.forEach(c => c.variants.forEach((v, i) => { const k = norm(v.sku); if (k.length >= 3) vskus.push({ c, v, k, i }); }));
  for (const f of files) {
    const fn = norm(f.name);
    let c = null, slot = null;
    const hit = vskus.filter(x => fn.includes(x.k)).sort((a, b) => b.k.length - a.k.length)[0];
    if (hit) { c = hit.c; slot = hit.v; }
    else {
      let best = null;
      st.cards.forEach(cc => [cc.sku, cc.name].forEach(k => { const kk = norm(k); if (kk.length >= 2 && fn.includes(kk) && (!best || kk.length > best.len)) best = { c: cc, len: kk.length }; }));
      if (best) {
        c = best.c;
        const m = f.name.replace(/\.[^.]+$/, '').match(/(?:^|[\s_\-(\[])([A-Za-z])[)\]]?$/);
        if (m) { const L = m[1].toUpperCase(); slot = c.variants.find((v, i) => (v.label || MB.letter(i)) === L); }
        if (!slot || slot.asset) slot = c.variants.find(v => !v.asset);
      }
    }
    if (!c) { miss.push(f.name); continue; }
    const a = await MB.fileToAsset(f);
    if (slot) slot.asset = a.id; else { slot = MB.newVariant({ asset: a.id }); c.variants.push(slot); }
    done.push(`${f.name} → ${String(c.name).replace(/\n/g, ' ')} ${slot.label || MB.letter(c.variants.indexOf(slot))}`);
  }
  MB.commit(); UI.rebuild();
  UI.modal('จับคู่รูปจากชื่อไฟล์', h('div', null,
    h('p', null, `จับคู่ได้ ${done.length} ไฟล์` + (miss.length ? ` · ไม่พบสินค้าที่ตรงกัน ${miss.length} ไฟล์` : '')),
    done.length ? h('div', { class: 'misslist' }, done.map(m => h('div', null, '✓ ' + m))) : null,
    miss.length ? h('div', { class: 'misslist' }, miss.map(m => h('div', null, '✗ ' + m))) : null),
    [btn('ตกลง', () => UI.closeModal(), 'primary')]);
};

/* ---------- preflight dialog ---------- */
UI.preflight = () => {
  const list = MB.preflight(MB.state);
  UI.modal('ตรวจงานก่อน Export', list.length ? h('div', { class: 'pfl' }, list.map(x => h('div', { class: 'pf ' + x.lv, onclick: () => { if (x.page) { MB.state.curPage = x.page; renderPageBar(); } if (x.sel) { MB.sel = x.sel; UI.tab = 'sel'; } UI.closeModal(); UI.rebuild(); MB.requestRender(); } },
    h('span', null, x.lv === 'warn' ? '⚠' : 'ℹ'), x.msg))) : h('p', null, 'เรียบร้อย ไม่พบปัญหา ✓'), [btn('ปิด', () => UI.closeModal())]);
};

/* ---------- project file ---------- */
UI.saveProject = () => {
  MB.download(new Blob([MB.projectJSON()], { type: 'application/json' }), MB.safeName(MB.state.name) + '.mbproj');
  UI.toast(MB.PWA ? 'เลือก "บันทึกไปยังไฟล์" (iCloud Drive) หรือ AirDrop — แล้วเปิดไฟล์ .mbproj นี้ในโปรแกรมบนคอมเพื่อทำ PSD/AI' : 'ดาวน์โหลดไฟล์โปรเจกต์แล้ว (.mbproj — เก็บรูปทั้งหมดไว้ในไฟล์เดียว)', 6000);
};
UI.openProject = async () => {
  const [f] = await UI.pickFiles(MB.PWA ? '' : '.mbproj,.json', false); if (!f) return; // iOS greys out unknown extensions when filtered
  try { const obj = JSON.parse(await f.text()); if (!obj.state) throw new Error('ไม่ใช่ไฟล์ MerchBoard'); await MB.loadProject(obj); UI.toast('เปิดโปรเจกต์แล้ว'); }
  catch (e) { alert('เปิดไฟล์ไม่ได้: ' + e.message); }
};
UI.newProject = () => {
  if (!confirm('เริ่มงานใหม่? (งานปัจจุบันจะถูกแทนที่ — บันทึก .mbproj ไว้ก่อนถ้าต้องการเก็บ)')) return;
  MB.assets = {}; MB.state = MB.newState(); MB.autoLayout(MB.state); MB.sel = null; MB.resetHistory(); MB.touch(); UI.tab = 'page'; UI.rebuild(); renderPageBar(); MB.fitView();
};

/* ---------- init ---------- */
const ACTIONS = {
  new: () => UI.newProject(), open: () => UI.openProject(), save: () => UI.saveProject(),
  undo: () => MB.undo(), redo: () => MB.redo(), zoomIn: () => MB.zoomBy(1.2), zoomOut: () => MB.zoomBy(1 / 1.2), fit: () => MB.fitView(),
  export: () => MB.exportDialog(), preflight: () => UI.preflight(),
  addCard: () => UI.addCard(), importExcel: () => UI.importExcel(), matchImages: () => UI.matchImages(), autoLayout: () => UI.autoLayout(),
  addPage: () => UI.addPage(), splitPages: () => UI.splitDialog(), aiStudio: () => MB.aiUI.open(),
  clearCards: () => { if (confirm('ลบสินค้าทั้งหมด (ทุกหน้า)?')) { MB.state.cards = []; MB.sel = null; MB.commit(); UI.rebuild(); } },
};
UI.init = async () => {
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](); });
  $('#search').addEventListener('input', renderList);
  $('#projName').addEventListener('input', (e) => { MB.state.name = e.target.value; MB.scheduleSave(); });
  $('#projName').addEventListener('change', () => MB.commit());
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') UI.closeModal(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#modal').hidden) UI.closeModal(); else if (MB.sel) { MB.sel = null; UI.rebuild(); MB.requestRender(); } return; }
    if (!$('#modal').hidden || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? MB.redo() : MB.undo(); }
    else if (mod && k === 'y') { e.preventDefault(); MB.redo(); }
    else if (mod && k === 's') { e.preventDefault(); UI.saveProject(); }
    else if (mod && k === 'd') { e.preventDefault(); UI.duplicateSel(); }
    else if (mod && k === 'a') { e.preventDefault(); UI.selectAll(); }
    else if (mod && e.shiftKey && k === 'c') { e.preventDefault(); UI.copyStyle(); }
    else if (mod && e.shiftKey && k === 'v') { e.preventDefault(); UI.pasteStyle(); }
    else if (mod && k === '0') { e.preventDefault(); MB.fitView(); }
    else if (k === 'pagedown' || k === 'pageup') { e.preventDefault(); const st = MB.state, i = MB.pageIndex(st, st.curPage) + (k === 'pagedown' ? 1 : -1); if (st.pages[i]) UI.switchPage(st.pages[i].id); }
    else if (mod && (k === '=' || k === '+')) { e.preventDefault(); MB.zoomBy(1.2); }
    else if (mod && k === '-') { e.preventDefault(); MB.zoomBy(1 / 1.2); }
    else if (k === 'delete' || k === 'backspace') { if (MB.selAll().length) { e.preventDefault(); UI.deleteSel(); } }
    else if (k.startsWith('arrow') && MB.sel) {
      e.preventDefault(); const d = e.shiftKey ? 10 : 1;
      UI.nudge(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0);
    }
  });
  if (MB.PWA) {
    document.body.classList.add('pwa');
    const ai = document.querySelector('[data-act="aiStudio"]'); ai.textContent = '✦ คลังลาย'; ai.title = 'คลังลายฟรี + นำเข้า SVG';
    const sv = document.querySelector('[data-act="save"]'); sv.title = 'บันทึกไฟล์ .mbproj → iCloud Drive / AirDrop แล้วเปิดในคอมเพื่อทำ PSD/AI';
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} // keep autosave from being evicted
    // touch has no Shift key: a sticky toggle for adding to the selection
    const mm = h('button', { class: 'mmode', title: 'แตะการ์ด/ชิ้นงานทีละอัน เพื่อเลือกหลายชิ้น (เหมือนกด Shift)', onclick: () => { MB.multiMode = !MB.multiMode; mm.classList.toggle('on', MB.multiMode); } }, '☐ เลือกหลายชิ้น');
    document.querySelector('[data-act="fit"]').after(mm, h('button', { title: 'เลือกการ์ดทั้งหน้า', onclick: () => UI.selectAll() }, 'เลือกทั้งหน้า'));
    document.querySelector('#top .brand').after(h('button', { class: 'leftbtn', onclick: () => document.body.classList.toggle('showleft') }, '☰ สินค้า'));
  }
  await MB.loadFontLib();
  MB.initStage();
  const restored = await MB.restoreAutosave();
  if (!restored) { MB.state = MB.newState(); MB.autoLayout(MB.state); }
  MB.walkFonts(MB.state, MB.registerFont);
  MB.resetHistory();
  UI.rebuild(); renderPageBar();
  requestAnimationFrame(() => { MB.fitView(); MB.requestRender(); });
  document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => MB.requestRender());
  const ok = await MB.detectServer();
  $('#stServer').textContent = ok
    ? `เชื่อมต่อแล้ว · Photoshop ${MB.server.info.ps ? '✓' : '✗'} · Illustrator ${MB.server.info.ai ? '✓' : '✗'}`
    : MB.PWA ? 'แอป iPad · ออฟไลน์ · PSD/AI ทำในคอมจากไฟล์ .mbproj' : 'โหมดออฟไลน์ (PSD/AI ส่งออกเป็นแพ็กเกจสคริปต์)';
  if (restored) UI.toast('เปิดงานล่าสุดที่บันทึกอัตโนมัติไว้');
};
window.addEventListener('DOMContentLoaded', UI.init);

})(window.MB);
