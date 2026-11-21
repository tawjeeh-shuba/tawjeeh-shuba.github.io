// الحسابات: تعيين كلمة مرور (وإنشاء الحساب لمن لا جوال له)، وفك القفل لمسؤول الشعبة وحده. كلمة المرور لا تُخزَّن ولا تُسجَّل، ويُلزم صاحبها بتغييرها.
import { S, h, get, fn, rpc, hijri, debounce, badge, askForm, confirmBox, toast, fail, field, ar } from './core.js';
import { fuzzy } from './queries.js';

const E = encodeURIComponent;
const lockedFuture = (a) => a?.locked_until && a.locked_until !== 'infinity' && new Date(a.locked_until) > new Date();
const forever = (a) => a?.locked_until && (a.locked_until === 'infinity' || new Date(a.locked_until).getFullYear() > 9000);

export async function render(root) {
  // فك القفل لمسؤول الشعبة فقط (والفحص الحقيقي داخل القاعدة)
  const isHead = !!S.profile?.assignments?.some((x) => x.role === 'division_head');
  const q = h('input', { type: 'search', placeholder: 'اسم الشخص أو رقمه', enterkeyhint: 'search', 'aria-label': 'بحث' });
  const list = h('div'); const pending = h('div');
  root.append(h('p', { class: 'muted' }, 'تعيّن كلمة مرور أولى للشخص، ويُلزَم بتغييرها عند أول دخول وتنتهي صلاحيتها بعد 14 يوماً. لا تُحفظ كلمة المرور عندنا بصيغة مقروءة.'),
    h('label', { class: 'field' }, h('span', null, 'ابحث عن شخص'), q), list,
    h('h2', { style: 'margin:18px 0 8px' }, 'أشخاص بلا حساب (بلا جوال)'), pending);

  let seq = 0;
  async function search() {
    const my = ++seq; const v = q.value.trim(); list.replaceChildren();
    if (v.length < 2) return;
    list.append(h('p', { class: 'loading' }, 'جارٍ البحث…'));
    const cond = /^\d+$/.test(v) ? 'display_code=like.' + E(v + '*') : /^[رن]-/.test(v) ? 'display_code=ilike.' + E(v + '*') : 'full_name=ilike.' + E('*' + fuzzy(v) + '*');
    try {
      const rows = await get(`persons?select=id,display_code,full_name,is_active,acc:accounts(is_active,must_change_password,locked_until,failed_attempts,last_login_at,initial_password_expires_at)&${cond}&is_active=eq.true&order=full_name&limit=15`);
      if (my !== seq) return;
      list.replaceChildren();
      if (!rows.length) list.append(h('p', { class: 'empty' }, 'لا يوجد أحد بهذا الاسم.'));
      rows.forEach((p) => list.append(card(p)));
    } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
  }
  q.addEventListener('input', debounce(search, 400));

  function card(p) {
    const a = p.acc;
    const state = !a ? badge('بلا حساب', 'warn') : forever(a) ? badge('مقفل نهائياً', 'bad') : lockedFuture(a) ? badge('مقفل مؤقتاً', 'bad') : !a.is_active ? badge('موقوف', 'bad') : a.must_change_password ? badge('بانتظار تغيير كلمة المرور', 'warn') : badge('نشط');
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('b', null, p.full_name), badge(String(p.display_code), 'gray')),
      h('div', { style: 'margin:6px 0' }, state),
      a?.last_login_at ? h('div', { class: 'muted small' }, 'آخر دخول: ', hijri(a.last_login_at)) : null,
      a?.must_change_password && a.initial_password_expires_at ? h('div', { class: 'muted small' }, 'تنتهي كلمة المرور الأولى: ', hijri(a.initial_password_expires_at)) : null,
      h('div', { class: 'btns', style: 'margin-top:10px' },
        h('button', { class: 'btn sm primary', type: 'button', onclick: (e) => setPw(e.currentTarget, p, !a) }, a ? 'تعيين كلمة مرور' : 'إنشاء الحساب بكلمة مرور'),
        a && isHead && (lockedFuture(a) || a.failed_attempts) && !forever(a) && a.is_active ? h('button', { class: 'btn sm', type: 'button', onclick: (e) => unlock(e.currentTarget, p) }, 'فك القفل') : null));
  }
  async function setPw(btn, p, create) {
    const v = await askForm({ title: `${create ? 'إنشاء حساب' : 'كلمة مرور جديدة'}: ${p.full_name}`,
      intro: 'اختر كلمة مرور مؤقتة وسلّمها له بنفسك. سيُطلب منه تغييرها فور أول دخول.',
      fields: [{ name: 'pw', label: 'كلمة المرور المؤقتة', required: true, hint: '6 خانات على الأقل' }], ok: 'احفظ' });
    if (!v) return;
    btn.disabled = true;
    try { await fn('admin-set-password', { person_id: p.id, action: 'set', password: v.pw }); toast(create ? 'أُنشئ الحساب' : 'عُيّنت كلمة المرور', 'ok'); search(); loadPending(); }
    catch (e) { fail(e); } finally { btn.disabled = false; }
  }
  async function unlock(btn, p) {
    btn.disabled = true;
    try { await rpc('admin_unlock_account', { p_person: p.id }); toast('فُكّ القفل', 'ok'); search(); }
    catch (e) { fail(e); btn.disabled = false; }
  }

  // الذين لا جوال لهم: بنود «الحسابات» المفتوحة
  async function loadPending() {
    pending.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    try {
      const rows = await get(`confirmations?select=id,record_key,details&list_name=eq.${E('الحسابات')}&status=eq.${E('مفتوح')}&order=id&limit=100`);
      pending.replaceChildren();
      if (!rows.length) { pending.append(h('p', { class: 'empty' }, 'كل من يحق له الدخول لديه حساب. 🎉')); return; }
      const people = await get(`persons?select=id,display_code,full_name&display_code=in.(${rows.map((r) => E('"' + r.record_key + '"')).join(',')})`);
      const byCode = new Map(people.map((p) => [p.display_code, p]));
      rows.forEach((r) => {
        const p = byCode.get(r.record_key);
        pending.append(h('div', { class: 'card' },
          h('div', { class: 'row between' }, h('b', null, p?.full_name || ar(r.record_key)), badge(String(r.record_key), 'gray')),
          r.details ? h('div', { class: 'muted small' }, ar(r.details).slice(0, 160)) : null,
          p ? h('button', { class: 'btn sm primary', type: 'button', style: 'margin-top:8px', onclick: (e) => setPw(e.currentTarget, { ...p, acc: null }, true) }, 'إنشاء الحساب بكلمة مرور') : null));
      });
    } catch (e) { pending.replaceChildren(); fail(e); }
  }
  loadPending();
}
