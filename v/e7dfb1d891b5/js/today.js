// شاشة «اليوم» (المرحلة 11): زيارات خطتي لهذا اليوم، والمتأخرة من الشهر، مع «ابدأ الزيارة» (تُربط الزيارة بسطرها).
import { h, rpc, icon, nf, empty } from './core.js';
import { offNotice } from './off_notice.js';
import { itemRow, visitHref, dayText, visitTypes } from './plans_api.js';

export async function render(root, ctx) {
  const [T, types] = await Promise.all([rpc('rpc_plan_today'), visitTypes()]);
  if (!ctx.alive()) return;
  if (!T.on) { root.append(offNotice('feature.plans', { what: 'الخطط الشهرية مطفأة الآن.' })); return; }   // رسالة «مطفأ» الموحدة
  const todays = T.items.filter((i) => i.date === T.today), late = T.items.filter((i) => i.late);
  const act = (it) => (it.status === 'مخططة' ? h('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, h('a', { class: 'btn sm primary', href: visitHref(it) }, 'ابدأ الزيارة')) : null);
  root.append(
    h('section', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, dayText(T.today)),
      h('a', { class: 'btn sm ghost', href: '#/الخطة' }, icon('cal', 18), 'الخطة الشهرية')),
      h('p', { class: 'muted small' }, `${nf(todays.filter((i) => i.status === 'منفذة').length)} من ${nf(todays.length)} زيارة نُفّذت اليوم`)),
    h('section', { class: 'card' }, h('h2', null, 'زيارات اليوم'), todays.length ? todays.map((it) => itemRow(it, { types, actions: act(it) })) : empty('لا زيارات مخططة لهذا اليوم.')),
    late.length ? h('section', { class: 'card' }, h('h2', null, `متأخرة من هذا الشهر (${nf(late.length)})`),
      h('p', { class: 'muted xs' }, 'نفّذها أو أجّلها أو ألغها من «الخطة الشهرية».'), late.map((it) => itemRow(it, { types, actions: act(it) }))) : null);
}
