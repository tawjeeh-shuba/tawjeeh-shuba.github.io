// مكونات قوائم المعلمين المشتركة (المرحلة 9): بطاقة المعلم بشاراتها، وزر «زيارة جديدة»، وحفظ الفلاتر في الجهاز.
import { S, h, badge, icon, initial, depName, perName, sheet } from './core.js';

export const pct = (x) => (x == null ? '—' : `${Math.round(Number(x) * 100)}٪`);
export function ago(days) {
  if (days == null) return '';
  const d = Number(days);
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  if (d === 2) return 'منذ يومين';
  if (d <= 10) return `منذ ${d} أيام`;
  return `منذ ${d} يوماً`;
}

// شارات المعلم: لم يُزر / آخر زيارة منذ / أداء منخفض
export function teacherBadges(r, settings) {
  const out = [];
  if (!r.visits) out.push(badge('لم يُزر', 'bad'));
  else out.push(badge(`آخر زيارة ${ago(r.days)}`, r.stale ? 'warn' : 'gray'));
  if (r.low) out.push(badge(`أداء منخفض • ${pct(r.avg)}`, 'bad'));
  else if (r.avg != null) out.push(badge(`متوسط آخر ${r.used}: ${pct(r.avg)}`, 'info'));
  return out;
}

// زر «زيارة جديدة»: إن كان للمعلم أكثر من حلقة لي في السياق يختار الموجه الحلقة
export function visitButton(r, halaqat, go) {
  const mine = halaqat.filter((x) => x.mine);
  if (!mine.length) return null;
  const open = (num) => go('زيارة', { معلم: r.id, حلقة: num });
  return h('button', { class: 'btn sm primary', type: 'button', 'aria-label': `زيارة جديدة لـ ${r.name}`, onclick: (e) => {
    e.stopPropagation();
    if (mine.length === 1) return open(mine[0].number);
    const close = sheet({ title: 'اختر الحلقة', body: h('div', { class: 'stack' }, mine.map((x) => h('button', { class: 'pick', type: 'button', onclick: () => { close(); open(x.number); } },
      h('b', null, `حلقة ${x.number}`), h('span', { class: 'muted small' }, ` ${perName(x.period)} • ${depName(x.department)}`)))), actions: [{ label: 'تراجع' }] });
  } }, icon('plus', 18), 'زيارة جديدة');
}

export function teacherCard(r, { go, period, visit = false, showSup = false } = {}) {
  const hs = (r.halaqat || []).filter((x) => !period || x.period === period);
  const open = () => go('المعلم', { id: r.id });
  return h('div', { class: 'card tap tcard', role: 'link', tabindex: '0', 'aria-label': `ملف ${r.name}`, onclick: open, onkeydown: (e) => { if (e.key === 'Enter') open(); } },
    h('div', { class: 'row nowrap', style: 'align-items:flex-start;gap:12px' },
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, initial(r.name)),
      h('div', { class: 'grow' },
        h('div', { class: 'row between nowrap', style: 'align-items:flex-start' }, h('b', { class: 'grow' }, r.name), badge(String(r.code), 'gray')),
        h('div', { class: 'hchips' }, (r.halaqat || []).map((x) => h('span', { class: x.type === 'بديل' ? 'alt' : (period && x.period !== period ? 'dim' : null) },
          `حلقة ${x.number}${x.type === 'بديل' ? ' (بديل)' : ''} • ${perName(x.period) || 'بلا فترة'}${showSup && x.supervisor ? ' • ' + x.supervisor : ''}`))),
        h('div', { class: 'tbadges' }, teacherBadges(r)))),
    visit ? h('div', { class: 'tactions' }, visitButton(r, hs.length ? hs : r.halaqat || [], go)) : null);
}

// حفظ آخر فلاتر اختارها المستخدم (لكل صفحة وسياق) في هذا الجهاز
export const prefs = {
  key: (page, ctxKey) => `tawjeeh.f.${S.profile?.person_id}.${page}.${ctxKey || '-'}`,
  get(page, ctxKey) { try { return JSON.parse(localStorage.getItem(prefs.key(page, ctxKey)) || '{}'); } catch { return {}; } },
  set(page, ctxKey, v) { try { localStorage.setItem(prefs.key(page, ctxKey), JSON.stringify(v)); } catch { /* */ } },
};

export const SORTS = [
  { value: 'weakest', label: 'الأضعف أداءً' },
  { value: 'oldest', label: 'الأقدم زيارة' },
  { value: 'never', label: 'من لم يُزر أولاً' },
  { value: 'name', label: 'الاسم' },
];
