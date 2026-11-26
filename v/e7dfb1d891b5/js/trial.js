// «زيارة تجريبية» لمسؤول الشعبة (أمر «الموقع السهل» 2026-11-25، القسم 1): يختار أي معلم وحلقة، والوضع (العادي أو المبسط)،
// فيسجّل زيارة كاملة كما سيفعل الموجه تماماً؛ وتحتها «زياراتي التجريبية» وزر «أرشفة كل الزيارات التجريبية» (أرشفة لا حذف).
// كل شيء خلف المفتاح feature.trial_visits_head، والحارس الحقيقي في دوال القاعدة (لا يراها غير مسؤول الشعبة، ولا تُحسب في أي رقم).
import { S, h, rpc, badge, nf, hijri, depName, perName, sheet, toast, fail, askForm, empty, debounce, isDivisionHead, seg, icon } from './core.js';
import { offNotice } from './off_notice.js';
import { pct } from './tlist.js';
import { trialBanner } from './trial_ui.js';

const MODES = [{ value: 'مبسط', label: 'الزيارة المبسطة' }, { value: 'عادي', label: 'الزيارة العادية' }];
const MKEY = 'tawjeeh.trial.mode';
const getMode = () => { try { return localStorage.getItem(MKEY) || 'مبسط'; } catch { return 'مبسط'; } };
const setMode = (m) => { try { localStorage.setItem(MKEY, m); } catch { /* */ } };
export const visitHref = (t, mode) => '#/زيارة?' + new URLSearchParams({ معلم: t.teacher_id, حلقة: t.halaqa, تجريبي: '1', وضع: mode });

