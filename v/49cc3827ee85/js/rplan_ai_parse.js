// قارئ رد الذكاء الاصطناعي للخطة العلاجية (أمر صاحب النظام 2026-11-26، الخطوة 2) — منطق خالص بلا متصفح (تختبره scripts/rplan_ai_parse_tests.mjs).
// الصيغة الثابتة في design/المرحلة12/01_أمر_الذكاء_الاصطناعي.md: [[بداية_الخطة]] … أقسام «## القوة/الضعف/بند/أسبوع/زيارة_متابعة» … [[نهاية_الخطة]].
// الأمان: النص يُعامل نصاً عادياً فقط — تُنزع علامات HTML ومحارف التحكم من كل قيمة، ولا يُبنى منه أي HTML (الرسم بـ textContent)، وحد أقصى للطول.
// السماحة: تتحمّل غياب كتلة الكود، والمقدمة والخاتمة، والخط العريض، والأرقام العربية، والنقطتين «:» أو «：»، والحقل المكرر (يؤخذ الأول)،
// وتقرأ البنود السليمة وتذكر ما ينقص غيرها برسالة عربية، ولا تعدّل النص الملصوق نفسه.
export const MAX_CHARS = 30000;
export const LIMITS = { items: 8, weeks: 8, visits: 6, points: 8, actions: 6, tasks: 4, text: 400, days: [1, 90], week: [1, 8] };
export const OWNERS = ['المعلم', 'الموجه', 'المعلم والموجه'];

const toLatin = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 1776);
// قيمة نصية نظيفة: بلا HTML ولا محارف تحكم ولا تنسيق Markdown، بمسافات موحدة
export function clean(v) {
  let s = String(v ?? '');
  s = s.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g, '');
  s = s.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  return s;
}
const norm = (k) => clean(k).replace(/[_\sـ]/g, '').replace(/[أإآ]/g, 'ا');
const SECTIONS = { 'القوة': 'strengths', 'نقاطالقوة': 'strengths', 'الضعف': 'weaknesses', 'نقاطالضعف': 'weaknesses', 'بند': 'item', 'أسبوع': 'week', 'اسبوع': 'week',
  'زيارةمتابعة': 'visit', 'زياراتالمتابعة': 'visit' };
const FIELDS = {
  item: { 'البند': 'item_code', 'المشكلة': 'problem_code', 'الهدف': 'goal', 'الاجراءات': 'actions', 'المسؤول': 'owner', 'المؤشر': 'indicator', 'المتابعةبعدايام': 'days' },
  week: { 'الاسبوع': 'week', 'المهام': 'tasks' },
  visit: { 'بعدايام': 'days', 'الغرض': 'purpose' },
};
const LABEL = { item_code: 'البند', problem_code: 'المشكلة', goal: 'الهدف', actions: 'الإجراءات', owner: 'المسؤول', indicator: 'المؤشر', days: 'المتابعة_بعد_أيام',
  week: 'الأسبوع', tasks: 'المهام', purpose: 'الغرض' };
const KIND = { item: 'البند العلاجي', week: 'الأسبوع', visit: 'زيارة المتابعة' };

const START = /\[\[\s*بداية[_\s]*الخطة\s*\]\]/;
const END = /\[\[\s*نهاية[_\s]*الخطة\s*\]\]/;

function cut(s, label, issues) {
  const v = clean(s);
  if (v.length > LIMITS.text) { issues.push(`«${label}» أطول من ${LIMITS.text} حرف، فقُصّ. راجعه.`); return v.slice(0, LIMITS.text); }
  return v;
}
function splitList(s) {
  const v = String(s ?? '');
  const parts = v.includes('|') ? v.split('|') : v.split(/[؛;]/);
  return parts.map(clean).filter(Boolean);
}
function int(v) { const s = toLatin(clean(v)).replace(/[^\d]/g, ''); return s && s.length <= 4 ? Number(s) : NaN; }
function ownerOf(v) {
  const s = clean(v).replace(/\s+/g, ' ');
  if (OWNERS.includes(s)) return s;
  if (/^(ال)?معلم\s*و\s*(ال)?موجه$|^(ال)?موجه\s*و\s*(ال)?معلم$/.test(s)) return 'المعلم والموجه';
  if (/^(ال)?معلم$/.test(s)) return 'المعلم';
  if (/^(ال)?موجه$/.test(s)) return 'الموجه';
  return null;
}

