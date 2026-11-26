// الحلقات: بحث وتصفية، بطاقات مختصرة، وتفاصيل في ورقة سفلية.
import { S, h, get, count, can, ar, nf, depName, perName, myDepartments, selectOf, field, debounce, badge, sheet, fail, choice } from './core.js';
import { halaqatQuery, SIZE } from './queries.js';
import { C } from './ctx.js';

export const STATUSES = ['الكل', 'نشطة', 'غير نشطة', 'بلا معلم', 'بلا موجه', 'مسندة لي', 'تحتاج تأكيد'];

export function halaqaCard(r, { onTap, extra } = {}) {
  const t = (r.halaqa_teachers || []).filter((x) => !x.valid_to);
  const main = t.find((x) => x.type === 'أساسي') || t[0];
  const sup = (r.halaqa_supervisors || []).find((x) => !x.valid_to);
  const mine = sup && S.profile && sup.person?.id === S.profile.person_id;
  const noCls = !r.is_active ? 'off' : mine ? 'mine' : !sup ? 'free' : '';
  const card = h('div', { class: onTap ? 'card tap' : 'card', role: onTap ? 'button' : null, tabindex: onTap ? '0' : null,
    'aria-label': onTap ? `حلقة ${r.number}` : null },
    h('div', { class: 'hq' },
      h('div', { class: `no ${noCls}` }, h('small', null, 'حلقة'), r.number),
      h('div', { class: 'bd' },
        h('div', { class: 'meta' }, [depName(r.department_code) || 'بلا قسم', perName(r.period_code) || 'بلا فترة'].join(' • ')),
        h('div', { class: 'ln' }, h('span', { class: 'k' }, 'المعلم:'), main ? h('b', null, (main.person?.full_name ?? 'غير ظاهر لك')) : h('b', { class: 'missing' }, 'لا يوجد')),
        h('div', { class: 'ln' }, h('span', { class: 'k' }, 'الموجه:'), sup ? h('b', null, (sup.person?.full_name ?? 'غير ظاهر لك')) : h('b', { class: 'free-t' }, 'غير مسندة')),
        (!r.is_active || r.needs_confirmation || r.sector === 'نساء' || mine) ? h('div', { class: 'tags', style: 'margin-top:6px' },
          mine ? badge('مسندة إليك', 'ok') : null, !r.is_active ? badge('غير نشطة', 'gray') : null,
          r.needs_confirmation ? badge('يحتاج تأكيد', 'warn') : null, r.sector === 'نساء' ? badge('نساء', 'info') : null) : null)),
    extra || null);
  if (onTap) { card.addEventListener('click', () => onTap(r)); card.addEventListener('keydown', (e) => e.key === 'Enter' && onTap(r)); }
  return card;
}

export function halaqaSheet(r) {
  const t = (r.halaqa_teachers || []).filter((x) => !x.valid_to);
  const sup = (r.halaqa_supervisors || []).find((x) => !x.valid_to);
  const kv = (k, v) => [h('dt', null, k), h('dd', null, v)];
  const links = [];
  if (S.profile && (can('self_assign') || can('request_halaqa') || can('assign_supervisor')))
    links.push(h('a', { class: 'btn primary', href: '#/الإسناد?' + new URLSearchParams({ قسم: r.department_code || '', حلقة: r.number }) }, 'الإسناد'));
  if (can('change_period')) links.push(h('a', { class: 'btn', href: '#/الفترات?' + new URLSearchParams({ حلقة: r.number }) }, 'تغيير الفترة'));
  const close = sheet({
    title: `حلقة ${r.number}`,
    body: h('div', null,
      h('dl', { class: 'kv' },
        kv('الحالة', r.is_active ? 'نشطة' : 'غير نشطة'),
        kv('القسم', depName(r.department_code) || 'بلا قسم'),
        kv('الفترة', [perName(r.period_code) || 'بلا فترة', r.period_detail ? `(${ar(r.period_detail)})` : ''].join(' ')),
        kv('القطاع', r.sector || 'غير محدد'),
        kv('المعلمون', t.length ? t.map((x) => `${(x.person?.full_name ?? 'غير ظاهر لك')} (${x.type})`).join('، ') : 'لا يوجد'),
        kv('الموجه', sup ? (sup.person?.full_name ?? 'غير ظاهر لك') : 'غير مسندة'),
        r.needs_confirmation ? kv('يحتاج تأكيد', ar(r.confirmation_reason) || 'نعم') : null,
        r.notes ? kv('ملاحظات', ar(r.notes)) : null),
      links.length ? h('div', { class: 'btns', onclick: () => close() }, links) : null),
    actions: [{ label: 'إغلاق' }],
  });
}

