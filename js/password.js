// تغيير كلمة المرور (إلزامي بعد أول دخول أو بعد تعيينها من المسؤول، واختياري في أي وقت)
import { S, h, fn, loadProfile, field, toast, fail, clearSession, safeMsg } from './core.js';
import { svg } from './icons.js';

export async function render(root, ctx) {
  const forced = !!S.profile?.must_change_password;
  const a = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'كلمة المرور الجديدة' });
  const b = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'تأكيد كلمة المرور' });
  const err = h('div', { class: 'err', hidden: true, role: 'alert' });
  const show = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => {
    const t = a.type === 'password' ? 'text' : 'password'; a.type = t; b.type = t; show.textContent = t === 'password' ? 'إظهار' : 'إخفاء';
  } }, 'إظهار');
  const save = h('button', { class: 'btn primary block', type: 'button' }, 'حفظ كلمة المرور');
  const showErr = (t) => { err.textContent = t; err.hidden = !t; };

  save.addEventListener('click', async () => {
    showErr('');
    if (a.value.length < 8) return showErr('كلمة المرور 8 خانات على الأقل');
    if (a.value !== b.value) return showErr('كلمتا المرور غير متطابقتين');
    save.disabled = true; save.textContent = 'جارٍ الحفظ…';
    try {
      await fn('change-password', { new_password: a.value });
      toast('تم تغيير كلمة المرور', 'ok');
      S.profile = null;
      try { await loadProfile(); } catch { /* قد تتطلب الجلسة دخولاً جديداً */ }
      if (!S.profile) { clearSession(); location.hash = '#/دخول'; return; }
      location.hash = '#/';
    } catch (e) { if (/الجلسة/.test(e.message)) return fail(e); showErr(safeMsg(e)); }
    finally { save.disabled = false; save.textContent = 'حفظ كلمة المرور'; }
  });

  const form = h('div', null,
    forced ? h('p', { class: 'note' }, 'هذه أول مرة تدخل فيها (أو أعاد المسؤول تعيين كلمة مرورك). لا يمكنك المتابعة قبل اختيار كلمة مرور جديدة.') : null,
    err,
    field('كلمة المرور الجديدة', a, '8 خانات على الأقل، ولا تكن كلمة سهلة ولا آخر 6 أرقام من جوالك.'),
    field('أعد كتابتها', b), h('div', { class: 'row', style: 'margin-bottom:12px' }, show), save,
    forced ? h('button', { class: 'btn block', style: 'margin-top:10px', type: 'button', onclick: () => { clearSession(); location.hash = '#/دخول'; } }, 'خروج') : null);
  if (forced) root.append(h('div', { class: 'login' },
    h('div', { class: 'top' }, h('div', { class: 'mark', html: svg('lock', 52) }), h('h1', null, 'كلمة مرور جديدة'), h('p', null, 'اختر كلمة مرور تحفظها ولا يعرفها غيرك')),
    h('div', { class: 'box' }, h('div', { class: 'in' }, form))));
  else root.append(h('div', { class: 'auth' }, h('div', { class: 'card' }, form)));
}
