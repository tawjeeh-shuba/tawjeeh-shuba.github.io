// شاشة «الخطة» (المرحلة 11): خطة الموجه الشهرية — الاقتراح التلقائي، والإضافة والتعديل والتأجيل والإلغاء، والإرسال،
// والمراجعة والاعتماد والإعادة، والنقاش والسجل؛ وقائمة «للمراجعة والاعتماد» لمسؤول القسم ومسؤول الشعبة.
// الرابط: #/الخطة?موجه=<رقم>&شهر=1448-07 (بلا موجه = خطتي، وبلا شهر = الشهر الحالي).
import { h, rpc, icon, toast, fail, sheet, askForm, nf, badge, empty } from './core.js';
import { offNotice } from './off_notice.js';
import { planAccess, planBadge, itemRow, saveOps, uuid, dayText, visitHref } from './plans_api.js';

export async function render(root, ctx) {
  const A = await planAccess();
  // إعادة الرسم في المكان نفسه (الرابط لا يتغير بعد الحفظ فلا يُطلق التنقل)
  const reload = () => { if (!ctx.alive()) return; root.replaceChildren(); render(root, ctx).catch(fail); };
  // من لا حلقات له (مسؤول قسم أو مسؤول الشعبة) يرى قائمة المراجعة والاعتماد فقط، إلا إن فتح خطة موجه بعينه
  const ownView = !ctx.query['موجه'];
  const [D, inbox] = await Promise.all([
    ownView && !A.owner ? null : rpc('rpc_plan_open', { p_sup: ctx.query['موجه'] || null, p_month: ctx.query['شهر'] || null }),
    A.review || A.approve ? rpc('rpc_plan_inbox', { p_month: null }).catch(() => null) : null]);
  if (!ctx.alive()) return;
  if (!D) {
    // قرار 2026-11-24: من يملك الاطلاع بنطاق (المرشد، ومسؤول القسم، ومسؤول الشعبة) يرى «خطط الموجهين» في نطاقه للاطلاع
    const browse = A.browse ? await browseCard(ctx.query['شهر']) : null;
    if (!ctx.alive()) return;
    const parts = [inbox ? inboxCard(inbox) : null, browse].filter(Boolean);
    root.append(...(parts.length ? parts : [empty('لا خطط لك. الخطط للموجهين أصحاب الحلقات.')])); return;
  }
  const sup = D.supervisor, mk = D.month.key, pl = D.plan, can = D.can;
  const goMonth = (k) => { location.hash = '#/الخطة?' + new URLSearchParams({ ...(ctx.query['موجه'] ? { موجه: sup } : {}), شهر: k }); };
  const save = async (ops) => { await saveOps(sup, mk, ops); reload(); };
  const monthLink = (k, label) => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => goMonth(k) }, label);

  if (inbox) root.append(inboxCard(inbox));
  if (!D.on) root.append(offNotice('feature.plans', { what: 'الخطط الشهرية مطفأة الآن.' }));   // رسالة «مطفأ» الموحدة
  if (D.on && !Object.values(can).some(Boolean)) root.append(h('div', { class: 'hint' }, icon('info', 18), h('span', null, 'للاطلاع فقط: لا تعديل ولا اعتماد ولا تعليق.')));

  // ---------- الرأس: الشهر والحالة والعدّادات والأزرار ----------
  const items = D.items;
  const cnt = (st) => items.filter((i) => i.status === st && !i.out_of_plan).length;
  const out = items.filter((i) => i.out_of_plan && i.status === 'منفذة').length;
  const lateSubmit = pl && ['مسودة', 'معادة للتعديل'].includes(pl.status) && D.month.start <= new Date().toISOString().slice(0, 10)
    && hijriDay() > D.settings.submit_last_day;
  root.append(h('section', { class: 'card' },
    h('div', { class: 'row between nowrap' }, monthLink(prevMonth(mk), 'الشهر السابق'), h('h2', { style: 'margin:0;text-align:center' }, D.month.label), monthLink(D.month.next, 'الشهر التالي')),
    h('div', { class: 'row between', style: 'margin-top:8px' }, h('b', null, D.supervisor_name), planBadge(pl?.status)),
    h('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, badge(`مخططة ${nf(cnt('مخططة'))}`, 'info'), badge(`منفذة ${nf(cnt('منفذة'))}`, 'ok'),
      out ? badge(`خارج الخطة ${nf(out)}`, 'gold') : null, cnt('مؤجلة') ? badge(`مؤجلة ${nf(cnt('مؤجلة'))}`, 'warn') : null, cnt('ملغاة') ? badge(`ملغاة ${nf(cnt('ملغاة'))}`, 'gray') : null),
    pl?.skip_review_reason ? h('div', { class: 'note' }, `اعتُمدت دون مراجعة مسؤول القسم: ${pl.skip_review_reason}`) : null,
    pl?.status === 'معادة للتعديل' && returnNote(pl) ? h('div', { class: 'note' }, `سبب الإعادة: ${returnNote(pl)}`) : null,
    lateSubmit ? h('div', { class: 'hint' }, icon('alert', 18), h('span', null, `آخر يوم لإرسال الخطة هو ${nf(D.settings.submit_last_day)} من الشهر.`)) : null,
    h('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, ...headButtons())));

  function headButtons() {
    const b = [];
    if (can.edit) b.push(h('button', { type: 'button', class: 'btn sm soft', onclick: suggest }, icon('cal', 18), 'اقتراح تلقائي'),
      h('button', { type: 'button', class: 'btn sm soft', onclick: () => addSheet() }, icon('plus', 18), 'إضافة زيارة'));
    if (can.submit && pl && ['مسودة', 'معادة للتعديل'].includes(pl.status)) b.push(h('button', { type: 'button', class: 'btn sm primary', onclick: submit }, 'إرسال للاعتماد'));
    if (can.review) b.push(h('button', { type: 'button', class: 'btn sm primary', onclick: () => decide('rpc_plan_review', 'مراجعة') }, 'تمت المراجعة'),
      h('button', { type: 'button', class: 'btn sm danger', onclick: () => decide('rpc_plan_review', 'إعادة') }, 'إعادة للتعديل'));
    if (can.decide) b.push(h('button', { type: 'button', class: 'btn sm primary', onclick: () => decide('rpc_plan_decide', 'اعتماد') }, 'اعتماد'),
      h('button', { type: 'button', class: 'btn sm danger', onclick: () => decide('rpc_plan_decide', 'إعادة') }, 'إعادة للتعديل'));
    if (can.skip) b.push(h('button', { type: 'button', class: 'btn sm ghost', onclick: () => decide('rpc_plan_decide', 'اعتماد', true) }, 'اعتماد دون مراجعة'));
    return b;
  }

  // ---------- السطور مجمّعة باليوم ----------
  const byDay = new Map();
  items.forEach((i) => { if (!byDay.has(i.date)) byDay.set(i.date, []); byDay.get(i.date).push(i); });
  root.append(h('section', { class: 'card' }, h('h2', null, 'زيارات الخطة'),
    items.length ? [...byDay.entries()].map(([d, list]) => h('div', null, h('div', { class: 'section-h' }, h('h3', null, dayText(d))),
      list.map((it) => itemRow(it, { types: D.types, actions: itemActions(it) })))) : empty(can.edit ? 'لا زيارات بعد. اضغط «اقتراح تلقائي» أو «إضافة زيارة».' : 'لا زيارات في هذه الخطة.')));

  function itemActions(it) {
    if (it.status !== 'مخططة' || !can.edit) return null;
    const todayIso = new Date().toISOString().slice(0, 10);
    return h('div', { class: 'row', style: 'gap:6px;margin-top:6px' },
      it.date <= todayIso && can.submit ? h('a', { class: 'btn sm primary', href: visitHref(it) }, 'ابدأ الزيارة') : null,
      h('button', { type: 'button', class: 'btn sm ghost', onclick: () => editSheet(it) }, 'تعديل'),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: () => postpone(it) }, 'تأجيل للشهر التالي'),
      h('button', { type: 'button', class: 'btn sm ghost danger', onclick: () => cancel(it) }, 'إلغاء'));
  }

  // ---------- النقاش والسجل ----------
  if (pl) {
    const box = h('textarea', { placeholder: 'اكتب تعليقاً على الخطة' });
    root.append(h('section', { class: 'card' }, h('h2', null, 'النقاش'),
      D.comments.length ? D.comments.map((c) => h('div', { class: `list-item ${c.status === 'مخفي' ? 'muted' : ''}` },
        h('div', { class: 'row between nowrap' }, h('b', null, `${c.author || '—'} (${c.role})`), h('span', { class: 'muted xs' }, dayText(String(c.at).slice(0, 10)))),
        h('div', null, c.body), c.status === 'مخفي' ? badge('مخفي', 'gray') : null,
        c.mine && c.status === 'ظاهر' && c.kind === 'تعليق' ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => hideComment(c) }, 'إخفاء') : null)) : empty('لا تعليقات.'),
      can.comment ? h('div', null, h('label', { class: 'field' }, box), h('button', { type: 'button', class: 'btn sm primary', onclick: async () => {
        const t = box.value.trim(); if (!t) return;
        try { await rpc('rpc_plan_comment', { p_plan: pl.id, p_id: uuid(), p_body: t }); reload(); } catch (e) { fail(e); }
      } }, 'إرسال التعليق')) : null),
      h('details', { class: 'card' }, h('summary', null, `سجل الخطة (${nf(D.events.length)})`),
        D.events.map((e) => h('div', { class: 'list-item' }, h('div', { class: 'row between nowrap' }, h('b', null, e.event), h('span', { class: 'muted xs' }, dayText(String(e.at).slice(0, 10)))),
          h('div', { class: 'muted xs' }, [e.actor, e.from && e.to && e.from !== e.to ? `${e.from} ← ${e.to}` : null, e.note].filter(Boolean).join(' • '))))));
  }

  // ---------- الأفعال ----------
  async function suggest() {
    try {
      const r = await rpc('rpc_plan_suggest', { p_sup: sup, p_month: mk });
      if (!r.items.length) return toast(r.note || 'الخطة تغطي الحد الأدنى لكل حلقة، ولا اقتراح جديد', 'ok');
      const picks = r.items.map((x) => ({ x, on: h('input', { type: 'checkbox', checked: true }) }));
      sheet({ title: `اقتراح ${nf(r.items.length)} زيارة`, body: h('div', null, h('p', { class: 'muted small' }, `زيارتان على الأقل لكل حلقة في الشهر، وأكثر بحسب تقدير المعلم. راجع ثم أضف ما تريد.`),
        picks.map(({ x, on }) => h('label', { class: 'list-item row nowrap', style: 'gap:8px' }, on,
          h('div', { class: 'grow' }, h('b', null, x.teacher_name), h('div', { class: 'muted xs' }, `${dayText(x.date)} • الحلقة ${x.halaqa} • ${x.reason}`))))),
      actions: [{ label: 'أضف المختار', kind: 'primary', onClick: async (close) => {
        const ops = picks.filter((p) => p.on.checked).map(({ x }) => ({ op: 'add', id: uuid(), teacher: x.teacher, halaqa: x.halaqa, date: x.date, type: x.type }));
        if (!ops.length) return close();
        close(); await save(ops);
      } }, { label: 'تراجع' }] });
    } catch (e) { fail(e); }
  }

  function dateInput(value, min, max) { return h('input', { type: 'date', value: value || '', min, max, required: true }); }
  function typeSelect(value) { const s = h('select', null, D.types.map((t) => h('option', { value: t.code }, t.name))); if (value) s.value = value; return s; }
  function addSheet() {
    if (!D.halaqat.length) return toast('لا حلقات مسندة لهذا الموجه الآن', 'bad');
    const hq = h('select', null, D.halaqat.map((x) => h('option', { value: x.number }, `الحلقة ${x.number}`)));
    const te = h('select');
    const fillTeachers = () => te.replaceChildren(...(D.halaqat.find((x) => x.number === hq.value)?.teachers || []).map((t) => h('option', { value: t.id }, t.name)));
    hq.addEventListener('change', fillTeachers); fillTeachers();
    const dt = dateInput(D.month.workdays.find((d) => d >= new Date().toISOString().slice(0, 10)) || D.month.start, D.month.start, D.month.end);
    const tm = h('input', { type: 'time' }); const ty = typeSelect();
    sheet({ title: 'إضافة زيارة إلى الخطة', body: h('div', null, field('الحلقة', hq), field('المعلم', te), field('اليوم', dt), field('الوقت (اختياري)', tm), field('نوع الزيارة', ty)),
      actions: [{ label: 'إضافة', kind: 'primary', onClick: async (close) => {
        if (!te.value || !dt.value) return toast('اختر المعلم واليوم', 'bad');
        close(); await save([{ op: 'add', id: uuid(), teacher: te.value, halaqa: hq.value, date: dt.value, time: tm.value || null, type: ty.value }]);
      } }, { label: 'تراجع' }] });
  }
  function editSheet(it) {
    const dt = dateInput(it.date, D.month.start, D.month.end); const tm = h('input', { type: 'time', value: it.time || '' }); const ty = typeSelect(it.type);
    const note = h('input', { type: 'text', placeholder: 'اختياري: يُكتب تلقائياً عند تغيير اليوم' });
    sheet({ title: `تعديل زيارة ${it.teacher_name}`, body: h('div', null, field('اليوم', dt), field('الوقت', tm), field('نوع الزيارة', ty), field('سبب التعديل', note)),
      actions: [{ label: 'حفظ', kind: 'primary', onClick: async (close) => {
        close(); await save([{ op: 'edit', id: it.id, rv: it.rv, date: dt.value, time: tm.value || '', type: ty.value, note: note.value.trim() || null }]);
      } }, { label: 'تراجع' }] });
  }
  async function postpone(it) {
    const nextFirst = await rpc('rpc_plan_open', { p_sup: sup, p_month: D.month.next }).then((n) => n.month).catch(() => null);
    if (!nextFirst) return toast('الشهر التالي غير موجود في التقويم', 'bad');
    const dt = dateInput(nextFirst.workdays[0] || nextFirst.start, nextFirst.start, nextFirst.end);
    const why = h('input', { type: 'text', placeholder: 'مثل: المعلم في إجازة' });
    sheet({ title: `تأجيل زيارة ${it.teacher_name}`, body: h('div', null, h('p', { class: 'muted small' }, 'يُلغى هذا السطر بسبب، ويُنشأ سطر مرتبط به في خطة الشهر التالي. لا يُحذف شيء.'),
      field(`اليوم في ${nextFirst.label}`, dt), field('سبب التأجيل', why)),
    actions: [{ label: 'تأجيل', kind: 'primary', onClick: async (close) => {
      if (!why.value.trim()) return toast('اكتب سبب التأجيل', 'bad');
      close(); await save([{ op: 'postpone', id: it.id, rv: it.rv, date: dt.value, reason: why.value.trim() }]);
    } }, { label: 'تراجع' }] });
  }
  async function cancel(it) {
    const r = await askForm({ title: `إلغاء زيارة ${it.teacher_name}`, intro: 'يبقى السطر في الخطة «ملغاة» مع السبب، ولا يُحذف.', fields: [{ name: 'reason', label: 'سبب الإلغاء', required: true }], ok: 'إلغاء الزيارة' });
    if (r) await save([{ op: 'cancel', id: it.id, rv: it.rv, reason: r.reason }]);
  }
  async function submit() {
    const r = await askForm({ title: 'إرسال الخطة للاعتماد', intro: `${nf(pl.planned_count)} زيارة في ${D.month.label}.`, fields: [{ name: 'note', label: 'ملاحظة لمسؤول القسم (اختيارية)', area: true }], ok: 'إرسال' });
    if (!r) return;
    try {
      const x = await rpc('rpc_plan_submit', { p_plan: pl.id, p_rv: pl.row_version, p_note: r.note || null });
      if (!x.ok) return toast(x.reason, 'bad');
      toast(x.no_reviewer ? 'أُرسلت الخطة. لا يوجد مسؤول قسم يراجعها الآن، فسيراها مسؤول الشعبة.' : 'أُرسلت الخطة', 'ok'); reload();
    } catch (e) { fail(e); }
  }
  async function decide(fn, decision, skip = false) {
    const fields = decision === 'إعادة' ? [{ name: 'note', label: 'سبب الإعادة', required: true, area: true }]
      : skip ? [{ name: 'skip', label: 'سبب الاعتماد دون مراجعة مسؤول القسم', required: true, area: true }] : [];
    const r = fields.length ? await askForm({ title: decision === 'إعادة' ? 'إعادة الخطة للتعديل' : 'اعتماد دون مراجعة', fields, ok: decision === 'إعادة' ? 'إعادة' : 'اعتماد' }) : {};
    if (!r) return;
    try {
      const args = { p_plan: pl.id, p_rv: pl.row_version, p_decision: decision, p_note: r.note || null };
      const x = await rpc(fn, fn === 'rpc_plan_decide' ? { ...args, p_skip_reason: r.skip || null } : args);
      if (!x.ok) { toast(x.reason, 'bad'); return reload(); }
      toast(decision === 'إعادة' ? 'أُعيدت الخطة للتعديل' : decision === 'مراجعة' ? 'تمت المراجعة' : 'اعتُمدت الخطة', 'ok'); reload();
    } catch (e) { fail(e); }
  }
  async function hideComment(c) {
    const r = await askForm({ title: 'إخفاء التعليق', intro: 'يبقى في السجل لمسؤول الشعبة.', fields: [{ name: 'reason', label: 'سبب الإخفاء', required: true }], ok: 'إخفاء' });
    if (!r) return;
    try { await rpc('rpc_plan_comment_hide', { p_comment: c.id, p_reason: r.reason }); reload(); } catch (e) { fail(e); }
  }

  // ---------- خطط الموجهين في النطاق (للاطلاع) ----------
  async function browseCard(month) {
    const B = await rpc('rpc_plan_browse', { p_month: month || null });
    const go = (k) => { location.hash = '#/الخطة?' + new URLSearchParams({ شهر: k }); };
    const row = (p) => h('a', { class: 'list-item row between nowrap', style: 'text-decoration:none;color:inherit', href: '#/الخطة?' + new URLSearchParams({ موجه: p.supervisor, شهر: p.month }) },
      h('div', { class: 'grow' }, h('b', null, p.name), h('div', { class: 'muted xs' }, `${nf(p.count)} زيارة مخططة • منفذة ${nf(p.done)}`)), planBadge(p.status));
    return h('section', { class: 'card' },
      h('div', { class: 'row between nowrap' }, h('button', { type: 'button', class: 'btn sm ghost', onclick: () => go(prevMonth(B.month.key)) }, 'الشهر السابق'),
        h('h2', { style: 'margin:0;text-align:center' }, `خطط الموجهين — ${B.month.label}`), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => go(B.month.next) }, 'الشهر التالي')),
      h('p', { class: 'muted small' }, 'خطط الموجهين في نطاقك، للاطلاع فقط.'),
      B.plans.length ? B.plans.map(row) : empty('لا خطط في نطاقك لهذا الشهر.'));
  }

  // ---------- قائمة المراجعة والاعتماد ----------
  function inboxCard(ib) {
    const row = (p) => h('a', { class: 'list-item row between nowrap', style: 'text-decoration:none;color:inherit', href: '#/الخطة?' + new URLSearchParams({ موجه: p.supervisor, شهر: p.month }) },
      h('div', { class: 'grow' }, h('b', null, p.name), h('div', { class: 'muted xs' }, `${p.month} • ${nf(p.count)} زيارة${p.reviewed_by ? ` • راجعها ${p.reviewed_by}` : ''}`)),
      h('span', { class: 'row', style: 'gap:4px' }, p.late ? badge('متأخرة', 'bad') : null, planBadge(p.status)));
    if (!ib.review.length && !ib.approve.length) return h('section', { class: 'card' }, h('h2', null, 'للمراجعة والاعتماد'), empty('لا خطط تنتظرك.'));
    return h('section', { class: 'card' }, h('h2', null, 'للمراجعة والاعتماد'),
      ib.review.length ? [h('h3', null, `تنتظر مراجعتك (${nf(ib.review.length)})`), ...ib.review.map(row)] : null,
      ib.approve.length ? [h('div', { class: 'row between' }, h('h3', null, `تنتظر الاعتماد (${nf(ib.approve.length)})`),
        ib.bulk ? h('button', { type: 'button', class: 'btn sm primary', onclick: () => bulk(ib.approve) }, 'اعتماد كل المراجَعة') : null), ...ib.approve.map(row)] : null);
  }
  async function bulk(list) {
    const ready = list.filter((p) => p.status === 'مراجَعة بانتظار الاعتماد' || p.status === 'بانتظار الاعتماد');
    sheet({ title: `اعتماد ${nf(ready.length)} خطة`, body: h('p', null, 'تُعتمد كل خطة بنسختها المعروضة الآن. الخطة التي تغيّرت بعد فتح الصفحة لا تُعتمد وتظهر لك.'),
      actions: [{ label: 'اعتماد الكل', kind: 'primary', onClick: async (close) => {
        const r = await rpc('rpc_plan_approve_bulk', { p: ready.map((p) => ({ id: p.id, rv: p.rv })) });
        close(); toast(`اعتُمدت ${nf(r.approved.length)} خطة${r.changed.length ? `، و${nf(r.changed.length)} تغيّرت فلم تُعتمد` : ''}`, r.changed.length ? 'bad' : 'ok'); reload();
      } }, { label: 'تراجع' }] });
  }
}

const prevMonth = (k) => { const [y, m] = k.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
const field = (label, el) => h('label', { class: 'field' }, h('span', null, label), el);
// سبب آخر إعادة: من المراجعة أو من الاعتماد، أيهما أحدث
const returnNote = (pl) => ((pl.decided_at || '') > (pl.reviewed_at || '') ? pl.decision_note : pl.review_note) || pl.decision_note || pl.review_note;
function hijriDay() { try { return Number(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric' }).format(new Date())); } catch { return 1; } }
