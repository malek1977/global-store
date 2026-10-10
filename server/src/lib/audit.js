/** Immutable audit trail — every mutation is recorded with actor + context. */
export function audit(db, { user, action, entity, entityId, before, after, req }) {
  try {
    db.prepare(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, before_json, after_json, ip)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).run(
      user?.id ?? null,
      user?.username ?? null,
      action,
      entity ?? null,
      entityId ?? null,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      req?.ip ?? null,
    );
  } catch (e) {
    console.error('[audit] failed', e.message);
  }
}

export function diff(before, after) {
  if (!before || !after) return { before, after };
  const changed = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (String(before[k] ?? '') !== String(after[k] ?? '')) changed[k] = { from: before[k], to: after[k] };
  }
  return changed;
}
