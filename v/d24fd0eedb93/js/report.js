// «بلاغ مشكلة» للمجرّبين (الاستعداد التشغيلي، 2026-11-24): تُحمَّل عند الضغط على الزر فقط.
// يُحفظ مع البلاغ تلقائياً: الصفحة، ورقم إصدار الواجهة، ومقاس الشاشة، والمتصفح؛ والوقت والدور يحفظهما الخادم.
// صورة الشاشة اختيارية: يختارها المستخدم من جهازه، وتُصغَّر هنا (JPEG) قبل الإرسال حتى لا تتجاوز الحد.
import { S, h, rpc, sheet, toast, field } from './core.js';

const version = () => document.querySelector('meta[name="tawjeeh-version"]')?.content || 'محلي';

// تصغير الصورة حتى تقل عن الحد (ك.ب) بتقليل الأبعاد ثم الجودة
async function shrink(file, maxKb) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('تعذّرت قراءة الصورة')); i.src = url; });
    let w = img.naturalWidth, hgt = img.naturalHeight; const scale = Math.min(1, 1280 / Math.max(w, hgt)); w = Math.round(w * scale); hgt = Math.round(hgt * scale);
    const cv = document.createElement('canvas');
    for (let q = 0.8, k = 0; k < 8; k++) {
      cv.width = w; cv.height = hgt; cv.getContext('2d').drawImage(img, 0, 0, w, hgt);
      const data = cv.toDataURL('image/jpeg', q);
      if (data.length <= maxKb * 1350) return data;
      if (q > 0.5) q -= 0.15; else { w = Math.round(w * 0.75); hgt = Math.round(hgt * 0.75); }
    }
    throw new Error(`الصورة كبيرة جداً حتى بعد التصغير (الحد ${maxKb} ك.ب)`);
  } finally { URL.revokeObjectURL(url); }
}

export function open() {
  const maxKb = S.profile?.ops?.report_kb || 350;
  const desc = h('textarea', { rows: 5, maxlength: 2000, placeholder: 'ماذا كنت تفعل؟ وماذا حدث؟ وماذا توقعت أن يحدث؟', 'aria-label': 'وصف المشكلة' });
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'صورة الشاشة (اختياري)' });
  const prev = h('div'); let shot = null;
  file.addEventListener('change', async () => {
    prev.replaceChildren(); shot = null;
    const f = file.files?.[0]; if (!f) return;
    try { shot = await shrink(f, maxKb); prev.append(h('img', { class: 'shot-prev', src: shot, alt: 'معاينة صورة الشاشة' })); }
    catch (e) { file.value = ''; toast(e.message, 'bad'); }
  });
  const page = decodeURIComponent(location.hash || '#/');
  sheet({
    title: 'بلاغ مشكلة',
    body: h('div', null,
      h('p', { class: 'muted small' }, 'يصل البلاغ إلى مسؤول الشعبة ومعه اسم الصفحة والوقت ودورك ورقم إصدار الموقع تلقائياً.'),
      field('وصف المشكلة', desc),
      field('صورة الشاشة (اختياري)', file, 'خذ صورة للشاشة من جهازك ثم اخترها هنا'), prev,
      h('p', { class: 'muted xs' }, `الصفحة: ${page}`)),
    actions: [
      { label: 'إرسال البلاغ', kind: 'primary', onClick: async (close) => {
        if (desc.value.trim().length < 3) { toast('اكتب وصفاً قصيراً للمشكلة', 'bad'); desc.focus(); return; }
        await rpc('rpc_report_submit', { p: { description: desc.value.trim(), page, version: version(), ua: navigator.userAgent.slice(0, 300),
          screen: `${innerWidth}x${innerHeight}`, screenshot: shot } });
        close(); toast('وصل البلاغ، شكراً لك', 'ok');
      } },
      { label: 'إلغاء' }],
  });
  desc.focus();
}
