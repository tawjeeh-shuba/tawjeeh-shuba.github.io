// النواة: الاتصال، الجلسة، الصلاحيات، وأدوات الواجهة. بلا مكتبات خارجية (أسرع تحميل).
import { HIDE } from './queries.js';
import { icon } from './icons.js';
export { icon };
const CFG = window.TAWJEEH_CONFIG;
const SKEY = 'tawjeeh.session';
export const S = { session: null, profile: null, refs: null, showWomen: false };
// المرحلة 10: حارس واحد لكل الشاشات — إلحاق null أو undefined أو false بعنصر (append وأخواتها) يُتجاهل، فلا تظهر كلمة «null» للمستخدم أبداً
for (const P of [Element.prototype, DocumentFragment.prototype]) for (const m of ['append', 'prepend', 'replaceChildren', 'before', 'after']) {
  const o = P[m]; if (typeof o !== 'function') continue;
  P[m] = function (...k) { return o.apply(this, k.filter((x) => x != null && x !== false)); };
}

// ---------- الجلسة ----------
export function loadSession() {
  try { S.session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { S.session = null; }
  return S.session;
}
function saveSession(s) {
  S.session = s;
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* تخزين غير متاح */ }
}
export function setSession(tokens) {
  saveSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: tokens.expires_at });
}
export function clearSession() {
  S.session = null; S.profile = null; S.refs = null; S.showWomen = false;
  document.dispatchEvent(new CustomEvent('sessioncleared'));
  try { localStorage.removeItem(SKEY); localStorage.removeItem(PKEY); localStorage.removeItem('tawjeeh.refs'); localStorage.removeItem('tawjeeh.ctxd'); sessionStorage.clear();
    // مسودات «الزيارة المبسطة» على هذا الجهاز (جهاز مشترك: لا تبقى بعد الخروج)
    Object.keys(localStorage).filter((k) => k.startsWith('tawjeeh.vs.')).forEach((k) => localStorage.removeItem(k)); } catch { /* */ }
}
let refreshing = null;
async function refresh() {
  if (!S.session?.refresh_token) throw new AuthError();
  refreshing ||= (async () => {
    const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: S.session.refresh_token }),
    });
    if (!r.ok) throw new AuthError();
    const j = await r.json();
    setSession(j);
  })().finally(() => { refreshing = null; });
  return refreshing;
}
export class AuthError extends Error { constructor() { super('انتهت الجلسة، سجّل الدخول من جديد'); } }
async function fresh() {
  if (!S.session) throw new AuthError();
  if (S.session.expires_at && S.session.expires_at * 1000 - Date.now() < 60000) await refresh();
}

