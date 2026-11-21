// لوحة التحكم ← الإعدادات ← «دفعات الاختبارات» (المرحلة 10): كل دفعة ترحيل بأرقامها ونتيجة مطابقتها، وزر «تراجع عن هذه الدفعة» بسبب مكتوب.
// لمسؤول الشعبة ومساعده فقط (عمل «إدارة دفعات الاختبارات» في المصفوفة، والفحص في القاعدة). لا حذف: الدفعة «ملغاة» ومجاميعها «ملغى»، وتبقى في السجل.
import { h, rpc, badge, nf, sheet, toast, fail, hijri } from './core.js';
import { periodName } from './exams_logic.js';

const KIND = { TERM: 'فصلية', MONTHLY: 'تنشيطية' };
const ERR = { HIFZ: 'حفظ', TAJWEED: 'تجويد', TASHKEEL: 'تشكيل', TAHAJJI: 'تهجٍّ' };
const dt = (x) => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(x)); } catch { return hijri(x); } };

export async function render(root) {
  const list = await rpc('rpc_exam_batches');
  root.append(h('p', { class: 'muted' }, 'كل ترحيل أو تحديث لنتائج الاختبارات «دفعة» برقم ووقت ومصدر. المجاميع فقط (لا بيانات طلاب). ',
    'التراجع عن دفعة لا يحذف شيئاً: تصير «ملغاة» وتختفي مجاميعها من ملف المعلم والتصدير، ويعود ما كانت قد استبدلته من دفعة سابقة، ويُسجَّل كله في «السجل».'));
  if (!list.length) root.append(h('p', { class: 'empty' }, 'لا دفعات بعد'));
  list.forEach((b) => root.append(card(b)));
  // المرحلة 10ب: تقويم الاختبارات، وسجل الوصول لقوائم الطلاب، وقياس الأداء (كل جزء مستقل؛ فشل أحدها لا يمنع الباقي)
  const extra = h('div'); root.append(extra);
  extra.append(await calendarCard().catch(() => h('p', { class: 'muted small' }, 'تعذّر تحميل تقويم الاختبارات')),
    await accessCard().catch(() => null), await perfCard().catch(() => null));
  function card(b) {
    const rec = b.reconciliation?.by_year_kind || {};
    const active = b.status === 'نشطة';
    return h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, `الدفعة ${nf(b.id)}`), badge(b.status, active ? 'ok' : 'gray')),
      h('p', { class: 'small', style: 'margin:6px 0' }, b.source_label),
      b.level ? h('div', { class: 'row', style: 'gap:6px' }, badge(b.level === 'طالب' ? 'على مستوى الطالب' : 'مجاميع فقط', 'info'),
        b.students ? badge(`${nf(b.students)} طالباً • ${nf(b.student_results)} نتيجة`, 'gray') : null,
        b.students_confirm ? badge(`${nf(b.students_confirm)} سجلاً يحتاج تأكيد (رقم تسجيل لأكثر من اسم)`, "gold") : null,
        b.superseded_results ? badge(`${nf(b.superseded_results)} مجموعاً مستبدلاً بدفعة أحدث`, 'gray') : null) : null,
      h('div', { class: 'muted xs' }, [`${b.source_kind}`, dt(b.created_at), b.created_label].filter(Boolean).join(' • ')),
      h('div', { class: 'stats compact', style: 'margin-top:10px' },
        h('div', { class: 'stat' }, h('b', null, nf(b.results_n)), h('span', null, 'مجموعاً')),
        h('div', { class: 'stat' }, h('b', null, nf(b.tested_n)), h('span', null, 'مختبَراً')),
        h('div', { class: 'stat' }, h('b', null, nf(b.rows_read)), h('span', null, 'صفاً مقروءاً')),
        h('div', { class: 'stat' }, h('b', null, nf(b.rows_duplicate)), h('span', null, 'مكرراً حرفياً (حُسب مرة)')),
        h('div', { class: 'stat' }, h('b', null, nf(b.teachers_matched)), h('span', null, 'معلماً مطابقاً')),
        h('div', { class: 'stat' }, h('b', null, nf(b.teachers_unmatched)), h('span', null, 'غير مطابقين (يحتاج تأكيد)'))),
      Object.keys(rec).length ? h('details', null, h('summary', { class: 'small' }, `المطابقة بالملفات: ${b.reconciliation.ok ? 'مطابقة ١٠٠٪' : 'فيها فروق'}`),
        Object.entries(rec).map(([k, r]) => { const [y, kind] = k.split('|'); return h('div', { class: 'list-item' },
          h('div', { class: 'row between' }, h('b', null, `${KIND[kind] || kind} ${y}هـ`), badge(r.ok ? 'مطابقة' : 'فرق', r.ok ? 'ok' : 'bad')),
          h('div', { class: 'muted xs' }, `مقروء ${nf(r.rows_read)} = ${nf(r.tested.db)} نتيجة + ${nf(r.duplicates)} مكرراً • ناجح ${nf(r.passed.db)} • راسب ${nf(r.failed.db)} • مستبعد ${nf(r.excluded.db)} • لم تُرصد ${nf(r.no_result.db)}`),
          h('div', { class: 'muted xs' }, 'الملاحظات: ' + Object.entries(r.errors).map(([e, v]) => `${ERR[e] || e} ${nf(v.db)}`).join(' • '))); })) : null,
      b.open_confirmations ? h('p', { class: 'small' }, `بنود «يحتاج تأكيد» مفتوحة لهذه الدفعة: ${nf(b.open_confirmations)} (في شاشة «يحتاج تأكيد»)`) : null,
      !active ? h('p', { class: 'muted xs' }, `أُلغيت ${b.cancelled_at ? dt(b.cancelled_at) : ''}${b.cancelled_by ? ' بواسطة ' + b.cancelled_by : ''}: ${b.cancel_reason || ''}`) : null,
      active ? h('button', { class: 'btn danger', type: 'button', style: 'margin-top:10px', onclick: () => undo(b) }, 'تراجع عن هذه الدفعة') : null);
  }
  function undo(b) {
    const reason = h('textarea', { rows: 3, placeholder: 'سبب التراجع (يُحفظ في السجل)', maxlength: 500 });
    const err = h('div', { class: 'err', hidden: true });
    sheet({ title: `التراجع عن الدفعة ${nf(b.id)}`, body: h('div', null,
      h('p', { class: 'small' }, `ستصير ${nf(b.active_results)} مجموعاً «ملغى»، وتختفي من ملفات المعلمين والتصدير والتقارير. لا يُحذف شيء، ويمكن ترحيل الملفات من جديد في دفعة جديدة.`),
      h('label', { class: 'field' }, h('span', null, 'السبب'), reason), err),
    actions: [{ label: 'تراجع عن الدفعة', kind: 'danger', onClick: async (close) => {
      if (reason.value.trim().length < 5) { err.textContent = 'اكتب سبب التراجع (5 أحرف على الأقل)'; err.hidden = false; return; }
      try {
        const r = await rpc('rpc_exam_batch_rollback', { p_batch: b.id, p_reason: reason.value.trim() });
        close(); toast(`أُلغيت الدفعة: ${nf(r.cancelled)} مجموعاً${r.restored ? `، وعاد ${nf(r.restored)} من دفعة سابقة` : ''}`, 'ok');
        root.replaceChildren(); await render(root);
      } catch (e) { fail(e); }
    } }, { label: 'رجوع' }] });
  }
}

