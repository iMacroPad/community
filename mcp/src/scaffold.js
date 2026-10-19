// Starter files that pass the check: a plugin (widget pack or app plugin), a theme, a layout.
// Layouts are placed on a landscape grid (12 × 8 by default) cell by cell, so frames never overlap and stay inside 0…1.
import { catalog, GRID } from './data.js';
import { required } from './validate.js';

export const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'plugin';
const round = n => Math.round(n * 1e6) / 1e6;

/* ---------- colour ---------- */
const hex2rgb = h => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] };
const rgb2hex = rgb => '#' + rgb.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
function hex2hsl(h) {
  let [r, g, b] = hex2rgb(h).map(x => x / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s * 100, l * 100];
}
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgb2hex([f(0) * 255, f(8) * 255, f(4) * 255]);
}
function luminance(h) { const c = hex2rgb(h).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) };
const ink = bg => contrast('#FFFFFF', bg) >= contrast('#111111', bg) ? '#FFFFFF' : '#111111';
const isHex = s => /^#[0-9A-Fa-f]{6}$/.test(s || '');
const NAMED = { red: 0, orange: 28, amber: 42, yellow: 52, lime: 85, green: 135, teal: 172, cyan: 190, blue: 214, indigo: 238, violet: 262, purple: 280, magenta: 305, pink: 330 };

export const MOODS = ['dark', 'light', 'neon', 'warm', 'pastel', 'mono', 'retro'];

/** A complete palette from a mood and optional base colours. Legends always read on their keys. */
export function palette({ mood = 'dark', accent, background, hue } = {}) {
  let h = typeof hue === 'number' ? hue : NAMED[String(hue || '').toLowerCase()];
  if (isHex(accent)) h = hex2hsl(accent)[0];
  if (h === undefined) h = { warm: 28, retro: 35, neon: 300, pastel: 250, mono: 214 }[mood] ?? 214;
  const P = {
    dark:   { bg: [h, 12, 5], key: [h, 8, 16], surface: [h, 10, 10], border: [h, 8, 25], accent: [h, 80, 52], accent2: [h + 40, 70, 58], danger: [356, 78, 50], glow: [h, 90, 62] },
    light:  { bg: [h, 18, 93], key: [h, 20, 99], surface: [h, 16, 87], border: [h, 12, 78], accent: [h, 75, 45], accent2: [h + 40, 65, 48], danger: [356, 72, 46], glow: [h, 85, 55] },
    neon:   { bg: [h, 45, 4], key: [h, 35, 10], surface: [h, 40, 7], border: [h, 80, 35], accent: [h, 100, 58], accent2: [h + 150, 100, 55], danger: [350, 100, 58], glow: [h, 100, 65] },
    warm:   { bg: [h, 22, 9], key: [h, 18, 18], surface: [h, 20, 13], border: [h, 18, 27], accent: [h, 85, 55], accent2: [h + 25, 75, 60], danger: [2, 75, 50], glow: [h + 10, 95, 62] },
    pastel: { bg: [h, 40, 95], key: [h, 45, 99], surface: [h, 35, 90], border: [h, 30, 82], accent: [h, 70, 72], accent2: [h + 60, 65, 75], danger: [350, 70, 70], glow: [h, 80, 78] },
    mono:   { bg: [0, 0, 6], key: [0, 0, 17], surface: [0, 0, 11], border: [0, 0, 27], accent: [h, 0, 88], accent2: [0, 0, 60], danger: [356, 70, 50], glow: [0, 0, 95] },
    retro:  { bg: [h, 25, 82], key: [h, 30, 90], surface: [h, 20, 74], border: [h, 18, 60], accent: [h - 20, 70, 45], accent2: [h + 150, 40, 40], danger: [5, 65, 45], glow: [h - 10, 85, 55] },
  }[mood] || null;
  if (!P) throw new Error(`mood must be one of ${MOODS.join(', ')}`);
  const pal = Object.fromEntries(Object.entries(P).map(([k, v]) => [k === 'bg' ? 'background' : k, hsl(...v)]));
  if (isHex(accent)) pal.accent = accent.toUpperCase();
  if (isHex(background)) {
    pal.background = background.toUpperCase();
    const [bh, bs, bl] = hex2hsl(background), up = bl < 50 ? 1 : -1;
    pal.surface = hsl(bh, bs, bl + up * 5); pal.key = hsl(bh, bs, bl + up * (bl < 50 ? 11 : 6)); pal.border = hsl(bh, bs, bl + up * 20);
  }
  pal.legend = ink(pal.key) === '#FFFFFF' ? hsl(h, 20, 95) : hsl(h, 25, 12);
  if (contrast(pal.legend, pal.key) < 4.5) pal.legend = ink(pal.key);
  pal.legendOnAccent = ink(pal.accent);
  const roles = catalog().paletteRoles.map(r => r.role);
  return Object.fromEntries(roles.map(r => [r, pal[r] ?? pal.accent]));
}

