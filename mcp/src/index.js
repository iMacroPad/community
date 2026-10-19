#!/usr/bin/env node
// The iMacroPad community MCP server (stdio): the plugin format, scaffolds for plugins, themes and layouts,
// the validator, and how to submit to the catalog. Run: npx -y @imacropad/mcp   or   node community/mcp/src/index.js
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { catalog, ROOT, GRID } from './data.js';
import { formatReference, schemaSummary } from './reference.js';
import { scaffoldPlugin, scaffoldTheme, scaffoldLayout, wrap, MOODS } from './scaffold.js';
import { validatePlugin } from './validate.js';
import { submitInstructions } from './submit.js';

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const server = new McpServer({ name: 'imacropad', version }, {
  instructions: 'Tools for making iMacroPad community content (plugins, widget packs, themes, layouts). Read get_format_reference first. ' +
    'Design for a landscape pad (12×8 grid), prefer native info panels over HTML, never write secret values into a file (use ${secret:NAME}), ' +
    'run validate_plugin until it passes, then follow submit_instructions.',
});

const text = s => ({ content: [{ type: 'text', text: s }] });
const json = (o, lead = '') => text((lead ? lead + '\n\n' : '') + '```json\n' + JSON.stringify(o, null, 2) + '\n```');
const fail = e => ({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
const safe = fn => async args => { try { return await fn(args) } catch (e) { return fail(e) } };
const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

/* ---------- reference ---------- */

server.registerResource('format-reference', 'imacropad://reference/format', {
  title: 'iMacroPad plugin format', description: 'Design rules, a field-by-field JSON summary and docs/PLUGINS.md', mimeType: 'text/markdown',
}, async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatReference({ full: true }) }] }));

server.registerResource('catalog', 'imacropad://reference/catalog.json', {
  title: 'Widget kinds, info panels, themes and actions', description: 'The lists taken from the app\'s Swift model', mimeType: 'application/json',
}, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(catalog(), null, 1) }] }));

server.registerTool('get_format_reference', {
  title: 'Plugin format reference',
  description: 'The iMacroPad plugin file format: design rules, a field-by-field JSON summary of Plugin, Profile/Layout, PadWidget, Theme, Integration, Macro and MacroAction (taken from the app\'s Swift model), and the full docs/PLUGINS.md. Read this before writing a plugin, theme or layout.',
  inputSchema: { part: z.enum(['all', 'summary', 'docs']).default('all').describe('"summary": only the JSON summary; "docs": only docs/PLUGINS.md; "all": both with the design rules') },
  annotations: READ,
}, safe(async ({ part = 'all' }) => text(part === 'summary' ? schemaSummary() : part === 'docs' ? formatReference({ full: true }).split('# The plugin format (docs/PLUGINS.md)')[1] : formatReference({ full: true }))));

server.registerTool('list_widget_kinds', {
  title: 'Widget kinds, info panels, palette roles and themes',
  description: 'Every widget kind (button, knob, info, markdown, html, chart…), the info-panel catalog (id, name, group, param, default size in grid cells), the theme palette roles, the theme enums (keycap, font, press effect…) and the built-in theme ids. All read from the app\'s Swift model.',
  inputSchema: {
    group: z.string().optional().describe('only info panels of this group id (e.g. "time", "mac", "sky")'),
    include: z.array(z.enum(['kinds', 'info', 'palette', 'themes', 'enums'])).optional().describe('which parts to return; all by default'),
  },
  annotations: READ,
}, safe(async ({ group, include }) => {
  const C = catalog(), want = k => !include?.length || include.includes(k), out = {};
  if (want('kinds')) out.widgetKinds = C.widgetKinds;
  if (want('info')) {
    out.infoGroups = C.infoGroups;
    out.infoPanels = C.infoPanels.filter(p => !group || p.group === group).map(({ id, name, group, source, param, paramTitle, default: d, w, h, interactive }) => ({ id, name, group, source, param, paramTitle, default: d, size: `${w}×${h}`, interactive }));
    out.infoNote = 'Use as {"kind":"info","infoID":"<id>","param":"<setting>"}. Sizes are grid cells; on the default landscape 12×8 grid a cell is 1/12 wide and 1/8 high.';
  }
  if (want('palette')) out.paletteRoles = C.paletteRoles;
  if (want('enums')) out.themeEnums = C.themeEnums;
  if (want('themes')) out.themes = C.themes;
  return json(out);
}));

/* ---------- scaffolds ---------- */

const author = z.string().min(1).max(80).describe('the maker\'s name as shown in the catalog');
const pluginId = z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/).describe('yourname.plugin-name: lower case, a dot, then letters, digits and dashes; never imacropad.…');

