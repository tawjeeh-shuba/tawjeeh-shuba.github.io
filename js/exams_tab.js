// تبويب «الاختبارات» في ملف المعلم (إعادة البناء 2026-11-21): يفهمه الموجه من أول نظرة دون شرح خارجي.
// الترتيب: «الخلاصة» (3–4 جمل مع «ما معنى هذا؟» والتوصية) ← سبع نوافذ مغلقة افتراضياً، على كل عنوان رقم مختصر:
//   التنشيطية، الفصلية، الملاحظات التجويدية، طلاب يحتاجون متابعة، سير المعلم، التقرير المفصل، الخطة العلاجية.
// البيانات: استدعاء واحد (rpc_teacher_exams_v3) بلا أسماء، يُحفظ مؤقتاً في الجلسة ويُتحقق منه في الخلفية. الأسماء من rpc_exam_student_names
// عند فتح أول قائمة طلاب فقط (بالمفتاح، ومسجَّلة). كل حساب وكل نص توضيحي في exams_logic.js والإعدادات؛ لا عتبة ولا جملة شرح هنا.
import { h, rpc, icon, toast, fail, hijri, nf, askForm } from './core.js';
import * as L from './exams_logic.js';

const CK = (id) => `tawjeeh.ex3.${id}`;
const store = { get(id) { try { return JSON.parse(sessionStorage.getItem(CK(id)) || 'null'); } catch { return null; } },
  set(id, d) { try { sessionStorage.setItem(CK(id), JSON.stringify(d)); } catch { /* التخزين ممتلئ أو غير متاح */ } },
  drop(id) { try { sessionStorage.removeItem(CK(id)); } catch { /* لا شيء */ } } };
const perf = (page, kind, ms) => { rpc('rpc_perf_log', { p_page: page, p_kind: kind, p_ms: Math.round(ms), p_cold: false }).catch(() => {}); };
const N = (x) => Number(x) || 0;

export function fetchExams(id) {
  const live = rpc('rpc_teacher_exams_v3', { p_teacher: id }).then((d) => { store.set(id, d); return d; });
  return { cached: store.get(id), live };
}
export const forget = (id) => store.drop(id);

// ---------- عناصر صغيرة ----------
const skeleton = () => h('div', { class: 'ex-skel', 'aria-busy': 'true', 'aria-label': 'جارٍ تحميل الاختبارات' },
  h('div', { class: 'sk sk-card' }), h('div', { class: 'sk sk-bar' }), h('div', { class: 'sk sk-bar' }), h('div', { class: 'sk sk-bar' }));
// مصطلح مع ⓘ يشرحه من الإعدادات (exams.glossary)
function term(cfg, label, shown = label) {
  const txt = cfg.glossary[label];
  if (!txt) return h('span', null, shown);
  const tip = h('span', { class: 'xr-tip', role: 'note', hidden: true }, txt);
  const b = h('button', { type: 'button', class: 'xr-i', 'aria-label': `ما معنى «${label}»؟`, 'aria-expanded': 'false',
    onclick: (e) => { e.stopPropagation(); e.preventDefault(); tip.hidden = !tip.hidden; b.setAttribute('aria-expanded', String(!tip.hidden)); } }, 'ⓘ');
  return h('span', { class: 'xr-term' }, shown, b, tip);
}
const ICO = { pass: 'check', fail: 'x', nores: 'clock', cand: 'users' };
const chip = (kind, text) => h('span', { class: `xr-st ${kind}` }, icon(ICO[kind], 15, 'i'), text);
const resChip = (res) => (res === 'ناجح' ? chip('pass', res) : res === 'راسب' ? chip('fail', res) : res === 'لم تُرصد' ? chip('nores', res) : h('span', { class: 'xr-st' }, res));
const copy = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok, 'ok'); return true; } catch { toast('تعذّر النسخ', 'bad'); return false; } };

export async function render(root, state) {
  const t0 = performance.now();
  state.examsP ||= fetchExams(state.id);
  const { cached } = state.examsP;
  let shown = null;
  const paint = (d) => { const s = JSON.stringify(d); if (s === shown) return; shown = s; draw(root, d, state, s); };
  if (cached) paint(cached); else root.replaceChildren(skeleton());
  try { paint(await state.examsP.live); }
  catch (e) { if (!cached) root.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'err' }, 'تعذّر تحميل الاختبارات، حاول مرة أخرى'))); fail(e); }
  state.examsP = null;
  perf('تبويب الاختبارات', 'تبويب', performance.now() - t0);
}

