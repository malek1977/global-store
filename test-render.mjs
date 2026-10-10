/**
 * Headless render check — loads the REAL production bundle with a jsdom DOM
 * installed as globals, then asserts the app mounted actual content.
 * This catches runtime crashes that a successful build cannot.
 *
 * Run:  node test-render.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = path.resolve('dist');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e?.message ?? e)));

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const wasm = fs.readFileSync(path.join(DIST, 'sql-wasm.wasm'));

const dom = new JSDOM(html, { url: 'https://example.test/', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;

function define(key, value) {
  try { Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  catch { /* read-only global */ }
}

define('window', window);
define('document', window.document);
define('navigator', window.navigator);
define('location', window.location);
define('history', window.history);
define('localStorage', window.localStorage);
define('sessionStorage', window.sessionStorage);

const DOM_KEYS = [
  'HTMLElement', 'HTMLDivElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement',
  'HTMLAnchorElement', 'HTMLButtonElement', 'HTMLFormElement', 'HTMLSelectElement',
  'Element', 'Node', 'NodeList', 'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'InputEvent',
  'Image', 'Blob', 'File', 'FileReader', 'AbortController', 'MutationObserver',
  'IntersectionObserver', 'ResizeObserver', 'DOMParser', 'SVGElement', 'getSelection',
];
for (const k of DOM_KEYS) if (window[k]) define(k, window[k]);

define('getComputedStyle', window.getComputedStyle.bind(window));
if (window.requestAnimationFrame) define('requestAnimationFrame', window.requestAnimationFrame.bind(window));
if (window.cancelAnimationFrame) define('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
window.scrollTo = () => {};
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
}

/* ---- fetch shim: serve anything that lives inside dist/ ---- */
function resolveLocal(url) {
  const u = String(url);
  if (u.startsWith('file://')) return decodeURIComponent(u.slice('file://'.length));
  if (u.startsWith('https://') || u.startsWith('http://')) {
    try {
      const p = new URL(u).pathname;
      return path.join(DIST, decodeURIComponent(p));
    } catch { return null; }
  }
  return null;
}

const shimFetch = async (url) => {
  const u = String(url);
  if (u.endsWith('.wasm')) {
    return new Response(wasm, { status: 200, headers: { 'Content-Type': 'application/wasm' } });
  }
  const file = resolveLocal(u);
  if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const body = fs.readFileSync(file);
    const type = file.endsWith('.js') ? 'text/javascript'
      : file.endsWith('.css') ? 'text/css'
        : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    return new Response(body, { status: 200, headers: { 'Content-Type': type } });
  }
  throw new Error('fetch_not_available: ' + u);
};
define('fetch', shimFetch);
window.fetch = shimFetch;

if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto');
  define('crypto', webcrypto);
}

process.on('unhandledRejection', (r) => errors.push('unhandledRejection: ' + (r?.message ?? r)));

const entryName = (html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/) ?? [])[1];
if (!entryName) { console.log('❌ entry chunk not found in index.html'); process.exit(1); }

try {
  await import(pathToFileURL(path.join(DIST, 'assets', entryName)).href);
} catch (e) {
  console.log('❌ bundle threw during evaluation:', e?.message ?? e);
  if (errors.length) console.log(errors.slice(0, 6).join('\n'));
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 9000));

const root = window.document.getElementById('root');
const text = (root?.textContent ?? '').replace(/\s+/g, ' ').trim();
const bootErr = window.document.getElementById('gs-boot-err')?.textContent ?? '';

console.log('-----------------------------------------------');
console.log('#root children :', root?.childElementCount ?? 0);
console.log('#root text     :', text.slice(0, 320) || '(empty)');
if (bootErr) console.log('boot error     :', bootErr);
console.log('runtime errors :', errors.length ? '\n  - ' + errors.slice(0, 6).join('\n  - ') : 'none');
console.log('-----------------------------------------------');

const ok = (root?.childElementCount ?? 0) > 0 && text.length > 60;
console.log(ok ? '✅ RENDER OK — the app mounted real content' : '❌ RENDER FAILED — blank root');
process.exit(ok ? 0 : 1);