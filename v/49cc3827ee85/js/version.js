// رقم الإصدار: كل نشر جديد يصل المستخدم فوراً.
// الصفحة المنشورة تحمل رقم إصدارها (وسم meta يضعه سكربت النشر)، والموقع يحمل الرقم الأحدث في version.txt.
// إن اختلفا: عند فتح الصفحة (قبل أن يكتب المستخدم شيئاً) تُحدَّث تلقائياً، وأثناء العمل يظهر شريط «حدّث الصفحة» فلا يضيع ما يكتبه.
// محلياً (بلا رقم إصدار) لا يفعل شيئاً.
const mine = document.querySelector('meta[name="tawjeeh-version"]')?.content || '';
const VALID = /^[0-9a-f]{7,40}$/;
const TRIED = 'tawjeeh.ver.tried';
let touched = false; let shown = false; let busy = false;
['keydown', 'input', 'pointerdown'].forEach((e) => addEventListener(e, () => { touched = true; }, { once: true, capture: true }));

async function latest() {
  const r = await fetch('version.txt', { cache: 'no-store' });
  if (!r.ok) return null;
  const v = (await r.text()).trim();
  return VALID.test(v) ? v : null;
}

// يُحفظ في localStorage لا sessionStorage (صفحة الدخول تمسح sessionStorage)، وتنتهي الحماية بعد 10 دقائق
const triedFor = () => { try { const j = JSON.parse(localStorage.getItem(TRIED) || 'null'); return j && Date.now() - j.at < 10 * 60000 ? j.v : null; } catch { return null; } };
async function reload(v) {
  try { localStorage.setItem(TRIED, JSON.stringify({ v, at: Date.now() })); } catch { /* */ }
  // تجديد الصفحة الرئيسية في ذاكرة المتصفح أولاً، ثم إعادة التحميل فتأتي بروابط الإصدار الجديد
  try { await fetch(location.pathname, { cache: 'reload' }); } catch { /* */ }
  location.reload();
}

function bar(v) {
  if (shown) return; shown = true;
  const b = document.createElement('div');
  b.className = 'verbar'; b.setAttribute('role', 'status');
  const t = document.createElement('span'); t.textContent = 'صدرت نسخة جديدة من الموقع.';
  const go = document.createElement('button'); go.type = 'button'; go.className = 'btn primary'; go.textContent = 'حدّث الصفحة';
  go.onclick = () => { go.disabled = true; reload(v); };
  b.append(t, go); document.body.append(b);
}

// force: ملف لم يُحمَّل (إصدار قديم أُزيل) ← التحديث مباشرة ما دام المستخدم لم يكتب شيئاً
export async function checkVersion({ startup = false, force = false } = {}) {
  if (!VALID.test(mine) || busy) return;
  busy = true;
  try {
    const v = await latest();
    if (!v || v === mine) { try { localStorage.removeItem(TRIED); } catch { /* */ } return; }
    const tried = triedFor();
    // حماية من التكرار: إن أُعيد التحميل لهذا الإصدار مرة ولم يصل بعد (ذاكرة الخادم الوسيط) ← الشريط بدل إعادة أخرى
    if ((startup || force) && !touched && tried !== v) return reload(v);
    bar(v);
  } catch { /* لا اتصال: يُعاد الفحص لاحقاً */ } finally { busy = false; }
}

if (VALID.test(mine)) {
  checkVersion({ startup: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
  setInterval(() => { if (document.visibilityState === 'visible') checkVersion(); }, 5 * 60000);
}
