// الأشخاص والتكليفات: بحث، تكليف جديد، إنهاء تكليف، «يساعد»، تعديل البيانات، إيقاف/تفعيل، وإضافة شخص.
// لا حذف: الإنهاء بتاريخ والإيقاف بسبب، وكل شيء يُسجَّل.
import { S, h, get, rpc, can, choice, toLatinDigits, depName, grpName, perName, hijri, today, selectOf, debounce, badge, askForm, confirmBox, toast, fail, ar, sectorChoices } from './core.js';

const E = encodeURIComponent;
let ROLES = null;
// نفس قيود القاعدة، لتظهر المشكلة بوضوح قبل الإرسال
function checkPerson(v) {
  v.code = toLatinDigits(v.code).trim(); v.mob = toLatinDigits(v.mob || '').replace(/[\s\-+()]/g, '');
  if ((v.name || '').trim().length < 3) return 'اكتب الاسم الكامل';
  if (!/^(\d+|ر-\d{4}|ن-\d{4})$/.test(v.code)) return 'الرقم الظاهر: رقم النظام (أرقام فقط) أو ر-0000 أو ن-0000';
  if (v.mob && !/^\d{6,15}$/.test(v.mob)) return 'الجوال أرقام فقط، من 6 إلى 15 خانة';
  if (v.mob && v.sector === 'نساء') return 'لا يُسجَّل جوال للقطاع النسائي';
  return null;
}

