// الخطة العلاجية بالذكاء الاصطناعي (أمر صاحب النظام 2026-11-26، الخطوة 2) — واجهة الموجه في ملف المعلم ← «الخطط»، وبطاقة المهام في صفحته.
// تُحمَّل عند الحاجة فقط. كل تحقق حقيقي في القاعدة (rpc_rplan_ai_*)؛ هنا: نسخ الأمر، ولصق الرد وقراءته، ومراجعة البنود، والاعتماد بسبب.
// الأمان: النص الملصوق والرد يُعرضان نصاً فقط (h() يضع textContent؛ لا innerHTML هنا إطلاقاً)، والحد 30000 حرف، ولا يضيع الملصوق (يُحفظ في الجهاز).
import { S, h, rpc, badge, icon, hijri, nf, sheet, toast, fail, confirmBox, askForm, isDivisionHead } from './core.js';
import { offNotice } from './off_notice.js';
import { uuid } from './plans_api.js';
import { parsePlan, validatePlan, MAX_CHARS, OWNERS } from './rplan_ai_parse.js';
import { buildPrompt, privacyIssues, variableText, PROMPT_VERSION } from './rplan_ai_prompt.js';

const T = {
  title: 'الخطة العلاجية بالذكاء الاصطناعي',
  copy: 'انسخ أمر الخطة', paste: 'الصق رد الذكاء الاصطناعي', read: 'اقرأ الخطة', approve: 'اعتمد الخطة', draft: 'احفظ مسودة',
  privacy1: 'قبل أن تلصق الأمر في أي ذكاء اصطناعي: راجع نصه وتأكد أنه لا يحوي اسم معلم أو طالب أو مسجد أو حلقة أو رقم جوال.',
  privacy2: 'التنظيف الآلي يحذف الأشهر ولا يضمن حذف كل شيء، وأنت المسؤول عن مراجعة الملاحظات قبل الإرسال.',
  how: '1) اختر الزيارة واضغط «انسخ أمر الخطة». 2) الصقه في Claude أو ChatGPT. 3) انسخ الرد كله والصقه هنا. 4) اضغط «اقرأ الخطة» وراجع البنود ثم اعتمدها.',
  fallback: 'خطة من قالب (بدون ذكاء اصطناعي)',
};
const ST = { 'مسودة': ['مسودة', 'warn'], 'معتمدة': ['معتمدة', 'ok'], 'ملغاة': ['ملغاة', ''] };
const KEY = (teacher, visit) => `tawjeeh.rpai.${teacher}.${visit}`;
const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* */ } },
};
const field = (label, el, hint) => h('label', { class: 'field' }, h('span', null, label), el, hint ? h('small', null, hint) : null);
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

// الحقيقي (ملف المعلم) والتجريبي (الزيارة التجريبية، 2026-11-26 ج س12): الواجهة نفسها، والدوال مختلفة، والتجريبي في جدول تجريبي وحده
const REAL = { prompt: (v) => rpc('rpc_rplan_ai_prompt', { p_visit: v.id }), save: (body) => rpc('rpc_rplan_ai_save', { p: body }), trial: false };
const TRIAL = { prompt: (v) => rpc('rpc_trial_rplan_ai_prompt', { p_trial_visit: v.id }), save: (body) => rpc('rpc_trial_rplan_ai_save', { p: body }), trial: true };

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// ---------- القسم في ملف المعلم ----------
export async function section(state) {
  const tid = state.id;
  const box = h('section', { class: 'card rpai-sec', 'data-rpai': '1' });
  let d;
  try { d = await rpc('rpc_rplan_ai_list', { p_teacher: tid }); } catch { box.append(h('h2', null, T.title), h('p', { class: 'err' }, 'تعذّر تحميل الخطط بالذكاء الاصطناعي.')); return box; }
  if (!d.on) return isDivisionHead() ? h('section', { class: 'card' }, h('h2', null, T.title), offNotice('feature.rplan_ai', { what: 'الخطة العلاجية بالذكاء الاصطناعي مطفأة الآن.' })) : null;
  const reload = () => state.reloadTab?.();
  box.append(h('h2', { style: 'margin:0 0 6px' }, icon('clipboard', 20), ' ', T.title));
  if (d.visits?.length) box.append(composer(state, d, reload));
  else box.append(h('p', { class: 'muted small' }, 'زر «انسخ أمر الخطة» يظهر لموجه الحلقة بعد حفظ زيارة لهذا المعلم.'));
  box.append(d.plans.length ? h('div', { style: 'margin-top:10px' }, d.plans.map((p) => planRow(p, d, reload))) : h('p', { class: 'empty' }, 'لا خطط بالذكاء الاصطناعي لهذا المعلم بعد.'));
  // القوالب العشرون: خيار احتياطي صغير
  if (S.profile?.ops?.rplan && d.visits?.length) {
    box.append(h('p', { class: 'small', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'linkish', onclick: () => import('./rplan.js')
      .then((m) => m.planSheet({ teacher: tid, halaqa: d.visits[0].halaqa, visit: d.visits[0].id, onDone: reload })).catch(fail) }, T.fallback)));
  }
  return box;
}

