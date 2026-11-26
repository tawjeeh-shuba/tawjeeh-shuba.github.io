// الشاشة 5 — أنواع الزيارات: المدد، والاستثناء من أدنى مدة عامة، والتقييم الكامل، والحساب في الخطة وفي التصنيف الرسمي، والنماذج المسموحة.
// «زيارة المتابعة» موقوفة ابتداءً (د1): تفعيلها = «إعادة تفعيل» في مسودة ثم نشر. الزيارة القديمة تحفظ نوعها.
import { h, get, rpc, badge, fail, toast } from './core.js';
import { canEdit } from './panel_ui.js';
import { versions, pick, versionBar, editSheet, yes, stopped, rowButtons, dot, formList } from './admin_cfg.js';

export async function render(root) {
  const edit = canEdit('P05');
  const reload = () => { root.replaceChildren(); render(root).catch(fail); };
  const vs = await versions('visit_types', null);
  const { live, draft } = pick(vs);
  root.append(h('p', { class: 'muted' }, 'التعديل في مسودة ثم النشر بتاريخ بدء. لتفعيل «المتابعة»: افتح مسودة، ثم «إعادة تفعيل»، ثم انشر.', edit ? '' : ' (لديك اطلاع فقط.)'),
    versionBar({ kind: 'visit_types', subject: null, screen: 'P05', vs, edit, onChange: reload, title: 'إصدارات أنواع الزيارات' }));
  const v = draft || live || vs[0];
  const can = edit && v.status === 'مسودة';
  const [types, forms] = await Promise.all([get(`visit_types?select=*&config_version_id=eq.${v.id}&order=sort_order`), formList()]);
  const ids = types.map((t) => t.id);
  const fName = (c) => forms.find((f) => f.code === c)?.name || c;
  root.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, `الأنواع (${types.filter((t) => t.is_active).length} نشطة)`),
      can ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => sheetFor() }, 'إضافة نوع') : null),
    types.map((t) => h('div', { class: 'list-item' },
      h('div', { class: 'row between' }, h('b', null, dot(t.color), t.name), h('span', { class: 'row' }, stopped(t), t.full_eval ? badge('تقييم كامل', 'info') : badge('مركّز على هدف', 'gray'), h('b', null, `${t.min_minutes}–${t.max_minutes} دقيقة`))),
      t.description ? h('div', { class: 'small muted' }, t.description) : null,
      h('div', { class: 'muted xs' }, `يُستثنى من أدنى مدة عامة: ${yes(t.skip_global_min)} • يُحسب في الخطة: ${yes(t.counts_in_plan)} • يُحسب للتصنيف الرسمي: ${yes(t.counts_for_official)}`,
        ` • النماذج: ${t.allowed_forms?.length ? t.allowed_forms.map(fName).join('، ') : 'الكل'}`),
      can ? rowButtons({ draftId: v.id, table: 'visit_types', row: t, ids, onChange: reload, onEdit: () => sheetFor(t) }) : null))));

  async function sheetFor(t) {
    const r = await editSheet({ title: t ? `تعديل «${t.name}»` : 'نوع زيارة جديد', fields: [
      { name: 'name', label: 'الاسم', value: t?.name, required: true },
      { name: 'description', label: 'الوصف (من الدليل)', type: 'area', value: t?.description },
      { name: 'min_minutes', label: 'أدنى مدة (دقيقة)', type: 'number', step: '1', value: t?.min_minutes ?? 20, required: true },
      { name: 'max_minutes', label: 'أقصى مدة (دقيقة)', type: 'number', step: '1', value: t?.max_minutes ?? 40, required: true },
      { name: 'skip_global_min', label: 'يُستثنى من أدنى مدة عامة', type: 'bool', value: t?.skip_global_min ?? false },
      { name: 'full_eval', label: 'تقييم كامل (يسمح بالشاملة)', type: 'bool', value: t?.full_eval ?? true },
      { name: 'counts_in_plan', label: 'يُحسب في عدد زيارات الخطة', type: 'bool', value: t?.counts_in_plan ?? true },
      { name: 'counts_for_official', label: 'يُحسب للتصنيف الرسمي', type: 'bool', value: t?.counts_for_official ?? true },
      { name: 'forms', label: 'النماذج المسموحة (رموز بفواصل، فارغ = الكل)', value: (t?.allowed_forms || []).join('، '), hint: forms.map((f) => `${f.code} = ${f.name}`).join(' • ') },
      { name: 'color', label: 'اللون', type: 'color', value: t?.color }] });
    if (!r) return;
    const af = (r.forms || '').split(/[،,]/).map((x) => x.trim()).filter(Boolean);
    const { forms: _f, ...p } = r;
    await rpc('rpc_visit_type_save', { p_version: v.id, p_id: t?.id ?? null, p: { ...p, allowed_forms: af.length ? af : null } });
    toast('حُفظ في المسودة', 'ok'); reload();
  }
}
