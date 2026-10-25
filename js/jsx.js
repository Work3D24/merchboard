'use strict';
/* MerchBoard Studio — ExtendScript builders for Photoshop (PSD/PSB) and Illustrator (AI + vector PDF).
   Placeholders: __MB_DATA__ (scene JSON, ASCII-escaped), __MB_ASSET_DIR__, __MB_OUT_DIR__ (filled by server.py;
   if left as-is the script falls back to "<script folder>/assets" and the script folder). */
(function (MB) {

MB.JSX_PS = String.raw`// MerchBoard Studio -> Photoshop builder (generated file, safe to re-run)
#target photoshop
app.bringToFront();
(function () {
var D = __MB_DATA__;
var ASSET_DIR = "__MB_ASSET_DIR__", OUT_DIR = "__MB_OUT_DIR__";
var HERE = File($.fileName).parent.fsName.replace(/\\/g, "/");
if (ASSET_DIR.indexOf("__MB_") === 0) ASSET_DIR = HERE + "/assets";
if (OUT_DIR.indexOf("__MB_") === 0) OUT_DIR = HERE;
var WARN = [], NOTE = [], cTID = charIDToTypeID, sTID = stringIDToTypeID, doc;
var oldRU = app.preferences.rulerUnits, oldTU = app.preferences.typeUnits, oldDD = app.displayDialogs;
app.preferences.rulerUnits = Units.PIXELS; app.preferences.typeUnits = TypeUnits.PIXELS; app.displayDialogs = DialogModes.NO;
try { build(); } catch (e) { WARN.push("ERROR: " + e + (e.line ? " (line " + e.line + ")" : "")); }
app.preferences.rulerUnits = oldRU; app.preferences.typeUnits = oldTU; app.displayDialogs = oldDD;
writeLog();
if (WARN.length) alert("MerchBoard Studio\n\n" + WARN.slice(0, 18).join("\n"));

var CUR;
function build() {
  if (D.combine) { buildCombined(); return; }
  for (var pi = 0; pi < D.pages.length; pi++) { CUR = D.pages[pi]; buildPage(); }
}
/* all pages in one document, one artboard per page: each page is built as a plain group at the origin (artboards
   change how new layers / paths are positioned), moved to its grid slot, then turned into an exact-size artboard */
function buildCombined() {
  var n = D.pages.length, cols = D.cols, rows = Math.ceil(n / cols), gap = D.gap;
  doc = app.documents.add(UnitValue(cols * D.W + (cols - 1) * gap, "px"), UnitValue(rows * D.H + (rows - 1) * gap, "px"), 72, D.name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
  var first = doc.layers[0], sets = [];
  for (var pi = 0; pi < n; pi++) {
    CUR = D.pages[pi];
    var set = doc.layerSets.add(); putIn(set, doc); set.name = CUR.name;
    for (var i = 0; i < CUR.tree.length; i++) addItem(set, CUR.tree[i]);
    var ox = (pi % cols) * (D.W + gap), oy = Math.floor(pi / cols) * (D.H + gap);
    if (ox || oy) set.translate(ox, oy);
    sets.push({ set: set, l: ox, t: oy });
  }
  try { first.remove(); } catch (e) {}
  // where every page's content belongs, measured before any artboard exists (creating artboards shifts layers around)
  for (j = 0; j < sets.length; j++) sets[j].exp = boundsOf(sets[j].set);
  for (var j = 0; j < sets.length; j++) {
    try { toArtboard(sets[j].set, sets[j].l, sets[j].t, sets[j].l + D.W, sets[j].t + D.H, sets[j].set.name, sets[j].exp); }
    catch (e) { WARN.push("Artboard " + (j + 1) + ": " + e); }
  }
  for (j = 0; j < sets.length; j++) realign(sets[j].set, sets[j].exp);
  doc.resizeImage(undefined, undefined, D.dpi, ResampleMethod.NONE);
  if (D.mode === "CMYK") { try { doc.changeMode(ChangeMode.CMYK); } catch (e) { WARN.push("CMYK convert: " + e); } }
  CUR = { file: D.file };
  save();
}
function boundsOf(L) { var b = L.bounds; return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")]; }
function rectDesc(l, t, r, b) { var rc = new ActionDescriptor(); rc.putDouble(sTID("top"), t); rc.putDouble(sTID("left"), l); rc.putDouble(sTID("bottom"), b); rc.putDouble(sTID("right"), r); return rc; }
function realign(set, exp) {
  var now = boundsOf(set);
  if (Math.abs(now[0] - exp[0]) > 0.5 || Math.abs(now[1] - exp[1]) > 0.5) set.translate(exp[0] - now[0], exp[1] - now[1]);
}
function toArtboard(set, l, t, r, b, name, exp) {
  var before = boundsOf(set);
  doc.activeLayer = set;
  var d = new ActionDescriptor(), ref = new ActionReference(), r2 = new ActionReference(), ab = new ActionDescriptor();
  ref.putClass(sTID("artboardSection")); d.putReference(cTID("null"), ref);
  r2.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt")); d.putReference(cTID("From"), r2);
  ab.putObject(sTID("artboardRect"), sTID("classFloatRect"), rectDesc(l, t, r, b)); d.putObject(sTID("artboard"), sTID("artboard"), ab);
  executeAction(cTID("Mk  "), d, DialogModes.NO);
  var board = doc.activeLayer, after = boundsOf(set);
  if (after[0] !== before[0] || after[1] !== before[1]) set.translate(before[0] - after[0], before[1] - after[1]);
  doc.activeLayer = board;
  var e = new ActionDescriptor(), er = new ActionReference(), eab = new ActionDescriptor();
  er.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt")); e.putReference(cTID("null"), er);
  eab.putObject(sTID("artboardRect"), sTID("classFloatRect"), rectDesc(l, t, r, b)); e.putObject(sTID("artboard"), sTID("artboard"), eab);
  e.putInteger(sTID("changeSizes"), 1);
  executeAction(sTID("editArtboardEvent"), e, DialogModes.NO);
  board.name = name;
  // editing the artboard rect drags its content along: put the content back where it was built
  realign(set, exp);
}
function buildPage() {
  // built at 72 ppi so every AM pixel value / type size is 1:1, then re-tagged to the target dpi without resampling
  doc = app.documents.add(UnitValue(D.W, "px"), UnitValue(D.H, "px"), 72, CUR.name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
  var first = doc.layers[0];
  for (var i = 0; i < CUR.tree.length; i++) addItem(doc, CUR.tree[i]);
  try { if (doc.layers.length > 1) first.remove(); } catch (e) {}
  doc.resizeImage(undefined, undefined, D.dpi, ResampleMethod.NONE);
  if (D.mode === "CMYK") { try { doc.changeMode(ChangeMode.CMYK); } catch (e) { WARN.push("CMYK convert: " + e); } }
  save();
}
function putIn(L, container) {
  try {
    if (container.typename === "Document") { if (container.layers[0] !== L) L.move(container.layers[0], ElementPlacement.PLACEBEFORE); }
    else L.move(container, ElementPlacement.PLACEATBEGINNING);
  } catch (e) {}
}
function addItem(container, p) {
  var L = null;
  try {
    if (p.t === "g") {
      L = container.layerSets.add(); putIn(L, container); L.name = p.n;
      for (var i = 0; i < p.c.length; i++) addItem(L, p.c[i]);
      return;
    }
    if (p.t === "r") L = makeRect(p);
    else if (p.t === "p") L = makePath(p);
    else if (p.t === "i") L = makeImage(p);
    else if (p.t === "t") L = makeText(container, p);
    if (!L) return;
    putIn(L, container);
    L.name = p.n || L.name;
    if (p.op != null && p.op < 1) L.opacity = Math.round(p.op * 1000) / 10;
  } catch (e) { WARN.push("[" + p.n + "] " + e + (e.line ? " (line " + e.line + ")" : "")); }
}
function rgbDesc(hex) {
  var c = hexRGB(hex), d = new ActionDescriptor();
  d.putDouble(cTID("Rd  "), c[0]); d.putDouble(cTID("Grn "), c[1]); d.putDouble(cTID("Bl  "), c[2]);
  return d;
}
function hexRGB(h) { h = String(h || "#000000").replace("#", ""); if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function makeRect(p) {
  var d = new ActionDescriptor(), r = new ActionReference();
  r.putClass(sTID("contentLayer")); d.putReference(cTID("null"), r);
  var u = new ActionDescriptor(), cd = new ActionDescriptor();
  cd.putObject(cTID("Clr "), cTID("RGBC"), rgbDesc(p.fill || "#ffffff"));
  u.putObject(cTID("Type"), sTID("solidColorLayer"), cd);
  var s = new ActionDescriptor(), px = cTID("#Pxl");
  s.putInteger(sTID("unitValueQuadVersion"), 1); // required for the corner radii below to be honoured
  s.putUnitDouble(cTID("Top "), px, p.y); s.putUnitDouble(cTID("Left"), px, p.x);
  s.putUnitDouble(cTID("Btom"), px, p.y + p.h); s.putUnitDouble(cTID("Rght"), px, p.x + p.w);
  var rad = Math.max(0, Math.min(p.r || 0, p.w / 2, p.h / 2));
  if (rad > 0) {
    s.putUnitDouble(sTID("topLeft"), px, rad); s.putUnitDouble(sTID("topRight"), px, rad);
    s.putUnitDouble(sTID("bottomLeft"), px, rad); s.putUnitDouble(sTID("bottomRight"), px, rad);
  }
  u.putObject(cTID("Shp "), cTID("Rctn"), s);
  d.putObject(cTID("Usng"), sTID("contentLayer"), u);
  executeAction(cTID("Mk  "), d, DialogModes.NO);
  var L = doc.activeLayer;
  if (p.sw && p.stroke) { try { addStroke(p.sw, p.stroke); } catch (e) { WARN.push("stroke: " + e); } }
  if (!p.fill) L.fillOpacity = 0;
  if (p.rot) L.rotate(p.rot, AnchorPosition.MIDDLECENTER);
  return L;
}
/* custom vector shape (cloud card, ticket, starburst…) as an editable shape layer */
function pathPoints(p) {
  var subs = [], cur = null;
  for (var i = 0; i < p.d.length; i++) {
    var c = p.d[i];
    if (c[0] === "M") { cur = { pts: [{ a: [c[1], c[2]] }] }; subs.push(cur); }
    else if (c[0] === "L") cur.pts.push({ a: [c[1], c[2]] });
    else if (c[0] === "C") { cur.pts[cur.pts.length - 1].r = [c[1], c[2]]; cur.pts.push({ a: [c[5], c[6]], l: [c[3], c[4]] }); }
    else if (c[0] === "Z" && cur && cur.pts.length > 1) {
      var f = cur.pts[0], la = cur.pts[cur.pts.length - 1];
      if (Math.abs(f.a[0] - la.a[0]) < 0.01 && Math.abs(f.a[1] - la.a[1]) < 0.01) { f.l = la.l; cur.pts.pop(); }
    }
  }
  return subs;
}
function makePath(p) {
  var subs = pathPoints(p), infos = [];
  for (var s = 0; s < subs.length; s++) {
    var arr = [];
    for (var i = 0; i < subs[s].pts.length; i++) {
      var q = subs[s].pts[i], pp = new PathPointInfo();
      pp.kind = PointKind.CORNERPOINT; pp.anchor = q.a; pp.leftDirection = q.l || q.a; pp.rightDirection = q.r || q.a; arr.push(pp);
    }
    var spi = new SubPathInfo(); spi.closed = true; spi.operation = ShapeOperation.SHAPEXOR; spi.entireSubPath = arr; infos.push(spi);
  }
  var wp = doc.pathItems.add("mb_tmp_path", infos); wp.select();
  var d = new ActionDescriptor(), r = new ActionReference(), u = new ActionDescriptor(), cd = new ActionDescriptor();
  r.putClass(sTID("contentLayer")); d.putReference(cTID("null"), r);
  cd.putObject(cTID("Clr "), cTID("RGBC"), rgbDesc(p.fill || "#ffffff"));
  u.putObject(cTID("Type"), sTID("solidColorLayer"), cd); d.putObject(cTID("Usng"), sTID("contentLayer"), u);
  executeAction(cTID("Mk  "), d, DialogModes.NO);
  var L = doc.activeLayer;
  try { wp.remove(); } catch (e) {}
  if (p.sw && p.stroke) { try { addStroke(p.sw, p.stroke); } catch (e) { WARN.push("stroke: " + e); } }
  if (!p.fill) L.fillOpacity = 0;
  return L;
}
function addStroke(w, hex) {
  var d = new ActionDescriptor(), r = new ActionReference();
  r.putProperty(cTID("Prpr"), cTID("Lefx")); r.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
  d.putReference(cTID("null"), r);
  var fx = new ActionDescriptor(), st = new ActionDescriptor();
  fx.putUnitDouble(cTID("Scl "), cTID("#Prc"), 100);
  st.putBoolean(cTID("enab"), true);
  st.putEnumerated(cTID("Styl"), cTID("FStl"), cTID("InsF"));
  st.putEnumerated(cTID("PntT"), cTID("FrFl"), cTID("SClr"));
  st.putEnumerated(cTID("Md  "), cTID("BlnM"), cTID("Nrml"));
  st.putUnitDouble(cTID("Opct"), cTID("#Prc"), 100);
  st.putUnitDouble(cTID("Sz  "), cTID("#Pxl"), w);
  st.putObject(cTID("Clr "), cTID("RGBC"), rgbDesc(hex));
  fx.putObject(cTID("FrFX"), cTID("FrFX"), st);
  d.putObject(cTID("T   "), cTID("Lefx"), fx);
  executeAction(cTID("setd"), d, DialogModes.NO);
}
function makeText(container, p) {
  var L = container.artLayers.add();
  L.kind = LayerKind.TEXT;
  var t = L.textItem;
  t.contents = p.s.replace(/\n/g, "\r");
  try { t.font = p.font; } catch (e) {}
  if (t.font !== p.font) WARN.push("Font missing, substituted: " + p.font);
  t.size = p.size;
  var col = new SolidColor(), c = hexRGB(p.color);
  col.rgb.red = c[0]; col.rgb.green = c[1]; col.rgb.blue = c[2]; t.color = col;
  t.justification = p.al === "center" ? Justification.CENTER : (p.al === "right" ? Justification.RIGHT : Justification.LEFT);
  if (p.s.indexOf("\n") >= 0) { t.useAutoLeading = false; t.leading = p.size * (p.lh || 1.15); }
  t.position = [p.x, p.y];
  if (p.tr) t.tracking = p.tr;
  if (p.fx) {
    if (p.fx.bold) t.fauxBold = true;
    applyFx(p.fx, p.color);
  }
  if (p.rot) L.rotate(p.rot, AnchorPosition.MIDDLECENTER);
  return L;
}
function linContour() { var c = new ActionDescriptor(); c.putString(cTID("Nm  "), "Linear"); return c; }
function applyFx(fx, base) {
  var parts = [], px = cTID("#Pxl"), pc = cTID("#Prc"), ang = cTID("#Ang");
  if (fx.glow.on) {
    var g = new ActionDescriptor();
    g.putBoolean(cTID("enab"), true); g.putEnumerated(cTID("Md  "), cTID("BlnM"), cTID("Nrml")); // Screen vanishes on light BGs
    g.putObject(cTID("Clr "), cTID("RGBC"), rgbDesc(fx.glow.color)); g.putUnitDouble(cTID("Opct"), pc, fx.glow.op * 100);
    g.putEnumerated(cTID("GlwT"), cTID("BETE"), cTID("SfBL")); g.putUnitDouble(cTID("Ckmt"), px, 0);
    g.putUnitDouble(cTID("blur"), px, fx.glow.size); g.putUnitDouble(cTID("Nose"), pc, 0); g.putUnitDouble(cTID("ShdN"), pc, 0);
    g.putBoolean(cTID("AntA"), false); g.putObject(cTID("TrnS"), cTID("ShpC"), linContour()); g.putUnitDouble(cTID("Inpr"), pc, 50);
    parts.push(["OrGl", g]);
  }
  if (fx.shadow.on) {
    var s = new ActionDescriptor();
    s.putBoolean(cTID("enab"), true); s.putEnumerated(cTID("Md  "), cTID("BlnM"), cTID("Mltp"));
    s.putObject(cTID("Clr "), cTID("RGBC"), rgbDesc(fx.shadow.color)); s.putUnitDouble(cTID("Opct"), pc, fx.shadow.op * 100);
    s.putBoolean(cTID("uglg"), false); s.putUnitDouble(cTID("lagl"), ang, fx.shadow.angle);
    s.putUnitDouble(cTID("Dstn"), px, fx.shadow.dist); s.putUnitDouble(cTID("Ckmt"), px, 0); s.putUnitDouble(cTID("blur"), px, fx.shadow.blur);
    s.putUnitDouble(cTID("Nose"), pc, 0); s.putBoolean(cTID("AntA"), false); s.putObject(cTID("TrnS"), cTID("ShpC"), linContour());
    s.putBoolean(sTID("layerConceals"), true);
    parts.push(["DrSh", s]);
  }
  if (fx.stroke.on) {
    var st = new ActionDescriptor();
    st.putBoolean(cTID("enab"), true); st.putEnumerated(cTID("Styl"), cTID("FStl"), cTID("OutF"));
    st.putEnumerated(cTID("PntT"), cTID("FrFl"), cTID("SClr")); st.putEnumerated(cTID("Md  "), cTID("BlnM"), cTID("Nrml"));
    st.putUnitDouble(cTID("Opct"), pc, 100); st.putUnitDouble(cTID("Sz  "), px, fx.stroke.w);
    st.putObject(cTID("Clr "), cTID("RGBC"), rgbDesc(fx.stroke.color));
    parts.push(["FrFX", st]);
  }
  if (fx.grad.on) {
    var gf = new ActionDescriptor(), gr = new ActionDescriptor(), clrs = new ActionList(), trns = new ActionList(), cols = [base, fx.grad.c2];
    for (var i = 0; i < 2; i++) {
      var cs = new ActionDescriptor();
      cs.putObject(cTID("Clr "), cTID("RGBC"), rgbDesc(cols[i])); cs.putEnumerated(cTID("Type"), cTID("Clry"), cTID("UsrS"));
      cs.putInteger(cTID("Lctn"), i * 4096); cs.putInteger(cTID("Mdpn"), 50); clrs.putObject(cTID("Clrt"), cs);
      var ts = new ActionDescriptor();
      ts.putUnitDouble(cTID("Opct"), pc, 100); ts.putInteger(cTID("Lctn"), i * 4096); ts.putInteger(cTID("Mdpn"), 50); trns.putObject(cTID("TrnS"), ts);
    }
    gr.putString(cTID("Nm  "), "MerchBoard"); gr.putEnumerated(cTID("GrdF"), cTID("GrdF"), cTID("CstS")); gr.putDouble(cTID("Intr"), 4096);
    gr.putList(cTID("Clrs"), clrs); gr.putList(cTID("Trns"), trns);
    gf.putBoolean(cTID("enab"), true); gf.putEnumerated(cTID("Md  "), cTID("BlnM"), cTID("Nrml")); gf.putUnitDouble(cTID("Opct"), pc, 100);
    gf.putObject(cTID("Grad"), cTID("Grdn"), gr); gf.putUnitDouble(cTID("Angl"), ang, fx.grad.angle);
    gf.putEnumerated(cTID("Type"), cTID("GrdT"), cTID("Lnr ")); gf.putBoolean(cTID("Rvrs"), false); gf.putBoolean(cTID("Algn"), true);
    gf.putUnitDouble(cTID("Scl "), pc, 100);
    parts.push(["GrFl", gf]);
  }
  if (fx.bevel.on) {
    var b = new ActionDescriptor();
    b.putBoolean(cTID("enab"), true);
    b.putEnumerated(cTID("hglM"), cTID("BlnM"), cTID("Scrn")); b.putObject(cTID("hglC"), cTID("RGBC"), rgbDesc(fx.bevel.hl)); b.putUnitDouble(cTID("hglO"), pc, 75);
    b.putEnumerated(cTID("sdwM"), cTID("BlnM"), cTID("Mltp")); b.putObject(cTID("sdwC"), cTID("RGBC"), rgbDesc(fx.bevel.sh)); b.putUnitDouble(cTID("sdwO"), pc, 75);
    b.putEnumerated(cTID("bvlT"), cTID("bvlT"), cTID("SfBL")); b.putEnumerated(cTID("bvlS"), cTID("BESl"), cTID("InrB"));
    b.putBoolean(cTID("uglg"), false); b.putUnitDouble(cTID("lagl"), ang, 120); b.putUnitDouble(cTID("Lald"), ang, 30);
    b.putUnitDouble(cTID("srgR"), pc, 100); b.putUnitDouble(cTID("blur"), px, fx.bevel.size);
    b.putEnumerated(cTID("bvlD"), cTID("BESs"), cTID("In  ")); b.putObject(cTID("TrnS"), cTID("ShpC"), linContour());
    b.putBoolean(sTID("antialiasGloss"), false); b.putUnitDouble(cTID("Sftn"), px, 0);
    b.putBoolean(sTID("useShape"), false); b.putBoolean(sTID("useTexture"), false);
    parts.push(["ebbl", b]);
  }
  if (!parts.length) return;
  function setFx(list) {
    var d = new ActionDescriptor(), r = new ActionReference(), fxd = new ActionDescriptor();
    r.putProperty(cTID("Prpr"), cTID("Lefx")); r.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
    d.putReference(cTID("null"), r); fxd.putUnitDouble(cTID("Scl "), pc, 100);
    for (var j = 0; j < list.length; j++) fxd.putObject(cTID(list[j][0]), cTID(list[j][0]), list[j][1]);
    d.putObject(cTID("T   "), cTID("Lefx"), fxd);
    executeAction(cTID("setd"), d, DialogModes.NO);
  }
  try { setFx(parts); } catch (e) {
    var ok = []; // isolate the effect Photoshop rejects, keep the rest
    for (var k = 0; k < parts.length; k++) {
      try { setFx(ok.concat([parts[k]])); ok.push(parts[k]); } catch (e2) { WARN.push("Effect " + parts[k][0] + " skipped: " + e2); }
    }
  }
}
function quad(L) {
  try {
    var r = new ActionReference(); r.putIdentifier(cTID("Lyr "), L.id);
    var tl = executeActionGet(r).getObjectValue(sTID("smartObjectMore")).getList(sTID("transform")), a = [];
    for (var i = 0; i < 8; i++) a.push(tl.getDouble(i));
    return a;
  } catch (e) {
    var b = L.bounds, x0 = b[0].as("px"), y0 = b[1].as("px"), x1 = b[2].as("px"), y1 = b[3].as("px");
    return [x0, y0, x1, y0, x1, y1, x0, y1];
  }
}
function makeImage(p) {
  var f = new File(ASSET_DIR + "/" + D.assets[p.a]);
  if (!f.exists) { WARN.push("Missing image: " + f.fsName); return null; }
  var d = new ActionDescriptor();
  d.putPath(cTID("null"), f);
  d.putBoolean(cTID("Lnkd"), !D.embed);
  d.putEnumerated(cTID("FTcs"), cTID("QCSt"), cTID("Qcsa"));
  var o = new ActionDescriptor();
  o.putUnitDouble(cTID("Hrzn"), cTID("#Pxl"), 0); o.putUnitDouble(cTID("Vrtc"), cTID("#Pxl"), 0);
  d.putObject(cTID("Ofst"), cTID("Ofst"), o);
  executeAction(cTID("Plc "), d, DialogModes.NO);
  var L = doc.activeLayer, q = quad(L);
  var w0 = Math.sqrt(Math.pow(q[2] - q[0], 2) + Math.pow(q[3] - q[1], 2)), h0 = Math.sqrt(Math.pow(q[4] - q[2], 2) + Math.pow(q[5] - q[3], 2));
  L.resize(p.w / w0 * 100, p.h / h0 * 100, AnchorPosition.MIDDLECENTER);
  if (p.rot) L.rotate(p.rot, AnchorPosition.MIDDLECENTER);
  q = quad(L);
  L.translate(p.x + p.w / 2 - (q[0] + q[2] + q[4] + q[6]) / 4, p.y + p.h / 2 - (q[1] + q[3] + q[5] + q[7]) / 4);
  if (p.fx) { doc.activeLayer = L; applyFx(p.fx, "#000000"); }
  return L;
}
function save() {
  var f = new File(OUT_DIR + "/" + CUR.file);
  if (D.fmt === "psb") {
    var d = new ActionDescriptor(), o = new ActionDescriptor();
    o.putBoolean(sTID("maximizeCompatibility"), true);
    d.putObject(cTID("As  "), sTID("largeDocumentFormat"), o);
    d.putPath(cTID("In  "), f); d.putBoolean(cTID("LwCs"), true);
    executeAction(cTID("save"), d, DialogModes.NO);
  } else {
    var so = new PhotoshopSaveOptions(); so.layers = true; so.embedColorProfile = true;
    doc.saveAs(f, so, false, Extension.LOWERCASE);
  }
}
function writeLog() {
  try {
    var f = new File(OUT_DIR + "/" + (D.combine ? D.file : D.pages[D.pages.length - 1].file) + ".log.txt"); f.encoding = "UTF-8"; f.open("w");
    f.writeln("MerchBoard Studio -> Photoshop  " + new Date());
    for (var i = 0; i < WARN.length; i++) f.writeln(WARN[i]);
    for (i = 0; i < NOTE.length; i++) f.writeln("· " + NOTE[i]);
    f.writeln(WARN.length ? "DONE WITH NOTES" : "DONE OK"); f.close();
  } catch (e) {}
}
})();
`;

MB.JSX_AI = String.raw`// MerchBoard Studio -> Illustrator builder (generated file, safe to re-run)
#target illustrator
(function () {
var D = __MB_DATA__;
var ASSET_DIR = "__MB_ASSET_DIR__", OUT_DIR = "__MB_OUT_DIR__";
var HERE = File($.fileName).parent.fsName.replace(/\\/g, "/");
if (ASSET_DIR.indexOf("__MB_") === 0) ASSET_DIR = HERE + "/assets";
if (OUT_DIR.indexOf("__MB_") === 0) OUT_DIR = HERE;
var WARN = [], k = 72 / D.dpi, doc;
var oldUIL = app.userInteractionLevel;
app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
try { build(); } catch (e) { WARN.push("ERROR: " + e + (e.line ? " (line " + e.line + ")" : "")); }
app.userInteractionLevel = oldUIL;
if (WARN.length) alert("MerchBoard Studio\n\n" + WARN.slice(0, 18).join("\n"));

var CUR;
function build() {
  if (D.combine) { buildCombined(); return; }
  for (var pi = 0; pi < D.pages.length; pi++) { CUR = D.pages[pi]; buildPage(); }
}
/* one document, one artboard per page (grid); each page goes on its own layer named after the page */
function buildCombined() {
  var n = D.pages.length, cols = D.cols, W = D.W * k, H = D.H * k, gap = D.gap * k;
  doc = app.documents.add(D.mode === "CMYK" ? DocumentColorSpace.CMYK : DocumentColorSpace.RGB, W, H);
  var r0 = doc.artboards[0].artboardRect;
  for (var pi = 1; pi < n; pi++) {
    var ox = (pi % cols) * (W + gap), oy = Math.floor(pi / cols) * (H + gap);
    doc.artboards.add([r0[0] + ox, r0[1] - oy, r0[0] + ox + W, r0[1] - oy - H]);
  }
  var first = doc.layers[0];
  for (pi = 0; pi < n; pi++) {
    CUR = D.pages[pi];
    try { doc.artboards[pi].name = CUR.name; } catch (e) {}
    doc.artboards.setActiveArtboardIndex(pi);
    app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
    var lay = pi === 0 ? first : doc.layers.add(); lay.name = CUR.name;
    for (var i = 0; i < CUR.tree.length; i++) addItem(lay, CUR.tree[i]);
  }
  if (D.embed) embedAll();
  var pdf = new File(OUT_DIR + "/" + D.base + ".pdf"), po = new PDFSaveOptions();
  po.compatibility = PDFCompatibility.ACROBAT7; po.preserveEditability = false; po.generateThumbnails = true;
  try { doc.saveAs(pdf, po); } catch (e) { WARN.push("PDF save: " + e); }
  var ai = new File(OUT_DIR + "/" + D.base + ".ai"), ao = new IllustratorSaveOptions();
  ao.pdfCompatible = true; ao.embedLinkedFiles = !!D.embed;
  doc.saveAs(ai, ao);
}
function buildPage() {
  doc = app.documents.add(D.mode === "CMYK" ? DocumentColorSpace.CMYK : DocumentColorSpace.RGB, D.W * k, D.H * k);
  app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
  var first = doc.layers[0];
  for (var i = 0; i < CUR.tree.length; i++) {
    var g = CUR.tree[i], lay = i === 0 ? first : doc.layers.add();
    lay.name = g.n || ("Layer " + (i + 1));
    if (g.t === "g") { for (var j = 0; j < g.c.length; j++) addItem(lay, g.c[j]); }
    else addItem(lay, g);
  }
  if (D.embed) embedAll();
  var pdf = new File(OUT_DIR + "/" + CUR.base + ".pdf"), po = new PDFSaveOptions();
  po.compatibility = PDFCompatibility.ACROBAT7; po.preserveEditability = false; po.generateThumbnails = true;
  try { doc.saveAs(pdf, po); } catch (e) { WARN.push("PDF save: " + e); }
  var ai = new File(OUT_DIR + "/" + CUR.base + ".ai"), ao = new IllustratorSaveOptions();
  ao.pdfCompatible = true; ao.embedLinkedFiles = !!D.embed;
  doc.saveAs(ai, ao);
}
function hexRGB(h) { h = String(h || "#000000").replace("#", ""); if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function col(hex) { var c = hexRGB(hex), r = new RGBColor(); r.red = c[0]; r.green = c[1]; r.blue = c[2]; return r; }
function addItem(container, p) {
  var it = null;
  try {
    if (p.t === "g") {
      it = container.groupItems.add(); it.name = p.n;
      for (var i = 0; i < p.c.length; i++) addItem(it, p.c[i]);
      return;
    }
    if (p.t === "r") {
      var rad = Math.max(0, Math.min(p.r || 0, p.w / 2, p.h / 2));
      it = rad > 0 ? container.pathItems.roundedRectangle(-p.y * k, p.x * k, p.w * k, p.h * k, rad * k, rad * k)
                   : container.pathItems.rectangle(-p.y * k, p.x * k, p.w * k, p.h * k);
      it.filled = !!p.fill; if (p.fill) it.fillColor = col(p.fill);
      it.stroked = !!(p.sw && p.stroke);
      if (it.stroked) { it.strokeWidth = p.sw * k; it.strokeColor = col(p.stroke); }
      if (p.rot) it.rotate(-p.rot);
    } else if (p.t === "p") {
      it = aiPath(container, p);
    } else if (p.t === "i") {
      var f = new File(ASSET_DIR + "/" + D.assets[p.a]);
      it = container.placedItems.add(); it.file = f;
      it.width = p.w * k; it.height = p.h * k;
      it.position = [p.x * k, -p.y * k];
      if (p.rot) it.rotate(-p.rot);
    } else if (p.t === "t") {
      it = p.fx ? fxText(container, p) : textFrame(container, p, {});
      if (p.rot) it.rotate(-p.rot);
    }
    if (!it) return;
    it.name = p.n || "";
    if (p.op != null && p.op < 1) it.opacity = Math.round(p.op * 1000) / 10;
  } catch (e) { WARN.push("[" + p.n + "] " + e + (e.line ? " (line " + e.line + ")" : "")); }
}
function aiPath(container, p) {
  var subs = [], cur = null, i, c;
  for (i = 0; i < p.d.length; i++) {
    c = p.d[i];
    if (c[0] === "M") { cur = { pts: [{ a: [c[1], c[2]] }] }; subs.push(cur); }
    else if (c[0] === "L") cur.pts.push({ a: [c[1], c[2]] });
    else if (c[0] === "C") { cur.pts[cur.pts.length - 1].r = [c[1], c[2]]; cur.pts.push({ a: [c[5], c[6]], l: [c[3], c[4]] }); }
    else if (c[0] === "Z" && cur && cur.pts.length > 1) { var f = cur.pts[0], la = cur.pts[cur.pts.length - 1]; if (Math.abs(f.a[0] - la.a[0]) < 0.01 && Math.abs(f.a[1] - la.a[1]) < 0.01) { f.l = la.l; cur.pts.pop(); } }
  }
  var tr = function (q) { return [q[0] * k, -q[1] * k]; };
  var build = function (pi, pts) {
    for (var j = 0; j < pts.length; j++) {
      var pp = pi.pathPoints.add(); pp.anchor = tr(pts[j].a);
      pp.leftDirection = tr(pts[j].l || pts[j].a); pp.rightDirection = tr(pts[j].r || pts[j].a); pp.pointType = PointType.CORNER;
    }
    pi.closed = true;
    pi.filled = !!p.fill; if (p.fill) pi.fillColor = col(p.fill);
    pi.stroked = !!(p.sw && p.stroke); if (pi.stroked) { pi.strokeWidth = p.sw * k; pi.strokeColor = col(p.stroke); pi.strokeJoin = StrokeJoin.ROUNDENDJOIN; }
    if (p.rule === "evenodd") pi.evenodd = true;
  };
  if (subs.length > 1) { // shapes with holes / several parts -> compound path
    var cp = container.compoundPathItems.add();
    for (i = 0; i < subs.length; i++) build(cp.pathItems.add(), subs[i].pts);
    return cp;
  }
  var it = container.pathItems.add(); build(it, subs[0].pts);
  return it;
}
var fontWarned = {}, bevelWarned = false;
function textFrame(container, p, o) {
  var dx = o.dx || 0, dy = o.dy || 0;
  var it = container.textFrames.pointText([(p.x + dx) * k, -(p.y + dy) * k]);
  it.contents = p.s.replace(/\n/g, "\r");
  var ca = it.textRange.characterAttributes;
  ca.size = p.size * k;
  try { ca.textFont = app.textFonts.getByName(p.font); } catch (e) { if (!fontWarned[p.font]) { fontWarned[p.font] = 1; WARN.push("Font missing: " + p.font); } }
  if (p.tr) ca.tracking = p.tr;
  ca.fillColor = col(o.fill || p.color);
  if (o.strokeW) { ca.strokeColor = col(o.stroke); ca.strokeWeight = o.strokeW * k; }
  if (p.s.indexOf("\n") >= 0) { ca.autoLeading = false; ca.leading = p.size * (p.lh || 1.15) * k; }
  it.textRange.paragraphAttributes.justification = p.al === "center" ? Justification.CENTER : (p.al === "right" ? Justification.RIGHT : Justification.LEFT);
  if (o.name) it.name = o.name;
  return it;
}
function gradColor(c1, c2, angle) {
  try {
    var g = doc.gradients.add(); g.type = GradientType.LINEAR;
    g.gradientStops[0].color = col(c1); g.gradientStops[1].color = col(c2);
    var gc = new GradientColor(); gc.gradient = g; try { gc.angle = angle; } catch (e) {}
    return gc;
  } catch (e) { WARN.push("gradient: " + e); return col(c1); }
}
/* Illustrator has no scriptable layer styles: build editable stacked copies (glow, shadow, outside stroke, fill) */
function fxText(container, p) {
  var fx = p.fx, G = container.groupItems.add(), sw = fx.stroke.on ? fx.stroke.w * 2 : 0, t;
  G.name = p.n || "Text";
  if (fx.glow.on) {
    t = textFrame(G, p, { fill: fx.glow.color, stroke: fx.glow.color, strokeW: sw + fx.glow.size * 0.9, name: "Glow" }); t.opacity = fx.glow.op * 35;
    t = textFrame(G, p, { fill: fx.glow.color, stroke: fx.glow.color, strokeW: sw + fx.glow.size * 0.4, name: "Glow" }); t.opacity = fx.glow.op * 55;
  }
  if (fx.shadow.on) {
    var a = fx.shadow.angle * Math.PI / 180;
    t = textFrame(G, p, { dx: -Math.cos(a) * fx.shadow.dist, dy: Math.sin(a) * fx.shadow.dist, fill: fx.shadow.color, stroke: fx.shadow.color, strokeW: sw, name: "Shadow" });
    t.opacity = fx.shadow.op * 100;
  }
  if (fx.stroke.on) textFrame(G, p, { fill: fx.stroke.color, stroke: fx.stroke.color, strokeW: sw, name: "Stroke" });
  var boldW = fx.bold ? p.size * 0.07 : 0, main = textFrame(G, p, { stroke: p.color, strokeW: boldW, name: "Fill" });
  if (fx.grad.on) { // Illustrator renders scripted gradients on live text as black -> outlined copy (one compound path) on top
    try {
      var og = textFrame(G, p, { name: "Gradient" }).createOutline(), cp = G.compoundPathItems.add();
      cp.name = "Gradient Fill (outlined copy of the text below)";
      for (var a1 = og.pageItems.length - 1; a1 >= 0; a1--) {
        var it1 = og.pageItems[a1];
        if (it1.typename === "CompoundPathItem") { for (var a2 = it1.pathItems.length - 1; a2 >= 0; a2--) it1.pathItems[a2].move(cp, ElementPlacement.PLACEATBEGINNING); }
        else if (it1.typename === "PathItem") it1.move(cp, ElementPlacement.PLACEATBEGINNING);
      }
      try { og.remove(); } catch (e) {}
      cp.pathItems[0].filled = true; cp.pathItems[0].stroked = false;
      cp.pathItems[0].fillColor = gradColor(p.color, fx.grad.c2, fx.grad.angle);
    } catch (e) { WARN.push("gradient text: " + e); }
  }
  if (fx.bevel.on && !bevelWarned) { bevelWarned = true; WARN.push("Bevel is exported to PSD/PNG only (not AI)"); }
  return G;
}
function embedAll() {
  for (var i = doc.placedItems.length - 1; i >= 0; i--) { try { doc.placedItems[i].embed(); } catch (e) { WARN.push("embed: " + e); } }
}
})();
`;

/* scene (U) -> compact pixel tree for the builders */
/* file names per page: "<base>" for a single page, "<base>_01", "<base>_02"… otherwise */
MB.pageBases = (st, base, pids) => pids.map(pid => pids.length > 1 ? `${base}_${String(MB.pageIndex(st, pid) + 1).padStart(2, '0')}` : base);
MB.jsxScene = (st, opts) => {
  const G = MB.pageGeom(st), s = G.pxPerU, assets = {}, R = (v) => Math.round(v * 100) / 100;
  Object.keys(MB.assets).forEach(id => { if (id.startsWith('__glass')) delete MB.assets[id]; });
  let nGlass = 0;
  const conv = (p) => {
    if (p.t === 'glass') { // live blur can't be scripted → baked PNG layer (blur/shadow, or sheen/rim)
      const b = MB.bakeGlass(p, s), id = '__glass' + (++nGlass);
      MB.assets[id] = { id, name: p.name, mime: 'image/png', data: b.data };
      assets[id] = MB.safeName(p.name) + '_' + nGlass + '.png';
      return { t: 'i', n: p.name, a: id, x: R(b.x * s), y: R(b.y * s), w: R(b.w * s), h: R(b.h * s), rot: 0, op: 1 };
    }
    if (p.t === 'group') { const c = p.children.map(conv).filter(Boolean); return c.length ? { t: 'g', n: p.name, c } : null; }
    if (p.t === 'rect') return { t: 'r', n: p.name, x: R(p.x * s), y: R(p.y * s), w: R(p.w * s), h: R(p.h * s), r: R((p.r || 0) * s), fill: p.fill, op: p.op, stroke: p.stroke || null, sw: p.sw ? R(p.sw * s) : 0, rot: p.rot || 0 };
    if (p.t === 'path') return { t: 'p', n: p.name, d: p.d.map(c => [c[0], ...c.slice(1).map(v => R(v * s))]), fill: p.fill, op: p.op, stroke: p.stroke || null, sw: p.sw ? R(p.sw * s) : 0, rule: p.rule };
    if (p.t === 'img') {
      const a = MB.assets[p.asset]; if (!a) return null;
      assets[p.asset] = MB.safeName(a.name).slice(0, 40) + '_' + p.asset + (a.mime === 'image/jpeg' ? '.jpg' : '.png');
      const img = { t: 'i', n: p.name, a: p.asset, x: R(p.x * s), y: R(p.y * s), w: R(p.w * s), h: R(p.h * s), rot: p.rot || 0, op: p.op };
      if (!p.fx) return img;
      if (opts.fmt !== 'ai') { // Photoshop: real layer styles
        img.fx = { stroke: Object.assign({}, p.fx.stroke, { w: R(p.fx.stroke.w * s) }), shadow: Object.assign({}, p.fx.shadow, { dist: R(p.fx.shadow.dist * s), blur: R(p.fx.shadow.blur * s) }),
          glow: Object.assign({}, p.fx.glow, { size: R(p.fx.glow.size * s) }), grad: { on: false }, bevel: { on: false } };
        return img;
      }
      const b = MB.bakeImgFx(p, s), id = '__glass' + (++nGlass); // Illustrator: effects baked under the picture
      MB.assets[id] = { id, name: p.name + ' fx', mime: 'image/png', data: b.data };
      assets[id] = MB.safeName(p.name + '_fx') + '_' + nGlass + '.png';
      return { t: 'g', n: p.name, c: [{ t: 'i', n: p.name + ' effects', a: id, x: R(b.x * s), y: R(b.y * s), w: R(b.w * s), h: R(b.h * s), rot: 0, op: p.op }, img] };
    }
    if (p.t === 'text') {
      const f = p.fx ? {
        bold: !!p.fx.bold, grad: p.fx.grad,
        stroke: Object.assign({}, p.fx.stroke, { w: R(p.fx.stroke.w * s) }),
        shadow: Object.assign({}, p.fx.shadow, { dist: R(p.fx.shadow.dist * s), blur: R(p.fx.shadow.blur * s) }),
        glow: Object.assign({}, p.fx.glow, { size: R(p.fx.glow.size * s) }),
        bevel: Object.assign({}, p.fx.bevel, { size: R(p.fx.bevel.size * s) }),
      } : null;
      return { t: 't', n: p.name, s: p.text, font: p.font.ps, size: R(p.size * s), color: p.color, x: R(p.x * s), y: R(p.y * s), al: p.align, lh: p.lh || 1.15, rot: p.rot || 0, op: p.op, tr: p.track || 0, fx: f };
    }
    return null;
  };
  const base = MB.safeName(opts.base), pids = opts.pages || [st.curPage], bases = MB.pageBases(st, base, pids);
  const pages = pids.map((pid, i) => ({
    name: bases[i], base: bases[i], file: bases[i] + '.' + (opts.fmt === 'psb' ? 'psb' : 'psd'),
    tree: MB.buildScene(st, pid).groups.map(conv).filter(Boolean),
  }));
  const data = { W: G.Wpx, H: G.Hpx, dpi: st.page.dpi, mode: opts.mode || 'RGB', embed: opts.embed !== false, fmt: opts.fmt, pages, assets };
  if (opts.combine && pages.length > 1) { // one file, one artboard per page, laid out in a grid
    pages.forEach((p, i) => { p.name = MB.pageLabel(st, pids[i]); });
    const cols = Math.ceil(Math.sqrt(pages.length)), rows = Math.ceil(pages.length / cols), gap = Math.round(G.Wpx * 0.06);
    if (data.fmt === 'psd' && Math.max(cols * G.Wpx + (cols - 1) * gap, rows * G.Hpx + (rows - 1) * gap) > 30000) data.fmt = 'psb'; // PSD max 30,000 px
    Object.assign(data, { combine: true, cols, gap, name: base, base, file: base + '.' + (data.fmt === 'psb' ? 'psb' : 'psd') });
  }
  return data;
};
const asciiJSON = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
MB.buildJsx = (app, data) => (app === 'ai' ? MB.JSX_AI : MB.JSX_PS).replace('__MB_DATA__', () => asciiJSON(data));

})(window.MB);
