// منطق «الخطة العلاجية» الاحترافية (2026-11-21) — دوال خالصة بلا واجهة ولا شبكة، يستعملها plan_ui.js والاختبارات الآلية.
// كل قائمة وسؤال ونص مرحلة وقالب أمر وأقسامه وحد الرسالة من الإعدادات (exams.plan_* و exams.ai_* و students.names_in_wa).
// قواعد ثابتة:
//   * لا اسم ولا رقم تسجيل ولا جوال في أي نص يُبنى للذكاء الاصطناعي: الطلاب «طالب ١…» والمعلم «[اسم المعلم]».
//   * استبدال الرموز بالأسماء الحقيقية (localizeWa) لرسالة الواتساب فقط، في جهاز الموجه، ولا يُستدعى أبداً على الأمر.
//   * «لم تُرصد» مسؤولية لجنة الاختبارات: لا تدخل الأهداف ولا الرسالة ولا خطوات المعلم؛ وعند ضعف الرصد صياغة exams.low_obs_texts.
import * as L from './exams_logic.js';

const N = (x) => Number(x) || 0;
const S = (x) => String(x ?? '');
const lines = (t) => S(t).split('\n').map((x) => x.trim()).filter(Boolean);
const AR_DIG = '٠١٢٣٤٥٦٧٨٩';
export const arDigits = (n) => String(n).replace(/[0-9]/g, (c) => AR_DIG[c]);
const toLatin = (s) => S(s).replace(/[٠-٩]/g, (c) => AR_DIG.indexOf(c)).replace(/[٫,]/g, '.');
const esc = (s) => S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
Object.assign(L.FORMS, { day: ['يوم', 'يومان', 'أيام', 'يوماً', 'يوم'], step: ['خطوة', 'خطوتان', 'خطوات', 'خطوة', 'خطوة'] });

// «## العنوان» ثم النص ← [{title, body}]
export function blocks(text) {
  const out = []; let cur = null;
  for (const raw of S(text).split('\n')) {
    const m = raw.match(/^##\s*(.+?)\s*$/);
    if (m) { cur = { title: m[1], body: [] }; out.push(cur); } else if (cur) cur.body.push(raw);
  }
  return out.map((b) => ({ title: b.title, body: b.body.join('\n').trim() }));
}
const kvLines = (t) => lines(t).map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null; }).filter(Boolean);

// ===================== الإعدادات =====================
export function pcfg(set = {}) {
  const v = (k, d) => { const x = set[k]; return x == null || x === '' ? d : x; };
  const num = (k, d) => { const x = Number(v(k, d)); return isFinite(x) ? x : d; };
  const roles = Object.fromEntries(kvLines(v('exams.ai_section_roles', '')).map(([k, x]) => [k, Number(toLatin(x))]));
  const guide = Object.fromEntries(kvLines(v('exams.ai_section_guide', '')).map(([k, x]) => [Number(toLatin(k)), x]));
  const tpl = {};
  for (const code of ['MISSING', 'LOWPASS', 'REPEAT', 'DECLINE', 'GOOD', 'LOWOBS']) {
    const key = `exams.plan_tpl_${code.toLowerCase()}`;
    const bs = blocks(set[key]);
    tpl[code] = { key, version: set._versions?.[key] || 1, b: Object.fromEntries(bs.map((x) => [x.title, x.body])) };
  }
  return {
    stages: blocks(v('exams.plan_stages', '')).map((b) => ({ name: b.title, text: b.body })),
    stageMap: kvLines(v('exams.plan_stage_map', '')),
    teacherQs: blocks(v('exams.plan_teacher_qs', '')).map((b) => ({ q: b.title, opts: lines(b.body) })),
    challenges: lines(v('exams.plan_challenges', '')),
    challengeMap: Object.fromEntries(kvLines(v('exams.plan_challenge_map', ''))),
    natureTips: Object.fromEntries(kvLines(v('exams.plan_nature_tips', ''))),
    form: L.kv(v('exams.plan_form_texts', '')), view: L.kv(v('exams.plan_view_texts', '')), tt: L.kv(v('exams.plan_tpl_texts', '')),
    freeMax: num('exams.plan_free_max', 300), guide, roles,
    stepFields: S(v('exams.ai_step_fields', 'الخطوة | المسؤول | الموعد | كيف نتحقق')), stepSep: S(v('exams.ai_step_sep', '|')) || '|',
    waSpec: S(v('exams.ai_wa_spec', '')), studentsMax: num('exams.ai_students_max', 12), prevMax: num('exams.ai_prev_plans_max', 6),
    partialW: num('exams.plan_partial_weight', 0.5),
    goalBands: kvLines(v('exams.goal_bands', '')).map(([a, b]) => [Number(toLatin(a)), Number(toLatin(b))]).filter(([a, b]) => isFinite(a) && isFinite(b)).sort((x, y) => x[0] - y[0]),
    goalCap: num('exams.goal_cap', 95), goalDefault: num('exams.goal_default', 75), goalStep: num('exams.goal_step', 5),
    // صيغ الهدف عند السقف وضعف الرصد (2026-11-22): من الإعداد exams.plan_rate_texts، وهذه احتياط فقط إن غاب مفتاح
    rt: { keep_line: 'المحافظة على المستوى: نسبة النجاح الحالية {الحالية}٪ عند السقف أو فوقه، فالهدف ألا تقل عن {السقف}٪',
      keep_wa: 'بإذن الله نحافظ على هذا المستوى المتميز، فلا تقل نسبة النجاح عن {السقف}٪.',
      keep_ai: 'النسبة الحالية {الحالية}٪ عند السقف ({السقف}٪) أو فوقه: اجعل الهدف «المحافظة على المستوى (≥ {السقف}٪)»، ولا تقترح هدفاً أقل من السقف.',
      up_ai: 'لا تقترح هدفاً أقل من النسبة الحالية ({الحالية}٪) ولا أعلى من السقف ({السقف}٪).',
      lowobs_ai: 'الرصد ضعيف ({الصيغة}): لا تكتب في رسالة الواتساب ولا في «مما نعتز به» نسبة نجاح وحدها (مثل «نجح 100٪»)، بل هذه الصيغة نفسها.',
      ...L.kv(v('exams.plan_rate_texts', '')) },
    openLine: S(v('exams.plan_open_line', '')), tpl, tplMax: num('exams.plan_tpl_max', 2),
    namesInWa: v('students.names_in_wa', true) === true || v('students.names_in_wa', true) === 'true',
    showNames: set['students.show_names'] === true || set['students.show_names'] === 'true',
  };
}

