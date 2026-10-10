/* =====================================================================
 *  GLOBAL STORE — demo dataset
 *  Arabic + English names, realistic wholesale/retail phone trade data.
 * ===================================================================== */
import { hashPassword, randomSalt } from '../lib/security';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function arNum(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
}

/* -------------------------------------------------- chart of accounts */
const ACCOUNTS: [string, string, string, string, string, number][] = [
  // code, ar, en, type, subtype, opening
  ['1000', 'الأصول', 'Assets', 'asset', 'current', 0],
  ['1100', 'النقدية بالصندوق', 'Cash on Hand', 'asset', 'current', 18500],
  ['1110', 'البنك — الحساب الجاري', 'Bank — Current Account', 'asset', 'current', 96400],
  ['1120', 'نقدية بوابة الدفع', 'Payment Gateway Float', 'asset', 'current', 6200],
  ['1200', 'الذمم المدينة — العملاء', 'Accounts Receivable', 'asset', 'current', 0],
  ['1210', 'ذمم مدينة — آجل', 'Receivable — Credit', 'asset', 'current', 0],
  ['1300', 'المخزون — جوالات', 'Inventory — Smartphones', 'asset', 'current', 0],
  ['1310', 'المخزون — إكسسوارات', 'Inventory — Accessories', 'asset', 'current', 0],
  ['1320', 'المخزون — قطع غيار', 'Inventory — Spare Parts', 'asset', 'current', 0],
  ['1400', 'أصول ثابتة', 'Fixed Assets', 'asset', 'noncurrent', 0],
  ['1410', 'أجهزة ومعدات الورشة', 'Workshop Equipment', 'asset', 'noncurrent', 38500],
  ['1420', 'أثاث وتجهيزات', 'Furniture & Fixtures', 'asset', 'noncurrent', 12700],
  ['1490', 'مجمع إهلاك الأصول', 'Accumulated Depreciation', 'asset', 'contra', -9800],
  ['2000', 'الخصوم', 'Liabilities', 'liability', 'current', 0],
  ['2100', 'ذمم دائنة — الموردين', 'Accounts Payable', 'liability', 'current', 0],
  ['2200', 'ضريبة القيمة المضافة المستحقة', 'VAT Payable', 'liability', 'current', 0],
  ['2210', 'ضريبة المشتريات', 'VAT Receivable', 'liability', 'contra', 0],
  ['2300', 'رواتب مستحقة', 'Accrued Salaries', 'liability', 'current', 0],
  ['2400', 'إيجارات مستحقة', 'Accrued Rent', 'liability', 'current', 0],
  ['3000', 'حقوق الملكية', 'Equity', 'equity', 'capital', 0],
  ['3100', 'رأس المال', 'Capital', 'equity', 'capital', 150000],
  ['3200', 'المسحوبات', 'Drawings', 'equity', 'contra', -12000],
  ['3300', 'الأرباح المُرحَّلة', 'Retained Earnings', 'equity', 'retained', 0],
  ['4000', 'الإيرادات', 'Revenue', 'revenue', 'sales', 0],
  ['4100', 'مبيعات — جملة', 'Sales — Wholesale', 'revenue', 'sales', 0],
  ['4200', 'مبيعات — تجزئة', 'Sales — Retail', 'revenue', 'sales', 0],
  ['4300', 'مردودات المبيعات', 'Sales Returns', 'revenue', 'contra', 0],
  ['4400', 'إيرادات صيانة', 'Repair Revenue', 'revenue', 'service', 0],
  ['4900', 'إيرادات أخرى', 'Other Income', 'revenue', 'other', 0],
  ['5000', 'تكلفة المبيعات', 'Cost of Goods Sold', 'expense', 'cogs', 0],
  ['5100', 'تكلفة البضاعة المباعة', 'COGS — Products', 'expense', 'cogs', 0],
  ['5200', 'تكلفة قطع الغيار', 'COGS — Spare Parts', 'expense', 'cogs', 0],
  ['6000', 'المصروفات التشغيلية', 'Operating Expenses', 'expense', 'opex', 0],
  ['6100', 'إيجارات', 'Rent', 'expense', 'opex', 0],
  ['6110', 'رواتب وأجور', 'Salaries & Wages', 'expense', 'opex', 0],
  ['6120', 'كهرباء ومياه', 'Utilities', 'expense', 'opex', 0],
  ['6130', 'إنترنت واتصالات', 'Internet & Telecom', 'expense', 'opex', 0],
  ['6140', 'تسويق وإعلان', 'Marketing', 'expense', 'opex', 0],
  ['6150', 'نقل وشحن', 'Freight & Shipping', 'expense', 'opex', 0],
  ['6160', 'مستلزمات الورشة', 'Workshop Supplies', 'expense', 'opex', 0],
  ['6170', 'مصروفات عمومية', 'General Expenses', 'expense', 'opex', 0],
  ['7000', 'مصاريف أخرى', 'Other Expenses', 'expense', 'other', 0],
];

const CATEGORIES: [string, string, string, string][] = [
  ['smartphones', 'جوالات ذكية', 'Smartphones', 'smartphone'],
  ['feature-phones', 'جوالات بسيطة', 'Feature Phones', 'phone'],
  ['tablets', 'أجهزة لوحية', 'Tablets', 'tablet'],
  ['watches', 'ساعات ذكية', 'Smartwatches', 'watch'],
  ['audio', 'سماعات وصوتيات', 'Audio & Sound', 'headphones'],
  ['chargers', 'شواحن وطاقات', 'Chargers & Power', 'plug'],
  ['cases', 'جرابات وحماية', 'Cases & Protection', 'shield'],
  ['screens', 'شاشات ولمسات', 'Screens & Touch', 'panel'],
  ['batteries', 'بطاريات', 'Batteries', 'battery'],
  ['storage', 'ذواكر تخزين', 'Memory & Storage', 'database'],
  ['tools', 'أدوات صيانة', 'Repair Tools', 'wrench'],
  ['accessories', 'إكسسوارات متنوعة', 'Misc Accessories', 'package'],
];

const BRANDS: [string, string, string][] = [
  ['apple', 'آبل', 'Apple'], ['samsung', 'سامسونج', 'Samsung'], ['xiaomi', 'شاومي', 'Xiaomi'],
  ['huawei', 'هواوي', 'Huawei'], ['oppo', 'أوبو', 'OPPO'], ['vivo', 'فيفو', 'vivo'],
  ['realme', 'ريلمي', 'realme'], ['honor', 'أونور', 'HONOR'], ['nokia', 'نوكيا', 'Nokia'],
  ['infinix', 'إنفينيكس', 'Infinix'], ['tecno', 'تكنو', 'Tecno'], ['oneplus', 'ون بلس', 'OnePlus'],
  ['anker', 'أنكر', 'Anker'], ['jbl', 'جي بي إل', 'JBL'], ['sandisk', 'سانديسك', 'SanDisk'],
  ['baseus', 'باسوس', 'Baseus'], ['spigen', 'سبigen', 'Spigen'], ['oraimo', 'اورايمو', 'Oraimo'],
];

