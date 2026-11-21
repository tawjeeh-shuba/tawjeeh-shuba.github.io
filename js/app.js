// التوجيه بين الصفحات، والحماية، والتنقل السفلي. الصفحات تُحمَّل عند الحاجة فقط (أسرع فتح).
import { S, loadSession, loadProfile, cachedProfile, refs, rpc, can, canAny, h, fail, toast, AuthError, clearSession, theme, safeMsg } from './core.js';
import { svg, icon } from './icons.js';
import { C, loadContexts, resetContexts, drawCtxBar } from './ctx.js';

// شبكة أمان: أي خطأ غير ملتقَط من زر أو طلب يظهر للمستخدم برسالة عربية بدل أن يضيع في سجل المتصفح
window.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  fail(e.reason instanceof Error ? e.reason : new Error(String(e.reason ?? '')));
});
window.addEventListener('error', () => toast('حدث خطأ غير متوقع، حاول مرة أخرى', 'bad'));

const PAGES = {
  'دخول': { mod: './login.js', title: 'تسجيل الدخول', public: true },
  'كلمة-المرور': { mod: './password.js', title: 'تغيير كلمة المرور' },
  '': { mod: './home.js', title: 'الرئيسية' },
  'الحلقات': { mod: './halaqat.js', title: 'الحلقات' },
  'المعلمون': { mod: './teachers.js', title: 'المعلمون' },
  'المعلم': { mod: './teacher.js', title: 'ملف المعلم' },
  'زيارة': { mod: './visit.js', title: 'زيارة جديدة' },
  'الإسناد': { mod: './assign.js', title: 'إسناد الحلقات' },
  'الفترات': { mod: './periods.js', title: 'إدارة الفترات' },
  'لوحة-التحكم': { mod: './admin.js', title: 'لوحة التحكم' },
  'المزيد': { mod: './more.js', title: 'المزيد' },
  'التصدير': { mod: './export.js', title: 'التصدير' },
};
const NAV = [
  { r: '', t: 'الرئيسية', i: 'home' },
  { r: 'الحلقات', t: 'الحلقات', i: 'book' },
  { r: 'المعلمون', t: 'المعلمون', i: 'users' },
  { r: 'الإسناد', t: 'الإسناد', i: 'swap', show: () => canAny('self_assign', 'request_halaqa', 'assign_supervisor', 'decide_requests') },
  { r: 'المزيد', t: 'المزيد', i: 'more' },
];

const $ = (id) => document.getElementById(id);
let navToken = 0;

function parse() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [name, qs] = raw.split('?');
  return { name: name || '', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export const go = (route, q) => { location.hash = '#/' + route + (q ? '?' + new URLSearchParams(q) : ''); };

function chrome(on, page, name) {
  $('top').hidden = !on; $('nav').hidden = !on; if (!on) $('ctx').hidden = true;
  document.body.classList.toggle('nonav', !on);
  document.body.classList.toggle('on-home', on && name === '');
  document.body.classList.toggle('on-panel', on && name === 'لوحة-التحكم');
  drawNote();
  if (!on) return;
  $('title').textContent = page.title;
  $('who').textContent = S.profile?.full_name || '';
  const main = ['', 'الحلقات', 'المعلمون', 'الإسناد', 'المزيد'].includes(name);
  $('back').hidden = main;
  // مبدّل السياق: في الرئيسية والحلقات وقائمة المعلمين (هي ما يتغير بالسياق)
  const ctxEl = $('ctx');
  if (name === '' || name === 'المعلمون' || name === 'الحلقات') drawCtxBar(ctxEl); else ctxEl.hidden = true;
  const items = NAV.filter((n) => !n.show || n.show());
  const PARENT = { 'المعلم': 'المعلمون', 'زيارة': '' };
  const cur = name in PARENT ? PARENT[name] : main ? name : 'المزيد';
  $('nav').replaceChildren(...items.map((n) => h('a', { href: '#/' + n.r, 'aria-current': n.r === cur ? 'page' : null },
    icon(n.i, 24), h('span', null, n.t))));
}

let first = true;
// قياس الأداء الدائم (بلا بيانات شخصية): أول فتح للموقع من بداية التحميل، وكل صفحة من لحظة طلبها
function measure(page, t0) {
  if (page.public) return;
  const ms = Math.round(performance.now() - (first ? 0 : t0));
  const kind = first ? 'فتح الموقع' : 'صفحة'; const cold = first && !sessionStorage.getItem('tawjeeh.warm');
  const name = first ? (cold ? 'فتح الموقع (أول مرة)' : 'فتح الموقع') : page.title;
  first = false; try { sessionStorage.setItem('tawjeeh.warm', '1'); } catch { /* */ }
  rpc('rpc_perf_log', { p_page: name.slice(0, 40), p_kind: kind, p_ms: ms, p_cold: cold }).catch(() => {});
  idle(() => ['./teacher.js', './teachers.js', './wa.js', './exams_logic.js'].forEach((x) => import(x).catch(() => {})));
}
const idle = (f) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 1500));
// التحقق في الخلفية بعد الفتح من المحفوظ: الملف الشخصي والسياقات من القاعدة؛ إن تغيّرا تُعاد الصفحة الحالية
function revalidate(cached) {
  loadProfile().then(async (p) => {
    if (!p) throw new AuthError();
    const before = JSON.stringify(C.list);
    await loadContexts(true);
    if (JSON.stringify(p) !== cached || JSON.stringify(C.list) !== before) route();
  }).catch((e) => { if (e instanceof AuthError) { clearSession(); location.replace('#/دخول'); } });
}

