// أدوات مشتركة لشاشات لوحة التحكم (المرحلة 6): صلاحية الشاشة، ونافذة «المعاينة ثم الحفظ بسبب».
// الفحص الحقيقي داخل القاعدة دائماً؛ هنا للعرض وإخفاء الأزرار فقط.
import { S, h, rpc, sheet, badge, hijri, toast } from './core.js';

export const panelMode = (code) => (S.profile?.panel || []).find((x) => x.code === code)?.mode || null;
export const canEdit = (code) => panelMode(code) === 'تعديل';
export const isHead = () => !!S.profile?.is_division_head;

const fmt = (v) => {
  if (v == null) return '—';
  if (v === true) return 'نعم';
  if (v === false) return 'لا';
  if (Array.isArray(v)) return v.join('، ');
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return hijri(v);
  return String(v);
};
export const show = fmt;
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const dayNames = (arr) => (arr || []).map((d) => DAYS[d] ?? d).join('، ');
export { DAYS };

// يعرض نتيجة المعاينة (أخطاء/تحذيرات/أسطر) ويطلب السبب، ثم ينفّذ save(reason). يرجع true إن حُفظ.
export async function previewThenSave({ screen, draft, title, lines, save, okLabel = 'احفظ' }) {
  const pv = draft ? await rpc('rpc_panel_preview', { p_screen: screen, p_draft: draft }) : { ok: true, errors: [], warnings: [] };
  return new Promise((res) => {
    let done = false;
    const reason = h('textarea', { placeholder: 'السبب (يظهر في سجل التغييرات)', rows: 2 });
    const err = h('div', { class: 'err', hidden: true });
    const body = h('div', null,
      h('h3', { style: 'font-size:1rem;margin:0 0 6px' }, 'المعاينة: ماذا سيتغير'),
      h('dl', { class: 'kv' }, (lines ? lines(pv) : []).filter(Boolean).flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
      (pv.errors || []).map((e) => h('p', { class: 'small', style: 'color:var(--bad);margin:4px 0' }, '✕ ', e)),
      (pv.warnings || []).map((w) => h('p', { class: 'small', style: 'color:var(--warn);margin:4px 0' }, '⚠ ', w)),
      pv.ok ? h('label', { class: 'field' }, h('span', null, 'السبب'), reason) : null, err);
    const actions = [{ label: 'تراجع', onClick: (close) => close() }];
    if (pv.ok) actions.unshift({ label: okLabel, kind: 'primary', onClick: async (close) => {
      const r = reason.value.trim();
      if (!r) { err.textContent = 'اكتب السبب'; err.hidden = false; return; }
      await save(r); done = true; toast('تم الحفظ، وسُجّل في سجل التغييرات', 'ok'); close(); res(true);
    } });
    sheet({ title, body, actions, onClose: () => { if (!done) res(false); } });
    setTimeout(() => reason.focus(), 80);
  });
}

export const modeBadge = (code) => {
  const m = panelMode(code);
  return m === 'تعديل' ? badge('تعديل', 'ok') : m ? badge('اطلاع فقط', 'gray') : null;
};
