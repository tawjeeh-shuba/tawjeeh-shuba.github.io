// مصفوفة الصلاحيات: أزرار تشغيل وإيقاف لكل (دور × عمل)، ونطاق كل صلاحية. كل تغيير يمر بدالة الخادم ويُسجَّل.
// على الجوال: يُختار الدور من الأعلى وتظهر أعماله في قائمة. على الشاشة العريضة: جدول كامل.
import { S, h, get, rpc, loadProfile, choice, sheet, confirmBox, toast, fail, arScope } from './core.js';

const SCOPE = { all: 'الكل', assigned: 'ضمن التكليف', own: 'الخاص' };
const SCOPE_HELP = {
  all: 'يشمل كل الشعبة بلا قيد قسم أو فترة.',
  assigned: 'يقتصر على الأقسام والفترات التي كُلِّف بها الشخص.',
  own: 'يقتصر على ما يخصه مباشرة (مثل معلمي حلقاته المسندة إليه).',
};

export async function render(root) {
  const [roles, actions, perms] = await Promise.all([
    get('roles?select=code,name,can_login,sort_order&can_login=eq.true&order=sort_order'),
    get('actions?select=code,name,description,sort_order&order=sort_order'),
    get('role_permissions?select=role_code,action_code,allowed,scope&limit=1000'),
  ]);
  const P = new Map(perms.map((p) => [`${p.role_code}|${p.action_code}`, p]));
  let role = roles[0]?.code;
  const wide = window.matchMedia('(min-width: 760px)').matches;
  const box = h('div');
  const bar = h('div');

  const get1 = (r, a) => P.get(`${r}|${a}`) || { allowed: false, scope: 'assigned' };

  async function save(r, a, allowed, scope, label) {
    const rn = roles.find((x) => x.code === r).name;
    const msg = allowed
      ? `تشغيل «${a.name}» للدور «${rn}» بنطاق «${SCOPE[scope]}»؟`
      : `إيقاف «${a.name}» عن الدور «${rn}»؟`;
    if (!(await confirmBox(msg, allowed ? 'شغّل' : 'أوقف', allowed ? 'primary' : 'danger'))) return false;
    await rpc('rpc_set_permission', { p_role: r, p_action: a.code, p_allowed: allowed, p_scope: scope });
    P.set(`${r}|${a.code}`, { role_code: r, action_code: a.code, allowed, scope });
    toast(label || 'تم الحفظ', 'ok');
    loadProfile().catch(() => {});   // قد تتغير صلاحياتي أنا
    return true;
  }
  function pickScope(r, a, cur) {
    return new Promise((res) => {
      let val = cur; let done = false;
      const opts = h('div', { class: 'stack' });
      const draw = () => opts.replaceChildren(...Object.keys(SCOPE).map((k) => h('button', { class: `btn block ${k === val ? 'primary' : ''}`, type: 'button', onclick: () => { val = k; draw(); } },
        h('span', null, SCOPE[k], h('small', { style: 'display:block;font-weight:400' }, SCOPE_HELP[k])))));
      draw();
      sheet({ title: `نطاق «${a.name}»`, body: opts, onClose: () => { if (!done) res(null); },
        actions: [{ label: 'حفظ النطاق', kind: 'primary', onClick: (close) => { done = true; res(val); close(); } }, { label: 'تراجع', onClick: (close) => close() }] });
    });
  }

  function control(r, a, redraw) {
    const p = get1(r, a.code);
    const sw = h('button', { class: `switch ${p.allowed ? 'on' : 'off'}`, type: 'button', role: 'switch', 'aria-checked': String(p.allowed), 'aria-label': `${a.name} — ${roles.find((x) => x.code === r).name}` },
      h('span', { class: 'dot' }), p.allowed ? 'مفعّل' : 'موقوف');
    sw.addEventListener('click', async () => {
      sw.disabled = true;
      try { if (await save(r, a, !p.allowed, p.scope, p.allowed ? 'أُوقفت الصلاحية' : 'شُغّلت الصلاحية')) redraw(); } catch (e) { fail(e); }
      sw.disabled = false;
    });
    const sc = p.allowed ? h('button', { class: 'btn sm', type: 'button', style: 'margin-top:6px', onclick: async (e) => {
      const b = e.currentTarget;
      const v = await pickScope(r, a, p.scope);
      if (!v || v === p.scope) return;
      b.disabled = true;
      try { if (await save(r, a, true, v, 'تغيّر النطاق')) redraw(); } catch (er) { fail(er); }
      b.disabled = false;
    } }, `النطاق: ${SCOPE[p.scope]}`) : null;
    return h('div', { style: 'text-align:center' }, sw, sc);
  }

  function draw() {
    box.replaceChildren();
    if (!wide) {
      bar.replaceChildren(h('div', { class: 'filters' }, h('label', { class: 'field full' }, h('span', null, 'الدور'), choice(roles.map((r) => ({ value: r.code, label: r.name })), role, (v) => { role = v; draw(); }, 'الدور'))));
      actions.forEach((a) => box.append(h('div', { class: 'card' }, h('b', null, a.name), a.description ? h('div', { class: 'muted small', style: 'margin:2px 0 10px' }, arScope(a.description)) : null, control(role, a, draw))));
    } else {
      bar.replaceChildren();
      const t = h('table', { class: 'matrix' },
        h('thead', null, h('tr', null, h('th', null, 'العمل'), roles.map((r) => h('th', null, r.name)))),
        h('tbody', null, actions.map((a) => h('tr', null,
          h('td', null, h('b', null, a.name), a.description ? h('div', { class: 'muted small' }, arScope(a.description)) : null),
          roles.map((r) => h('td', null, control(r.code, a, draw)))))));
      box.append(h('div', { class: 'scroll-x' }, t));
    }
  }
  root.append(
    h('p', { class: 'muted' }, 'اضغط الزر لتشغيل الصلاحية أو إيقافها، وسيُطلب منك التأكيد. الشرط في كل صلاحية يحدد النطاق: «الكل» أو «ضمن التكليف» أو «الخاص». لا يمكن نزع صلاحيتي تعديل المصفوفة وتعيين كلمات المرور من مسؤول الشعبة.'),
    bar, box);
  draw();
}