function composer(state, d, reload, api = REAL) {
  const tid = state.id;
  let visit = d.visits[0];
  const wrap = h('div', { class: 'rpai-compose' });
  const pick = d.visits.length > 1 ? h('select', { 'aria-label': 'الزيارة', onchange: () => { visit = d.visits.find((v) => v.id === pick.value); ta.value = store.get(KEY(tid, visit.id)); out.replaceChildren(); } },
    d.visits.map((v) => h('option', { value: v.id }, `زيارة ${hijri(v.date)} — الحلقة ${v.halaqa}`))) : null;
  const promptBox = h('div');
  const copyBtn = h('button', { type: 'button', class: 'btn primary block', 'data-act': 'rpai-copy', onclick: async () => {
    copyBtn.disabled = true;
    try {
      const data = await api.prompt(visit);
      data.mastery = !!S.profile?.ops?.rpai_mastery;   // المرحلة 12: قاعدة «الإتقان قبل المقدار» إن شُغّل إعدادها
      const text = buildPrompt(data);
      // الفحص على القيم المتغيرة وحدها (المراجعة المستقلة م1)، والرقم الطويل على الأمر كله
      const bad = privacyIssues(variableText(data), { teacherName: state.f?.name || '', halaqa: visit.halaqa });
      if (bad.length) { promptBox.replaceChildren(h('p', { class: 'err' }, bad.join(' '))); return; }
      const ok = await copyText(text);
      // دائماً يظهر الأمر للمراجعة (وللنسخ اليدوي إن منع المتصفح النسخ)
      const area = h('textarea', { readonly: true, rows: 6, class: 'rpai-prompt', 'aria-label': 'نص الأمر' }); area.value = text;
      promptBox.replaceChildren(h('p', { class: ok ? 'ok small' : 'warn small' }, ok ? '✓ نُسخ الأمر. الصقه في Claude أو ChatGPT، ثم الصق الرد في المربع أدناه.' : 'لم يسمح المتصفح بالنسخ: اضغط داخل المربع واختر «تحديد الكل» ثم «نسخ».'),
        h('details', null, h('summary', null, 'اعرض نص الأمر'), area));
      if (!ok) { area.focus(); area.select(); }
    } catch (e) { fail(e); } finally { copyBtn.disabled = false; }
  } }, icon('clipboard', 18), ' ', T.copy);
  const ta = h('textarea', { rows: 6, placeholder: 'الصق هنا رد الذكاء الاصطناعي كاملاً', 'aria-label': T.paste, 'data-act': 'rpai-paste',
    oninput: () => store.set(KEY(tid, visit.id), ta.value) });
  ta.value = store.get(KEY(tid, visit.id));
  const out = h('div', { class: 'rpai-out' });
  const readBtn = h('button', { type: 'button', class: 'btn block', 'data-act': 'rpai-read', onclick: () => {
    const r = parsePlan(ta.value);
    out.replaceChildren(editor({ tid, visit, raw: ta.value, parsed: r, d, api, onDone: () => { store.set(KEY(tid, visit.id), ''); reload(); } }));
  } }, T.read);
  wrap.append(...[h('p', { class: 'muted xs' }, T.how), pick ? field('الزيارة', pick) : null, copyBtn,
    h('div', { class: 'rpai-note', role: 'note', style: 'margin-top:6px' }, h('p', { class: 'small', style: 'margin:0' }, T.privacy1), h('p', { class: 'muted xs', style: 'margin:4px 0 0' }, T.privacy2)),
    promptBox, field(T.paste, ta, `حتى ${nf(MAX_CHARS)} حرف. يُحفظ في جهازك حتى تعتمد الخطة.`), readBtn, out].filter(Boolean));
  return wrap;
}

