// الشاشة 2 — نماذج التقييم: النماذج وإصداراتها، وإعدادات النموذج (نوع التعليم، الشاهد، خانات الإغلاق، النسبة، السلّم، قاعدة «يحتاج متابعة»)،
// وإنشاء نموذج جديد فارغ أو نسخاً من نموذج قائم. التعديل في مسودة ثم النشر بتاريخ بدء. البنود في الشاشة 3، والمستويات في الشاشة 4.
import { h, get, rpc, chips, badge, empty, fail, toast, icon, arCode } from './core.js';
import { canEdit, panelMode } from './panel_ui.js';
import { itemsTree } from './admin_p03.js';
import { versions, pick, versionBar, editSheet, yes, formList, scaleList, E } from './admin_cfg.js';

// المرحلة 9ب: شجرة — الضغط على نموذج يفتح تحته إعداداته وإصداراته، ثم محاوره وبنوده (لا صفحة منفصلة للبنود).
let FORMS = null;   // قائمة النماذج تُحفظ للجلسة (تُحدَّث عند إنشاء نموذج أو إعادة التحميل)
// المرحلة 9ج (السرعة): القائمة وإصدارات كل النماذج تُطلب معاً في طلب واحد متوازٍ، وتبدأ مبكراً من صفحة بطاقات «الزيارات»
// (prefetch)، فيُفتح النموذج الأول دون انتظار طلب الإصدارات وحده. الإصدارات المحفوظة مسبقاً تُستعمل لأول فتح فقط.
let FORMS_P = null, VS_P = null;
export function prefetch() {
  FORMS_P ||= formList().catch((e) => { FORMS_P = null; throw e; });
  VS_P ||= get('config_versions?select=id,kind,subject_key,version_no,status,valid_from,valid_to,note,published_at,copied_from_id&kind=eq.eval_form&order=version_no.desc')
    .catch(() => { VS_P = null; return null; });
  FORMS_P.catch(() => {});
}
export async function render(root, ctx, state = {}) {
  const edit = canEdit('P02');
  if (state.code !== undefined) { FORMS = null; FORMS_P = null; VS_P = null; }
  if (!FORMS) { prefetch(); FORMS = await FORMS_P; }
  const forms = FORMS;
  if (!forms.length) { root.append(empty('لا نماذج بعد.')); return; }
  let openCode = state.code === undefined ? forms[0].code : state.code;
  const reloadAll = (code) => { root.replaceChildren(); render(root, ctx, { code }).catch(fail); };
  root.append(h('p', { class: 'muted' }, 'اضغط النموذج لتظهر تحته إعداداته ثم محاوره وبنوده. كل تعديل يتم في «مسودة» لا تؤثر على شيء، ثم تُنشر بتاريخ بدء، والزيارات القديمة تبقى على إصدارها دائماً.', edit ? '' : ' (لديك اطلاع فقط.)'),
    edit ? h('div', { class: 'btns', style: 'margin:8px 0' }, h('button', { class: 'btn sm soft', type: 'button', onclick: () => create(forms, reloadAll) }, 'نموذج جديد')) : '');
  const nodes = [];
  const tree = h('div', { class: 'ftree', role: 'tree', 'aria-label': 'النماذج وبنودها' }, forms.map((fm) => {
    const body = h('div', { class: 'fbody', hidden: true });
    const head = h('button', { type: 'button', class: 'fhead', role: 'treeitem', 'aria-expanded': 'false', onclick: () => toggle(fm.code) },
      icon('clipboard', 20), h('span', null, fm.name), icon('chev', 18, 'ico chev'));
    nodes.push({ code: fm.code, head, body });
    return h('div', { class: 'fnode' }, head, body);
  }));
  root.append(tree);
  function toggle(code) {
    for (const n of nodes) {
      const on = n.code === code && n.head.getAttribute('aria-expanded') !== 'true';
      n.head.setAttribute('aria-expanded', String(on)); n.body.hidden = !on;
      if (on) { openCode = code; n.body.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); formDetail(n.body, code, ctx, () => reloadAll(code), forms).catch((e) => { n.body.replaceChildren(); fail(e); }); }
    }
  }
  if (openCode) toggle(openCode);
}