/** [sku, ar, en, catIdx, brandIdx, cost, retail, wholesale, qty, reorder, condition] */
type P = [string, string, string, number, number, number, number, number, number, number, string?];
const PRODUCTS: P[] = [
  ['GS-IP15-256', 'آيفون 15 برو ماكس 256 جيجا', 'iPhone 15 Pro Max 256GB', 0, 0, 4180, 4890, 4620, 14, 6],
  ['GS-IP15-128', 'آيفون 15 برو 128 جيجا', 'iPhone 15 Pro 128GB', 0, 0, 3620, 4290, 4050, 22, 8],
  ['GS-IP14-128', 'آيفون 14 128 جيجا', 'iPhone 14 128GB', 0, 0, 2980, 3490, 3290, 9, 5],
  ['GS-IP13-128', 'آيفون 13 128 جيجا', 'iPhone 13 128GB', 0, 0, 2410, 2890, 2720, 31, 10],
  ['GS-IP-SE3', 'آيفون SE الجيل الثالث', 'iPhone SE (3rd gen)', 0, 0, 1620, 1990, 1870, 6, 4],
  ['GS-SM-S24U', 'سامسونج جالكسي S24 ألترا 512', 'Samsung Galaxy S24 Ultra 512GB', 0, 1, 4380, 5190, 4890, 11, 6],
  ['GS-SM-S24', 'سامسونج جالكسي S24 بلس 256', 'Samsung Galaxy S24+ 256GB', 0, 1, 3080, 3690, 3480, 18, 8],
  ['GS-SM-A55', 'سامسونج جالكسي A55 128', 'Samsung Galaxy A55 128GB', 0, 1, 1380, 1690, 1590, 40, 15],
  ['GS-SM-A15', 'سامسونج جالكسي A15 128', 'Samsung Galaxy A15 128GB', 0, 1, 620, 799, 749, 64, 20],
  ['GS-SM-M35', 'سامسونج جالكسي M35 128', 'Samsung Galaxy M35 128GB', 0, 1, 890, 1120, 1049, 33, 12],
  ['GS-XM-14U', 'شاومي 14 ألترا 512', 'Xiaomi 14 Ultra 512GB', 0, 2, 3690, 4390, 4150, 7, 4],
  ['GS-XM-N13', 'شاومي ريدمي نوت 13 برو', 'Xiaomi Redmi Note 13 Pro', 0, 2, 890, 1150, 1079, 52, 18],
  ['GS-XM-13T', 'شاومي 13T برو 256', 'Xiaomi 13T Pro 256GB', 0, 2, 1120, 1390, 1299, 27, 10],
  ['GS-XM-R12', 'ريدمي 12 سي بلس', 'Redmi 12C Plus', 0, 2, 330, 449, 415, 88, 25],
  ['GS-HW-P60', 'هواوي P60 برو 256', 'Huawei P60 Pro 256GB', 0, 3, 2380, 2890, 2720, 8, 4],
  ['GS-HW-N12', 'هواوي نوفا 12 لايت', 'Huawei nova 12 Lite', 0, 3, 890, 1090, 1019, 21, 8],
  ['GS-OP-A78', 'أوبو A78 256', 'OPPO A78 256GB', 0, 4, 690, 869, 809, 46, 18],
  ['GS-OP-Reno11', 'أوبو رينو 11 برو', 'OPPO Reno11 Pro 256GB', 0, 4, 1180, 1450, 1359, 19, 8],
  ['GS-VI-V29', 'فيفو V29 برو', 'vivo V29 Pro 256GB', 0, 5, 1290, 1590, 1490, 15, 7],
  ['GS-VI-Y36', 'فيفو Y36 128', 'vivo Y36 128GB', 0, 5, 480, 639, 589, 57, 20],
  ['GS-RM-12P', 'ريلمي 12 برو بلس', 'realme 12 Pro+ 256GB', 0, 6, 1080, 1340, 1249, 24, 10],
  ['GS-RM-C67', 'ريلمي C67 128', 'realme C67 128GB', 0, 6, 340, 459, 425, 71, 25],
  ['GS-HN-Magic6', 'أونور ماجيك 6 برو', 'HONOR Magic6 Pro 512GB', 0, 7, 2680, 3290, 3090, 6, 3],
  ['GS-HN-X9b', 'أونور X9b', 'HONOR X9b 256GB', 0, 7, 620, 819, 759, 29, 12],
  ['GS-IP13R', 'آيفون 13 مستعمل نظيف', 'iPhone 13 — Refurbished', 0, 0, 1980, 2390, 2250, 12, 5, 'refurbished'],
  ['GS-IP12R', 'آيفون 12 مستعمل', 'iPhone 12 — Refurbished', 0, 0, 1420, 1790, 1680, 17, 6, 'refurbished'],
  ['GS-SM-S22U-U', 'جالكسي S22 ألترا مستعمل', 'Galaxy S22 Ultra — Used', 0, 1, 2180, 2590, 2420, 9, 4, 'used'],
  ['GS-NK-105', 'نوكيا 105 بدون كاميرا', 'Nokia 105 Dual Sim', 1, 8, 52, 89, 79, 210, 60],
  ['GS-NK-110', 'نوكيا 110 4G', 'Nokia 110 4G', 1, 8, 68, 119, 105, 168, 50],
  ['GS-TB-IP10', 'آيباد 10 الجيل العاشر 64', 'iPad 10th Gen 64GB', 2, 0, 1620, 1949, 1840, 12, 5],
  ['GS-TB-S9FE', 'جالكسي تاب S9 FE 128', 'Galaxy Tab S9 FE 128GB', 2, 1, 1180, 1420, 1330, 14, 6],
  ['GS-TB-M5', 'ريدمي تب 5', 'Redmi Tab 5 128GB', 2, 2, 420, 559, 519, 26, 10],
  ['GS-WT-S9-45', 'جالكسي ووتش 9 كلاسيك 45', 'Galaxy Watch9 Classic 45mm', 3, 1, 820, 1049, 979, 17, 6],
  ['GS-WT-IP-SE', 'ساعة آبل الترا 2 49', 'Apple Watch Ultra 2 49mm', 3, 0, 1980, 2340, 2190, 5, 3],
  ['GS-WT-AM-Fit3', 'ساعة أمازون فيت 3', 'Amazon Fit 3', 3, 15, 210, 289, 259, 34, 12],
  ['GS-AU-JBL-FLIP7', 'مكبر JBL فليب 7', 'JBL Flip 7 Speaker', 4, 13, 480, 629, 589, 23, 8],
  ['GS-AU-JBL-CHARGE5', 'سماعة JBL Charge 5', 'JBL Charge 5 Earbuds', 4, 13, 390, 519, 479, 29, 10],
  ['GS-AU-ANK-HD', 'سماعة أنكر ساوندكوفود', 'Anker Soundcore P30i', 4, 12, 185, 259, 229, 41, 15],
  ['GS-AU-BAS-BOOST', 'سماعة باسوس بونست سليكس', 'Baseus Boombox Slice', 4, 15, 145, 209, 185, 38, 14],
  ['GS-PW-ANK-737', 'شاحن أنكر 737 باور بانك 24000', 'Anker 737 Power Bank 24000mAh', 5, 12, 1180, 1449, 1349, 11, 5],
  ['GS-PW-ANK-20K', 'باور بانك أنكر 20000', 'Anker PowerCore 20000', 5, 12, 210, 289, 259, 48, 18],
  ['GS-PW-BAS-30W', 'شاحن باسوس 30 واط', 'Baseus GaN Charger 30W', 5, 15, 95, 139, 125, 72, 25],
  ['GS-PW-SAM-45W', 'شاحن سامسونج 45 واط', 'Samsung 45W Super Fast Charger', 5, 1, 88, 129, 119, 64, 22],
  ['GS-PW-CAR-36', 'شاحن سيارة سريع 36 وات', 'Car Charger 36W PD+QC', 5, 17, 62, 99, 85, 55, 20],
  ['GS-PW-CBL-TC100', 'كابل أنكر Type-C 100 واط', 'Anker USB-C Cable 100W 2m', 5, 12, 55, 89, 75, 130, 40],
  ['GS-PW-SOL-20K', 'باور بانك شمسي 20000', 'Solar Power Bank 20000mAh', 5, 17, 130, 189, 165, 26, 10],
  ['GS-CS-IP15-CLR', 'جراب آيفون 15 برو ماكس شفاف', 'iPhone 15 Pro Max Clear Case', 6, 0, 32, 65, 52, 190, 60],
  ['GS-CS-IP15-MAG', 'جراب آيفون ماج سيف مقاوم للصدمات', 'iPhone 15 MagSafe Shockproof Case', 6, 0, 48, 95, 79, 142, 45],
  ['GS-CS-S24-CLR', 'جراب جالكسي S24 شفاف', 'Galaxy S24 Clear Case', 6, 1, 28, 55, 45, 165, 50],
  ['GS-CS-SPK-GLS', 'جراب سبجين جالكسي S24 زجاج', 'Spigen GlasTRust Galaxy S24', 6, 16, 78, 129, 109, 96, 30],
  ['GS-CS-IP15-FILM', 'حماية شاشة آيفون 15 برو ماكس', 'iPhone 15 Pro Max Screen Film', 6, 0, 22, 49, 38, 240, 70],
  ['GS-CS-SAM-BND', 'حزام يد سامسونج', 'Samsung Wrist Strap', 6, 1, 34, 69, 55, 88, 30],
  ['GS-SC-IP15', 'شاشة آيفون 15 برو ماكس أصلية', 'iPhone 15 Pro Max OLED Original', 7, 0, 1120, 1590, 1490, 13, 6],
  ['GS-SC-IP13', 'شاشة آيفون 13 أصلية', 'iPhone 13 OLED Original', 7, 0, 780, 1090, 999, 21, 8],
  ['GS-SC-S24', 'شاشة جالكسي S24 أوليد', 'Galaxy S24 OLED Display', 7, 1, 690, 949, 879, 16, 7],
  ['GS-SC-SAM-A55', 'شاشة جالكسي A55', 'Galaxy A55 Display', 7, 1, 260, 389, 335, 34, 12],
  ['GS-SC-IP12X', 'شاشة آيفون 12 إكس', 'iPhone 12 X Display', 7, 0, 640, 899, 829, 11, 5],
  ['GS-BT-IP15', 'بطارية آيفون 15 برو ماكس', 'iPhone 15 Pro Max Battery', 8, 0, 380, 549, 485, 18, 8],
  ['GS-BT-SAM-5000', 'بطارية سامسونج 5000 مللي', 'Samsung EB-A5000 5000mAh', 8, 1, 95, 159, 135, 52, 20],
  ['GS-BT-XM-5000', 'بطارية شاومي 5000 مللي', 'Xiaomi BN3S 5000mAh', 8, 2, 68, 119, 99, 61, 22],
  ['GS-BT-ORA-5000', 'بطارية أوراimo 5000', 'Oraimo 5000mAh Battery', 8, 17, 55, 95, 79, 44, 18],
  ['GS-ST-SD-128', 'ذاكرة سانديسك ميكرو SD 128 جيجا', 'SanDisk microSD 128GB', 9, 14, 62, 99, 85, 145, 45],
  ['GS-ST-SD-256', 'ذاكرة سانديسك ميكرو SD 256 جيجا', 'SanDisk microSD 256GB', 9, 14, 98, 149, 129, 92, 35],
  ['GS-ST-OTG-128', 'فلاشة يوتيب 128 جيجا', 'USB Flash Drive 128GB', 9, 15, 72, 119, 99, 78, 30],
  ['GS-ST-SSD-1T', 'هارد SSD داخلي 1 تيرابايت', 'Internal SSD 1TB NVMe', 9, 15, 420, 599, 545, 26, 10],
  ['GS-ST-SAND-256', 'ذاكرة متنقلة سانديسك 256', 'SanDisk Extreme 256GB', 9, 14, 190, 279, 245, 31, 12],
  ['GS-TL-SUCT-38', 'عدّة لحام станس إضافية 38', 'Soldering Station S-260', 10, 15, 145, 239, 199, 18, 6],
  ['GS-TL-SCREW-KIT', 'عدّة مفاتيحPrecision 115 قطعة', 'Precision Screwdriver Set 115-in-1', 10, 15, 88, 149, 125, 26, 10],
  ['GS-TL-SEP-02', 'شيفطة سحب مفاتيح', 'Separator Opening Tool 02', 10, 15, 32, 69, 55, 64, 20],
  ['GS-TL-BATP', 'بطارية متنقلةRepair 2000', 'Repair Power Supply Bench 2000A', 10, 15, 320, 469, 419, 9, 4],
  ['GS-TL-HEAT', 'لوحة تسخين مقاوم 220', 'Heating Platform 220V', 10, 15, 96, 169, 139, 15, 6],
  ['GS-AC-MOB-CH', 'حامل موبايل مغناطيسي لاسلكي', 'Wireless Magnetic Car Mount', 11, 12, 68, 129, 105, 68, 25],
  ['GS-AC-MOB-ARM', 'ذراع تثبيت موبايل مكتب', 'Desktop Phone Holder Arm', 11, 17, 42, 85, 69, 82, 30],
  ['GS-AC-STND-SLV', 'حامل موبايل ألومنيوم فضي', 'Aluminium Phone Stand Silver', 11, 15, 55, 99, 82, 47, 18],
  ['GS-AC-SIM-EJE', 'إبرة إخراج شرائح', 'SIM Ejector Tool', 11, 15, 4, 15, 10, 300, 80],
  ['GS-SV-PLANTC', 'باقة حماية بدون planetary', 'Device Protection Plan', 11, 0, 0, 149, 119, 0, 0, 'service'],
  ['GS-SV-EXTW', 'ضمان ممتد سنة إضافية', 'Extended Warranty +1 Year', 11, 0, 0, 129, 99, 0, 0, 'service'],
];

