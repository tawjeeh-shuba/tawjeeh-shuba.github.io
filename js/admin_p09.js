// الشاشة 9 — قواعد الخطة: الزيارات المقترحة شهرياً لكل تقدير (مع تخصيص لقسم أو فترة)، والحد اليومي لكل فترة ونص الدليل.
// الحد الأدنى لكل حلقة وآخر يوم للإرسال وطريقة تطبيق الحد اليومي إعدادات في «الإعدادات العامة» (مجموعة الخطة).
// الخطط المعتمدة لا تتغير؛ القواعد الجديدة تسري على ما يُقترح بعد تاريخ البدء. مراحل الاعتماد تأتي مع المرحلة 11.
import { S, h, get, rpc, refs, badge, fail, toast, depName, perName } from './core.js';
import { canEdit } from './panel_ui.js';
import { versions, pick, versionBar, editSheet, stopped, rowButtons } from './admin_cfg.js';

export async function render(root) {
  const edit = canEdit('P09');
  await refs();
  const reload = () => { root.replaceChildren(); render(root).catch(fail); };
  const vs = await versions('plan_rules', null);
  const { live, draft } = pick(vs);
  root.append(h('p', { class: 'muted' }, 'التعديل في مسودة ثم النشر بتاريخ بدء. الحد الأدنى لزيارات كل حلقة وطريقة تطبيق الحد اليومي (تحذير/منع) في «الإعدادات العامة».', edit ? '' : ' (لديك اطلاع فقط.)'),
    versionBar({ kind: 'plan_rules', subject: null, screen: 'P09', vs, edit, onChange: reload, title: 'إصدارات قواعد الخطة' }));
  const v = draft || live || vs[0];
  const can = edit && v.status === 'مسودة';
  const scaleV = (await get(`config_versions?select=id&kind=eq.grade_scale&subject_key=eq.VISITS&status=neq.مسودة&valid_from=lte.${new Date().toISOString().slice(0, 10)}&order=valid_from.desc&limit=1`))[0];
  const typesV = (await get(`config_versions?select=id&kind=eq.visit_types&status=neq.مسودة&valid_from=lte.${new Date().toISOString().slice(0, 10)}&order=valid_from.desc&limit=1`))[0];
  const [rules, caps, bands, types, settings] = await Promise.all([
    get(`plan_rules?select=*&config_version_id=eq.${v.id}&order=id`), get(`period_rules?select=*&config_version_id=eq.${v.id}`),
    scaleV ? get(`grade_bands?select=code,name,sort_order&config_version_id=eq.${scaleV.id}&is_active=eq.true&order=sort_order`) : [],
    typesV ? get(`visit_types?select=code,name&config_version_id=eq.${typesV.id}&is_active=eq.true&order=sort_order`) : [],
    get('setting_values?select=key,value,valid_from&key=in.(plan.min_visits_per_halaqa_month,plan.submit_last_day,period.daily_cap_mode)&scope_kind=eq.عام&order=valid_from.desc')]);
  const bandName = (c) => (c == null ? 'لم يُقيَّم' : bands.find((b) => b.code === c)?.name || c);
  const typeName = (c) => types.find((t) => t.code === c)?.name || c || '—';
  const sv = (k) => settings.find((x) => x.key === k && x.valid_from <= new Date().toISOString().slice(0, 10))?.value;
  const scope = (r) => [r.department_code ? 'قسم ' + depName(r.department_code) : null, r.period_code ? 'فترة ' + perName(r.period_code) : null].filter(Boolean).join(' • ') || 'عام';

  root.append(h('div', { class: 'card' }, h('h2', null, 'من الإعدادات العامة'),
    h('dl', { class: 'kv' }, [['الحد الأدنى لزيارات كل حلقة في الشهر', `${sv('plan.min_visits_per_halaqa_month') ?? 2}`], ['آخر يوم لإرسال الخطة', `${sv('plan.submit_last_day') ?? 5} من الشهر`],
      ['تطبيق الحد اليومي', sv('period.daily_cap_mode') ?? 'تحذير']].flatMap(([k, x]) => [h('dt', null, k), h('dd', null, x)]))));

  const pOrder = (c) => S.refs.periods.find((p) => p.code === c)?.sort_order ?? 99;
  caps.sort((a, b) => pOrder(a.period_code) - pOrder(b.period_code));
  root.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, 'الزيارات المقترحة شهرياً لكل تقدير'),
      can ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => ruleSheet() }, 'إضافة تخصيص') : null),
    rules.map((r) => h('div', { class: 'list-item' },
      h('div', { class: 'row between' }, h('b', null, bandName(r.band_code)), h('span', { class: 'row' }, stopped(r), scope(r) !== 'عام' ? badge(scope(r), 'info') : null, h('b', null, `${r.visits_per_month} في الشهر • ${typeName(r.suggested_type)}`))),
      r.note ? h('div', { class: 'muted xs' }, r.note) : null,
      can ? rowButtons({ draftId: v.id, table: 'plan_rules', row: r, onChange: reload, onEdit: () => ruleSheet(r) }) : null))));

  root.append(h('div', { class: 'card' }, h('h2', null, 'الحد اليومي لزيارات الموجه في كل فترة'),
    h('p', { class: 'muted xs' }, 'من الدليل (ج2): الفجر والظهر والعشاء 1–2 (تُقرأ 2)، والعصر والضحى 2، والمغرب 1. الفترات غير المذكورة في الدليل: 2.'),
    caps.map((c) => h('div', { class: 'list-item' },
      h('div', { class: 'row between' }, h('b', null, perName(c.period_code) || c.period_code), h('span', { class: 'row' }, stopped(c), h('b', null, `${c.daily_cap} في اليوم`))),
      h('div', { class: 'muted xs' }, c.guide_text ? `الدليل: ${c.guide_text}` : '', c.guide_text && c.composition ? ' • ' : '', c.composition || (c.guide_text ? '' : 'غير مذكورة في الدليل'), c.max_visits_per_teacher_month ? ` • أقصى زيارات للمعلم شهرياً ${c.max_visits_per_teacher_month}` : ''),
      can ? rowButtons({ draftId: v.id, table: 'period_rules', row: c, onChange: reload, onEdit: () => capSheet(c) }) : null))));

  async function ruleSheet(r) {
    const fields = [
      ...(r ? [] : [
        { name: 'band_code', label: 'التقدير', type: 'select', value: '', options: [{ value: '', label: 'لم يُقيَّم' }, ...bands.map((b) => ({ value: b.code, label: b.name }))] },
        { name: 'department_code', label: 'القسم (فارغ = الكل)', type: 'select', value: '', options: [{ value: '', label: 'كل الأقسام' }, ...S.refs.departments.filter((d) => d.is_active).map((d) => ({ value: d.code, label: d.name }))] },
        { name: 'period_code', label: 'الفترة (فارغ = الكل)', type: 'select', value: '', options: [{ value: '', label: 'كل الفترات' }, ...S.refs.periods.filter((p) => p.is_active).map((p) => ({ value: p.code, label: p.name }))] }]),
      { name: 'visits_per_month', label: 'الزيارات المقترحة شهرياً', type: 'number', step: '1', value: r?.visits_per_month ?? 2, required: true },
      { name: 'suggested_type', label: 'النوع المقترح', type: 'select', value: r?.suggested_type || types[0]?.code, options: types.map((t) => ({ value: t.code, label: t.name })) },
      { name: 'note', label: 'ملاحظة', value: r?.note }];
    const x = await editSheet({ title: r ? `قاعدة «${bandName(r.band_code)}» (${scope(r)})` : 'تخصيص جديد', fields });
    if (!x) return;
    await rpc('rpc_plan_rule_save', { p_version: v.id, p_id: r?.id ?? null, p: x }); toast('حُفظ في المسودة', 'ok'); reload();
  }
  async function capSheet(c) {
    const x = await editSheet({ title: `فترة ${perName(c.period_code)}`, fields: [
      { name: 'daily_cap', label: 'الحد اليومي', type: 'number', step: '1', value: c.daily_cap, required: true },
      { name: 'max_visits_per_teacher_month', label: 'أقصى زيارات للمعلم في الشهر (فارغ = بلا حد، تحذير لا منع)', type: 'number', step: '1', value: c.max_visits_per_teacher_month },
      { name: 'guide_text', label: 'نص الدليل', value: c.guide_text },
      { name: 'composition', label: 'التركيب المقترح / ملاحظة', value: c.composition }] });
    if (!x) return;
    await rpc('rpc_period_rule_save', { p_version: v.id, p_id: c.id, p: x }); toast('حُفظ في المسودة', 'ok'); reload();
  }
}
