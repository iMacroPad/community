#!/usr/bin/env node
// The catalog's one script (Node 20+, no packages):
//   node scripts/catalog.mjs check [--root DIR] [--base DIR]  the rules every item folder follows; exit 1 on a problem
//   node scripts/catalog.mjs publish                          a release per new version, an issue per new item (gh, GH_TOKEN)
//   node scripts/catalog.mjs index                            index.json for the website: items + installs, likes, requests
// It only reads submissions. Nothing in an item folder is ever run.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = process.env.GITHUB_REPOSITORY || 'iMacroPad/community';
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def };
const ROOT = arg('--root', '.'), BASE = arg('--base');
export const TYPES = ['plugin', 'layout', 'theme', 'widgets', 'integration', 'workflow'];
const ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/, VERSION = /^\d+\.\d+\.\d+$/, TAG = /^[a-z0-9][a-z0-9 -]{1,19}$/;
const MAGIC = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], jpeg: [0xff, 0xd8, 0xff], webp: [0x52, 0x49, 0x46, 0x46] };
const MB = 1024 * 1024;

const dirs = root => existsSync(join(root, 'items')) ? readdirSync(join(root, 'items')).filter(d => statSync(join(root, 'items', d)).isDirectory()).sort() : [];
const json = f => JSON.parse(readFileSync(f, 'utf8'));
const pluginFile = id => `${id}.imacropad-plugin.json`;