// ===================== الخطوة 1: مرحلة الحلقة وأسئلة الموجه =====================
// المرحلة المسجلة للحلقة (أحدث صف في السجل) أو المقترحة من اسم القسم (أول قاعدة تنطبق)، أو لا شيء
export function stageInfo(halaqa, P) {
  if (!halaqa) return { kind: 'none', stage: null };
  const names = P.stages.map((s) => s.name);
  if (halaqa.stage && names.includes(halaqa.stage)) return { kind: 'recorded', stage: halaqa.stage, at: halaqa.stage_at, by: halaqa.stage_by };
  const dn = S(halaqa.dept_name);
  for (const [kw, st] of P.stageMap) if (kw && dn.includes(kw) && names.includes(st)) return { kind: 'suggested', stage: st, dept: dn };
  return { kind: 'none', stage: null, dept: dn };
}
export const stageText = (P, name) => P.stages.find((s) => s.name === name)?.text || '';
// الحقول الإلزامية: المرحلة والتحديات فقط
export function validateAnswers(a, P) {
  const errs = [];
  if (!a.stage || !P.stages.some((s) => s.name === a.stage)) errs.push('stage');
  const ch = (a.challenges || []).filter(Boolean);
  if (!ch.length && !S(a.other).trim()) errs.push('challenges');
  for (const k of ['tried', 'focus', 'other']) if (S(a[k]).length > P.freeMax) errs.push(k);
  return errs;
}
// أسماء الحقول الحرة (لرسالة «أُوقف النسخ»)
const bare = (t) => S(t).replace(/\s*\((?:اختياري|مطلوب)\)\s*$/, '');
export const freeFields = (P) => ({ tried: bare(P.form.q_tried || 'ما الذي جرّبه المعلم سابقاً؟'), focus: bare(P.form.q_focus || 'على ماذا تريد أن تركز الخطة؟'), other: P.form.other || 'أخرى' });
// فحص المتصفح: الأسماء المعروفة في الجهاز + أرقام التسجيل والأرقام الطويلة والجوالات
const PHONE = /(?:\+?966|00966|0)[ -]?5(?:[ -]?[0-9٠-٩]){8}|(?:\+?٩٦٦|٠)[ -]?٥(?:[ -]?[0-9٠-٩]){8}/;
export function leaksIn(text, who = {}) {
  const f = L.aiLeaks(S(text), who);
  if (PHONE.test(S(text)) && !f.includes('رقم طويل')) f.push('رقم جوال');
  return f;
}
// موضع أول تطابق لعرضه للموجه («احذف هذا»)
export function leakSnippet(text, who = {}) {
  const t = S(text);
  const m = t.match(/[Ss][0-9٠-٩]{7}|[0-9٠-٩]{6,}/) || t.match(PHONE);
  if (m) return m[0];
  // أقصر مقطع (كلمة إلى ثلاث) يطابق، ليُعرض للموجه ما يحذفه بالضبط
  const words = t.split(/\s+/); let best = '';
  for (const n of [1, 2, 3]) {
    for (let i = 0; i + n <= words.length; i++) { const part = words.slice(i, i + n).join(' '); if (part && L.aiLeaks(part, who).length) { best = part; break; } }
    if (best) break;
  }
  return best;
}
export function answersLeaks(a, P, who = {}) {
  const out = [];
  for (const [k, label] of Object.entries(freeFields(P))) {
    const t = S(a[k]); if (!t.trim()) continue;
    const kinds = leaksIn(t, who);
    if (kinds.length) out.push({ key: k, field: label, kinds, text: leakSnippet(t, who) });
  }
  return out;
}

// ===================== الخطوة 2: الأمر =====================
// رموز الطلاب: أشد الطلاب حاجة بترتيب «يحتاجون متابعة» ← «طالب ١…» (الخريطة بأرقام داخلية فقط)
const REASON_TXT = (s, R) => s.reasons.map((r) => r.code === 'FAILED' ? `رسب في ${L.arCount(r.n, 'exam', { gen: true })}`
  : r.code === 'REPEAT' ? `تكررت عنده ملاحظة ${r.keys.slice(0, 2).map((x) => `${x.k} (${L.arCount(x.c, 'times')})`).join(' وملاحظة ')}`
  : r.code === 'NOTES' ? `${L.arCount(r.n, 'note')} في آخر اختبار له (${L.pName(r.at, true)})` : '').filter(Boolean).join('؛ ');
