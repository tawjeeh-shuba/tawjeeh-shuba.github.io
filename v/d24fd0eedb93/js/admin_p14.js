// الشاشة 14 — الإعدادات العامة: كل المهل والحدود بمجموعات، مع الشرح والقيمة الافتراضية والحدود.
// التعديل بتاريخ سريان (اليوم افتراضياً) ومعاينة وسبب؛ «إعادة للافتراضي»؛ تخصيص لقسم أو فترة وإيقافه. لا حذف.
import { S, h, get, rpc, hijri, badge, field, fail, today, depName, perName, sheet, refreshShowWomen } from './core.js';
import { canEdit, previewThenSave, show, DAYS, dayNames, isHead } from './panel_ui.js';
// «الموقع السهل» (2026-11-25، القسم 4): الإعدادات العامة في ثلاث مجموعات من دليل الإعدادات في القاعدة (setting_guide عبر rpc_settings_guide)،
// تحت كل إعداد سطر شرح والقيمة الموصى بها، و«إعدادات متقدمة — لا تغيّرها» مطوية. أسماء المفاتيح ومنطقها لم تتغير.
const TIERS = [
  { t: 'الآن', title: 'شغّلته لك الآن', cls: 'tier-now', icon: '✓', intro: 'يخصك وحدك ولا يغيّر شيئاً لغيرك. شُغّل بأمرك.' },
  { t: 'يوم البدء', title: 'يوم البدء', cls: 'tier-day', icon: '◷', intro: 'يغيّر ما يراه المجرّبون، فيبقى مطفأ الآن. يشغّله كله زر واحد في آخر هذا القسم، ومعه «إرجاع».' },
  { t: 'قرار', title: 'تحتاج قرارك أو موافقة الإدارة', cls: 'tier-dec', icon: '?', intro: 'تبقى كما هي حتى تقرر. بجانب كل واحد سبب الانتظار.' },
];
// أسماء عربية لخيارات تقنية في الإعدادات (عرض فقط؛ القيمة المحفوظة لا تتغير)
const OPT_AR = { xlsx: 'إكسل', xls: 'إكسل قديم', csv: 'نص مفصول بفواصل', tsv: 'نص مفصول بمسافات' };

