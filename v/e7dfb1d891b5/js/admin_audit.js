// سجل التعديلات: من فعل ماذا ومتى (قراءة فقط). الأحدث أولاً.
import { h, get, hijri, chips, badge, fail, ar } from './core.js';

const TABLES = { halaqat: 'الحلقات', halaqa_teachers: 'معلمو الحلقات', halaqa_supervisors: 'إسناد الموجهين', persons: 'الأشخاص', assignments: 'التكليفات',
  accounts: 'الحسابات', role_permissions: 'الصلاحيات', confirmations: 'يحتاج تأكيد', assignment_requests: 'طلبات الإسناد', person_mobiles: 'الجوالات',
  person_nationalities: 'الجنسيات', person_aliases: 'الأسماء البديلة', departments: 'الأقسام', groups: 'المجموعات', periods: 'الفترات', roles: 'الأدوار', actions: 'الأعمال', import_batches: 'دفعات الرفع' };
const ACTIONS = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' };
const FIELDS = { is_active: 'نشط', valid_to: 'تاريخ الانتهاء', valid_from: 'تاريخ البدء', period_code: 'الفترة', department_code: 'القسم', group_code: 'المجموعة', sector: 'القطاع',
  allowed: 'مسموح', scope: 'النطاق', status: 'الحالة', full_name: 'الاسم', display_code: 'الرقم الظاهر', must_change_password: 'إلزام تغيير كلمة المرور', locked_until: 'القفل حتى',
  failed_attempts: 'المحاولات الفاشلة', last_login_at: 'آخر دخول', password_changed_at: 'تاريخ تغيير كلمة المرور', deactivated_at: 'تاريخ الإيقاف', deactivated_reason: 'سبب الإيقاف',
  initial_password_expires_at: 'انتهاء كلمة المرور الأولى', is_approved: 'معتمدة', period_detail: 'تفصيل الفترة', needs_confirmation: 'يحتاج تأكيد', confirmation_reason: 'سبب التأكيد',
  sector_status: 'حالة القطاع', sector_source: 'مصدر القطاع', assists_person_id: 'يساعد', updated_at: 'آخر تحديث', term: 'المدة', halaqa_number: 'رقم الحلقة', role_code: 'الدور', type: 'النوع',
  decision_note: 'ملاحظة القرار', resolved_at: 'تاريخ الحسم', login_email: 'بريد الدخول الداخلي', auth_user_id: 'معرّف الدخول', person_id: 'الشخص', created_by: 'أُنشئ بواسطة', notes: 'ملاحظات', end_reason: 'سبب الإنهاء', reason: 'السبب', resolution: 'الحسم' };
const PAGE = 30;
const val = (v) => (v == null ? '—' : v === 'true' ? 'نعم' : v === 'false' ? 'لا' : v === 'infinity' ? 'دائم'
  : /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) ? '(معرّف)' : /^\d{4}-\d{2}-\d{2}T/.test(v) ? hijri(v) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? hijri(v) : ar(v));
const fieldName = (f) => FIELDS[f] || ar(f).replace(/[A-Za-z_]+/g, '').trim() || 'حقل آخر';
const E = encodeURIComponent;
const NAMES = new Map();
const HIDE = ['رفع الإطلاق الأول', 'النظام/الرفع', 'حساب مجموعة النطاق (تحسين السرعة)'];

export async function render(root) {
  let table = ''; let offset = 0; let mineOnly = true;
  const bar = h('div'); const list = h('div'); const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  const opts = [{ value: '', label: 'الكل' }, ...['assignments', 'halaqa_supervisors', 'halaqa_teachers', 'role_permissions', 'accounts', 'halaqat', 'persons', 'confirmations'].map((t) => ({ value: t, label: TABLES[t] }))];
  const drawBar = () => bar.replaceChildren(chips(opts, table, (v) => { table = v; drawBar(); reload(); }));
  async function page() {
    const hide = HIDE.map((x) => E('"' + x + '"')).join(',');
    const rows = await get(`audit_log?select=id,at,actor_person_id,actor_label,table_name,record_key,action,field,old_value,new_value&order=id.desc&limit=${PAGE}&offset=${offset}`
      + `${table ? '&table_name=eq.' + table : ''}${mineOnly ? `&or=(actor_label.is.null,actor_label.not.in.(${hide}))` : ''}`);
    const ids = [...new Set(rows.map((r) => r.actor_person_id).filter((x) => x && !NAMES.has(x)))];
    if (ids.length) {
      try { (await get(`persons?select=id,full_name&id=in.(${ids.join(',')})`)).forEach((p) => NAMES.set(p.id, p.full_name)); } catch { /* الاسم اختياري */ }
    }
    rows.forEach((r) => list.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('span', null, badge(ACTIONS[r.action] || r.action), ' ', TABLES[r.table_name] || r.table_name), h('span', { class: 'muted small' }, hijri(r.at), ' ', new Date(r.at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }))),
      h('div', { class: 'muted small' }, 'بواسطة: ', NAMES.get(r.actor_person_id) || 'النظام', r.actor_label ? ` — ${ar(r.actor_label)}` : ''),
      r.field ? h('div', { class: 'small' }, `${fieldName(r.field)}: `, h('span', { class: 'muted' }, val(r.old_value)), ' ← ', h('b', null, val(r.new_value))) : null)));
    offset += rows.length; more.hidden = rows.length < PAGE;
    if (!rows.length && offset === 0) list.append(h('p', { class: 'empty' }, 'لا توجد تعديلات.'));
  }
  function reload() { offset = 0; more.hidden = true; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); page().then(() => list.querySelector('.loading')?.remove()).catch((e) => { list.replaceChildren(); fail(e); }); }
  more.addEventListener('click', async () => { more.disabled = true; try { await page(); } catch (e) { fail(e); } more.disabled = false; });
  const toggle = h('label', { class: 'check', style: 'margin:0 0 10px' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { mineOnly = e.target.checked; reload(); } }), 'إخفاء الرفع الأولي وتحسينات النظام');
  root.append(toggle, bar, list, more);
  drawBar(); reload();
}