export function studentCodes(R, P) {
  const list = R.followup.slice(0, Math.max(0, P.studentsMax)).map((s, i) => ({ code: i + 1, label: `طالب ${arDigits(i + 1)}`, sid: s.sid, reasons: s.reasons, text: REASON_TXT(s, R) }));
  return { list, map: Object.fromEntries(list.map((x) => [String(x.code), x.sid])) };
}
// اقتراح «نسبة النجاح التي نطمح لها»: متوسط آخر الأشهر المرصودة رصداً كافياً (عددها exams.trend_n) + زيادة الشريحة، والسقف حد أعلى
// (شهر واحد بنسبة 100٪ لا يجعل الهدف 100٪؛ ومعلم فوق السقف هدفه المحافظة على السقف)
export function suggestGoal(R, P) {
  const cfg = R.cfg;
  const ser = (R.trend?.series || []).filter((x) => !x.weak && x.rate != null).slice(-Math.max(1, cfg.trendN || 3));
  let base = ser.length ? ser.reduce((a, x) => a + x.rate, 0) / ser.length : null;
  if (base == null && !L.weakObs(R.W, cfg) && R.A.winRate != null) base = R.A.winRate;
  if (base == null) return { value: P.goalDefault, base: null, add: null, n: 0, keep: false };
  const b = Math.round(base * 100);
  // عند السقف أو فوقه: الهدف «المحافظة على المستوى (≥ السقف)» لا رقماً أقل من النسبة الحالية
  if (b >= P.goalCap) return { value: P.goalCap, base: b, add: 0, n: ser.length, keep: true };
  const band = P.goalBands.find(([lt]) => b < lt);
  // لا يكون الهدف أقل من النسبة الحالية أبداً (ولو كانت زيادة الشريحة سالبة في الإعداد)
  const value = Math.max(b, Math.min(P.goalCap, b + (band ? band[1] : P.goalStep)));
  return { value, base: b, add: value - b, n: ser.length, keep: false };
}
// متغيرات صيغ الهدف: {الحالية} {السقف} {الهدف}
const goalVars = (g, P) => ({ 'الحالية': g.base != null ? L.fmtN(g.base) : '—', 'السقف': L.fmtN(P.goalCap), 'الهدف': L.fmtN(g.value) });
// سطر «المحافظة على المستوى» (للأقسام) حين يكون الهدف عند السقف
export const keepLine = (g, P) => (g.keep ? L.fillT(P.rt.keep_line, goalVars(g, P)) : null);
const hijriOf = (date) => {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric' }).formatToParts(new Date(date));
    const y = Number(parts.find((x) => x.type === 'year')?.value?.replace(/\D/g, '')), m = Number(parts.find((x) => x.type === 'month')?.value);
    return y && m ? { k: 'MONTHLY', y, n: m } : null;
  } catch { return null; }
};
export function nextExamText(next, { short = false } = {}) {
  if (!next) return short ? '—' : 'الاختبار القادم';
  const mon = `${L.hmonth(next.n, true)} ${next.y}هـ`;
  const when = next.days == null ? null : next.days <= 0 ? 'اليوم' : next.days === 1 ? 'غداً' : `بعد ${L.arCount(next.days, 'day', { one: false })}`;
  if (short) return when || `في ${mon}`;
  return `الاختبار التنشيطي القادم (المتوقع في ${mon}${when ? `، ${when === 'اليوم' || when === 'غداً' ? when : when.replace('بعد', 'بعد نحو')}` : ''})`;
}

