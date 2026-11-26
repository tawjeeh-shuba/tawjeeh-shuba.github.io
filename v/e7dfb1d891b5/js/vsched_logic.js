// منطق «الخطة التلقائية» لخطط زيارات الموجهين (أمر صاحب النظام 2026-11-26، الخطوة 3) — منطق خالص بلا متصفح (تختبره scripts/vsched_logic_tests.mjs).
// القواعد من مسودة visit-scheduling-expert (design/المرحلة12/10_قواعد_خطط_الزيارات.md — مسودة تنتظر الاعتماد):
//   الترتيب: من موعد متابعة خطته العلاجية مستحق في الدورة (الأقرب أولاً) ← من لم يُزر قط ← الأقدم زيارة ← كسر تعادل ثابت.
//   السعة لكل (يوم، فترة) = الأقل بين «أقصى زيارات في الفترة» ووقت الفترة ÷ مدة الزيارة. لا يتجاوزها الاقتراح أبداً (والقاعدة ترفض الحفظ إن تجاوزها).
//   التوزيع العادل: كل معلم مرة واحدة في الدورة، في أقل الأيام ازدحاماً (والمتابعة في أقرب يوم من موعدها). الموجه يبدّل ويضيف ويحذف قبل الرفع.
export const SRC_AUTO = 'تلقائية';
export const SRC_MANUAL = 'يدوية';

// بصمة ثابتة صغيرة (لا عشوائية: الاقتراح نفسه لنفس المدخلات)
export function stableHash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

export function capacity(period, cfg, windows) {
  const mins = Number(windows?.[period]?.minutes) || 60;
  return Math.max(0, Math.min(Number(cfg.max_per_period) || 2, Math.floor(mins / (Number(cfg.visit_minutes) || 30))));
}

// ترتيب الأولوية
export function rank(teachers, cycleEnd) {
  const due = (t) => (t.followup_due && t.followup_due <= cycleEnd ? t.followup_due : null);
  return [...teachers].sort((a, b) => {
    const da = due(a), db = due(b);
    if (da && db) return da < db ? -1 : da > db ? 1 : stableHash(a.teacher + a.halaqa) - stableHash(b.teacher + b.halaqa);
    if (da || db) return da ? -1 : 1;
    if (!a.last_visit !== !b.last_visit) return a.last_visit ? 1 : -1;
    if (a.last_visit && b.last_visit && a.last_visit !== b.last_visit) return a.last_visit < b.last_visit ? -1 : 1;
    return stableHash(a.teacher + a.halaqa) - stableHash(b.teacher + b.halaqa);
  });
}

// يقترح جدولاً: يُبقي الزيارات الموجودة (اليدوية وغيرها) ويضيف المقترحة حتى السعة. يعيد { items, unplaced: [{teacher, name, reason}] }
export function suggest({ teachers, workdays, cfg, windows, today, cycleEnd, existing = [], limit = Infinity }) {
  const days = (workdays || []).filter((d) => d >= today).sort();
  const items = existing.map((x) => ({ ...x }));
  const load = new Map(); const dayLoad = new Map(); const taken = new Set(items.map((x) => x.teacher + '|' + x.halaqa));
  const key = (d, p) => d + '|' + (p || '-');
  for (const x of items) { load.set(key(x.date, x.period), (load.get(key(x.date, x.period)) || 0) + 1); dayLoad.set(x.date, (dayLoad.get(x.date) || 0) + 1); }
  const unplaced = []; let added = 0;
  for (const t of rank(teachers, cycleEnd)) {
    if (taken.has(t.teacher + '|' + t.halaqa)) continue;
    if (added >= limit) break;
    const cap = capacity(t.period, cfg, windows);
    const sameDay = (d) => items.some((x) => x.teacher === t.teacher && x.date === d);
    let opts = days.filter((d) => (load.get(key(d, t.period)) || 0) < cap && !sameDay(d));
    if (!opts.length) { unplaced.push({ teacher: t.teacher, name: t.name, halaqa: t.halaqa, reason: cap === 0 ? 'وقت الفترة أقصر من مدة الزيارة' : 'امتلأت فترته في كل أيام الدورة' }); continue; }
    let pick;
    if (t.followup_due && t.followup_due <= cycleEnd) {
      const from = t.followup_due < today ? today : t.followup_due;
      pick = opts.find((d) => d >= from) || opts[opts.length - 1];
    } else {
      pick = opts.reduce((best, d) => ((dayLoad.get(d) || 0) < (dayLoad.get(best) || 0) ? d : best), opts[0]);
    }
    items.push({ id: null, teacher: t.teacher, teacher_name: t.name, halaqa: t.halaqa, period: t.period, date: pick, source: SRC_AUTO });
    load.set(key(pick, t.period), (load.get(key(pick, t.period)) || 0) + 1); dayLoad.set(pick, (dayLoad.get(pick) || 0) + 1);
    taken.add(t.teacher + '|' + t.halaqa); added++;
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.period).localeCompare(String(b.period))));
  return { items, unplaced };
}

// أخطاء القيود (نفس فحص القاعدة): يعيد قائمة رسائل
export function violations(items, { cfg, windows, workdays }) {
  const out = []; const c = new Map(); const seen = new Set();
  for (const x of items) {
    if (workdays && !workdays.includes(x.date)) out.push(`${x.teacher_name || 'معلم'}: التاريخ ${x.date} خارج أيام العمل في الدورة`);
    const k = x.date + '|' + x.period; c.set(k, (c.get(k) || 0) + 1);
    const td = x.teacher + '|' + x.date; if (seen.has(td)) out.push(`${x.teacher_name || 'معلم'} مكرر في يوم ${x.date}`); seen.add(td);
  }
  for (const [k, n] of c) { const [d, p] = k.split('|'); const cap = capacity(p, cfg, windows); if (n > cap) out.push(`تجاوز حد الفترة في ${d}: ${n} زيارات والحد ${cap}`); }
  return out;
}

// تبديل معلم بآخر في زيارة مقترحة: نفس اليوم إن سمحت سعة فترة البديل، وإلا رسالة
export function swap(items, index, t, { cfg, windows }) {
  const cur = items[index]; if (!cur) return { ok: false, reason: 'الزيارة غير موجودة' };
  if (items.some((x, i) => i !== index && x.teacher === t.teacher && x.halaqa === t.halaqa)) return { ok: false, reason: 'المعلم البديل في الخطة من قبل' };
  const next = items.map((x, i) => (i === index ? { ...x, teacher: t.teacher, teacher_name: t.name, halaqa: t.halaqa, period: t.period, id: x.id, source: x.source } : x));
  const v = violations(next, { cfg, windows });
  return v.length ? { ok: false, reason: v[0] } : { ok: true, items: next };
}
