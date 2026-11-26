// الحلقات (لوحة التحكم): قائمة مباشرة بالبحث والفلاتر (المرحلة 9ب)، وإضافة حلقة أو تعديل قسمها وفترتها وقطاعها، وإيقاف/تفعيل، وتحديد القطاع. لا حذف.
import { S, h, get, count, rpc, nf, askForm, toast, fail, selectOf, debounce, sectorChoices, choice } from './core.js';
import { halaqatQuery, SIZE } from './queries.js';
import { halaqaCard } from './halaqat.js';

export async function render(root) {
  // المرحلة 9ب: القائمة تظهر مباشرة (دفعات) مع البحث والفلاتر، وأزرار التعديل على كل حلقة
  const f = { q: '', dep: '', per: '', status: '' };
  const q = h('input', { type: 'search', placeholder: 'رقم الحلقة أو اسم المعلم', enterkeyhint: 'search', 'aria-label': 'بحث' });
  const out = h('div', { 'aria-live': 'polite' });
  const cnt = h('div', { class: 'count-line' });
  const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  const dep = selectOf(S.refs.departments, { all: 'كل الأقسام', onchange: (v) => { f.dep = v; find(); } });
  const per = selectOf(S.refs.periods.filter((p) => p.is_active), { all: 'كل الفترات', onchange: (v) => { f.per = v; find(); } });
  dep.setAttribute('aria-label', 'القسم'); per.setAttribute('aria-label', 'الفترة');
  const STAT = ['الكل', 'نشطة', 'غير نشطة', 'بلا معلم', 'بلا موجه', 'تحتاج تأكيد'];
  // المرحلة 9ج: الحالة قائمة منسدلة (كانت أزراراً أفقية تخرج عن شاشة الجوال)
  const stat = choice(STAT.map((x) => ({ value: x === 'الكل' ? '' : x, label: x === 'الكل' ? 'كل الحالات' : x })), f.status || '', (v) => { f.status = v; find(); }, 'الحالة');
  root.append(h('button', { class: 'btn soft block', type: 'button', style: 'margin-bottom:10px', onclick: () => edit(null) }, '＋ إضافة حلقة'),
    h('div', { class: 'filters f3' }, h('div', { class: 'full' }, q), dep, per, stat), cnt, out, more);

  const depOpts = [{ value: '', label: 'بلا قسم' }, ...S.refs.departments.map((d) => ({ value: d.code, label: d.name }))];
  const perOpts = [{ value: '', label: 'بلا فترة' }, ...S.refs.periods.filter((p) => p.is_active).map((p) => ({ value: p.code, label: p.name }))];
  let seq = 0, offset = 0;
  const cardOf = (r) => halaqaCard(r, { extra: h('div', { class: 'btns', style: 'margin-top:10px' },
    h('button', { class: 'btn sm primary', type: 'button', onclick: () => edit(r) }, 'تعديل'),
    h('button', { class: 'btn sm', type: 'button', onclick: () => sector(r) }, 'تحديد القطاع'),
    h('button', { class: `btn sm ${r.is_active ? 'danger' : 'soft'}`, type: 'button', onclick: () => toggle(r) }, r.is_active ? 'إيقاف الحلقة' : 'تفعيل الحلقة')) });
  async function page(append) {
    const my = ++seq;
    if (!append) { offset = 0; more.hidden = true; cnt.textContent = ''; out.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); }
    try {
      const path = halaqatQuery({ q: f.q, dep: f.dep, per: f.per, status: f.status }, offset, SIZE);
      if (!append) count(path).then((n) => { if (my === seq) cnt.textContent = `${nf(n)} حلقة`; }).catch(() => {});
      const rows = await get(path);
      if (my !== seq) return;
      if (!append) out.replaceChildren();
      if (!rows.length && !append) out.append(h('p', { class: 'empty' }, 'لا توجد حلقات مطابقة.'));
      rows.forEach((r) => out.append(cardOf(r)));
      offset += rows.length; more.hidden = rows.length < SIZE;
    } catch (e) { if (my === seq) { out.replaceChildren(); fail(e); } }
  }
  const find = () => page(false);
  more.addEventListener('click', async () => { more.disabled = true; await page(true); more.disabled = false; });
  q.addEventListener('input', debounce(() => { f.q = q.value.trim(); find(); }, 400));
  find();

  async function edit(r) {
    const v = await askForm({ title: r ? `تعديل الحلقة ${r.number}` : 'إضافة حلقة', fields: [
      r ? null : { name: 'number', label: 'رقم الحلقة', inputmode: 'numeric', required: true },
      { name: 'dep', label: 'القسم', options: depOpts, value: r?.department_code || '' },
      { name: 'per', label: 'الفترة', options: perOpts, value: r?.period_code || '' },
      { name: 'sector', label: 'القطاع', options: [{ value: '', label: 'غير محدد (يحتاج تأكيد)' }, ...sectorChoices()], value: r?.sector || '' },
      { name: 'notes', label: 'ملاحظات', area: true, value: '' }].filter(Boolean), ok: 'حفظ' });
    if (!v) return;
    const number = r?.number || v.number;
    if (!/^\d+$/.test(number)) return toast('رقم الحلقة أرقام فقط', 'bad');
    const grp = S.refs.departments.find((d) => d.code === v.dep)?.group_code || null;
    await rpc('rpc_upsert_halaqa', { p_number: number, p_department: v.dep || null, p_group: grp, p_period: v.per || null, p_sector: v.sector || null,
      p_is_active: r ? r.is_active : true, p_is_approved: r ? r.is_approved : true, p_notes: v.notes || null });
    toast('تم الحفظ', 'ok'); q.value = number; f.q = number; find();
  }
  async function sector(r) {
    const v = await askForm({ title: `قطاع الحلقة ${r.number}`, fields: [{ name: 'sector', label: 'القطاع', required: true, options: [{ value: '', label: 'اختر…' }, ...sectorChoices()] },
      { name: 'reason', label: 'مصدر القرار', required: true, value: 'تأكيد من المسؤول' }] });
    if (!v) return;
    await rpc('rpc_set_halaqa_sector', { p_number: r.number, p_sector: v.sector, p_reason: v.reason }); toast('تم تحديد القطاع', 'ok'); find();
  }
  async function toggle(r) {
    const v = await askForm({ title: `${r.is_active ? 'إيقاف' : 'تفعيل'} الحلقة ${r.number}`, intro: 'لا يُحذف شيء؛ يُسجَّل السبب في ملاحظات الحلقة.', fields: [{ name: 'reason', label: 'السبب', required: true }], ok: r.is_active ? 'أوقف' : 'فعّل' });
    if (!v) return;
    await rpc('rpc_set_halaqa_active', { p_number: r.number, p_active: !r.is_active, p_reason: v.reason }); toast('تم الحفظ', 'ok'); find();
  }
}
