'use strict';
/* MerchBoard Studio — built-in free vector library (drawn here, no internet / no cost). Each item is plain SVG. */
(function (MB) {

const f2 = (v) => +v.toFixed(2);
const poly = (pts) => 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join(' L') + ' Z';
const starPts = (n, R, r, cx = 50, cy = 50, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (rot + i * 180 / n) * Math.PI / 180, d = i % 2 ? r : R; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
});
const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const E = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const cmdD = (cmds) => cmds.map(c => c[0] + c.slice(1).map(f2).join(' ')).join(' ');
/* rounded star: every point and every valley softened with curves */
function softStar(n, R, r, cx = 50, cy = 50) {
  const pts = starPts(n, R, r, cx, cy), out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (!i) out.push(`M${f2(m[0])} ${f2(m[1])}`);
    const nq = pts[(i + 2) % pts.length], m2 = [(q[0] + nq[0]) / 2, (q[1] + nq[1]) / 2];
    out.push(`Q${f2(q[0])} ${f2(q[1])} ${f2(m2[0])} ${f2(m2[1])}`);
  }
  return out.join(' ') + 'Z';
}
function scallopCircle(cx, cy, R, n, b) { // round badge with n bumps
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], p1 = [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R], c = [cx + Math.cos(am) * (R + b * 2), cy + Math.sin(am) * (R + b * 2)];
    if (!i) out.push(`M${f2(p0[0])} ${f2(p0[1])}`);
    out.push(`Q${f2(c[0])} ${f2(c[1])} ${f2(p1[0])} ${f2(p1[1])}`);
  }
  return out.join(' ') + 'Z';
}
const HEART = 'M50 90 C20 68 4 50 4 31 C4 16 15 6 28 6 C38 6 46 12 50 21 C54 12 62 6 72 6 C85 6 96 16 96 31 C96 50 80 68 50 90Z';
const DARK = '#4A3A3A', PINK = '#FF9EBB';

