import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/state';
import { Loading, Button } from '../ui/primitives';
import { Link } from 'react-router-dom';

/**
 * Auth guard kept in its own module so AppLayout does NOT import App.tsx
 * (App lazily imports AppLayout — importing back would create a cycle and
 * leave some router bindings undefined at runtime).
 */
export function RequireAuth({ perm, children }: { perm?: string; children: React.ReactNode }) {
  const { user, ready, can } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (perm && !can(perm)) {
    return (
      <div className="p-10">
        <div className="surface mx-auto max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-2xl">🔒</div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">صلاحيات غير كافية</h2>
          <p className="mt-2 text-sm text-ink-500">ليس لديك صلاحية للوصول إلى هذه الصفحة.</p>
          <Link to="/app/dashboard" className="btn-primary mt-6">لوحة التحكم</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}