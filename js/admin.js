// لوحة التحكم: مجموعات (المرحلة 9ب)، وكل مجموعة تُفتح صفحة بطاقات لأقسامها (المرحلة 9ج) بنفس شكل بطاقات الرئيسية:
// أيقونة واسم ووصف قصير وعدد إن وُجد. كل شاشة تظهر حسب الصلاحية وتُحمَّل عند فتحها فقط.
// على الشاشة العريضة: قائمة جانبية بالمجموعات. على الجوال: المجموعات في الأعلى ثم بطاقات المجموعة المختارة.
import { S, h, can, canAny, seg, fail, icon, count, nf } from './core.js';
import { panelMode } from './panel_ui.js';
import { halaqatQuery } from './queries.js';

const panelOn = () => S.profile?.panel_on !== false;
const P = (code) => panelOn() && !!panelMode(code);
// n: اسم الشاشة (يُستعمل في الرابط ?تبويب=)، d: وصف البطاقة، c: عدد اختياري (يُحمَّل بعد ظهور البطاقات، ويُترك إن فشل).
// href: رابط لصفحة خارج اللوحة. big: بطاقة مميزة أكبر. args: ما يُمرَّر للشاشة (مثل مكان الإعدادات).
const GROUPS = [
  // «يحتاج تأكيد» قائمة عمل (صندوق وارد) لا إعداد، فهي أولاً ووحدها، وإليها يشير رقم «بند يحتاج تأكيد» في الرئيسية
  { g: 'يحتاج تأكيد', i: 'inbox', items: [
    { n: 'يحتاج تأكيد', i: 'inbox', d: 'البنود المفتوحة التي تنتظر حسماً', ok: () => can('resolve_confirmations'), mod: './admin_conf.js' }] },
  { g: 'الأشخاص والحسابات والصلاحيات', s: 'الأشخاص', i: 'users', items: [
    { n: 'الأشخاص والتكليفات', i: 'users', d: 'البحث في الأشخاص، والتكليفات، وإضافة شخص', ok: () => can('manage_persons') || can('manage_assignments'), mod: './admin_people.js',
      c: () => count('persons?select=id') },
    { n: 'الحسابات', i: 'key', d: 'كلمات المرور وتفعيل الدخول', ok: () => can('set_passwords'), mod: './admin_accounts.js' },
    { n: 'الصلاحيات', i: 'shield', d: 'ما يحق لكل دور أن يفعله، ونطاقه', ok: () => can('manage_permissions'), mod: './admin_matrix.js', c: () => count('roles?select=code'), cl: 'أدوار' },
    { n: 'المستخدمون وصلاحيات الشاشات', s: 'صلاحيات الشاشات', i: 'lock', d: 'من يرى كل شاشة في اللوحة أو يعدّلها', ok: () => P('P11'), mod: './admin_p11.js' }] },
  { g: 'الحلقات والأقسام والإسناد', s: 'الحلقات', i: 'book', items: [
    // الإسناد أولاً وأكبر لأهميته (رابط لصفحة الإسناد خارج اللوحة)
    { n: 'الإسناد', i: 'swap', d: 'إسناد الحلقات للموجهين، وطلباتهم، والحلقات بلا موجه', big: true, ok: () => canAny('assign_supervisor', 'decide_requests'), href: '#/الإسناد',
      c: () => count(halaqatQuery({ status: 'بلا موجه' }, 0, 1)), cl: 'حلقة بلا موجه' },
    { n: 'الحلقات', i: 'book', d: 'كل الحلقات بالبحث والقسم والفترة والحالة', ok: () => can('manage_halaqat'), mod: './admin_halaqat.js',
      c: () => count('halaqat?select=number&is_active=eq.true'), cl: 'نشطة' },
    { n: 'الأقسام والمجموعات', s: 'الأقسام', i: 'grid', d: 'الأقسام ومجموعاتها', ok: () => P('P01'), mod: './admin_p01.js',
      c: () => count('departments?select=code&is_active=eq.true'), cl: 'قسماً' }] },
  { g: 'الزيارات', i: 'clipboard', items: [
    // النموذج وتحته بنوده (شجرة): شاشتا 2 و3 في مكان واحد
    { n: 'نماذج التقييم', s: 'النماذج والبنود', i: 'clipboard', d: 'النماذج وإصداراتها، ومحاورها وبنودها', ok: () => P('P02') || P('P03'), mod: './admin_p02.js' },
    { n: 'أنواع الزيارات', s: 'الأنواع', i: 'clock', d: 'مفاجئة ومجدولة ومتابعة… وما يُحسب منها', ok: () => P('P05'), mod: './admin_p05.js' },
    { n: 'المستويات والسلالم', s: 'المستويات', i: 'chart', d: 'تقديرات البنود وسلالم التصنيف', ok: () => P('P04'), mod: './admin_p04.js' },
    // مكان «الخطط»: قواعد الخطة والحد اليومي لكل فترة الآن، وشاشات الخطة الشهرية تُضاف هنا في مرحلتها
    { n: 'قواعد الخطة', s: 'الخطط', i: 'cal', d: 'الحد اليومي لكل فترة، وقواعد الخطة الشهرية', ok: () => P('P09'), mod: './admin_p09.js' },
    // المرحلة 9ج: إعدادات الزيارات هنا لا في «الإعدادات العامة». القيم نفسها لم تتغير، والمكان من جدول setting_group_areas
    { n: 'إعدادات الزيارات', i: 'filter', d: 'مدة الزيارة، والمهل، وقوالب واتساب، وحد الأداء المنخفض، وعدد الزيارات في المتوسط', ok: () => P('P14'), mod: './admin_p14.js', args: { area: 'الزيارات' } }] },
  { g: 'التقويم', i: 'cal', items: [
    { n: 'التقويم والفصول', s: 'التقويم', i: 'cal', d: 'التقويم الهجري، والفصول، والفترات', ok: () => P('P10'), mod: './admin_p10.js' }] },
  { g: 'السجل', i: 'list', items: [
    // «السجل» و«سجل اللوحة» صارا سجلاً واحداً بلا تكرار
    { n: 'السجل', i: 'list', d: 'كل عملية: من، ومتى، وماذا', ok: () => can('view_audit') || P('P15'), mod: './admin_log.js' }] },
  // صفحة التصدير (قراءة فقط): كل مستخدم يصدّر ما يحق له رؤيته؛ والتصدير الكامل لمسؤول الشعبة ومساعده
  { g: 'التصدير', i: 'layers', items: [
    { n: 'التصدير', i: 'layers', d: 'تنزيل البيانات والتقارير ملفات إكسل', ok: () => true, mod: './export.js' }] },
  { g: 'الإعدادات', i: 'shield', items: [
    { n: 'الإعدادات العامة', s: 'الإعدادات', i: 'shield', d: 'هوية الشعبة، وتشغيل الميزات، والعرض، والأمان', ok: () => P('P14'), mod: './admin_p14.js', args: { area: 'عام' } },
    // المرحلة 10: دفعات ترحيل الاختبارات والتراجع عن دفعة (لمسؤول الشعبة ومساعده)
    { n: 'دفعات الاختبارات', i: 'layers', d: 'دفعات ترحيل نتائج الاختبارات، ومطابقتها بالملفات، والتراجع عن دفعة', ok: () => can('manage_exam_batches'), mod: './admin_exams.js' }] },
];
// روابط قديمة بأسماء الشاشات قبل إعادة الترتيب
const OLD = { 'سجل التغييرات': 'السجل', 'بنود النموذج ومحاوره': 'نماذج التقييم' };

