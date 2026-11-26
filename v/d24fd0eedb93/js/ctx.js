// مبدّل السياق (المرحلة 9): الدور + الفترة (+ القسم) من التكليفات السارية في القاعدة (rpc_my_contexts).
// الاختيار الافتراضي: حسب الوقت إن كانت أوقات الفترات مُدخلة في الإعدادات، وإلا آخر اختيار للمستخدم (محفوظ في جهازه).
import { S, h, rpc, sheet, icon, depName, grpName } from './core.js';

export const C = { data: null, list: [], cur: null };
const skey = () => 'tawjeeh.ctx.' + (S.profile?.person_id || '');
const ROLE_ORDER = ['supervisor', 'dept_head', 'mentor', 'supervisor_assistant', 'division_assistant', 'division_head'];

document.addEventListener('sessioncleared', () => resetContexts());
export function resetContexts(keepStored = false) { C.data = null; C.list = []; C.cur = null; if (!keepStored) try { localStorage.removeItem('tawjeeh.ctxd'); } catch { /* */ } }
const riyadhNow = () => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch { return null; } };

// المرحلة 10ب (السرعة): السياقات محفوظة في الجهاز (يوم واحد)، و«الوقت الآن» يُحسب محلياً بتوقيت الرياض؛ fresh = تجاهل المحفوظ
export async function loadContexts(fresh = false) {
  if (C.data && !fresh) return C;
  let d = null;
  if (!fresh) try { d = JSON.parse(localStorage.getItem('tawjeeh.ctxd') || 'null'); } catch { /* */ }
  if (!d || d.pid !== S.profile.person_id || !d.at || Date.now() - d.at > 864e5) {
    try { d = (await rpc('rpc_my_contexts')) || {}; } catch { d = {}; }
    d.pid = S.profile.person_id; d.at = Date.now();
    try { localStorage.setItem('tawjeeh.ctxd', JSON.stringify(d)); } catch { /* */ }
  } else { d.now = riyadhNow() || d.now; }
  C.data = d; C.list = build(d); C.cur = pickDefault();
  return C;
}

const pname = (code) => (C.data?.periods || []).find((p) => p.code === code)?.name || 'بلا فترة';

// سياق لكل (دور، فترة). الموجه: فتراته من حلقاته المسندة إليه (أو فترة تكليفه)، وأقسامه في كل فترة من حلقاته.
function build(d) {
  const out = new Map();
  const allPeriods = (d.periods || []).map((p) => p.code);
  const add = (role, roleName, period, deps, group, global) => {
    const key = role + '|' + (period || '*');
    const c = out.get(key) || { key, role, roleName, period, deps: new Set(), groups: new Set(), all: false };
    if (global || (!deps.length && !group && role !== 'supervisor')) c.all = true;
    deps.forEach((x) => x && c.deps.add(x)); if (group) c.groups.add(group);
    out.set(key, c);
  };
  for (const a of d.assignments || []) {
    if (a.role === 'supervisor') {
      const sup = (d.supervised || []).filter((s) => !a.period || s.period === a.period);
      const pers = a.period ? [a.period] : [...new Set(sup.map((s) => s.period))];
      if (!pers.length) add('supervisor', a.role_name, a.period || null, a.department ? [a.department] : [], null, false);
      pers.forEach((p) => add('supervisor', a.role_name, p, sup.filter((s) => s.period === p).map((s) => s.department), null, false));
    } else if (a.global) {
      add(a.role, a.role_name, null, [], null, true);
    } else {
      (a.period ? [a.period] : [null]).forEach((p) => add(a.role, a.role_name, p, a.department ? [a.department] : [], a.group, false));
    }
  }
  const order = (c) => ROLE_ORDER.indexOf(c.role) * 100 + (c.period ? allPeriods.indexOf(c.period) : -1);
  return [...out.values()].map((c) => ({ ...c, deps: [...c.deps], groups: [...c.groups], periodName: c.period ? pname(c.period) : 'كل الفترات' }))
    .sort((x, y) => order(x) - order(y));
}

// الفترة الحالية حسب الوقت (إن كانت الأوقات مُدخلة)
function periodNow() {
  const now = C.data?.now; if (!now) return null;
  const p = (C.data.periods || []).find((x) => x.starts_at && x.ends_at && (x.starts_at <= x.ends_at
    ? now >= x.starts_at.slice(0, 5) && now < x.ends_at.slice(0, 5)
    : now >= x.starts_at.slice(0, 5) || now < x.ends_at.slice(0, 5)));
  return p?.code || null;
}
function pickDefault() {
  if (!C.list.length) return null;
  let saved = null; try { saved = localStorage.getItem(skey()); } catch { /* */ }
  const savedC = C.list.find((c) => c.key === saved);
  const pn = periodNow();
  if (pn) {
    const byTime = C.list.filter((c) => c.period === pn);
    if (byTime.length) return byTime.find((c) => savedC && c.role === savedC.role) || byTime[0];
  }
  return savedC || C.list[0];
}
export function setContext(key) {
  const c = C.list.find((x) => x.key === key); if (!c) return;
  C.cur = c;
  try { localStorage.setItem(skey(), key); } catch { /* */ }
  document.dispatchEvent(new CustomEvent('ctxchange'));
}
export const isSupCtx = () => C.cur?.role === 'supervisor';
export const ctxLabel = (c = C.cur) => c ? `${c.roleName} • ${c.periodName}${c.deps.length === 1 && !c.all ? ' • ' + depName(c.deps[0]) : c.groups.length === 1 && !c.deps.length ? ' • ' + grpName(c.groups[0]) : ''}` : '';

// الشريط تحت العنوان: يظهر متى كان للمستخدم أكثر من سياق
export function drawCtxBar(el) {
  if (!C.cur || C.list.length < 2) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren(h('button', { type: 'button', class: 'ctx-btn', 'aria-haspopup': 'dialog', 'aria-label': `السياق الحالي: ${ctxLabel()}. اضغط للتغيير`, onclick: openPicker },
    icon('layers', 18), h('span', { class: 'grow ellip' }, h('span', { class: 'k' }, 'أعمل الآن بصفتي: '), h('b', null, ctxLabel())), h('span', { class: 'chg' }, 'تغيير')));
}
function openPicker() {
  const roles = [...new Set(C.list.map((c) => c.role))];
  const body = h('div', null, h('p', { class: 'muted small' }, 'لا تظهر لك إلا معلومات الدور والفترة المختارين. يُحفظ اختيارك في هذا الجهاز.'),
    roles.map((r) => {
      const items = C.list.filter((c) => c.role === r);
      return h('div', { class: 'ctx-group' }, h('h3', null, items[0].roleName),
        h('div', { class: 'ctx-opts' }, items.map((c) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(c.key === C.cur?.key),
          onclick: () => { close(); setContext(c.key); } }, c.periodName + (c.role === 'supervisor' && c.deps.length > 1 ? ` (${c.deps.length} أقسام)` : '')))));
    }));
  const close = sheet({ title: 'اختر الدور والفترة', body, actions: [{ label: 'إغلاق' }] });
}
