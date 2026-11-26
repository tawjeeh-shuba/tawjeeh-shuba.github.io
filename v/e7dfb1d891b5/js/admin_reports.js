// «البلاغات» (الاستعداد التشغيلي، 2026-11-24) لمسؤول الشعبة وحده: بلاغات المجرّبين بحالاتها (جديد، قيد المعالجة، مُغلق). لا حذف.
import { h, rpc, badge, nf, askForm, toast, fail, seg, empty, sheet } from './core.js';

const dt = (t) => (t ? new Date(t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const KIND = { 'جديد': 'warn', 'قيد المعالجة': 'gray', 'مُغلق': 'ok' };

export async function render(root) {
  let status = 'جديد';
  const top = h('div'); const list = h('div');
  root.append(h('p', { class: 'muted small' }, 'كل بلاغ يحمل الصفحة والوقت ودور المرسل ورقم إصدار الموقع ومقاس شاشته. الصورة تُفتح عند الطلب.'), top, list);
  async function load() {
    list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    try {
      const d = await rpc('rpc_reports', { p: { status, limit: 100 } });
      top.replaceChildren(seg(['جديد', 'قيد المعالجة', 'مُغلق', ''].map((v) => ({ value: v, label: `${v || 'الكل'} (${nf(v ? d.counts[v] || 0 : Object.values(d.counts).reduce((a, b) => a + b, 0))})` })), status, (v) => { status = v; load(); }));
      list.replaceChildren(...(d.rows.length ? d.rows.map(card) : [empty('لا بلاغات بهذه الحالة.')]));
    } catch (e) { list.replaceChildren(); fail(e); }
  }
  function card(r) {
    const set = async (st) => {
      const v = await askForm({ title: `البلاغ ${r.id}: ${st}`, fields: [{ name: 'note', label: 'ملاحظة (اختيارية)', value: r.status_note || '' }], ok: 'حفظ' });
      if (!v) return;
      try { await rpc('rpc_report_set_status', { p_id: r.id, p_status: st, p_note: v.note || null }); toast('حُفظت الحالة', 'ok'); load(); } catch (e) { fail(e); }
    };
    const shot = async () => {
      try { const s = await rpc('rpc_report_screenshot', { p_id: r.id }); if (s) sheet({ title: `صورة البلاغ ${r.id}`, body: h('img', { class: 'shot-prev', src: s, alt: 'صورة الشاشة', style: 'max-height:70vh' }), actions: [{ label: 'إغلاق' }] }); }
      catch (e) { fail(e); }
    };
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('b', null, `${r.name} (${r.code})`), badge(r.status, KIND[r.status])),
      h('div', { class: 'muted xs' }, [dt(r.created_at), r.roles, r.page, r.screen, r.app_version ? `الإصدار ${r.app_version.slice(0, 7)}` : null].filter(Boolean).join(' • ')),
      h('p', { style: 'white-space:pre-wrap;margin:8px 0' }, r.description),
      r.status_note ? h('p', { class: 'muted small' }, `ملاحظة: ${r.status_note}${r.status_by_name ? ` — ${r.status_by_name}` : ''}`) : null,
      h('div', { class: 'btns' },
        r.has_shot ? h('button', { class: 'btn sm', type: 'button', onclick: shot }, 'عرض الصورة') : null,
        r.status !== 'قيد المعالجة' ? h('button', { class: 'btn sm', type: 'button', onclick: () => set('قيد المعالجة') }, 'قيد المعالجة') : null,
        r.status !== 'مُغلق' ? h('button', { class: 'btn sm primary', type: 'button', onclick: () => set('مُغلق') }, 'إغلاق') : null,
        r.status === 'مُغلق' ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => set('جديد') }, 'إعادة فتح') : null));
  }
  load();
}
