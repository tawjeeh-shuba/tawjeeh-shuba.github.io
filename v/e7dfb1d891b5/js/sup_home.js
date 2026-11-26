// صفحة الموجه (الرئيسية في سياق «موجه»): زياراتي اليوم من الحد اليومي، و«حلقاتي»، و«زياراتي القادمة»، ثم معلميّ المسندون إليّ في الفترة والقسم المختارين فقط.
// لا إحصاءات للمسؤول هنا (بلا معلم / بلا موجه / نشطة في النطاق): هي من شأن المسؤول لا الموجه (المرحلة 9ب).
// كل الأرقام من القاعدة (rpc_supervisor_home) بصلاحيات RLS؛ الحد اليومي من إعدادات قواعد الخطة.
import { S, h, rpc, nf, hijri, depName, debounce, fail, icon, choice, badge } from './core.js';
import { C } from './ctx.js';
import { teacherCard, prefs, SORTS } from './tlist.js';
const append = (el, ...k) => el.append(...k.filter((x) => x != null && x !== false));

export async function render(root, ctx) {
  const c = C.cur;
  const saved = prefs.get('home', c.key);
  const f = { dep: c.deps.includes(saved.dep) ? saved.dep : '', sort: saved.sort || 'weakest', q: '' };
  const todayBox = h('div');
  const mineBox = h('div');
  const upBox = h('div');
  // المرحلة 10ب: تنبيه الاختبارات — معلميّ الذين لديهم أشهر بلا ترشيح، الأكثر أولاً (لا يؤخر الصفحة: يُرسم حين يصل)
  const exBox = h('div');
  rpc('rpc_exam_alerts').then(async (list) => {
    if (!list?.length) return;
    const { periodName, arCount } = await import('./exams_logic.js');
    exBox.replaceChildren(h('div', { class: 'section-h' }, icon('alert', 20), h('h2', null, `${arCount(list.length, 'teacher')} لديهم أشهر بلا ترشيح`)),
      h('div', { class: 'card ex' }, list.slice(0, 10).map((t) => h('a', { class: 'list-item row nowrap', style: 'gap:10px;text-decoration:none;color:inherit',
        href: '#/المعلم?' + new URLSearchParams({ id: t.id, تبويب: 'الاختبارات' }) },
        h('div', { class: 'grow' }, h('b', null, t.name), h('div', { class: 'muted xs' }, t.missing.slice(0, 3).map(periodName).join('، ') + (t.missing.length > 3 ? '…' : ''))),
        h('span', { class: 'ex-misstag' }, `لم يرشّح في ${arCount(t.missing_n, 'month')}`))),
        list.length > 10 ? h('p', { class: 'muted xs' }, `و${arCount(list.length - 10, 'teacher')} آخرون`) : null));
  }).catch(() => {});
  // الخطة العلاجية (2026-11-21): خطط معلميّ المفتوحة بسطر واحد لكل معلم («خطة مفتوحة: إنجاز 60٪، الاختبار القادم بعد 12 يوماً»)
  const plBox = h('div');
  rpc('rpc_exam_open_plans').then(async (r) => {
    const rows = (r?.rows || []).filter((x) => x.progress?.n > 0);
    if (!rows.length) return;
    const PL = await import('./plan_logic.js');
    plBox.replaceChildren(h('div', { class: 'section-h' }, icon('clipboard', 20), h('h2', null, 'خطط علاجية مفتوحة')),
      h('div', { class: 'card ex' }, rows.slice(0, 15).map((t) => h('a', { class: 'list-item row nowrap', style: 'gap:10px;text-decoration:none;color:inherit',
        href: '#/المعلم?' + new URLSearchParams({ id: t.teacher_id, تبويب: 'السجل' }) },
        h('div', { class: 'grow' }, h('b', null, t.name), h('div', { class: 'muted xs' }, PL.openLine(t.progress, r.next_exam, { openLine: r.line || '' }))),
        h('span', { class: 'ex-misstag' }, `${Math.round(Number(t.progress.pct || 0) * 100)}٪`)))));
  }).catch(() => {});
  // المرحلة 11: «متابعات الخطط العلاجية» (مستحقة اليوم أو خلال 3 أيام أو متأخرة) — تُرسم حين تصل دون تأخير الصفحة، وتختفي إن كانت مطفأة أو فارغة
  const rpBox = h('div');
  // يُطلب بعد رسم الصفحة وقائمة المعلمين لا معهما (قياس المرحلة 11: لا يزاحم طلبات الإقلاع)
  const loadRp = () => { if (S.profile?.ops?.rplan) rpc('rpc_rplan_due').then(async (d) => {
    if (!d?.on || !d.items?.length) return;
    const m = await import('./rplan.js');
    rpBox.replaceChildren(m.dueCard(d.items, d.texts));
  }).catch(() => {}); };
  // المرحلة 12 (أ): مهام متابعة الخطط بالذكاء الاصطناعي (خلال 7 أيام أو متأخرة) — تختفي إن كانت مطفأة أو فارغة
  const aiBox = h('div');
  const loadAi = () => { if (S.profile?.ops?.rplan_ai) rpc('rpc_rplan_ai_due').then(async (d) => {
    if (!d?.on || !d.tasks?.length) return;
    const m = await import('./rplan_ai.js');
    aiBox.replaceChildren(m.dueCard(d.tasks));
  }).catch(() => {}); };
  const list = h('div', { 'aria-live': 'polite' });
  const cnt = h('div', { class: 'count-line' });
  const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  let offset = 0, seq = 0, total = 0;

  const q = h('input', { type: 'search', placeholder: 'ابحث بالاسم أو رقم الحلقة', enterkeyhint: 'search', 'aria-label': 'بحث في معلميّ' });
  const sort = h('select', { 'aria-label': 'الترتيب', onchange: () => { f.sort = sort.value; save(); reload(); } }, SORTS.map((s) => h('option', { value: s.value }, s.label)));
  sort.value = f.sort;
  const save = () => prefs.set('home', c.key, { dep: f.dep, sort: f.sort });
  // المرحلة 9ج: أقسامي قائمة منسدلة (لا أزرار أفقية تخرج عن الشاشة)
  const depChips = c.deps.length > 1 ? h('div') : null;
  const drawDeps = () => depChips?.replaceChildren(choice([{ value: '', label: 'كل أقسامي' }, ...c.deps.map((d) => ({ value: d, label: depName(d) || d }))], f.dep,
    (v) => { f.dep = v; save(); reload(); }, 'القسم'));
  drawDeps();

  function drawToday(t) {
    const done = t.done || 0, cap = t.cap;
    const full = cap != null && done >= cap;
    const pctv = cap ? Math.min(1, done / cap) : 0;
    const r = 30, L = 2 * Math.PI * r;
    todayBox.replaceChildren(h('section', { class: `card today ${full ? 'full' : ''}`, 'aria-label': `زياراتي اليوم: ${done} من ${cap ?? '—'}` },
      h('div', { class: 'ring', html: `<svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true"><circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--ch-track)" stroke-width="8"/>`
        + `<circle cx="36" cy="36" r="${r}" fill="none" stroke="${full ? 'var(--gold)' : 'var(--ch-1)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${L * pctv} ${L}" transform="rotate(-90 36 36)"/></svg>` },
        h('b', null, nf(done))),
      h('div', { class: 'grow' },
        h('h2', null, 'زياراتي اليوم'),
        h('div', { class: 'big' }, h('b', null, nf(done)), ' من ', h('b', null, cap == null ? '—' : nf(cap)), h('span', { class: 'muted small' }, ` • فترة ${c.periodName}`)),
        h('div', { class: 'muted xs' }, hijri(t.date), full ? (t.mode === 'منع' ? ' • بلغت الحد اليومي' : ' • بلغت الحد اليومي؛ أي زيارة أخرى تحتاج سبباً مكتوباً') : ''),
        t.recording_on ? null : offSlot('feature.visits'))));
  }
  // رسالة «مطفأ» الموحدة (ما المطفأ، ولماذا، ومن يشغّله) تُحمَّل عند الحاجة فقط، فلا تكبر الحزمة الأولى
  function offSlot(key) {
    const el = h('div', { class: 'muted xs', style: 'color:var(--warn)' }, 'تسجيل الزيارات مطفأ الآن.');
    import('./off_notice.js').then((m) => el.replaceWith(m.offNotice(key, { trial: true, what: 'تسجيل الزيارات مطفأ الآن.' }))).catch(() => {});
    return el;
  }

  // «حلقاتي»: عدد الحلقات المسندة إليّ (كلها، وفي الفترة المختارة)، والضغط يفتح تبويب الحلقات (حلقاتي فقط)
  function drawMine(m) {
    if (!m) { mineBox.replaceChildren(); return; }
    mineBox.replaceChildren(h('div', { class: 'stats two' },
      h('a', { class: 'stat info', href: '#/الحلقات', 'aria-label': `حلقاتي: ${nf(m.all)}` }, icon('book', 19), h('b', null, nf(m.all)), h('span', null, 'حلقاتي')),
      h('a', { class: 'stat', href: '#/الحلقات?' + new URLSearchParams({ فترة: c.period || '' }), 'aria-label': `حلقاتي في ${c.periodName}: ${nf(m.period)}` },
        icon('clock', 19), h('b', null, nf(m.period)), h('span', null, `في ${c.periodName}`))));
  }
  // «زياراتي القادمة»: المواعيد التي حددتُها عند حفظ زياراتي (من أحدث زيارة لكل معلم)، والمتأخر منها أولاً
  function drawUpcoming(list) {
    if (!list) return;
    if (!list.length) { upBox.replaceChildren(); return; }
    upBox.replaceChildren(h('div', { class: 'section-h' }, icon('clock', 20), h('h2', null, 'زياراتي القادمة')),
      h('div', { class: 'card' }, list.map((u) => h('a', { class: 'list-item row nowrap upcoming', href: '#/المعلم?' + new URLSearchParams({ id: u.teacher_id }), style: 'gap:10px;text-decoration:none;color:inherit' },
        h('div', { class: 'grow' }, h('b', null, u.teacher), h('div', { class: 'muted xs' }, `الحلقة ${u.halaqa || '—'} • ${u.hijri || hijri(u.date)}`)),
        badge(u.overdue ? `متأخرة ${nf(-u.days)} يوماً` : u.days === 0 ? 'اليوم' : u.days === 1 ? 'غداً' : `بعد ${nf(u.days)} أيام`, u.overdue ? 'bad' : u.days <= 1 ? 'warn' : 'info')))));
  }

  async function load(append) {
    const my = ++seq;
    try {
      const d = await rpc('rpc_supervisor_home', { p_period: c.period, p_department: f.dep || null, p_sort: f.sort, p_q: f.q || null, p_offset: offset });
      if (my !== seq || !ctx.alive()) return;
      if (!append) { drawToday(d.today); drawMine(d.my_halaqat); drawUpcoming(d.upcoming); list.replaceChildren(); }
      total = d.list.total;
      cnt.textContent = `${nf(total)} معلم${f.q ? ' مطابق' : ''} في ${c.periodName}${f.dep ? ' • ' + depName(f.dep) : ''}`;
      if (!d.list.rows.length && !append) list.append(h('p', { class: 'empty' }, f.q ? 'لا يوجد معلم مطابق. جرّب اسماً أقصر أو رقم الحلقة.' : 'لا معلمين مسندين إليك في هذه الفترة.'));
      d.list.rows.forEach((r) => list.append(teacherCard(r, { go: ctx.go, period: c.period, visit: true })));
      offset += d.list.rows.length; more.hidden = offset >= total;
    } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
  }
  function reload() { offset = 0; more.hidden = true; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); return load(false); }
  more.addEventListener('click', async () => { more.disabled = true; await load(true); more.disabled = false; });
  q.addEventListener('input', debounce(() => { f.q = q.value.trim(); reload(); }));

  append(root, todayBox, mineBox, upBox, aiBox, rpBox, exBox, plBox,
    h('div', { class: 'section-h' }, icon('users', 20), h('h2', null, 'معلميّ'), h('a', { class: 'link', href: '#/المعلمون' }, 'بحث متقدم')),
    h('div', { class: 'filters' }, h('div', { class: 'full' }, q), depChips || null, h('div', { class: depChips ? '' : 'full' }, sort)), cnt, list, more);
  await reload();
  loadRp(); loadAi();
}
