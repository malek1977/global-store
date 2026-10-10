/* =====================================================================
 *  GLOBAL STORE — Accounting engine
 *  Double-entry posting, ledgers, trial balance, P&L, balance sheet, VAT.
 *  Every business document (sale / purchase / payment / repair / expense)
 *  posts through `post()` so the ledger can never drift from operations.
 * ===================================================================== */
import { q, one, scalar, tx, getDB, type Row } from '../db/db';
import { round2 } from '../lib/format';

export type JournalLine = { code: string; debit?: number; credit?: number; partner_id?: number; description?: string };

export const ACC = {
  CASH: '1100', BANK: '1110', GATEWAY: '1120', AR: '1200', AR_CREDIT: '1210',
  INV_PHONE: '1300', INV_ACC: '1310', INV_PART: '1320',
  FIXED_WS: '1410', FIXED_FURN: '1420', DEPR: '1490',
  AP: '2100', VAT_PAY: '2200', VAT_REC: '2210', ACCR_SAL: '2300', ACCR_RENT: '2400',
  CAPITAL: '3100', DRAWINGS: '3200', RETAINED: '3300',
  REV_WHOLESALE: '4100', REV_RETAIL: '4200', REV_RETURNS: '4300', REV_REPAIR: '4400', REV_OTHER: '4900',
  COGS: '5100', COGS_PARTS: '5200',
  RENT: '6100', SALARIES: '6110', UTILITIES: '6120', TELECOM: '6130',
  MARKETING: '6140', FREIGHT: '6150', WS_SUPPLIES: '6160', GENERAL: '6170',
  OTHER_EXP: '7000',
} as const;

export function accountId(code: string): number {
  const r = one<{ id: number }>('SELECT id FROM accounts WHERE code=?', [code]);
  if (!r) throw new Error(`Account ${code} missing from chart`);
  return r.id;
}

/* ------------------------------------------------------------ posting */
export interface PostInput {
  date: string;
  kind: 'opening' | 'sale' | 'purchase' | 'payment' | 'expense' | 'repair' | 'adjust' | 'closing';
  reference?: string;
  memo?: string;
  lines: JournalLine[];
  source_table?: string;
  source_id?: number;
  user_id?: number | null;
  status?: 'draft' | 'posted';
}

/** Post a balanced journal. Throws when debits ≠ credits. */
export function post(input: PostInput): number {
  const lines = input.lines.filter((l) => (l.debit || 0) !== 0 || (l.credit || 0) !== 0);
  if (!lines.length) throw new Error('لا توجد أسطر للترحيل');
  const dr = round2(lines.reduce((t, l) => t + (l.debit || 0), 0));
  const cr = round2(lines.reduce((t, l) => t + (l.credit || 0), 0));
  if (Math.abs(dr - cr) > 0.009) throw new Error(`القيد غير متوازن: مدين ${dr} / دائن ${cr}`);

  let jid = 0;
  tx(() => {
    const db = getDB();
    const seq = scalar<number>(`SELECT COUNT(*) AS v FROM journals`) + 1;
    const no = `JV-${String(seq).padStart(5, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
    db.run(
      `INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,source_id,created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [no, input.date, input.kind, input.reference ?? null, input.memo ?? null,
       input.status ?? 'posted', input.source_table ?? null, input.source_id ?? null, input.user_id ?? null],
    );
    jid = scalar<number>('SELECT last_insert_rowid() AS v');
    lines.forEach((l, i) => {
      const a = accountId(l.code);
      db.run(
        `INSERT INTO journal_lines (journal_id,account_id,partner_id,debit,credit,description) VALUES (?,?,?,?,?,?)`,
        [jid, a, l.partner_id ?? null, round2(l.debit || 0), round2(l.credit || 0), l.description ?? null],
      );
      void i;
    });
  });
  return jid;
}

