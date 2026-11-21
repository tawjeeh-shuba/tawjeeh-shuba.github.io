// الشاشة 4 — مستويات التقييم وسلالم التصنيف.
// المستويات لكل نموذج (درجة، يدخل في الحساب، يتطلب سبباً، «ضعيف»، اللون) تُعدَّل في مسودة النموذج.
// السلالم مستقلة بإصداراتها (ممتاز ≥ 90٪ …)، ويُربط السلّم بالنموذج من الشاشة 2. تصنيف الزيارة القديمة محفوظ فيها ولا يُعاد حسابه.
import { h, get, rpc, seg, choice, badge, empty, fail, toast } from './core.js';
import { canEdit } from './panel_ui.js';
import { versions, pick, versionBar, editSheet, yes, stopped, rowButtons, formList, scaleList, dot } from './admin_cfg.js';

export async function render(root, ctx, state = {}) {
  const edit = canEdit('P04');
  let tab = state.tab || 'المستويات';
  const reload = (extra = {}) => { root.replaceChildren(); render(root, ctx, { ...state, tab, ...extra }).catch(fail); };
  root.append(...(edit ? [] : [h('p', { class: 'muted' }, 'لديك اطلاع فقط.')]),
    seg([{ value: 'المستويات', label: 'مستويات النماذج' }, { value: 'السلالم', label: 'سلالم التصنيف' }], tab, (v) => { tab = v; reload({ tab: v }); }));

  if (tab === 'المستويات') {
    const forms = await formList();
    const code = state.code || forms[0]?.code;
    if (!code) { root.append(empty('لا نماذج بعد.')); return; }
    root.append(h('label', { class: 'field' }, h('span', null, 'النموذج'), choice(forms.map((f) => ({ value: f.code, label: f.name })), code, (v) => reload({ code: v }), 'النموذج')));
    const vs = await versions('eval_form', code);
    const { live, draft } = pick(vs);
    root.append(versionBar({ kind: 'eval_form', subject: code, screen: 'P04', vs, edit, onChange: () => reload({ code }), title: 'إصدارات النموذج' }));
    const v = draft || live || vs[0];
    const can = edit && v.status === 'مسودة';
    const levels = await get(`eval_levels?select=*&config_version_id=eq.${v.id}&order=sort_order`);
    const ids = levels.map((l) => l.id);
    root.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, `المستويات (${levels.length})`),
        can ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => levelSheet() }, 'إضافة مستوى') : null),
      levels.map((l) => h('div', { class: 'list-item' },
        h('div', { class: 'row between' }, h('b', null, dot(l.color), l.name), h('span', { class: 'row' }, stopped(l), h('b', null, l.points == null ? 'بلا درجة' : `${+l.points}`))),
        h('div', { class: 'muted xs' }, `يدخل في الحساب: ${yes(l.counts)} • يتطلب سبباً: ${yes(l.requires_reason)} • يُعد «ضعيفاً»: ${yes(l.is_weakest)}`),
        l.description ? h('div', { class: 'small muted' }, l.description) : null,
        can ? rowButtons({ draftId: v.id, table: 'eval_levels', row: l, ids, onChange: () => reload({ code }), onEdit: () => levelSheet(l) }) : null))));

    async function levelSheet(l) {
      const r = await editSheet({ title: l ? 'تعديل مستوى' : 'مستوى جديد', intro: 'درجة البند = (درجة المستوى ÷ أعلى درجة) × الدرجة القصوى للبند.', fields: [
        { name: 'name', label: 'الاسم', value: l?.name, required: true },
        { name: 'points', label: 'الدرجة (فارغ = بلا درجة)', type: 'number', value: l?.points != null ? +l.points : null },
        { name: 'counts', label: 'يدخل في الحساب', type: 'bool', value: l ? l.counts : true },
        { name: 'requires_reason', label: 'يتطلب سبباً', type: 'bool', value: l?.requires_reason ?? false },
        { name: 'is_weakest', label: 'يُعد «ضعيفاً» في عدّ البنود الضعيفة', type: 'bool', value: l?.is_weakest ?? false },
        { name: 'description', label: 'متى يُختار', type: 'area', value: l?.description },
        { name: 'color', label: 'اللون', type: 'color', value: l?.color }] });
      if (!r) return;
      await rpc('rpc_eval_level_save', { p_version: v.id, p_id: l?.id ?? null, p: r }); toast('حُفظ في المسودة', 'ok'); reload({ code });
    }
    return;
  }

  // ---------- السلالم ----------
  const scales = await scaleList();
  const scode = state.scale || scales[0]?.code;
  root.append(h('div', { class: 'row', style: 'margin:8px 0' }, h('label', { class: 'field grow', style: 'margin:0' }, h('span', null, 'السلّم'), choice(scales.map((s) => ({ value: s.code, label: s.name })), scode, (v) => reload({ scale: v }), 'السلّم')),
    edit ? h('button', { class: 'btn sm soft', type: 'button', onclick: newScale }, 'سلّم جديد') : null));
  if (!scode) { root.append(empty('لا سلالم بعد.')); return; }
  const vs = await versions('grade_scale', scode);
  const { live, draft } = pick(vs);
  root.append(versionBar({ kind: 'grade_scale', subject: scode, screen: 'P04', vs, edit, onChange: () => reload({ scale: scode }), title: 'إصدارات السلّم' }));
  const v = draft || live || vs[0];
  const can = edit && v.status === 'مسودة';
  const [[sc], bands] = await Promise.all([get(`grade_scales?select=*&config_version_id=eq.${v.id}`), get(`grade_bands?select=*&config_version_id=eq.${v.id}&order=sort_order`)]);
  const ids = bands.map((b) => b.id);
  root.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, sc.name),
      can ? h('span', { class: 'btns' }, h('button', { class: 'btn sm', type: 'button', onclick: renameScale }, 'تعديل الاسم'), h('button', { class: 'btn sm soft', type: 'button', onclick: () => bandSheet() }, 'إضافة تقدير')) : null),
    bands.map((b) => h('div', { class: 'list-item' },
      h('div', { class: 'row between' }, h('b', null, dot(b.color), b.name), h('span', { class: 'row' }, stopped(b), b.is_lowest ? badge('أدنى تقدير', 'warn') : null, h('b', null, `≥ ${Math.round(b.min_pct * 1000) / 10}٪`))),
      h('div', { class: 'muted xs' }, `يُعد في قوائم المتابعة: ${yes(b.in_follow_list)}`),
      can ? rowButtons({ draftId: v.id, table: 'grade_bands', row: b, ids, onChange: () => reload({ scale: scode }), onEdit: () => bandSheet(b) }) : null))));

  async function bandSheet(b) {
    const r = await editSheet({ title: b ? 'تعديل تقدير' : 'تقدير جديد', fields: [
      { name: 'name', label: 'الاسم', value: b?.name, required: true },
      { name: 'pct', label: 'أدنى نسبة ٪', type: 'number', value: b ? Math.round(b.min_pct * 1000) / 10 : null, required: true },
      { name: 'is_lowest', label: 'أدنى تقدير', type: 'bool', value: b?.is_lowest ?? false },
      { name: 'in_follow_list', label: 'يُعد في قوائم المتابعة', type: 'bool', value: b?.in_follow_list ?? false },
      { name: 'color', label: 'اللون', type: 'color', value: b?.color }] });
    if (!r) return;
    await rpc('rpc_grade_band_save', { p_version: v.id, p_id: b?.id ?? null, p: { name: r.name, min_pct: r.pct / 100, is_lowest: r.is_lowest, in_follow_list: r.in_follow_list, color: r.color } });
    toast('حُفظ في المسودة', 'ok'); reload({ scale: scode });
  }
  async function renameScale() {
    const r = await editSheet({ title: 'اسم السلّم', fields: [{ name: 'scale_name', label: 'الاسم', value: sc.name, required: true }] });
    if (!r) return;
    await rpc('rpc_grade_band_save', { p_version: v.id, p_id: null, p: r }); reload({ scale: scode });
  }
  async function newScale() {
    const r = await editSheet({ title: 'سلّم جديد', fields: [
      { name: 'name', label: 'اسم السلّم', required: true },
      { name: 'copy', label: 'نسخاً من', type: 'select', value: scode, options: [{ value: '', label: 'سلّم فارغ' }, ...scales.map((s) => ({ value: s.code, label: s.name }))] },
      { name: 'reason', label: 'السبب', required: true }] });
    if (!r) return;
    const id = await rpc('rpc_grade_scale_create', { p_name: r.name, p_copy_from: r.copy, p_reason: r.reason });
    const [ns] = await get(`config_versions?select=subject_key&id=eq.${id}`);
    toast('أُنشئ السلّم مسودة', 'ok'); reload({ scale: ns.subject_key });
  }
}
