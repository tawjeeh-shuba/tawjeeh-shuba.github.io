// المرحلة 11: «الخطة العلاجية للمعلم» — واجهة الموجه (وتجربة مسؤول الشعبة) — تُحمَّل عند الحاجة فقط (import ديناميكي).
// كل نص يأتي من سياق القاعدة (rplan.texts) عبر tx()؛ والنصوص المكتوبة هنا احتياط عند غياب المفتاح فقط.
// كل تحقق حقيقي في القاعدة (rpc_rplan_* و rpc_trial_rplan_*)؛ هنا العرض وتقليل النقرات: قالب مقترح ← سبب الاعتماد ← اعتمد ← تأكيد (4 نقرات).
import { S, h, rpc, badge, icon, hijri, nf, sheet, toast, fail, confirmBox, askForm, isDivisionHead } from './core.js';
import { offNotice } from './off_notice.js';
import { uuid } from './plans_api.js';
import { waTextSheet, waIntl } from './wa.js';

// ---------- النصوص ----------
const FB = {
  tab_title: 'الخطط العلاجية', empty: 'لا توجد خطط لهذا المعلم بعد.', new_btn: 'خطة جديدة', from_visit_hint: 'في الزيارة بنود تحتاج دعماً. أنشئ خطة قصيرة تساعد المعلم؟',
  step_problem: '1. ما نريد تعزيزه', step_goal: '2. الهدف', step_actions: '3. الإجراءات', step_follow: '4. المتابعة', step_approve: '5. الاعتماد',
  lbl_evidence: 'الدليل', lbl_baseline: 'نقطة البداية', lbl_target: 'المستهدف', lbl_weeks: 'المدة (أسابيع)', lbl_owner: 'المنفّذ', lbl_follower: 'المتابِع',
  lbl_indicator: 'مؤشر النجاح', lbl_followup_date: 'موعد المتابعة', lbl_reason: 'سبب الاعتماد دون مراجعة القسم', lbl_reason_free: 'تفصيل إضافي (اختياري)',
  st_draft: 'مسودة', st_active: 'قيد التنفيذ', st_due: 'موعد المتابعة اليوم', st_overdue: 'متابعة متأخرة', st_closed_met: 'أُغلقت: تحقق الهدف',
  st_closed_partial: 'أُغلقت: تحقق جزئياً', st_closed_notmet: 'أُغلقت: لم يتحقق بعد', st_extended: 'ممدّدة', st_cancelled: 'أُلغيت',
  btn_save_draft: 'احفظ مسودة', btn_approve: 'اعتمد الخطة', btn_followup: 'سجّل المتابعة', btn_close: 'أغلق الخطة', btn_extend: 'مدّد الخطة', btn_cancel: 'ألغِ الخطة', btn_wa: 'أرسل واتساب',
  approve_note: 'اعتمدها الموجه بنفسه دون مراجعة القسم.', approve_confirm: 'ستُعتمد الخطة دون مراجعة مسؤول القسم، ويُحفظ اسمك والسبب والتاريخ. تأكيد الاعتماد؟',
  res_met: 'تحقق الهدف', res_partial: 'تحقق جزئياً', res_notmet: 'لم يتحقق بعد', err_reason: 'اختر سبب الاعتماد من القائمة ليتم الاعتماد.',
  err_max_active: 'لهذا المعلم خطة جارية بالعدد الأقصى؛ أغلق إحداها أو أكملها قبل إضافة جديدة.', err_date: 'اختر موعد متابعة بعد تاريخ اليوم.',
  err_max_ext: 'بلغت الخطة حدّ التمديد؛ أغلقها بسبب واضح أو أنشئ خطة جديدة.', err_weeks: 'اجعل المدة بين أسبوع واحد والحدّ المسموح من الأسابيع.',
  off_notice: 'الخطط العلاجية مطفأة حتى يوم البدء، وتُشغَّل في موعدها من مسؤول الشعبة.', trial_banner: 'خطة تجريبية — لا تُحسب ولا يراها أحد.',
  draft_content_banner: 'القوالب مسودة تنتظر اعتمادك قبل اعتمادها للاستعمال.',
  due_today: 'اليوم موعد متابعة خطة {اسم_المعلم}.', overdue: 'تأخّر موعد متابعة خطة {اسم_المعلم} (كان في {موعد_المتابعة}). سجّل المتابعة متى تيسّر.',
};
let TXT = {};
export function setTexts(t) { if (t && typeof t === 'object' && Object.keys(t).length) TXT = t; }
export const tx = (k) => TXT[k] ?? FB[k] ?? '';

// ---------- منطق خالص (بلا واجهة) ----------
// جملة الهدف: الخانات {البداية} و{الهدف} و{المدة}
export const fillGoal = (text, v) => String(text ?? '').split('{البداية}').join(v.baseline).split('{الهدف}').join(v.target).split('{المدة}').join(v.weeks);
export const addDays = (iso, n) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
// موعد المتابعة = اليوم + الأسابيع × 7
export const followUpDate = (today, weeks) => addDays(today, Number(weeks) * 7);
// النتيجة المقترحة بنصف المسافة (كما في القاعدة تماماً)
export function suggestResult(b, t, dir, m) {
  b = Number(b); t = Number(t); m = Number(m);
  if (![b, t, m].every(Number.isFinite) || b === t) return null;
  if (dir === 'down') return m <= t ? 'تحقق' : (b - m) >= (b - t) / 2 ? 'تحقق جزئياً' : 'لم يتحقق';
  return m >= t ? 'تحقق' : (m - b) >= (t - b) / 2 ? 'تحقق جزئياً' : 'لم يتحقق';
}
const RES = { 'تحقق': 'res_met', 'تحقق جزئياً': 'res_partial', 'لم يتحقق': 'res_notmet' };
export const resultLabel = (r) => tx(RES[r]) || r || '';
// الخطة التجريبية تُسطَّح لتُعرض كالحقيقية
export const view = (x) => (x?.trial ? { ...x.plan, id: x.id, rv: x.rv, status: x.status, outcome: x.outcome, teacher_name: x.teacher_name, teacher_id: x.teacher_id,
  halaqa: x.halaqa, due_today: x.due_today, overdue: x.overdue, trial: true, trial_visit: x.trial_visit, can_write: true, can_cancel: ['مسودة', 'نشطة'].includes(x.status),
  followups: x.followups || [], events: x.events || [], extensions: x.plan?.extensions || 0, supervisor_name: x.supervisor_name } : x);