export function reverseJournal(journalId: number, userId?: number): number {
  const j = one<Row>('SELECT * FROM journals WHERE id=?', [journalId]);
  if (!j) throw new Error('القيد غير موجود');
  if (j.kind === 'opening') throw new Error('لا يمكن عكس قيد الافتتاح');
  const lines = q<Row>(
    `SELECT a.code, jl.debit, jl.credit, jl.partner_id, jl.description
     FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.journal_id=?`,
    [journalId],
  );
  return post({
    date: new Date().toISOString().slice(0, 10),
    kind: 'adjust',
    reference: `عكس ${j.journal_no}`,
    memo: `إلغاء القيد ${j.journal_no}`,
    source_table: 'journals', source_id: journalId, user_id: userId ?? null,
    lines: lines.map((l) => ({ code: l.code, debit: l.credit, credit: l.debit, partner_id: l.partner_id, description: 'عكس' })),
  });
}

/* --------------------------------------------------------- balances */
export interface BalOpts { from?: string; to?: string; asOf?: string; includeDrafts?: boolean }

export function accountBalances(o: BalOpts = {}): Record<string, { debit: number; credit: number; balance: number }> {
  const where: string[] = [];
  const params: any[] = [];
  if (o.from) { where.push('j.entry_date >= ?'); params.push(o.from); }
  if (o.to ?? o.asOf) { where.push('j.entry_date <= ?'); params.push(o.to ?? o.asOf); }
  if (!o.includeDrafts) where.push(`j.status='posted'`);
  const sql = `
    SELECT a.code AS code, a.type AS type,
           COALESCE(SUM(jl.debit),0)  AS d,
           COALESCE(SUM(jl.credit),0) AS c
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journals j ON j.id = jl.journal_id
    ${where.length ? 'WHERE ' + where.map((w) => w.replace('j.', 'j.')).join(' AND ') : ''}
    GROUP BY a.id`;
  const rows = q<Row>(sql, params);
  const out: Record<string, { debit: number; credit: number; balance: number }> = {};
  for (const r of rows) {
    const debit = round2(r.d), credit = round2(r.c);
    const sign = r.type === 'asset' || r.type === 'expense' ? 1 : -1;
    out[r.code] = { debit, credit, balance: round2(sign * (debit - credit)) };
  }
  return out;
}

export function accountBalance(code: string, o: BalOpts = {}): number {
  return accountBalances(o)[code]?.balance ?? 0;
}

/** Trial balance — debit and credit columns must match. */
export function trialBalance(from?: string, to?: string) {
  const rows = q<Row>(
    `SELECT a.code, a.name_ar, a.name_en, a.type, a.is_postable,
            COALESCE(SUM(jl.debit),0)  AS debit,
            COALESCE(SUM(jl.credit),0) AS credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id=a.id
     LEFT JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
          ${from ? 'AND j.entry_date >= ?' : ''} ${to ? 'AND j.entry_date <= ?' : ''}
     WHERE a.is_postable=1
     GROUP BY a.id
     ORDER BY a.code`,
    [...(from ? [from] : []), ...(to ? [to] : [])],
  );
  const isDebitNature = (t: string) => t === 'asset' || t === 'expense';
  const data = rows.map((r) => {
    const debit = round2(r.debit), credit = round2(r.credit);
    // "natural" = movement on the account's own side (debit for assets/expenses,
    // credit for liabilities/equity/revenue). Positive => that is the reported side.
    const natural = round2(isDebitNature(r.type) ? debit - credit : credit - debit);
    const balance = round2(isDebitNature(r.type) ? natural : -natural); // signed account balance
    return {
      ...r, debit, credit, balance,
      side: natural > 0 ? (isDebitNature(r.type) ? 'debit' : 'credit')
        : natural < 0 ? (isDebitNature(r.type) ? 'credit' : 'debit') : '',
      abs: Math.abs(natural),
    };
  });
  return {
    rows: data,
    totalDebit: round2(data.filter((x) => x.side === 'debit').reduce((t, x) => t + x.abs, 0)),
    totalCredit: round2(data.filter((x) => x.side === 'credit').reduce((t, x) => t + x.abs, 0)),
    balanced: round2(data.filter((x) => x.side === 'debit').reduce((t, x) => t + x.abs, 0)) ===
              round2(data.filter((x) => x.side === 'credit').reduce((t, x) => t + x.abs, 0)),
  };
}

