// الشاشة 15 — سجل التغييرات: من غيّر ماذا ومتى، والقيمة قبل وبعد، والسبب، ومعاينة وقت الحفظ.
// «استرجاع القيمة السابقة» ينشئ تعديلاً جديداً ولا يكتب فوق الماضي. تصفية بالشاشة والشخص والمدة، وجاهزة: «ما فعله المساعد».
import { h, get, rpc, hijri, badge, fail, sheet, field, selectOf, toast, ar } from './core.js';
import { show } from './panel_ui.js';

const PAGE = 30;
const TABLES = { setting_values: 'الإعدادات', hijri_calendar: 'التقويم', terms: 'الفصول', periods: 'الفترات', panel_grants: 'منح الشاشات', assignments: 'التكليفات' };
const FIELDS = { h_year: 'السنة الهجرية', h_month: 'الشهر', h_day: 'اليوم', month_key: 'الشهر الهجري', h_text: 'التاريخ الهجري', source: 'المصدر', adjust_note: 'سبب التعديل',
  is_holiday: 'إجازة', holiday_name: 'اسم الإجازة', is_workday: 'يوم دوام', name: 'الاسم', start_date: 'من', end_date: 'إلى', is_active: 'نشط', stop_reason: 'سبب الإيقاف',
  note: 'ملاحظة', status: 'الحالة', mode: 'الوضع', scope_departments: 'الأقسام', valid_to: 'حتى', stopped_by: 'أوقفه', stopped_at: 'وقت الإيقاف', starts_at: 'وقت البداية',
  ends_at: 'وقت النهاية', shift: 'الوردية', sort_order: 'الترتيب', deactivated_at: 'تاريخ الإيقاف', deactivated_reason: 'سبب الإيقاف', suspended_at: 'سحب الصلاحيات منذ', suspend_reason: 'سبب السحب' };
const val = (v) => (v == null ? '—' : /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) ? '(شخص)' : /^\d{4}-\d{2}-\d{2}(T|$)/.test(v) ? hijri(v) : v === 'true' ? 'نعم' : v === 'false' ? 'لا' : ar(v));
const E = encodeURIComponent;

export async function render(root) {
  const screens = await get('panel_screens?select=code,name&order=sort_order');
  const sname = Object.fromEntries(screens.map((s) => [s.code, s.name]));
  const f = { screen: '', role: '', from: '', to: '' };
  let offset = 0; let rows = [];
  const list = h('div'); const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  const from = h('input', { type: 'date' }), to = h('input', { type: 'date' });
  const bar = h('div', { class: 'filters' },
    field('الشاشة', selectOf(screens.map((s) => ({ code: s.code, name: s.name })), { onchange: (v) => { f.screen = v; reload(); } })),
    field('الفاعل', selectOf([{ code: 'مسؤول الشعبة', name: 'مسؤول الشعبة' }, { code: 'مساعد إدارة الشعبة', name: 'ما فعله مساعد إدارة الشعبة' }, { code: 'بمنح شاشة', name: 'من مُنح شاشة' }, { code: 'النظام (ملف الهجرة)', name: 'البذور الأولى' }], { onchange: (v) => { f.role = v; reload(); } })),
    field('من تاريخ', from), field('إلى تاريخ', to));
  from.onchange = () => { f.from = from.value; reload(); }; to.onchange = () => { f.to = to.value; reload(); };
  const exp = h('button', { class: 'btn sm', type: 'button', onclick: exportCsv }, 'تصدير ما ظهر (CSV)');
  root.append(h('p', { class: 'muted' }, 'كل ضغطة حفظ في اللوحة صفٌّ هنا. «استرجاع» ينشئ تعديلاً جديداً بالقيمة السابقة، والاسترجاع نفسه يُسجَّل.'), bar, h('div', { class: 'btns', style: 'margin-bottom:8px' }, exp), list, more);

  const names = new Map();
  async function page() {
    let qs = `change_sets?select=id,screen_code,action,subject,actor_id,actor_role,reason,at,restores_change_set_id&order=id.desc&limit=${PAGE}&offset=${offset}`;
    if (f.screen) qs += '&screen_code=eq.' + f.screen;
    if (f.role) qs += '&actor_role=eq.' + E(f.role);
    if (f.from) qs += '&at=gte.' + f.from;
    if (f.to) qs += '&at=lt.' + new Date(new Date(f.to).getTime() + 86400000).toISOString().slice(0, 10);
    const r = await get(qs);
    const ids = [...new Set(r.map((x) => x.actor_id).filter((x) => x && !names.has(x)))];
    if (ids.length) { try { (await get(`persons?select=id,full_name&id=in.(${ids.join(',')})`)).forEach((p) => names.set(p.id, p.full_name)); } catch { /* */ } }
    rows = rows.concat(r);
    r.forEach((c) => list.append(h('div', { class: 'card tap', role: 'button', tabindex: '0', onclick: () => showChangeSet(c.id, reload), onkeydown: (e) => e.key === 'Enter' && showChangeSet(c.id, reload) },
      h('div', { class: 'row between' }, h('span', null, badge(c.action, c.action === 'استرجاع' ? 'info' : c.action.includes('سحب') || c.action === 'إيقاف' ? 'warn' : ''), ' ', h('b', null, c.subject || sname[c.screen_code])),
        h('span', { class: 'muted small' }, hijri(c.at), ' ', new Date(c.at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }))),
      h('div', { class: 'muted small' }, `${sname[c.screen_code]} • ${c.actor_id ? names.get(c.actor_id) || '—' : 'النظام'} (${c.actor_role})`),
      h('div', { class: 'small' }, 'السبب: ', c.reason), c.restores_change_set_id ? h('div', { class: 'xs muted' }, `يسترجع الضغطة رقم ${c.restores_change_set_id}`) : null)));
    offset += r.length; more.hidden = r.length < PAGE;
    if (!r.length && offset === 0) list.append(h('p', { class: 'empty' }, 'لا توجد تغييرات بهذه التصفية.'));
  }
  function reload() { offset = 0; rows = []; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); page().then(() => list.querySelector('.loading')?.remove()).catch((e) => { list.replaceChildren(); fail(e); }); }
  more.onclick = async () => { more.disabled = true; try { await page(); } catch (e) { fail(e); } more.disabled = false; };

  function exportCsv() {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const csv = ['رقم,الوقت,الشاشة,العمل,العنصر,الفاعل,الصفة,السبب', ...rows.map((c) => [c.id, c.at, sname[c.screen_code], c.action, c.subject, names.get(c.actor_id) || '', c.actor_role, c.reason].map(q).join(','))].join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: 'سجل_التغييرات.csv' }); document.body.append(a); a.click(); a.remove();
  }
  reload();
}

