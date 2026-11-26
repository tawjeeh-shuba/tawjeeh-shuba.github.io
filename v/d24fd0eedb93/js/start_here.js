// «ابدأ من هنا» (أمر «الموقع السهل» 2026-11-25، القسم 2) لمسؤول الشعبة: أول صفحة بعد الدخول، ويُرجع إليها من زر «ابدأ من هنا» أعلى الشاشة.
// ثلاث بطاقات كبيرة فقط: «جرّب زيارة الآن»، و«أكمل الجاهزية» (كم بقي وزر لكل بند)، و«يوم البدء» (ما سيحدث وزر واحد ومعه «إرجاع»).
// وجولة تعريف قصيرة اختيارية عند أول دخول، مع «تخطٍّ» وزر لإعادتها. الأرقام من دوال القاعدة القائمة (الحارس الحقيقي فيها).
import { S, h, rpc, badge, nf, isDivisionHead, icon, toast, fail } from './core.js';
import { dayStartCard } from './day_start.js';
import { startTour, tourSeen } from './tour.js';
import { offNotice } from './off_notice.js';

const TOUR = [
  { sel: '[data-tour=try]', title: 'جرّب زيارة الآن', text: 'من هنا تسجّل زيارة تجريبية كاملة (العادية أو المبسطة) لأي معلم. لا يراها غيرك ولا تُحسب في أي رقم.' },
  { sel: '[data-tour=ready]', title: 'أكمل الجاهزية', text: 'ما بقي عليك قبل التجربة، وبجانب كل بند زر يأخذك إليه مباشرة.' },
  { sel: '[data-tour=day]', title: 'يوم البدء', text: 'يوم بدء التجربة تضغط زراً واحداً فتُشغَّل كل ميزات المجرّبين، ومعه زر «إرجاع».' },
  { sel: '#starthere', title: 'ترجع إلى هنا دائماً', text: 'زر «ابدأ من هنا» أعلى الشاشة يعيدك إلى هذه الصفحة من أي مكان.' },
  { sel: '#nav a[href="#/المزيد"]', title: 'لوحة التحكم', text: 'من «المزيد» (آخر زر في الشريط السفلي) تصل إلى «لوحة التحكم» والإعدادات وكل الشاشات.' },
];
const iso = (t) => String(t ?? '').replace('(الإعدادات العامة ← تشغيل الميزات)', '(الإعدادات العامة ← «يوم البدء»)').replace(/(\d{4}-\d{2}-\d{2})/g, '⁦$1⁩');
const big = (tour, ico, title, ...kids) => h('section', { class: 'card sh-card', 'data-tour': tour }, h('div', { class: 'sh-head' }, h('span', { class: 'sh-ico' }, icon(ico, 26)), h('h2', null, title)), ...kids);