// اسم الحالة ولونها (مع «موعد المتابعة اليوم» و«متابعة متأخرة»)
export function statusInfo(p) {
  const s = p.status;
  if (s === 'مسودة') return { label: tx('st_draft'), kind: 'gray' };
  if (s === 'نشطة') return p.overdue ? { label: tx('st_overdue'), kind: 'bad' } : p.due_today ? { label: tx('st_due'), kind: 'warn' } : { label: tx('st_active'), kind: 'info' };
  if (s === 'مغلقة') return p.outcome === 'تحقق' ? { label: tx('st_closed_met'), kind: 'ok' } : p.outcome === 'تحقق جزئياً' ? { label: tx('st_closed_partial'), kind: 'info' } : { label: tx('st_closed_notmet'), kind: 'warn' };
  if (s === 'ملغاة') return { label: tx('st_cancelled'), kind: 'gray' };
  return { label: s || '', kind: 'gray' };
}
export const actionLines = (acts) => (acts || []).map((a, i) => `${i + 1}- ${a.text}${a.freq ? ` (${a.freq})` : ''}`).join('\n');
// خانة {نقطة_قوة}: إن فرغت تُحذف العبارة التي فيها بسلاسة (لا يبقى «…: .»)
function dropStrength(text) {
  return text.split('\n').map((ln) => {
    if (!ln.includes('{نقطة_قوة}')) return ln;
    const a = ln.replace(/،\s*[^،\n]*\{نقطة_قوة\}/, '');
    if (!a.includes('{نقطة_قوة}')) return a;
    return a.replace(/[^،\n]*\{نقطة_قوة\}[.،]?\s*/, '').trim();
  }).filter((ln) => ln.trim()).join('\n');
}
const fillWa = (key, p, strength) => {
  const t0 = String(tx(key)); const t1 = strength ? t0 : dropStrength(t0);
  return t1.split('{اسم_المعلم}').join(p.teacher_name || '').split('{نقطة_قوة}').join(strength)
    .split('{الهدف}').join(p.goal_text || '').split('{الإجراءات}').join(actionLines(p.actions)).split('{موعد_المتابعة}').join(hijri(p.follow_up_date))
    .split('{اسم_الموجه}').join(S.profile?.full_name || '');
};
const strKey = (id) => 'tawjeeh.rplan.str.' + id;
const getStr = (id) => { try { return sessionStorage.getItem(strKey(id)) || ''; } catch { return ''; } };
const putStr = (id, v) => { try { if (v) sessionStorage.setItem(strKey(id), v); } catch { /* */ } };
const hm = (at) => { try { return new Date(at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
const when = (at) => (at ? `${hijri(at)} ${hm(at)}` : '');

// ---------- عناصر مشتركة ----------
const trialBar = (C) => [h('div', { class: 'trial-banner', role: 'status' }, h('b', null, tx('trial_banner'))),
  C && C.content_approved === false ? h('div', { class: 'note' }, tx('draft_content_banner')) : null];
// «؟»: نص من help_* ؛ لا يظهر الزر إن غاب النص. مساحة اللمس 44×44 داخل الشارة
function help(key) {
  const text = tx(key); if (!text) return null;
  const box = h('div', { class: 'rp-help', role: 'note', hidden: true }, text);
  const btn = h('button', { type: 'button', class: 'rp-q', 'aria-expanded': 'false', 'aria-label': 'شرح', onclick: () => { box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden)); } }, h('span', null, '؟'));
  return { btn, box };
}
const lbl = (text, key) => { const hp = key ? help(key) : null; return [h('div', { class: 'rp-lbl' }, h('span', null, text), hp?.btn), hp?.box]; };
// عدّاد +/− بلا لوحة مفاتيح
function stepper({ get: g, set, min = 0, max = 999, step = 1, label, onChange }) {
  const out = h('output', { 'aria-live': 'polite' });
  const dec = h('button', { type: 'button', class: 'btn', 'aria-label': `إنقاص ${label}` }, '−');
  const inc = h('button', { type: 'button', class: 'btn', 'aria-label': `زيادة ${label}` }, '+');
  const sync = () => { out.textContent = String(g()); dec.disabled = g() <= min; inc.disabled = g() >= max; };
  const move = (d) => () => { set(Math.min(max, Math.max(min, g() + d * step))); sync(); onChange?.(); };
  dec.addEventListener('click', move(-1)); inc.addEventListener('click', move(1));
  sync();
  const el = h('div', { class: 'rp-stp', dir: 'ltr' }, dec, out, inc);
  el.sync = sync;
  return el;
}

// ---------- ورقة الخطة ----------
// opt: {trial, teacher, halaqa, visit (زيارة حقيقية) | trialVisit (زيارة تجريبية), plan (مسودة للتعديل، بعد view), onDone(result)}
export async function planSheet(opt = {}) {
  const { trial = false, plan = null, onDone } = opt;
  const teacher = opt.teacher || plan?.teacher_id, halaqa = opt.halaqa || plan?.halaqa, trialVisit = opt.trialVisit || plan?.trial_visit;
  const C = trial ? await rpc('rpc_trial_rplan_context', { p_trial_visit: trialVisit }) : await rpc('rpc_rplan_context', { p_teacher: teacher, p_halaqa: halaqa, p_visit: opt.visit || null });
  setTexts(C.texts);
  if (!C.on) { offSheet(C); return; }
  if (!C.can_write) { toast('يكتب الخطة موجه الحلقة الحالي وحده', 'bad'); return; }
  const L = C.limits, today = C.today || L.today, tpls = C.templates || [], sugg = C.suggested || [];
  const maxW = L.max_weeks || 8;
  const teacherName = C.teacher?.name || plan?.teacher_name || '';
  const reasons = C.approve_reasons || [];
  const id = plan?.id || uuid();
  putStr(id, C.strength);
  let rv = plan?.rv ?? null;
  let existing = !!plan;
  let tpl = null;
  const X = { title: '', kind: null, problem: null, evidence: [], diag: '', goalT: '', goalEdited: false, metric: null, unit: null, dir: 'up', base: 0, tgt: 0, weeks: L.default_weeks || 4,
    acts: [], owner: '', follower: '', indicator: '', fu: null, fuEdited: false, reason: null, free: '' };
  const fu = () => (X.fuEdited && X.fu ? X.fu : followUpDate(today, X.weeks));
  const goalNow = () => (X.goalEdited ? X.goalT : fillGoal(X.goalT, { baseline: X.base, target: X.tgt, weeks: X.weeks }));

  function fromTemplate(t, ev) {
    tpl = t; const g = t.goal || {};
    Object.assign(X, { title: t.title || '', kind: t.kind || null, problem: t.problem || t.code, evidence: ev || [], diag: '', goalT: g.text || '', goalEdited: false, metric: g.metric || null, unit: g.unit || null,
      dir: g.direction === 'down' ? 'down' : 'up', base: Number(g.baseline ?? 0), tgt: Number(g.target ?? 0), weeks: Math.min(maxW, Math.max(1, Number(t.weeks) || L.default_weeks || 4)),
      acts: (t.actions || []).map((a) => ({ text: a.text, who: a.who || 'المعلم', freq: a.freq || null, on: a.default !== false })), owner: t.owner || '', follower: t.follower || '',
      indicator: t.indicator || '', fu: null, fuEdited: false });
  }
  if (plan) {
    const t = tpls.find((x) => x.code === plan.template_code) || null; tpl = t;
    const have = new Set((plan.actions || []).map((a) => a.text));
    Object.assign(X, { title: plan.title, kind: plan.kind, problem: plan.problem_code, evidence: plan.evidence || [], diag: plan.diagnosis_note || '', goalT: plan.goal_text, goalEdited: true, metric: plan.metric, unit: plan.unit,
      dir: plan.direction, base: Number(plan.baseline), tgt: Number(plan.target), weeks: Number(plan.weeks), owner: plan.owner_label || '', follower: plan.follower_label || '', indicator: plan.indicator || '',
      fu: plan.follow_up_date, fuEdited: true,
      acts: [...(plan.actions || []).map((a) => ({ text: a.text, who: a.who, freq: a.freq || null, on: true })), ...((t?.actions || []).filter((a) => !have.has(a.text)).map((a) => ({ text: a.text, who: a.who || 'المعلم', freq: a.freq || null, on: false })))] });
  }

  // ----- الأقسام الخمسة -----
  const steps = {};
  const mk = (k, title) => {
    const sum = h('small', { class: 'rp-sum' }); const body = h('div', { class: 'rp-body' });
    const d = h('details', { class: 'rp-step', 'data-step': k }, h('summary', null, h('span', { class: 'rp-t' }, title), sum), body);
    steps[k] = { d, sum, body }; return d;
  };
  const open = (k) => { Object.values(steps).forEach((s) => { s.d.open = false; }); steps[k].d.open = true; };
  const sumUp = () => {
    steps.problem.sum.textContent = X.title || '—';
    steps.goal.sum.textContent = `${X.base} ← ${X.tgt} • ${X.weeks} ${X.weeks === 1 ? 'أسبوع' : 'أسابيع'}`;
    steps.actions.sum.textContent = `${nf(X.acts.filter((a) => a.on).length)} إجراء`;
    steps.follow.sum.textContent = hijri(fu());
    steps.approve.sum.textContent = X.reason ? (reasons.find((r) => r.code === X.reason)?.text || '').slice(0, 28) : '—';
  };

  // أعلى الورقة: القوالب المقترحة
  const suggBox = h('div', { class: 'rp-sugg' });
  let moreSugg = false;
  const drawSugg = () => {
    if (!sugg.length) { suggBox.replaceChildren(); return; }
    // بعد اختيار قالب مقترح يبقى هو وحده (وزر «قالب آخر»)، وقبله أول ثلاثة مع «عرض كل المقترحة»
    const sel = sugg.find((x) => x.code === tpl?.code);
    const shown = moreSugg ? sugg : sel ? [sel] : sugg.slice(0, 3);
    const rest = moreSugg ? 0 : sel ? sugg.length - 1 : sugg.length - shown.length;
    suggBox.replaceChildren(h('div', { class: 'rp-lbl' }, h('b', null, C.visit || C.trial_visit ? 'مقترحة من الزيارة' : 'مقترحة من آخر تقييمات المعلم')),
      ...shown.map((s) => h('button', { type: 'button', class: 'rp-tpl', 'aria-pressed': String(tpl?.code === s.code), onclick: () => choose(s.code, s.evidence) },
        h('b', null, s.title),
        h('span', { class: 'muted xs' }, `${tx('lbl_evidence')}: ${(s.evidence || []).slice(0, 2).map((e) => [e.item_name, e.level_name].filter(Boolean).join(' — ')).join('، ')}${(s.evidence || []).length > 2 ? '…' : ''}`))),
      rest > 0 ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { moreSugg = true; drawSugg(); } }, sel ? 'قالب آخر من المقترحة' : `عرض كل المقترحة (${nf(sugg.length)})`) : null);
  };

  // 1) المشكلة
  const tplSel = h('select', { 'aria-label': 'القالب', onchange: () => { if (tplSel.value) choose(tplSel.value, sugg.find((s) => s.code === tplSel.value)?.evidence); } },
    h('option', { value: '' }, '— اختر قالباً —'), ...tpls.map((t) => h('option', { value: t.code }, t.title)));
  const titleIn = h('input', { type: 'text', maxlength: 200, 'aria-label': 'عنوان الخطة', oninput: () => { X.title = titleIn.value; sumUp(); } });
  const evBox = h('div');
  const diagIn = h('textarea', { rows: 2, maxlength: 500, 'aria-label': 'ملاحظة التشخيص', placeholder: 'ملاحظة على التشخيص (اختيارية)', oninput: () => { X.diag = diagIn.value; } });
  const drawEv = () => evBox.replaceChildren(...(X.evidence.length ? [...lbl(tx('lbl_evidence'), 'help_evidence'), h('ul', { class: 'rp-ev' }, X.evidence.map((e) => h('li', null,
    h('b', null, [e.item_name, e.level_name].filter(Boolean).join(' — ') || e.source), h('span', { class: 'muted xs' }, ` ${e.source}${e.date ? ' • ' + hijri(e.date) : ''}`), e.text ? h('div', { class: 'xs' }, e.text) : null)))] : []));
  const s1 = mk('problem', tx('step_problem'));
  steps.problem.body.append(...lbl('القالب', 'help_problem'), tplSel, h('label', { class: 'field', style: 'margin-top:8px' }, h('span', null, 'عنوان الخطة'), titleIn), evBox, h('label', { class: 'field' }, h('span', null, 'ملاحظة التشخيص'), diagIn));

  // 2) الهدف
  const goalBox = h('div', { class: 'rp-goal' });
  const goalEdit = h('textarea', { rows: 3, maxlength: 400, hidden: true, 'aria-label': 'جملة الهدف', oninput: () => { X.goalT = goalEdit.value; X.goalEdited = true; } });
  const goalBtn = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { X.goalT = goalNow(); X.goalEdited = true; goalEdit.value = X.goalT; goalEdit.hidden = false; goalBox.hidden = true; goalBtn.hidden = true; } }, icon('edit', 16), 'عدّل الجملة');
  const drawGoal = () => { goalBox.textContent = goalNow() || '—'; };
  const upd = () => { drawGoal(); fuIn.value = fu(); fuHint.textContent = hijri(fu()); sumUp(); };
  const bS = stepper({ get: () => X.base, set: (v) => { X.base = v; }, label: tx('lbl_baseline'), onChange: upd });
  const tS = stepper({ get: () => X.tgt, set: (v) => { X.tgt = v; }, label: tx('lbl_target'), onChange: upd });
  const wS = stepper({ get: () => X.weeks, set: (v) => { X.weeks = v; }, min: 1, max: maxW, label: tx('lbl_weeks'), onChange: upd });
  const hpBT = help('help_baseline_target'), hpW = help('help_weeks');
  const unitTxt = h('small', { class: 'muted' });
  mk('goal', tx('step_goal'));
  steps.goal.body.append(...lbl('جملة الهدف', 'help_goal'), goalBox, goalEdit, goalBtn,
    h('div', { class: 'rp-row' }, h('div', { class: 'rp-lbl' }, h('span', null, tx('lbl_baseline')), hpBT?.btn), bS), hpBT?.box,
    h('div', { class: 'rp-row' }, h('div', { class: 'rp-lbl' }, h('span', null, tx('lbl_target'))), tS), unitTxt,
    h('div', { class: 'rp-row' }, h('div', { class: 'rp-lbl' }, h('span', null, tx('lbl_weeks')), hpW?.btn), wS), hpW?.box);

  // 3) الإجراءات
  const actBox = h('div');
  const addIn = h('input', { type: 'text', maxlength: 300, placeholder: 'إجراء آخر (اختياري)', 'aria-label': 'إجراء آخر' });
  const addBtn = h('button', { type: 'button', class: 'btn sm soft', onclick: () => {
    const v = addIn.value.trim(); if (!v) return;
    if (X.acts.length >= 6) { toast('الحد الأقصى 6 إجراءات', 'bad'); return; }
    X.acts.push({ text: v, who: 'المعلم', freq: null, on: true }); addIn.value = ''; drawActs();
  } }, icon('plus', 16), 'أضف');
  const drawActs = () => {
    actBox.replaceChildren(...X.acts.map((a) => h('label', { class: 'rp-act' }, h('input', { type: 'checkbox', checked: a.on, onchange: (e) => { a.on = e.target.checked; sumUp(); } }),
      h('span', null, a.text, h('small', { class: 'muted' }, ` — ${a.who}${a.freq ? '، ' + a.freq : ''}`)))));
    sumUp();
  };
  mk('actions', tx('step_actions'));
  steps.actions.body.append(...lbl(tx('step_actions').replace(/^\d+\.\s*/, ''), 'help_actions'), actBox, h('div', { class: 'row nowrap', style: 'margin-top:8px' }, addIn, addBtn));

  // 4) المتابعة
  const ownIn = h('input', { type: 'text', maxlength: 60, 'aria-label': tx('lbl_owner'), oninput: () => { X.owner = ownIn.value; } });
  const folIn = h('input', { type: 'text', maxlength: 60, 'aria-label': tx('lbl_follower'), oninput: () => { X.follower = folIn.value; } });
  const indIn = h('textarea', { rows: 3, maxlength: 400, 'aria-label': tx('lbl_indicator'), oninput: () => { X.indicator = indIn.value; } });
  const fuIn = h('input', { type: 'date', min: addDays(today, 1), max: L.max_follow_up || addDays(today, maxW * 7), 'aria-label': tx('lbl_followup_date'),
    onchange: () => { if (fuIn.value) { X.fu = fuIn.value; X.fuEdited = true; } else { X.fuEdited = false; } fuHint.textContent = hijri(fu()); sumUp(); } });
  const fuHint = h('small');
  mk('follow', tx('step_follow'));
  steps.follow.body.append(h('div', { class: 'filters' }, h('label', { class: 'field' }, h('span', null, tx('lbl_owner')), ownIn), h('label', { class: 'field' }, h('span', null, tx('lbl_follower')), folIn)),
    ...lbl(tx('lbl_indicator'), 'help_indicator'), indIn,
    ...lbl(tx('lbl_followup_date'), 'help_followup_date'), fuIn, fuHint);

  // 5) الاعتماد
  const reasonBox = h('div', { role: 'radiogroup', 'aria-label': tx('lbl_reason') });
  const freeIn = h('textarea', { rows: 2, maxlength: 500, 'aria-label': tx('lbl_reason_free'), oninput: () => { X.free = freeIn.value; } });
  const drawReasons = () => {
    reasonBox.replaceChildren(...reasons.map((r) => h('button', { type: 'button', class: 'rp-opt', role: 'radio', 'aria-pressed': String(X.reason === r.code), 'aria-checked': String(X.reason === r.code),
      onclick: () => { X.reason = r.code; drawReasons(); sumUp(); errBox.hidden = true; } }, r.text)));
  };
  mk('approve', tx('step_approve'));
  steps.approve.body.append(h('div', { class: 'hint' }, icon('info', 18), h('span', null, tx('approve_note'))), ...lbl(tx('lbl_reason'), 'help_approve'), reasonBox,
    h('label', { class: 'field', style: 'margin-top:10px' }, h('span', null, tx('lbl_reason_free')), freeIn));

  // ----- اختيار قالب: يملأ كل شيء -----
  function choose(code, ev) {
    const t = tpls.find((x) => x.code === code); if (!t) return;
    fromTemplate(t, ev || sugg.find((s) => s.code === code)?.evidence || []);
    syncAll(); open('approve'); steps.approve.d.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }
  function syncAll() {
    tplSel.value = tpl?.code || ''; titleIn.value = X.title; diagIn.value = X.diag; drawEv(); drawSugg();
    goalEdit.hidden = true; goalBox.hidden = false; goalBtn.hidden = false;
    bS.sync(); tS.sync(); wS.sync();
    unitTxt.textContent = X.metric ? `المقياس: ${X.metric}` : '';
    ownIn.value = X.owner; folIn.value = X.follower; indIn.value = X.indicator; fuIn.value = fu();
    drawActs(); drawReasons(); upd();
  }

  // ----- التحقق والحفظ -----
  const errBox = h('div', { class: 'err', role: 'alert', hidden: true });
  const fail1 = (k, m) => { errBox.textContent = m; errBox.hidden = false; open(k); errBox.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); return false; };
  function check(approve) {
    if (!tpl && !X.title.trim()) return fail1('problem', 'اختر قالباً من «المقترحة» أو من القائمة ليُملأ كل شيء.');
    if (!X.title.trim()) return fail1('problem', 'اكتب عنوان الخطة.');
    if (!goalNow().trim()) return fail1('goal', 'اكتب جملة الهدف.');
    if (X.base === X.tgt) return fail1('goal', 'المستهدف يساوي نقطة البداية: غيّر أحدهما ليكون للهدف معنى.');
    if (X.dir === 'down' && !(X.tgt < X.base)) return fail1('goal', 'الهدف «الأقل أفضل»: اجعل المستهدف أقل من نقطة البداية.');
    if (X.dir === 'up' && !(X.tgt > X.base)) return fail1('goal', 'الهدف «الأكثر أفضل»: اجعل المستهدف أكبر من نقطة البداية.');
    if (!(X.weeks >= 1 && X.weeks <= maxW)) return fail1('goal', tx('err_weeks'));
    if (!X.acts.some((a) => a.on)) return fail1('actions', 'اختر إجراءً واحداً على الأقل.');
    if (!(fu() > today && fu() <= (L.max_follow_up || addDays(today, maxW * 7)))) return fail1('follow', tx('err_date'));
    if (!existing && C.active_count >= L.max_active) return fail1('problem', tx('err_max_active'));
    if (approve) {
      if (!X.reason && X.free.trim().length < 5) return fail1('approve', tx('err_reason'));
      if (X.reason === 'OTHER' && X.free.trim().length < 5) return fail1('approve', 'اخترت «غير ذلك»: اكتب السبب في «' + tx('lbl_reason_free') + '» (5 أحرف على الأقل).');
    }
    errBox.hidden = true; return true;
  }
  const payload = (approve) => ({ id, ...(trial ? { trial_visit: trialVisit } : { teacher, halaqa, visit: C.visit?.id || null }), ...(existing && rv != null ? { rv } : {}),
    template_code: tpl?.code || null, problem_code: X.problem || null, kind: X.kind || null, title: X.title.trim(), evidence: X.evidence, diagnosis_note: X.diag.trim() || null,
    goal_text: goalNow().trim(), metric: X.metric, unit: X.unit, direction: X.dir, baseline: X.base, target: X.tgt, weeks: X.weeks,
    actions: X.acts.filter((a) => a.on).map((a) => ({ text: a.text, who: a.who, ...(a.freq ? { freq: a.freq } : {}) })),
    owner_label: X.owner.trim() || null, follower_label: X.follower.trim() || null, indicator: X.indicator.trim() || null, follow_up_date: fu(),
    ...(approve ? { approve: true, reason_code: X.reason || null, reason: X.free.trim() || null } : {}) });
  let close;
  async function submit(approve, btn) {
    if (!check(approve)) return;
    if (approve && !(await confirmBox(tx('approve_confirm'), 'اعتمد'))) return;
    const keep = btn.textContent; btn.disabled = true; btn.textContent = 'جارٍ التنفيذ…';
    try {
      const r = await rpc(trial ? 'rpc_trial_rplan_save' : 'rpc_rplan_save', { p: payload(approve) });
      if (r.conflict) { rv = r.plan?.rv ?? rv; toast(r.reason, 'bad'); return; }
      existing = true; rv = r.rv;
      close(); toast(approve ? 'اعتُمدت الخطة' : 'حُفظت المسودة', 'ok'); onDone?.(r);
      if (approve) detailsSheet({ id: r.id, trial, onChange: onDone }).catch(fail);
    } catch (e) { fail(e); } finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = keep; } }
  }
  const bApprove = h('button', { type: 'button', class: 'btn primary', onclick: (e) => submit(true, e.currentTarget) }, icon('check', 20), tx('btn_approve'));
  const bDraft = h('button', { type: 'button', class: 'btn', onclick: (e) => submit(false, e.currentTarget) }, tx('btn_save_draft'));
  const bClose = h('button', { type: 'button', class: 'rp-x', 'aria-label': 'إغلاق', onclick: () => close() }, '×');

  const body = h('div', { class: 'rp' }, ...(trial ? trialBar(C) : []),
    h('div', { class: 'row between nowrap' }, h('div', { class: 'muted small grow' }, `${teacherName}${halaqa ? ' • الحلقة ' + (C.halaqa?.number || halaqa) : ''}`), bClose), suggBox, s1, steps.goal.d, steps.actions.d, steps.follow.d, steps.approve.d, errBox,
    h('div', { class: 'rp-foot' }, h('div', { class: 'rp-foot-main' }, bApprove, bDraft)));
  close = sheet({ title: plan ? 'تعديل المسودة' : tx('new_btn'), body });
  syncAll();
  if (plan) open('approve'); else if (sugg.length) { /* كلها مطوية: النقرة الأولى على قالب مقترح */ } else open('problem');
  sumUp();
}