// ---------- تقويم الاختبارات: يُملأ تلقائياً من النتائج، ويُعدَّل يدوياً بسبب (في السجل) ----------
async function calendarCard() {
  const cal = await rpc('rpc_exam_calendar');
  const box = h('section', { class: 'card' }, h('h2', null, 'تقويم الاختبارات'),
    h('p', { class: 'muted small' }, 'متى أُقيم كل نوع على مستوى الشعبة. منه يُحسب «لم يرشّح» في ملف كل معلم. «تلقائي» = من النتائج، و«يدوي» = عُدِّل هنا بسبب. لا حذف: «لم يُقم» يُخرج الشهر من الحساب.'));
  const row = (c) => h('div', { class: 'list-item row between', style: 'gap:8px' },
    h('div', { class: 'grow' }, h('b', null, `${KIND[c.k] || c.k} — ${periodName(c)}`),
      h('div', { class: 'muted xs' }, [c.src, c.tested ? `${nf(c.tested)} مختبَراً` : 'بلا نتائج', c.by ? `عدّله ${c.by}` : '', c.note || ''].filter(Boolean).join(' • '))),
    badge(c.held ? 'أُقيم' : 'لم يُقم', c.held ? 'ok' : 'gray'),
    h('button', { class: 'btn soft', type: 'button', onclick: () => edit(c) }, c.held ? 'لم يُقم' : 'أُقيم'));
  const list = h('div', null, cal.map(row));
  const add = h('button', { class: 'btn block', type: 'button', onclick: () => edit(null) }, 'إضافة فصل أو شهر يدوياً');
  box.append(list, add);
  function edit(c) {
    const kind = h('select', null, h('option', { value: 'MONTHLY' }, 'تنشيطية'), h('option', { value: 'TERM' }, 'فصلية'));
    const year = h('input', { type: 'number', inputmode: 'numeric', value: c?.y || 1448, min: 1440, max: 1460 });
    const no = h('input', { type: 'number', inputmode: 'numeric', value: c?.n || 1, min: 1, max: 12 });
    const reason = h('textarea', { rows: 2, placeholder: 'السبب (يُحفظ في السجل)' });
    const err = h('div', { class: 'err', hidden: true });
    if (c) kind.value = c.k;
    sheet({ title: c ? `${KIND[c.k]} — ${periodName(c)}` : 'إضافة إلى التقويم', body: h('div', null,
      c ? h('p', { class: 'small' }, c.held ? 'سيُعلَّم «لم يُقم»، فيخرج من حساب «لم يرشّح» لكل المعلمين.' : 'سيُعلَّم «أُقيم»، فيدخل في حساب «لم يرشّح».')
        : [h('label', { class: 'field' }, h('span', null, 'النوع'), kind), h('label', { class: 'field' }, h('span', null, 'السنة الهجرية'), year),
          h('label', { class: 'field' }, h('span', null, 'رقم الشهر (أو الفصل)'), no)],
      h('label', { class: 'field' }, h('span', null, 'السبب'), reason), err),
    actions: [{ label: 'حفظ', kind: 'primary', onClick: async (close) => {
      if (reason.value.trim().length < 5) { err.textContent = 'اكتب السبب (5 أحرف على الأقل)'; err.hidden = false; return; }
      try {
        await rpc('rpc_exam_calendar_set', { p_kind: c ? c.k : kind.value, p_year: c ? c.y : Number(year.value), p_no: c ? c.n : Number(no.value), p_held: c ? !c.held : true, p_month: null, p_reason: reason.value.trim() });
        close(); toast('حُفظ في التقويم وفي السجل', 'ok'); box.replaceWith(await calendarCard());
      } catch (e) { fail(e); }
    } }, { label: 'رجوع' }] });
  }
  return box;
}
// ---------- سجل الوصول لقوائم الطلاب ----------
async function accessCard() {
  const rows = await rpc('rpc_exam_access_log', { p_limit: 100 });
  return h('section', { class: 'card' }, h('h2', null, 'سجل الوصول لقوائم الطلاب'),
    h('p', { class: 'muted small' }, 'كل فتح لقائمة «الطلاب الذين يحتاجون متابعة» أو تصدير لأسماء الطلاب: من، ومتى، وأي معلم، وهل ظهرت الأسماء.'),
    rows.length ? rows.slice(0, 50).map((r) => h('div', { class: 'list-item' }, h('div', { class: 'row between' }, h('b', null, r.who || '—'), badge(r.names ? 'بالأسماء' : 'أعداد فقط', r.names ? 'warn' : 'gray')),
      h('div', { class: 'muted xs' }, `${dt(r.at)} • ${r.kind} • المعلم: ${r.teacher || '—'}${r.rows ? ` • ${nf(r.rows)} صفاً` : ''}`))) : h('p', { class: 'empty' }, 'لا وصول مسجل بعد'));
}
// ---------- قياس الأداء الدائم (آخر 50 فتحاً لكل صفحة، بلا بيانات شخصية) ----------
async function perfCard() {
  const rows = await rpc('rpc_perf_stats');
  const s = (ms) => (ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(2)} ث` : `${nf(ms)} م.ث`);
  return h('section', { class: 'card' }, h('h2', null, 'قياس الأداء'),
    h('p', { class: 'muted small' }, 'زمن فتح الموقع والصفحات والتبويبات من أجهزة المستخدمين الحقيقية (آخر 50 فتحاً لكل صفحة). بلا أي بيانات شخصية. الأهداف: فتح الموقع < 1 ث، والتبويب < 0.3 ث، والفلتر < 0.1 ث.'),
    rows.length ? rows.map((r) => h('div', { class: 'list-item' }, h('div', { class: 'row between' }, h('b', null, r.page), badge(r.kind, 'gray')),
      h('div', { class: 'muted xs' }, `الوسيط ${s(r.p50)} • 90٪ أقل من ${s(r.p90)} • المتوسط ${s(r.avg)} • ${nf(r.n)} قياساً${r.cold_avg != null ? ` • أول مرة ${s(r.cold_avg)}` : ''}`))) : h('p', { class: 'empty' }, 'لا قياسات بعد'));
}
export const prefetch = () => {};