// ---------- رسائل الأخطاء بالعربية ----------
const CONSTRAINTS = {
  persons_sector_check: 'القطاع: رجال أو نساء فقط',
  persons_display_code_key: 'هذا الرقم الظاهر مستعمل مع شخص آخر',
  person_mobiles_mobile_check: 'الجوال أرقام فقط، من 6 إلى 15 خانة',
  halaqat_sector_check: 'القطاع: رجال أو نساء فقط',
  halaqat_number_check: 'رقم الحلقة أرقام فقط',
  halaqa_one_open_supervisor: 'الحلقة مسندة لموجه آخر الآن',
  halaqa_one_open_main_teacher: 'للحلقة معلم أساسي حالي',
  one_pending_request_per_person_halaqa: 'لك طلب معلق على هذه الحلقة',
};
export const toLatinDigits = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 1776);
export function arMsg(m) {
  m = String(m || '');
  for (const [k, v] of Object.entries(CONSTRAINTS)) if (m.includes(k)) return v;
  if (/JWT|expired|invalid token/i.test(m)) return 'انتهت الجلسة، سجّل الدخول من جديد';
  if (/duplicate key|already exists|unique/i.test(m)) return 'هذا الإدخال موجود مسبقاً أو مكرر';
  if (/violates check/i.test(m)) return 'إحدى القيم غير مقبولة، راجع الحقول (الرقم الظاهر، الجوال، القطاع)';
  if (/violates foreign/i.test(m)) return 'قيمة مرتبطة غير موجودة';
  if (/permission denied|row-level security/i.test(m)) return 'ليست لديك صلاحية لهذا العمل';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'تعذّر الاتصال بالشبكة، تحقق من الإنترنت وحاول مرة أخرى';
  if (/[؀-ۿ]/.test(m)) return offPlace(m.trim());
  return 'تعذّر تنفيذ العملية، حاول مرة أخرى';
}
// «الموقع السهل» (2026-11-25، القسم 3): رسائل القاعدة «… موقوف من الإعدادات العامة. يشغّله مسؤول الشعبة» تُعرض بالمكان بالضبط.
// عرض فقط: الشرط نفسه في القاعدة لا يتغير. ما فيه «لوحة التحكم» أصلاً يبقى كما هو.
function offPlace(m) {
  if (m.includes('لوحة التحكم')) return m;
  const x = m.match(/^(.+?)\s+(موقوفة?|مطفأة?)\s+من\s+«?الإعدادات(?: العامة)?»?\s*[.،]?\s*(?:يشغّ?ل(?:ه|ها)\s+مسؤول الشعبة\s*\.?)?$/);
  // إعدادات اعتماد الخطة مكانها شاشة «قواعد الخطة» لا «الإعدادات العامة»
  const at = /اعتماد/.test(x?.[1] || '') ? '«لوحة التحكم» ← «الزيارات» ← «قواعد الخطة»' : '«لوحة التحكم» ← «الإعدادات العامة»';
  if (x) { const f = x[2].endsWith('ة'); return `${x[1]} ${f ? 'مطفأة' : 'مطفأ'} الآن. ${f ? 'يشغّلها' : 'يشغّله'} مسؤول الشعبة من: ${at}.`; }
  return m.replace(/من\s+«?الإعدادات العامة»?(?:\s*←\s*«تشغيل الميزات»)?/g, 'من «لوحة التحكم» ← «الإعدادات العامة»');
}

