// لوحة التحكم ← «مصادر البيانات» (2026-11-22). لمسؤول الشعبة ومساعده فقط (عمل «إدارة مصادر البيانات»، والفحص في القاعدة).
// بطاقة لكل مصدر، ومعالج «إضافة مصدر» (الاسم ← الطريقة ← الرابط أو الملف ← ربط الأعمدة ← المقارنة ← التفعيل)، ورفع Excel
// (سحب وإفلات ← معاينة ← مقارنة ← تأكيد)، وسجل المزامنة. الرابط لا يصل هنا إلا مختصراً، ولا يُطبع اسم طالب في أي تقرير.
// كل نص طويل في الشاشة من الإعداد sources.ui_texts.
import { h, rpc, nf, badge, toast, fail, icon, sheet, confirmBox, field } from './core.js';
import * as SL from './sources_logic.js';
import { readXlsx, sha256Hex } from './xlsx_read.js';

let D = null; let T = {}; let timer = null;
const METHODS = ['رابط عام', 'حساب الخدمة', 'رفع Excel'];
const METHOD_NOTE = { 'رابط عام': 'الملف مشارك «أي شخص لديه الرابط يمكنه العرض»، ويُقرأ بلا حساب.', 'حساب الخدمة': 'حساب آلي لبريد الشعبة يقرأ الملفات المشاركة معه فقط (الأنسب لملفات الطلاب).', 'رفع Excel': 'ترفع الملف بنفسك من الجوال أو الكمبيوتر متى شئت.' };
const when = (d) => (d ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(d)) : '—');
// بالسنة الهجرية: لكل ما يُسجَّل باسم شخص (قبول الرابط العام، والأرشفة والاستعادة)
const whenY = (d) => (d ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(d)) : '—');
// «لا توجد مصادر» و«مصدر واحد» و«مصدران» و«3 مصادر» و«11 مصدراً»
const srcCount = (k) => (k === 0 ? 'لا توجد مصادر' : k === 1 ? 'مصدر واحد' : k === 2 ? 'مصدران' : k % 100 >= 3 && k % 100 <= 10 ? `${nf(k)} مصادر` : `${nf(k)} مصدراً`);
const reasonField = (ph = 'سبب مختصر يُحفظ في السجل') => h('input', { type: 'text', placeholder: ph, autocomplete: 'off' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const prefetch = () => {};
export async function render(root) {
  clearTimeout(timer);
  D = await rpc('rpc_sources'); T = SL.kv(D.texts);
  const list = h('div');
  const arch = D.archived || [];
  root.replaceChildren(
    h('div', { class: 'hint' }, icon('info', 18), h('span', null, T.intro || '')),
    h('div', { class: 'row between', style: 'margin-bottom:12px' }, h('b', null, srcCount(D.sources.length)),
      h('button', { class: 'btn primary', type: 'button', onclick: () => wizard(root) }, icon('plus', 18), 'إضافة مصدر')),
    list,
    // المؤرشفة: لا تُسحب ولا تُعدَّل، ولا يُحذف منها شيء؛ «استعادة» لمسؤول الشعبة وحده
    arch.length ? h('details', { class: 'card src-arch' }, h('summary', null, h('b', null, `المؤرشفة (${nf(arch.length)})`)),
      h('p', { class: 'xs muted' }, 'لا تُسحب ولا تُعدَّل، ولا يُحذف منها شيء، وتبقى نتائج الاختبارات المسحوبة منها سابقاً كما هي.'),
      arch.map((a) => archivedRow(a, root))) : null);
  if (!D.sources.length) list.append(h('p', { class: 'empty' }, 'لا توجد مصادر بعد. اضغط «إضافة مصدر» للبدء.'));
  D.sources.forEach((s) => list.append(card(s, root)));
  // تحديث تلقائي ما دام سحب قائماً
  if (D.sources.some((s) => SL.runActive(s.last_run))) timer = setTimeout(() => { if (root.isConnected) render(root).catch(() => {}); }, 6000);
}

function card(s, root) {
  const st = SL.statusView(s); const lr = s.last_run;
  const reload = () => render(root).catch(fail);
  const btn = (label, ico, onclick, kind = 'soft') => h('button', { class: `btn sm ${kind}`, type: 'button', onclick }, ico ? icon(ico, 16) : null, label);
  const acts = [];
  if (s.method !== 'رفع Excel') acts.push(btn('تحديث الآن', 'swap', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await rpc('rpc_source_run_now', { p_source: s.id }); toast('بدأ السحب'); await reload(); } catch (er) { fail(er); b.disabled = false; }
  }, 'primary'));
  acts.push(btn('رفع Excel', 'layers', () => uploadFlow(s, reload)));
  acts.push(btn('ربط الأعمدة', 'grid', () => mappingSheet(s, reload)));
  acts.push(btn('سجل المزامنة', 'list', () => runsSheet(s)));
  if (s.mode === 'مقارنة فقط') acts.push(btn('تفعيل التحديث الفعلي', 'check', () => setMode(s, 'تحديث فعلي', reload), s.can_activate ? 'primary' : 'soft'));
  else acts.push(btn('رجوع إلى مقارنة فقط', 'eye', () => setMode(s, 'مقارنة فقط', reload)));
  acts.push(btn('تعديل', 'edit', () => editSheet(s, reload), 'ghost'));
  acts.push(s.state === 'يعمل' ? btn('إيقاف', 'x', () => setState(s, 'موقوف يدوياً', reload), 'ghost') : btn('إعادة التشغيل', 'check', () => setState(s, 'يعمل', reload), 'ghost'));
  // أرشفة بدل الحذف (قرار عبدالكريم 2026-11-23): لمسؤول الشعبة وحده، وتأكيد بسبب يُسجَّل باسمه ووقته (والقاعدة تفحص ذلك أيضاً)
  if (D.can_archive) acts.push(btn('أرشفة', 'inbox', () => archiveSource(s, reload), 'ghost'));
  return h('section', { class: `card src-card src-${st.kind}` },
    h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, s.name), badge(st.label, st.kind)),
    h('div', { class: 'src-meta xs muted' },
      h('span', null, `النوع: ${s.kind_name}`), h('span', null, `الطريقة: ${s.method}`),
      s.has_student_data ? h('span', null, 'يحتوي بيانات طلاب') : null,
      h('span', null, `الجدول: ${s.auto_on ? SL.scheduleText(s.schedule, s.method) : 'التحديث التلقائي موقوف'}`),
      s.link ? h('span', { dir: 'ltr' }, s.link) : null,
      h('span', null, `ربط الأعمدة: الإصدار ${nf(s.mapping_version || 0)}`)),
    // الرابط العام لمصدر فيه بيانات طلاب: القبول المسجّل باسم المسؤول ووقته (قرار عبدالكريم 2026-11-23)
    s.public_ack ? h('p', { class: 'xs src-warn' }, icon('alert', 14), ` ${T.public_students_warn || ''} قبِله ${s.public_ack.by || '—'} في ${whenY(s.public_ack.at)}.`) : null,
    s.state !== 'يعمل' && s.state_reason && s.state_reason !== lr?.error ? h('p', { class: 'err' }, s.state_reason) : null,
    h('div', { class: `src-last ${lr ? SL.RUN_KIND[lr.status] : ''}` }, h('b', null, 'آخر سحب: '), lr ? `${when(lr.finished_at || lr.queued_at)} — ` : '', SL.runSummary(lr)),
    s.mode === 'مقارنة فقط' && !s.can_activate ? h('p', { class: 'xs muted' }, 'التفعيل متاح بعد مقارنة ناجحة بالربط الحالي.') : null,
    h('div', { class: 'src-acts' }, acts));
}

