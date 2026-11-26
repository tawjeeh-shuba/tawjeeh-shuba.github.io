// صفحة «التصدير» (قراءة فقط): يختار المستخدم ما يريد فيُنزَّل ملف إكسل بعناوين عربية ومن اليمين إلى اليسار، واسمه بالعربية مع التاريخ.
// كل البيانات تُقرأ بصلاحيات المستخدم نفسه في القاعدة (RLS): لا يصدّر أحد إلا ما يحق له رؤيته، والقطاع النسائي مخفي بإعداده،
// والدرجة لا تظهر إلا بإعداد «إظهار الدرجة في التصدير». وكل عملية تصدير تُسجَّل (من، وماذا، والفلاتر، والوقت).
// للإضافة لاحقاً (مصادر البيانات): عنصر جديد في DATASETS أو REPORTS فقط، دون إعادة بناء.
// المرحلة 11: «الخطط» (زيارات الخطط وسجل اعتمادها) تظهر حين تكون الخطط مشغّلة للمستخدم.
import { S, h, get, rpc, can, depName, perName, hijri, today, selectOf, field, badge, toast, fail, icon, nf, debounce, toLatinDigits } from './core.js';
import { panelMode } from './panel_ui.js';
import { workbook, download } from './xlsx.js';
import { colLabel, tableLabel } from './col_ar.js';
import * as XL from './exams_logic.js';
import { planAccess } from './plans_api.js';

const E = encodeURIComponent;
const SAVED = 'محفوظة';
let OPT = null;
let PLANS_ON = false;
const ROLE_AR = { division_head: 'مسؤول الشعبة', division_assistant: 'مساعد إدارة الشعبة', dept_head: 'مسؤول قسم', supervisor: 'موجه', supervisor_assistant: 'مساعد موجه', mentor: 'مرشد', teacher: 'معلم' };
const hd = (d) => (d ? hijri(d) : '');
const dtTime = (x) => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(x)); } catch { return x; } };

// قراءة كل الصفحات حتى الحد (أو بلا حد للتصدير الكامل)
async function pages(path, max, size = 1000) {
  const out = [];
  for (let off = 0; max == null || out.length < max; off += size) {
    const n = max == null ? size : Math.min(size, max - out.length);
    const r = await get(`${path}${path.includes('?') ? '&' : '?'}limit=${n}&offset=${off}`);
    out.push(...r); if (r.length < n) break;
  }
  return out;
}
async function people(role, f, max) {
  const out = [];
  for (let off = 0; out.length < max; off += 200) {
    const d = await rpc('rpc_people_list', { p: { role, period: f.per || '', department: f.dep || '', offset: off, limit: 200 } });
    out.push(...d.rows); if (out.length >= d.total || !d.rows.length) break;
  }
  return out.slice(0, max);
}
const asgText = (p, role) => (p.asg || []).filter((a) => !a.valid_to && (!role || a.role_code === role))
  .map((a) => `${ROLE_AR[a.role_code] || a.role_code}${a.department_code ? ' — ' + depName(a.department_code) : ''}${a.period_code ? ' — ' + perName(a.period_code) : ''}`).join('؛ ');
const personCols = (role) => [
  { key: 'code', label: 'الرقم', width: 10 }, { key: 'name', label: 'الاسم', width: 34 }, { key: 'sector', label: 'القطاع' }, { key: 'active', label: 'نشط' },
  { key: 'nat', label: 'الجنسية', width: 14 }, { key: 'mob', label: 'الجوال', width: 14 },
  role === 'teacher' ? { key: 'halaqat', label: 'حلقاته الحالية', width: 50 } : { key: 'asg', label: 'التكليفات السارية', width: 50 }];
const personRow = (role) => (p) => ({ code: p.display_code, name: p.full_name, sector: p.sector || '', active: p.is_active !== false, nat: p.nat?.nationality || '', mob: p.mob?.mobile || '',
  halaqat: (p.teaching || []).map((t) => `${t.halaqa} (${depName(t.department) || 'بلا قسم'} — ${perName(t.period) || 'بلا فترة'}${t.type === 'بديل' ? '، بديل' : ''})`).join('؛ '),
  asg: asgText(p, role) });

const VISIT_SEL = 'id,visit_date,halaqa_number,department_code,period_code,visit_type_code,classification,score_pct,is_official,source,duration_minutes,strengths,improvements,public_notes,next_visit_date,'
  + 'teacher:persons!visits_teacher_id_fkey(full_name,display_code),sup:persons!visits_supervisor_id_fkey(id,full_name)';
let VT = null;
const vtName = async () => { VT ||= Object.fromEntries((await get('visit_types?select=code,name&order=config_version_id.desc')).reverse().map((t) => [t.code, t.name])); return VT; };
async function visits(f, max) {
  const vt = await vtName();
  const q = [`status=eq.${E(SAVED)}`, f.dep && `department_code=eq.${E(f.dep)}`, f.per && `period_code=eq.${E(f.per)}`, f.sup && `supervisor_id=eq.${E(f.sup)}`,
    f.teacher && `teacher_id=eq.${E(f.teacher)}`, f.from && `visit_date=gte.${f.from}`, f.to && `visit_date=lte.${f.to}`].filter(Boolean).join('&');
  const rows = await pages(`visits?select=${VISIT_SEL}&${q}&order=visit_date.desc,created_at.desc`, max);
  return rows.map((v) => ({ ...v, date_h: hd(v.visit_date), date_g: v.visit_date, teacher_name: v.teacher?.full_name || '', teacher_code: v.teacher?.display_code || '',
    sup_name: v.sup?.full_name || '', dep: depName(v.department_code), per: perName(v.period_code), type: vt[v.visit_type_code] || '',
    score: OPT.show_score && v.score_pct != null ? Math.round(v.score_pct * 1000) / 10 : null, next_h: hd(v.next_visit_date), src: v.source === 'التطبيق' ? 'جديدة' : 'أرشيف' }));
}
const visitCols = () => [
  { key: 'date_h', label: 'التاريخ (هجري)', width: 18 }, { key: 'date_g', label: 'التاريخ (ميلادي)', width: 13 }, { key: 'teacher_code', label: 'رقم المعلم', width: 10 },
  { key: 'teacher_name', label: 'المعلم', width: 30 }, { key: 'halaqa_number', label: 'الحلقة', width: 10 }, { key: 'dep', label: 'القسم', width: 24 }, { key: 'per', label: 'الفترة' },
  { key: 'sup_name', label: 'الموجه', width: 28 }, { key: 'type', label: 'نوع الزيارة', width: 14 }, { key: 'classification', label: 'التقدير', width: 14 },
  ...(OPT.show_score ? [{ key: 'score', label: 'الدرجة (٪)' }] : []), { key: 'is_official', label: 'رسمية' }, { key: 'duration_minutes', label: 'المدة (دقيقة)' },
  { key: 'strengths', label: 'نقاط القوة', width: 40 }, { key: 'improvements', label: 'للتحسين', width: 40 }, { key: 'public_notes', label: 'ملاحظات عامة', width: 40 },
  { key: 'next_h', label: 'الزيارة القادمة', width: 18 }, { key: 'src', label: 'المصدر' }];

