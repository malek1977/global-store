/* =====================================================================
 *  GLOBAL STORE — i18n (ar / en) with full RTL/LTR switching
 * ===================================================================== */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';

const dict = {
  /* ---------------------------------------------------------- common */
  'app.name': ['جلوبال ستور', 'Global Store'],
  'app.tagline': ['الجوالات وإكسسوارات — جملة وتجزئة وصيانة', 'Phones & accessories — wholesale, retail & repair'],
  'nav.home': ['الرئيسية', 'Home'],
  'nav.store': ['المتجر', 'Store'],
  'nav.categories': ['الأقسام', 'Categories'],
  'nav.repair': ['الصيانة', 'Repair'],
  'nav.track': ['تتبع طلبك', 'Track order'],
  'nav.about': ['من نحن', 'About'],
  'nav.contact': ['تواصل معنا', 'Contact'],
  'nav.dashboard': ['لوحة التحكم', 'Dashboard'],
  'nav.accounting': ['النظام المحاسبي', 'Accounting'],
  'nav.admin': ['النظام الإداري', 'Administration'],
  'nav.ai': ['المساعد الذكي', 'AI Assistant'],
  'nav.login': ['تسجيل الدخول', 'Sign in'],
  'nav.logout': ['تسجيل الخروج', 'Sign out'],
  'nav.search': ['ابحث عن جوال، إكسسوار، أو صنف…', 'Search phones, accessories or parts…'],
  'nav.cart': ['السلة', 'Cart'],
  'nav.account': ['حسابي', 'My account'],
  'nav.menu': ['القائمة', 'Menu'],

  /* ------------------------------------------------------------ home */
  'hero.badge': ['الموثوق في تجارة الجوالات منذ 2009', 'Trusted in phone trade since 2009'],
  'hero.title1': ['الجملة والتجزئة', 'Wholesale & Retail'],
  'hero.title2': ['في مكان واحد', 'All in one place'],
  'hero.desc': [
    'جلوبال ستور — وجهتك الأولى لشراء وبيع وصيانة جميع أنواع الجوالات وإكسسواراتها. أسعار الجملة، ضمان معتمد، وورشة صيانة معتمدة.',
    'Global Store — your first stop to buy, sell and repair every kind of phone and accessory. Wholesale pricing, certified warranty and an approved service centre.',
  ],
  'hero.cta1': ['تصفح المنتجات', 'Browse products'],
  'hero.cta2': ['اطلب صيانة', 'Request a repair'],
  'hero.stat.products': ['صنف في الكتالوج', 'Products in catalogue'],
  'hero.stat.brands': ['علامة تجارية', 'Brands'],
  'hero.stat.tickets': ['تذكرة صيانة', 'Repair tickets'],
  'hero.stat.years': ['سنوات من الخبرة', 'Years of experience'],

  'feat.wholesale': ['أسعار جملة حقيقية', 'Real wholesale pricing'],
  'feat.wholesale.d': ['قوائم أسعار متعددة المستويات تبدأ من 10 و50 قطعة مع خصم تلقائي.', 'Tiered price lists from 10 and 50 units with automatic discount.'],
  'feat.repair': ['ورشة صيانة معتمدة', 'Certified service centre'],
  'feat.repair.d': ['فنيون متخصصون في اللوحات الأم والشاشات والبطاريات، مع ضمان على كل إصلاح.', 'Specialists in boards, screens and batteries — with warranty on every repair.'],
  'feat.warranty': ['ضمان معتمد', 'Certified warranty'],
  'feat.warranty.d': ['ضمان الوكيل على الأجهزة الجديدة، وقطع غيار أصلية بعلامة تجارية.', 'Agent warranty on new devices, genuine branded spare parts.'],
  'feat.delivery': ['شحن سريع', 'Fast delivery'],
  'feat.delivery.d': ['توصيل داخل الرياض خلال 24 ساعة، وإلى باقي المدن خلال 48 ساعة.', 'Riyadh delivery within 24h, rest of KSA within 48h.'],

  'cat.title': ['تسوّق حسب القسم', 'Shop by category'],
  'cat.sub': ['كل ما تحتاجه من جوالات وإكسسوارات وقطع غيار', 'Everything you need — phones, accessories and spare parts'],
  'cat.viewAll': ['عرض الكل', 'View all'],
  'brand.title': ['علامات تجارية عالمية', 'Global brands'],
  'prod.featured': ['منتجات مميزة', 'Featured products'],
  'prod.newest': ['وصل حديثاً', 'Just arrived'],
  'prod.bestseller': ['الأكثر مبيعاً', 'Best sellers'],
  'prod.wholesale': ['أسعار الجملة', 'Wholesale deals'],
  'prod.viewAll': ['عرض كل المنتجات', 'View all products'],
  'prod.inStock': ['متوفر', 'In stock'],
  'prod.outOfStock': ['غير متوفر', 'Out of stock'],
  'prod.lowStock': ['الكمية محدودة', 'Low stock'],
  'prod.addToCart': ['أضف للسلة', 'Add to cart'],
  'prod.buyNow': ['اشترِ الآن', 'Buy now'],
  'prod.details': ['التفاصيل', 'Details'],
  'prod.specs': ['المواصفات', 'Specifications'],
  'prod.related': ['منتجات ذات صلة', 'Related products'],
  'prod.price': ['السعر', 'Price'],
  'prod.qty': ['الكمية', 'Quantity'],
  'prod.sku': ['رمز المنتج', 'SKU'],
  'prod.brand': ['العلامة', 'Brand'],
  'prod.category': ['القسم', 'Category'],
  'prod.warranty': ['الضمان', 'Warranty'],
  'prod.condition': ['الحالة', 'Condition'],
  'prod.save': ['وفّر', 'Save'],
  'prod.compare': ['قارن', 'Compare'],
  'prod.filters': ['الفلاتر', 'Filters'],
  'prod.clear': ['مسح الفلاتر', 'Clear filters'],
  'prod.results': ['نتيجة', 'results'],
  'prod.noResults': ['لا توجد نتائج مطابقة', 'No matching results'],
  'prod.wholesaleFrom': ['سعر الجملة من', 'Wholesale from'],
  'prod.minOrder': ['الحد الأدنى للطلب', 'Minimum order'],
  'prod.sort': ['ترتيب', 'Sort'],
  'prod.sort.newest': ['الأحدث', 'Newest'],
  'prod.sort.priceAsc': ['السعر: من الأقل', 'Price: low to high'],
  'prod.sort.priceDesc': ['السعر: من الأعلى', 'Price: high to low'],
  'prod.sort.name': ['الاسم', 'Name'],
  'prod.sort.best': ['الأكثر مبيعاً', 'Best selling'],

  /* ------------------------------------------------------------ cart */
  'cart.title': ['سلة المشتريات', 'Shopping cart'],
  'cart.empty': ['سلتك فارغة', 'Your cart is empty'],
  'cart.empty.d': ['ابدأ التسوق وأضف منتجاتك المفضلة', 'Start shopping and add your favourites'],
  'cart.subtotal': ['المجموع الفرعي', 'Subtotal'],
  'cart.vat': ['ضريبة القيمة المضافة', 'VAT'],
  'cart.discount': ['الخصم', 'Discount'],
  'cart.total': ['الإجمالي', 'Total'],
  'cart.checkout': ['إتمام الشراء', 'Checkout'],
  'cart.continue': ['متابعة التسوق', 'Continue shopping'],
  'cart.remove': ['حذف', 'Remove'],
  'cart.items': ['قطعة', 'items'],
  'cart.shipping': ['الشحن', 'Shipping'],
  'cart.free': ['مجاني', 'Free'],

  /* --------------------------------------------------------- checkout */
  'checkout.title': ['إتمام الطلب', 'Checkout'],
  'checkout.contact': ['بيانات التواصل', 'Contact details'],
  'checkout.name': ['الاسم الكامل', 'Full name'],
  'checkout.phone': ['رقم الجوال', 'Mobile number'],
  'checkout.email': ['البريد الإلكتروني', 'Email'],
  'checkout.city': ['المدينة', 'City'],
  'checkout.address': ['العنوان', 'Address'],
  'checkout.payment': ['طريقة الدفع', 'Payment method'],
  'checkout.nameReq': ['الاسم مطلوب', 'Name is required'],
  'checkout.phoneReq': ['رقم جوال صحيح مطلوب (يبدأ بـ 05)', 'A valid mobile is required (starts with 05)'],
  'checkout.emailReq': ['بريد إلكتروني غير صحيح', 'Invalid email address'],
  'checkout.place': ['تأكيد الطلب', 'Place order'],
  'checkout.success': ['تم استلام طلبك بنجاح', 'Your order has been received'],
  'checkout.success.d': ['سنرسل لك رسالة تأكيد فور تجهيز الطلب.', 'We will send you a confirmation as soon as the order is prepared.'],
  'checkout.orderNo': ['رقم الطلب', 'Order number'],
  'checkout.keepShopping': ['متابعة التسوق', 'Keep shopping'],

  /* ---------------------------------------------------------- repair */
  'repair.title': ['مركز الصيانة', 'Service centre'],
  'repair.sub': ['صيانة معتمدة لجميع أنواع الجوالات — تشخيص مجاني وتقدير فوري', 'Certified repair for every phone — free diagnosis and instant estimate'],
  'repair.book': ['احجز صيانة', 'Book a repair'],
  'repair.device': ['الجهاز', 'Device'],
  'repair.brand': ['الماركة', 'Brand'],
  'repair.model': ['الموديل', 'Model'],
  'repair.imei': ['رقم IMEI (اختياري)', 'IMEI (optional)'],
  'repair.issue': ['وصف المشكلة', 'Describe the issue'],
  'repair.issuePh': ['مثال: الشاشة مكسورة واللمس لا يعمل', 'e.g. broken screen, touch not working'],
  'repair.contact': ['بيانات التواصل', 'Contact details'],
  'repair.submit': ['إرسال طلب الصيانة', 'Submit repair request'],
  'repair.success': ['تم تسجيل طلبك', 'Your request is registered'],
  'repair.success.d': ['رقم التذكرة', 'Ticket number'],
  'repair.trackPh': ['رقم التذكرة أو الجوال', 'Ticket number or mobile'],
  'repair.trackBtn': ['تتبع', 'Track'],
  'repair.status': ['الحالة', 'Status'],
  'repair.eta': ['المدة المتوقعة', 'Estimated time'],
  'repair.warranty': ['الضمان', 'Warranty'],
  'repair.cost': ['التكلفة', 'Cost'],
  'repair.noTickets': ['لا توجد تذاكر مطابقة', 'No matching tickets'],
  'repair.walkIn': ['Walk-in استقبال فوري', 'Walk-in accepted'],
  'repair.parts': ['قطع الغيار', 'Spare parts'],
  'repair.dataCare': ['حماية البيانات', 'Data protection'],
  'repair.warranty30': ['ضمان 30 يوماً', '30-day warranty'],

  'status.received': ['تم الاستلام', 'Received'],
  'status.diagnosing': ['قيد التشخيص', 'Diagnosing'],
  'status.awaiting_parts': ['بانتظار قطعة الغيار', 'Awaiting parts'],
  'status.in_progress': ['قيد الإصلاح', 'In progress'],
  'status.testing': ['قيد الاختبار', 'Testing'],
  'status.completed': ['مكتمل', 'Completed'],
  'status.delivered': ['تم التسليم', 'Delivered'],
  'status.cancelled': ['ملغي', 'Cancelled'],

  /* ----------------------------------------------------------- track */
  'track.title': ['تتبع طلبك', 'Track your order'],
  'track.ph': ['أدخل رقم الطلب أو التذكرة', 'Enter your order or ticket number'],
  'track.btn': ['تتبع الآن', 'Track now'],
  'track.notFound': ['لم نعثر على طلب مطابق', 'No matching order found'],

  /* ------------------------------------------------------------ auth */
  'auth.title': ['تسجيل الدخول', 'Sign in'],
  'auth.sub': ['الدخول إلى أنظمة جلوبال ستور', 'Access the Global Store systems'],
  'auth.user': ['اسم المستخدم', 'Username'],
  'auth.pass': ['كلمة المرور', 'Password'],
  'auth.signin': ['دخول', 'Sign in'],
  'auth.failed': ['بيانات الدخول غير صحيحة', 'Invalid credentials'],
  'auth.locked': ['تم إيقاف الحساب مؤقتاً due إلى محاولات كثيرة', 'Account temporarily locked after too many attempts'],
  'auth.demo': ['حسابات تجريبية', 'Demo accounts'],
  'auth.back': ['العودة للمتجر', 'Back to store'],
  'auth.strength': ['قوة كلمة المرور', 'Password strength'],
  'auth.weak': ['ضعيفة', 'Weak'],
  'auth.fair': ['متوسطة', 'Fair'],
  'auth.good': ['جيدة', 'Good'],
  'auth.strong': ['قوية', 'Strong'],

  /* -------------------------------------------------------- dashboard */
  'dash.title': ['نظرة عامة', 'Overview'],
  'dash.revenue': ['إجمالي الإيرادات', 'Total revenue'],
  'dash.profit': ['صافي الربح', 'Net profit'],
  'dash.orders': ['عدد الطلبات', 'Orders'],
  'dash.customers': ['العملاء', 'Customers'],
  'dash.inventory': ['قيمة المخزون', 'Inventory value'],
  'dash.ar': ['الذمم المدينة', 'Receivables'],
  'dash.ap': ['الذمم الدائنة', 'Payables'],
  'dash.cash': ['النقد المتاح', 'Cash position'],
  'dash.openTickets': ['تذاكر صيانة مفتوحة', 'Open repair tickets'],
  'dash.lowStock': ['أصناف تحت الحد', 'Items below reorder'],
  'dash.salesTrend': ['اتجاه المبيعات', 'Sales trend'],
  'dash.topProducts': ['أفضل المنتجات', 'Top products'],
  'dash.recentOrders': ['أحدث الطلبات', 'Recent orders'],
  'dash.channelMix': ['توزيع القنوات', 'Channel mix'],
  'dash.health': ['مؤشر صحة العمل', 'Business health score'],
  'dash.period': ['الفترة', 'Period'],
  'dash.today': ['اليوم', 'Today'],
  'dash.week': ['7 أيام', '7 days'],
  'dash.month': ['30 يوم', '30 days'],
  'dash.quarter': ['ربع سنة', 'Quarter'],
  'dash.year': ['السنة', 'Year'],

  /* ------------------------------------------------------- accounting */
  'acc.title': ['النظام المحاسبي', 'Accounting'],
  'acc.dashboard': ['لوحة المحاسبة', 'Accounting dashboard'],
  'acc.chart': ['شجرة الحسابات', 'Chart of accounts'],
  'acc.journals': ['دفتر اليومية', 'General journal'],
  'acc.ledger': ['دفتر الأستاذ', 'General ledger'],
  'acc.trial': ['ميزان المراجعة', 'Trial balance'],
  'acc.pl': ['قائمة الدخل', 'Income statement'],
  'acc.bs': ['الميزانية العمومية', 'Balance sheet'],
  'acc.vat': ['ضريبة القيمة المضافة', 'VAT'],
  'acc.receivables': ['الذمم المدينة', 'Receivables'],
  'acc.payables': ['الذمم الدائنة', 'Payables'],
  'acc.sales': ['فواتير البيع', 'Sales invoices'],
  'acc.purchases': ['فواتير الشراء', 'Purchase invoices'],
  'acc.payments': ['سندات القبض والصرف', 'Receipts & payments'],
  'acc.expenses': ['المصروفات', 'Expenses'],
  'acc.account': ['الحساب', 'Account'],
  'acc.code': ['الكود', 'Code'],
  'acc.debit': ['مدين', 'Debit'],
  'acc.credit': ['دائن', 'Credit'],
  'acc.balance': ['الرصيد', 'Balance'],
  'acc.total': ['الإجمالي', 'Total'],
  'acc.type': ['النوع', 'Type'],
  'acc.revenue': ['الإيرادات', 'Revenue'],
  'acc.cogs': ['تكلفة المبيعات', 'Cost of goods sold'],
  'acc.gross': ['مجمل الربح', 'Gross profit'],
  'acc.expenses': ['المصروفات التشغيلية', 'Operating expenses'],
  'acc.ebit': ['الربح قبل الفوائد', 'EBIT'],
  'acc.net': ['صافي الربح', 'Net profit'],
  'acc.assets': ['الأصول', 'Assets'],
  'acc.liabilities': ['الخصوم', 'Liabilities'],
  'acc.equity': ['حقوق الملكية', 'Equity'],
  'acc.outputVat': ['ضريبة المخرجات', 'Output VAT'],
  'acc.inputVat': ['ضريبة المدخلات', 'Input VAT'],
  'acc.netVat': ['صافي الضريبة', 'Net VAT'],
  'acc.balanced': ['متوازن', 'Balanced'],
  'acc.unbalanced': ['غير متوازن', 'Out of balance'],
  'acc.post': ['ترحيل قيد', 'Post entry'],
  'acc.newEntry': ['قيد جديد', 'New entry'],
  'acc.memo': ['البيان', 'Memo'],
  'acc.reference': ['المرجع', 'Reference'],
  'acc.date': ['التاريخ', 'Date'],
  'acc.amount': ['المبلغ', 'Amount'],
  'acc.method': ['الطريقة', 'Method'],
  'acc.cash': ['نقدي', 'Cash'],
  'acc.bank': ['تحويل بنكي', 'Bank transfer'],
  'acc.card': ['بطاقة', 'Card'],
  'acc.transfer': ['حوالة', 'Transfer'],
  'acc.cheque': ['شيك', 'Cheque'],
  'acc.unbalancedError': ['القيد يجب أن يكون متوازناً (مدين = دائن)', 'Entry must balance (debit = credit)'],

  /* ------------------------------------------------------------ admin */
  'adm.title': ['النظام الإداري', 'Administration'],
  'adm.inventory': ['المخزون', 'Inventory'],
  'adm.products': ['المنتجات', 'Products'],
  'adm.stockMove': ['حركات المخزون', 'Stock movements'],
  'adm.valuation': ['تقييم المخزون', 'Inventory valuation'],
  'adm.partners': ['العملاء والموردون', 'Customers & suppliers'],
  'adm.customers': ['العملاء', 'Customers'],
  'adm.suppliers': ['الموردون', 'Suppliers'],
  'adm.repairs': ['إدارة الصيانة', 'Repair management'],
  'adm.tickets': ['تذاكر الصيانة', 'Repair tickets'],
  'adm.technicians': ['الفنيون', 'Technicians'],
  'adm.employees': ['الموظفون', 'Employees'],
  'adm.users': ['المستخدمون والصلاحيات', 'Users & permissions'],
  'adm.roles': ['الأدوار', 'Roles'],
  'adm.new': ['إضافة', 'Add'],
  'adm.edit': ['تعديل', 'Edit'],
  'adm.delete': ['حذف', 'Delete'],
  'adm.save': ['حفظ', 'Save'],
  'adm.cancel': ['إلغاء', 'Cancel'],
  'adm.confirm': ['تأكيد', 'Confirm'],
  'adm.actions': ['إجراءات', 'Actions'],
  'adm.onHand': ['المتاح', 'On hand'],
  'adm.reorderAt': ['حد إعادة الطلب', 'Reorder at'],
  'adm.cost': ['التكلفة', 'Cost'],
  'adm.retail': ['سعر التجزئة', 'Retail price'],
  'adm.wholesale': ['سعر الجملة', 'Wholesale price'],
  'adm.adjust': ['تسوية', 'Adjust'],
  'adm.adjustStock': ['تسوية المخزون', 'Adjust stock'],
  'adm.assign': ['إسناد', 'Assign'],
  'adm.priority': ['الأولوية', 'Priority'],
  'adm.low': ['منخفضة', 'Low'],
  'adm.normal': ['عادية', 'Normal'],
  'adm.high': ['عالية', 'High'],
  'adm.urgent': ['عاجلة', 'Urgent'],
  'adm.technician': ['الفني', 'Technician'],
  'adm.eta': ['المدة المتوقعة', 'ETA'],
  'adm.confidence': ['درجة الثقة', 'Confidence'],
  'adm.risk': ['المخاطرة', 'Risk'],
  'adm.customer': ['العميل', 'Customer'],
  'adm.outstanding': ['المستحق', 'Outstanding'],
  'adm.creditLimit': ['حد الائتمان', 'Credit limit'],
  'adm.collect': ['تحصيل', 'Collect'],
  'adm.payment': ['دفعة', 'Payment'],
  'adm.newPurchase': ['أمر شراء جديد', 'New purchase order'],

  /* --------------------------------------------------------------- ai */
  'ai.title': ['المساعد الذكي', 'AI assistant'],
  'ai.sub': ['اسألني عن المبيعات والأرباح والمخزون والصيانة — بالعربية أو الإنجليزية', 'Ask me about sales, profit, inventory and repairs — in Arabic or English'],
  'ai.placeholder': ['اكتب سؤالك… مثال: كم مبيعاتنا هذا الشهر؟', 'Type your question… e.g. how much did we sell this month?'],
  'ai.send': ['إرسال', 'Send'],
  'ai.thinking': ['جارٍ التحليل…', 'Analysing…'],
  'ai.insights': ['رؤى ذكية', 'AI insights'],
  'ai.refresh': ['تحديث الرؤى', 'Refresh insights'],
  'ai.clear': ['مسح المحادثة', 'Clear chat'],
  'ai.suggestions': ['جرّب أن تسأل', 'Try asking'],
  'ai.confidence': ['مبني على بياناتك الفعلية', 'Grounded in your actual data'],
  'ai.noAnswer': ['لم أفهم — جرّب صياغة أخرى', 'Not understood — try rephrasing'],

  /* ------------------------------------------------------------- misc */
  'c.save': ['حفظ', 'Save'],
  'c.cancel': ['إلغاء', 'Cancel'],
  'c.delete': ['حذف', 'Delete'],
  'c.close': ['إغلاق', 'Close'],
  'c.search': ['بحث', 'Search'],
  'c.all': ['الكل', 'All'],
  'c.none': ['لا شيء', 'None'],
  'c.loading': ['جارٍ التحميل…', 'Loading…'],
  'c.error': ['حدث خطأ', 'An error occurred'],
  'c.success': ['تم بنجاح', 'Done successfully'],
  'c.total': ['الإجمالي', 'Total'],
  'c.date': ['التاريخ', 'Date'],
  'c.status': ['الحالة', 'Status'],
  'c.actions': ['إجراءات', 'Actions'],
  'c.from': ['من', 'From'],
  'c.to': ['إلى', 'To'],
  'c.apply': ['تطبيق', 'Apply'],
  'c.export': ['تصدير', 'Export'],
  'c.print': ['طباعة', 'Print'],
  'c.pdf': ['PDF', 'PDF'],
  'c.csv': ['CSV', 'CSV'],
  'c.back': ['رجوع', 'Back'],
  'c.yes': ['نعم', 'Yes'],
  'c.no': ['لا', 'No'],
  'c.optional': ['اختياري', 'optional'],
  'c.required': ['مطلوب', 'required'],
  'c.theme': ['المظهر', 'Theme'],
  'c.light': ['فاتح', 'Light'],
  'c.dark': ['داكن', 'Dark'],
  'c.lang': ['اللغة', 'Language'],
  'c.footer': ['جميع الحقوق محفوظة', 'All rights reserved'],
  'c.demo': ['نسخة تجريبية', 'Demo edition'],
  'c.resetData': ['إعادة تعيين البيانات', 'Reset demo data'],
  'c.exportData': ['تصدير نسخة احتياطية', 'Export backup'],
  'c.importData': ['استيراد نسخة', 'Import backup'],
} as const;

export type TKey = keyof typeof dict;

interface I18nCtx {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (k: TKey | string, vars?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  isRTL: boolean;
}

const Ctx = createContext<I18nCtx>(null as any);
export const useI18n = () => useContext(Ctx);

const LS_KEY = 'gs.lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    return (saved as Lang) || 'ar';
  });

  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem(LS_KEY, lang);
  }, [lang, dir]);

  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      dir,
      isRTL: lang === 'ar',
      setLang: (l: Lang) => setLangState(l),
      toggleLang: () => setLangState((p) => (p === 'ar' ? 'en' : 'ar')),
      t: (k, vars) => {
        const entry = (dict as any)[k];
        let s: string = Array.isArray(entry)
          ? entry[lang === 'ar' ? 0 : 1]
          : (entry ?? k);
        if (vars) for (const [kk, vv] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${kk}\\}`, 'g'), String(vv));
        return s;
      },
    }),
    [lang, dir],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Pick the localised column from an API row: name_ar / name_en. */
export function pick(row: any, base: string, lang: Lang): any {
  return row?.[`${base}_${lang}`] ?? row?.[`${base}_ar`] ?? row?.[base] ?? '';
}
