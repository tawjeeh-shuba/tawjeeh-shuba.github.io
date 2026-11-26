// جولة تعريف قصيرة (أمر «الموقع السهل» 2026-11-25، القسم 2): 4–6 خطوات تشير إلى الأزرار المهمة، مع «تخطٍّ» و«التالي»، وتُعاد من زر.
// خفيفة بلا مكتبة: طبقة شفافة وإطار حول العنصر وفقاعة شرح. «رأيتها» تُحفظ في المتصفح فقط (تفضيل شخصي).
import { h } from './core.js';

export const tourSeen = (id) => { try { return localStorage.getItem('tawjeeh.tour.' + id) === '1'; } catch { return true; } };
const markSeen = (id) => { try { localStorage.setItem('tawjeeh.tour.' + id, '1'); } catch { /* */ } };

// steps: [{ sel, title, text }] — الخطوة التي لا يوجد عنصرها تُتخطى
export function startTour(id, steps) {
  const list = steps.filter((s) => document.querySelector(s.sel));
  if (!list.length) return;
  let i = 0;
  const ring = h('div', { class: 'tour-ring', 'aria-hidden': 'true' });
  const title = h('b'); const text = h('p', { class: 'small', style: 'margin:6px 0 10px' }); const count = h('span', { class: 'muted xs' });
  const prev = h('button', { type: 'button', class: 'btn sm ghost' }, 'السابق');
  const next = h('button', { type: 'button', class: 'btn sm primary' }, 'التالي');
  const skip = h('button', { type: 'button', class: 'btn sm ghost' }, 'تخطٍّ');
  const tip = h('div', { class: 'tour-tip', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'جولة تعريف' }, title, text,
    h('div', { class: 'row between nowrap' }, count, h('span', { class: 'row', style: 'gap:6px;flex-wrap:nowrap' }, skip, prev, next)));
  const ov = h('div', { class: 'tour-ov' }, ring, tip);
  const end = () => { markSeen(id); ov.remove(); window.removeEventListener('resize', place); window.removeEventListener('hashchange', end); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') end(); };
  function place() {
    const s = list[i]; const el = document.querySelector(s.sel);
    if (!el) { end(); return; }
    el.scrollIntoView({ block: 'center', behavior: 'instant' in el ? 'instant' : 'auto' });
    const r = el.getBoundingClientRect(); const pad = 6;
    Object.assign(ring.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    title.textContent = s.title; text.textContent = s.text; count.textContent = `${i + 1} من ${list.length}`;
    prev.hidden = i === 0; next.textContent = i === list.length - 1 ? 'انتهيت' : 'التالي';
    const below = r.bottom + 12; const vh = window.innerHeight;
    tip.style.top = ''; tip.style.bottom = '';
    // qa-e2e (2026-11-25): عنصر أطول من الشاشة (بطاقة «أكمل الجاهزية» ببنود كثيرة) كان يدفع الفقاعة خارج الشاشة فلا يظهر «التالي» ولا «تخطٍّ»؛ تبقى الفقاعة داخلها دائماً
    if (below + 170 < vh) tip.style.top = `${below}px`; else tip.style.bottom = `${Math.min(Math.max(12, vh - r.top + 12), vh - 190)}px`;
    next.focus({ preventScroll: true });
  }
  prev.addEventListener('click', () => { if (i > 0) { i--; place(); } });
  next.addEventListener('click', () => { if (i < list.length - 1) { i++; place(); } else end(); });
  skip.addEventListener('click', end);
  window.addEventListener('resize', place);
  window.addEventListener('hashchange', end);   // المراجع المستقل: لا تبقى الطبقة فوق صفحة أخرى
  document.addEventListener('keydown', key);
  document.body.append(ov);
  requestAnimationFrame(place);
}