// ---------- التفعيل والإيقاف (تأكيد وسبب، ويُسجَّل) ----------
function askReason(title, intro, ok, kind = 'primary') {
  return new Promise((res) => {
    const r = reasonField(); let done = false;
    sheet({ title, body: h('div', null, h('p', null, intro), field('السبب', r)), onClose: () => { if (!done) res(null); },
      actions: [{ label: ok, kind, onClick: (close) => { if (r.value.trim().length < 5) { toast('اكتب السبب (5 أحرف على الأقل)', 'bad'); return; } done = true; res(r.value.trim()); close(); } }, { label: 'تراجع' }] });
  });
}
async function setMode(s, mode, reload) {
  if (mode === 'تحديث فعلي' && !s.can_activate) { toast('شغّل مقارنة ناجحة بالربط الحالي أولاً، وراجع تقريرها', 'bad'); return; }
  const why = await askReason(mode === 'تحديث فعلي' ? `تفعيل التحديث الفعلي: ${s.name}` : `رجوع إلى مقارنة فقط: ${s.name}`,
    mode === 'تحديث فعلي' ? (T.step_activate || '') + ' تأكد أنك راجعت تقرير المقارنة.' : 'لن يُكتب شيء بعد الآن من هذا المصدر حتى تفعّله من جديد.', mode === 'تحديث فعلي' ? 'تفعيل' : 'رجوع');
  if (!why) return;
  try { await rpc('rpc_source_set_mode', { p_source: s.id, p_mode: mode, p_reason: why }); toast(mode === 'تحديث فعلي' ? 'فُعّل التحديث الفعلي' : 'عاد إلى مقارنة فقط'); reload(); } catch (e) { fail(e); }
}
async function setState(s, state, reload) {
  const why = await askReason(state === 'يعمل' ? `إعادة تشغيل: ${s.name}` : `إيقاف: ${s.name}`, state === 'يعمل' ? 'يعود السحب في مواعيده.' : 'يتوقف السحب التلقائي و«تحديث الآن» لهذا المصدر وحده.', state === 'يعمل' ? 'إعادة التشغيل' : 'إيقاف', state === 'يعمل' ? 'primary' : 'danger');
  if (!why) return;
  try { await rpc('rpc_source_set_state', { p_source: s.id, p_state: state, p_reason: why }); reload(); } catch (e) { fail(e); }
}

// ---------- الأرشفة والاستعادة (لمسؤول الشعبة وحده) ----------
async function archiveSource(s, reload) {
  const why = await askReason(`أرشفة: ${s.name}`, T.archive_confirm || 'الأرشفة توقف سحب هذا المصدر فوراً وتخفيه من القائمة. لا يُحذف شيء، ويمكنك استعادته متى شئت.', 'أرشفة', 'danger');
  if (!why) return;
  try { await rpc('rpc_source_archive', { p_source: s.id, p_reason: why }); toast('أُرشف المصدر، وتوقف سحبه'); reload(); } catch (e) { fail(e); }
}
function archivedRow(a, root) {
  const reload = () => render(root).catch(fail);
  const restore = async () => {
    const why = await askReason(`استعادة: ${a.name}`, T.restore_confirm || 'الاستعادة ترجعه إلى القائمة «موقوفاً يدوياً» و«مقارنة فقط».', 'استعادة');
    if (!why) return;
    try { await rpc('rpc_source_restore', { p_source: a.id, p_reason: why }); toast('استُعيد المصدر «موقوفاً يدوياً»'); reload(); } catch (e) { fail(e); }
  };
  return h('div', { class: 'list-item src-arch-row' },
    h('div', null, h('b', null, a.name), h('div', { class: 'xs muted' }, `${a.kind_name} • ${a.method} • أرشفه ${a.by || '—'} في ${whenY(a.at)}`),
      a.reason ? h('div', { class: 'xs' }, `السبب: ${a.reason}`) : null),
    D.can_archive ? h('button', { class: 'btn sm soft', type: 'button', onclick: restore }, icon('back', 16), 'استعادة') : null);
}