// ---------- الخطط (المرحلة 11) ----------
const PLAN_SEL = 'planned_date,planned_time,halaqa_number,period_code,visit_type_code,status,out_of_plan,over_max_confirmed,cancel_reason,change_note,visit_id,postponed_to,postponed_from,'
  + 'plan:plans!inner(month_key,status,supervisor_id,sup:persons!plans_supervisor_id_fkey(full_name)),teacher:persons!plan_items_teacher_id_fkey(full_name,display_code),h:halaqat!inner(department_code)';
async function planItems(f, max) {
  const vt = await vtName();
  const q = [f.dep && `h.department_code=eq.${E(f.dep)}`, f.per && `period_code=eq.${E(f.per)}`, f.sup && `plan.supervisor_id=eq.${E(f.sup)}`,
    f.from && `planned_date=gte.${f.from}`, f.to && `planned_date=lte.${f.to}`].filter(Boolean).join('&');
  const rows = await pages(`plan_items?select=${PLAN_SEL}${q ? '&' + q : ''}&order=planned_date.desc,created_at.desc`, max);
  return rows.map((r) => ({ month: r.plan?.month_key, plan_status: r.plan?.status, sup: r.plan?.sup?.full_name || '', date_h: hd(r.planned_date), date_g: r.planned_date,
    time: r.planned_time ? String(r.planned_time).slice(0, 5) : '', teacher_code: r.teacher?.display_code || '', teacher: r.teacher?.full_name || '', halaqa: r.halaqa_number,
    dep: depName(r.h?.department_code), per: perName(r.period_code), type: vt[r.visit_type_code] || '', status: r.status, out: r.out_of_plan, over: r.over_max_confirmed,
    done: !!r.visit_id, moved: r.postponed_to ? 'أُجّلت إلى الشهر التالي' : r.postponed_from ? 'مؤجلة من الشهر السابق' : '', reason: r.cancel_reason || '', note: r.change_note || '' }));
}
const planItemCols = [{ key: 'month', label: 'الشهر', width: 10 }, { key: 'plan_status', label: 'حالة الخطة', width: 22 }, { key: 'sup', label: 'الموجه', width: 28 },
  { key: 'date_h', label: 'اليوم (هجري)', width: 18 }, { key: 'date_g', label: 'ميلادي', width: 12 }, { key: 'time', label: 'الوقت' }, { key: 'teacher_code', label: 'رقم المعلم', width: 10 },
  { key: 'teacher', label: 'المعلم', width: 30 }, { key: 'halaqa', label: 'الحلقة' }, { key: 'dep', label: 'القسم', width: 24 }, { key: 'per', label: 'الفترة' }, { key: 'type', label: 'نوع الزيارة', width: 14 },
  { key: 'status', label: 'حالة الزيارة' }, { key: 'done', label: 'نُفّذت بزيارة' }, { key: 'out', label: 'خارج الخطة' }, { key: 'over', label: 'فوق الحد الأقصى بتأكيد' },
  { key: 'moved', label: 'التأجيل', width: 22 }, { key: 'reason', label: 'سبب الإلغاء أو التأجيل', width: 30 }, { key: 'note', label: 'سبب التعديل', width: 30 }];
async function planHeads(f, max) {
  const q = [f.sup && `supervisor_id=eq.${E(f.sup)}`].filter(Boolean).join('&');
  const rows = await pages(`plans?select=month_key,status,planned_count,approval_stages,submitted_at,reviewed_at,review_note,decided_at,decision_note,skip_review_reason,bulk_batch_id,`
    + `sup:persons!plans_supervisor_id_fkey(full_name),rev:persons!plans_reviewed_by_fkey(full_name),dec:persons!plans_decided_by_fkey(full_name)${q ? '&' + q : ''}&order=month_key.desc`, max);
  return rows.map((p) => ({ month: p.month_key, sup: p.sup?.full_name || '', status: p.status, n: p.planned_count, stages: p.approval_stages || '', sub: p.submitted_at ? dtTime(p.submitted_at) : '',
    rev: p.rev?.full_name || '', rev_at: p.reviewed_at ? dtTime(p.reviewed_at) : '', dec: p.dec?.full_name || '', dec_at: p.decided_at ? dtTime(p.decided_at) : '',
    note: p.decision_note || p.review_note || '', skip: p.skip_review_reason || '', bulk: p.bulk_batch_id ? 'نعم' : '' }));
}
const planHeadCols = [{ key: 'month', label: 'الشهر', width: 10 }, { key: 'sup', label: 'الموجه', width: 28 }, { key: 'status', label: 'الحالة', width: 22 }, { key: 'n', label: 'الزيارات المخططة' },
  { key: 'stages', label: 'مراحل الاعتماد' }, { key: 'sub', label: 'أُرسلت', width: 22 }, { key: 'rev', label: 'راجعها', width: 26 }, { key: 'rev_at', label: 'وقت المراجعة', width: 22 },
  { key: 'dec', label: 'القرار من', width: 26 }, { key: 'dec_at', label: 'وقت القرار', width: 22 }, { key: 'note', label: 'ملاحظة القرار', width: 34 },
  { key: 'skip', label: 'سبب الاعتماد دون مراجعة', width: 34 }, { key: 'bulk', label: 'اعتماد جماعي' }];