export async function render(root, ctx) {
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((t) => t.ok()) })).filter((g) => g.items.some((t) => !t.href));
  if (S.profile?.assistant_suspended) root.append(h('p', { class: 'err' }, 'صلاحياتك كمساعد لإدارة الشعبة مسحوبة الآن من مسؤول الشعبة؛ ما فعلته قبل ذلك باقٍ في السجل باسمك.'));
  if (!groups.length) { root.append(h('p', { class: 'empty' }, 'ليست لديك صلاحية في لوحة التحكم.')); return; }
  const screens = groups.flatMap((g) => g.items.filter((t) => !t.href));
  // مجموعة بشاشة واحدة تُفتح شاشتها مباشرة؛ وما فيها أكثر تُفتح بطاقاتها
  const single = (g) => g.items.length === 1 && !g.items[0].href;
  const want = OLD[ctx.query['تبويب']] || ctx.query['تبويب'];
  const wantT = screens.find((t) => t.n === want);
  // cur: { gr: المجموعة، t: الشاشة، أو null لصفحة البطاقات }
  let cur = wantT ? { gr: groups.find((g) => g.items.includes(wantT)), t: wantT } : { gr: groups.find((g) => g.g === ctx.query['مجموعة']) || groups[0], t: null };
  if (!cur.t && single(cur.gr)) cur.t = cur.gr.items[0];
  const side = h('nav', { class: 'pside', 'aria-label': 'مجموعات لوحة التحكم' });
  const top = h('div', { class: 'ptop' });
  const body = h('div', { class: 'pbody' });
  let seq = 0;

  function drawNav() {
    side.replaceChildren(...groups.map((gr) => h('button', { type: 'button', class: 'pitem', 'aria-current': gr === cur.gr ? 'page' : null, onclick: () => goGroup(gr) },
      icon(gr.i, 18), h('span', null, gr.g), gr.items.length > 1 ? h('span', { class: 'pn' }, nf(gr.items.length)) : null)));
    top.replaceChildren(seg(groups.map((gr) => ({ value: gr.g, label: gr.s || gr.g, icon: gr.i })), cur.gr.g, (v) => goGroup(groups.find((x) => x.g === v)), { grid: groups.length > 3 }));
  }
  const url = () => history.replaceState(null, '', '#/لوحة-التحكم?' + new URLSearchParams(cur.t ? { تبويب: cur.t.n } : { مجموعة: cur.gr.g }));
  function goGroup(gr) { cur = { gr, t: single(gr) ? gr.items[0] : null }; url(); show(); }
  function goScreen(t) { cur = { gr: cur.gr, t }; url(); show(); }
  const crumb = () => single(cur.gr) ? h('h2', { class: 'ptitle' }, cur.t.n)
    : h('div', { class: 'pcrumb' }, h('button', { type: 'button', class: 'btn sm ghost', onclick: () => goGroup(cur.gr) }, icon('back', 16), cur.gr.g), h('h2', { class: 'ptitle' }, cur.t.n));

  function cards() {
    const gr = cur.gr;
    body.replaceChildren(h('h2', { class: 'ptitle' }, gr.g), h('div', { class: 'pcards' }, gr.items.map((t) => {
      const n = h('b', { class: 'pc-n', hidden: true });
      const el = h(t.href ? 'a' : 'button', { class: `pcard${t.big ? ' big' : ''}`, ...(t.href ? { href: t.href } : { type: 'button', onclick: () => goScreen(t) }),
        onpointerenter: () => warm(t) },
        icon(t.i, 22),
        h('span', { class: 'pc-t' }, t.n, t.href ? h('span', { class: 'ext', 'aria-hidden': 'true' }, ' ↗') : null),
        h('span', { class: 'pc-d' }, t.d), n);
      if (t.c) t.c().then((v) => { if (v != null) { n.textContent = `${nf(v)}${t.cl ? ' ' + t.cl : ''}`; n.hidden = false; } }).catch(() => {});
      return el;
    })));
    // تحميل مسبق لملفات شاشات هذه المجموعة وبياناتها الأولى (أسرع فتح للبطاقة)
    gr.items.forEach(warm);
  }
  const warmed = new Set();
  function warm(t) {
    if (!t.mod || warmed.has(t.mod)) return;
    warmed.add(t.mod);
    import(t.mod).then((m) => m.prefetch?.()).catch(() => warmed.delete(t.mod));
  }
  async function show() {
    const my = ++seq;
    drawNav();
    if (!cur.t) { cards(); return; }
    const t = cur.t;
    body.replaceChildren(crumb(), h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    try {
      const m = await import(t.mod);
      if (my !== seq) return;
      const box = h('div');
      const wait = h('p', { class: 'loading', role: 'status' }, 'جارٍ التحميل…');
      body.replaceChildren(crumb(), box, wait);
      await m.render(box, ctx, t.args);
      wait.remove();
    } catch (e) { if (my === seq) { body.replaceChildren(crumb()); fail(e); } }
  }
  root.append(h('div', { class: 'panel-wrap' }, side, h('div', { class: 'pmain' }, top, body)));
  show();
}
