// الشاشة 3 — بنود النموذج ومحاوره: لكل بند المحور والمسار والنص وما يقيسه وما يراعيه الموجه والدرجة القصوى والوزن والشاهد والإلزام.
// النسبة = مجموع (درجة البند × الوزن) ÷ مجموع (الدرجة القصوى × الوزن) للبنود المقيَّمة؛ بالقيم الافتراضية (4 و1) تطابق حساب القديم.
// التعديل في مسودة النموذج فقط (تُفتح من الشاشة 2 أو من هنا)، ثم النشر بتاريخ بدء. الإيقاف لا يحذف، والبند الموقوف يبقى في الزيارات القديمة.
import { h, get, rpc, chips, badge, empty, fail, toast, arCode } from './core.js';
import { canEdit } from './panel_ui.js';
import { versions, pick, versionBar, editSheet, yes, stopped, rowButtons, formList } from './admin_cfg.js';

export async function render(root, ctx, state = {}) {
  const edit = canEdit('P03');
  const forms = await formList();
  if (!forms.length) { root.append(empty('لا نماذج بعد.')); return; }
  let code = state.code || forms[0].code;
  const reload = () => { root.replaceChildren(); render(root, ctx, { code }).catch(fail); };
  root.append(h('p', { class: 'muted' }, 'اختر النموذج. البنود تُعدَّل في المسودة ثم تُنشر؛ «إيقاف» البند يخفيه من الزيارات الجديدة ويبقيه في القديمة.', edit ? '' : ' (لديك اطلاع فقط.)'),
    chips(forms.map((f) => ({ value: f.code, label: f.name })), code, (v) => { code = v; reload(); }));

  const vs = await versions('eval_form', code);
  const { live, draft } = pick(vs);
  root.append(versionBar({ kind: 'eval_form', subject: code, screen: 'P03', vs, edit, onChange: reload, title: 'إصدارات النموذج' }));
  const v = draft || live || vs[0];
  await itemsBody(root, v, reload, edit);
}

// المرحلة 9ب: البنود تحت النموذج نفسه (شجرة) في شاشة «نماذج التقييم». الإصدار المعروض = المسودة إن وُجدت وإلا الساري.
export async function itemsTree(root, code, preVs = null) {
  const edit = canEdit('P03');
  const reload = () => { root.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); itemsTree(root, code).catch(fail); };
  const vs = preVs || await versions('eval_form', code);
  const { live, draft } = pick(vs);
  const v = draft || live || vs[0];
  root.replaceChildren();
  if (!v) { root.append(empty('لا إصدار لهذا النموذج.')); return; }
  if (edit && v.status !== 'مسودة') root.append(h('p', { class: 'muted xs' }, 'لتعديل البنود افتح مسودة من شريط الإصدارات أعلاه.'));
  await itemsBody(root, v, reload, edit);
}

async function itemsBody(root, v, reload, edit) {
  const can = edit && v.status === 'مسودة';
  const [[f], axes, items] = await Promise.all([
    get(`eval_forms?select=id,name,needs_track,tracks,evidence_per_item&config_version_id=eq.${v.id}`),
    get(`eval_axes?select=*&config_version_id=eq.${v.id}&order=sort_order`),
    get(`eval_items?select=*&config_version_id=eq.${v.id}&order=sort_order`)]);
  const trackOpts = f.needs_track ? ['مشترك', ...f.tracks] : ['الكل'];
  const axisIds = axes.map((a) => a.id);

  root.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, `المحاور (${axes.length})`),
      can ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => axisSheet() }, 'إضافة محور') : null),
    axes.map((a) => h('div', { class: 'list-item' },
      h('div', { class: 'row between' }, h('b', null, a.name), h('span', { class: 'row' }, stopped(a), a.has_own_pct ? badge('له نسبة مستقلة', 'info') : null)),
      can ? rowButtons({ draftId: v.id, table: 'eval_axes', row: a, ids: axisIds, onChange: reload, onEdit: () => axisSheet(a) }) : null))));

  for (const a of axes) {
    const list = items.filter((i) => i.axis_id === a.id);
    const ids = list.map((i) => i.id);
    root.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, `${a.name} — ${list.filter((i) => i.is_active).length} بنداً نشطاً`),
        can ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => itemSheet(null, a) }, 'إضافة بند') : null),
      list.length ? list.map((i) => h('div', { class: 'list-item' },
        h('div', { class: 'row between' }, h('b', null, i.name), h('span', { class: 'row' }, stopped(i), arCode(i.code) ? badge(arCode(i.code), 'gray') : null)),
        h('div', { class: 'muted xs' }, `الدرجة القصوى ${+i.max_score} • الوزن ${+i.weight} • المسار ${i.track}`,
          ` • الشاهد ${i.evidence_required == null ? 'حسب النموذج (' + yes(f.evidence_per_item) + ')' : yes(i.evidence_required)}`, i.mandatory_in_full ? ' • إلزامي في الشاملة' : ''),
        i.measures ? h('div', { class: 'small' }, 'ما يقيسه: ', i.measures) : null,
        i.observe_hint ? h('div', { class: 'small muted' }, 'ما يراعيه الموجه: ', i.observe_hint) : null,
        can ? rowButtons({ draftId: v.id, table: 'eval_items', row: i, ids, onChange: reload, onEdit: () => itemSheet(i, a) }) : null)) : empty('لا بنود في هذا المحور.')));
  }

  async function axisSheet(a) {
    const r = await editSheet({ title: a ? 'تعديل محور' : 'محور جديد', fields: [
      { name: 'name', label: 'اسم المحور', value: a?.name, required: true },
      { name: 'has_own_pct', label: 'تُحسب له نسبة مستقلة', type: 'bool', value: a ? a.has_own_pct : true }] });
    if (!r) return;
    await rpc('rpc_eval_axis_save', { p_version: v.id, p_id: a?.id ?? null, p: r }); toast('حُفظ في المسودة', 'ok'); reload();
  }
  async function itemSheet(i, a) {
    const r = await editSheet({ title: i ? `تعديل البند ${arCode(i.code) || i.name}` : 'بند جديد', intro: 'الرمز يُولَّد آلياً ولا يتغير. تغيير الدرجة أو الوزن يسري من تاريخ نشر الإصدار فقط.', fields: [
      { name: 'axis_code', label: 'المحور', type: 'select', value: (axes.find((x) => x.id === i?.axis_id) || a).code, options: axes.filter((x) => x.is_active).map((x) => ({ value: x.code, label: x.name })) },
      { name: 'track', label: 'المسار', type: 'select', value: i?.track || trackOpts[0], options: trackOpts.map((t) => ({ value: t, label: t })) },
      { name: 'name', label: 'نص البند', value: i?.name, required: true },
      { name: 'measures', label: 'ما يقيسه', type: 'area', value: i?.measures },
      { name: 'observe_hint', label: 'ما يراعيه الموجه', type: 'area', value: i?.observe_hint },
      { name: 'max_score', label: 'الدرجة القصوى', type: 'number', value: i ? +i.max_score : 4 },
      { name: 'weight', label: 'الوزن', type: 'number', value: i ? +i.weight : 1 },
      { name: 'evidence_required', label: 'الشاهد', type: 'bool', nullable: true, value: i?.evidence_required ?? null },
      { name: 'mandatory_in_full', label: 'إلزامي في الزيارة الشاملة', type: 'bool', value: i?.mandatory_in_full ?? false }] });
    if (!r) return;
    await rpc('rpc_eval_item_save', { p_version: v.id, p_id: i?.id ?? null, p: r }); toast('حُفظ في المسودة', 'ok'); reload();
  }
}
