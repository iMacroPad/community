// validate_plugin: the app's own validator (`imacropadd plugin validate`) when it can be found or fetched, else a
// JavaScript port of its main rules. Either way a few extra checks follow that the app leaves to the editor and the
// catalog: overlapping widgets, unknown info panels, the catalog's own rules for id, author and blurb.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync, statSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { catalog, REPO } from './data.js';

const CACHE = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'imacropad-mcp');
const VALIDATOR_URL = `https://github.com/${REPO}/releases/download/validator/imacropadd`;
let downloadFailed = null;   // once per session: offline is not retried on every call

/* ---------- finding the real validator ---------- */

function onPath(name) {
  for (const d of (process.env.PATH || '').split(delimiter)) { const f = join(d, name); if (d && existsSync(f)) return f }
  return null;
}

export async function findValidator({ download = true } = {}) {
  const candidates = [process.env.IMACROPADD_BIN, onPath('imacropadd'),
    join(homedir(), 'Applications/iMacroPadD.app/Contents/MacOS/imacropadd'), '/Applications/iMacroPadD.app/Contents/MacOS/imacropadd',
    join(CACHE, 'imacropadd')].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return { path: c };
  if (process.platform !== 'darwin') return { path: null, note: 'the app\'s validator runs on macOS only; used the JavaScript check' };
  if (!download) return { path: null, note: 'no imacropadd found; used the JavaScript check' };
  if (downloadFailed) return { path: null, note: downloadFailed };
  try {
    const r = await fetch(VALIDATOR_URL, { signal: AbortSignal.timeout(20000), redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    // a Mach-O binary (universal or thin), nothing else is kept
    const magic = buf.readUInt32BE(0);
    if (![0xcafebabe, 0xcffaedfe, 0xcefaedfe, 0xfeedfacf].includes(magic)) throw new Error('the download is not a macOS program');
    mkdirSync(CACHE, { recursive: true });
    const tmp = join(CACHE, `imacropadd.${process.pid}`);
    writeFileSync(tmp, buf); chmodSync(tmp, 0o755); renameSync(tmp, join(CACHE, 'imacropadd'));
    return { path: join(CACHE, 'imacropadd'), note: `downloaded the validator from ${VALIDATOR_URL} into ${CACHE}` };
  } catch (e) {
    downloadFailed = `could not download the validator (${e.message}); used the JavaScript check`;
    return { path: null, note: downloadFailed };
  }
}

function run(bin, file) {
  return new Promise(resolve => execFile(bin, ['plugin', 'validate', file], { timeout: 30000, maxBuffer: 4 << 20 },
    (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : -1) : 0, stdout: String(stdout), stderr: String(stderr) })));
}

const LEVEL = { PASS: 'pass', INFO: 'info', WARN: 'warning', FAIL: 'error' };
export function parseReport(text) {
  const checks = [];
  for (const l of text.split('\n')) {
    const m = l.match(/^\s+(PASS|INFO|WARN|FAIL)\s+([^:]+):\s(.*)$/);
    if (m) checks.push({ level: LEVEL[m[1]], area: m[2].trim(), message: m[3] });
  }
  return checks;
}

/* ---------- the JavaScript port of PluginValidator ---------- */

const re = (p, f = '') => new RegExp(p, f);
const isHex = s => typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s);
const str = v => typeof v === 'string';
const clip = (s, n = 60) => { const one = String(s).replace(/\n/g, '⏎'); return one.length > n ? one.slice(0, n) + '…' : one };

