// منطق شاشة «مصادر البيانات» (2026-11-22) — دوال خالصة بلا واجهة ولا شبكة، تستعملها admin_sources.js والاختبارات.
// القراءة باسم العمود هنا للمعاينة فقط وبالقاعدة نفسها في القاعدة (app.src_norm و app.sync_apply)؛ والحكم النهائي للقاعدة.

const TASHKEEL = /[ً-ْـ]/g;
export function norm(s) {
  let x = String(s ?? '').replace(TASHKEEL, '');
  x = x.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  x = x.replace(/\s+/g, ' ').trim().replace(/عبد ال/g, 'عبدال').toLowerCase();
  x = x.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[_-]/g, ' ');
  return x.replace(/\s+/g, ' ').trim();
}
export function kv(text) { const o = {}; String(text || '').split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); return o; }
export const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

// عمود كل حقل: المربوط وحده إن ربطه المسؤول، وإلا مفتاح الحقل ثم اسمه ثم بدائله
export function resolveFields(fields, map = {}, header = [], fixed = {}) {
  const hn = header.map(norm);
  return fields.map((f) => {
    if (String(fixed?.[f.key] ?? '').trim()) return { ...f, how: 'ثابت', value: fixed[f.key], idx: -1 };
    const mapped = String(map?.[f.key] ?? '').trim();
    const cands = mapped ? [mapped] : [f.key, f.label, ...(f.aliases || [])];
    for (const c of cands) { const i = hn.indexOf(norm(c)); if (i >= 0) return { ...f, how: mapped ? 'مربوط' : 'تلقائي', column: header[i], idx: i }; }
    return { ...f, how: mapped ? 'مفقود' : 'غير موجود', column: mapped || null, idx: -1 };
  });
}
// الأعمدة الممنوعة (بيانات طالب شخصية) في غير الاختبارات
export const forbiddenCols = (header, forbiddenText, target) => (target === 'اختبارات' ? [] : header.filter((h) => lines(forbiddenText).some((w) => norm(h).includes(norm(w)))));
// المشكلات قبل الحفظ أو الرفع: حقل مطلوب بلا عمود، أو عمود مربوط مفقود، أو مفتاح بلا عمود
export function mappingProblems(res, keyFields) {
  const out = [];
  for (const r of res) {
    if (r.how === 'مفقود') out.push(`العمود «${r.column}» المربوط بحقل «${r.label}» غير موجود في الملف`);
    else if (r.how === 'غير موجود' && r.required) out.push(`حقل «${r.label}» مطلوب ولا عمود له`);
  }
  for (const k of keyFields || []) { const r = res.find((x) => x.key === k); if (r && r.idx < 0 && r.how !== 'ثابت') out.push(`حقل المفتاح «${r.label}» بلا عمود`); }
  return [...new Set(out)];
}

// الحالة المعروضة بلون واضح
export function statusView(s) {
  if (s.state === 'متوقف') return { label: 'متوقف', kind: 'bad' };
  if (s.state === 'موقوف يدوياً') return { label: 'موقوف يدوياً', kind: 'gray' };
  if (s.mode === 'مقارنة فقط') return { label: 'مقارنة فقط', kind: 'info' };
  return { label: 'يعمل', kind: 'ok' };
}
export const RUN_KIND = { 'نجح': 'ok', 'لم يتغير': 'gray', 'أوقفه الحارس': 'warn', 'فشل': 'bad', 'في الانتظار': 'info', 'يعمل': 'info', 'جاهز': 'info' };
export const runActive = (r) => !!r && ['في الانتظار', 'يعمل', 'جاهز'].includes(r.status);

export function scheduleText(sc, method) {
  if (method === 'رفع Excel') return 'يدوي (برفع ملف)';
  if (!sc || sc.type === 'يدوي') return 'يدوي فقط';
  if (sc.type === 'يومي') return `يومياً ${sc.at} بتوقيت الرياض`;
  if (sc.type === 'أسبوعي') return `يدوي، مع سحب أسبوعي يوم ${sc.day} ${sc.at}`;
  // «من 05:00 إلى 07:00» لا «05:00-07:00» (الشرطة تنقلب في الاتجاه العربي)
  if (sc.type === 'نوافذ') return `كل ${sc.every} دقيقة ${(sc.w || []).map((w) => { const [a, b] = String(w).split('-'); return `من ${a.trim()} إلى ${(b || '').trim()}`; }).join('، و')}، وكل ${sc.other} دقيقة في الباقي`;
  return '—';
}

// ملخص التشغيل بجملة
export function runSummary(r) {
  if (!r) return 'لم يُسحب بعد';
  if (runActive(r)) return r.status === 'جاهز' ? 'وصلت الصفوف، والمقارنة خلال دقيقة…' : r.status === 'يعمل' ? 'يُقرأ الملف الآن…' : 'في الانتظار…';
  if (r.status === 'فشل' || r.status === 'أوقفه الحارس') return r.error || r.status;
  if (r.status === 'لم يتغير') return 'لم يتغير الملف منذ آخر سحب';
  const verb = r.mode === 'مقارنة فقط' ? ['سيُضاف', 'سيتغير', 'سيختفي'] : ['أُضيف', 'تغيّر', 'اختفى'];
  const parts = [`${verb[0]} ${r.added}`, `${verb[1]} ${r.updated}`, `${verb[2]} ${r.missing}`];
  if (r.returned) parts.push(`عاد ${r.returned}`);
  if (r.rejected) parts.push(`مرفوض ${r.rejected}`);
  if (r.absent) parts.push(`غائب ${r.absent}`);
  parts.push(`كما هو ${r.unchanged}`);
  return `${r.mode === 'مقارنة فقط' ? 'مقارنة فقط: ' : ''}${parts.join('، ')} من ${r.rows_read} صفاً${r.match_pct != null ? ` — التطابق ${Math.round(Number(r.match_pct))}٪` : ''}`;
}

// صفوف الملف لإرسالها: كل خلية نص، وبلا الصفوف الفارغة كلياً في آخره
export function bodyRows(rows, headerIdx) {
  const body = rows.slice(headerIdx + 1).map((r) => (r || []).map((c) => (c == null ? '' : String(c))));
  while (body.length && !body[body.length - 1].some((c) => c.trim() !== '')) body.pop();
  return body;
}
export const headerIndex = (rows) => rows.findIndex((r) => (r || []).some((c) => String(c ?? '').trim() !== ''));
// مفاتيح حقول النوع «عام» تُولَّد (f1، f2…) فلا يكتب المسؤول أسماء إنجليزية
export const genericKey = (i) => `f${i + 1}`;
