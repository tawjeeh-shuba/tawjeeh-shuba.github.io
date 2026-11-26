// الشاشة 10 — الفترات والفصول الدراسية والتقويم الهجري (أم القرى 1440–1470).
// التقويم: عرض شهري، وتعديل بداية شهر بسبب، وإجازات رسمية. الفصول: إضافة وتعديل وإيقاف ونسخ لعام تالٍ (لا تداخل).
// الفترات: الاسم والوردية والوقت والترتيب، وإضافة، وإيقاف (لا يُسمح والحلقات النشطة فيها). لا حذف، وكل شيء بمعاينة وسبب.
import { S, h, get, rpc, refs, badge, field, fail, seg, sheet, today, empty, nf, toast, toLatinDigits } from './core.js';
import { canEdit, previewThenSave, DAYS } from './panel_ui.js';

const E = encodeURIComponent;
export async function render(root) {
  const edit = canEdit('P10');
  let tab = 'التقويم';
  const bar = h('div'); const body = h('div');
  const draw = () => { bar.replaceChildren(seg([{ value: 'التقويم', label: 'التقويم' }, { value: 'الفصول', label: 'الفصول' }, { value: 'الفترات', label: 'الفترات' }], tab, (v) => { tab = v; draw(); }));
    body.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    ({ 'التقويم': calendar, 'الفصول': terms, 'الفترات': periods })[tab](body).then(() => body.querySelector(':scope > .loading')?.remove()).catch((e) => { body.replaceChildren(); fail(e); }); };
  root.append(...(edit ? [] : [h('p', { class: 'muted' }, 'لديك اطلاع فقط.')]), bar, body);
  draw();

  // ---------- التقويم ----------
  async function calendar(box) {
    const now = (await get(`hijri_calendar?select=month_key&g_date=eq.${today()}`))[0]?.month_key || '1448-06';
    let key = now;
    const wrap = h('div'); box.append(wrap);
    async function show() {
      const [m] = await get(`hijri_months?select=*&month_key=eq.${key}`);
      const days = await get(`hijri_calendar?select=g_date,h_day,weekday,is_workday,is_holiday,holiday_name,source,adjust_note&month_key=eq.${key}&order=g_date`);
      const [y, mo] = key.split('-').map(Number);
      const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`, next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:8px 0' },
        DAYS.map((d) => h('div', { class: 'xs muted', style: 'text-align:center' }, d.replace(/^ال/, ''))),   // «أحد» و«أربعاء» لا «الأ» مرتين
        Array.from({ length: days[0]?.weekday || 0 }, () => h('div')),
        days.map((d) => h('div', { title: d.holiday_name || d.adjust_note || '', style: `border-radius:10px;padding:4px 2px;text-align:center;background:${d.is_holiday ? 'var(--warn-soft)' : d.is_workday ? 'var(--sunk)' : 'transparent'};${d.g_date === today() ? 'outline:2px solid var(--brand-2);' : ''}` },
          h('b', null, d.h_day), h('div', { class: 'xs muted', style: 'direction:ltr' }, d.g_date.slice(5).replace('-', '/')), d.source === 'تعديل يدوي' ? h('div', { class: 'xs', style: 'color:var(--info)' }, 'معدَّل') : null)));
      const hol = days.filter((d) => d.is_holiday);
      wrap.replaceChildren(h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { key = prev; show(); } }, '‹ السابق'), h('h2', { style: 'margin:0' }, m?.label || key),
          h('button', { class: 'btn sm', type: 'button', onclick: () => { key = next; show(); } }, 'التالي ›')),
        m ? h('div', { class: 'muted small' }, `${m.days} يوماً • أيام الدوام ${m.workdays} • من ${m.start_date} إلى ${m.end_date}`, m.has_manual ? ' • فيه تعديل يدوي' : '') : empty('الشهر خارج التقويم (1440–1470).'),
        grid, h('div', { class: 'xs muted' }, 'الخلفية الرمادية يوم دوام، والصفراء إجازة رسمية.'),
        hol.length ? h('div', { class: 'small' }, 'الإجازات: ', [...new Set(hol.map((d) => d.holiday_name))].join('، ')) : null,
        edit && m ? h('div', { class: 'btns', style: 'margin-top:8px' },
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => moveStart(m) }, 'تعديل بداية الشهر'),
          h('button', { class: 'btn sm soft', type: 'button', onclick: () => holiday(true, m) }, 'إضافة إجازة'),
          hol.length ? h('button', { class: 'btn sm', type: 'button', onclick: () => holiday(false, m, hol) }, 'إلغاء إجازة') : null) : null));
    }
    async function moveStart(m) {
      const d = h('input', { type: 'date', value: m.start_date });
      const v = await ask(`بداية ${m.label}`, [field('أول يوم في الشهر (ميلادي)', d, `الحالي ${m.start_date}. الشهر الهجري 29 أو 30 يوماً، فالتعديل عادة يوم واحد قبل أو بعد.`)]);
      if (!v) return;
      if (await previewThenSave({ screen: 'P10', title: `تعديل بداية ${m.label}`, draft: { op: 'month_start', h_year: m.h_year, h_month: m.h_month, start: d.value },
        lines: (pv) => [['البداية الحالية', pv.old_start], ['البداية الجديدة', pv.new_start], ['الشهر السابق يصير', pv.prev_month_days && `${pv.prev_month_days} يوماً`], ['هذا الشهر يصير', pv.this_month_days && `${pv.this_month_days} يوماً`], ['أيام يتغير تاريخها الهجري', pv.days_changed], ['الأثر', pv.affected_records]],
        save: (reason) => rpc('rpc_calendar_set_month_start', { p_year: m.h_year, p_month: m.h_month, p_start: d.value, p_reason: reason }) })) show();
    }
    async function holiday(on, m, hol) {
      const f = h('input', { type: 'date', value: on ? m.start_date : hol[0].g_date }), t = h('input', { type: 'date', value: on ? m.start_date : hol.at(-1).g_date }), n = h('input', { type: 'text', placeholder: 'مثل: إجازة عيد الفطر' });
      const v = await ask(on ? 'إضافة إجازة رسمية' : 'إلغاء إجازة', [field('من', f), field('إلى', t), on ? field('اسم الإجازة', n) : null]);
      if (!v) return;
      if (await previewThenSave({ screen: 'P10', title: on ? 'إضافة إجازة' : 'إلغاء إجازة', draft: { op: 'holiday', from: f.value, to: t.value, is_holiday: on, name: n.value },
        lines: (pv) => [['المدة', `${pv.days ?? '—'} يوماً`], ['أيام دوام تتأثر', pv.workdays_affected]],
        save: (reason) => rpc('rpc_calendar_set_holiday', { p_from: f.value, p_to: t.value, p_is_holiday: on, p_name: n.value, p_reason: reason }) })) show();
    }
    await show();
  }

  // ---------- الفصول ----------
  async function terms(box) {
    const rows = await get('v_terms?select=*&order=start_date.desc');
    put(box, h('p', { class: 'muted small' }, 'التقييم التراكمي وتقويم الموجه يُحسبان بالفصل، وما لا يقع في فصل يُحسب «للعام كاملاً». لا يُقبل فصلان نشطان متداخلان.'),
      edit ? h('div', { class: 'btns', style: 'margin-bottom:8px' }, h('button', { class: 'btn sm primary', type: 'button', onclick: () => save(null) }, '＋ إضافة فصل'),
        h('button', { class: 'btn sm soft', type: 'button', onclick: copyYear }, 'نسخ فصول عام إلى العام التالي')) : null,
      rows.length ? rows.map((t) => h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('b', null, `الفصل ${t.name} — ${t.h_year}هـ`), h('span', { class: 'row' }, !t.is_active ? badge('موقوف', 'bad') : badge(t.status, t.status === 'جارٍ' ? 'ok' : 'gray'))),
        h('div', { class: 'small' }, `${t.h_start || ''} ← ${t.h_end || ''}`, h('span', { class: 'muted' }, ` (${t.start_date} إلى ${t.end_date}) • أيام الدوام ${nf(t.workdays)}`)),
        t.note ? h('div', { class: 'muted small' }, t.note) : null, t.stop_reason ? h('div', { class: 'muted small' }, 'سبب الإيقاف: ', t.stop_reason) : null,
        edit ? h('div', { class: 'btns', style: 'margin-top:6px' }, h('button', { class: 'btn sm', type: 'button', onclick: () => save(t) }, 'تعديل'),
          h('button', { class: `btn sm ${t.is_active ? 'danger' : 'soft'}`, type: 'button', onclick: () => toggle(t) }, t.is_active ? 'إيقاف' : 'إعادة تفعيل')) : null))
        : empty('لا توجد فصول بعد. أضف فصول العام الحالي بتواريخها (تُختار ميلادياً ويظهر مقابلها الهجري).'));
    async function save(t) {
      const y = h('input', { type: 'number', value: t?.h_year || 1448, inputmode: 'numeric' }), n = h('input', { type: 'text', value: t?.name || '', placeholder: 'الأول، الثاني، الثالث، الصيفي…' });
      const s = h('input', { type: 'date', value: t?.start_date || '' }), e = h('input', { type: 'date', value: t?.end_date || '' }), note = h('input', { type: 'text', value: t?.note || '' });
      if (!(await ask(t ? 'تعديل فصل' : 'إضافة فصل', [field('العام الهجري', y), field('الاسم', n), field('من', s), field('إلى', e), field('ملاحظة (اختيارية)', note)]))) return;
      if (await previewThenSave({ screen: 'P10', title: t ? 'تعديل الفصل' : 'إضافة فصل', draft: { op: 'term', id: t?.id, h_year: +y.value, name: n.value, start: s.value, end: e.value, is_active: t ? t.is_active : true },
        lines: (pv) => [['الفصل', `${n.value} ${y.value}هـ`], ['من', `${pv.h_start || ''} (${s.value})`], ['إلى', `${pv.h_end || ''} (${e.value})`], ['الأيام / أيام الدوام', pv.days ? `${pv.days} / ${pv.workdays}` : null],
          pv.overlaps?.length ? ['يتداخل مع', pv.overlaps.map((o) => `${o.name} ${o.h_year}`).join('، ')] : null],
        save: (reason) => rpc('rpc_term_save', { p_id: t?.id || null, p_h_year: +y.value, p_name: n.value, p_start: s.value, p_end: e.value, p_note: note.value, p_reason: reason, p_row_version: t?.row_version ?? null }) })) redraw();
    }
    async function toggle(t) {
      if (await previewThenSave({ screen: 'P10', title: t.is_active ? 'إيقاف الفصل' : 'إعادة تفعيل الفصل', draft: t.is_active ? null : { op: 'term', id: t.id, h_year: t.h_year, name: t.name, start: t.start_date, end: t.end_date, is_active: true },
        lines: () => [['الفصل', `${t.name} ${t.h_year}هـ`], ['الأثر', t.is_active ? 'يتوقف استعماله في الحسابات الجديدة، ولا يُحذف' : 'يعود للاستعمال']],
        save: (reason) => rpc('rpc_term_set_active', { p_id: t.id, p_active: !t.is_active, p_reason: reason }), okLabel: t.is_active ? 'أوقف' : 'أعد التفعيل' })) redraw();
    }
    async function copyYear() {
      const a = h('input', { type: 'number', value: 1448 }), b = h('input', { type: 'number', value: 1449 });
      if (!(await ask('نسخ فصول عام', [field('من العام', a), field('إلى العام', b), h('p', { class: 'muted small' }, 'تُنسخ بالتواريخ الهجرية نفسها، ثم راجعها؛ ما يتداخل مع فصل قائم يُتجاوز.')]))) return;
      let out = null;
      if (await previewThenSave({ screen: 'P10', title: 'نسخ الفصول', draft: null, lines: () => [['من', a.value], ['إلى', b.value]],
        save: async (reason) => { out = await rpc('rpc_terms_copy_year', { p_from_year: +a.value, p_to_year: +b.value, p_reason: reason }); }, okLabel: 'انسخ' })) {
        sheet({ title: 'نتيجة النسخ', body: h('div', null, h('p', null, `نُسخ ${out.copied.length}، وتُجووز ${out.skipped.length}.`), out.skipped.map((x) => h('div', { class: 'small muted' }, `${x.name}: ${x.reason}`))), actions: [{ label: 'حسناً' }] });
        redraw();
      }
    }
    function redraw() { box.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); terms(box).then(() => box.querySelector(':scope > .loading')?.remove()).catch(fail); }
  }

  // ---------- الفترات ----------
  async function periods(box) {
    const rows = await get('periods?select=code,name,shift,starts_at,ends_at,sort_order,is_active,deactivated_reason&order=sort_order');
    const counts = {}; (await get('dept_period_summary?select=period_code,halaqat_active&limit=2000')).forEach((x) => { counts[x.period_code] = (counts[x.period_code] || 0) + x.halaqat_active; });
    put(box, h('p', { class: 'muted small' }, 'أوقات البداية والنهاية تُستعمل لاحقاً لحساب «أول/وسط/آخر» الحلقة في الزيارة. لا تُوقف فترة فيها حلقات نشطة.'),
      edit ? h('button', { class: 'btn sm primary', type: 'button', style: 'margin-bottom:8px', onclick: () => save(null) }, '＋ إضافة فترة') : null,
      rows.map((p) => h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('b', null, p.name), h('span', { class: 'row' }, !p.is_active ? badge('موقوفة', 'bad') : null, badge(p.shift || '—', 'gray'))),
        h('div', { class: 'small muted' }, `الوقت: ${p.starts_at ? p.starts_at.slice(0, 5) + ' – ' + (p.ends_at || '').slice(0, 5) : 'غير محدد'} • الترتيب ${p.sort_order ?? '—'} • حلقات نشطة ${nf(counts[p.code] || 0)}`),
        p.deactivated_reason ? h('div', { class: 'small muted' }, 'سبب الإيقاف: ', p.deactivated_reason) : null,
        edit ? h('div', { class: 'btns', style: 'margin-top:6px' }, h('button', { class: 'btn sm', type: 'button', onclick: () => save(p) }, 'تعديل'),
          h('button', { class: `btn sm ${p.is_active ? 'danger' : 'soft'}`, type: 'button', onclick: () => toggle(p) }, p.is_active ? 'إيقاف' : 'إعادة تفعيل')) : null)));
    async function save(p) {
      const n = h('input', { type: 'text', value: p?.name || '' }), sh = h('select', null, ['صباحية', 'مسائية'].map((x) => h('option', { value: x }, x)));
      sh.value = p?.shift || 'مسائية';
      const tm = (v) => h('input', { type: 'text', inputmode: 'numeric', dir: 'ltr', placeholder: '16:30', pattern: '\\d{1,2}:\\d{2}', value: v || '' });
      const a = tm(p?.starts_at?.slice(0, 5)), b = tm(p?.ends_at?.slice(0, 5)), o = h('input', { type: 'number', value: p?.sort_order ?? '' });
      if (!(await ask(p ? `تعديل فترة ${p.name}` : 'إضافة فترة', [field('الاسم', n), field('الوردية', sh), field('وقت البداية', a, 'بنظام 24 ساعة، مثل 16:30 للرابعة والنصف عصراً'), field('وقت النهاية', b, 'إن عبرت منتصف الليل فالنهاية أصغر من البداية'), field('الترتيب', o)]))) return;
      for (const x of [a, b]) {
        x.value = toLatinDigits(x.value).trim().replace(/^(\d):/, '0$1:');
        if (x.value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.value)) { toast('الوقت بنظام 24 ساعة، مثل 07:30 أو 16:30', 'bad'); return; }
      }
      if (await previewThenSave({ screen: 'P10', title: p ? 'تعديل الفترة' : 'إضافة فترة', draft: { op: 'period', code: p?.code, name: n.value, starts_at: a.value, ends_at: b.value },
        lines: () => [['الاسم', n.value], ['الوقت', a.value ? `${a.value} – ${b.value}` : 'غير محدد'], ['الوردية', sh.value]],
        save: async (reason) => { await rpc('rpc_period_save', { p_code: p?.code || null, p_name: n.value, p_shift: sh.value, p_starts_at: a.value || null, p_ends_at: b.value || null, p_sort: o.value === '' ? null : +o.value, p_reason: reason }); sessionStorage.removeItem('tawjeeh.refs'); S.refs = null; await refs(); } })) redraw();
    }
    async function toggle(p) {
      if (await previewThenSave({ screen: 'P10', title: p.is_active ? 'إيقاف الفترة' : 'إعادة تفعيل الفترة', draft: { op: 'period', code: p.code, is_active: !p.is_active },
        lines: (pv) => [['الفترة', p.name], ['حلقات نشطة فيها', pv.halaqat_active], ['تكليفات سارية مرتبطة', pv.assignments_open]],
        save: async (reason) => { await rpc('rpc_period_set_active', { p_code: p.code, p_active: !p.is_active, p_reason: reason }); sessionStorage.removeItem('tawjeeh.refs'); S.refs = null; await refs(); }, okLabel: p.is_active ? 'أوقف' : 'أعد التفعيل' })) redraw();
    }
    function redraw() { box.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); periods(box).then(() => box.querySelector(':scope > .loading')?.remove()).catch(fail); }
  }
}

// يضيف عناصر ومصفوفات عناصر، ويتجاهل الفارغ (Element.append وحده يكتب المصفوفة نصاً «[object HTMLDivElement]» و null نصاً «null»)
const put = (el, ...k) => el.append(...k.flat(9).filter((x) => x != null && x !== false));

// نافذة إدخال بسيطة: ترجع true عند «التالي»
function ask(title, fields) {
  return new Promise((res) => {
    let done = false;
    sheet({ title, body: h('div', null, fields), onClose: () => { if (!done) res(false); },
      actions: [{ label: 'معاينة', kind: 'primary', onClick: (close) => { done = true; res(true); close(); } }, { label: 'تراجع', onClick: (c) => c() }] });
  });
}