// ---------- المراجعة: قبول كل بند أو تعديله أو حذفه، وإضافة بند، ثم «اعتمد الخطة» بسبب ----------
function editor({ tid, visit, raw, parsed, d, onDone, existing = null, api = REAL }) {
  const plan = JSON.parse(JSON.stringify(existing ? existing.plan : parsed.plan));
  const accepted = new Set();
  const issues = existing ? (existing.issues || []) : parsed.issues;
  const root = h('div', { class: 'rpai-ed', 'data-rpai-ed': '1' });
  let reason = null; const free = h('input', { type: 'text', maxlength: '500', placeholder: 'أو اكتب السبب بنفسك (5 أحرف على الأقل)', 'aria-label': 'سبب الاعتماد' });
  const errBox = h('div', { class: 'err', hidden: true, role: 'alert' });
  function draw() {
    const items = plan.items.map((it, i) => itemCard(it, i));
    const reasons = (d.approve_reasons || []).filter((r) => r.code !== 'OTHER');
    root.replaceChildren(
      issues.length ? h('div', { class: 'rpai-note warn', role: 'note', 'data-rpai-issues': String(issues.length) }, h('b', null, `ملاحظات القراءة (${nf(issues.length)}):`),
        h('ul', { class: 'small' }, issues.map((m) => h('li', null, m)))) : h('p', { class: 'ok small' }, '✓ قُرئ الرد كاملاً بلا ملاحظات.'),
      plan.strengths.length || plan.weaknesses.length ? h('div', { class: 'rpai-sw' },
        listBlock('نقاط القوة', plan.strengths), listBlock('نقاط الضعف', plan.weaknesses)) : null,
      h('h3', null, `البنود العلاجية (${nf(plan.items.length)}) — مقبول ${nf([...accepted].filter((i) => i < plan.items.length).length)}`),
      ...items,
      h('button', { type: 'button', class: 'btn sm', 'data-act': 'rpai-add', onclick: () => { plan.items.push({ item_code: null, problem_code: null, goal: '', actions: [], owner: 'المعلم', indicator: '', days: 14 }); draw(); } }, icon('plus', 16), ' أضف بنداً'),
      weeksBlock(), visitsBlock(),
      h('h3', null, 'الاعتماد'),
      h('p', { class: 'muted xs' }, api.trial ? 'خطة تجريبية: تُحفظ في جدول تجريبي منفصل، ولا تُنشأ مهام متابعة، ولا تدخل أي عدد أو تقرير.' : 'تعتمدها بنفسك دون مراجعة القسم، ويُحفظ اسمك والسبب والتاريخ (قرار د4).'),
      reasons.length ? h('div', { class: 'chips' }, reasons.map((r) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(reason === r.code),
        onclick: () => { reason = reason === r.code ? null : r.code; draw(); } }, r.text))) : null,
      field('تفصيل السبب', free),
      errBox,
      h('div', { class: 'row', style: 'gap:8px;margin-top:8px' },
        h('button', { type: 'button', class: 'btn', 'data-act': 'rpai-draft', onclick: (e) => submit(false, e.currentTarget) }, T.draft),
        h('button', { type: 'button', class: 'btn primary grow', 'data-act': 'rpai-approve', onclick: (e) => submit(true, e.currentTarget) }, T.approve)));
  }
  function listBlock(title, arr) {
    return h('div', null, h('b', { class: 'small' }, title), h('ul', { class: 'small' }, arr.map((s, i) => h('li', null, s, ' ',
      h('button', { type: 'button', class: 'linkish xs', 'aria-label': 'احذف', onclick: () => { arr.splice(i, 1); draw(); } }, '✕')))));
  }
  function itemCard(it, i) {
    const isOk = accepted.has(i);
    const goal = h('textarea', { rows: 2, maxlength: '400', oninput: () => { it.goal = goal.value; accepted.delete(i); } }); goal.value = it.goal || '';
    const acts = h('textarea', { rows: 3, oninput: () => { it.actions = lines(acts.value); accepted.delete(i); } }); acts.value = (it.actions || []).join('\n');
    const owner = h('select', { onchange: () => { it.owner = owner.value; accepted.delete(i); } }, OWNERS.map((o) => h('option', { value: o }, o))); owner.value = OWNERS.includes(it.owner) ? it.owner : 'المعلم'; it.owner = owner.value;
    const ind = h('input', { type: 'text', maxlength: '400', oninput: () => { it.indicator = ind.value; accepted.delete(i); } }); ind.value = it.indicator || '';
    const days = h('input', { type: 'number', min: '1', max: '90', inputmode: 'numeric', oninput: () => { it.days = Number(days.value); accepted.delete(i); } }); days.value = it.days || '';
    const code = h('input', { type: 'text', maxlength: '4', placeholder: 'G7', oninput: () => { it.item_code = code.value.trim().toUpperCase() || null; } }); code.value = it.item_code || '';
    return h('div', { class: `card rpai-item${isOk ? ' ok' : ''}`, 'data-rpai-item': String(i) },
      h('div', { class: 'row between nowrap' }, h('b', null, `البند ${nf(i + 1)}${it.item_code ? ' — ' + it.item_code : ''}`), badge(isOk ? 'مقبول' : 'لم يُراجع', isOk ? 'ok' : 'warn')),
      field('الهدف', goal), field('الإجراءات (سطر لكل إجراء)', acts), field('المسؤول', owner), field('المؤشر', ind),
      h('div', { class: 'row', style: 'gap:8px' }, field('المتابعة بعد (أيام)', days), field('رمز البند', code)),
      h('div', { class: 'row', style: 'gap:8px' },
        h('button', { type: 'button', class: `btn sm ${isOk ? '' : 'primary'}`, 'data-act': 'rpai-accept', onclick: () => { if (isOk) accepted.delete(i); else accepted.add(i); draw(); } }, isOk ? 'تراجع عن القبول' : 'اقبل البند'),
        h('button', { type: 'button', class: 'btn sm ghost', 'data-act': 'rpai-del', onclick: () => { plan.items.splice(i, 1); const a = [...accepted].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)); accepted.clear(); a.forEach((x) => accepted.add(x)); draw(); } }, 'احذف من المسودة')));
  }
  function weeksBlock() {
    return h('div', null, h('h3', null, `الخطة الأكاديمية الأسبوعية (${nf(plan.weeks.length)})`),
      plan.weeks.length ? plan.weeks.map((w, i) => {
        const t = h('textarea', { rows: 2, oninput: () => { w.tasks = lines(t.value); } }); t.value = w.tasks.join('\n');
        return h('div', { class: 'rpai-week' }, field(`الأسبوع ${nf(w.week)} — المهام (سطر لكل مهمة)`, t),
          h('button', { type: 'button', class: 'linkish xs', onclick: () => { plan.weeks.splice(i, 1); draw(); } }, 'احذف الأسبوع'));
      }) : h('p', { class: 'muted xs' }, 'لا خطة أسبوعية في الرد.'));
  }
  function visitsBlock() {
    return h('div', null, h('h3', null, `زيارات المتابعة (${nf(plan.visits.length)})`),
      plan.visits.length ? h('ul', { class: 'small' }, plan.visits.map((v, i) => h('li', null, `بعد ${nf(v.days)} يوماً: ${v.purpose} `,
        h('button', { type: 'button', class: 'linkish xs', onclick: () => { plan.visits.splice(i, 1); draw(); } }, '✕')))) : h('p', { class: 'muted xs' }, 'لا زيارات متابعة في الرد.'));
  }
  async function submit(approve, btn) {
    errBox.hidden = true;
    const errs = validatePlan(plan);
    if (approve && plan.items.some((_, i) => !accepted.has(i))) errs.push('اقبل كل بند (أو احذفه من المسودة) قبل الاعتماد.');
    const fr = free.value.trim();
    if (approve && !reason && fr.replace(/[^\p{L}\p{N}]/gu, '').length < 5) errs.push('سبب الاعتماد دون مراجعة القسم إلزامي: اختر سبباً أو اكتبه (5 أحرف على الأقل).');
    if (errs.length) { errBox.replaceChildren(h('ul', null, errs.map((m) => h('li', null, m)))); errBox.hidden = false; errBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (approve && !(await confirmBox(api.trial ? 'ستُعتمد الخطة التجريبية (لا تُحسب ولا تُنشأ لها مهام). تأكيد الاعتماد؟' : 'ستُعتمد الخطة دون مراجعة مسؤول القسم، ويُحفظ اسمك والسبب والتاريخ، وتُنشأ مهام المتابعة بمواعيدها. تأكيد الاعتماد؟', 'اعتمد'))) return;
    btn.disabled = true;
    try {
      const body = existing ? { id: existing.id, rv: existing.rv, plan, issues }
        : { id: (editor.ids ||= {})[visit.id] ||= uuid(), visit_id: visit.id, raw_text: raw, parsed: parsed.plan, issues, plan, prompt_version: PROMPT_VERSION + (S.profile?.ops?.rpai_mastery ? '+إتقان' : '') };
      if (approve) Object.assign(body, { approve: true, reason_code: reason, reason: fr || null });
      const r = await api.save(body);
      if (r.conflict) { toast(r.reason, 'bad'); return; }
      toast(approve ? (api.trial ? 'اعتُمدت الخطة التجريبية' : `اعتُمدت الخطة، وأُنشئت ${nf(r.plan.tasks.length)} مهمة متابعة`) : 'حُفظت المسودة', 'ok');
      if (existing) existing.rv = r.plan.rv; else if (editor.ids) delete editor.ids[visit.id];   // خطة جديدة للزيارة نفسها لاحقاً تأخذ رقماً جديداً (م2)
      onDone?.(r.plan);
    } catch (e) { fail(e); } finally { btn.disabled = false; }
  }
  draw();
  return root;
}

