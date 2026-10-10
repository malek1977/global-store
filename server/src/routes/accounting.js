/* =====================================================================
 *  Accounting — ledgers, statements, manual journal posting
 * ===================================================================== */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/core.js';
import { requirePermission } from '../lib/rbac.js';
import { audit } from '../lib/audit.js';
import { clean, period } from '../lib/http.js';
import { postJournal, money } from '../lib/accounting.js';

export const router = Router();

/* ------------------------------------------------------------ accounts */
router.get('/accounts', requirePermission('accounting.chart'), (_req, res) => {
  res.json(db.prepare(
    `SELECT a.*, COALESCE(SUM(jl.debit),0) AS debit, COALESCE(SUM(jl.credit),0) AS credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journals j ON j.id = jl.journal_id AND j.status='posted'
     GROUP BY a.id ORDER BY a.code`,
  ).all());
});

/* ------------------------------------------------------- trial balance */
router.get('/trial-balance', requirePermission('accounting.view'), (req, res) => {
  const { from, to } = period(req.query);
  const rows = db.prepare(
    `SELECT a.code, a.name_ar, a.name_en, a.type,
            COALESCE(SUM(jl.debit),0) AS debit, COALESCE(SUM(jl.credit),0) AS credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journals j ON j.id = jl.journal_id AND j.status='posted'
     WHERE a.is_postable=1 AND j.entry_date BETWEEN ? AND ?
     GROUP BY a.id ORDER BY a.code`,
  ).all(from, to);

  const isDebitNature = (t) => t === 'asset' || t === 'expense';
  let totalDebit = 0, totalCredit = 0;
  const data = rows.map((r) => {
    const debit = money(r.debit), credit = money(r.credit);
    const natural = isDebitNature(r.type) ? debit - credit : credit - debit;
    const side = natural > 0 ? (isDebitNature(r.type) ? 'debit' : 'credit')
      : natural < 0 ? (isDebitNature(r.type) ? 'credit' : 'debit') : '';
    if (side === 'debit') totalDebit += Math.abs(natural);
    if (side === 'credit') totalCredit += Math.abs(natural);
    return { ...r, debit, credit, balance: natural, side };
  });

  res.json({ from, to, rows: data, total_debit: money(totalDebit), total_credit: money(totalCredit), balanced: money(totalDebit) === money(totalCredit) });
});

/* ---------------------------------------------------- general ledger */
router.get('/ledger/:code', requirePermission('accounting.view'), (req, res) => {
  const code = clean(req.params.code, 16);
  const { from, to } = period(req.query);
  const account = db.prepare('SELECT * FROM accounts WHERE code=?').get(code);
  if (!account) return res.status(404).json({ error: 'account_not_found' });

  const rows = db.prepare(
    `SELECT j.journal_no, j.entry_date, j.kind, j.memo, j.reference,
            jl.debit, jl.credit, jl.description
     FROM journal_lines jl JOIN journals j ON j.id = jl.journal_id
     WHERE jl.account_id = ? AND j.status='posted' AND j.entry_date BETWEEN ? AND ?
     ORDER BY j.entry_date, j.id`,
  ).all(account.id, from, to);

  const sign = account.type === 'asset' || account.type === 'expense' ? 1 : -1;
  let running = 0;
  const ledger = rows.map((r) => {
    running = money(running + sign * (r.debit - r.credit));
    return { ...r, running_balance: running };
  });
  res.json({ account, from, to, rows: ledger, closing_balance: running });
});

/* ------------------------------------------------- income statement */
router.get('/income-statement', requirePermission('accounting.view'), (req, res) => {
  const { from, to } = period(req.query);
  const rows = db.prepare(
    `SELECT a.code, a.name_ar, a.name_en, a.type, COALESCE(SUM(jl.debit),0) AS debit, COALESCE(SUM(jl.credit),0) AS credit
     FROM accounts a JOIN journal_lines jl ON jl.account_id = a.id
     JOIN journals j ON j.id = jl.journal_id AND j.status='posted'
     WHERE j.entry_date BETWEEN ? AND ? GROUP BY a.id ORDER BY a.code`,
  ).all(from, to);

  const map = Object.fromEntries(rows.map((r) => [r.code, r]));
  const net = (code) => {
    const r = map[code];
    if (!r) return 0;
    return money(r.credit - r.debit);
  };
  const exp = (code) => {
    const r = map[code];
    if (!r) return 0;
    return money(r.debit - r.credit);
  };

  const revenue = money(net('4100') + net('4200') + net('4400') + net('4900') - net('4300'));
  const cogs = money(exp('5100') + exp('5200'));
  const gross = money(revenue - cogs);
  const opex = money(rows.filter((r) => r.type === 'expense' && !['5100', '5200'].includes(r.code))
    .reduce((t, r) => t + (r.debit - r.credit), 0));
  const other = money(exp('7000'));
  const netProfit = money(gross + net('4900') - opex - other);

  res.json({
    from, to, revenue, cogs, gross,
    gross_margin_pct: revenue ? money((gross / revenue) * 100) : 0,
    opex, ebit: money(gross - opex), other_expenses: other, net_profit: netProfit,
    net_margin_pct: revenue ? money((netProfit / revenue) * 100) : 0,
    lines: rows,
  });
});

