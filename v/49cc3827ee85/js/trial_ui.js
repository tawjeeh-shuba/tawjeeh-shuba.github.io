// «الزيارة التجريبية» لمسؤول الشعبة (أمر «الموقع السهل» 2026-11-25): الشريط الظاهر وورقة «حُفظت» فقط.
// الحفظ في جدول تجريبي منفصل (rpc_trial_visit_save): لا يراه غير مسؤول الشعبة (RLS)، ولا يدخل أي عدد أو تقرير أو تصدير أو ترحيل.
import { h, badge, sheet, nf, icon, fail } from './core.js';
import { pct } from './tlist.js';   // نفس عرض «المجموع» في ملف المعلم (الكسر × 100)

export const trialBanner = () => h('div', { class: 'trial-banner', role: 'status' },
  h('b', null, 'زيارة تجريبية — لا تُحسب'),
  h('span', null, 'لا يراها غيرك، ولا تدخل أي عدد أو تقرير أو تصدير أو ملف معلم.'));

// بعد الحفظ: تصنيف الزيارة كما سيراه الموجه، ثم العودة إلى «زياراتي التجريبية»
export function trialDone(r, ctx) {
  // المرحلة 11: «جرّب خطة علاجية» من الزيارة التجريبية نفسها (rplan.js يُحمَّل عند الضغط فقط)
  const tryPlan = h('button', { type: 'button', class: 'btn gold block', style: 'margin-top:10px', onclick: async () => {
    const m = await import('./rplan.js'); close(); m.planSheet({ trial: true, trialVisit: r.id }).catch(fail);
  } }, icon('clipboard', 20), 'جرّب خطة علاجية');
  const close = sheet({ title: 'حُفظت الزيارة التجريبية', body: h('div', null,
    h('div', { class: 'row', style: 'gap:6px' }, r.classification ? badge(r.classification, 'ok') : null,
      r.pct != null ? badge(`المجموع ${pct(r.pct)}`, 'gray') : null,
      badge(`تجريبية اليوم: ${nf(r.today?.done ?? 1)}`, 'gray')),
    h('p', { class: 'muted small', style: 'margin-top:10px' }, 'لم يتغير أي رقم حقيقي. تجدها في «زياراتي التجريبية»، ويمكنك أرشفتها كلها بزر واحد.'), tryPlan),
  actions: [{ label: 'زياراتي التجريبية', kind: 'primary' }],
  onClose: () => { if (/^#\/زيارة\?/.test(decodeURIComponent(location.hash))) ctx.go('زيارة-تجريبية'); } });
}
