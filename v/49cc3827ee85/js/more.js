// «المزيد»: بقية الصفحات حسب الصلاحية + الوضع الليلي + كلمة المرور + الخروج
import { S, h, can, canAny, roleNames, clearSession, confirmBox, icon, initial, theme, hideFilter, nf } from './core.js';
import { planAccess } from './plans_api.js';

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

  // «الموقع السهل» (2026-11-25): لمسؤول الشعبة أولاً «ابدأ من هنا» و«زيارة تجريبية» (خلف مفتاحيهما كما في لوحة التحكم)
  const head = !!S.profile?.is_division_head;
  const pages = [
    head && S.profile?.ops?.setup ? item('#/ابدأ', 'check', 'ابدأ من هنا', 'جرّب زيارة، وأكمل الجاهزية، وزر يوم البدء', 'gold') : null,
    head && S.profile?.ops?.trial ? item('#/زيارة-تجريبية', 'clipboard', 'زيارة تجريبية', 'زيارة كاملة لا تُحسب ولا يراها غيرك') : null,
    // المرحلة 12 (ب): خطط زيارات الموجهين (خلف مفتاحها feature.vsched)
    S.profile?.ops?.vsched ? item('#/خطط-الزيارات', 'cal', 'خطط الزيارات', S.profile?.ops?.vsched_head ? 'اعتماد خطط الموجهين ومتابعة المتأخر' : 'خطتي للدورة وقائمة اليوم', 'gold') : null,
    canAny('change_period', 'manage_assignments') ? item('#/الفترات', 'clock', 'إدارة الفترات', 'تفصيل فترة الظهر، تغيير فترة حلقة، وفترات الموجهين') : null,
    canAny('resolve_confirmations', 'manage_permissions', 'set_passwords', 'manage_assignments', 'manage_persons', 'manage_halaqat', 'view_audit') || (S.profile.panel || []).length
      ? item('#/لوحة-التحكم', 'shield', 'لوحة التحكم', 'الإعدادات وتشغيل الميزات، والأشخاص والحسابات، والحلقات، والسجل') : null,
    // صفحة التصدير لكل مستخدم: كلٌّ يصدّر ما يحق له رؤيته فقط (الفحص في القاعدة)
    item('#/التصدير', 'layers', 'التصدير', 'تنزيل البيانات والتقارير ملفات إكسل'),
    // الاستعداد التشغيلي: صفحة المساعدة حين يكون مفتاحها مشغّلاً
    // ولمسؤول الشعبة معاينةً قبل تشغيلها لغيره (الصفحة نص ثابت)
    S.profile?.ops?.help || head ? item('#/مساعدة', 'info', 'المساعدة', S.profile?.ops?.help ? 'خطوات قصيرة لما تحتاجه في دورك، وطريقة البلاغ' : 'معاينة لك: خطوات كل دور. لا يراها غيرك حتى يوم البدء') : null,
  ].filter(Boolean);

  // المرحلة 11: «اليوم» و«الخطة الشهرية» و«للمراجعة والاعتماد» تظهر فقط حين تكون الخطط مشغّلة لهذا المستخدم
  const plansMenu = h('nav', { class: 'menu', 'aria-label': 'الخطط', hidden: true });
  planAccess().then((A) => {
    if (!A.on || !(A.owner || A.review || A.approve || A.browse)) return;
    plansMenu.append(...[
      A.owner ? item('#/اليوم', 'clock', 'زيارات اليوم', 'زيارات خطتك لهذا اليوم والمتأخرة') : null,
      A.owner ? item('#/الخطة', 'cal', 'الخطة الشهرية', 'إعداد خطتك وإرسالها ومتابعة اعتمادها') : null,
      A.review || A.approve ? item('#/الخطة', 'inbox', 'مراجعة الخطط واعتمادها', A.waiting ? `${nf(A.waiting)} خطة تنتظرك` : 'لا خطط تنتظرك الآن') : null,
      A.browse && !A.owner && !A.review && !A.approve ? item('#/الخطة', 'cal', 'خطط الموجهين', 'الاطلاع على خطط الموجهين في نطاقك') : null].filter(Boolean));
    plansMenu.hidden = !plansMenu.children.length;
  });

  root.append(
    h('div', { class: 'card row nowrap', style: 'gap:12px' },
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, initial(S.profile.full_name)),
      h('div', { class: 'grow' }, h('b', null, S.profile.full_name), h('div', { class: 'muted small' }, roleNames().join(' • ')))),
    plansMenu,
    pages.length ? h('nav', { class: 'menu', 'aria-label': 'صفحات الإدارة' }, pages) : null,
    hideBtns,
    h('div', { class: 'menu' }, themeBtn, item('#/كلمة-المرور', 'key', 'تغيير كلمة المرور')),
    h('div', { class: 'menu' }, h('button', { type: 'button', onclick: async () => {
      if (await confirmBox('هل تريد تسجيل الخروج؟', 'خروج', 'danger')) { clearSession(); location.hash = '#/دخول'; }
    } }, h('span', { class: 'ic bad' }, icon('logout', 22)), h('span', { class: 't danger' }, 'تسجيل الخروج'))));
}