/* ----------------------------------------------------- balance sheet */
router.get('/balance-sheet', requirePermission('accounting.view'), (req, res) => {
  const { to } = period(req.query);
  const b = {};
  for (const r of db.prepare(
    `SELECT a.code, a.type,
            COALESCE(SUM(jl.debit), 0)  AS d,
            COALESCE(SUM(jl.credit), 0) AS c
     FROM accounts a
     LEFT JOIN (journal_lines jl
                JOIN journals j ON j.id = jl.journal_id
                               AND j.status = 'posted'
                               AND j.entry_date <= ?) ON jl.account_id = a.id
     GROUP BY a.id`,
  ).all(to)) {
    b[r.code] = (r.type === 'asset' || r.type === 'expense') ? money(r.d - r.c) : money(r.c - r.d);
  }
  const g = (c) => b[c] ?? 0;

  // 2210 (input VAT) is typed as a liability but carries a debit balance: it is a receivable
  const currentAssets = money(g('1100') + g('1110') + g('1120') + g('1200') + g('1210') - g('2210'));
  const inventory = money(g('1300') + g('1310') + g('1320'));
  const fixed = money(g('1410') + g('1420') + g('1490'));
  const totalAssets = money(currentAssets + inventory + fixed);

  const currentLiabilities = money(g('2100') + g('2200') + g('2300') + g('2400'));
  const capital = money(g('3100') + g('3200') + g('3300'));

  const asOf = to > new Date().toISOString().slice(0, 10) ? new Date().toISOString().slice(0, 10) : to;
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const pl = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN a.type='revenue' THEN jl.credit-jl.debit ELSE 0 END),0) AS revenue,
            COALESCE(SUM(CASE WHEN a.type='expense'  THEN jl.debit-jl.credit ELSE 0 END),0) AS expense
     FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id WHERE j.entry_date BETWEEN ? AND ?`,
  ).get(yearStart, asOf);
  const profit = money(pl.revenue - pl.expense);

  const totalEquity = money(capital + profit);
  res.json({
    as_of: to, period_start: yearStart, current_assets: currentAssets, inventory, fixed_assets: fixed, total_assets: totalAssets,
    current_liabilities: currentLiabilities, total_liabilities: currentLiabilities,
    capital, retained_earnings: profit, total_equity: totalEquity,
    total_liabilities_and_equity: money(currentLiabilities + totalEquity),
    balanced: Math.abs(money(totalAssets - (currentLiabilities + totalEquity))) < 0.05,
  });
});

/* --------------------------------------------------------------- VAT */
router.get('/vat', requirePermission('accounting.view'), (req, res) => {
  const { from, to } = period(req.query);
  const get = (code) => db.prepare(
    `SELECT COALESCE(SUM(jl.debit),0) AS d, COALESCE(SUM(jl.credit),0) AS c
     FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id WHERE a.code=? AND j.entry_date BETWEEN ? AND ?`,
  ).get(code, from, to);
  const output = get('2200'), input = get('2210');
  const netPayable = money((output.c - output.d) - (input.d - input.c));
  res.json({
    from, to,
    output_vat: money(output.c - output.d),
    input_vat: money(input.d - input.c),
    net_payable: netPayable,
    direction: netPayable >= 0 ? 'payable' : 'refundable',
  });
});

/* -------------------------------------------------- manual postings */
router.post('/journals', requirePermission('accounting.post'), (req, res, next) => {
  try {
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      memo: z.string().max(400).optional(),
      reference: z.string().max(80).optional(),
      lines: z.array(z.object({
        code: z.string().min(2).max(16),
        debit: z.number().min(0).default(0),
        credit: z.number().min(0).default(0),
        description: z.string().max(200).optional(),
      })).min(2).max(50),
    });
    const input = schema.parse(req.body);
    const journalId = db.transaction(() => postJournal(db, {
      ...input, kind: 'adjust', source_table: 'journals', user_id: req.user.id,
    }))();
    audit(db, { user: req.user, action: 'POST', entity: 'journals', entityId: journalId, after: input, req });
    res.status(201).json({ data: { id: journalId } });
  } catch (e) { next(e); }
});

router.post('/journals/:id/reverse', requirePermission('accounting.post'), (req, res, next) => {
  try {
    const journalId = Number(req.params.id);
    const journal = db.prepare('SELECT * FROM journals WHERE id=?').get(journalId);
    if (!journal) return res.status(404).json({ error: 'journal_not_found' });
    if (journal.kind === 'opening') return res.status(422).json({ error: 'opening_entry_immutable' });

    const lines = db.prepare(
      `SELECT a.code, jl.debit, jl.credit, jl.description FROM journal_lines jl
       JOIN accounts a ON a.id = jl.account_id WHERE jl.journal_id = ?`,
    ).all(journalId);

    const newId = db.transaction(() => postJournal(db, {
      date: new Date().toISOString().slice(0, 10), kind: 'adjust',
      reference: `عكس ${journal.journal_no}`, memo: `إلغاء القيد ${journal.journal_no}`,
      lines: lines.map((l) => ({ code: l.code, debit: l.credit, credit: l.debit, description: 'عكس' })),
      source_table: 'journals', source_id: journalId, user_id: req.user.id,
    }))();
    audit(db, { user: req.user, action: 'REVERSE', entity: 'journals', entityId: journalId, req });
    res.json({ data: { reversal_id: newId } });
  } catch (e) { next(e); }
});