export function scaffoldTheme({ name, pluginId, mood = 'dark', accent, background, hue, keycap, blurb, font }) {
  if (!name) throw new Error('a theme needs a name');
  const prefix = pluginId || `yourname.${slug(name)}`;
  const kc = keycap || { dark: 'chiclet', light: 'chiclet', neon: 'glass', warm: 'mechanical', pastel: 'dome', mono: 'flat', retro: 'retro' }[mood];
  const C = catalog();
  if (!C.themeEnums.KeycapStyle.some(s => s.split(':')[0] === kc)) throw new Error(`keycap must be one of ${C.themeEnums.KeycapStyle.map(s => s.split(':')[0]).join(', ')}`);
  const pal = palette({ mood, accent, background, hue });
  return {
    id: `${prefix}.${slug(name)}`, name, family: 'Custom', blurb: blurb || `${name}: a ${mood} palette.`,
    palette: pal, keycap: kc, cornerRadius: { pastel: 18, neon: 14, retro: 6, mono: 8 }[mood] ?? 12, borderWidth: mood === 'neon' ? 1.5 : 0, keyGap: 0.06,
    font: font || (mood === 'retro' ? 'mono' : mood === 'pastel' ? 'rounded' : 'system'), uppercaseLegends: mood === 'retro',
    pressEffect: mood === 'neon' ? 'glow' : 'depress', sound: 'none', hapticSharpness: 0.7, ledRing: mood === 'neon' || mood === 'dark', rainbowBadge: false,
  };
}

/* ---------- layout ---------- */

const KIND_SIZE = { button: [2, 2], toggle: [2, 2], knob: [2, 2], volumeKnob: [3, 3], rotary: [2, 2], slider: [1, 4], scrollStrip: [1, 4], roller: [4, 1],
  trackpad: [4, 3], trackball: [3, 3], pencilArea: [4, 3], label: [2, 1], chips: [4, 1], markdown: [4, 3], html: [4, 3], chart: [4, 3],
  colorWheel: [3, 3], brushPicker: [3, 2], appSwitcher: [6, 1], obsScenes: [4, 2], obsStatus: [2, 2], obsMixer: [4, 3], obsPreview: [4, 3], aiSessions: [4, 3], voice: [3, 3] };

const MODS = { cmd: 'command', command: 'command', '⌘': 'command', opt: 'option', option: 'option', alt: 'option', '⌥': 'option', ctrl: 'control', control: 'control', '⌃': 'control', shift: 'shift', '⇧': 'shift', fn: 'function' };
/** "cmd+shift+z" or "⇧⌘Z" → a keyChord action. */
export function chord(text) {
  const t = String(text).trim();
  let parts = t.includes('+') && t.length > 1 ? t.split('+').map(s => s.trim()) : null;
  if (!parts) { parts = []; let rest = t; while (rest.length > 1 && MODS[rest[0]]) { parts.push(rest[0]); rest = rest.slice(1) } parts.push(rest) }
  const key = parts.pop().toLowerCase(), modifiers = [...new Set(parts.map(m => MODS[m.toLowerCase()] || MODS[m]).filter(Boolean))];
  if (!catalog().keys.includes(key)) throw new Error(`“${key}” is not a key name the pad can press (see the reference's key names)`);
  return { keyChord: { _0: { key, modifiers } } };
}

