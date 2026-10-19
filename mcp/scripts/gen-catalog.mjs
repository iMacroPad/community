#!/usr/bin/env node
// Reads the app's Swift model and writes what the MCP server serves:
//   data/catalog.json    widget kinds, info panels and their groups, palette roles, built-in themes, enums, key names, actions
//   data/PLUGINS.md      the plugin format (docs/PLUGINS.md)
//   data/CONTRIBUTING.md how to submit to the catalog
//   ../skill/imacropad-community/reference.md   the same reference for the skill, for assistants without the MCP
// node scripts/gen-catalog.mjs [--src <app repo>]   (default: the repo this folder sits in)
// The parsers are generic on purpose: new info panels, groups, themes and enum cases are picked up as they are added.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), MCP = join(HERE, '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined };
const APP = arg('--src') || process.env.IMACROPAD_SRC || join(MCP, '../..');
const KIT = join(APP, 'Sources/MacroKit');
if (!existsSync(KIT)) { console.error(`no Sources/MacroKit under ${APP}; pass --src <the iMacroPad app repo>`); process.exit(2) }
const swift = f => readFileSync(join(KIT, f), 'utf8');

/* ---------- small Swift readers ---------- */

/** The text between the braces of `enum|struct NAME …{`, nested braces included. */
export function body(src, kind, name) {
  const m = new RegExp(`\\b${kind}\\s+${name.replace('.', '\\.')}\\b[^{]*\\{`).exec(src);
  if (!m) return null;
  let depth = 1, i = m.index + m[0].length;
  const start = i;
  for (; i < src.length && depth; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; }
  return src.slice(start, i - 1);
}

/** Lines of `body` at its own level (not inside nested braces). */
function topLines(b) {
  const out = []; let depth = 0, line = '';
  for (const ch of b) {
    if (ch === '\n') { if (depth === 0) out.push(line); line = ''; continue }
    if (ch === '{') depth++;
    if (depth === 0) line += ch;
    if (ch === '}') depth--;
  }
  if (depth === 0 && line) out.push(line);
  return out;
}

/** Simple cases of an enum: [{name, note}], with a trailing `// note` or a `/// doc` line above. */
export function enumCases(src, name) {
  const b = body(src, 'enum', name); if (!b) return [];
  const out = []; let doc = [];
  for (const raw of topLines(b)) {
    const l = raw.trim();
    if (l.startsWith('///')) { doc.push(l.slice(3).trim()); continue }
    const m = l.match(/^case\s+([a-z]\w*(?:\s*,\s*[a-z]\w*)*)\s*(?:\/\/\s*(.*))?$/);
    if (m) for (const n of m[1].split(',').map(s => s.trim())) out.push({ name: n, note: (m[2] || doc.join(' ')).trim() || undefined });
    if (!l.startsWith('//')) doc = [];
  }
  return out;
}

/** `case .x: return "…"` pairs of an enum, in order: the first per case is usually its title. */
function returns(src, name) {
  const b = body(src, 'enum', name) || '', seen = {};
  for (const m of b.matchAll(/case\s+((?:\.\w+\s*,?\s*)+):\s*return\s+"([^"]*)"/g))
    for (const c of m[1].split(',').map(s => s.trim().slice(1)).filter(Boolean)) (seen[c] ||= []).push(m[2]);
  return seen;
}