// ---------- صف خطة، وتفاصيلها ----------
function planRow(p, d, reload) {
  const [lbl, kind] = ST[p.status] || [p.status, ''];
  const open = (p.tasks || []).filter((t) => t.status === 'مفتوحة');
  return h('button', { type: 'button', class: 'list-item rp-row-btn', 'data-rpai-plan': p.id, onclick: () => details(p.id, d, reload).catch(fail) },
    h('div', { class: 'row between nowrap', style: 'align-items:flex-start;gap:8px' },
      h('div', { class: 'grow' }, h('b', null, `خطة زيارة ${hijri(p.visit_date)} — ${nf(p.items_count)} بنود`),
        h('div', { class: 'muted xs' }, [`الحلقة ${p.halaqa}`, p.supervisor_name, p.status === 'معتمدة' ? `مهام مفتوحة ${nf(open.length)}` : null,
          open.some((t) => t.overdue) ? 'فيها مهمة متأخرة' : null].filter(Boolean).join(' • '))),
      badge(lbl, kind)));
}

export async function details(id, d = null, reload = null) {
  const r = await rpc('rpc_rplan_ai_get', { p_id: id });
  const p = r.plan;
  let close;
  const body = h('div', { class: 'rpai-details' });
  const [lbl, kind] = ST[p.status] || [p.status, ''];
  const pl = p.plan || {};
  body.append(...[h('p', null, badge(lbl, kind), ' ', h('span', { class: 'muted xs' }, `زيارة ${hijri(p.visit_date)} • الحلقة ${p.halaqa} • ${p.supervisor_name || ''}`)),
    p.status === 'معتمدة' ? h('p', { class: 'small' }, `اعتمدها ${p.approved_by_name || '—'} في ${hijri(p.approved_at)} ${p.approval_mode || ''}. السبب: ${p.approval_reason || ''}`) : null,
    p.status === 'ملغاة' ? h('p', { class: 'small' }, `أُلغيت في ${hijri(p.cancelled_at)}. السبب: ${p.cancel_reason || ''}`) : null,
    pl.strengths?.length ? h('div', null, h('b', null, 'نقاط القوة'), h('ul', { class: 'small' }, pl.strengths.map((s) => h('li', null, s)))) : null,
    pl.weaknesses?.length ? h('div', null, h('b', null, 'نقاط الضعف'), h('ul', { class: 'small' }, pl.weaknesses.map((s) => h('li', null, s)))) : null,
    h('b', null, 'البنود العلاجية'),
    ...(pl.items || []).map((it, i) => h('div', { class: 'card' }, h('b', null, `${nf(i + 1)}. ${it.item_code ? it.item_code + ' — ' : ''}${it.goal}`),
      h('div', { class: 'small' }, 'الإجراءات: ', it.actions.join('، ')), h('div', { class: 'small' }, `المسؤول: ${it.owner} • المؤشر: ${it.indicator} • المتابعة بعد ${nf(it.days)} يوماً`))),
    (p.tasks || []).length ? h('div', null, h('b', null, `مهام المتابعة (${nf(p.tasks.length)})`), p.tasks.map((t) => taskRow(t, p, async () => { close?.(); await details(id, d, reload); reload?.(); }))) : null,
    h('details', null, h('summary', null, 'النص الملصوق الأصلي'), h('pre', { class: 'rpai-raw', dir: 'auto' }, p.raw_text || '')),
    (p.events || []).length ? h('details', null, h('summary', null, 'السجل'), h('ul', { class: 'small' }, p.events.map((e) => h('li', null, `${e.event} — ${e.actor_name || ''} — ${hijri(e.at)}${e.note ? ' — ' + e.note : ''}`)))) : null].filter(Boolean));
  const actions = [];
  if (p.status === 'مسودة' && p.can_write && d) actions.push({ label: 'أكمل المراجعة والاعتماد', kind: 'primary', onClick: (c) => {
    c(); const s = sheet({ title: T.title, body: editor({ tid: p.teacher, visit: { id: p.visit }, raw: p.raw_text, parsed: null, d, existing: p, onDone: () => { s(); reload?.(); } }), actions: [{ label: 'إغلاق' }] });
  } });
  if (p.can_cancel) actions.push({ label: 'ألغِ الخطة', onClick: async (c) => {
    const f = await askForm({ title: 'إلغاء الخطة', intro: 'لا تُحذف الخطة؛ تبقى «ملغاة» بسببها، وتُلغى مهامها المفتوحة.', fields: [{ name: 'r', label: 'سبب الإلغاء', required: true, area: true }], ok: 'ألغِ الخطة' });
    if (!f) return;
    const x = await rpc('rpc_rplan_ai_cancel', { p_id: p.id, p_rv: p.rv, p_reason: f.r });
    if (x.conflict) { toast(x.reason, 'bad'); return; }
    toast('أُلغيت الخطة', 'ok'); c(); reload?.();
  } });
  actions.push({ label: 'إغلاق' });
  close = sheet({ title: T.title, body, actions });
}

