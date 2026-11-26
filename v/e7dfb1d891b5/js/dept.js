// المرحلة 12 (أمر صاحب النظام 2026-11-26 ج): صفحة «قسمي» لمسؤول القسم، ولمسؤول الشعبة ومساعده لكل قسم.
// طلب واحد (rpc_dept_page) يعيد كل الصفحة؛ الحارس الحقيقي في القاعدة (المفتاح feature.dept_page، ونطاق الأقسام، وإخفاء القطاع النسائي، ولا بيانات تجريبية).
import { S, h, rpc, badge, nf, hijri, empty, icon, isDivisionHead } from './core.js';
import { offNotice } from './off_notice.js';

const card = (title, ...kids) => h('section', { class: 'card' }, h('h2', { style: 'margin:0 0 8px' }, title), ...kids);
const stat = (label, n, kind = '') => h('div', { class: `stat ${kind}`, style: 'flex:1;min-width:120px' }, h('b', { style: 'font-size:1.4em;display:block' }, nf(n)), h('span', { class: 'muted xs' }, label));

export async function render(root, ctx) {
  const dept = ctx.query['قسم'] || '';
  const days = Number(ctx.query['أيام'] || 30);
  const d = await rpc('rpc_dept_page', { p_dept: dept || null, p_days: days });
  if (!ctx.alive()) return;
  if (!d.on) {
    root.append(card('قسمي', isDivisionHead() ? offNotice('feature.dept_page', { what: 'صفحة مسؤول القسم مطفأة الآن.' }) : h('p', { class: 'muted' }, 'هذه الصفحة غير متاحة الآن.')));
    return;
  }
  document.getElementById('title').textContent = d.dept.name || 'قسمي';
  const pick = d.depts.length > 1 ? h('select', { 'aria-label': 'القسم', onchange: (e) => ctx.go('قسمي', { قسم: e.target.value, أيام: d.days }) },
    d.depts.map((x) => h('option', { value: x.code, selected: x.code === d.dept.code }, x.name || x.code))) : null;
  const per = h('select', { 'aria-label': 'المدة', onchange: (e) => ctx.go('قسمي', { قسم: d.dept.code, أيام: e.target.value }) },
    [30, 60, 90].map((n) => h('option', { value: n, selected: n === d.days }, `آخر ${nf(n)} يوماً`)));
  const C = d.counts;
  root.append(
    h('section', { class: 'card' },
      h('div', { class: 'row between', style: 'gap:8px;flex-wrap:wrap' }, h('h2', { style: 'margin:0' }, d.dept.name || d.dept.code), h('div', { class: 'row', style: 'gap:6px' }, pick, per)),
      h('p', { class: 'muted xs' }, `منذ ${hijri(d.since)}. الأعداد للحلقات النشطة في القسم${S.showWomen ? '' : ' (بلا القطاع النسائي)'}.`),
      h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-top:6px', 'data-dept-counts': '1' },
        stat('حلقة', C.halaqat), stat('معلماً', C.teachers), stat('موجهاً', C.supervisors), stat('زيارة', C.visits),
        stat('تنتظر «تم الاطلاع»', C.unack, C.unack ? 'warn' : ''), stat('معلماً بلا زيارة في المدة', C.never + C.stale, C.never + C.stale ? 'warn' : ''))),
    card(`الموجهون (${nf(d.supervisors.length)})`,
      d.supervisors.length ? h('div', null, d.supervisors.map((s) => h('div', { class: 'list-item row between nowrap', style: 'gap:8px', 'data-dept-sup': '1' },
        h('div', { class: 'grow' }, h('b', null, s.name), h('div', { class: 'muted xs' }, `${nf(s.halaqat)} حلقة • آخر زيارة: ${s.last ? hijri(s.last) : 'لا زيارة في المدة'}`)),
        h('span', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, badge(`${nf(s.visits)} زيارة`, s.visits ? 'ok' : 'bad'), s.unack ? badge(`${nf(s.unack)} بلا اطلاع`, 'warn') : null))))
        : empty('لا موجهين على حلقات هذا القسم.')),
    card(`زيارات تنتظر «تم الاطلاع» (${nf(C.unack)})`,
      h('p', { class: 'muted xs' }, d.can_ack ? 'افتح ملف المعلم ← «الزيارات» ← الزيارة ← «تم الاطلاع».' : 'الاطلاع لمسؤول القسم نفسه.'),
      d.to_ack.length ? h('div', null, d.to_ack.map((v) => h('a', { class: 'list-item row between nowrap', style: 'gap:8px', href: '#/المعلم?' + new URLSearchParams({ id: v.teacher_id, تبويب: 'الزيارات' }) },
        h('div', { class: 'grow' }, h('b', null, v.teacher), h('div', { class: 'muted xs' }, `${hijri(v.date)} • الحلقة ${v.halaqa} • ${v.supervisor}`)),
        v.classification ? badge(v.classification, 'gray') : null)))
        : empty('لا زيارات تنتظر الاطلاع في هذه المدة.'),
      C.unack > d.to_ack.length ? h('p', { class: 'muted xs' }, `يظهر أحدث ${nf(d.to_ack.length)}.`) : null),
    card(`معلمون بلا زيارة في المدة (${nf(C.never + C.stale)})`,
      h('p', { class: 'muted xs' }, `منهم ${nf(C.never)} بلا أي زيارة مسجّلة. الأقدم أولاً.`),
      d.unvisited.length ? h('div', null, d.unvisited.map((t) => h('a', { class: 'list-item row between nowrap', style: 'gap:8px', href: '#/المعلم?' + new URLSearchParams({ id: t.id }) },
        h('div', { class: 'grow' }, h('b', null, t.name), h('div', { class: 'muted xs' }, `الحلقة ${t.halaqa}`)),
        badge(t.last ? `آخر زيارة ${hijri(t.last)}` : 'لا زيارة', t.last ? 'warn' : 'bad'))))
        : empty('كل المعلمين زيروا في هذه المدة.')),
    d.vsched_waiting != null ? card('خطط الزيارات', h('a', { class: 'list-item row between', href: '#/خطط-الزيارات' }, h('span', null, 'خطط مرفوعة تنتظر الاعتماد'), badge(nf(d.vsched_waiting), d.vsched_waiting ? 'warn' : 'ok'))) : null,
    S.profile?.ops?.tmsg ? card('الرسائل بخصوص معلم', h('a', { class: 'btn sm ghost', href: '#/الرسائل' }, icon('inbox', 18), ' افتح الرسائل')) : null);
}