async function route() {
  const t0 = performance.now();
  const token = ++navToken;
  const { name, query } = parse();
  const page = PAGES[name];
  const view = $('view');
  if (!page) { location.replace('#/'); return; }
  loadSession();
  if (!page.public && !S.session) { location.replace('#/دخول'); return; }
  if (page.public && S.session && name === 'دخول') { location.replace('#/'); return; }
  if (!page.public && !S.profile) {
    const cached = cachedProfile();
    if (cached) {
      // فتح فوري: من المحفوظ في الجهاز، ثم تحقق في الخلفية (إن تغيّر شيء يُعاد رسم الصفحة)
      try { resetContexts(true); await Promise.all([refs(), loadContexts()]); } catch { /* يُصحَّح بالتحقق */ }
      revalidate(cached);
    } else {
      try {
        await loadProfile();
        if (!S.profile) throw new AuthError();
        resetContexts();
        await Promise.all([refs(), loadContexts()]);
      } catch (e) { clearSession(); if (e instanceof AuthError || !S.profile) { location.replace('#/دخول'); return; } fail(e); return; }
    }
  }
  if (token !== navToken) return;
  if (S.profile?.must_change_password && name !== 'كلمة-المرور') { location.replace('#/كلمة-المرور'); return; }
  chrome(!page.public && !(name === 'كلمة-المرور' && S.profile?.must_change_password), page, name);
  view.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
  window.scrollTo(0, 0);
  try {
    const m = await import(page.mod);
    if (token !== navToken) return;
    const root = h('div');
    const wait = h('p', { class: 'loading', role: 'status' }, 'جارٍ التحميل…');
    view.replaceChildren(root, wait);
    await m.render(root, { query, go, alive: () => token === navToken });
    wait.remove();
    if (token === navToken) view.focus({ preventScroll: true });
    measure(page, t0);
  } catch (e) {
    if (token !== navToken) return;
    if (e instanceof AuthError) { clearSession(); location.replace('#/دخول'); return; }
    view.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'err' }, safeMsg(e, 'تعذّر تحميل الصفحة')),
      h('button', { class: 'btn primary block', onclick: route }, 'إعادة المحاولة')));
  }
}

// إشعار «الفلتر مفعّل» أُزيل (المرحلة 9ب): خيار «إخفاء الحلقات غير محددة القطاع» يبقى يعمل كما هو من صفحة «المزيد»، بلا شريط أصفر.
function drawNote() { $('fnote').hidden = true; }
document.addEventListener('ctxchange', () => route());
// زر الوضع الليلي في الشريط العلوي
function drawTheme() {
  const dark = theme.get() === 'dark';
  $('theme').innerHTML = svg(dark ? 'sun' : 'moon', 22);
  $('theme').setAttribute('aria-label', dark ? 'الوضع النهاري' : 'الوضع الليلي');
  $('theme').setAttribute('title', dark ? 'الوضع النهاري' : 'الوضع الليلي');
}
$('theme').addEventListener('click', () => theme.toggle());
document.addEventListener('themechange', drawTheme);
drawTheme();
$('back').addEventListener('click', () => history.length > 1 ? history.back() : go(''));
window.addEventListener('hashchange', route);
route();
