// السجل الموحّد (المرحلة 9ب): «السجل» (تعديلات البيانات) و«سجل اللوحة» (ضغطات الحفظ في اللوحة بأسبابها) في قائمة واحدة بلا تكرار.
// صف لكل عملية: الوقت، والشخص، ونوع العملية، ووصف مختصر. الأحدث أولاً، ودفعات. فلاتر: الشخص، ونوع العملية، والمجال، والتاريخ.
// ضغطة اللوحة تُفتح بتفاصيلها و«استرجاع القيمة السابقة» كما كانت. كل مستخدم يرى ما تتيحه صلاحيته فقط (RLS في القاعدة).
import { h, rpc, hijri, badge, fail, sheet, field, selectOf, ar } from './core.js';
import { showChangeSet } from './admin_p15.js';

const TABLES = { halaqat: 'الحلقات', halaqa_teachers: 'معلمو الحلقات', halaqa_supervisors: 'إسناد الموجهين', persons: 'الأشخاص', assignments: 'التكليفات',
  accounts: 'الحسابات', role_permissions: 'الصلاحيات', confirmations: 'يحتاج تأكيد', assignment_requests: 'طلبات الإسناد', person_mobiles: 'الجوالات',
  person_nationalities: 'الجنسيات', person_aliases: 'الأسماء البديلة', departments: 'الأقسام', groups: 'المجموعات', periods: 'الفترات', roles: 'الأدوار', actions: 'الأعمال',
  import_batches: 'دفعات الرفع', teacher_notes: 'ملاحظات المعلمين', teacher_contact_log: 'سجل التواصل', export_log: 'سجل التصدير', setting_group_areas: 'أماكن الإعدادات', visit_acknowledgments: 'الاطلاع على الزيارات', visits: 'الزيارات',
  setting_values: 'الإعدادات', panel_grants: 'منح الشاشات', hijri_calendar: 'التقويم', terms: 'الفصول', panel: 'لوحة التحكم' };
const ACTIONS = { INSERT: ['إضافة', 'ok'], UPDATE: ['تعديل', 'info'], DELETE: ['حذف', 'bad'] };
const FIELDS = { is_active: 'نشط', valid_to: 'تاريخ الانتهاء', valid_from: 'تاريخ البدء', period_code: 'الفترة', department_code: 'القسم', group_code: 'المجموعة', sector: 'القطاع',
  allowed: 'مسموح', scope: 'النطاق', status: 'الحالة', full_name: 'الاسم', display_code: 'الرقم الظاهر', must_change_password: 'إلزام تغيير كلمة المرور', locked_until: 'القفل حتى',
  failed_attempts: 'المحاولات الفاشلة', last_login_at: 'آخر دخول', password_changed_at: 'تاريخ تغيير كلمة المرور', deactivated_at: 'تاريخ الإيقاف', deactivated_reason: 'سبب الإيقاف',
  initial_password_expires_at: 'انتهاء كلمة المرور الأولى', is_approved: 'معتمدة', period_detail: 'تفصيل الفترة', needs_confirmation: 'يحتاج تأكيد', confirmation_reason: 'سبب التأكيد',
  sector_status: 'حالة القطاع', sector_source: 'مصدر القطاع', assists_person_id: 'يساعد', term: 'المدة', halaqa_number: 'رقم الحلقة', role_code: 'الدور', type: 'النوع',
  decision_note: 'ملاحظة القرار', resolved_at: 'تاريخ الحسم', login_email: 'بريد الدخول الداخلي', auth_user_id: 'معرّف الدخول', person_id: 'الشخص', created_by: 'أُنشئ بواسطة',
  notes: 'ملاحظات', end_reason: 'سبب الإنهاء', reason: 'السبب', resolution: 'الحسم', body: 'النص', category: 'التصنيف', is_hidden: 'الإخفاء', hide_reason: 'سبب الإخفاء',
  suspended_at: 'سحب الصلاحيات منذ', suspend_reason: 'سبب السحب', value: 'القيمة' };
const val = (v) => (v == null ? '—' : v === 'true' ? 'نعم' : v === 'false' ? 'لا' : v === 'infinity' ? 'دائم'
  : /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) ? '(معرّف)' : /^\d{4}-\d{2}-\d{2}(T|$)/.test(v) ? hijri(v) : ar(v).length > 80 ? ar(v).slice(0, 80) + '…' : ar(v));