/** General ledger for one account with running balance. */
export function ledger(code: string, from?: string, to?: string) {
  const aid = one<{ id: number }>('SELECT id FROM accounts WHERE code=?', [code]);
  if (!aid) return { opening: 0, rows: [], closing: 0, type: 'asset' };
  const acc = one<Row>('SELECT * FROM accounts WHERE id=?', [aid.id])!;
  const sign = acc.type === 'asset' || acc.type === 'expense' ? 1 : -1;
  const params: any[] = [aid.id];
  let where = '';
  if (from) { where += ' AND j.entry_date >= ?'; params.push(from); }
  if (to) { where += ' AND j.entry_date <= ?'; params.push(to); }
  const openingRaw = scalar<number>(
    `SELECT COALESCE(SUM(CASE WHEN j.status='posted' THEN jl.debit ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN j.status='posted' THEN jl.credit ELSE 0 END),0)
     FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id
     WHERE jl.account_id=? ${from ? "AND j.entry_date < ?" : ''}`,
    from ? [aid.id, from] : [aid.id],
  );
  let running = round2(sign * openingRaw);
  const rows = q<Row>(
    `SELECT j.id AS journal_id, j.journal_no, j.entry_date, j.kind, j.memo, j.reference, jl.description, jl.debit, jl.credit,
            p.name AS partner_name
     FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id
     LEFT JOIN partners p ON p.id=jl.partner_id
     WHERE jl.account_id=? AND j.status='posted' ${where.replace(/j\./g, 'j.')}
     ORDER BY j.entry_date ASC, j.id ASC`,
    params,
  );
  const out = rows.map((r) => {
    running = round2(running + sign * (r.debit - r.credit));
    return { ...r, debit: round2(r.debit), credit: round2(r.credit), running };
  });
  return { opening: round2(sign * openingRaw), rows: out, closing: running, type: acc.type, account: acc };
}

/** Partner sub-ledger (receivable / payable). */
export function partnerLedger(partnerId: number) {
  const rows = q<Row>(
    `SELECT so.order_no, so.placed_at AS date, so.total, so.paid, so.status, 'sale' AS kind, so.id AS ref_id
     FROM sales_orders so WHERE so.partner_id=? AND so.status<>'cancelled'
     UNION ALL
     SELECT po.order_no, po.ordered_at, po.total, po.paid, po.status, 'purchase', po.id
     FROM purchase_orders po WHERE po.partner_id=? AND po.status<>'cancelled'
     ORDER BY date ASC`,
    [partnerId, partnerId],
  );
  const pays = q<Row>(
    `SELECT COALESCE(so.order_no, po.order_no) AS ref, p.paid_at AS date, p.amount, p.direction, p.method, p.reference
     FROM payments p
     LEFT JOIN sales_orders so ON so.id=p.order_id AND p.direction='in'
     LEFT JOIN purchase_orders po ON po.id=p.order_id AND p.direction='out'
     WHERE p.partner_id=? AND (so.id IS NOT NULL OR po.id IS NOT NULL)
     ORDER BY p.paid_at ASC`,
    [partnerId],
  );
  const partner = one<Row>('SELECT * FROM partners WHERE id=?', [partnerId]);
  return { partner, invoices: rows, payments: pays, balance: partner?.balance ?? 0 };
}

