// المرحلة 11: ما تشترك فيه شاشات الخطط («الخطة» و«اليوم» وتبويب ملف المعلم و«المزيد»): الوصول، والحفظ بالعمليات، وشارات الحالة.
// كل تحقق حقيقي في القاعدة؛ هنا العرض والسؤال عن التأكيد فقط.
import { h, rpc, get, badge, toast, confirmBox, hijri } from './core.js';

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

// الوصول يُجلب مرة في الجلسة (الميزة مطفأة = لا روابط ولا تبويب)
let accessP = null;
export const planAccess = () => (accessP ||= rpc('rpc_plan_access').catch(() => ({ on: false })));
export const resetAccess = () => { accessP = null; };
// أسماء أنواع الزيارات بالعربية (الإصدار الأحدث لكل رمز)، مرة في الجلسة
let typesP = null;
export const visitTypes = () => (typesP ||= get('visit_types?select=code,name&order=config_version_id.desc')
  .then((rows) => rows.filter((t, i, a) => a.findIndex((x) => x.code === t.code) === i)).catch(() => []));

const PLAN_KIND = { 'مسودة': 'gray', 'بانتظار المراجعة': 'warn', 'معدلة بانتظار المراجعة': 'warn', 'مراجَعة بانتظار الاعتماد': 'info', 'بانتظار الاعتماد': 'info', 'معتمدة': 'ok', 'معادة للتعديل': 'bad' };
const ITEM_KIND = { 'مخططة': 'info', 'منفذة': 'ok', 'مؤجلة': 'warn', 'ملغاة': 'gray' };
export const planBadge = (st) => badge(st || 'لم تُنشأ بعد', PLAN_KIND[st] || 'gray');
export const itemBadge = (it) => badge(it.out_of_plan ? 'خارج الخطة' : it.status, it.out_of_plan ? 'gold' : ITEM_KIND[it.status] || 'gray');
export const dayText = (d) => hijri(new Date(d + 'T12:00:00'));
export const visitHref = (it) => '#/زيارة?' + new URLSearchParams({ معلم: it.teacher, حلقة: it.halaqa, سطر: it.id });

// الحفظ بالعمليات: ما يحتاج تأكيد الحد الأقصى يُسأل عنه ثم يُعاد بتأكيد، والتعارض والأخطاء تظهر لكل سطر
export async function saveOps(sup, month, ops) {
  let r = await rpc('rpc_plan_save', { p: { supervisor: sup, month, ops } });
  if (r.confirm?.length) {
    const ok = await confirmBox(r.confirm.map((x) => x.message).join('\n'), 'أضفها مع التجاوز', 'primary');
    if (ok) {
      const again = ops.filter((o) => r.confirm.some((x) => x.id === o.id)).map((o) => ({ ...o, confirm_over: true }));
      const r2 = await rpc('rpc_plan_save', { p: { supervisor: sup, month, ops: again } });
      r = { ...r2, saved: [...r.saved, ...r2.saved], errors: [...r.errors, ...r2.errors], conflicts: [...r.conflicts, ...r2.conflicts] };
    }
  }
  if (r.conflicts?.length) toast(`${r.conflicts.length === 1 ? 'سطر عدّله غيرك' : `${r.conflicts.length} سطور عدّلها غيرك`} قبل حفظك؛ عُرضت النسخة الحالية، فأعد تعديلك عليها`, 'bad');
  else if (r.errors?.length) toast(r.errors.map((x) => x.message).join('؛ '), 'bad');
  else if (r.saved?.length) toast('حُفظت الخطة', 'ok');
  return r;
}

// سطر الزيارة في القوائم (الخطة واليوم وملف المعلم)
export function itemRow(it, { types = [], actions = null, showTeacher = true, extra = null } = {}) {
  const typeName = types.find((t) => t.code === it.type)?.name || '';
  return h('div', { class: 'list-item' },
    h('div', { class: 'row between nowrap', style: 'align-items:flex-start;gap:8px' },
      h('div', { class: 'grow' },
        h('b', null, showTeacher ? it.teacher_name || '—' : dayText(it.date)),
        h('div', { class: 'muted xs' }, [showTeacher ? dayText(it.date) : null, `الحلقة ${it.halaqa}`, typeName, it.time ? `الساعة ${it.time}` : null, extra].filter(Boolean).join(' • ')),
        it.note ? h('div', { class: 'muted xs' }, it.note) : null,
        it.cancel_reason && it.status !== 'منفذة' ? h('div', { class: 'muted xs' }, `السبب: ${it.cancel_reason}`) : null),
      itemBadge(it)),
    actions);
}