/** Place widgets on a cols × rows grid: explicit cells first, the rest first-fit row by row. */
export function place(items, cols, rows) {
  const used = Array.from({ length: rows }, () => Array(cols).fill(-1)), placed = [], skipped = [];
  const free = (x, y, w, h) => x >= 0 && y >= 0 && x + w <= cols && y + h <= rows && used.slice(y, y + h).every(r => r.slice(x, x + w).every(c => c < 0));
  const take = (i, x, y, w, h) => { for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) used[r][c] = i; placed.push({ i, x, y, w, h }) };
  const order = [...items.keys()].sort((a, b) => (items[b].x != null && items[b].y != null) - (items[a].x != null && items[a].y != null));
  for (const i of order) {
    const it = items[i], w = Math.min(cols, Math.max(1, it.w)), h = Math.min(rows, Math.max(1, it.h));
    if (it.x != null && it.y != null && free(it.x, it.y, w, h)) { take(i, it.x, it.y, w, h); continue }
    let done = false;
    for (let y = 0; y <= rows - h && !done; y++) for (let x = 0; x <= cols - w && !done; x++) if (free(x, y, w, h)) { take(i, x, y, w, h); done = true }
    if (!done) skipped.push(i);
  }
  return { placed: placed.sort((a, b) => a.i - b.i), skipped, map: used };
}

/** One widget spec → a PadWidget without its frame. */
function widget(spec, C) {
  const notes = [];
  let kind = spec.kind || (spec.info ? 'info' : spec.chord || spec.action ? 'button' : null);
  if (!kind) throw new Error(`each widget needs "info" (a panel id) or "kind" (${C.widgetKinds.map(k => k.kind).join(', ')})`);
  if (!C.widgetKinds.some(k => k.kind === kind)) throw new Error(`“${kind}” is not a widget kind`);
  const out = { kind, style: { tint: spec.tint || (['markdown', 'html', 'chart', 'info', 'trackpad'].includes(kind) ? 'surface' : 'key') } };
  let size = KIND_SIZE[kind] || [2, 2];
  if (kind === 'info') {
    const p = C.infoPanels.find(x => x.id === spec.info);
    if (!p) throw new Error(`“${spec.info}” is not an info panel; see list_widget_kinds`);
    out.infoID = p.id; size = [p.w, p.h];
    const param = spec.param ?? p.default; if (param != null) out.param = String(param);
    if (p.param !== 'none' && param == null) notes.push(`${p.id}: set "param" (${p.paramTitle})`);
    out.style.label = spec.label || p.name;
  } else if (spec.label) out.style.label = spec.label;
  if (spec.icon) out.style.iconSystemName = spec.icon;
  if (spec.chord) out.action = chord(spec.chord);
  if (spec.action) out.action = spec.action;
  if (spec.altChord) out.altAction = chord(spec.altChord);
  if (spec.altAction) out.altAction = spec.altAction;
  if (spec.content != null) out.content = spec.content;
  if (spec.settings) out.settings = spec.settings;
  if (spec.param != null && kind !== 'info') out.param = String(spec.param);
  if (spec.options) out.options = spec.options;
  if (spec.stateKey) out.stateKey = spec.stateKey;
  if (['markdown', 'html', 'chart'].includes(kind) && out.content == null && !out.action) notes.push(`${out.style.label || kind}: give it "content"`);
  if (['button', 'toggle', 'knob'].includes(kind) && !out.action) notes.push(`${out.style.label || kind}: no action yet`);
  return { w: out, size: [spec.w ?? size[0], spec.h ?? size[1]], notes };
}