export function contrast(a, b) {
  const lum = h => {
    if (!isHex(h)) return 0;
    const v = parseInt(h.slice(1), 16), ch = s => { const c = ((v >> s) & 255) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 };
    return 0.2126 * ch(16) + 0.7152 * ch(8) + 0.0722 * ch(0);
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function danger(text) {
  const t = String(text).toLowerCase();
  for (const [p, why] of catalog().rules.danger) if (re(p).test(t)) return why;
  return null;
}

export function htmlProblem(html) {
  const max = catalog().rules.safeHTMLMaxBytes;
  if (Buffer.byteLength(html) > max) return `it is larger than ${max / 1000} KB`;
  const lower = html.toLowerCase();
  const dense = [...lower].filter(c => { const v = c.codePointAt(0); return v > 0x20 && v !== 0x7f && !(v >= 0x200b && v <= 0x200f) && v !== 0xfeff }).join('');
  for (const [p, why] of catalog().rules.safeHTML) if (re(p).test(lower)) return why;
  if (/(javascript|vbscript):|<script|<iframe/.test(dense)) return 'it hides a script behind spacing';
  return null;
}

const isTemplate = t => t.includes('{{') && t.includes('}}');
function chartOK(text) {
  const t = text.trim(); if (!t) return false;
  const num = v => typeof v === 'number' ? isFinite(v) : (str(v) && v.trim() !== '' && isFinite(Number(v)));
  try {
    const j = JSON.parse(t);
    if (Array.isArray(j)) return j.some(num);
    if (j && typeof j === 'object') return (Array.isArray(j.values) && j.values.some(num)) || (Array.isArray(j.points) && j.points.some(p => p && num(p.value)));
    return false;
  } catch {
    return t.split(/\r?\n/).some(l => { l = l.trim(); const cut = Math.max(l.lastIndexOf(','), l.lastIndexOf(':'), l.lastIndexOf('\t')); return cut >= 0 ? num(l.slice(cut + 1)) : num(l) });
  }
}

/** The case name and value of a MacroAction as Swift writes it: {"keyChord": {"_0": …}}. */
const caseOf = a => (a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 1) ? [Object.keys(a)[0], a[Object.keys(a)[0]] ?? {}] : [null, null];
const KEYS_CASES = ['keyChord', 'menu', 'mediaKey', 'setVolume', 'scrollBy', 'midi', 'obs', 'photoshop', 'teams', 'openApp', 'clickText', 'click', 'clickElement', 'waitFor', 'quitApp', 'macro', 'appleScript', 'shell'];

function needsIntegration(i) {
  const out = new Set(['network']);
  if ([i.url, i.body, ...Object.values(i.headers || {})].some(t => str(t) && t.includes('${clipboard}'))) out.add('clipboard');
  if (i.output === 'type') out.add('typeAnswers'); if (i.output === 'save') out.add('saveFiles'); if (i.output === 'open') out.add('openLinks');
  return out;
}

function needs(p, a) {
  const [c, v] = caseOf(a), out = new Set();
  const add = s => s.forEach(x => out.add(x));
  if (!c) return out;
  if (KEYS_CASES.includes(c)) out.add('keys');
  else if (c === 'typeText') out.add('typeText');
  else if (c === 'runShortcut') out.add('shortcuts');
  else if (c === 'openURL') out.add('openLinks');
  else if (c === 'setClipboard') out.add('clipboard');
  else if (c === 'sequence') (v._0 || []).forEach(x => add(needs(p, x)));
  else if (c === 'performIn') { add(needs(p, v.action)); out.add('keys') }
  else if (c === 'loop') add(needs(p, v.action));
  else if (c === 'when') { add(needs(p, v.then)); if (v.otherwise) add(needs(p, v.otherwise)) }
  else if (c === 'integration') { const i = v.plugin === p.id && (p.integrations || []).find(x => x.name === v.name); add(i ? needsIntegration(i) : ['network']) }
  return out;
}

const widgetLabel = w => w?.style?.label ?? w?.kind ?? 'widget';
function allActions(p) {
  const out = [];
  const add = (place, a) => {
    if (!a) return; out.push([place, a]);
    const [c, v] = caseOf(a);
    if (c === 'sequence') (v._0 || []).forEach(x => add(place, x));
    else if (c === 'performIn' || c === 'loop') add(place, v.action);
    else if (c === 'when') { add(place, v.then); add(place, v.otherwise) }
  };
  const addW = (place, w) => {
    const pl = `${place} ▸ ${widgetLabel(w)}`;
    add(pl, w.action); add(pl, w.altAction);
    (w.options || []).forEach(o => add(`${pl} ▸ ${o.label}`, o.action));
    Object.keys(w.gestures || {}).sort().forEach(k => add(`${pl} ▸ ${k}`, w.gestures[k]));
  };
  (p.profiles || []).forEach(pr => (pr.layout?.widgets || []).forEach(w => addW(`Layout “${pr.name}”`, w)));
  (p.components || []).forEach(w => addW('Components', w));
  (p.macros || []).forEach(m => add(`Macro “${m.name}”`, { sequence: { _0: m.steps || [] } }));
  (p.triggers || []).forEach(t => add(`Trigger ${t.event}`, t.action));
  return out;
}

const DISPLAY = ['markdown', 'html', 'chart'];
const KIND_TITLE = { rest: 'REST API', websocket: 'WebSocket', mcp: 'MCP tool', grpc: 'gRPC' };
export function required(p) {
  const out = new Set();
  for (const [, a] of allActions(p)) needs(p, a).forEach(x => out.add(x));
  (p.integrations || []).forEach(i => needsIntegration(i).forEach(x => out.add(x)));
  if ((p.triggers || []).length || (p.macros || []).some(m => (m.triggers || []).length)) out.add('triggers');
  for (const w of [...(p.profiles || []).flatMap(pr => pr.layout?.widgets || []), ...(p.components || [])]) if (DISPLAY.includes(w.kind)) {
    if (w.kind === 'html' && ((w.content || '') !== '' || w.action)) out.add('html');
    if (w.action) out.add('liveData');
  }
  return out;
}

/** The shape checks Swift's decoder makes: what would make the app say "not a plugin file". */
function decodeProblem(p) {
  const C = catalog(), kinds = C.widgetKinds.map(k => k.kind), caps = C.capabilities.map(c => c.id), tints = C.themeEnums.Tint;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'the file is not a JSON object';
  if (!str(p.id)) return '“id” is missing'; if (!str(p.name)) return '“name” is missing';
  if (p.format !== undefined && typeof p.format !== 'number') return '“format” is not a number';
  for (const k of ['profiles', 'themes', 'components', 'triggers', 'integrations', 'macros', 'permissions']) if (p[k] !== undefined && !Array.isArray(p[k])) return `“${k}” is not a list`;
  if (p.app && (!str(p.app.name) || !Array.isArray(p.app.bundleIDs))) return '“app” needs a name and bundleIDs';
  const widget = (w, at) => {
    if (!w || !kinds.includes(w.kind)) return `${at}.kind “${w?.kind}” is not a widget kind`;
    const f = w.frame; if (!f || ['x', 'y', 'w', 'h'].some(k => typeof f[k] !== 'number')) return `${at}.frame needs numbers x, y, w and h`;
    if (w.style?.tint && !tints.includes(w.style.tint)) return `${at}.style.tint “${w.style.tint}” is not one of ${tints.join(', ')}`;
    if (w.style?.shape && !C.shapes.includes(w.style.shape)) return `${at}.style.shape “${w.style.shape}”`;
    return null;
  };
  for (const [i, pr] of (p.profiles || []).entries()) {
    if (!str(pr?.name)) return `profiles.${i}: “name” is missing`;
    if (!pr.layout || !Array.isArray(pr.layout.widgets ?? [])) return `profiles.${i}: “layout” is missing`;
    for (const [j, w] of (pr.layout.widgets || []).entries()) { const e = widget(w, `profiles.${i}.layout.widgets.${j}`); if (e) return e }
  }
  for (const [j, w] of (p.components || []).entries()) { const e = widget(w, `components.${j}`); if (e) return e }
  for (const [i, t] of (p.themes || []).entries()) {
    if (!str(t?.id) || !str(t?.name)) return `themes.${i}: “id” and “name” are needed`;
    if (!t.palette) return `themes.${i}: “palette” is missing`;
    for (const r of C.paletteRoles) if (!str(t.palette[r.role])) return `themes.${i}.palette: “${r.role}” is missing`;
    if (t.keycap && !C.themeEnums.KeycapStyle.some(s => s.split(':')[0] === t.keycap)) return `themes.${i}.keycap “${t.keycap}”`;
  }
  for (const [i, x] of (p.integrations || []).entries()) {
    if (!str(x?.name) || !str(x?.url)) return `integrations.${i}: “name” and “url” are needed`;
    if (x.kind && !C.integrationKinds.includes(x.kind)) return `integrations.${i}.kind “${x.kind}”`;
    if (x.output && !C.integrationOutputs.includes(x.output)) return `integrations.${i}.output “${x.output}”`;
  }
  for (const [i, x] of (p.permissions || []).entries()) {
    if (!caps.includes(x?.capability)) return `permissions.${i}.capability “${x?.capability}” is not one of ${caps.join(', ')}`;
    if (!str(x.reason)) return `permissions.${i}: “reason” is missing`;
  }
  for (const [i, m] of (p.macros || []).entries()) if (!str(m?.name)) return `macros.${i}: “name” is missing`;
  for (const [i, t] of (p.triggers || []).entries()) if (!str(t?.event) || !t.action) return `triggers.${i}: “event” and “action” are needed`;
  const cases = new Set(C.actions.MacroAction.map(c => c.name));
  for (const [place, a] of allActions(p)) { const [c] = caseOf(a); if (!cases.has(c)) return `${place}: “${clip(JSON.stringify(a), 50)}” is not an action` }
  return null;
}

export function jsValidate(p) {
  const C = catalog(), checks = [];
  const fail = (a, m) => checks.push({ level: 'error', area: a, message: m }), warn = (a, m) => checks.push({ level: 'warning', area: a, message: m });
  const info = (a, m) => checks.push({ level: 'info', area: a, message: m });
  let before = 0;
  const close = (a, ok) => { const now = checks.filter(c => c.level === 'error').length; if (now === before) checks.push({ level: 'pass', area: a, message: ok }); before = now };
  const why = decodeProblem(p);
  if (why) return [{ level: 'error', area: 'File', message: `not a plugin file: ${why}` }];
  const L = k => p[k] || [];

  // File
  if ((p.format ?? 1) > 1) fail('File', `made for a newer iMacroPad (format ${p.format}); update the app`);
  if (!/^[a-z0-9]+([.-][a-z0-9]+)+$/.test(p.id) || p.id.length > 80) fail('File', `ID “${p.id}” must look like “author.plugin-name” (lower case letters, digits, dots, dashes)`);
  if (p.id.startsWith('imacropad.')) fail('File', `ID “${p.id}” claims to be a built-in plugin; only the app itself ships “imacropad.” IDs`);
  const name = p.name.trim();
  if (!name || name.length > 60) fail('File', 'needs a name of 1 to 60 characters');
  if (!/^[0-9]+\.[0-9]+(\.[0-9]+)?$/.test(p.version ?? '1.0.0')) fail('File', `version “${p.version}” must look like 1.0.0`);
  if ((p.author || '').length > 80 || (p.blurb || '').length > 400) fail('File', 'author or description is too long');
  if (['profiles', 'themes', 'components', 'integrations', 'triggers', 'macros'].every(k => !L(k).length)) fail('File', 'is empty: no layout, theme, component, trigger, integration or macro');
  for (const [k, n, what] of [['profiles', 24, 'layouts'], ['themes', 16, 'themes'], ['components', 200, 'components'], ['triggers', 64, 'triggers'], ['integrations', 32, 'integrations'], ['macros', 64, 'macros']])
    if (L(k).length > n) fail('File', `${L(k).length} ${what}; at most ${n}`);
  close('File', `“${name}” ${p.version ?? '1.0.0'}${p.author ? ` by ${p.author}` : ''}`);

  // App
  const declared = new Set(p.app?.bundleIDs || []);
  if (p.app) {
    if (!p.app.bundleIDs.length) fail('App', `names an app (“${p.app.name}”) but no bundle ID`);
    for (const b of p.app.bundleIDs) if (!/^[A-Za-z0-9._-]{3,120}$/.test(b)) fail('App', `“${b}” is not a bundle ID`);
    info('App', `made for ${p.app.name} (${p.app.bundleIDs.join(', ')})`);
  }
  for (const pr of L('profiles')) {
    const foreign = (pr.matchBundleIDs || []).filter(b => !declared.has(b));
    if (foreign.length) fail('App', `layout “${pr.name}” takes over ${foreign.join(', ')}, which the plugin does not declare as its app`);
  }

  // Themes
  const themeIDs = new Set();
  for (const t of L('themes')) {
    if (!t.id.startsWith(p.id + '.')) fail('Themes', `theme ID “${t.id}” must start with “${p.id}.” so it cannot replace another theme`);
    if (themeIDs.has(t.id)) fail('Themes', `two themes share the ID “${t.id}”`); themeIDs.add(t.id);
    const pal = t.palette, hw = t.hardware || {};
    const hexes = [...C.paletteRoles.map(r => pal[r.role]), ...(t.backgroundGradient || []), hw.knobHex, hw.caseHex, hw.caseEdgeHex].filter(x => x !== undefined && x !== null);
    const bad = hexes.find(h => !isHex(h)); if (bad !== undefined) { fail('Themes', `“${t.name}”: “${bad}” is not a colour (#RRGGBB)`); continue }
    if (t.backgroundImageName != null) fail('Themes', `“${t.name}” points at an image file; pictures do not travel in a plugin`);
    const gap = t.keyGap ?? 0.06, cr = t.cornerRadius ?? 12, bw = t.borderWidth ?? 0;
    if (!(gap >= 0 && gap <= 0.3) || !(cr >= 0 && cr <= 60) || !(bw >= 0 && bw <= 12)) fail('Themes', `“${t.name}” has a key gap, corner or border outside what the pad can draw`);
    if (contrast(pal.legend, pal.key) < 3) warn('Themes', `“${t.name}”: key legends are hard to read (contrast ${contrast(pal.legend, pal.key).toFixed(1)}:1)`);
    if (contrast(pal.legendOnAccent, pal.accent) < 3) warn('Themes', `“${t.name}”: legends on accent keys are hard to read`);
  }
  if (L('themes').length) close('Themes', `${L('themes').length} theme${L('themes').length === 1 ? '' : 's'} with complete palettes`);

  // Layouts
  const checkW = (w, place) => {
    const f = w.frame, label = widgetLabel(w);
    if (![f.x, f.y, f.w, f.h].every(Number.isFinite) || f.w <= 0 || f.h <= 0 || f.x < -0.001 || f.y < -0.001 || f.x + f.w > 1.001 || f.y + f.h > 1.001)
      fail('Layouts', `${place} ▸ “${label}” lies outside the pad`);
    const m = w.style?.mediaName;
    if (m != null) { if (m.includes('/') || m.includes('..')) fail('Layouts', `${place} ▸ “${label}” points at a file outside the app (${m})`); else warn('Layouts', `${place} ▸ “${label}” shows a picture that is not part of the plugin`) }
    if (DISPLAY.includes(w.kind)) {
      const text = w.content ?? '';
      let problem;
      if (Buffer.byteLength(text) > C.rules.safeHTMLMaxBytes) fail('Layouts', `${place} ▸ “${label}”: its content is larger than ${C.rules.safeHTMLMaxBytes / 1000} KB`);
      else if (w.kind === 'html' && (problem = htmlProblem(text))) fail('Layouts', `${place} ▸ “${label}”: the HTML is refused because ${problem}`);
      else if (w.kind === 'chart' && text && !isTemplate(text) && !chartOK(text)) fail('Layouts', `${place} ▸ “${label}”: the chart has no numbers to draw`);
      if (w.action && caseOf(w.action)[0] !== 'integration') fail('Layouts', `${place} ▸ “${label}”: a ${w.kind} widget shows content; its only action may be the integration it reads from`);
      if (w.altAction) fail('Layouts', `${place} ▸ “${label}”: a ${w.kind} widget cannot press anything`);
    } else if (w.content != null) fail('Layouts', `${place} ▸ “${label}”: only markdown, html and chart widgets carry content`);
    if ((w.style?.label?.length ?? 0) > 60 || (w.style?.sublabel?.length ?? 0) > 60) fail('Layouts', `${place}: a key label is longer than 60 characters`);
    if ((w.options?.length ?? 0) > 24) fail('Layouts', `${place} ▸ “${label}” has more than 24 options`);
    if (w.style?.customColors) for (const h of [w.style.fillHex ?? '#2C2C2E', w.style.labelHex ?? '#FFFFFF']) if (!isHex(h)) fail('Layouts', `${place} ▸ “${label}”: “${h}” is not a colour`);
    for (const g of Object.keys(w.gestures || {})) if (!C.gestures.includes(g)) fail('Layouts', `${place} ▸ “${label}”: unknown gesture “${g}”`);
  };
  for (const pr of L('profiles')) {
    const place = `“${pr.name}”`, l = pr.layout, ws = l.widgets || [];
    if (!pr.name || pr.name.length > 60) fail('Layouts', 'a layout needs a name of 1 to 60 characters');
    if (ws.length > 150) fail('Layouts', `${place} has ${ws.length} keys; at most 150`);
    const cols = l.columns ?? 6, rows = l.rows ?? 8;
    if (!(cols >= 1 && cols <= 24) || !(rows >= 1 && rows <= 24)) fail('Layouts', `${place} has a ${cols}×${rows} grid`);
    const ids = ws.map(w => w.id).filter(Boolean); if (new Set(ids).size !== ids.length) fail('Layouts', `${place}: two keys share an ID`);
    if (pr.isDefault) warn('Layouts', `${place} asks to be the default layout; it is installed as an ordinary one`);
    if (pr.themeID && !themeIDs.has(pr.themeID) && !C.themes.some(t => t.id === pr.themeID)) warn('Layouts', `${place} asks for the theme “${pr.themeID}”, which is neither built in nor part of the plugin`);
    ws.slice(0, 150).forEach(w => checkW(w, place));
  }
  L('components').slice(0, 200).forEach(w => checkW(w, 'Components'));
  if (L('profiles').length || L('components').length)
    close('Layouts', `${L('profiles').length} layout${L('profiles').length === 1 ? '' : 's'}, ${L('profiles').reduce((n, pr) => n + (pr.layout.widgets || []).length, 0) + L('components').length} keys, all on the pad`);

  // Triggers and macros
  for (const t of L('triggers')) if (!/^(gesture|midi):[a-z0-9:]{1,60}$/.test(t.event)) fail('Actions', `trigger “${t.event}” is not a gesture or MIDI event`);
  const mids = L('macros').map(m => m.id).filter(Boolean); if (new Set(mids).size !== mids.length) fail('Macros', 'two macros share an ID');
  for (const m of L('macros')) {
    if (!m.name.trim() || m.name.length > 60) fail('Macros', 'a macro needs a name of 1 to 60 characters');
    if (!(m.steps || []).length) warn('Macros', `“${m.name}” has no steps`);
    if ((m.steps || []).length > 60) fail('Macros', `“${m.name}” has ${m.steps.length} steps; at most 60`);
    for (const t of m.triggers || []) if (!/^(hotkey|text|time|every|app|obs|mac|gesture|midi):.{1,120}$/.test(t)) fail('Macros', `“${m.name}”: “${clip(t)}” is not a trigger the Mac knows`);
  }

  // Actions
  const integrationNames = new Set(L('integrations').map(i => i.name)), all = allActions(p), keys = new Set(C.keys);
  if (all.length > 5000) fail('Actions', `${all.length} actions; a key may not hide that many steps`);
  const typed = [], shortcuts = new Set();
  const depth = a => { const [c, v] = caseOf(a); if (c === 'sequence') return 1 + Math.max(0, ...(v._0 || []).map(depth)); if (c === 'performIn' || c === 'loop') return depth(v.action); if (c === 'when') return Math.max(depth(v.then), v.otherwise ? depth(v.otherwise) : 0); return 0 };
  for (const [place, a] of all.slice(0, 5000)) {
    const [c, v] = caseOf(a);
    switch (c) {
      case 'keyChord': { const k = String(v._0?.key ?? ''); if (!keys.has(k.toLowerCase())) { if ([...k].length === 1) warn('Actions', `${place}: the key “${k}” is not on every keyboard`); else fail('Actions', `${place}: unknown key “${k}”`) } break }
      case 'typeText': { const s = String(v._0 ?? ''); if (s.length > 2000) fail('Actions', `${place}: types ${s.length} characters; at most 2000`); const d = danger(s); if (d) fail('Actions', `${place}: types “${clip(s)}”, ${d}`); else if (s) typed.push(clip(s)); break }
      case 'sequence': {
        const list = v._0 || []; if (list.length > 40) fail('Actions', `${place}: a sequence of ${list.length} steps; at most 40`);
        if (depth(a) > 6) fail('Actions', `${place}: sequences nested more than 6 deep`);
        const joined = list.map(x => caseOf(x)[0] === 'typeText' ? String(x.typeText._0 ?? '') : null).filter(x => x !== null).join('');
        const d = list.length > 1 && danger(joined); if (d) fail('Actions', `${place}: types “${clip(joined)}” in pieces, ${d}`); break
      }
      case 'runShortcut': { const n = String(v._0 ?? ''); if (!n || n.length > 120) fail('Actions', `${place}: a Shortcut needs a name`); else shortcuts.add(n); break }
      case 'openApp': if (!declared.has(v.bundleID)) fail('Actions', `${place}: opens ${v.bundleID}, an app the plugin does not declare`); break;
      case 'performIn': if (!declared.has(v.bundleID)) fail('Actions', `${place}: sends keys to ${v.bundleID}, an app the plugin does not declare`); break;
      case 'menu': if (v.bundleID && !declared.has(v.bundleID)) fail('Actions', `${place}: presses a menu of ${v.bundleID}, an app the plugin does not declare`); if (!(v.path || []).length || v.path.length > 8) fail('Actions', `${place}: a menu item needs a path like File > Save`); break;
      case 'openURL': {
        const u = String(v._0 ?? ''), scheme = (u.match(/^([a-z][a-z0-9+.-]*):/i)?.[1] || '').toLowerCase();
        if (['http', 'https'].includes(scheme)) break;
        if (!scheme || ['file', 'javascript', 'data', 'vbscript', 'applescript', 'ssh', 'telnet', 'ftp', 'smb', 'afp', 'vnc'].includes(scheme)) fail('Actions', `${place}: opens “${clip(u)}”; a plugin may open web links and app links, not files, scripts or remote logins`);
        else warn('Actions', `${place}: opens a “${scheme}://” link, handled by whichever app owns that link type`); break
      }
      case 'setVolume': if (!(v._0 >= 0 && v._0 <= 100)) fail('Actions', `${place}: volume ${v._0}`); break;
      case 'scrollBy': if (!Number.isFinite(v.dx) || !Number.isFinite(v.dy) || Math.abs(v.dx) > 200 || Math.abs(v.dy) > 200) fail('Actions', `${place}: scrolls by an impossible amount`); break;
      case 'integration': if (v.plugin !== p.id) fail('Actions', `${place}: calls an integration of another plugin (${v.plugin})`); else if (!integrationNames.has(v.name)) fail('Actions', `${place}: calls “${v.name}”, which the plugin does not define`); break;
      case 'appleScript': case 'shell': fail('Actions', `${place}: runs a script; a plugin may not`); break;
      case 'quitApp': if (!declared.has(v.bundleID)) fail('Actions', `${place}: quits ${v.bundleID}, an app the plugin does not declare`); break;
      case 'loop': if (!(v.times >= 1 && v.times <= 100)) fail('Actions', `${place}: repeats ${v.times} times; 1 to 100`); break;
      case 'wait': case 'waitFor': { const t = c === 'wait' ? v.seconds : v.timeout; if (!Number.isFinite(t) || t < 0 || t > 60) fail('Actions', `${place}: waits ${t} s; at most 60`); break }
      case 'setVariable': if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(v.name ?? '')) fail('Actions', `${place}: “${clip(v.name ?? '')}” is not a variable name (letters, digits, _)`); if ((v.value ?? '').length > 2000) fail('Actions', `${place}: a variable of ${v.value.length} characters; at most 2000`); break;
      case 'notify': case 'clickText': { const t = String(v._0 ?? ''); if (!t || t.length > 200) fail('Actions', `${place}: needs a text of 1 to 200 characters`); break }
    }
  }
  if (typed.length) warn('Actions', `types text for you (${typed.length} key${typed.length === 1 ? '' : 's'}): ${typed.slice(0, 6).map(t => `“${t}”`).join(', ')}${typed.length > 6 ? '…' : ''}`);
  if (shortcuts.size) warn('Actions', `runs your Shortcuts by name: ${[...shortcuts].sort().map(s => `“${s}”`).join(', ')} — a Shortcut can do anything you built it to`);
  close('Actions', `${all.length} actions, none outside what a plugin may do`);

  // Integrations
  if (integrationNames.size !== L('integrations').length) fail('Integrations', 'two integrations share a name');
  for (const i of L('integrations')) {
    const place = `“${i.name}”`, headers = i.headers || {}, body = i.body ?? '', texts = [i.url, body, ...Object.values(headers)];
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(i.name) || i.name.length > 40) fail('Integrations', `${place}: the name must be lower case letters, digits and dashes`);
    const placeholders = [...new Set(texts.flatMap(t => [...String(t).matchAll(/\$\{([^}]*)\}/g)].map(m => m[1])))];
    for (const ph of placeholders) if (ph !== 'clipboard' && !/^secret:[A-Z][A-Z0-9_]{1,63}$/.test(ph) && !/^input:[a-z][a-z0-9_]{0,31}$/.test(ph))
      fail('Integrations', `${place}: unknown placeholder \${${ph}}; there is \${clipboard}, \${secret:NAME} and \${input:name}`);
    for (const [k, v] of Object.entries(headers)) if (/(authorization|cookie|token|secret|api-?key|password)/.test(k.toLowerCase()) && !String(v).includes('${secret:'))
      fail('Integrations', `${place}: the header “${k}” carries a secret written into the file; use \${secret:NAME}`);
    const leak = texts.find(t => /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.eyJ)/.test(String(t)));
    if (leak) fail('Integrations', `${place}: a key or token is written into the file (“${clip(leak, 16)}…”); use \${secret:NAME}`);
    if (/[?&](key|api_?key|token|access_token|secret|password)=(?!\$\{secret:)/.test(i.url.toLowerCase())) fail('Integrations', `${place}: the address carries a key written into the file; use \${secret:NAME}`);
    const d = danger([i.url, body, i.tool ?? '', ...Object.values(headers)].join('\n')); if (d) fail('Integrations', `${place}: sends text ${d}`);
    if (body.length > 100000 || Object.keys(headers).length > 30) fail('Integrations', `${place}: the request is larger than a key press should send`);
    if (Object.entries(headers).some(([k, v]) => /[\r\n]/.test(k) || /[\r\n]/.test(String(v)))) fail('Integrations', `${place}: a header spans more than one line`);
    const kind = i.kind ?? 'rest', output = i.output ?? 'none', fileType = i.fileType ?? 'txt';
    if (output === 'save' && !C.fileTypes.includes(fileType.toLowerCase())) fail('Integrations', `${place}: saves the answer as “.${fileType}”; allowed are ${C.fileTypes.join(', ')}`);
    if ((kind === 'mcp' || kind === 'grpc') && !i.tool) fail('Integrations', `${place}: needs the ${kind === 'mcp' ? 'tool' : 'method'} to call`);
    if (kind === 'rest' && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(i.method ?? 'POST').toUpperCase())) fail('Integrations', `${place}: method “${i.method}”`);
    const plain = i.url.replace(/\$\{[^}]*\}/g, 'x');
    let u; try { u = new URL(kind === 'grpc' && !plain.includes('://') ? 'https://' + plain : plain) } catch { }
    const host = u?.hostname?.toLowerCase().replace(/^\[|\]$/g, ''), scheme = u?.protocol?.replace(':', '').toLowerCase();
    if (!host || !scheme) { fail('Integrations', `${place}: “${clip(i.url)}” is not an address`); continue }
    const authority = (i.url.split('://').pop() || '').split(/[/?]/)[0];
    if (authority.includes('${')) fail('Integrations', `${place}: the server's address may not come from a placeholder`);
    const local = ['localhost', '127.0.0.1', '::1'].includes(host), secure = kind === 'websocket' ? 'wss' : 'https', open = kind === 'websocket' ? 'ws' : 'http';
    if (scheme !== secure && !(scheme === open && local)) fail('Integrations', `${place}: must use ${secure}://; unencrypted ${open}:// is only allowed to this Mac (localhost)`);
    if (u.username) fail('Integrations', `${place}: the address carries a user name or password`);
    if (host.startsWith('169.254.') || host.startsWith('fe80:') || host === '0.0.0.0' || host === 'metadata.google.internal') fail('Integrations', `${place}: calls a link-local or metadata address (${host})`);
    else if (local) info('Integrations', `${place}: calls a service on this Mac (${KIND_TITLE[kind] || kind}, port ${u.port || 'default'})`);
    else if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host) || host.endsWith('.local')) warn('Integrations', `${place}: calls a device on your own network (${host})`);
    else info('Integrations', `${place}: calls ${host} (${KIND_TITLE[kind] || kind})`);
    if (texts.some(t => String(t).includes('${clipboard}'))) warn('Integrations', `${place}: sends what is on your clipboard to ${host}`);
    const secrets = placeholders.filter(x => x.startsWith('secret:')).map(x => x.slice(7));
    if (secrets.length) info('Integrations', `${place}: needs ${secrets.join(', ')} in the Mac's keychain (imacropadd secret set NAME)`);
    if (output === 'type') warn('Integrations', `${place}: types the answer from ${host} into the app in front`);
    if (output === 'open') warn('Integrations', `${place}: opens the link ${host} answers with`);
    if (output === 'save') info('Integrations', `${place}: saves the answer as a .${fileType} file in Downloads/iMacroPad`);
    if (kind === 'grpc') info('Integrations', `${place}: gRPC calls go through grpcurl, which must be installed on the Mac`);
    const inputs = placeholders.filter(x => x.startsWith('input:')).map(x => x.slice(6));
    for (const f of i.find || []) {
      if (f.search != null && !L('integrations').some(x => x.name === f.search)) fail('Integrations', `${place}: finds “${f.title}” with “${f.search}”, which is not in the file`);
      if (f.search == null && !(f.options || []).length) fail('Integrations', `${place}: finds “${f.title}” in nothing: give a search or options`);
      if ((f.options?.length ?? 0) > 200 || !Object.keys(f.set || {}).length || (f.title || '').length > 40 || [f.label, f.detail, ...Object.values(f.set || {})].some(x => (x || '').length > 200))
        fail('Integrations', `${place}: the finder “${f.title}” is empty or too large`);
      for (const k of Object.keys(f.set || {})) if (!inputs.includes(k)) fail('Integrations', `${place}: the finder “${f.title}” sets “${k}”, which the call does not read`);
    }
  }
  if (L('integrations').length) close('Integrations', `${L('integrations').length} integration${L('integrations').length === 1 ? '' : 's'}, encrypted and without secrets in the file`);

  // Permissions
  const needed = required(p), asked = L('permissions');
  if (new Set(asked.map(x => x.capability)).size !== asked.length) fail('Permissions', 'asks for the same permission twice');
  for (const cap of C.capabilities) if (needed.has(cap.id)) {
    const reason = asked.find(x => x.capability === cap.id)?.reason?.trim();
    if (reason == null) fail('Permissions', `uses “${cap.title}” without asking for it: add {"capability": "${cap.id}", "reason": "…"} to permissions`);
    else if (reason.length < 10 || reason.length > 300) fail('Permissions', `asks for “${cap.title}” without a real reason (10 to 300 characters)`);
    else info('Permissions', `asks to ${cap.title[0].toLowerCase() + cap.title.slice(1)} — “${reason}”`);
  }
  for (const x of asked) if (!needed.has(x.capability)) warn('Permissions', `asks for “${C.capabilities.find(c => c.id === x.capability)?.title ?? x.capability}” but nothing in it uses that`);
  close('Permissions', needed.size ? 'every capability it uses is asked for, with a reason' : 'needs no permission');
  return checks;
}