/** Split a Swift argument list at its top-level commas. */
function args(s) {
  const out = []; let depth = 0, q = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { cur += ch; if (ch === '\\') { cur += s[++i]; continue } if (ch === '"') q = false; continue }
    if (ch === '"') { q = true; cur += ch; continue }
    if ('([{'.includes(ch)) depth++; if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const value = v => {
  v = v.trim();
  if (/^".*"$/.test(v)) return JSON.parse(v.replace(/\\\(/g, '('));
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  if (v === 'nil') return null;
  if (v.startsWith('.')) return v.slice(1);
  return v;
};

/* ---------- widgets ---------- */
const model = swift('Model.swift');
const widgetKinds = enumCases(model, 'WidgetKind').map(c => ({ kind: c.name, note: c.note }));
const shapes = enumCases(model, 'WidgetShape').map(c => c.name);

/* ---------- info panels ---------- */
const info = swift('InfoWidgets.swift');
const groupBody = body(info, 'enum', 'Group');
const gret = returns(groupBody ? `enum Group {${groupBody}}` : '', 'Group');
const infoGroups = enumCases(info, 'Group').map(c => ({ id: c.name, title: gret[c.name]?.[0], icon: gret[c.name]?.[1] }));
const pret = returns(`enum Param {${body(info, 'enum', 'Param') || ''}}`, 'Param');
const infoParams = enumCases(info, 'Param').map(c => ({ id: c.name, title: pret[c.name]?.[0] ?? null }));
const infoSources = enumCases(info, 'Source').map(c => c.name);
// `init(_ id, _ name, _ icon, _ group, _ source = .local, param: = .none, default: = nil, w: = 3, h: = 2, interactive: = false)`
const catalogBody = info.slice(info.indexOf('enum InfoCatalog'));
const infoPanels = [];
for (const m of catalogBody.matchAll(/^\s*\.init\((.*)\),?\s*(?:\/\/.*)?$/gm)) {
  const a = args(m[1]), pos = [], named = {};
  for (const x of a) { const k = x.match(/^([a-zA-Z]\w*)\s*:\s*([\s\S]+)$/); if (k && !x.startsWith('"')) named[k[1]] = value(k[2]); else pos.push(value(x)) }
  const [id, name, icon, group, source = 'local'] = pos;
  if (typeof id !== 'string') continue;
  const param = named.param ?? 'none';
  infoPanels.push({
    id, name, icon, group, source, param, paramTitle: infoParams.find(p => p.id === param)?.title ?? null,
    default: named.default ?? null, w: named.w ?? 3, h: named.h ?? 2, interactive: named.interactive ?? false,
  });
}

/* ---------- themes ---------- */
const theme = swift('Theme.swift');
// stored roles only: a computed one (`highlightInk { … }`) has a brace on its line
const paletteRoles = (body(theme, 'struct', 'ThemePalette') || '').split('\n')
  .map(l => l.match(/^\s*public var (\w+): String\s*(?:\/\/\s*(.*))?$/)).filter(Boolean).map(m => ({ role: m[1], note: m[2]?.trim() }));
const themeEnums = Object.fromEntries(['KeycapStyle', 'LegendFont', 'PressEffect', 'ClickSound', 'Tint', 'LegendAlign', 'KnobStyle', 'CapMaterial']
  .map(n => [n, enumCases(theme, n).map(c => c.note ? `${c.name}: ${c.note}` : c.name)]));
const themes = [];
for (const f of readdirSync(KIT).filter(f => /^Themes.*\.swift$/.test(f)).sort())
  for (const m of swift(f).matchAll(/\bid:\s*"([^"]+)",\s*name:\s*"([^"]+)"(?:,\s*family:\s*"([^"]+)")?/g))
    if (!themes.some(t => t.id === m[1])) themes.push({ id: m[1], name: m[2], family: m[3] || null });

/* ---------- plugin vocabulary ---------- */
const plugin = swift('Plugin.swift'), action = swift('Action.swift');
const cret = returns(plugin, 'Capability');
const capabilities = enumCases(plugin, 'Capability').map(c => ({ id: c.name, title: cret[c.name]?.[0] }));
const integrationKinds = enumCases(plugin, 'Kind').map(c => c.name);
const integrationOutputs = enumCases(plugin, 'Output').map(c => c.name);
const fileTypes = JSON.parse((plugin.match(/fileTypes\s*=\s*(\[[^\]]*\])/) || [, '[]'])[1]);
const keys = [...(swift('KeyMap.swift').matchAll(/"((?:\\.|[^"\\])+)"\s*:\s*\d+/g))].map(m => JSON.parse(`"${m[1]}"`));
const gestures = existsSync(join(KIT, 'TrackpadGesture.swift')) ? (body(swift('TrackpadGesture.swift'), 'enum', 'TrackpadGesture') || '')
  .split('\n').map(l => l.match(/^\s*case\s+([a-z]\w*(?:\s*,\s*[a-z]\w*)*)\s*$/)).filter(Boolean).flatMap(m => m[1].split(',').map(s => s.trim())) : [];

/** Every case of an indirect enum with its associated values: [{name, params: [{label, type}], doc}]. */
function actionCases(src, name) {
  const b = body(src, 'enum', name) || '', out = []; let doc = [];
  for (const raw of topLines(b)) {
    const l = raw.trim();
    if (l.startsWith('///')) { doc.push(l.slice(3).trim()); continue }
    const m = l.match(/^case\s+(.+)$/);
    if (m && !m[1].startsWith('.')) {
      for (const c of args(m[1].replace(/\s*\/\/.*$/, ''))) {
        const cm = c.match(/^(\w+)(?:\((.*)\))?$/); if (!cm) continue;
        const params = cm[2] ? args(cm[2]).map((p, i) => { const pm = p.match(/^(\w+)\s*:\s*(.+)$/); return pm ? { label: pm[1], type: pm[2] } : { label: `_${i}`, type: p } }) : [];
        out.push({ name: cm[1], params, doc: doc.join(' ') || undefined });
      }
    }
    if (!l.startsWith('//')) doc = [];
  }
  return out;
}
const macros = swift('Macros.swift'), midi = existsSync(join(KIT, 'MIDI.swift')) ? swift('MIDI.swift') : '';
const actions = {
  MacroAction: actionCases(action, 'MacroAction'),
  MediaKey: enumCases(action, 'MediaKey').map(c => c.name),
  Modifier: enumCases(action, 'Modifier').map(c => c.name),
  OBSCommand: actionCases(action, 'OBSCommand'),
  PhotoshopCommand: actionCases(action, 'PhotoshopCommand'),
  TeamsCommand: enumCases(action, 'TeamsCommand').map(c => c.name),
  PadCommand: actionCases(macros, 'PadCommand'),
  MacroCondition: actionCases(macros, 'MacroCondition'),
  MIDICommand: actionCases(midi, 'MIDICommand'),
};

/* ---------- the text rules, for the validator's JavaScript fallback ---------- */
// `[("pattern", "why"), …]` lists: Swift string literals read as JSON strings (same escapes), checked to compile in JavaScript.
function rulePairs(src, from) {
  const at = src.indexOf(from); if (at < 0) return [];
  const end = src.indexOf('\n        ]', at), block = src.slice(at, end > 0 ? end : undefined), out = [];
  for (const m of block.matchAll(/\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*\)/g)) {
    const [pattern, why] = [JSON.parse(m[1]), JSON.parse(m[2])];
    try { new RegExp(pattern); out.push([pattern, why]) } catch (e) { console.warn(`! skipped a rule JavaScript cannot read: ${pattern} (${e.message})`) }
  }
  return out;
}
const rules = {
  safeHTML: rulePairs(swift('CustomWidgets.swift'), 'private static let rules'),
  safeHTMLMaxBytes: Number((swift('CustomWidgets.swift').match(/maxBytes\s*=\s*([\d_]+)/) || [, '200000'])[1].replace(/_/g, '')),
  danger: rulePairs(swift('PluginValidator.swift'), 'let rules: [(String, String)]'),
};

const catalog = {
  about: 'Generated from the iMacroPad app\'s Swift model by scripts/gen-catalog.mjs. Info panel sizes (w, h) are grid cells; they read the same on a landscape 12×8 pad.',
  widgetKinds, shapes, infoGroups, infoSources, infoParams, infoPanels,
  paletteRoles, themeEnums, themes, capabilities, integrationKinds, integrationOutputs, fileTypes, keys, gestures, actions, rules,
};
mkdirSync(join(MCP, 'data'), { recursive: true });
writeFileSync(join(MCP, 'data/catalog.json'), JSON.stringify(catalog, null, 1) + '\n');

// the docs travel with the package (npx has no repo around it)
const docs = [[join(APP, 'docs/PLUGINS.md'), 'PLUGINS.md'], [join(MCP, '../CONTRIBUTING.md'), 'CONTRIBUTING.md'], [join(MCP, '../REVIEW.md'), 'REVIEW.md']];
for (const [from, to] of docs) if (existsSync(from)) writeFileSync(join(MCP, 'data', to), readFileSync(from, 'utf8'));

// the skill's offline copy of the reference
const { formatReference } = await import('../src/reference.js?' + Date.now());
const skill = join(MCP, '../skill/imacropad-community');
if (existsSync(skill)) writeFileSync(join(skill, 'reference.md'), formatReference({ full: true }));

console.log(`catalog.json: ${widgetKinds.length} widget kinds, ${infoPanels.length} info panels in ${infoGroups.length} groups, ${paletteRoles.length} palette roles, ${themes.length} themes, ${actions.MacroAction.length} actions, ${keys.length} key names`);