function taskRow(t, p, after) {
  const st = t.status === 'منجزة' ? badge('منجزة', 'ok') : t.status === 'ملغاة' ? badge('ملغاة', '') : t.overdue ? badge('متأخرة', 'bad') : t.due_soon ? badge('قريبة', 'warn') : badge('مفتوحة', 'info');
  const auto = t.auto_visit ? h('div', { class: 'muted xs' }, `زيارة للمعلم في ${hijri(t.auto_visit.date)} تقع في موعدها`) : null;
  const btn = t.status === 'مفتوحة' && p.can_tasks ? h('button', { type: 'button', class: 'btn sm', 'data-act': 'rpai-done', onclick: async (e) => {
    const f = await askForm({ title: 'إنجاز المهمة', intro: t.title, fields: [{ name: 'n', label: 'ملاحظة (اختيارية)', area: true }], ok: 'تم' });
    if (!f) return;
    e.target.disabled = true;
    try { await rpc('rpc_rplan_ai_task_done', { p_task: t.id, p_note: f.n || null, p_visit: t.auto_visit?.id || null, p_cancel: false }); toast('سُجّل الإنجاز', 'ok'); after(); }
    catch (x) { fail(x); e.target.disabled = false; }
  } }, 'تم') : null;
  return h('div', { class: 'list-item' }, h('div', { class: 'row between nowrap', style: 'gap:8px' },
    h('div', { class: 'grow' }, h('b', { class: 'small' }, `${t.kind}${t.week ? ' ' + nf(t.week) : ''}: `), h('span', { class: 'small' }, t.title),
      h('div', { class: 'muted xs' }, `الموعد ${hijri(t.due)}${t.done_at ? ' • أُنجزت ' + hijri(t.done_at) : ''}${t.visit ? ' • بزيارة ' + hijri(t.visit.date) : ''}`), auto),
    h('span', { class: 'row', style: 'gap:4px' }, st, btn)));
}