/* ---------- what the app leaves to the editor and the catalog ---------- */

export function lint(p) {
  const C = catalog(), out = [], add = (level, area, message) => out.push({ level, area, message });
  if (!p || typeof p !== 'object' || !str(p.id)) return out;
  const infoIDs = new Set(C.infoPanels.map(x => x.id));
  const walk = (ws, place) => {
    for (const w of ws || []) if (w?.kind === 'info') {
      if (!w.infoID) add('warning', 'Layouts', `${place} ▸ an info widget without "infoID" shows nothing`);
      else if (!infoIDs.has(w.infoID)) add('warning', 'Layouts', `${place} ▸ "${w.infoID}" is not an info panel this app knows (see list_widget_kinds)`);
    }
  };
  for (const pr of p.profiles || []) {
    const ws = (pr.layout?.widgets || []).filter(w => w?.frame), place = `“${pr.name}”`;
    walk(ws, place);
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
      const a = ws[i].frame, b = ws[j].frame, e = 0.0005;
      if (a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.h - e && b.y < a.y + a.h - e)
        add('warning', 'Layouts', `${place}: “${widgetLabel(ws[i])}” and “${widgetLabel(ws[j])}” overlap`);
    }
    const c = pr.layout?.columns, r = pr.layout?.rows;
    if (c && r && c < r) add('info', 'Layouts', `${place} is a ${c}×${r} grid (portrait); a landscape pad reads best at 12×8`);
  }
  walk(p.components, 'Components');
  // the catalog's own rules (community/scripts/catalog.mjs)
  if (str(p.id) && !/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(p.id)) add('error', 'Catalog', 'the catalog wants an ID like yourname.my-widgets (lower case, a dot, then letters, digits, dashes)');
  if (!/^\d+\.\d+\.\d+$/.test(p.version || '')) add('error', 'Catalog', '"version" must look like 1.0.0 (three numbers)');
  if (!String(p.author || '').trim()) add('error', 'Catalog', '"author" is missing');
  if (!(String(p.name || '').length >= 2 && p.name.length <= 60)) add('error', 'Catalog', '"name" must be 2–60 characters');
  if (!(String(p.blurb || '').length >= 20 && p.blurb.length <= 400)) add('error', 'Catalog', '"blurb" must be 20–400 characters: one or two sentences on what it does');
  if (typeof p.format !== 'number') add('error', 'Catalog', '"format" is missing (use 1)');
  return out;
}