function offSheet(C) {
  sheet({ title: tx('tab_title'), body: h('div', null, offNotice(C.off_key || 'feature.remedial_plans', { what: tx('off_notice') })), actions: [{ label: 'إغلاق' }] });
}

// ---------- تفاصيل الخطة ----------
export async function detailsSheet({ id, trial = false, onChange } = {}) {
  const d = await rpc(trial ? 'rpc_trial_rplan_get' : 'rpc_rplan_get', { p_id: id });
  setTexts(d.texts);
  const p = view(d), L = d.limits || {};
  const st = statusInfo(p);
  const refresh = () => { close(); onChange?.(); detailsSheet({ id, trial, onChange }).catch(fail); };
  const row = (k, v) => (v ? [h('dt', null, k), h('dd', null, v)] : []);
  const metric = p.metric ? `${p.metric}${p.unit ? ' (' + p.unit + ')' : ''}` : '';
  const evid = (p.evidence || []).map((e) => h('li', null, h('b', null, [e.item_name, e.level_name].filter(Boolean).join(' — ') || e.source),
    h('span', { class: 'muted xs' }, ` ${e.source}${e.date ? ' • ' + hijri(e.date) : ''}`), e.text ? h('div', { class: 'xs' }, e.text) : null));
  const approvedBy = p.trial ? 'أنت (تجريبي)' : (p.approved_by_name || '—');
  const appr = p.approved_at ? h('div', { class: 'rp-appr' }, h('b', null, p.approval_mode || 'دون مراجعة القسم'), h('div', { class: 'small' }, tx('approve_note')),
    h('div', { class: 'small' }, `${approvedBy} • ${when(p.approved_at)}`), p.approval_reason ? h('div', { class: 'small' }, `السبب: ${p.approval_reason}`) : null) : null;
  const fus = (p.followups || []).map((f) => h('li', null, h('b', null, hijri(f.followed_on)), ' ', f.result ? badge(resultLabel(f.result), f.result === 'تحقق' ? 'ok' : f.result === 'تحقق جزئياً' ? 'info' : 'warn') : null,
    h('div', { class: 'xs' }, [f.measured != null ? `القيمة المقيسة: ${f.measured} (المستهدف ${p.target})` : null, f.decision, f.extend_weeks ? `تمديد ${f.extend_weeks} أسابيع حتى ${hijri(f.new_follow_up_date)}` : null, f.by].filter(Boolean).join(' • ')),
    f.extend_reason ? h('div', { class: 'xs' }, `سبب التمديد: ${f.extend_reason}`) : null, f.note ? h('div', { class: 'xs' }, f.note) : null));
  const evs = (p.events || []).map((e) => h('li', null, h('b', null, e.event), h('span', { class: 'muted xs' }, ` ${e.actor || (p.trial ? 'أنت (تجريبي)' : '')} • ${when(e.at)}`), e.note ? h('div', { class: 'xs' }, e.note) : null));
  const canActive = p.can_write && p.status === 'نشطة';
  const waKinds = waKindsFor(p);
  const btns = h('div', { class: 'stack', style: 'margin-top:12px' },
    p.can_write && p.status === 'مسودة' ? h('button', { class: 'btn primary block', type: 'button', onclick: () => { close(); planSheet({ trial, plan: p, onDone: onChange }).catch(fail); } }, icon('edit', 20), 'أكمل المسودة واعتمدها') : null,
    canActive ? h('button', { class: 'btn primary block', type: 'button', onclick: () => followupSheet(p, L, { trial, onDone: refresh }).catch(fail) }, icon('check', 20), tx('btn_followup')) : null,
    waKinds.length && p.can_write ? h('button', { class: 'btn soft block', type: 'button', onclick: () => waSheet(p, waKinds).catch(fail) }, icon('chat', 20), tx('btn_wa')) : null,
    p.can_cancel ? h('button', { class: 'btn danger block', type: 'button', onclick: () => cancelPlan(p, { trial, onDone: refresh }).catch(fail) }, tx('btn_cancel')) : null);
  const close = sheet({ title: p.title, body: h('div', { class: 'rp' }, ...(p.trial ? trialBar(d) : []),
    h('div', { class: 'row', style: 'gap:6px;margin-bottom:6px' }, badge(st.label, st.kind), p.extensions ? badge(tx('st_extended'), 'gold') : null, p.kind ? badge(p.kind, 'gray') : null),
    h('div', { class: 'muted small' }, [p.teacher_name, p.halaqa ? `الحلقة ${p.halaqa}` : null, p.supervisor_name ? `الموجه: ${p.supervisor_name}` : null].filter(Boolean).join(' • ')),
    h('div', { class: 'rp-goal', style: 'margin-top:8px' }, p.goal_text),
    h('dl', { class: 'kv' }, ...row(tx('lbl_baseline'), `${p.baseline} ← ${tx('lbl_target')} ${p.target}${p.unit ? ' ' + p.unit : ''}`), ...row('المقياس', metric), ...row(tx('lbl_weeks'), String(p.weeks ?? '')),
      ...row(tx('lbl_followup_date'), p.status === 'نشطة' || p.status === 'مسودة' ? hijri(p.follow_up_date) : ''), ...row(tx('lbl_owner'), p.owner_label), ...row(tx('lbl_follower'), p.follower_label), ...row(tx('lbl_indicator'), p.indicator)),
    appr,
    evid.length ? h('div', null, h('h3', null, tx('lbl_evidence')), h('ul', { class: 'rp-ev' }, evid)) : null,
    h('h3', null, tx('step_actions').replace(/^\d+\.\s*/, '')), h('ul', { class: 'rp-ev' }, (p.actions || []).map((a) => h('li', null, a.text, h('span', { class: 'muted xs' }, ` — ${a.who}${a.freq ? '، ' + a.freq : ''}`)))),
    fus.length ? h('div', null, h('h3', null, 'المتابعات'), h('ul', { class: 'rp-ev' }, fus)) : null,
    p.status === 'ملغاة' && (p.cancel_reason) ? h('div', { class: 'note' }, `سبب الإلغاء: ${p.cancel_reason}`) : null,
    evs.length ? h('details', null, h('summary', null, `السجل (${nf(evs.length)})`), h('ul', { class: 'rp-ev' }, evs)) : null,
    btns), actions: [{ label: 'إغلاق' }] });
}

