// «الزيارة المبسطة» (2026-11-25): العرض المبسط لشاشة تسجيل الزيارة على الجوال، خلف المفتاح feature.visit_simple.
// يُحمَّل بـ import() من visit.js فقط حين يعيد rpc_visit_form العلم simple=true؛ فلا يكبر visit.js ولا الحزمة الأولى.
// لا تغيير على بنود الزيارة ولا درجاتها ولا حسابها: النموذج نفسه من rpc_visit_form، والحفظ بالدالة نفسها rpc_visit_save وبالحمولة نفسها.
// الجديد في العرض فقط: ثلاث خطوات بشريط تقدم، وتعبئة تلقائية، وحفظ تلقائي للمسودة واسترجاعها، وملخص قبل الحفظ،
// وزر «؟» بجانب كل بند له شرح معتمد (feature.visit_item_help؛ المعتمد وحده يصل من القاعدة).
import { S, h, rpc, badge, hijri, depName, perName, sheet, toast, fail, askForm, nf } from './core.js';
import { whatsappSheet } from './wa.js';
import { visitTimer, elapsedMin } from './visit_timer.js';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const DRAFT_MAX_MS = 12 * 3600 * 1000;
// رسالة «مطفأ» الموحدة (off_notice.js تُحمَّل عند الحاجة فقط)
const offSlot = (key) => { const el = h('div', { class: 'off-slot' }); import('./off_notice.js').then((m) => el.replaceWith(m.offNotice(key, { trial: true, what: 'تسجيل الزيارات مطفأ الآن.' }))).catch(() => {}); return el; };
const STEPS = ['نوع الزيارة', 'البنود', 'المراجعة والحفظ'];

const CSS = `
[data-vs]{display:flex;flex-direction:column;gap:12px;padding-bottom:12px}
.vs-top{position:sticky;top:var(--top-h,56px);z-index:9;background:var(--paper);padding:8px 0 6px}
.vs-top .vs-who{font-weight:700}
.vs-bar{height:8px;border-radius:99px;background:var(--sunk);overflow:hidden;margin-top:6px}
.vs-bar>i{display:block;height:100%;background:var(--brand);border-radius:99px;transition:width var(--dur,180ms)}
.vs-step{font-size:var(--fs-s);color:var(--ink-3);font-weight:600;margin-top:6px}
.vs-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-m);padding:14px}
.vs-card h2{margin:0 0 8px;font-size:var(--fs-l)}
.vs-types{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.vs-type{min-height:64px;border:1.5px solid var(--line-2);background:var(--surface);border-radius:14px;font:inherit;font-weight:700;color:var(--ink);cursor:pointer;padding:8px}
.vs-type[aria-checked=true]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.vs-item{padding:12px 0;border-top:1px solid var(--line)}
.vs-item:first-of-type{border-top:0}
.vs-head{display:flex;align-items:flex-start;gap:8px;justify-content:space-between}
.vs-name{font-weight:700;line-height:1.5}
.vs-help{flex:none;min-width:44px;min-height:44px;border-radius:50%;border:1.5px solid var(--info);background:var(--info-soft);color:var(--info);font:inherit;font-weight:800;font-size:var(--fs-l);cursor:pointer}
.vs-lv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.vs-lv button{min-height:48px;border-radius:12px;border:1.5px solid var(--line-2);background:var(--surface);font:inherit;font-weight:700;font-size:var(--fs-s);color:var(--ink-2);cursor:pointer;padding:4px 6px}
.vs-lv button[aria-checked=true],.vs-lv button.nr[aria-checked=true]{background:var(--sel);border-color:var(--sel-ring);border-style:solid;color:var(--sel-ink);box-shadow:0 0 0 2px var(--sel-ring) inset}
.vs-lv button[aria-checked=true]::before{content:"✓ ";font-weight:800}
.vs-lv button.nr{border-style:dashed}
.vs-type[aria-checked=true]::before{content:"✓ ";font-weight:800}
.vs-bulk{margin:0 0 6px}
.vs-note-btn{min-height:44px;background:none;border:0;color:var(--brand-2);font:inherit;font-weight:700;cursor:pointer;padding:0 4px}
.vs-note textarea{width:100%;min-height:72px}
.vs-nav{position:sticky;bottom:calc(var(--tab-h,64px) + var(--safe-b,0px) + 8px);z-index:10;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-m);padding:10px;box-shadow:0 4px 18px rgba(0,0,0,.16);display:flex;gap:8px;align-items:center}
.vs-nav .btn{min-height:48px}
.vs-nav .grow{flex:1}
.vs-count{font-weight:700;font-variant-numeric:tabular-nums;flex:none}
.vs-err{color:var(--bad);background:var(--bad-soft);border-radius:10px;padding:8px 10px;font-size:var(--fs-s);margin-top:6px}
.vs-resume{background:var(--info-soft);color:var(--info);border-radius:12px;padding:10px 12px;display:flex;gap:8px;align-items:center;justify-content:space-between}
.vs-sum dt{color:var(--ink-3);font-size:var(--fs-s)}
.vs-sum dd{margin:0 0 8px;font-weight:700}
.vs-opt{width:100%;min-height:48px;text-align:start;background:var(--surface-2);border:1px dashed var(--line-2);border-radius:12px;font:inherit;font-weight:700;color:var(--ink-2);cursor:pointer;padding:0 12px}
.vs-field{display:block;margin-top:10px}
.vs-field>span{display:block;font-weight:700;margin-bottom:4px}
.vs-field input,.vs-field textarea,.vs-field select{width:100%;min-height:48px}
.vs-field small{display:block;color:var(--ink-3);margin-top:4px}
`;