// ---------- سجل المزامنة ----------
async function runsSheet(s) {
  const runs = await rpc('rpc_source_runs', { p_source: s.id, p_limit: 30 }).catch((e) => { fail(e); return null; });
  if (!runs) return;
  sheet({ title: `سجل المزامنة: ${s.name}`, body: h('div', { class: 'src-runs' }, runs.length ? runs.map((r) => h('details', { class: 'list-item' },
    h('summary', null, h('div', { class: 'row between' }, h('b', null, `${when(r.finished_at || r.queued_at)} — ${r.trigger}${r.actor ? ' (' + r.actor + ')' : ''}`), badge(r.status, SL.RUN_KIND[r.status] || 'gray')),
      h('div', { class: 'xs muted' }, r.error ? 'السبب في التفاصيل أدناه' : SL.runSummary(r), r.ms ? ` • ${(r.ms / 1000).toFixed(1)} ث` : '')),
    reportView(r))) : h('p', { class: 'empty' }, 'لا تشغيلات بعد.')), actions: [{ label: 'إغلاق' }] });
}
function reportView(r) {
  const R = r.report || {}; const box = h('div', { class: 'src-report xs' });
  const ex = (title, arr, fmt) => (arr?.length ? h('div', null, h('b', null, title), h('ul', null, arr.map((x) => h('li', null, fmt(x))))) : null);
  box.append(
    h('div', null, `الصفوف المقروءة ${nf(r.rows_read)} • مضاف ${nf(r.added)} • محدَّث ${nf(r.updated)} • مختفٍ ${nf(r.missing)} • عاد ${nf(r.returned)} • مرفوض ${nf(r.rejected)} • كما هو ${nf(r.unchanged)}${r.absent ? ` • غائب ${nf(r.absent)}` : ''}${r.match_pct != null ? ` • التطابق ${Math.round(Number(r.match_pct))}٪` : ''}`),
    // نطاق الملف: «اختفى من المصدر» وحارس النقص داخل هذا النطاق فقط
    R.scopes?.length ? h('div', null, h('b', null, 'نطاق الملف: '), R.scopes.join('؛ '), h('span', { class: 'muted' }, ' — «اختفى من المصدر» يُحسب داخل هذا النطاق فقط، وما خارجه لا يُمسّ.')) : '',
    R.late_results ? h('div', null, `نتائج متأخرة («لم تُرصد» ← نتيجة فعلية): ${nf(R.late_results)}`) : '',
    R.new_variants ? h('div', null, `صيغ جديدة لأرقام موجودة («يحتاج تأكيد»): ${nf(R.new_variants)}`) : '',
    r.error ? h('p', { class: 'err' }, r.error) : '',
    ex('أمثلة سيُضاف/أُضيف (بالرموز):', R.added_examples, (x) => `${x.c} — الصف ${x.r ?? '—'}${x.note ? ' — ' + x.note : ''}${x.res ? ' — ' + x.res : ''}`),
    ex('أمثلة تغيّرت:', R.updated_examples, (x) => `${x.c} — الصف ${x.r} — ${(x.f || []).join('، ')}${x.from ? ` (${x.from} ← ${x.to})` : ''}`),
    ex('أمثلة «غائب»:', R.absent_examples, (x) => `${x.c} — الصف ${x.r}`),
    ex('أمثلة اختفت من المصدر:', R.missing_examples, (x) => x.c),
    ex('أمثلة مرفوضة:', R.rejected_examples, (x) => `الصف ${x.r} (${x.c}): ${x.why}`),
    R.unmapped_columns?.length ? h('div', null, h('b', null, 'أعمدة في الملف لم تُربط (تُتجاهل): '), R.unmapped_columns.join('، ')) : '',
    r.exam_batch ? h('div', null, `دفعة الاختبارات رقم ${nf(r.exam_batch)} (التراجع من «دفعات الاختبارات»)`) : '');
  return box;
}

