// واجهة «الخطة العلاجية» الاحترافية (2026-11-21): أسئلة الموجه قبل النسخ، ونسخ الأمر بعد فحص الأسماء (المتصفح + القاعدة)،
// واللصق والمعاينة والتعديل (الأقسام، وبنود المتابعة، وفقاعة الواتساب)، وخطة القوالب، وبطاقة المتابعة في «السجل ← الخطط».
// كل نص من الإعدادات عبر plan_logic.js. الأسماء الحقيقية لا تدخل الأمر أبداً، وتُستبدل في رسالة الواتساب محلياً فقط.
import { h, rpc, icon, toast, fail, hijri, nf, askForm, S } from './core.js';
import * as L from './exams_logic.js';
import * as PL from './plan_logic.js';

const DK = (id) => `tawjeeh.plan.draft.${id}`;
const draftStore = { get(id) { try { return JSON.parse(sessionStorage.getItem(DK(id)) || 'null'); } catch { return null; } },
  set(id, v) { try { sessionStorage.setItem(DK(id), JSON.stringify(v)); } catch { /* غير متاح */ } },
  drop(id) { try { sessionStorage.removeItem(DK(id)); } catch { /* لا شيء */ } } };
const copyText = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok, 'ok'); return true; } catch { toast('تعذّر النسخ', 'bad'); return false; } };
export async function openWa(state, text) {
  const mob = await (state.mobP || Promise.resolve(null));
  const dd = String(mob || '').replace(/\D/g, ''); const num = dd ? (dd.startsWith('966') ? dd : dd.startsWith('0') ? '966' + dd.slice(1) : '966' + dd) : '';
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  if (!num) toast('لا يوجد جوال للمعلم أو لا صلاحية لرؤيته: اختر المحادثة في واتساب');
}
const autosize = (ta) => { const f = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 640) + 'px'; }; ta.addEventListener('input', f); requestAnimationFrame(f); return ta; };
const chipBtn = (label, on, onclick) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!on), onclick }, label);
const who = (ctx) => ({ teacher: ctx.state.f?.name || '', students: Object.values(ctx.names.map || {}).map((x) => x[0]), others: [S.profile?.full_name || S.profile?.name || ''].filter(Boolean) });

// فقاعة واتساب (معاينة فقط): *عريض*، وأسطر، وسطر فارغ بين الأقسام
export function bubble(text) {
  return h('div', { class: 'pl-bubble', dir: 'rtl' }, PL.waLines(text).map((ln) => (ln.blank ? h('div', { class: 'pl-bl' }) : h('div', null, ln.segs.map((s) => (s.b ? h('b', null, s.t) : s.t))))),
    h('span', { class: 'pl-btime', 'aria-hidden': 'true' }, '✓✓'));
}
// الرسالة بعد الاستبدال المحلي (الأسماء تُجلب بدالة مسجّلة، فقط إن كان المفتاحان مشغّلين)
async function localWa(ctx, P, text, smap) {
  const on = P.namesInWa && !!ctx.d.names;
  if (on && !ctx.names.map) await ctx.loadNames();
  return PL.localizeWa(text, { teacher: ctx.state.f?.name || '', names: on ? ctx.names.map : null, smap: smap || {}, on: P.namesInWa });
}