export async function render(root, ctx) {
  // 2026-11-26 ج (س7): والحسابات التجريبية خلف feature.trial_accounts (my_profile.ops.trial يحسبه الخادم)
  if (!isDivisionHead() && !S.profile?.ops?.trial) { root.append(h('section', { class: 'card' }, h('p', null, 'الزيارات التجريبية لمسؤول الشعبة وللحسابات التجريبية حين يُشغَّل مفتاحها.'))); return; }
  if (!S.profile?.ops?.trial) { root.append(h('section', { class: 'card' }, h('h2', null, 'زيارة تجريبية'), offNotice('feature.trial_visits_head'))); return; }
  let mode = getMode();

  // ---------- 1) زيارة جديدة ----------
  const results = h('div', { class: 'tv-list' });
  const q = h('input', { type: 'search', placeholder: 'ابحث برقم الحلقة أو اسم المعلم', 'aria-label': 'بحث عن معلم أو حلقة', autocomplete: 'off' });
  const modeBox = h('div');
  const drawMode = () => modeBox.replaceChildren(seg(MODES, mode, (v) => { mode = v; setMode(v); drawMode(); drawResults(last); }));
  let last = [];
  function drawResults(rows) {
    last = rows;
    if (!rows.length) { results.replaceChildren(empty('لا نتائج. جرّب رقم حلقة آخر أو جزءاً من اسم المعلم.')); return; }
    results.replaceChildren(...rows.map((t) => h('a', { class: 'list-item row between nowrap tv-row', href: visitHref(t, mode) },
      h('div', { class: 'grow' }, h('b', null, t.teacher_name), h('div', { class: 'muted small' }, `الحلقة ${t.halaqa} • ${depName(t.department) || '—'} • ${perName(t.period) || '—'}`)),
      h('span', { class: 'btn sm primary', 'aria-hidden': 'true' }, 'ابدأ'))));
  }
  let seq = 0;   // المراجع المستقل: رد قديم يصل متأخراً لا يحلّ محل الأحدث
  const search = debounce(async () => {
    const my = ++seq;
    try { const rows = await rpc('rpc_trial_visit_targets', { p_q: q.value.trim() || null, p_limit: 30 }); if (my === seq) drawResults(rows); } catch (e) { if (my === seq) fail(e); }
  });
  q.addEventListener('input', search);
  drawMode();
  root.append(trialBanner(), h('section', { class: 'card' },
    h('h2', null, 'زيارة تجريبية جديدة'),
    h('p', { class: 'muted small' }, 'سجّل زيارة كاملة كما سيفعل الموجه تماماً، ومعها خطة علاج الاختبارات إن شئت. اختر الوضع، ثم اضغط «ابدأ» بجانب أي معلم.'),
    h('div', { class: 'field' }, h('span', null, '1. اختر الوضع'), modeBox),
    h('label', { class: 'field' }, h('span', null, '2. اختر المعلم والحلقة'), q), results));
  let firstList = rpc('rpc_trial_visits', { p_archived: false }).catch(() => null);   // بالتوازي مع قائمة الحلقات
  const my0 = ++seq;
  try { const rows = await rpc('rpc_trial_visit_targets', { p_q: null, p_limit: 30 }); if (my0 === seq) drawResults(rows); } catch (e) { if (my0 === seq) { results.replaceChildren(h('p', { class: 'err' }, 'تعذّر تحميل الحلقات. حدّث الصفحة.')); fail(e); } }
  if (!ctx.alive()) return;

  // ---------- 2) زياراتي التجريبية ----------
  const listBox = h('section', { class: 'card' });
  root.append(listBox);
  let showArchived = false;
  async function loadList() {
    let rows = [];
    try { const pre = !showArchived && firstList ? await firstList : null; rows = pre || await rpc('rpc_trial_visits', { p_archived: showArchived }); } catch (e) { fail(e); }
    firstList = null;
    const archiveBtn = !showArchived && rows.length ? h('button', { type: 'button', class: 'btn sm danger-soft', onclick: archiveAll }, icon('layers', 16), 'أرشفة كل الزيارات التجريبية') : null;
    listBox.replaceChildren(
      h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, showArchived ? 'الزيارات التجريبية المؤرشفة' : `زياراتي التجريبية (${nf(rows.length)})`), archiveBtn),
      h('p', { class: 'muted xs' }, 'لا يراها أحد غيرك، ولا تدخل أي عدد أو تقرير أو تصدير أو ملف معلم. الأرشفة تخفيها من هنا ولا تحذفها، وتشغيل «إعدادات يوم البدء» يؤرشفها تلقائياً.'),
      rows.length ? h('div', null, rows.map((r) => h('button', { type: 'button', class: 'list-item row between nowrap tv-row', style: 'width:100%;text-align:start', onclick: () => openOne(r.id) },
        h('div', { class: 'grow' }, h('b', null, r.teacher_name), h('div', { class: 'muted small' }, `الحلقة ${r.halaqa} • ${hijri(r.created_at)}${r.has_plan ? ' • معها خطة علاج' : ''}`)),
        h('span', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, badge(r.mode === 'مبسط' ? 'مبسطة' : 'عادية', 'gray'), r.classification ? badge(r.classification, 'ok') : null))))
        : empty(showArchived ? 'لا زيارات تجريبية مؤرشفة.' : 'لم تسجّل زيارة تجريبية بعد. ابدأ من القسم الذي فوق.'),
      h('button', { type: 'button', class: 'btn sm ghost', style: 'margin-top:8px', onclick: () => { showArchived = !showArchived; loadList(); } }, showArchived ? 'عرض غير المؤرشفة' : 'عرض المؤرشفة'));
  }
  async function archiveAll() {
    const v = await askForm({ title: 'أرشفة كل الزيارات التجريبية', intro: 'تختفي من «زياراتي التجريبية» ولا تُحذف. لا يتغير أي رقم حقيقي.', fields: [{ name: 'reason', label: 'السبب (اختياري)', value: 'انتهيت من التجربة' }], ok: 'أرشفة' });
    if (!v) return;
    try { const n = await rpc('rpc_trial_visits_archive', { p_reason: v.reason || null }); toast(`أُرشفت ${nf(n)} زيارة تجريبية`, 'ok'); loadList(); } catch (e) { fail(e); }
  }
  async function openOne(id) {
    try {
      const d = await rpc('rpc_trial_visit_get', { p_id: id });
      const tx = d.texts || {};
      const txt = [['ملاحظات عامة للمعلم', tx.public_notes], ['نقاط القوة', tx.strengths], ['المطلوب تحسينه', tx.improvements], ['ملاحظات للموجه', tx.notes]].filter(([, x]) => x);
      let axis = null;
      const rp = h('div');   // المرحلة 11: «جرّب خطة علاجية» وخطط هذه الزيارة التجريبية (كاملة: متابعة وإغلاق وتمديد وإلغاء)
      import('./rplan.js').then((m) => m.trialBlock(id, { onChange: loadList })).then((el) => { if (rp.isConnected) rp.replaceChildren(el); }).catch(() => {});
      const ai = h('div');   // 2026-11-26 ج (س12): الخطة بالذكاء الاصطناعي التجريبية (خلف feature.trial_accounts)
      if (S.profile?.ops?.trial_ai) import('./rplan_ai.js').then((m) => m.trialAiBlock(id, { teacherName: d.teacher_name, halaqa: d.halaqa, date: d.created_at })).then((el) => { if (el && ai.isConnected) ai.replaceChildren(el); }).catch(() => {});
      sheet({ title: `${d.teacher_name} • الحلقة ${d.halaqa}`, body: h('div', null, trialBanner(),
        h('div', { class: 'row', style: 'gap:6px;margin:8px 0' }, badge(d.mode === 'مبسط' ? 'الزيارة المبسطة' : 'الزيارة العادية', 'gray'), d.visit_type_name ? badge(d.visit_type_name, 'gray') : null,
          d.classification ? badge(d.classification, 'ok') : null, d.pct != null ? badge(`المجموع ${pct(d.pct)}`, 'gray') : null,
          badge(`قيّمت ${nf(d.rated ?? 0)} بنداً`, 'gray')),
        h('div', { class: 'muted small' }, `${hijri(d.created_at)} • ${d.form_name || ''}${d.duration_minutes ? ` • ${nf(d.duration_minutes)} دقيقة` : ''}`),
        (d.items || []).filter((i) => i.level).map((i) => {
          const hd = i.axis !== axis ? h('h3', { style: 'margin:10px 0 4px;font-size:var(--fs-m)' }, i.axis) : null; axis = i.axis;
          return [hd, h('div', { class: 'list-item row between nowrap', style: 'gap:8px' }, h('div', { class: 'grow small' }, i.name, i.note ? h('div', { class: 'muted xs' }, i.note) : null), badge(i.level, 'gray'))];
        }),
        txt.map(([k, x]) => h('div', { style: 'margin-top:8px' }, h('b', { class: 'small' }, k), h('div', { class: 'small' }, x))),
        tx.next_visit_date ? h('div', { class: 'small', style: 'margin-top:8px' }, `الزيارة القادمة: ${hijri(tx.next_visit_date)}`) : null,
        d.exam_plan?.body ? h('div', { style: 'margin-top:8px' }, h('b', { class: 'small' }, 'خطة علاج الاختبارات'), h('div', { class: 'small', style: 'white-space:pre-wrap' }, d.exam_plan.body)) : null,
        rp, ai),
      actions: [{ label: 'إغلاق' }] });
    } catch (e) { fail(e); }
  }
  loadList();
}
