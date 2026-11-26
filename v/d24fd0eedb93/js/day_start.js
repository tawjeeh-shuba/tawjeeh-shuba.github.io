// زر «تشغيل إعدادات يوم البدء» ومعه «إرجاع» (أمر «الموقع السهل» 2026-11-25، القسمان 2 و4) — بطاقة واحدة تُستعمل في «ابدأ من هنا» وفي «الإعدادات العامة».
// قائمة ما سيتغير من القاعدة (rpc_trial_day_start_preview: مفاتيح فئة «يوم البدء» في دليل الإعدادات + إطفاء الزيارات التجريبية وأرشفتها).
// الزر يعرض القائمة ويطلب تأكيداً وسبباً، ويُسجَّل من ضغطه ومتى (trial_day_runs + السجل). «إرجاع» يعيد كل شيء كما كان، بلا حذف.
import { h, rpc, badge, nf, sheet, toast, fail, isDivisionHead, loadProfile } from './core.js';

const val = (v) => (v === true ? 'مشغّل' : v === false ? 'مطفأ' : v == null ? '—' : String(v));
const when = (t) => { try { return new Date(t).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return String(t || ''); } };

export function dayStartCard({ compact = false, onChange, preview = null } = {}) {
  const box = h('div', { class: 'day-start' }, h('p', { class: 'muted small' }, 'جارٍ التحميل…'));
  if (!isDivisionHead()) { box.replaceChildren(h('p', { class: 'muted small' }, 'زر «تشغيل إعدادات يوم البدء» لمسؤول الشعبة وحده.')); return box; }
  async function load() {
    let P;
    try { P = preview || await rpc('rpc_trial_day_start_preview'); preview = null; } catch (e) { box.replaceChildren(h('p', { class: 'err' }, 'تعذّر تحميل قائمة يوم البدء. حدّث الصفحة.')); return; }
    const run = P.last_run && P.last_run.kind === 'تشغيل' && !P.last_run.undone ? P.last_run : null;
    const pending = (P.changes || []).filter((c) => JSON.stringify(c.current) !== JSON.stringify(c.new));
    box.replaceChildren(
      run ? h('div', { class: 'ds-done' }, badge('شُغّلت إعدادات يوم البدء', 'ok'),
        h('div', { class: 'small', style: 'margin-top:6px' }, `ضغطه ${run.run_by_name || '—'} في ${when(run.run_at)}: تغيّر ${nf(run.changed ?? 0)} إعداداً، وأُرشفت ${nf(run.archived ?? 0)} زيارة تجريبية.`),
        h('button', { type: 'button', class: 'btn sm', style: 'margin-top:8px', onclick: () => undo(run) }, 'إرجاع (يعيد ما غيّره الزر كما كان)'))
        : h('div', null,
          h('p', { class: 'small' }, compact ? 'الآن كل ميزات المجرّبين مطفأة، فلا يتغير شيء عليهم وأنت تجرّب. يوم البدء تضغط زراً واحداً:' : 'يوم بدء التجربة تضغط زراً واحداً، فيحدث هذا كله معاً:'),
          h('ul', { class: 'small ds-list' },
            (P.changes || []).map((c) => h('li', null, `«${c.label}»: ${val(c.current)} ← `, h('b', null, val(c.new)))),
            h('li', null, `أرشفة كل زياراتك التجريبية (${nf(P.trial_visits_to_archive ?? 0)}) — أرشفة لا حذف.`)),
          h('p', { class: 'muted xs' }, 'يُسجَّل اسمك ووقت الضغط، ومعه زر «إرجاع» يعيد كل شيء كما كان.'),
          h('button', { type: 'button', class: 'btn primary block', onclick: () => start(P, pending) }, 'تشغيل إعدادات يوم البدء')));
  }
  async function start(P, pending) {
    // 2026-11-26 (بعد ضغطة غير مقصودة مسجّلة في 2026-11-25): لا سبب مكتوب مسبقاً، واشتراط كتابة كلمة «تشغيل» قبل التأكيد
    const reason = h('input', { type: 'text', placeholder: 'مثل: بدء التجربة', 'aria-label': 'السبب' });
    const word = h('input', { type: 'text', placeholder: 'تشغيل', autocomplete: 'off', 'aria-label': 'اكتب كلمة تشغيل للتأكيد' });
    const err = h('div', { class: 'err', hidden: true, role: 'alert' });
    sheet({ title: 'تشغيل إعدادات يوم البدء', body: h('div', null,
      h('p', null, 'سيتغير الآن:'),
      h('ul', { class: 'small ds-list' }, (P.changes || []).map((c) => h('li', null, `«${c.label}»: ${val(c.current)} ← `, h('b', null, val(c.new)))),
        h('li', null, `أرشفة ${nf(P.trial_visits_to_archive ?? 0)} زيارة تجريبية.`)),
      pending.length ? null : h('p', { class: 'muted small' }, 'كل الإعدادات على قيمتها الموصى بها أصلاً؛ سيُسجَّل التشغيل فقط.'),
      h('p', { class: 'small', style: 'font-weight:700' }, 'بعد التأكيد يرى المجرّبون هذه الميزات فوراً. ويمكنك «إرجاع» كل شيء في أي وقت.'),
      h('label', { class: 'field' }, h('span', null, 'السبب (يُسجَّل مع اسمك)'), reason),
      h('label', { class: 'field' }, h('span', null, 'للتأكيد اكتب كلمة «تشغيل»'), word), err),
    actions: [{ label: 'تأكيد التشغيل', kind: 'primary', onClick: async (close) => {
      const rs = reason.value.trim();
      if (rs.replace(/[^\p{L}\p{N}]/gu, '').length < 3) { err.textContent = 'اكتب السبب (3 أحرف على الأقل).'; err.hidden = false; return; }
      if (word.value.trim() !== 'تشغيل') { err.textContent = 'للتأكيد اكتب كلمة «تشغيل» كما هي.'; err.hidden = false; return; }
      const r = await rpc('rpc_trial_day_start', { p_reason: rs });
      close(); toast(`شُغّلت إعدادات يوم البدء: ${nf(r.changed ?? 0)} إعداداً، وأُرشفت ${nf(r.archived ?? 0)} زيارة تجريبية`, 'ok'); after();
    } }, { label: 'إغلاق دون تشغيل' }] });
  }
  async function undo(run) {
    const reason = h('input', { type: 'text', value: 'إرجاع' });
    sheet({ title: 'إرجاع إعدادات يوم البدء', body: h('div', null,
      h('p', null, 'تعود الإعدادات التي غيّرها الزر إلى ما كانت عليه قبله، وتعود الزيارات التجريبية التي أرشفها، ويعود وضع «الزيارات التجريبية» كما كان. الإعداد الذي غيّرته أنت بيدك بعد الضغط يبقى كما تركته. لا يُحذف شيء.'),
      h('label', { class: 'field' }, h('span', null, 'السبب (يُسجَّل مع اسمك)'), reason)),
    actions: [{ label: 'تأكيد الإرجاع', kind: 'primary', onClick: async (close) => {
      const r = await rpc('rpc_trial_day_start_undo', { p_run: run.id, p_reason: reason.value.trim() || 'إرجاع' });
      const sk = (r.skipped || []).map((x) => `«${x.label || x.key}»`);
      close(); toast(`أُرجعت ${nf(r.restored ?? 0)} إعدادات كما كانت${sk.length ? `، وبقي كما غيّرته بيدك: ${sk.join('، ')}` : ''}`, 'ok'); after();
    } }, { label: 'إغلاق دون إرجاع' }] });
  }
  // الملف الشخصي يحمل حالة المفاتيح (الزيارات التجريبية، والبلاغ…): يُعاد تحميله ثم تُرسم الصفحة من جديد
  async function after() {
    try { await loadProfile(); } catch { /* */ }
    if (onChange) onChange(); else load().catch(fail);
  }
  load();
  return box;
}