function draw(root, d, state, key) {
  // البيانات نفسها عند إعادة فتح التبويب: لا يُعاد الحساب (يُستعمل الناتج المحفوظ في حالة الملف)
  const R = key && state.examRKey === key && state.examR ? state.examR : L.build(d);
  state.examRKey = key;
  const { cfg } = R; const U = cfg.ui; const c = cfg.colors;
  state.examR = R; state.examD = d;
  root.className = 'ex xr';
  root.setAttribute('style', `--exs-pass:${c.pass};--exs-fail:${c.fail};--exs-nores:${c.nores};--exs-missbg:${c.missingBg};--exs-note:${c.note}`);
  const names = state.examNames = { map: null, on: !!d.names, p: null };
  const loadNames = () => (names.p ||= rpc('rpc_exam_student_names', { p_teacher: state.id })
    .then((r) => { names.map = r.names ? r.map : {}; names.on = !!r.names; return names.map; })
    .catch((e) => { names.map = {}; fail(e); return {}; }));
  const nameOf = (sid, i) => names.map?.[sid]?.[0] || `طالب ${nf(i + 1)}`;
  const ctx = { R, d, state, names, loadNames, nameOf };
  if (!R.has) {
    root.replaceChildren(h('div', { class: 'card xr-empty' }, icon('chart', 28), h('p', null, U.empty_all || '')));
    if ((d.plans2 || []).length) root.append(planWindow(ctx, true));
    return;
  }

  // ---------- الخلاصة ----------
  const sum = h('section', { class: 'card xr-sum', 'aria-label': 'الخلاصة' },
    h('div', { class: 'xr-sumh' }, h('h2', null, 'الخلاصة'), h('span', { class: 'muted xs' }, `نطاق التحليل: ${R.winLabel}`)),
    h('div', { class: 'xr-cards' }, R.cards.map((cd) => {
      const help = h('p', { class: 'xr-help', hidden: true }, cd.help || '');
      const b = h('button', { type: 'button', class: 'xr-why', 'aria-expanded': 'false', onclick: () => { help.hidden = !help.hidden; b.setAttribute('aria-expanded', String(!help.hidden)); } }, 'ما معنى هذا؟');
      return h('article', { class: `xr-card ${cd.tone}` },
        h('span', { class: 'xr-dot', 'aria-hidden': 'true' }, icon(cd.tone === 'good' ? 'check' : cd.tone === 'bad' ? 'alert' : 'info', 18)),
        h('div', null, h('p', { class: 'xr-ct' }, cd.text),
          h('div', { class: 'xr-cta' }, cd.help ? b : null, h('button', { type: 'button', class: 'xr-go', onclick: () => openWin(cd.go) }, 'التفاصيل', icon('chev', 14, 'i'))), help));
    })),
    R.rec ? h('p', { class: 'xr-rec' }, icon('clipboard', 18), h('span', null, h('b', null, 'التوصية: '), R.rec)) : null);

  // ---------- النوافذ (مغلقة، والمحتوى يُبنى عند أول فتح) ----------
  const wins = ctx.wins = {};
  const win = (key, title, badge, body, { tone = '', ico = 'chart' } = {}) => {
    let built = false;
    const inner = h('div', { class: 'xr-wb' });
    const el = h('details', { class: `card xr-w ${tone}`, id: `xr-${key}` },
      h('summary', null, h('span', { class: 'xr-wi', 'aria-hidden': 'true' }, icon(ico, 20)),
        h('span', { class: 'xr-wt' }, h('b', null, title), h('span', { class: `xr-badge ${tone}` }, badge))), inner);
    el.addEventListener('toggle', () => { if (el.open && !built) { built = true; const t1 = performance.now(); inner.replaceChildren(...[].concat(body())); perf(`نافذة ${title}`.slice(0, 40), 'تبويب', performance.now() - t1); } });
    wins[key] = el; return el;
  };
  function openWin(key) { const el = wins[key]; if (!el) return; el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  const doneM = R.months.filter((m) => m.state === 'done' || m.state === 'nores');
  const lastM = R.lastMonthly;
  const missM = R.months.filter((m) => m.state === 'missing').length;
  const lastT = R.terms.find((t) => t.state !== 'missing');
  const termPart = R.A.termPart;
  const TYPE = ['نوع', 'نوعان', 'أنواع', 'نوعاً', 'نوع'];
  root.replaceChildren(sum,
    win('monthly', 'الاختبارات التنشيطية', R.months.length ? [L.arCount(doneM.length, 'month'), missM ? `لم يرشّح في ${L.arCount(missM, 'month', { gen: true })}` : '', lastM ? (lastM.state === 'nores' ? 'آخرها: لم تُرصد' : `آخرها ${L.pct(lastM.rate, cfg.digits)}`) : ''].filter(Boolean).join(' • ') : 'لا يوجد',
      () => monthlyBody(ctx), { tone: missM ? 'bad' : '', ico: 'cal' }),
    win('term', 'الاختبارات الفصلية', R.terms.length ? [L.ofTotal(termPart.n, termPart.total, 'term'), lastT ? `آخرها ${L.pct(lastT.rate, cfg.digits)}` : ''].filter(Boolean).join(' • ') : 'لا يوجد',
      () => termBody(ctx), { tone: R.terms.some((t) => t.state === 'missing') ? 'bad' : '', ico: 'cal' }),
    win('notes', 'الملاحظات التجويدية', R.noteTypes.length ? `${L.arCount(R.noteTypes.length, TYPE)} • تكررت عند ${L.arCount(R.repeatedStudents, 'student', { gen: true })}` : 'لا ملاحظات',
      () => notesBody(ctx), { ico: 'edit' }),
    win('followup', 'طلاب يحتاجون متابعة', R.followup.length ? `${L.arCount(R.followup.length, 'student')} من ${nf(R.winStudentsN)}` : 'لا يوجد',
      () => followupBody(ctx), { tone: R.followup.length ? 'warn' : '', ico: 'users' }),
    win('trend', 'سير المعلم', R.trend.word || 'لا يكفي للحكم', () => trendBody(ctx), { tone: R.trend.label === 'up' ? 'good' : R.trend.red ? 'bad' : '', ico: 'chart' }),
    win('report', 'التقرير المفصل', 'للنسخ والطباعة', () => reportBody(ctx), { ico: 'list' }),
    planWindow(ctx, false));
  if (state.extra?.openPlan) { state.extra = null; openWin('plan'); }
}

// ---------- قائمة طلاب (بالأسماء إن كان المفتاح مشغّلاً؛ وفتحها يُسجَّل في سجل الوصول) ----------
function studentList(ctx, items, renderItem) {
  const box = h('div', { class: 'xr-sl' });
  const btn = h('button', { type: 'button', class: 'btn sm soft', onclick: async () => {
    btn.disabled = true; await ctx.loadNames(); btn.remove();
    box.replaceChildren(h('ol', { class: 'xr-slist' }, items.map((it, i) => renderItem(it, i))),
      ctx.names.on ? null : h('p', { class: 'muted xs' }, ctx.R.cfg.ui.names_off || ''));
  } }, icon('users', 16), `الطلاب (${nf(items.length)})`);
  box.append(btn);
  return box;
}

// ---------- 1 و2) بطاقة شهر أو فصل: ثلاث حالات بثلاثة أشكال ----------
const ORDER = ['راسب', 'لم تُرصد', 'مستبعد', 'ناجح'];
function periodCard(ctx, m) {
  const { R } = ctx; const { cfg } = R; const U = cfg.ui;
  if (m.state === 'none') return h('article', { class: 'xr-mc none' }, h('div', { class: 'xr-mh' }, h('h3', null, L.pName(m)), h('span', { class: 'xr-tag none' }, U.month_none || '')),
    h('p', { class: 'muted xs' }, U.month_none_sub || ''));
  if (m.state === 'missing') return h('article', { class: 'xr-mc missing', role: 'note' }, h('div', { class: 'xr-mh' }, h('h3', null, L.pName(m)),
    h('span', { class: 'xr-tag missing' }, icon('alert', 15, 'i'), U.month_missing || '')), h('p', { class: 'xs' }, U.month_missing_sub || ''));
  const p = m.p;
  const cmp = [];
  if (m.deptRate != null) cmp.push(h('span', null, term(cfg, 'متوسط القسم', cfg.excludeSelf ? 'بقية القسم' : 'القسم'), ` ${L.pct(m.deptRate, cfg.digits)}`));
  if (m.divRate != null) cmp.push(h('span', null, term(cfg, 'متوسط الشعبة', 'الشعبة'), ` ${L.pct(m.divRate, cfg.digits)}`));
  const dv = m.vsDept ?? m.vsDiv; const who = m.vsDept != null ? (cfg.excludeSelf ? 'بقية القسم' : 'القسم') : 'الشعبة';
  const gap = dv == null ? null : L.pts(dv) === 0 ? `مثل ${who}` : `${dv > 0 ? 'أعلى من' : 'أقل من'} ${who} بـ ${L.arCount(L.pts(dv), 'point', { one: false, gen: true })}`;
  const gapCls = dv == null || m.state === 'nores' ? '' : dv * 100 <= -cfg.declinePoints ? 'bad' : dv * 100 >= cfg.trendPts ? 'good' : '';
  return h('article', { class: `xr-mc ${m.state}` },
    h('div', { class: 'xr-mh' }, h('h3', null, L.pName(m)), h('b', { class: 'xr-rate', title: 'نسبة النجاح' }, L.pct(m.rate, cfg.digits))),
    m.state === 'nores' ? h('p', { class: 'xr-tag nores' }, icon('clock', 15, 'i'), U.month_nores || '') : null,
    h('div', { class: 'xr-chips' }, chip('cand', L.arCount(p.t, 'candidate')), chip('pass', `${nf(p.p)} ناجح`), chip('fail', `${nf(p.f)} راسب`), chip('nores', `${nf(p.r)} لم تُرصد`),
      N(p.x) ? h('span', { class: 'xr-st' }, `مستبعد ${nf(p.x)}`) : null),
    cfg.noresPending && N(p.r) ? h('p', { class: 'xr-pend' }, icon('clock', 13, 'i'), U.nores_badge || '') : null,
    cmp.length ? h('p', { class: 'xr-cmp' }, ...cmp.flatMap((x, i) => (i ? [' • ', x] : [x])), gap ? h('span', { class: `xr-gap ${gapCls}` }, ` — ${gap}`) : null)
      : h('p', { class: 'muted xs' }, 'لا متوسط للمقارنة في هذا الشهر'),
    m.deptWhy === 'small' ? h('p', { class: 'muted xs' }, `${cfg.excludeSelf ? 'بقية قسمه' : 'قسمه'} ${L.arCount(m.deptT, 'candidate', { one: false })} فقط هنا، فالمقارنة بالشعبة.`) : null,
    studentList(ctx, m.rows.slice().sort((a, b) => ORDER.indexOf(a.res) - ORDER.indexOf(b.res) || b.notes.length - a.notes.length),
      (r, i) => h('li', { class: 'xr-srow' }, h('div', { class: 'xr-sh' }, h('b', null, ctx.nameOf(r.sid, i)), resChip(r.res), r.conf ? h('span', { class: 'badge gold' }, U.conf_badge || '') : null),
        r.notes.length ? h('div', { class: 'xr-note' }, icon('edit', 13, 'i'), [...new Set(r.notes.map((n) => n.g))].join('، ')) : null)));
}
function monthlyBody(ctx) {
  const { R } = ctx; const { cfg } = R;
  if (!R.months.length) return h('p', { class: 'empty' }, cfg.ui.empty_monthly || '');
  return [h('p', { class: 'muted xs xr-legend' }, 'الأحدث أولاً • ', term(cfg, 'نسبة النجاح'), ' • ', term(cfg, 'المرشحون'), ' • ', term(cfg, 'لم تُرصد'), ' • ', term(cfg, 'نقطة')),
    h('div', { class: 'xr-mlist' }, R.months.map((m) => periodCard(ctx, m)))];
}
function termBody(ctx) {
  const { R } = ctx;
  if (!R.terms.length) return h('p', { class: 'empty' }, R.cfg.ui.empty_term || '');
  return [h('p', { class: 'muted xs xr-legend' }, 'الأحدث أولاً • ', term(R.cfg, 'الفصلي', 'الاختبار الفصلي'), ' • ', term(R.cfg, 'نسبة النجاح')),
    h('div', { class: 'xr-mlist' }, R.terms.map((m) => periodCard(ctx, m)))];
}

// ---------- 3) الملاحظات التجويدية ----------
function notesBody(ctx) {
  const { R } = ctx; const { cfg } = R;
  if (!R.noteTypes.length) return h('p', { class: 'xr-fine' }, icon('check', 18), ' ', cfg.ui.empty_notes || '');
  const tw = { up: ['يزيد', 'up'], down: ['ينقص', 'down'], flat: ['ثابت', 'flat'] };
  return [h('p', { class: 'small xr-def' }, h('b', null, '«التكرار»: '), cfg.glossary['التكرار'] || ''),
    h('p', { class: 'muted xs' }, cfg.ui.source_note || ''),
    h('ul', { class: 'xr-types' }, R.noteTypes.map((t) => {
      const [tw1, tcls] = tw[t.trend.label] || ['لا يكفي للحكم', 'flat'];
      const more = h('div', { class: 'xr-tmore', hidden: true },
        h('p', { class: 'xs muted' }, 'حسب الشهر (من أخذ النوع من المختبَرين):'),
        h('div', { class: 'xr-chips' }, t.byPeriod.map((x) => h('span', { class: 'xr-st' }, `${L.pName(x.p)}: ${nf(x.n)} من ${nf(x.t)}`))),
        t.notes.length > 1 ? h('p', { class: 'xs' }, 'تفصيل النوع: ', t.notes.map(([n, k]) => `${n} (${L.arCount(k, 'times', { one: false })})`).join('، ')) : null,
        studentList(ctx, t.sids.map((sid) => ({ sid, n: R.winRows.filter((r) => r.sid === sid && r.notes.some((x) => x.g === t.g)).length })).sort((a, b) => b.n - a.n),
          (s, i) => h('li', { class: 'xr-srow' }, h('div', { class: 'xr-sh' }, h('b', null, ctx.nameOf(s.sid, i)),
            h('span', { class: `xr-st ${s.n >= cfg.repeatMin ? 'warn' : ''}` }, `في ${L.arCount(s.n, 'exam', { gen: true })}`)))));
      const b = h('button', { type: 'button', class: 'xr-trow', 'aria-expanded': 'false', onclick: () => { more.hidden = !more.hidden; b.setAttribute('aria-expanded', String(!more.hidden)); } },
        h('span', { class: 'xr-th' }, h('b', null, t.g), h('span', { class: `xr-trend ${tcls}` }, tcls === 'up' ? '▲ ' : tcls === 'down' ? '▼ ' : '＝ ', tw1)),
        h('span', { class: 'xs' }, `${L.arCount(t.students, 'student')} • في ${L.arCount(t.months, 'month', { gen: true })} • تكررت عند ${L.arCount(t.repeated, 'student', { gen: true })}`));
      return h('li', null, b, more);
    })),
    h('p', { class: 'xs muted' }, term(cfg, 'الاتجاه', 'الاتجاه'), ': «يزيد» أي أن نسبة طلابه الذين أخذوا النوع في آخر الأشهر أعلى مما قبلها.')];
}

// ---------- 4) طلاب يحتاجون متابعة: كل طالب مرة واحدة مع كل أسبابه، ومساره عند الضغط ----------
function followupBody(ctx) {
  const { R } = ctx; const { cfg } = R;
  if (!R.followup.length) return h('p', { class: 'xr-fine' }, icon('check', 18), ' ', cfg.ui.empty_followup || '');
  const ui = { r: '' };
  const listBox = h('div', { 'aria-live': 'polite' });
  const chipsBox = h('div', { class: 'xr-chips', role: 'group', 'aria-label': 'تصفية حسب السبب' });
  const reasonTxt = (r) => (r.code === 'FAILED' ? `رسب في ${L.arCount(r.n, 'exam', { gen: true })}` : r.code === 'NORES' ? `لم تُرصد في ${L.arCount(r.n, 'exam', { gen: true })}`
    : r.code === 'REPEAT' ? `تكرر: ${r.keys.map((k) => `${k.k} (${L.arCount(k.c, 'times', { one: false })})`).join('، ')}` : `${L.arCount(r.n, 'note')} في ${L.pName(r.at, true)}`);
  const drawChips = () => chipsBox.replaceChildren(...[['', `الكل (${nf(R.followup.length)})`], ...Object.entries(R.reasonCount).filter(([, n]) => n).map(([k, n]) => [k, `${L.reasonLabel[k]} (${nf(n)})`])]
    .map(([k, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(ui.r === k), onclick: () => { ui.r = k; drawChips(); drawList(); } }, label)));
  const drawList = async () => {
    const t1 = performance.now();
    await ctx.loadNames();
    const rows = R.followup.filter((s) => !ui.r || s.reasons.some((x) => x.code === ui.r));
    const ol = h('ol', { class: 'xr-fl' }); let shown = 0;
    const more = h('button', { type: 'button', class: 'btn block', hidden: true }, 'المزيد');
    const page = () => {
      rows.slice(shown, shown + cfg.page).forEach((s, j) => {
        const i = shown + j;
        const tl = h('div', { class: 'xr-tl', hidden: true }, h('p', { class: 'xs muted' }, 'مساره الكامل عبر الأشهر (الأقدم أولاً):'),
          h('ol', { class: 'xr-tll' }, s.items.map((it) => h('li', { class: `xr-tli ${it.res === 'راسب' ? 'fail' : it.res === 'لم تُرصد' ? 'nores' : 'pass'}` },
            h('span', { class: 'xr-tld', 'aria-hidden': 'true' }), h('b', null, L.pName(it)), ' ', resChip(it.res),
            it.notes.length ? h('div', { class: 'xr-note' }, icon('edit', 13, 'i'), it.notes.map((n) => n.note).join('، ')) : null))));
        const b = h('button', { type: 'button', class: 'xr-frow', 'aria-expanded': 'false', onclick: () => { tl.hidden = !tl.hidden; b.setAttribute('aria-expanded', String(!tl.hidden)); } },
          h('div', { class: 'xr-sh' }, h('span', { class: 'xr-rank' }, nf(i + 1)), h('b', null, ctx.nameOf(s.sid, i)), s.conf ? h('span', { class: 'badge gold' }, cfg.ui.conf_badge || '') : null),
          h('ul', { class: 'xr-reasons' }, s.reasons.map((r) => h('li', { class: `xr-rs ${r.code}` }, icon(r.code === 'FAILED' ? 'x' : r.code === 'NORES' ? 'clock' : 'edit', 13, 'i'), reasonTxt(r)))));
        ol.append(h('li', null, b, tl));
      });
      shown = Math.min(rows.length, shown + cfg.page); more.hidden = shown >= rows.length;
    };
    more.onclick = page; page();
    listBox.replaceChildren(ol, more, ctx.names.on ? null : h('p', { class: 'muted xs' }, cfg.ui.names_off || ''));
    if (ui.r) perf('فلتر طلاب المتابعة', 'فلتر', performance.now() - t1);
  };
  drawChips(); drawList();
  return [h('p', { class: 'small' }, term(cfg, 'يحتاج متابعة', `${L.arCount(R.followup.length, 'student')} يحتاجون متابعة`), ` من ${L.arCount(R.winStudentsN, 'student', { gen: true })} اختُبروا عنده في ${R.winLabel}، مرتبون من الأشد حاجة. اضغط الطالب لترى مساره.`),
    chipsBox, listBox];
}

// ---------- 5) سير المعلم: خط واحد مقابل المتوسط، وحكم بجملة ----------
function trendBody(ctx) {
  const { R } = ctx; const { cfg } = R; const T = R.trend;
  if (T.series.length < 2) return h('p', { class: 'empty' }, cfg.ui.empty_trend || '');
  const W = 340, H = 170, P = { l: 34, r: 12, t: 14, b: 26 };
  const s = T.series; const n = s.length;
  const x = (i) => W - P.r - (i * (W - P.l - P.r)) / Math.max(1, n - 1); // من اليمين (الأقدم) إلى اليسار (الأحدث)
  const y = (v) => P.t + (1 - v) * (H - P.t - P.b);
  const avg = s.map((e) => e.deptRate ?? e.divRate);
  const line = (vals) => vals.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ');
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); kids.forEach((k) => e.append(k)); return e; };
  const tone = T.label === 'up' ? 'good' : T.red ? 'bad' : 'flat';
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'xr-chart', role: 'img', 'aria-label': `نسبة النجاح شهراً شهراً مقابل المتوسط. الحكم: ${T.word || '—'}` });
  [0, 0.5, 1].forEach((g) => { svg.append(sv('line', { x1: P.l, x2: W - P.r, y1: y(g), y2: y(g), class: 'grid' }), sv('text', { x: P.l - 4, y: y(g) + 4, class: 'ax', 'text-anchor': 'end' }, `${g * 100}٪`)); });
  svg.append(sv('polyline', { points: line(avg), class: 'avg' }), sv('polyline', { points: line(s.map((e) => e.rate ?? 0)), class: `me ${tone}` }));
  s.forEach((e, i) => { svg.append(sv('circle', { cx: x(i), cy: y(e.rate ?? 0), r: 3.5, class: `pt ${tone}` }, sv('title', {}, `${L.pName(e.p)}: ${L.pct(e.rate, cfg.digits)}`)));
    if (i === 0 || i === n - 1 || n <= 5) svg.append(sv('text', { x: x(i), y: H - 8, class: 'ax', 'text-anchor': i === 0 ? 'end' : i === n - 1 ? 'start' : 'middle' }, L.hmonth(e.p.n))); });
  return [h('p', { class: `xr-verdict ${tone}` }, icon(tone === 'good' ? 'check' : tone === 'bad' ? 'alert' : 'info', 18), h('b', null, T.word || '—'),
      T.word ? h('span', null, ` — متوسط آخر ${L.arCount(T.k, 'month', { one: false })} ${L.pct(T.last, cfg.digits)} مقابل ${L.pct(T.prev, cfg.digits)} قبلها`) : null),
    h('div', { class: 'xr-chartbox' }, svg),
    h('p', { class: 'xs muted xr-key' }, h('span', { class: `k me ${tone}` }), ' نسبته   ', h('span', { class: 'k avg' }), ' ', term(cfg, 'متوسط القسم', cfg.excludeSelf ? 'متوسط بقية القسم' : 'متوسط القسم'), ' (أو الشعبة إن قلّ مختبَرو القسم)'),
    h('p', { class: 'xs muted' }, cfg.help.trend || '')];
}

