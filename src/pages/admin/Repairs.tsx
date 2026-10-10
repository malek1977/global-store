/* =====================================================================
 *  Administration — repair workshop
 * ===================================================================== */
import { useState } from 'react';
import {
  Wrench, Plus, Clock, AlertTriangle, User, Cpu, CheckCircle2, Search as SearchIcon,
  Package, Sparkles, XCircle,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, one, insert, update, type Row } from '../../db/db';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select,
  StatCard, StatusPill, Tabs, Textarea, useToast, Avatar,
} from '../../ui/primitives';
import { money, num, fmtDateTime, fmtTimeAgo } from '../../lib/format';
import { workshopBoard, setStatus, assignTechnician, addPart, setCost, settleTicket, FLOW, triageTicket } from '../../ops/repairs';
import { createSale } from '../../ops/commerce';
import { RepairTimeline } from '../store/TrackOrder';

const STATUS_TONE: Record<string, string> = {
  received: 'neutral', diagnosing: 'info', awaiting_parts: 'warn',
  in_progress: 'info', testing: 'info', completed: 'good', delivered: 'good', cancelled: 'bad',
};

export default function Repairs() {
  const { t, lang } = useI18n();
  const { can, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('board');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<Row | null>(null);
  const [newTicket, setNewTicket] = useState(false);

  const wb = useQuery(() => workshopBoard(), [tab, search]);

  const tickets = useQuery(() => {
    const where: string[] = ['1=1'];
    const params: any[] = [];
    if (status) { where.push('rt.status=?'); params.push(status); }
    if (search) { where.push('(rt.ticket_no LIKE ? OR rt.customer_name LIKE ? OR rt.device_model LIKE ? OR rt.customer_phone LIKE ?)'); const l = `%${search}%`; params.push(l, l, l, l); }
    return q<Row>(
      `SELECT rt.*, te.name AS technician, u.full_name AS staff
       FROM repair_tickets rt
       LEFT JOIN technicians te ON te.id=rt.technician_id
       LEFT JOIN users u ON u.id=6
       WHERE ${where.join(' AND ')} ORDER BY rt.id DESC LIMIT 120`, params);
  }, [status, search]);

  const slaRisk = tickets.filter((x) => x.promised_at && new Date(x.promised_at.replace(' ', 'T')) < new Date() && !['delivered', 'cancelled'].includes(x.status)).length;

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={t('dash.openTickets')} value={num(wb.open, lang)} icon={<Wrench size={19} />} tone="brand" />
        <StatCard label={lang === 'ar' ? 'تجاوز الموعد' : 'SLA breached'} value={num(slaRisk, lang)} icon={<AlertTriangle size={19} />} tone={slaRisk ? 'bad' : 'good'} />
        <StatCard label={lang === 'ar' ? 'إيراد الصيانة' : 'Repair revenue'} value={money(wb.revenue, 'SAR', lang)} icon={<CheckCircle2 size={19} />} tone="good" />
        <StatCard label={lang === 'ar' ? 'متوسط قيمة التذكرة' : 'Avg ticket'} value={money(wb.avgTicket, 'SAR', lang)} icon={<Cpu size={19} />} tone="info" />
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Tabs
            tabs={[
              { id: 'board', label: lang === 'ar' ? 'لوحة الورشة' : 'Board', count: tickets.length },
              { id: 'techs', label: t('adm.technicians'), count: wb.techLoad.length },
              { id: 'analytics', label: lang === 'ar' ? 'تحليلات' : 'Analytics' },
            ]}
            value={tab} onChange={setTab} />
          {tab === 'board' && (
            <div className="ms-auto flex flex-wrap gap-2">
              <div className="w-48"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t('c.search')}…`} /></div>
              <div className="w-36">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">{t('c.all')}</option>
                  {FLOW.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                </Select>
              </div>
              {can('repairs.write') && (
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setNewTicket(true)}>{t('adm.new')}</Button>
              )}
            </div>
          )}
        </div>

        {/* -------------------------------------------------------- board */}
        {tab === 'board' && (
          tickets.length === 0 ? <EmptyState title={t('prod.noResults')} icon={<Wrench size={26} />} /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>{lang === 'ar' ? 'التذكرة' : 'Ticket'}</th>
                  <th>{lang === 'ar' ? 'الجهاز' : 'Device'}</th>
                  <th>{t('adm.customer')}</th>
                  <th>{lang === 'ar' ? 'المشكلة' : 'Issue'}</th>
                  <th>{t('c.status')}</th>
                  <th>{t('adm.technician')}</th>
                  <th className="text-end">{t('adm.eta')}</th>
                  <th className="text-end">{t('repair.cost')}</th>
                </tr></thead>
                <tbody>
                  {tickets.map((x) => {
                    const late = x.promised_at && new Date(x.promised_at.replace(' ', 'T')) < new Date() && !['delivered', 'cancelled'].includes(x.status);
                    return (
                      <tr key={x.id} className="cursor-pointer" onClick={() => setOpen(x)}>
                        <td>
                          <p className="num text-xs font-bold">{x.ticket_no}</p>
                          <p className="text-[10px] text-ink-400">{fmtTimeAgo(x.intake_at, lang)}</p>
                        </td>
                        <td className="max-w-[160px]">
                          <p className="truncate text-xs font-semibold">{x.device_brand} {x.device_model}</p>
                          {x.imei && <p className="num text-[10px] text-ink-400">{x.imei}</p>}
                        </td>
                        <td className="max-w-[140px]">
                          <p className="truncate text-xs">{x.customer_name}</p>
                          <p className="num text-[10px] text-ink-400">{x.customer_phone}</p>
                        </td>
                        <td className="max-w-[170px]"><p className="truncate text-xs">{x.issue_ar}</p></td>
                        <td>
                          <StatusPill status={x.status} lang={lang} />
                          <div className="mt-1 flex gap-1">
                            {x.priority !== 'normal' && <Badge tone={x.priority === 'urgent' ? 'bad' : 'warn'}>{t(`adm.${x.priority}`)}</Badge>}
                            {x.ai_risk === 'high' && <Badge tone="ai">AI</Badge>}
                          </div>
                        </td>
                        <td className="text-xs">{x.technician ?? <span className="text-ink-400">—</span>}</td>
                        <td className="num text-end text-xs">
                          <span className={late ? 'font-bold text-red-500' : ''}>{x.ai_eta_hours ? `${x.ai_eta_hours}h` : '—'}</span>
                        </td>
                        <td className="num text-end text-xs font-bold">{x.final_cost > 0 ? money(x.final_cost, 'SAR', lang) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* -------------------------------------------------------- techs */}
        {tab === 'techs' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wb.techLoad.map((x: any) => {
              const load = x.max_active ? Math.min(100, (x.active / x.max_active) * 100) : 0;
              return (
                <div key={x.id} className="rounded-2xl border border-ink-100 p-5 dark:border-white/10">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar name={x.name} size={42} />
                    <div>
                      <p className="font-bold">{x.name}</p>
                      <p className="text-xs text-ink-500">{x.specialty}</p>
                    </div>
                    <Badge tone="ai" className="ms-auto">★ {x.rating}</Badge>
                  </div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-ink-500">{lang === 'ar' ? 'الحمل الحالي' : 'Current load'}</span>
                    <span className="num font-bold">{x.active} / {x.max_active}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                    <div className={`h-full rounded-full ${load > 90 ? 'bg-red-500' : load > 65 ? 'bg-amber-500' : 'bg-signal-500'}`} style={{ width: `${load}%` }} />
                  </div>
                  <p className="num mt-3 text-xs text-ink-500">
                    {lang === 'ar' ? 'أنجز' : 'Produced'}: <b>{money(x.produced, 'SAR', lang)}</b>
                  </p>
                  <p className="mt-1 truncate text-[10px] text-ink-400">{x.skills}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------------------------------------------------- analytics */}
        {tab === 'analytics' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <SectionTitle title={lang === 'ar' ? 'الأكثر إصلاحاً' : 'Most repaired brands'} />
              <div className="space-y-2.5">
                {wb.byBrand.map((b: any) => {
                  const max = wb.byBrand[0]?.n ?? 1;
                  return (
                    <div key={b.brand} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 truncate text-xs font-semibold">{b.brand}</span>
                      <div className="h-6 flex-1 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/10">
                        <div className="h-full rounded-lg bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${(b.n / max) * 100}%` }} />
                      </div>
                      <span className="num w-8 shrink-0 text-end text-xs font-bold">{b.n}</span>
                      <span className="num w-20 shrink-0 text-end text-[10px] text-ink-400">{money(b.avg_cost, 'SAR', lang)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <SectionTitle title={lang === 'ar' ? 'أنواع الأعطال' : 'Issue types'} />
              <div className="space-y-2.5">
                {wb.byIssue.map((b: any) => {
                  const max = wb.byIssue[0]?.n ?? 1;
                  return (
                    <div key={b.issue} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-xs font-semibold">{b.issue}</span>
                      <div className="h-6 flex-1 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/10">
                        <div className="h-full rounded-lg bg-gradient-to-r from-ai-500 to-ai-400" style={{ width: `${(b.n / max) * 100}%` }} />
                      </div>
                      <span className="num w-8 shrink-0 text-end text-xs font-bold">{b.n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:col-span-2">
              <SectionTitle title={lang === 'ar' ? 'توزيع الحالات' : 'Status distribution'} />
              <div className="flex flex-wrap gap-3">
                {wb.statusCounts.map((s: any) => (
                  <div key={s.status} className={`rounded-xl px-4 py-3 ring-1 ${
                    s.status === 'delivered' ? 'bg-signal-500/10 ring-signal-500/25' :
                    s.status === 'cancelled' ? 'bg-red-500/10 ring-red-500/25' :
                    'bg-brand-500/10 ring-ink-500/20'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{t(`status.${s.status}`)}</p>
                    <p className="num mt-1 text-xl font-extrabold">{s.n}</p>
                    <p className="num text-[10px] text-ink-400">{money(s.value, 'SAR', lang)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <TicketDrawer ticket={open} onClose={() => setOpen(null)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
      <NewTicketModal open={newTicket} onClose={() => setNewTicket(false)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
    </div>
  );
}

/* ------------------------------------------------------- ticket detail */
function TicketDrawer({ ticket, onClose, onDone }: { ticket: Row | null; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const { can, user } = useAuth();
  const [cost, setCost] = useState('');
  const [labor, setLabor] = useState('');
  const [partLabel, setPartLabel] = useState('');
  const [partPrice, setPartPrice] = useState('');

  const techs = useQuery(() => q<Row>('SELECT * FROM technicians WHERE is_active=1'), [ticket?.id]);
  const parts = useQuery(() => q<Row>(
    `SELECT rp.*, p.sku FROM repair_parts rp LEFT JOIN products p ON p.id=rp.product_id WHERE rp.ticket_id=?`, [ticket?.id ?? 0]), [ticket?.id]);
  const history = useQuery(() => q<Row>(
    `SELECT rh.*, u.full_name AS staff FROM repair_history rh LEFT JOIN users u ON u.id=rh.user_id
     WHERE rh.ticket_id=? ORDER BY rh.id ASC`, [ticket?.id ?? 0]), [ticket?.id]);

  if (!ticket) return null;
  const editable = can('repairs.write');

  const move = (s: any) => { try { setStatus(ticket.id, s, user?.id); onDone(`${t(`status.${s}`)}`); onClose(); } catch (e: any) { onDone(String(e.message)); } };
  const saveCost = () => {
    try {
      setCost(ticket.id, { labor_cost: parseFloat(labor || String(ticket.labor_cost || 0)), final_cost: cost ? parseFloat(cost) : undefined }, user?.id);
      onDone(t('c.success')); onClose();
    } catch (e: any) { onDone(String(e.message)); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={`${ticket.ticket_no} — ${ticket.device_brand} ${ticket.device_model}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label={t('c.status')} value={<StatusPill status={ticket.status} lang={lang} />} />
          <Mini label={t('adm.priority')} value={t(`adm.${ticket.priority}`)} />
          <Mini label={t('adm.eta')} value={`${ticket.ai_eta_hours ?? '—'}h`} />
          <Mini label={t('adm.confidence')} value={`${Math.round((ticket.ai_confidence ?? 0) * 100)}%`} />
        </div>

        <RepairTimeline current={ticket.status} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-ink-50 p-4 dark:bg-white/5">
            <p className="label">{t('adm.customer')}</p>
            <p className="text-sm font-bold">{ticket.customer_name}</p>
            <p className="num text-xs text-ink-500">{ticket.customer_phone}</p>
            {ticket.customer_email && <p className="text-xs text-ink-400">{ticket.customer_email}</p>}
            <p className="num mt-2 text-xs text-ink-500">IMEI: {ticket.imei ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-ink-50 p-4 dark:bg-white/5">
            <p className="label">{lang === 'ar' ? 'المشكلة' : 'Issue'}</p>
            <p className="text-sm font-bold">{ticket.issue_ar}</p>
            {ticket.diagnosis && <p className="mt-1 text-xs text-ink-500">{ticket.diagnosis}</p>}
            {ticket.advice && <p className="mt-2 rounded-lg bg-ai-500/10 p-2 text-[11px] text-ai-700 dark:text-ai-300">💡 {ticket.advice}</p>}
          </div>
        </div>

        {/* technician */}
        <Field label={t('adm.technician')}>
          <Select value={ticket.technician_id ?? ''} disabled={!editable}
            onChange={(e) => { assignTechnician(ticket.id, e.target.value ? +e.target.value : null, user?.id); onDone(t('c.success')); }}>
            <option value="">{lang === 'ar' ? 'غير مُسند' : 'Unassigned'}</option>
            {techs.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.specialty}</option>)}
          </Select>
        </Field>

        {/* status flow */}
        <div>
          <p className="label">{lang === 'ar' ? 'تغيير الحالة' : 'Change status'}</p>
          <div className="flex flex-wrap gap-2">
            {FLOW.map((s) => (
              <button key={s} disabled={!editable || ticket.status === s} onClick={() => move(s)}
                className={`chip ${ticket.status === s ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 text-ink-600 hover:border-brand-400 disabled:opacity-40 dark:border-white/12 dark:text-ink-300'}`}>
                {t(`status.${s}`)}
              </button>
            ))}
            {editable && ticket.status !== 'cancelled' && (
              <button onClick={() => move('cancelled')} className="chip border-red-500/40 text-red-500 hover:bg-red-500/10">
                <XCircle size={13} /> {t('status.cancelled')}
              </button>
            )}
          </div>
        </div>

        {/* parts */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label !mb-0">{t('repair.parts')}</p>
            <span className="num text-xs font-bold">{money(ticket.parts_cost, 'SAR', lang)}</span>
          </div>
          <div className="space-y-1.5">
            {parts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-xs dark:bg-white/5">
                <span>{p.label}</span>
                <span className="num font-bold">{money(p.unit_price * p.qty, 'SAR', lang)}</span>
              </div>
            ))}
            {parts.length === 0 && <p className="py-2 text-center text-xs text-ink-400">{lang === 'ar' ? 'لم تُسجَّل قطع بعد' : 'No parts recorded'}</p>}
          </div>
          {editable && (
            <div className="mt-2 flex gap-2">
              <Input value={partLabel} onChange={(e) => setPartLabel(e.target.value)} placeholder={lang === 'ar' ? 'اسم القطعة' : 'Part name'} className="flex-1" />
              <Input value={partPrice} onChange={(e) => setPartPrice(e.target.value)} placeholder="0" className="w-24" dir="ltr" inputMode="decimal" />
              <Button size="sm" onClick={() => {
                if (!partLabel.trim()) return;
                addPart(ticket.id, { label: partLabel.trim(), qty: 1, unit_price: parseFloat(partPrice || '0') }, user?.id);
                setPartLabel(''); setPartPrice(''); onDone(partLabel);
              }}><Plus size={14} /></Button>
            </div>
          )}
        </div>

        {/* cost */}
        {editable && (
          <div className="rounded-xl border border-ink-100 p-4 dark:border-white/10">
            <p className="label">{t('repair.cost')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={lang === 'ar' ? 'أجور الفني' : 'Labour'}>
                <Input value={labor} onChange={(e) => setLabor(e.target.value)} defaultValue={String(ticket.labor_cost ?? 0)} dir="ltr" inputMode="decimal" />
              </Field>
              <Field label={lang === 'ar' ? 'الإجمالي النهائي' : 'Final total'}>
                <Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder={String(ticket.parts_cost + (ticket.labor_cost ?? 0))} dir="ltr" inputMode="decimal" />
              </Field>
            </div>
            <Button size="sm" className="mt-3" onClick={saveCost}>{t('adm.save')}</Button>
          </div>
        )}

        {/* history */}
        <div>
          <p className="label">{lang === 'ar' ? 'سجل الحالة' : 'Status history'}</p>
          <div className="space-y-1.5">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-[11px] dark:bg-white/5">
                <Clock size={12} className="text-ink-400" />
                <span className="font-bold">{t(`status.${h.to_status}`)}</span>
                <span className="text-ink-400">{h.staff ?? ''}</span>
                <span className="ms-auto num text-ink-400">{fmtDateTime(h.created_at, lang)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* settle */}
        {editable && ticket.status === 'completed' && (
          <Button className="w-full" onClick={() => {
            try { settleTicket(ticket.id, 'cash', user?.id); onDone(money(ticket.final_cost, 'SAR', lang)); onClose(); }
            catch (e: any) { onDone(String(e.message)); }
          }}>
            <CheckCircle2 size={16} /> {lang === 'ar' ? 'تحصيل وتسليم' : 'Settle & deliver'}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function NewTicketModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [f, setF] = useState<any>({ priority: 'normal', passcode: false });
  const techs = useQuery(() => q<Row>('SELECT * FROM technicians WHERE is_active=1'), [open]);
  const triage = f.issue?.length > 3
    ? triageTicket({ customer_name: f.name || 'x', device_model: f.model || 'x', issue_ar: f.issue, priority: f.priority, est_cost: +f.est || 0 })
    : null;

  const save = () => {
    try {
      const id = createTicket({
        customer_name: f.name, customer_phone: f.phone, customer_email: f.email || undefined,
        device_brand: f.brand || 'أخرى', device_model: f.model || '—', imei: f.imei || undefined,
        issue_ar: f.issue, priority: f.priority, technician_id: f.technician_id ? +f.technician_id : null,
        branch_id: 4, passcode_ok: f.passcode, est_cost: +f.est || 0, warranty_days: 30,
      }, user?.id);
      const tk = q<Row>('SELECT ticket_no FROM repair_tickets WHERE id=?', [id])[0];
      onDone(tk.ticket_no); onClose(); setF({ priority: 'normal', passcode: false });
    } catch (e: any) { onDone(String(e.message)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={lang === 'ar' ? 'تذكرة صيانة جديدة' : 'New repair ticket'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={save}>{t('adm.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adm.customer')} required><Input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={lang === 'ar' ? 'الجوال' : 'Mobile'}><Input value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} dir="ltr" /></Field>
        <Field label={t('repair.brand')}><Input value={f.brand ?? ''} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
        <Field label={t('repair.model')} required><Input value={f.model ?? ''} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
        <Field label={t('repair.imei')}><Input value={f.imei ?? ''} onChange={(e) => setF({ ...f, imei: e.target.value })} dir="ltr" /></Field>
        <Field label={t('adm.priority')}>
          <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            <option value="low">{t('adm.low')}</option><option value="normal">{t('adm.normal')}</option>
            <option value="high">{t('adm.high')}</option><option value="urgent">{t('adm.urgent')}</option>
          </Select>
        </Field>
        <Field label={t('adm.technician')}>
          <Select value={f.technician_id ?? ''} onChange={(e) => setF({ ...f, technician_id: e.target.value })}>
            <option value="">{lang === 'ar' ? 'غير مُسند' : 'Unassigned'}</option>
            {techs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label={lang === 'ar' ? 'التكلفة التقديرية' : 'Estimate'}>
          <Input value={f.est ?? ''} onChange={(e) => setF({ ...f, est: e.target.value })} dir="ltr" inputMode="decimal" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('repair.issue')} required>
            <Textarea value={f.issue ?? ''} onChange={(e) => setF({ ...f, issue: e.target.value })} />
          </Field>
        </div>
        {triage && (
          <div className="sm:col-span-2 rounded-xl bg-brand-500/10 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ai-700 dark:text-ai-300"><Sparkles size={13} /> AI</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-ink-500">{t('adm.eta')}</span><p className="num font-bold">{triage.etaHours}h</p></div>
              <div><span className="text-ink-500">{t('adm.confidence')}</span><p className="num font-bold">{Math.round(triage.confidence * 100)}%</p></div>
              <div><span className="text-ink-500">{t('adm.risk')}</span><p className="font-bold">{triage.risk}</p></div>
            </div>
            <p className="mt-2 text-[11px] text-ink-600 dark:text-ink-300">{triage.advice}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 text-center dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <div className="mt-1 text-sm font-extrabold">{value}</div>
    </div>
  );
}