// ---------- المتابعة ----------
async function followupSheet(p, L, { trial, onDone }) {
  const maxW = L.max_weeks || 8, canExt = (p.extensions || 0) < (L.max_extensions ?? 2);
  const F = { m: Number(p.baseline), result: null, dec: null, ew: Math.min(maxW, L.default_weeks || 4), er: '', note: '' };
  const sug = () => suggestResult(p.baseline, p.target, p.direction, F.m);
  const res = () => F.result || sug() || 'لم يتحقق';
  const decAuto = () => F.dec || (res() === 'تحقق' ? 'إغلاق' : canExt ? 'تمديد' : 'إغلاق');
  const resBox = h('div', { class: 'rp-seg', role: 'radiogroup', 'aria-label': 'النتيجة' });
  const decBox = h('div', { class: 'rp-seg', role: 'radiogroup', 'aria-label': 'القرار' });
  const extBox = h('div');
  const note = h('textarea', { rows: 2, maxlength: 500, 'aria-label': 'ملاحظة المتابعة', oninput: () => { F.note = note.value; } });
  const noteLbl = h('span');
  const er = h('textarea', { rows: 2, maxlength: 500, 'aria-label': 'سبب التمديد', oninput: () => { F.er = er.value; } });
  const errBox = h('div', { class: 'err', role: 'alert', hidden: true });
  const wS = stepper({ get: () => F.ew, set: (v) => { F.ew = v; }, min: 1, max: maxW, label: 'مدة التمديد', onChange: () => drawDec() });
  const goBtn = h('button', { type: 'button', class: 'btn primary block' });
  const seg = (box, items, cur, pick) => box.replaceChildren(...items.map((i) => h('button', { type: 'button', role: 'radio', class: 'rp-opt', 'aria-pressed': String(cur === i.v), 'aria-checked': String(cur === i.v),
    disabled: !!i.off, onclick: () => pick(i.v) }, i.t, i.s ? h('small', { class: 'muted' }, ` ${i.s}`) : null)));
  const drawRes = () => seg(resBox, ['تحقق', 'تحقق جزئياً', 'لم يتحقق'].map((v) => ({ v, t: resultLabel(v), s: sug() === v ? '(مقترحة)' : '' })), res(), (v) => { F.result = v; F.dec = null; drawRes(); drawDec(); });
  const drawDec = () => {
    const d = decAuto();
    seg(decBox, [{ v: 'إغلاق', t: tx('btn_close') }, { v: 'تمديد', t: tx('btn_extend'), off: !canExt || res() === 'تحقق', s: !canExt ? '' : '' }, { v: 'متابعة مرحلية', t: 'متابعة مرحلية' }], d, (v) => { F.dec = v; drawDec(); });
    extBox.replaceChildren(...(d === 'تمديد' ? [h('div', { class: 'rp-row' }, h('div', { class: 'rp-lbl' }, h('span', null, 'مدة التمديد (أسابيع)')), wS),
      h('small', { class: 'muted' }, `الموعد الجديد: ${hijri(followUpDate(L.today || new Date().toISOString().slice(0, 10), F.ew))}`),
      ...lbl('سبب التمديد', 'help_extend'), er] : []));
    if (!canExt) extBox.append(h('small', { class: 'muted' }, tx('err_max_ext')));
    noteLbl.textContent = d === 'إغلاق' && res() !== 'تحقق' ? 'ملاحظة (لازمة: سبب الإغلاق)' : 'ملاحظة (اختيارية)';
    goBtn.textContent = d === 'إغلاق' ? tx('btn_close') : d === 'تمديد' ? tx('btn_extend') : tx('btn_followup');
    wS.sync();
  };
  const mS = stepper({ get: () => F.m, set: (v) => { F.m = v; F.result = null; F.dec = null; }, label: 'القيمة المقيسة', onChange: () => { drawRes(); drawDec(); } });
  goBtn.addEventListener('click', async () => {
    const d = decAuto(), r = res();
    if (d === 'إغلاق' && r !== 'تحقق' && F.note.trim().length < 5) { errBox.textContent = 'الهدف لم يتحقق كاملاً: اكتب سبب الإغلاق في الملاحظة (5 أحرف على الأقل)، أو اختر «تمديد».'; errBox.hidden = false; return; }
    if (d === 'تمديد' && F.er.trim().length < 5) { errBox.textContent = 'اكتب سبب التمديد (5 أحرف على الأقل).'; errBox.hidden = false; return; }
    errBox.hidden = true;
    const q = { rv: p.rv, decision: d, measured: F.m, result: r, note: F.note.trim() || null, ...(d === 'تمديد' ? { extend_weeks: F.ew, extend_reason: F.er.trim() } : {}) };
    const old = goBtn.textContent; goBtn.disabled = true; goBtn.textContent = 'جارٍ التنفيذ…';
    try {
      const out = trial ? await rpc('rpc_trial_rplan_act', { p_id: p.id, p_action: 'متابعة', p: q }) : await rpc('rpc_rplan_followup', { p: { id: uuid(), plan: p.id, ...q } });
      if (out.conflict) { toast(out.reason, 'bad'); return; }
      close(); toast('سُجّلت المتابعة', 'ok'); onDone?.(out);
    } catch (e) { fail(e); } finally { if (goBtn.isConnected) { goBtn.disabled = false; goBtn.textContent = old; } }
  });
  drawRes(); drawDec();
  const close = sheet({ title: tx('btn_followup'), body: h('div', { class: 'rp' }, ...(trial ? trialBar() : []),
    h('div', { class: 'muted small' }, `${tx('lbl_baseline')}: ${p.baseline} • ${tx('lbl_target')}: ${p.target}${p.unit ? ' ' + p.unit : ''}`),
    ...lbl('القيمة المقيسة', 'help_followup'), h('div', { class: 'rp-row' }, h('div'), mS),
    h('div', { class: 'rp-lbl' }, h('span', null, 'النتيجة')), resBox, h('div', { class: 'rp-lbl' }, h('span', null, 'القرار')), decBox, extBox,
    h('label', { class: 'field', style: 'margin-top:8px' }, noteLbl, note), errBox, goBtn), actions: [{ label: 'تراجع' }] });
}

