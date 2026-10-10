/**
 * Icon check: verifies every lucide-react icon imported in src/ actually exists.
 * A missing icon renders as `undefined` and crashes the whole React tree
 * (error #130) — which shows up as a blank white page. This catches it early.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lucide = require('lucide-react');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const missing = [];
for (const file of walk(path.resolve('src'))) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      if (lucide[name] === undefined) missing.push(`${path.relative(process.cwd(), file)}: ${name}`);
    }
  }
}

if (!missing.length) {
  console.log('✅ all lucide-react icons exist');
} else {
  console.log('❌ missing icons (' + missing.length + '):');
  for (const m of missing) console.log('  - ' + m);
}
process.exit(missing.length ? 1 : 0);