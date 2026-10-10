/**
 * JSX binding check — every component used as <Foo /> must actually be bound
 * (imported or declared). A missing import produces "Foo is not defined" at
 * runtime and a blank screen, while the build still succeeds.
 *
 * This is the guard for the bugs that shipped a blank dashboard:
 *   - `q` used in state.tsx without importing it
 *   - `<Link>` used in AppLayout.tsx without importing it
 *
 * Run:  node test-jsx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

// React/lucide/router symbols that are either global or come from known packages
const ALWAYS_OK = new Set(['React', 'Fragment']);

const problems = [];

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file);
  const src = fs.readFileSync(file, 'utf8');

  const bound = new Set(ALWAYS_OK);

  // named imports (any module)
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (t) bound.add(t.split(/\s+as\s+/).pop().trim());
    }
  }
  for (const m of src.matchAll(/import\s+([A-Za-z0-9_$]+)\s*(?:,|from)/g)) bound.add(m[1]);
  for (const m of src.matchAll(/import\s*\*\s*as\s+([A-Za-z0-9_$]+)/g)) bound.add(m[1]);
  // local declarations
  for (const m of src.matchAll(/(?:^|\s)(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g)) bound.add(m[1]);
  for (const m of src.matchAll(/(?:^|\s)function\s*\*?\s*([A-Za-z0-9_$]+)/g)) bound.add(m[1]);

  // collect <Component usages (capitalised plain identifiers only).
  // Skip: generics `<T ...>`, member expressions `<Ctx.Provider>`, and
  // destructured/renamed locals already covered by the bound set.
  const used = new Map();
  for (const m of src.matchAll(/<([A-Z][A-Za-z0-9_$]*)(\s[^<>]*)?>/g)) {
    const name = m[1];
    // a lone capital is a type parameter or a single-char icon alias — only flag
    // names that look like real components (length > 1 and not a known generic)
    if (name.length < 2) continue;
    if (/^(?:T|Key|E)$/.test(name) && !m[2]) continue;
    if (!used.has(name)) used.set(name, m.index);
  }

  for (const [name, idx] of used) {
    if (bound.has(name)) continue;
    // dynamic components come from local aliases like Icon/Comp — skip those
    if (/^(?:Icon|Comp|Component|Any)$/.test(name)) continue;
    // DOM element names appear in TS *type* positions (Attributes<HTMLInputElement>)
    if (/^HTML[A-Z][A-Za-z]*Element$/.test(name)) continue;
    if (/^SVG[A-Z][A-Za-z]*Element$/.test(name)) continue;
    const line = src.slice(0, idx).split('\n').length;
    problems.push(`${rel}:${line}  <${name}> is used but never imported or declared`);
  }
}

const files = walk(SRC);
console.log('checked .tsx files :', files.length);
if (!problems.length) {
  console.log('✅ every JSX component is bound');
} else {
  console.log('❌ unbound JSX components (' + problems.length + '):');
  for (const p of problems) console.log('  - ' + p);
}
process.exit(problems.length ? 1 : 0);