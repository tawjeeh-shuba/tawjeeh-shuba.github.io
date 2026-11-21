// ملخص الزيارة بواتساب (المرحلة 9، وأشمل في 9ب): النص يُبنى في القاعدة من قالب الإعدادات (والدرجة لا تظهر إلا بإعداد).
// لا إرسال تلقائي: رابط wa.me يفتح واتساب، والمرسل يضغط «إرسال» بنفسه. ويُسجَّل في «السجل» أنه فُتح للإرسال.
// المرحلة 9ب: الورقة نفسها لرسالة «تم الاطلاع» من مسؤول القسم (نص وتسجيل مختلفان).
import { h, rpc, sheet, toast, icon, safeMsg } from './core.js';

const KINDS = {
  summary: { text: 'rpc_visit_whatsapp', log: 'rpc_log_whatsapp', title: 'ملخص الزيارة بواتساب', logged: 'سُجّل في «السجل» أن الملخص فُتح للإرسال' },
  ack: { text: 'rpc_visit_ack_message', log: 'rpc_log_ack_message', title: 'رسالة الاطلاع للمعلم', logged: 'سُجّل في «السجل» أن الرسالة فُتحت للإرسال' },
};

export async function whatsappSheet(visitId, onLogged, kind = 'summary') {
  const K = KINDS[kind] || KINDS.summary;
  const d = await rpc(K.text, { p_visit: visitId });
  const url = `https://wa.me/${d.phone || ''}?text=${encodeURIComponent(d.text)}`;
  let logged = false;
  const link = h('a', { class: 'btn primary block', href: url, target: '_blank', rel: 'noopener', onclick: () => {
    if (logged) return; logged = true;
    rpc(K.log, { p_visit: visitId, p_with_phone: !!d.phone })
      .then(() => { toast(K.logged, 'ok'); onLogged?.(); })
      .catch(() => { logged = false; toast('فُتح واتساب، وتعذّر تسجيل ذلك في السجل', 'bad'); });
  } }, icon('chat', 20), 'فتح واتساب');
  const copy = h('button', { class: 'btn block', type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(d.text); toast('نُسخ النص', 'ok'); } catch { toast('تعذّر النسخ', 'bad'); }
  } }, 'نسخ النص');
  sheet({ title: K.title, body: h('div', null,
    h('div', { class: d.phone ? 'hint' : 'note' }, d.phone ? 'سيفتح واتساب على رقم المعلم، وتضغط «إرسال» بنفسك.' : 'رقم المعلم غير متاح لك، فيفتح واتساب لتختار المستلم بنفسك.'),
    h('div', { class: 'wa-preview', dir: 'rtl' }, d.text),
    h('div', { class: 'stack', style: 'margin-top:12px' }, link, copy)), actions: [{ label: 'إغلاق' }] });
}