// ---------- الإلغاء ----------
async function cancelPlan(p, { trial, onDone }) {
  const v = await askForm({ title: tx('btn_cancel'), intro: tx('help_cancel') || null, fields: [{ name: 'reason', label: 'سبب الإلغاء', area: true, required: true }], ok: tx('btn_cancel') });
  if (!v) return;
  const out = trial ? await rpc('rpc_trial_rplan_act', { p_id: p.id, p_action: 'إلغاء', p: { rv: p.rv, reason: v.reason } }) : await rpc('rpc_rplan_cancel', { p_id: p.id, p_rv: p.rv, p_reason: v.reason });
  if (out.conflict) { toast(out.reason, 'bad'); return; }
  toast('أُلغيت الخطة', 'ok'); onDone?.(out);
}

// ---------- واتساب للمعلم (يفتحه الموجه بنفسه) ----------
const WA = { start: ['wa_start', 'بدء الخطة'], reminder: ['wa_reminder', 'تذكير بالمتابعة'], closed: ['wa_closed_met', 'إغلاق ناجح'], extended: ['wa_extended', 'تمديد'] };
function waKindsFor(p) {
  const k = [];
  if (p.status === 'نشطة') { k.push('start', 'reminder'); if (p.extensions) k.push('extended'); }
  else if (p.status === 'مغلقة' && p.outcome === 'تحقق') k.push('closed');
  return k.filter((x) => tx(WA[x][0]));
}
async function waSheet(p, kinds) {
  let cur = p.status === 'مغلقة' ? 'closed' : p.overdue || p.due_today ? 'reminder' : p.extensions && (p.events || []).at(-1)?.event === 'تمديد' ? 'extended' : 'start';
  if (!kinds.includes(cur)) cur = kinds[0];
  let strength = getStr(p.id);
  const logged = new Set();
  const chipsBox = h('div', { class: 'rp-seg', role: 'radiogroup', 'aria-label': 'نوع الرسالة' });
  const sIn = h('input', { type: 'text', maxlength: 120, value: strength, placeholder: 'مثال: حرصه على متابعة طلابه', 'aria-label': 'نقطة قوة (اختيارية)', oninput: () => { strength = sIn.value.trim(); w.refresh(); } });
  const drawKinds = () => chipsBox.replaceChildren(...kinds.map((k) => h('button', { type: 'button', role: 'radio', class: 'rp-opt', 'aria-pressed': String(cur === k), 'aria-checked': String(cur === k), onclick: () => { cur = k; drawKinds(); w.refresh(); } }, WA[k][1])));
  // تسجيل «فُتح للإرسال» مرة لكل نوع رسالة (كما في wa.js)
  const onOpen = () => {
    const kind = WA[cur][0]; if (logged.has(kind)) return; logged.add(kind);
    (p.trial ? rpc('rpc_trial_rplan_act', { p_id: p.id, p_action: 'واتساب', p: { kind } }) : rpc('rpc_rplan_log_wa', { p_id: p.id, p_kind: kind, p_with_phone: !!p.phone }))
      .then(() => toast('سُجّل في «السجل» أن الرسالة فُتحت للإرسال', 'ok'))
      .catch(() => { logged.delete(kind); toast('فُتح واتساب، وتعذّر تسجيل ذلك في السجل', 'bad'); });
  };
  const w = waTextSheet({ title: tx('btn_wa'), phone: waIntl(p.phone), getText: () => fillWa(WA[cur][0], p, strength), onOpen,
    head: [chipsBox, h('label', { class: 'field', style: 'margin-top:8px' }, h('span', null, 'نقطة قوة رأيتها (اختيارية؛ إن تُركت حُذفت من الرسالة)'), sIn)] });
  drawKinds(); w.refresh();
}

