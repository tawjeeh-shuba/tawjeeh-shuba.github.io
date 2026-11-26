// «شروح البنود» (2026-11-25) لمسؤول الشعبة وحده: شرح مبسط لكل بند يظهر للموجه بزر «؟» في الزيارة المبسطة بعد الاعتماد فقط.
// المسودة ومصدرها تظهر هنا وحدها؛ تعديل الشرح يرجعه «مسودة» حتى تعتمده. الحارس الحقيقي في القاعدة (الدوال ترفض غير مسؤول الشعبة).
import { h, rpc, badge, toast, fail, empty, confirmBox } from './core.js';
import { settingLink } from './off_notice.js';

const dt = (t) => (t ? new Date(t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export async function render(root) {
  const body = h('div'); root.append(body);
  let filter = '';
  async function load() {
    body.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    let d;
    try { d = await rpc('rpc_item_helps_admin', {}); } catch (e) { body.replaceChildren(h('p', { class: 'err' }, String(e.message || e))); return; }
    const rows = d.rows.filter((r) => !filter || r.status === filter);
    const nOk = d.rows.filter((r) => r.status === 'معتمد').length;
    const sel = h('select', { 'aria-label': 'الحالة', onchange: (e) => { filter = e.target.value; load(); } }, ...['', 'مسودة', 'معتمد'].map((v) => h('option', { value: v, selected: v === filter }, v || 'كل الشروح')));
    body.replaceChildren(
      h('p', { class: 'muted small' }, 'الموجه لا يرى أي شرح قبل اعتماده. إذا عدّلت شرحاً يعود «مسودة» ويختفي عن الموجهين حتى تعتمده من جديد. يُسجَّل اسمك مع كل تعديل واعتماد في «السجل».'),
      h('p', { class: 'muted small' }, `المعتمد: ${nOk} من ${d.rows.length}. زر «؟» عند الموجهين: ${d.on && d.simple ? 'يعمل' : 'لا يعمل الآن. يعمل حين يكون الإعدادان «الزيارة المبسطة» و«زر ؟ بجانب كل بند» مشغّلين. الأول يشغّله زر «يوم البدء»، والثاني ينتظر قرارك'}.`),
      // زر لكل إعداد ناقص يفتحه مظلّلاً في «الإعدادات العامة» (بدل وصف الطريق بالكلمات)
      d.on && d.simple ? null : h('div', { class: 'btns' },
        d.simple ? null : h('a', { class: 'btn sm ghost', href: settingLink('feature.visit_simple') }, 'افتح إعداد «الزيارة المبسطة»'),
        d.on ? null : h('a', { class: 'btn sm ghost', href: settingLink('feature.visit_item_help') }, 'افتح إعداد «زر ؟»')),
      sel, ...(rows.length ? rows.map(card) : [empty('لا توجد شروح بهذه الحالة. اختر «كل الشروح» من القائمة أعلاه.')]));
  }
  function card(r) {
    const ta = h('textarea', { rows: 4, 'aria-label': `شرح ${r.name}` }); ta.value = r.body;
    const ex = h('textarea', { rows: 2, 'aria-label': `مثال ${r.name}`, placeholder: 'مثال قصير من واقع الحلقة (اختياري)' }); ex.value = r.example || '';
    const save = h('button', { type: 'button', class: 'btn sm' }, 'حفظ التعديل (مسودة)');
    const ok = h('button', { type: 'button', class: `btn sm ${r.status === 'معتمد' ? '' : 'primary'}` }, r.status === 'معتمد' ? 'سحب الاعتماد' : 'اعتماد');
    save.addEventListener('click', async () => {
      save.disabled = true;
      try { await rpc('rpc_item_help_save', { p_code: r.code, p_body: ta.value, p_example: ex.value || null }); toast('حُفظ التعديل، والشرح الآن مسودة', 'ok'); load(); } catch (e) { fail(e); save.disabled = false; }
    });
    ok.addEventListener('click', async () => {
      const dirty = ta.value !== r.body || (ex.value || '') !== (r.example || '');
      if (dirty) return toast('اضغط «حفظ التعديل (مسودة)» أولاً، ثم اضغط «اعتماد»', 'bad');
      if (r.status !== 'معتمد' && !(await confirmBox(`اعتماد شرح «${r.name}»؟ سيراه الموجهون بزر «؟» بجانب البند، متى كان الزر مشغّلاً.`, 'اعتماد'))) return;
      ok.disabled = true;
      try { await rpc('rpc_item_help_approve', { p_code: r.code, p_approve: r.status !== 'معتمد' }); toast(r.status === 'معتمد' ? 'سُحب الاعتماد' : 'اعتُمد الشرح', 'ok'); load(); } catch (e) { fail(e); ok.disabled = false; }
    });
    return h('section', { class: 'card' },
      h('div', { class: 'row between nowrap' }, h('b', null, `${r.code} — ${r.name}`), badge(r.status, r.status === 'معتمد' ? 'ok' : 'warn')),
      h('label', { class: 'field' }, h('span', null, 'الشرح'), ta), h('label', { class: 'field' }, h('span', null, 'المثال'), ex),
      h('div', { class: 'muted xs' }, `المصدر: ${r.source}`),
      h('div', { class: 'muted xs' }, r.status === 'معتمد' ? `اعتمده ${r.approved_by || '—'} • ${dt(r.approved_at)}` : `آخر تعديل: ${dt(r.updated_at)}`),
      h('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, save, ok));
  }
  load();
}