const E = encodeURIComponent;
// نصوص «المفتاح: النص» ذات المفاتيح الداخلية الإنجليزية (مثل intro وSEP): تُعرض وتُعدَّل بأسماء عربية بلا المفاتيح،
// والمفاتيح تبقى كما هي في القيمة المحفوظة (فحص الشاشات 2026-11-23: لا كلمة إنجليزية ظاهرة للمستخدم)
const KV_LINE = /^([A-Za-z][A-Za-z_]*)\s*:\s?(.*)$/;
const kvLines = (v) => {
  if (typeof v !== 'string') return null;
  const ls = v.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!ls.length || !ls.every((l) => KV_LINE.test(l))) return null;
  return ls.map((l) => { const m = l.match(KV_LINE); return { key: m[1], text: m[2].trim() }; });
};
const KEY_AR = {
  // نصوص شاشة «مصادر البيانات»
  intro: 'مقدمة الشاشة', share_help: 'شرح مشاركة الملف', public_blocked: 'منع الرابط العام (نص قديم)', sa_blocked: 'سبب تعطيل حساب الخدمة',
  step_name: 'شرح خطوة الاسم والنوع', step_method: 'شرح خطوة الطريقة', step_link: 'شرح خطوة الرابط', step_map: 'شرح خطوة ربط الأعمدة',
  step_compare: 'شرح خطوة المقارنة', step_activate: 'شرح خطوة التفعيل', upload_help: 'شرح رفع الملف',
  public_students_warn: 'تنبيه الرابط العام لملف فيه بيانات طلاب', public_students_ok: 'زر القبول', public_students_need: 'رسالة «القبول مطلوب»', public_students_hint: 'ملاحظة القبول في الخطوة الأولى',
  archived_blocked: 'رسالة «المصدر مؤرشف»', archive_confirm: 'شرح تأكيد الأرشفة', restore_confirm: 'شرح تأكيد الاستعادة',
  // شروح الطرق
  SEP: 'حين يكون «غائب» رقماً مستقلاً', WITH: 'حين يُعدّ «غائب» مع «لم تُرصد»', OUT: 'حين يكون «مستبعد» خارج المقام', IN: 'حين يكون «مستبعد» داخل المقام',
  EXCL_NORES: 'طريقة «استبعاد لم تُرصد من المقام»', PREVIOUS: 'الطريقة السابقة', EXCL_A: 'طريقة «استبعاد الفئة أ فقط»', OBS: 'شرح نسبة الرصد',
  normal: 'الصيغة الكاملة', short: 'الصيغة المختصرة', none: 'حين لا تُرصد أي نتيجة',
  // نصوص تبويب الاختبارات
  nores_badge: 'شارة «لم تُرصد»', nores_badge_sep: 'شارة «لم تُرصد» حين يكون «غائب» مستقلاً', nores_alert: 'تنبيه «نتائج كثيرة غير مرصودة»',
  month_none: 'شهر بلا اختبار', month_none_sub: 'شرح الشهر بلا اختبار', month_missing: 'لم يرشّح أحداً', month_missing_sub: 'شرح «لم يرشّح»', month_nores: 'شهر غير مرصود',
  conf_badge: 'شارة «يحتاج تأكيد»', names_off: 'الأسماء مخفية', ai_off: 'الذكاء الاصطناعي مطفأ',
  empty_all: 'لا اختبارات', empty_monthly: 'لا اختبارات تنشيطية', empty_term: 'لا اختبارات فصلية', empty_notes: 'لا ملاحظات', empty_followup: 'لا طلاب للمتابعة',
  empty_trend: 'لا سير', empty_plans: 'لا خطط',
  last: 'آخر اختبار', last_weak: 'آخر اختبار قليل الرصد', last_prev: 'آخر اختبار مقارنة بما قبله', last_prev_weak: 'آخر اختبار مقارنة بما قبله (قليل الرصد)', last_nores: 'آخر اختبار غير مرصود',
  trend: 'سير المعلم', trend_weak: 'سير المعلم (قليل الرصد)', trend_none: 'لا يكفي للحكم', missing: 'عدم الترشيح', followup: 'طلاب يحتاجون متابعة', followup_none: 'لا طلاب للمتابعة',
  repeat: 'تكرار الملاحظة', part: 'ترشيح جزئي', part_full: 'ترشيح كامل', part_missing: 'ترشيح ناقص', good: 'مستوى جيد', decline: 'تراجع', failed: 'رسوب', nores: 'لم تُرصد',
  source_note: 'ملاحظة المصدر', report_note: 'ملاحظة التقرير',
  keep_line: 'سطر المحافظة على المستوى', keep_wa: 'المحافظة في رسالة واتساب', keep_ai: 'المحافظة في أمر الذكاء الاصطناعي', up_ai: 'حدود الهدف في أمر الذكاء الاصطناعي', lowobs_ai: 'ضعف الرصد في أمر الذكاء الاصطناعي',
};
const keyLabel = (k, i) => KEY_AR[k] || `النص ${i + 1}`;
const longText = (v) => { const kv = kvLines(v); const t = kv ? kv.map((x) => x.text).join(' • ') : String(v).replace(/\n/g, ' '); return t.length > 90 ? t.slice(0, 90) + '…' : t; };
// إعدادات لا يغيّرها إلا مسؤول الشعبة (الحارس الحقيقي في القاعدة؛ هنا لإخفاء الأزرار فقط).
// القائمة نفسها في app.head_only_setting_keys() (الهجرة 20261125000600) ومعها display.show_women_circles؛ ويتحقق scripts/security_fixes_tests.mjs من تطابقهما.
const HEAD_ONLY = new Set(['display.show_women_circles',
  'exams.ai_plan_admin', 'exams.ai_plan_assistant', 'exams.ai_plan_supervisors', 'security.emergency_on', 'security.emergency_email',
  'ops.maintenance', 'ops.maintenance_msg', 'feature.trial_setup', 'feature.ops_accounts', 'feature.ops_monitor',
  'feature.visits', 'feature.visit_simple', 'feature.visit_item_help', 'export.show_score', 'whatsapp.show_score',
  'students.show_names', 'students.names_in_export', 'students.names_in_wa', 'trial.names_approval', 'feature.teacher_login', 'feature.acting', 'feature.trial_visits_head',
  'feature.remedial_plans', 'rplan.content_approved', 'feature.rplan_ai', 'feature.vsched', 'vsched.overdue_days', 'vsched.period_times', 'export.plans_all_roles']);
const valText = (s, v) => (v == null ? '—' : s.value_type === 'أيام الأسبوع' ? dayNames(v) : s.value_type === 'نسبة' ? `${Math.round(v * 1000) / 10}٪`
  : s.value_type === 'نص طويل' ? longText(v)
  : s.value_type === 'نص' && v === '' ? '(فارغ)' : Array.isArray(v) ? v.map((x) => OPT_AR[x] || show(x)).join('، ') : show(OPT_AR[v] || v)) + (s.unit && v != null && s.value_type !== 'نسبة' ? ` ${s.unit}` : '');