// «ملخص الزيارات» من ملف المعلم (المرحلة 9ج): يختار المرسل الزيارات (كلها، أو آخر عدد، أو فترة)، فيُبنى النص في القاعدة
// من قالب الإعدادات: شكرٌ بالاسم على كل بند تحسّن، وما تراجع يُذكر بلطف تحت «نرجو العناية». بلا درجات إلا بالإعداد.
// المرحلة 10ب: extraThanks اختياري يعيد أسطر شكر تحسن الاختبارات (من خطط علاج تحققت) فتُضاف قبل الخاتمة
export function visitsSummarySheet(teacherId, onLogged, extraThanks) {
  const mode = h('select', { 'aria-label': 'أي الزيارات' },
    h('option', { value: 'all' }, 'كل الزيارات'), h('option', { value: 'last' }, 'آخر عدد من الزيارات'), h('option', { value: 'range' }, 'فترة زمنية: من تاريخ إلى تاريخ'));
  const n = h('input', { type: 'number', inputmode: 'numeric', min: 1, value: 5, 'aria-label': 'عدد الزيارات' });
  const from = h('input', { type: 'date', 'aria-label': 'من تاريخ' }), to = h('input', { type: 'date', 'aria-label': 'إلى تاريخ', value: new Date().toISOString().slice(0, 10) });
  const fN = h('label', { class: 'field' }, h('span', null, 'عدد الزيارات (الأحدث)'), n);
  const fR = h('div', { class: 'filters' }, h('label', { class: 'field' }, h('span', null, 'من تاريخ'), from), h('label', { class: 'field' }, h('span', null, 'إلى تاريخ'), to));
  const out = h('div');
  const sync = () => { fN.hidden = mode.value !== 'last'; fR.hidden = mode.value !== 'range'; out.replaceChildren(); };
  mode.addEventListener('change', sync); [n, from, to].forEach((x) => x.addEventListener('input', () => out.replaceChildren()));
  const pick = () => ({ mode: mode.value, ...(mode.value === 'last' ? { n: Number(n.value) || null } : {}), ...(mode.value === 'range' ? { from: from.value, to: to.value } : {}) });
  async function preview(btn) {
    const p = pick();
    if (p.mode === 'last' && !(p.n >= 1)) { toast('اكتب عدد الزيارات', 'bad'); return; }
    if (p.mode === 'range' && (!p.from || !p.to)) { toast('حدد التاريخين: من وإلى', 'bad'); return; }
    btn.disabled = true;
    try {
      const d = await rpc('rpc_visits_summary', { p_teacher: teacherId, p });
      const extra = (extraThanks?.() || []).filter(Boolean);
      if (extra.length) { const parts = d.text.split('\n\n'); parts.splice(Math.max(1, parts.length - 1), 0, extra.join('\n')); d.text = parts.join('\n\n'); }
      let logged = false;
      const url = `https://wa.me/${d.phone || ''}?text=${encodeURIComponent(d.text)}`;
      const link = h('a', { class: 'btn primary block', href: url, target: '_blank', rel: 'noopener', onclick: () => {
        if (logged) return; logged = true;
        rpc('rpc_log_visits_summary', { p_teacher: teacherId, p, p_with_phone: !!d.phone })
          .then(() => { toast('سُجّل في «السجل» أن ملخص الزيارات فُتح للإرسال', 'ok'); onLogged?.(); })
          .catch(() => { logged = false; toast('فُتح واتساب، وتعذّر تسجيل ذلك في السجل', 'bad'); });
      } }, icon('chat', 20), 'فتح واتساب');
      const copy = h('button', { class: 'btn block', type: 'button', onclick: async () => {
        try { await navigator.clipboard.writeText(d.text); toast('نُسخ النص', 'ok'); } catch { toast('تعذّر النسخ', 'bad'); }
      } }, 'نسخ النص');
      out.replaceChildren(...[
        h('div', { class: 'row', style: 'gap:6px;margin:10px 0 6px' }, h('span', { class: 'badge info' }, `${d.count} زيارة`),
          h('span', { class: 'badge ok' }, `تحسّن ${d.improved || 0} بنداً`), h('span', { class: 'badge warn' }, `للعناية ${d.declined || 0}`)),
        d.capped ? h('div', { class: 'note' }, `في اختيارك ${d.capped} زيارة، فأُخذت الأحدث (${d.count}) حسب «أقصى عدد زيارات في ملخص الزيارات» في الإعدادات.`) : null,
        d.count < 2 ? h('div', { class: 'note' }, 'المقارنة (الشكر و«نرجو العناية») تحتاج زيارتين على الأقل.') : null,
        h('div', { class: d.phone ? 'hint' : 'note' }, d.phone ? 'سيفتح واتساب على رقم المعلم، وتضغط «إرسال» بنفسك.' : 'رقم المعلم غير متاح لك، فيفتح واتساب لتختار المستلم بنفسك.'),
        h('div', { class: 'wa-preview', dir: 'rtl' }, d.text),
        h('p', { class: 'muted xs' }, 'القالب وسطر الشكر وسطر «نرجو العناية» تُعدَّل من لوحة التحكم ← الزيارات ← إعدادات الزيارات ← ملخص واتساب.'),
        h('div', { class: 'stack', style: 'margin-top:12px' }, link, copy)].filter(Boolean));
    } catch (e) { out.replaceChildren(); throw e; } finally { btn.disabled = false; }
  }
  const go = h('button', { class: 'btn soft block', type: 'button', onclick: (e) => preview(e.currentTarget).catch((er) => toast(safeMsg(er), 'bad')) }, 'عرض الملخص');
  sync();
  sheet({ title: 'إرسال ملخص الزيارات', body: h('div', null,
    h('p', { class: 'muted small' }, 'يقارن بين الزيارات المختارة: يشكر المعلم بالاسم على كل بند تحسّن، ويذكر بلطف ما تراجع ضمن «نرجو العناية»، بتقديرات لفظية بلا درجات.'),
    h('label', { class: 'field' }, h('span', null, 'الزيارات'), mode), fN, fR, go, out), actions: [{ label: 'إغلاق' }] });
}
