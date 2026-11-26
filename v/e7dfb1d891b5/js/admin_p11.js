// الشاشة 11 — المستخدمون والأدوار وصلاحيات الشاشات.
// 11-أ: من له تكليف سارٍ، ودوره ونطاقه، وحالة حسابه، وزر «سحب صلاحيات مساعد إدارة الشعبة / إعادتها» (لمسؤول الشعبة وحده).
//        إدخال التكليفات وإنهاؤها ورمز الدخول تبقى في التبويبات القائمة («الأشخاص والتكليفات» و«الحسابات») ولا تتكرر هنا.
// 11-ب: منح شاشة لشخص (اطلاع/تعديل، نطاق، مدة، سبب)، وتعديله وإيقافه وإعادة تفعيله. المنح باسم المانح، ولا يمنح أحد نفسه.
import { S, h, get, rpc, hijri, badge, field, fail, seg, sheet, today, canAll, depName, grpName, perName, empty, toast } from './core.js';
import { isHead, previewThenSave } from './panel_ui.js';

export async function render(root, ctx) {
  let tab = 'المستخدمون';
  const bar = h('div'); const body = h('div');
  const draw = () => { bar.replaceChildren(seg([{ value: 'المستخدمون', label: '11-أ المستخدمون' }, { value: 'المنح', label: '11-ب صلاحيات الشاشات' }], tab, (v) => { tab = v; draw(); }));
    body.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    (tab === 'المستخدمون' ? users : grants)(body).then(() => body.querySelector(':scope > .loading')?.remove()).catch((e) => { body.replaceChildren(); fail(e); }); };
  root.append(bar, body);

  let STAFF = null;
  async function staff() {
    if (STAFF) return STAFF;
    const rows = await get(`assignments?select=id,role_code,department_code,group_code,period_code,valid_from,valid_to,suspended_at,suspend_reason,`
      + `role:roles!role_code(name,sort_order),person:persons!person_id(id,full_name,display_code,is_active,acc:accounts(is_active,last_login_at,locked_until))`
      + `&or=(valid_to.is.null,valid_to.gte.${today()})&valid_from=lte.${today()}&limit=2000`);
    const by = new Map();
    rows.filter((r) => r.person).forEach((r) => { const p = by.get(r.person.id) || { ...r.person, roles: [] }; p.roles.push(r); by.set(r.person.id, p); });
    STAFF = [...by.values()].sort((a, b) => Math.min(...a.roles.map((x) => x.role.sort_order)) - Math.min(...b.roles.map((x) => x.role.sort_order)) || a.full_name.localeCompare(b.full_name, 'ar'));
    return STAFF;
  }
  const where = (a) => a.department_code ? depName(a.department_code) : a.group_code ? `مجموعة ${grpName(a.group_code)}` : 'الكل';

  // ---------- 11-أ ----------
  async function users(box) {
    const list = await staff();
    let role = '';
    const roles = [...new Map(list.flatMap((p) => p.roles.map((r) => [r.role_code, r.role.name]))).entries()];
    const holder = h('div');
    const drawList = () => holder.replaceChildren(...list.filter((p) => !role || p.roles.some((r) => r.role_code === role)).map(card));
    box.append(h('p', { class: 'muted small' }, 'التكليفات ورمز الدخول تُدار من تبويبي «الأشخاص والتكليفات» و«الحسابات». سحب صلاحيات مساعد إدارة الشعبة يسري من لحظته، وما فعله قبله يبقى في السجل باسمه.'),
      h('div', { class: 'btns', style: 'margin-bottom:8px' }, h('a', { class: 'btn sm', href: '#/لوحة-التحكم?تبويب=' + encodeURIComponent('الأشخاص والتكليفات') }, 'إدارة التكليفات'),
        h('a', { class: 'btn sm', href: '#/لوحة-التحكم?تبويب=' + encodeURIComponent('الحسابات') }, 'الحسابات ورمز الدخول')),
      field('الدور', (() => { const s = h('select', { onchange: () => { role = s.value; drawList(); } }, h('option', { value: '' }, `الكل (${list.length})`), roles.map(([c, n]) => h('option', { value: c }, n))); return s; })()),
      holder);
    drawList();
  }
  function card(p) {
    const acc = p.acc;
    const locked = acc?.locked_until && (acc.locked_until === 'infinity' || new Date(acc.locked_until) > new Date());
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('b', null, p.full_name), h('span', { class: 'row' }, badge(String(p.display_code), 'gray'),
        !p.is_active ? badge('موقوف', 'bad') : !acc ? badge('بلا حساب', 'gray') : !acc.is_active ? badge('الحساب موقوف', 'bad') : locked ? badge('مقفل', 'warn') : badge('نشط', 'ok'))),
      p.roles.map((r) => h('div', { class: 'list-item' },
        h('div', { class: 'row between' }, h('span', null, r.role.name, ' — ', where(r), r.period_code ? ` • ${perName(r.period_code)}` : ''),
          r.suspended_at ? badge('صلاحياته مسحوبة', 'warn') : null),
        h('div', { class: 'muted xs' }, `منذ ${hijri(r.valid_from)}${r.valid_to ? ' حتى ' + hijri(r.valid_to) : ''}`, r.suspended_at ? ` • سُحبت ${hijri(r.suspended_at)}: ${r.suspend_reason || ''}` : ''),
        r.role_code === 'division_assistant' && isHead() ? h('div', { class: 'btns', style: 'margin-top:6px' },
          r.suspended_at ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => assistant(p, false) }, 'إعادة صلاحيات المساعد')
            : h('button', { class: 'btn sm danger', type: 'button', onclick: () => assistant(p, true) }, 'سحب صلاحيات المساعد')) : null)),
      acc?.last_login_at ? h('div', { class: 'muted xs' }, 'آخر دخول: ', hijri(acc.last_login_at)) : null);
  }
  async function assistant(p, revoke) {
    const ok = await previewThenSave({ screen: 'P11', draft: null, title: revoke ? `سحب صلاحيات ${p.full_name}` : `إعادة صلاحيات ${p.full_name}`,
      lines: () => revoke ? [['الأثر', 'من هذه اللحظة: لا تعديل ولا منح ولا اعتماد ولا لوحة. ما فعله قبل السحب يبقى كما هو باسمه، ويمكنك مراجعته واسترجاع ما تشاء من سجل التغييرات.'], ['ما منحه لغيره', 'يبقى؛ راجعه في «11-ب» بتصفية «ما منحه المساعد»']]
        : [['الأثر', 'يعود له كل ما لمسؤول الشعبة عدا سحب صلاحيات المساعد']],
      okLabel: revoke ? 'اسحب الصلاحيات' : 'أعد الصلاحيات',
      save: (reason) => rpc(revoke ? 'rpc_revoke_division_assistant' : 'rpc_restore_division_assistant', { p_person: p.id, p_reason: reason }) });
    if (ok) { STAFF = null; tab = 'المستخدمون'; body.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); users(body).then(() => body.querySelector(':scope > .loading')?.remove()).catch(fail); }
  }

  // ---------- 11-ب ----------
  async function grants(box) {
    const canGrant = canAll('grant_panel_screen');
    const [rows, screens] = await Promise.all([
      get('panel_grants?select=*,person:persons!person_id(full_name,display_code),granter:persons!granted_by(full_name)&order=id.desc&limit=500'),
      get('panel_screens?select=code,name,grantable,is_built,build_phase&order=sort_order'),
    ]);
    const sname = Object.fromEntries(screens.map((s) => [s.code, s.name]));
    let filter = '';
    const holder = h('div');
    const active = (g) => g.status === 'فعّال' && g.valid_from <= today() && (!g.valid_to || g.valid_to >= today());
    const drawList = () => {
      const list = rows.filter((g) => !filter || (filter === 'asst' ? g.granted_by_role === 'مساعد إدارة الشعبة' : filter === 'on' ? active(g) : !active(g)));
      holder.replaceChildren(...(list.length ? list.map((g) => h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('b', null, g.person?.full_name || '—'), h('span', { class: 'row' }, badge(g.mode, g.mode === 'تعديل' ? 'ok' : 'gray'), active(g) ? badge('ساري', 'ok') : badge(g.status === 'موقوف' ? 'موقوف' : 'خارج المدة', 'bad'))),
        h('div', { class: 'small' }, sname[g.screen_code], ' • ', g.scope_departments ? g.scope_departments.map(depName).join('، ') : 'كل الأقسام'),
        h('div', { class: 'muted xs' }, `من ${hijri(g.valid_from)}${g.valid_to ? ' إلى ' + hijri(g.valid_to) : ' بلا نهاية'} • منحه ${g.granter?.full_name || '—'} (${g.granted_by_role}) • السبب: ${g.reason}`),
        g.stop_reason ? h('div', { class: 'muted xs' }, 'سبب الإيقاف: ', g.stop_reason) : null,
        canGrant ? h('div', { class: 'btns', style: 'margin-top:6px' },
          g.status === 'فعّال' ? h('button', { class: 'btn sm', type: 'button', onclick: () => edit(g) }, 'تعديل') : null,
          h('button', { class: `btn sm ${g.status === 'فعّال' ? 'danger' : 'soft'}`, type: 'button', onclick: () => toggle(g) }, g.status === 'فعّال' ? 'إيقاف المنح' : 'إعادة تفعيل')) : null))
        : [empty('لا يوجد منح بهذه التصفية.')]));
    };
    box.append(h('p', { class: 'muted small' }, 'المنح يعطي شخصاً شاشة واحدة اطلاعاً أو تعديلاً، لكل الأقسام أو لأقسام محددة، بمدة اختيارية. شاشة المستخدمين لا تُمنح، وسجل التغييرات يُمنح اطلاعاً فقط.'),
      canGrant ? h('button', { class: 'btn sm primary', type: 'button', style: 'margin-bottom:8px', onclick: () => grant() }, '＋ منح شاشة لشخص') : null,
      field('عرض', (() => { const s = h('select', { onchange: () => { filter = s.value; drawList(); } }, [['', 'الكل'], ['on', 'السارية'], ['off', 'الموقوفة والمنتهية'], ['asst', 'ما منحه مساعد إدارة الشعبة']].map(([v, l]) => h('option', { value: v }, l))); return s; })()),
      holder);
    drawList();

    function deptsBox(sel) {
      const boxes = S.refs.departments.filter((d) => d.is_active).map((d) => { const cb = h('input', { type: 'checkbox', checked: (sel || []).includes(d.code) }); cb.value = d.code; return h('label', { class: 'check' }, cb, d.name); });
      return [h('details', null, h('summary', { class: 'small' }, 'أقسام محددة (اتركها كلها فارغة = كل الأقسام)'), h('div', { style: 'max-height:220px;overflow:auto' }, boxes)),
        () => boxes.map((b) => b.querySelector('input')).filter((x) => x.checked).map((x) => x.value)];
    }
    async function grant() {
      const people = (await staff()).filter((p) => p.id !== S.profile.person_id && p.acc?.is_active);
      const who = h('select', null, h('option', { value: '' }, 'اختر الشخص…'), people.map((p) => h('option', { value: p.id }, `${p.full_name} (${p.roles.map((r) => r.role.name).join('، ')})`)));
      const scr = h('select', null, screens.filter((s) => s.grantable).map((s) => h('option', { value: s.code }, s.name + (s.is_built ? '' : ` (تُبنى في المرحلة ${s.build_phase})`))));
      const mode = h('select', null, h('option', { value: 'اطلاع' }, 'اطلاع'), h('option', { value: 'تعديل' }, 'تعديل'));
      const from = h('input', { type: 'date', value: today(), min: today() }), to = h('input', { type: 'date' });
      const [dBox, readD] = deptsBox(null);
      if (!(await ask('منح شاشة', [field('الشخص', who), field('الشاشة', scr), field('الوضع', mode), dBox, field('من', from), field('إلى (اختياري)', to)]))) return;
      const draft = { op: 'grant', person: who.value, screen: scr.value, mode: mode.value, depts: readD(), from: from.value, to: to.value || null };
      if (await previewThenSave({ screen: 'P11', title: 'منح شاشة', draft, okLabel: 'امنح',
        lines: (pv) => [['الشخص', who.selectedOptions[0]?.textContent], ['الشاشة', pv.screen], ['الوضع', pv.mode], ['النطاق', draft.depts.length ? draft.depts.map(depName).join('، ') : 'كل الأقسام'], ['المدة', `${hijri(draft.from)}${draft.to ? ' إلى ' + hijri(draft.to) : ' بلا نهاية'}`]],
        save: (reason) => rpc('rpc_grant_panel', { p_person: draft.person, p_screen: draft.screen, p_mode: draft.mode, p_depts: draft.depts, p_from: draft.from, p_to: draft.to, p_reason: reason }) })) redraw();
    }
    async function edit(g) {
      const mode = h('select', null, h('option', { value: 'اطلاع' }, 'اطلاع'), h('option', { value: 'تعديل' }, 'تعديل')); mode.value = g.mode;
      const to = h('input', { type: 'date', value: g.valid_to || '' }); const [dBox, readD] = deptsBox(g.scope_departments);
      if (!(await ask(`تعديل منح ${g.person?.full_name}`, [field('الوضع', mode), dBox, field('إلى (اختياري)', to)]))) return;
      const depts = readD();
      if (await previewThenSave({ screen: 'P11', title: 'تعديل المنح', draft: { op: 'grant', id: g.id, person: g.person_id, screen: g.screen_code, mode: mode.value, depts, from: g.valid_from, to: to.value || null },
        lines: () => [['الشاشة', sname[g.screen_code]], ['الوضع', `${g.mode} ← ${mode.value}`], ['النطاق', depts.length ? depts.map(depName).join('، ') : 'كل الأقسام'], ['حتى', to.value ? hijri(to.value) : 'بلا نهاية']],
        save: (reason) => rpc('rpc_panel_grant_update', { p_id: g.id, p_mode: mode.value, p_depts: depts, p_to: to.value || null, p_reason: reason, p_row_version: g.row_version }) })) redraw();
    }
    async function toggle(g) {
      const on = g.status !== 'فعّال';
      if (await previewThenSave({ screen: 'P11', title: on ? 'إعادة تفعيل المنح' : 'إيقاف المنح', okLabel: on ? 'أعد التفعيل' : 'أوقف',
        draft: on ? { op: 'grant', id: g.id, person: g.person_id, screen: g.screen_code, mode: g.mode, depts: g.scope_departments || [], from: g.valid_from, to: g.valid_to } : null,
        lines: () => [['الشخص', g.person?.full_name], ['الشاشة', sname[g.screen_code]], ['الأثر', on ? 'يعود المنح سارياً' : 'يتوقف من الآن ولا يُحذف؛ ما عدّله باسمه يبقى في السجل']],
        save: (reason) => rpc('rpc_panel_grant_set_status', { p_id: g.id, p_active: on, p_reason: reason }) })) redraw();
    }
    function redraw() { box.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); grants(box).then(() => box.querySelector(':scope > .loading')?.remove()).catch(fail); }
  }
  // يُرسم في آخر الدالة بعد تعريف كل المتغيرات (كان قبل «let STAFF» فيفشل أول فتح للشاشة)
  draw();
}

function ask(title, fields) {
  return new Promise((res) => {
    let done = false;
    sheet({ title, body: h('div', null, fields), onClose: () => { if (!done) res(false); },
      actions: [{ label: 'معاينة', kind: 'primary', onClick: (close) => { done = true; res(true); close(); } }, { label: 'تراجع', onClick: (c) => c() }] });
  });
}
