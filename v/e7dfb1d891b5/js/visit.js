// تسجيل زيارة جديدة (المرحلة 9): من نموذج قسم الحلقة الساري وبنوده ومستوياته وأنواع الزيارات المفعّلة.
// الحفظ بدالة واحدة في القاعدة (rpc_visit_save) تتحقق من: تشغيل التسجيل، والإسناد، والحد اليومي، والمدة. رقم الزيارة يولَّد هنا فلا تتكرر.
import { S, h, rpc, badge, icon, hijri, depName, perName, sheet, toast, fail, askForm, nf } from './core.js';
import { whatsappSheet } from './wa.js';
import { visitTimer, elapsedMin } from './visit_timer.js';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

export async function render(root, ctx) {
  const tid = ctx.query['معلم'], hn = ctx.query['حلقة'];
  if (!tid || !hn) throw new Error('حدّد المعلم والحلقة');
  // «زيارة تجريبية» لمسؤول الشعبة (2026-11-25): ?تجريبي=1&وضع=عادي|مبسط — النموذج نفسه، والحفظ في الجدول التجريبي وحده
  const trial = ctx.query['تجريبي'] === '1';
  // trial_ui.js تُحمَّل بالتوازي في الوضع التجريبي فقط (لا رحلة شبكة إضافية قبل زيارة الموجه)
  const [F, TU] = await Promise.all([rpc(trial ? 'rpc_trial_visit_form' : 'rpc_visit_form', { p_teacher: tid, p_halaqa: hn }), trial ? import('./trial_ui.js') : null]);
  if (!ctx.alive()) return;
  if (trial) { F.trial = true; F.simple = ctx.query['وضع'] === 'مبسط'; root.append(TU.trialBanner()); document.getElementById('title').textContent = 'زيارة تجريبية'; }   // عنوان الشريط العلوي: لا «زيارة جديدة»
  if (F.simple) return (await import('./visit_simple.js')).render(root, ctx, F, tid, hn);   // «الزيارة المبسطة» (feature.visit_simple)، مطفأة افتراضياً
  // المسودة (ومعها وقت البدء) في تخزين الجهاز الدائم لا في ذاكرة الجلسة (2026-11-25): العدّاد يكمل صحيحاً بعد إغلاق الصفحة أو انطفاء الشاشة.
  // المفتاح يحمل رقم الشخص، وصلاحيتها 12 ساعة، وتُمسح كل مسودات «tawjeeh.vs.» عند الخروج (core.js clearSession).
  const DK = `tawjeeh.vs.n.${S.profile?.person_id || 'x'}.${F.trial ? 'trial.' : ''}${tid}.${hn}`;
  const OLDK = `tawjeeh.vdraft.${F.trial ? 'trial.' : ''}${tid}.${hn}`;
  let D = null; let resumed = false;
  try { const raw = JSON.parse(localStorage.getItem(DK) || 'null'); if (raw?.D && Date.now() - raw.t < 12 * 3600 * 1000) { D = raw.D; resumed = true; } } catch { /* */ }
  if (!D) { try { D = JSON.parse(sessionStorage.getItem(OLDK) || 'null'); sessionStorage.removeItem(OLDK); } catch { /* */ } }   // مسودة قديمة مفتوحة وقت التحديث
  if (!D) D = { id: uuid(), started_at: new Date().toISOString(), grades: {}, type: F.types[0]?.code || '', track: '', dur: '', durEdited: false, strengths: '', improvements: '', notes: '' };
  if (D.dur && D.durEdited == null) D.durEdited = true;   // مسودة قديمة كُتبت مدتها باليد
  D.inotes ||= {}; D.public_notes ||= ''; D.next ||= '';   // المرحلة 9ب: ملاحظة البند، والملاحظات العامة، وموعد الزيارة القادمة
  const LIM = F.limits || { next_max_days: 120, item_note_max: 300, today: new Date().toISOString().slice(0, 10) };
  const keep = () => { try { localStorage.setItem(DK, JSON.stringify({ t: Date.now(), D })); } catch { /* */ } };
  const clearDraft = () => { try { localStorage.removeItem(DK); } catch { /* */ } };
  keep();

  const items = F.axes.flatMap((a) => a.items);
  const visible = () => items.filter((i) => !F.form.needs_track || !D.track || ['الكل', 'مشترك'].includes(i.track) || i.track === D.track);
  const levels = F.levels;
  const t = F.today; const full = t.cap != null && t.done >= t.cap;

  // مسودة مسترجعة (المراجعة المستقلة 2026-11-25): العدّاد يحسب من وقت بدئها، فيُعرض ذلك مع «ابدأ من جديد» كما في الزيارة المبسطة
  if (resumed && (Object.keys(D.grades || {}).length || Date.now() - Date.parse(D.started_at) > 5 * 60 * 1000)) {
    root.append(h('div', { class: 'vs-resume note', role: 'status', style: 'display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px' },
      h('span', null, `لديك زيارة لم تكتمل لهذا المعلم بدأت الساعة ${new Date(D.started_at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}، استرجعناها والعدّاد يكمل منها.`),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { clearDraft(); location.reload(); } }, 'ابدأ من جديد')));
  }
  // ---------- الرأس ----------
  root.append(h('section', { class: 'card' },
    h('div', { class: 'row between nowrap', style: 'align-items:flex-start' },
      h('div', { class: 'grow' }, h('h2', { style: 'margin:0' }, F.teacher.name),
        h('div', { class: 'muted small' }, `الحلقة ${F.halaqa.number} • ${depName(F.halaqa.department) || '—'} • ${perName(F.halaqa.period) || '—'}`),
        h('div', { class: 'muted xs' }, `${F.form.name} • ${hijri(new Date())}`)),
      h('div', { class: `vscore ${full ? 'warn' : ''}` }, h('b', null, F.trial ? nf(t.done) : `${nf(t.done)}/${t.cap ?? '—'}`), h('span', null, F.trial ? 'تجريبية اليوم' : 'زياراتي اليوم'))),
    full ? h('div', { class: 'note' }, t.mode === 'منع' ? 'بلغت الحد اليومي لهذه الفترة، ولن تُقبل زيارة أخرى اليوم.' : 'بلغت الحد اليومي لهذه الفترة. يمكنك الحفظ بسبب مكتوب يُحفظ مع الزيارة.') : null,
    F.recording_on ? null : h('div', { class: 'off-slot', 'data-off': 'feature.visits' })));
  // رسالة «مطفأ» الموحدة: ما المطفأ ولماذا ومن يشغّله، ولمسؤول الشعبة زر «افتح الإعداد» وزر «جرّب زيارة تجريبية»
  root.querySelectorAll('.off-slot').forEach((el) => import('./off_notice.js').then((m) => el.replaceWith(m.offNotice(el.dataset.off, { trial: true, what: 'تسجيل الزيارات مطفأ الآن.' }))).catch(() => {}));

  // ---------- المرحلة 10ب: بطاقة «الاختبارات» المختصرة، وحقل اختياري «خطة علاج للاختبارات» خارج بنود التقييم ----------
  let exams = null;
  if (F.can_exams !== false) {
    const holder = h('div'); root.append(holder);
    import('./exams_tab.js').then(async (m) => { exams = await m.visitCard(tid, { trial: !!F.trial }); holder.replaceWith(exams.el); }).catch(() => holder.remove());
  }

  // ---------- النوع والمدة والمسار ----------
  const typeBox = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'نوع الزيارة' });
  const dur = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 240, value: D.dur, placeholder: 'بالدقائق', 'aria-label': 'مدة الزيارة بالدقائق' });
  const durHint = h('small');
  const durAuto = h('small', { class: 'vt-line' });
  const elapsed = () => elapsedMin(D.started_at);
  const typeOf = () => F.types.find((x) => x.code === D.type);
  // المدة تُملأ من العدّاد ما لم يعدّلها الموجه بيده
  const syncDur = (m) => { if (!D.durEdited && document.activeElement !== dur) dur.value = String(m ?? elapsed()); };
  const autoBtn = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { D.durEdited = false; D.dur = ''; keep(); syncDur(); drawDurAuto(); } }, 'ارجع للحساب التلقائي');
  const drawDurAuto = () => { durAuto.textContent = D.durEdited ? 'عدّلتها بيدك، ولن تتغير مع العدّاد.' : 'محسوبة تلقائياً من وقت البدء، وتتحدّث مع العدّاد. يمكنك تعديلها بيدك عند الحاجة.'; autoBtn.hidden = !D.durEdited; };
  const timer = visitTimer({ startedAt: () => D.started_at, type: typeOf, onTick: syncDur });
  function drawTypes() {
    typeBox.replaceChildren(...F.types.map((x) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(D.type === x.code), 'aria-pressed': String(D.type === x.code),
      onclick: () => { D.type = x.code; keep(); drawTypes(); timer.update(); } }, x.name)));
    const ty = typeOf();
    durHint.textContent = ty ? `المسموح لنوع «${ty.name}»: من ${ty.min} إلى ${ty.max} دقيقة. بدأتَ الساعة ${new Date(D.started_at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}.` : '';
  }
  dur.addEventListener('input', () => { D.dur = dur.value; D.durEdited = true; keep(); drawDurAuto(); });
  syncDur(); drawDurAuto();
  const track = F.form.needs_track ? h('select', { onchange: (e) => { D.track = e.target.value; keep(); drawItems(); } }, h('option', { value: '' }, 'اختر المسار'), (F.form.tracks || []).map((x) => h('option', { value: x }, x))) : null;
  if (track) track.value = D.track;
  drawTypes();
  root.append(h('section', { class: 'card' }, h('h2', null, 'نوع الزيارة'), typeBox,
    h('label', { class: 'field', style: 'margin-top:8px' }, h('span', null, 'مدة الزيارة (دقيقة)'), h('div', { class: 'row nowrap' }, dur, autoBtn), durAuto, durHint),
    track ? h('label', { class: 'field' }, h('span', null, 'المسار'), track) : null));

  // ---------- البنود ----------
  const progress = h('div', { class: 'count-line' });
  const itemsBox = h('div');
  function drawProgress() {
    const v = visible(); const n = v.filter((i) => D.grades[i.code]).length;
    progress.textContent = `قيّمت ${nf(n)} من ${nf(v.length)} بنداً`;
  }
  function drawItems() {
    itemsBox.replaceChildren(...F.axes.map((a) => {
      const its = a.items.filter((i) => visible().includes(i));
      if (!its.length) return null;
      return h('section', { class: 'card' }, h('h2', null, a.name), its.map((i) => {
        const row = h('div', { class: 'gitem' });
        // ملاحظة اختيارية على البند (تظهر في ملخص واتساب تحته)
        const noteEl = h('textarea', { rows: 2, maxlength: LIM.item_note_max, placeholder: 'ملاحظتك على هذا البند (اختيارية، تظهر في الملخص)', 'aria-label': `ملاحظة على ${i.name}` });
        noteEl.value = D.inotes[i.code] || '';
        noteEl.addEventListener('input', () => { D.inotes[i.code] = noteEl.value; keep(); });
        const noteBox = h('div', { class: 'inote', hidden: !D.inotes[i.code] }, noteEl);
        const noteBtn = h('button', { type: 'button', class: 'btn sm ghost inote-btn', hidden: !!D.inotes[i.code], onclick: () => { noteBox.hidden = false; noteBtn.hidden = true; noteEl.focus(); } }, icon('plus', 16), 'ملاحظة على البند');
        const draw = () => row.replaceChildren(
          h('div', { class: 'gname' }, h('b', null, i.name), i.hint ? h('small', { class: 'muted' }, i.hint) : null),
          h('div', { class: 'levels', role: 'radiogroup', 'aria-label': i.name }, [...levels, { code: '', name: 'لم يُقيَّم', counts: false, nr: true }].map((l) => h('button', {
            type: 'button', class: `lv ${l.nr ? 'nr' : ''}`, role: 'radio', 'aria-checked': String(!!((D.grades[i.code] || '') === l.code && (l.code || i.code in D.grades))),
            style: l.color ? `--lv:${l.color}` : null,
            onclick: () => { if (l.nr) D.grades[i.code] = ''; else D.grades[i.code] = l.code; keep(); draw(); drawProgress(); } }, l.name))), noteBtn, noteBox);
        draw(); return row;
      }));
    }));
    drawProgress();
  }
  drawItems();
  root.append(h('div', { class: 'section-h' }, icon('clipboard', 20), h('h2', null, 'البنود')), progress, itemsBox);

  // ---------- الختام ----------
  const ta = (k, ph) => { const x = h('textarea', { rows: 3, placeholder: ph }); x.value = D[k] || ''; x.addEventListener('input', () => { D[k] = x.value; keep(); }); return x; };
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const next = h('input', { type: 'date', min: addDays(LIM.today, 1), max: addDays(LIM.today, LIM.next_max_days), value: D.next, 'aria-label': 'موعد الزيارة القادمة' });
  const nextHint = h('small');
  const drawNext = () => { nextHint.textContent = D.next ? `يوافق ${hijri(D.next)}. يظهر في «زياراتي القادمة» وفي ملف المعلم وفي الملخص.` : `اختياري: من الغد حتى ${LIM.next_max_days} يوماً.`; };
  next.addEventListener('input', () => { D.next = next.value; keep(); drawNext(); });
  drawNext();
  root.append(h('section', { class: 'card' }, h('h2', null, 'الختام (اختياري)'),
    h('label', { class: 'field' }, h('span', null, 'ملاحظات عامة للمعلم'), ta('public_notes', 'تظهر في ملخص واتساب')),
    h('label', { class: 'field' }, h('span', null, 'نقاط القوة'), ta('strengths', 'اتركها فارغة ليُبنى ملخص واتساب من أقوى البنود')),
    h('label', { class: 'field' }, h('span', null, 'المطلوب تحسينه'), ta('improvements', 'اتركها فارغة ليُبنى من أضعف البنود')),
    h('label', { class: 'field' }, h('span', null, 'ملاحظات للموجه'), ta('notes', 'خاصة بك، لا تظهر في ملخص واتساب')),
    h('label', { class: 'field' }, h('span', null, 'موعد الزيارة القادمة'), next, nextHint)));

  // ---------- الحفظ ----------
  const saveBtn = h('button', { class: 'btn primary block', type: 'button', disabled: !F.recording_on }, icon('check', 20), F.recording_on ? 'حفظ الزيارة' : 'الحفظ مطفأ — انظر أعلى الصفحة');
  root.append(h('div', { class: 'sticky-bar vt-bar' }, timer.el, saveBtn));   // العدّاد ثابت بجانب «حفظ الزيارة»
  saveBtn.addEventListener('click', async () => {
    if (!D.type) return toast('اختر نوع الزيارة', 'bad');
    if (!D.durEdited || !D.dur) { D.dur = String(elapsed()); dur.value = D.dur; }   // المدة من العدّاد لحظة الحفظ
    if (F.form.needs_track && !D.track) return toast('اختر المسار', 'bad');
    const grades = Object.fromEntries(visible().filter((i) => i.code in D.grades).map((i) => [i.code, D.grades[i.code] || null]));
    if (!Object.values(grades).some(Boolean)) return toast('قيّم بنداً واحداً على الأقل', 'bad');
    const p = { id: D.id, teacher: tid, halaqa: hn, visit_type: D.type, track: D.track || null, duration_minutes: Number(D.dur), started_at: D.started_at,
      grades, strengths: D.strengths, improvements: D.improvements, notes: D.notes, public_notes: D.public_notes, next_visit_date: D.next || null,
      item_notes: Object.fromEntries(Object.entries(D.inotes).filter(([k, v]) => k in grades && grades[k] && String(v || '').trim())),
      client_saved_at: new Date().toISOString(), plan_item: ctx.query['سطر'] || null };   // المرحلة 11: سطر الخطة الذي بدأت منه الزيارة
    const old = saveBtn.textContent; saveBtn.disabled = true; saveBtn.textContent = 'جارٍ الحفظ…';
    try {
      let r;
      if (F.trial) {   // الزيارة التجريبية: خطة علاج الاختبارات تُحفظ معها في الجدول التجريبي، لا في سجل المعلم
        const plan = exams?.plan();
        r = await rpc('rpc_trial_visit_save', { p: { ...p, plan_item: null, mode: 'عادي', exam_plan: plan ? { codes: plan.codes, body: plan.body, students: plan.students } : null } });
        clearDraft();
        return TU.trialDone(r, ctx);
      }
      try { r = await rpc('rpc_visit_save', { p }); }
      catch (e) {
        if (!/سبب التجاوز/.test(e.message)) throw e;
        const v = await askForm({ title: 'تجاوز الحد اليومي', intro: e.message, fields: [{ name: 'reason', label: 'سبب التجاوز', area: true, required: true }], ok: 'احفظ مع السبب' });
        if (!v) return;
        r = await rpc('rpc_visit_save', { p: { ...p, over_cap_reason: v.reason } });
      }
      clearDraft();
      // خطة علاج الاختبارات (اختيارية): تُحفظ في سجل المعلم مرتبطة بالزيارة، ولا تؤثر في التقييم
      const plan = exams?.plan();
      if (plan) await rpc('rpc_exam_plan_save', { p: { teacher: tid, source: 'زيارة', visit_id: r.id, codes: plan.codes, body: plan.body, students: plan.students } })
        .then(() => toast('حُفظت خطة علاج الاختبارات في سجل المعلم', 'ok')).catch(() => toast('حُفظت الزيارة، وتعذّر حفظ خطة الاختبارات', 'bad'));
      done(r);
    } catch (e) { fail(e); } finally { if (saveBtn.isConnected) { saveBtn.disabled = !F.recording_on; saveBtn.textContent = old; } }
  });
  function done(r) {
    const rp = h('div');   // المرحلة 11: «ابدأ خطة علاجية» إن كانت الخطط تعمل وفي الزيارة بنود تحتاج دعماً (يُرسم حين يصل، دون تأخير الورقة)
    const close = sheet({ title: 'حُفظت الزيارة', body: h('div', null,
      h('div', { class: 'row', style: 'gap:6px' }, r.classification ? badge(r.classification, 'ok') : null, badge(`زياراتي اليوم: ${r.today?.done ?? '—'} من ${r.today?.cap ?? '—'}`, 'gray'),
        r.next_visit_date ? badge(`الزيارة القادمة: ${hijri(r.next_visit_date)}`, 'gold') : null),
      h('p', { class: 'muted small', style: 'margin-top:10px' }, 'تحدّث ملخص المعلم فوراً. يمكنك إرسال ملخص الزيارة للمعلم بواتساب.'), rp),
      actions: [
        ...(r.whatsapp ? [{ label: 'ملخص واتساب', kind: 'primary', onClick: async (close) => { close(); await whatsappSheet(r.id); } }] : []),
        { label: 'ملف المعلم', onClick: (close) => { close(); ctx.go('المعلم', { id: tid, تبويب: 'الزيارات' }); } },
      ], onClose: () => { if (location.hash.includes('زيارة')) ctx.go(''); } });
    if (S.profile?.ops?.rplan) import('./rplan.js').then((m) => m.visitHint({ teacher: tid, halaqa: hn, visit: r.id, onStart: () => { close(); m.planSheet({ teacher: tid, halaqa: hn, visit: r.id }).catch(fail); } }))
      .then((el) => { if (el && rp.isConnected) rp.replaceChildren(el); }).catch(() => {});
  }
}