// ---------- قسم «الخطط العلاجية» في ملف المعلم ----------
export async function section(state) {
  const { id: tid } = state;
  const box = h('section', { class: 'card rp-sec' });
  let d;
  try { d = await rpc('rpc_rplan_list', { p_teacher: tid }); } catch (e) { box.append(h('h2', null, tx('tab_title')), h('p', { class: 'err' }, 'تعذّر تحميل الخطط العلاجية.')); return box; }
  if (!d.on) { return isDivisionHead() ? h('section', { class: 'card' }, h('h2', null, tx('tab_title')), offNotice('feature.remedial_plans', { what: tx('off_notice') })) : null; }
  const reload = () => state.reloadTab?.();
  const open = (n) => planSheet({ teacher: tid, halaqa: n, onDone: reload }).catch(fail);
  const newBtn = d.halaqat?.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => {
    if (d.halaqat.length === 1) return open(d.halaqat[0]);
    const close = sheet({ title: tx('new_btn'), body: h('div', { class: 'stack' }, d.halaqat.map((n) => h('button', { class: 'pick', type: 'button', onclick: () => { close(); open(n); } }, h('b', null, `حلقة ${n}`)))), actions: [{ label: 'تراجع' }] });
  } }, icon('plus', 20), tx('new_btn')) : null;
  box.append(h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, icon('clipboard', 20), ' ', tx('tab_title')), newBtn),
    d.items.length ? h('div', null, d.items.map((x) => planRow(x, { onChange: reload }))) : h('p', { class: 'empty' }, tx('empty')));
  return box;
}
export function planRow(x, { onChange, trial = false, showTeacher = false } = {}) {
  const v = view(x), st = statusInfo(v);
  return h('button', { type: 'button', class: 'list-item rp-row-btn', onclick: () => detailsSheet({ id: v.id, trial, onChange }).catch(fail) },
    h('div', { class: 'row between nowrap', style: 'align-items:flex-start;gap:8px' },
      h('div', { class: 'grow' }, h('b', null, v.title || v.plan?.title), h('div', { class: 'muted xs' }, [showTeacher ? v.teacher_name : null, v.halaqa ? `الحلقة ${v.halaqa}` : null, v.supervisor_name,
        (v.status === 'نشطة' || v.status === 'مسودة') && v.follow_up_date ? `${tx('lbl_followup_date')}: ${hijri(v.follow_up_date)}` : null].filter(Boolean).join(' • '))),
      h('span', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, badge(st.label, st.kind), v.extensions ? badge(tx('st_extended'), 'gold') : null)));
}