async function notes(f, max) {
  const q = ['is_hidden=eq.false', f.teacher && `teacher_id=eq.${E(f.teacher)}`, f.from && `created_at=gte.${f.from}`, f.to && `created_at=lt.${f.to}T23:59:59`].filter(Boolean).join('&');
  const rows = await pages(`teacher_notes?select=category,body,created_at,visit_id,teacher:persons!teacher_notes_teacher_id_fkey(full_name,display_code),author:persons!teacher_notes_author_id_fkey(full_name)&${q}&order=created_at.desc`, max);
  return rows.map((n) => ({ at: dtTime(n.created_at), teacher_code: n.teacher?.display_code || '', teacher: n.teacher?.full_name || '', cat: n.category, body: n.body, author: n.author?.full_name || '', linked: !!n.visit_id }));
}
const noteCols = [{ key: 'at', label: 'الوقت', width: 22 }, { key: 'teacher_code', label: 'رقم المعلم', width: 10 }, { key: 'teacher', label: 'المعلم', width: 30 },
  { key: 'cat', label: 'التصنيف', width: 14 }, { key: 'body', label: 'الملاحظة', width: 60 }, { key: 'author', label: 'كتبها', width: 26 }, { key: 'linked', label: 'مرتبطة بزيارة' }];

const ACT = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' };
async function auditLog(f, max) {
  const out = [];
  for (let off = 0; out.length < max; off += 100) {
    const d = await rpc('rpc_unified_log', { p: { from: f.from || '', to: f.to || '', offset: off, limit: 100 } });
    out.push(...d.rows); if (d.rows.length < 100) break;
  }
  return out.slice(0, max).map((r) => ({ at: dtTime(r.at), who: r.actor || r.label || 'النظام', kind: r.src === 'c' ? 'حفظ في لوحة التحكم' : ACT[r.action] || r.action,
    what: r.src === 'c' ? `${r.screen_name || ''}: ${r.subject || ''}` : `${r.table}${r.record ? ' — ' + r.record : ''}`, reason: r.reason || '',
    fields: (r.fields || []).map((x) => x.field ? `${x.field}: ${x.old ?? '—'} ← ${x.new ?? '—'}` : '').filter(Boolean).join('؛ ') }));
}
const logCols = [{ key: 'at', label: 'الوقت', width: 22 }, { key: 'who', label: 'الشخص', width: 28 }, { key: 'kind', label: 'نوع العملية', width: 18 },
  { key: 'what', label: 'الوصف', width: 50 }, { key: 'reason', label: 'السبب', width: 30 }, { key: 'fields', label: 'التغييرات', width: 60 }];

// ---------- الاختبارات (المرحلة 10): مجاميع فقط، بصلاحيات المستخدم نفسه (rpc بصلاحية المستدعي) ----------
const HMONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
let ETYPES = [];
// إعدادات حساب النسبة كما في الموقع (الطريقة وعتبتا الفئة أ والمستبعدون وعتبة ضعف الرصد وصياغته) من خيارات التصدير
const examCfg = () => XL.settings({ 'exams.rate_method': OPT.exams_rate_method, 'exams.rate_a_min_candidates': OPT.exams_a_min, 'exams.rate_a_share': OPT.exams_a_share,
  'exams.rate_include_excluded': OPT.exams_rate_excl, 'exams.no_result_max': OPT.exams_nr_max ?? 0.25, 'exams.low_obs_texts': OPT.exams_low_obs || '',
  'exams.absent_method': OPT.exams_absent_method || 'رقم مستقل', 'exams.excluded_method': OPT.exams_excluded_method || (OPT.exams_rate_excl ? 'داخل المقام' : 'خارج المقام') });
async function exams(f, max) {
  const d = await rpc('rpc_exam_rows', { p: { teacher: f.teacher || '', sup: f.sup || '', dep: f.dep || '', year: f.year || '', kind: f.kind || '', limit: max } });
  ETYPES = d.types;
  return d.rows.map((r) => {
    // نسبة النجاح بالطريقة المختارة في الإعدادات (الافتراضية: الناجحون ÷ من رُصدت نتائجهم)، والفئة أ تُحكم على «المعلم × الاختبار» كله (unit_t, unit_r).
    // عند ضعف الرصد لا تُصدَّر نسبة النجاح وحدها: تبقى فارغة ويُكتب في «الرصد» «نجح كذا من كذا رُصدت نتائجهم…»
    const cfg = examCfg();
    // «غائب» (absNorm): خارج «لم تُرصد» ومقام النجاح حين يكون رقماً مستقلاً، ويُصدَّر في عموده
    const x0 = XL.absNorm({ t: r.tested, p: r.passed, f: r.failed, x: r.excluded, r: r.no_result, a: r.absent }, cfg);
    const ra = XL.isAUnit(XL.absNorm({ t: r.unit_t, r: r.unit_r, a: r.unit_a }, cfg), cfg) ? x0.r : 0;
    const x = { ...x0, ra };
    const weak = XL.weakObs(x, cfg); const rt = XL.passRate(x, cfg); const obs = XL.obsRate(x);
    return { kind: r.kind, year: r.year, per: r.unit === 'فصل' ? `الفصل ${r.no}` : HMONTHS[r.no - 1] || r.no, teacher_code: r.teacher_code || '', teacher: r.teacher || '',
      dep: depName(r.dep) || r.legacy_dep || '', halaqa: r.halaqa || '', halaqa_basis: r.halaqa_basis || '', track: r.track || '', tested: r.tested, passed: r.passed, failed: r.failed,
      excluded: r.excluded, no_result: x.r, absent: x.a, rate: weak || rt == null ? null : Math.round(rt * 1000) / 10, obs: obs == null ? null : Math.round(obs * 1000) / 10, obs_note: weak ? XL.obsPhrase(x, cfg) : '',
      ...Object.fromEntries(d.types.map((t) => [`e_${t.code}`, r.errors?.[t.code] || 0])),
      match: r.match || 'غير مطابق', confirm: !!r.confirm, reason: r.reason || '', batch: r.batch };
  });
}
// لا درجات في الاختبارات أصلاً؛ «نسبة النجاح» بطريقة الإعدادات، و«لم تُرصد» و«غائب» عمودان مستقلان
const examCols = () => [{ key: 'kind', label: 'نوع الاختبار', width: 12 }, { key: 'year', label: 'السنة' }, { key: 'per', label: 'الفصل أو الشهر', width: 14 },
  { key: 'teacher_code', label: 'رقم المعلم', width: 10 }, { key: 'teacher', label: 'المعلم', width: 30 }, { key: 'dep', label: 'القسم', width: 24 }, { key: 'halaqa', label: 'الحلقة' },
  { key: 'track', label: 'المسار', width: 30 }, { key: 'tested', label: 'المختبَرون' }, { key: 'passed', label: 'الناجحون' }, { key: 'failed', label: 'الراسبون' },
  { key: 'excluded', label: OPT?.exams_rate_excl ? 'المستبعدون (داخل مقام النجاح)' : 'المستبعدون (لأسباب إدارية؛ خارج مقام النجاح)' }, { key: 'no_result', label: 'لم تُرصد (مسؤولية لجنة الاختبارات)' }, { key: 'absent', label: 'غائب (سجّلته اللجنة؛ خارج مقام النجاح)' }, { key: 'rate', label: 'نسبة النجاح (٪) — بطريقة الإعدادات؛ فارغة عند ضعف الرصد' },
  { key: 'obs', label: 'نسبة الرصد (٪)' }, { key: 'obs_note', label: 'الرصد', width: 50 },
  ...ETYPES.map((t) => ({ key: `e_${t.code}`, label: `ملاحظات ${t.name}` })), { key: 'match', label: 'مطابقة المعلم' }, { key: 'confirm', label: 'يحتاج تأكيد' },
  { key: 'reason', label: 'السبب', width: 34 }, { key: 'halaqa_basis', label: 'تحديد الحلقة', width: 40 }, { key: 'batch', label: 'رقم الدفعة' }];