// =====================================================================
// الخطوة 1: أسئلة الموجه
// =====================================================================
function answersForm(ctx, P, A, save) {
  const { d } = ctx; const F = P.form; const hs = d.halaqat || [];
  if (!A.halaqa || !hs.some((x) => x.number === A.halaqa)) A.halaqa = (hs.find((x) => x.dept === d.dept?.code) || hs[0])?.number || null;
  const errs = {}; const errEl = (k) => (errs[k] ||= h('p', { class: 'pl-err', role: 'alert', hidden: true }));
  const stageNote = h('p', { class: 'xs muted pl-snote' });
  const stageBox = h('div', { class: 'pl-chips', role: 'radiogroup', 'aria-label': F.q_stage || '' });
  const drawStage = () => {
    const hq = hs.find((x) => x.number === A.halaqa); const si = PL.stageInfo(hq, P);
    if (!A.stageTouched) { A.stage = si.stage || A.stage || null; A.stageKind = si.kind; }
    stageNote.textContent = si.kind === 'recorded' ? L.fillT(F.stage_recorded || '', { 'المرحلة': si.stage }) : si.kind === 'suggested' ? L.fillT(F.stage_suggested || '', { 'القسم': si.dept }) : (F.stage_none || '');
    stageBox.replaceChildren(...P.stages.map((s) => { const b = chipBtn(s.name, A.stage === s.name, () => { A.stage = s.name; A.stageTouched = true; save(); drawStage(); errEl('stage').hidden = true; }); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(A.stage === s.name)); return b; }));
  };
  const hsel = hs.length > 1 ? h('select', { 'aria-label': F.q_halaqa || 'الحلقة', onchange: (e) => { A.halaqa = e.target.value; A.stageTouched = false; save(); drawStage(); } },
    hs.map((x) => h('option', { value: x.number }, `الحلقة ${x.number}${x.dept_name ? ` • ${x.dept_name}` : ''}`))) : null;
  if (hsel) hsel.value = A.halaqa || '';
  drawStage();
  const nature = P.teacherQs.map((q) => {
    const box = h('div', { class: 'pl-chips' });
    const draw = () => box.replaceChildren(...q.opts.map((o) => chipBtn(o, A.nature?.[q.q] === o, () => { A.nature ||= {}; A.nature[q.q] = A.nature[q.q] === o ? null : o; save(); draw(); })));
    draw();
    return h('div', { class: 'pl-q' }, h('span', { class: 'pl-ql' }, q.q), box);
  });
  const other = h('input', { type: 'text', maxlength: P.freeMax, placeholder: F.other_ph || '', value: A.other || '', hidden: !A.otherOn, 'aria-label': F.other || 'أخرى',
    oninput: (e) => { A.other = e.target.value; save(); } });
  const chBox = h('div', { class: 'pl-chips' });
  const drawCh = () => chBox.replaceChildren(...P.challenges.map((c) => chipBtn(c, (A.challenges || []).includes(c), () => {
    const s = new Set(A.challenges || []); s.has(c) ? s.delete(c) : s.add(c); A.challenges = [...s]; save(); drawCh(); errEl('challenges').hidden = true; })),
    chipBtn(F.other || 'أخرى', A.otherOn, () => { A.otherOn = !A.otherOn; if (!A.otherOn) A.other = ''; other.hidden = !A.otherOn; if (A.otherOn) other.focus(); save(); drawCh(); }));
  drawCh();
  const free = (k, label) => { const ta = autosize(h('textarea', { rows: 2, maxlength: P.freeMax, 'aria-label': label, oninput: (e) => { A[k] = e.target.value; save(); errEl(k).hidden = true; } })); ta.value = A[k] || '';
    return h('label', { class: 'field pl-free' }, h('span', null, label), ta, h('small', { class: 'pl-nonames' }, icon('alert', 13, 'i'), F.no_names || ''), errEl(k)); };
  const el = h('section', { class: 'pl-form', 'aria-label': F.title || '' },
    h('h3', null, icon('list', 18), F.title || ''), h('p', { class: 'xs muted' }, F.intro || ''),
    hs.length ? h('div', { class: 'pl-q' }, h('span', { class: 'pl-ql' }, F.q_halaqa || ''), hsel || h('b', { class: 'small' }, `الحلقة ${hs[0].number}${hs[0].dept_name ? ` • ${hs[0].dept_name}` : ''}`)) : null,
    h('div', { class: 'pl-q' }, h('span', { class: 'pl-ql req' }, F.q_stage || ''), stageNote, stageBox, errEl('stage')),
    h('details', { class: 'pl-nat' }, h('summary', null, F.q_nature || ''), nature),
    h('div', { class: 'pl-q' }, h('span', { class: 'pl-ql req' }, F.q_challenges || ''), chBox, other, errEl('challenges'), errEl('other')),
    free('tried', F.q_tried || ''), free('focus', F.q_focus || ''),
    h('p', { class: 'xs muted pl-priv' }, icon('lock', 13, 'i'), F.privacy || ''));
  return {
    el,
    showErrors(list) { for (const k of list) { const e = errEl(k); e.hidden = false; e.textContent = k === 'stage' || k === 'challenges' ? (F.required || '') : `${nf(P.freeMax)} حرف على الأكثر`; }
      el.querySelector('.pl-err:not([hidden])')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
    showLeak(key, msg) { const e = errEl(key); e.hidden = false; e.textContent = msg; e.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  };
}

// =====================================================================
// الخطوات 1–5 مجتمعة في نافذة الخطة: النموذج، ثم الذكاء الاصطناعي، ثم القوالب
// =====================================================================
export function planTools(ctx) {
  const { R, d, state } = ctx; const P = PL.pcfg(d.set); const V = P.view;
  const A = Object.assign({ nature: {}, challenges: [] }, draftStore.get(state.id) || {});
  const save = () => draftStore.set(state.id, A);
  const form = answersForm(ctx, P, A, save);
  const out = [form.el];
  out.push(d.can_ai ? aiBlock(ctx, P, A, form, save) : h('p', { class: 'xr-note-box' }, icon('info', 16), h('span', null, R.cfg.ui.ai_off || '')));
  out.push(templateBlock(ctx, P, A, form));
  return out;
}

function aiBlock(ctx, P, A, form, save) {
  const { R, d, state } = ctx; const { cfg } = R; const U = cfg.ui; const F = P.form; const V = P.view;
  let ctxP = null;
  const step = (n, title, ...body) => h('li', { class: 'xr-step' }, h('span', { class: 'xr-sn', 'aria-hidden': 'true' }, nf(n)), h('div', null, h('b', null, title), ...body));
  const stop = h('p', { class: 'xr-bad xs', hidden: true, role: 'alert' });
  const fieldsLabel = PL.freeFields(P);
  const copyBtn = h('button', { type: 'button', class: 'btn primary block', onclick: async () => {
    stop.hidden = true;
    const errs = PL.validateAnswers(A, P); if (errs.length) { form.showErrors(errs); return; }
    copyBtn.disabled = true;
    try {
      const W = who(ctx);
      const al = PL.answersLeaks(A, P, W);
      if (al.length) { form.showLeak(al[0].key, L.fillT(F.leak_stop || '', { 'الحقل': al[0].field, 'النوع': al[0].kinds.join('، '), 'النص': al[0].text })); return; }
      ctxP ||= rpc('rpc_exam_ai_context2', { p_teacher: state.id });
      const codes = PL.studentCodes(R, P);
      const prompt = PL.buildPrompt2(R, await ctxP, P, { answers: A, plans: d.plans2, px: d.px, codes, next: d.next_exam });
      const pl = PL.leaksIn(prompt, W);
      if (pl.length) { stop.hidden = false; stop.textContent = L.fillT(F.leak_prompt || '', { 'النوع': pl.join('، ') }); return; }
      let srv;
      try { srv = await rpc('rpc_exam_ai_leaks', { p_teacher: state.id, p_texts: { tried: A.tried || '', focus: A.focus || '', other: A.other || '', prompt } }); }
      catch { stop.hidden = false; stop.textContent = F.leak_fail || ''; return; }
      if (srv?.length) {
        const f = srv.find((x) => x.key !== 'prompt') || srv[0];
        if (f.key !== 'prompt') form.showLeak(f.key, L.fillT(F.leak_stop || '', { 'الحقل': fieldsLabel[f.key] || f.key, 'النوع': f.kind, 'النص': f.text }));
        else { stop.hidden = false; stop.textContent = L.fillT(F.leak_prompt || '', { 'النوع': f.kind }); }
        return;
      }
      A.smap = codes.map; save();
      const hq = (d.halaqat || []).find((x) => x.number === A.halaqa);
      if (hq && A.stage && hq.stage !== A.stage) {
        const src = A.stageKind === 'suggested' && !A.stageTouched ? 'تأكيد المقترح' : 'اختيار';
        rpc('rpc_halaqa_stage_set', { p_halaqa: A.halaqa, p_teacher: state.id, p_stage: A.stage, p_source: src }).then(() => { hq.stage = A.stage; }).catch(fail);
      }
      await copyText(prompt, L.fillT(F.copied || '', { 'العدد': nf(prompt.length) }));
    } catch (e) { ctxP = null; fail(e); } finally { copyBtn.disabled = false; }
  } }, icon('clipboard', 20), F.copy || 'نسخ أمر الخطة');
  const ta = h('textarea', { rows: 6, class: 'xr-paste', placeholder: 'ألصق الخطة هنا…', 'aria-label': 'ألصق الخطة هنا' });
  const checks = h('ul', { class: 'xr-checks', 'aria-live': 'polite' }); const editorBox = h('div');
  const SEC = ['قسم', 'قسمان', 'أقسام', 'قسماً', 'قسم'];
  const check = () => {
    const v = ta.value.trim();
    if (!v) { checks.replaceChildren(); editorBox.replaceChildren(); return; }
    const p = PL.parsePlan2(v, R, P);
    const item = (ok, t) => h('li', { class: ok ? 'ok' : 'bad' }, icon(ok ? 'check' : 'x', 15, 'i'), t);
    checks.replaceChildren(
      item(!p.missing.length && p.sections.length > 0, p.missing.length ? `الأقسام: ${L.arCount(p.sections.length, SEC)} من ${nf(cfg.ai.sections.length)} — ${p.missing.map((x) => L.fillT(V.missing_section || '{القسم}', { 'القسم': x.title })).join('، ')}` : `الأقسام كلها موجودة (${nf(p.sections.length)})`),
      item(p.items.length > 0, p.items.length ? `بنود المتابعة: ${L.arCount(p.items.length, 'step')}` : (V.items_none || '')),
      item(p.goal != null, p.goal != null ? `نسبة النجاح التي نطمح لها: ${nf(p.goal)}٪ فأكثر` : 'سطر «الهدف الرقمي» غير موجود'),
      item(p.waOk, p.wa ? `رسالة الواتساب: ${nf(p.waLen)} حرفاً من ${nf(cfg.waMax)}` : 'رسالة الواتساب غير موجودة'),
      p.hasEnd ? null : h('li', { class: 'warn' }, icon('alert', 15, 'i'), 'لم تُوجد علامة «نهاية الخطة» (قد يكون الرد ناقصاً)'));
    editorBox.replaceChildren(p.canSave ? planEditor(ctx, P, A, { sections: p.sections, items: p.items, wa: p.wa, goal: p.goal, goals: p.goals, checks: { sections: p.sections.length, missing: p.missing.map((x) => x.n), wa_len: p.waLen, has_end: p.hasEnd } }, 'ذكاء اصطناعي') : h('p', { class: 'xs muted' }, 'أكمل الرد ليظهر محرر الخطة.'));
  };
  ta.addEventListener('input', check);
  return h('section', { class: 'xr-ai' }, h('h3', null, V.ai_title || ''),
    h('ol', { class: 'xr-steps' },
      step(1, F.copy || '', h('p', { class: 'xs muted' }, U.ai_step1 || ''), copyBtn, stop),
      step(2, 'الذكاء الاصطناعي', h('p', { class: 'xs' }, U.ai_step2 || '')),
      step(3, 'ألصق الخطة هنا', h('p', { class: 'xs muted' }, U.ai_step3 || ''), ta, checks),
      step(4, 'المعاينة والحفظ', h('p', { class: 'xs muted' }, V.edit_hint || ''), editorBox)));
}

// =====================================================================
// المحرر (قبل الحفظ): الهدف، والأقسام قابلة للتعديل، وبنود المتابعة، ورسالة الواتساب بفقاعة
// =====================================================================
function planEditor(ctx, P, A, draft, kind, extra = {}) {
  const { R, state } = ctx; const { cfg } = R; const V = P.view;
  const D = { sections: draft.sections.map((s) => ({ ...s })), items: draft.items.map((i) => ({ ...i })), wa: draft.wa || '', goal: draft.goal };
  const roleN = (r) => P.roles[r];
  const goalIn = h('input', { type: 'number', min: 0, max: 100, step: 1, inputmode: 'numeric', value: D.goal ?? '', class: 'xr-goal', 'aria-label': V.goal || '' });
  const itemsBox = h('ol', { class: 'pl-items-ed' });
  const drawItems = () => itemsBox.replaceChildren(...D.items.map((it, i) => {
    const inp = (k, ph, max) => h('input', { type: 'text', value: it[k] || '', placeholder: ph, maxlength: max, 'aria-label': ph, oninput: (e) => { it[k] = e.target.value; } });
    const st = autosize(h('textarea', { rows: 2, maxlength: 600, 'aria-label': `البند ${nf(i + 1)}`, oninput: (e) => { it.step = e.target.value; } })); st.value = it.step;
    return h('li', { class: 'pl-ied' }, st, h('div', { class: 'pl-ied-f' }, inp('owner', 'المسؤول', 60), inp('due', 'الموعد', 200), inp('verify', 'كيف نتحقق', 400)),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { D.items.splice(i, 1); drawItems(); } }, icon('x', 16), 'حذف البند'));
  }));
  drawItems();
  const waTa = autosize(h('textarea', { rows: 8, maxlength: cfg.waMax + 200, class: 'pl-wa-ta', 'aria-label': 'رسالة الواتساب (بالرموز)' })); waTa.value = D.wa;
  const waMeta = h('p', { class: 'xs muted' }); const waPrev = h('div');
  const drawWa = async () => {
    waMeta.textContent = `${nf(D.wa.length)} حرفاً من ${nf(cfg.waMax)} • ${P.namesInWa && ctx.d.names ? V.names_on || '' : V.names_off || ''}`;
    waMeta.className = `xs ${D.wa.length > cfg.waMax ? 'xr-bad' : 'muted'}`;
    waPrev.replaceChildren(bubble(await localWa(ctx, P, D.wa, A.smap)));
  };
  waTa.addEventListener('input', () => { D.wa = waTa.value; drawWa(); });
  drawWa();
  const secEls = D.sections.map((s) => {
    if (s.n === roleN('steps')) return h('section', { class: 'pl-sec' }, h('h4', null, s.title), h('p', { class: 'xs muted' }, V.items_title || ''), itemsBox,
      h('button', { type: 'button', class: 'btn sm soft', onclick: () => { D.items.push({ step: '', owner: '', due: '', verify: '' }); drawItems(); itemsBox.lastElementChild?.querySelector('textarea')?.focus(); } }, icon('plus', 16), V.add_item || ''));
    if (s.n === roleN('wa')) return h('section', { class: 'pl-sec' }, h('h4', null, s.title), waPrev, h('details', { class: 'pl-wa-ed' }, h('summary', { class: 'xs' }, 'تعديل نص الرسالة'), waTa), waMeta);
    const ta = autosize(h('textarea', { rows: 3, 'aria-label': s.title, oninput: (e) => { s.body = e.target.value; } })); ta.value = s.body;
    return h('section', { class: 'pl-sec' }, h('h4', null, s.title), ta);
  });
  const savedBox = h('div');
  const saveBtn = h('button', { type: 'button', class: 'btn primary block', onclick: async () => {
    const g = goalIn.value === '' ? null : Number(goalIn.value);
    if (g == null || !(g >= 0 && g <= 100)) { toast('نسبة النجاح التي نطمح لها: رقم بين 0 و100', 'bad'); goalIn.focus(); return; }
    if (D.wa.length > cfg.waMax) { toast(`رسالة الواتساب أطول من ${nf(cfg.waMax)} حرف`, 'bad'); return; }
    const items = D.items.filter((i) => String(i.step || '').trim().length >= 2);
    const goalLine = L.fillT(cfg.ai.goalLine, { 'النسبة': nf(g) });
    const sections = D.sections.map((s) => ({ n: s.n, title: s.title,
      body: s.n === roleN('steps') ? PL.itemsToText(items, P) : s.n === roleN('wa') ? D.wa
        : s.n === roleN('goals') ? (PL.goalFrom(s.body, cfg) == null ? `${goalLine}\n${s.body}` : String(s.body).split('\n').map((l) => (PL.goalFrom(l, cfg) != null ? goalLine : l)).join('\n')) : s.body }));
    if (!A.smap) A.smap = PL.studentCodes(R, P).map;
    saveBtn.disabled = true;
    try {
      const { codes: _c, otherOn: _o, stageTouched: _t, smap: _s, ...answers } = A;
      const r = await rpc('rpc_exam_plan_save_v3', { p: { teacher: state.id, kind, full_text: PL.joinPlan(sections, cfg), wa_full: D.wa || null, goal_pct: g, goal_kind: cfg.goalKind,
        prompt_version: kind === 'ذكاء اصطناعي' ? cfg.ai.version : null, checks: draft.checks || {}, codes: R.weaknesses.map((w) => w.code),
        template_keys: (extra.templates || []).map((t) => t.key), template_versions: (extra.templates || []).map((t) => t.version), baseline: L.planBaseline(R),
        halaqa: A.halaqa || null, stage: A.stage || null, stage_source: A.stageKind === 'recorded' && !A.stageTouched ? 'تأكيد المسجَّل' : A.stageKind === 'suggested' && !A.stageTouched ? 'تأكيد المقترح' : 'اختيار',
        answers, sections, goals: draft.goals || [], student_map: A.smap, items } });
      draftStore.drop(state.id); ctx.afterSave?.();
      const local = await localWa(ctx, P, D.wa, A.smap);
      savedBox.replaceChildren(h('div', { class: 'xr-saved', role: 'status' }, icon('check', 18), h('span', null, `تم الحفظ في سجل المعلم (${L.arCount(r.items, 'step')} للمتابعة)`),
        h('div', { class: 'xr-btns col' },
          D.wa ? h('button', { type: 'button', class: 'btn soft', onclick: () => openWa(state, local) }, icon('send', 18), V.send_wa || '') : null,
          D.wa ? h('button', { type: 'button', class: 'btn soft', onclick: () => copyText(local, 'نُسخت الرسالة') }, icon('chat', 18), V.copy_wa || '') : null,
          h('button', { type: 'button', class: 'btn sm', onclick: () => { if (state.f?.can?.log) state.goTab?.('السجل', { plan: r.id }); else state.goTab?.('الاختبارات', { openPlan: true }); } }, '← عرض الخطة والمتابعة'))));
      toast('تم الحفظ في سجل المعلم', 'ok');
    } catch (e) { fail(e); saveBtn.disabled = false; }
  } }, icon('check', 18), 'حفظ في سجل المعلم');
  return h('div', { class: 'pl-editor' },
    h('label', { class: 'field pl-goal' }, h('span', null, `${V.goal || ''} (٪)`), goalIn, h('small', null, V.goal_help || '')),
    secEls, saveBtn, savedBox);
}

