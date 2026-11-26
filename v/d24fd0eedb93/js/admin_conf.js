// «يحتاج تأكيد»: مجمّع حسب نوع البند مع العدد، وتصفية بالقسم والفترة، وحسم جماعي أو بالاختيار.
// كل حسم يُسجَّل في سجل التعديلات تلقائياً (الفاعل والبند والنص).
import { S, h, get, rpc, ar, depName, perName, selectOf, chips, badge, sheet, askForm, confirmBox, toast, fail, nf } from './core.js';
import { hbars } from './charts.js';

const E = encodeURIComponent;
const PAGE = 30;

export async function render(root) {
  const f = { dep: '', per: '', status: 'مفتوح' };
  const dep = selectOf(S.refs.departments, { all: 'كل الأقسام', onchange: (v) => { f.dep = v; load(); } });
  const per = selectOf(S.refs.periods, { all: 'كل الفترات', onchange: (v) => { f.per = v; load(); } });
  const bar = h('div'); const out = h('div');
  const drawBar = () => bar.replaceChildren(chips([{ value: 'مفتوح', label: 'البنود المفتوحة' }, { value: 'محسوم', label: 'البنود المحسومة' }], f.status, (v) => { f.status = v; drawBar(); load(); }));
  root.append(bar, h('p', { class: 'muted small' }, 'البنود مجمّعة حسب النوع. افتح النوع لتراجع بنوده وتحسم ما تختاره، أو احسم النوع كله دفعة واحدة. تصفية القسم والفترة تقتصر على البنود المرتبطة بقسم أو فترة.'),
    h('div', { class: 'filters' }, dep, per), out);

  let seq = 0;
  async function load() {
    const my = ++seq;
    out.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    try {
      const rows = await rpc('confirmations_summary', { p_department: f.dep || null, p_period: f.per || null, p_status: f.status });
      if (my !== seq) return;
      out.replaceChildren();
      if (!rows.length) { out.append(h('p', { class: 'empty' }, f.status === 'مفتوح' ? 'لا توجد بنود مفتوحة. 🎉' : 'لا توجد بنود محسومة.')); return; }
      const by = new Map();
      rows.forEach((r) => { if (!by.has(r.list_name)) by.set(r.list_name, []); by.get(r.list_name).push(r); });
      const total = rows.reduce((a, r) => a + Number(r.items), 0);
      out.append(h('div', { class: 'stats compact' }, h('div', { class: `stat ${f.status === 'مفتوح' ? 'warn' : ''}` }, h('b', null, nf(total)), h('span', null, f.status === 'مفتوح' ? 'بند مفتوح' : 'بند محسوم')),
        h('div', { class: 'stat' }, h('b', null, nf(by.size)), h('span', null, 'قائمة')), h('div', { class: 'stat' }, h('b', null, nf(rows.length)), h('span', null, 'نوع'))));
      // رسم: البنود حسب القائمة، مرتبة. الضغط على شريط ينقل إلى بطاقة تلك القائمة
      const lists = [...by].map(([list, cats], i) => ({ list, i, n: cats.reduce((a, r) => a + Number(r.items), 0) })).sort((a, b) => b.n - a.n);
      const ch = lists.length > 1 ? hbars({ title: f.status === 'مفتوح' ? 'البنود المفتوحة حسب القائمة' : 'البنود المحسومة حسب القائمة', ico: 'chart',
        sub: 'اضغط القائمة للانتقال إلى أنواعها', items: lists.map((x) => ({ label: ar(x.list), href: `#conf-${x.i}`, parts: [{ value: x.n, color: f.status === 'مفتوح' ? 'var(--ch-2)' : 'var(--ch-1)' }] })) }) : null;
      ch?.addEventListener('click', (e) => {
        const a = e.target.closest('a[href^="#conf-"]'); if (!a) return;
        e.preventDefault(); const el = document.getElementById(a.getAttribute('href').slice(1));
        el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
      if (ch) out.append(ch);
      [...by].forEach(([list, cats], i) => {
        const sum = cats.reduce((a, r) => a + Number(r.items), 0);
        out.append(h('div', { class: 'card', id: `conf-${i}`, style: 'scroll-margin-top:72px' },
          h('div', { class: 'row between' }, h('h2', null, ar(list)), badge(nf(sum), 'warn')),
          cats.map((c) => h('div', { class: 'list-item' },
            h('div', { class: 'row between' }, h('span', { class: 'grow' }, ar(c.category)), h('b', null, nf(c.items))),
            h('div', { class: 'btns', style: 'margin-top:8px' },
              h('button', { class: 'btn sm', type: 'button', onclick: () => openItems(list, c.category, Number(c.items)) }, 'عرض البنود'),
              f.status === 'مفتوح' ? h('button', { class: 'btn sm primary', type: 'button', onclick: () => bulk(list, c.category, Number(c.items)) }, `حسم الكل (${nf(c.items)})`) : null)))));
      });
    } catch (e) { if (my === seq) { out.replaceChildren(); fail(e); } }
  }

  const filterTail = () => `${f.dep ? '&department_code=eq.' + E(f.dep) : ''}${f.per ? '&period_code=eq.' + E(f.per) : ''}`;
  const catFilter = (list, cat) => (cat === list ? '&category=is.null' : '&category=eq.' + E(cat));
  const scopeText = () => [f.dep && `قسم ${depName(f.dep)}`, f.per && `فترة ${perName(f.per)}`].filter(Boolean).join(' و');

  async function bulk(list, cat, n) {
    const v = await askForm({ title: `حسم جماعي: ${ar(cat)}`, intro: `سيُحسم ${nf(n)} بنداً من «${ar(list)}»${scopeText() ? ' ضمن ' + scopeText() : ''}.`,
      fields: [{ name: 'res', label: 'نص الحسم', area: true, required: true, hint: 'مثال: تم التأكد والاعتماد. يُكتب هذا النص مع كل بند ويُسجَّل باسمك.' }], ok: 'تابع' });
    if (!v) return;
    if (!(await confirmBox(`تأكيد أخير: حسم ${nf(n)} بنداً دفعة واحدة؟ يُسجَّل الحسم في سجل التعديلات.`, `نعم، احسم ${nf(n)}`, 'danger'))) return;
    const done = await rpc('rpc_resolve_confirmations_bulk', { p_list: list, p_category: cat, p_resolution: v.res, p_department: f.dep || null, p_period: f.per || null });
    toast(`حُسم ${nf(done)} بنداً`, 'ok');
    load();
  }

  // عرض بنود نوع واحد مع اختيار وحسم مجموعة منها
  function openItems(list, cat, total) {
    let offset = 0; const picked = new Set(); const items = h('div'); const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
    const cnt = h('span', { class: 'muted small' });
    const resolveBtn = h('button', { class: 'btn primary', type: 'button', disabled: true }, 'حسم المحدد');
    const upd = () => { cnt.textContent = picked.size ? `المحدد: ${picked.size}` : ''; resolveBtn.disabled = !picked.size; };
    async function page() {
      const rows = await get(`confirmations?select=id,record_key,reason,details,department_code,period_code,resolution&list_name=eq.${E(list)}${catFilter(list, cat)}&status=eq.${E(f.status)}${filterTail()}&order=id&limit=${PAGE}&offset=${offset}`);
      rows.forEach((r) => {
        const cb0 = f.status === 'مفتوح' ? h('input', { type: 'checkbox', 'aria-label': `تحديد البند ${r.record_key}`, onchange: () => { cb0.checked ? picked.add(r.id) : picked.delete(r.id); upd(); } }) : null;
        const cb = cb0 ? h('label', { class: 'check' }, cb0) : null;
        items.append(h('div', { class: 'list-item row', style: 'align-items:flex-start;flex-wrap:nowrap' }, cb,
          h('div', { class: 'grow' },
            h('div', null, h('b', null, ar(r.record_key)), ' ', r.department_code ? badge(depName(r.department_code), 'gray') : null, ' ', r.period_code ? badge(perName(r.period_code), 'gray') : null),
            h('div', { class: 'small' }, ar(r.reason)), r.details ? h('div', { class: 'muted small' }, ar(r.details).slice(0, 220)) : null,
            r.resolution ? h('div', { class: 'small', style: 'color:var(--ok)' }, 'الحسم: ', ar(r.resolution)) : null)));
      });
      offset += rows.length; more.hidden = rows.length < PAGE;
      if (!rows.length && offset === 0) items.append(h('p', { class: 'empty' }, 'لا توجد بنود.'));
    }
    more.addEventListener('click', async () => { more.disabled = true; try { await page(); } catch (e) { fail(e); } more.disabled = false; });
    resolveBtn.addEventListener('click', async () => {
      const v = await askForm({ title: `حسم ${picked.size} بنداً`, fields: [{ name: 'res', label: 'نص الحسم', area: true, required: true }], ok: 'احسم' });
      if (!v) return;
      resolveBtn.disabled = true;
      try { const n = await rpc('rpc_resolve_confirmations_ids', { p_ids: [...picked], p_resolution: v.res }); toast(`حُسم ${nf(n)} بنداً`, 'ok'); close(); load(); }
      catch (e) { fail(e); resolveBtn.disabled = false; }
    });
    const body = h('div', null, h('div', { class: 'row between' }, h('span', { class: 'muted small' }, `${nf(total)} بند`), cnt), items, more);
    const close = sheet({ title: ar(cat), body, actions: f.status === 'مفتوح' ? [{ label: 'إغلاق' }] : [{ label: 'إغلاق' }] });
    if (f.status === 'مفتوح') { const acts = body.parentElement.querySelector('.actions'); acts.classList.remove('one'); acts.prepend(resolveBtn); }
    page().catch(fail);
  }

  drawBar(); load();
}