/* ------------------------------------------------------- statements */
export function incomeStatement(from: string, to: string) {
  const b = accountBalances({ from, to });
  const rev = [ACC.REV_WHOLESALE, ACC.REV_RETAIL, ACC.REV_OTHER].map((c) => ({ code: c, amount: -(b[c]?.balance ?? 0) }));
  const returns = -(b[ACC.REV_RETURNS]?.balance ?? 0);
  const netRevenue = round2(rev.reduce((t, r) => t + r.amount, 0) - returns);
  const cogs = [
    { code: ACC.COGS, ar: 'تكلفة البضاعة المباعة', en: 'COGS — Products', amount: b[ACC.COGS]?.balance ?? 0 },
    { code: ACC.COGS_PARTS, ar: 'تكلفة قطع الغيار', en: 'COGS — Spare Parts', amount: b[ACC.COGS_PARTS]?.balance ?? 0 },
  ];
  const totalCogs = round2(cogs.reduce((t, c) => t + c.amount, 0));
  const gross = round2(netRevenue - totalCogs);

  const opexRows = q<Row>(
    `SELECT a.code, a.name_ar, a.name_en, COALESCE(SUM(jl.debit),0) AS amt
     FROM accounts a JOIN journal_lines jl ON jl.account_id=a.id
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     WHERE a.type='expense' AND a.code NOT IN (?,?) AND j.entry_date>=? AND j.entry_date<=?
     GROUP BY a.id ORDER BY a.code`,
    [ACC.COGS, ACC.COGS_PARTS, from, to],
  );
  const opex = opexRows.map((r) => ({ ...r, amount: round2(r.amt) }));
  const totalOpex = round2(opex.reduce((t, o) => t + o.amount, 0));

  const repairRev = -(b[ACC.REV_REPAIR]?.balance ?? 0);
  const repairInNet = repairRev;
  const ebit = round2(gross + repairInNet - totalOpex);
  const otherExp = b[ACC.OTHER_EXP]?.balance ?? 0;
  const net = round2(ebit - otherExp);

  return {
    from, to,
    revenue: rev, returns: round2(returns), repairRevenue: repairRev,
    netRevenue, cogs, totalCogs, gross, grossMarginPct: netRevenue ? round2((gross / netRevenue) * 100) : 0,
    opex, totalOpex, ebit, ebitMarginPct: netRevenue ? round2((ebit / netRevenue) * 100) : 0,
    otherExpenses: round2(otherExp), netProfit: net,
    netMarginPct: netRevenue ? round2((net / netRevenue) * 100) : 0,
  };
}

export function balanceSheet(asOf: string) {
  const b = accountBalances({ asOf });
  const asset = (c: string) => b[c]?.balance ?? 0;
  const liab = (c: string) => b[c]?.balance ?? 0;   // liabilities carry a credit-normal balance

  // input VAT (2210) holds a debit balance -> it is a receivable from the tax authority
  const currentAssets = round2(asset(ACC.CASH) + asset(ACC.BANK) + asset(ACC.GATEWAY) + asset(ACC.AR) + asset(ACC.AR_CREDIT) - liab(ACC.VAT_REC));
  const inventory = round2(asset(ACC.INV_PHONE) + asset(ACC.INV_ACC) + asset(ACC.INV_PART));
  const fixed = round2(asset(ACC.FIXED_WS) + asset(ACC.FIXED_FURN) + asset(ACC.DEPR));
  const totalAssets = round2(currentAssets + inventory + fixed);

  const currentLiab = round2(liab(ACC.AP) + liab(ACC.VAT_PAY) + liab(ACC.ACCR_SAL) + liab(ACC.ACCR_RENT));
  const totalLiab = currentLiab;

  const capital = round2(asset(ACC.CAPITAL));
  const drawings = round2(asset(ACC.DRAWINGS));
  const ytd = incomeStatement(asOf.slice(0, 4) + '-01-01', asOf);
  const equity = round2(capital + drawings + ytd.netProfit);

  return {
    asOf,
    currentAssets, inventory, fixed, totalAssets,
    currentLiab, totalLiab,
    equity: { capital, drawings, retained: ytd.netProfit, total: equity },
    totalEquity: equity,
    liabilitiesAndEquity: round2(totalLiab + equity),
    balanced: Math.abs(round2(totalAssets - (totalLiab + equity))) < 0.05,
    difference: round2(totalAssets - (totalLiab + equity)),
  };
}