export function scaffoldLayout({ name, widgets = [], columns = GRID.columns, rows = GRID.rows, icon = 'square.grid.2x2', themeID, matchBundleIDs, backgroundHex = '#000000' }) {
  if (!name) throw new Error('a layout needs a name');
  if (!(columns >= 1 && columns <= 24 && rows >= 1 && rows <= 24)) throw new Error('columns and rows must be 1–24');
  const C = catalog(), built = widgets.map(s => widget(s, C));
  const { placed, skipped, map } = place(built.map((b, i) => ({ w: b.size[0], h: b.size[1], x: widgets[i].x, y: widgets[i].y })), columns, rows);
  const ws = placed.map(({ i, x, y, w, h }) => ({ ...built[i].w, frame: { x: round(x / columns), y: round(y / rows), w: round(w / columns), h: round(h / rows) } }));
  const profile = { name, icon, ...(matchBundleIDs?.length ? { matchBundleIDs } : {}), ...(themeID ? { themeID } : {}), layout: { columns, rows, backgroundHex, widgets: ws } };
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const grid = map.map(r => r.map(c => c < 0 ? '·' : letters[placed.findIndex(p => p.i === c) % letters.length]).join('')).join('\n');
  const legend = placed.map((p, n) => `${letters[n % letters.length]} = ${built[p.i].w.style.label || built[p.i].w.infoID || built[p.i].w.kind} (${p.w}×${p.h} at ${p.x},${p.y})`);
  const notes = built.flatMap(b => b.notes).concat(skipped.map(i => `did not fit: ${built[i].w.style.label || built[i].w.kind} (${built[i].size.join('×')}); make it smaller or drop something`));
  return { profile, grid, legend, notes };
}

/* ---------- plugin ---------- */

const REASONS = {
  keys: 'The keys press the app\'s own shortcuts and menu items.', typeText: 'A key types a short snippet of text it brings.',
  openLinks: 'A key opens a web page.', shortcuts: 'A key runs one of your own Shortcuts by name.',
  network: 'The live widgets fetch data from the service named in the README.', clipboard: 'The text on your clipboard is what gets sent.',
  typeAnswers: 'The answer is typed into the app in front.', saveFiles: 'The answer is saved to Downloads/iMacroPad.',
  triggers: 'Gestures on the Mac run the plugin\'s actions.', html: 'A card is drawn as a small static HTML page with no script.',
  liveData: 'The cards show what the service answers, refreshed while they are on screen.',
};
/** Every capability the content uses, with a plain reason to rewrite. */
export function declare(p, reasons = {}) {
  const need = required(p), have = Object.fromEntries((p.permissions || []).map(x => [x.capability, x.reason]));
  p.permissions = catalog().capabilities.filter(c => need.has(c.id)).map(c => ({ capability: c.id, reason: reasons[c.id] || have[c.id] || REASONS[c.id] }));
  return p;
}