/* ---------- the tool ---------- */

const summarize = checks => ({ errors: checks.filter(c => c.level === 'error').length, warnings: checks.filter(c => c.level === 'warning').length });

export async function validatePlugin({ json, path, useApp = true, download = true }) {
  let text, from;
  if (path) {
    if (!existsSync(path)) throw new Error(`no file at ${path}`);
    if (statSync(path).size > 4 * 1024 * 1024) return report({ validator: 'js', checks: [{ level: 'error', area: 'File', message: 'larger than 4 MB' }] });
    text = readFileSync(path, 'utf8'); from = path;
  } else if (json != null) text = typeof json === 'string' ? json : JSON.stringify(json);
  else throw new Error('give the plugin as "json" (its text) or "path" (a file)');

  let p = null, parseError = null;
  try { p = JSON.parse(text) } catch (e) { parseError = e.message }
  const extra = p ? lint(p) : [];

  if (useApp) {
    const v = await findValidator({ download });
    if (v.path) {
      let file = from, dir;
      if (!file) { dir = mkdtempSync(join(tmpdir(), 'imacropad-')); file = join(dir, `${(p && str(p.id) && /^[a-z0-9.-]+$/.test(p.id)) ? p.id : 'plugin'}.imacropad-plugin.json`); writeFileSync(file, text) }
      try {
        const r = await run(v.path, file);
        const checks = parseReport(r.stdout);
        if ((r.code === 0 || r.code === 1) && checks.length) return report({ validator: 'imacropadd', binary: v.path, note: v.note, checks, extra, raw: r.stdout.trim() });
        v.note = `imacropadd did not answer as expected (exit ${r.code}${r.stderr ? `: ${r.stderr.trim().slice(0, 200)}` : ''}); used the JavaScript check`;
      } finally { if (dir) rmSync(dir, { recursive: true, force: true }) }
    }
    if (parseError) return report({ validator: 'js', note: v.note, checks: [{ level: 'error', area: 'File', message: `not a plugin file: ${parseError}` }], extra });
    return report({ validator: 'js', note: v.note, checks: jsValidate(p), extra });
  }
  if (parseError) return report({ validator: 'js', checks: [{ level: 'error', area: 'File', message: `not a plugin file: ${parseError}` }], extra });
  return report({ validator: 'js', checks: jsValidate(p), extra });
}

function report({ validator, binary, note, checks, extra = [], raw }) {
  const s = summarize(checks), x = summarize(extra);
  const mark = { pass: 'PASS', info: 'INFO', warning: 'WARN', error: 'FAIL' };
  const line = c => `  ${mark[c.level]}  ${c.area}: ${c.message}`;
  const passed = s.errors === 0, readyForCatalog = passed && x.errors === 0;
  const text = [
    `Validator: ${validator === 'imacropadd' ? `the app's own (${binary})` : 'JavaScript port of the app\'s rules (the catalog runs the real one on a Mac)'}${note ? `\nNote: ${note}` : ''}`,
    ...checks.map(line),
    passed ? `→ OK (${s.warnings} warnings)` : `→ REJECTED (${s.errors} errors, ${s.warnings} warnings)`,
    ...(extra.length ? ['', 'Further checks (layout overlaps, info panels, catalog rules):', ...extra.map(line)] : []),
    '', readyForCatalog ? 'Ready to submit: see submit_instructions.' : 'Fix the FAIL lines and validate again.',
  ].join('\n');
  return { passed, readyForCatalog, validator, binary: binary || null, note: note || null, errors: s.errors, warnings: s.warnings, checks, extra, text, ...(raw ? { raw } : {}) };
}
