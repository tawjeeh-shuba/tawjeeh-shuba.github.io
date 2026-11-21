// ملف المعلم بالتبويبات (المرحلة 9): البيانات، والزيارات، والملاحظات، والسجل، والاختبارات (المرحلة 10).
// التبويبات من قائمة تسجيل؛ كل تبويب بشرط ظهوره، فيُضاف «الخطط» في المرحلة 10 بسطر واحد ولا يظهر قبلها.
// كل ما يُعرض من القاعدة بصلاحيات RLS (الموجه: معلموه فقط، ويرى كل زياراتهم وملاحظاتهم حتى من موجهين سابقين).
import { S, h, rpc, get, badge, icon, initial, hijri, depName, perName, seg, sheet, fail, toast, confirmBox, nf } from './core.js';
import { pct, visitButton } from './tlist.js';
import { whatsappSheet, visitsSummarySheet } from './wa.js';
const append = (el, ...k) => el.append(...k.filter((x) => x != null && x !== false));

const TABS = [
  { k: 'البيانات', i: 'user', show: () => true, render: dataTab },
  { k: 'الزيارات', i: 'clipboard', show: (f) => f.can.visits, render: visitsTab },
  { k: 'الملاحظات', i: 'edit', show: (f) => f.can.notes, render: notesTab },
  { k: 'السجل', i: 'list', show: (f) => f.can.log, render: logTab },
  // المرحلة 10ب: تبويب الاختبارات الجديد (exams_tab.js يُحمَّل عند الحاجة، وملخصه يُجلب مسبقاً عند فتح الملف)، بصلاحية «رؤية نتائج الاختبارات» وإعداد «إظهار تبويب الاختبارات»
  { k: 'الاختبارات', i: 'chart', show: (f) => f.can.exams, render: (root, state) => import('./exams_tab.js').then((m) => m.render(root, state)) },
  // المرحلة 11: { k: 'الخطط', i: 'cal', show: (f) => f.can.plans, render: plansTab },
];
const dt = (x) => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(x)); } catch { return x; } };
// «الزيارة القادمة» (المرحلة 9ب): من أحدث زيارة للمعلم إن حُدِّد فيها موعد
function nextBadge(n) {
  if (!n) return null;
  const when = n.overdue ? `متأخرة ${nf(-n.days)} يوماً` : n.days === 0 ? 'اليوم' : n.days === 1 ? 'غداً' : `بعد ${nf(n.days)} أيام`;
  return h('span', { class: `badge ${n.overdue ? 'bad' : 'gold'}`, title: n.by ? `حددها ${n.by}` : null }, `الزيارة القادمة: ${n.hijri || hijri(n.date)} (${when})`);
}
const digits = (m) => String(m || '').replace(/\D/g, '');
const intl = (m) => { const d = digits(m); return d.startsWith('966') ? d : d.startsWith('0') ? '966' + d.slice(1) : '966' + d; };

