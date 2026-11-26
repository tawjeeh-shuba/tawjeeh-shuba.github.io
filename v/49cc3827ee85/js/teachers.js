// المعلمون: بحث بالاسم أو رقم الحلقة، وفلاتر الفترة والقسم والموجه، وترتيب احترافي، وتحميل على دفعات (rpc_teacher_list).
// ما يُرى تحدده القاعدة (RLS): الموجه معلموه فقط، ومسؤول القسم نطاقه، ومسؤول الشعبة الجميع. آخر فلاتر تُحفظ في الجهاز.
import { S, h, rpc, nf, myDepartments, debounce, fail, depName } from './core.js';
import { C, isSupCtx } from './ctx.js';
import { teacherCard, prefs, SORTS } from './tlist.js';

let supCache = null;
async function supervisors() {
  if (supCache) return supCache;
  try { supCache = JSON.parse(sessionStorage.getItem('tawjeeh.sups') || 'null'); } catch { /* */ }
  if (!supCache) { supCache = await rpc('rpc_supervisor_options'); try { sessionStorage.setItem('tawjeeh.sups', JSON.stringify(supCache)); } catch { /* */ } }
  return supCache;
}

export async function render(root, ctx) {
  const c = C.cur; const sup = isSupCtx();
  const ck = c?.key || 'all';
  const saved = prefs.get('teachers', ck);
  const f = {
    q: '', per: ctx.query['فترة'] ?? saved.per ?? (c?.period || ''), dep: ctx.query['قسم'] ?? saved.dep ?? '',
    sup: saved.sup || '', sort: saved.sort || (sup ? 'weakest' : 'name'),
  };
  const save = () => prefs.set('teachers', ck, { per: f.per, dep: f.dep, sup: f.sup, sort: f.sort });

  // الأقسام والفترات المتاحة في السياق
  const deps = sup ? (S.refs.departments || []).filter((d) => c.deps.includes(d.code))
    : c && !c.all ? (S.refs.departments || []).filter((d) => c.deps.includes(d.code) || c.groups.includes(d.group_code)) : myDepartments();
  const pers = (S.refs.periods || []).filter((p) => p.is_active && (!sup || C.list.some((x) => x.role === 'supervisor' && x.period === p.code)));
  if (f.dep && !deps.some((d) => d.code === f.dep)) f.dep = '';
  // سياق محدود بقسم واحد (مسؤول قسم): القسم ثابت، فلا يختلط بما يتيحه دور آخر للشخص نفسه
  const oneDep = !sup && c && !c.all && deps.length === 1;
  if (oneDep) f.dep = deps[0].code;
  if (f.per && !pers.some((p) => p.code === f.per)) f.per = '';

  const sel = (label, opts, val, on) => { const s = h('select', { 'aria-label': label, onchange: () => { on(s.value); save(); reload(); } }, opts.map(([v, t]) => h('option', { value: v }, t))); s.value = val; return s; };
  const q = h('input', { type: 'search', placeholder: 'ابحث بالاسم أو رقم الحلقة أو رقم المعلم', enterkeyhint: 'search', 'aria-label': 'بحث' });
  const per = sel('الفترة', [['', 'كل الفترات'], ...pers.map((p) => [p.code, p.name])], f.per, (v) => { f.per = v; });
  const dep = sel('القسم', [...(oneDep ? [] : [['', 'كل الأقسام']]), ...deps.map((d) => [d.code, d.name])], f.dep, (v) => { f.dep = v; });
  const sort = sel('الترتيب', SORTS.map((s) => [s.value, 'ترتيب: ' + s.label]), f.sort, (v) => { f.sort = v; });
  const supSel = sup ? null : sel('الموجه', [['', 'كل الموجهين']], '', (v) => { f.sup = v; });
  if (supSel) supervisors().then((list) => {
    supSel.replaceChildren(...[['', 'كل الموجهين'], ...list.map((x) => [x.id, x.name])].map(([v, t]) => h('option', { value: v }, t)));
    supSel.value = list.some((x) => x.id === f.sup) ? f.sup : '';
    if (supSel.value !== f.sup) { f.sup = supSel.value; reload(); }
  }).catch(() => { supSel.hidden = true; });

  const list = h('div', { 'aria-live': 'polite' });
  const cnt = h('div', { class: 'count-line' });
  const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
  let offset = 0, seq = 0, total = 0;
  async function load(append) {
    const my = ++seq;
    try {
      const d = await rpc('rpc_teacher_list', { p: { q: f.q, period: f.per || null, department: f.dep || null, supervisor: f.sup || null, sort: f.sort, mine: sup, offset } });
      if (my !== seq || !ctx.alive()) return;
      if (!append) list.replaceChildren();
      total = d.total;
      cnt.textContent = `${nf(total)} معلم${sup ? ' من معلميك' : ''}${f.dep ? ' • ' + depName(f.dep) : ''}`;
      if (!d.rows.length && !append) list.append(h('p', { class: 'empty' }, 'لا يوجد معلمون مطابقون. جرّب اسماً أقصر أو غيّر الفلاتر.'));
      d.rows.forEach((r) => list.append(teacherCard(r, { go: ctx.go, period: f.per, visit: sup, showSup: !sup })));
      offset += d.rows.length; more.hidden = offset >= total;
    } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
  }
  function reload() { offset = 0; more.hidden = true; cnt.textContent = ''; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ البحث…')); return load(false); }
  more.addEventListener('click', async () => { more.disabled = true; await load(true); more.disabled = false; });
  q.addEventListener('input', debounce(() => { f.q = q.value.trim(); reload(); }));
  root.append(h('div', { class: `filters ${sup ? '' : 'f4'}` }, h('div', { class: 'full' }, q), per, dep, supSel, sort), cnt, list, more);
  await reload();
}