// =====================================================================
// الخطوة 5: خطة القوالب — الأسئلة نفسها تختار القالب الأنسب، والمحرر نفسه
// =====================================================================
function templateBlock(ctx, P, A, form) {
  const { R, d } = ctx; const V = P.view;
  const body = h('div', { class: 'pl-tpl' });
  const LABEL = { MISSING: 'عدم الترشيح وقلة المرشحين', LOWPASS: 'ضعف النجاح والرسوب', REPEAT: 'ملاحظات تجويد متكررة', DECLINE: 'تراجع النسبة', GOOD: 'المحافظة على الأداء' };
  let picked = null;
  const draw = () => {
    const errs = PL.validateAnswers(A, P);
    if (errs.length) { body.replaceChildren(h('p', { class: 'xs muted' }, icon('info', 14, 'i'), ' ', P.form.required || ''), h('button', { type: 'button', class: 'btn sm soft', onclick: () => { form.showErrors(errs); } }, 'إكمال الأسئلة أعلاه'), h('button', { type: 'button', class: 'btn sm ghost', onclick: draw }, 'تحديث')); return; }
    if (!A.smap) A.smap = PL.studentCodes(R, P).map;
    const codes = PL.studentCodes(R, P);
    const auto = PL.pickTemplates(R, A, P);
    if (!picked) picked = auto.picked.map((x) => x.code);
    const chips = h('div', { class: 'pl-chips' }, Object.keys(LABEL).map((k) => chipBtn(LABEL[k], picked.includes(k), () => { picked = picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k]; if (!picked.length) picked = ['GOOD']; draw(); })));
    const forced = picked.map((code) => ({ code, score: auto.picked.find((x) => x.code === code)?.score || 0, why: auto.picked.find((x) => x.code === code)?.why || [] }));
    const T = PL.composeTemplate(R, A, P, { codes, next: d.next_exam, picked: forced });
    body.replaceChildren(h('p', { class: 'xs muted' }, V.tpl_intro || ''), chips,
      auto.lowObs ? h('p', { class: 'xr-pend xs' }, icon('info', 13, 'i'), R.cfg.ui.nores_alert || '') : null,
      planEditor(ctx, P, A, { sections: T.sections, items: T.items, wa: T.wa, goal: T.goal, goals: T.goals, checks: { templates: T.templates.length } }, 'قالب', { templates: T.templates }));
  };
  const det = h('details', { class: 'xr-tpl' }, h('summary', null, V.tpl_title || ''), body);
  det.addEventListener('toggle', () => { if (det.open) draw(); });
  return det;
}

