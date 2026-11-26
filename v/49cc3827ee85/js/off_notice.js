// رسالة «مطفأ» الموحدة (أمر «الموقع السهل» 2026-11-25، القسم 3): لكل ميزة مطفأة تقول بالعربية البسيطة
// ما المطفأ، ولماذا، ومن يستطيع تشغيله. لمسؤول الشعبة زر «افتح الإعداد» يأخذه إلى ذلك الإعداد بالتحديد مظلّلاً؛ ولغيره «تواصل مع مسؤول الشعبة».
// النصوص من القاعدة (setting_guide عبر rpc_settings_guide)؛ وإن تعذّر جلبها يُعرض نص عام صحيح.
import { S, h, rpc, icon, isDivisionHead } from './core.js';

// السرعة (وكيل الأداء 2026-11-25): النص يُرسم فوراً (من المحفوظ في الجلسة أو النص العام)، ثم يُحدَّث إن وصل دليل أحدث
const cache = new Map();
const SK = (key) => 'tawjeeh.offg.' + key;
const stored = (key) => { try { return JSON.parse(sessionStorage.getItem(SK(key)) || 'null'); } catch { return null; } };
const guide = (key) => {
  if (!cache.has(key)) cache.set(key, rpc('rpc_settings_guide', { p_key: key })
    .then((g) => { try { sessionStorage.setItem(SK(key), JSON.stringify(g)); } catch { /* */ } return g; })
    .catch(() => { cache.delete(key); return null; }));
  return cache.get(key);
};
// رابط الإعداد نفسه في «الإعدادات العامة» (تفتحه الشاشة مظلّلاً)
export const settingLink = (key) => '#/لوحة-التحكم?' + new URLSearchParams({ تبويب: 'الإعدادات العامة', إعداد: key });

// opt.trial: في شاشة الزيارة يظهر لمسؤول الشعبة زر «جرّب زيارة تجريبية» (أو إعدادها إن كانت مطفأة)
export function offNotice(key, opt = {}) {
  const box = h('div', { class: 'off-notice', role: 'note', 'data-off': key });
  const draw = (g) => {
    const head = isDivisionHead();
    const label = g?.label || opt.label || '';
    const what = g?.off_what || opt.what || (label ? `الإعداد «${label}» مطفأ الآن.` : 'هذه الميزة مطفأة الآن.');
    const why = g?.off_why || opt.why || '';
    const who = g?.off_who || 'مسؤول الشعبة، من: لوحة التحكم ← الإعدادات العامة.';
    const tryBtn = head && opt.trial && key === 'feature.visits'
      ? (S.profile?.ops?.trial
        ? h('a', { class: 'btn sm primary', href: '#/زيارة-تجريبية' }, 'جرّب زيارة تجريبية الآن')
        : h('a', { class: 'btn sm primary', href: settingLink('feature.trial_visits_head') }, 'شغّل الزيارات التجريبية لك'))
      : null;
    box.replaceChildren(icon('info', 20), h('div', { class: 'grow' },
      h('b', null, what),
      why ? h('div', { class: 'small' }, h('span', { class: 'muted' }, 'لماذا؟ '), why) : null,
      h('div', { class: 'small' }, h('span', { class: 'muted' }, 'من يشغّله؟ '), who),
      head ? h('div', { class: 'btns', style: 'margin-top:8px' }, tryBtn, h('a', { class: `btn sm ${tryBtn ? 'ghost' : ''}`, href: settingLink(key) }, 'افتح الإعداد'))
        : h('div', { class: 'small', style: 'margin-top:6px;font-weight:700' }, 'تواصل مع مسؤول الشعبة.')));
  };
  const had = stored(key);
  draw(had);
  if (!had) guide(key).then((g) => { if (g) draw(g); });
  return box;
}