/** VAT return (declaration) for a period. */
export function vatReturn(from: string, to: string) {
  const outputVat = scalar<number>(
    `SELECT COALESCE(SUM(jl.credit - jl.debit),0) AS v FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id
     WHERE a.code=? AND j.entry_date>=? AND j.entry_date<=?`, [ACC.VAT_PAY, from, to]);
  const inputVat = scalar<number>(
    `SELECT COALESCE(SUM(jl.debit - jl.credit),0) AS v FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id
     WHERE a.code=? AND j.entry_date>=? AND j.entry_date<=?`, [ACC.VAT_REC, from, to]);
  const net = round2(outputVat - inputVat);
  const salesBase = scalar<number>(
    `SELECT COALESCE(SUM(jl.credit),0) AS v FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id
     WHERE a.code IN (?,?,?,?) AND j.entry_date>=? AND j.entry_date<=?`,
    [ACC.REV_WHOLESALE, ACC.REV_RETAIL, ACC.REV_REPAIR, ACC.REV_OTHER, from, to]);
  const purchaseBase = scalar<number>(
    `SELECT COALESCE(SUM(jl.debit),0) AS v FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id
     WHERE a.code=? AND j.entry_date>=? AND j.entry_date<=?`, [ACC.INV_PHONE, from, to]);
  return {
    from, to,
    outputVat: round2(outputVat), inputVat: round2(inputVat), netPayable: net,
    salesBase: round2(salesBase), purchaseBase: round2(purchaseBase),
    direction: net >= 0 ? 'payable' : 'credit',
  };
}

/* ------------------------------------------------------- inventory */
export function inventoryValue() {
  return round2(scalar<number>(`SELECT COALESCE(SUM(qty*cost_price),0) AS v FROM products WHERE is_service=0`));
}

export function yearlySeries(year: number) {
  return q<Row>(
    `SELECT strftime('%m', entry_date) AS m,
            SUM(CASE WHEN a.type='revenue' THEN jl.credit - jl.debit ELSE 0 END) AS revenue,
            SUM(CASE WHEN a.code IN (?,?) THEN jl.debit ELSE 0 END) AS cogs,
            SUM(CASE WHEN a.type='expense' THEN jl.debit ELSE 0 END) AS expenses,
            SUM(CASE WHEN a.type='asset' AND a.code IN (?,?,?) THEN jl.debit ELSE 0 END) AS cash_in
     FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id
     WHERE j.entry_date>=? AND j.entry_date<=?
     GROUP BY m ORDER BY m`,
    [ACC.COGS, ACC.COGS_PARTS, ACC.CASH, ACC.BANK, ACC.GATEWAY, `${year}-01-01`, `${year}-12-31`],
  );
}

/* ------------------------------------------------------ fiscal year */
export function currentFY(): Row {
  return (
    one<Row>(`SELECT * FROM fiscal_years WHERE status='open' ORDER BY start DESC LIMIT 1`) ??
    one<Row>('SELECT * FROM fiscal_years ORDER BY start DESC LIMIT 1')
  );
}

export function closeFiscalYear(id: number) {
  const fy = one<Row>('SELECT * FROM fiscal_years WHERE id=?', [id]);
  if (!fy) throw new Error('السنة المالية غير موجودة');
  if (fy.status === 'closed') throw new Error('السنة مغلقة بالفعل');
  const pl = incomeStatement(fy.start, fy.end);
  tx(() => {
    const db = getDB();
    db.run(`UPDATE fiscal_years SET status='closed', closed_at=datetime('now') WHERE id=?`, [id]);
    db.run(`UPDATE accounts SET opening = opening + ? WHERE code=?`, [pl.netProfit, ACC.RETAINED]);
  });
}

export function auditTrail(limit = 200) {
  return q<Row>(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ?`, [limit]);
}