// ---------- ربط الأعمدة ----------
async function mappingSheet(s, reload, { header: given, onSaved } = {}) {
  const det = await rpc('rpc_source_detail', { p_source: s.id }).catch((e) => { fail(e); return null; });
  if (!det) return;
  const header = given || det.header || [];
  const kind = D.kinds.find((k) => k.code === s.kind);
  const isGen = s.kind === 'GENERIC';
  let fields = (isGen ? (det.mapping?.fields || []) : det.fields).map((f) => ({ ...f }));
  const map = { ...(det.mapping?.map || {}) };
  let keys = [...(det.mapping?.key_fields || fields.filter((f) => f.key_part).map((f) => f.key))];
  const forb = SL.forbiddenCols(header, D.forbidden, kind.target);
  const box = h('div'); const probs = h('div');
  const opts = (cur) => [h('option', { value: '' }, header.length ? 'تلقائي (بالاسم)' : '— اكتب اسم العمود —'),
    ...(cur && !header.includes(cur) ? [h('option', { value: cur, selected: '' }, `«${cur}» (غير موجود في الملف)`)] : []),
    ...header.filter((x) => x && !forb.includes(x)).map((x) => h('option', { value: x, selected: x === cur ? '' : null }, x))];
  function draw() {
    const res = SL.resolveFields(fields, map, header, s.fixed);
    box.replaceChildren(
      h('p', { class: 'muted xs' }, T.step_map || ''),
      header.length ? null : h('p', { class: 'hint' }, 'لم يُقرأ صف العناوين بعد. شغّل «تحديث الآن» أو ارفع الملف، أو اكتب أسماء الأعمدة كما هي في الملف.'),
      forb.length ? h('p', { class: 'xs muted' }, `متجاهَل دائماً (بيانات طالب شخصية): ${forb.join('، ')}`) : null,
      ...res.map((r, i) => {
        const sel = header.length ? h('select', { onchange: (e) => { map[r.key] = e.target.value; draw(); } }, opts(map[r.key] || ''))
          : h('input', { type: 'text', value: map[r.key] || '', placeholder: r.label, onchange: (e) => { map[r.key] = e.target.value.trim(); draw(); } });
        const kp = h('input', { type: 'checkbox', checked: !!(keys.includes(r.key)), onchange: (e) => { keys = e.target.checked ? [...new Set([...keys, r.key])] : keys.filter((k) => k !== r.key); draw(); } });
        const state = r.how === 'ثابت' ? `قيمة ثابتة: ${r.value}` : r.idx >= 0 ? `يُقرأ من «${r.column}»` : r.how === 'مفقود' ? `العمود «${r.column}» غير موجود` : r.required ? 'مطلوب — لا عمود له' : 'لا عمود (يبقى فارغاً)';
        return h('div', { class: 'src-map-row' },
          h('div', null, h('b', null, r.label), r.required ? h('span', { class: 'req', title: 'مطلوب' }, ' *') : null,
            isGen ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { fields.splice(i, 1); keys = keys.filter((k) => k !== r.key); draw(); } }, 'حذف الحقل') : null,
            h('div', { class: `xs ${r.idx >= 0 || r.how === 'ثابت' ? 'muted' : r.required || r.how === 'مفقود' ? 'src-bad' : 'muted'}` }, state)),
          r.how === 'ثابت' ? h('span', { class: 'xs muted' }, 'من «تعديل»') : sel,
          h('label', { class: 'xs src-key' }, kp, ' جزء من المفتاح'));
      }),
      isGen ? newFieldRow() : null);
    const p = SL.mappingProblems(res, keys);
    probs.replaceChildren(...(p.length ? [h('div', { class: 'err' }, h('b', null, 'قبل الحفظ: '), p.join('؛ '))] : []));
  }
  // النوع «عام»: إضافة حقل باسمه ونوعه (المفتاح الداخلي يُولَّد f1، f2…)
  function newFieldRow() {
    const lab = h('input', { type: 'text', placeholder: 'اسم الحقل الجديد' });
    const ty = h('select', null, ['نص', 'رقم', 'تاريخ'].map((x) => h('option', { value: x }, x)));
    return h('div', { class: 'src-map-row' }, lab, ty, h('button', { class: 'btn sm soft', type: 'button', onclick: () => {
      if (!lab.value.trim()) { toast('اكتب اسم الحقل', 'bad'); return; }
      const nxt = fields.length ? Math.max(...fields.map((f) => Number(String(f.key).slice(1)) || 0)) : 0;
      fields.push({ key: SL.genericKey(nxt), label: lab.value.trim(), type: ty.value, required: false, aliases: [] });
      draw();
    } }, icon('plus', 16), 'إضافة حقل'));
  }
  draw();
  const reason = reasonField('مثال: ربط أول مرة، أو تغيّر اسم عمود');
  sheet({ title: `ربط الأعمدة: ${s.name}`, body: h('div', null, box, probs, field('سبب الحفظ', reason, `الإصدار الحالي ${nf(det.mapping?.version || 0)}؛ الحفظ يصنع إصداراً جديداً ولا يغيّر القديم.`)),
    actions: [{ label: 'حفظ الربط', kind: 'primary', onClick: async (close) => {
      if (reason.value.trim().length < 3) { toast('اكتب سبب الحفظ', 'bad'); return; }
      const r = await rpc('rpc_source_mapping_save', { p_source: s.id, p: { map, key_fields: keys, fields: isGen ? fields : undefined, reason: reason.value.trim() } });
      toast(`حُفظ الربط (الإصدار ${nf(r.version)})`); close(); onSaved?.(); reload?.();
    } }, { label: 'إغلاق' }] });
}