export async function render(root) {
  ROLES ||= await get('roles?select=code,name,is_global,can_login&order=sort_order');
  const rname = (c) => ROLES.find((r) => r.code === c)?.name || c;
  // المرحلة 9ب: القائمة تظهر مباشرة (دفعات)، مع فلاتر جاهزة بالدور والفترة والقسم، وبحث بالاسم أو الرقم
  const PLURAL = { supervisor: 'موجهون', teacher: 'معلمون', dept_head: 'مسؤولو أقسام', supervisor_assistant: 'مساعدو موجهين', division_assistant: 'مساعدو إدارة الشعبة', mentor: 'مرشدون', division_head: 'مسؤول الشعبة' };
  const ORDER = ['supervisor', 'teacher', 'dept_head', 'supervisor_assistant', 'division_assistant', 'mentor', 'division_head'];
  const roleOpts = [{ value: '', label: 'الكل' }, ...ORDER.filter((c) => c === 'teacher' || ROLES.some((r) => r.code === c && r.can_login)).map((c) => ({ value: c, label: PLURAL[c] || rname(c) }))];
  const f = { q: '', role: '', per: '', dep: '' };
  const q = h('input', { type: 'search', placeholder: 'ابحث بالاسم أو الرقم', enterkeyhint: 'search', 'aria-label': 'بحث' });
  const list = h('div', { 'aria-live': 'polite' });
  const cnt = h('div', { class: 'count-line' });
  const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  // المرحلة 9ج: الدور قائمة منسدلة (كانت أزراراً أفقية تخرج عن الشاشة ويختفي بعضها)
  const role = choice(roleOpts.map((o) => (o.value ? o : { value: '', label: 'كل الأدوار' })), f.role, (v) => { f.role = v; load(); }, 'الدور');
  const per = selectOf(S.refs.periods.filter((x) => x.is_active), { all: 'كل الفترات', onchange: (v) => { f.per = v; load(); } });
  const dep = selectOf(S.refs.departments.filter((x) => x.is_active !== false), { all: 'كل الأقسام', onchange: (v) => { f.dep = v; load(); } });
  per.setAttribute('aria-label', 'الفترة'); dep.setAttribute('aria-label', 'القسم');
  const add = can('manage_persons') ? h('button', { class: 'btn soft block', type: 'button', style: 'margin-bottom:10px', onclick: addPerson }, '＋ إضافة شخص') : null;
  root.append(...[add, h('div', { class: 'filters f3' }, h('div', { class: 'full' }, q), role, per, dep), cnt, list, more].filter(Boolean));
  let seq = 0, offset = 0;

  async function page(append) {
    const my = ++seq;
    if (!append) { offset = 0; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); more.hidden = true; }
    try {
      const d = await rpc('rpc_people_list', { p: { q: toLatinDigits(f.q), role: f.role, period: f.per, department: f.dep, offset } });
      if (my !== seq) return;
      if (!append) list.replaceChildren();
      cnt.textContent = `${d.total.toLocaleString('ar-SA-u-nu-latn')} شخصاً${f.q || f.role || f.per || f.dep ? ' مطابقاً' : ''} • مرتبون بالاسم`;
      if (!d.rows.length && !append) list.append(h('p', { class: 'empty' }, 'لا يوجد أحد بهذه التصفية.'));
      d.rows.forEach((p) => list.append(card(p)));
      offset += d.rows.length; more.hidden = offset >= d.total;
    } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
  }
  const load = () => page(false);
  more.addEventListener('click', async () => { more.disabled = true; await page(true); more.disabled = false; });
  q.addEventListener('input', debounce(() => { f.q = q.value.trim(); load(); }, 400));
  load();

  const where = (a) => a.department_code ? depName(a.department_code) : a.group_code ? `مجموعة ${grpName(a.group_code)}` : 'عام';
  function card(p) {
    const open = (p.asg || []).filter((a) => !a.valid_to || a.valid_to >= today());
    const closed = (p.asg || []).filter((a) => a.valid_to && a.valid_to < today());
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('b', null, p.full_name), h('span', { class: 'row' }, !p.is_active ? badge('موقوف', 'bad') : null, p.needs_confirmation ? badge('يحتاج تأكيد', 'warn') : null, badge(String(p.display_code), 'gray'))),
      h('div', { class: 'muted small' }, [p.sector || 'القطاع غير محدد', p.nat?.nationality && `الجنسية: ${p.nat.nationality}`].filter(Boolean).join(' • ')),
      p.mob?.mobile ? h('div', { class: 'small' }, 'الجوال: ', h('span', { class: 'ltr' }, p.mob.mobile)) : null,
      p.teaching?.length ? h('div', { class: 'hchips' }, p.teaching.map((t) => h('span', { class: t.type === 'بديل' ? 'alt' : null }, `معلم: حلقة ${t.halaqa}${t.type === 'بديل' ? ' (بديل)' : ''} • ${perName(t.period) || 'بلا فترة'}`))) : null,
      h('h3', { style: 'margin-top:10px;font-size:1rem' }, 'التكليفات السارية'),
      open.length ? open.map((a) => h('div', { class: 'list-item' },
        h('div', { class: 'row between' }, h('span', null, rname(a.role_code)), badge(a.period_code ? perName(a.period_code) : 'كل الفترات', a.period_code ? '' : 'gray')),
        h('div', { class: 'muted small' }, where(a), ' • منذ ', hijri(a.valid_from), a.valid_to ? ` • حتى ${hijri(a.valid_to)}` : ''),
        h('div', { class: 'btns', style: 'margin-top:6px' },
          h('button', { class: 'btn sm danger', type: 'button', onclick: (e) => endAsg(e.currentTarget, a) }, 'إنهاء'),
          a.role_code === 'supervisor_assistant' ? h('button', { class: 'btn sm', type: 'button', onclick: () => setAssists(a) }, a.assists_person_id ? 'تغيير من يساعده' : 'حدّد من يساعده') : null)))
        : h('p', { class: 'muted small' }, 'لا توجد تكليفات سارية.'),
      closed.length ? h('details', null, h('summary', { class: 'muted small' }, `تكليفات منتهية (${closed.length})`),
        closed.map((a) => h('div', { class: 'muted small list-item' }, `${rname(a.role_code)} • ${where(a)} • حتى ${hijri(a.valid_to)}${a.end_reason ? ' • ' + ar(a.end_reason) : ''}`))) : null,
      h('div', { class: 'btns', style: 'margin-top:10px' },
        can('manage_assignments') || can('assign_supervisor') ? h('button', { class: 'btn sm primary', type: 'button', onclick: () => newAsg(p) }, 'تكليف جديد') : null,
        can('manage_persons') ? h('button', { class: 'btn sm', type: 'button', onclick: () => editPerson(p) }, 'تعديل البيانات') : null,
        can('manage_persons') ? h('button', { class: `btn sm ${p.is_active ? 'danger' : 'soft'}`, type: 'button', onclick: () => toggleActive(p) }, p.is_active ? 'إيقاف' : 'تفعيل') : null));
  }

  async function newAsg(p) {
    const v = await askForm({ title: `تكليف جديد: ${p.full_name}`, fields: [
      { name: 'role', label: 'الدور', required: true, options: [{ value: '', label: 'اختر الدور…' }, ...ROLES.filter((r) => r.can_login).map((r) => ({ value: r.code, label: r.name }))] },
      { name: 'dep', label: 'القسم (للأدوار غير العامة)', options: [{ value: '', label: 'بلا قسم' }, ...S.refs.departments.map((d) => ({ value: d.code, label: d.name }))], hint: 'اختر قسماً أو مجموعة، لا الاثنين.' },
      { name: 'grp', label: 'أو المجموعة', options: [{ value: '', label: 'بلا مجموعة' }, ...S.refs.groups.map((g) => ({ value: g.code, label: g.name }))] },
      { name: 'per', label: 'الفترة', options: [{ value: '', label: 'كل الفترات' }, ...S.refs.periods.filter((x) => x.is_active).map((x) => ({ value: x.code, label: x.name }))] },
      { name: 'from', label: 'من تاريخ', type: 'date', value: today() }, { name: 'to', label: 'إلى تاريخ (اختياري)', type: 'date' },
      { name: 'reason', label: 'السبب', required: true, value: 'تكليف جديد' }], ok: 'أضف التكليف' });
    if (!v) return;
    if (v.dep && v.grp) return toast('اختر قسماً أو مجموعة، لا الاثنين', 'bad');
    const glob = ROLES.find((r) => r.code === v.role)?.is_global;
    await rpc('rpc_add_assignment', { p_person: p.id, p_role: v.role, p_department: glob ? null : v.dep || null, p_group: glob ? null : v.grp || null,
      p_period: glob ? null : v.per || null, p_from: v.from || today(), p_to: v.to || null, p_term: null, p_reason: v.reason });
    toast('أُضيف التكليف', 'ok'); load();
  }
  async function endAsg(btn, a) {
    const v = await askForm({ title: 'إنهاء التكليف', intro: `${rname(a.role_code)} • ${where(a)}. يُنهى بالتاريخ المحدد ولا يُحذف.`,
      fields: [{ name: 'date', label: 'تاريخ الانتهاء', type: 'date', value: today() }, { name: 'reason', label: 'السبب', required: true }], ok: 'أنهِ التكليف' });
    if (!v) return;
    btn.disabled = true;
    try { await rpc('rpc_end_assignment', { p_id: a.id, p_date: v.date || today(), p_reason: v.reason }); toast('أُنهي التكليف', 'ok'); load(); }
    catch (e) { fail(e); btn.disabled = false; }
  }
  async function setAssists(a) {
    const rows = await get(`assignments?select=person:persons!person_id(id,full_name)&role_code=eq.supervisor&valid_to=is.null&limit=200`);
    const m = new Map(rows.map((r) => [r.person.id, r.person.full_name]));
    const v = await askForm({ title: 'من يساعده هذا المساعد؟', intro: 'يرى المساعد معلمي الموجه الذي يساعده.', fields: [
      { name: 'sup', label: 'الموجه', required: true, options: [{ value: '', label: 'اختر الموجه…' }, ...[...m].sort((x, y) => x[1].localeCompare(y[1], 'ar')).map(([value, label]) => ({ value, label }))], value: a.assists_person_id || '' }] });
    if (!v) return;
    await rpc('rpc_set_assists', { p_assignment: a.id, p_supervisor: v.sup }); toast('تم الحفظ', 'ok'); load();
  }
  async function editPerson(p) {
    const v = await askForm({ title: 'تعديل بيانات الشخص', fields: [
      { name: 'name', label: 'الاسم', value: p.full_name, required: true },
      { name: 'code', label: 'الرقم الظاهر', value: p.display_code, required: true, hint: 'رقم النظام أو ر-0000 أو ن-0000' },
      { name: 'sector', label: 'القطاع', value: p.sector || '', options: [{ value: '', label: 'غير محدد (يحتاج تأكيد)' }, ...sectorChoices()] },
      { name: 'mob', label: 'الجوال', type: 'tel', inputmode: 'numeric', value: p.mob?.mobile || '', hint: 'اتركه كما هو إن لم يتغير.' + (S.showWomen ? ' لا جوال للنساء.' : '') },
      { name: 'nat', label: 'الجنسية', value: p.nat?.nationality || '' }] });
    if (!v) return;
    { const m = checkPerson(v); if (m) return toast(m, 'bad'); }
    await rpc('rpc_update_person', { p_person: p.id, p_full_name: v.name, p_display_code: v.code, p_sector: v.sector || null });
    const mob = v.mob && v.mob !== (p.mob?.mobile || '') ? v.mob : null, nat = v.nat && v.nat !== (p.nat?.nationality || '') ? v.nat : null;
    if (mob || nat) await rpc('rpc_set_person_private', { p_person: p.id, p_mobile: mob, p_nationality: nat });
    toast('تم الحفظ', 'ok'); load();
  }
  async function toggleActive(p) {
    const v = await askForm({ title: `${p.is_active ? 'إيقاف' : 'تفعيل'} ${p.full_name}`, intro: p.is_active ? 'يُوقف الشخص ويُوقف حسابه، ولا يُحذف شيء.' : null, fields: [{ name: 'reason', label: 'السبب', required: true }], ok: p.is_active ? 'أوقف' : 'فعّل' });
    if (!v) return;
    await rpc('rpc_set_person_active', { p_person: p.id, p_active: !p.is_active, p_reason: v.reason }); toast('تم الحفظ', 'ok'); load();
  }
  async function addPerson() {
    const v = await askForm({ title: 'إضافة شخص', fields: [
      { name: 'name', label: 'الاسم الكامل', required: true },
      { name: 'code', label: 'الرقم الظاهر', required: true, hint: 'رقم النظام، أو ر-0000 (موجه/إداري)، أو ن-0000' },
      { name: 'sector', label: 'القطاع', options: [{ value: '', label: 'غير محدد (يحتاج تأكيد)' }, ...sectorChoices()] },
      { name: 'mob', label: 'الجوال (اختياري)', type: 'tel', inputmode: 'numeric' }, { name: 'nat', label: 'الجنسية (اختياري)' }], ok: 'أضف' });
    if (!v) return;
    { const m = checkPerson(v); if (m) return toast(m, 'bad'); }
    await rpc('rpc_create_person', { p_full_name: v.name, p_display_code: v.code, p_sector: v.sector || null, p_mobile: v.mob || null, p_nationality: v.nat || null });
    toast('أُضيف الشخص. أضف له تكليفاً من بطاقته.', 'ok'); q.value = v.name; f.q = v.name; load();
  }
}