export async function render(root, ctx) {
  if (!isDivisionHead()) { ctx.go(''); return; }
  root.append(h('div', { class: 'row between', style: 'margin-bottom:8px' },
    h('p', { class: 'muted small', style: 'margin:0' }, 'ثلاث خطوات فقط. ابدأ بالأولى، ثم انزل إلى ما تحتها.'),
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => startTour('start', TOUR) }, 'أعد جولة التعريف')));

  // ---------- أ) جرّب زيارة الآن ----------
  const tryBody = h('div');
  root.append(big('try', 'clipboard', 'جرّب زيارة الآن', tryBody));
  if (!S.profile?.ops?.trial) tryBody.append(offNotice('feature.trial_visits_head'));
  else {
    const go = async (mode, btn) => {
      btn.disabled = true;
      try {
        const [t] = await rpc('rpc_trial_visit_targets', { p_q: null, p_limit: 1 });
        if (!t) { toast('لا توجد حلقة لها معلم ونموذج تقييم الآن', 'bad'); return; }
        location.hash = '#/زيارة?' + new URLSearchParams({ معلم: t.teacher_id, حلقة: t.halaqa, تجريبي: '1', وضع: mode });
      } catch (e) { fail(e); } finally { btn.disabled = false; }
    };
    const b1 = h('button', { type: 'button', class: 'btn primary block', onclick: () => go('مبسط', b1) }, 'ابدأ زيارة تجريبية (الوضع المبسط)');
    const b2 = h('button', { type: 'button', class: 'btn soft block', style: 'margin-top:8px', onclick: () => go('عادي', b2) }, 'ابدأ زيارة تجريبية (الوضع العادي)');
    tryBody.append(h('p', { class: 'small' }, 'زيارة كاملة كما سيسجّلها الموجه، ومعها خطة العلاج. عليها شريط «زيارة تجريبية — لا تُحسب»، ولا يراها غيرك. يُختار لك معلم وحلقة تلقائياً.'),
      h('p', { class: 'muted xs' }, 'المبسطة: خطوة خطوة على الجوال (3 خطوات وشريط تقدم). العادية: كل البنود في صفحة واحدة.'),
      b1, b2, h('a', { class: 'btn sm ghost', style: 'margin-top:8px', href: '#/زيارة-تجريبية' }, 'اختر معلماً آخر، أو اعرض زياراتي التجريبية'));
  }

  // ---------- ب) أكمل الجاهزية ----------
  const readyBody = h('div', null, h('p', { class: 'muted small' }, 'جارٍ التحميل…'));
  const readyBadge = h('span');
  root.append(big('ready', 'check', 'أكمل الجاهزية', readyBadge, readyBody));
  (async () => {
    const [R, O, D] = await Promise.all([rpc('rpc_trial_readiness').catch(() => null), rpc('rpc_ops_readiness').catch(() => null), rpc('rpc_trial_drafts').catch(() => null)]);
    const left = [];
    (R?.items || []).filter((x) => !x.ok).forEach((x) => left.push({ t: x.title, d: x.detail, link: x.link }));
    (O?.items || []).filter((x) => !x.ok).forEach((x) => left.push({ t: x.title, d: x.detail, link: x.link }));
    const drafts = (D || []).filter((x) => x.status === 'مسودة');
    if (drafts.length) left.push({ t: `مسودات تحتاج تأكيدك (${nf(drafts.length)})`, d: 'قيم مقترحة جاهزة: يكفي فيها زر «تأكيد». والفارغة مكتوب تحتها المطلوب بالضبط.', link: '#/لوحة-التحكم?' + new URLSearchParams({ تبويب: 'جاهزية التجربة', قسم: 'مسودات' }) });
    readyBadge.replaceChildren(badge(left.length ? `بقي ${nf(left.length)} ${left.length === 1 ? 'بند' : 'بنود'}` : 'اكتملت الجاهزية', left.length ? 'warn' : 'ok'));
    readyBody.replaceChildren(
      R?.date ? h('p', { class: 'muted small' }, iso(`تاريخ بدء التجربة: ${R.date}`)) : null,
      left.length ? h('div', null, left.map((x) => h('div', { class: 'list-item row between nowrap', style: 'gap:10px;align-items:flex-start' },
        h('div', { class: 'grow' }, h('b', null, x.t), x.d ? h('div', { class: 'muted xs' }, iso(x.d)) : null),
        x.link ? h('a', { class: 'btn sm primary', href: x.link }, 'اذهب إليه') : null)))
        : h('p', { class: 'small' }, 'لا بند ناقص. ✓'),
      h('a', { class: 'btn sm ghost', style: 'margin-top:8px', href: '#/لوحة-التحكم?' + new URLSearchParams({ تبويب: 'جاهزية التجربة' }) }, 'كل بنود الجاهزية'));
  })().catch(() => readyBody.replaceChildren(h('p', { class: 'err' }, 'تعذّر تحميل الجاهزية. حدّث الصفحة.')));

  // ---------- ج) يوم البدء ----------
  root.append(big('day', 'cal', 'يوم البدء',
    dayStartCard({ compact: true, onChange: () => ctx.go('ابدأ', { t: Date.now() }) })));

  // لا تُفتح الجولة فوق ورقة فتحها المستخدم (ملاحظة qa-e2e)
  if (!tourSeen('start')) setTimeout(() => { if (ctx.alive() && !document.querySelector('.sheet')) startTour('start', TOUR); }, 400);
}
