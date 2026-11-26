// «جاهزية التجربة» (المرحلة هـ، 2026-11-24) لمسؤول الشعبة وحده: كل بند جاهز أو ناقص مع ما ينقص ورابط شاشته،
// ثم «يحتاج تأكيد» مصفّاة بالموجه والقسم والحلقة وحلقات المجرّبين، ومرتبة بالأثر (ما يغيّر الإسناد أولاً).
// التأكيد بالدالة القائمة نفسها (rpc_resolve_confirmations_ids)، فيُسجَّل من أكّد ومتى. الحارس الحقيقي في القاعدة.
import { S, h, rpc, ar, badge, nf, askForm, toast, fail, selectOf, depName, empty } from './core.js';

const IMPACT = { 1: 'يغيّر الإسناد', 2: 'بيانات حلقة أو شخص', 3: 'ترحيل وأرشيف', 4: 'غيره' };
const PAGE = 100;
// «الموقع السهل» (2026-11-25، القسم 5): أثر نقص كل مسودة على بدء التجربة (من فحص الكود: أين تُستعمل القيمة)
const DRAFT_IMPACT = {
  start_date: ['لا يمنع البدء', 'الإعداد «تاريخ بدء التجربة» فيه قيمة الآن؛ التأكيد يثبّتها فقط. زر «تشغيل إعدادات يوم البدء» لا ينتظره.'],
  final_participants: ['لا يمنع البدء', 'يلزم لتعرف لمن ترسل رسالة الترحيب، ولتصفية «حلقات المجرّبين فقط» في هذه الشاشة.'],
  participants_candidates: ['لا يمنع البدء', 'اقتراح يُبنى عليه «قائمة المجرّبين النهائية».'],
  supervisors_roster: ['لا يمنع البدء', 'للاطلاع: من «حساب مفعّل: لا» لا يستطيع الدخول حتى يُفعَّل حسابه.'],
  period_times: ['لا يمنع البدء', 'بدونها لا تُختار «الفترة الحالية» تلقائياً في صفحة الموجه، فيختارها بنفسه. لا أثر على حفظ الزيارة.'],
  term_dates: ['يؤثر على التقارير فقط', 'بدونها يُحسب ملخص المعلم على العام الهجري كاملاً بدل الفصل. لا أثر على تسجيل الزيارة.'],
  holidays: ['يؤثر على الخطط فقط', 'تُستعمل في أيام العمل للخطة الشهرية (والخطة الشهرية مطفأة). لا أثر على تسجيل الزيارة.'],
};
// التاريخ الميلادي (2027-01-09) داخل نص عربي يُعزل باتجاهه فلا ينقلب
const iso = (t) => String(t ?? '').replace('(الإعدادات العامة ← تشغيل الميزات)', '(الإعدادات العامة ← «يوم البدء»)').replace(/(\d{4}-\d{2}-\d{2})/g, '\u2066$1\u2069');