const examSheet = async (name, f, max) => { const rows = await exams(f, max); return { name, columns: examCols(), rows }; };

// ---------- المرحلة 10ب: مؤشرات الاختبارات وسير المعلم ونقاط الضعف والخطة (بلا أسماء طلاب ما دام مفتاحها مطفأ) ----------
const KV = [{ key: 'k', label: 'البند', width: 34 }, { key: 'v', label: 'القيمة', width: 70 }];
async function examIndicators(teacherId) {
  // إعادة البناء 2026-11-21: الأرقام نفسها التي في التبويب (كل طالب مرة واحدة، والمؤشرات المخفية لا تُصدَّر)
  const d = await rpc('rpc_teacher_exams_v3', { p_teacher: teacherId });
  const R = XL.build(d);
  return { d, A: R.A, R };
}
function indicatorRows({ d, A, R }) {
  if (!A.has) return [{ k: 'الاختبارات', v: R.cfg.ui.empty_all || 'لا توجد اختبارات مسجلة لهذا المعلم' }];
  const cfg = R.cfg;
  return [
    { k: 'قاعدة نسبة النجاح', v: `${cfg.methodText}${cfg.inclExcluded ? ' والمستبعدون داخل المقام.' : ' والمستبعدون خارج المقام (رقم مستقل).'}` },
    ...R.cards.map((c) => ({ k: 'الخلاصة', v: c.text })),
    { k: 'التوصية', v: R.rec || '—' },
    { k: 'نطاق التحليل', v: `${R.winLabel}: ${XL.arCount(R.W.t, 'nomination')} لـ ${XL.arCount(R.winStudentsN, 'student')}؛ نجح ${R.W.p}، رسب ${R.W.f}، لم تُرصد ${R.W.r}${XL.absPart(R.W)}${XL.excPart(R.W)}، ${XL.weakObs(R.W, cfg) ? XL.obsPhrase(R.W, cfg) : `النسبة ${XL.pct(A.winRate, 1)}`}` },
    { k: 'يحتاجون متابعة', v: `${XL.arCount(R.followup.length, 'student')} (كل طالب مرة واحدة): ${Object.entries(R.reasonCount).filter(([, n]) => n).map(([k, n]) => `${XL.reasonLabel[k]} ${n}`).join('، ') || '—'}` },
    { k: 'سير المعلم', v: R.trend.word || 'لا يكفي للحكم' },
    ...R.strengths.map((x) => ({ k: 'نقطة قوة', v: x.text })),
    ...R.weaknesses.map((x) => ({ k: 'نقطة ضعف', v: x.text })),
    ...(d.plans2 || []).filter((p) => p.status !== 'ملغاة').slice(0, 3).map((p) => ({ k: `خطة علاج (${hijri(p.at)})`, v: `${XL.planStatus(p, R).label}${p.goal != null ? ` — الهدف ≥ ${p.goal}٪` : ''}: ${String(p.wa || p.body || '').slice(0, 500)}` })),
  ];
}
function timelineRows({ d, A, R }) {
  const cfg = R.cfg;
  return A.timeline.map((p) => (p.missing
    ? { kind: XL.kindName(p.k, d.kinds), per: XL.periodName(p), state: 'لم يرشّح' }
    : { kind: XL.kindName(p.k, d.kinds), per: XL.periodName(p), state: 'رشّح', t: p.t, p: p.p, f: p.f, r: p.r, a: p.a, x: p.x, rate: p.rate == null || XL.weakObs(p, cfg) ? null : Math.round(p.rate * 1000) / 10, obs: p.obs == null ? null : Math.round(p.obs * 1000) / 10, obs_note: XL.weakObs(p, cfg) ? XL.obsPhrase(p, cfg) : '',
        vs: p.vsPrev == null ? null : Math.round(p.vsPrev * 1000) / 10, div: p.divRate == null ? null : Math.round(p.divRate * 1000) / 10,
        notes: Object.entries(p.e || {}).map(([k, v]) => `${(d.types.find((x) => x.code === k) || {}).name || k} ${v}`).join('، ') }));
}
const TL_COLS = [{ key: 'kind', label: 'النوع' }, { key: 'per', label: 'الفصل أو الشهر', width: 20 }, { key: 'state', label: 'الحالة' }, { key: 't', label: 'المرشحون' },
  { key: 'p', label: 'الناجحون' }, { key: 'f', label: 'الراسبون' }, { key: 'r', label: 'لم تُرصد' }, { key: 'a', label: 'غائب' }, { key: 'x', label: 'مستبعد' }, { key: 'rate', label: 'نسبة النجاح (٪)' }, { key: 'obs', label: 'نسبة الرصد (٪)' }, { key: 'obs_note', label: 'الرصد', width: 46 }, { key: 'vs', label: 'الفرق عن السابق (نقطة)' },
  { key: 'div', label: 'متوسط الشعبة (٪)' }, { key: 'notes', label: 'الملاحظات', width: 40 }];
