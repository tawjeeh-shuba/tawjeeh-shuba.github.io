// الشاشة 14 — الإعدادات العامة: كل المهل والحدود بمجموعات، مع الشرح والقيمة الافتراضية والحدود.
// التعديل بتاريخ سريان (اليوم افتراضياً) ومعاينة وسبب؛ «إعادة للافتراضي»؛ تخصيص لقسم أو فترة وإيقافه. لا حذف.
import { S, h, get, rpc, hijri, badge, field, fail, today, depName, perName, sheet, refreshShowWomen } from './core.js';
import { canEdit, previewThenSave, show, DAYS, dayNames, isHead } from './panel_ui.js';
// أسماء عربية لخيارات تقنية في الإعدادات (عرض فقط؛ القيمة المحفوظة لا تتغير)
const OPT_AR = { xlsx: 'إكسل', xls: 'إكسل قديم', csv: 'نص مفصول بفواصل', tsv: 'نص مفصول بمسافات' };

const E = encodeURIComponent;
// إعدادات لا يغيّرها إلا مسؤول الشعبة (الحارس الحقيقي في القاعدة؛ هنا لإخفاء الأزرار فقط)
const HEAD_ONLY = new Set(['display.show_women_circles']);
const valText = (s, v) => (v == null ? '—' : s.value_type === 'أيام الأسبوع' ? dayNames(v) : s.value_type === 'نسبة' ? `${Math.round(v * 1000) / 10}٪`
  : s.value_type === 'نص طويل' ? (String(v).length > 90 ? String(v).slice(0, 90).replace(/\n/g, ' ') + '…' : String(v).replace(/\n/g, ' '))
  : s.value_type === 'نص' && v === '' ? '(فارغ)' : Array.isArray(v) ? v.map((x) => OPT_AR[x] || show(x)).join('، ') : show(OPT_AR[v] || v)) + (s.unit && v != null && s.value_type !== 'نسبة' ? ` ${s.unit}` : '');

