// «المزيد»: بقية الصفحات حسب الصلاحية + الوضع الليلي + كلمة المرور + الخروج
import { S, h, can, canAny, roleNames, clearSession, confirmBox, icon, initial, theme, hideFilter } from './core.js';

export async function render(root) {
  const item = (href, ico, t, d, cls = '') => h('a', { href },
    h('span', { class: `ic ${cls}` }, icon(ico, 22)), h('span', { class: 't' }, t, d ? h('small', null, d) : null), icon('chev', 18, 'ico chev'));
  const themeBtn = h('button', { type: 'button', role: 'switch', 'aria-checked': String(theme.get() === 'dark') },
    h('span', { class: 'ic gold' }, icon('moon', 22)), h('span', { class: 't' }, 'الوضع الليلي', h('small', null, 'النهاري هو الأصل، ويُحفظ اختيارك في هذا الجهاز')),
    h('span', { class: 'toggle', 'aria-hidden': 'true' }));
  themeBtn.addEventListener('click', () => { theme.toggle(); themeBtn.setAttribute('aria-checked', String(theme.get() === 'dark')); });

  const sw = (key, title, desc) => {
    const b = h('button', { type: 'button', role: 'switch', 'aria-checked': String(hideFilter.get(key)) },
      h('span', { class: 'ic gold' }, icon('eye', 22)), h('span', { class: 't' }, title, h('small', null, desc)), h('span', { class: 'toggle', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => { hideFilter.set(key, !hideFilter.get(key)); b.setAttribute('aria-checked', String(hideFilter.get(key))); });
    return b;
  };
  const hideBtns = h('div', { class: 'menu' },
    sw('unspecified', 'إخفاء الحلقات غير محددة القطاع', 'للعرض فقط، ولا يغيّر شيئاً في القاعدة. يُحفظ في هذا الجهاز'));

  const pages = [
    canAny('change_period', 'manage_assignments') ? item('#/الفترات', 'clock', 'إدارة الفترات', 'تفصيل فترة الظهر، تغيير فترة حلقة، وفترات الموجهين') : null,
    canAny('resolve_confirmations', 'manage_permissions', 'set_passwords', 'manage_assignments', 'manage_persons', 'manage_halaqat', 'view_audit') || (S.profile.panel || []).length
      ? item('#/لوحة-التحكم', 'shield', 'لوحة التحكم', 'التقويم والفصول، الإعدادات، المستخدمون، السجل، والصلاحيات') : null,
    // صفحة التصدير لكل مستخدم: كلٌّ يصدّر ما يحق له رؤيته فقط (الفحص في القاعدة)
    item('#/التصدير', 'layers', 'التصدير', 'تنزيل البيانات والتقارير ملفات إكسل'),
  ].filter(Boolean);

  root.append(
    h('div', { class: 'card row nowrap', style: 'gap:12px' },
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, initial(S.profile.full_name)),
      h('div', { class: 'grow' }, h('b', null, S.profile.full_name), h('div', { class: 'muted small' }, roleNames().join(' • ')))),
    pages.length ? h('nav', { class: 'menu', 'aria-label': 'صفحات الإدارة' }, pages) : null,
    hideBtns,
    h('div', { class: 'menu' }, themeBtn, item('#/كلمة-المرور', 'key', 'تغيير كلمة المرور')),
    h('div', { class: 'menu' }, h('button', { type: 'button', onclick: async () => {
      if (await confirmBox('هل تريد تسجيل الخروج؟', 'خروج', 'danger')) { clearSession(); location.hash = '#/دخول'; }
    } }, h('span', { class: 'ic bad' }, icon('logout', 22)), h('span', { class: 't danger' }, 'تسجيل الخروج'))));
}