const L = [
  // ---------- ดาว / ประกาย ----------
  ['star4', 'ดาว 4 แฉก', 'ดาว', 'orn', svg('0 0 100 100', P(poly(starPts(4, 48, 14)), '#FFD34D'))],
  ['sparkle4', 'ประกาย 4 แฉก', 'ดาว', 'orn', svg('0 0 100 100', P('M50 2 Q55 45 98 50 Q55 55 50 98 Q45 55 2 50 Q45 45 50 2Z', '#FFD34D'))],
  ['sparkle4thin', 'ประกายเรียว', 'ดาว', 'orn', svg('0 0 100 100', P('M50 0 Q52.5 47.5 100 50 Q52.5 52.5 50 100 Q47.5 52.5 0 50 Q47.5 47.5 50 0Z', '#FFE58A'))],
  ['star5', 'ดาว 5 แฉก', 'ดาว', 'orn', svg('0 0 100 100', P(poly(starPts(5, 49, 20, 50, 53)), '#FFD34D'))],
  ['star5soft', 'ดาวมน 5 แฉก', 'ดาว', 'orn', svg('0 0 100 100', P(softStar(5, 50, 24, 50, 53), '#FFC94D'))],
  ['star5fat', 'ดาวอ้วน', 'ดาว', 'orn', svg('0 0 100 100', P(softStar(5, 48, 30, 50, 53), '#FFB84D') + C(40, 50, 4, DARK) + C(60, 50, 4, DARK) + P('M44 60 Q50 66 56 60', 'none', `stroke="${DARK}" stroke-width="3" stroke-linecap="round"`))],
  ['star6', 'ดาว 6 แฉก', 'ดาว', 'orn', svg('0 0 100 100', P(poly(starPts(6, 48, 26)), '#FFD34D'))],
  ['star8', 'ดาว 8 แฉก', 'ดาว', 'orn', svg('0 0 100 100', P(poly(starPts(8, 48, 22)), '#FFD34D'))],
  ['star8sparkle', 'ประกาย 8 แฉก', 'ดาว', 'orn', svg('0 0 100 100', P(poly(starPts(4, 48, 9)), '#FFD34D') + P(poly(starPts(4, 30, 7, 50, 50, -45)), '#FFE9A0'))],
  ['sparkles3', 'ประกาย 3 ดวง', 'ดาว', 'decor', svg('0 0 120 100', P('M45 10 Q49 45 85 50 Q49 55 45 90 Q41 55 5 50 Q41 45 45 10Z', '#FFD34D') + P('M95 5 Q97 22 115 25 Q97 28 95 45 Q93 28 75 25 Q93 22 95 5Z', '#FF9EBB') + P('M98 62 Q99.5 74 112 76 Q99.5 78 98 90 Q96.5 78 84 76 Q96.5 74 98 62Z', '#9EC9FF'))],
  ['shootingstar', 'ดาวตก', 'ดาว', 'decor', svg('0 0 140 80', P('M8 62 Q60 40 96 30 L98 38 Q62 46 12 70Z', '#FFE58A', 'opacity="0.8"') + P(poly(starPts(5, 26, 11, 108, 30)), '#FFD34D'))],
  ['burst12', 'ดาวแตก 12', 'ดาว', 'orn', svg('0 0 100 100', P(poly(starPts(12, 49, 38)), '#FF6FA8'))],
  // ---------- ไพ่ ----------
  ['spade', 'โพดำ ♠', 'ไพ่', 'orn', svg('0 0 100 100', P('M50 4 C80 28 96 45 96 61 C96 75 85 83 72 83 C63 83 56 79 52 72 C53 82 57 90 64 96 L36 96 C43 90 47 82 48 72 C44 79 37 83 28 83 C15 83 4 75 4 61 C4 45 20 28 50 4Z', '#2E2A3A'))],
  ['heartsuit', 'โพแดง ♥', 'ไพ่', 'orn', svg('0 0 100 100', P(HEART, '#E8455A'))],
  ['diamond', 'ข้าวหลามตัด ♦', 'ไพ่', 'orn', svg('0 0 100 100', P('M50 2 Q66 30 88 50 Q66 70 50 98 Q34 70 12 50 Q34 30 50 2Z', '#E8455A'))],
  ['club', 'ดอกจิก ♣', 'ไพ่', 'orn', svg('0 0 100 100', C(50, 28, 21, '#2E2A3A') + C(27, 58, 21, '#2E2A3A') + C(73, 58, 21, '#2E2A3A') + C(50, 52, 13, '#2E2A3A') + P('M46 56 C46 76 40 88 31 96 L69 96 C60 88 54 76 54 56Z', '#2E2A3A'))],
  ['card', 'ไพ่ 1 ใบ', 'ไพ่', 'decor', svg('0 0 72 100', `<rect x="2" y="2" width="68" height="96" rx="8" fill="#FFFFFF" stroke="#2E2A3A" stroke-width="3"/>` + `<g transform="translate(16 30) scale(0.4)">${P(HEART, '#E8455A')}</g>`)],
  // ---------- ดนตรี ----------
  ['note8', 'ตัวโน้ต ♪', 'ดนตรี', 'orn', svg('0 0 80 100', E(30, 80, 18, 13, '#7C5CFF', 'transform="rotate(-20 30 80)"') + `<rect x="42" y="10" width="7" height="70" fill="#7C5CFF"/>` + P('M49 10 C56 26 76 30 74 54 C71 42 62 37 49 35Z', '#7C5CFF'))],
  ['note4', 'ตัวโน้ตดำ', 'ดนตรี', 'orn', svg('0 0 60 100', E(26, 82, 18, 13, '#7C5CFF', 'transform="rotate(-20 26 82)"') + `<rect x="38" y="6" width="7" height="76" fill="#7C5CFF"/>`)],
  ['note16', 'โน้ตคู่ ♫', 'ดนตรี', 'orn', svg('0 0 110 100', E(26, 82, 17, 12, '#7C5CFF', 'transform="rotate(-20 26 82)"') + E(82, 72, 17, 12, '#7C5CFF', 'transform="rotate(-20 82 72)"') + `<rect x="37" y="16" width="7" height="66" fill="#7C5CFF"/><rect x="93" y="6" width="7" height="66" fill="#7C5CFF"/>` + P('M37 16 L100 4 L100 18 L37 30Z', '#7C5CFF'))],
  ['notecute', 'โน้ตหัวใจ', 'ดนตรี', 'decor', svg('0 0 80 100', `<g transform="translate(4 58) scale(0.38)">${P(HEART, '#FF6FA8')}</g>` + `<rect x="38" y="8" width="6" height="66" fill="#FF6FA8"/>` + P('M44 8 C52 22 70 26 68 46 C65 36 57 32 44 30Z', '#FF6FA8'))],
  // ---------- สัตว์ ----------
  ['cat', 'แมว', 'สัตว์', 'decor', svg('0 0 100 100', P('M12 46 L16 6 L44 28Z', '#FFC98B') + P('M88 46 L84 6 L56 28Z', '#FFC98B') + P('M20 34 L21 16 L35 28Z', PINK) + P('M80 34 L79 16 L65 28Z', PINK) + E(50, 60, 42, 34, '#FFC98B') + E(35, 58, 4.5, 6.5, DARK) + E(65, 58, 4.5, 6.5, DARK) + P('M46 68 L54 68 L50 73Z', '#FF7A9C') + P('M50 73 Q46 79 41 76 M50 73 Q54 79 59 76', 'none', `stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"`) + C(26, 70, 5, PINK, 'opacity="0.6"') + C(74, 70, 5, PINK, 'opacity="0.6"'))],
  ['bear', 'หมี', 'สัตว์', 'decor', svg('0 0 100 100', C(20, 24, 15, '#C9976B') + C(80, 24, 15, '#C9976B') + C(20, 24, 8, '#E8C29E') + C(80, 24, 8, '#E8C29E') + C(50, 56, 40, '#C9976B') + E(50, 70, 17, 13, '#F2DCC4') + E(50, 64, 6.5, 4.5, DARK) + C(35, 50, 4.5, DARK) + C(65, 50, 4.5, DARK) + P('M50 69 Q46 75 42 73 M50 69 Q54 75 58 73', 'none', `stroke="${DARK}" stroke-width="2.2" stroke-linecap="round"`))],
  ['bunny', 'กระต่าย', 'สัตว์', 'decor', svg('0 0 100 110', E(34, 30, 10, 28, '#FFF2F6', 'transform="rotate(-10 34 30)"') + E(66, 30, 10, 28, '#FFF2F6', 'transform="rotate(10 66 30)"') + E(34, 32, 5, 19, PINK, 'transform="rotate(-10 34 32)"') + E(66, 32, 5, 19, PINK, 'transform="rotate(10 66 32)"') + E(50, 76, 36, 30, '#FFF2F6') + C(38, 74, 4, DARK) + C(62, 74, 4, DARK) + E(50, 82, 4, 3, '#FF7A9C') + C(30, 84, 5, PINK, 'opacity="0.6"') + C(70, 84, 5, PINK, 'opacity="0.6"'))],
  ['dog', 'หมา', 'สัตว์', 'decor', svg('0 0 100 100', E(18, 50, 13, 27, '#A86F45', 'transform="rotate(18 18 50)"') + E(82, 50, 13, 27, '#A86F45', 'transform="rotate(-18 82 50)"') + E(50, 54, 35, 37, '#F2C894') + E(50, 70, 18, 14, '#FFF1DC') + E(50, 63, 7, 5, DARK) + C(36, 50, 4.5, DARK) + C(64, 50, 4.5, DARK) + E(50, 78, 5, 6, '#FF7A9C'))],
  ['paw', 'รอยเท้า', 'สัตว์', 'orn', svg('0 0 100 100', E(50, 66, 24, 20, '#C9976B') + E(22, 40, 10, 13, '#C9976B') + E(40, 24, 10, 13, '#C9976B') + E(60, 24, 10, 13, '#C9976B') + E(78, 40, 10, 13, '#C9976B'))],
  ['fish', 'ปลา', 'สัตว์', 'decor', svg('0 0 120 70', P('M10 35 Q40 2 80 35 Q40 68 10 35Z', '#7EC8F5') + P('M78 35 L112 14 L104 35 L112 56Z', '#5AAEE6') + C(32, 30, 4, DARK))],
  // ---------- ท้องฟ้า ----------
  ['moon', 'จันทร์เสี้ยว', 'ท้องฟ้า', 'orn', svg('0 0 100 100', P('M62 4 A46 46 0 1 0 96 70 A37 37 0 1 1 62 4Z', '#FFE08A'))],
  ['moonstar', 'จันทร์ + ดาว', 'ท้องฟ้า', 'decor', svg('0 0 120 100', P('M60 4 A46 46 0 1 0 94 70 A37 37 0 1 1 60 4Z', '#FFE08A') + P(poly(starPts(5, 14, 6, 100, 24)), '#FFD34D'))],
  ['cloud', 'เมฆ', 'ท้องฟ้า', 'decor', svg('0 0 120 70', C(36, 42, 22, '#FFFFFF') + C(62, 30, 26, '#FFFFFF') + C(88, 44, 20, '#FFFFFF') + `<rect x="30" y="42" width="64" height="22" rx="11" fill="#FFFFFF"/>`)],
  ['cloudpuff', 'เมฆปุย', 'ท้องฟ้า', 'decor', svg('0 0 120 80', P(cmdD(MB.shapePath('cloud', 0, 0, 120, 70, { bump: 0.2 })), '#EAF4FF'))],
  ['cloudcute', 'เมฆยิ้ม', 'ท้องฟ้า', 'decor', svg('0 0 120 70', C(36, 42, 22, '#FFFFFF') + C(62, 30, 26, '#FFFFFF') + C(88, 44, 20, '#FFFFFF') + `<rect x="30" y="42" width="64" height="22" rx="11" fill="#FFFFFF"/>` + C(52, 44, 3.5, DARK) + C(72, 44, 3.5, DARK) + P('M57 51 Q62 56 67 51', 'none', `stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"`) + C(46, 52, 4, PINK, 'opacity="0.6"') + C(78, 52, 4, PINK, 'opacity="0.6"'))],
  ['sun', 'พระอาทิตย์', 'ท้องฟ้า', 'decor', svg('0 0 100 100', P(poly(starPts(12, 48, 34)), '#FFC94D') + C(50, 50, 28, '#FFE08A'))],
  ['rainbow', 'รุ้ง', 'ท้องฟ้า', 'decor', svg('0 0 120 66', P('M6 62 A54 54 0 0 1 114 62 L102 62 A42 42 0 0 0 18 62Z', '#FF9EBB') + P('M18 62 A42 42 0 0 1 102 62 L90 62 A30 30 0 0 0 30 62Z', '#FFE08A') + P('M30 62 A30 30 0 0 1 90 62 L78 62 A18 18 0 0 0 42 62Z', '#9EC9FF'))],
  // ---------- น่ารัก ----------
  ['heart', 'หัวใจ', 'น่ารัก', 'orn', svg('0 0 100 100', P(HEART, '#FF6FA8'))],
  ['hearts2', 'หัวใจคู่', 'น่ารัก', 'orn', svg('0 0 130 100', P(HEART, '#FF6FA8') + `<g transform="translate(70 30) scale(0.6)">${P(HEART, '#B48CFF')}</g>`)],
  ['bow', 'โบว์', 'น่ารัก', 'orn', svg('0 0 120 80', P('M60 38 C40 6 6 8 8 34 C10 58 40 56 60 42Z', '#FF8FB8') + P('M60 38 C80 6 114 8 112 34 C110 58 80 56 60 42Z', '#FF8FB8') + P('M54 44 L38 78 L48 74 L56 80 L60 46Z', '#F2709F') + P('M66 44 L82 78 L72 74 L64 80 L60 46Z', '#F2709F') + E(60, 40, 9, 11, '#F2709F'))],
  ['flower', 'ดอกไม้', 'น่ารัก', 'orn', svg('0 0 100 100', [0, 72, 144, 216, 288].map(a => { const r = (a - 90) * Math.PI / 180; return C(f2(50 + Math.cos(r) * 24), f2(50 + Math.sin(r) * 24), 21, '#FFB3CF'); }).join('') + C(50, 50, 14, '#FFD34D'))],
  ['crown', 'มงกุฎ', 'น่ารัก', 'orn', svg('0 0 100 80', P('M8 66 L14 16 L34 42 L50 8 L66 42 L86 16 L92 66Z', '#FFC94D') + `<rect x="8" y="64" width="84" height="12" rx="3" fill="#E8A92E"/>` + C(14, 14, 5, '#FF6FA8') + C(50, 8, 6, '#9EC9FF') + C(86, 14, 5, '#FF6FA8'))],
  ['ribbonrose', 'ดอกกุหลาบ', 'น่ารัก', 'decor', svg('0 0 100 100', C(50, 46, 34, '#FF6F91') + P('M50 18 C70 20 76 40 62 50 C52 58 38 50 42 40 C46 32 56 34 54 42', 'none', 'stroke="#D94A70" stroke-width="5" stroke-linecap="round"') + P('M30 80 Q20 96 40 92 Q46 86 44 78Z', '#7BC67B') + P('M70 80 Q80 96 60 92 Q54 86 56 78Z', '#7BC67B'))],
  ['candy', 'ลูกอม', 'น่ารัก', 'decor', svg('0 0 120 60', P('M30 30 L6 10 L10 30 L6 50Z', '#FFB3CF') + P('M90 30 L114 10 L110 30 L114 50Z', '#FFB3CF') + C(60, 30, 26, '#FF6FA8') + P('M42 16 Q60 30 42 46 M60 4 Q78 30 60 56', 'none', 'stroke="#FFFFFF" stroke-width="5" opacity="0.7"'))],
  ['lightning', 'สายฟ้า', 'น่ารัก', 'orn', svg('0 0 70 100', P('M42 2 L8 56 L32 56 L24 98 L62 38 L38 38 L50 2Z', '#FFD34D'))],
  ['drop', 'หยดน้ำ', 'น่ารัก', 'orn', svg('0 0 70 100', P('M35 4 C50 30 64 46 64 64 A29 29 0 0 1 6 64 C6 46 20 30 35 4Z', '#7EC8F5'))],
  // ---------- ป้ายราคา ----------
  ['tagbanner', 'ริบบิ้นพับปลาย', 'ป้ายราคา', 'tag', svg('0 0 220 80', P('M0 22 L28 22 L28 10 L192 10 L192 22 L220 22 L206 44 L220 66 L192 66 L192 70 L28 70 L28 66 L0 66 L14 44Z', '#E8457A') + P('M28 66 L28 70 L40 66Z', '#B8325E') + P('M192 66 L192 70 L180 66Z', '#B8325E'))],
  ['tagscallop', 'ป้ายขอบหยัก', 'ป้ายราคา', 'tag', svg('0 0 220 90', P(cmdD(MB.shapePath('cloud', 0, 0, 220, 90, { bump: 0.11 })), '#29A3E3'))],
  ['tagticket', 'ตั๋ว', 'ป้ายราคา', 'tag', svg('0 0 220 90', P(cmdD(MB.shapePath('ticket', 0, 0, 220, 90, { r: 10, notchY: 45 })), '#FFB84D'))],
  ['tagbadge', 'เหรียญหยัก', 'ป้ายราคา', 'tag', svg('0 0 120 120', P(scallopCircle(60, 60, 50, 18, 3.2), '#E8457A') + C(60, 60, 42, 'none', 'stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="4 4"'))],
  ['tagheart', 'ป้ายหัวใจคู่', 'ป้ายราคา', 'tag', svg('0 0 230 90', `<rect x="20" y="12" width="190" height="66" rx="33" fill="#FF6FA8"/>` + `<g transform="translate(0 22) scale(0.42)">${P(HEART, '#FF6FA8')}</g>` + `<g transform="translate(188 22) scale(0.42)">${P(HEART, '#FF6FA8')}</g>`)],
  ['tagstar', 'ป้ายดาวปลาย', 'ป้ายราคา', 'tag', svg('0 0 240 90', `<rect x="26" y="14" width="188" height="62" rx="31" fill="#7C5CFF"/>` + P(poly(starPts(5, 26, 11, 26, 45)), '#FFD34D') + P(poly(starPts(5, 26, 11, 214, 45)), '#FFD34D'))],
  ['tagcloud', 'ป้ายเมฆ', 'ป้ายราคา', 'tag', svg('0 0 230 90', C(40, 52, 32, '#FFFFFF') + C(84, 34, 30, '#FFFFFF') + C(132, 32, 32, '#FFFFFF') + C(180, 46, 32, '#FFFFFF') + `<rect x="30" y="44" width="170" height="40" rx="20" fill="#FFFFFF"/>`)],
];
MB.VLIB = L.map(([key, name, cat, role, svgText]) => ({ key, name, cat, role, svg: svgText }));
MB.VLIB_CATS = ['ทั้งหมด', 'ดาว', 'ไพ่', 'ดนตรี', 'สัตว์', 'ท้องฟ้า', 'น่ารัก', 'ป้ายราคา'];
const cache = {};
MB.vlibVector = (key) => { if (!cache[key]) { const it = MB.VLIB.find(x => x.key === key); cache[key] = MB.svgToVector(it.svg); } return cache[key]; };
/* add (or reuse) a library item as a vector asset of this project */
MB.vlibAsset = (key) => {
  const st = MB.state, it = MB.VLIB.find(x => x.key === key);
  const have = (st.vecLib || []).find(id => MB.assets[id] && MB.assets[id].libKey === key);
  if (have) return MB.assets[have];
  const a = MB.addVectorAsset(JSON.parse(JSON.stringify(MB.vlibVector(key))), it.name, it.role);
  a.libKey = key;
  return a;
};

})(window.MB);