async function teacherExamSheets(teacherId) {
  const X = await examIndicators(teacherId);
  const out = [{ name: 'مؤشرات الاختبارات', columns: KV, rows: indicatorRows(X) }, { name: 'سير المعلم في الاختبارات', columns: TL_COLS, rows: timelineRows(X) }];
  // أسماء الطلاب: فقط بمفتاحي «إظهار أسماء الطلاب» و«أسماء الطلاب في التصدير» معاً (والفحص في القاعدة)
  if (OPT.student_names) {
    const st = await rpc('rpc_exam_students_export', { p_teacher: teacherId });
    if (st.names) out.push({ name: 'نتائج الطلاب', columns: [{ key: 'name', label: 'الطالب', width: 30 }, { key: 'reg', label: 'رقم التسجيل', width: 12 }, { key: 'per', label: 'الفصل أو الشهر', width: 18 },
      { key: 'res', label: 'النتيجة' }, { key: 'track', label: 'المسار', width: 26 }, { key: 'pages', label: 'المقدار (صفحات)' }, { key: 'notes', label: 'الملاحظات', width: 40 }],
      rows: st.rows.map((r) => ({ name: r.name, reg: r.reg, per: XL.periodName(r), res: r.res, track: r.track, pages: r.pf != null ? `${r.pf}–${r.pt ?? ''}` : '', notes: r.notes || '' })) });
  }
  return out;
}

// ---------- المجموعات ----------
const F = { per: 'الفترة', dep: 'القسم', sup: 'الموجه', from: 'من تاريخ', to: 'إلى تاريخ', teacher: 'المعلم', year: 'السنة الهجرية', kind: 'نوع الاختبار' };
const DATASETS = [
  ...[['teacher', 'المعلمون'], ['supervisor', 'الموجهون'], ['supervisor_assistant', 'مساعدو الموجهين'], ['dept_head', 'مسؤولو الأقسام']].map(([role, k]) => ({
    k, i: role === 'teacher' ? 'user' : 'users', filters: ['per', 'dep'],
    run: async (f, max) => [{ name: k, columns: personCols(role), rows: (await people(role, f, max)).map(personRow(role)) }] })),
  { k: 'الحلقات', i: 'book', filters: ['per', 'dep'], run: async (f, max) => {
    const q = [f.dep && `department_code=eq.${E(f.dep)}`, f.per && `period_code=eq.${E(f.per)}`, 'halaqa_teachers.valid_to=is.null', 'halaqa_supervisors.valid_to=is.null'].filter(Boolean).join('&');
    const rows = await pages(`halaqat?select=number,sector,is_active,department_code,period_code,period_detail,needs_confirmation,halaqa_teachers(type,person:persons!person_id(full_name,display_code)),halaqa_supervisors(person:persons!person_id(full_name))&${q}&order=number`, max);
    return [{ name: 'الحلقات', columns: [{ key: 'number', label: 'رقم الحلقة', width: 12 }, { key: 'dep', label: 'القسم', width: 26 }, { key: 'per', label: 'الفترة' },
      { key: 'detail', label: 'تفصيل الفترة', width: 16 }, { key: 'sector', label: 'القطاع' }, { key: 'active', label: 'نشطة' }, { key: 'teacher', label: 'المعلم', width: 34 },
      { key: 'sup', label: 'الموجه', width: 28 }, { key: 'conf', label: 'يحتاج تأكيد' }],
    rows: rows.map((r) => ({ number: r.number, dep: depName(r.department_code), per: perName(r.period_code), detail: r.period_detail || '', sector: r.sector || 'غير محدد', active: r.is_active,
      teacher: (r.halaqa_teachers || []).map((t) => `${t.person?.full_name || ''}${t.type === 'بديل' ? ' (بديل)' : ''}`).join('، '),
      sup: (r.halaqa_supervisors || []).map((s) => s.person?.full_name || '').join('، ') || 'غير مسندة', conf: r.needs_confirmation })) }];
  } },
  { k: 'الإسناد', i: 'swap', filters: ['per', 'dep'], run: async (f, max) => {
    const q = ['valid_to=is.null', f.dep && `h.department_code=eq.${E(f.dep)}`, f.per && `h.period_code=eq.${E(f.per)}`].filter(Boolean).join('&');
    const rows = await pages(`halaqa_supervisors?select=halaqa_number,valid_from,reason,person:persons!person_id(full_name,display_code),h:halaqat!inner(department_code,period_code,sector)&${q}&order=halaqa_number`, max);
    return [{ name: 'الإسناد', columns: [{ key: 'h', label: 'رقم الحلقة', width: 12 }, { key: 'dep', label: 'القسم', width: 26 }, { key: 'per', label: 'الفترة' },
      { key: 'code', label: 'رقم الموجه', width: 10 }, { key: 'sup', label: 'الموجه', width: 30 }, { key: 'since', label: 'منذ', width: 18 }, { key: 'reason', label: 'السبب', width: 30 }],
    rows: rows.map((r) => ({ h: r.halaqa_number, dep: depName(r.h?.department_code), per: perName(r.h?.period_code), code: r.person?.display_code, sup: r.person?.full_name, since: hd(r.valid_from), reason: r.reason || '' })) }];
  } },
  { k: 'الزيارات', i: 'clipboard', filters: ['per', 'dep', 'sup', 'from', 'to'], run: async (f, max) => [{ name: 'الزيارات', columns: visitCols(), rows: await visits(f, max) }] },
  { k: 'الملاحظات', i: 'edit', filters: ['from', 'to'], run: async (f, max) => [{ name: 'الملاحظات', columns: noteCols, rows: await notes(f, max) }] },
  { k: 'السجل', i: 'list', ok: () => OPT.audit || !!panelMode('P15'), filters: ['from', 'to'], run: async (f, max) => [{ name: 'السجل', columns: logCols, rows: await auditLog(f, max) }] },
  { k: 'الاختبارات', i: 'chart', ok: () => OPT.exams, filters: ['year', 'kind', 'dep', 'sup'], run: async (f, max) => [await examSheet('الاختبارات', f, max)] },
  { k: 'الخطط', i: 'cal', ok: () => PLANS_ON, filters: ['per', 'dep', 'sup', 'from', 'to'], run: async (f, max) => [
    { name: 'زيارات الخطط', columns: planItemCols, rows: await planItems(f, max) }, { name: 'اعتماد الخطط', columns: planHeadCols, rows: await planHeads(f, max) }] },
  // تُضاف هنا لاحقاً: { k: 'الخطط', ... }، { k: 'مصادر البيانات', ... }
];