// =====================================================================
// الخطوة 4: بطاقة المتابعة (السجل ← الخطط، وآخر الخطط في التبويب)
// =====================================================================
export function planCard(ctx, p, { canAct = true, onStatus } = {}) {
  const { R, d, state } = ctx; const P = PL.pcfg(d.set); const V = P.view; const cfg = R.cfg;
  const x = d.px[String(p.id)]; const items = x.items || [];
  const canMark = canAct && d.can_write && p.status !== 'ملغاة' && !x.judged?.closed;
  const head = h('div'); const bar = h('div', { class: 'pl-prog' });
  const drawHead = () => {
    const J = PL.judgeLine(p, R, P, x); const closed = J.closed || x.judged?.closed;
    const pr = PL.progressOf(items, P);
    const badgeK = p.status === 'ملغاة' ? ['gray', 'ملغاة'] : closed ? [J.st.code === 'met' ? 'ok' : 'bad', `${J.st.label} • ${V.closed || ''}`] : ['gold', V.open || ''];
    head.replaceChildren(h('div', { class: 'row between' }, h('b', null, hijri(p.at)), h('span', { class: `badge ${badgeK[0]}` }, badgeK[1])),
      h('p', { class: 'xs muted' }, [p.kind === 'ذكاء اصطناعي' ? 'ذكاء اصطناعي' : 'قوالب', x.stage ? `المرحلة: ${x.stage}` : '', x.halaqa ? `الحلقة ${x.halaqa}` : '', p.by ? `بواسطة ${p.by}` : ''].filter(Boolean).join(' • ')));
    bar.replaceChildren(
      h('div', { class: 'pl-pk' },
        h('div', null, h('span', { class: 'xs muted' }, V.progress || ''), h('b', { class: 'pl-big' }, pr.pct == null ? '—' : L.pct(pr.pct, 0))),
        h('div', null, h('span', { class: 'xs muted' }, V.goal || ''), h('b', { class: 'pl-big' }, p.goal != null ? `${nf(p.goal)}٪` : '—', p.goal != null ? h('small', { class: 'pl-more' }, 'فأكثر') : null)),
        h('div', null, h('span', { class: 'xs muted' }, 'الحالة'), h('b', { class: 'pl-big sm' }, closed ? J.st.label : p.status === 'ملغاة' ? 'ملغاة' : (J.st.code === 'pending' ? 'بانتظار الاختبار' : J.st.label)))),
      h('div', { class: 'pl-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((pr.pct || 0) * 100), 'aria-label': V.progress || '' },
        h('span', { style: `width:${Math.round((pr.pct || 0) * 100)}%` })),
      h('p', { class: 'xs muted' }, `تم ${nf(pr.done)} • جزئي ${nf(pr.part)} • لم يتم ${nf(pr.not)} • بلا تأشير ${nf(pr.unmarked)}`),
      closed ? h('p', { class: `xs ${J.st.code === 'met' ? 'xr-good' : 'xr-bad'}` }, `${J.text}${J.st.text ? ` — ${J.st.text}` : ''}. ${V.closed_note || ''}`) : null,
      !closed && p.status !== 'ملغاة' && (d.next_exam) ? h('p', { class: 'xs' }, icon('clock', 13, 'i'), ' ', PL.openLine(pr, d.next_exam, P)) : null);
  };
  drawHead();
  const waText = () => x.wa || x.sections?.find((s) => s.n === P.roles.wa)?.body || p.wa || '';
  const actions = h('div', { class: 'xr-btns pl-act' },
    waText() ? h('button', { type: 'button', class: 'btn sm soft', onclick: async () => openWa(state, await localWa(ctx, P, waText(), x.smap)) }, icon('send', 16), V.send_wa || '') : null,
    waText() ? h('button', { type: 'button', class: 'btn sm soft', onclick: async () => copyText(await localWa(ctx, P, waText(), x.smap), 'نُسخت الرسالة') }, icon('chat', 16), V.copy_wa || '') : null,
    h('button', { type: 'button', class: 'btn sm soft', onclick: () => printPlan(ctx, p, x, P) }, icon('list', 16), V.print || ''));
  const itemsList = h('ol', { class: 'pl-items' }, items.length ? items.map((it) => itemRow(ctx, P, it, canMark, () => drawHead())) : h('li', { class: 'xs muted' }, V.no_items || ''));
  const secs = (x.sections || []).map((s) => {
    const open = s.n === P.roles.diag || s.n === P.roles.priorities;
    if (s.n === P.roles.steps) return h('details', { class: 'pl-card', open: true }, h('summary', null, h('b', null, s.title), h('span', { class: 'xs muted' }, L.arCount(items.length, 'step'))), itemsList);
    if (s.n === P.roles.wa) { const holder = h('div'); localWa(ctx, P, waText(), x.smap).then((t) => holder.replaceChildren(bubble(t))).catch(() => holder.replaceChildren(bubble(waText())));
      return h('details', { class: 'pl-card' }, h('summary', null, h('b', null, s.title)), holder); }
    return h('details', { class: 'pl-card', open }, h('summary', null, h('b', null, s.title)), h('div', { class: 'pl-cb' }, String(s.body || '').split('\n').map((l) => (l.trim() ? h('p', null, l.replace(/^[-•*]\s*/, '• ')) : null))));
  });
  const ans = x.answers ? h('details', { class: 'pl-card' }, h('summary', null, h('b', null, 'إجابات الموجه'), h('span', { class: 'xs muted' }, 'للمسؤول وموجه المعلم فقط')),
    h('div', { class: 'pl-cb' }, PL.answersData(x.answers, P).split('\n').map((l) => h('p', null, l.replace(/^- /, '• '))))) : null;
  return h('article', { class: `xr-prow pl-plan ${p.status === 'ملغاة' ? 'cancelled' : ''}`, id: `plan-${p.id}` },
    head, bar, actions, secs, ans,
    canAct && d.can_plan && onStatus ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => onStatus(p) }, p.status === 'ملغاة' ? 'استرجاع الخطة' : 'إلغاء الخطة') : null);
}