const PARTNERS: [string, string, string, string, string, number, number, number][] = [
  // code, name, kind, phone, city, creditLimit, openingBalance, terms
  ['C-1001', 'مؤسسة النور للتجارة', 'customer', '0555100101', 'الرياض', 50000, 0, 30],
  ['C-1002', 'شركة الأفق للاتصالات', 'customer', '0555100102', 'جدة', 120000, 18500, 45],
  ['C-1003', 'متجر فون تك', 'customer', '0555100103', 'الدمام', 25000, 0, 14],
  ['C-1004', 'مؤسسة الرواد التجارية', 'customer', '0555100104', 'الخبر', 80000, 0, 30],
  ['C-1005', 'أبو خالد للتجارة', 'customer', '0555100105', 'مكة', 15000, 3200, 0],
  ['C-1006', 'مركز بلس الكترونيات', 'customer', '0555100106', 'المدينة', 35000, 0, 21],
  ['C-1007', 'شركة الوصلات الحديثة', 'customer', '0555100107', 'الدمام', 200000, 42000, 60],
  ['C-1008', 'متجر أونلاين', 'customer', '0555100108', 'الرياض', 10000, 0, 0],
  ['C-1009', 'مؤسسة التقوى', 'customer', '0555100109', 'بريدة', 60000, 0, 30],
  ['C-1010', 'متجر الجوال الحديث', 'customer', '0555100110', 'تبوك', 30000, 8900, 21],
  ['C-1011', 'عميل نقدي — محل الحي', 'customer', '0555100111', 'الرياض', 5000, 0, 0],
  ['C-1012', 'شركة الإمداد كدا', 'customer', '0555100112', 'جدة', 95000, 0, 30],
  ['S-2001', 'شركة التوزيع العالمية', 'supplier', '0544100201', 'الرياض', 0, -38000, 30],
  ['S-2002', 'مؤسسة الإمداد كلس', 'supplier', '0544100202', 'دبي', 0, -22000, 45],
  ['S-2003', 'وكيل سامسونج السعودية', 'supplier', '0544100203', 'الرياض', 0, -19100, 60],
  ['S-2004', 'مستورد الجوالات المستعملة', 'supplier', '0544100204', 'جدة', 0, -12000, 15],
  ['S-2005', 'مورّد قطع الغيار الأصلي', 'supplier', '0544100205', 'الخبر', 0, -6000, 30],
];