export function examsData2(R, P, codes) {
  const cfg = R.cfg; const out = [L.examsData(R)];
  // الملاحظات حسب النوع والشهر
  const types = R.noteTypes.slice(0, 8);
  if (types.length) {
    out.push('- الملاحظات التجويدية حسب النوع والشهر (عدد الطلاب الذين أخذوها من المختبَرين، الأحدث أولاً):');
    for (const t of types) out.push(`  • ${t.g}: ${t.byPeriod.slice(0, 6).map((x) => `${L.pName(x.p)} ${L.fmtN(x.n)} من ${L.fmtN(x.t)}`).join('، ') || '—'}`);
  }
  // الطلاب المحتاجون برموزهم
  out.push(`- الطلاب الذين يحتاجون متابعة (الأشد حاجة أولاً، برموز لا أسماء؛ ${L.arCount(codes.list.length, 'student')} من ${L.arCount(R.followup.length, 'student', { gen: true })}):`);
  if (!codes.list.length) out.push('  • لا يوجد.');
  for (const s of codes.list) out.push(`  • ${s.label}: ${s.text}`);
  const g = suggestGoal(R, P); const gv = goalVars(g, P);
  const weak = L.weakObs(R.W, cfg);
  // عند ضعف الرصد لا تُذكر «النسبة الحالية» رقماً وحده (قد تكون 100٪ من قلة المرصودين): الصيغة من exams.low_obs_texts
  const cur = g.base == null ? `لا نسبة حالية موثوقة (${weak ? 'رصد ضعيف' : 'لا نتائج'})` : weak ? `${L.obsPhrase(R.W, cfg)} (متوسط الأشهر المرصودة رصداً كافياً ${L.fmtN(g.base)}٪)` : `النسبة الحالية ${L.fmtN(g.base)}٪`;
  out.push(`- مرجع لواقعية الهدف (حساب الموقع من الإعدادات): ${cur}، والمقترح ${g.keep ? `المحافظة على المستوى (≥ ${L.fmtN(P.goalCap)}٪)` : `${L.fmtN(g.value)}٪`}.`);
  if (g.base != null) out.push(`- قاعدة الهدف: ${L.fillT(g.keep ? P.rt.keep_ai : P.rt.up_ai, gv)}`);
  if (weak) out.push(`- صياغة النسب: ${L.fillT(P.rt.lowobs_ai, { 'الصيغة': L.obsPhrase(R.W, cfg) })}`);
  return out.join('\n');
}
// تاريخ الاجتهاد: انتظام الترشيح سنة سنة، وعدد المرشحين عبر الزمن، وأطول انقطاع، والاتجاه
export function historyData(R) {
  const cfg = R.cfg; const out = [];
  const asc = R.months.slice().reverse(); // الأقدم أولاً
  if (!asc.length) return '- لا اختبارات تنشيطية مسجلة.';
  const years = new Map();
  for (const m of asc) {
    if (!years.has(m.y)) years.set(m.y, { held: 0, nom: 0, cand: 0 });
    const Y = years.get(m.y);
    if (m.state !== 'none') Y.held++;
    if (m.state === 'done' || m.state === 'nores') { Y.nom++; Y.cand += N(m.p?.t); }
  }
  for (const [y, Y] of years) out.push(`- ${y}هـ: رشّح في ${L.ofTotal(Y.nom, Y.held, 'month')} أُقيم فيها الاختبار${Y.nom ? `، بمتوسط ${L.arCount(Math.round(Y.cand / Y.nom), 'candidate')} في الشهر` : ''}.`);
  const nom = asc.filter((m) => m.state === 'done' || m.state === 'nores');
  if (nom.length) {
    out.push(`- أول ترشيح له: ${L.pName(nom[0])}.`);
    out.push(`- عدد المرشحين شهراً شهراً (الأقدم أولاً): ${nom.slice(-12).map((m) => `${L.hmonth(m.n)} ${L.fmtN(m.p.t)}`).join('، ')}.`);
    const j = L.judge(nom.map((m) => N(m.p.t)), cfg.trendN, 0.0001);
    if (j.label) out.push(`- اتجاه عدد المرشحين: ${j.diff > 0.5 ? 'يزيد' : j.diff < -0.5 ? 'ينقص' : 'ثابت'} (متوسط آخر ${L.arCount(j.k, 'month', { one: false })} ${j.last.toFixed(1)} مقابل ${j.prev.toFixed(1)} قبلها).`);
  }
  let best = [], cur = [];
  for (const m of asc) { if (m.state === 'missing') { cur.push(m); if (cur.length > best.length) best = cur.slice(); } else if (m.state !== 'none') cur = []; }
  out.push(best.length ? `- أطول انقطاع عن الترشيح: ${L.arCount(best.length, 'month')} متتالية (${L.pList(best)}).` : '- لم ينقطع عن الترشيح في شهر أُقيم فيه الاختبار.');
  const tp = R.A.termPart; if (tp?.total) out.push(`- الفصلية: رشّح في ${L.ofTotal(tp.n, tp.total, 'term')}.`);
  return out.join('\n');
}
// التقييم العام: بيانات v1 + الاتجاه عبر الفصول + نقاط البنود
export function visitsData2(ctx) {
  // حين تتوفر نقاط البنود لا تُكرر قائمة البنود كلها: تبقى البنود التي كانت الأضعف أو لها سبب مكتوب
  const base = L.visitsData(ctx && ctx.visits_ok && (ctx.items_pts || []).length ? { ...ctx, items: (ctx.items || []).filter((i) => N(i.weak) > 0 || i.reason) } : ctx);
  if (!ctx || !ctx.visits_ok) return base;
  const out = [base];
  const sm = (ctx.summary || []).filter((s) => s.pct != null).slice().reverse(); // الأقدم أولاً
  if (sm.length >= 2) {
    const a = Number(sm[sm.length - 2].pct), b = Number(sm[sm.length - 1].pct);
    out.push(`- الاتجاه عبر الفصول (الأقدم أولاً): ${sm.map((s) => `${S(s.period).replace(/\s+/g, ' ').trim()} ${L.pct(Number(s.pct), 0)}`).join(' ← ')} (${b - a >= 0.03 ? 'متحسّن' : b - a <= -0.03 ? 'متراجع' : 'ثابت'}).`);
  }
  const all = ctx.items_pts || [];
  const ip = all.filter((i) => N(i.avg) < 100 || N(i.last) < N(i.first)).slice(0, 25);
  if (all.length) {
    out.push('- البنود ونقاطها (متوسط النسبة، وأول تقييم ← آخر تقييم، وعدد مرات التقييم؛ الأضعف أولاً):');
    for (const i of ip) out.push(`  • ${S(i.name).replace(/\s+/g, ' ')} (${S(i.axis).replace(/\s+/g, ' ')}): ${i.avg ?? '—'}٪، ${i.first ?? '—'}٪ ← ${i.last ?? '—'}٪، ${L.fmtN(i.n)}`);
    if (all.length > ip.length) out.push(`  • و${L.arCount(all.length - ip.length, ['بند', 'بندان', 'بنود', 'بنداً', 'بند'])} آخر بنسبة 100٪ في كل تقييماته.`);
  }
  return out.join('\n');
}
const CODE_LABEL = { MISSING: 'عدم الترشيح', FAILED: 'الرسوب', REPEAT: 'تكرار الملاحظة نفسها', DECLINE: 'تراجع النسبة', BELOW: 'أقل من متوسط القسم', FEW: 'قلة المرشحين', TAJWEED: 'ملاحظات التجويد', HIFZ: 'ملاحظات الحفظ', TASHKEEL: 'ملاحظات التشكيل' };
// نسبة إنجاز الخطوات من حالات البنود
export function progressOf(items, P) {
  const n = items.length; if (!n) return { n: 0, done: 0, part: 0, not: 0, unmarked: 0, pct: null };
  const st = (i) => i.state?.status || null;
  const done = items.filter((i) => st(i) === 'تم').length, part = items.filter((i) => st(i) === 'جزئي').length, not = items.filter((i) => st(i) === 'لم يتم').length;
  return { n, done, part, not, unmarked: n - done - part - not, pct: (done + P.partialW * part) / n };
}
// الخطط السابقة: هدفها، وحكمها، ونسبة إنجاز خطواتها، وما نجح وما لم يُنجز (نصوص الخطوات من الخطة نفسها، وهي بالرموز)
export function prevPlansData(R, P, plans, px) {
  const ps = (plans || []).slice(0, Math.max(0, P.prevMax));
  if (!ps.length) return `- ${P.tt.judge_none || 'لا خطط سابقة.'}`;
  const out = [];
  for (const p of ps) {
    const st = L.planStatus(p, R); const x = px?.[String(p.id)]; const items = x?.items || [];
    const pr = items.length ? progressOf(items, P) : null; const hm = hijriOf(p.at);
    out.push(`- خطة ${hm ? L.pName(hm) : ''} (${p.kind === 'ذكاء اصطناعي' ? 'بالذكاء الاصطناعي' : 'من القوالب'})${p.status === 'ملغاة' ? ' — ملغاة' : ''}: ${p.goal != null ? `الهدف ≥ ${L.fmtN(p.goal)}٪` : 'بلا هدف رقمي'} — الحكم: ${st.label}${st.text ? ` (${st.text})` : ''}${pr ? ` — إنجاز الخطوات ${L.pct(pr.pct, 0)} (تم ${L.fmtN(pr.done)}، جزئي ${L.fmtN(pr.part)}، لم يتم ${L.fmtN(pr.not)}، بلا تأشير ${L.fmtN(pr.unmarked)} من ${L.fmtN(pr.n)})` : ''}.`);
    const cl = (p.codes || []).filter((c2) => CODE_LABEL[c2]);   // «لم تُرصد» (NO_RESULT) ليست مما يعالجه المعلم: لا تُذكر
    if (cl.length) out.push(`  • ما عالجته: ${cl.map((c2) => CODE_LABEL[c2]).join('، ')}.`);
    for (const [label, want] of [['نُفّذ', 'تم'], ['جزئياً', 'جزئي'], ['لم يُنفَّذ', 'لم يتم']]) {
      const xs = items.filter((i) => i.state?.status === want).slice(0, 6);
      if (xs.length) out.push(`  • ${label}: ${xs.map((i) => S(i.step).replace(/\s+/g, ' ')).join('؛ ')}.`);
    }
  }
  return out.join('\n');
}
export function answersData(a, P) {
  const none = P.form.none_answer || 'لم يُجب';
  const out = [`- مرحلة الحلقة: ${a.stage || none}.`];
  for (const q of P.teacherQs) out.push(`- ${q.q}: ${a.nature?.[q.q] || none}.`);
  const ch = [...(a.challenges || [])]; if (S(a.other).trim()) ch.push(`${P.form.other || 'أخرى'}: ${S(a.other).trim()}`);
  out.push(`- أبرز التحديات: ${ch.join('، ') || none}.`);
  out.push(`- ما جرّبه المعلم سابقاً: ${S(a.tried).trim() || none}.`);
  out.push(`- ما يريد الموجه أن تركز عليه الخطة: ${S(a.focus).trim() || none}.`);
  return out.join('\n');
}
export const sectionTitles = (cfg) => cfg.ai.sections;
export const secNum = (t) => { const m = toLatin(t).match(/القسم\s*(\d+)/); return m ? Number(m[1]) : null; };
export function buildPrompt2(R, ctx, P, { answers, plans, px, codes, next }) {
  const cfg = R.cfg;
  const vars = { 'صيغة_الخطوة': P.stepFields, 'فاصل_الخطوة': P.stepSep, 'سطر_الهدف': L.fillT(cfg.ai.goalLine, { 'النسبة': '…' }), 'حد_واتساب': L.fmtN(cfg.waMax) };
  vars['مواصفات_واتساب'] = '\n' + L.fillT(P.waSpec, vars);
  const guide = cfg.ai.sections.map((t) => { const n = secNum(t); const g = P.guide[n]; return g ? `${t}: ${L.fillT(g, vars)}` : null; }).filter(Boolean).join('\n');
  return L.fillT(cfg.ai.template, {
    'الاختبار_القادم': nextExamText(next), 'اسم_المرحلة': answers.stage || '—', 'وصف_المرحلة': stageText(P, answers.stage) || '—',
    'بيانات_التقييم': visitsData2(ctx), 'بيانات_الاختبارات': examsData2(R, P, codes), 'تاريخ_الاجتهاد': historyData(R),
    'الخطط_السابقة': prevPlansData(R, P, plans, px), 'إجابات_الموجه': answersData(answers, P),
    'الأقسام': cfg.ai.sections.map((s) => L.marker(cfg, s)).join('\n'), 'تفصيل_الأقسام': guide, 'علامة_النهاية': L.marker(cfg, cfg.ai.endTitle),
    // متغيرات القالب السابق (إن استرجعه المسؤول يبقى يعمل)
    'بيانات_التقييم_القديمة': L.visitsData(ctx), 'سطر_الهدف': vars['سطر_الهدف'], 'حد_واتساب': vars['حد_واتساب'], 'عنوان_واتساب': L.marker(cfg, cfg.ai.waTitle),
  }).trim();
}