const fieldName = (f) => FIELDS[f] || ar(f).replace(/[A-Za-z_]+/g, '').trim() || 'حقل آخر';
const time = (at) => new Date(at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
const KINDS = [{ code: 'إضافة', name: 'إضافة' }, { code: 'تعديل', name: 'تعديل' }, { code: 'حذف', name: 'حذف' }, { code: 'لوحة', name: 'حفظ في لوحة التحكم' }, { code: 'استرجاع', name: 'استرجاع قيمة سابقة' }];
const DOMAINS = ['panel', 'assignments', 'halaqa_supervisors', 'halaqa_teachers', 'halaqat', 'persons', 'accounts', 'role_permissions', 'confirmations', 'teacher_notes', 'visit_acknowledgments']
  .map((c) => ({ code: c, name: TABLES[c] }));

// وصف مختصر لكل صف
function describe(r) {
  if (r.src === 'c') return [r.subject || r.screen_name || 'لوحة التحكم', r.reason ? ` — السبب: ${r.reason}` : ''].join('');
  const t = TABLES[r.table] || ar(r.table);
  if (r.action === 'INSERT') return `${t}: إضافة سجل`;
  if (r.action === 'DELETE') return `${t}: حذف سجل`;
  const fs = (r.fields || []).filter((x) => x.field);
  const head = fs.slice(0, 2).map((x) => `${fieldName(x.field)}: ${val(x.old)} ← ${val(x.new)}`).join('، ');
  return `${t}: ${head}${r.fields_n > 2 ? ` (+${r.fields_n - 2})` : ''}`;
}

export async function render(root) {
  const f = { actor: '', kind: '', table: '', from: '', to: '', hide: true };
  let offset = 0; let rows = []; let seq = 0; const PAGE = 30;
  const actors = await rpc('rpc_log_actors').catch(() => []);
  const list = h('div', { class: 'card', 'aria-live': 'polite' });
  const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  const from = h('input', { type: 'date', 'aria-label': 'من تاريخ' }), to = h('input', { type: 'date', 'aria-label': 'إلى تاريخ' });
  from.onchange = () => { f.from = from.value; reload(); }; to.onchange = () => { f.to = to.value; reload(); };
  const bar = h('div', { class: 'filters' },
    field('الشخص', selectOf([{ code: 'system', name: 'النظام' }, ...actors.map((a) => ({ code: a.id, name: a.name }))], { all: 'الكل', onchange: (v) => { f.actor = v; reload(); } })),
    field('نوع العملية', selectOf(KINDS, { all: 'الكل', onchange: (v) => { f.kind = v; reload(); } })),
    field('من تاريخ', from), field('إلى تاريخ', to),
    field('المجال', selectOf(DOMAINS, { all: 'الكل', onchange: (v) => { f.table = v; reload(); } })));
  const hideBox = h('label', { class: 'check', style: 'margin:0 0 10px' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { f.hide = e.target.checked; reload(); } }),
    'إخفاء الرفع الأولي وتحسينات النظام');
  const exp = h('button', { class: 'btn sm', type: 'button', onclick: exportCsv }, 'تصدير ما ظهر (ملف جدول نصي)');
  root.append(h('p', { class: 'muted small' }, 'كل عملية صفٌّ واحد: ضغطة الحفظ في اللوحة بسببها، وتعديلات البيانات الأخرى. اضغط الصف لتفاصيله؛ وضغطة اللوحة فيها «استرجاع القيمة السابقة».'),
    bar, h('div', { class: 'row between', style: 'margin-bottom:8px' }, hideBox, exp), list, more);

  function rowEl(r) {
    const [k, kc] = r.src === 'c' ? [r.action === 'استرجاع' ? 'استرجاع' : 'لوحة: ' + r.action, r.action === 'استرجاع' ? 'gold' : 'gray'] : ACTIONS[r.action] || [r.action, 'gray'];
    const open = () => (r.src === 'c' ? showChangeSet(r.id, reload) : fieldsSheet(r));
    return h('div', { class: 'list-item logrow tap', role: 'button', tabindex: '0', onclick: open, onkeydown: (e) => e.key === 'Enter' && open() },
      h('div', { class: 'when' }, hijri(r.at), h('br'), time(r.at)),
      h('div', { class: 'who' }, r.actor || (r.actor_id ? '—' : 'النظام'), r.label && r.src === 'a' && !r.actor ? h('div', { class: 'muted xs' }, ar(r.label)) : null,
        r.src === 'c' && r.label ? h('div', { class: 'muted xs' }, r.label) : null),
      h('div', null, badge(k, kc)),
      h('div', { class: 'what' }, describe(r)));
  }
  function fieldsSheet(r) {
    sheet({ title: `${(ACTIONS[r.action] || [r.action])[0]} — ${TABLES[r.table] || ar(r.table)}`, body: h('div', null,
      h('dl', { class: 'kv' }, [['الوقت', `${hijri(r.at)} ${time(r.at)}`], ['الشخص', r.actor || 'النظام'], r.label ? ['الوصف', ar(r.label)] : null, ['السجل', val(r.record)]]
        .filter(Boolean).flatMap(([a, b]) => [h('dt', null, a), h('dd', null, b)])),
      r.action === 'UPDATE' ? h('div', null, h('h3', { style: 'font-size:1rem' }, `الحقول التي تغيّرت (${r.fields_n})`),
        (r.fields || []).map((x) => h('div', { class: 'small list-item' }, `${fieldName(x.field)}: `, h('span', { class: 'muted' }, val(x.old)), ' ← ', h('b', null, val(x.new)))),
        r.fields_n > (r.fields || []).length ? h('p', { class: 'muted xs' }, `وحقول أخرى (${r.fields_n - r.fields.length}).`) : null) : null),
      actions: [{ label: 'إغلاق' }] });
  }
  async function page() {
    const my = seq;
    const d = await rpc('rpc_unified_log', { p: { actor: f.actor, kind: f.kind, table: f.table, from: f.from, to: f.to, hide_system: f.hide, offset, limit: PAGE } });
    if (my !== seq) return;
    list.querySelector('.loading')?.remove();
    rows = rows.concat(d.rows);
    d.rows.forEach((r) => list.append(rowEl(r)));
    offset += d.rows.length; more.hidden = d.rows.length < PAGE;
    if (!rows.length) list.replaceChildren(h('p', { class: 'empty' }, 'لا عمليات بهذه التصفية.'));
  }
  function reload() { seq++; offset = 0; rows = []; more.hidden = true; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); page().catch((e) => { list.replaceChildren(); fail(e); }); }
  more.onclick = async () => { more.disabled = true; try { await page(); } catch (e) { fail(e); } more.disabled = false; };
  function exportCsv() {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const csv = ['الوقت,الشخص,نوع العملية,الوصف', ...rows.map((r) => [r.at, r.actor || 'النظام', r.src === 'c' ? 'لوحة: ' + r.action : (ACTIONS[r.action] || [r.action])[0], describe(r)].map(q).join(','))].join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: 'السجل.csv' }); document.body.append(a); a.click(); a.remove();
  }
  reload();
}