function itemRow(ctx, P, it, canMark, onChange) {
  const V = P.view;
  const li = h('li', { class: 'pl-item' });
  const note = h('input', { type: 'text', maxlength: 500, placeholder: V.note_ph || '', 'aria-label': V.note_ph || '' });
  const run = async (fn, args) => {
    li.classList.add('busy');
    try {
      const r = await rpc(fn, args); it.state = r.state || null;
      it.hist = [...(it.hist || []), fn === 'rpc_exam_plan_mark' ? { id: r.state?.mark, a: 'تأشير', st: args.p_status, note: args.p_note || null, by: r.state?.by, at: r.state?.at } : { a: 'تراجع', undoes: args._undoes, by: S.profile?.full_name || '', at: new Date().toISOString() }];
      note.value = ''; ctx.afterSave?.(); draw(); onChange();
    } catch (e) { fail(e); } finally { li.classList.remove('busy'); }
  };
  const mark = (st) => run('rpc_exam_plan_mark', { p_item: it.id, p_status: st, p_note: note.value.trim() || null });
  const undo = () => run('rpc_exam_plan_unmark', { p_item: it.id, _undoes: it.state?.mark });
  function draw() {
    const st = it.state?.status || null;
    const cb = h('input', { type: 'checkbox', checked: st === 'تم', disabled: !canMark, 'aria-label': `تم: ${it.step}`,
      onchange: (e) => { if (e.target.checked) mark('تم'); else if (it.state) undo(); } });
    const segs = h('div', { class: 'pl-seg', role: 'group', 'aria-label': 'حالة البند' }, [['تم', V.done], ['جزئي', V.part], ['لم يتم', V.not]].map(([k, lb]) =>
      h('button', { type: 'button', class: `pl-sb ${k === 'تم' ? 'ok' : k === 'جزئي' ? 'part' : 'no'}`, 'aria-pressed': String(st === k), disabled: !canMark, onclick: () => (st === k ? null : mark(k)) }, lb || k)));
    const hist = (it.hist || []).filter((x) => x.a);
    li.className = `pl-item ${st === 'تم' ? 'done' : st === 'جزئي' ? 'part' : st === 'لم يتم' ? 'no' : ''}`;
    li.replaceChildren(
      h('label', { class: 'pl-iline' }, cb, h('span', { class: 'pl-itext' }, it.step)),
      [it.owner, it.due].some(Boolean) || it.verify ? h('p', { class: 'xs muted pl-imeta' }, [it.owner ? `المسؤول: ${it.owner}` : '', it.due ? `الموعد: ${it.due}` : '', it.verify ? `التحقق: ${it.verify}` : ''].filter(Boolean).join(' • ')) : null,
      segs,
      it.state ? h('p', { class: 'xs pl-istate' }, L.fillT(V.marked_by || '{الحالة} • {من} • {متى}', { 'الحالة': it.state.status, 'من': it.state.by || '—', 'متى': hijri(it.state.at) }), it.state.note ? ` — ${it.state.note}` : '',
        canMark ? h('button', { type: 'button', class: 'pl-undo', onclick: undo }, V.undo || 'تراجع') : null) : null,
      canMark ? h('details', { class: 'pl-inote' }, h('summary', { class: 'xs' }, '+ ملاحظة مع التأشير'), note) : null,
      hist.length ? h('details', { class: 'pl-ihist' }, h('summary', { class: 'xs muted' }, `السجل (${nf(hist.length)})`),
        h('ul', { class: 'xs' }, hist.slice().reverse().map((x) => h('li', null, `${x.a === 'تراجع' ? 'تراجع' : x.st}${x.note ? ` («${x.note}»)` : ''} — ${x.by || '—'} — ${hijri(x.at)}`)))) : null);
  }
  draw();
  return li;
}