async function formDetail(root, code, ctx, reload, forms) {
  const edit = canEdit('P02');
  // أول فتح: من الإصدارات المحمّلة مسبقاً (طلب واحد لكل النماذج)، ثم تُستهلك فتُطلب طازجة في المرات التالية
  const pre = VS_P ? await VS_P : null; VS_P = null;
  const vs = pre ? pre.filter((v) => v.subject_key === code) : await versions('eval_form', code);
  const { live, draft } = pick(vs);
  root.append(versionBar({ kind: 'eval_form', subject: code, screen: 'P02', vs, edit, onChange: reload, title: `إصدارات «${forms.find((f) => f.code === code)?.name}»` }));
  const v = draft || live || vs[0];
  // البنود تحت النموذج تُحمَّل في الوقت نفسه مع بطاقة النموذج (لا واحدة بعد الأخرى) — أسرع فتح
  let itemsP = null;
  const itemsBox = panelMode('P03') ? h('div', { class: 'titems' }, h('p', { class: 'loading' }, 'جارٍ تحميل البنود…')) : null;
  if (itemsBox) itemsP = itemsTree(itemsBox, code, vs).catch((e) => { itemsBox.replaceChildren(); fail(e); });
  const [[f], nItems, nLevels, links, scales] = await Promise.all([
    get(`eval_forms?select=*&config_version_id=eq.${v.id}`),
    get(`eval_items?select=id&config_version_id=eq.${v.id}&is_active=eq.true`), get(`eval_levels?select=code,name&config_version_id=eq.${v.id}&is_active=eq.true&order=sort_order`),
    get(`department_forms?select=department_code&form_code=eq.${E(code)}&or=(valid_to.is.null,valid_to.gte.${new Date().toISOString().slice(0, 10)})`),
    scaleList()]);
  const lvName = (c) => nLevels.find((l) => l.code === c)?.name || c;
  const follow = f.follow_rule?.any?.map((x) => `«${lvName(x.level)}» ${x.min_count} أو أكثر`).join(' أو ') || 'بالتقدير فقط (أدنى تقدير في السلّم)';
  root.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, f.name), h('span', { class: 'row' }, arCode(code) ? badge(arCode(code), 'gray') : null, v.status === 'مسودة' ? badge('مسودة', 'warn') : null)),
    f.description ? h('p', { class: 'muted small' }, f.description) : null,
    h('dl', { class: 'kv' }, [
      ['يستعمله', f.audience === 'mentor' ? 'المرشد' : 'الموجه'],
      ['يطلب نوع التعليم', f.needs_track ? `نعم: ${f.tracks.join('، ')}` : 'لا'],
      ['شاهد لكل بند', yes(f.evidence_per_item)],
      ['خانات الإغلاق', (f.closing_fields || []).map((c) => c.name + (c.required ? ' (إلزامية)' : '')).join('، ') || '—'],
      ['يُحسب نسبة مئوية', yes(f.scored)],
      ['سلّم التصنيف', scales.find((s) => s.code === f.scale_code)?.name || f.scale_code || '—'],
      ['حد التغطية', f.coverage_min != null ? `${Math.round(f.coverage_min * 100)}٪` : 'الإعداد العام'],
      ['«يحتاج متابعة» إذا', follow],
      ['البنود النشطة / المستويات', `${nItems.length} / ${nLevels.length}`],
      ['الأقسام المربوطة', String(new Set(links.map((l) => l.department_code)).size)],
    ].flatMap(([k, x]) => [h('dt', null, k), h('dd', null, x)])),
    edit && draft ? h('div', { class: 'btns' }, h('button', { class: 'btn sm primary', type: 'button', onclick: () => editHeader(f, nLevels, scales) }, 'تعديل إعدادات النموذج (في المسودة)')) : null,
    edit && !draft ? h('p', { class: 'muted xs' }, 'للتعديل افتح مسودة من شريط الإصدارات أعلاه.') : null));
  root.querySelector('.loading')?.remove();
  if (itemsBox) {
    root.append(h('div', { class: 'section-h' }, icon('list', 20), h('h2', null, 'المحاور والبنود')), itemsBox);
    await itemsP;
  }

  async function editHeader(f, levels, scales) {
    const lvOpts = [{ value: '', label: '—' }, ...levels.map((l) => ({ value: l.code, label: l.name }))];
    const r1 = f.follow_rule?.any?.[0] || {}, r2 = f.follow_rule?.any?.[1] || {};
    const r = await editSheet({ title: 'إعدادات النموذج', intro: 'تُحفظ في المسودة فقط حتى النشر.', fields: [
      { name: 'name', label: 'الاسم', value: f.name, required: true },
      { name: 'description', label: 'الوصف', type: 'area', value: f.description },
      { name: 'needs_track', label: 'يطلب نوع التعليم', type: 'bool', value: f.needs_track },
      { name: 'tracks', label: 'مسارات نوع التعليم (بفواصل)', value: (f.tracks || []).join('، '), hint: 'مثل: حضوري، عن بعد' },
      { name: 'evidence_per_item', label: 'شاهد لكل بند', type: 'bool', value: f.evidence_per_item },
      { name: 'closing', label: 'خانات الإغلاق (بفواصل؛ أضف * للإلزامية)', value: (f.closing_fields || []).map((c) => c.name + (c.required ? '*' : '')).join('، ') },
      { name: 'scored', label: 'يُحسب نسبة مئوية', type: 'bool', value: f.scored },
      { name: 'scale_code', label: 'سلّم التصنيف', type: 'select', value: f.scale_code, options: scales.map((s) => ({ value: s.code, label: s.name })) },
      { name: 'coverage', label: 'حد التغطية للتصنيف الرسمي ٪ (فارغ = العام)', type: 'number', value: f.coverage_min != null ? f.coverage_min * 100 : null },
      { name: 'f1_level', label: '«يحتاج متابعة» إذا كان المستوى', type: 'select', value: r1.level, options: lvOpts },
      { name: 'f1_n', label: '… بعدد بنود لا يقل عن', type: 'number', step: '1', value: r1.min_count },
      { name: 'f2_level', label: 'أو المستوى', type: 'select', value: r2.level, options: lvOpts },
      { name: 'f2_n', label: '… بعدد بنود لا يقل عن', type: 'number', step: '1', value: r2.min_count },
    ] });
    if (!r) return;
    const split = (s) => (s || '').split(/[،,]/).map((x) => x.trim()).filter(Boolean);
    const any = [[r.f1_level, r.f1_n], [r.f2_level, r.f2_n]].filter(([l, n]) => l && n).map(([level, n]) => ({ level, min_count: n }));
    await rpc('rpc_eval_form_save', { p_version: v.id, p: {
      name: r.name, description: r.description, needs_track: r.needs_track, tracks: split(r.tracks), evidence_per_item: r.evidence_per_item,
      closing_fields: split(r.closing).map((x) => ({ name: x.replace(/\*$/, '').trim(), required: x.endsWith('*') })),
      scored: r.scored, scale_code: r.scale_code, coverage_min: r.coverage == null ? null : r.coverage / 100, follow_rule: any.length ? { any } : null } });
    toast('حُفظ في المسودة', 'ok'); reload();
  }

}

async function create(forms, reloadAll) {
  const r = await editSheet({ title: 'نموذج جديد', intro: 'يُنشأ مسودة. بعد ضبط بنوده ومستوياته انشره، ثم اربطه بقسم من شاشة «الأقسام».', fields: [
    { name: 'name', label: 'اسم النموذج', required: true },
    { name: 'copy', label: 'نسخاً من', type: 'select', value: '', options: [{ value: '', label: 'نموذج فارغ' }, ...forms.map((x) => ({ value: x.code, label: x.name }))] },
    { name: 'reason', label: 'السبب', required: true }] });
  if (!r) return;
  const id = await rpc('rpc_eval_form_create', { p_name: r.name, p_copy_from: r.copy, p_reason: r.reason });
  const [nf] = await get(`config_versions?select=subject_key&id=eq.${id}`);
  toast('أُنشئ النموذج مسودة', 'ok'); reloadAll(nf.subject_key);
}