// مؤشرات اختبارات معلمي الموجه (صف لكل معلم): الأكثر أشهراً بلا ترشيح أولاً
async function supExamSheet(teachers) {
  const ids = [...new Set(teachers.map((t) => t.id).filter(Boolean))];
  const rows = [];
  for (const id of ids) {
    try { const X = await examIndicators(id); const { d, A } = X; const t = teachers.find((x) => x.id === id);
      rows.push({ code: t.code, name: t.name, last: A.lastMonthly && !XL.weakObs(A.lastMonthly, A.cfg) ? Math.round(XL.passRate(A.lastMonthly, A.cfg) * 1000) / 10 : null, win: A.winRate == null || XL.weakObs(A.win, A.cfg) ? null : Math.round(A.winRate * 1000) / 10, obs_note: XL.weakObs(A.win, A.cfg) ? XL.obsPhrase(A.win, A.cfg) : '', obs: A.winObs == null ? null : Math.round(A.winObs * 1000) / 10,
        miss: A.missing.length, months: A.missing.map(XL.periodName).join('، '), nores: A.win.r, absent: A.win.a, weak: X.R.weaknesses.map((w) => w.text).join('؛ '), plans: (d.plans2 || []).filter((p) => p.status !== 'ملغاة').length });
    } catch { /* معلم خارج الصلاحية: لا يُصدَّر */ }
  }
  rows.sort((a, b) => b.miss - a.miss);
  return { name: 'مؤشرات اختبارات معلميه', columns: [{ key: 'code', label: 'رقم المعلم', width: 10 }, { key: 'name', label: 'المعلم', width: 30 }, { key: 'last', label: 'النجاح في آخر تنشيطية (٪)' },
    { key: 'win', label: 'النجاح في نطاق التحليل (٪) — فارغ عند ضعف الرصد' }, { key: 'obs', label: 'نسبة الرصد في نطاق التحليل (٪)' }, { key: 'obs_note', label: 'الرصد', width: 46 }, { key: 'miss', label: 'أشهر لم يرشّح' }, { key: 'months', label: 'الأشهر', width: 40 }, { key: 'nores', label: 'لم تُرصد' }, { key: 'absent', label: 'غائب' },
    { key: 'weak', label: 'نقاط الضعف', width: 50 }, { key: 'plans', label: 'خطط العلاج' }], rows };
}

// ---------- التقارير الجاهزة ----------
const REPORTS = [
  { k: 'تقرير موجه', i: 'user', d: 'زياراته، ومعلموه، والتزامه بالحد اليومي، ومجاميع اختبارات معلميه', filters: ['sup', 'from', 'to'], need: ['sup'], run: async (f, max) => {
    const vs = await visits(f, max);
    const asg = await pages(`halaqa_supervisors?select=halaqa_number,h:halaqat!inner(department_code,period_code,halaqa_teachers(type,valid_to,person:persons!person_id(id,full_name,display_code)))&valid_to=is.null&person_id=eq.${E(f.sup)}&h.halaqa_teachers.valid_to=is.null&order=halaqa_number`, max);
    const vByT = new Map(); vs.forEach((v) => vByT.set(v.teacher_code, (vByT.get(v.teacher_code) || 0) + 1));
    const teachers = asg.flatMap((a) => (a.h?.halaqa_teachers || []).map((t) => ({ id: t.person?.id, code: t.person?.display_code, name: t.person?.full_name, h: a.halaqa_number,
      dep: depName(a.h.department_code), per: perName(a.h.period_code), n: vByT.get(t.person?.display_code) || 0 })));
    const byDay = new Map();
    vs.forEach((v) => { const k = `${v.visit_date}|${v.period_code || ''}`; byDay.set(k, (byDay.get(k) || 0) + 1); });
    const days = [...byDay].map(([k, n]) => { const [d, p] = k.split('|'); const cap = OPT.caps?.[p] ?? null;
      return { d: hd(d), g: d, per: perName(p) || 'بلا فترة', n, cap, ok: cap == null ? 'لا حد' : n <= cap ? 'ضمن الحد' : 'تجاوز الحد' }; }).sort((a, b) => (a.g < b.g ? 1 : -1));
    const over = days.filter((x) => x.ok === 'تجاوز الحد').length;
    return [
      { name: 'ملخص', columns: [{ key: 'k', label: 'البند', width: 30 }, { key: 'v', label: 'القيمة', width: 30 }], rows: [
        { k: 'الموجه', v: f.supName || '' }, { k: 'من', v: hd(f.from) || 'البداية' }, { k: 'إلى', v: hd(f.to) || 'اليوم' }, { k: 'عدد الزيارات', v: vs.length },
        { k: 'عدد معلميه الحاليين', v: teachers.length }, { k: 'معلمون بلا زيارة في الفترة', v: teachers.filter((t) => !t.n).length },
        { k: 'أيام عمل بزيارات', v: days.length }, { k: 'أيام تجاوز فيها الحد اليومي', v: over }] },
      { name: 'الزيارات', columns: visitCols(), rows: vs },
      { name: 'معلموه', columns: [{ key: 'code', label: 'رقم المعلم', width: 10 }, { key: 'name', label: 'المعلم', width: 32 }, { key: 'h', label: 'الحلقة' }, { key: 'dep', label: 'القسم', width: 24 },
        { key: 'per', label: 'الفترة' }, { key: 'n', label: 'زياراته في الفترة' }], rows: teachers },
      { name: 'الالتزام بالحد اليومي', columns: [{ key: 'd', label: 'اليوم (هجري)', width: 18 }, { key: 'g', label: 'ميلادي', width: 12 }, { key: 'per', label: 'الفترة' },
        { key: 'n', label: 'عدد الزيارات' }, { key: 'cap', label: 'الحد اليومي' }, { key: 'ok', label: 'الحالة', width: 14 }], rows: days },
      // المرحلة 10: مجاميع اختبارات معلميه الحاليين (بصلاحيات من يصدّر)
      ...(OPT.exams ? [await examSheet('اختبارات معلميه', { sup: f.sup }, max), await supExamSheet(teachers)] : [])];
  } },
  { k: 'تقرير معلم', i: 'user', d: 'كل زياراته وملاحظاته ومجاميع اختباراته', filters: ['teacher'], need: ['teacher'], run: async (f, max) => [
    { name: 'الزيارات', columns: visitCols(), rows: await visits({ teacher: f.teacher }, max) },
    { name: 'الملاحظات', columns: noteCols, rows: await notes({ teacher: f.teacher }, max) },
    ...(OPT.exams ? [await examSheet('الاختبارات', { teacher: f.teacher }, max), ...(await teacherExamSheets(f.teacher))] : [])] },
  { k: 'تقرير زيارات قسم أو فترة', i: 'chart', d: 'زيارات قسم أو فترة، وملخص لكل موجه', filters: ['dep', 'per', 'from', 'to'], run: async (f, max) => {
    const vs = await visits(f, max);
    const by = new Map(); vs.forEach((v) => { const k = v.sup_name || 'غير مسجل'; const x = by.get(k) || { sup: k, n: 0, teachers: new Set(), off: 0 }; x.n++; x.teachers.add(v.teacher_code); if (v.is_official) x.off++; by.set(k, x); });
    return [{ name: 'ملخص الموجهين', columns: [{ key: 'sup', label: 'الموجه', width: 30 }, { key: 'n', label: 'الزيارات' }, { key: 'off', label: 'الرسمية' }, { key: 't', label: 'المعلمون المزارون' }],
      rows: [...by.values()].map((x) => ({ sup: x.sup, n: x.n, off: x.off, t: x.teachers.size })).sort((a, b) => b.n - a.n) },
      { name: 'الزيارات', columns: visitCols(), rows: vs }];
  } },
];

