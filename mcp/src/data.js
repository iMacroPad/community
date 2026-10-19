// What the server knows: data/catalog.json (made from the app's Swift model by scripts/gen-catalog.mjs) and the docs.
// In a clone of the app or catalog repo the live docs are read; installed from npm, the copies in data/ are.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
let cached;

export function catalog() {
  if (!cached) {
    const f = join(DATA, 'catalog.json');
    if (!existsSync(f)) throw new Error('data/catalog.json is missing: run `node scripts/gen-catalog.mjs` in community/mcp');
    cached = JSON.parse(readFileSync(f, 'utf8'));
  }
  return cached;
}

/** A doc by name: the repo's own copy when this runs from a clone, else the one bundled in data/. */
export function doc(name) {
  const live = { 'PLUGINS.md': join(ROOT, '../../docs/PLUGINS.md'), 'CONTRIBUTING.md': join(ROOT, '../CONTRIBUTING.md'), 'REVIEW.md': join(ROOT, '../REVIEW.md') }[name];
  for (const f of [live, join(DATA, name)]) if (f && existsSync(f)) return readFileSync(f, 'utf8');
  return '';
}

export const REPO = 'iMacroPad/community';
export const GRID = { columns: 12, rows: 8 };
