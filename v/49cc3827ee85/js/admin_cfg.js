// أدوات مشتركة لشاشات الإعداد بإصدارات (المرحلة 7: الشاشات 2–5 و9).
// القاعدة: الصفوف تُعدَّل في «مسودة» فقط، ثم تُنشر بتاريخ بدء (اليوم أو بعده) بمعاينة وسبب، فيُغلق الإصدار السابق تلقائياً.
// الفحص الحقيقي في القاعدة دائماً؛ هنا للعرض فقط.
import { h, get, rpc, sheet, field, badge, hijri, today, toast } from './core.js';
import { previewThenSave } from './panel_ui.js';

const E = encodeURIComponent;

// إصدارات نوع وموضوع: [{id, version_no, status, valid_from, valid_to, ...}]
export async function versions(kind, subject) {
  const s = subject == null ? 'subject_key=is.null' : `subject_key=eq.${E(subject)}`;
  return get(`config_versions?select=id,kind,subject_key,version_no,status,valid_from,valid_to,note,published_at,copied_from_id&kind=eq.${kind}&${s}&order=version_no.desc`);
}
// الساري اليوم، والمجدول، والمسودة
export function pick(vs) {
  const t = today();
  const live = vs.find((v) => v.status !== 'مسودة' && v.valid_from <= t && (!v.valid_to || v.valid_to >= t)) || null;
  const scheduled = vs.filter((v) => v.status !== 'مسودة' && v.valid_from > t);
  const draft = vs.find((v) => v.status === 'مسودة') || null;
  return { live, scheduled, draft };
}
export const vLabel = (v) => v ? `الإصدار ${v.version_no}` + (v.status === 'مسودة' ? ' (مسودة)' : ` من ${hijri(v.valid_from)}${v.valid_to ? ' إلى ' + hijri(v.valid_to) : ''}`) : '—';

// شريط الإصدار: الساري، والمجدول، والمسودة، وزرا «فتح مسودة» و«نشر»
export function versionBar({ kind, subject, screen, vs, edit, onChange, title }) {
  const { live, scheduled, draft } = pick(vs);
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', null, title || 'الإصدارات'), draft ? badge('توجد مسودة', 'warn') : null),
    h('div', { class: 'small' }, 'الساري اليوم: ', h('b', null, vLabel(live))),
    scheduled.map((v) => h('div', { class: 'small', style: 'color:var(--info)' }, 'مجدول: ', vLabel(v))),
    draft ? h('div', { class: 'small' }, 'المسودة: ', h('b', null, `الإصدار ${draft.version_no}`), ' — التعديل فيها لا يؤثر على شيء حتى تُنشر.') : null,
    h('details', { class: 'small', style: 'margin-top:4px' }, h('summary', null, `كل الإصدارات (${vs.length})`),
      vs.map((v) => h('div', { class: 'muted xs' }, vLabel(v), v.note ? ` — ${v.note}` : ''))),
    edit ? h('div', { class: 'btns', style: 'margin-top:8px' },
      !draft ? h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
        await rpc('rpc_config_draft', { p_kind: kind, p_subject: subject, p_reason: 'فتح مسودة جديدة' });
        toast('فُتحت مسودة منسوخة من الإصدار الساري', 'ok'); onChange();
      } }, 'فتح مسودة للتعديل') : null,
      draft ? h('button', { class: 'btn sm primary', type: 'button', onclick: () => publish(draft, screen, onChange) }, 'نشر المسودة') : null) : null);
}

// النشر: تاريخ البدء ← المعاينة ← السبب
export async function publish(draft, screen, onChange) {
  const date = h('input', { type: 'date', value: today(), min: today() });
  const from = await new Promise((res) => {
    let done = false;
    sheet({ title: `نشر الإصدار ${draft.version_no}`, body: h('div', null,
      h('p', { class: 'muted small' }, 'يبدأ الإصدار من التاريخ الذي تختاره (اليوم أو بعده)، ويُغلق الإصدار السابق تلقائياً قبله بيوم. الزيارات القديمة تبقى على إصدارها دائماً.'),
      field('يسري من', date)), onClose: () => { if (!done) res(null); },
      actions: [{ label: 'معاينة', kind: 'primary', onClick: (close) => { done = true; res(date.value || today()); close(); } }, { label: 'تراجع', onClick: (c) => c() }] });
  });
  if (!from) return;
  const ch = (pv) => Object.entries(pv.changes || {}).map(([k, v]) => [({ items_active: 'البنود النشطة', items_added: 'بنود جديدة', items_stopped: 'بنود موقوفة',
    items_changed: 'بنود تغيّرت', departments: 'أقسام تستعمل النموذج', forms: 'نماذج تستعمل السلّم', caps_changed: 'فترات تغيّر حدها اليومي', rules_changed: 'قواعد تغيّرت' })[k] || k, String(v)]);
  const ok = await previewThenSave({ screen, title: `نشر الإصدار ${draft.version_no}`, okLabel: 'انشر',
    draft: { op: 'publish', version_id: draft.id, valid_from: from },
    lines: (pv) => [['الساري الآن', pv.current_version_no ? `الإصدار ${pv.current_version_no}` : '—'], ['الجديد', `الإصدار ${pv.version_no}`], ['يسري من', hijri(pv.valid_from)], ...ch(pv)],
    save: (reason) => rpc('rpc_config_publish', { p_version: draft.id, p_valid_from: from, p_reason: reason }) });
  if (ok) onChange();
}