// ---------- 6) التقرير المفصل ----------
function reportBody(ctx) {
  const { R, state } = ctx;
  const text = L.report(R, { teacher: state.f?.name || '', today: hijri(new Date()) });
  const view = h('div', { class: 'xr-report', dir: 'rtl' }, text.split('\n').map((l) => (l.startsWith('■') ? h('h3', null, l.slice(1).trim()) : l.trim() ? h('p', null, l) : null)));
  return [view, h('div', { class: 'xr-btns' },
    h('button', { type: 'button', class: 'btn soft', onclick: () => copy(text, 'نُسخ التقرير') }, icon('clipboard', 18), 'نسخ'),
    h('button', { type: 'button', class: 'btn soft', onclick: () => printReport(view) }, icon('list', 18), 'طباعة'))];
}
function printReport(view) {
  const area = h('div', { id: 'xr-print', dir: 'rtl' }, view.cloneNode(true));
  document.body.append(area); document.body.classList.add('xr-printing');
  const done = () => { area.remove(); document.body.classList.remove('xr-printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
}

// ---------- 7) الخطة العلاجية ----------
function planWindow(ctx, alone) {
  const { R, d, state } = ctx; const plans = d.plans2 || [];
  const latest = plans.find((p) => p.status !== 'ملغاة');
  const st = latest ? L.planStatus(latest, R) : null;
  let built = false; const inner = h('div', { class: 'xr-wb' });
  const tone = st?.code === 'met' ? 'good' : st?.code === 'unmet' ? 'bad' : '';
  const el = h('details', { class: 'card xr-w', id: 'xr-plan' },
    h('summary', null, h('span', { class: 'xr-wi', 'aria-hidden': 'true' }, icon('clipboard', 20)),
      h('span', { class: 'xr-wt' }, h('b', null, 'الخطة العلاجية'), h('span', { class: `xr-badge ${tone}` }, st ? `آخر خطة: ${st.label}` : 'لا خطة'))), inner);
  const build = () => { built = true; inner.replaceChildren(...planBody(ctx)); };
  el.addEventListener('toggle', () => { if (el.open && !built) build(); });
  if (ctx.wins) ctx.wins.plan = el;
  if (alone) { el.open = true; build(); }
  return el;
}
const savedMsg = (state, id) => h('div', { class: 'xr-saved', role: 'status' }, icon('check', 18), h('span', null, 'تم الحفظ في سجل المعلم'),
  h('button', { type: 'button', class: 'btn sm', onclick: () => { if (state.f?.can?.log) state.goTab?.('السجل', { plan: id }); else state.goTab?.('الاختبارات', { openPlan: true }); } }, '← عرض الخطة'));
const afterSave = (state) => { forget(state.id); state.examsP = null; };
function planBody(ctx) {
  const { R, d, state } = ctx; const U = R.cfg.ui; const out = [];
  const plans = (d.plans2 || []).slice(0, 3);
  out.push(h('div', { class: 'xr-plist' }, h('h3', null, 'آخر الخطط'), plans.length ? plans.map((p) => planRow(R, p, state, false)) : h('p', { class: 'empty' }, U.empty_plans || ''),
    plans.length && state.f?.can?.log ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => state.goTab?.('السجل') }, 'كل الخطط في «السجل»') : null));
  if (!d.can_plan || !R.has) return out;
  out.push(d.can_ai ? aiSteps(ctx) : h('p', { class: 'xr-note-box' }, icon('info', 16), h('span', null, U.ai_off || '')));
  out.push(templatePlan(ctx));
  return out;
}
export function planRow(R, p, state, withActions = true, canAct = true) {
  const st = L.planStatus(p, R);
  const cls = st.code === 'met' ? 'ok' : st.code === 'unmet' ? 'bad' : st.code === 'cancelled' ? 'gray' : 'gold';
  const textBox = h('details', { class: 'xr-ptext' }, h('summary', { class: 'xs' }, 'النص الكامل'),
    h('div', { class: 'xr-report' }, String(p.full || p.body || '').split('\n').map((l) => (l.trim() ? h('p', null, l) : null))),
    h('div', { class: 'xr-btns' }, h('button', { type: 'button', class: 'btn sm soft', onclick: () => copy(p.full || p.body || '', 'نُسخت الخطة') }, icon('clipboard', 16), 'نسخ'),
      p.wa ? h('button', { type: 'button', class: 'btn sm soft', onclick: () => copy(p.wa, 'نُسخت نسخة الواتساب') }, icon('chat', 16), 'نسخ نسخة الواتساب') : null));
  return h('article', { class: `xr-prow ${p.status === 'ملغاة' ? 'cancelled' : ''}`, id: `plan-${p.id}` },
    h('div', { class: 'row between' }, h('b', null, hijri(p.at)), h('span', { class: `badge ${cls}` }, st.label)),
    h('p', { class: 'xs muted' }, [`المصدر: ${p.kind === 'ذكاء اصطناعي' ? 'ذكاء اصطناعي' : 'قالب'}`, p.by ? `بواسطة ${p.by}` : '', p.goal != null ? `الهدف: ≥ ${nf(p.goal)}٪` : ''].filter(Boolean).join(' • ')),
    st.text ? h('p', { class: `xs ${st.code === 'met' ? 'xr-good' : 'xr-bad'}` }, st.text) : null,
    p.status === 'ملغاة' && p.cancel_reason ? h('p', { class: 'xs muted' }, `أُلغيت: ${p.cancel_reason}`) : null,
    textBox,
    withActions && canAct ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => setStatus(p, state) }, p.status === 'ملغاة' ? 'استرجاع' : 'إلغاء') : null);
}
async function setStatus(p, state) {
  const restore = p.status === 'ملغاة';
  const r = await askForm({ title: restore ? 'استرجاع الخطة' : 'إلغاء الخطة',
    intro: restore ? 'تعود الخطة نشطة، ويُسجَّل الاسترجاع في السجل.' : 'لا تُحذف الخطة: تُعلَّم «ملغاة» ويمكن استرجاعها، ويُسجَّل ذلك في السجل.',
    fields: [{ name: 'reason', label: 'السبب', required: true }], ok: restore ? 'استرجاع' : 'إلغاء' });
  if (!r) return;
  try { await rpc('rpc_exam_plan_set_status', { p_id: p.id, p_active: restore, p_reason: r.reason }); toast(restore ? 'استُرجعت الخطة' : 'أُلغيت الخطة', 'ok'); afterSave(state); state.reloadTab?.(); }
  catch (e) { fail(e); }
}

