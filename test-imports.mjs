/**
 * Static export check: verifies every named import in src/ actually exists in
 * the target module. This is what turns a "component is undefined" runtime
 * crash (React #130) into a concrete, fixable report.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const exportsOf = new Map();
const starCache = new Map();

function collectExports(file) {
  if (exportsOf.has(file)) return { names: exportsOf.get(file), stars: starCache.get(file) ?? [] };
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();

  // export const/let/var/function/class
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  // export interface / export type
  for (const m of src.matchAll(/export\s+(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  // export function name(  /  export async function
  for (const m of src.matchAll(/export\s+default\s+function\s+([A-Za-z0-9_$]+)/g)) names.add('default');
  // export { a, b as c }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      names.add((as[1] ?? as[0]).trim());
    }
  }
  // export * from './x'
  const stars = [...src.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)];
  exportsOf.set(file, names);
  starCache.set(file, stars);
  return { names, stars };
}

const problems = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(SRC, file);

  const importRe = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  for (const m of src.matchAll(importRe)) {
    if (m[1]) continue;                         // type-only import
    const spec = m[3];
    const target = path.resolve(path.dirname(file), spec);
    const candidates = [target + '.ts', target + '.tsx', path.join(target, 'index.ts'), path.join(target, 'index.tsx')];
    const resolved = candidates.find((c) => fs.existsSync(c));
    if (!resolved) { problems.push(`${rel}: cannot resolve '${spec}'`); continue; }

    const { names, stars } = collectExports(resolved);
    const reexportsAll = stars.some((st) => {
      const stTarget = path.resolve(path.dirname(resolved), st[1]);
      return [stTarget + '.ts', stTarget + '.tsx', path.join(stTarget, 'index.ts'), path.join(stTarget, 'index.tsx')]
        .some((c) => fs.existsSync(c));
    });

    for (const raw of m[2].split(',')) {
      const t = raw.trim().replace(/^type\s+/, '');
      if (!t) continue;
      const parts = t.split(/\s+as\s+/);
      const orig = parts[0].trim();
      if (/^[A-Za-z0-9_$]+$/.test(orig) && !names.has(orig) && !reexportsAll && !orig.startsWith('_')) {
        problems.push(`${rel}: '${orig}' is not exported by '${spec}'`);
      }
    }
  }
}

console.log('checked files :', files.length);
if (!problems.length) {
  console.log('✅ every named import resolves to a real export');
} else {
  console.log('❌ broken imports (' + problems.length + '):');
  for (const p of problems) console.log('  - ' + p);
}
process.exit(problems.length ? 1 : 0);