function printPlan(ctx, p, x, P) {
  const { R, state } = ctx;
  const items = x.items || [];
  const view = h('div', { class: 'xr-report pl-print', dir: 'rtl' },
    h('h2', null, `الخطة العلاجية — ${state.f?.name || ''}`), h('p', null, `${hijri(p.at)}${x.stage ? ` • المرحلة: ${x.stage}` : ''}${p.goal != null ? ` • الهدف: ${nf(p.goal)}٪ فأكثر` : ''}`),
    (x.sections || []).filter((s) => s.n !== P.roles.wa).map((s) => [h('h3', null, s.title),
      s.n === P.roles.steps ? h('ol', null, items.map((it) => h('li', null, `${it.step}${it.owner ? ` (${it.owner})` : ''}${it.due ? ` — ${it.due}` : ''} — ${it.state?.status || '☐'}`)))
        : String(s.body || '').split('\n').map((l) => (l.trim() ? h('p', null, l) : null))]));
  const area = h('div', { id: 'xr-print', dir: 'rtl' }, view);
  document.body.append(area); document.body.classList.add('xr-printing');
  const done = () => { area.remove(); document.body.classList.remove('xr-printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  void R;
}

// سطر الخطة المفتوحة (بطاقة بدء الزيارة): آخر خطة نشطة غير مغلقة ببنود متابعة
export function openPlanLine(d, R) {
  const P = PL.pcfg(d.set);
  const p = (d.plans2 || []).find((q) => q.status !== 'ملغاة' && d.px?.[String(q.id)]);
  if (!p) return null;
  const x = d.px[String(p.id)];
  if (x.judged?.closed || !x.items?.length) return null;
  const st = L.planStatus(p, R); if (st.code === 'met' || st.code === 'unmet') return null;
  return PL.openLine(PL.progressOf(x.items, P), d.next_exam, P);
}