// ---------- تعديل المصدر ----------
function editSheet(s, reload) {
  const name = h('input', { type: 'text', value: s.name });
  const url = h('input', { type: 'url', dir: 'ltr', placeholder: s.link ? `الحالي: ${s.link} (اتركه فارغاً للإبقاء عليه)` : 'https://docs.google.com/spreadsheets/d/…' });
  const sheetName = h('input', { type: 'text', value: s.sheet_name || '', placeholder: 'اختياري: اسم الورقة إن لم يكن في الرابط رقمها' });
  const auto = h('input', { type: 'checkbox', checked: !!(s.auto_on) });
  const sc = s.custom_schedule ? s.schedule : null;
  const type = h('select', null, [['', `الافتراضي من الإعدادات (${SL.scheduleText(s.custom_schedule ? null : s.schedule, s.method)})`], ['يومي', 'يومياً في وقت'], ['أسبوعي', 'أسبوعياً في يوم ووقت'], ['يدوي', 'يدوي فقط']].map(([v, l]) => h('option', { value: v, selected: (sc?.type || '') === v ? '' : null }, l)));
  const at = h('input', { type: 'text', inputmode: 'numeric', dir: 'ltr', placeholder: '01:30', value: sc?.at || '' });
  const day = h('select', null, ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d) => h('option', { value: d, selected: sc?.day === d ? '' : null }, d)));
  const kind = D.kinds.find((k) => k.code === s.kind);
  const fixedIns = kind.code === 'EXAMS' ? fixedInputs(s.fixed) : null;
  const reason = reasonField();
  sheet({ title: `تعديل: ${s.name}`, body: h('div', null, field('الاسم', name),
    s.method !== 'رفع Excel' ? field('رابط الملف', url, 'تغيير الرابط يعيد المصدر إلى «مقارنة فقط».') : null,
    s.method !== 'رفع Excel' ? field('اسم الورقة', sheetName) : null,
    fixedIns ? fixedIns.el : null,
    s.method !== 'رفع Excel' ? h('label', { class: 'field row' }, auto, h('span', null, 'التحديث التلقائي في مواعيده')) : null,
    s.method !== 'رفع Excel' ? field('الجدول', type) : null, s.method !== 'رفع Excel' ? field('الوقت (للجدول اليومي أو الأسبوعي)', at) : null, s.method !== 'رفع Excel' ? field('اليوم (للأسبوعي)', day) : null,
    field('سبب التعديل', reason)),
    actions: [{ label: 'حفظ', kind: 'primary', onClick: async (close) => {
      if (reason.value.trim().length < 3) { toast('اكتب سبب التعديل', 'bad'); return; }
      const p = { id: s.id, name: name.value.trim(), reason: reason.value.trim() };
      if (url.value.trim()) p.url = url.value.trim();
      // تغيير الرابط العام لمصدر فيه بيانات طلاب: التنبيه ثم «أفهم وأوافق» (يُسجَّل باسمك ووقته)
      if (p.url && s.has_student_data && s.method === 'رابط عام') {
        if (!(await confirmBox(T.public_students_warn || 'هذا الملف فيه بيانات طلاب، والرابط العام يتيحه لكل من يملك الرابط.', T.public_students_ok || 'أفهم وأوافق'))) return;
        p.public_ack = true;
      }
      if (s.method !== 'رفع Excel') {
        p.sheet_name = sheetName.value.trim(); p.auto_on = auto.checked;
        p.schedule = !type.value ? null : type.value === 'يومي' ? { type: 'يومي', at: at.value.trim() } : type.value === 'أسبوعي' ? { type: 'أسبوعي', day: day.value, at: at.value.trim() } : { type: 'يدوي' };
      }
      if (fixedIns) p.fixed = fixedIns.value();
      await rpc('rpc_source_save', { p }); toast('حُفظ'); close(); reload();
    } }, { label: 'تراجع' }] });
}
// قيم ثابتة لمصدر الاختبارات (ملف لشهر واحد): نوع الاختبار والسنة والشهر/الفصل
function fixedInputs(fx = {}) {
  const k = h('select', null, [['', 'من عمود في الملف'], ['تنشيطي', 'تنشيطي (شهري)'], ['فصلي', 'فصلي']].map(([v, l]) => h('option', { value: v, selected: (fx.exam_kind || '') === v ? '' : null }, l)));
  const y = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'من عمود في الملف (مثال 1448)', value: fx.h_year || '' });
  const n = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'من عمود في الملف (1–12)', value: fx.period_no || '' });
  return { el: h('div', { class: 'card flat' }, h('b', null, 'قيم ثابتة لهذا المصدر (إن كان الملف لاختبار واحد)'), field('نوع الاختبار', k), field('السنة الهجرية', y), field('الشهر أو الفصل', n)),
    value: () => ({ exam_kind: k.value, h_year: y.value.trim(), period_no: n.value.trim() }) };
}

