// خطط زيارات الموجهين (أمر صاحب النظام 2026-11-26، الخطوة 3) — صفحة واحدة بحسب الدور:
//   الموجه: «خطة الدورة» (يدوية و/أو تلقائية مقترحة، تبديل معلم، رفع) و«قائمة اليوم» (حسب الإمكان).
//   مسؤول القسم: «للاعتماد» (يعتمد أو يعيد بملاحظة). مسؤول الشعبة ومساعده: «الخطط غير المعتمدة» (أيام الانتظار والمتأخر)،
//   ومسؤول الشعبة (لا مساعده) يعتمد مؤقتاً خطط الأقسام التي لا مسؤول قسم لها (20261126000300).
// كل قيد حقيقي في القاعدة (rpc_vsched_*)؛ والاقتراح في الجهاز (vsched_logic.js) ولا يُحفظ حتى يرفعه الموجه.
import { S, h, rpc, badge, icon, hijri, nf, sheet, toast, fail, askForm, confirmBox, isDivisionHead } from './core.js';
import { offNotice } from './off_notice.js';
import { uuid } from './plans_api.js';
import { suggest, violations, swap } from './vsched_logic.js';

// (بروفة التجربة ب1) append الأصلية لا تفرد المصفوفات فكانت القائمتان تظهران «[object HTMLDivElement]»
const appendAll = (e, ...k) => k.flat(9).forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
const ST = { 'مسودة': 'warn', 'مرفوعة': 'info', 'معتمدة': 'ok', 'معادة': 'bad' };
const perName = (c) => (S.refs?.periods || []).find((p) => p.code === c)?.name || c || '';
const dayName = (d) => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { weekday: 'long' }).format(new Date(d + 'T12:00:00')); } catch { return ''; } };

export async function render(root, ctx) {
  const prof = S.profile || {};
  const box = h('div', { class: 'stack' });
  root.append(box);
  if (!prof.ops?.vsched) { box.append(h('section', { class: 'card' }, h('h2', null, 'خطط الزيارات'), offNotice('feature.vsched', { what: 'خطط زيارات الموجهين مطفأة الآن.' }))); return; }
  const C = await rpc('rpc_vsched_context', { p_dept: ctx?.query?.['قسم'] || null });
  if (ctx?.alive && !ctx.alive()) return;
  if (C.departments?.length) box.append(await supSection(C, ctx));
  if (prof.ops?.vsched_head) box.append(await inboxSection());
  if (prof.ops?.vsched_head) box.append(await cfgSection());
  if (isDivisionHead() || (prof.assignments || []).some((a) => a.role === 'division_assistant')) box.append(await pendingSection());
  if (!box.children.length) box.append(h('p', { class: 'empty' }, 'لا خطط زيارات لدورك.'));
}

