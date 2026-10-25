'use strict';
/* MerchBoard Studio — export: PNG / JPG / PDF (browser) and PSD / PSB / AI+PDF (via Photoshop / Illustrator) */
(function (MB) {

const ALL_FORMATS = [
  ['png', 'PNG', 'ภาพ ความละเอียดเต็ม (มี dpi ในไฟล์)'],
  ['jpg', 'JPG', 'ภาพ ไฟล์เล็ก สำหรับโพสต์'],
  ['pdf', 'PDF (ภาพ)', 'PDF จากภาพความละเอียดเต็ม — สร้างในเบราว์เซอร์'],
  ['psd', 'PSD', 'Photoshop แยกเลเยอร์ / Text แก้ได้ / รูปเป็น Smart Object'],
  ['psb', 'PSB', 'เหมือน PSD สำหรับไฟล์ขนาดใหญ่'],
  ['ai', 'AI + PDF (เวกเตอร์)', 'Illustrator แยกเลเยอร์ / Text แก้ได้ + PDF พิมพ์'],
];
// iPad app: no Photoshop / Illustrator here — PSD/AI are made on the PC from the saved .mbproj
const FORMATS = MB.PWA ? ALL_FORMATS.filter(f => ['png', 'jpg', 'pdf'].includes(f[0])) : ALL_FORMATS;

MB.exportDialog = () => {
  const h = MB.h, st = MB.state, G = MB.pageGeom(st);
  const pref = (() => { try { return JSON.parse(localStorage.getItem('mb_export') || '{}'); } catch (e) { return {}; } })();
  const o = Object.assign({ fmt: 'png', quality: 0.92, mode: 'RGB', embed: true, combine: true, dir: (MB.server.info && MB.server.info.defaultOut) || '' }, pref, { base: MB.safeName(st.name), scope: st.pages.length > 1 ? 'all' : 'current', size: '', range: `1-${st.pages.length}` });
  if (!FORMATS.some(f => f[0] === o.fmt)) o.fmt = 'png';
  const log = h('div', { class: 'xlog' });
  const say = (m, cls) => { log.append(h('div', { class: cls || '' }, m)); log.scrollTop = 1e9; };
  const fmtBox = h('div', { class: 'fmtgrid' }, FORMATS.map(([id, label, desc]) => h('label', { class: 'fmt' + (o.fmt === id ? ' on' : '') },
    h('input', { type: 'radio', name: 'xf', value: id, checked: o.fmt === id, onchange: () => { o.fmt = id; fmtBox.querySelectorAll('.fmt').forEach(x => x.classList.toggle('on', x.querySelector('input').checked)); upd(); } }),
    h('b', null, label), h('small', null, desc))));
  const needsAdobe = () => ['psd', 'psb', 'ai'].includes(o.fmt);
  const optAdobe = h('div', { class: 'xopts' },
    MB.ui.row('โหมดสี', MB.ui.sel(o, 'mode', [['RGB', 'RGB'], ['CMYK', 'CMYK (งานพิมพ์)']], null, true)),
    MB.ui.chk(o, 'embed', 'ฝังรูปไว้ในไฟล์ (ปิด = ลิงก์ไปโฟลเดอร์ assets)', null, true));
  const optJpg = h('div', { class: 'xopts' }, MB.ui.row('คุณภาพ JPG', MB.ui.rng(o, 'quality', 0.5, 1, 0.01, { fmt: v => Math.round(v * 100) + '%', silent: true })));
  const dirInp = h('input', { type: 'text', value: o.dir, oninput: () => { o.dir = dirInp.value.trim(); } });
  const baseInp = h('input', { type: 'text', value: o.base, oninput: () => { o.base = baseInp.value.trim(); } });
  const serverNote = h('div', { class: 'hint' });
  const rangeInp = h('input', { type: 'text', value: o.range, placeholder: 'เช่น 1-3, 5, 8-11', oninput: () => { o.range = rangeInp.value; } });
  const rangeRow = MB.ui.row('ช่วงหน้า', rangeInp);
  const combineRow = h('div', { class: 'xopts' }, MB.ui.chk(o, 'combine', 'รวมเป็นไฟล์เดียว — 1 หน้า = 1 อาร์ตบอร์ด (ปิด = แยกไฟล์ละหน้า)', null, true));
  const upd = () => {
    optAdobe.hidden = !needsAdobe(); optJpg.hidden = o.fmt !== 'jpg';
    rangeRow.hidden = o.scope !== 'range';
    combineRow.hidden = !(needsAdobe() && st.pages.length > 1 && o.scope !== 'current');
    if (MB.server.ok) {
      const inf = MB.server.info;
      serverNote.textContent = needsAdobe()
        ? ((o.fmt === 'ai' ? inf.ai : inf.ps) ? `จะสั่ง ${o.fmt === 'ai' ? 'Illustrator' : 'Photoshop'} สร้างไฟล์ให้อัตโนมัติ แล้วบันทึกลงโฟลเดอร์นี้` : 'ไม่พบโปรแกรม Adobe ในเครื่อง — จะบันทึกชุดสคริปต์ .jsx ไว้ให้รันเอง')
        : 'บันทึกลงโฟลเดอร์นี้';
    } else if (MB.PWA) serverNote.textContent = 'ไฟล์จะขึ้นปุ่ม "บันทึก / แชร์" ให้แตะ → Save to Files / AirDrop · ต้องการ PSD / AI: กด "บันทึก" (ไฟล์ .mbproj) แล้วเปิดในโปรแกรมบนคอม';
    else serverNote.textContent = needsAdobe()
      ? 'โหมดออฟไลน์: จะดาวน์โหลด .zip (สคริปต์ .jsx + รูป) → แตกไฟล์ แล้วเปิดใน Photoshop/Illustrator: File › Scripts › Other Script… เลือกไฟล์ .jsx'
      : 'ไฟล์จะถูกดาวน์โหลดผ่านเบราว์เซอร์';
  };
  const body = h('div', { class: 'xwrap' },
    h('div', { class: 'xinfo' }, `${G.Wpx} × ${G.Hpx} px · ${st.page.dpi} dpi` + (st.page.unit === 'mm' ? ` · ${MB.round(G.wmm, 1)} × ${MB.round(G.hmm, 1)} mm` : '')),
    MB.ui.row('ขนาดงาน', MB.ui.sel(o, 'size', [['', `ตามงานนี้ (${st.page.preset === 'Custom' ? 'กำหนดเอง' : st.page.preset})`], ...Object.keys(MB.PAPERS).filter(k => k !== st.page.preset).map(k => [k, k + ' — จัดวางใหม่อัตโนมัติ'])], null, true)),
    st.pages.length > 1 ? MB.ui.row('หน้าที่จะส่งออก', MB.ui.sel(o, 'scope', [['all', `ทุกหน้า (${st.pages.length} หน้า)`], ['current', 'เฉพาะ ' + MB.pageLabel(st, st.curPage)], ['range', 'เลือกช่วงหน้า…']], () => upd(), true)) : null,
    rangeRow, combineRow,
    fmtBox, optJpg, optAdobe,
    MB.server.ok ? MB.ui.row('โฟลเดอร์ปลายทาง', dirInp) : null,
    MB.ui.row('ชื่อไฟล์', baseInp), serverNote, log);
  upd();
  const go = h('button', { class: 'primary', onclick: async () => {
    go.disabled = true;
    try { localStorage.setItem('mb_export', JSON.stringify({ fmt: o.fmt, quality: o.quality, mode: o.mode, embed: o.embed, combine: o.combine, dir: o.dir })); } catch (e) {}
    try { await runExport(o, say); } catch (e) { console.error(e); say('ผิดพลาด: ' + e.message, 'err'); }
    go.disabled = false;
  } }, 'Export');
  MB.ui.modal('Export', body, [h('button', { onclick: () => MB.ui.closeModal() }, 'ปิด'), go]);
};

async function saveOut(blob, name, o, say) {
  if (MB.server.ok && o.dir) {
    const r = await MB.api('/api/save-file', { dir: o.dir, name, b64: await MB.blobToB64(blob) });
    say('บันทึกแล้ว: ' + r.path, 'ok'); addOpen(r.dir, say);
  } else if (MB.PWA) { // iOS needs a fresh tap to open the share sheet, so offer a button per file
    say(MB.h('button', { class: 'small primary', onclick: () => MB.shareFiles([new File([blob], name, { type: blob.type })]) }, '⤓ บันทึก / แชร์ ' + name));
  } else { MB.download(blob, name); say('ดาวน์โหลด ' + name, 'ok'); }
}
function addOpen(dir, say) {
  if (!MB.server.ok) return;
  const b = MB.h('button', { class: 'small', onclick: () => MB.api('/api/open-folder', { path: dir }) }, 'เปิดโฟลเดอร์');
  say(b);
}
const canvasBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));

