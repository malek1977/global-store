/**
 * Role-based access control.
 * The same six-role matrix used by the front office.
 */
export const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: [
    'accounting.view', 'accounting.chart',
    'admin.dashboard', 'admin.inventory.view', 'admin.inventory.write',
    'admin.partners.view', 'admin.partners.write', 'admin.purchases.view', 'admin.purchases.write',
    'admin.employees.view', 'admin.employees.write', 'repairs.view', 'repairs.write',
    'store.view', 'reports.view', 'ai.use',
  ],
  accountant: [
    'accounting.view', 'accounting.post', 'accounting.chart', 'accounting.years',
    'admin.partners.view', 'admin.purchases.view', 'admin.purchases.write',
    'store.view', 'repairs.view', 'reports.view',
  ],
  technician: ['repairs.view', 'repairs.write', 'admin.inventory.view', 'store.view'],
  sales: ['store.manage', 'admin.partners.view', 'admin.partners.write', 'repairs.view', 'repairs.write', 'ai.use'],
  viewer: ['store.view', 'accounting.view', 'reports.view'],
};

export function can(role, perm) {
  const list = ROLE_PERMISSIONS[role] ?? [];
  return list.includes('*') || list.includes(perm);
}

export function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!can(req.user.role, perm)) return res.status(403).json({ error: 'forbidden', required: perm });
    next();
  };
}