// ---------- التصدير الكامل (للمسؤول) ----------
// كل الجداول ما عدا جدولي الدخول (accounts وlogin_attempts) لحساسيتهما. العنوان عربي ومعه اسم العمود الأصلي (لازم لنقل الموقع).
const FULL_TABLES = ['persons', 'person_mobiles', 'person_nationalities', 'person_aliases', 'roles', 'actions', 'role_permissions', 'assignments', 'groups', 'departments', 'periods',
  'halaqat', 'halaqa_teachers', 'halaqa_supervisors', 'assignment_requests', 'confirmations', 'dept_period_summary', 'visits', 'visit_grades', 'visit_axis_scores', 'visit_acknowledgments',
  'teacher_eval_summary', 'teacher_item_latest', 'teacher_notes', 'teacher_contact_log', 'note_categories', 'eval_forms', 'eval_axes', 'eval_items', 'eval_levels', 'grade_scales', 'grade_bands',
  'department_forms', 'visit_types', 'period_rules', 'plan_rules', 'alert_rules', 'sup_eval_templates', 'sup_eval_items', 'config_versions', 'app_settings', 'setting_values',
  'setting_group_areas', 'change_sets', 'panel_screens', 'panel_grants', 'terms', 'hijri_calendar', 'ref_lists', 'ref_list_items', 'import_batches', 'export_log', 'audit_log',
  'exam_kinds', 'exam_error_types', 'exam_error_map', 'exam_batches', 'exam_results', 'exam_result_errors', 'plans', 'plan_items', 'plan_events', 'plan_comments'];
// العناوين العربية لكل عمود ولكل جدول في web/js/col_ar.js

