// «حالة الحسابات» (الاستعداد التشغيلي، 2026-11-24) لمسؤول الشعبة وحده: تبديل الحساب نشط/غير نشط (بلا حذف، وبياناته كاملة)،
// وسجل محاولات الدخول، وحساب الطوارئ. الحارس الحقيقي في القاعدة (الدوال ترفض غير مسؤول الشعبة).
import { h, rpc, badge, nf, askForm, toast, fail, debounce, seg, empty, confirmBox } from './core.js';

const dt = (t) => (t ? new Date(t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const REJ = { bad_password: 'رمز خاطئ', unknown_identifier: 'معرّف غير موجود', invalid_identifier: 'معرّف غير صالح', no_account: 'لا حساب', disabled: 'موقوف',
  locked: 'مقفل', initial_expired: 'انتهت كلمة المرور الأولى', visitor_limit: 'تجاوز حد الزائر' };

export async function render(root) {
  const body = h('div'); let tab = 'الحسابات';
  const tabs = h('div');
  const drawTabs = () => tabs.replaceChildren(seg([{ value: 'الحسابات', label: 'الحسابات' }, { value: 'سجل الدخول', label: 'سجل الدخول' }, { value: 'حساب الطوارئ', label: 'حساب الطوارئ' }],
    tab, (v) => { tab = v; drawTabs(); show(); }));
  root.append(tabs, body); drawTabs();
  const show = () => (tab === 'الحسابات' ? accounts() : tab === 'سجل الدخول' ? log() : emergency());
  show();

  // ---------- الحسابات ----------
  function accounts() {
    const q = h('input', { type: 'search', placeholder: 'اسم الشخص أو رقمه', 'aria-label': 'بحث' });
    const st = h('select', { 'aria-label': 'الحالة' }, ...['', 'نشط', 'غير نشط', 'المجرّبون', 'التجريبية'].map((v) => h('option', { value: v }, v || 'كل الحسابات')));
    const sum = h('p', { class: 'muted small' }); const list = h('div');
    body.replaceChildren(h('p', { class: 'muted small' }, 'الحساب «غير النشط» لا يدخل، وتبقى بياناته كاملة، ويعود بضغطة «تفعيل». كل تبديل يُسجَّل باسمك وسببه.'),
      h('div', { class: 'row', style: 'gap:8px' }, q, st), sum, list);
    let seq = 0;
    async function load() {
      const my = ++seq; list.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
      try {
        const d = await rpc('rpc_accounts_status', { p: { q: q.value.trim(), state: st.value, limit: 100 } });
        if (my !== seq) return;
        sum.textContent = `${nf(d.total)} حساباً، النشط منها ${nf(d.active)}${d.total > d.rows.length ? ` (يظهر أول ${nf(d.rows.length)})` : ''}`;
        list.replaceChildren(...(d.rows.length ? d.rows.map(card) : [empty('لا حسابات بهذه التصفية.')]));
      } catch (e) { if (my === seq) { list.replaceChildren(); fail(e); } }
    }
    function card(r) {
      const btn = h('button', { class: `btn sm ${r.is_active ? '' : 'primary'}`, type: 'button' }, r.is_active ? 'تعطيل' : 'تفعيل');
      btn.addEventListener('click', async () => {
        const v = await askForm({ title: `${r.is_active ? 'تعطيل' : 'تفعيل'} حساب: ${r.name}`, intro: r.is_active ? 'لن يستطيع الدخول، وتبقى بياناته كاملة.' : 'سيستطيع الدخول برمزه الحالي.',
          fields: [{ name: 'reason', label: 'السبب', required: true, value: r.is_active ? 'ليس من المجرّبين' : 'من المجرّبين' }], ok: r.is_active ? 'تعطيل' : 'تفعيل' });
        if (!v) return;
        btn.disabled = true;
        try { await rpc('admin_set_account_active', { p_person: r.id, p_active: !r.is_active, p_reason: v.reason }); toast(r.is_active ? 'عُطّل الحساب' : 'فُعّل الحساب', 'ok'); load(); }
        catch (e) { fail(e); btn.disabled = false; }
      });
      return h('div', { class: 'list-item row between nowrap', style: 'gap:10px' },
        h('div', { class: 'grow' },
          h('div', null, h('b', null, r.name), ' ', badge(String(r.code), 'gray'), r.trial ? [' ', badge('مجرّب', 'warn')] : null, r.is_test ? [' ', badge('تجريبي', 'gray')] : null,
            r.emergency ? [' ', badge('حساب الطوارئ', 'bad')] : null),
          h('div', { class: 'muted xs' }, [r.roles || 'بلا تكليف ساري', `آخر دخول: ${dt(r.last_login_at)}`].join(' • ')),
          h('div', { style: 'margin-top:4px' }, badge(r.is_active ? 'نشط' : 'غير نشط', r.is_active ? 'ok' : 'bad'), r.locked ? [' ', badge('مقفل مؤقتاً', 'bad')] : null,
            r.mcp ? [' ', badge('بانتظار تغيير كلمة المرور', 'warn')] : null)),
        btn);
    }
    q.addEventListener('input', debounce(load, 400)); st.addEventListener('change', load);
    load();
  }

  // ---------- سجل الدخول ----------
  function log() {
    const failed = h('input', { type: 'checkbox', checked: true }); const days = h('select', { 'aria-label': 'المدة' }, ...[1, 7, 30].map((d) => h('option', { value: d, selected: d === 7 }, d === 1 ? 'آخر يوم' : `آخر ${d} أيام`)));
    const sum = h('p', { class: 'muted small' }); const box = h('div', { class: 'ops-scroll' });
    body.replaceChildren(h('p', { class: 'muted small' }, 'بعد 5 محاولات فاشلة متتالية يُقفل الحساب 15 دقيقة تلقائياً (في الخادم)، ويُفك القفل من شاشة «الحسابات». الجوال يظهر بآخر 4 أرقام فقط.'),
      h('div', { class: 'row', style: 'gap:10px' }, h('label', { class: 'row', style: 'gap:6px' }, failed, 'الفاشلة فقط'), days), sum, box);
    async function load() {
      box.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
      try {
        const d = await rpc('rpc_login_log', { p: { failed: failed.checked, days: Number(days.value), limit: 200 } });
        sum.textContent = `${nf(d.total)} محاولة، الفاشلة ${nf(d.failed)}، والمقفل الآن ${nf(d.locked_now)}`;
        box.replaceChildren(d.rows.length ? h('table', { class: 'ops-table' },
          h('thead', null, h('tr', null, ...['الوقت', 'الحساب', 'النتيجة', 'السبب', 'الزائر'].map((t) => h('th', null, t)))),
          h('tbody', null, ...d.rows.map((r) => h('tr', null, h('td', null, dt(r.at)),
            h('td', null, r.name ? `${r.name} (${r.code})` : (r.masked || '—'), r.emergency ? [' ', badge('طوارئ', 'bad')] : null),
            h('td', null, r.event === 'unlock' ? badge('فك قفل', 'gray') : badge(r.success ? 'نجح' : 'فشل', r.success ? 'ok' : 'bad')),
            h('td', null, REJ[r.reject_code] || r.reason || '—'), h('td', { dir: 'ltr' }, r.visitor || '—'))))) : empty('لا محاولات في هذه المدة.'));
      } catch (e) { box.replaceChildren(); fail(e); }
    }
    failed.addEventListener('change', load); days.addEventListener('change', load);
    load();
  }

  // ---------- حساب الطوارئ ----------
  function emergency() {
    const q = h('input', { type: 'search', placeholder: 'اسم الحساب أو رقمه', 'aria-label': 'بحث' }); const list = h('div');
    body.replaceChildren(h('div', { class: 'card' },
      h('h3', { style: 'margin-top:0' }, 'ما هو؟'),
      h('p', { class: 'small' }, 'حساب احتياطي لمسؤول الشعبة يُستعمل عند الطوارئ فقط (مثل ضياع جوالك أو قفل حسابك). يبقى مطفأً: لا يدخل ولا يعمل حتى تشغّل «حساب الطوارئ مفعّل» في «الإعدادات العامة» ← «الاستعداد التشغيلي». كل دخول به يُسجَّل ويظهر تنبيهاً في «نشاط التجربة» و«جاهزية التجربة».'),
      h('h3', null, 'خطوات تجهيزه (مرة واحدة)'),
      h('ol', { class: 'small' },
        h('li', null, '«الأشخاص والتكليفات» ← «إضافة شخص»: الاسم «حساب طوارئ الشعبة»، ثم أضف له تكليف «مسؤول الشعبة».'),
        h('li', null, '«الحسابات» ← ابحث عنه ← «إنشاء الحساب بكلمة مرور»: اكتب أنت كلمة مرور قوية، واحفظها مع بريد الشعبة في مكان آمن خارج الجهاز.'),
        h('li', null, 'هنا: ابحث عنه واضغط «تعيينه حساب الطوارئ».'),
        h('li', null, '«لوحة التحكم» ← «الإعدادات العامة» ← «إعدادات متقدمة — لا تغيّرها» (اضغطها لتنفتح) ← «الاستعداد التشغيلي» ← «بريد الشعبة لحساب الطوارئ» ← «تعديل»: اكتب البريد (لا تكتب كلمة المرور هناك أبداً).'),
        h('li', null, 'تأكد أن «حساب الطوارئ مفعّل» = «لا» (في «الإعدادات العامة» ← قسم «تحتاج قرارك أو موافقة الإدارة»).'))),
      h('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, q), list);
    let seq = 0;
    async function load() {
      const my = ++seq; const v = q.value.trim();
      if (v.length < 2) { list.replaceChildren(); return; }
      try {
        const d = await rpc('rpc_accounts_status', { p: { q: v, limit: 10 } });
        if (my !== seq) return;
        list.replaceChildren(...(d.rows.length ? d.rows.map((r) => {
          const b = h('button', { class: `btn sm ${r.emergency ? '' : 'primary'}`, type: 'button' }, r.emergency ? 'إلغاء التعيين' : 'تعيينه حساب الطوارئ');
          b.addEventListener('click', async () => {
            if (!(await confirmBox(r.emergency ? `إلغاء تعيين «${r.name}» حساباً للطوارئ؟` : `تعيين «${r.name}» حساباً للطوارئ؟ سيتوقف عن العمل ما دام مفتاح الطوارئ مطفأً.`, 'تأكيد'))) return;
            try { const x = await rpc('admin_emergency_mark', { p_person: r.id, p_on: !r.emergency, p_note: null }); toast(x.on ? `عُيّن حساب الطوارئ (المفتاح ${x.switch_on ? 'مشغّل!' : 'مطفأ'})` : 'أُلغي التعيين', 'ok'); load(); }
            catch (e) { fail(e); }
          });
          return h('div', { class: 'list-item row between nowrap' }, h('div', null, h('b', null, r.name), ' ', badge(String(r.code), 'gray'), r.emergency ? [' ', badge('حساب الطوارئ', 'bad')] : null,
            h('div', { class: 'muted xs' }, r.roles || 'بلا تكليف')), b);
        }) : [empty('لا أحد بهذا الاسم.')]));
      } catch (e) { fail(e); }
    }
    q.addEventListener('input', debounce(load, 400));
  }
}
