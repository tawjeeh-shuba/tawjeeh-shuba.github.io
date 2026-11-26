// الإسناد (مثل تطبيق «إسناد المعلمين» القديم):
// الموجه: أسندها لي / اطلبها / ألغِ إسنادي / ألغِ طلبي.  المسؤول: أسند وانقل وأنهِ، واعتمد الطلبات أو ارفضها.
// الإلغاء إنهاء بتاريخ لا حذف. كل فحص حقيقي للصلاحية داخل قاعدة البيانات.
import { S, h, get, rpc, can, isDivisionHead, depName, perName, hijri, myDepartments, selectOf, chips, seg, debounce, badge, askForm, confirmBox, toast, fail, ar, nf } from './core.js';
import { halaqatQuery, SIZE, sectorOK, sectorQS } from './queries.js';

const TABS = ['الحلقات', 'الطلبات', 'السجل'];
const TAB_ICON = { 'الحلقات': 'book', 'الطلبات': 'inbox', 'السجل': 'list' };
const E = encodeURIComponent;

export async function render(root, ctx) {
  const me = S.profile.person_id;
  const deps = myDepartments();
  const st = {
    tab: TABS.includes(ctx.query['تبويب']) ? ctx.query['تبويب'] : 'الحلقات',
    dep: ctx.query['قسم'] || deps[0]?.code || '', per: ctx.query['فترة'] || '', status: 'الكل', q: ctx.query['حلقة'] || '',
  };
  if (!can('self_assign') && !can('request_halaqa') && !can('assign_supervisor') && !can('decide_requests')) {
    root.append(h('p', { class: 'empty' }, 'ليست لديك صلاحية في الإسناد.')); return;
  }
  const body = h('div');
  const tabsBox = h('div');
  const dep = selectOf(deps, { all: 'اختر القسم', value: st.dep, onchange: (v) => { st.dep = v; draw(); } });
  const per = selectOf(S.refs.periods.filter((p) => p.is_active), { all: 'كل الفترات', value: st.per, onchange: (v) => { st.per = v; draw(); } });
  const head = h('div', { class: 'filters' }, dep, per);

  function drawTabs() {
    tabsBox.replaceChildren(seg(TABS.map((t) => ({ value: t, label: t, icon: TAB_ICON[t] })), st.tab, (v) => { st.tab = v; drawTabs(); draw(); }));
  }
  function draw() {
    body.replaceChildren();
    ({ 'الحلقات': halaqatTab, 'الطلبات': requestsTab, 'السجل': logTab })[st.tab](body);
  }

  // ---------- تبويب الحلقات ----------
  function halaqatTab(box) {
    if (!st.dep) { box.append(h('p', { class: 'empty' }, 'اختر القسم من الأعلى لتظهر حلقاته.')); return; }
    // شريط أرقام القسم والفترة المختارين (من الملخص المحسوب مسبقاً، قراءة فقط)
    const kpi = h('div', { class: 'card flat', style: 'padding:12px' }, h('div', { class: 'loading', style: 'min-height:0;margin:0' }));
    get(`dept_period_summary?select=sector,halaqat_active,halaqat_no_supervisor&department_code=eq.${E(st.dep)}${st.per ? '&period_code=eq.' + E(st.per) : ''}&limit=500`).then((rs0) => {
      const rs = rs0.filter((r) => sectorOK(r.sector));
      const a = rs.reduce((x, r) => x + (r.halaqat_active || 0), 0), n = rs.reduce((x, r) => x + (r.halaqat_no_supervisor || 0), 0);
      const k = (v, l, cls = '') => h('div', { class: `stat ${cls}` }, h('b', null, nf(v)), h('span', null, l));
      kpi.replaceChildren(h('div', { class: 'stats compact', style: 'margin:0 0 10px' }, k(a, 'حلقة نشطة'), k(a - n, 'مسندة'), k(n, 'بلا موجه', n ? 'warn' : '')),
        h('div', { class: 'row between xs', style: 'font-weight:600;margin-bottom:6px' }, h('span', { class: 'muted' }, 'نسبة الإسناد'), h('span', null, `${a ? Math.round(((a - n) / a) * 100) : 0}٪`)),
        h('div', { class: 'bar', role: 'img', 'aria-label': `نسبة الإسناد ${a ? Math.round(((a - n) / a) * 100) : 0}٪` }, h('i', { style: `width:${a ? ((a - n) / a) * 100 : 0}%` })));
    }).catch(() => kpi.remove());
    const q = h('input', { type: 'search', placeholder: 'رقم الحلقة', inputmode: 'numeric', value: st.q, 'aria-label': 'رقم الحلقة' });
    const bar = h('div'); const list = h('div'); const more = h('button', { class: 'btn block', type: 'button', hidden: true }, 'عرض المزيد');
    let offset = 0, seq = 0, mine = new Map();
    const FILTERS = ['الكل', 'بلا موجه', 'مسندة لي', 'عند غيري'];
    const drawBar = () => bar.replaceChildren(chips(FILTERS.map((s) => ({ value: s, label: s })), st.status, (v) => { st.status = v; drawBar(); reload(); }));

    async function load(append) {
      const my = ++seq;
      try {
        const [rows, pend] = await Promise.all([
          get(halaqatQuery({ q: st.q, dep: st.dep, per: st.per, status: st.status === 'الكل' ? '' : st.status, me, active: true }, offset)),
          offset === 0 && can('request_halaqa') ? get(`assignment_requests?select=id,halaqa_number&requested_by=eq.${me}&status=eq.${E('معلق')}`) : [],
        ]);
        if (my !== seq) return;
        if (offset === 0) mine = new Map(pend.map((x) => [x.halaqa_number, x.id]));
        if (!append) list.replaceChildren();
        if (!rows.length && !append) list.append(h('p', { class: 'empty' }, 'لا توجد حلقات مطابقة.'));
        rows.forEach((r) => list.append(card(r)));
        offset += rows.length; more.hidden = rows.length < SIZE;
      } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
    }
    function reload() { offset = 0; more.hidden = true; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); load(false); }
    const refresh = () => reload();

    function card(r) {
      const sup = (r.halaqa_supervisors || []).find((x) => !x.valid_to);
      const t = (r.halaqa_teachers || []).find((x) => !x.valid_to && x.type === 'أساسي');
      const isMine = sup?.person?.id === me;
      const btns = [];
      if (!sup) {
        if (can('self_assign')) btns.push(act('أسندها لي', 'primary', async () => {
          if (await confirmBox(`هل تُسند الحلقة ${r.number} إلى نفسك؟`, 'نعم، أسندها لي')) { await rpc('rpc_self_assign', { p_halaqa: r.number }); toast('أُسندت الحلقة إليك', 'ok'); refresh(); }
        }));
        if (can('assign_supervisor')) btns.push(act('أسندها إلى موجه…', '', () => pickSupervisor(r, false)));
      } else {
        if (isMine && can('self_assign')) btns.push(act('ألغِ إسنادي', 'danger', async () => {
          const v = await askForm({ title: `إلغاء إسنادك للحلقة ${r.number}`, fields: [{ name: 'reason', label: 'السبب', required: true, area: true }], ok: 'ألغِ الإسناد' });
          if (v) { await rpc('rpc_unassign_self', { p_halaqa: r.number, p_reason: v.reason }); toast('أُنهي إسنادك للحلقة', 'ok'); refresh(); }
        }));
        if (!isMine && can('request_halaqa') && !isDivisionHead()) {
          const rid = mine.get(r.number);
          if (rid) btns.push(act('ألغِ طلبي', '', async () => { await rpc('rpc_cancel_request', { p_request: rid }); toast('أُلغي طلبك', 'ok'); refresh(); }));
          else btns.push(act('اطلبها', 'primary', async () => {
            const v = await askForm({ title: `طلب الحلقة ${r.number}`, intro: `الحلقة عند: ${(sup.person?.full_name ?? 'غير ظاهر لك')}. يصل طلبك إلى المسؤول ليعتمده أو يرفضه.`, fields: [{ name: 'note', label: 'ملاحظة (اختياري)', area: true }], ok: 'أرسل الطلب' });
            if (v) { await rpc('rpc_request_halaqa', { p_halaqa: r.number, p_note: v.note || null }); toast('أُرسل طلبك', 'ok'); refresh(); }
          }));
        }
        if (can('assign_supervisor')) {
          btns.push(act('نقل إلى موجه…', '', () => pickSupervisor(r, true)));
          btns.push(act('إنهاء الإسناد', 'danger', async () => {
            const v = await askForm({ title: `إنهاء إسناد الحلقة ${r.number}`, intro: 'الإنهاء بتاريخ اليوم، ولا يُحذف شيء من السجل.', fields: [{ name: 'reason', label: 'السبب', required: true, area: true }], ok: 'أنهِ الإسناد' });
            if (v) { await rpc('rpc_end_supervisor', { p_halaqa: r.number, p_reason: v.reason }); toast('أُنهي الإسناد', 'ok'); refresh(); }
          }));
        }
      }
      const pend = mine.has(r.number);
      return h('div', { class: 'card' },
        h('div', { class: 'hq' },
          h('div', { class: `no ${isMine ? 'mine' : !sup ? 'free' : ''}` }, h('small', null, 'حلقة'), r.number),
          h('div', { class: 'bd' },
            h('div', { class: 'meta' }, [depName(r.department_code), perName(r.period_code) || 'بلا فترة'].filter(Boolean).join(' • ')),
            h('div', { class: 'ln' }, h('span', { class: 'k' }, 'المعلم:'), t ? h('b', null, (t.person?.full_name ?? 'غير ظاهر لك')) : h('b', { class: 'missing' }, 'لا يوجد')),
            h('div', { class: 'ln' }, h('span', { class: 'k' }, 'الموجه:'), sup ? h('b', null, (sup.person?.full_name ?? 'غير ظاهر لك')) : h('b', { class: 'free-t' }, 'غير مسندة')),
            h('div', { class: 'tags', style: 'margin-top:6px' }, sup ? badge(isMine ? 'مسندة إليك' : 'عند موجه آخر', isMine ? 'ok' : 'gray') : badge('بلا موجه', 'warn'),
              pend ? badge('لك طلب معلق', 'info') : null))),
        btns.length ? h('div', { class: 'btns', style: 'margin-top:12px' }, btns) : null);
    }
    const act = (label, kind, fnc) => {
      const b = h('button', { class: `btn ${kind}`, type: 'button' }, label);
      b.addEventListener('click', async () => { b.disabled = true; try { await fnc(); } catch (e) { fail(e); } finally { b.disabled = false; } });
      return b;
    };

    // اختيار الموجه (للمسؤول): من له تكليف «موجه» ساري يغطي قسم الحلقة وفترتها
    async function pickSupervisor(r, isMove) {
      const grp = S.refs.departments.find((d) => d.code === r.department_code)?.group_code;
      const orq = [`department_code.eq.${r.department_code}`, grp ? `group_code.eq.${grp}` : null].filter(Boolean).join(',');
      const rows = await get(`assignments?select=person_id,period_code,person:persons!person_id(id,full_name)&role_code=eq.supervisor&valid_to=is.null&or=(${orq})`);
      const ok = new Map();
      rows.filter((x) => x.person && (!x.period_code || x.period_code === r.period_code)).forEach((x) => ok.set(x.person.id, (x.person?.full_name ?? 'غير ظاهر لك')));
      const cur = (r.halaqa_supervisors || []).find((x) => !x.valid_to)?.person?.id;
      ok.delete(cur);
      if (!ok.size) { toast('لا يوجد موجه آخر مكلّف بهذا القسم وهذه الفترة', 'bad'); return; }
      const opts = [...ok].sort((a, b) => a[1].localeCompare(b[1], 'ar')).map(([value, label]) => ({ value, label }));
      const v = await askForm({ title: `${isMove ? 'نقل' : 'إسناد'} الحلقة ${r.number}`,
        fields: [{ name: 'person', label: 'الموجه', options: [{ value: '', label: 'اختر الموجه…' }, ...opts], required: true },
          { name: 'reason', label: 'السبب', value: isMove ? '' : 'إسناد من المسؤول', required: true }], ok: isMove ? 'انقل' : 'أسند' });
      if (v) { await rpc('rpc_assign_supervisor', { p_halaqa: r.number, p_person: v.person, p_reason: v.reason }); toast('تم الإسناد', 'ok'); refresh(); }
    }

    q.addEventListener('input', debounce(() => { st.q = q.value.trim(); reload(); }));
    drawBar();
    box.append(kpi, h('div', { class: 'filters' }, h('div', { class: 'full' }, q)), bar, list, more);
    more.addEventListener('click', async () => { more.disabled = true; await load(true); more.disabled = false; });
    reload();
  }

  // ---------- تبويب الطلبات ----------
  async function requestsTab(box) {
    const decider = can('decide_requests');
    let only = 'معلق';
    const bar = h('div'); const list = h('div');
    const draw2 = () => bar.replaceChildren(chips([{ value: 'معلق', label: 'المعلقة' }, { value: '', label: 'كل الطلبات' }], only, (v) => { only = v; draw2(); load(); }));
    async function load() {
      list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
      try {
        const rows = await get(`assignment_requests?select=id,status,halaqa_number,note,created_at,decided_at,decision_note,requested_by,req:persons!requested_by(full_name),frm:persons!from_person_id(full_name),h:halaqat!inner(department_code,period_code,sector)`
          + `${only ? '&status=eq.' + E(only) : ''}${sectorQS('h.')}&order=created_at.desc&limit=50`);
        list.replaceChildren();
        if (!rows.length) list.append(h('p', { class: 'empty' }, only ? 'لا توجد طلبات معلقة.' : 'لا توجد طلبات.'));
        rows.forEach((r) => list.append(reqCard(r)));
      } catch (e) { list.replaceChildren(); fail(e); }
    }
    function reqCard(r) {
      const pending = r.status === 'معلق';
      const btns = [];
      if (pending && decider) {
        btns.push(h('button', { class: 'btn primary', type: 'button', onclick: (e) => decide(e.currentTarget, r, true) }, 'اعتماد'));
        btns.push(h('button', { class: 'btn danger', type: 'button', onclick: (e) => decide(e.currentTarget, r, false) }, 'رفض'));
      }
      if (pending && r.requested_by === me) btns.push(h('button', { class: 'btn', type: 'button', onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { await rpc('rpc_cancel_request', { p_request: r.id }); toast('أُلغي الطلب', 'ok'); load(); } catch (er) { fail(er); e.currentTarget.disabled = false; }
      } }, 'ألغِ طلبي'));
      return h('div', { class: 'card' },
        h('div', { class: 'hq' },
          h('div', { class: `no ${pending ? 'free' : ''}` }, h('small', null, 'حلقة'), r.halaqa_number),
          h('div', { class: 'bd' },
            h('div', { class: 'meta' }, [depName(r.h?.department_code), perName(r.h?.period_code)].filter(Boolean).join(' • '), badge(r.status, pending ? 'warn' : r.status === 'معتمد' ? 'ok' : 'gray')),
            h('div', { class: 'ln' }, h('span', { class: 'k' }, 'مقدّم الطلب:'), h('b', null, r.req?.full_name || '')),
            h('div', { class: 'ln' }, h('span', { class: 'k' }, 'الموجه الحالي:'), h('b', null, r.frm?.full_name || '—')),
            r.note ? h('div', { class: 'ln' }, h('span', { class: 'k' }, 'ملاحظة:'), h('span', null, r.note)) : null,
            r.decision_note ? h('div', { class: 'ln' }, h('span', { class: 'k' }, 'القرار:'), h('span', null, ar(r.decision_note))) : null,
            h('div', { class: 'muted xs', style: 'margin-top:4px' }, hijri(r.created_at)))),
        btns.length ? h('div', { class: 'btns', style: 'margin-top:12px' }, btns) : null);
    }
    async function decide(btn, r, approve) {
      const v = await askForm({ title: `${approve ? 'اعتماد' : 'رفض'} طلب الحلقة ${r.halaqa_number}`,
        intro: approve ? `تنتقل الحلقة من ${r.frm?.full_name || '—'} إلى ${r.req?.full_name}.` : null,
        fields: [{ name: 'note', label: 'ملاحظة القرار (اختياري)', area: true }], ok: approve ? 'اعتمد' : 'ارفض' });
      if (!v) return;
      btn.disabled = true;
      try { await rpc('rpc_decide_request', { p_request: r.id, p_approve: approve, p_note: v.note || null }); toast(approve ? 'اعتُمد الطلب' : 'رُفض الطلب', 'ok'); load(); }
      catch (e) { fail(e); btn.disabled = false; }
    }
    draw2(); box.append(bar, list); load();
  }

  // ---------- تبويب السجل ----------
  async function logTab(box) {
    const list = h('div', null, h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    box.append(list);
    try {
      const rows = await get(`halaqa_supervisors?select=id,halaqa_number,valid_from,valid_to,reason,end_reason,updated_at,person:persons!person_id(full_name),h:halaqat!inner(department_code,period_code,sector)`
        + `${sectorQS('h.')}${st.dep ? '&h.department_code=eq.' + E(st.dep) : ''}${st.per ? '&h.period_code=eq.' + E(st.per) : ''}&order=updated_at.desc&limit=40`);
      list.replaceChildren();
      if (!rows.length) list.append(h('p', { class: 'empty' }, 'لا توجد تغييرات.'));
      rows.forEach((r) => list.append(h('div', { class: 'card' },
        h('div', { class: 'hq' },
          h('div', { class: `no ${r.valid_to ? 'off' : ''}` }, h('small', null, 'حلقة'), r.halaqa_number),
          h('div', { class: 'bd' },
            h('div', { class: 'meta' }, badge(r.valid_to ? 'منتهٍ' : 'سارٍ', r.valid_to ? 'gray' : 'ok'), `من ${hijri(r.valid_from)}`, r.valid_to ? ` إلى ${hijri(r.valid_to)}` : ''),
            h('div', { class: 'ln' }, h('span', { class: 'k' }, 'الموجه:'), h('b', null, r.person?.full_name || '')),
            r.reason ? h('div', { class: 'ln' }, h('span', { class: 'k' }, 'السبب:'), h('span', null, ar(r.reason))) : null,
            r.end_reason ? h('div', { class: 'ln' }, h('span', { class: 'k' }, 'سبب الإنهاء:'), h('span', null, ar(r.end_reason))) : null)))));
    } catch (e) { list.replaceChildren(); fail(e); }
  }

  root.append(head, tabsBox, body);
  drawTabs(); draw();
}
