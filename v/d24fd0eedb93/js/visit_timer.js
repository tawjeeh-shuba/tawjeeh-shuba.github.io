// عدّاد مدة الزيارة (2026-11-25، طلب صاحب النظام): يعمل تلقائياً من وقت البدء المحفوظ في مسودة الزيارة (لا من ذاكرة الصفحة)،
// فيكمل صحيحاً بعد إغلاق الصفحة أو انطفاء شاشة الجوال ثم الرجوع. يتلوّن حسب المدة المسموحة لنوع الزيارة:
// رمادي قبل الحد الأدنى، وأخضر بين الحدين، وبرتقالي بعد الحد الأعلى، وتحته جملة قصيرة. يُستعمل في الزيارة العادية والمبسطة والتجريبية.
// النشر: أُعيد تشغيل سير النشر المعتاد بهذا الحفظ لأن GitHub Pages فقد نشر c4f1754 أثناء عطله المعلن (2026-11-25).
import { h, nf } from './core.js';

// «دقيقة» بالعدد الصحيح في العربية
export const arMinutes = (n) => (n === 1 ? 'دقيقة واحدة' : n === 2 ? 'دقيقتان' : n >= 3 && n <= 10 ? `${nf(n)} دقائق` : `${nf(n)} دقيقة`);
const pad = (x) => String(x).padStart(2, '0');
// الثواني منذ البدء (لا سالب: ساعة جهاز رجعت للوراء)
export const elapsedSec = (startedAt, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
// المدة بالدقائق التي تُحفظ: الدقائق الكاملة كما يراها الموجه في العدّاد، ولا تقل عن 1
export const elapsedMin = (startedAt, now = Date.now()) => Math.max(1, Math.floor(elapsedSec(startedAt, now) / 60));
export const clock = (sec) => { const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60; return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`; };

// الحالة والجملة حسب نوع الزيارة (منطق خالص قابل للاختبار)
export function timerState(sec, ty) {
  if (!ty || ty.min == null || ty.max == null) return { cls: '', line: 'اختر نوع الزيارة لتظهر المدة المسموحة' };
  const minS = ty.min * 60, maxS = ty.max * 60;
  if (sec < minS) return { cls: '', line: `بقي ${arMinutes(Math.ceil((minS - sec) / 60))} للحد الأدنى` };
  if (sec <= maxS) { const left = Math.floor((maxS - sec) / 60); return { cls: 'ok', line: left > 0 ? `ضمن المسموح • بقي ${arMinutes(left)} للحد الأعلى` : 'ضمن المسموح • بلغت الحد الأعلى' }; }
  return { cls: 'over', line: `تجاوزت الحد الأعلى (${arMinutes(ty.max)}) بـ${arMinutes(Math.ceil((sec - maxS) / 60))}` };
}

// العنصر: يُحدَّث كل ثانية، وفوراً عند الرجوع إلى الصفحة؛ ويتوقف وحده حين يُزال من الصفحة
// opts: { startedAt: () => iso, type: () => {name,min,max}, onTick?: (min) => void }
export function visitTimer(opts) {
  const big = h('b', { 'aria-hidden': 'true' });
  const line = h('small');
  const el = h('div', { class: 'vtimer', role: 'timer', 'aria-label': 'مدة الزيارة منذ البدء', 'data-vtimer': '' }, big, line);
  let iv = null;
  function update() {
    if (iv && !el.isConnected && el.dataset.mounted) { stop(); return; }
    if (el.isConnected) el.dataset.mounted = '1';
    const sec = elapsedSec(opts.startedAt());
    const st = timerState(sec, opts.type());
    big.textContent = clock(sec);
    line.textContent = st.line;
    el.className = `vtimer ${st.cls}`.trim();
    el.dataset.state = st.cls || 'wait';
    el.setAttribute('aria-label', `مدة الزيارة ${clock(sec)}. ${st.line}`);
    opts.onTick?.(Math.max(1, Math.floor(sec / 60)));
  }
  const onVis = () => { if (document.visibilityState === 'visible') update(); };
  function stop() { clearInterval(iv); iv = null; document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pageshow', update); }
  update();
  iv = setInterval(update, 1000);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pageshow', update);
  return { el, update, stop };
}