export async function render(root, ctx) {
  OPT ||= await rpc('rpc_export_options');
  PLANS_ON = !!(await planAccess()).on;
  const all = (S.profile?.assignments || []).some((a) => !a.department_code && !a.group_code);
  const isSupOnly = !all && (S.profile?.assignments || []).every((a) => a.role === 'supervisor' || a.role === 'supervisor_assistant');
  const out = h('div');
  root.append(
    h('p', { class: 'muted' }, 'اختر ما تريد فيُنزَّل ملف إكسل بعناوين عربية ومن اليمين إلى اليسار. يصدّر كل مستخدم ما يحق له رؤيته فقط، وكل تصدير يُسجَّل في «السجل».',
      OPT.show_score ? '' : ' الدرجة الرقمية مخفية حسب الإعداد (يظهر التقدير اللفظي).'),
    h('div', { class: 'note' }, `أقصى عدد صفوف في الملف: ${nf(OPT.max_rows)} (إعداد «صفوف التصدير»). إن زاد ما اخترته يُنبَّه في الملف.`),
    h('h3', { class: 'ex-h' }, 'البيانات'),
    h('div', { class: 'pcards' }, DATASETS.filter((d) => !d.ok || d.ok()).map((d) => card(d, () => form(d)))),
    h('h3', { class: 'ex-h' }, 'تقارير جاهزة'),
    h('div', { class: 'pcards' }, REPORTS.map((r) => card(r, () => form(r)))),
    ...(OPT.full ? [h('h3', { class: 'ex-h' }, 'التصدير الكامل'),
      h('div', { class: 'pcards' }, card({ k: 'كل الجداول', i: 'layers', d: 'ورقة لكل جدول بعناوين عربية ومعها الاسم الأصلي، لنقل الموقع إن لزم (لمسؤول الشعبة ومساعده)', big: true }, fullExport))] : []),
    out);

  function card(d, onclick) {
    return h('button', { type: 'button', class: `pcard${d.big ? ' big' : ''}`, onclick }, icon(d.i || 'list', 22), h('span', { class: 'pc-t' }, d.k), d.d ? h('span', { class: 'pc-d' }, d.d) : null);
  }

  async function form(d) {
    const f = {}; const els = {};
    const inputs = [];
    for (const k of d.filters) {
      if (k === 'per') els.per = selectOf(S.refs.periods.filter((p) => p.is_active), { all: 'كل الفترات' });
      if (k === 'dep') els.dep = selectOf(S.refs.departments.filter((x) => x.is_active !== false), { all: 'كل الأقسام' });
      if (k === 'from' || k === 'to') els[k] = h('input', { type: 'date' });
      // المرحلة 10: سنة الاختبار ونوعه (من القاعدة، لا ثابتة في الكود)
      if (k === 'year') { els.year = h('select', null, h('option', { value: '' }, 'كل السنوات'));
        rpc('rpc_exam_rows', { p: { limit: 1 } }).then((r) => r.years.forEach((y) => els.year.append(h('option', { value: y }, `${y}هـ`)))).catch(() => {}); }
      if (k === 'kind') { els.kind = h('select', null, h('option', { value: '' }, 'كل الأنواع'));
        get('exam_kinds?select=code,name&order=sort_order').then((r) => r.forEach((x) => els.kind.append(h('option', { value: x.code }, x.name)))).catch(() => {}); }
      if (k === 'sup') {
        if (isSupOnly) { els.sup = h('select', null, h('option', { value: S.profile.person_id || '' }, S.profile.full_name)); }
        else {
          els.sup = h('select', null, h('option', { value: '' }, d.need?.includes('sup') ? 'اختر الموجه' : 'كل الموجهين'));
          rpc('rpc_people_list', { p: { role: 'supervisor', limit: 200 } }).then((r) => r.rows.forEach((p) => els.sup.append(h('option', { value: p.id }, p.full_name)))).catch(() => {});
        }
      }
      if (k === 'teacher') {
        const q = h('input', { type: 'search', placeholder: 'ابحث باسم المعلم أو رقمه' }); const sel = h('select', null, h('option', { value: '' }, 'اكتب للبحث ثم اختر'));
        q.addEventListener('input', debounce(async () => {
          const r = await rpc('rpc_people_list', { p: { role: 'teacher', q: toLatinDigits(q.value), limit: 30 } }).catch(() => ({ rows: [] }));
          sel.replaceChildren(h('option', { value: '' }, r.rows.length ? 'اختر المعلم' : 'لا نتائج'), ...r.rows.map((p) => h('option', { value: p.id }, `${p.full_name} (${p.display_code})`)));
          if (r.rows.length === 1) sel.value = r.rows[0].id;
        }, 350));
        els.teacher = sel; inputs.push(field('بحث', q));
      }
      inputs.push(field(F[k], els[k]));
    }
    const go = h('button', { class: 'btn primary block', type: 'button' }, icon('send', 20), 'تنزيل ملف إكسل');
    const msg = h('div', { role: 'status' });
    out.replaceChildren(h('section', { class: 'card ex-form' }, h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, d.k), badge('قراءة فقط', 'gray')),
      d.d ? h('p', { class: 'muted small' }, d.d) : null, h('div', { class: 'filters' }, inputs.map((x) => h('div', null, x))), go, msg));
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    go.onclick = async () => {
      for (const k of d.filters) f[k] = els[k].value || '';
      if (f.sup) f.supName = els.sup.selectedOptions[0]?.textContent;
      if (f.teacher) f.teacherName = els.teacher.selectedOptions[0]?.textContent;
      if (f.kind) f.kindName = els.kind.selectedOptions[0]?.textContent;
      const miss = (d.need || []).find((k) => !f[k]);
      if (miss) return toast(`اختر ${F[miss]}`, 'bad');
      if (f.from && f.to && f.from > f.to) return toast('تاريخ البداية بعد تاريخ النهاية', 'bad');
      go.disabled = true; msg.replaceChildren(h('p', { class: 'loading' }, 'جارٍ تجهيز الملف…'));
      try {
        const sheets = await d.run(f, OPT.max_rows + 1);
        let capped = false;
        sheets.forEach((s) => { if (s.rows.length > OPT.max_rows) { s.rows = s.rows.slice(0, OPT.max_rows); capped = true; } });
        const total = sheets.reduce((a, s) => a + s.rows.length, 0);
        const label = filterLabel(d.k, f);
        if (capped) sheets.unshift({ name: 'تنبيه', columns: [{ key: 't', label: 'تنبيه', width: 90 }], rows: [{ t: `بعض الأوراق بلغت الحد (${OPT.max_rows} صف) فلم تُصدَّر كاملة. يرفعه مسؤول الشعبة من: لوحة التحكم ← الإعدادات العامة ← «إعدادات متقدمة» ← «البحث والتصدير» ← «صفوف التصدير».` }] });
        download(await workbook(sheets), fileName(label));
        await rpc('rpc_log_export', { p_kind: d.k, p_label: label, p_filters: clean(f), p_rows: total }).catch(() => toast('نُزّل الملف، وتعذّر تسجيل ذلك في السجل', 'bad'));
        msg.replaceChildren(h('p', { class: 'hint' }, `نُزّل الملف: ${nf(total)} صفاً${capped ? ' (بلغ الحد)' : ''}. وسُجّل في «السجل».`));
      } catch (e) { msg.replaceChildren(); fail(e); } finally { go.disabled = false; }
    };
  }

  async function fullExport() {
    const msg = h('div', { role: 'status' }); const go = h('button', { class: 'btn primary block', type: 'button' }, icon('layers', 20), 'تنزيل كل الجداول');
    out.replaceChildren(h('section', { class: 'card ex-form' }, h('h2', null, 'التصدير الكامل'),
      h('p', { class: 'muted small' }, `ورقة لكل جدول (${FULL_TABLES.length} جدولاً)، بلا حد للصفوف، ما عدا جدولي الدخول (الحسابات ومحاولات الدخول) لحساسيتهما. قد يأخذ دقيقة.`), go, msg));
    go.onclick = async () => {
      go.disabled = true; const sheets = []; const skipped = [];
      try {
        for (const [i, t] of FULL_TABLES.entries()) {
          msg.replaceChildren(h('p', { class: 'loading' }, `جارٍ قراءة ${i + 1} من ${FULL_TABLES.length}…`));
          try {
            const rows = await pages(`${t}?select=*`, null);
            const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
            sheets.push({ name: tableLabel(t), table: t, columns: keys.map((k) => ({ key: k, label: colLabel(k), width: 18 })),
              rows: rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] != null && typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]]))) });
          } catch { skipped.push(t); }
        }
        sheets.unshift({ name: 'فهرس', columns: [{ key: 't', label: 'الجدول', width: 30 }, { key: 'n', label: 'عدد الصفوف' }],
          rows: [...sheets.map((s) => ({ t: `${s.name} (${s.table})`, n: s.rows.length })), ...skipped.map((t) => ({ t: `${tableLabel(t)} (${t}) — تعذّرت قراءته`, n: 0 }))] });
        const total = sheets.reduce((a, s) => a + s.rows.length, 0);
        download(await workbook(sheets), fileName('تصدير كامل'));
        await rpc('rpc_log_export', { p_kind: 'كامل', p_label: `تصدير كامل: ${sheets.length - 1} جدولاً`, p_filters: { skipped }, p_rows: total });
        msg.replaceChildren(h('p', { class: 'hint' }, `نُزّل الملف: ${sheets.length - 1} جدولاً، ${nf(total)} صفاً${skipped.length ? `، وتعذّر ${skipped.length}` : ''}. وسُجّل في «السجل».`));
      } catch (e) { msg.replaceChildren(); fail(e); } finally { go.disabled = false; }
    };
  }
}
const clean = (f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v));
function filterLabel(k, f) {
  return [k, f.year && `${f.year}هـ`, f.kindName, f.dep && depName(f.dep), f.per && perName(f.per), f.supName, f.teacherName, f.from && 'من ' + hijri(f.from), f.to && 'إلى ' + hijri(f.to)].filter(Boolean).join(' — ');
}
function fileName(label) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const d = `${String(p.year).replace(/\D/g, '')}-${p.month}-${p.day}`;
  return `${label.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80)} ${d}هـ.xlsx`;
}
export const prefetch = () => { if (!OPT) rpc('rpc_export_options').then((o) => { OPT = o; }).catch(() => {}); };