// ---------- رفع Excel: سحب وإفلات ← معاينة ← مقارنة ← تأكيد ----------
function uploadFlow(s, reload, { onDone } = {}) {
  const body = h('div'); let close;
  const pick = h('input', { type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hidden: true });
  const drop = h('div', { class: 'src-drop', tabindex: '0', role: 'button', onclick: () => pick.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') pick.click(); } },
    icon('layers', 28), h('b', null, 'اسحب ملف Excel إلى هنا أو اضغط لاختياره'), h('span', { class: 'xs muted' }, T.upload_help || ''));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('on'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) got(f); });
  pick.addEventListener('change', () => { const f = pick.files?.[0]; if (f) got(f); });
  body.append(drop, pick);
  close = sheet({ title: `رفع Excel: ${s.name}`, body, actions: [{ label: 'إغلاق' }] });

  async function got(file) {
    body.replaceChildren(h('p', { class: 'loading' }, 'يُقرأ الملف في جهازك…'));
    try {
      const buf = await file.arrayBuffer();
      const [x, hash] = await Promise.all([readXlsx(buf, { maxRows: (D.max_rows || 60000) + 10 }), sha256Hex(buf)]);
      const sheets = x.sheets.filter((sh) => sh.rows.length);
      if (!sheets.length) throw new Error('لا أوراق فيها بيانات في هذا الملف');
      let cur = sheets.find((sh) => s.sheet_name && SL.norm(sh.name) === SL.norm(s.sheet_name)) || sheets[0];
      const det = await rpc('rpc_source_detail', { p_source: s.id });
      const preview = () => {
        const hi = SL.headerIndex(cur.rows); const header = (cur.rows[hi] || []).map((c) => String(c ?? '').trim()); const rows = SL.bodyRows(cur.rows, hi);
        const fields = s.kind === 'GENERIC' ? (det.mapping?.fields || []) : det.fields;
        const res = SL.resolveFields(fields, det.mapping?.map || {}, header, s.fixed);
        const probs = SL.mappingProblems(res, det.mapping?.key_fields || []);
        const sel = sheets.length > 1 ? field('الورقة', h('select', { onchange: (e) => { cur = sheets.find((q) => q.name === e.target.value); preview(); } }, sheets.map((q) => h('option', { value: q.name, selected: q === cur ? '' : null }, q.name)))) : null;
        const tbl = h('div', { class: 'src-prev' }, h('table', null, h('thead', null, h('tr', null, header.map((c) => h('th', null, c)))),
          h('tbody', null, rows.slice(0, 5).map((r) => h('tr', null, header.map((_, i) => h('td', null, r[i] ?? '')))))));
        body.replaceChildren(h('p', null, h('b', null, file.name), ` — ${nf(rows.length)} صفاً`), sel,
          h('p', { class: 'xs muted' }, 'معاينة أول 5 صفوف (في جهازك فقط):'), tbl,
          h('div', { class: 'xs' }, res.map((r) => h('div', { class: r.idx >= 0 || r.how === 'ثابت' ? 'muted' : r.required ? 'src-bad' : 'muted' }, `${r.label}: ${r.how === 'ثابت' ? 'قيمة ثابتة ' + r.value : r.idx >= 0 ? '«' + r.column + '»' : r.required ? 'لا عمود له' : '—'}`))),
          probs.length ? h('div', { class: 'err' }, probs.join('؛ '), ' ', h('button', { class: 'btn sm soft', type: 'button', onclick: () => { close(); mappingSheet(s, reload, { header }); } }, 'افتح ربط الأعمدة')) : null,
          h('div', { class: 'btns', style: 'margin-top:12px' },
            h('button', { class: 'btn primary', type: 'button', disabled: !!(probs.length), onclick: (e) => send(e.currentTarget, header, rows, hash, file.name, true) }, 'مقارنة (لا يُكتب شيء)')));
      };
      preview();
    } catch (e) { body.replaceChildren(h('p', { class: 'err' }, e.message || 'تعذّر قراءة الملف'), drop, pick); }
  }
  async function send(b, header, rows, hash, name, compareOnly) {
    b.disabled = true;
    const st = h('p', { class: 'loading', role: 'status' }, 'يُرسل الملف على دفعات…');
    body.append(st);
    try {
      const run = await uploadRows(s, header, rows, hash, name, compareOnly, (p) => { st.textContent = `يُرسل الملف… ${p}٪`; });
      st.textContent = 'تجري المقارنة (أقل من دقيقة)…';
      const r = await waitRun(run);
      st.remove();
      body.append(h('div', { class: 'card flat' }, h('div', { class: 'row between' }, h('b', null, compareOnly ? 'نتيجة المقارنة' : 'نتيجة التطبيق'), badge(r.status, SL.RUN_KIND[r.status] || 'gray')),
        h('p', null, SL.runSummary(r)), reportView(r)));
      if (compareOnly && r.status === 'نجح' && s.mode === 'تحديث فعلي') {
        body.append(h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
          if (!(await confirmBox('تأكيد التطبيق: يكتب الفرق فعلاً في القاعدة كما في التقرير أعلاه. كل تغيير يُسجَّل ويمكن الرجوع عنه.', 'تطبيق'))) return;
          send(e.currentTarget, header, rows, hash, name, false);
        } }, 'تأكيد التطبيق')));
      } else if (compareOnly && r.status === 'نجح' && s.mode === 'مقارنة فقط') {
        body.append(h('p', { class: 'hint' }, 'المصدر في وضع «مقارنة فقط»: لم يُكتب شيء. إن كان التقرير صحيحاً فاضغط «تفعيل التحديث الفعلي» في بطاقته ثم ارفع الملف مرة أخرى.'));
      }
      onDone?.(r); reload?.();
    } catch (e) { st.remove(); fail(e); b.disabled = false; }
  }
}
export async function uploadRows(s, header, rows, hash, name, compareOnly, progress) {
  const b = await rpc('rpc_source_upload_begin', { p_source: s.id, p: { header, rows: rows.length, file_hash: hash, file_name: name, compare_only: compareOnly } });
  const size = b.chunk_rows || 2000;
  for (let i = 0, no = 0; i < rows.length; i += size, no++) {
    await rpc('rpc_source_upload_chunk', { p_run: b.run, p_no: no, p_start: 2 + i, p_rows: rows.slice(i, i + size) });
    progress?.(Math.round(((i + size) / Math.max(rows.length, 1)) * 100));
  }
  await rpc('rpc_source_upload_finish', { p_run: b.run });
  return b.run;
}
// انتظار نتيجة التشغيل (المؤقت يشغّل المحرك كل دقيقة)
export async function waitRun(run, maxMs = 150000) {
  const t0 = Date.now();
  for (;;) {
    const r = await rpc('rpc_source_run', { p_run: run });
    if (!SL.runActive(r)) return r;
    if (Date.now() - t0 > maxMs) return r;
    await sleep(4000);
  }
}