// يعيد { ok, plan:{strengths,weaknesses,items,weeks,visits}, issues:[نص], found:{start,end}, counts }
export function parsePlan(input) {
  const issues = [];
  const empty = { strengths: [], weaknesses: [], items: [], weeks: [], visits: [] };
  let text = String(input ?? '');
  if (!text.trim()) return { ok: false, plan: empty, issues: ['المربع فارغ: الصق رد الذكاء الاصطناعي كاملاً ثم اضغط «اقرأ الخطة».'], found: { start: false, end: false } };
  if (text.length > MAX_CHARS) {
    return { ok: false, plan: empty, issues: [`النص أطول من ${MAX_CHARS.toLocaleString('en')} حرف (الآن ${text.length.toLocaleString('en')}). انسخ الرد وحده بلا محادثة قبله.`], found: { start: false, end: false } };
  }
  text = toLatin(text.replace(/\r/g, '').replace(/\u0000/g, ''));
  const sm = text.match(START); const em = text.match(END);
  const found = { start: !!sm, end: !!em };
  let body;
  if (sm) {
    body = text.slice(sm.index + sm[0].length);
    const e2 = body.match(END);
    body = e2 ? body.slice(0, e2.index) : body;
    if (!e2) issues.push('لم أجد علامة النهاية [[نهاية_الخطة]]؛ قرأت حتى آخر النص. تأكد أن الرد اكتمل ولم ينقطع.');
  } else {
    issues.push('لم أجد علامة البداية [[بداية_الخطة]]؛ حاولت قراءة الأقسام مباشرة. إن نقص شيء فاطلب من الذكاء الاصطناعي إعادة الرد بالصيغة المطلوبة.');
    const first = text.search(/^\s*#{2,}\s*(القوة|الضعف|بند|أسبوع|اسبوع|زيارة[_\s]*متابعة)/m);
    if (first < 0) {
      return { ok: false, plan: empty, issues: ['لم أجد علامة البداية ولا أي قسم من أقسام الخطة (## بند …). هذا ليس رد الخطة: انسخ رد الذكاء الاصطناعي كاملاً.'], found };
    }
    body = text.slice(first);
    const e2 = body.match(END); if (e2) body = body.slice(0, e2.index);
  }
  if (START.test(body)) issues.push('وجدت علامة البداية أكثر من مرة؛ قرأت الخطة الأولى فقط.');
  body = body.split(START)[0];

  // تقسيم الأقسام
  const blocks = []; let cur = null;
  for (const raw of body.split('\n')) {
    const line = raw.replace(/^\s*>\s?/, '').trim();
    if (!line || /^```/.test(line)) continue;
    const hm = line.match(/^#{2,}\s*(.+)$/);
    if (hm) {
      const key = SECTIONS[norm(hm[1]).replace(/[:：]$/, '')];
      if (key) { cur = { key, lines: [] }; blocks.push(cur); } else { cur = null; issues.push(`قسم غير معروف «${clean(hm[1]).slice(0, 30)}» فتجاهلته.`); }
      continue;
    }
    if (cur) cur.lines.push(line);
  }

  const plan = { strengths: [], weaknesses: [], items: [], weeks: [], visits: [] };
  const n = { item: 0, week: 0, visit: 0 };
  for (const b of blocks) {
    if (b.key === 'strengths' || b.key === 'weaknesses') {
      for (const l of b.lines) {
        const v = cut(l.replace(/^([-*•·]|\d+[.)-])\s*/, ''), b.key === 'strengths' ? 'نقطة قوة' : 'نقطة ضعف', issues);
        if (!v || /^نص$/.test(v)) continue;
        if (plan[b.key].length >= LIMITS.points) { issues.push(`${b.key === 'strengths' ? 'نقاط القوة' : 'نقاط الضعف'} أكثر من ${LIMITS.points}؛ أخذت أول ${LIMITS.points}.`); break; }
        plan[b.key].push(v);
      }
      continue;
    }
    n[b.key] += 1; const no = n[b.key]; const kind = KIND[b.key];
    const f = {};
    for (const l of b.lines) {
      const m = l.replace(/^[-*•·]\s*/, '').match(/^([^:：]{1,30})[:：]\s*(.*)$/);
      if (!m) continue;
      const fk = FIELDS[b.key][norm(m[1])];
      if (!fk) continue;
      if (fk in f) { issues.push(`${kind} ${no}: الحقل «${LABEL[fk]}» مكرر؛ أخذت الأول.`); continue; }
      f[fk] = m[2];
    }
    if (b.key === 'item') {
      const miss = ['goal', 'actions', 'owner', 'indicator', 'days'].filter((k) => !clean(f[k]));
      const owner = clean(f.owner) ? ownerOf(f.owner) : null;
      const days = int(f.days);
      const problems = [];
      if (miss.length) problems.push(`ينقصه: ${miss.map((k) => '«' + LABEL[k] + '»').join('، ')}`);
      if (clean(f.owner) && !owner) problems.push(`المسؤول «${clean(f.owner).slice(0, 20)}» غير معروف (المسموح: المعلم، الموجه، المعلم والموجه)`);
      if (clean(f.days) && !(days >= LIMITS.days[0] && days <= LIMITS.days[1])) problems.push(`«المتابعة_بعد_أيام» يجب أن يكون رقماً من 1 إلى 90 (الآن «${clean(f.days).slice(0, 10)}»)`);
      const actions = splitList(f.actions).map((a) => cut(a, `${kind} ${no}: إجراء`, issues));
      if (clean(f.actions) && !actions.length) problems.push('الإجراءات فارغة');
      if (problems.length) { issues.push(`${kind} ${no} لم يُقرأ: ${problems.join('؛ ')}.`); continue; }
      if (plan.items.length >= LIMITS.items) { issues.push(`البنود العلاجية أكثر من ${LIMITS.items}؛ أخذت أول ${LIMITS.items}.`); continue; }
      if (actions.length > LIMITS.actions) issues.push(`${kind} ${no}: الإجراءات أكثر من ${LIMITS.actions}؛ أخذت أول ${LIMITS.actions}.`);
      const code = (toLatin(clean(f.item_code)).toUpperCase().match(/\b[GV]\s*\d{1,2}\b/) || [''])[0].replace(/\s/g, '') || null;
      const prob = (clean(f.problem_code).toUpperCase().match(/\b[A-Z][A-Z0-9_]{1,39}\b/) || [null])[0];
      plan.items.push({ item_code: code, problem_code: prob, goal: cut(f.goal, `${kind} ${no}: الهدف`, issues), actions: actions.slice(0, LIMITS.actions),
        owner, indicator: cut(f.indicator, `${kind} ${no}: المؤشر`, issues), days });
    } else if (b.key === 'week') {
      const wk = int(f.week); const tasks = splitList(f.tasks).map((t) => cut(t, `${kind} ${no}: مهمة`, issues));
      const problems = [];
      if (!clean(f.week)) problems.push('ينقصه «الأسبوع»'); else if (!(wk >= LIMITS.week[0] && wk <= LIMITS.week[1])) problems.push(`رقم الأسبوع من 1 إلى 8 (الآن «${clean(f.week).slice(0, 10)}»)`);
      if (!tasks.length) problems.push('ينقصه «المهام»');
      if (problems.length) { issues.push(`${kind} ${no} لم يُقرأ: ${problems.join('؛ ')}.`); continue; }
      if (plan.weeks.length >= LIMITS.weeks) { issues.push(`الأسابيع أكثر من ${LIMITS.weeks}؛ أخذت أول ${LIMITS.weeks}.`); continue; }
      if (tasks.length > LIMITS.tasks) issues.push(`${kind} ${wk}: المهام أكثر من ${LIMITS.tasks}؛ أخذت أول ${LIMITS.tasks}.`);
      plan.weeks.push({ week: wk, tasks: tasks.slice(0, LIMITS.tasks) });
    } else {
      const d = int(f.days); const problems = [];
      if (!clean(f.days)) problems.push('ينقصه «بعد_أيام»'); else if (!(d >= LIMITS.days[0] && d <= LIMITS.days[1])) problems.push(`«بعد_أيام» رقم من 1 إلى 90 (الآن «${clean(f.days).slice(0, 10)}»)`);
      if (!clean(f.purpose)) problems.push('ينقصه «الغرض»');
      if (problems.length) { issues.push(`${kind} ${no} لم تُقرأ: ${problems.join('؛ ')}.`); continue; }
      if (plan.visits.length >= LIMITS.visits) { issues.push(`زيارات المتابعة أكثر من ${LIMITS.visits}؛ أخذت أول ${LIMITS.visits}.`); continue; }
      plan.visits.push({ days: d, purpose: cut(f.purpose, `${kind} ${no}: الغرض`, issues) });
    }
  }
  plan.weeks.sort((a, b) => a.week - b.week);
  if (!plan.items.length) issues.push('لم أجد أي بند علاجي سليم. اطلب من الذكاء الاصطناعي إعادة الرد بالصيغة المطلوبة، أو أضف البنود بنفسك.');
  return { ok: plan.items.length > 0, plan, issues, found, counts: { items: n.item, weeks: n.week, visits: n.visit } };
}

// تحقق قبل الحفظ (نفس قيود القاعدة app.rplan_ai_normalize): يعيد قائمة أخطاء (فارغة = سليمة)
export function validatePlan(p) {
  const e = [];
  const items = p?.items || [];
  if (!items.length) e.push('أضف بنداً علاجياً واحداً على الأقل.');
  if (items.length > LIMITS.items) e.push(`البنود حتى ${LIMITS.items}.`);
  items.forEach((it, i) => {
    const k = `البند ${i + 1}`;
    if (!clean(it.goal)) e.push(`${k}: الهدف ناقص.`);
    if (!(it.actions || []).map(clean).filter(Boolean).length) e.push(`${k}: الإجراءات ناقصة.`);
    if (!OWNERS.includes(it.owner)) e.push(`${k}: اختر المسؤول.`);
    if (!clean(it.indicator)) e.push(`${k}: المؤشر ناقص.`);
    if (!(Number(it.days) >= 1 && Number(it.days) <= 90)) e.push(`${k}: المتابعة بعد 1 إلى 90 يوماً.`);
    for (const t of [it.goal, it.indicator, ...(it.actions || [])]) if (clean(t).length > LIMITS.text) { e.push(`${k}: نص أطول من ${LIMITS.text} حرف.`); break; }
  });
  (p?.weeks || []).forEach((w, i) => { if (!(w.week >= 1 && w.week <= 8) || !(w.tasks || []).map(clean).filter(Boolean).length) e.push(`الأسبوع ${i + 1}: الرقم أو المهام ناقصة.`); });
  (p?.visits || []).forEach((v, i) => { if (!(v.days >= 1 && v.days <= 90) || !clean(v.purpose)) e.push(`زيارة المتابعة ${i + 1}: الموعد أو الغرض ناقص.`); });
  return e;
}