function aiSteps(ctx) {
  const { R, state } = ctx; const { cfg } = R; const U = cfg.ui;
  let ctxP = null; let parsed = null;
  const step = (n, title, ...body) => h('li', { class: 'xr-step' }, h('span', { class: 'xr-sn', 'aria-hidden': 'true' }, nf(n)), h('div', null, h('b', null, title), ...body));
  const leakMsg = h('p', { class: 'xr-bad xs', hidden: true, role: 'alert' });
  const copyBtn = h('button', { type: 'button', class: 'btn primary block', onclick: async () => {
    copyBtn.disabled = true;
    try {
      ctxP ||= rpc('rpc_exam_ai_context', { p_teacher: state.id });
      const prompt = L.buildPrompt(R, await ctxP);
      const studentNames = Object.values(ctx.names.map || {}).map((x) => x[0]);
      const leaks = L.aiLeaks(prompt, { teacher: state.f?.name || '', students: studentNames });
      if (leaks.length) { leakMsg.hidden = false; leakMsg.textContent = `أُوقف النسخ: وُجد في الأمر ما يشبه ${leaks.join('، ')}. لم يُنسخ شيء.`; return; }
      leakMsg.hidden = true;
      await copy(prompt, `نُسخ أمر الخطة (${nf(prompt.length)} حرفاً)`);
    } catch (e) { ctxP = null; fail(e); } finally { copyBtn.disabled = false; }
  } }, icon('clipboard', 20), 'نسخ أمر الخطة');
  const ta = h('textarea', { rows: 6, class: 'xr-paste', placeholder: 'ألصق الخطة هنا…', 'aria-label': 'ألصق الخطة هنا' });
  const checks = h('ul', { class: 'xr-checks', 'aria-live': 'polite' }); const preview = h('div', { class: 'xr-preview' });
  const saveBtn = h('button', { type: 'button', class: 'btn primary', disabled: true }, icon('check', 18), 'حفظ في سجل المعلم');
  const waCopy = h('button', { type: 'button', class: 'btn soft', disabled: true }, icon('chat', 18), 'نسخ نسخة الواتساب');
  const waOpen = h('button', { type: 'button', class: 'btn soft', disabled: true }, icon('send', 18), 'فتح واتساب للمعلم');
  const savedBox = h('div');
  const SEC = ['قسم', 'قسمان', 'أقسام', 'قسماً', 'قسم'];
  const check = () => {
    const v = ta.value.trim();
    if (!v) { checks.replaceChildren(); preview.replaceChildren(); saveBtn.disabled = waCopy.disabled = waOpen.disabled = true; parsed = null; return; }
    parsed = L.parsePlan(v, cfg);
    const item = (ok, t) => h('li', { class: ok ? 'ok' : 'bad' }, icon(ok ? 'check' : 'x', 15, 'i'), t);
    checks.replaceChildren(
      item(parsed.missing.length === 0 && parsed.sections.length > 0, parsed.missing.length ? `الأقسام: ${L.arCount(parsed.sections.length, SEC)} من ${nf(cfg.ai.sections.length)} (الناقص: ${parsed.missing.map(nf).join('، ')})` : 'الأقسام الثمانية موجودة'),
      item(parsed.goal != null, parsed.goal != null ? `الهدف الرقمي: نسبة النجاح ≥ ${nf(parsed.goal)}٪` : 'سطر «الهدف الرقمي» غير موجود'),
      item(parsed.waOk, parsed.wa ? `نسخة الواتساب: ${nf(parsed.waLen)} حرفاً من ${nf(cfg.waMax)}` : 'نسخة الواتساب غير موجودة'),
      parsed.hasEnd ? null : h('li', { class: 'warn' }, icon('alert', 15, 'i'), 'لم تُوجد علامة «نهاية الخطة» (قد يكون الرد ناقصاً)'));
    preview.replaceChildren(...parsed.sections.map((s) => h('section', null, h('h4', null, s.title), s.body.split('\n').map((l) => (l.trim() ? h('p', null, l.replace(/^[-•*]\s*/, '• ')) : null)))),
      parsed.wa ? h('section', { class: 'xr-wa' }, h('h4', null, cfg.ai.waTitle), h('p', { class: 'wa-preview' }, parsed.wa)) : null);
    saveBtn.disabled = !parsed.canSave; waCopy.disabled = waOpen.disabled = !parsed.waOk;
  };
  ta.addEventListener('input', check);
  saveBtn.onclick = async () => {
    if (!parsed?.canSave) return; saveBtn.disabled = true;
    try {
      const r = await rpc('rpc_exam_plan_save_v2', { p: { teacher: state.id, kind: 'ذكاء اصطناعي', full_text: parsed.text, wa_text: parsed.wa || null, goal_pct: parsed.goal,
        goal_kind: cfg.goalKind, prompt_version: cfg.ai.version, checks: { sections: parsed.sections.length, missing: parsed.missing, wa_len: parsed.waLen, has_end: parsed.hasEnd },
        codes: R.weaknesses.map((w) => w.code), baseline: { sk: R.A.periods[0]?.sk || 0, rate: R.A.winRate, last: R.lastMonthly?.rate ?? null } } });
      afterSave(state); savedBox.replaceChildren(savedMsg(state, r.id)); toast('تم الحفظ في سجل المعلم', 'ok');
    } catch (e) { fail(e); saveBtn.disabled = false; }
  };
  waCopy.onclick = () => parsed?.wa && copy(parsed.wa, 'نُسخت نسخة الواتساب');
  waOpen.onclick = () => parsed?.wa && openWa(state, parsed.wa);
  return h('section', { class: 'xr-ai' }, h('h3', null, 'خطة بالذكاء الاصطناعي'),
    h('ol', { class: 'xr-steps' },
      step(1, 'نسخ أمر الخطة', h('p', { class: 'xs muted' }, U.ai_step1 || ''), copyBtn, leakMsg),
      step(2, 'الذكاء الاصطناعي', h('p', { class: 'xs' }, U.ai_step2 || '')),
      step(3, 'ألصق الخطة هنا', h('p', { class: 'xs muted' }, U.ai_step3 || ''), ta, checks, preview),
      step(4, 'الحفظ والإرسال', h('p', { class: 'xs muted' }, U.ai_step4 || ''), h('div', { class: 'xr-btns col' }, saveBtn, waCopy, waOpen), savedBox)));
}
async function openWa(state, text) {
  const mob = await (state.mobP || Promise.resolve(null));
  const dd = String(mob || '').replace(/\D/g, ''); const num = dd ? (dd.startsWith('966') ? dd : dd.startsWith('0') ? '966' + dd.slice(1) : '966' + dd) : '';
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  if (!num) toast('لا يوجد جوال للمعلم أو لا صلاحية لرؤيته: اختر المحادثة في واتساب');
}

