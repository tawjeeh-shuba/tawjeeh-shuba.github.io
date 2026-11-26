// «نشاط التجربة» (الاستعداد التشغيلي، 2026-11-24) لمسؤول الشعبة وحده: كل يوم (الدخول، والزيارات المسجّلة، والبلاغات، وأخطاء الواجهة)،
// ومن دخل وآخر نشاط له، والتنبيهات (دخول الطوارئ وقفل الحسابات)، وأخطاء الواجهة.
import { S, h, rpc, badge, nf, toast, fail, empty } from './core.js';
import { offNotice } from './off_notice.js';

const dt = (t) => (t ? new Date(t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const table = (cols, rows) => h('div', { class: 'ops-scroll' }, h('table', { class: 'ops-table' }, h('thead', null, h('tr', null, ...cols.map((c) => h('th', null, c)))),
  h('tbody', null, ...rows.map((r) => h('tr', null, ...r.map((x) => h('td', null, x)))))));

export async function render(root) {
  const days = h('select', { 'aria-label': 'المدة' }, ...[7, 14, 30].map((d) => h('option', { value: d, selected: d === 14 }, `آخر ${d} يوماً`)));
  const box = h('div');
  root.append(h('div', { class: 'row', style: 'gap:8px' }, days), box);
  async function load() {
    box.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    try {
      const d = await rpc('rpc_ops_activity', { p: { days: Number(days.value) } });
      const unseen = d.alerts.filter((a) => !a.seen_at);
      const seenBtn = unseen.length ? h('button', { class: 'btn sm', type: 'button', onclick: async () => {
        try { await rpc('rpc_ops_alerts_seen', { p_ids: unseen.map((a) => a.id) }); toast('عُلّمت مقروءة', 'ok'); load(); } catch (e) { fail(e); } } }, `تعليم ${nf(unseen.length)} مقروءة`) : null;
      box.replaceChildren(
        h('section', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, 'التنبيهات'), seenBtn),
          d.alerts.length ? d.alerts.map((a) => h('div', { class: 'list-item' }, h('div', null, badge(a.kind, /طوارئ|قفل/.test(a.kind) ? 'bad' : 'gray'), ' ', a.name ? `${a.name} (${a.code})` : '', a.seen_at ? '' : [' ', badge('جديد', 'warn')]),
            h('div', { class: 'muted xs' }, [dt(a.at), a.detail].filter(Boolean).join(' • ')))) : empty('لا تنبيهات.')),
        h('section', { class: 'card' }, h('h2', null, 'كل يوم'),
          table(['اليوم', 'دخول ناجح', 'أشخاص', 'محاولات فاشلة', 'زيارات مسجّلة', 'بلاغات', 'أخطاء الواجهة'],
            d.days.map((x) => [x.day, nf(x.logins), nf(x.people), nf(x.failed), nf(x.visits), nf(x.reports), nf(x.errors)]))),
        h('section', { class: 'card' }, h('h2', null, 'الأشخاص'), h('p', { class: 'muted xs' }, 'المجرّبون أولاً، ثم من دخل في هذه المدة.'),
          d.people.length ? table(['الاسم', 'آخر دخول', 'آخر عملية', 'زيارات في المدة', 'الحالة'],
            d.people.map((p) => [h('span', null, `${p.name} (${p.code})`, p.trial ? [' ', badge('مجرّب', 'warn')] : null), dt(p.last_login_at), dt(p.last_action_at), nf(p.visits), badge(p.is_active ? 'نشط' : 'غير نشط', p.is_active ? 'ok' : 'bad')]))
            : empty('لا أحد دخل في هذه المدة، ولم تُكتب أرقام المجرّبين بعد.')),
        h('section', { class: 'card' }, h('h2', null, 'أخطاء الواجهة'),
          d.errors.length ? table(['آخر مرة', 'المرات', 'الرسالة', 'الصفحة', 'الأدوار', 'الإصدار'],
            d.errors.map((e) => [dt(e.last_at), nf(e.hits), h('span', { dir: 'ltr' }, e.message || '—'), e.page || '—', e.roles || '—', (e.app_version || '').slice(0, 7)]))
            : S.profile?.ops?.errors ? empty('لا أخطاء مسجّلة.') : offNotice('feature.error_capture', { what: 'التقاط أخطاء الواجهة مطفأ الآن، فلا تُحفظ الأخطاء هنا.' })));
    } catch (e) { box.replaceChildren(); fail(e); }
  }
  days.addEventListener('change', load);
  load();
}
