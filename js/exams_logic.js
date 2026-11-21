// منطق الاختبارات (المرحلة 10ب) — دوال خالصة بلا واجهة ولا شبكة، يستعملها تبويب الاختبارات والتصدير والاختبارات الآلية.
// كل عتبة ونص وقالب ولون من الإعدادات (d.set) القادمة مع ملخص المعلم من القاعدة؛ لا رقم حكم ثابت هنا.
// قاعدة النسبة (أمر المرحلة 10ب): نسبة النجاح = الناجحون ÷ جميع المرشحين × 100. «لم تُرصد» داخل المقام ولا تُعد نجاحاً.
// والمستبعدون داخل المقام أيضاً ما دام إعداد «المستبعدون داخل مقام نسبة النجاح» مشغّلاً.

export const HMONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const TERM_NAMES = ['الأول', 'الثاني', 'الثالث'];
const N = (x) => Number(x) || 0;

// ---------- صيغ العدد العربية ----------
// forms: [مفرد، مثنى، جمع (3–10)، تمييز منصوب (11–99)، مفرد بعد المئة]
export const FORMS = {
  month: ['شهر', 'شهران', 'أشهر', 'شهراً', 'شهر'],
  student: ['طالب', 'طالبان', 'طلاب', 'طالباً', 'طالب'],
  term: ['اختبار فصلي', 'اختباران فصليان', 'اختبارات فصلية', 'اختباراً فصلياً', 'اختبار فصلي'],
  monthlyMonth: ['شهر', 'شهران', 'أشهر', 'شهراً', 'شهر'],
  tested: ['مختبَر', 'مختبَران', 'مختبَرين', 'مختبَراً', 'مختبَر'],
  note: ['ملاحظة', 'ملاحظتان', 'ملاحظات', 'ملاحظةً', 'ملاحظة'],
  teacher: ['معلم', 'معلمان', 'معلمين', 'معلماً', 'معلم'],
  exam: ['اختبار', 'اختباران', 'اختبارات', 'اختباراً', 'اختبار'],
  period: ['فصل أو شهر', 'فصلان أو شهران', 'فصول وأشهر', 'فصلاً وشهراً', 'فصل وشهر'],
  termPeriod: ['فصل', 'فصلان', 'فصول', 'فصلاً', 'فصل'],
};
export const fmtN = (n) => String(Math.round(N(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
// gen: بعد حرف جر («في شهرين»، «في اختبارين») — المثنى المجرور
export function arCount(n, forms, { one = true, gen = false } = {}) {
  const v = Math.round(N(n)); const f = typeof forms === 'string' ? FORMS[forms] : forms;
  if (v === 1) return one ? `${f[0]} واحد${/ة$/.test(f[0]) ? 'ة' : ''}` : f[0];
  if (v === 2) return gen ? f[1].replace(/ان(?=\s|$)/g, 'ين') : f[1];
  const r = v % 100;
  if (r >= 3 && r <= 10) return `${fmtN(v)} ${f[2]}`;
  if (r >= 11 && r <= 99) return `${fmtN(v)} ${f[3]}`;
  return v === 0 ? `0 ${f[2]}` : `${fmtN(v)} ${f[4]}`;
}
// «3 اختبارات فصلية من أصل 4»
export const ofTotal = (n, total, forms) => `${arCount(n, forms)} من أصل ${fmtN(total)}`;
export const pctText = (x, digits = 1) => (x == null || !isFinite(x) ? '—' : `${(Math.round(x * 1000) / 10).toFixed(digits).replace(/\.0$/, '')}٪`);

// ---------- الفصل أو الشهر ----------
export const kindName = (k, kinds) => (kinds || []).find((x) => x.code === k)?.name || (k === 'TERM' ? 'فصلية' : k === 'MONTHLY' ? 'تنشيطية' : '');
export function periodName(p) {
  if (p.k === 'TERM') return `الفصل ${TERM_NAMES[p.n - 1] || p.n} ${p.y}هـ`;
  return `${HMONTHS[p.n - 1] || p.n} ${p.y}هـ`;
}
// «رجب، جمادى الآخرة، ربيع الآخر 1447هـ، والفصل الأول 1447هـ» (بالترتيب المعطى، والسنة مرة لكل مجموعة متتالية)
export function listPeriods(arr) {
  const parts = [];
  for (const p of arr) {
    const last = parts[parts.length - 1];
    const name = p.k === 'TERM' ? `الفصل ${TERM_NAMES[p.n - 1] || p.n}` : HMONTHS[p.n - 1] || String(p.n);
    if (last && last.y === p.y && last.k === p.k && p.k === 'MONTHLY') last.names.push(name); else parts.push({ y: p.y, k: p.k, names: [name] });
  }
  return parts.map((x) => `${x.names.join('، ')} ${x.y}هـ`).join('، و');
}
export function missingText(missing) {
  const m = missing.filter((x) => x.k !== 'TERM').length, t = missing.length - m;
  const cnt = [m ? arCount(m, 'month', { gen: true }) : '', t ? arCount(t, 'termPeriod', { gen: true }) : ''].filter(Boolean).join(' و');
  return `لم يرشّح في ${cnt}: ${listPeriods(missing)}`;
}
export const periodLabel = (p, kinds) => `${kindName(p.k, kinds)} — ${periodName(p)}`;
const pkey = (p) => `${p.k}|${p.y}|${p.n}`;
export function sortKey(p, cal) {
  if (p.k === 'MONTHLY') return p.y * 100 + p.n;
  const c = (cal || []).find((x) => x.k === p.k && x.y === p.y && x.n === p.n);
  return p.y * 100 + (c?.sm || (p.n === 1 ? 4 : 8));
}

// ---------- الإعدادات ----------
export function settings(set = {}) {
  const v = (k, d) => { const x = set[k]; return x == null || x === '' ? d : x; };
  const num = (k, d) => { const x = Number(v(k, d)); return isFinite(x) ? x : d; };
  const color = (k, d) => { const x = String(v(k, '')); return /^#[0-9a-f]{6}$/i.test(x) ? x : (set._defaults?.[k] || d); };
  return {
    inclExcluded: v('exams.rate_include_excluded', true) !== false && v('exams.rate_include_excluded', true) !== 'false',
    window: v('exams.analysis_window', 'آخر سنة هجرية'),
    strengthPass: num('exams.strength_pass', 0.95), notesFactor: num('exams.notes_factor', 1.25), notesLow: num('exams.notes_low_factor', 0.75),
    notesMinTested: num('exams.notes_min_tested', 5), repeatMin: num('exams.repeat_min', 2), repeatStudentsMin: num('exams.repeat_students_min', 3),
    noResultMax: num('exams.no_result_max', 0.10), failedMax: num('exams.failed_max', 0.10), declinePoints: num('exams.decline_points', 10),
    missingMin: num('exams.missing_min', 1), candidatesMin: num('exams.candidates_min_ratio', 0.5), page: num('exams.followup_page', 30),
    waMax: num('exams.whatsapp_max', 700), waTemplate: v('exams.wa_template', '{المعلم}\n{نقاط_الضعف}\n{الإجراءات}\n{المدة}\n{مؤشر_التحقق}\n{الطلاب}'), waStudents: v('exams.wa_students_line', '{الطلاب}'),
    listenLine: v('exams.visit_listen_line', 'استمع إلى: {الطلاب}'), askLine: v('exams.visit_ask_line', 'اسأل عن عدم الترشيح في {الأشهر}'),
    thanksLine: v('exams.improve_thanks_line', '• {المؤشر}'),
    colors: { pass: color('exams.color_pass', '#17603a'), fail: color('exams.color_fail', '#a4161a'), nores: color('exams.color_noresult', '#9a3d00'),
      missingBg: color('exams.color_missing_bg', '#fde7e7'), note: color('exams.color_note', '#7a5300') },
    remedy: Object.fromEntries(Object.entries(set).filter(([k]) => k.startsWith('exams.remedy_')).map(([k, t]) => [k.slice(13).toUpperCase(), { text: String(t || ''), version: set._versions?.[k] || 1 }])),
    names: set['students.show_names'] === true || set['students.show_names'] === 'true',
  };
}

// ---------- الحساب ----------
export const candidates = (x, cfg) => N(x.t) - (cfg.inclExcluded ? 0 : N(x.x));
export const passRate = (x, cfg) => { const d = candidates(x, cfg); return d > 0 ? N(x.p) / d : null; };
const sum = (arr, f) => arr.reduce((a, x) => a + N(typeof f === 'function' ? f(x) : x[f]), 0);
const addErr = (arr) => { const o = {}; arr.forEach((x) => Object.entries(x.e || {}).forEach(([k, v]) => { o[k] = (o[k] || 0) + N(v); })); return o; };
const addGrp = (arr) => { const o = {}; arr.forEach((x) => Object.entries(x.g || {}).forEach(([k, v]) => { o[k] = (o[k] || 0) + N(v); })); return o; };

// التحليل الكامل لملخص معلم (d = مخرج rpc_teacher_exams_v2)
export function analyze(d) {
  const cfg = settings(d.set);
  const cal = d.cal || [];
  const periods = (d.s?.periods || []).map((p) => ({ ...p, sk: sortKey(p, cal), key: pkey(p) })).sort((a, b) => b.sk - a.sk || (a.k < b.k ? -1 : 1));
  const missing = (d.missing || []).map((m) => ({ ...m, sk: m.sk || sortKey(m, cal), key: pkey(m), missing: true }));
  const div = new Map((d.div || []).map((x) => [pkey(x), x]));
  const has = periods.length > 0;
  const lastYear = has ? Math.max(...periods.map((p) => p.y)) : null;
  const inWin = (p) => cfg.window === 'كل الأرشيف' || p.y === lastYear;
  const win = periods.filter(inWin);
  const winKey = cfg.window === 'كل الأرشيف' ? 'all' : String(lastYear);
  const fu = d.s?.fu?.[winKey] || { students: 0, failed: 0, nores: 0, noted: 0, total: 0, by_code: {}, by_group: {}, rep: {} };
  const fuAll = d.s?.fu?.all || fu;
  const winLabel = cfg.window === 'كل الأرشيف' ? 'كل الأرشيف' : lastYear ? `سنة ${lastYear}هـ` : '';

  // المؤشرات
  const lastOf = (k) => periods.find((p) => p.k === k) || null;
  const lastTerm = lastOf('TERM'), lastMonthly = lastOf('MONTHLY');
  const part = (k) => { const n = periods.filter((p) => p.k === k).length; const m = missing.filter((x) => x.k === k).length; return { n, total: n + m }; };
  const termPart = part('TERM'), monPart = part('MONTHLY');
  const winMonthly = win.filter((p) => p.k === 'MONTHLY');
  const avgCand = winMonthly.length ? sum(winMonthly, 't') / winMonthly.length : null;
  const T = sum(win, 't'), P = sum(win, 'p'), F = sum(win, 'f'), X = sum(win, 'x'), R = sum(win, 'r');
  const W = { t: T, p: P, f: F, x: X, r: R };
  const errs = addErr(win), grps = addGrp(win);
  const notesTotal = Object.values(errs).reduce((a, b) => a + b, 0);
  // متوسط الشعبة في النطاق نفسه (السنوات نفسها)
  const divWin = (d.div || []).filter((x) => cfg.window === 'كل الأرشيف' || x.y === lastYear);
  const divT = sum(divWin, 't'); const divErr = addErr(divWin);
  const divRate = (code) => (divT ? N(divErr[code]) / divT : null);
  const divPass = divT ? sum(divWin, 'p') / (divT - (cfg.inclExcluded ? 0 : sum(divWin, 'x'))) : null;
  const rateOf = (code) => (T ? N(errs[code]) / T : null);

  // سير المعلم: كل فصل/شهر، وصفوف «لم يرشّح»، مع السهم مقارنة بالسابق من النوع نفسه وبمتوسط الشعبة
  const timeline = [...periods, ...missing].sort((a, b) => b.sk - a.sk || (a.k < b.k ? -1 : 1)).map((p) => {
    if (p.missing) return { ...p };
    const prev = periods.find((q) => q.k === p.k && q.sk < p.sk);
    const r = passRate(p, cfg); const pr = prev ? passRate(prev, cfg) : null;
    const dv = div.get(p.key); const dr = dv ? passRate(dv, cfg) : null;
    return { ...p, rate: r, prevRate: pr, prevKey: prev?.key || null, vsPrev: r != null && pr != null ? r - pr : null, divRate: dr, vsDiv: r != null && dr != null ? r - dr : null,
      notesPer: N(p.t) ? sum(Object.values(p.e || {}), (x) => x) / N(p.t) : 0 };
  });

  // المتكررون: عدد الطلاب الذين ظهر عندهم التصنيف نفسه في repeatMin اختباراً أو أكثر (من التوزيع المحسوب مسبقاً)
  const repeated = (f) => { const byStudent = {}; Object.entries(f.rep || {}).forEach(([code, hist]) => Object.entries(hist).forEach(([times, n]) => { if (N(times) >= cfg.repeatMin) byStudent[code] = (byStudent[code] || 0) + N(n); }));
    return { byCode: byStudent, max: Math.max(0, ...Object.values(byStudent)), total: Object.values(byStudent).reduce((a, b) => a + b, 0) }; };
  const rep = repeated(fu);

  // التنبيهات (تظهر فقط عند وجود حالة)
  const alerts = [];
  if (missing.length) alerts.push({ code: 'MISSING', level: 'bad', filter: 'missing', text: missingText(missing) });
  const nrPct = T ? R / T : 0;
  if (T && nrPct > cfg.noResultMax) alerts.push({ code: 'NO_RESULT', level: 'warn', filter: 'nores', text: `لم تُرصد نتائج ${pctText(nrPct)} من المرشحين في ${winLabel} (${arCount(R, 'tested', { one: false })}؛ الحد ${pctText(cfg.noResultMax)})` });
  if (rep.max > 0) alerts.push({ code: 'REPEAT', level: 'warn', filter: 'repeated', text: `${arCount(rep.max, 'student')} تكررت ملاحظاتهم من التصنيف نفسه في ${arCount(cfg.repeatMin, 'exam', { one: false, gen: true })} أو أكثر` });
  const mon = periods.filter((p) => p.k === 'MONTHLY');
  if (mon.length >= 2) {
    const a = passRate(mon[0], cfg), b = passRate(mon[1], cfg);
    if (a != null && b != null && (b - a) * 100 >= cfg.declinePoints) alerts.push({ code: 'DECLINE', level: 'warn', text: `تراجعت نسبة النجاح في ${periodName(mon[0])} إلى ${pctText(a)} بعد ${pctText(b)} في ${periodName(mon[1])}` });
  }

  // نقاط القوة والضعف (قواعد وعتبات من الإعدادات؛ كل نقطة بسببها بالرقم)
  const strengths = [], weaknesses = [];
  const wr = passRate(W, cfg);
  if (T) {
    if (wr != null && wr >= cfg.strengthPass) strengths.push({ code: 'PASS', text: `نجاح ${pctText(wr)} من المرشحين في ${winLabel}`, why: `${fmtN(P)} ناجحاً من ${fmtN(candidates(W, cfg))} مرشحاً (الحد ${pctText(cfg.strengthPass)})` });
    for (const [code, label] of [['TAJWEED', 'التجويدية'], ['HIFZ', 'الحفظ'], ['TASHKEEL', 'التشكيل']]) {
      const r = rateOf(code), dr = divRate(code);
      if (T < cfg.notesMinTested || r == null || dr == null) continue;
      if (dr > 0 && r > dr * cfg.notesFactor) weaknesses.push({ code, text: `ارتفاع ملاحظات ${label}`, why: `${fmtN(errs[code])} ${FORMS.note[2]} لـ ${fmtN(T)} مختبَراً = ${r.toFixed(2)} لكل مختبَر، ومتوسط الشعبة ${dr.toFixed(2)}` });
      else if (code === 'TAJWEED' && r < dr * cfg.notesLow) strengths.push({ code: 'NOTES_LOW', text: 'ملاحظات تجويدية أقل من متوسط الشعبة', why: `${r.toFixed(2)} لكل مختبَر، ومتوسط الشعبة ${dr.toFixed(2)}` });
    }
    if (rep.max >= cfg.repeatStudentsMin) weaknesses.push({ code: 'REPEAT', text: 'ملاحظات متكررة عند الطلاب أنفسهم', why: `${arCount(rep.max, 'student')} تكررت ملاحظاتهم في ${arCount(cfg.repeatMin, 'exam', { one: false, gen: true })} أو أكثر (الحد ${fmtN(cfg.repeatStudentsMin)})` });
    if (nrPct > cfg.noResultMax) weaknesses.push({ code: 'NO_RESULT', text: 'كثرة «لم تُرصد»', why: `${fmtN(R)} من ${fmtN(T)} = ${pctText(nrPct)}، والحد ${pctText(cfg.noResultMax)}` });
    else if (R === 0) strengths.push({ code: 'NO_RESULT_ZERO', text: 'رُصدت نتائج جميع المرشحين', why: `0 «لم تُرصد» من ${fmtN(T)}` });
    const fPct = F / Math.max(1, candidates(W, cfg));
    if (fPct > cfg.failedMax) weaknesses.push({ code: 'FAILED', text: 'ارتفاع الرسوب', why: `${fmtN(F)} راسباً من ${fmtN(candidates(W, cfg))} = ${pctText(fPct)}، والحد ${pctText(cfg.failedMax)}` });
    const students = N(fu.students);
    if (avgCand != null && students > 0 && avgCand / students < cfg.candidatesMin) weaknesses.push({ code: 'FEW', text: 'قلة المرشحين قياساً بعدد الطلاب',
      why: `متوسط ${avgCand.toFixed(1)} مرشحاً في الشهر من ${fmtN(students)} طالباً رشّحهم في ${winLabel} = ${pctText(avgCand / students)}، والحد ${pctText(cfg.candidatesMin)} (عدد طلاب الحلقة غير متوفر في المصدر)` });
  }
  const missWin = missing.filter((m) => cfg.window === 'كل الأرشيف' || m.y === lastYear);
  if (missWin.length >= cfg.missingMin) weaknesses.push({ code: 'MISSING', text: 'أشهر بلا ترشيح', why: `${missingText(missWin).replace('لم يرشّح في ', '')} (في ${winLabel})` });
  else if (has && !missing.length) strengths.push({ code: 'FULL', text: 'شارك في كل الاختبارات المقامة', why: `${ofTotal(termPart.n, termPart.total, 'term')}، و${ofTotal(monPart.n, monPart.total, 'month')} من التنشيطية` });
  const decline = alerts.find((a) => a.code === 'DECLINE'); if (decline) weaknesses.push({ code: 'DECLINE', text: 'تراجع نسبة النجاح عن الشهر السابق', why: decline.text });

  // ملخص الملاحظات التجويدية
  const groups = Object.entries(grps).sort((a, b) => b[1] - a[1]);
  const notes = { total: notesTotal, per: T ? notesTotal / T : null, byCode: errs, groups, top: groups[0] || null,
    divPer: divT ? Object.values(divErr).reduce((a, b) => a + b, 0) / divT : null, tajPer: rateOf('TAJWEED'), divTajPer: divRate('TAJWEED') };

  return { cfg, has, periods, missing, timeline, lastTerm, lastMonthly, termPart, monPart, avgCand, win: W, winRate: wr, divPass, errs, notes, fu, fuAll, rep,
    alerts, strengths, weaknesses, lastYear, winLabel, winKey };
}

// ---------- قوالب العلاج ورسالة واتساب ----------
export function parseRemedy(text) {
  const line = (label) => (String(text || '').split('\n').find((l) => l.trim().startsWith(label)) || '').replace(label, '').trim();
  return { actions: line('الإجراءات:'), duration: line('المدة:'), verify: line('التحقق:') };
}
const fill = (t, vars) => String(t || '').replace(/\{([^}]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
// يبني الرسالة ولا يتجاوز الحد: يختصر الإجراءات ثم يقص بلطف
export function planMessage(A, codes, { teacher = '', studentsText = '' } = {}) {
  const cfg = A.cfg; const ws = A.weaknesses.filter((w) => codes.includes(w.code));
  const topGroups = A.notes.groups.slice(0, 2).map(([g]) => g).join(' و') || 'الأحكام';
  const parts = ws.map((w) => ({ w, r: parseRemedy(fill(cfg.remedy[w.code]?.text || '', { 'الأنواع': topGroups })) }));
  const build = (maxAct) => fill(cfg.waTemplate, {
    'المعلم': teacher, 'نقاط_الضعف': ws.map((w) => `• ${w.text}`).join('\n'),
    'الإجراءات': parts.map(({ r }) => `• ${maxAct ? r.actions.slice(0, maxAct).replace(/\s+\S*$/, '') + (r.actions.length > maxAct ? '…' : '') : r.actions}`).join('\n'),
    'المدة': [...new Set(parts.map(({ r }) => r.duration).filter(Boolean))].join('، '),
    'مؤشر_التحقق': parts.map(({ r }) => (maxAct && r.verify.length > maxAct ? r.verify.slice(0, maxAct).replace(/\s+\S*$/, '') + '…' : r.verify)).filter(Boolean).join('؛ '),
    'الطلاب': studentsText ? fill(cfg.waStudents, { 'الطلاب': studentsText }) : '' }).replace(/\n{3,}/g, '\n\n').trim();
  let msg = build(0);
  for (const cap of [160, 110, 70, 45]) { if (msg.length <= cfg.waMax) break; msg = build(cap); }
  // ثم أقل عدد من نقاط الضعف (الأهم أولاً)، ثم قص عند نهاية سطر لا في منتصف كلمة
  while (msg.length > cfg.waMax && parts.length > 1) { parts.pop(); ws.pop(); msg = build(45); }
  if (msg.length > cfg.waMax) { const cut = msg.slice(0, cfg.waMax - 1); msg = cut.slice(0, Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('؛'), cfg.waMax * 0.6)).trim() + '…'; }
  return { text: msg, templates: parts.map(({ w }) => ({ key: `exams.remedy_${w.code.toLowerCase()}`, label: w.text, version: cfg.remedy[w.code]?.version || 1 })) };
}

// ---------- «هل تحقق؟»: مقارنة رقمية بعد أول اختبار تالٍ لتاريخ الخطة ----------
export function planCheck(plan, A) {
  const b = plan.baseline || {}; const after = A.periods.filter((p) => p.sk > N(b.sk));
  if (!after.length) return { pending: true, text: 'ينتظر الاختبار القادم' };
  const cfg = A.cfg; const t = sum(after, 't');
  const out = [];
  const errs = addErr(after);
  for (const code of plan.codes || []) {
    if (['TAJWEED', 'HIFZ', 'TASHKEEL'].includes(code) && b.rates?.[code] != null) {
      const now = t ? N(errs[code]) / t : null; if (now == null) continue;
      out.push({ code, ok: now < b.rates[code], text: `ملاحظات ${code === 'TAJWEED' ? 'التجويد' : code === 'HIFZ' ? 'الحفظ' : 'التشكيل'} لكل مختبَر: ${b.rates[code].toFixed(2)} ← ${now.toFixed(2)}` });
    }
    if (code === 'NO_RESULT' && b.nores != null) { const now = t ? sum(after, 'r') / t : 0; out.push({ code, ok: now <= cfg.noResultMax, text: `«لم تُرصد»: ${pctText(b.nores)} ← ${pctText(now)}` }); }
    if (code === 'FAILED' && b.failed != null) { const c2 = t - (cfg.inclExcluded ? 0 : sum(after, 'x')); const now = c2 ? sum(after, 'f') / c2 : 0; out.push({ code, ok: now <= cfg.failedMax, text: `الرسوب: ${pctText(b.failed)} ← ${pctText(now)}` }); }
    if (code === 'MISSING') { const m = A.missing.filter((x) => x.sk > N(b.sk)).length; out.push({ code, ok: m === 0, text: m ? `لم يرشّح بعد الخطة في ${arCount(m, 'month', { gen: true })}` : 'رشّح في كل ما أُقيم بعد الخطة' }); }
    if (code === 'DECLINE' || code === 'FEW') { const r0 = b.rate; const r1 = passRate({ t, p: sum(after, 'p'), x: sum(after, 'x') }, cfg);
      if (code === 'DECLINE' && r0 != null && r1 != null) out.push({ code, ok: r1 >= r0, text: `نسبة النجاح: ${pctText(r0)} ← ${pctText(r1)}` });
      if (code === 'FEW' && b.avgCand != null) { const am = after.filter((p) => p.k === 'MONTHLY'); const a1 = am.length ? sum(am, 't') / am.length : 0; out.push({ code, ok: a1 > b.avgCand, text: `متوسط المرشحين في الشهر: ${b.avgCand.toFixed(1)} ← ${a1.toFixed(1)}` }); } }
  }
  return { pending: false, items: out, ok: out.length > 0 && out.every((x) => x.ok), some: out.some((x) => x.ok) };
}
export const baselineOf = (A) => ({ sk: A.periods[0]?.sk || 0, rate: A.winRate, nores: A.win.t ? A.win.r / A.win.t : 0, failed: A.win.t ? A.win.f / Math.max(1, candidates(A.win, A.cfg)) : 0,
  avgCand: A.avgCand, rates: { TAJWEED: A.win.t ? N(A.errs.TAJWEED) / A.win.t : null, HIFZ: A.win.t ? N(A.errs.HIFZ) / A.win.t : null, TASHKEEL: A.win.t ? N(A.errs.TASHKEEL) / A.win.t : null } });

// ---------- تباين الألوان (WCAG) ----------
const lum = (hex) => { let h6 = hex.replace('#', ''); if (h6.length === 3) h6 = h6.split('').map((x) => x + x).join(''); const c = h6.match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// =====================================================================
// إعادة بناء التبويب (2026-11-21): كل طالب يُعدّ مرة واحدة من صفوف الطلاب (بلا أسماء)، وحالات الشهر الثلاث،
// والخلاصة بجمل، وسير المعلم بحكم واحد، والتقرير، وأمر الذكاء الاصطناعي وفحص الرد، وحالة الخطة التلقائية.
// كل نص توضيحي وقالب وعتبة من الإعدادات (exams.*). لا عتبة ولا جملة ثابتة هنا إلا أسماء الأشهر وصيغ العدد.
// =====================================================================
Object.assign(FORMS, {
  candidate: ['مرشح', 'مرشحان', 'مرشحين', 'مرشحاً', 'مرشح'],
  nomination: ['ترشيح', 'ترشيحان', 'ترشيحات', 'ترشيحاً', 'ترشيح'],
  result: ['نتيجة', 'نتيجتان', 'نتائج', 'نتيجة', 'نتيجة'],
  point: ['نقطة', 'نقطتان', 'نقاط', 'نقطة', 'نقطة'],
  times: ['مرة', 'مرتان', 'مرات', 'مرة', 'مرة'],
  visit: ['زيارة', 'زيارتان', 'زيارات', 'زيارة', 'زيارة'],
  passed: ['ناجح', 'ناجحان', 'ناجحين', 'ناجحاً', 'ناجح'],
  failedP: ['راسب', 'راسبان', 'راسبين', 'راسباً', 'راسب'],
});
const RES = ['ناجح', 'راسب', 'لم تُرصد', 'مستبعد'];
// «في ذي القعدة» و«في ذي الحجة» بعد حرف الجر
export const hmonth = (n, gen = false) => { const m = HMONTHS[n - 1] || String(n); return gen ? m.replace(/^ذو /, 'ذي ') : m; };
export function pName(p, gen = false) { return p.k === 'TERM' ? `الفصل ${TERM_NAMES[p.n - 1] || p.n} ${p.y}هـ` : `${hmonth(p.n, gen)} ${p.y}هـ`; }
export function pList(arr, gen = false) {
  const parts = [];
  for (const p of arr) {
    const last = parts[parts.length - 1];
    const name = p.k === 'TERM' ? `الفصل ${TERM_NAMES[p.n - 1] || p.n}` : hmonth(p.n, gen);
    if (last && last.y === p.y && last.k === p.k && p.k === 'MONTHLY') last.names.push(name); else parts.push({ y: p.y, k: p.k, names: [name] });
  }
  return parts.map((x) => `${x.names.join('، ')} ${x.y}هـ`).join('، و');
}
// «12 فصلاً وشهراً»: الأشهر والفصول تُعدّ منفصلة
export function pCount(arr, gen = true) {
  const m = arr.filter((x) => x.k !== 'TERM').length, t = arr.length - m;
  return [m ? arCount(m, 'month', { gen }) : '', t ? arCount(t, 'termPeriod', { gen }) : ''].filter(Boolean).join(' و');
}
export const pct = (x, digits = 0) => (x == null || !isFinite(x) ? '—' : `${(Math.round(x * 100 * 10 ** digits) / 10 ** digits).toFixed(digits).replace(/\.0$/, '')}٪`);
// «بـ 12 نقطة»: فرق نسبتين بالنقاط (عدد صحيح)
export const pts = (d) => Math.round(Math.abs(d) * 100);
// «المفتاح: النص» سطراً سطراً
export function kv(text) { const o = {}; String(text || '').split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); return o; }
export const fillT = (t, vars) => String(t || '').replace(/\{([^}]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const bool = (x, d) => (x == null || x === '' ? d : x === true || x === 'true');

export function settings2(set = {}) {
  const base = settings(set);
  const v = (k, d) => { const x = set[k]; return x == null || x === '' ? d : x; };
  const num = (k, d) => { const x = Number(v(k, d)); return isFinite(x) ? x : d; };
  return { ...base,
    digits: num('exams.pct_digits', 0), trendN: num('exams.trend_n', 3), trendPts: num('exams.trend_points', 5),
    excludeSelf: bool(set['exams.compare_exclude_self'], true), compareMin: num('exams.compare_min', 20),
    repeatLevel: v('exams.repeat_level', 'النوع'), notesTrendPts: num('exams.notes_trend_points', 10),
    fu: { failed: bool(set['exams.fu_failed'], true), repeat: bool(set['exams.fu_repeat'], true), noresMin: num('exams.fu_nores_min', 2), notesLastMin: num('exams.fu_notes_last_min', 3),
      w: { FAILED: num('exams.fu_w_failed', 3), REPEAT: num('exams.fu_w_repeat', 2), NORES: num('exams.fu_w_nores', 1), NOTES: num('exams.fu_w_notes', 1) } },
    noresPending: bool(set['exams.nores_pending'], true), noresShare: num('exams.nores_month_share', 0.5), goalStep: num('exams.goal_step', 5), goalKind: v('exams.plan_goal_kind', 'التنشيطي'),
    cards: kv(set['exams.card_templates']), help: kv(set['exams.help_texts']), glossary: kv(set['exams.glossary']), rec: kv(set['exams.rec_templates']),
    recOrder: String(set['exams.rec_templates'] || '').split('\n').map((l) => l.split(':')[0].trim()).filter(Boolean), ui: kv(set['exams.ui_texts']),
    ai: { template: v('exams.ai_prompt_template', ''), version: set._versions?.['exams.ai_prompt_template'] || 1,
      sections: String(v('exams.ai_sections', '')).split('\n').map((x) => x.trim()).filter(Boolean),
      marker: v('exams.ai_marker', '[[{العنوان}]]'), waTitle: v('exams.ai_wa_title', ''), endTitle: v('exams.ai_end_title', ''), goalLine: v('exams.ai_goal_line', '') } };
}

// صفوف الطلاب المضغوطة من rpc_teacher_exams_v3 ← كائنات
export function decodeRows(d) {
  const nd = (d.nd || []).map(([note, g, c]) => ({ note, g, c }));
  const conf = new Set((d.conf || []).map(Number));
  return (d.rows || []).map(([sid, k, y, n, r, ni]) => ({ sid: Number(sid), k, y, n, res: RES[r] ?? 'ناجح', notes: (ni || []).map((i) => nd[i]).filter(Boolean), conf: conf.has(Number(sid)) }));
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
// شهر «أغلب نتائجه لم تُرصد» (الحد من الإعدادات): نسبته الرسمية تبقى ظاهرة، لكنه لا يدخل حكم السير ولا الحكم على الخطة حتى يُحسم التحقق
export const noresHeavy = (p, cfg) => N(p.t) > 0 && N(p.r) / N(p.t) >= cfg.noresShare;
// الحكم على سلسلة نسب (الأقدم أولاً): متوسط آخر k مقابل k قبلها
export function judge(series, n, thr) {
  const k = Math.min(n, Math.floor(series.length / 2));
  if (k < 1) return { label: null, diff: null, k: 0 };
  const last = mean(series.slice(-k)), prev = mean(series.slice(-2 * k, -k));
  const diff = last - prev;
  return { label: diff * 100 >= thr ? 'up' : diff * 100 <= -thr ? 'down' : 'flat', diff, last, prev, k };
}

// ===================== البناء الكامل للتبويب =====================
export function build(d) {
  const A = analyze(d);
  const cfg = settings2(d.set);
  const cal = d.cal || [];
  const rows = decodeRows(d).map((r) => ({ ...r, sk: sortKey(r, cal), key: `${r.k}|${r.y}|${r.n}` }));
  const has = A.has;
  const lastYear = A.lastYear;
  const inWin = (x) => cfg.window === 'كل الأرشيف' || x.y === lastYear;
  const winRows = rows.filter(inWin);
  const winLabel = A.winLabel;
  const pmap = new Map(A.periods.map((p) => [p.key, p]));
  const divMap = new Map((d.div || []).map((x) => [`${x.k}|${x.y}|${x.n}`, x]));
  const deptMap = new Map((d.dept?.periods || []).map((x) => [`${x.k}|${x.y}|${x.n}`, x]));
  const missKeys = new Set(A.missing.map((m) => m.key));

  // مقارنة الفصل/الشهر بالقسم (بقية القسم بدون المعلم إن طُلب، وبحد أدنى للعينة) ثم الشعبة
  const compare = (p) => {
    const dv = divMap.get(p.key); const divRate = dv ? passRate(dv, cfg) : null;
    let dep = deptMap.get(p.key); let deptRate = null; let deptWhy = null;
    if (dep) {
      if (cfg.excludeSelf) dep = { t: N(dep.t) - N(p.t), p: N(dep.p) - N(p.p), f: N(dep.f) - N(p.f), x: N(dep.x) - N(p.x), r: N(dep.r) - N(p.r) };
      if (candidates(dep, cfg) >= cfg.compareMin) deptRate = passRate(dep, cfg); else deptWhy = 'small';
    } else deptWhy = d.dept ? 'none' : 'nodept';
    const r = passRate(p, cfg);
    return { rate: r, divRate, deptRate, deptWhy, deptT: dep ? N(dep.t) : 0, vsDept: r != null && deptRate != null ? r - deptRate : null, vsDiv: r != null && divRate != null ? r - divRate : null };
  };

  // ---------- الطلاب (كل طالب مرة واحدة) ----------
  const byStudent = new Map();
  for (const r of rows) { if (!byStudent.has(r.sid)) byStudent.set(r.sid, []); byStudent.get(r.sid).push(r); }
  const repKey = (nt) => (cfg.repeatLevel === 'الملاحظة بعينها' ? nt.note : nt.g);
  const students = [];
  for (const [sid, all] of byStudent) {
    const items = all.slice().sort((a, b) => a.sk - b.sk || (a.k < b.k ? -1 : 1));
    const w = items.filter(inWin);
    if (!w.length) { students.push({ sid, items, inWin: false, reasons: [], score: 0, conf: items[0].conf }); continue; }
    const failedN = w.filter((x) => x.res === 'راسب').length, noresN = w.filter((x) => x.res === 'لم تُرصد').length;
    const seen = new Map(); w.forEach((x) => new Set(x.notes.map(repKey)).forEach((k) => seen.set(k, (seen.get(k) || 0) + 1)));
    const repeated = [...seen].filter(([, c]) => c >= cfg.repeatMin).map(([k, c]) => ({ k, c })).sort((a, b) => b.c - a.c);
    const last = w[w.length - 1]; const notesLast = last.notes.length;
    const reasons = [];
    if (cfg.fu.failed && failedN) reasons.push({ code: 'FAILED', n: failedN });
    if (cfg.fu.repeat && repeated.length) reasons.push({ code: 'REPEAT', n: repeated.length, keys: repeated });
    if (cfg.fu.noresMin > 0 && noresN >= cfg.fu.noresMin) reasons.push({ code: 'NORES', n: noresN });
    if (cfg.fu.notesLastMin > 0 && notesLast >= cfg.fu.notesLastMin) reasons.push({ code: 'NOTES', n: notesLast, at: last });
    const score = reasons.reduce((s, x) => s + (cfg.fu.w[x.code] || 0), 0);
    students.push({ sid, items, w, inWin: true, failedN, noresN, repeated, notesLast, last, reasons, score, conf: items[0].conf,
      tie: failedN * 100 + repeated.length * 10 + noresN, lastSk: last.sk });
  }
  const winStudents = students.filter((s) => s.inWin);
  const followup = winStudents.filter((s) => s.reasons.length).sort((a, b) => b.score - a.score || b.tie - a.tie || b.lastSk - a.lastSk || a.sid - b.sid);
  const reasonCount = { FAILED: 0, REPEAT: 0, NORES: 0, NOTES: 0 };
  followup.forEach((s) => s.reasons.forEach((r) => { reasonCount[r.code]++; }));
  const repeatedStudents = winStudents.filter((s) => s.repeated.length).length;

  // ---------- الأشهر التنشيطية: كل شهر من أول ترشيح إلى آخر شهر معروف، بثلاث حالات مختلفة ----------
  const heldM = new Set(cal.filter((c) => c.k === 'MONTHLY').map((c) => `${c.y}|${c.n}`));
  const myM = A.periods.filter((p) => p.k === 'MONTHLY');
  const monthsList = [];
  if (myM.length || A.missing.some((m) => m.k === 'MONTHLY')) {
    const sks = [...myM.map((p) => p.y * 100 + p.n), ...A.missing.filter((m) => m.k === 'MONTHLY').map((m) => m.y * 100 + m.n)];
    const start = Math.min(...sks);
    const end = Math.max(...sks, ...cal.filter((c) => c.k === 'MONTHLY').map((c) => c.y * 100 + c.n));
    for (let y = Math.floor(start / 100), m = start % 100; y * 100 + m <= end; m === 12 ? (y++, m = 1) : m++) {
      const key = `MONTHLY|${y}|${m}`; const p = pmap.get(key);
      if (p) {
        const c = compare(p); const st = rows.filter((r) => r.key === key);
        monthsList.push({ k: 'MONTHLY', y, n: m, key, state: noresHeavy(p, cfg) ? 'nores' : 'done', p, ...c, rows: st });
      } else if (missKeys.has(key)) monthsList.push({ k: 'MONTHLY', y, n: m, key, state: 'missing' });
      else monthsList.push({ k: 'MONTHLY', y, n: m, key, state: heldM.has(`${y}|${m}`) ? 'before' : 'none' });
    }
  }
  const months = monthsList.filter((x) => x.state !== 'before').reverse(); // الأحدث أولاً
  // ---------- الفصلية: كل فصل أُقيم منذ أول ترشيح، ومثله ----------
  const terms = [...A.periods.filter((p) => p.k === 'TERM').map((p) => ({ k: 'TERM', y: p.y, n: p.n, key: p.key, sk: p.sk, state: noresHeavy(p, cfg) ? 'nores' : 'done', p, ...compare(p), rows: rows.filter((r) => r.key === p.key) })),
    ...A.missing.filter((m) => m.k === 'TERM').map((m) => ({ k: 'TERM', y: m.y, n: m.n, key: m.key, sk: m.sk, state: 'missing' }))].sort((a, b) => b.sk - a.sk);

  // ---------- الملاحظات التجويدية حسب النوع وحسب الشهر ----------
  const winPeriods = A.periods.filter((p) => inWin(p)).slice().sort((a, b) => a.sk - b.sk);
  const testedIn = new Map(winPeriods.map((p) => [p.key, new Set(winRows.filter((r) => r.key === p.key).map((r) => r.sid))]));
  const typeMap = new Map();
  for (const r of winRows) for (const nt of r.notes) {
    if (!typeMap.has(nt.g)) typeMap.set(nt.g, { g: nt.g, students: new Set(), periods: new Map(), perStudent: new Map(), notes: new Map() });
    const T = typeMap.get(nt.g); T.students.add(r.sid);
    if (!T.periods.has(r.key)) T.periods.set(r.key, new Set()); T.periods.get(r.key).add(r.sid);
    if (!T.perStudent.has(r.sid)) T.perStudent.set(r.sid, new Set()); T.perStudent.get(r.sid).add(r.key);
    T.notes.set(nt.note, (T.notes.get(nt.note) || 0) + 1);
  }
  const noteTypes = [...typeMap.values()].map((T) => {
    const series = winPeriods.map((p) => { const t = testedIn.get(p.key)?.size || 0; return t ? (T.periods.get(p.key)?.size || 0) / t : 0; });
    const j = judge(series, cfg.trendN, cfg.notesTrendPts);
    const repeatedN = [...T.perStudent.values()].filter((s) => s.size >= cfg.repeatMin).length;
    return { g: T.g, students: T.students.size, sids: [...T.students], months: T.periods.size, repeated: repeatedN, trend: j,
      byPeriod: winPeriods.filter((p) => T.periods.has(p.key)).map((p) => ({ p, n: T.periods.get(p.key).size, t: testedIn.get(p.key)?.size || 0 })).reverse(),
      notes: [...T.notes].sort((a, b) => b[1] - a[1]) };
  }).sort((a, b) => b.students - a.students || b.repeated - a.repeated);

  // ---------- سير المعلم ----------
  // الشهر الذي لم تُرصد نتائج كل مرشحيه لا يدخل الحكم (قيد التحقق: غياب أم نتائج لم تُدخل) — وإلا حُسب 0٪
  const series = myM.filter((p) => !noresHeavy(p, cfg)).sort((a, b) => a.sk - b.sk).map((p) => ({ p, ...compare(p) }));
  const tj = judge(series.map((s) => s.rate ?? 0), cfg.trendN, cfg.trendPts);
  const trend = { series, ...tj, red: tj.label === 'down' && tj.diff * 100 <= -cfg.declinePoints,
    word: tj.label === 'up' ? 'متحسّن' : tj.label === 'down' ? (tj.diff * 100 <= -cfg.declinePoints ? 'متراجع' : 'متراجع قليلاً') : tj.label === 'flat' ? 'ثابت' : null };

  // ---------- الأرقام السنوية بوحداتها الصحيحة ----------
  const W = A.win; const winStudentsN = winStudents.length;
  const noresStudents = winStudents.filter((s) => s.noresN).length, failedStudents = winStudents.filter((s) => s.failedN).length;

  // ---------- القوة والضعف (قواعد من الإعدادات؛ بلا المؤشرات المخفية: معدلات الملاحظات لكل مختبَر، وقلة المرشحين) ----------
  const strengths = [], weaknesses = [];
  const wr = A.winRate; const lm = monthsList.filter((x) => x.state === 'done' || x.state === 'nores').slice(-1)[0] || null;
  const lmDone = monthsList.filter((x) => x.state === 'done').slice(-1)[0] || null; // آخر شهر رُصدت نتائجه
  const missWin = A.missing.filter(inWin);
  if (has) {
    if (wr != null && wr >= cfg.strengthPass) strengths.push({ code: 'PASS', text: `نجح ${pct(wr, cfg.digits)} من مرشحيه في ${winLabel}` });
    if (!A.missing.length) strengths.push({ code: 'FULL', text: 'رشّح في كل الاختبارات المقامة منذ أول ترشيح له' });
    if (W.t && W.r === 0) strengths.push({ code: 'NO_RESULT_ZERO', text: 'رُصدت نتائج جميع من رشّحهم' });
    if (lmDone?.vsDept != null && lmDone.vsDept * 100 >= cfg.trendPts) strengths.push({ code: 'ABOVE', text: `أعلى من متوسط القسم بـ ${arCount(pts(lmDone.vsDept), 'point', { one: false })} في ${pName(lmDone, true)}` });
    if (trend.label === 'up') strengths.push({ code: 'UP', text: 'نسبة نجاحه في تحسّن خلال الأشهر الأخيرة' });
    if (missWin.length >= cfg.missingMin) weaknesses.push({ code: 'MISSING', text: `لم يرشّح أحداً في ${pCount(missWin)}: ${pList(missWin, true)}` });
    if (W.t && W.r / W.t > cfg.noResultMax) weaknesses.push({ code: 'NO_RESULT', text: `لم تُرصد ${arCount(W.r, 'result')} من ${arCount(W.t, 'nomination')} (${pct(W.r / W.t, cfg.digits)})، تخص ${arCount(noresStudents, 'student')}` });
    const cand = candidates(W, cfg);
    if (cand && W.f / cand > cfg.failedMax) weaknesses.push({ code: 'FAILED', text: `رسب ${arCount(failedStudents, 'student')} (${pct(W.f / cand, cfg.digits)} من الترشيحات)` });
    if (repeatedStudents >= cfg.repeatStudentsMin) weaknesses.push({ code: 'REPEAT', text: `${arCount(repeatedStudents, 'student')} تكررت عندهم الملاحظة نفسها` });
    if (trend.red) weaknesses.push({ code: 'DECLINE', text: `نسبة النجاح متراجعة: متوسط آخر ${arCount(trend.k, 'month', { one: false })} ${pct(trend.last, cfg.digits)} بعد ${pct(trend.prev, cfg.digits)} قبلها` });
    if (lmDone?.vsDept != null && lmDone.vsDept * 100 <= -cfg.declinePoints) weaknesses.push({ code: 'BELOW', text: `أقل من متوسط القسم بـ ${arCount(pts(lmDone.vsDept), 'point', { one: false })} في ${pName(lmDone, true)}` });
  }

  const R = { A, cfg, d, has, rows, winRows, students, winStudents, followup, reasonCount, repeatedStudents, months, terms, noteTypes, trend, lastMonthly: lm, lastDone: lmDone,
    winLabel, lastYear, W, winStudentsN, noresStudents, failedStudents, strengths, weaknesses, missWin, compare };
  R.cards = cards(R); R.rec = recommendation(R);
  return R;
}

export const reasonLabel = { FAILED: 'الرسوب', REPEAT: 'تكرار الملاحظة نفسها', NORES: '«لم تُرصد» أكثر من مرة', NOTES: 'ملاحظات كثيرة في آخر اختبار' };
function cmpText(R, m, why = true) {
  const cfg = R.cfg;
  const one = (d, who) => { const p = pts(d); return p === 0 ? `مثل متوسط ${who}` : `${d > 0 ? 'أعلى' : 'أقل'} من متوسط ${who} بـ ${arCount(p, 'point', { one: false, gen: true })}`; };
  if (m.vsDept != null) return one(m.vsDept, cfg.excludeSelf ? 'بقية القسم' : 'القسم');
  if (m.vsDiv != null) return one(m.vsDiv, 'الشعبة') + (why && m.deptWhy === 'small' ? `، لأن ${cfg.excludeSelf ? 'بقية قسمه' : 'قسمه'} ${arCount(m.deptT, 'candidate', { one: false })} فقط في ذلك الشهر` : '');
  return 'ولا متوسط للمقارنة';
}
// بطاقات «الخلاصة» (3–4): جملة لكل بطاقة، ونبرة، وشرح «ما معنى هذا؟»
function cards(R) {
  const { cfg, A } = R; const T = cfg.cards; const out = [];
  if (!R.has) return out;
  const lm = R.lastMonthly;
  if (lm && lm.state === 'nores') {
    const ld = R.lastDone;
    out.push({ key: 'last', tone: 'flat', text: fillT(T.last_nores, { 'العدد': arCount(lm.p.t, 'student'), 'غير_المرصود': fmtN(lm.p.r), 'الشهر': pName(lm),
      'السابق': ld ? fillT(T.last_prev || '', { 'النسبة': pct(ld.rate, cfg.digits), 'الشهر': pName(ld, true) }) : '' }).replace(/\s+\./, '.'), help: cfg.help.last, go: 'monthly' });
  } else if (lm) {
    const dv = lm.vsDept ?? lm.vsDiv; const tone = dv != null ? (dv * 100 <= -cfg.declinePoints ? 'bad' : dv * 100 >= cfg.trendPts ? 'good' : 'flat') : 'flat';
    out.push({ key: 'last', tone, text: fillT(T.last, { 'النسبة': pct(lm.rate, cfg.digits), 'الشهر': pName(lm), 'المقارنة': cmpText(R, lm, false) }), help: cfg.help.last, go: 'monthly' });
  }
  const mp = A.monPart, tp = A.termPart;
  const monthsTxt = ofTotal(mp.n, mp.total, 'month'), termTxt = tp.total ? ofTotal(tp.n, tp.total, 'term') : 'ولا اختبار فصلي مسجل';
  out.push(A.missing.length
    ? { key: 'part', tone: R.missWin.length ? 'bad' : 'flat', text: fillT(T.part_missing, { 'الغياب': `${pCount(A.missing)}: ${pList(A.missing, true)}`, 'التنشيطي': monthsTxt, 'الفصلي': termTxt }), help: cfg.help.part, go: A.missing.some((m) => m.k === 'MONTHLY') ? 'monthly' : 'term' }
    : { key: 'part', tone: 'good', text: fillT(T.part_full, { 'التنشيطي': monthsTxt, 'الفصلي': termTxt }), help: cfg.help.part, go: 'monthly' });
  const top = Object.entries(R.reasonCount).filter(([, n]) => n).sort((a, b) => b[1] - a[1])[0];
  out.push(R.followup.length
    ? { key: 'followup', tone: R.followup.length / Math.max(1, R.winStudentsN) > 0.5 ? 'bad' : 'flat', text: fillT(T.followup, { 'العدد': arCount(R.followup.length, 'student'), 'الطلاب': arCount(R.winStudentsN, 'student', { gen: true }), 'النطاق': R.winLabel, 'السبب': top ? `${reasonLabel[top[0]]} (${arCount(top[1], 'student')})` : '' }), help: cfg.help.followup, go: 'followup' }
    : { key: 'followup', tone: 'good', text: fillT(T.followup_none, { 'الطلاب': arCount(R.winStudentsN, 'student', { gen: true }), 'النطاق': R.winLabel }), help: cfg.help.followup, go: 'followup' });
  const tr = R.trend;
  out.push(tr.word
    ? { key: 'trend', tone: tr.label === 'up' ? 'good' : tr.red ? 'bad' : 'flat', text: fillT(T.trend, { 'الحكم': tr.word, 'التفصيل': `متوسط آخر ${arCount(tr.k, 'month', { one: false })} ${pct(tr.last, cfg.digits)} مقابل ${pct(tr.prev, cfg.digits)} قبلها` }), help: cfg.help.trend, go: 'trend' }
    : { key: 'trend', tone: 'flat', text: fillT(T.trend_none, { 'العدد': arCount(tr.series.length, 'month') }), help: cfg.help.trend, go: 'trend' });
  return out;
}
// جملة التوصية: أول حالة تنطبق بترتيب الإعداد
function recommendation(R) {
  const { cfg, A } = R; const lm = R.lastMonthly;
  const C = {
    missing: () => R.missWin.length && { 'الأشهر': pList(R.missWin.slice(0, 3), true) },
    decline: () => R.trend.red && lm && { 'الشهر': pName(lm, true) },
    nores: () => lm?.p && N(lm.p.t) && N(lm.p.r) / N(lm.p.t) > cfg.noResultMax && { 'العدد': arCount(lm.p.r, 'student', { gen: true }), 'الشهر': pName(lm, true) },
    repeat: () => { const t = R.noteTypes.slice().sort((a, b) => b.repeated - a.repeated)[0]; return t && t.repeated >= cfg.repeatStudentsMin && { 'النوع': t.g, 'العدد': arCount(t.repeated, 'student') }; },
    failed: () => { const c = candidates(R.W, cfg); return c && R.W.f / c > cfg.failedMax && { 'العدد': arCount(R.failedStudents, 'student'), 'النطاق': R.winLabel }; },
    good: () => ({}),
  };
  if (!R.has) return null;
  for (const k of cfg.recOrder) { const v = C[k]?.(); if (v) return fillT(cfg.rec[k], v); }
  return null;
}

// ===================== حالة الخطة التلقائية =====================
const hijriYM = (date) => {
  try { const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric' }).formatToParts(new Date(date));
    const y = Number(parts.find((x) => x.type === 'year')?.value?.replace(/\D/g, '')), m = Number(parts.find((x) => x.type === 'month')?.value);
    return y && m ? y * 100 + m : null; } catch { return null; }
};
// «بانتظار الاختبار القادم» حتى يُرصد أول اختبار بعد تاريخ الخطة (من النوع في الإعداد)، ثم «تحقق» أو «لم يتحقق» بالرقم الفعلي مقابل الهدف
export function planStatus(plan, R) {
  if (plan.status === 'ملغاة') return { code: 'cancelled', label: 'ملغاة' };
  const goal = plan.goal ?? plan.baseline?.goal_pct ?? null;
  if (goal == null || goal === '') return { code: 'nogoal', label: 'بلا هدف رقمي' };
  const kind = (plan.goal_kind || plan.baseline?.goal_kind || R.cfg.goalKind) === 'أي اختبار' ? null : 'MONTHLY';
  const from = Math.max(hijriYM(plan.at) || 0, N(plan.baseline?.sk) + 1);
  // اختبار لم تُرصد نتائج كل مرشحيه لا يُحكم به (يبقى «بانتظار»)
  const next = R.A.periods.filter((p) => (!kind || p.k === kind) && p.sk >= from && !noresHeavy(p, R.cfg)).sort((a, b) => a.sk - b.sk)[0];
  if (!next) return { code: 'pending', label: 'بانتظار الاختبار القادم', goal: Number(goal) };
  const actual = passRate(next, R.cfg);
  const ok = actual != null && actual * 100 + 1e-9 >= Number(goal);
  return { code: ok ? 'met' : 'unmet', label: ok ? 'تحقق' : 'لم يتحقق', goal: Number(goal), actual, period: next,
    text: `الفعلي ${pct(actual, R.cfg.digits)} مقابل الهدف ${fmtN(goal)}٪ (${pName(next)})` };
}

// ===================== أمر الذكاء الاصطناعي =====================
export const marker = (cfg, title) => fillT(cfg.ai.marker, { 'العنوان': title });
const nextMonth = (R) => { const all = [...R.A.periods, ...(R.d.cal || [])].filter((p) => p.k === 'MONTHLY').map((p) => p.y * 100 + p.n);
  const now = hijriYM(new Date()); if (!all.length && !now) return null; const mx = Math.max(...all, now ? now - 1 : 0); let y = Math.floor(mx / 100), m = mx % 100 + 1; if (m > 12) { m = 1; y++; } return { y, n: m, k: 'MONTHLY' }; };
const sanitizeLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export function examsData(R) {
  const { cfg, A } = R; const L2 = [];
  L2.push(`- نطاق التحليل: ${R.winLabel}: ${arCount(R.W.t, 'nomination')} لـ ${arCount(R.winStudentsN, 'student')} مختلفين؛ نجح منها ${fmtN(R.W.p)}، ورسب ${fmtN(R.W.f)}، ولم تُرصد ${fmtN(R.W.r)}${R.W.x ? `، واستُبعد ${fmtN(R.W.x)}` : ''}. نسبة النجاح ${pct(A.winRate, 1)} (الناجحون ÷ جميع المرشحين).`);
  L2.push(`- سير المعلم: ${R.trend.word || 'لا يكفي للحكم'}${R.trend.word ? ` (متوسط آخر ${arCount(R.trend.k, 'month', { one: false })} ${pct(R.trend.last, 1)} مقابل ${pct(R.trend.prev, 1)} قبلها)` : ''}.`);
  L2.push('- الاختبارات التنشيطية (الأحدث أولاً):');
  for (const m of R.months.slice(0, 12)) {
    if (m.state === 'none') L2.push(`  • ${pName(m)}: لم يُقم اختبار على مستوى الشعبة.`);
    else if (m.state === 'missing') L2.push(`  • ${pName(m)}: أُقيم الاختبار ولم يرشّح المعلم أحداً.`);
    else L2.push(`  • ${pName(m)}: ${arCount(m.p.t, 'candidate')}، نجح ${fmtN(m.p.p)}، رسب ${fmtN(m.p.f)}، لم تُرصد ${fmtN(m.p.r)} ← ${pct(m.rate, 1)}؛ ${m.deptRate != null ? `بقية القسم ${pct(m.deptRate, 1)}، ` : ''}الشعبة ${pct(m.divRate, 1)}.`);
  }
  L2.push('- الاختبارات الفصلية:');
  if (!R.terms.length) L2.push('  • لا اختبارات فصلية مسجلة.');
  for (const t of R.terms) L2.push(t.state === 'missing' ? `  • ${pName(t)}: أُقيم ولم يرشّح أحداً.` : `  • ${pName(t)}: ${arCount(t.p.t, 'candidate')}، نجح ${fmtN(t.p.p)}، رسب ${fmtN(t.p.f)}، لم تُرصد ${fmtN(t.p.r)} ← ${pct(t.rate, 1)}؛ الشعبة ${pct(t.divRate, 1)}.`);
  L2.push(`- الملاحظات التجويدية في ${R.winLabel} (المصدر يذكر النوع فقط):`);
  if (!R.noteTypes.length) L2.push('  • لا ملاحظات.');
  const tw = { up: 'يزيد', down: 'ينقص', flat: 'ثابت' };
  for (const t of R.noteTypes.slice(0, 10)) L2.push(`  • ${t.g}: ${arCount(t.students, 'student')}، ظهرت في ${arCount(t.months, 'month', { gen: true })}، وتكررت عند ${arCount(t.repeated, 'student', { gen: true })}، والاتجاه ${tw[t.trend.label] || 'لا يكفي للحكم'}.`);
  L2.push(`- الطلاب الذين يحتاجون متابعة: ${arCount(R.followup.length, 'student')} من ${arCount(R.winStudentsN, 'student', { gen: true })} (كل طالب مرة واحدة). حسب السبب: ${Object.entries(R.reasonCount).map(([k, n]) => `${reasonLabel[k]} ${fmtN(n)}`).join('، ')}.`);
  if (R.missWin.length) L2.push(`- أشهر لم يرشّح فيها أحداً: ${pList(R.missWin)}.`);
  return L2.join('\n');
}
export function visitsData(ctx) {
  if (!ctx || !ctx.visits_ok) return '- لا تتوفر بيانات زيارات لهذا المعلم.';
  const L2 = [];
  for (const s of ctx.summary || []) L2.push(`- التقييم العام (${sanitizeLine(s.period)}): ${s.pct != null ? pct(Number(s.pct), 0) : '—'}، التصنيف «${sanitizeLine(s.classification || 'لم يُقيَّم')}»، من ${arCount(s.visits, 'visit', { gen: true })}. المحاور: ${(s.axes || []).map((a) => `${sanitizeLine(a.name)} ${pct(Number(a.pct), 0)}`).join('، ')}.${(s.weakest || []).length ? ` أضعف البنود: ${s.weakest.map(sanitizeLine).join('، ')}.` : ''}`);
  if ((ctx.items || []).length) {
    L2.push('- البنود (عدد مرات تقييمها، ومرات أضعف مستوى، وآخر مستوى):');
    for (const i of ctx.items.slice(0, 30)) L2.push(`  • ${sanitizeLine(i.name)} (${sanitizeLine(i.axis)}): ${fmtN(i.n)}، الأضعف ${fmtN(i.weak)}، الأخير «${sanitizeLine(i.last)}»${i.reason ? `؛ سبب: ${sanitizeLine(i.reason)}` : ''}`);
  }
  if ((ctx.visits || []).length) {
    L2.push('- آخر الزيارات وملاحظاتها:');
    for (const v of ctx.visits) {
      const t = [['ملاحظات', v.notes], ['نقاط القوة', v.strengths], ['ما يحتاج تحسين', v.improvements], ['ملاحظة عامة', v.public], ['ملاحظة الاختبار', v.test]].filter(([, x]) => x).map(([k, x]) => `${k}: ${sanitizeLine(x)}`).join('؛ ');
      L2.push(`  • ${sanitizeLine(v.date)}${v.type ? ` (${sanitizeLine(v.type)})` : ''}: ${v.pct != null ? pct(Number(v.pct), 0) : '—'}، «${sanitizeLine(v.classification || '')}»${(v.low || []).length ? `؛ الأضعف: ${v.low.map(sanitizeLine).join('، ')}` : ''}${t ? `؛ ${t}` : ''}`);
    }
  }
  return L2.join('\n') || '- لا تتوفر بيانات زيارات لهذا المعلم.';
}
export function buildPrompt(R, ctx) {
  const cfg = R.cfg; const nm = nextMonth(R);
  return fillT(cfg.ai.template, {
    'بيانات_التقييم': visitsData(ctx), 'بيانات_الاختبارات': examsData(R),
    'الاختبار_القادم': nm ? `الاختبار التنشيطي القادم (المتوقع في ${pName(nm, true)})` : 'الاختبار القادم',
    'الأقسام': cfg.ai.sections.map((s) => marker(cfg, s)).join('\n'), 'سطر_الهدف': fillT(cfg.ai.goalLine, { 'النسبة': '…' }),
    'عنوان_واتساب': marker(cfg, cfg.ai.waTitle), 'علامة_النهاية': marker(cfg, cfg.ai.endTitle), 'حد_واتساب': fmtN(cfg.waMax) }).trim();
}
// فحص التسرّب قبل النسخ: أي رقم تسجيل أو رقم طويل أو اسم (المعلم أو الطلاب أو غيرهم) يوقف النسخ
const normAr = (s) => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u0652\u0640]/g, '').replace(/عبد\s+/g, 'عبد').replace(/\s+/g, ' ');
export function nameForms(full, single = true) {
  const a = normAr(full).trim().split(' ').filter(Boolean); const out = new Set();
  if (!a.length) return [];
  out.add(a.join(' ')); if (a.length >= 2) out.add(a.slice(0, 2).join(' ')); if (a.length >= 3) out.add(a.slice(0, 3).join(' '));
  // الاسم الأول وحده يُفحص فقط إذا كان مركباً مميزاً («عبدالرحمن»)؛ غيره قد يطابق كلمة عادية («صالح»، «حسن») والقاعدة نقّته أصلاً
  if (single && a[0].length >= 6 && a[0].startsWith('عبد')) out.add(a[0]);
  return [...out].filter((x) => x.length >= 3);
}
export function aiLeaks(text, { teacher = '', students = [], others = [] } = {}) {
  const found = [];
  if (/[Ss][0-9٠-٩]{7}/.test(text)) found.push('رقم تسجيل');
  if (/[0-9٠-٩]{6,}/.test(text)) found.push('رقم طويل');
  const T = ' ' + normAr(text).replace(/[^\u0600-\u06FF ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const hit = (forms) => forms.some((f) => T.includes(' ' + f + ' ') || T.includes(' و' + f + ' ') || T.includes(' ل' + f + ' '));
  if (teacher && hit(nameForms(teacher, true))) found.push('اسم المعلم');
  if (students.some((s) => hit(nameForms(s, false)))) found.push('اسم طالب');
  if (others.some((s) => hit(nameForms(s, true)))) found.push('اسم شخص');
  return found;
}

// ===================== فحص رد الذكاء الاصطناعي =====================
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toLatin = (s) => String(s).replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[٫,]/g, '.');
export function parsePlan(raw, cfg) {
  const text = String(raw || '').replace(/\r/g, '').replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '');
  const [pre, post] = String(cfg.ai.marker).split('{العنوان}');
  const re = new RegExp(`${esc(pre.trim())}\\s*([^\\n]+?)\\s*${esc((post || '').trim())}`, 'g');
  const marks = []; let m; while ((m = re.exec(text))) marks.push({ title: m[1].trim(), at: m.index, end: re.lastIndex });
  const blocks = marks.map((x, i) => ({ ...x, body: text.slice(x.end, marks[i + 1]?.at ?? text.length).trim() }));
  const num = (t) => { const mm = toLatin(t).match(/القسم\s*(\d+)/); return mm ? Number(mm[1]) : null; };
  const sections = blocks.filter((b) => num(b.title) != null).map((b) => ({ n: num(b.title), title: b.title, body: b.body }));
  const want = cfg.ai.sections.map((s) => num(s)).filter((x) => x != null);
  const missing = want.filter((n) => !sections.some((s) => s.n === n && s.body.length > 0));
  const waB = blocks.find((b) => normAr(b.title).includes(normAr(cfg.ai.waTitle)));
  const hasEnd = blocks.some((b) => normAr(b.title).includes(normAr(cfg.ai.endTitle)));
  const wa = waB ? waB.body.trim() : '';
  const [g1, g2] = String(cfg.ai.goalLine).split('{النسبة}');
  const flex = (s) => esc(s.trim()).replace(/\s+/g, '\\s*').replace(/≥/g, '(?:≥|>=|=>|≧|أكبر من أو يساوي)');
  const gre = new RegExp(`${flex(g1)}\\s*([0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?)\\s*${flex(g2 || '') || ''}`);
  const gm = text.match(gre) || toLatin(text).match(new RegExp(`${flex(toLatin(g1))}\\s*([0-9]+(?:\\.[0-9]+)?)`));
  const goal = gm ? Number(toLatin(gm[1])) : null;
  const issues = [];
  if (!marks.length) issues.push('لم تُوجد العلامات الفاصلة: تأكد أنك نسخت الرد كاملاً');
  if (missing.length) issues.push(`أقسام ناقصة: ${missing.map((n) => fmtN(n)).join('، ')}`);
  if (goal == null || !(goal >= 0 && goal <= 100)) issues.push('سطر «الهدف الرقمي» غير موجود أو بلا نسبة صحيحة');
  if (!wa) issues.push('نسخة الواتساب غير موجودة');
  else if (wa.length > cfg.waMax) issues.push(`نسخة الواتساب ${fmtN(wa.length)} حرفاً، والحد ${fmtN(cfg.waMax)}`);
  return { sections: sections.sort((a, b) => a.n - b.n), missing, goal: goal != null && goal >= 0 && goal <= 100 ? goal : null, wa, waLen: wa.length, waOk: !!wa && wa.length <= cfg.waMax, hasEnd, issues,
    ok: issues.length === 0, canSave: goal != null && goal >= 0 && goal <= 100 && sections.length > 0, text: text.trim() };
}

// ===================== التقرير المفصل (نص بعناوين، بلا أسماء طلاب) =====================
export function report(R, { teacher = '', today = '' } = {}) {
  const { cfg } = R; const L2 = [];
  const h1 = (t) => { L2.push('', `■ ${t}`); };
  L2.push(`تقرير اختبارات المعلم${teacher ? `: ${teacher}` : ''}`, `${today ? today + ' • ' : ''}نطاق التحليل: ${R.winLabel}`);
  h1('الخلاصة'); R.cards.forEach((c) => L2.push(`• ${c.text}`)); if (R.rec) L2.push(`• التوصية: ${R.rec}`);
  h1('الاختبارات التنشيطية شهراً شهراً');
  if (!R.months.length) L2.push(`• ${cfg.ui.empty_monthly || ''}`);
  for (const m of R.months) {
    if (m.state === 'none') L2.push(`• ${pName(m)}: ${cfg.ui.month_none || ''}`);
    else if (m.state === 'missing') L2.push(`• ${pName(m)}: ${cfg.ui.month_missing || ''}`);
    else L2.push(`• ${pName(m)}: ${arCount(m.p.t, 'candidate')}، نجح ${fmtN(m.p.p)}، رسب ${fmtN(m.p.f)}، لم تُرصد ${fmtN(m.p.r)} ← ${pct(m.rate, cfg.digits)} (${cmpText(R, m)})`);
  }
  h1('الاختبارات الفصلية');
  if (!R.terms.length) L2.push(`• ${cfg.ui.empty_term || ''}`);
  for (const t of R.terms) L2.push(t.state === 'missing' ? `• ${pName(t)}: ${cfg.ui.month_missing || ''}` : `• ${pName(t)}: ${arCount(t.p.t, 'candidate')}، نجح ${fmtN(t.p.p)}، رسب ${fmtN(t.p.f)}، لم تُرصد ${fmtN(t.p.r)} ← ${pct(t.rate, cfg.digits)} (${cmpText(R, t)})`);
  h1('الملاحظات التجويدية');
  if (!R.noteTypes.length) L2.push(`• ${cfg.ui.empty_notes || ''}`);
  const tw = { up: 'يزيد', down: 'ينقص', flat: 'ثابت' };
  for (const t of R.noteTypes) L2.push(`• ${t.g}: ${arCount(t.students, 'student')}، في ${arCount(t.months, 'month', { gen: true })}، تكررت عند ${arCount(t.repeated, 'student', { gen: true })}، الاتجاه: ${tw[t.trend.label] || '—'}`);
  h1('الطلاب الذين يحتاجون متابعة');
  L2.push(`• ${arCount(R.followup.length, 'student')} من ${arCount(R.winStudentsN, 'student', { gen: true })} (كل طالب مرة واحدة).`);
  Object.entries(R.reasonCount).filter(([, n]) => n).forEach(([k, n]) => L2.push(`• ${reasonLabel[k]}: ${arCount(n, 'student')}`));
  h1('أشهر عدم الترشيح');
  L2.push(R.A.missing.length ? `• ${pCount(R.A.missing, false)}: ${pList(R.A.missing)}` : '• لا يوجد: رشّح في كل ما أُقيم منذ أول ترشيح له.');
  h1('نقاط القوة'); (R.strengths.length ? R.strengths : [{ text: '—' }]).forEach((s) => L2.push(`• ${s.text}`));
  h1('نقاط الضعف'); (R.weaknesses.length ? R.weaknesses : [{ text: '—' }]).forEach((s) => L2.push(`• ${s.text}`));
  h1('التوصية'); L2.push(`• ${R.rec || '—'}`);
  if (cfg.ui.report_note) L2.push('', cfg.ui.report_note);
  return L2.join('\n').trim();
}
