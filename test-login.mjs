/**
 * Login flow test — boots the real production bundle, fills the sign-in form
 * with the demo credentials, submits it and asserts the dashboard renders.
 * This is the guard that caught "cannot log in with any account".
 *
 * Run:  node test-login.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = path.resolve('dist');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e?.stack ?? e?.message ?? e)));
vc.on('error', (...a) => errors.push('page console.error: ' + a.map(String).join(' ')));

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const wasm = fs.readFileSync(path.join(DIST, 'sql-wasm.wasm'));

const dom = new JSDOM(html, { url: 'https://example.test/login', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;

function define(key, value) {
  try { Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  catch { /* read-only */ }
}
define('window', window);
define('document', window.document);
define('navigator', window.navigator);
define('location', window.location);
define('history', window.history);
define('localStorage', window.localStorage);
define('sessionStorage', window.sessionStorage);

for (const k of ['HTMLElement', 'HTMLDivElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement',
  'HTMLAnchorElement', 'HTMLButtonElement', 'HTMLFormElement', 'Element', 'Node', 'NodeList',
  'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'InputEvent', 'Image', 'Blob', 'File',
  'FileReader', 'AbortController', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'DOMParser', 'SVGElement', 'getSelection']) {
  if (window[k]) define(k, window[k]);
}
define('getComputedStyle', window.getComputedStyle.bind(window));
if (window.requestAnimationFrame) define('requestAnimationFrame', window.requestAnimationFrame.bind(window));
if (window.cancelAnimationFrame) define('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
window.scrollTo = () => {};
if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

function resolveLocal(url) {
  const u = String(url);
  if (u.startsWith('file://')) return decodeURIComponent(u.slice('file://'.length));
  if (/^https?:\/\//.test(u)) { try { return path.join(DIST, decodeURIComponent(new URL(u).pathname)); } catch { return null; } }
  return null;
}
const shimFetch = async (url) => {
  const u = String(url);
  if (u.endsWith('.wasm')) return new Response(wasm, { status: 200, headers: { 'Content-Type': 'application/wasm' } });
  const f = resolveLocal(u);
  if (f && fs.existsSync(f) && fs.statSync(f).isFile()) {
    const body = fs.readFileSync(f);
    const type = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream';
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
await import(pathToFileURL(path.join(DIST, 'assets', entryName)).href);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const doc = window.document;
const txt = () => (doc.getElementById('root')?.textContent ?? '').replace(/\s+/g, ' ').trim();

// 1) wait for the login screen
let loginReady = false;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if (txt().includes('تسجيل الدخول') || txt().includes('Sign in')) { loginReady = true; break; }
}
console.log('login screen rendered :', loginReady);
if (!loginReady) {
  console.log('  text:', txt().slice(0, 200));
  console.log('  errors:', errors.slice(0, 5));
  process.exit(1);
}

// 2) fill the form (first two inputs are username + password on the login screen)
const inputs = [...doc.querySelectorAll('#root input')];
console.log('inputs found          :', inputs.length);
const userInput = inputs.find((i) => (i.placeholder ?? '') === 'admin') ?? inputs[0];
const passInput = inputs.find((i) => (i.type ?? '') === 'password') ?? inputs[1];

const setValue = (el, value) => {
  const proto = el instanceof window.HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
};
setValue(userInput, 'admin');
setValue(passInput, 'Global@2025');
await sleep(300);

// 3) submit
const form = userInput.closest('form') ?? doc.querySelector('#root form');
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
// also click the submit button for good measure
const btn = [...doc.querySelectorAll('#root button')].find((b) => /دخول|Sign in/i.test(b.textContent ?? ''));
btn?.click();
await sleep(1500);

// 4) assert we landed on the back office
let ok = false;
for (let i = 0; i < 30; i++) {
  await sleep(500);
  const t = txt();
  const onDashboard = window.location.pathname.startsWith('/app');
  const hasKpi = /نظرة عامة|Overview|إجمالي الإيرادات|Total revenue|إيرادات/.test(t);
  if (onDashboard && hasKpi) { ok = true; break; }
}

console.log('path                  :', window.location.pathname);
console.log('dashboard rendered    :', ok);
console.log('screen text (260)     :', txt().slice(0, 260) || '(empty)');
console.log('runtime errors       :', errors.length ? '\n  - ' + errors.slice(0, 5).join('\n  - ') : 'none');
console.log('-----------------------------------------------');

if (!ok) { console.log('❌ LOGIN FAILED — could not reach the dashboard'); process.exit(1); }
console.log('✅ LOGIN OK — signed in and the dashboard rendered');