export async function render(root, ctx) {
  // الموجه (سياق «موجه»، أو موجه بلا دور إداري) يرى حلقاته المسندة إليه فقط (المرحلة 9ب). الإسناد وطلب الحلقات في صفحة «الإسناد».
  const asg = S.profile.assignments || [];
  const supView = C.cur ? C.cur.role === 'supervisor' : asg.some((a) => a.role === 'supervisor') && !asg.some((a) => a.role !== 'supervisor');
  const f = { q: '', dep: ctx.query['قسم'] || '', per: ctx.query['فترة'] || '', sector: '', status: supView ? 'مسندة لي' : ctx.query['حالة'] || 'الكل', me: S.profile.person_id };
  const deps = supView && C.cur?.deps?.length ? myDepartments().filter((d) => C.cur.deps.includes(d.code)) : myDepartments();
  const q = h('input', { type: 'search', placeholder: 'رقم الحلقة أو اسم المعلم', enterkeyhint: 'search', 'aria-label': 'بحث' });
  const dep = selectOf(deps, { all: 'كل الأقسام', value: f.dep, onchange: (v) => { f.dep = v; reload(); } });
  const per = selectOf(S.refs.periods.filter((p) => p.is_active || p.code === f.per), { all: 'كل الفترات', value: f.per, onchange: (v) => { f.per = v; reload(); } });
  const sec = S.showWomen ? h('select', { onchange: () => { f.sector = sec.value; reload(); }, 'aria-label': 'القطاع' }, h('option', { value: '' }, 'رجال ونساء'), h('option', { value: 'رجال' }, 'رجال'), h('option', { value: 'نساء' }, 'نساء')) : null;
  const list = h('div', { 'aria-live': 'polite' });
  const cnt = h('div', { class: 'count-line', 'aria-live': 'polite' });
  const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  // المرحلة 9ج: الحالة قائمة منسدلة (كانت أزراراً أفقية تخرج عن شاشة الجوال)
  const chipsBox = supView ? h('div', null, h('span', { class: 'muted small' }, 'حلقاتي المسندة إليّ فقط. لإسناد حلقة أو طلبها افتح «الإسناد».')) : null;
  const stat = supView ? null : choice(STATUSES.filter((s) => s !== 'مسندة لي' || (S.profile.assignments || []).some((a) => a.role === 'supervisor'))
    .map((s) => ({ value: s, label: s === 'الكل' ? 'كل الحالات' : s })), f.status || 'الكل', (v) => { f.status = v; reload(); }, 'الحالة');
  let offset = 0, seq = 0;
  async function load(append) {
    const my = ++seq;
    try {
      const path = halaqatQuery({ ...f, status: f.status === 'الكل' ? '' : f.status }, offset);
      if (!append) count(path).then((n) => { if (my === seq) cnt.textContent = `${nf(n)} حلقة${supView ? ' مسندة إليك' : ''}`; }).catch(() => {});
      const rows = await get(path);
      if (my !== seq) return;
      if (!append) list.replaceChildren();
      if (!rows.length && !append) list.append(h('p', { class: 'empty' }, 'لا توجد حلقات مطابقة.'));
      rows.forEach((r) => list.append(halaqaCard(r, { onTap: halaqaSheet })));
      offset += rows.length;
      more.hidden = rows.length < SIZE;
    } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
  }
  function reload() { offset = 0; more.hidden = true; cnt.textContent = ''; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ البحث…')); load(false); }
  more.addEventListener('click', async () => { more.disabled = true; await load(true); more.disabled = false; });
  q.addEventListener('input', debounce(() => { f.q = q.value; reload(); }));

  root.append(...[
    h('div', { class: (S.showWomen ? 1 : 0) + (stat ? 1 : 0) === 1 ? 'filters f3' : S.showWomen && stat ? 'filters f4' : 'filters' }, h('div', { class: 'full' }, q), dep, per, sec, stat),
    chipsBox, cnt, list, more].filter(Boolean));
  reload();
}
