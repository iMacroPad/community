// submit_instructions: how an item gets into the community catalog, with its folder written out for this plugin.
import { doc, REPO } from './data.js';

const TYPES = ['plugin', 'layout', 'theme', 'widgets', 'integration', 'workflow'];

/** The catalog type a plugin most likely is, from what it holds. */
export function guessType(p) {
  if (!p) return 'plugin';
  const n = k => (p[k] || []).length;
  if (n('integrations')) return 'integration';
  if (n('macros') && !n('profiles') && !n('components')) return 'workflow';
  if (n('themes') && !n('profiles') && !n('components')) return 'theme';
  if (n('components') && !p.app) return 'widgets';
  if (p.app) return 'plugin';
  if (n('profiles')) return 'layout';
  return 'plugin';
}

export function submitInstructions({ id, type, tags = [], screenshots = 2, plugin }) {
  const p = plugin ? (typeof plugin === 'string' ? JSON.parse(plugin) : plugin) : null;
  id ||= p?.id;
  if (!id) throw new Error('give the plugin\'s "id" (or the plugin itself)');
  type ||= guessType(p);
  if (!TYPES.includes(type)) throw new Error(`type must be one of ${TYPES.join(', ')}`);
  const n = Math.max(1, Math.min(8, screenshots | 0 || 1));
  const meta = { type, tags: tags.slice(0, 6).map(t => String(t).toLowerCase().slice(0, 20)), screenshots: Array.from({ length: n }, (_, i) => ({ file: `${i + 1}.png`, caption: i === 0 ? 'The layout on the pad' : 'A closer look' })) };
  const file = `${id}.imacropad-plugin.json`;
  const tree = `items/${id}/
  ${file}
  meta.json
  README.md
  screenshots/
${meta.screenshots.map(s => `    ${s.file}`).join('\n')}`;
  const secrets = p ? [...new Set(JSON.stringify(p.integrations || []).match(/\$\{secret:([A-Z0-9_]+)\}/g) || [])].map(s => s.slice(9, -1)) : [];
  const hosts = p ? [...new Set((p.integrations || []).map(i => { try { return new URL(i.url.replace(/\$\{[^}]*\}/g, 'x')).host } catch { return null } }).filter(Boolean))] : [];
  const readme = `${p?.blurb || 'What it does, in a sentence or two.'}

## What you get

- **…**: what this key, widget or layout does.

## Before you start

${secrets.length ? secrets.map((s, i) => `${i + 1}. Put your own key into the Mac's keychain: \`imacropadd secret set ${s}\`. The file never holds it.`).join('\n') + '\n' : ''}${p?.app ? `- Made for ${p.app.name}; tested with version … in English.\n` : ''}- Install, then switch on only the permissions you want.
${hosts.length ? `\n## What it sends where\n\n${hosts.map(h => `- \`${h}\`: …`).join('\n')}\n` : ''}`;

  const steps = `# Submitting “${p?.name || id}” to the iMacroPad community catalog

Catalog repository: https://github.com/${REPO} · website: https://www.imacropad.app/community/

## 1. Check it

\`\`\`sh
imacropadd plugin validate ${file}     # the app's own check (or validate_plugin in this MCP)
imacropadd plugin test ${file}         # also against the real app on this Mac
\`\`\`

## 2. The folder

\`\`\`
${tree}
\`\`\`

**meta.json**

\`\`\`json
${JSON.stringify(meta, null, 2)}
\`\`\`

**README.md** (plain Markdown, no HTML, no pictures; 80–20 000 characters):

\`\`\`markdown
${readme.trim()}
\`\`\`

**Screenshots**: 1–8 real PNG, JPEG or WebP pictures of it on the pad (landscape), at most 1.5 MB each, nothing
personal in them, each listed in meta.json. The folder holds these files and nothing else.

## 3. Open a pull request

\`\`\`sh
gh repo fork ${REPO} --clone && cd community
mkdir -p items/${id}/screenshots
cp /path/to/${file} items/${id}/            # plus meta.json, README.md, screenshots/
node scripts/catalog.mjs check                 # the folder rules
git checkout -b add-${id} && git add items/${id} && git commit -m "Add ${p?.name || id}"
git push -u origin add-${id} && gh pr create --fill
\`\`\`

One item per pull request, changing only \`items/${id}/\`. The validator runs on a Mac, an AI review comments, an
editor tries it and merges. An update changes the file and raises \`"version"\`.

## The catalog's own guide (CONTRIBUTING.md)

${doc('CONTRIBUTING.md').replace(/^# .*\n/, '').trim()}
`;
  return { folder: `items/${id}/`, files: { [file]: '(the plugin file)', 'meta.json': meta, 'README.md': readme }, type, text: steps };
}