// ---------- الموجه ----------
async function supSection(C, ctx) {
  const sec = h('section', { class: 'card', 'data-vs': 'sup' });
  const types = C.cfg.types || [];
  const reload = (dept) => ctx.go?.('خطط-الزيارات', { قسم: dept || C.department, t: Date.now() });
  const deptSel = C.departments.length > 1 ? h('select', { 'aria-label': 'القسم', onchange: () => reload(deptSel.value) }, C.departments.map((d) => h('option', { value: d.code }, d.name))) : null;
  if (deptSel) deptSel.value = C.department;
  const tabs = [];
  if (types.includes('يدوية') || types.includes('تلقائية')) tabs.push(['خطة الدورة', () => planTab(C, reload)]);
  if (types.includes('حسب الإمكان')) tabs.push(['قائمة اليوم', () => dailyTab(C)]);
  const body = h('div');
  const tabBar = h('div', { class: 'chips', role: 'tablist' }, tabs.map(([t, f], i) => h('button', { type: 'button', class: 'chip', role: 'tab', 'aria-selected': String(i === 0), 'data-vs-tab': t,
    onclick: async (e) => { tabBar.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-selected', 'false')); e.currentTarget.setAttribute('aria-selected', 'true'); body.replaceChildren(await f()); } }, t)));
  sec.append(h('h2', { style: 'margin:0 0 6px' }, icon('cal', 20), ' خطة زياراتي'),
    ...[deptSel ? h('label', { class: 'field' }, h('span', null, 'القسم'), deptSel) : h('p', { class: 'muted small' }, C.departments[0].name),
      h('p', { class: 'muted xs' }, `الدورية: ${C.cfg.cycle} • الأنواع المفعّلة: ${types.join('، ')} • أقصى ${nf(C.cfg.max_per_period)} زيارة في الفترة • مدة الزيارة ${nf(C.cfg.visit_minutes)} دقيقة`),
      Object.values(C.windows || {}).some((w) => w.temp) ? h('p', { class: 'muted xs' }, 'أوقات الفترات مؤقتة حتى يعتمدها مسؤول الشعبة.') : null,
      tabs.length > 1 ? tabBar : null, body].filter(Boolean));
  if (tabs.length) body.replaceChildren(await tabs[0][1]());
  return sec;
}

function planTab(C, reload) {
  const wrap = h('div', { 'data-vs-plan': '1' });
  let ci = 1;                                                                   // الدورة التالية افتراضاً (تُرفع قبل بدايتها)
  const types = C.cfg.types || [];
  const T = Object.fromEntries((C.teachers || []).map((t) => [t.teacher + '|' + t.halaqa, t]));
  let state;
  function load() {
    const cyc = C.cycles[ci];
    const plan = (C.plans || []).find((p) => p.cycle_start === cyc.start) || null;
    state = { cyc, plan, items: (plan?.items || []).map((x) => ({ ...x })), unplaced: [] };
    draw();
  }
  const opt = () => ({ cfg: C.cfg, windows: C.windows, workdays: state.cyc.workdays });
  function draw() {
    const { cyc, plan, items } = state;
    const editable = !plan || plan.can_edit;
    const v = violations(items, opt());
    const byDate = new Map(); items.forEach((x, i) => { if (!byDate.has(x.date)) byDate.set(x.date, []); byDate.get(x.date).push([x, i]); });
    wrap.replaceChildren(...[
      h('div', { class: 'chips' }, C.cycles.map((c, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === ci), onclick: () => { ci = i; load(); } },
        `${i === 0 ? 'الدورة الحالية' : 'الدورة التالية'}: ${hijri(c.start)} – ${hijri(c.end)}`))),
      plan ? h('p', null, badge(plan.status, ST[plan.status]), plan.status === 'معادة' && plan.decision_note ? h('span', { class: 'small' }, ` ملاحظة مسؤول القسم: ${plan.decision_note}`) : null,
        plan.status === 'معتمدة' ? h('span', { class: 'muted xs' }, ` اعتمدها ${plan.decided_by_name || ''} في ${hijri(plan.decided_at)}`) : null) : h('p', { class: 'muted small' }, 'لا خطة لهذه الدورة بعد.'),
      editable ? h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' },
        types.includes('تلقائية') ? h('button', { type: 'button', class: 'btn', 'data-act': 'vs-suggest', onclick: () => {
          const r = suggest({ teachers: C.teachers, workdays: cyc.workdays, cfg: C.cfg, windows: C.windows, today: C.today, cycleEnd: cyc.end, existing: state.items });
          state.items = r.items; state.unplaced = r.unplaced; draw();
          toast(`اقتُرحت ${nf(r.items.length - items.length)} زيارة${r.unplaced.length ? `، ولم يُوضع ${nf(r.unplaced.length)}` : ''}`, 'ok');
        } }, icon('list', 18), ' اقترح جدولاً') : null,
        types.includes('يدوية') ? h('button', { type: 'button', class: 'btn', 'data-act': 'vs-add', onclick: () => addSheet() }, icon('plus', 18), ' أضف زيارة') : null) : null,
      state.unplaced.length ? h('details', null, h('summary', { class: 'small' }, `لم يُوضع ${nf(state.unplaced.length)} معلماً`), h('ul', { class: 'small' }, state.unplaced.map((u) => h('li', null, `${u.name}: ${u.reason}`)))) : null,
      v.length ? h('div', { class: 'err', role: 'alert', 'data-vs-err': '1' }, h('ul', null, v.map((m) => h('li', null, m)))) : null,
      items.length ? h('div', null, [...byDate.entries()].map(([d, list]) => h('div', { class: 'vs-day' }, h('h3', null, `${dayName(d)} ${hijri(d)} (${nf(list.length)})`),
        list.map(([x, i]) => h('div', { class: 'list-item row between nowrap', 'data-vs-item': String(i) },
          h('div', { class: 'grow' }, h('b', null, x.teacher_name || T[x.teacher + '|' + x.halaqa]?.name || ''), h('div', { class: 'muted xs' }, `الحلقة ${x.halaqa} • ${perName(x.period)} • ${x.source}`)),
          editable ? h('span', { class: 'row', style: 'gap:4px' },
            h('button', { type: 'button', class: 'btn sm', 'data-act': 'vs-swap', onclick: () => swapSheet(i) }, 'بدّل'),
            h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': 'احذف', onclick: () => { state.items.splice(i, 1); draw(); } }, '✕')) : null)))))
        : h('p', { class: 'empty' }, 'لا زيارات في الخطة.'),
      editable ? h('div', { class: 'row', style: 'gap:8px;margin-top:8px' },
        h('button', { type: 'button', class: 'btn', 'data-act': 'vs-save', onclick: (e) => save(false, e.currentTarget) }, 'احفظ مسودة'),
        h('button', { type: 'button', class: 'btn primary grow', 'data-act': 'vs-submit', onclick: (e) => save(true, e.currentTarget) }, 'ارفع الخطة لمسؤول القسم')) : null].filter(Boolean));
  }
  function teacherOptions(exclude) {
    return (C.teachers || []).filter((t) => !exclude.has(t.teacher + '|' + t.halaqa))
      .map((t) => h('option', { value: t.teacher + '|' + t.halaqa }, `${t.name} — الحلقة ${t.halaqa} — ${perName(t.period)}${t.followup_due ? ' • متابعة مستحقة' : ''}${t.last_visit ? '' : ' • لم يُزر'}`));
  }
  function addSheet() {
    const taken = new Set(state.items.map((x) => x.teacher + '|' + x.halaqa));
    const tSel = h('select', { 'aria-label': 'المعلم' }, teacherOptions(taken));
    const dSel = h('select', { 'aria-label': 'اليوم' }, state.cyc.workdays.filter((d) => d >= C.today).map((d) => h('option', { value: d }, `${dayName(d)} ${hijri(d)}`)));
    const err = h('div', { class: 'err', hidden: true });
    sheet({ title: 'أضف زيارة', body: h('div', null, h('label', { class: 'field' }, h('span', null, 'المعلم'), tSel), h('label', { class: 'field' }, h('span', null, 'اليوم'), dSel), err),
      actions: [{ label: 'أضف', kind: 'primary', onClick: (close) => {
        const t = T[tSel.value]; if (!t) { err.textContent = 'لا معلم متاح: كل معلمي حلقاتك في الخطة.'; err.hidden = false; return; }
        const next = [...state.items, { id: null, teacher: t.teacher, teacher_name: t.name, halaqa: t.halaqa, period: t.period, date: dSel.value, source: 'يدوية' }];
        const v = violations(next, opt()); if (v.length) { err.textContent = v[0]; err.hidden = false; return; }
        state.items = next.sort((a, b) => (a.date < b.date ? -1 : 1)); close(); draw();
      } }, { label: 'تراجع' }] });
  }
  function swapSheet(i) {
    const taken = new Set(state.items.map((x) => x.teacher + '|' + x.halaqa));
    const tSel = h('select', { 'aria-label': 'المعلم البديل' }, teacherOptions(taken));
    const err = h('div', { class: 'err', hidden: true });
    sheet({ title: 'بدّل المعلم', body: h('div', null, h('p', { class: 'muted small' }, 'يبقى اليوم نفسه إن سمح حد فترة البديل.'), h('label', { class: 'field' }, h('span', null, 'المعلم البديل'), tSel), err),
      actions: [{ label: 'بدّل', kind: 'primary', onClick: (close) => {
        const t = T[tSel.value]; if (!t) { err.textContent = 'لا معلم بديل متاح: كل معلمي حلقاتك في الخطة.'; err.hidden = false; return; }
        const r = swap(state.items, i, t, { cfg: C.cfg, windows: C.windows });
        if (!r.ok) { err.textContent = r.reason; err.hidden = false; return; }
        state.items = r.items; close(); draw();
      } }, { label: 'تراجع' }] });
  }
  async function save(submit, btn) {
    const v = violations(state.items, opt());
    if (v.length) { toast(v[0], 'bad'); return; }
    if (submit && !state.items.length) { toast('أضف زيارة واحدة على الأقل قبل الرفع', 'bad'); return; }
    if (submit && !(await confirmBox(`ترفع خطة ${nf(state.items.length)} زيارة لمسؤول القسم ليعتمدها أو يعيدها بملاحظة. لا تعدّلها بعد الرفع إلا إن أُعيدت. تأكيد الرفع؟`, 'ارفع'))) return;
    btn.disabled = true;
    try {
      const r = await rpc('rpc_vsched_save', { p: { id: state.plan?.id || uuid(), department: C.department, cycle_start: state.cyc.start, rv: state.plan?.rv,
        items: state.items.map((x) => ({ id: x.id || uuid(), teacher: x.teacher, halaqa: x.halaqa, date: x.date, source: x.source })), submit } });
      if (r.conflict) { toast(r.reason, 'bad'); return; }
      toast(submit ? 'رُفعت الخطة لمسؤول القسم' : 'حُفظت المسودة', 'ok');
      C.plans = [...(C.plans || []).filter((p) => p.id !== r.plan.id), r.plan]; load();
    } catch (e) { fail(e); } finally { btn.disabled = false; }
  }
  load();
  return wrap;
}

async function dailyTab(C) {
  const wrap = h('div', { 'data-vs-daily': '1' });
  let d;
  try { d = await rpc('rpc_vsched_daily', { p_dept: C.department }); } catch (e) { wrap.append(h('p', { class: 'err' }, String(e.message || 'تعذّر تحميل قائمة اليوم'))); return wrap; }
  const pct = Math.min(100, Math.round((d.progress.done / Math.max(1, d.progress.goal)) * 100));
  const draw = () => wrap.replaceChildren(
    h('p', { class: 'small' }, `قائمة ${dayName(d.day)} ${hijri(d.day)}: اختر من تستطيع زيارته. لا يظهر فيها من زرته أمس، وتبقى ثابتة طوال اليوم.`),
    h('div', { class: 'vs-progress', role: 'progressbar', 'aria-valuenow': String(d.progress.done), 'aria-valuemax': String(d.progress.goal) },
      h('div', { class: 'vs-bar', style: `width:${pct}%` }), h('span', { class: 'small' }, `زرت ${nf(d.progress.done)} من هدف ${nf(d.progress.goal)} معلمين في هذه الدورة`)),
    ...(d.items.length ? d.items.map((it) => h('label', { class: 'list-item row between nowrap', 'data-vs-daily-item': it.teacher },
      h('span', { class: 'grow' }, h('b', null, it.name), h('div', { class: 'muted xs' }, `الحلقة ${it.halaqa} • ${perName(it.period)}`)),
      h('span', { class: 'row', style: 'gap:6px' }, it.followup ? badge('متابعة مستحقة', 'warn') : null, it.visited_today ? badge('زُرت', 'ok') : null,
        h('input', { type: 'checkbox', checked: !!it.picked, 'aria-label': 'سأزوره اليوم', onchange: async (e) => {
          try { const r = await rpc('rpc_vsched_pick', { p_dept: C.department, p_teacher: it.teacher, p_on: e.target.checked }); it.picked = r.picks.includes(it.teacher); }
          catch (x) { e.target.checked = !e.target.checked; fail(x); }
        } }),
        h('a', { class: 'btn sm', href: '#/زيارة?' + new URLSearchParams({ معلم: it.teacher, حلقة: it.halaqa }) }, 'زيارة')))) : [h('p', { class: 'empty' }, 'لا معلمين في قائمة اليوم.')]));
  draw();
  return wrap;
}

// ---------- مسؤول القسم: للاعتماد ----------
async function inboxSection() {
  const sec = h('section', { class: 'card', 'data-vs': 'inbox' });
  const d = await rpc('rpc_vsched_inbox').catch(() => null);
  const list = (d?.plans || []);
  const pend = list.filter((p) => p.status === 'مرفوعة');
  appendAll(sec, h('h2', { style: 'margin:0 0 6px' }, icon('inbox', 20), ` خطط للاعتماد (${nf(pend.length)})`),
    list.length ? list.map((p) => h('button', { type: 'button', class: 'list-item rp-row-btn', 'data-vs-plan-row': p.id, onclick: () => decideSheet(p, () => location.reload()) },
      h('div', { class: 'row between nowrap' }, h('div', { class: 'grow' }, h('b', null, p.supervisor_name), h('div', { class: 'muted xs' },
        `${p.department_name} • ${hijri(p.cycle_start)} – ${hijri(p.cycle_end)} • ${nf(p.items.length)} زيارة${p.submitted_at ? ' • رُفعت ' + hijri(p.submitted_at) : ''}`)), badge(p.status, ST[p.status])))) : h('p', { class: 'empty' }, 'لا خطط في أقسامك الآن.'));
  return sec;
}
function decideSheet(p, after) {
  const body = h('div', null, h('p', { class: 'small' }, `${p.supervisor_name} — ${p.department_name} — ${hijri(p.cycle_start)} إلى ${hijri(p.cycle_end)}`),
    h('ul', { class: 'small' }, p.items.map((x) => h('li', null, `${dayName(x.date)} ${hijri(x.date)} — ${x.teacher_name} — الحلقة ${x.halaqa} — ${perName(x.period)} (${x.source})`))));
  const actions = [];
  if (p.can_decide) {
    actions.push({ label: 'اعتمد', kind: 'primary', onClick: async (close) => {
      const r = await rpc('rpc_vsched_decide', { p_id: p.id, p_rv: p.rv, p_approve: true, p_note: null });
      if (r.conflict) { toast(r.reason, 'bad'); return; } toast('اعتُمدت الخطة', 'ok'); close(); setTimeout(() => after?.(), 1200);
    } });
    actions.push({ label: 'أعِد بملاحظة', onClick: async (close) => {
      const f = await askForm({ title: 'إعادة الخطة للموجه', intro: 'اكتب ما يلزم تعديله.', fields: [{ name: 'n', label: 'الملاحظة', area: true, required: true }], ok: 'أعِد' });
      if (!f) return;
      const r = await rpc('rpc_vsched_decide', { p_id: p.id, p_rv: p.rv, p_approve: false, p_note: f.n });
      if (r.conflict) { toast(r.reason, 'bad'); return; } toast('أُعيدت الخطة بملاحظتك', 'ok'); close(); setTimeout(() => after?.(), 1200);
    } });
  }
  actions.push({ label: 'إغلاق' });
  sheet({ title: 'خطة زيارات', body, actions });
}

// ---------- مسؤول القسم: إعدادات أقسامي (مسؤول الشعبة ومساعده: كل الأقسام) ----------
const TYPES = ['يدوية', 'تلقائية', 'حسب الإمكان'];
async function cfgSection() {
  const sec = h('section', { class: 'card', 'data-vs': 'cfg' });
  const d = await rpc('rpc_vsched_dept_cfgs').catch(() => null);
  const list = d?.departments || [];
  const line = (c) => `${c.cycle} • ${c.types.join('، ')} • ${nf(c.max_per_period)} في الفترة • ${nf(c.visit_minutes)} د • قائمة اليوم ${nf(c.list_size)} • الهدف ${nf(c.goal)}`;
  const det = h('details', null, h('summary', null, h('b', null, `إعدادات خطط الزيارات لأقسامي (${nf(list.length)})`)),
    list.length ? list.map((x) => h('div', { class: 'list-item row between nowrap', 'data-vs-cfg': x.code },
      h('div', { class: 'grow' }, h('b', null, x.name), h('div', { class: 'muted xs' }, line(x.cfg))),
      h('button', { type: 'button', class: 'btn sm', 'data-act': 'vs-cfg-edit', onclick: () => cfgSheet(x) }, 'تعديل'))) : h('p', { class: 'empty' }, 'لا أقسام لك.'));
  sec.append(h('h2', { style: 'margin:0 0 6px' }, icon('filter', 20), ' إعدادات الأقسام'), det);
  return sec;
}
function cfgSheet(x) {
  const c = x.cfg;
  const cyc = h('select', { 'aria-label': 'دورية الرفع' }, ['أسبوعية', 'شهرية'].map((v) => h('option', { value: v }, v))); cyc.value = c.cycle;
  const ty = TYPES.map((t) => h('input', { type: 'checkbox', value: t, checked: c.types.includes(t) }));
  const num = (v, min, max, lbl) => { const e = h('input', { type: 'number', min: String(min), max: String(max), inputmode: 'numeric', 'aria-label': lbl }); e.value = v; return e; };
  const mp = num(c.max_per_period, 1, 6, 'أقصى زيارات في الفترة'), vm = num(c.visit_minutes, 10, 120, 'مدة الزيارة'), ls = num(c.list_size, 3, 15, 'عدد قائمة اليوم'), gl = num(c.goal, 1, 40, 'هدف الدورة');
  const rs = h('input', { type: 'text', placeholder: 'سبب التغيير', 'aria-label': 'سبب التغيير' });
  const err = h('div', { class: 'err', hidden: true });
  const f = (l, e) => h('label', { class: 'field' }, h('span', null, l), e);
  sheet({ title: `إعدادات ${x.name}`, body: h('div', null, f('دورية الرفع', cyc),
    h('div', { class: 'field' }, h('span', null, 'أنواع الخطة (أكثر من نوع)'), ...ty.map((e) => h('label', { class: 'row', style: 'gap:6px' }, e, e.value))),
    f('أقصى زيارات في الفترة الواحدة', mp), f('مدة الزيارة المتوقعة (دقيقة)', vm), f('عدد معلمي «قائمة اليوم»', ls), f('هدف الدورة في «حسب الإمكان» (معلمون)', gl), f('السبب (يُسجَّل مع اسمك)', rs), err),
  actions: [{ label: 'احفظ', kind: 'primary', onClick: async (close) => {
    const types = ty.filter((e) => e.checked).map((e) => e.value);
    if (!types.length) { err.textContent = 'فعّل نوعاً واحداً على الأقل.'; err.hidden = false; return; }
    if (rs.value.trim().length < 3) { err.textContent = 'اكتب سبب التغيير.'; err.hidden = false; return; }
    const want = { 'vsched.cycle': cyc.value, 'vsched.types': types, 'vsched.max_per_period': Number(mp.value), 'vsched.visit_minutes': Number(vm.value),
      'vsched.flex_list_size': Number(ls.value), 'vsched.flex_goal': Number(gl.value) };
    const cur = { 'vsched.cycle': c.cycle, 'vsched.types': c.types, 'vsched.max_per_period': c.max_per_period, 'vsched.visit_minutes': c.visit_minutes,
      'vsched.flex_list_size': c.list_size, 'vsched.flex_goal': c.goal };
    const changed = Object.keys(want).filter((k) => JSON.stringify(want[k]) !== JSON.stringify(cur[k]));
    if (!changed.length) { close(); return; }
    for (const k of changed) await rpc('rpc_vsched_set_cfg', { p_dept: x.code, p_key: k, p_value: want[k], p_reason: rs.value.trim() });
    toast(`حُفظت ${nf(changed.length)} إعدادات لقسم ${x.name}`, 'ok'); close(); location.reload();
  } }, { label: 'تراجع' }] });
}

// ---------- مسؤول الشعبة: الخطط غير المعتمدة ----------
async function pendingSection() {
  const sec = h('section', { class: 'card', 'data-vs': 'pending' });
  const d = await rpc('rpc_vsched_pending').catch(() => null);
  const list = d?.plans || [];
  const late = list.filter((p) => p.overdue).length;
  appendAll(sec, h('h2', { style: 'margin:0 0 6px' }, icon('alert', 20), ` الخطط غير المعتمدة (${nf(list.length)})`),
    h('p', { class: 'muted xs' }, `مرتبة من الأقدم انتظاراً. «متأخرة» إذا انتظرت ${nf(d?.overdue_days ?? 3)} أيام أو أكثر عند مسؤول القسم. المتأخرة الآن: ${nf(late)}.`),
    d?.ended ? h('p', { class: 'muted xs' }, `و${nf(d.ended)} خطة انتهت دورتها قبل اعتمادها (لا تظهر في القائمة).`) : null,
    list.length ? list.map((p) => h('div', { class: `list-item${p.overdue ? ' vs-late' : ''}`, 'data-vs-pending': p.id, 'data-overdue': String(!!p.overdue) },
      h('div', { class: 'row between nowrap', style: 'gap:8px' },
        h('div', { class: 'grow' }, h('b', null, p.supervisor_name), h('div', { class: 'muted xs' },
          `${p.department_name} • مسؤول القسم: ${(p.dept_heads || []).join('، ') || 'لا أحد مكلَّف'} • ${nf(p.items)} زيارة • تنتظر: ${p.waiting_on}`)),
        h('span', { class: 'row', style: 'gap:4px' }, badge(`${nf(p.waiting_days)} يوم`, p.overdue ? 'bad' : 'info'), p.overdue ? badge('متأخرة', 'bad') : null,
          p.head_decides ? badge('بلا مسؤول قسم', 'warn') : null,
          // قرار صاحب النظام 2026-11-26: القسم الذي لا مسؤول قسم له ← يعتمد مسؤول الشعبة مؤقتاً (لا مساعده)
          p.can_decide ? h('button', { type: 'button', class: 'btn sm primary', 'data-act': 'vs-head-decide', onclick: () => headDecide(p.id) }, 'اعتمد أو أعِد') : null)))) : h('p', { class: 'empty' }, 'كل الخطط المرفوعة معتمدة.'));
  if (d?.head_waiting) sec.insertBefore(h('p', { class: 'note small', 'data-vs-head-waiting': String(d.head_waiting) },
    `${nf(d.head_waiting)} خطة في أقسام بلا مسؤول قسم تنتظر اعتمادك أنت مؤقتاً${d.can_decide_head ? ' (زر «اعتمد أو أعِد» بجانب كل واحدة)' : ' (يعتمدها مسؤول الشعبة)'}.`), sec.children[2] || null);
  return sec;
}
async function headDecide(id) {
  try {
    const ib = await rpc('rpc_vsched_inbox');
    const p = (ib?.plans || []).find((x) => x.id === id);
    if (!p) { toast('لم أجد الخطة. حدّث الصفحة.', 'bad'); return; }
    decideSheet(p, () => location.reload());
  } catch (e) { fail(e); }
}