// ---------- معالج «إضافة مصدر» (6 خطوات، صفحة كاملة في اللوحة) ----------
function wizard(root) {
  clearTimeout(timer);
  const W = { step: 1, name: '', kind: D.kinds[0]?.code, students: D.kinds[0]?.student_data, method: null, url: '', sheet: '', fixed: null, id: null, file: null, header: null, rows: null, hash: null, run: null, ack: false };
  const STEPS = ['الاسم والنوع', 'الطريقة', 'الرابط أو الملف', 'ربط الأعمدة', 'المقارنة', 'التفعيل'];
  const wrap = h('div', { class: 'src-wiz' });
  root.replaceChildren(h('button', { class: 'btn sm ghost', type: 'button', onclick: () => render(root).catch(fail) }, icon('back', 16), 'رجوع إلى المصادر'), wrap);
  const kindOf = () => D.kinds.find((k) => k.code === W.kind);
  const needAck = () => W.method === 'رابط عام' && !!W.students;
  const nav = (next, label = 'التالي', can = true) => h('div', { class: 'btns', style: 'margin-top:14px' },
    W.step > 1 && !W.id ? h('button', { class: 'btn soft', type: 'button', onclick: () => { W.step--; draw(); } }, 'السابق') : null,
    // disabled منطقي لا نص: «''» كان لا يعطّل الزر (فحص الشاشات 2026-11-23)، فـ«التالي» يبقى معطلاً حتى «أفهم وأوافق»
    next ? h('button', { class: 'btn primary', type: 'button', disabled: !can, onclick: next }, label) : null);
  function draw() {
    const head = h('ol', { class: 'src-steps' }, STEPS.map((t, i) => h('li', { class: i + 1 === W.step ? 'on' : i + 1 < W.step ? 'done' : '' }, h('span', null, nf(i + 1)), t)));
    const k = kindOf();
    let body;
    if (W.step === 1) {
      const name = h('input', { type: 'text', value: W.name, placeholder: 'مثال: نتائج اختبارات رجب' });
      const kind = h('select', { onchange: (e) => { W.kind = e.target.value; W.students = kindOf().student_data; W.ack = false; W.name = name.value; draw(); } }, D.kinds.map((x) => h('option', { value: x.code, selected: x.code === W.kind ? '' : null }, x.name)));
      const stu = h('input', { type: 'checkbox', checked: !!(W.students), onchange: (e) => { W.students = e.target.checked; W.ack = false; } });
      body = h('div', null, h('p', { class: 'muted' }, T.step_name || ''), field('اسم المصدر', name), field('نوع البيانات', kind, k?.note || ''),
        h('label', { class: 'field row' }, stu, h('span', null, 'يحتوي بيانات طلاب (أسماء أو أرقام تسجيل)')), h('small', { class: 'xs muted' }, T.public_students_hint || ''),
        nav(() => { if (name.value.trim().length < 2) { toast('اكتب اسماً للمصدر', 'bad'); return; } W.name = name.value.trim(); W.step = 2; draw(); }));
    } else if (W.step === 2) {
      body = h('div', null, h('p', { class: 'muted' }, T.step_method || ''), ...METHODS.map((m) => {
        const blocked = m === 'حساب الخدمة' && !D.sa_on ? (T.sa_blocked || 'غير متاح بعد') : null;
        const warn = m === 'رابط عام' && W.students ? (T.public_students_warn || '') : null;
        return h('button', { type: 'button', class: `card tap src-opt${W.method === m ? ' on' : ''}${blocked ? ' off' : ''}`, disabled: !!(blocked), onclick: () => { if (W.method !== m) W.ack = false; W.method = m; draw(); } },
          h('b', null, m), h('div', { class: 'xs muted' }, METHOD_NOTE[m]), blocked ? h('div', { class: 'xs src-bad' }, `غير متاح: ${blocked}`) : null,
          warn ? h('div', { class: 'xs src-warn' }, warn) : null);
      }),
      // الرابط العام لمصدر فيه بيانات طلاب: تنبيه ثم «أفهم وأوافق» (يُسجَّل في سجل المصدر باسمك ووقته)، ولا «التالي» قبله
      needAck() ? h('div', { class: 'hint src-ackbox' }, icon('alert', 18), h('div', null, h('p', null, T.public_students_warn || ''),
        W.ack ? h('b', null, `✓ ${T.public_students_ok || 'أفهم وأوافق'}`)
          : h('button', { class: 'btn primary sm', type: 'button', onclick: () => { W.ack = true; draw(); } }, T.public_students_ok || 'أفهم وأوافق'))) : null,
      nav(() => { W.step = 3; draw(); }, 'التالي', !!W.method && (!needAck() || W.ack)));
    } else if (W.step === 3) {
      const fx = k.code === 'EXAMS' ? fixedInputs(W.fixed || {}) : null;
      const reason = reasonField('مثال: إضافة ملف لجنة الاختبارات');
      if (W.method === 'رفع Excel') {
        const pick = h('input', { type: 'file', accept: '.xlsx', hidden: true, onchange: async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try {
            const buf = await f.arrayBuffer(); const x = await readXlsx(buf); const sh = x.sheets.find((q) => q.rows.length);
            if (!sh) throw new Error('لا بيانات في الملف');
            const hi = SL.headerIndex(sh.rows); W.header = sh.rows[hi].map((c) => String(c ?? '').trim()); W.rows = SL.bodyRows(sh.rows, hi); W.hash = await sha256Hex(buf); W.file = f.name;
            info.textContent = `${f.name}: ورقة «${sh.name}»، ${nf(W.rows.length)} صفاً، ${nf(W.header.length)} عموداً`;
          } catch (er) { info.textContent = er.message; }
        } });
        const info = h('p', { class: 'xs muted' }, W.file ? `${W.file}: ${nf(W.rows?.length || 0)} صفاً` : 'اختر الملف (يُقرأ في جهازك فقط).');
        const choose = h('div', { class: 'src-drop', tabindex: '0', role: 'button', onclick: () => pick.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') pick.click(); } }, icon('layers', 26), h('b', null, 'اختر ملف Excel'), pick);
        body = h('div', null, h('p', { class: 'muted' }, T.upload_help || ''), choose, info, fx?.el, field('سبب الإضافة', reason),
          nav(() => saveSource(reason.value, fx), 'حفظ المصدر'));
      } else {
        const url = h('input', { type: 'url', dir: 'ltr', value: W.url, placeholder: 'https://docs.google.com/spreadsheets/d/…' });
        const sheetName = h('input', { type: 'text', value: W.sheet, placeholder: 'اختياري' });
        body = h('div', null, h('p', { class: 'muted' }, T.step_link || ''),
          W.method === 'رابط عام' ? h('div', { class: 'hint' }, icon('info', 18), h('span', null, T.share_help || '')) : h('div', { class: 'hint' }, icon('info', 18), h('span', null, 'شارك الملف مع بريد حساب الخدمة بصلاحية «عارض» (الدليل: خطوات حساب الخدمة).')),
          field('رابط الملف', url), field('اسم الورقة', sheetName, 'إن لم يكن في الرابط رقم الورقة تُقرأ الورقة بهذا الاسم، وإلا فالورقة الأولى.'), fx?.el, field('سبب الإضافة', reason),
          nav(() => { W.url = url.value.trim(); W.sheet = sheetName.value.trim(); saveSource(reason.value, fx); }, 'حفظ المصدر'));
      }
    } else if (W.step === 4) {
      const s = { id: W.id, name: W.name, kind: W.kind, fixed: W.fixed || {}, method: W.method, sheet_name: W.sheet };
      const readBtn = h('button', { class: 'btn soft', type: 'button', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; st.textContent = 'يُقرأ صف العناوين من الملف…';
        try { const r = await rpc('rpc_source_run_now', { p_source: W.id }); W.run = r.run; const x = await waitRun(r.run, 90000); W.header = (await rpc('rpc_source_detail', { p_source: W.id })).header; st.textContent = W.header ? `قُرئت ${nf(W.header.length)} عموداً. ${SL.runSummary(x)}` : `لم يُقرأ صف العناوين: ${SL.runSummary(x)}`; }
        catch (er) { fail(er); } finally { b.disabled = false; }
      } }, 'اقرأ صف العناوين الآن');
      const st = h('p', { class: 'xs muted' }, W.header ? `صف العناوين: ${nf(W.header.length)} عموداً.` : '');
      body = h('div', null, h('p', { class: 'muted' }, T.step_map || ''), W.method !== 'رفع Excel' ? readBtn : null, st,
        h('div', { class: 'btns' }, h('button', { class: 'btn soft', type: 'button', onclick: () => mappingSheet(s, null, { header: W.header || undefined }) }, 'افتح ربط الأعمدة')),
        h('p', { class: 'xs muted' }, 'الربط الافتراضي يقرأ الأعمدة المعروفة بأسمائها؛ افتح الشاشة لمراجعته أو تعديله.'),
        nav(() => { W.step = 5; draw(); }, 'الربط صحيح، تابع'));
    } else if (W.step === 5) {
      const out = h('div');
      const go = h('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; out.replaceChildren(h('p', { class: 'loading' }, 'تجري المقارنة (أقل من دقيقة)…'));
        try {
          const s = { id: W.id };
          const run = W.method === 'رفع Excel' ? await uploadRows(s, W.header, W.rows, W.hash, W.file, true) : (await rpc('rpc_source_run_now', { p_source: W.id })).run;
          const r = await waitRun(run); W.lastRun = r;
          out.replaceChildren(h('div', { class: 'card flat' }, h('div', { class: 'row between' }, h('b', null, 'نتيجة المقارنة'), badge(r.status, SL.RUN_KIND[r.status] || 'gray')), h('p', null, SL.runSummary(r)), reportView(r)));
          if (r.status === 'نجح') out.append(nav(() => { W.step = 6; draw(); }, 'التالي: التفعيل'));
        } catch (er) { out.replaceChildren(); fail(er); } finally { b.disabled = false; }
      } }, 'شغّل المقارنة (لا يُكتب شيء)');
      body = h('div', null, h('p', { class: 'muted' }, T.step_compare || ''), go, out);
    } else {
      body = h('div', null, h('p', { class: 'muted' }, T.step_activate || ''), W.lastRun ? h('p', null, SL.runSummary(W.lastRun)) : null,
        h('div', { class: 'btns' },
          h('button', { class: 'btn primary', type: 'button', onclick: async () => { await setMode({ id: W.id, name: W.name, can_activate: true }, 'تحديث فعلي', () => render(root).catch(fail)); } }, 'تفعيل التحديث الفعلي'),
          h('button', { class: 'btn soft', type: 'button', onclick: () => render(root).catch(fail) }, 'أبقِه «مقارنة فقط» الآن')));
    }
    wrap.replaceChildren(head, h('section', { class: 'card' }, h('h2', null, `${nf(W.step)}. ${STEPS[W.step - 1]}`), body));
  }
  async function saveSource(reason, fx) {
    if (String(reason || '').trim().length < 3) { toast('اكتب سبب الإضافة', 'bad'); return; }
    if (W.method === 'رفع Excel' && !W.rows) { toast('اختر ملف Excel', 'bad'); return; }
    if (W.method !== 'رفع Excel' && !W.url) { toast('الصق رابط الملف', 'bad'); return; }
    W.fixed = fx ? fx.value() : null;
    try {
      const r = await rpc('rpc_source_save', { p: { name: W.name, kind: W.kind, method: W.method, has_student_data: W.students, url: W.url || null, sheet_name: W.sheet || null, fixed: W.fixed || {}, reason: reason.trim(), public_ack: needAck() && !!W.ack } });
      W.id = r.id; toast('حُفظ المصدر «مقارنة فقط»'); W.step = 4; draw();
    } catch (e) { fail(e); }
  }
  draw();
}