server.registerTool('scaffold_plugin', {
  title: 'Start a plugin',
  description: 'A valid starter plugin file. "widget-pack": widgets for any layout (in components and on a ready layout). "app-plugin": a landscape layout of keys, a dial and cards for one Mac app. Options add a theme and an example integration that reads a secret from the Mac\'s keychain. Permissions are declared with plain reasons to rewrite.',
  inputSchema: {
    id: pluginId, name: z.string().min(2).max(60), author,
    kind: z.enum(['widget-pack', 'app-plugin']).default('widget-pack'),
    options: z.object({
      blurb: z.string().max(400).optional().describe('one or two sentences on what it does (20–400 characters)'),
      icon: z.string().optional().describe('SF Symbol name'),
      app: z.object({ name: z.string(), bundleIDs: z.array(z.string()).min(1) }).optional().describe('for app-plugin: the Mac app'),
      withTheme: z.boolean().optional().describe('add a palette theme of its own'),
      mood: z.enum(MOODS).optional().describe('the theme\'s mood'),
      accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('the theme\'s accent colour'),
      withIntegration: z.boolean().optional().describe('add an example REST integration and a live Markdown card'),
    }).optional(),
  },
  annotations: READ,
}, safe(async ({ id, name, author, kind = 'widget-pack', options = {} }) => {
  const { plugin, notes } = scaffoldPlugin({ id, name, author, kind, ...options });
  const r = await validatePlugin({ json: JSON.stringify(plugin), useApp: false });
  return json(plugin, `Save as \`${id}.imacropad-plugin.json\`.\n${notes.map(n => `- ${n}`).join('\n')}\n- Quick check: ${r.passed ? 'passes' : 'has errors'} (${r.errors} errors, ${r.warnings} warnings); run validate_plugin after every change.`);
}));

server.registerTool('scaffold_theme', {
  title: 'Make a palette theme',
  description: 'A complete theme: all palette roles in #RRGGBB from a mood and optional base colours, with legends that read on their keys, plus keycap, font and press effect. Give pluginId so the theme id starts with it (the check requires that); asPlugin wraps it into a theme-only plugin file.',
  inputSchema: {
    name: z.string().min(1).max(60),
    pluginId: pluginId.optional().describe('the plugin the theme belongs to; its id becomes <pluginId>.<name>'),
    mood: z.enum(MOODS).default('dark'),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('main accent colour'),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('pad background; keys, surface and border follow it'),
    hue: z.union([z.number(), z.string()]).optional().describe('a hue in degrees or a colour word (red, orange, teal, blue, violet, pink…) when no accent is given'),
    keycap: z.string().optional().describe(`keycap style: ${catalog().themeEnums.KeycapStyle.map(s => s.split(':')[0]).join(', ')}`),
    blurb: z.string().max(200).optional(),
    asPlugin: z.object({ name: z.string().min(2).max(60), author, blurb: z.string().max(400).optional() }).optional().describe('also return a theme-only plugin file (uses pluginId as its id)'),
  },
  annotations: READ,
}, safe(async ({ asPlugin, ...a }) => {
  const theme = scaffoldTheme(a);
  if (!asPlugin) return json(theme, `Theme “${theme.name}” (${theme.id}). Put it in a plugin's "themes" and name it in a layout's "themeID".`);
  if (!a.pluginId) throw new Error('asPlugin needs pluginId');
  const p = wrap({ id: a.pluginId, name: asPlugin.name, author: asPlugin.author, blurb: asPlugin.blurb || `${theme.name}: a ${a.mood || 'dark'} palette theme for any layout, with legends that stay readable on every key.`, themes: [theme] });
  return json(p, `Save as \`${p.id}.imacropad-plugin.json\`.`);
}));

const widgetSpec = z.object({
  info: z.string().optional().describe('an info panel id from list_widget_kinds (e.g. "clock.digital", "weather.now")'),
  kind: z.string().optional().describe('a widget kind (button, knob, slider, trackpad, label, markdown, chart, html, chips…); default "info" when info is set, else "button"'),
  label: z.string().max(60).optional(), icon: z.string().optional().describe('SF Symbol'),
  tint: z.enum(['key', 'accent', 'accent2', 'danger', 'surface']).optional(),
  chord: z.string().optional().describe('shortcut for the action, e.g. "cmd+shift+z" or "⇧⌘Z"'), altChord: z.string().optional().describe('knob anticlockwise / toggle off'),
  action: z.record(z.string(), z.any()).optional().describe('a MacroAction in its JSON shape (see the reference)'), altAction: z.record(z.string(), z.any()).optional(),
  param: z.string().optional(), content: z.string().optional().describe('markdown, html or chart content'), settings: z.record(z.string(), z.string()).optional(),
  options: z.array(z.object({ label: z.string(), action: z.record(z.string(), z.any()) })).optional(), stateKey: z.string().optional(),
  w: z.number().int().min(1).max(24).optional().describe('width in grid cells (default: the panel\'s or kind\'s size)'), h: z.number().int().min(1).max(24).optional(),
  x: z.number().int().min(0).optional().describe('column to place it at (optional; first free place otherwise)'), y: z.number().int().min(0).optional(),
});