// ---------- بعد حفظ زيارة حقيقية فيها بنود تحتاج دعماً ----------
export async function visitHint({ teacher, halaqa, visit, onStart }) {
  let C; try { C = await rpc('rpc_rplan_context', { p_teacher: teacher, p_halaqa: halaqa, p_visit: visit }); } catch { return null; }
  setTexts(C.texts);
  if (!C.on || !C.can_write || !(C.suggested || []).length) return null;
  return h('div', { class: 'hint rp-hint' }, icon('clipboard', 18), h('div', { class: 'grow' }, h('div', null, tx('from_visit_hint')),
    h('button', { type: 'button', class: 'btn sm primary', style: 'margin-top:8px', onclick: () => onStart() }, 'ابدأ خطة علاجية')));
}

// ---------- بطاقة «متابعات الخطط العلاجية» في صفحة الموجه ----------
export function dueCard(items, texts) {
  setTexts(texts);
  const show = items.slice(0, 8);
  const line = (x) => (x.overdue ? tx('overdue').split('{اسم_المعلم}').join(x.teacher_name).split('{موعد_المتابعة}').join(hijri(x.follow_up_date))
    : tx('due_today').split('{اسم_المعلم}').join(x.teacher_name));
  return h('div', null, h('div', { class: 'section-h' }, icon('clock', 20), h('h2', null, 'متابعات الخطط العلاجية')),
    h('div', { class: 'card' }, show.map((x) => h('button', { type: 'button', class: 'list-item rp-row-btn', onclick: () => detailsSheet({ id: x.id }).catch(fail) },
      h('div', { class: 'row between nowrap', style: 'align-items:flex-start;gap:8px' },
        h('div', { class: 'grow' }, h('b', null, x.teacher_name), h('div', { class: 'muted xs' }, `الحلقة ${x.halaqa} • ${x.due_today || x.overdue ? line(x) : `${tx('lbl_followup_date')}: ${hijri(x.follow_up_date)}`}`)),
        badge(x.overdue ? tx('st_overdue') : x.due_today ? tx('st_due') : `بعد ${nf(x.days)} ${x.days === 1 ? 'يوم' : 'أيام'}`, x.overdue ? 'bad' : x.due_today ? 'warn' : 'info')))),
      items.length > show.length ? h('p', { class: 'muted xs' }, `و${nf(items.length - show.length)} أخرى`) : null));
}

// ---------- الزيارة التجريبية: زر «جرّب خطة علاجية» وخطط هذه الزيارة ----------
export function trialButton(trialVisit, onDone) {
  return h('button', { type: 'button', class: 'btn gold block', onclick: () => planSheet({ trial: true, trialVisit, onDone }).catch(fail) }, icon('clipboard', 20), 'جرّب خطة علاجية');
}
export async function trialBlock(trialVisit, { onChange } = {}) {
  const box = h('div', { class: 'rp-trial' });
  const draw = async () => {
    let rows = []; try { rows = await rpc('rpc_trial_rplans', { p_trial_visit: trialVisit }); } catch { /* */ }
    box.replaceChildren(h('h3', null, tx('tab_title')), trialButton(trialVisit, () => { draw(); onChange?.(); }),
      rows.length ? h('div', { style: 'margin-top:6px' }, rows.map((r) => planRow(r, { trial: true, onChange: () => { draw(); onChange?.(); } }))) : h('p', { class: 'muted xs' }, 'لا خطط تجريبية لهذه الزيارة بعد.'));
  };
  await draw();
  return box;
}