export async function render(root, ctx) {
  const R = await rpc('rpc_trial_readiness');
  root.append(h('section', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, 'جاهزية التجربة'), badge(`${nf(R.ready)} من ${nf(R.total)} جاهز`, R.ready === R.total ? 'ok' : 'warn')),
    h('p', { class: 'muted small' }, iso(`تاريخ بدء التجربة: ${R.date}. `), h('a', { class: 'btn sm ghost', href: '#/لوحة-التحكم?' + new URLSearchParams({ تبويب: 'الإعدادات العامة', إعداد: 'trial.start_date' }) }, 'غيّر التاريخ')),
    R.items.map((it) => h('div', { class: 'list-item row between nowrap', style: 'gap:10px;align-items:flex-start' },
      h('div', { class: 'grow' }, h('b', null, it.title), h('div', { class: 'muted xs' }, iso(it.detail))),
      h('div', { class: 'row', style: 'gap:6px;flex-wrap:nowrap' }, badge(it.ok ? 'جاهز' : 'ناقص', it.ok ? 'ok' : 'bad'),
        h('a', { class: 'btn sm ghost', href: it.link }, it.ok ? 'عرض' : 'أكمله'))))));

  // ---------- بنود الاستعداد التشغيلي التلقائية (تظهر بعد تطبيق هجرتها؛ قبلها تُترك بصمت) ----------
  const ops = h('section', { class: 'card', hidden: true }); root.append(ops);
  rpc('rpc_ops_readiness').then((O) => {
    const ok = O.items.filter((x) => x.ok).length;
    ops.append(h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, 'الاستعداد التشغيلي'), badge(`${nf(ok)} من ${nf(O.items.length)} جاهز`, ok === O.items.length ? 'ok' : 'warn')),
      ...O.items.map((it) => h('div', { class: 'list-item row between nowrap', style: 'gap:10px;align-items:flex-start' },
        h('div', { class: 'grow' }, h('b', null, it.title), h('div', { class: 'muted xs' }, iso(it.detail))),
        h('div', { class: 'row', style: 'gap:6px;flex-wrap:nowrap' }, badge(it.ok ? 'جاهز' : 'ناقص', it.ok ? 'ok' : 'bad'), it.link ? h('a', { class: 'btn sm ghost', href: it.link }, it.ok ? 'عرض' : 'أكمله') : null))));
    ops.hidden = false;
  }).catch(() => {});

  // ---------- «مسودات تحتاج تأكيدك» (خلف feature.trial_setup؛ تُترك بصمت إن كانت مطفأة) ----------
  const dr = h('section', { class: 'card', hidden: true }); root.append(dr);
  const STAT = { 'مسودة': 'warn', 'مؤكدة': 'ok', 'مرفوضة': 'gray' };
  const drawDrafts = (D) => dr.replaceChildren(
    h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, 'مسودات تحتاج تأكيدك'),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: async () => { try { const n = await rpc('rpc_trial_drafts_refresh'); toast(n ? `حُدّثت ${nf(n)} مسودة من البيانات` : 'لا جديد في البيانات', 'ok'); loadDrafts(); } catch (e) { fail(e); } } }, 'تحديث المسودات من البيانات')),
    h('p', { class: 'muted xs' }, 'هذه قيم مقترحة من بيانات الموقع والملفات. لا تُعتمد ولا يتغير شيء حتى تضغط «تأكيد». ما لم نعرفه بيقين تركناه فارغاً، ومكتوب تحته ما نحتاجه منك.'),
    ...D.map((d) => h('div', { class: 'list-item', 'data-draft': d.key },
      h('div', { class: 'row between nowrap', style: 'gap:8px;align-items:flex-start' },
        h('b', null, d.title), h('span', { class: 'row', style: 'gap:6px;flex-wrap:nowrap;flex-shrink:0;white-space:nowrap' }, badge(d.status, STAT[d.status] || 'gray'))),
      d.status === 'مسودة' ? h('div', { class: 'xs', style: 'color:var(--warn,#a15c00);font-weight:600' }, 'مسودة — تحتاج تأكيد عبدالكريم') : null,
      d.value ? h('pre', { class: 'small', style: 'white-space:pre-wrap;max-height:9em;overflow:auto;margin:6px 0;padding:6px;border:1px solid var(--line,#ddd);border-radius:8px;direction:rtl;unicode-bidi:plaintext' }, iso(d.value))
              : h('div', { class: 'muted small', style: 'margin:6px 0' }, 'فارغ (لم تُكتب قيمة بعد)'),
      h('div', { class: 'muted xs' }, 'المصدر: ' + iso(d.source)),
      d.needed ? h('div', { class: 'xs', style: 'margin-top:4px' }, d.value ? '' : h('b', null, 'المطلوب بالضبط: '), iso(d.needed)) : null,
      DRAFT_IMPACT[d.key] ? h('div', { class: 'xs', style: 'margin-top:4px' }, badge(DRAFT_IMPACT[d.key][0], DRAFT_IMPACT[d.key][0] === 'لا يمنع البدء' ? 'ok' : 'gray'), ' ', DRAFT_IMPACT[d.key][1]) : null,
      d.target ? h('div', { class: 'muted xs' }, `عند التأكيد تُنسخ إلى إعداد «${d.target_label}»`) : null,
      d.decided_at ? h('div', { class: 'muted xs' }, `${d.status === 'مؤكدة' ? 'أكّده' : 'رفضه'} ${d.decided_by || ''} • ${new Date(d.decided_at).toLocaleString('ar-SA-u-nu-latn')}${d.note ? ' • ' + d.note : ''}`) : null,
      h('div', { class: 'row', style: 'gap:6px;margin-top:6px;flex-wrap:wrap' },
        d.status === 'مسودة' && d.value ? h('button', { type: 'button', class: 'btn sm primary', onclick: () => confirmDraft(d) }, 'تأكيد') : null,
        h('button', { type: 'button', class: `btn sm ${d.status === 'مسودة' && !d.value ? 'primary' : 'soft'}`, onclick: () => editDraft(d) }, d.value ? 'تعديل' : 'اكتب القيمة'),
        d.status === 'مسودة' && !d.value ? h('button', { type: 'button', class: 'btn sm soft', onclick: () => confirmDraft(d) }, 'تأكيد') : null,
        d.status === 'مسودة' ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => rejectDraft(d) }, 'رفض') : null))));
  let jumped = false;
  async function loadDrafts() {
    const D = await rpc('rpc_trial_drafts'); drawDrafts(D); dr.hidden = false;
    // ?قسم=مسودات (من «ابدأ من هنا»): يُفتح قسم المسودات مظلّلاً
    if (!jumped && ctx?.query?.['قسم'] === 'مسودات') { jumped = true; dr.classList.add('setting-hl'); setTimeout(() => dr.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120); }
  }
  async function editDraft(d) {
    const v = await askForm({ title: `تعديل: ${d.title}`, intro: 'بعد الحفظ تبقى مسودة، وتحتاج أن تضغط «تأكيد» من جديد.', fields: [{ name: 'value', label: 'القيمة', value: d.value, area: true, hint: d.target ? 'اكتب رقماً في كل سطر، أو افصل الأرقام بفاصلة' : null }, { name: 'note', label: 'ملاحظة (اختياري)', value: d.note || '' }], ok: 'حفظ التعديل' });
    if (!v) return;
    try { await rpc('rpc_trial_draft_edit', { p_key: d.key, p_value: v.value, p_note: v.note }); toast('حُفظ التعديل', 'ok'); loadDrafts(); } catch (e) { fail(e); }
  }
  async function confirmDraft(d) {
    const v = await askForm({ title: `تأكيد: ${d.title}`, intro: d.target ? `ستُنسخ القيمة الحالية إلى إعداد «${d.target_label}» ويُسجَّل اسمك ووقت التأكيد.` : 'يُسجَّل اسمك ووقت التأكيد.', fields: [{ name: 'note', label: 'ملاحظة (اختياري)', value: '' }], ok: 'تأكيد' });
    if (!v) return;
    try { await rpc('rpc_trial_draft_confirm', { p_key: d.key, p_value: null, p_note: v.note }); toast('أُكِّدت المسودة', 'ok'); loadDrafts(); } catch (e) { fail(e); }
  }
  async function rejectDraft(d) {
    const v = await askForm({ title: `رفض: ${d.title}`, fields: [{ name: 'note', label: 'سبب الرفض', required: true }], ok: 'رفض' });
    if (!v) return;
    try { await rpc('rpc_trial_draft_reject', { p_key: d.key, p_note: v.note }); toast('رُفضت المسودة', 'ok'); loadDrafts(); } catch (e) { fail(e); }
  }
  // لا طلب والمفتاح مطفأ (الملف الشخصي يحمل حالته منذ 20261125000500)؛ والحارس الحقيقي في القاعدة
  if (S.profile?.ops?.setup !== false) loadDrafts().catch(() => {});

  // ---------- «يحتاج تأكيد» للتجربة ----------
  const f = { participants: true, supervisor: '', department: '', halaqa: '' };
  const box = h('div'); const head = h('div'); const supSel = h('select'); let rows = [];
  const dep = selectOf(S.refs.departments, { all: 'كل الأقسام', onchange: (v) => { f.department = v; load(); } });
  const hq = h('input', { type: 'search', inputmode: 'numeric', placeholder: 'رقم الحلقة' });
  hq.addEventListener('change', () => { f.halaqa = hq.value.trim(); load(); });
  supSel.addEventListener('change', () => { f.supervisor = supSel.value; load(); });
  const mine = h('input', { type: 'checkbox', checked: true });
  mine.addEventListener('change', () => { f.participants = mine.checked; load(); });
  root.append(h('section', { class: 'card' }, h('h2', null, 'يحتاج تأكيد'),
    h('p', { class: 'muted xs' }, 'مرتبة بالأثر: ما يغيّر الإسناد أولاً. اختر بنداً أو أكثر ثم «تأكيد المختار»، أو «تأكيد الكل الظاهر». يُسجَّل اسمك ووقت التأكيد.'),
    h('label', { class: 'row', style: 'gap:6px' }, mine, 'حلقات المجرّبين فقط (من إعداد «المجرّبون»)'),
    h('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, supSel, dep, hq), head, box));

  async function load(offset = 0) {
    try {
      const d = await rpc('rpc_trial_confirmations', { p: { ...f, limit: PAGE, offset } });
      if (!offset) {
        rows = [];
        const cur = supSel.value;
        supSel.replaceChildren(h('option', { value: '' }, 'كل الموجهين'), ...d.supervisors.sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((x) => h('option', { value: x.id }, x.name)));
        supSel.value = cur;
      }
      rows.push(...d.rows);
      draw(d);
    } catch (e) { fail(e); }
  }
  function draw(d) {
    const picked = new Set();
    const count = h('span', { class: 'muted small' });
    const btnPick = h('button', { type: 'button', class: 'btn sm primary', disabled: true }, 'تأكيد المختار');
    const btnAll = h('button', { type: 'button', class: 'btn sm soft', disabled: !rows.length }, `تأكيد الكل الظاهر (${nf(rows.length)})`);
    const upd = () => { btnPick.disabled = !picked.size; count.textContent = picked.size ? `المختار: ${nf(picked.size)}` : ''; };
    btnPick.addEventListener('click', () => confirmIds([...picked]));
    btnAll.addEventListener('click', () => confirmIds(rows.map((r) => r.id)));
    head.replaceChildren(h('div', { class: 'row between', style: 'margin-top:8px' },
      h('span', null, `${nf(d.total)} بند`, ...Object.entries(d.by_impact).map(([k, n]) => [' ', badge(`${IMPACT[k]} ${nf(n)}`, k === '1' ? 'warn' : 'gray')])),
      h('span', { class: 'row', style: 'gap:6px' }, count, btnPick, btnAll)));
    if (!rows.length) { box.replaceChildren(empty(f.participants ? 'لا بنود لحلقات المجرّبين (أو لم تُكتب أرقامهم في إعداد «المجرّبون»).' : 'لا بنود مفتوحة بهذه التصفية.')); return; }
    box.replaceChildren(...rows.map((r) => {
      const cb = h('input', { type: 'checkbox', 'aria-label': 'اختيار البند' });
      cb.addEventListener('change', () => { if (cb.checked) picked.add(r.id); else picked.delete(r.id); upd(); });
      return h('label', { class: 'list-item row nowrap', style: 'gap:10px;align-items:flex-start' }, cb,
        h('div', { class: 'grow' },
          h('div', null, h('b', null, ar(r.key)), ' ', badge(ar(r.list), 'gray'), ' ', r.impact === 1 ? badge(IMPACT[1], 'warn') : null),
          h('div', { class: 'small' }, ar(r.reason)),
          h('div', { class: 'muted xs' }, [r.halaqa ? `الحلقة ${r.halaqa}` : null, r.department ? depName(r.department) : null, r.supervisor].filter(Boolean).join(' • ')),
          r.details ? h('div', { class: 'muted xs' }, ar(r.details).slice(0, 200)) : null));
    }), rows.length < d.total ? h('button', { type: 'button', class: 'btn sm ghost block', onclick: () => load(rows.length) }, `عرض المزيد (${nf(d.total - rows.length)})`) : null);
  }
  async function confirmIds(ids) {
    const v = await askForm({ title: `تأكيد ${nf(ids.length)} بنداً`, intro: 'يُحسم كل بند بهذا النص، ويُسجَّل اسمك ووقته.', fields: [{ name: 'res', label: 'نص التأكيد', value: 'مؤكَّد قبل التجربة', required: true }], ok: 'تأكيد' });
    if (!v) return;
    try { const n = await rpc('rpc_resolve_confirmations_ids', { p_ids: ids, p_resolution: v.res }); toast(`أُكِّد ${nf(n)} بنداً`, 'ok'); load(); } catch (e) { fail(e); }
  }
  load();
}