function templatePlan(ctx) {
  const { R, state } = ctx; const { cfg } = R;
  const ws = R.weaknesses.filter((w) => cfg.remedy[w.code]);
  if (!ws.length) return h('details', { class: 'xr-tpl' }, h('summary', null, 'خطة من القوالب (خيار ثانٍ)'), h('p', { class: 'xr-fine' }, icon('check', 18), ' لا نقاط ضعف تحتاج خطة'));
  const picked = new Set(ws.map((w) => w.code));
  const base = R.lastDone?.rate != null ? Math.min(100, Math.round(R.lastDone.rate * 100) + cfg.goalStep) : '';
  const goal = h('input', { type: 'number', min: 0, max: 100, step: 1, value: base, inputmode: 'numeric', class: 'xr-goal' });
  const pre = h('div', { class: 'wa-preview', dir: 'rtl' }); const meta = h('p', { class: 'muted xs' }); const savedBox = h('div');
  const compat = { cfg, weaknesses: ws, notes: { groups: R.noteTypes.map((t) => [t.g, t.students]) } };
  let msg = null;
  const redraw = () => { msg = L.planMessage(compat, [...picked], { teacher: state.f?.name || '' }); pre.textContent = msg.text;
    meta.textContent = `${nf(msg.text.length)} حرفاً من ${nf(cfg.waMax)} • القوالب: ${msg.templates.map((t) => `«${t.label}» الإصدار ${t.version}`).join('، ') || '—'}`; };
  const chipsBox = h('div', { class: 'xr-chips' }, ws.map((w) => { const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'true',
    onclick: () => { if (picked.has(w.code)) picked.delete(w.code); else picked.add(w.code); b.setAttribute('aria-pressed', String(picked.has(w.code))); redraw(); } }, w.text); return b; }));
  redraw();
  return h('details', { class: 'xr-tpl' }, h('summary', null, 'خطة من القوالب (خيار ثانٍ)'),
    h('p', { class: 'muted xs' }, 'من مكتبة قوالب الإعدادات: لكل نقطة ضعف الإجراءات والمدة ومؤشر التحقق.'), chipsBox,
    h('label', { class: 'field' }, h('span', null, 'الهدف الرقمي: نسبة النجاح في الاختبار القادم ≥ (٪)'), goal), pre, meta,
    h('div', { class: 'xr-btns col' },
      h('button', { type: 'button', class: 'btn soft', onclick: () => copy(msg.text, 'نُسخت الرسالة') }, icon('chat', 18), 'نسخ رسالة واتساب'),
      h('button', { type: 'button', class: 'btn soft', onclick: () => openWa(state, msg.text) }, icon('send', 18), 'فتح واتساب للمعلم'),
      h('button', { type: 'button', class: 'btn', onclick: async (e) => {
        const b = e.currentTarget; const g = goal.value === '' ? null : Number(goal.value);
        if (g != null && !(g >= 0 && g <= 100)) { toast('الهدف نسبة بين 0 و100', 'bad'); return; }
        b.disabled = true;
        try {
          const r = await rpc('rpc_exam_plan_save_v2', { p: { teacher: state.id, kind: 'قالب', full_text: msg.text, wa_text: msg.text.length <= 2000 ? msg.text : null, goal_pct: g, goal_kind: cfg.goalKind,
            codes: [...picked], template_keys: msg.templates.map((t) => t.key), template_versions: msg.templates.map((t) => t.version),
            baseline: { sk: R.A.periods[0]?.sk || 0, rate: R.A.winRate, last: R.lastMonthly?.rate ?? null } } });
          afterSave(state); savedBox.replaceChildren(savedMsg(state, r.id)); toast('تم الحفظ في سجل المعلم', 'ok');
        } catch (er) { fail(er); } finally { b.disabled = false; }
      } }, icon('check', 18), 'حفظ في سجل المعلم')), savedBox);
}