export async function render(root, ctx) {
  const id = ctx.query.id;
  if (!id) throw new Error('لم يُحدَّد المعلم');
  // الجوال يُطلب مع الملف في الوقت نفسه (لا ينتظر أحدهما الآخر)؛ يعود فارغاً إن لم تكن للمستخدم صلاحية رؤيته
  const mobP = get(`person_mobiles?select=mobile&person_id=eq.${encodeURIComponent(id)}`).then((r) => r[0]?.mobile || null).catch(() => null);
  const f = await rpc('rpc_teacher_file', { p_teacher: id });
  if (!ctx.alive()) return;
  document.getElementById('title').textContent = f.name;
  const state = { visits: null, f, id, ctx, mobP };
  // المرحلة 10ب: ملخص الاختبارات يُجلب مسبقاً بعد رسم الملف مباشرة (لا يزاحم طلب الملف نفسه)، فيفتح التبويب فوراً عند الضغط
  const prefetchExams = () => { if (f.can.exams) import('./exams_tab.js').then((m) => { if (!state.examsP) state.examsP = m.fetchExams(id); state.examsP.live.catch(() => {}); }).catch(() => {}); };
  const tabs = TABS.filter((t) => t.show(f));
  let cur = tabs.find((t) => t.k === ctx.query['تبويب']) || tabs[0];
  const body = h('div');
  const tabBar = h('div');
  const mineH = f.halaqat.filter((x) => x.mine);
  const head = h('section', { class: 'card tfile-head' },
    h('div', { class: 'row nowrap', style: 'gap:12px' },
      h('div', { class: 'avatar lg', 'aria-hidden': 'true' }, initial(f.name)),
      h('div', { class: 'grow' }, h('h2', { style: 'margin:0' }, f.name),
        h('div', { class: 'row', style: 'gap:6px;margin-top:4px' }, badge(String(f.code), 'gray'),
          f.halaqat.length ? badge(`${nf(f.halaqat.length)} حلقة`, 'info') : badge('بلا حلقة حالية', 'warn'),
          nextBadge(f.next_visit)))),
    f.can.record ? h('div', { class: 'btns', style: 'margin-top:12px' },
      visitButton({ id: f.id, name: f.name }, mineH, ctx.go) || h('span')) : null);
  function drawTabs() {
    tabBar.className = 'tfile-tabs';
    tabBar.replaceChildren(seg(tabs.map((t) => ({ value: t.k, label: t.k, icon: t.i })), cur.k, (k) => {
      cur = tabs.find((t) => t.k === k); drawTabs(); show();
      const q = new URLSearchParams({ id, تبويب: k }); history.replaceState(null, '', '#/المعلم?' + q);
    }, { grid: true }));
  }
  async function show() {
    const t0 = performance.now(); const k = cur.k;
    // تبويب الاختبارات يرسم هيكله بنفسه فوراً (بلا قفز في الصفحة)؛ وغيره بالمؤشر المعتاد
    if (k === 'الاختبارات') { const out = h('div', { class: 'ex' }); body.replaceChildren(out); try { await cur.render(out, state); } catch (e) { fail(e); } return; }
    body.replaceChildren(h('p', { class: 'loading' }, 'جارٍ التحميل…'));
    try { const out = h('div'); await cur.render(out, state); body.replaceChildren(out); } catch (e) { body.replaceChildren(); fail(e); }
    rpc('rpc_perf_log', { p_page: `تبويب ${k}`.slice(0, 40), p_kind: 'تبويب', p_ms: Math.round(performance.now() - t0), p_cold: false }).catch(() => {});
  }
  state.reloadTab = show;
  state.goTab = (k, extra) => { cur = tabs.find((t) => t.k === k) || cur; state.extra = extra; drawTabs(); show(); };
  drawTabs();
  root.append(head, tabBar, body);
  await show();
  if (cur.k !== 'الاختبارات') setTimeout(prefetchExams, 0);
}

// ---------- البيانات ----------
async function dataTab(root, { f, mobP }) {
  const mob = await mobP;
  const byPer = new Map();
  f.halaqat.forEach((x) => { const k = x.period || ''; if (!byPer.has(k)) byPer.set(k, []); byPer.get(k).push(x); });
  const deps = [...new Set(f.halaqat.map((x) => depName(x.department)).filter(Boolean))];
  const sups = [...new Set(f.halaqat.map((x) => x.supervisor).filter(Boolean))];
  append(root, 
    h('div', { class: 'card' }, h('h2', null, 'حلقاته في كل فترة'),
      f.halaqat.length ? [...byPer].map(([p, hs]) => h('div', { class: 'list-item' },
        h('div', { class: 'row between' }, h('b', null, perName(p) || 'بلا فترة'), badge(`${hs.length} حلقة`, 'gray')),
        hs.map((x) => h('div', { class: 'hq', style: 'margin-top:8px' },
          h('div', { class: `no ${x.mine ? 'mine' : ''}` }, x.number, h('small', null, x.type)),
          h('div', { class: 'bd' },
            h('div', { class: 'ln' }, h('span', { class: 'k' }, 'القسم:'), h('b', null, depName(x.department) || '—')),
            x.period_detail ? h('div', { class: 'ln' }, h('span', { class: 'k' }, 'تفصيل:'), h('b', null, x.period_detail)) : null,
            h('div', { class: 'ln' }, h('span', { class: 'k' }, 'الموجه:'), x.supervisor ? h('b', null, x.supervisor + (x.mine ? ' (أنت)' : '')) : h('b', { class: 'free-t' }, 'غير مسندة')),
            h('div', { class: 'muted xs' }, `منذ ${hijri(x.since)}`)))))) : h('p', { class: 'empty' }, 'لا حلقة حالية لهذا المعلم')),
    h('div', { class: 'card' }, h('h2', null, 'أقسامه وموجهوه'),
      h('dl', { class: 'kv' },
        h('dt', null, 'الأقسام'), h('dd', null, deps.join('، ') || '—'),
        h('dt', null, 'موجهوه الآن'), h('dd', null, sups.join('، ') || '—'),
        f.past_supervisors?.length ? [h('dt', null, 'زاره من قبل'), h('dd', null, f.past_supervisors.join('، '))] : null)),
    mob ? h('div', { class: 'card' }, h('h2', null, 'التواصل'), h('div', { class: 'btns' },
      h('a', { class: 'btn soft', href: `tel:+${intl(mob)}` }, icon('phone', 20), h('span', { class: 'ltr' }, mob)),
      h('a', { class: 'btn', href: `https://wa.me/${intl(mob)}`, target: '_blank', rel: 'noopener' }, icon('chat', 20), 'واتساب'))) : null);
}

