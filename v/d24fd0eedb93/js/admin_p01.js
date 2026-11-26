// الشاشة 1 — الأقسام والمجموعات: إضافة وتعديل وإيقاف وإعادة تفعيل (لا يُوقف قسم فيه حلقات نشطة، ولا مجموعة فيها أقسام نشطة)،
// وربط القسم بنموذج تقييم **منشور** بتاريخ بدء (اليوم أو بعده). الزيارات القديمة تحفظ نموذجها وقسمها. كل حفظ بمعاينة وسبب.
import { S, h, get, rpc, refs, badge, empty, fail, hijri, today, grpName, arCode } from './core.js';
import { canEdit, previewThenSave } from './panel_ui.js';
import { editSheet, formList, E } from './admin_cfg.js';

export async function render(root) {
  const edit = canEdit('P01');
  const reload = () => { try { sessionStorage.removeItem('tawjeeh.refs'); } catch { /* */ } S.refs = null; root.replaceChildren(); render(root).catch(fail); };
  await refs();
  const t = today();
  const [groups, deps, links, forms, hal] = await Promise.all([
    get('groups?select=code,name,sort_order,is_active&order=sort_order'),
    get('departments?select=code,name,group_code,in_quarterly_exams,sort_order,is_active,notes&order=sort_order'),
    get(`department_forms?select=*&or=(valid_to.is.null,valid_to.gte.${t})&order=valid_from`),
    formList(),
    get('halaqat?select=department_code&is_active=eq.true&limit=5000')]);
  const fName = (c) => forms.find((f) => f.code === c)?.name || c;
  const halN = (c) => hal.filter((x) => x.department_code === c).length;
  const linkOf = (c) => links.filter((l) => l.department_code === c && l.audience_role === 'supervisor');

  root.append(h('p', { class: 'muted' }, 'الرمز يُولَّد آلياً ولا يتغير. تغيير الاسم لا يغيّر أي رقم. ربط القسم بنموذج آخر يسري من تاريخه على الزيارات الجديدة فقط.', edit ? '' : ' (لديك اطلاع فقط.)'),
    edit ? h('div', { class: 'btns', style: 'margin-bottom:8px' },
      h('button', { class: 'btn sm primary', type: 'button', onclick: () => depSheet() }, 'قسم جديد'),
      h('button', { class: 'btn sm soft', type: 'button', onclick: () => grpSheet() }, 'مجموعة جديدة')) : '');

  for (const g of [...groups, { code: null, name: 'بلا مجموعة', is_active: true }]) {
    const list = deps.filter((d) => (d.group_code || null) === g.code);
    if (!g.code && !list.length) continue;
    root.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, g.name), h('span', { class: 'row' }, g.code && arCode(g.code) ? badge(arCode(g.code), 'gray') : null, g.is_active ? null : badge('موقوفة', 'gray'),
        edit && g.code ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => grpSheet(g) }, 'تعديل') : null,
        edit && g.code ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => grpActive(g) }, g.is_active ? 'إيقاف' : 'إعادة تفعيل') : null)),
      list.length ? list.map((d) => {
        const ls = linkOf(d.code); const cur = ls.find((l) => l.valid_from <= t); const next = ls.filter((l) => l.valid_from > t);
        return h('div', { class: 'list-item' },
          h('div', { class: 'row between' }, h('b', null, d.name), h('span', { class: 'row' }, arCode(d.code) ? badge(arCode(d.code), 'gray') : null, d.is_active ? null : badge('موقوف', 'gray'))),
          h('div', { class: 'muted xs' }, `النموذج: ${cur ? fName(cur.form_code) + ' (من ' + hijri(cur.valid_from) + ')' : '— غير مربوط'}`,
            ` • يدخل الاختبارات الفصلية: ${d.in_quarterly_exams == null ? '—' : d.in_quarterly_exams ? 'نعم' : 'لا'} • حلقات نشطة: ${halN(d.code)}`),
          next.map((n) => h('div', { class: 'small', style: 'color:var(--info)' }, `مجدول: ${fName(n.form_code)} من ${hijri(n.valid_from)}`)),
          edit ? h('div', { class: 'btns', style: 'margin-top:4px' },
            h('button', { class: 'btn sm', type: 'button', onclick: () => depSheet(d) }, 'تعديل'),
            h('button', { class: 'btn sm soft', type: 'button', onclick: () => linkSheet(d, cur) }, 'ربط بنموذج'),
            h('button', { class: 'btn sm ghost', type: 'button', onclick: () => depActive(d) }, d.is_active ? 'إيقاف' : 'إعادة تفعيل')) : null);
      }) : empty('لا أقسام في هذه المجموعة.')));
  }

  const grpOpts = groups.filter((g) => g.is_active).map((g) => ({ value: g.code, label: g.name }));
  async function depSheet(d) {
    const r = await editSheet({ title: d ? `تعديل «${d.name}»` : 'قسم جديد', fields: [
      { name: 'name', label: 'الاسم', value: d?.name, required: true },
      { name: 'group', label: 'المجموعة', type: 'select', value: d?.group_code || grpOpts[0]?.value, options: grpOpts },
      { name: 'exams', label: 'يدخل الاختبارات الفصلية', type: 'bool', value: d?.in_quarterly_exams ?? false },
      { name: 'notes', label: 'ملاحظات', type: 'area', value: d?.notes }], ok: 'التالي' });
    if (!r) return;
    const ok = await previewThenSave({ screen: 'P01', title: d ? 'تعديل قسم' : 'قسم جديد',
      draft: { op: 'department', code: d?.code ?? null, name: r.name, group_code: r.group },
      lines: (pv) => [['القسم', r.name], ['المجموعة', grpName(r.group) || r.group], d ? ['الاسم السابق', d.name] : ['الرمز', 'يُولَّد آلياً']],
      save: (reason) => rpc('rpc_department_save', { p_code: d?.code ?? null, p_name: r.name, p_group: r.group, p_in_exams: r.exams, p_sort: null, p_notes: r.notes, p_reason: reason }) });
    if (ok) reload();
  }
  async function depActive(d) {
    const ok = await previewThenSave({ screen: 'P01', title: `${d.is_active ? 'إيقاف' : 'إعادة تفعيل'} «${d.name}»`, okLabel: d.is_active ? 'أوقف' : 'أعد التفعيل',
      draft: { op: 'department', code: d.code, is_active: !d.is_active },
      lines: () => [['القسم', d.name], ['حلقات نشطة', String(halN(d.code))], ['أثره', d.is_active ? 'يختفي من القوائم الجديدة، وتبقى زياراته وتقاريره' : 'يعود إلى القوائم']],
      save: (reason) => rpc('rpc_department_set_active', { p_code: d.code, p_active: !d.is_active, p_reason: reason }) });
    if (ok) reload();
  }
  async function linkSheet(d, cur) {
    const r = await editSheet({ title: `ربط «${d.name}» بنموذج`, intro: 'يُقبل النموذج المنشور فقط. الزيارات قبل تاريخ البدء تبقى على نموذجها.', fields: [
      { name: 'form', label: 'النموذج', type: 'select', value: cur?.form_code, options: forms.map((f) => ({ value: f.code, label: f.name })) },
      { name: 'from', label: 'يسري من', type: 'date', value: t, hint: 'اليوم أو بعده' }], ok: 'معاينة' });
    if (!r) return;
    const ok = await previewThenSave({ screen: 'P01', title: 'ربط القسم بنموذج',
      draft: { op: 'department_form', department_code: d.code, audience_role: 'supervisor', form_code: r.form, valid_from: r.from, scope_ref: d.code },
      lines: (pv) => [['القسم', d.name], ['النموذج الحالي', pv.current_form ? fName(pv.current_form) : '—'], ['الجديد', fName(r.form)], ['يسري من', hijri(r.from)]],
      save: (reason) => rpc('rpc_department_form_link', { p_dept: d.code, p_role: 'supervisor', p_form: r.form, p_from: r.from, p_reason: reason }) });
    if (ok) reload();
  }
  async function grpSheet(g) {
    const r = await editSheet({ title: g ? `تعديل «${g.name}»` : 'مجموعة جديدة', fields: [
      { name: 'name', label: 'الاسم', value: g?.name, required: true }, { name: 'reason', label: 'السبب', required: true }] });
    if (!r) return;
    await rpc('rpc_group_save', { p_code: g?.code ?? null, p_name: r.name, p_sort: null, p_reason: r.reason }); reload();
  }
  async function grpActive(g) {
    const n = deps.filter((d) => d.group_code === g.code && d.is_active).length;
    const ok = await previewThenSave({ screen: 'P01', title: `${g.is_active ? 'إيقاف' : 'إعادة تفعيل'} «${g.name}»`, okLabel: g.is_active ? 'أوقف' : 'أعد التفعيل',
      lines: () => [['المجموعة', g.name], ['أقسام نشطة فيها', String(n)], g.is_active && n ? ['ملاحظة', 'لا تُوقف مجموعة فيها أقسام نشطة؛ سيرفض الحفظ'] : null],
      save: (reason) => rpc('rpc_group_set_active', { p_code: g.code, p_active: !g.is_active, p_reason: reason }) });
    if (ok) reload();
  }
}