// ---------- صفحة الموجه: مهام المتابعة المستحقة خلال 7 أيام أو المتأخرة ----------
export function dueCard(tasks) {
  const show = tasks.slice(0, 8);
  return h('div', { 'data-rpai-due': String(tasks.length) }, h('div', { class: 'section-h' }, icon('clock', 20), h('h2', null, 'مهام متابعة الخطط بالذكاء الاصطناعي')),
    h('div', { class: 'card' }, show.map((t) => h('button', { type: 'button', class: 'list-item rp-row-btn', onclick: () => details(t.plan).catch(fail) },
      h('div', { class: 'row between nowrap', style: 'align-items:flex-start;gap:8px' },
        h('div', { class: 'grow' }, h('b', null, t.teacher_name), h('div', { class: 'muted xs' }, `الحلقة ${t.halaqa} • ${t.kind}: ${t.title}`)),
        badge(t.overdue ? 'متأخرة' : `الموعد ${hijri(t.due)}`, t.overdue ? 'bad' : t.due_soon ? 'warn' : 'info')))),
      tasks.length > show.length ? h('p', { class: 'muted xs' }, `و${nf(tasks.length - show.length)} أخرى`) : null));
}

// ---------- الزيارة التجريبية: «جرّب خطة بالذكاء الاصطناعي» (2026-11-26 ج، س12) — الحفظ في الجدول التجريبي وحده ----------
export async function trialAiBlock(trialVisit, info = {}) {
  let d;
  try { d = await rpc('rpc_trial_rplan_ai_list', { p_trial_visit: trialVisit }); } catch { return null; }   // المفتاح مطفأ أو لا صلاحية: لا شيء يظهر
  const box = h('div', { class: 'rpai-sec', 'data-rpai-trial': '1', style: 'margin-top:10px' });
  const reload = async () => { const el = await trialAiBlock(trialVisit, info); if (el) box.replaceWith(el); };
  const visit = { id: trialVisit, halaqa: info.halaqa || '', date: info.date || null };
  const state = { id: `trial.${trialVisit}`, f: { name: info.teacherName || '' } };
  const open = h('button', { type: 'button', class: 'btn gold block', 'data-act': 'rpai-trial-open' }, icon('clipboard', 20), ' جرّب خطة بالذكاء الاصطناعي');
  const area = h('div', { hidden: true });
  open.addEventListener('click', () => { area.hidden = !area.hidden; if (!area.hidden && !area.firstChild) area.append(composer(state, { ...d, visits: [visit] }, reload, TRIAL)); });
  box.append(open, area);
  if (d.plans.length) {
    box.append(h('div', { style: 'margin-top:8px' }, h('b', { class: 'small' }, `خططي بالذكاء الاصطناعي لهذه الزيارة (${nf(d.plans.length)})`),
      ...d.plans.map((p) => {
        const [lbl, kind] = ST[p.status] || [p.status, ''];
        const cancel = p.status !== 'ملغاة' ? h('button', { type: 'button', class: 'linkish xs', onclick: async () => {
          const f = await askForm({ title: 'إلغاء الخطة التجريبية', intro: 'لا تُحذف؛ تبقى «ملغاة».', fields: [{ name: 'r', label: 'السبب', required: true }], ok: 'ألغِ' });
          if (!f) return;
          try { await rpc('rpc_trial_rplan_ai_cancel', { p_id: p.id, p_reason: f.r }); toast('أُلغيت الخطة التجريبية', 'ok'); reload(); } catch (e) { fail(e); }
        } }, 'ألغِ') : null;
        return h('div', { class: 'list-item', 'data-rpai-trial-plan': p.status },
          h('div', { class: 'row between nowrap', style: 'gap:8px' }, h('span', { class: 'small' }, `${nf(p.items_count)} بنود${p.reason ? ' — ' + p.reason : ''}`), h('span', { class: 'row', style: 'gap:6px' }, badge(lbl, kind), cancel)),
          p.status === 'مسودة' ? h('button', { type: 'button', class: 'btn sm', style: 'margin-top:6px', onclick: () => {
            const s2 = sheet({ title: 'خطة تجريبية بالذكاء الاصطناعي', body: editor({ tid: state.id, visit, raw: p.raw_text, parsed: null, d, existing: p, api: TRIAL, onDone: () => { s2(); reload(); } }), actions: [{ label: 'إغلاق' }] });
          } }, 'أكمل المراجعة والاعتماد') : null);
      })));
  }
  return box;
}