// المرحلة 9ج: opt.area = «الزيارات» لبطاقة «إعدادات الزيارات» في مجموعة الزيارات، و«عام» للإعدادات العامة.
// مكان كل مجموعة من جدول setting_group_areas (لا ثابت في الكود)؛ والقيم نفسها لا تتغير بتغيّر المكان.
export async function render(root, ctx, opt = {}) {
  const edit = canEdit('P14');
  const area = opt.area || null;
  const [allDefs0, vals, areas, G] = await Promise.all([
    get('app_settings?select=*&is_active=eq.true&order=sort_order'),
    get('setting_values?select=id,key,scope_kind,scope_ref,value,valid_from,created_by,created_at,change_set_id&order=valid_from.desc,id.desc&limit=2000'),
    area ? get('setting_group_areas?select=group_name,area').catch(() => []) : [],
    rpc('rpc_settings_guide').catch(() => null),
  ]);
  // بطاقة «يوم البدء»: الوحدة والمعاينة تبدآن الآن بالتوازي مع رسم الصفحة (لا بعده)
  const dayP = area === 'عام' && isHead() ? Promise.all([import('./day_start.js'), rpc('rpc_trial_day_start_preview')]).catch(() => null) : null;
  // دليل كل إعداد (الفئة والشرح والموصى) والقيمة العامة السارية من القاعدة
  const guide = new Map((G || []).map((g) => [g.key, g]));
  // إعداد في الدليل لم يصل تعريفه بعد (مثل إعداد جديد): يُبنى من الدليل نفسه
  const allDefs = [...allDefs0, ...(G || []).filter((g) => !allDefs0.some((d) => d.key === g.key)).map((g) => ({ key: g.key, group_name: g.group, label_ar: g.label, description: g.description,
    value_type: g.value_type, unit: g.unit, options: g.options, default_value: g.default, min_value: g.min, max_value: g.max, allow_scope: g.allow_scope || ['عام'], is_readonly: g.is_readonly, readonly_note: g.readonly_note }))];
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
  if (area === 'عام' && areas.some((a) => a.area === 'الزيارات')) root.append(h('div', { class: 'hint' }, 'إعدادات الزيارات (مدة الزيارة، والمهل، وقوالب واتساب، وحد الأداء المنخفض…) ليست هنا، بل في: «لوحة التحكم» ← «الزيارات» ← «إعدادات الزيارات».'));
  root.append(h('p', { class: 'muted' }, 'كل تعديل يسري من تاريخه (اليوم أو بعده، لا في الماضي)، ويمر بالمعاينة، ويُسجَّل باسمك وسببه في سجل التغييرات. ما حُسب قديماً لا يُعاد حسابه.',
    edit ? '' : ' (لديك اطلاع فقط.)'));
  const tierKeys = new Set();
  if (area === 'عام' && G) {
    for (const T of TIERS) {
      const list = defs.filter((d) => guide.get(d.key)?.tier === T.t).sort((a, b) => (guide.get(a.key).sort ?? 0) - (guide.get(b.key).sort ?? 0));
      if (!list.length) continue;
      list.forEach((d) => tierKeys.add(d.key));
      const box = h('section', { class: `card tier ${T.cls}` }, h('h2', null, h('span', { 'aria-hidden': 'true' }, T.icon), T.title), h('p', { class: 'muted small' }, T.intro), list.map((d) => item(d)));
      if (T.t === 'يوم البدء') box.append(h('div', { class: 'day-slot', style: 'margin-top:10px' }));
      root.append(box);
    }
    const slot = root.querySelector('.day-slot');
    if (slot && dayP) dayP.then((x) => { if (x) slot.replaceWith(x[0].dayStartCard({ onChange: reload, preview: x[1] })); else import('./day_start.js').then((m) => slot.replaceWith(m.dayStartCard({ onChange: reload }))).catch(() => {}); });
  }
  const rest = groups.map((g) => [g, defs.filter((d) => d.group_name === g && !tierKeys.has(d.key))]).filter(([, l]) => l.length);
  const holder = tierKeys.size ? h('details', { class: 'adv' }, h('summary', null, `إعدادات متقدمة — لا تغيّرها (${rest.reduce((a, [, l]) => a + l.length, 0)})`),
    h('p', { class: 'muted small' }, 'قيمها مضبوطة ولا تحتاج لمسها. غيّر شيئاً منها فقط إن طُلب منك.')) : root;
  for (const [g, list] of rest) {
    const box = h('div', { class: 'card' }, h('h2', null, g));
    list.forEach((s) => box.append(item(s)));
    holder.append(box);
  }
  if (holder !== root) root.append(holder);
  // ?إعداد=<المفتاح>: يُفتح الإعداد نفسه مظلّلاً (من رسائل «مطفأ» و«ابدأ من هنا»)
  const want = ctx?.query?.['إعداد'];
  if (want) {
    const el = [...root.querySelectorAll('[data-key]')].find((x) => x.dataset.key === want);
    if (el) { const d = el.closest('details'); if (d) d.open = true; el.classList.add('setting-hl'); setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }
  }

  function item(s) {
    const g = guide.get(s.key);
    const c = cur(s.key, 'عام', null); const v = g && 'current' in g ? g.current : c ? c.value : s.default_value;   // القيمة السارية من القاعدة نفسها إن وصل الدليل
    const isDef = JSON.stringify(v) === JSON.stringify(s.default_value);
    const ov = overrides(s.key); const pend = pending(s.key, 'عام', null);
    const headOnly = HEAD_ONLY.has(s.key) || !!g?.head_only;
    const rec = g && g.recommended !== undefined && g.recommended !== null ? g.recommended : null;
    const atRec = rec != null && JSON.stringify(rec) === JSON.stringify(v);
    return h('div', { class: 'list-item', 'data-key': s.key },
      h('div', { class: 'row between' }, h('b', null, s.label_ar), h('span', { class: 'row' }, s.is_readonly ? badge('للاطلاع', 'gray') : null, isDef ? null : badge('معدَّل', 'info'), h('b', null, valText(s, v)))),
      g?.what_ar ? h('div', { class: 'guide' }, g.what_ar, g.affects_ar ? h('span', { class: 'muted' }, ` • يتأثر: ${g.affects_ar}`) : null) : null,
      g?.tier === 'قرار' ? h('div', { class: 'rec' }, `القيمة الحالية (بقرارك أو بموافقة الإدارة): ${valText(s, v)}${g.when_ar ? ` • متى أغيّره: ${g.when_ar}` : ''}`)
        : rec != null ? h('div', { class: 'rec' }, `الموصى بها: ${valText(s, rec)}${atRec ? ' ✓ (القيمة الآن هي الموصى بها)' : ''}${g.when_ar ? ` • متى أغيّره: ${g.when_ar}` : ''}`)
        : g?.tier ? h('div', { class: 'rec' }, `الموصى بها: أبقِه كما هو${g.when_ar ? ` • متى أغيّره: ${g.when_ar}` : ''}`) : null,
      g?.tier === 'قرار' && g.wait_reason ? h('div', { class: 'wait' }, `سبب الانتظار: ${g.wait_reason}`) : null,
      s.description ? h('div', { class: 'muted small' }, s.description) : null,
      h('div', { class: 'muted xs' }, `الافتراضي: ${valText(s, s.default_value)}`,
        s.min_value != null ? ` • المسموح: ${valText(s, s.min_value)} إلى ${valText(s, s.max_value)}` : '',
        c?.created_by ? ` • آخر تعديل: ${names.get(c.created_by) || '—'} (${hijri(c.created_at)})` : c ? ' • القيمة الابتدائية' : '',
        s.readonly_note ? ` • ${s.readonly_note}` : ''),
      pend.map((p) => h('div', { class: 'small', style: 'color:var(--info)' }, `مجدول: ${valText(s, p.value)} من ${hijri(p.valid_from)}`)),
      ov.map((o) => h('div', { class: 'small row between' }, h('span', null, `تخصيص ${o.scope_kind === 'قسم' ? 'قسم ' + depName(o.scope_ref) : 'فترة ' + perName(o.scope_ref)}: `, h('b', null, valText(s, o.value))),
        edit ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => stopOverride(s, o) }, 'إيقاف التخصيص') : null)),
      edit && !s.is_readonly && (!headOnly || isHead()) ? h('div', { class: 'btns', style: 'margin-top:6px' },
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => change(s, 'عام', null, v) }, 'تعديل'),
        !isDef ? h('button', { class: 'btn sm', type: 'button', onclick: () => reset(s) }, 'إعادة للافتراضي') : null,
        s.allow_scope.length > 1 ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => addOverride(s) }, 'تخصيص لقسم أو فترة') : null)
        : edit && !s.is_readonly && headOnly ? h('div', { class: 'muted xs', style: 'margin-top:6px' }, 'للاطلاع: هذا الإعداد لا يغيّره إلا مسؤول الشعبة.') : null);
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
    if (s.value_type === 'نص طويل') {
      // «المفتاح: النص»: حقل لكل نص باسم عربي، والمفتاح يُعاد كما هو عند الحفظ
      const kv = kvLines(v);
      if (kv) {
        const els = kv.map((x) => { const t = h('textarea', { rows: 2, style: 'line-height:1.7' }); t.value = x.text; return t; });
        return [h('div', null, kv.map((x, i) => field(keyLabel(x.key, i), els[i]))), () => kv.map((x, i) => `${x.key}: ${els[i].value.replace(/\s*\n\s*/g, ' ').trim()}`).join('\n')];
      }
      const el = h('textarea', { rows: 12, style: 'line-height:1.8' }); el.value = v ?? ''; return [el, () => el.value.replace(/\s+$/, '')];
    }
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