/* ---------- check ---------- */
export function checkItem(root, id, base) {
  const errs = [], e = m => errs.push(`${id}: ${m}`), dir = join(root, 'items', id);
  if (!ID.test(id)) e('the folder name must be the plugin ID: lower case, with a dot, like yourname.my-widgets');
  if (id.startsWith('imacropad.')) e('IDs starting with “imacropad.” belong to the app');
  const allowed = new Set([pluginFile(id), 'meta.json', 'README.md', 'screenshots']);
  for (const f of readdirSync(dir)) if (!allowed.has(f)) e(`“${f}” does not belong here: an item holds ${[...allowed].join(', ')} and nothing else`);

  let p, m;
  const pf = join(dir, pluginFile(id));
  if (!existsSync(pf)) e(`missing ${pluginFile(id)}`);
  else if (statSync(pf).size > 4 * MB) e('the plugin file is larger than 4 MB');
  else try { p = json(pf) } catch (x) { e(`${pluginFile(id)} is not JSON: ${x.message}`) }
  if (p) {
    if (p.id !== id) e(`the plugin's "id" is “${p.id}”, the folder is “${id}”`);
    if (typeof p.format !== 'number') e('"format" is missing');
    if (!(p.name?.length >= 2 && p.name.length <= 60)) e('"name" must be 2–60 characters');
    if (!VERSION.test(p.version || '')) e('"version" must look like 1.0.0');
    if (!p.author?.trim()) e('"author" is missing');
    if (!(p.blurb?.length >= 20 && p.blurb.length <= 400)) e('"blurb" must be 20–400 characters: one or two sentences on what it does');
  }
  try { m = json(join(dir, 'meta.json')) } catch (x) { e(`meta.json: ${x.code === 'ENOENT' ? 'missing' : x.message}`) }
  if (m) {
    for (const k of Object.keys(m)) if (!['type', 'tags', 'screenshots'].includes(k)) e(`meta.json: unknown field "${k}"`);
    if (!TYPES.includes(m.type)) e(`meta.json: "type" must be one of ${TYPES.join(', ')}`);
    if (!Array.isArray(m.tags) || m.tags.length > 6 || m.tags.some(t => !TAG.test(t))) e('meta.json: "tags" is a list of up to 6 short lower-case words');
    const shots = existsSync(join(dir, 'screenshots')) ? readdirSync(join(dir, 'screenshots')) : [];
    if (!Array.isArray(m.screenshots) || m.screenshots.length < 1 || m.screenshots.length > 8) e('meta.json: "screenshots" lists 1–8 pictures');
    else for (const s of m.screenshots) {
      if (!shots.includes(s.file)) { e(`screenshot “${s.file}” is not in screenshots/`); continue }
      if (s.caption && s.caption.length > 120) e(`screenshot “${s.file}”: the caption is longer than 120 characters`);
    }
    for (const f of shots) {
      const ext = f.split('.').pop().toLowerCase(), b = readFileSync(join(dir, 'screenshots', f));
      if (!MAGIC[ext] || !MAGIC[ext].every((x, i) => b[i] === x)) e(`screenshots/${f}: only real PNG, JPEG or WebP pictures`);
      if (b.length > 1.5 * MB) e(`screenshots/${f}: larger than 1.5 MB`);
      if (Array.isArray(m.screenshots) && !m.screenshots.some(s => s.file === f)) e(`screenshots/${f} is not listed in meta.json`);
    }
  }
  const rf = join(dir, 'README.md');
  if (!existsSync(rf)) e('missing README.md');
  else {
    const r = readFileSync(rf, 'utf8');
    if (r.length < 80 || r.length > 20000) e('README.md must be 80–20 000 characters');
    if (/<[a-z!/][^>]*>/i.test(r.replace(/`[^`]*`/g, ''))) e('README.md: plain Markdown only, no HTML');
    if (/!\[/.test(r)) e('README.md: pictures go in screenshots/, not in the text');
  }
  // a changed plugin needs a new version: installs are counted per version and the app updates by it
  const bf = base && join(base, 'items', id, pluginFile(id));
  if (p && bf && existsSync(bf) && readFileSync(bf, 'utf8') !== readFileSync(pf, 'utf8') && json(bf).version === p.version)
    e(`the plugin changed but "version" is still ${p.version}: raise it`);
  return errs;
}

/* ---------- index ---------- */
async function gh(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
      { headers: { authorization: `Bearer ${process.env.GH_TOKEN || process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub ${path}: ${r.status}`);
    const a = await r.json(); out.push(...a);
    if (a.length < 100) return out;
  }
}
const gitDate = (id, first) => { try { const l = execFileSync('git', ['log', '--format=%cs', '--', `items/${id}`], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean); return (first ? l.at(-1) : l[0]) || null } catch { return null } };
const host = u => { try { return new URL(u).host } catch { return null } };

async function index() {
  const live = !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  const [releases, itemIssues, requestIssues] = live ? await Promise.all([gh('releases'), gh('issues?labels=item&state=all'), gh('issues?labels=request&state=open')]) : [[], [], []];
  const picks = existsSync(join(ROOT, 'editors-picks.json')) ? json(join(ROOT, 'editors-picks.json')) : [];
  const items = dirs(ROOT).map(id => {
    const dir = join(ROOT, 'items', id), p = json(join(dir, pluginFile(id))), m = json(join(dir, 'meta.json'));
    const issue = itemIssues.find(i => i.title.endsWith(`(${id})`));
    return {
      id, name: p.name, version: p.version, author: p.author, blurb: p.blurb, icon: p.icon || null, app: p.app?.name || null,
      type: m.type, tags: m.tags, readme: readFileSync(join(dir, 'README.md'), 'utf8'),
      screenshots: m.screenshots.map(s => ({ path: `items/${id}/screenshots/${s.file}`, caption: s.caption || '' })),
      contents: { layouts: p.profiles?.length || 0, themes: p.themes?.length || 0, widgets: p.components?.length || 0, integrations: p.integrations?.length || 0, gestures: p.triggers?.length || 0, macros: p.macros?.length || 0 },
      permissions: (p.permissions || []).map(x => ({ capability: x.capability, reason: x.reason })),
      hosts: [...new Set((p.integrations || []).map(i => host(i.url)).filter(Boolean))],
      file: `https://github.com/${REPO}/releases/download/${encodeURIComponent(`${id}@${p.version}`)}/${pluginFile(id)}`,
      added: gitDate(id, true), updated: gitDate(id, false), pick: picks.includes(id),
      installs: releases.filter(r => r.tag_name.startsWith(id + '@')).flatMap(r => r.assets).reduce((n, a) => n + a.download_count, 0),
      likes: issue?.reactions?.['+1'] || 0, issue: issue?.number || null,
    };
  });
  const requests = requestIssues.filter(i => !i.pull_request).map(i => ({ title: i.title.replace(/^\[request\]\s*/i, ''), number: i.number, votes: i.reactions?.['+1'] || 0, comments: i.comments }))
    .sort((a, b) => b.votes - a.votes || b.comments - a.comments).slice(0, 12);
  writeFileSync(join(ROOT, 'index.json'), JSON.stringify({ repo: REPO, types: TYPES, items, requests }, null, 1) + '\n');
  console.log(`index.json: ${items.length} items, ${requests.length} requests${live ? '' : ' (no GitHub token: no stats)'}`);
}

/* ---------- publish: what the stats are counted on ---------- */
function publish() {
  const run = (...a) => execFileSync('gh', a, { cwd: ROOT, encoding: 'utf8' });
  for (const [l, c, d] of [['item', '5e9bff', 'One per catalog item: 👍 it to like it'], ['request', 'a37bff', 'Something people would like made']]) run('label', 'create', l, '--color', c, '--description', d, '--force');
  const tags = new Set(JSON.parse(run('release', 'list', '--limit', '1000', '--json', 'tagName')).map(r => r.tagName));
  const issues = JSON.parse(run('issue', 'list', '--label', 'item', '--state', 'all', '--limit', '1000', '--json', 'title'));
  for (const id of dirs(ROOT)) {
    const p = json(join(ROOT, 'items', id, pluginFile(id))), tag = `${id}@${p.version}`;
    if (!tags.has(tag)) { run('release', 'create', tag, join('items', id, pluginFile(id)), '--title', `${p.name} ${p.version}`, '--notes', p.blurb, '--target', 'main', '--latest=false'); console.log('released', tag) }
    if (!issues.some(i => i.title.endsWith(`(${id})`))) {
      run('issue', 'create', '--label', 'item', '--title', `${p.name} (${id})`, '--body', `**${p.name}** by ${p.author}\n\n${p.blurb}\n\n👍 this issue to like it. Questions and problems go in the comments.\n\nFiles: [items/${id}](../tree/main/items/${id})`);
      console.log('issue for', id);
    }
  }
}

const cmd = process.argv[2];
if (cmd === 'check') {
  const errs = dirs(ROOT).flatMap(id => checkItem(ROOT, id, BASE));
  if (errs.length) { console.error(errs.map(x => '✗ ' + x).join('\n')); process.exit(1) }
  console.log(`✓ ${dirs(ROOT).length} items follow the rules`);
} else if (cmd === 'index') await index();
else if (cmd === 'publish') publish();
else if (cmd) { console.error('usage: catalog.mjs check|publish|index'); process.exit(2) }
