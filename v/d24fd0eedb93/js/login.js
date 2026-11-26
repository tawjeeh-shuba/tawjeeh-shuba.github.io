// صفحة الدخول: «رقم الجوال أو رقمك في النظام» ثم «رمز الدخول». لا بحث بالأسماء ولا يظهر أي اسم قبل الدخول.
import { S, h, fn, setSession, loadProfile, refs, field, clearSession, theme, safeMsg } from './core.js';
import { svg } from './icons.js';

export async function render(root, ctx) {
  clearSession();
  const id = h('input', { type: 'text', inputmode: 'text', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false',
    maxlength: '40', dir: 'ltr', enterkeyhint: 'next', 'aria-label': 'رقم الجوال أو رقمك في النظام' });
  const pw = h('input', { type: 'password', autocomplete: 'current-password', maxlength: '200', 'aria-label': 'رمز الدخول', enterkeyhint: 'go' });
  const show = h('button', { class: 'btn sm', type: 'button', onclick: () => {
    pw.type = pw.type === 'password' ? 'text' : 'password'; show.textContent = pw.type === 'password' ? 'إظهار' : 'إخفاء';
  } }, 'إظهار');
  const msg = h('div', { class: 'err', hidden: true, role: 'alert' });
  const enter = h('button', { class: 'btn primary block', type: 'button' }, 'دخول');
  const err = (t) => { msg.textContent = t; msg.hidden = !t; };

  async function submit() {
    if (!id.value.trim()) { err('اكتب رقم الجوال أو رقمك في النظام'); id.focus(); return; }
    if (!pw.value) { err('اكتب رمز الدخول'); pw.focus(); return; }
    enter.disabled = true; enter.textContent = 'جارٍ الدخول…'; err('');
    try {
      const r = await fn('login', { identifier: id.value.trim(), password: pw.value }, false);
      setSession(r);
      S.profile = null;
      await loadProfile();
      await refs();
      location.hash = r.must_change_password ? '#/كلمة-المرور' : '#/';
    } catch (e) {
      // رسالة واحدة لكل حالات الفشل (يرسلها الخادم)، وأي خطأ شبكة يظهر كما هو
      // تنبيه ثابت بلا كشف حالة الحساب: الخادم يقفل الحساب 15 دقيقة بعد 5 محاولات خاطئة متتالية
      const m = safeMsg(e); err(/بيانات الدخول غير صحيحة/.test(m) ? m + ' — تنبيه: بعد 5 محاولات خاطئة متتالية يتوقف الدخول لهذا الحساب 15 دقيقة. لفك القفل قبلها راجع مسؤول الشعبة.' : m); pw.value = ''; pw.focus();
    } finally { enter.disabled = false; enter.textContent = 'دخول'; }
  }
  enter.addEventListener('click', submit);
  id.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pw.focus(); } });
  pw.addEventListener('keydown', (e) => e.key === 'Enter' && submit());

  const fab = h('button', { class: 'theme-fab', type: 'button', 'aria-label': 'تبديل الوضع الليلي', html: svg(theme.get() === 'dark' ? 'sun' : 'moon', 22) });
  fab.addEventListener('click', () => { theme.toggle(); fab.innerHTML = svg(theme.get() === 'dark' ? 'sun' : 'moon', 22); });
  root.append(h('div', { class: 'login' }, fab,
    h('div', { class: 'top' }, h('div', { class: 'mark', html: svg('book', 52) }), h('h1', null, 'شعبة التوجيه'), h('p', null, 'حلقات القرآن الكريم بالمسجد النبوي')),
    h('div', { class: 'box' }, h('div', { class: 'in' },
      msg,
      field('رقم الجوال أو رقمك في النظام', id),
      h('label', { class: 'field' }, h('span', null, 'رمز الدخول'), h('div', { class: 'pwrow' }, pw, show)),
      enter,
      h('p', { class: 'muted small', style: 'text-align:center;margin:16px 0 0' }, 'لا تعرف رمز الدخول، أو نسيته؟ راجع مسؤول الشعبة.')))));
  id.focus();
}