// المرحلة 9ج: opt.area = «الزيارات» لبطاقة «إعدادات الزيارات» في مجموعة الزيارات، و«عام» للإعدادات العامة.
// مكان كل مجموعة من جدول setting_group_areas (لا ثابت في الكود)؛ والقيم نفسها لا تتغير بتغيّر المكان.
export async function render(root, ctx, opt = {}) {
  const edit = canEdit('P14');
  const area = opt.area || null;
  const [allDefs, vals, areas] = await Promise.all([
    get('app_settings?select=*&is_active=eq.true&order=sort_order'),
    get('setting_values?select=id,key,scope_kind,scope_ref,value,valid_from,created_by,created_at,change_set_id&order=valid_from.desc,id.desc&limit=2000'),
    area ? get('setting_group_areas?select=group_name,area').catch(() => []) : [],
  ]);
  const areaOf = new Map(areas.map((a) => [a.group_name, a.area]));
  const defs = !area ? allDefs : allDefs.filter((d) => (areaOf.get(d.group_name) || 'عام') === area);
  const t = today();
  const names = new Map();
  const ids = [...new Set(vals.map((v) => v.created_by).filter(Boolean))];
  if (ids.length) { try { (await get(`persons?select=id,full_name&id=in.(${ids.join(',')})`)).forEach((p) => names.set(p.id, p.full_name)); } catch { /* */ } }
  // القيمة السارية لنطاق: أحدث valid_from ≤ اليوم
  const cur = (key, kind, ref) => vals.find((v) => v.key === key && v.scope_kind === kind && (v.scope_ref || null) === (ref || null) && v.valid_from <= t);
  const pending = (key, kind, ref) => vals.filter((v) => v.key === key && v.scope_kind === kind && (v.scope_ref || null) === (ref || null) && v.valid_from > t);
  const overrides = (key) => {
    const seen = new Map();
    vals.filter((v) => v.key === key && v.scope_kind !== 'عام' && v.valid_from <= t).forEach((v) => { const k = v.scope_kind + '|' + v.scope_ref; if (!seen.has(k)) seen.set(k, v); });
    return [...seen.values()].filter((v) => v.value !== null);
  };

  const groups = [...new Set(defs.map((d) => d.group_name))];
  if (area === 'الزيارات' && !defs.length) { root.append(h('p', { class: 'empty' }, 'لا إعدادات للزيارات بعد.')); return; }
  if (area === 'عام' && areas.some((a) => a.area === 'الزيارات')) root.append(h('div', { class: 'hint' }, 'إعدادات الزيارات (مدة الزيارة، والمهل، وقوالب واتساب، وحد الأداء المنخفض…) صارت في: الزيارات ← إعدادات الزيارات.'));
  root.append(h('p', { class: 'muted' }, 'كل تعديل يسري من تاريخه (اليوم أو بعده، لا في الماضي)، ويمر بالمعاينة، ويُسجَّل باسمك وسببه في سجل التغييرات. ما حُسب قديماً لا يُعاد حسابه.',
    edit ? '' : ' (لديك اطلاع فقط.)'));
  for (const g of groups) {
    const box = h('div', { class: 'card' }, h('h2', null, g));
    defs.filter((d) => d.group_name === g).forEach((s) => box.append(item(s)));
    root.append(box);
  }

  function item(s) {
    const c = cur(s.key, 'عام', null); const v = c ? c.value : s.default_value; const isDef = JSON.stringify(v) === JSON.stringify(s.default_value);
    const ov = overrides(s.key); const pend = pending(s.key, 'عام', null);
    return h('div', { class: 'list-item' },
      h('div', { class: 'row between' }, h('b', null, s.label_ar), h('span', { class: 'row' }, s.is_readonly ? badge('للاطلاع', 'gray') : null, isDef ? null : badge('معدَّل', 'info'), h('b', null, valText(s, v)))),
      s.description ? h('div', { class: 'muted small' }, s.description) : null,
      h('div', { class: 'muted xs' }, `الافتراضي: ${valText(s, s.default_value)}`,
        s.min_value != null ? ` • المسموح: ${valText(s, s.min_value)} إلى ${valText(s, s.max_value)}` : '',
        c?.created_by ? ` • آخر تعديل: ${names.get(c.created_by) || '—'} (${hijri(c.created_at)})` : c ? ' • القيمة الابتدائية' : '',
        s.readonly_note ? ` • ${s.readonly_note}` : ''),
      pend.map((p) => h('div', { class: 'small', style: 'color:var(--info)' }, `مجدول: ${valText(s, p.value)} من ${hijri(p.valid_from)}`)),
      ov.map((o) => h('div', { class: 'small row between' }, h('span', null, `تخصيص ${o.scope_kind === 'قسم' ? 'قسم ' + depName(o.scope_ref) : 'فترة ' + perName(o.scope_ref)}: `, h('b', null, valText(s, o.value))),
        edit ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => stopOverride(s, o) }, 'إيقاف التخصيص') : null)),
      edit && !s.is_readonly && (!HEAD_ONLY.has(s.key) || isHead()) ? h('div', { class: 'btns', style: 'margin-top:6px' },
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => change(s, 'عام', null, v) }, 'تعديل'),
        !isDef ? h('button', { class: 'btn sm', type: 'button', onclick: () => reset(s) }, 'إعادة للافتراضي') : null,
        s.allow_scope.length > 1 ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => addOverride(s) }, 'تخصيص لقسم أو فترة') : null) : null);
  }

  function input(s, v) {
    if (s.value_type === 'نعم/لا') { const el = h('select', null, h('option', { value: 'true' }, 'نعم'), h('option', { value: 'false' }, 'لا')); el.value = String(v); return [el, () => el.value === 'true']; }
    if (s.value_type === 'قائمة') { const el = h('select', null, (s.options || []).map((o) => h('option', { value: o }, OPT_AR[o] || o))); el.value = v; return [el, () => el.value]; }
    if (s.value_type === 'قائمة متعددة' || s.value_type === 'أيام الأسبوع') {
      const opts = s.value_type === 'أيام الأسبوع' ? DAYS.map((n, i) => [i, n]) : (s.options || []).map((o) => [o, OPT_AR[o] || o]);
      const boxes = opts.map(([val, lab]) => { const cb = h('input', { type: 'checkbox', checked: (v || []).includes(val) }); cb.dataset.v = JSON.stringify(val); return h('label', { class: 'check' }, cb, lab); });
      return [h('div', null, boxes), () => boxes.map((b) => b.querySelector('input')).filter((x) => x.checked).map((x) => JSON.parse(x.dataset.v))];
    }
    if (s.value_type === 'نص') { const el = h('input', { type: 'text', value: v ?? '' }); return [el, () => el.value.trim()]; }
    // المرحلة 9: «قائمة نصوص» (عنصر في كل سطر) و«نص طويل» (مثل قالب واتساب)
    if (s.value_type === 'قائمة نصوص') { const el = h('textarea', { rows: 7 }); el.value = (v || []).join('\n'); return [el, () => el.value.split('\n').map((x) => x.trim()).filter(Boolean)]; }
    if (s.value_type === 'نص طويل') { const el = h('textarea', { rows: 12, style: 'line-height:1.8' }); el.value = v ?? ''; return [el, () => el.value.replace(/\s+$/, '')]; }
    const pct = s.value_type === 'نسبة';
    const el = h('input', { type: 'number', inputmode: 'decimal', step: pct ? '0.01' : '1', value: v ?? '' });
    return [el, () => (el.value === '' ? null : Number(el.value))];
  }

  async function change(s, kind, ref, v) {
    const [el, read] = input(s, v);
    const date = h('input', { type: 'date', value: today(), min: today() });
    const val = await new Promise((res) => {
      let done = false;
      sheet({ title: `تعديل: ${s.label_ar}`, body: h('div', null,
        h('p', { class: 'muted small' }, s.description || ''), field(`القيمة${s.unit ? ' (' + s.unit + ')' : ''}${s.value_type === 'نسبة' ? ' (من 0 إلى 1)' : ''}`, el),
        field('يسري من', date, 'اليوم أو بعده')), onClose: () => { if (!done) res(null); },
        actions: [{ label: 'معاينة', kind: 'primary', onClick: (close) => { done = true; res({ value: read(), from: date.value || today() }); close(); } }, { label: 'تراجع', onClick: (close) => close() }] });
    });
    if (!val) return;
    const ok = await previewThenSave({ screen: 'P14', title: s.label_ar,
      draft: { op: 'setting', key: s.key, scope_kind: kind, scope_ref: ref, value: val.value, valid_from: val.from },
      lines: (pv) => [['النطاق', kind === 'عام' ? 'عام' : `${kind}: ${kind === 'قسم' ? depName(ref) : perName(ref)}`], ['السارية الآن', valText(s, pv.current)], ['الجديدة', valText(s, pv.new)], ['يسري من', hijri(pv.valid_from)]],
      save: (reason) => rpc('rpc_setting_set', { p_key: s.key, p_scope_kind: kind, p_scope_ref: ref, p_value: val.value, p_valid_from: val.from, p_reason: reason }) });
    if (ok) { await refreshShowWomen(); reload(); }
  }
  async function reset(s) {
    const ok = await previewThenSave({ screen: 'P14', title: `إعادة «${s.label_ar}» للافتراضي`,
      draft: { op: 'setting', key: s.key, scope_kind: 'عام', value: s.default_value, valid_from: today() },
      lines: (pv) => [['السارية الآن', valText(s, pv.current)], ['الافتراضي', valText(s, s.default_value)], ['يسري من', 'اليوم']],
      save: (reason) => rpc('rpc_setting_reset', { p_key: s.key, p_scope_kind: 'عام', p_scope_ref: null, p_reason: reason }) });
    if (ok) { await refreshShowWomen(); reload(); }
  }
  async function addOverride(s) {
    const kinds = s.allow_scope.filter((k) => k !== 'عام');
    const kind = h('select', null, kinds.map((k) => h('option', { value: k }, k)));
    const dep = h('select', null, S.refs.departments.filter((d) => d.is_active).map((d) => h('option', { value: d.code }, d.name)));
    const per = h('select', null, S.refs.periods.filter((p) => p.is_active).map((p) => h('option', { value: p.code }, p.name)));
    const sync = () => { dep.parentElement.hidden = kind.value !== 'قسم'; per.parentElement.hidden = kind.value !== 'فترة'; };
    const pick = await new Promise((res) => {
      let done = false;
      sheet({ title: `تخصيص: ${s.label_ar}`, body: h('div', null, field('على مستوى', kind), field('القسم', dep), field('الفترة', per)),
        onClose: () => { if (!done) res(null); }, actions: [{ label: 'التالي', kind: 'primary', onClick: (close) => { done = true; res({ kind: kind.value, ref: kind.value === 'قسم' ? dep.value : per.value }); close(); } }, { label: 'تراجع', onClick: (c) => c() }] }); sync(); kind.onchange = sync;
    });
    if (!pick) return;
    const c = cur(s.key, pick.kind, pick.ref);
    change(s, pick.kind, pick.ref, c?.value ?? cur(s.key, 'عام', null)?.value ?? s.default_value);
  }
  async function stopOverride(s, o) {
    const ok = await previewThenSave({ screen: 'P14', title: 'إيقاف التخصيص',
      draft: { op: 'setting', key: s.key, scope_kind: o.scope_kind, scope_ref: o.scope_ref, value: null, valid_from: today() },
      lines: (pv) => [['التخصيص الحالي', valText(s, pv.current)], ['يعود إلى العام', valText(s, pv.new)]],
      save: (reason) => rpc('rpc_setting_reset', { p_key: s.key, p_scope_kind: o.scope_kind, p_scope_ref: o.scope_ref, p_reason: reason }), okLabel: 'أوقف التخصيص' });
    if (ok) reload();
  }
  function reload() { root.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…')); render(root, ctx, opt).then(() => root.querySelector('.loading')?.remove()).catch(fail); }
}
