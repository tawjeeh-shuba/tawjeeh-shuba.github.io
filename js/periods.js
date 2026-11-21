// إدارة الفترات: (1) تفصيل فترة «الظهر» إلى قبل/بعد الظهر، (2) تغيير فترة أي حلقة، (3) فترات الموجهين (تكليفاتهم).
// لا حذف: تغيير الفترة يُسجَّل في ملاحظات الحلقة وفي سجل التعديلات، وتكليف الموجه يُنهى بتاريخ ثم يُضاف الجديد.
import { S, h, get, rpc, can, depName, grpName, perName, hijri, today, selectOf, chips, seg, debounce, badge, askForm, confirmBox, toast, fail, field } from './core.js';
import { halaqatQuery, fuzzy } from './queries.js';
import { halaqaCard } from './halaqat.js';

const E = encodeURIComponent;
const ROLE = { supervisor: 'موجه', supervisor_assistant: 'مساعد موجه', mentor: 'مرشد', dept_head: 'مسؤول قسم' };
const ZUHR = 'PER-05';

export async function render(root, ctx) {
  const canPeriod = can('change_period');
  const canAssign = can('manage_assignments') || can('assign_supervisor');
  const TABS = [canPeriod && 'تفصيل الظهر', canPeriod && 'تغيير فترة حلقة', canAssign && 'فترات الموجهين'].filter(Boolean);
  if (!TABS.length) { root.append(h('p', { class: 'empty' }, 'ليست لديك صلاحية في إدارة الفترات.')); return; }
  let tab = ctx.query['حلقة'] && TABS.includes('تغيير فترة حلقة') ? 'تغيير فترة حلقة' : TABS[0];
  const body = h('div'); const bar = h('div');
  const activePeriods = S.refs.periods.filter((p) => p.is_active);
  const ICONS = { 'تفصيل الظهر': 'sun', 'تغيير فترة حلقة': 'clock', 'فترات الموجهين': 'users' };
  const drawTabs = () => bar.replaceChildren(seg(TABS.map((t) => ({ value: t, label: t, icon: ICONS[t] })), tab, (v) => { tab = v; drawTabs(); draw(); }, { grid: TABS.length > 2 }));
  const draw = () => { body.replaceChildren(); ({ 'تفصيل الظهر': zuhrTab, 'تغيير فترة حلقة': changeTab, 'فترات الموجهين': supTab })[tab](body); };

  // ---------- 1) تفصيل الظهر ----------
  async function zuhrTab(box) {
    const targets = S.refs.periods.filter((p) => p.code === 'PER-04' || p.code === 'PER-11');
    const list = h('div', null, h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    const picked = new Set();
    const barBtns = targets.map((t) => h('button', { class: 'btn primary', type: 'button' }, `انقل المحدد إلى «${t.name}»`));
    const sticky = h('div', { class: 'sticky-bar', hidden: true }, h('div', { class: 'small muted', id: 'pcount' }), h('div', { class: 'btns' }, barBtns));
    const upd = () => { sticky.hidden = !picked.size; sticky.querySelector('#pcount').textContent = `المحدد: ${picked.size} حلقة`; };
    box.append(h('p', { class: 'muted' }, 'حلقات فترتها «الظهر» ولم تُفصَّل بعد. اختر لكل حلقة: قبل الظهر أو بعد الظهر، أو حدّد عدة حلقات وانقلها دفعة واحدة.'), list, sticky);
    let rows = [];
    async function load() {
      rows = await get(halaqatQuery({ per: ZUHR }, 0, 200));
      list.replaceChildren();
      picked.clear(); upd();
      if (!rows.length) { list.append(h('p', { class: 'empty' }, 'لا توجد حلقات بفترة «الظهر» غير مفصّلة. 🎉')); return; }
      rows.forEach((r) => {
        const cb = h('input', { type: 'checkbox', 'aria-label': `تحديد الحلقة ${r.number}`,
          onchange: () => { cb.checked ? picked.add(r.number) : picked.delete(r.number); upd(); } });
        list.append(h('div', null, halaqaCard(r, { extra: h('div', { class: 'row', style: 'margin-top:10px' },
          h('label', { class: 'check' }, cb, 'تحديد'),
          targets.map((t) => h('button', { class: 'btn sm soft', type: 'button', onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true;
            try { await move([r], t.code); await load(); } catch (er) { fail(er); b.disabled = false; }
          } }, t.name))) })));
      });
    }
    async function move(rs, per) {
      for (const r of rs) await rpc('rpc_set_halaqa_period', { p_halaqa: r.number, p_period: per, p_detail: r.period_detail || null, p_reason: 'تفصيل فترة الظهر' });
      toast(`نُقلت ${rs.length} حلقة إلى «${perName(per)}»`, 'ok');
    }
    barBtns.forEach((b, i) => b.addEventListener('click', async () => {
      const sel = rows.filter((r) => picked.has(r.number));
      if (!sel.length) return;
      if (!(await confirmBox(`نقل ${sel.length} حلقة إلى «${targets[i].name}»؟`, 'انقل'))) return;
      barBtns.forEach((x) => (x.disabled = true));
      try {
        let n = 0;
        for (const r of sel) { await rpc('rpc_set_halaqa_period', { p_halaqa: r.number, p_period: targets[i].code, p_detail: r.period_detail || null, p_reason: 'تفصيل فترة الظهر' }); b.textContent = `تم ${++n} من ${sel.length}…`; }
        toast(`نُقلت ${sel.length} حلقة إلى «${targets[i].name}»`, 'ok');
      } catch (e) { fail(e); }
      barBtns.forEach((x, j) => { x.disabled = false; x.textContent = `انقل المحدد إلى «${targets[j].name}»`; });
      load().catch(fail);
    }));
    load().catch((e) => { list.replaceChildren(); fail(e); });
  }

  // ---------- 2) تغيير فترة حلقة ----------
  // المرحلة 9ج: قائمة منسدلة بحث فيها الحلقات (الرقم والقسم والفترة الحالية) بدل كتابة الرقم
  function changeTab(box) {
    const q = h('input', { type: 'search', placeholder: 'ابحث برقم الحلقة أو اسم المعلم أو القسم', value: ctx.query['حلقة'] || '', autocomplete: 'off',
      role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'hq-pick-list', 'aria-label': 'اختر الحلقة' });
    const listBox = h('div', { class: 'pick-list', id: 'hq-pick-list', role: 'listbox', hidden: true });
    const out = h('div');
    box.append(h('p', { class: 'muted' }, 'اختر الحلقة من القائمة (تظهر برقمها وقسمها وفترتها الحالية)، ثم اختر الفترة الجديدة واكتب السبب.'),
      h('label', { class: 'field' }, h('span', null, 'الحلقة'), h('div', { class: 'pick' }, q, listBox)), out);
    let seq = 0;
    const label = (r) => `الحلقة ${r.number} • ${depName(r.department_code) || 'بلا قسم'} • ${perName(r.period_code) || 'بلا فترة'}`;
    const open = (on) => { listBox.hidden = !on; q.setAttribute('aria-expanded', String(on)); };
    async function search() {
      const my = ++seq;
      const t = q.value.trim();
      listBox.replaceChildren(h('div', { class: 'pick-empty' }, 'جارٍ البحث…')); open(true);
      try {
        // القسم بالاسم: أقسام نطاقي التي يطابق اسمها النص، ثم حلقاتها
        const deps = t && !/^\d+$/.test(t) ? S.refs.departments.filter((d) => d.name.includes(t)).slice(0, 3) : [];
        const lists = await Promise.all([
          get(halaqatQuery({ q: t, active: true }, 0, 30)).catch(() => []),
          ...deps.map((d) => get(halaqatQuery({ dep: d.code, active: true }, 0, 30)).catch(() => []))]);
        if (my !== seq) return;
        const seen = new Set(); const rows = lists.flat().filter((r) => !seen.has(r.number) && seen.add(r.number)).slice(0, 40);
        listBox.replaceChildren(...(rows.length ? rows.map((r) => h('button', { type: 'button', role: 'option', class: 'pick-opt', onclick: () => choose(r) },
          h('b', null, r.number), h('span', null, depName(r.department_code) || 'بلا قسم'), h('span', { class: 'badge gray' }, perName(r.period_code) || 'بلا فترة')))
          : [h('div', { class: 'pick-empty' }, 'لا حلقة مطابقة ضمن نطاقك.')]));
      } catch (e) { if (my === seq) { open(false); fail(e); } }
    }
    function choose(r) {
      open(false); q.value = label(r);
      out.replaceChildren();
      const per = selectOf(activePeriods, { all: 'اختر الفترة الجديدة' });
      const detail = h('input', { type: 'text', value: r.period_detail || '', placeholder: 'تفصيل الفترة (اختياري)' });
      const reason = h('input', { type: 'text', placeholder: 'سبب التغيير (مطلوب)' });
      const save = h('button', { class: 'btn primary block', type: 'button' }, 'غيّر الفترة');
      save.addEventListener('click', async () => {
        if (!per.value) return toast('اختر الفترة الجديدة', 'bad');
        if (per.value === r.period_code) return toast('هذه هي الفترة الحالية', 'bad');
        if (!reason.value.trim()) return toast('اكتب السبب', 'bad');
        if (!(await confirmBox(`نقل الحلقة ${r.number} من «${perName(r.period_code) || 'بلا فترة'}» إلى «${perName(per.value)}»؟`, 'غيّر'))) return;
        save.disabled = true;
        try {
          await rpc('rpc_set_halaqa_period', { p_halaqa: r.number, p_period: per.value, p_detail: detail.value.trim() || null, p_reason: reason.value.trim() });
          toast('تم تغيير الفترة', 'ok');
          const [fresh] = await get(halaqatQuery({ q: r.number }, 0, 5)).then((x) => x.filter((y) => y.number === r.number));
          choose(fresh || r);
        } catch (e) { fail(e); save.disabled = false; }
      });
      out.append(halaqaCard(r), h('div', { class: 'card' }, field('الفترة الحالية', h('b', null, perName(r.period_code) || 'بلا فترة')), field('الفترة الجديدة', per), field('التفصيل', detail), field('السبب', reason), save));
    }
    q.addEventListener('input', debounce(() => { out.replaceChildren(); search(); }, 300));
    q.addEventListener('focus', () => { if (!out.childElementCount) search(); else { q.select(); } });
    q.addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
    document.addEventListener('click', function off(e) { if (!box.isConnected) return document.removeEventListener('click', off); if (!e.target.closest('.pick')) open(false); });
    // رابط مباشر بحلقة (?حلقة=رقم): تُختار مباشرة
    const pre = (ctx.query['حلقة'] || '').trim();
    if (/^\d+$/.test(pre)) get(halaqatQuery({ q: pre }, 0, 5)).then((x) => { const r = x.find((y) => y.number === pre); if (r) choose(r); }).catch(fail);
  }

  // ---------- 3) فترات الموجهين ----------
  function supTab(box) {
    const q = h('input', { type: 'search', placeholder: 'ابحث باسم الموجه أو المرشد', 'aria-label': 'بحث' });
    const dep = selectOf(S.refs.departments, { all: 'كل الأقسام', onchange: () => load() });
    const list = h('div');
    box.append(h('p', { class: 'muted' }, 'التكليف «كل الفترات» يعني أن الموجه يرى كل فترات قسمه. حدّد الفترة ليقتصر عمله عليها. التغيير ينهي التكليف القديم بتاريخ اليوم ويضيف الجديد.'),
      h('div', { class: 'filters' }, h('div', { class: 'full' }, q), dep), list);
    let seq = 0;
    async function load() {
      const my = ++seq;
      list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
      const name = q.value.trim();
      try {
        const rows = await get(`assignments?select=id,role_code,department_code,group_code,period_code,valid_from,assists_person_id,person:persons!person_id${name ? '!inner' : ''}(id,full_name)`
          + `&role_code=in.(supervisor,supervisor_assistant,mentor,dept_head)&valid_to=is.null${dep.value ? '&department_code=eq.' + E(dep.value) : ''}`
          + `${name ? '&person.full_name=ilike.' + E('*' + fuzzy(name) + '*') : ''}&order=person_id&limit=120`);
        if (my !== seq) return;
        list.replaceChildren();
        if (!rows.length) { list.append(h('p', { class: 'empty' }, 'لا توجد تكليفات مطابقة.')); return; }
        const by = new Map();
        rows.forEach((a) => { if (!by.has(a.person.id)) by.set(a.person.id, { p: a.person, items: [] }); by.get(a.person.id).items.push(a); });
        [...by.values()].forEach(({ p, items }) => list.append(h('div', { class: 'card' }, h('b', null, p.full_name), items.map(item))));
      } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
    }
    const item = (a) => h('div', { class: 'list-item' },
      h('div', { class: 'row between' }, h('span', null, ROLE[a.role_code] || a.role_code), badge(a.period_code ? perName(a.period_code) : 'كل الفترات', a.period_code ? '' : 'gray')),
      h('div', { class: 'muted small' }, a.department_code ? depName(a.department_code) : `مجموعة ${grpName(a.group_code)}`, ' • منذ ', hijri(a.valid_from)),
      h('div', { class: 'btns', style: 'margin-top:8px' },
        h('button', { class: 'btn sm soft', type: 'button', onclick: (e) => changePeriod(e.currentTarget, a, true) }, 'حدّد الفترة'),
        h('button', { class: 'btn sm', type: 'button', onclick: (e) => changePeriod(e.currentTarget, a, false) }, 'أضف فترة أخرى'),
        h('button', { class: 'btn sm danger', type: 'button', onclick: (e) => endIt(e.currentTarget, a) }, 'إنهاء التكليف')));

    async function addNew(a, per, reason) {
      const id = await rpc('rpc_add_assignment', { p_person: a.person.id, p_role: a.role_code, p_department: a.department_code, p_group: a.group_code,
        p_period: per || null, p_from: today(), p_to: null, p_term: null, p_reason: reason });
      if (a.assists_person_id) await rpc('rpc_set_assists', { p_assignment: id, p_supervisor: a.assists_person_id });
    }
    async function changePeriod(btn, a, replace) {
      const v = await askForm({ title: replace ? 'تحديد فترة التكليف' : 'إضافة فترة أخرى', intro: `${a.person.full_name} — ${ROLE[a.role_code]} — ${a.department_code ? depName(a.department_code) : grpName(a.group_code)}`,
        fields: [{ name: 'per', label: 'الفترة', options: [{ value: '', label: 'كل الفترات' }, ...activePeriods.map((p) => ({ value: p.code, label: p.name }))] },
          { name: 'reason', label: 'السبب', value: replace ? 'تحديد الفترة' : 'إضافة فترة', required: true }], ok: 'حفظ' });
      if (!v) return;
      if (replace && (v.per || '') === (a.period_code || '')) return toast('هذه هي الفترة الحالية', 'bad');
      btn.disabled = true;
      try {
        await addNew(a, v.per, v.reason);                                  // الإضافة أولاً حتى لا يُترك الشخص بلا تكليف إن فشلت الخطوة التالية
        if (replace) await rpc('rpc_end_assignment', { p_id: a.id, p_date: today(), p_reason: `تغيير الفترة: ${v.reason}` });
        toast('تم الحفظ', 'ok'); load();
      } catch (e) { fail(e); btn.disabled = false; load(); }
    }
    async function endIt(btn, a) {
      const v = await askForm({ title: 'إنهاء التكليف', intro: `${a.person.full_name} — ${ROLE[a.role_code]}. يُنهى بتاريخ اليوم ولا يُحذف.`, fields: [{ name: 'reason', label: 'السبب', required: true }], ok: 'أنهِ التكليف' });
      if (!v) return;
      btn.disabled = true;
      try { await rpc('rpc_end_assignment', { p_id: a.id, p_date: today(), p_reason: v.reason }); toast('أُنهي التكليف', 'ok'); load(); }
      catch (e) { fail(e); btn.disabled = false; }
    }
    q.addEventListener('input', debounce(load, 400));
    load();
  }

  root.append(bar, body);
  drawTabs(); draw();
}