// ===================== الخطوة 3: قراءة الرد =====================
const cleanStep = (l) => l.replace(/^\s*(?:[-•*▪◦]|\(?[0-9٠-٩]+[).\-–]|[0-9٠-٩]+\s*[-–])\s*/, '').trim();
export function parseSteps(body, P) {
  const sep = P.stepSep; const hdr = P.stepFields.split(sep).map((x) => x.trim());
  const out = [];
  for (let l of S(body).split('\n')) {
    l = l.trim(); if (!l) continue;
    if (/^\|?\s*:?-{3,}/.test(l)) continue; // فاصل جدول
    if (sep === '|' && l.startsWith('|')) l = l.replace(/^\|/, '').replace(/\|\s*$/, '');
    if (!l.includes(sep)) continue;
    const f = l.split(sep).map((x) => x.replace(/\*/g, '').trim());
    if (f[0] === hdr[0] || cleanStep(f[0]) === hdr[0]) continue;   // سطر العناوين
    const step = cleanStep(f[0]); if (step.length < 2) continue;
    out.push({ step, owner: f[1] || '', due: f[2] || '', verify: f.slice(3).join(` ${sep} `) || '' });
  }
  if (!out.length) for (const l of S(body).split('\n')) { const s = cleanStep(l.replace(/\*/g, '')); if (s.length >= 8) out.push({ step: s, owner: '', due: '', verify: '' }); }
  return out.slice(0, 30);
}
export function parsePlan2(raw, R, P) {
  const cfg = R.cfg;
  const text = S(raw).replace(/\r/g, '').replace(/^```[a-z]*\s*$/gim, '').replace(/\*\*([^*\n]+)\*\*/g, '*$1*').replace(/__/g, '').replace(/^#+\s*/gm, '');
  const [pre, post] = S(cfg.ai.marker).split('{العنوان}');
  const re = new RegExp(`${esc(pre.trim())}\\s*([^\\n]+?)\\s*${esc((post || '').trim())}`, 'g');
  const marks = []; let m; while ((m = re.exec(text))) marks.push({ title: m[1].trim(), at: m.index, end: re.lastIndex });
  const blocksT = marks.map((x, i) => ({ ...x, body: text.slice(x.end, marks[i + 1]?.at ?? text.length).trim() }));
  const role = Object.fromEntries(Object.entries(P.roles).map(([k, n]) => [n, k]));
  const want = cfg.ai.sections.map((t) => ({ n: secNum(t), title: t.replace(/^القسم\s*[0-9٠-٩]+\s*:\s*/, '').trim(), full: t })).filter((x) => x.n != null);
  const sections = [];
  for (const b of blocksT) {
    const n = secNum(b.title); if (n == null || sections.some((s) => s.n === n)) continue;
    const w = want.find((x) => x.n === n);
    sections.push({ n, title: w?.title || b.title.replace(/^القسم\s*[0-9٠-٩]+\s*:\s*/, ''), body: b.body, role: role[n] || null });
  }
  sections.sort((a, b) => a.n - b.n);
  const missing = want.filter((x) => !sections.some((s) => s.n === x.n && s.body.length > 0)).map((x) => ({ n: x.n, title: x.title }));
  const get = (r) => sections.find((s) => s.role === r);
  const waOld = blocksT.find((b) => cfg.ai.waTitle && b.title.includes(cfg.ai.waTitle));
  const wa = (get('wa')?.body || waOld?.body || '').trim();
  const hasEnd = blocksT.some((b) => cfg.ai.endTitle && b.title.includes(cfg.ai.endTitle));
  const goal = goalFrom(get('goals')?.body || '', cfg) ?? goalFrom(text, cfg);
  const goals = lines(get('goals')?.body || '').filter((l) => /^[-•*]/.test(l)).map((l) => l.replace(/^[-•*]\s*/, ''));
  const items = parseSteps(get('steps')?.body || '', P);
  const issues = [];
  if (!marks.length) issues.push('لم تُوجد العلامات الفاصلة: تأكد أنك نسخت الرد كاملاً');
  for (const x of missing) issues.push(L.fillT(P.view.missing_section || 'قسم ناقص: «{القسم}»', { 'القسم': x.title }));
  if (goal == null) issues.push('سطر «الهدف الرقمي» غير موجود أو بلا نسبة صحيحة');
  if (!wa) issues.push('رسالة الواتساب غير موجودة');
  else if (wa.length > cfg.waMax) issues.push(`رسالة الواتساب ${L.fmtN(wa.length)} حرفاً، والحد ${L.fmtN(cfg.waMax)}`);
  if (get('steps') && !items.length) issues.push(P.view.items_none || 'لم تُقرأ خطوات');
  return { sections, missing, goal, goals, items, wa, waLen: wa.length, waOk: !!wa && wa.length <= cfg.waMax, hasEnd, issues, ok: issues.length === 0,
    canSave: goal != null && sections.length > 0, text: text.trim() };
}
export function goalFrom(text, cfg) {
  const [g1, g2] = S(cfg.ai.goalLine).split('{النسبة}');
  const flex = (s) => esc(S(s).trim()).replace(/\s+/g, '\\s*').replace(/≥/g, '(?:≥|>=|=>|≧|أكبر من أو يساوي)');
  const gre = new RegExp(`${flex(g1)}\\s*([0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?)\\s*${flex(g2 || '') || ''}`);
  const gm = S(text).match(gre) || toLatin(text).match(new RegExp(`${flex(toLatin(g1))}\\s*([0-9]+(?:\\.[0-9]+)?)`));
  const g = gm ? Number(toLatin(gm[1])) : null;
  return g != null && g >= 0 && g <= 100 ? g : null;
}
// النص الكامل بعد التعديل (يُحفظ مع الخطة): الأقسام بعلاماتها ثم الرسالة
export function joinPlan(sections, cfg) {
  return sections.map((s) => `${L.marker(cfg, cfg.ai.sections.find((t) => secNum(t) === s.n) || `القسم ${s.n}: ${s.title}`)}\n${S(s.body).trim()}`).join('\n\n') + `\n\n${L.marker(cfg, cfg.ai.endTitle)}`;
}
export const itemsToText = (items, P) => items.map((i) => [i.step, i.owner, i.due, i.verify].map((x) => S(x).trim()).join(` ${P.stepSep} `)).join('\n');

// ===================== رسالة الواتساب =====================
// الاستبدال المحلي (الرسالة فقط): «[اسم المعلم]» ← اسمه، و«طالب ١» ← اسم الطالب من خريطة الخطة. لا يُستدعى على الأمر أبداً
export function localizeWa(text, { teacher = '', names = null, smap = {}, on = true } = {}) {
  let t = S(text);
  if (!on) return t;
  if (teacher) t = t.replace(/\[\s*اسم\s+المعلم\s*\]/g, teacher);
  if (names) t = t.replace(/طالب\s*([0-9٠-٩]{1,3})(?![0-9٠-٩])/g, (m0, d) => { const sid = smap[String(Number(toLatin(d)))]; const nm = sid != null ? names[sid]?.[0] : null; return nm || m0; });
  return t;
}
// أسطر الفقاعة: [{segs: [{b, t}]}] — *عريض* بتنسيق واتساب
export function waLines(text) {
  return S(text).split('\n').map((l) => {
    const segs = []; const re = /\*([^*\n]+)\*/g; let last = 0; let m;
    while ((m = re.exec(l))) { if (m.index > last) segs.push({ b: false, t: l.slice(last, m.index) }); segs.push({ b: true, t: m[1] }); last = re.lastIndex; }
    if (last < l.length) segs.push({ b: false, t: l.slice(last) });
    return { segs, blank: !l.trim() };
  });
}

// ===================== الخطوة 4: المتابعة =====================
export function openLine(progress, next, P) {
  return L.fillT(P.openLine, { 'الإنجاز': progress?.pct != null ? L.pct(Number(progress.pct), 0) : '—', 'الموعد': nextExamText(next, { short: true }) });
}
// الحالة الجديدة لبند بعد سجل العمليات (للعرض الفوري قبل رد القاعدة، ولاختبار منطق التراجع)
export function stateFromHist(hist) {
  const undone = new Set(hist.filter((h) => h.a === 'تراجع').map((h) => h.undoes));
  const act = hist.filter((h) => h.a === 'تأشير' && !undone.has(h.id));
  const last = act[act.length - 1];
  return last ? { mark: last.id, status: last.st, note: last.note, by: last.by, at: last.at } : null;
}
// الحكم + نسبة الإنجاز («تحقق • إنجاز الخطوات 60٪») — الحكم بطريقة exams.rate_method الحالية والأساس المعاد حسابه (planStatus)
export function judgeLine(plan, R, P, x) {
  const st = L.planStatus(plan, R); const pr = x?.items?.length ? progressOf(x.items, P) : null;
  const closed = st.code === 'met' || st.code === 'unmet';
  return { st, pr, closed, text: L.fillT(P.view.judge || 'الحكم: {الحكم} • إنجاز الخطوات {الإنجاز}', { 'الحكم': st.label, 'الإنجاز': pr ? L.pct(pr.pct, 0) : '—' }) };
}

// ===================== الخطوة 5: خطة القوالب =====================
// ترجيح القوالب: بيانات المعلم (نقاط الضعف) + تحديات الموجه (خريطة الإعداد)
export function pickTemplates(R, answers, P) {
  const score = { MISSING: 0, LOWPASS: 0, REPEAT: 0, DECLINE: 0 }; const why = { MISSING: [], LOWPASS: [], REPEAT: [], DECLINE: [] };
  const w = new Map(R.weaknesses.map((x) => [x.code, x]));
  const add = (k, n, t) => { score[k] += n; if (t) why[k].push(t); };
  if (w.has('MISSING')) add('MISSING', 3, w.get('MISSING').text);
  if (w.has('FEW')) add('MISSING', 2, w.get('FEW').text);
  if (w.has('FAILED')) add('LOWPASS', 3, w.get('FAILED').text);
  if (w.has('BELOW')) add('LOWPASS', 2, w.get('BELOW').text);
  if (w.has('REPEAT')) add('REPEAT', 3, w.get('REPEAT').text);
  if (w.has('DECLINE')) add('DECLINE', 3, w.get('DECLINE').text);
  // قلة المرشحين المتزايدة: متوسط آخر الأشهر أقل من ثلثي ما قبلها (دليل بيانات على الترشيح)
  const nom = R.months.slice().reverse().filter((m) => m.state === 'done' || m.state === 'nores').map((m) => N(m.p?.t));
  const jn = L.judge(nom, R.cfg.trendN, 0.0001);
  if (jn.label && jn.prev > 0 && jn.last / jn.prev < 2 / 3) add('MISSING', 2, `عدد المرشحين ينقص: متوسط آخر ${L.arCount(jn.k, 'month', { one: false })} ${jn.last.toFixed(1)} مقابل ${jn.prev.toFixed(1)} قبلها`);
  const data = Object.fromEntries(Object.entries(score).map(([k, v]) => [k, v]));
  // التحديات ترجّح بين القوالب التي عليها دليل من البيانات؛ ولا تُدخل قالباً بلا دليل إلا إذا لم يوجد أي دليل
  const anyData = Object.values(data).some((v) => v > 0);
  for (const c of answers?.challenges || []) { const k = P.challengeMap[c]; if (k in score && (!anyData || data[k] > 0)) add(k, 1, c); }
  const picked = Object.entries(score).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, P.tplMax)).map(([k, s]) => ({ code: k, score: s, why: why[k] }));
  const lowObs = L.weakObs(R.W, R.cfg);
  return { picked: picked.length ? picked : [{ code: 'GOOD', score: 0, why: [] }], lowObs };
}
const stageFilter = (body, stage) => S(body).split('\n').filter((l) => { const m = l.trim().match(/^\[([^\]]+)\]/); return !m || m[1].trim() === stage; })
  .map((l) => l.replace(/^\s*\[[^\]]+\]\s*/, '')).join('\n');
export function composeTemplate(R, answers, P, { codes, next, picked: forced } = {}) {
  const cfg = R.cfg; const T = P.tt; const stage = answers?.stage || '';
  const sel = forced?.length ? { picked: forced, lowObs: L.weakObs(R.W, cfg) } : pickTemplates(R, answers, P);
  const goal = suggestGoal(R, P);
  // أنواع الملاحظات التي ذكرها الموجه في «على ماذا تركز الخطة؟» تتقدم، ثم الأكثر طلاباً
  const fx = S(answers?.focus);
  const types = R.noteTypes.slice().sort((a, b) => (fx.includes(b.g) ? 1 : 0) - (fx.includes(a.g) ? 1 : 0));
  const top2 = types.slice(0, 2).map((t) => t.g).join(' و') || 'الأحكام';
  const avgC = R.A.avgCand != null ? Math.round(R.A.avgCand) : (R.lastDone?.p?.t || 0);
  const vars = { 'الأشهر': R.missWin.length ? L.pList(R.missWin.slice(0, 4), true) : 'بعض الأشهر', 'المرشحون': L.fmtN(Math.max(3, avgC + 2)), 'الطلاب': L.fmtN(R.winStudentsN),
    'النسبة': L.weakObs(R.W, cfg) ? L.obsPhrase(R.W, cfg) : L.pct(R.A.winRate, cfg.digits), 'الهدف': L.fmtN(goal.value), 'الراسبون': L.arCount(R.failedStudents, 'student'),
    'الأنواع': top2, 'المتكررون': L.arCount(R.repeatedStudents, 'student'), 'التراجع': R.trend.word ? `${R.trend.word}: ${L.pct(R.trend.last, cfg.digits)} بعد ${L.pct(R.trend.prev, cfg.digits)}` : '—',
    'الموعد': nextExamText(next, { short: true }) };
  const tp = sel.picked.map((x) => ({ ...x, t: P.tpl[x.code] })).filter((x) => x.t);
  const b = (x, k) => L.fillT(stageFilter(x.t.b[k] || '', stage), { ...vars, 'الدليل': x.why?.join('؛ ') || '—' }).trim();
  const items = []; const seen = new Set();
  for (const x of tp) for (const it of parseSteps(b(x, 'الخطوات'), P)) { if (!seen.has(it.step)) { seen.add(it.step); items.push(it); } }
  const lo = sel.lowObs && P.tpl.LOWOBS ? P.tpl.LOWOBS : null;
  if (lo) for (const it of parseSteps(L.fillT(lo.b['الخطوات'] || '', vars), P)) items.push(it);   // خطوات الموجه فقط، لا تدخل الرسالة ولا الأهداف
  const nature = Object.values(answers?.nature || {}).map((a) => P.natureTips[a]).filter(Boolean);
  const strengths = R.strengths.map((s) => s.text);
  const stList = (codes?.list || []).map((s) => {
    const r = s.reasons.map((x) => x.code); const typ = (s.reasons.find((x) => x.code === 'REPEAT')?.keys || []).slice(0, 2).map((x) => x.k).join(' و') || top2;
    const parts = [];
    if (r.includes('REPEAT')) parts.push(L.fillT(T.st_repeat || '', { 'النوع': typ }));
    if (r.includes('FAILED')) parts.push(parts.length ? (T.st_failed_and || T.st_failed) : T.st_failed);
    if (!parts.length) parts.push(T.st_notes);
    return { s, act: parts.filter(Boolean).join('، ') };
  });
  const goalLine = L.fillT(cfg.ai.goalLine, { 'النسبة': L.fmtN(goal.value) });
  const kLine = keepLine(goal, P);
  const sec = (n, body) => ({ n, title: (cfg.ai.sections.find((t) => secNum(t) === n) || '').replace(/^القسم\s*[0-9٠-٩]+\s*:\s*/, ''), body: S(body).trim(), role: Object.entries(P.roles).find(([, v]) => v === n)?.[0] || null });
  const R2 = P.roles;
  const diag = [R.cards[0]?.text || '', b(tp[0], 'التشخيص').split('\n')[0] || '', items[0] ? `الفرصة الأكبر قبل الاختبار القادم: ${items[0].step}.` : ''].filter(Boolean).slice(0, 3);
  if (lo) diag.push(L.fillT(lo.b['التشخيص'] || '', vars));
  const sup = [...tp.map((x) => b(x, 'دور الموجه')).filter(Boolean), ...(nature.length ? [`${T.supervisor_title || ''}:`, ...nature.map((t) => `- ${t}`)] : [])];
  const risks = [...tp.map((x) => b(x, 'المخاطر')).filter(Boolean), lo ? L.fillT(lo.b['المخاطر'] || '', vars) : '',
    S(answers?.tried).trim() ? L.fillT(T.tried_note || '{النص}', { 'النص': S(answers.tried).trim() }) : '', S(answers?.focus).trim() ? L.fillT(T.focus_note || '{النص}', { 'النص': S(answers.focus).trim() }) : ''].filter(Boolean);
  const goalsOther = tp.flatMap((x) => lines(b(x, 'الأهداف')).map((l) => l.replace(/^[-•]\s*/, '')));
  const sectionsMap = {
    [R2.diag]: diag.join('\n'),
    [R2.strengths]: (strengths.length ? strengths : [T.strengths_none || '—']).map((t) => `- ${t}`).join('\n'),
    [R2.priorities]: tp.filter((x) => x.code !== 'GOOD').map((x, i) => `${i + 1}. ${b(x, 'التشخيص').split('\n')[0] || x.code}`).join('\n') || '—',
    [R2.steps]: itemsToText(items, P),
    [R2.schedule]: b(tp[0], 'الجدول'),
    [R2.supervisor]: sup.join('\n'),
    [R2.goals]: [goalLine, ...(kLine ? [kLine] : []), ...goalsOther.map((g) => `- ${g}`)].join('\n'),
    [R2.students]: stList.length ? stList.map(({ s, act }) => `${s.label}: ${s.text} ← ${act} ← ${T.st_when || ''}`).join('\n') : (T.students_none || '—'),
    [R2.risks]: risks.join('\n'),
  };
  // الرسالة: افتتاح، وتقدير ونقاط قوة، ورسالة كل قالب، والهدف، والطلاب (بالرموز)، والختام — ولا ذكر لضعف الرصد
  // نقاط القوة في الرسالة بصيغة المخاطَب (من الإعداد sw_<الرمز>)، وإلا الجملة العامة
  // أي نسبة في الرسالة: عند ضعف الرصد الصيغة المختصرة من exams.low_obs_texts بدل «نجح 100٪»
  const sv = { 'النسبة': L.rateOrPhrase(R.W, cfg, R.A.winRate, cfg.digits, 'short'), 'النطاق': R.winLabel, 'الشهر': R.lastDone ? L.pName(R.lastDone, true) : '' };
  const waStr = R.strengths.map((s2) => (T[`sw_${s2.code}`] ? L.fillT(T[`sw_${s2.code}`], sv) : null)).filter(Boolean);
  const wa = [T.wa_open, T.wa_greet, '', T.wa_strengths_title, ...(waStr.length ? waStr : [T.strengths_none || '']).slice(0, 2).map((t) => `✅ ${t}`), '',
    ...tp.flatMap((x) => [b(x, 'الرسالة'), '']), T.wa_goal_title, goal.keep ? L.fillT(P.rt.keep_wa, goalVars(goal, P)) : L.fillT(T.wa_goal || '', vars), '',
    ...(stList.length ? [T.wa_students_title, ...stList.slice(0, 5).map(({ s, act }) => `• ${s.label}: ${act}`), ''] : []),
    L.fillT(T.wa_close || '', vars), T.wa_dua].filter((x) => x != null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  let waT = wa;
  if (waT.length > cfg.waMax) { const cut = waT.slice(0, cfg.waMax - 1); waT = cut.slice(0, Math.max(cut.lastIndexOf('\n'), cfg.waMax * 0.6)).trim(); }
  sectionsMap[R2.wa] = waT;
  const sections = cfg.ai.sections.map((t) => secNum(t)).filter((n) => n != null).map((n) => sec(n, sectionsMap[n] || ''));
  return { sections, items, goal: goal.value, goalInfo: goal, keep: goal.keep, goals: goalsOther, wa: waT, picked: sel.picked, lowObs: sel.lowObs,
    templates: [...tp.map((x) => ({ key: x.t.key, version: x.t.version })), ...(lo ? [{ key: lo.key, version: lo.version }] : [])] };
}
