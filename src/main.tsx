import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Safety net: the pre-hydration shell lives in index.html so the user never
 * sees a blank page. We remove it once React mounts, and if anything blows up
 * before that we surface the real error instead of a white screen.
 */
const boot = document.getElementById('gs-boot');
const bootErr = document.getElementById('gs-boot-err');

function fatal(message: string) {
  if (boot) {
    boot.style.display = 'grid';
    const p = boot.querySelector('p');
    const h = boot.querySelector('h1');
    const bar = boot.querySelector('.bar');
    if (h) h.textContent = 'تعذّر تشغيل التطبيق';
    if (p) p.textContent = 'حدث خطأ أثناء التحميل';
    if (bar) (bar as HTMLElement).style.display = 'none';
    if (bootErr) {
      bootErr.style.display = 'block';
      bootErr.textContent = message.slice(0, 220);
    }
  }
  // keep the console useful for debugging
  console.error('[global-store]', message);
}

window.addEventListener('error', (e) => {
  if (!document.querySelector('#root')?.hasChildNodes()) fatal(e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (!document.querySelector('#root')?.hasChildNodes()) fatal(String((e as PromiseRejectionEvent).reason));
});

const root = document.getElementById('root')!;
try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // give React a tick to mount, then drop the shell
  setTimeout(() => boot?.remove(), 400);
} catch (e: any) {
  fatal(e?.message ?? String(e));
}