export function scaffoldPlugin({ id, name, author, kind = 'widget-pack', blurb, icon, app, withTheme = false, withIntegration = false, mood = 'dark', accent }) {
  if (!id || !name || !author) throw new Error('id, name and author are needed');
  const notes = [];
  if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(id)) throw new Error('id must look like yourname.my-widgets: lower case, a dot, then letters, digits and dashes');
  if (id.startsWith('imacropad.')) throw new Error('IDs starting with “imacropad.” belong to the app');
  const p = { format: 1, id, name, version: '1.0.0', author, blurb: blurb || '', icon: icon || (kind === 'app-plugin' ? 'keyboard' : 'square.grid.3x3.square') };
  let theme;
  if (withTheme) { theme = scaffoldTheme({ name: `${name}`, pluginId: id, mood, accent }); p.themes = [theme] }

  if (kind === 'widget-pack') {
    p.blurb ||= `${name}: a clock, a note card and a weekly chart for any layout, drawn by the app itself. Nothing leaves the pad.`;
    const comps = [
      { info: 'clock.digital' },
      { kind: 'markdown', label: 'Note', content: '### Today\n- **Focus** on one thing\n- Ship it\n\n> Make it work, make it right, make it fast.' },
      { kind: 'chart', label: 'This week', content: '{"type":"bar","title":"Hours","labels":["Mon","Tue","Wed","Thu","Fri"],"values":[3,5,4,6,2]}' },
      { info: 'weather.now', param: 'London' },
    ];
    const lay = scaffoldLayout({ name, widgets: comps, icon: p.icon });
    p.components = lay.profile.layout.widgets.map(w => ({ ...w, frame: { x: 0, y: 0, w: w.frame.w, h: w.frame.h } }));
    p.profiles = [{ ...lay.profile, ...(theme ? { themeID: theme.id } : {}) }];
    notes.push('A widget pack: the widgets are in "components" (the editor\'s library) and on a ready layout. Replace them with your own.');
  } else if (kind === 'app-plugin') {
    if (!app?.name || !app?.bundleIDs?.length) {
      app = { name: app?.name || 'Your App', bundleIDs: app?.bundleIDs?.length ? app.bundleIDs : ['com.example.yourapp'] };
      notes.push('Set "app" to the real app: its name and bundle ID (`osascript -e \'id of app "Name"\'` on the Mac prints it).');
    }
    p.app = app;
    p.blurb ||= `Keys, a zoom dial and a status card for ${app.name}: the everyday commands one tap away on a landscape pad.`;
    const lay = scaffoldLayout({ name: app.name, icon: p.icon, matchBundleIDs: app.bundleIDs, themeID: theme?.id, widgets: [
      { label: 'Undo', icon: 'arrow.uturn.backward', chord: 'cmd+z', x: 0, y: 0 },
      { label: 'Redo', icon: 'arrow.uturn.forward', chord: 'cmd+shift+z', x: 2, y: 0 },
      { label: 'Save', icon: 'square.and.arrow.down', chord: 'cmd+s', tint: 'accent', x: 4, y: 0 },
      { label: 'Find', icon: 'magnifyingglass', chord: 'cmd+f', x: 0, y: 2 },
      { label: 'Copy', icon: 'doc.on.doc', chord: 'cmd+c', x: 2, y: 2 },
      { label: 'Paste', icon: 'doc.on.clipboard', chord: 'cmd+v', x: 4, y: 2 },
      { kind: 'knob', label: 'Zoom', chord: 'cmd+=', altChord: 'cmd+-', w: 3, h: 3, x: 6, y: 0 },
      { label: 'Preferences', icon: 'gearshape', action: { menu: { path: [app.name, 'Settings…'] } }, w: 3, h: 2, x: 9, y: 0 },
      { info: 'clock.digital', x: 0, y: 6 },
      { info: 'mac.front', x: 4, y: 6 },
      { kind: 'markdown', label: 'How to use', content: `### ${app.name}\n- **Undo / Redo** on the left\n- Turn **Zoom** to zoom in and out\n- Change any key in the editor`, x: 6, y: 3, w: 6, h: 3 },
    ] });
    p.profiles = [lay.profile];
    notes.push(...lay.notes, 'Menu paths must match the app\'s menus in the language you test with (`imacropadd plugin test FILE` checks them).');
  } else throw new Error('kind must be widget-pack or app-plugin');

  if (withIntegration) {
    p.integrations = [{ name: 'status', title: 'Service status', kind: 'rest', method: 'GET', url: 'https://api.example.com/v1/status?team=${input:team}',
      headers: { Authorization: 'Bearer ${secret:EXAMPLE_API_KEY}' }, body: '', extract: '', output: 'none' }];
    const card = { kind: 'markdown', frame: { x: 0, y: 0, w: 0.333333, h: 0.375 }, style: { tint: 'surface', label: 'Status' }, param: '300', settings: { team: 'core' },
      action: { integration: { plugin: id, name: 'status' } }, content: '### {{name}}\n**{{state}}** · updated {{updated|date}}' };
    p.components = [...(p.components || []), card];
    notes.push('The integration is a shape to fill in: a real https address, the answer\'s fields in the template, and the secret\'s name. The value of a secret never goes in the file: each user runs `imacropadd secret set EXAMPLE_API_KEY` on their Mac.');
  }
  declare(p);
  for (const k of ['profiles', 'themes', 'components', 'integrations']) if (p[k] && !p[k].length) delete p[k];
  return { plugin: p, notes };
}

/** Wrap a theme or a layout into a plugin file of its own. */
export function wrap({ id, name, author, blurb, app, themes, profiles }) {
  const p = { format: 1, id, name, version: '1.0.0', author, blurb: blurb || '', icon: themes ? 'paintpalette' : 'square.grid.2x2', ...(app ? { app } : {}), ...(profiles ? { profiles } : {}), ...(themes ? { themes } : {}) };
  return declare(p);
}