// ---------- الطلبات ----------
async function call(path, { method = 'GET', body, prefer, head } = {}, retry = true) {
  await fresh();
  let res;
  try {
    res = await fetch(`${CFG.url}/rest/v1/${path}`, {
      method: head ? 'HEAD' : method,
      headers: {
        apikey: CFG.key, Authorization: `Bearer ${S.session.access_token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new Error(arMsg(e.message)); }
  if (res.status === 401 && retry) { await refresh(); return call(path, { method, body, prefer, head }, false); }
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(arMsg(e.message));
  }
  if (head) return res;
  return res.status === 204 ? null : res.json();
}
export const get = (path) => call(path);
export const rpc = (name, args) => call(`rpc/${name}`, { method: 'POST', body: args || {} });
export async function count(path) {
  const res = await call(path, { head: true, prefer: 'count=exact' });
  const m = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
  return m ? +m[1] : 0;
}
// دوال الخادم (الدخول وكلمات المرور)
export async function fn(name, body, auth = true) {
  if (auth) await fresh();
  let res;
  try {
    res = await fetch(`${CFG.url}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: CFG.key, 'Content-Type': 'application/json', ...(auth && S.session ? { Authorization: `Bearer ${S.session.access_token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) { throw new Error(arMsg(e.message)); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(arMsg(j.error || j.message)); err.data = j; err.status = res.status; throw err; }
  return j;
}

// ---------- الملف الشخصي والصلاحيات ----------
// المرحلة 10ب (السرعة): الملف الشخصي و«إظهار النسائي» في طلبين متوازيين (كانا متتاليين)، ويُحفظان في الجهاز لفتح فوري في المرة التالية
// (يُرسم الموقع من المحفوظ ثم يُتحقق في الخلفية؛ الصلاحيات الفعلية في القاعدة دائماً، فالمحفوظ للعرض فقط)
const PKEY = 'tawjeeh.profile';
const sub = () => { try { return JSON.parse(atob(String(S.session?.access_token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || null; } catch { return null; } };
export async function loadProfile() {
  const [p, w] = await Promise.all([rpc('my_profile'), rpc('rpc_women_shown').catch(() => false)]);
  S.profile = p; S.showWomen = w === true;
  try { localStorage.setItem(PKEY, JSON.stringify({ at: Date.now(), sub: sub(), p, w: S.showWomen })); } catch { /* */ }
  return p;
}
export function cachedProfile(maxDays = 7) {
  try {
    const c = JSON.parse(localStorage.getItem(PKEY) || 'null');
    if (c && c.p && c.sub && c.sub === sub() && Date.now() - c.at < maxDays * 864e5) { S.profile = c.p; S.showWomen = c.w === true; return JSON.stringify(c.p); }
  } catch { /* */ }
  return null;
}
// «إظهار الحلقات النسائية» (إعداد لوحة التحكم، مطفأ افتراضياً). القرار الفعلي في القاعدة (RLS)؛ هنا فقط لنعرف هل نعرض خيار «نساء» في القوائم.
// أي فشل ← نعدّه مطفأً (الأحوط).
export async function refreshShowWomen() {
  try { S.showWomen = (await rpc('rpc_women_shown')) === true; } catch { S.showWomen = false; }
  return S.showWomen;
}
export const can = (a) => !!S.profile?.actions?.includes(a);
export const canAll = (a) => !!S.profile?.global_actions?.includes(a);
export const canAny = (...a) => a.some(can);

// ---------- المراجع (المجموعات والأقسام والفترات) ----------
export async function refs() {
  if (S.refs) return S.refs;
  try {
    const c = JSON.parse(localStorage.getItem('tawjeeh.refs') || 'null');
    if (c && c.at && Date.now() - c.at < 864e5) { S.refs = c; return c; }
  } catch { /* */ }
  const [groups, departments, periods] = await Promise.all([
    get('groups?select=code,name,sort_order&order=sort_order'),
    get('departments?select=code,name,group_code,is_active,sort_order&order=sort_order'),
    get('periods?select=code,name,shift,is_active,is_temporary,sort_order&order=sort_order'),
  ]);
  S.refs = { groups, departments, periods, at: Date.now() };
  try { localStorage.setItem('tawjeeh.refs', JSON.stringify(S.refs)); } catch { /* */ }
  return S.refs;
}
const nameMap = (arr) => Object.fromEntries((arr || []).map((x) => [x.code, x.name]));
export const depName = (c) => (c && nameMap(S.refs?.departments)[c]) || '';
export const perName = (c) => (c && nameMap(S.refs?.periods)[c]) || '';
export const grpName = (c) => (c && nameMap(S.refs?.groups)[c]) || '';
// تحويل الرموز الإنجليزية في النصوص إلى أسماء عربية (لا تظهر كلمة إنجليزية في الواجهة)
export function ar(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\b(DEP-\d{3})\b/g, (m, c) => depName(c) || 'قسم')
    .replace(/\b(PER-\d{2})\b/g, (m, c) => perName(c) || 'فترة')
    .replace(/\b(GRP-\d{2})\b/g, (m, c) => grpName(c) || 'مجموعة')
    .replace(/\bSUP-(\d+)\b/g, 'الموجه رقم $1')
    .replace(/\bv(\d+(?:\.\d+)?)\b/gi, 'الإصدار $1')
    .replace(/\bT-?(\d+)\b/g, 'ت-$1')
    .replace(/(\d)xx\b/gi, '$1××');
}

export const arScope = (t) => String(t ?? '').replace(/\ball\b/g, 'الكل').replace(/\bassigned\b/g, 'ضمن التكليف').replace(/\bown\b/g, 'الخاص');
export const isDivisionHead = () => (S.profile?.assignments || []).some((a) => a.role === 'division_head');

// ---------- أدوات الواجهة ----------
export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'for') e.htmlFor = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'type') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
// المرحلة 10: رموز البيانات بلا حروف إنجليزية في العرض (القيم نفسها لا تتغير): DEP-001 ← ق-001، GRP-01 ← م-01، PER-04 ← ف-04، وغيرها يُخفى
export const arCode = (c) => { const s = String(c ?? '').replace(/^DEP-/, 'ق-').replace(/^GRP-/, 'م-').replace(/^PER-/, 'ف-'); return s && !/[A-Za-z]/.test(s) ? s : null; };
export const nf = (n) => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
export function hijri(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T12:00:00' : d) : d;
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt); }
  catch { return dt.toLocaleDateString('ar'); }
}
export const today = () => new Date().toISOString().slice(0, 10);
export const debounce = (f, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

export function toast(msg, kind = '') {
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6000 : 3200);
}
// المرحلة 10: لا رسالة إنجليزية للمستخدم أبداً (خطأ برمجي غير متوقع ← رسالة عربية عامة)
export const safeMsg = (e, dflt = 'تعذّر تنفيذ العملية، حاول مرة أخرى') => { const m = arMsg(e?.message ?? e); return m && /[\u0600-\u06FF]/.test(m) ? m : dflt; };
export function fail(e) {
  if (e instanceof AuthError) { clearSession(); location.hash = '#/دخول'; return; }
  toast(safeMsg(e), 'bad');
}
export async function busy(btn, f) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = 'جارٍ التنفيذ…';
  try { return await f(); } catch (e) { fail(e); } finally { btn.disabled = false; btn.textContent = old; }
}

// ورقة سفلية. تُرجع دالة الإغلاق. actions: [{label, kind, onClick(close, btn)}]
export function sheet({ title, body, actions = [], onClose }) {
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc); onClose?.(); };
  const esc = (e) => e.key === 'Escape' && close();
  const buttons = actions.map((a) => {
    const b = h('button', { class: `btn ${a.kind || ''}`, type: 'button' }, a.label);
    b.addEventListener('click', async () => {
      if (!a.onClick) return close();
      const old = b.textContent; b.disabled = true; b.textContent = 'جارٍ التنفيذ…';
      try { await a.onClick(close, b); } catch (e) { fail(e); } finally { if (b.isConnected) { b.disabled = false; b.textContent = old; } }
    });
    return b;
  });
  const sh = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || null },
    h('div', { class: 'grab', 'aria-hidden': 'true' }), title ? h('h2', null, title) : null, body, buttons.length ? h('div', { class: `actions ${buttons.length === 1 ? 'one' : ''}` }, buttons) : null);
  const ov = h('div', { class: 'overlay' }, sh);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(ov);
  return close;
}
export const confirmBox = (message, ok = 'تأكيد', kind = 'primary') => new Promise((res) => {
  let done = false;
  sheet({ title: 'تأكيد', body: h('p', null, message), onClose: () => { if (!done) res(false); },
    actions: [{ label: ok, kind, onClick: (close) => { done = true; res(true); close(); } }, { label: 'تراجع', onClick: (close) => close() }] });
});
// يطلب نصاً (سبب مثلاً). الحقل يمكن أن يكون select إن مُررت options
export function askForm({ title, intro, fields, ok = 'حفظ' }) {
  return new Promise((res) => {
    let done = false;
    const inputs = {};
    const body = h('div', null, intro ? h('p', { class: 'muted' }, intro) : null, fields.map((f) => {
      let el;
      if (f.options) el = h('select', null, f.options.map((o) => h('option', { value: o.value }, o.label)));
      else if (f.area) el = h('textarea', { placeholder: f.placeholder || '' });
      else el = h('input', { type: f.type || 'text', placeholder: f.placeholder || '', inputmode: f.inputmode, autocomplete: 'off' });
      if (f.value != null) el.value = f.value;
      inputs[f.name] = el;
      return h('label', { class: 'field' }, h('span', null, f.label), el, f.hint ? h('small', null, f.hint) : null);
    }));
    const err = h('div', { class: 'err', hidden: true });
    body.append(err);
    sheet({ title, body, onClose: () => { if (!done) res(null); },
      actions: [{ label: ok, kind: 'primary', onClick: (close, btn) => {
        const out = {};
        for (const f of fields) {
          const v = (inputs[f.name].value || '').trim();
          if (f.required && !v) { err.textContent = `«${f.label}» مطلوب`; err.hidden = false; return; }
          out[f.name] = v;
        }
        done = true; res(out); close();
      } }, { label: 'تراجع', onClick: (close) => close() }] });
    setTimeout(() => Object.values(inputs)[0]?.focus(), 80);
  });
}
export const chips = (items, current, onPick) => h('div', { class: 'chips', role: 'tablist' },
  items.map((it) => h('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': String(it.value === current), onclick: () => onPick(it.value) }, it.label)));
// المرحلة 9ج: قائمة منسدلة بدل أزرار الفلترة الأفقية التي تخرج عن الشاشة (نفس توقيع chips)
export function choice(items, current, onPick, label) {
  const s = h('select', { 'aria-label': label || null, onchange: () => onPick(s.value) }, items.map((it) => h('option', { value: it.value }, it.label)));
  s.value = current ?? ''; return s;
}
// المقطّع (أنماط الصفحة، كالقديم): نفس توقيع chips
export function seg(items, current, onPick, { grid = false } = {}) {
  const box = h('div', { class: grid ? 'seg grid' : 'seg', role: 'tablist' },
    items.map((it) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(it.value === current), onclick: () => onPick(it.value) }, it.icon ? icon(it.icon, grid ? 20 : 18) : null, h('span', null, it.label))));
  // التبويب المختار يظهر دائماً حتى لو كان آخر الشريط
  requestAnimationFrame(() => { const b = box.querySelector('[aria-selected="true"]'); if (b && box.scrollWidth > box.clientWidth) box.scrollLeft += b.getBoundingClientRect().left - box.getBoundingClientRect().left - 8; });
  return box;
}
// ---------- إخفاء الحلقات غير محددة القطاع (واجهة فقط؛ الاختيار محفوظ في هذا الجهاز، والافتراضي الإظهار) ----------
const HKEY = 'tawjeeh.hide';
try { const j = JSON.parse(localStorage.getItem(HKEY) || '{}'); HIDE.unspecified = j.unspecified === true; } catch { /* افتراضي: إظهار */ }
export const hideFilter = {
  get: (k) => HIDE[k],
  active: () => HIDE.unspecified,
  set(k, v) {
    HIDE[k] = !!v;
    try { localStorage.setItem(HKEY, JSON.stringify({ unspecified: HIDE.unspecified })); } catch { /* تخزين غير متاح */ }
    document.dispatchEvent(new CustomEvent('hidechange'));
  },
  text() { return HIDE.unspecified ? 'فلتر مفعّل: الحلقات غير محددة القطاع مخفية مع معلميها' : ''; },
};

// خيارات القطاع في النماذج: «نساء» لا يظهر إلا والإعداد «إظهار الحلقات النسائية» مشغَّل
export const sectorChoices = () => [{ value: 'رجال', label: 'رجال' }, ...(S.showWomen ? [{ value: 'نساء', label: 'نساء' }] : [])];
export const empty = (text) => h('p', { class: 'empty' }, text);

// ---------- الوضع النهاري/الليلي: النهاري هو الأصل، والاختيار يُحفظ في الجهاز ----------
export const theme = {
  get: () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
  set(t) {
    if (t === 'dark') document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('tawjeeh.theme', t === 'dark' ? 'dark' : 'light'); } catch { /* تخزين غير متاح */ }
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#122a23' : '#1f5a4c';
    document.dispatchEvent(new CustomEvent('themechange'));
  },
  toggle() { theme.set(theme.get() === 'dark' ? 'light' : 'dark'); },
};
export const initial = (name) => (String(name || '').trim().replace(/^(عبد\s?ال)/, 'ع')[0] || '؟');
export const optionList = (arr, all = 'الكل') => [h('option', { value: '' }, all), ...arr.map((x) => h('option', { value: x.code }, x.name))];
export function selectOf(arr, { all = 'الكل', value = '', onchange } = {}) {
  const s = h('select', { onchange: () => onchange?.(s.value) }, optionList(arr, all));
  s.value = value; return s;
}
export function field(label, el, hint) { return h('label', { class: 'field' }, h('span', null, label), el, hint ? h('small', null, hint) : null); }
export const badge = (t, kind = '') => h('span', { class: `badge ${kind}` }, t);

// الأقسام والفترات المتاحة لي (للتصفية والإسناد)
export function myScope() {
  const a = S.profile?.assignments || [];
  const global = a.some((x) => !x.department_code && !x.group_code);
  const deps = new Set(), grps = new Set();
  a.forEach((x) => { if (x.department_code) deps.add(x.department_code); if (x.group_code) grps.add(x.group_code); });
  return { global, deps, grps };
}
export function myDepartments() {
  const { global, deps, grps } = myScope();
  const all = S.refs?.departments || [];
  if (global) return all;
  return all.filter((d) => deps.has(d.code) || grps.has(d.group_code));
}
export const roleNames = () => [...new Set((S.profile?.assignments || []).map((x) => x.role_name))];