server.registerTool('scaffold_layout', {
  title: 'Lay out a pad',
  description: `A layout (profile) for a landscape pad from a list of widgets: info panels by id or widgets by kind, with sizes in grid cells (default grid ${GRID.columns}×${GRID.rows}). Widgets are placed cell by cell, so the fractional frames never overlap and stay inside 0…1; what does not fit is reported. Returns the profile, a text map of the grid, and optionally a plugin file around it.`,
  inputSchema: {
    name: z.string().min(1).max(60), widgets: z.array(widgetSpec).min(1).max(150),
    columns: z.number().int().min(1).max(24).default(GRID.columns), rows: z.number().int().min(1).max(24).default(GRID.rows),
    icon: z.string().optional(), themeID: z.string().optional().describe('a built-in theme id or one of the plugin\'s'), matchBundleIDs: z.array(z.string()).optional().describe('the app it is for (must be the plugin\'s app)'),
    asPlugin: z.object({ id: pluginId, name: z.string().min(2).max(60), author, blurb: z.string().max(400).optional(), app: z.object({ name: z.string(), bundleIDs: z.array(z.string()).min(1) }).optional() }).optional(),
  },
  annotations: READ,
}, safe(async ({ asPlugin, ...a }) => {
  if (asPlugin?.app && !a.matchBundleIDs) a.matchBundleIDs = asPlugin.app.bundleIDs;
  const { profile, grid, legend, notes } = scaffoldLayout(a);
  const lead = `Grid ${profile.layout.columns}×${profile.layout.rows}:\n\`\`\`\n${grid}\n\`\`\`\n${legend.join('\n')}${notes.length ? '\n\n' + notes.map(n => `- ${n}`).join('\n') : ''}`;
  if (!asPlugin) return json(profile, lead + '\n\nPut it in a plugin\'s "profiles".');
  const p = wrap({ ...asPlugin, blurb: asPlugin.blurb || `${asPlugin.name}: a landscape layout for iMacroPad, ${profile.layout.widgets.length} widgets on a ${profile.layout.columns}×${profile.layout.rows} grid.`, profiles: [profile] });
  return json(p, lead + `\n\nSave as \`${p.id}.imacropad-plugin.json\`.`);
}));

/* ---------- validate and submit ---------- */

server.registerTool('validate_plugin', {
  title: 'Validate a plugin file',
  description: 'Runs the app\'s own validator (`imacropadd plugin validate`): from PATH, the iMacroPad Mac app, or the catalog\'s "validator" release (downloaded once into ~/.cache/imacropad-mcp). Without it (offline, not a Mac) a JavaScript port of the same rules runs. Then checks the app leaves to the editor: overlapping widgets, unknown info panels and the catalog\'s rules. Returns the structured report; fix every FAIL and validate again.',
  inputSchema: {
    json: z.string().optional().describe('the plugin file\'s text'), path: z.string().optional().describe('or a path to the file'),
    useApp: z.boolean().default(true).describe('use the app\'s validator when it can be found or downloaded'),
    download: z.boolean().default(true).describe('allow downloading the validator when it is not installed'),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
}, safe(async ({ json: j, path, useApp = true, download = true }) => {
  const r = await validatePlugin({ json: j, path: path ? resolve(path) : undefined, useApp, download });
  const { text: t, raw, ...rest } = r;
  return { content: [{ type: 'text', text: t }, { type: 'text', text: JSON.stringify(rest, null, 2) }], structuredContent: rest };
}));

server.registerTool('submit_instructions', {
  title: 'Submit to the community catalog',
  description: 'How to submit an item to the iMacroPad community catalog (github.com/iMacroPad/community): the exact items/<id>/ folder (plugin file, meta.json, README.md, screenshots/), a meta.json and README drafted from the plugin, the checks, and the pull-request commands.',
  inputSchema: {
    id: z.string().optional().describe('the plugin id (or give the plugin)'),
    plugin: z.string().optional().describe('the plugin file\'s text, to fill in type, secrets and hosts'),
    type: z.enum(['plugin', 'layout', 'theme', 'widgets', 'integration', 'workflow']).optional(),
    tags: z.array(z.string()).max(6).optional(), screenshots: z.number().int().min(1).max(8).default(2),
  },
  annotations: READ,
}, safe(async a => text(submitInstructions(a).text)));

await server.connect(new StdioServerTransport());