export async function render(root, ctx, F, tid, hn) {
  if (!document.getElementById('vs-css')) { const st = h('style', { id: 'vs-css' }); st.textContent = CSS; document.head.append(st); }
  // المفتاح يحمل رقم الشخص، فلا يرى موجه آخر على الجهاز نفسه مسودة غيره؛ وتُمسح كل المسودات عند الخروج (core.js clearSession)
  const DK = `tawjeeh.vs.${S.profile?.person_id || 'x'}.${F.trial ? 'trial.' : ''}${tid}.${hn}`;
  const LIM = F.limits || { next_max_days: 120, item_note_max: 300, today: new Date().toISOString().slice(0, 10) };
  const helps = F.item_help && F.helps ? F.helps : {};
  const items = F.axes.flatMap((a) => a.items);
  const levels = F.levels;
  const t = F.today; const full = t.cap != null && t.done >= t.cap;
  const fresh = () => ({ id: uuid(), started_at: new Date().toISOString(), grades: {}, inotes: {}, type: F.types[0]?.code || '', track: '', dur: '', durEdited: false,
    strengths: '', improvements: '', notes: '', public_notes: '', next: '' });
  let D = null; let step = 1; let resumedAt = null;
  try {
    const raw = JSON.parse(localStorage.getItem(DK) || 'null');
    if (raw && raw.D && Date.now() - raw.t < DRAFT_MAX_MS) { D = { ...fresh(), ...raw.D }; step = Math.min(3, Math.max(1, raw.step || 1)); resumedAt = raw.t; }
  } catch { /* */ }
  if (!D) D = fresh();
  const keep = () => { try { localStorage.setItem(DK, JSON.stringify({ t: Date.now(), step, D })); } catch { /* */ } };
  const clear = () => { try { localStorage.removeItem(DK); } catch { /* */ } };
  const hasWork = () => Object.keys(D.grades).length > 0;
  const visible = () => items.filter((i) => !F.form.needs_track || !D.track || ['الكل', 'مشترك'].includes(i.track) || i.track === D.track);
  const elapsed = () => elapsedMin(D.started_at);
  const typeOf = () => F.types.find((x) => x.code === D.type);
  // عدّاد المدة (2026-11-25): من وقت البدء المحفوظ في المسودة، ثابت أعلى الشاشة في الخطوات الثلاث، ويملأ حقل المدة ما لم يُعدَّل باليد
  let durInput = null;
  const timer = visitTimer({ startedAt: () => D.started_at, type: typeOf,
    onTick: (m) => { if (!D.durEdited && durInput?.isConnected && document.activeElement !== durInput) durInput.value = String(m); } });
  let exams = null;

  const wrap = h('div', { 'data-vs': '' });
  root.append(wrap);
  const onHide = () => keep(); window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onHide);

  function go(n) { step = n; keep(); draw(); window.scrollTo({ top: 0 }); }

  function top() {
    return h('div', { class: 'vs-top' },
      h('div', { class: 'row between nowrap' },
        h('div', { class: 'grow' }, h('div', { class: 'vs-who' }, F.teacher.name), h('div', { class: 'muted small' }, `الحلقة ${F.halaqa.number} • ${depName(F.halaqa.department) || '—'} • ${perName(F.halaqa.period) || '—'}`),
          badge(F.trial ? `تجريبية اليوم: ${nf(t.done)}` : `زياراتي اليوم: ${nf(t.done)} من ${t.cap ?? '—'}`, full ? 'warn' : 'gray')),
        timer.el),
      h('div', { class: 'vs-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 3, 'aria-valuenow': step, 'aria-label': 'تقدم الزيارة' }, h('i', { style: `width:${Math.round((step / 3) * 100)}%` })),
      h('div', { class: 'vs-step' }, `الخطوة ${nf(step)} من ${nf(3)}: ${STEPS[step - 1]}`));
  }

  function resumeNote() {
    if (!resumedAt || !(hasWork() || step > 1)) return null;
    const mins = Math.max(1, Math.round((Date.now() - resumedAt) / 60000));
    const when = mins < 60 ? `${nf(mins)} دقيقة` : `${nf(Math.round(mins / 60))} ساعة`;
    return h('div', { class: 'vs-resume', role: 'status' }, h('span', null, `لديك زيارة لم تكتمل لهذا المعلم، استرجعناها (آخر حفظ قبل ${when}).`),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { clear(); D = fresh(); step = 1; resumedAt = null; draw(); } }, 'ابدأ من جديد'));
  }

  function draw() {
    wrap.replaceChildren(top(), resumeNote(), step === 1 ? step1() : step === 2 ? step2() : step3());
    resumedAt = resumedAt && (hasWork() || step > 1) ? resumedAt : null;
  }

  // ---------- 1) نوع الزيارة ----------
  function step1() {
    const err = h('div', { class: 'vs-err', hidden: true, role: 'alert' });
    const nextBtn = () => { if (F.form.needs_track && !D.track) { err.textContent = 'اختر المسار (حضوري أو عن بعد) ثم اضغط «التالي». البنود تختلف حسب المسار.'; err.hidden = false; trackSel.focus(); return; } go(2); };
    const types = h('div', { class: 'vs-types', role: 'radiogroup', 'aria-label': 'نوع الزيارة' }, F.types.map((x) => h('button', { type: 'button', class: 'vs-type', role: 'radio', 'aria-checked': String(D.type === x.code),
      onclick: () => { D.type = x.code; keep(); timer.update(); if (!F.form.needs_track || D.track) go(2); else { draw(); } } },
      x.name, h('div', { class: 'xs', style: 'font-weight:500;opacity:.85' }, `${nf(x.min)}–${nf(x.max)} دقيقة`))));
    let trackSel = null;
    if (F.form.needs_track) {
      trackSel = h('select', { 'aria-label': 'المسار', onchange: (e) => { D.track = e.target.value; keep(); err.hidden = true; } }, h('option', { value: '' }, 'اختر المسار'), (F.form.tracks || []).map((x) => h('option', { value: x }, x)));
      trackSel.value = D.track;
    }
    return h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      full ? h('div', { class: 'note' }, t.mode === 'منع' ? 'بلغت الحد اليومي لهذه الفترة، ولن تُقبل زيارة أخرى اليوم.' : 'بلغت الحد اليومي لهذه الفترة. يمكنك الحفظ إن كتبت السبب، ويُحفظ السبب مع الزيارة.') : null,
      F.recording_on ? null : offSlot('feature.visits'),
      h('section', { class: 'vs-card' }, h('h2', null, 'اختر نوع الزيارة'), types,
        trackSel ? h('label', { class: 'vs-field' }, h('span', null, 'المسار'), trackSel) : null, err,
        h('p', { class: 'muted small', style: 'margin:10px 0 0' }, `معبّأ تلقائياً: ${F.form.name} • ${hijri(new Date())} • بدأتَ الساعة ${new Date(D.started_at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}. عدّاد المدة أعلى الشاشة بدأ من الآن، والمدة تُحسب منه تلقائياً (ويمكنك تعديلها في الخطوة الأخيرة).`)),
      trackSel ? h('div', { class: 'vs-nav' }, h('button', { type: 'button', class: 'btn primary grow', onclick: nextBtn }, 'التالي')) : null);
  }

  // ---------- 2) البنود ----------
  function step2() {
    const counter = h('span', { class: 'vs-count', 'aria-live': 'polite' });
    const nextBtn = h('button', { type: 'button', class: 'btn primary grow', onclick: () => go(3) }, 'التالي: المراجعة');
    const refresh = () => { const v = visible(); const n = v.filter((i) => D.grades[i.code]).length; counter.textContent = `قيّمت ${nf(n)} من ${nf(v.length)}`; };
    const sections = F.axes.map((a) => {
      const its = a.items.filter((i) => visible().includes(i));
      if (!its.length) return null;
      const bulk = h('div', { class: 'vs-bulk' }); let last = null;
      const rows = its.map((i) => {
        const row = h('div', { class: 'vs-item', 'data-item': i.code });
        const noteEl = h('textarea', { rows: 2, maxlength: LIM.item_note_max, placeholder: 'ملاحظتك على هذا البند (اختيارية، تظهر في الملخص)', 'aria-label': `ملاحظة على ${i.name}` });
        noteEl.value = D.inotes[i.code] || ''; noteEl.addEventListener('input', () => { D.inotes[i.code] = noteEl.value; keep(); });
        const noteBox = h('div', { class: 'vs-note', hidden: !D.inotes[i.code] }, noteEl);
        const noteBtn = h('button', { type: 'button', class: 'vs-note-btn', hidden: !!D.inotes[i.code], onclick: () => { noteBox.hidden = false; noteBtn.hidden = true; noteEl.focus(); } }, '+ ملاحظة على البند');
        const set = (code) => { D.grades[i.code] = code; if (D.bulk) delete D.bulk[i.code]; keep(); };
        const draw1 = () => row.replaceChildren(
          h('div', { class: 'vs-head' }, h('div', { class: 'vs-name' }, i.name, i.hint ? h('div', { class: 'muted small', style: 'font-weight:500' }, i.hint) : null),
            helps[i.code] ? h('button', { type: 'button', class: 'vs-help', 'aria-label': `شرح البند: ${i.name}`, onclick: () => helpSheet(i) }, '؟') : null),
          h('div', { class: 'vs-lv', role: 'radiogroup', 'aria-label': i.name }, [...levels, { code: '', name: 'لم يُقيَّم', nr: true }].map((l) => h('button', {
            type: 'button', class: l.nr ? 'nr' : '', role: 'radio', 'aria-checked': String(!!((D.grades[i.code] || '') === l.code && (l.code || i.code in D.grades))), style: l.color ? `--lv:${l.color}` : null,
            onclick: () => {
              set(l.nr ? '' : l.code); draw1(); refresh(); if (l.nr) drawBulk();
              if (!l.nr) { last = l; drawBulk(); const nx = rows.find((r) => r.el !== row && !(r.code in D.grades)); if (nx && nx.el.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_PRECEDING) nx.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            } }, l.name))), noteBtn, noteBox);
        draw1();
        return { code: i.code, el: row };
      });
      function drawBulk() {
        // (المراجعة المستقلة 2026-11-25) «الباقي» = ما لم يُلمس أصلاً؛ البند الذي اختار له الموجه «لم يُقيَّم» صراحةً لا يُكتب فوقه
        const left = its.filter((i) => !(i.code in D.grades));
        if (!last || left.length < 2) { bulk.replaceChildren(); return; }
        bulk.replaceChildren(h('button', { type: 'button', class: 'btn sm', onclick: () => {
          D.bulk ||= {}; for (const i of its.filter((x) => !(x.code in D.grades))) { D.grades[i.code] = last.code; D.bulk[i.code] = true; } keep(); draw(); } }, `طبّق «${last.name}» على باقي بنود المحور (${nf(left.length)})`));
      }
      return h('section', { class: 'vs-card' }, h('h2', null, a.name), bulk, rows.map((r) => r.el));
    });
    refresh();
    return h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, sections,
      h('div', { class: 'vs-nav' }, h('button', { type: 'button', class: 'btn', onclick: () => go(1) }, 'رجوع'), counter, nextBtn));
  }

  function helpSheet(i) {
    const x = helps[i.code]; if (!x) return;
    sheet({ title: i.name, body: h('div', null, x.status === 'مسودة' ? h('p', { class: 'xs', style: 'color:var(--warn);font-weight:700' }, 'مسودة لم تعتمدها بعد — لا يراها الموجهون') : null, String(x.body || '').split('\n').filter(Boolean).map((l) => h('p', null, l)),
      x.example ? h('p', { class: 'muted' }, `مثال: ${x.example}`) : null), actions: [{ label: 'فهمت' }] });
  }

  // ---------- 3) المراجعة والحفظ ----------
  function step3() {
    const ty = typeOf();
    const dur = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 240, value: D.durEdited && D.dur ? D.dur : String(elapsed()), 'aria-label': 'مدة الزيارة بالدقائق' });
    durInput = dur;
    const durErr = h('div', { class: 'vs-err', hidden: true, role: 'alert' });
    const durNote = h('small');
    const autoBtn = h('button', { type: 'button', class: 'btn sm ghost', style: 'margin-top:6px', onclick: () => { D.durEdited = false; D.dur = ''; keep(); dur.value = String(elapsed()); drawDurNote(); } }, 'ارجع للحساب التلقائي');
    const drawDurNote = () => { durNote.textContent = `${D.durEdited ? 'عدّلتها بيدك، ولن تتغير مع العدّاد. ' : 'محسوبة تلقائياً من وقت البدء، وتتحدّث مع العدّاد. '}${ty ? `المسموح: من ${nf(ty.min)} إلى ${nf(ty.max)} دقيقة.` : ''}`; autoBtn.hidden = !D.durEdited; };
    drawDurNote();
    dur.addEventListener('input', () => { D.dur = dur.value; D.durEdited = true; keep(); durErr.hidden = true; drawDurNote(); });
    const grErr = h('div', { class: 'vs-err', hidden: true, role: 'alert' });
    const v = visible(); const graded = v.filter((i) => D.grades[i.code]); const left = v.filter((i) => !D.grades[i.code]);
    const byLevel = levels.map((l) => [l, graded.filter((i) => D.grades[i.code] === l.code).length]).filter(([, n]) => n);
    const ta = (k, ph) => { const x = h('textarea', { rows: 3, placeholder: ph }); x.value = D[k] || ''; x.addEventListener('input', () => { D[k] = x.value; keep(); }); return x; };
    const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const next = h('input', { type: 'date', min: addDays(LIM.today, 1), max: addDays(LIM.today, LIM.next_max_days), value: D.next, 'aria-label': 'موعد الزيارة القادمة' });
    const nextHint = h('small'); const drawNext = () => { nextHint.textContent = D.next ? `يوافق ${hijri(D.next)}.` : `اختياري: من الغد حتى ${nf(LIM.next_max_days)} يوماً.`; };
    next.addEventListener('input', () => { D.next = next.value; keep(); drawNext(); }); drawNext();
    const more = h('div', { hidden: true },
      h('label', { class: 'vs-field' }, h('span', null, 'ملاحظات عامة للمعلم'), ta('public_notes', 'تظهر في ملخص واتساب')),
      h('label', { class: 'vs-field' }, h('span', null, 'نقاط القوة'), ta('strengths', 'اتركها فارغة ليُبنى الملخص من أقوى البنود')),
      h('label', { class: 'vs-field' }, h('span', null, 'المطلوب تحسينه'), ta('improvements', 'اتركها فارغة ليُبنى من أضعف البنود')),
      h('label', { class: 'vs-field' }, h('span', null, 'ملاحظات للموجه'), ta('notes', 'خاصة بك، لا تظهر في ملخص واتساب')),
      h('label', { class: 'vs-field' }, h('span', null, 'موعد الزيارة القادمة'), next, nextHint));
    const moreBtn = h('button', { type: 'button', class: 'vs-opt', 'aria-expanded': 'false', onclick: () => { more.hidden = !more.hidden; moreBtn.setAttribute('aria-expanded', String(!more.hidden)); } }, 'ملاحظات وموعد الزيارة القادمة (اختياري)');
    const exHolder = h('div', { hidden: true });
    let exLoaded = false;
    const exBtn = F.can_exams !== false ? h('button', { type: 'button', class: 'vs-opt', 'aria-expanded': 'false', onclick: async () => {
      exHolder.hidden = !exHolder.hidden; exBtn.setAttribute('aria-expanded', String(!exHolder.hidden));
      if (!exLoaded && !exHolder.hidden) { exLoaded = true; try { const m = await import('./exams_tab.js'); exams = await m.visitCard(tid, { trial: !!F.trial }); exHolder.replaceChildren(exams.el); } catch { exHolder.replaceChildren(h('p', { class: 'muted small' }, 'تعذّر تحميل بطاقة الاختبارات الآن. أغلقها وافتحها بعد قليل.')); } } } }, 'الاختبارات وخطة علاج (اختياري)') : null;
    if (exams) { exLoaded = true; exHolder.replaceChildren(exams.el); }

    const saveBtn = h('button', { class: 'btn primary grow', type: 'button', disabled: !F.recording_on }, F.recording_on ? 'حفظ الزيارة' : 'الحفظ مطفأ — انظر الخطوة 1');
    saveBtn.addEventListener('click', async () => {
      durErr.hidden = true; grErr.hidden = true;
      if (!D.durEdited || !D.dur) { D.dur = String(elapsed()); dur.value = D.dur; }   // المدة من العدّاد لحظة الحفظ
      const dm = Number(D.dur);
      if (!D.dur || !(dm >= 1)) { durErr.textContent = 'اكتب مدة الزيارة بالدقائق.'; durErr.hidden = false; dur.focus(); return; }
      if (ty && (dm < ty.min || dm > ty.max)) { durErr.textContent = `المدة المسموحة لنوع «${ty.name}» من ${nf(ty.min)} إلى ${nf(ty.max)} دقيقة. صحّح الرقم.`; durErr.hidden = false; dur.focus(); return; }
      const grades = Object.fromEntries(visible().filter((i) => i.code in D.grades).map((i) => [i.code, D.grades[i.code] || null]));
      if (!Object.values(grades).some(Boolean)) { grErr.textContent = 'لم تقيّم أي بند بعد. اضغط «رجوع للبنود» أسفل الشاشة، وقيّم بنداً واحداً على الأقل.'; grErr.hidden = false; return; }
      const p = { id: D.id, teacher: tid, halaqa: hn, visit_type: D.type, track: D.track || null, duration_minutes: dm, started_at: D.started_at,
        grades, strengths: D.strengths, improvements: D.improvements, notes: D.notes, public_notes: D.public_notes, next_visit_date: D.next || null,
        item_notes: Object.fromEntries(Object.entries(D.inotes).filter(([k, x]) => k in grades && grades[k] && String(x || '').trim())),
        client_saved_at: new Date().toISOString(), plan_item: ctx.query['سطر'] || null };
      const old = saveBtn.textContent; saveBtn.disabled = true; saveBtn.textContent = 'جارٍ الحفظ…';
      try {
        let r;
        if (F.trial) {   // الزيارة التجريبية: في الجدول التجريبي وحده، ومعها خطة علاج الاختبارات
          const plan = exams?.plan();
          r = await rpc('rpc_trial_visit_save', { p: { ...p, plan_item: null, mode: 'مبسط', exam_plan: plan ? { codes: plan.codes, body: plan.body, students: plan.students } : null } });
          clear(); window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide);
          return (await import('./trial_ui.js')).trialDone(r, ctx);
        }
        try { r = await rpc('rpc_visit_save', { p }); }
        catch (e) {
          if (!/سبب التجاوز/.test(e.message)) throw e;
          const x = await askForm({ title: 'تجاوز الحد اليومي', intro: e.message, fields: [{ name: 'reason', label: 'سبب التجاوز', area: true, required: true }], ok: 'احفظ مع السبب' });
          if (!x) return;
          r = await rpc('rpc_visit_save', { p: { ...p, over_cap_reason: x.reason } });
        }
        clear(); window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide);
        const plan = exams?.plan();
        if (plan) await rpc('rpc_exam_plan_save', { p: { teacher: tid, source: 'زيارة', visit_id: r.id, codes: plan.codes, body: plan.body, students: plan.students } })
          .then(() => toast('حُفظت خطة علاج الاختبارات في سجل المعلم', 'ok')).catch(() => toast('حُفظت الزيارة، وتعذّر حفظ خطة الاختبارات', 'bad'));
        done(r);
      } catch (e) { fail(e); } finally { if (saveBtn.isConnected) { saveBtn.disabled = !F.recording_on; saveBtn.textContent = old; } }
    });

    return h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      h('section', { class: 'vs-card' }, h('h2', null, 'ملخص الزيارة قبل الحفظ'),
        h('dl', { class: 'vs-sum', style: 'margin:0' },
          h('dt', null, 'المعلم والحلقة'), h('dd', null, `${F.teacher.name} • الحلقة ${F.halaqa.number}`),
          h('dt', null, 'نوع الزيارة'), h('dd', null, ty ? ty.name : '—', F.form.needs_track ? ` • ${D.track || '—'}` : ''),
          h('dt', null, 'البنود المقيّمة'), h('dd', null, `${nf(graded.length)} من ${nf(v.length)}`, byLevel.length ? h('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, byLevel.map(([l, n]) => badge(`${l.name}: ${nf(n)}`, 'gray'))) : null)),
        (() => { const nb = Object.keys(D.bulk || {}).filter((k) => D.grades[k]).length; return nb ? h('div', { class: 'note' }, `منها ${nf(nb)} بنداً قُيّمت بزر «طبّق على باقي بنود المحور». راجعها إن شئت قبل الحفظ.`) : null; })(),
        left.length ? h('div', { class: 'note' }, `بقي ${nf(left.length)} بنداً بلا تقييم، ولن يُحسب في الزيارة: ${left.slice(0, 4).map((i) => i.name).join('، ')}${left.length > 4 ? '…' : ''}`) : null,
        grErr,
        h('label', { class: 'vs-field' }, h('span', null, 'مدة الزيارة (دقيقة)'), dur, durNote, durErr), autoBtn),
      moreBtn, more, exBtn, exHolder,
      h('div', { class: 'vs-nav' }, h('button', { type: 'button', class: 'btn', onclick: () => go(2) }, 'رجوع للبنود'), saveBtn));
  }

  function done(r) {
    const rp = h('div');   // المرحلة 11: «ابدأ خطة علاجية» (يُرسم حين يصل)
    const close = sheet({ title: 'حُفظت الزيارة', body: h('div', null,
      h('div', { class: 'row', style: 'gap:6px' }, r.classification ? badge(r.classification, 'ok') : null, badge(`زياراتي اليوم: ${r.today?.done ?? '—'} من ${r.today?.cap ?? '—'}`, 'gray'),
        r.next_visit_date ? badge(`الزيارة القادمة: ${hijri(r.next_visit_date)}`, 'gold') : null),
      h('p', { class: 'muted small', style: 'margin-top:10px' }, 'تم تحديث ملف المعلم. يمكنك إرسال ملخص الزيارة له بواتساب.'), rp),
      actions: [
        ...(r.whatsapp ? [{ label: 'ملخص واتساب', kind: 'primary', onClick: async (close) => { close(); await whatsappSheet(r.id); } }] : []),
        { label: 'ملف المعلم', onClick: (close) => { close(); ctx.go('المعلم', { id: tid, تبويب: 'الزيارات' }); } },
      ], onClose: () => { if (location.hash.includes('زيارة')) ctx.go(''); } });
    if (S.profile?.ops?.rplan) import('./rplan.js').then((m) => m.visitHint({ teacher: tid, halaqa: hn, visit: r.id, onStart: () => { close(); m.planSheet({ teacher: tid, halaqa: hn, visit: r.id }).catch(fail); } }))
      .then((el) => { if (el && rp.isConnected) rp.replaceChildren(el); }).catch(() => {});
  }

  draw();
}