// تفاصيل ضغطة واسترجاعها (يستعملها السجل الموحّد أيضاً — المرحلة 9ب)
export async function showChangeSet(id, onRestored) {
  let d; try { d = await rpc('rpc_change_set_details', { p_id: id }); } catch (e) { return fail(e); }
  const c = d.change_set; const pv = c.preview_summary;
  const body = h('div', null,
    h('dl', { class: 'kv' }, [['الشاشة', c.screen_name], ['العمل', c.action], ['العنصر', c.subject || '—'], ['الفاعل', `${c.actor_name || 'النظام'} (${c.actor_role})`],
      ['الوقت', `${hijri(c.at)} ${new Date(c.at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}`], ['السبب', c.reason],
      c.restores_change_set_id ? ['يسترجع', `الضغطة رقم ${c.restores_change_set_id}`] : null, d.restored_by.length ? ['استُرجعت بـ', d.restored_by.map((x) => 'رقم ' + x).join('، ')] : null]
      .filter(Boolean).flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
    d.settings.length ? h('div', null, h('h3', { style: 'font-size:1rem' }, 'القيم المحفوظة'), d.settings.map((s) => h('div', { class: 'small list-item' },
      `${s.label} (${s.scope_kind}${s.scope_ref ? ': ' + ar(s.scope_ref) : ''}) ← `, h('b', null, s.value == null ? 'إيقاف التخصيص' : show(s.value)), ` من ${hijri(s.valid_from)}`))) : null,
    d.fields.length ? h('div', null, h('h3', { style: 'font-size:1rem' }, `الحقول التي تغيّرت (${d.fields_total})`),
      d.fields.filter((x) => x.action === 'UPDATE').slice(0, 60).map((x) => h('div', { class: 'small list-item' }, `${TABLES[x.table] || x.table} ${val(x.record)} • ${FIELDS[x.field] || x.field}: `,
        h('span', { class: 'muted' }, val(x.old)), ' ← ', h('b', null, val(x.new)))),
      d.fields.filter((x) => x.action === 'INSERT').map((x) => h('div', { class: 'small list-item' }, `إضافة في ${TABLES[x.table] || x.table} (${val(x.record)})`))) : null,
    pv ? h('details', null, h('summary', { class: 'muted small' }, 'ملخص المعاينة وقت الحفظ'), h('pre', { class: 'xs', style: 'white-space:pre-wrap;direction:ltr;text-align:left' }, JSON.stringify(pv, null, 1))) : null);
  const actions = [{ label: 'إغلاق', onClick: (cl) => cl() }];
  if (d.can_restore) actions.unshift({ label: 'استرجاع القيمة السابقة', kind: 'primary', onClick: async (close) => {
    const reason = prompt2(); const r = await reason; if (!r) return;
    await rpc('rpc_change_restore', { p_id: id, p_reason: r }); toast('أُنشئ تعديل جديد بالقيمة السابقة', 'ok'); close(); onRestored?.();
  } });
  sheet({ title: `الضغطة رقم ${id}`, body, actions });
}
function prompt2() {
  return new Promise((res) => {
    let done = false; const t = h('textarea', { rows: 2, placeholder: 'سبب الاسترجاع' }); const err = h('div', { class: 'err', hidden: true });
    sheet({ title: 'سبب الاسترجاع', body: h('div', null, h('p', { class: 'muted small' }, 'لن يُكتب فوق الماضي: يُضاف تعديل جديد بالقيمة السابقة. إن تغيّرت القيمة بعد هذه الضغطة يُرفض الاسترجاع حتى تسترجع الأحدث أولاً.'), t, err),
      onClose: () => { if (!done) res(null); }, actions: [{ label: 'استرجع', kind: 'primary', onClick: (cl) => { if (!t.value.trim()) { err.textContent = 'اكتب السبب'; err.hidden = false; return; } done = true; res(t.value.trim()); cl(); } }, { label: 'تراجع', onClick: (cl) => cl() }] });
  });
}