// ---------- قسم «الخطط» في تبويب «السجل» ----------
export function plansSection(state) {
  const box = h('section', { class: 'card xr xr-plans', id: 'xr-plans' }, h('h2', null, icon('clipboard', 20), ' الخطط'), skeleton());
  (async () => {
    try {
      const f = fetchExams(state.id); const d = await f.live; const R = L.build(d);
      const plans = d.plans2 || [];
      box.replaceChildren(h('h2', null, icon('clipboard', 20), ' الخطط'),
        ...(plans.length ? plans.map((p) => planRow(R, p, state, true, !!d.can_plan)) : [h('p', { class: 'empty' }, R.cfg.ui.empty_plans || '')]));
      const want = state.extra?.plan;
      if (want) { state.extra = null; const el = box.querySelector(`#plan-${want}`); if (el) { el.classList.add('hl'); el.querySelector('details')?.setAttribute('open', ''); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    } catch { box.remove(); /* خارج صلاحية الاختبارات: لا قسم */ }
  })();
  return box;
}

// ---------- بطاقة مختصرة في شاشة بدء الزيارة ----------
export async function visitCard(teacherId) {
  const box = h('section', { class: 'card ex xr ex-vcard' }, h('h2', null, icon('chart', 20), ' الاختبارات'), skeleton());
  const field = { codes: [], body: '', students: [] };
  (async () => {
    try {
      const d = await fetchExams(teacherId).live; const R = L.build(d);
      if (!R.has) { box.replaceChildren(h('h2', null, icon('chart', 20), ' الاختبارات'), h('p', { class: 'muted small' }, R.cfg.ui.empty_all || '')); return; }
      const ws = R.weaknesses.filter((w) => R.cfg.remedy[w.code]);
      const compat = { cfg: R.cfg, weaknesses: ws, notes: { groups: R.noteTypes.map((t) => [t.g, t.students]) } };
      const ta = h('textarea', { rows: 3, maxlength: 3000, placeholder: 'اختياري: خطة علاج للاختبارات (من القوالب أو كتابة حرة)' });
      const tpl = h('select', { 'aria-label': 'قالب الخطة', onchange: () => { if (tpl.value) { ta.value = L.planMessage(compat, [tpl.value]).text; field.codes = [tpl.value]; field.body = ta.value; } } },
        h('option', { value: '' }, 'من القوالب…'), ws.map((w) => h('option', { value: w.code }, w.text)));
      ta.addEventListener('input', () => { field.body = ta.value; });
      const lp = (d.plans2 || []).find((p) => p.status !== 'ملغاة');
      box.replaceChildren(h('h2', null, icon('chart', 20), ' الاختبارات'),
        h('ul', { class: 'small xr-vlist' }, R.cards.map((c) => h('li', { class: c.tone }, c.text))),
        R.rec ? h('p', { class: 'small' }, h('b', null, 'التوصية: '), R.rec) : null,
        lp ? h('p', { class: 'muted xs' }, `آخر خطة: ${hijri(lp.at)} — ${L.planStatus(lp, R).label}`) : null,
        h('details', null, h('summary', { class: 'small' }, 'خطة علاج للاختبارات (اختياري، خارج بنود التقييم)'), tpl, ta,
          h('p', { class: 'muted xs' }, 'تُحفظ في سجل المعلم مع الزيارة، ولا تؤثر في التقييم.')));
    } catch { box.remove(); }
  })();
  return { el: box, plan: () => (field.body.trim().length >= 5 ? { ...field, body: field.body.trim() } : null) };
}