const USERS: [string, string, string, string, number][] = [
  ['admin', 'مالك النظام', 'admin', 'admin@globalstore.sa', 1],
  ['accountant', 'منى الحربي', 'accountant', 'accounts@globalstore.sa', 1],
  ['manager', 'أحمد الشمري', 'manager', 'ops@globalstore.sa', 1],
  ['tech1', 'فهد العتيبي', 'technician', 'tech1@globalstore.sa', 2],
  ['sales1', 'سارة القحطاني', 'sales', 'sales@globalstore.sa', 1],
  ['viewer', 'مشاهد', 'viewer', 'viewer@globalstore.sa', 1],
];

const DEV_PASSWORD = 'Global@2025';

function iso(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function isoD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number, hour = 11): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, (n * 17) % 60, 0, 0);
  return d;
}

/* deterministic pseudo-random so demo numbers are stable */
let s = 20250210;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length) % a.length];
const ri = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

export async function buildSeed(db: any): Promise<void> {
  const R2 = (n: number) => Math.round(n * 100) / 100;

  db.run(
    `INSERT INTO company (id,name_ar,name_en,tagline_ar,tagline_en,vat_number,cr_number,address_ar,address_en,phone,email,currency,vat_rate,fiscal_start)
     VALUES (1,'جلوبال ستور','Global Store','الجوالات وإكسسوارات — جملة وتجزئة وصيانة','Phones & Accessories — Wholesale, Retail & Repair','310123456700003','1010123456',
             'طريق الملك فهد، حي العليا، الرياض','King Fahd Rd, Al Olaya, Riyadh','+966 55 510 0000','info@globalstore.sa','SAR',0.15,'01-01')`,
  );
  db.run(`INSERT INTO app_meta (key,value) VALUES ('version','1.0.0'),('seeded_at',datetime('now')),('base_currency','SAR')`);

  /* fiscal years */
  const y0 = new Date().getFullYear();
  db.run(`INSERT INTO fiscal_years (name,start,end,status) VALUES (?,?,?,'open')`,
    [`${y0}`, `${y0}-01-01`, `${y0}-12-31`]);
  db.run(`INSERT INTO fiscal_years (name,start,end,status) VALUES (?,?,?,'closed')`,
    [`${y0 - 1}`, `${y0 - 1}-01-01`, `${y0 - 1}-12-31`]);

  /* branches + warehouses */
  const branches = [
    ['HQ', 'المعرض الرئيسي — الرياض', 'Main Showroom — Riyadh', 'retail', 'الرياض'],
    ['JED', 'فرع جدة', 'Jeddah Branch', 'retail', 'جدة'],
    ['WH', 'مستودع الجملة', 'Wholesale Warehouse', 'wholesale', 'الرياض'],
    ['RP', 'مركز الصيانة', 'Service Center', 'repair', 'الرياض'],
  ];
  branches.forEach((b, i) =>
    db.run(`INSERT INTO branches (code,name_ar,name_en,kind,city,phone,address,is_active) VALUES (?,?,?,?,?,?,?,1)`,
      [b[0], b[1], b[2], b[3], b[4], '+966 55 510 00' + i, b[1]]),
  );
  const warehouses = [
    ['WH-MAIN', 'المستودع الرئيسي', 'Main Warehouse', 'main', 'الرياض'],
    ['WH-SHOW', 'مخزن المعرض', 'Showroom Stock', 'branch', 'الرياض'],
    ['WH-JED', 'مخزن جدة', 'Jeddah Stock', 'branch', 'جدة'],
    ['WH-RPR', 'مخزن قطع الغيار', 'Repair Parts Store', 'repair', 'الرياض'],
  ];
  warehouses.forEach((w) =>
    db.run(`INSERT INTO warehouses (code,name_ar,name_en,kind,location,is_active) VALUES (?,?,?,?,?,1)`, w as any),
  );

  /* permissions + role map */
  const PERMS: [string, string, string, string][] = [
    ['store.view', 'store', 'تصفح المتجر', 'Browse storefront'],
    ['store.manage', 'store', 'إدارة الطلبات', 'Manage orders'],
    ['accounting.view', 'accounting', 'عرض الحسابات', 'View accounting'],
    ['accounting.post', 'accounting', 'ترحيل القيود', 'Post entries'],
    ['accounting.chart', 'accounting', 'شجرة الحسابات', 'Chart of accounts'],
    ['accounting.years', 'accounting', 'السنوات المالية', 'Fiscal years'],
    ['admin.dashboard', 'admin', 'لوحة التحكم', 'Dashboard'],
    ['admin.inventory.view', 'admin', 'عرض المخزون', 'View inventory'],
    ['admin.inventory.write', 'admin', 'تعديل المخزون', 'Adjust inventory'],
    ['admin.partners.view', 'admin', 'العملاء والموردون', 'Partners'],
    ['admin.partners.write', 'admin', 'تعديل العملاء', 'Edit partners'],
    ['admin.purchases.view', 'admin', 'عرض المشتريات', 'View purchases'],
    ['admin.purchases.write', 'admin', 'إنشاء المشتريات', 'Create purchases'],
    ['admin.employees.view', 'admin', 'عرض الموظفين', 'View employees'],
    ['admin.employees.write', 'admin', 'إدارة الموظفين', 'Manage employees'],
    ['repairs.view', 'admin', 'عرض الصيانة', 'View repairs'],
    ['repairs.write', 'admin', 'إدارة الصيانة', 'Manage repairs'],
    ['reports.view', 'accounting', 'التقارير', 'Reports'],
    ['ai.use', 'admin', 'المساعد الذكي', 'AI assistant'],
  ];
  PERMS.forEach((p) => db.run(`INSERT INTO permissions (code,module,label_ar,label_en) VALUES (?,?,?,?)`, p as any));
  const ROLE_MAP: Record<string, string[]> = {
    admin: PERMS.map((p) => p[0]),
    accountant: ['accounting.view', 'accounting.post', 'accounting.chart', 'accounting.years', 'admin.partners.view', 'admin.purchases.view', 'admin.purchases.write', 'store.view', 'repairs.view', 'reports.view'],
    manager: ['accounting.view', 'accounting.chart', 'admin.dashboard', 'admin.inventory.view', 'admin.inventory.write', 'admin.partners.view', 'admin.partners.write', 'admin.purchases.view', 'admin.purchases.write', 'admin.employees.view', 'admin.employees.write', 'repairs.view', 'repairs.write', 'store.view', 'reports.view', 'ai.use'],
    technician: ['repairs.view', 'repairs.write', 'admin.inventory.view', 'store.view'],
    sales: ['store.manage', 'admin.partners.view', 'admin.partners.write', 'repairs.view', 'repairs.write', 'ai.use'],
    viewer: ['store.view', 'accounting.view', 'reports.view'],
  };
  Object.entries(ROLE_MAP).forEach(([role, list]) =>
    list.forEach((c) => db.run(`INSERT INTO role_permissions (role,permission_code) VALUES (?,?)`, [role, c])),
  );

  /* users (PBKDF2 hashed at seed time) */
  for (const [username, full, role, email, branch] of USERS) {
    const salt = randomSalt();
    const h = await hashPassword(DEV_PASSWORD, salt);
    db.run(
      `INSERT INTO users (username,full_name,email,phone,role,branch_id,pass_hash,pass_salt,status,mfa_enabled,last_login_at)
       VALUES (?,?,?,?,?,?,?,?,'active',?,?)`,
      [username, full, email, '0555' + ri(100000, 999999), role, branch, h, salt, username === 'admin' ? 1 : 0,
       iso(daysAgo(ri(0, 3)))],
    );
  }

  /* employees + technicians */
  db.run(`INSERT INTO technicians (user_id,name,specialty,skills,max_active,rating) VALUES (4,'فهد العتيبي','لوحات أم','Micro-soldering,BGA,Screen,Water damage',6,4.8)`);
  db.run(`INSERT INTO technicians (user_id,name,specialty,skills,max_active,rating) VALUES (NULL,'ماجد الزهراني','برمجيات','iOS,Android,Frp,Bypass,Data recovery',5,4.6)`);
  db.run(`INSERT INTO technicians (user_id,name,specialty,skills,max_active,rating) VALUES (NULL,'سامي خالد','قطع غيار','Disassembly,Screen replacement,Battery',7,4.4)`);
  const staff: [string, string, string, number, number, string][] = [
    ['EMP-001', 'أحمد الشمري', 'الإدارة', 'مدير فرع', 1, '2021-03-15'],
    ['EMP-002', 'منى الحربي', 'المحاسبة', 'محاسب رئيسي', 1, '2021-07-01'],
    ['EMP-003', 'سارة القحطاني', 'المبيعات', 'مسؤول مبيعات', 1, '2022-02-20'],
    ['EMP-004', 'خالد المطيري', 'المبيعات', 'مندوب مبيعات جملة', 3, '2022-09-10'],
    ['EMP-005', 'نورة الدوسري', 'خدمة العملاء', 'موظف خدمة عملاء', 1, '2023-01-05'],
    ['EMP-006', 'يوسف إبراهيم', 'الورشة', 'فني صيانة أول', 2, '2022-05-11'],
    ['EMP-007', 'ريم السالم', 'المحاسبة', 'مساعد محاسب', 1, '2023-06-01'],
  ];
  staff.forEach((e) =>
    db.run(`INSERT INTO employees (code,full_name,department,job_title,branch_id,salary,hire_date,status) VALUES (?,?,?,?,?,?,?,'active')`,
      [e[0], e[1], e[2], e[3], e[4], ri(6000, 15000), e[5]]),
  );

  /* chart of accounts */
  ACCOUNTS.forEach((a) =>
    db.run(
      `INSERT INTO accounts (code,name_ar,name_en,type,subtype,parent_code,is_postable,opening,is_system) VALUES (?,?,?,?,?,?,?,?,1)`,
      [a[0], a[1], a[2], a[3], a[4], a[0][0] + '000', a[1] === a[2] ? 0 : 1, a[5]],
    ),
  );
  const acc = (code: string) =>
    db.exec(`SELECT id FROM accounts WHERE code='${code}'`)[0].values[0][0] as number;

  /* catalog */
  CATEGORIES.forEach((c, i) =>
    db.run(`INSERT INTO categories (slug,name_ar,name_en,icon,parent_id,sort) VALUES (?,?,?,?,NULL,?)`, [c[0], c[1], c[2], c[3], i]),
  );
  BRANDS.forEach((b) => db.run(`INSERT INTO brands (slug,name_ar,name_en) VALUES (?,?,?)`, b as any));

  const prodIds: number[] = [];
  const products = PRODUCTS.filter((p) => p.length >= 10);
  for (const p of products) {
    const [sku, ar, en, cat, brand, cost, retail, whole, qty, reorder, cond] = p;
    const isSvc = qty === 0 && cost === 0;
    // guarantee a healthy margin on both price tiers
    const RETAIL = isSvc ? retail : Math.max(retail, Math.round(cost * 1.32));
    const WHL = isSvc ? whole : Math.max(whole, Math.round(cost * 1.18));
    db.run(
      `INSERT INTO products (sku,barcode,name_ar,name_en,desc_ar,desc_en,category_id,brand_id,unit,cost_price,retail_price,wholesale_price,vat_rate,qty,reorder_level,warranty_months,condition,is_service,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [
        sku, '628' + String(10000000 + prodIds.length * 137), ar, en,
        `${ar} — ضمان ${cond === 'refurbished' ? 6 : 12} شهر، متوفر في المستودع الرئيسي.`,
        `${en} — ${cond === 'refurbished' ? '6' : '12'}-month warranty, in stock at main warehouse.`,
        cat + 1, brand + 1, 'piece', cost, RETAIL, WHL, 0.15, qty, reorder,
        cond === 'refurbished' ? 6 : 12, cond ?? 'new', isSvc ? 1 : 0,
      ],
    );
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    prodIds.push(id);
    if (!isSvc) {
      db.run(`INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
               VALUES (?,1,'in',?,?,'opening',NULL,'رصيد افتتاحي',2,?)`, [id, qty, cost, iso(daysAgo(200))]);
    }
    db.run(`INSERT INTO price_lists (product_id,tier,min_qty,price) VALUES (?,'retail',1,?)`, [id, RETAIL]);
    db.run(`INSERT INTO price_lists (product_id,tier,min_qty,price) VALUES (?,'wholesale',1,?)`, [id, WHL]);
    db.run(`INSERT INTO price_lists (product_id,tier,min_qty,price) VALUES (?,'wholesale',10,?)`, [id, R2(WHL * 0.97)]);
    db.run(`INSERT INTO price_lists (product_id,tier,min_qty,price) VALUES (?,'wholesale',50,?)`, [id, R2(WHL * 0.94)]);
  }

  /* partners */
  const custIds: number[] = [];
  const suppIds: number[] = [];
  PARTNERS.forEach((p) => {
    const [code, name, kind, phone, city, credit, open, terms] = p;
    const segment = kind === 'customer' ? (credit > 90000 ? 'wholesale' : credit > 25000 ? 'vip' : 'retail') : 'retail';
    db.run(
      `INSERT INTO partners (code,kind,name,company,email,phone,city,address,credit_limit,payment_terms,opening_balance,balance,segment,loyalty_points,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [code, kind, name, name, `${code.toLowerCase().replace('-', '')}@example.com`, phone, city, city, credit, terms, open, open, segment, ri(0, 900)],
    );
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    (kind === 'supplier' ? suppIds : custIds).push(id);
  });

  /* opening balances -> journal (capital derived so the entry always balances) */
  const arOpening = 18500 + 3200 + 8900 + 42000;            // customer receivables carried forward
  const apOpening = 38000 + 22000 + 19100 + 12000 + 6000;  // supplier payables carried forward
  const netFixedAssets = 38500 + 12700 - 9800;
  const DRAWINGS_OPENING = 12000;
  const capitalOpening = netFixedAssets + 18500 + 96400 + 6200 + arOpening - apOpening + DRAWINGS_OPENING;

  const openingLines: [number, number][] = [
    [acc('1100'), 18500], [acc('1110'), 96400], [acc('1120'), 6200],
    [acc('1410'), 38500], [acc('1420'), 12700], [acc('1490'), -9800],
    [acc('1200'), arOpening], [acc('3200'), DRAWINGS_OPENING], [acc('3100'), -capitalOpening],
    [acc('2100'), -apOpening],
  ];
  db.run(`INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,created_by) VALUES ('JV-OPENING',?,'opening','OPENING','رصيد افتتاحي — مبداية السنة','posted','journals',1)`,
    [isoD(daysAgo(200))]);
  const openId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  openingLines.forEach(([a, amt]) =>
    db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`,
      [openId, a, amt > 0 ? amt : 0, amt < 0 ? -amt : 0, 'رصيد افتتاحي']),
  );

  /* ------------------------------- purchase orders (history) ------- */
  let journalSeq = 1;
  const newJournalNo = () => `JV-${String(journalSeq++).padStart(5, '0')}`;

  const sellableIds = prodIds.filter((_, i) => products[i][5] > 0);
  const productOf = (pid: number) => products[prodIds.indexOf(pid)]!;

  const purchaseItemsFor = (poId: number, count: number, when: Date) => {
    const chosen = new Set<number>();
    while (chosen.size < count) chosen.add(pick(sellableIds));
    let subtotal = 0, vat = 0;
    for (const pid of chosen) {
      const p = productOf(pid);
      const qty = ri(5, 40);
      const cost = R2(p[5] * (0.96 + rnd() * 0.08));
      const line = R2(cost * qty);
      subtotal += line;
      vat += line * 0.15;
      db.run(`INSERT INTO purchase_items (order_id,product_id,qty,unit_cost,vat_rate,line_total) VALUES (?,?,?,?,0.15,?)`,
        [poId, pid, qty, cost, line]);
      db.run(`UPDATE products SET qty = qty + ?, cost_price = ? WHERE id=?`, [qty, cost, pid]);
      db.run(`INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
               VALUES (?,1,'in',?,?,'purchase_order',?,'استلام بضاعة',2,?)`, [pid, qty, cost, poId, iso(when)]);
    }
    return { subtotal: R2(subtotal), vat: R2(vat) };
  };

  const PO_COUNT = 26;
  for (let i = 0; i < PO_COUNT; i++) {
    const d = daysAgo(ri(3, 170));
    const supp = pick(suppIds);
    const suppName = PARTNERS.find((x) => x[2] === 'supplier' && x[0] === `S-200${suppIds.indexOf(supp) + 1}`)?.[1] ?? 'مورد';

    // 1) header first so items can reference the real id
    db.run(
      `INSERT INTO purchase_orders (order_no,partner_id,branch_id,user_id,status,subtotal,discount,vat_amount,total,paid,supplier_ref,note,ordered_at,received_at)
       VALUES (?,?,3,2,'received',0,0,0,0,0,?,?,?,?)`,
      [`PO-${String(2400 + i)}`, supp, 'SUP-' + ri(10000, 99999), null, iso(d), iso(d)],
    );
    const poId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    const { subtotal, vat } = purchaseItemsFor(poId, ri(3, 7), d);
    const total = R2(subtotal + vat);
    const paid = rnd() > 0.45 ? total : R2(total * (0.2 + rnd() * 0.6));
    db.run(`UPDATE purchase_orders SET subtotal=?, vat_amount=?, total=?, paid=? WHERE id=?`,
      [subtotal, vat, total, paid, poId]);

    // accounting: Dr Inventory + VAT receivable ; Cr Accounts Payable
    const lines: [number, number, number][] = [[acc('1300'), subtotal, 0], [acc('2210'), vat, 0], [acc('2100'), 0, total]];
    db.run(`INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,source_id,created_by)
            VALUES (?,?,'purchase',?,?,'posted','purchase_orders',?,2)`,
      [newJournalNo(), isoD(d), `PO-${2400 + i}`, `فاتورة شراء — ${suppName}`, poId]);
    const jid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    lines.forEach(([a, dr, cr]) =>
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, a, dr, cr, 'فاتورة شراء']));

    if (paid > 0) {
      const pd = daysAgo(Math.max(0, ri(1, 90)));
      const ref = 'TRX-' + ri(1000, 9999);
      db.run(`INSERT INTO payments (partner_id,direction,method,amount,reference,order_id,journal_id,paid_at,user_id)
              VALUES (?,'out',?,?,?,?,NULL,?,2)`, [supp, pick(['bank', 'transfer', 'cheque']), paid, ref, poId, iso(pd)]);
      const payId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run(`INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,source_id,created_by)
              VALUES (?,?,'payment',?,?,'posted','payments',?,2)`,
        [newJournalNo(), isoD(pd), ref, `سداد مورد — ${suppName}`, payId]);
      const j2 = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [j2, acc('2100'), paid, 0, 'سداد مورد']);
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [j2, acc('1110'), 0, paid, 'سداد مورد']);
      db.run(`UPDATE payments SET journal_id=? WHERE id=?`, [j2, payId]);
      db.run(`UPDATE partners SET balance = balance + ? WHERE id=?`, [paid, supp]);   // paying a supplier reduces what we owe
    }
    db.run(`UPDATE partners SET balance = balance - ? WHERE id=?`, [total, supp]);
  }

  /* ------------------------------- sales orders (history) ---------- */
  const SO_COUNT = 140;
  for (let i = 0; i < SO_COUNT; i++) {
    const d = daysAgo(ri(0, 180), ri(9, 21));
    const wholesale = rnd() > 0.55;
    const cust = pick(custIds);
    const channel = wholesale ? 'wholesale' : rnd() > 0.6 ? 'online' : 'retail';
    const lineCount = wholesale ? ri(2, 8) : ri(1, 4);
    const chosen = new Set<number>();
    while (chosen.size < Math.min(lineCount, sellableIds.length)) chosen.add(pick(sellableIds));

    let subtotal = 0, vatTotal = 0, costTotal = 0;
    const lines: [number, number, number, number][] = [];
    for (const pid of chosen) {
      const p = productOf(pid);
      const qty = wholesale ? ri(5, 30) : ri(1, 3);
      const base = wholesale ? p[7] : p[6];
      const price = R2(base * (wholesale ? 0.98 + rnd() * 0.06 : 0.96 + rnd() * 0.1));
      const disc = wholesale && rnd() > 0.85 ? R2(price * qty * 0.03) : 0;
      const line = R2(price * qty - disc);
      subtotal += line;
      vatTotal += line * 0.15;
      costTotal += p[5] * qty;
      lines.push([pid, qty, price, disc]);
    }
    subtotal = R2(subtotal);
    vatTotal = R2(vatTotal);
    costTotal = R2(costTotal);
    const total = R2(subtotal + vatTotal);
    const payProb = channel === 'online' ? 1 : wholesale ? 0.65 : 0.92;
    const paid = rnd() < payProb ? total : R2(total * (0.1 + rnd() * 0.5));
    const custRow = PARTNERS.find((p) => p[0] === `C-${1001 + custIds.indexOf(cust)}`)!;

    db.run(
      `INSERT INTO sales_orders (order_no,partner_id,branch_id,user_id,channel,status,subtotal,discount,vat_amount,total,cost_total,paid,ship_name,ship_phone,ship_city,note,placed_at,delivered_at)
       VALUES (?,?,?,?,?,'delivered',?,0,?,?,?,?,?,?,?,?,?,?)`,
      [
        `SO-${String(90000 + i)}`, cust, wholesale ? 3 : pick([1, 2]), wholesale ? 2 : 5, channel,
        subtotal, vatTotal, total, costTotal, R2(paid), custRow[1], custRow[3], custRow[4],
        channel === 'online' ? 'طلب عبر الموقع' : null, iso(d), iso(d),
      ],
    );
    const soId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    for (const [pid, qty, price, disc] of lines) {
      const p = productOf(pid);
      const lineTotal = R2(price * qty - disc);
      db.run(`INSERT INTO sales_items (order_id,product_id,qty,unit_price,cost_price,discount,vat_rate,line_total)
              VALUES (?,?,?,?,?,?,0.15,?)`, [soId, pid, qty, price, p[5], disc, lineTotal]);
      db.run(`UPDATE products SET qty = qty - ? WHERE id=?`, [qty, pid]);
      db.run(`INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
               VALUES (?,?,'out',?,?,'sales_order',?,'بيع',?,?)`, [pid, wholesale ? 3 : 1, -qty, p[5], soId, wholesale ? 2 : 5, iso(d)]);
    }

    // accounting: Dr Cash/AR + VAT ; Cr Sales ; Dr COGS ; Cr Inventory
    const cash = R2(paid);
    const ar = R2(total - paid);
    const jl: [number, number, number][] = [];
    // online → payment gateway · wholesale → bank transfer · retail → till (mixed with bank)
    const receiptAcc = channel === 'online' ? '1120' : channel === 'wholesale' ? '1110' : (rnd() > 0.4 ? '1110' : '1100');
    if (cash > 0) jl.push([acc(receiptAcc), cash, 0]);
    if (ar > 0) jl.push([acc('1200'), ar, 0]);
    if (vatTotal > 0) jl.push([acc('2200'), 0, vatTotal]);
    jl.push([acc(wholesale ? '4100' : '4200'), 0, subtotal]);
    if (costTotal > 0) {
      jl.push([acc('5100'), costTotal, 0]);
      jl.push([acc('1300'), 0, costTotal]);
    }
    db.run(`INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,source_id,created_by)
            VALUES (?,?,'sale',?,?,'posted','sales_orders',?,?)`,
      [newJournalNo(), isoD(d), `SO-${90000 + i}`, `بيع ${wholesale ? 'جملة' : 'تجزئة'}`, soId, wholesale ? 2 : 5]);
    const jid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    jl.forEach(([a, dr, cr]) =>
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`,
        [jid, a, dr, cr, `فاتورة بيع ${wholesale ? 'جملة' : 'تجزئة'}`]));

    if (paid > 0) {
      db.run(`INSERT INTO payments (partner_id,direction,method,amount,reference,order_id,journal_id,paid_at,user_id)
              VALUES (?,'in',?,?,?,?,?,?,?)`,
        [cust, channel === 'online' ? 'card' : pick(['cash', 'bank', 'transfer', 'card']), cash, 'RCP-' + ri(1000, 9999), soId, null, iso(d), wholesale ? 2 : 5]);
    }
    db.run(`UPDATE partners SET balance = balance + ? WHERE id=?`, [R2(total - paid), cust]);
  }

  /* ------------- replenishment: top up anything sold below reorder ----- */
  {
    const lowRows: any[] = [];
    const lowStmt = db.prepare(
      `SELECT id, sku, qty, reorder_level, cost_price FROM products WHERE is_service=0 AND qty < reorder_level`);
    while (lowStmt.step()) lowRows.push(lowStmt.getAsObject());
    lowStmt.free();
    const lows = lowRows;
    if (lows.length) {
      const supp = suppIds[0];
      const suppName = PARTNERS.find((x) => x[0] === 'S-2001')?.[1] ?? 'مورد';
      const d = daysAgo(ri(2, 14));
      let subtotal = 0;
      const lines: [number, number, number][] = [];

      db.run(
        `INSERT INTO purchase_orders (order_no,partner_id,branch_id,user_id,status,subtotal,discount,vat_amount,total,paid,supplier_ref,note,ordered_at,received_at)
         VALUES (?,?,3,2,'received',0,0,0,0,0,'TOPUP',?,?,?)`,
        [`PO-TOPUP`, supp, 'توريد طارئ — إعادة تخزون', iso(d), iso(d)]);
      const poId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

      for (const p2 of lows) {
        const delta = Math.max(5, p2.reorder_level * 2 - p2.qty);
        const cost = R2(p2.cost_price * (0.97 + rnd() * 0.06));
        const line = R2(cost * delta);
        subtotal += line;
        db.run(`INSERT INTO purchase_items (order_id,product_id,qty,unit_cost,vat_rate,line_total) VALUES (?,?,?,?,0.15,?)`,
          [poId, p2.id, delta, cost, line]);
        db.run('UPDATE products SET qty = qty + ?, cost_price = ? WHERE id=?', [delta, cost, p2.id]);
        db.run(`INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
                 VALUES (?,3,'in',?,?,'purchase_order',?,'توريد طارئ',2,?)`, [p2.id, delta, cost, poId, iso(d)]);
      }

      subtotal = R2(subtotal);
      const vat = R2(subtotal * 0.15);
      const total = R2(subtotal + vat);
      db.run(`UPDATE purchase_orders SET subtotal=?, vat_amount=?, total=?, paid=? WHERE id=?`, [subtotal, vat, total, 0, poId]);
      db.run(`INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,source_id,created_by)
              VALUES (?,?,'purchase','PO-TOPUP',?,'posted','purchase_orders',?,2)`,
        [newJournalNo(), isoD(d), `توريد طارئ — ${suppName}`, poId]);
      const jid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      lines.push([acc('1300'), subtotal, 0], [acc('2210'), vat, 0], [acc('2100'), 0, total]);
      lines.forEach(([a, dr, cr]) =>
        db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, a, dr, cr, 'فاتورة شراء']));
      db.run('UPDATE partners SET balance = balance - ? WHERE id=?', [total, supp]);
    }
  }

  /* ------------------------------- repairs -------------------------- */
  const ISSUES: [string, string, string][] = [
    ['شاشة مكسورة', 'Broken screen', 'screen'],
    ['لا يشحن — الشاحن لا يعمل', 'Not charging — no power', 'board'],
    ['مبلل بالماء', 'Water damaged', 'water'],
    ['بطارية تفرغ سريعاً', 'Battery drains fast', 'battery'],
    ['صوت لا يعمل', 'No sound on calls', 'audio'],
    ['كاميرا أمامية معطلة', 'Front camera not working', 'camera'],
    ['تعليق الجهاز (يboot)', 'Device stuck in boot loop', 'board'],
    ['عدم التعرف على الشبكة', 'No network / SIM not detected', 'board'],
    ['منفذ الشحن تالف', 'Charging port damaged', 'port'],
    ['الشاشة لا تستجيب للمس', 'Touch screen unresponsive', 'screen'],
  ];
  const STATUSES = ['received', 'diagnosing', 'awaiting_parts', 'in_progress', 'testing', 'completed', 'delivered'];
  const REPAIR_COUNT = 46;
  for (let i = 0; i < REPAIR_COUNT; i++) {
    const d = daysAgo(ri(0, 90), ri(9, 19));
    const status = i < 9 ? pick(STATUSES.slice(0, 6)) : pick(['completed', 'delivered', 'delivered']);
    const issue = pick(ISSUES);
    const prodIdx = ri(0, 28);
    const p = products[prodIdx]!;
    const parts = rnd() > 0.45 ? R2(p[5] * (0.3 + rnd() * 1.2)) : 0;
    const labor = ri(80, 320);
    const final = R2(parts + labor);
    const createdAt = new Date(d.getTime() + (ri(1, 14) * 3600 * 1000));
    const doneAt = status === 'completed' || status === 'delivered' ? new Date(d.getTime() + ri(4, 72) * 3600 * 1000) : null;
    db.run(
      `INSERT INTO repair_tickets (ticket_no,customer_name,customer_phone,customer_email,device_brand,device_model,imei,issue_ar,issue_en,diagnosis,advice,status,priority,technician_id,branch_id,passcode_ok,est_cost,parts_cost,labor_cost,discount,final_cost,vat_rate,warranty_days,ai_confidence,ai_eta_hours,ai_risk,intake_at,promised_at,completed_at,delivered_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `SR-${String(5000 + i)}`, pick(['أحمد العنزي', 'سلمى الحسن', 'خالد الرشيد', 'منال الغامدي', 'يوسف بدر', 'هند السبيعي', 'راكان العمري', 'لينا المالكي', 'تركي الشهري', 'دانة الفيصل']).toString(),
        '05' + ri(10000000, 99999999), `cust${i}@example.com`,
        ['آيفون', 'سامسونج', 'هواوي', 'شاومي', 'أوبو', 'فيفو', 'نوكيا'][ri(0, 6)], p[1].split(' ').slice(1).join(' '),
        '35' + ri(100000, 999999), issue[0], issue[1],
        issue[2] === 'screen' ? 'كسر في الزجاج والطبقة اللمسية — يحتاج استبدال كامل' :
        issue[2] === 'battery' ? 'بطارية فقدت أكثر من 80% من سعتها الأصلية' :
        issue[2] === 'water' ? 'تأثر بسبب السوائل — corrosion على اللوحة' :
        issue[2] === 'audio' ? 'عطل في مكبر الصوت أو سماعة الأذن' :
        'يحتاج تشخيص دقيق للوحة الأم',
        issue[2] === 'water' ? 'تنظيف اللوحة من التآكل وتغيير البطاريات' : 'يوصى بفحص شامل قبل التسليم',
        status, rnd() > 0.82 ? pick(['high', 'urgent']) : pick(['low', 'normal', 'normal', 'high']),
        1, 4, rnd() > 0.35 ? 1 : 0,
        R2(parts + labor * 1.1), parts, labor, 0, final, 0.15, 30,
        R2(0.55 + rnd() * 0.44), ri(3, 48), rnd() > 0.75 ? 'high' : 'low',
        iso(d), iso(new Date(d.getTime() + ri(6, 72) * 3600 * 1000)),
        doneAt ? iso(doneAt) : null,
        status === 'delivered' && doneAt ? iso(new Date(doneAt.getTime() + ri(2, 48) * 3600 * 1000)) : null,
      ],
    );
    const tid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    if (parts > 0) {
      db.run(`INSERT INTO repair_parts (ticket_id,product_id,label,qty,unit_price,source) VALUES (?,?,?,?,?,'stock')`,
        [tid, prodIds[prodIdx], p[1], 1, parts]);
    }
    let prev = 'received';
    const chain = ['received', 'diagnosing', 'awaiting_parts', 'in_progress', 'testing', 'completed', 'delivered'];
    const upto = chain.indexOf(status) + 1;
    for (let k = 1; k < upto; k++) {
      db.run(`INSERT INTO repair_history (ticket_id,from_status,to_status,note,user_id,created_at) VALUES (?,?,?,?,?,?)`,
        [tid, chain[k - 1], chain[k], k === 1 ? 'استلام الجهاز من العميل' : null, 4, iso(new Date(d.getTime() + k * ri(3, 10) * 3600 * 1000))]);
      prev = chain[k];
    }
    void prev;
    // repair revenue journal (only finished ones)
    if (doneAt && final > 0) {
      db.run(`INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,source_id,created_by)
              VALUES (?,?,'repair',?,?,'posted','repair_tickets',?,4)`,
        [newJournalNo(), isoD(doneAt), `SR-${5000 + i}`, `صيانة — ${p[1]}`, tid]);
      const jid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc('1100'), final, 0, 'تحصيل صيانة']);
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc('4400'), 0, final, 'إيراد صيانة']);
      if (parts > 0) {
        db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc('5200'), parts, 0, 'تكلفة قطع الغيار']);
        db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc('1320'), 0, parts, 'صرف قطع غيار']);
        db.run(`INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
                 VALUES (?,4,'out',-1,?,'repair_ticket',?,'صرف قطعة غيار',4,?)`, [prodIds[prodIdx], parts, tid, iso(doneAt)]);
        db.run('UPDATE products SET qty = qty - 1 WHERE id=?', [prodIds[prodIdx]]);
      }
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc('6100'), labor, 0, 'أجور فني صيانة']);
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc('1110'), 0, labor, 'أجور فني صيانة']);
    }
  }

  /* ------------------------------- expenses -------------------------- */
  const EXPENSES: [string, number, string][] = [
    ['إيجارات', 32000, '6100'], ['رواتب وأجور', 86000, '6110'], ['كهرباء ومياه', 4200, '6120'],
    ['إنترنت واتصالات', 2800, '6130'], ['تسويق وإعلان', 6800, '6140'], ['نقل وشحن', 5200, '6150'],
    ['مستلزمات الورشة', 3000, '6160'], ['مصروفات عمومية', 3600, '6170'],
  ];
  for (let m = 0; m < 4; m++) {
    for (const [cat, base, code] of EXPENSES) {
      const d = daysAgo(m * 45 + ri(2, 9));
      const amount = R2(base * (0.9 + rnd() * 0.2));
      const vat = R2(amount * 0.15);
      db.run(`INSERT INTO expenses (category,amount,vat_amount,method,vendor,note,entry_date,user_id) VALUES (?,?,?,?,?,?,?,2)`,
        [cat, amount, vat, pick(['bank', 'cash', 'transfer']), 'مصروف تشغيلي', null, isoD(d)]);
      const exId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run(`INSERT INTO journals (journal_no,entry_date,kind,reference,memo,status,source_table,source_id,created_by)
              VALUES (?,?,'expense',?,?,'posted','expenses',?,2)`,
        [newJournalNo(), isoD(d), `EXP-${exId}`, `${cat}`]);
      const jid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc(code), amount, 0, cat]);
      db.run(`INSERT INTO journal_lines (journal_id,account_id,debit,credit,description) VALUES (?,?,?,?,?)`, [jid, acc('1110'), 0, amount, cat]);
    }
  }

  db.run(`INSERT INTO audit_log (user_id,username,action,entity,entity_id,ip) VALUES (1,'admin','SEED','system',NULL,'127.0.0.1')`);
}

export const DEV_CREDENTIALS = { password: DEV_PASSWORD, users: USERS.map((u) => u[0]) };
export { arNum as toArabicDigits };