/* "1-3, 5, 8-" -> zero-based page indexes */
MB.parseRange = (txt, n) => {
  const out = new Set();
  String(txt || '').split(/[,\s]+/).filter(Boolean).forEach(part => {
    const m = part.match(/^(\d+)?(-)?(\d+)?$/); if (!m) return;
    let a = m[1] ? +m[1] : 1, b = m[2] ? (m[3] ? +m[3] : n) : a;
    if (a > b) [a, b] = [b, a];
    for (let i = Math.max(1, a); i <= Math.min(n, b); i++) out.add(i - 1);
  });
  return [...out].sort((x, y) => x - y);
};
/* a re-laid-out copy of the project at another paper size (the open project is not touched) */
MB.sizedClone = (preset) => {
  const st = JSON.parse(JSON.stringify(MB.state)), P = MB.PAPERS[preset];
  Object.assign(st.page, { preset, unit: P.unit, w: P.w, h: P.h, dpi: P.dpi, bleed: P.unit === 'px' ? 0 : st.page.bleed });
  st.pages.forEach(p => MB.autoLayout(st, p.id));
  return st;
};
async function runExport(o, say) {
  const st = o.size ? MB.sizedClone(o.size) : MB.state, G = MB.pageGeom(st);
  const base = MB.safeName((o.base || st.name) + (o.size ? '_' + o.size.split(' ')[0] + (o.size.match(/\((\d+)×(\d+)\)/) ? '_' + RegExp.$1 + 'x' + RegExp.$2 : '') : ''));
  if (o.size) say(`ขนาด ${o.size}: ${G.Wpx}×${G.Hpx}px — จัดวางใหม่ในสำเนา (งานที่เปิดอยู่ไม่เปลี่ยน)`);
  const pids = o.scope === 'all' ? st.pages.map(p => p.id) : o.scope === 'range' ? MB.parseRange(o.range, st.pages.length).map(i => st.pages[i].id) : [st.curPage];
  if (!pids.length) { say('ช่วงหน้าไม่ถูกต้อง — ใช้รูปแบบ 1-3, 5', 'err'); return; }
  const bases = MB.pageBases(st, base, pids);
  const empty = st.cards.filter(c => pids.includes(c.page)).reduce((n, c) => n + c.variants.filter(v => !v.asset).length, 0);
  if (empty) say(`หมายเหตุ: ยังมี ${empty} ช่องที่ไม่มีรูป (จะไม่ถูกส่งออก)`, 'warn');
  if (['png', 'jpg', 'pdf'].includes(o.fmt)) {
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 30));
    const { jsPDF } = window.jspdf, wmm = G.wmm, hmm = G.hmm;
    const pdf = o.fmt === 'pdf' ? new jsPDF({ unit: 'mm', format: [wmm, hmm], orientation: wmm > hmm ? 'l' : 'p', compress: true }) : null;
    for (let i = 0; i < pids.length; i++) {
      say(`กำลังเรนเดอร์ ${MB.pageLabel(st, pids[i])} (${G.Wpx}×${G.Hpx}px) …`);
      await new Promise(r => setTimeout(r, 20));
      // iPad Safari can't allocate a canvas over 16.7 MP (A3 @ 300 dpi is 17.4 MP) → render just under it
      const k = MB.PWA ? Math.min(1, Math.sqrt(16.5e6 / (G.Wpx * G.Hpx))) : 1, dpi = Math.round(st.page.dpi * k);
      if (k < 1 && i === 0) say(`iPad วาดภาพได้สูงสุด ~16.7 ล้านพิกเซล → ไฟล์นี้ ${Math.round(G.Wpx * k)}×${Math.round(G.Hpx * k)}px (${dpi} dpi) · ไฟล์พิมพ์จริงให้ส่งออกจากคอม`, 'warn');
      const c = MB.renderFull(st, k < 1 ? Math.floor(Math.max(G.Wpx, G.Hpx) * k) : 0, pids[i], { full: true });
      if (o.fmt === 'png') {
        const b = await canvasBlob(c, 'image/png');
        const u8 = MB.pngSetDpi(new Uint8Array(await b.arrayBuffer()), dpi);
        await saveOut(new Blob([u8], { type: 'image/png' }), bases[i] + '.png', o, say);
      } else if (o.fmt === 'jpg') {
        const b = await canvasBlob(c, 'image/jpeg', o.quality);
        const u8 = MB.jpgSetDpi(new Uint8Array(await b.arrayBuffer()), dpi);
        await saveOut(new Blob([u8], { type: 'image/jpeg' }), bases[i] + '.jpg', o, say);
      } else {
        if (i > 0) pdf.addPage([wmm, hmm], wmm > hmm ? 'l' : 'p');
        pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wmm, hmm, undefined, 'FAST');
      }
      c.width = c.height = 1; // free the big canvas before the next page
    }
    if (pdf) await saveOut(pdf.output('blob'), base + '.pdf', o, say);
    return;
  }
  // Photoshop / Illustrator
  const app = o.fmt === 'ai' ? 'ai' : 'ps';
  const data = MB.jsxScene(st, { base, fmt: o.fmt, mode: o.mode, embed: o.embed, pages: pids, combine: o.combine && o.scope !== 'current' });
  if (data.combine && data.fmt !== o.fmt) say('ขนาดรวมเกิน 30,000 px (ขีดจำกัด PSD) — บันทึกเป็น PSB แทน', 'warn');
  const outputs = data.combine ? (app === 'ai' ? [base + '.pdf', base + '.ai'] : [data.file])
    : app === 'ai' ? data.pages.flatMap(p => [p.base + '.pdf', p.base + '.ai']) : data.pages.map(p => p.file);
  if (data.combine) say(`รวม ${data.pages.length} หน้าเป็นไฟล์เดียว · ${data.pages.length} อาร์ตบอร์ด`);
  const jsx = MB.buildJsx(app, data);
  const files = Object.entries(data.assets).map(([id, fname]) => ({ id, fname }));
  const appName = app === 'ai' ? 'Illustrator' : 'Photoshop';
  if (MB.server.ok && o.dir) {
    say(`กำลังส่ง ${files.length} รูป + สคริปต์ ไปที่โฟลเดอร์ …`);
    const assets = files.map(f => ({ name: f.fname, b64: MB.assets[f.id].data.split(',')[1] }));
    const r = await MB.api('/api/export', { app, dir: o.dir, base, jsx, assets, outputs });
    if (!r.launched) { say(`สคริปต์อยู่ที่ ${r.jsx} — เปิดใน ${appName}: File › Scripts › Other Script…`, 'warn'); addOpen(r.dir, say); return; }
    say(`สั่ง ${appName} แล้ว — กำลังสร้าง ${data.pages.length} ไฟล์ (ประมาณ 10 วินาที – 2 นาทีต่อหน้า ตามจำนวนรูป)…`);
    addOpen(r.dir, say);
    const target = r.outputs[r.outputs.length - 1], t0 = r.t;
    for (let i = 0; i < 120 + 100 * data.pages.length; i++) {
      await new Promise(res => setTimeout(res, 2500));
      try {
        const s = await MB.api('/api/stat?path=' + encodeURIComponent(target));
        if (s.exists && s.mtime >= t0 - 1 && s.size > 0) {
          await new Promise(res => setTimeout(res, 1500));
          say('เสร็จแล้ว ✓ ' + r.outputs.join('  ·  '), 'ok');
          if (s.log) say(s.log, /NOTES|ERROR/.test(s.log) ? 'warn' : '');
          return;
        }
      } catch (e) {}
    }
    say(`ยังไม่เห็นไฟล์สุดท้าย — ตรวจหน้าต่าง ${appName} (อาจมีกล่องข้อความรออยู่)`, 'warn');
    return;
  }
  // offline: zip package
  say('กำลังสร้างไฟล์ .zip …');
  const zf = [{ name: `${base}_build_${app}.jsx`, data: new TextEncoder().encode(jsx) }];
  files.forEach(f => zf.push({ name: 'assets/' + f.fname, data: MB.dataURLBytes(MB.assets[f.id].data) }));
  zf.push({ name: 'README.txt', data: new TextEncoder().encode(
    `MerchBoard Studio export package\r\n\r\n1) Extract this zip to a folder.\r\n2) Open ${appName}.\r\n3) File > Scripts > Other Script... (Illustrator) / Browse... (Photoshop) and choose ${base}_build_${app}.jsx\r\n4) The ${o.fmt.toUpperCase()} file is saved next to the script.\r\n`) });
  MB.download(MB.zip(zf), `${base}_${o.fmt}_package.zip`);
  say('ดาวน์โหลดแพ็กเกจแล้ว ✓', 'ok');
}

})(window.MB);
