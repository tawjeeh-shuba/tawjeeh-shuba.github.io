// الرئيسية: «المحراب» بالتاريخ الهجري (كالقديم)، ثم بطاقات أرقام تجيب «ما وضعي الآن؟»، ثم رسوم من الملخص المحسوب مسبقاً.
// كل الأرقام من القاعدة كما تعيدها لنطاق المستخدم (الصلاحيات داخل القاعدة).
import { S, h, get, rpc, count, can, canAny, nf, roleNames, depName, icon } from './core.js';
import { donut, columns, hbars } from './charts.js';
import { sectorOK, sectorQS } from './queries.js';
import { C } from './ctx.js';

const Q = (o) => '?' + new URLSearchParams(o);
function hijriParts() {
  try {
    const f = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { day: p.day, month: `${p.month} ${p.year} هـ`, wd: p.weekday };
  } catch { return { day: new Date().getDate(), month: '', wd: '' }; }
}

export async function render(root, ctx) {
  // سياق «موجه» ← صفحة الموجه (زياراتي اليوم ومعلميّ). غيره ← الإحصاءات كما هي.
  if (C.cur?.role === 'supervisor') return (await import('./sup_home.js')).render(root, ctx);
  const me = S.profile.person_id;
  const isSup = (S.profile.assignments || []).some((a) => a.role === 'supervisor');
  // موجه بلا دور إداري (احتياط إن تعذّر تحميل السياق): لا إحصاءات للمسؤول، بل «حلقاتي» فقط (المرحلة 9ب)
  const supOnly = isSup && !(S.profile.assignments || []).some((a) => a.role !== 'supervisor');
  let [rows, mine, pending, teachers, confRows, srcAlerts] = await Promise.all([
    get('dept_period_summary?select=department_code,period_code,sector,halaqat_active,teachers_current,halaqat_no_teacher,halaqat_no_supervisor,open_confirmations&limit=5000'),
    isSup ? count(`halaqa_supervisors?select=id,h:halaqat!inner(sector)&valid_to=is.null&person_id=eq.${me}${sectorQS('h.')}`).catch(() => null) : null,
    can('decide_requests') ? count(`assignment_requests?select=id,h:halaqat!inner(sector)&status=eq.%D9%85%D8%B9%D9%84%D9%82${sectorQS('h.')}`).catch(() => null) : null,
    // عدد المعلمين الفعلي (أشخاص مختلفون)، لا مجموع الروابط
    count(`persons?select=id,links:halaqa_teachers!person_id!inner(halaqa_number,h:halaqat!inner(sector))&links.valid_to=is.null${sectorQS('links.h.')}`).catch(() => null),
    // كل البنود المفتوحة (كل القوائم) كما تعرضها لوحة التحكم، لا بنود الحلقات وحدها
    can('resolve_confirmations') ? rpc('confirmations_summary', { p_department: null, p_period: null, p_status: 'مفتوح' }).catch(() => null) : null,
    // مصادر البيانات: تنبيه للمسؤول عند توقف أي مصدر أو إيقاف الحارس لآخر سحب
    can('manage_data_sources') ? rpc('rpc_sources_alerts').catch(() => null) : null,
  ]);
  if (!ctx.alive()) return;
  rows = rows.filter((r) => sectorOK(r.sector));
  const sum = (k, f) => rows.filter(f || (() => true)).reduce((a, x) => a + (x[k] || 0), 0);
  const active = sum('halaqat_active'), noT = sum('halaqat_no_teacher'), noS = sum('halaqat_no_supervisor');
  const conf = confRows ? confRows.reduce((a, r) => a + Number(r.items || 0), 0) : sum('open_confirmations');
  const assigned = Math.max(0, active - noS);

  // ---------- المحراب ----------
  const hp = hijriParts();
  const hero = h('section', { class: 'hero' },
    h('div', { class: 'arch' }, h('div', { class: 'day' }, hp.day), h('div', { class: 'month' }, hp.month), h('div', { class: 'wd' }, hp.wd)),
    h('div', { class: 'greet' }, 'السلام عليكم ورحمة الله، ', h('b', null, S.profile.full_name)),
    h('div', { class: 'roles' }, roleNames().map((r) => h('span', null, r))));

  // ---------- بطاقات الأرقام ----------
  const stat = (n, label, href, ico, kind = '') => h(href ? 'a' : 'div', { class: `stat ${kind}`, href, 'aria-label': `${label}: ${nf(n)}` },
    icon(ico, 19), h('b', null, nf(n)), h('span', null, label));
  const stats = supOnly ? h('div', { class: 'stats two' },
    mine != null ? stat(mine, 'حلقاتي', '#/الحلقات', 'book', 'info') : null,
    stat(teachers ?? sum('teachers_current'), 'معلميّ', '#/المعلمون', 'users')) : h('div', { class: 'stats' },
    mine != null ? stat(mine, 'حلقة مسندة إليك', '#/الحلقات' + Q({ حالة: 'مسندة لي' }), 'check', 'info') : null,
    pending != null ? stat(pending, 'طلب ينتظر قرارك', '#/الإسناد' + Q({ تبويب: 'الطلبات' }), 'inbox', pending ? 'warn' : '') : null,
    stat(active, 'حلقة نشطة في نطاقك', '#/الحلقات' + Q({ حالة: 'نشطة' }), 'book'),
    stat(teachers ?? sum('teachers_current'), teachers == null ? 'رابط معلم بحلقة' : 'معلم حالي', '#/المعلمون', 'users'),
    stat(noS, 'حلقة بلا موجه', '#/الحلقات' + Q({ حالة: 'بلا موجه' }), 'alert', noS ? 'warn' : ''),
    stat(noT, 'حلقة بلا معلم', '#/الحلقات' + Q({ حالة: 'بلا معلم' }), 'user', noT ? 'bad' : ''),
    can('resolve_confirmations') ? stat(conf, 'بند يحتاج تأكيد', '#/لوحة-التحكم' + Q({ تبويب: 'يحتاج تأكيد' }), 'clipboard', conf ? 'gold' : '') : null);

  // ---------- الرسوم ----------
  const charts = [];
  if (active && !supOnly) {
    charts.push(donut({
      title: 'الإسناد في نطاقك', ico: 'swap', sub: 'الحلقات النشطة: المسندة إلى موجه والتي بلا موجه',
      center: { value: `${Math.round((assigned / active) * 100)}٪`, label: 'نسبة الإسناد' },
      parts: [
        { label: 'مسندة إلى موجه', value: assigned, color: 'var(--ch-1)' },
        { label: 'بلا موجه', value: noS, color: 'var(--ch-2)', href: '#/الحلقات' + Q({ حالة: 'بلا موجه' }) },
      ],
    }));
    const per = new Map();
    rows.forEach((r) => per.set(r.period_code || '', (per.get(r.period_code || '') || 0) + (r.halaqat_active || 0)));
    const perItems = S.refs.periods.filter((p) => p.is_active || per.get(p.code))
      .map((p) => ({ label: p.name, value: per.get(p.code) || 0, href: '#/الحلقات' + Q({ فترة: p.code }) }));
    if (per.get('')) perItems.push({ label: 'بلا فترة', value: per.get(''), color: 'var(--ch-4)' });
    charts.push(columns({ title: 'الحلقات حسب الفترة', ico: 'clock', sub: 'الحلقات النشطة في كل فترة بترتيب اليوم — اضغط الفترة لعرض حلقاتها', items: perItems }));
  }
  const grid = charts.length ? h('div', { class: 'grid2' }, charts) : null;

  const dep = new Map();
  rows.forEach((r) => {
    const k = r.department_code || '';
    const d = dep.get(k) || { a: 0, n: 0 };
    d.a += r.halaqat_active || 0; d.n += r.halaqat_no_supervisor || 0; dep.set(k, d);
  });
  const depItems = [...dep].filter(([, d]) => d.a > 0).sort((x, y) => y[1].a - x[1].a)
    .map(([c, d]) => ({ label: depName(c) || 'بلا قسم', href: c ? '#/الحلقات' + Q({ قسم: c }) : null,
      extra: d.n ? `${nf(d.n)} بلا موجه` : null,
      parts: [{ value: d.a - d.n, color: 'var(--ch-1)' }, { value: d.n, color: 'var(--ch-2)' }] }));
  const depChart = depItems.length > 1 && !supOnly ? hbars({ title: 'الحلقات حسب القسم', ico: 'grid', sub: 'مرتبة من الأكثر حلقات — اضغط القسم لعرض حلقاته',
    keys: [{ label: 'مسندة', color: 'var(--ch-1)' }, { label: 'بلا موجه', color: 'var(--ch-2)' }], items: depItems, moreLabel: 'عرض كل الأقسام' }) : null;

  const sec = [['رجال', 'var(--ch-1)'], ['نساء', 'var(--ch-2)'], ['غير محدد', 'var(--ch-4)']]
    .map(([k, c]) => ({ label: k === 'غير محدد' ? 'قطاع غير محدد' : k, parts: [{ value: sum('halaqat_active', (r) => (r.sector || 'غير محدد') === k), color: c }] }))
    .filter((x) => x.parts[0].value > 0);
  const secChart = S.showWomen && sec.length > 1 ? hbars({ title: 'الحلقات حسب القطاع', ico: 'users', items: sec }) : null;

  const srcAlert = srcAlerts?.length ? h('a', { class: 'home-src-alert', href: '#/لوحة-التحكم?' + new URLSearchParams({ تبويب: 'مصادر البيانات' }), role: 'alert' },
    icon('alert', 18), ` ${srcAlerts.length === 1 ? 'مصدر بيانات يحتاج نظرك' : `${nf(srcAlerts.length)} مصادر بيانات تحتاج نظرك`}: `,
    srcAlerts.slice(0, 3).map((a) => `«${a.name}» (${a.state === 'متوقف' ? 'متوقف' : a.last})`).join('، ')) : null;
  // «الموقع السهل» (2026-11-25): لمسؤول الشعبة زر واضح إلى «ابدأ من هنا» تحت التحية مباشرة (خلف «صفحات تجهيز التجربة»)
  const start = S.profile?.is_division_head && S.profile?.ops?.setup ? h('a', { class: 'btn primary block', href: '#/ابدأ', style: 'margin-bottom:12px' }, icon('check', 20), 'ابدأ من هنا: جرّب زيارة، وأكمل الجاهزية') : null;
  root.append(hero, start, srcAlert, stats, grid, depChart, secChart,
    h('div', { class: 'btns', style: 'margin-top:4px' },
      h('a', { class: 'btn soft', href: '#/الحلقات' }, icon('search', 20), 'ابحث عن حلقة'),
      h('a', { class: 'btn soft', href: '#/المعلمون' }, icon('users', 20), 'ابحث عن معلم'),
      canAny('self_assign', 'request_halaqa', 'assign_supervisor') ? h('a', { class: 'btn soft', href: '#/الإسناد' }, icon('swap', 20), 'إسناد الحلقات') : null));
}