// ---------- الزيارات ----------
function spark(points) {
  const pts = points.filter((p) => p.pct != null);
  if (pts.length < 2) return null;
  const W = 300, H = 84, P = 10;
  const vals = pts.map((p) => Number(p.pct));
  const lo = Math.max(0, Math.min(...vals) - 0.05), hi = Math.min(1, Math.max(...vals) + 0.05);
  const x = (i) => W - P - (i * (W - 2 * P)) / (pts.length - 1);           // من اليمين (الأقدم) إلى اليسار (الأحدث)
  const y = (v) => H - P - ((v - lo) / Math.max(0.01, hi - lo)) * (H - 2 * P);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const dots = vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === vals.length - 1 ? 4.5 : 3}" fill="${i === vals.length - 1 ? 'var(--gold)' : 'var(--ch-1)'}"><title>${hijri(pts[i].date)}: ${pct(v)}</title></circle>`).join('');
  return h('div', { class: 'spark', role: 'img', 'aria-label': `مسار آخر ${pts.length} زيارات: من ${pct(vals[0])} إلى ${pct(vals[vals.length - 1])}`,
    html: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--ch-1)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${dots}</svg>` });
}
const TREND = { 'تحسّن': ['ok', '↑'], 'تراجع': ['bad', '↓'], 'ثبات': ['gray', '←'], 'لا يكفي للحكم': ['gray', ''] };

async function visitsTab(root, state) {
  const { f, id, ctx } = state;
  const d = state.visits ||= await rpc('rpc_teacher_visits', { p_teacher: id, p_limit: 500 });
  const tr = d.trend || {}; const [tk, arrow] = TREND[tr.label] || ['gray', ''];
  const lastN = d.spark.slice(-d.n).map((x) => Number(x.pct));
  const avg = lastN.length ? lastN.reduce((a, b) => a + b, 0) / lastN.length : null;
  const cls = d.summary[0];
  root.append(h('section', { class: 'card trend' },
    h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, 'اتجاه الأداء'), badge(`${arrow} ${tr.label || '—'}`.trim(), tk)),
    h('div', { class: 'muted xs' }, tr.n >= 3 ? `مقارنة متوسط أحدث زياراته بأقدمها في آخر ${tr.n} زيارات رسمية` : 'يلزم 3 زيارات رسمية على الأقل للحكم'),
    spark(d.spark),
    h('div', { class: 'stats compact', style: 'margin:10px 0 0' },
      h('div', { class: 'stat' }, h('b', null, pct(avg)), h('span', null, `متوسط آخر ${lastN.length || d.n}`)),
      h('div', { class: 'stat' }, h('b', null, nf(d.visits.length)), h('span', null, 'كل زياراته')),
      h('div', { class: 'stat' }, h('b', { style: 'font-size:var(--fs-m)' }, cls?.classification || 'لم يُقيَّم'), h('span', null, cls ? cls.period : 'التصنيف')))));
  if (!d.visits.length) { root.append(h('p', { class: 'empty' }, 'لا زيارات مسجلة لهذا المعلم بعد')); return; }
  // المرحلة 9ج: ملخص الزيارات (كلها، أو آخر عدد، أو فترة) بواتساب، ويُسجَّل في «السجل»
  if (f.can.whatsapp) root.append(h('button', { class: 'btn soft block', type: 'button', style: 'margin-bottom:10px', onclick: () => visitsSummarySheet(id, null, () => state.examThanks || []) }, icon('chat', 20), 'إرسال ملخص الزيارات'));
  const halaqat = [...new Set(d.visits.map((v) => v.halaqa).filter(Boolean))];
  const fil = { h: '' };
  const list = h('div'); const more = h('button', { class: 'btn block', type: 'button' }, 'عرض المزيد');
  const cnt = h('div', { class: 'count-line' });
  let shown = 0; const STEP = 20;
  const rows = () => d.visits.filter((v) => !fil.h || v.halaqa === fil.h);
  function draw(reset) {
    if (reset) { list.replaceChildren(); shown = 0; }
    const r = rows(); cnt.textContent = `${nf(r.length)} زيارة${fil.h ? ' في الحلقة ' + fil.h : ' من كل حلقاته'} • الأحدث أولاً`;
    r.slice(shown, shown + STEP).forEach((v) => list.append(visitCard(v, state)));
    shown = Math.min(r.length, shown + STEP); more.hidden = shown >= r.length;
  }
  more.onclick = () => draw(false);
  const hsel = halaqat.length > 1 ? h('select', { 'aria-label': 'تصفية بالحلقة', onchange: (e) => { fil.h = e.target.value; draw(true); } },
    h('option', { value: '' }, 'كل الحلقات'), halaqat.map((x) => h('option', { value: x }, `الحلقة ${x}`))) : null;
  append(root, hsel ? h('div', { class: 'filters' }, h('div', { class: 'full' }, hsel)) : null, cnt, list, more);
  draw(true);
}

function visitCard(v, state) {
  const items = (arr, kind) => arr?.length ? h('div', { class: `vitems ${kind}` }, h('span', { class: 'k' }, kind === 'top' ? 'أقوى البنود' : 'أضعف البنود'),
    h('ul', null, arr.map((x) => h('li', null, x)))) : null;
  return h('article', { class: 'card visit' },
    h('div', { class: 'row between nowrap', style: 'align-items:flex-start' },
      h('div', { class: 'grow' }, h('b', null, v.hijri || hijri(v.date)),
        h('div', { class: 'muted xs' }, [v.supervisor ? 'الموجه: ' + v.supervisor : 'موجه غير مسجل', v.halaqa ? 'الحلقة ' + v.halaqa : '', v.type].filter(Boolean).join(' • '))),
      h('div', { class: 'vscore' }, h('b', null, pct(v.pct)), h('span', null, 'المجموع'))),
    h('div', { class: 'row', style: 'gap:6px;margin:6px 0' },
      v.classification ? badge(v.classification, /ممتاز|متقن/.test(v.classification) ? 'ok' : /متابعة|ضعيف|غير/.test(v.classification) ? 'bad' : 'info') : null,
      v.is_official ? null : badge('غير رسمية', 'gray'), v.source === 'التطبيق' ? badge('جديدة', 'gold') : badge('أرشيف', 'gray'),
      ackBadge(v.ack)),
    h('div', { class: 'vgrid' }, items(v.top, 'top'), items(v.low, 'low')),
    h('div', { class: 'row', style: 'gap:6px;margin-top:8px' },
      h('button', { class: 'btn sm', type: 'button', onclick: () => detailSheet(v.id, state).catch(fail) }, 'التفاصيل'),
      state.f.can.whatsapp ? h('button', { class: 'btn sm soft', type: 'button', onclick: () => whatsappSheet(v.id).catch(fail) }, icon('chat', 18), 'ملخص واتساب') : null,
      state.f.can.notes ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => noteForm(state, null, v) }, icon('plus', 18), 'ملاحظة') : null));
}

// «اطُّلع عليها» / «لم يُطَّلع عليها بعد» (المرحلة 9ب)
const ackBadge = (on) => on ? badge('✓ اطُّلع عليها', 'ok') : badge('لم يُطَّلع عليها بعد', 'gray');

async function detailSheet(vid, state) {
  const d = await rpc('rpc_visit_detail', { p_visit: vid });
  const axes = [...new Set(d.grades.map((g) => g.axis))];
  const acks = d.acks || [];
  d.wa = !!state?.f?.can?.whatsapp;
  const ackBox = h('div', { class: 'ack-box' });
  const drawAck = () => ackBox.replaceChildren(...[
    acks.length ? acks.map((a) => h('div', { class: 'ack ok' }, icon('check', 18), h('span', null, `اطُّلع عليها: ${a.by || '—'} (${a.role || ''}) • ${dt(a.at)}`)))
      : h('div', { class: 'ack' }, icon('info', 18), h('span', null, 'لم يُطَّلع عليها بعد')),
    d.can_ack && acks.some((a) => a.mine) && d.wa ? h('button', { class: 'btn soft block', type: 'button', style: 'margin-top:8px', onclick: () => whatsappSheet(vid, null, 'ack').catch(fail) },
      icon('chat', 20), 'رسالة الاطلاع للمعلم مرة أخرى') : null,
    d.can_ack && !acks.some((a) => a.mine) ? h('button', { class: 'btn primary block', type: 'button', style: 'margin-top:8px', onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        const r = await rpc('rpc_visit_ack', { p_visit: vid });
        if (r.new) acks.push({ by: r.by, role: 'مسؤول القسم', at: r.at, mine: true }); else acks.forEach((a) => { if (a.by === r.by) a.mine = true; });
        toast(r.new ? 'سُجّل الاطلاع باسمك ووقته' : 'اطلاعك مسجّل من قبل', 'ok');
        if (r.whatsapp) d.wa = true;
        drawAck(); state.visits = null;
        if (r.whatsapp) await whatsappSheet(vid, null, 'ack');
      } catch (er) { fail(er); b.disabled = false; }
    } }, icon('check', 20), 'تم الاطلاع') : null].flat().filter(Boolean));
  drawAck();
  sheet({ title: `زيارة ${d.hijri || hijri(d.date)}`, body: h('div', null,
    h('div', { class: 'row', style: 'gap:6px;margin-bottom:8px' }, badge(`المجموع ${pct(d.pct)}`, 'info'), d.classification ? badge(d.classification) : null,
      badge(`قُيّم ${d.rated ?? '—'} من ${d.applicable ?? '—'}`, 'gray')),
    h('div', { class: 'muted xs', style: 'margin-bottom:8px' }, [d.type, d.supervisor ? 'الموجه: ' + d.supervisor : '', d.halaqa ? 'الحلقة ' + d.halaqa : '', d.department, d.period].filter(Boolean).join(' • ')),
    ackBox,
    d.axes.length ? h('div', { class: 'stats compact' }, d.axes.map((a) => h('div', { class: 'stat' }, h('b', null, pct(a.pct)), h('span', null, a.name)))) : null,
    axes.map((ax) => h('details', { open: axes.length < 3 }, h('summary', null, ax),
      d.grades.filter((g) => g.axis === ax).map((g) => h('div', { class: 'list-item' },
        h('div', { class: 'row between' }, h('span', { class: 'grow' }, g.item), badge(g.not_rated ? 'لم يُقيَّم' : g.level || '—', g.not_rated ? 'gray' : '')),
        g.evidence ? h('div', { class: 'muted xs', style: 'margin-top:4px' }, 'ملاحظة: ', g.evidence) : null)))),
    d.public_notes ? h('p', null, h('b', null, 'ملاحظات عامة: '), d.public_notes) : null,
    d.strengths ? h('p', null, h('b', null, 'نقاط القوة: '), d.strengths) : null,
    d.improvements ? h('p', null, h('b', null, 'للتحسين: '), d.improvements) : null,
    d.notes ? h('p', null, h('b', null, 'ملاحظات: '), d.notes) : null,
    d.next_visit_date ? h('p', null, h('b', null, 'موعد الزيارة القادمة: '), d.next_visit_hijri || hijri(d.next_visit_date)) : null), actions: [{ label: 'إغلاق' }] });
}

// ---------- الملاحظات ----------
async function notesTab(root, state) {
  const { f, id } = state;
  const showHidden = !!state.showHidden;
  const notes = await rpc('rpc_teacher_notes', { p_teacher: id, p_include_hidden: showHidden });
  root.append(h('div', { class: 'row between', style: 'margin-bottom:10px' },
    h('button', { class: 'btn primary', type: 'button', onclick: () => noteForm(state) }, icon('plus', 20), 'ملاحظة جديدة'),
    h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { state.showHidden = !showHidden; state.reloadTab(); } }, showHidden ? 'إخفاء المخفية' : 'إظهار المخفية')));
  if (!notes.length) { root.append(h('p', { class: 'empty' }, 'لا ملاحظات بعد. الملاحظة تُكتب للمعلم، وربطها بزيارة اختياري.')); return; }
  notes.forEach((n) => root.append(h('article', { class: `card note-card ${n.hidden ? 'hidden-note' : ''}` },
    h('div', { class: 'row between' }, badge(n.category, n.category === 'إشادة' ? 'ok' : 'info'), n.hidden ? badge('مخفية', 'gray') : null),
    h('p', { style: 'margin:8px 0;white-space:pre-wrap' }, n.body),
    h('div', { class: 'muted xs' }, [n.author, dt(n.at), n.edited ? 'معدّلة' : '', n.visit_date ? 'مرتبطة بزيارة ' + hijri(n.visit_date) : '', n.hidden && n.hide_reason ? 'سبب الإخفاء: ' + n.hide_reason : ''].filter(Boolean).join(' • ')),
    h('div', { class: 'row', style: 'gap:6px;margin-top:8px' },
      n.can_edit && !n.hidden ? h('button', { class: 'btn sm', type: 'button', onclick: () => noteForm(state, n) }, icon('edit', 18), 'تعديل') : null,
      n.can_edit ? h('button', { class: `btn sm ${n.hidden ? 'soft' : 'danger'}`, type: 'button', onclick: () => hideNote(state, n) }, n.hidden ? 'إعادة إظهار' : 'إخفاء') : null,
      h('button', { class: 'btn sm ghost', type: 'button', onclick: () => noteHistory(state, n).catch(fail) }, 'سجل التعديلات')))));
}

async function noteForm(state, n = null, visit = null) {
  const { f, id } = state;
  const cats = Array.isArray(f.note_categories) ? f.note_categories : [];
  const cat = h('select', null, [...new Set([...(n ? [n.category] : []), ...cats])].map((c) => h('option', { value: c }, c)));
  if (n) cat.value = n.category;
  const txt = h('textarea', { rows: 5, placeholder: 'نص الملاحظة', maxlength: 4000 }); if (n) txt.value = n.body;
  let vlist = state.visits?.visits;
  if (!vlist && f.can.visits) { try { state.visits = await rpc('rpc_teacher_visits', { p_teacher: id, p_limit: 500 }); vlist = state.visits.visits; } catch { vlist = []; } }
  const vsel = h('select', null, h('option', { value: '' }, 'بلا ربط بزيارة'), (vlist || []).slice(0, 60).map((v) => h('option', { value: v.id }, `${v.hijri || hijri(v.date)}${v.halaqa ? ' • الحلقة ' + v.halaqa : ''}`)));
  vsel.value = visit?.id || n?.visit_id || '';
  const err = h('div', { class: 'err', hidden: true });
  sheet({ title: n ? 'تعديل الملاحظة' : 'ملاحظة جديدة', body: h('div', null,
    h('label', { class: 'field' }, h('span', null, 'التصنيف'), cat), h('label', { class: 'field' }, h('span', null, 'الملاحظة'), txt),
    h('label', { class: 'field' }, h('span', null, 'ربطها بزيارة (اختياري)'), vsel),
    n ? h('p', { class: 'muted xs' }, 'التعديل يُحفظ في السجل بالقيمة السابقة، ويمكن استرجاعها.') : null, err),
    actions: [{ label: 'حفظ', kind: 'primary', onClick: async (close) => {
      if (!txt.value.trim()) { err.textContent = 'اكتب نص الملاحظة'; err.hidden = false; return; }
      await rpc('rpc_note_save', { p_id: n?.id || null, p_teacher: id, p_category: cat.value, p_body: txt.value, p_visit: vsel.value || null, p_row_version: null });
      close(); toast('حُفظت الملاحظة', 'ok');
      if (!n) state.goTab('الملاحظات'); else state.reloadTab();
    } }, { label: 'تراجع' }] });
  setTimeout(() => txt.focus(), 80);
}

async function hideNote(state, n) {
  const reason = h('input', { type: 'text', placeholder: n.hidden ? 'سبب إعادة الإظهار' : 'سبب الإخفاء' });
  sheet({ title: n.hidden ? 'إعادة إظهار الملاحظة' : 'إخفاء الملاحظة', body: h('div', null,
    h('p', { class: 'muted small' }, n.hidden ? 'تعود الملاحظة للظهور في الملف.' : 'لا تُحذف الملاحظة: تختفي من الملف وتبقى محفوظة، ويمكن إعادة إظهارها.'), h('label', { class: 'field' }, h('span', null, 'السبب'), reason)),
    actions: [{ label: n.hidden ? 'أعد إظهارها' : 'أخفِها', kind: n.hidden ? 'primary' : 'danger', onClick: async (close) => {
      if (!reason.value.trim()) { reason.focus(); return; }
      await rpc('rpc_note_set_hidden', { p_id: n.id, p_hidden: !n.hidden, p_reason: reason.value }); close(); state.reloadTab();
    } }, { label: 'تراجع' }] });
}

async function noteHistory(state, n) {
  const hist = await rpc('rpc_note_history', { p_id: n.id });
  const FIELD = { body: 'النص', category: 'التصنيف', visit_id: 'الزيارة المرتبطة', is_hidden: 'الإخفاء', hide_reason: 'سبب الإخفاء' };
  const close = sheet({ title: 'سجل تعديلات الملاحظة', body: h('div', null, hist.map((x) => h('div', { class: 'list-item' },
    h('div', { class: 'muted xs' }, `${x.by || '—'} • ${dt(x.at)}`),
    x.action === 'INSERT' ? h('b', null, 'كُتبت الملاحظة') : h('div', null, h('b', null, `${FIELD[x.field] || x.field}: `),
      x.field === 'is_hidden' ? (x.new === 'true' ? 'أُخفيت' : 'أُعيد إظهارها') : h('span', null, h('del', { class: 'muted' }, x.old || '—'), ' ← ', x.new || '—'),
      (x.field === 'body' || x.field === 'category') && n.can_edit && !n.hidden ? h('div', null, h('button', { class: 'btn sm soft', type: 'button', style: 'margin-top:6px', onclick: async () => {
        if (!(await confirmBox('تُسترجع القيمة السابقة بتعديل جديد يُسجَّل باسمك. متابعة؟', 'استرجع'))) return;
        try { await rpc('rpc_note_restore', { p_id: n.id, p_audit_id: x.audit_id }); close(); toast('استُرجعت القيمة السابقة', 'ok'); state.reloadTab(); } catch (e) { fail(e); }
      } }, 'استرجاع القيمة السابقة')) : null)))), actions: [{ label: 'إغلاق' }] });
}

// ---------- السجل ----------
// «ملخص الزيارات» (المرحلة 9ج): عدد الزيارات ومداها، وطريقة الاختيار
const sumNote = (d) => !d ? '' : ` (${d.count} زيارة${d.first_h ? ' من ' + d.first_h + ' إلى ' + d.last_h : ''}${d.mode === 'last' ? '، آخر ' + d.n : d.mode === 'range' ? '، فترة محددة' : '، كل الزيارات'})`;
async function logTab(root, state) {
  const { id, f } = state;
  // قسم «الخطط» (خطط الاختبارات العلاجية: التاريخ والمصدر والهدف والحالة والنص الكامل مع الإلغاء والاسترجاع) أعلى السجل
  if (f.can.exams) root.append((await import('./exams_tab.js')).plansSection(state));
  const rows = await rpc('rpc_teacher_log', { p_teacher: id });
  root.append(h('p', { class: 'muted small' }, 'كل ما أُرسل أو فُتح للإرسال بخصوص هذا المعلم، واطلاع مسؤول القسم على زياراته. «فُتح للإرسال» يعني أن واتساب فُتح برسالة جاهزة، ولا يعني أنها وصلت.'));
  if (!rows.length) { root.append(h('p', { class: 'empty' }, 'لا شيء في السجل بعد')); return; }
  root.append(h('div', { class: 'card' }, rows.map((r) => h('div', { class: 'list-item row nowrap', style: 'gap:12px;align-items:flex-start' },
    h('span', { class: 'menu-ic' }, icon(r.channel ? 'chat' : 'check', 20)),
    h('div', { class: 'grow' }, h('b', null, `${r.kind}${r.visit_date ? ' (زيارة ' + hijri(r.visit_date) + ')' : ''}${sumNote(r.details)} — ${r.status}${r.channel ? ' عبر ' + r.channel : ''}`),
      h('div', { class: 'muted xs' }, [r.by || '—', dt(r.at), r.channel ? (r.to_teacher ? 'على رقم المعلم' : 'المرسل اختار المستلم') : ''].filter(Boolean).join(' • ')))))));
}
// ---------- الاختبارات: انتقل إلى exams_tab.js (المرحلة 10ب) ----------
