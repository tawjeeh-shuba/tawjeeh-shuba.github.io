// المرحلة 12 (أمر صاحب النظام 2026-11-26 ج): الرسائل «بخصوص معلم» — تبويب «الرسائل» في ملف المعلم، وصفحة «الرسائل» (صندوقي).
// الحارس الحقيقي في القاعدة (feature.teacher_msgs، ودور المرسل: موجه الحلقة الحالي، أو مسؤول قسمها، أو مسؤول الشعبة/مساعده، وعزل التجريبي).
// النصوص تُعرض نصاً فقط (h() يضع textContent). الرسالة لا تُعدَّل ولا تُحذف.
import { h, rpc, badge, nf, toast, fail, empty, icon } from './core.js';
import { uuid } from './plans_api.js';

const when = (t) => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(t)); } catch { return t; } };
const DRAFT = (tid) => `tawjeeh.tmsg.${tid}`;
const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* */ } } };

// ---------- تبويب «الرسائل» في ملف المعلم ----------
export async function tab(root, state) {
  const tid = state.id;
  const d = await rpc('rpc_tmsg_thread', { p_teacher: tid });
  if (!d.on) { root.append(h('section', { class: 'card' }, h('p', { class: 'muted' }, 'الرسائل بخصوص معلم مطفأة الآن.'))); return; }
  const list = h('div', { 'data-tmsg-list': String(d.messages.length) });
  const draw = (msgs) => list.replaceChildren(...(msgs.length ? msgs.map((m) => h('div', { class: `list-item${m.mine ? ' mine' : ''}`, 'data-tmsg': m.id },
    h('div', { class: 'row between nowrap', style: 'gap:8px' }, h('b', { class: 'small' }, m.author || ''), h('span', { class: 'row', style: 'gap:4px' }, badge(m.role, 'gray'), h('span', { class: 'muted xs' }, when(m.at)))),
    h('div', { class: 'small', style: 'white-space:pre-wrap;margin-top:4px' }, m.body))) : [empty('لا رسائل بخصوص هذا المعلم بعد.')]));
  draw(d.messages);
  const ta = h('textarea', { rows: 3, maxlength: '1000', placeholder: 'اكتب رسالة بخصوص المعلم (تصل إلى موجهه ومسؤول قسمه ومسؤول الشعبة ومساعده)', 'aria-label': 'نص الرسالة', 'data-act': 'tmsg-body',
    oninput: () => store.set(DRAFT(tid), ta.value) });
  ta.value = store.get(DRAFT(tid));
  let pendingId = null;
  const send = h('button', { type: 'button', class: 'btn primary', 'data-act': 'tmsg-send', onclick: async () => {
    const body = ta.value.trim();
    if (!body) { toast('اكتب نص الرسالة', 'bad'); return; }
    send.disabled = true; pendingId ||= uuid();
    try {
      await rpc('rpc_tmsg_send', { p: { id: pendingId, teacher: tid, body } });
      pendingId = null; ta.value = ''; store.set(DRAFT(tid), '');
      toast('أُرسلت الرسالة', 'ok');
      const x = await rpc('rpc_tmsg_thread', { p_teacher: tid }); draw(x.messages);
    } catch (e) { fail(e); } finally { send.disabled = false; }
  } }, icon('send', 18), ' أرسل');
  root.append(h('section', { class: 'card' },
    h('h2', { style: 'margin:0 0 6px' }, 'الرسائل بخصوص المعلم'),
    h('p', { class: 'muted xs' }, `دورك هنا: ${d.role}. يرى الرسائل موجه الحلقة الحالي ومسؤول قسمها ومسؤول الشعبة ومساعده، ولا يراها المعلم. لا تُعدَّل الرسالة ولا تُحذف بعد إرسالها.`),
    list, h('label', { class: 'field', style: 'margin-top:8px' }, h('span', null, 'رسالة جديدة'), ta, h('small', null, 'حتى 1000 حرف. لا تكتب أرقام جوالات أو بيانات طلاب.')), send));
}

// ---------- صفحة «الرسائل»: المعلمون الذين فيهم رسائل (غير المقروء أولاً) ----------
export async function render(root, ctx) {
  const d = await rpc('rpc_tmsg_inbox');
  if (!ctx.alive()) return;
  if (!d.on) { root.append(h('section', { class: 'card' }, h('h2', null, 'الرسائل'), h('p', { class: 'muted' }, 'الرسائل بخصوص معلم مطفأة الآن.'))); return; }
  const unread = d.threads.reduce((a, t) => a + (t.unread || 0), 0);
  root.append(h('section', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, 'الرسائل بخصوص المعلمين'), badge(unread ? `${nf(unread)} غير مقروءة` : 'لا جديد', unread ? 'warn' : 'ok')),
    h('p', { class: 'muted xs' }, 'آخر 180 يوماً. لبدء رسالة جديدة: افتح ملف المعلم ← تبويب «الرسائل».'),
    d.threads.length ? h('div', { 'data-tmsg-inbox': String(d.threads.length) }, d.threads.map((t) => h('a', { class: 'list-item row between nowrap', style: 'gap:8px',
      href: '#/المعلم?' + new URLSearchParams({ id: t.teacher_id, تبويب: 'الرسائل' }) },
      h('div', { class: 'grow' }, h('b', null, t.teacher), h('div', { class: 'muted xs' }, `${t.last_role}: ${t.last_body}`)),
      h('span', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, t.unread ? badge(nf(t.unread), 'bad') : null, h('span', { class: 'muted xs' }, when(t.last_at)))))) : empty('لا رسائل بعد.')));
}