// نموذج تعديل عام: fields = [{name, label, type: text|area|number|bool|select|color, options:[{value,label}], value, hint, required}]
export function editSheet({ title, intro, fields, ok = 'حفظ' }) {
  return new Promise((res) => {
    let done = false;
    const els = {};
    const body = h('div', null, intro ? h('p', { class: 'muted small' }, intro) : null, fields.map((f) => {
      let el;
      if (f.type === 'bool') { el = h('select', null, f.nullable ? h('option', { value: '' }, f.nullLabel || 'حسب النموذج') : null, h('option', { value: 'true' }, 'نعم'), h('option', { value: 'false' }, 'لا')); el.value = f.value == null ? '' : String(f.value); }
      else if (f.type === 'select') { el = h('select', null, f.options.map((o) => h('option', { value: o.value ?? '' }, o.label))); el.value = f.value ?? ''; }
      else if (f.type === 'area') { el = h('textarea', { rows: 3 }); el.value = f.value ?? ''; }
      else if (f.type === 'number') { el = h('input', { type: 'number', inputmode: 'decimal', step: f.step || 'any', value: f.value ?? '' }); }
      else if (f.type === 'color') { el = h('input', { type: 'color', value: f.value || '#5b6a72' }); }
      else if (f.type === 'date') { el = h('input', { type: 'date', value: f.value || today(), min: today() }); }
      else { el = h('input', { type: 'text', value: f.value ?? '', autocomplete: 'off' }); }
      els[f.name] = el;
      return field(f.label, el, f.hint);
    }));
    const err = h('div', { class: 'err', hidden: true }); body.append(err);
    sheet({ title, body, onClose: () => { if (!done) res(null); }, actions: [{ label: ok, kind: 'primary', onClick: (close) => {
      const out = {};
      for (const f of fields) {
        const raw = els[f.name].value;
        if (f.required && !String(raw).trim()) { err.textContent = `«${f.label}» مطلوب`; err.hidden = false; return; }
        out[f.name] = f.type === 'bool' ? (raw === '' ? null : raw === 'true') : f.type === 'number' ? (raw === '' ? null : Number(raw)) : String(raw).trim() === '' ? null : String(raw).trim();
      }
      done = true; res(out); close();
    } }, { label: 'تراجع', onClick: (c) => c() }] });
  });
}

export const yes = (b) => (b ? 'نعم' : 'لا');
export const dot = (color) => h('span', { 'aria-hidden': 'true', style: `display:inline-block;width:10px;height:10px;border-radius:50%;background:${color || '#999'};margin-inline-end:6px` });
export const stopped = (row) => (row.is_active ? null : badge('موقوف', 'gray'));

// أزرار صف في مسودة: تعديل، إيقاف/إعادة تفعيل، تحريك للأعلى/للأسفل
export function rowButtons({ draftId, table, row, onEdit, onChange, ids }) {
  const move = async (dir) => {
    const i = ids.indexOf(row.id); const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const n = ids.slice(); [n[i], n[j]] = [n[j], n[i]];
    await rpc('rpc_config_reorder', { p_version: draftId, p_table: table, p_ids: n }); onChange();
  };
  return h('div', { class: 'btns', style: 'margin-top:4px' },
    onEdit ? h('button', { class: 'btn sm', type: 'button', onclick: onEdit }, 'تعديل') : null,
    h('button', { class: 'btn sm ghost', type: 'button', onclick: async () => {
      await rpc('rpc_config_row_set_active', { p_version: draftId, p_table: table, p_id: row.id, p_active: !row.is_active }); onChange();
    } }, row.is_active ? 'إيقاف' : 'إعادة تفعيل'),
    ids ? h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'للأعلى', onclick: () => move(-1) }, '▲') : null,
    ids ? h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'للأسفل', onclick: () => move(1) }, '▼') : null);
}

// اختيار نموذج تقييم: [{code, name}] من آخر إصدار لكل نموذج
export async function formList() {
  const rows = await get('eval_forms?select=code,name,config_version_id&order=id.asc');
  const seen = new Map(); rows.forEach((r) => seen.set(r.code, r.name));   // ترتيب الإنشاء، وآخر اسم لكل نموذج
  return [...seen.entries()].map(([code, name]) => ({ code, name }));
}
export async function scaleList() {
  const rows = await get('grade_scales?select=code,name&order=id.asc');
  const seen = new Map(); rows.forEach((r) => seen.set(r.code, r.name));
  return [...seen.entries()].map(([code, name]) => ({ code, name }));
}
export { E };
