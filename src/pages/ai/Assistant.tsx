/* =====================================================================
 *  AI assistant — bilingual chat over the live ledger
 * ===================================================================== */
import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, Send, Trash2, RefreshCw, BarChart3, Lightbulb, AlertTriangle, Info, CheckCircle2, User, Bot,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, type Row } from '../../db/db';
import { Badge, Button, Card, EmptyState, SectionTitle, Tabs, Loading } from '../../ui/primitives';
import { money, num } from '../../lib/format';
import { ask, saveMessage, history, clearHistory, refreshInsights, insightsFeed, healthScore, restockSuggestions, profitByProduct, customerSegments, type Answer } from '../../ai/engine';
import { ChartTip } from '../admin/Dashboard';

const SESSION = 'gs-ai-session';

export default function Assistant() {
  const { t, lang, isRTL } = useI18n();
  const { can } = useAuth();
  const [tab, setTab] = useState('chat');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<{ role: 'user' | 'assistant'; content: string; answer?: Answer }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const stored = useQuery(() => history(SESSION), []);
  useEffect(() => {
    setThread(stored.map((m: any) => (m.role === 'assistant' ? { role: 'assistant' as const, content: m.content } : { role: 'user' as const, content: m.content })));
  }, [stored.length]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread.length, busy]);

  const send = (text: string) => {
    const q0 = text.trim();
    if (!q0) return;
    setMsg('');
    setBusy(true);
    saveMessage(SESSION, 'user', q0);
    setThread((s) => [...s, { role: 'user', content: q0 }]);

    // simulate retrieval latency so the "thinking" state reads naturally
    setTimeout(() => {
      const a = ask(q0);
      saveMessage(SESSION, 'assistant', lang === 'ar' ? a.text_ar : a.text_en, a.intent, { kpis: a.kpis });
      setThread((s) => [...s, { role: 'assistant', content: lang === 'ar' ? a.text_ar : a.text_en, answer: a }]);
      setBusy(false);
    }, 420);
  };

  const chips = lang === 'ar'
    ? ['إجمالي مبيعات هذا الشهر', 'ما هي المنتجات الأكثر ربحية؟', 'من هم العملاء المتأخرون؟', 'كم تبلغ قيمة المخزون؟',
       'صافي الربح آخر 90 يوم', 'أهم مخاطر العمل', 'حالة الورشة', 'إقرار ضريبة القيمة المضافة']
    : ['Total sales this month', 'Which products are most profitable?', 'Who has overdue invoices?',
       'What is the inventory value?', 'Net profit last 90 days', 'Top business risks', 'Workshop status', 'VAT return'];

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatChip icon={<Sparkles size={18} />} tone="ai" label={t('ai.title')} value={`${insightsFeed(30).length} ${lang === 'ar' ? 'رؤية' : 'insights'}`} />
        <StatChip icon={<BarChart3 size={18} />} tone="brand" label={lang === 'ar' ? 'محرك التحليل' : 'Analytics engine'} value={lang === 'ar' ? 'مباشر على الدفاتر' : 'live on the ledger'} />
        <StatChip icon={<Lightbulb size={18} />} tone="good" label={t('ai.confidence')} value={lang === 'ar' ? 'أرقام موثّقة' : 'grounded numbers'} />
        <StatChip icon={<CheckCircle2 size={18} />} tone="info" label={lang === 'ar' ? 'مؤشر الصحة' : 'Health score'} value={String(Math.round(healthScore().total))} />
      </div>

      <Tabs
        tabs={[
          { id: 'chat', label: t('ai.title') },
          { id: 'insights', label: t('ai.insights'), count: insightsFeed(30).length },
          { id: 'recommend', label: lang === 'ar' ? 'التوصيات' : 'Recommendations' },
        ]}
        value={tab} onChange={setTab} />

      {tab === 'chat' && (
        <Card className="flex min-h-[560px] flex-col p-0">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-ai-500 to-brand-500 text-white">
                <Sparkles size={19} />
              </div>
              <div>
                <p className="text-sm font-extrabold">{t('ai.title')}</p>
                <p className="text-xs text-ink-500">{t('ai.sub')}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />}
              onClick={() => { clearHistory(SESSION); setThread([]); }}>{t('ai.clear')}</Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5" style={{ maxHeight: '62vh' }}>
            {thread.length === 0 && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-ai-500/15 to-brand-500/15">
                  <Sparkles size={28} className="text-ai-500" />
                </div>
                <p className="text-sm font-bold">{t('ai.title')}</p>
                <p className="mx-auto mt-1.5 max-w-md text-xs text-ink-500">{t('ai.sub')}</p>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-ink-400">{t('ai.suggestions')}</p>
                <div className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
                  {chips.map((c) => (
                    <button key={c} onClick={() => send(c)}
                      className="chip border-ink-200 text-xs text-ink-600 hover:border-ai-400 hover:text-ai-600 dark:border-white/12 dark:text-ink-300">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {thread.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-ai-500 to-brand-500 text-white">
                    <Sparkles size={15} />
                  </div>
                )}
                <div className={`max-w-[85%] space-y-3 ${m.role === 'user' ? '' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-brand-500 text-white'
                      : 'bg-ink-50 dark:bg-white/5'}`}>
                    <Markdown text={m.content} />
                  </div>
                  {m.answer?.kpis && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {m.answer.kpis.map((k, j) => (
                        <div key={j} className="rounded-xl border border-ink-100 p-3 dark:border-white/10">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{lang === 'ar' ? k.label_ar : k.label_en}</p>
                          <p className={`num mt-1 text-base font-extrabold ${
                            k.tone === 'good' ? 'text-signal-600 dark:text-signal-400' : k.tone === 'bad' ? 'text-red-500' : ''}`}>{k.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.answer?.table && m.answer.table.rows.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-white/10">
                      <table className="tbl">
                        <thead><tr>
                          {m.answer.table.columns.map((c) => (
                            <th key={c.key}>{lang === 'ar' ? c.label_ar : c.label_en}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {m.answer.table.rows.slice(0, 8).map((r: any, j: number) => (
                            <tr key={j}>
                              {m.answer!.table!.columns.map((c, x) => (
                                <td key={c.key} className={`max-w-[220px] truncate text-xs ${x === m.answer!.table!.columns.length - 1 ? 'num text-end font-bold' : ''}`}>
                                  {typeof r[c.key] === 'number' ? num(r[c.key], lang) : String(r[c.key] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {m.answer?.chart && m.answer.chart.data.length > 1 && (
                    <div className="rounded-xl border border-ink-100 p-3 dark:border-white/10">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                        {lang === 'ar' ? m.answer.chart.title_ar : m.answer.chart.title_en}
                      </p>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={m.answer.chart.data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                            <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
                            <Tooltip content={<ChartTip currency="SAR" />} />
                            <Bar dataKey="value" fill="#7C5CFF" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {m.answer?.followups && m.answer.followups.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.answer.followups.map((f, j) => (
                        <button key={j} onClick={() => send(lang === 'ar' ? f.ar : f.en)}
                          className="chip border-ai-400/50 text-[11px] text-ai-600 hover:bg-ai-500 hover:text-white dark:text-ai-300">
                          {lang === 'ar' ? f.ar : f.en}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-200 text-ink-600 dark:bg-white/10 dark:text-ink-300">
                    <User size={15} />
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-ai-500 to-brand-500 text-white">
                  <Sparkles size={15} className="animate-pulse" />
                </div>
                <div className="rounded-2xl bg-ink-50 px-4 py-3 dark:bg-white/5">
                  <span className="inline-flex items-center gap-2 text-xs text-ink-500">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-500" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-500" style={{ animationDelay: '120ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-500" style={{ animationDelay: '240ms' }} />
                    </span>
                    {t('ai.thinking')}
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(msg); }}
            className="flex items-center gap-2 border-t border-ink-100 p-4 dark:border-white/10">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t('ai.placeholder')}
              className="input flex-1" />
            <Button type="submit" variant="ai" loading={busy} icon={<Send size={16} />}>{t('ai.send')}</Button>
          </form>
        </Card>
      )}

      {tab === 'insights' && <InsightsView onRefresh={() => refreshInsights()} />}
      {tab === 'recommend' && <RecommendView />}
    </div>
  );
}

function StatChip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const c: Record<string, string> = {
    ai: 'bg-brand-500/15 text-ai-600 dark:text-ai-300', brand: 'bg-brand-500/15 text-brand-600 dark:text-brand-400',
    good: 'bg-brand-500/15 text-signal-600 dark:text-signal-400', info: 'bg-brand-500/15 text-sky-600 dark:text-sky-300',
  };
  return (
    <div className="surface card-hover p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${c[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
          <p className="truncate text-sm font-extrabold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function InsightsView({ onRefresh }: { onRefresh: () => void }) {
  const { lang } = useI18n();
  const list = useQuery(() => insightsFeed(30), [onRefresh]);
  const icons = { risk: <AlertTriangle size={15} />, forecast: <BarChart3 size={15} />, opportunity: <Lightbulb size={15} />, anomaly: <Info size={15} />, summary: <Info size={15} /> };

  return (
    <Card>
      <SectionTitle title={t('ai.insights') || 'Insights'} sub={lang === 'ar' ? 'تحليل استباقي مبني على بياناتك' : 'Proactive analysis grounded in your data'}
        action={<Button size="sm" variant="outline" icon={<RefreshCw size={14} />} onClick={onRefresh}>{t('ai.refresh')}</Button>} />
      {list.length === 0 ? <EmptyState title={t('ai.insights')} icon={<Sparkles size={24} />}
        action={<Button size="sm" onClick={onRefresh} className="mt-2">{t('ai.refresh')}</Button>} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((i: any) => {
            const border = i.severity === 'critical' ? 'border-red-500/30 bg-red-500/[0.05]'
              : i.severity === 'warn' ? 'border-amber-500/30 bg-amber-500/[0.05]'
              : 'border-ai-500/25 bg-ai-500/[0.04]';
            return (
              <div key={i.id} className={`rounded-2xl border p-4 ${border}`}>
                <div className="mb-2 flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/60 dark:bg-white/10">
                    {icons[(i.kind as any) in icons ? i.kind : 'summary']}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug">{lang === 'ar' ? i.title_ar : i.title_en}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={i.severity === 'critical' ? 'bad' : i.severity === 'warn' ? 'warn' : 'ai'}>{i.kind}</Badge>
                      <Badge tone="neutral">{i.module}</Badge>
                      {i.metric != null && <Badge tone="neutral">{num(i.metric, lang, 1)}</Badge>}
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-600 dark:text-ink-300">{lang === 'ar' ? i.body_ar : i.body_en}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RecommendView() {
  const { t, lang } = useI18n();
  const restock = useQuery(() => restockSuggestions(), []);
  const profit = useQuery(() => profitByProduct(12), []);
  const seg = useQuery(() => customerSegments(), []);
  const [tab, setTab] = useState('restock');

  const tabs = [
    { id: 'restock', label: lang === 'ar' ? 'إعادة التخزين' : 'Reorder', count: restock.length },
    { id: 'profit', label: lang === 'ar' ? 'الربحية' : 'Profitability', count: profit.length },
    { id: 'churn', label: lang === 'ar' ? 'العملاء' : 'Customers', count: seg.rows.length },
  ];

  return (
    <Card>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'restock' && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th>{t('adm.products')}</th><th>{t('prod.brand')}</th>
              <th className="text-end">{lang === 'ar' ? 'مبيعات 60 يوم' : 'Sold 60d'}</th>
              <th className="text-end">{t('adm.onHand')}</th>
              <th className="text-end">{lang === 'ar' ? 'مدة التغطية' : 'Cover'}</th>
              <th className="text-end">{lang === 'ar' ? 'الكمية المقترحة' : 'Suggested'}</th>
              <th className="text-end">{lang === 'ar' ? 'التكلفة' : 'Cost'}</th>
            </tr></thead>
            <tbody>
              {restock.map((r: any) => (
                <tr key={r.id}>
                  <td className="max-w-[240px]"><p className="truncate text-xs font-semibold">{lang === 'ar' ? r.name_ar : r.name_en}</p>
                    <p className="num text-[10px] text-ink-400">{r.sku}</p></td>
                  <td className="text-xs">{r.brand ?? '—'}</td>
                  <td className="num text-end text-xs">{num(r.sold60, lang)}</td>
                  <td className="num text-end text-xs font-bold">{num(r.qty, lang)}</td>
                  <td className="text-end"><Badge tone={r.daysOfCover < 7 ? 'bad' : r.daysOfCover < 20 ? 'warn' : 'good'}>
                    {r.daysOfCover > 900 ? '∞' : `${r.daysOfCover}d`}</Badge></td>
                  <td className="num text-end text-xs font-bold text-brand-600 dark:text-brand-400">{num(r.suggestQty, lang)}</td>
                  <td className="num text-end text-xs">{money(r.suggestCost, 'SAR', lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'profit' && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th>{t('adm.products')}</th><th className="text-end">{lang === 'ar' ? 'مبيعات' : 'Units'}</th>
              <th className="text-end">{t('acc.total')}</th><th className="text-end">{lang === 'ar' ? 'الربح' : 'Profit'}</th>
              <th className="text-end">{lang === 'ar' ? 'الهامش' : 'Margin'}</th><th className="text-end">{t('adm.onHand')}</th>
            </tr></thead>
            <tbody>
              {profit.map((p: any) => (
                <tr key={p.sku}>
                  <td className="max-w-[260px]"><p className="truncate text-xs font-semibold">{lang === 'ar' ? p.name_ar : p.name_en}</p>
                    <p className="num text-[10px] text-ink-400">{p.sku}</p></td>
                  <td className="num text-end text-xs">{num(p.units, lang)}</td>
                  <td className="num text-end text-xs">{money(p.revenue, 'SAR', lang)}</td>
                  <td className="num text-end text-xs font-bold text-signal-600 dark:text-signal-400">{money(p.profit, 'SAR', lang)}</td>
                  <td className="text-end"><Badge tone={p.margin > 20 ? 'good' : p.margin > 10 ? 'warn' : 'bad'}>{p.margin.toFixed(1)}%</Badge></td>
                  <td className="num text-end text-xs">{num(p.stock, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'churn' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {seg.groups.map((g) => (
            <div key={g.tier} className="rounded-2xl border border-ink-100 p-4 text-center dark:border-white/10">
              <p className="num text-2xl font-extrabold">{g.count}</p>
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">{g.tier}</p>
              <p className="num mt-2 text-xs font-bold text-brand-600 dark:text-brand-400">{money(g.revenue, 'SAR', lang)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Minimal inline markdown: **bold** only. */
function Markdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <b key={i} className="font-extrabold text-brand-600 dark:text-brand-400">{p.slice(2, -2)}</b>
          : <span key={i}>{p}</span>,
      )}
    </span>
  );
}
