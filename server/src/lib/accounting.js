/* =====================================================================
 *  Server-side double-entry posting (mirrors the front-office engine)
 * ===================================================================== */
export function money(v, round = 2) {
  return Math.round((Number(v) + Number.EPSILON) * 10 ** round) / 10 ** round;
}

export function postJournal(db, { date, kind, reference, memo, lines, source_table, source_id, user_id, status = 'posted' }) {
  const clean = lines.filter((l) => (l.debit || 0) !== 0 || (l.credit || 0) !== 0);
  if (!clean.length) throw Object.assign(new Error('empty_journal'), { status: 422 });

  const debit = money(clean.reduce((t, l) => t + (l.debit || 0), 0));
  const credit = money(clean.reduce((t, l) => t + (l.credit || 0), 0));
  if (Math.abs(debit - credit) > 0.009) {
    throw Object.assign(new Error(`unbalanced_journal:Dr=${debit}:Cr=${credit}`), { status: 422, code: 'unbalanced_journal' });
  }

  const seq = db.prepare('SELECT COUNT(*) AS n FROM journals').get().n + 1;
  const journalNo = `JV-${String(seq).padStart(5, '0')}`;
  const info = db.prepare(
    `INSERT INTO journals (journal_no, entry_date, kind, reference, memo, status, source_table, source_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(journalNo, date, kind, reference ?? null, memo ?? null, status, source_table ?? null, source_id ?? null, user_id ?? null);
  const journalId = info.lastInsertRowid;

  for (const l of clean) {
    const account = db.prepare('SELECT id FROM accounts WHERE code=?').get(l.code);
    if (!account) throw Object.assign(new Error(`account_not_found:${l.code}`), { status: 422 });
    db.prepare(
      `INSERT INTO journal_lines (journal_id, account_id, partner_id, debit, credit, description)
       VALUES (?,?,?,?,?,?)`,
    ).run(journalId, account.id, l.partner_id ?? null, money(l.debit || 0), money(l.credit || 0), l.description ?? null);
  }
  return journalId;
}
