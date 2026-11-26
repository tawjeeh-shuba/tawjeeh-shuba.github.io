// لوحة التحكم ← «جودة بيانات الاختبارات» (لمسؤول الشعبة ومساعده فقط؛ والفحص في القاعدة: عمل «إدارة دفعات الاختبارات»).
// نتائج الاختبارات ترصدها لجنة الاختبارات في موقعها وتسلّم الشعبة ملف Google Sheet، فـ«لم تُرصد» مسؤولية اللجنة لا المعلم.
// هذه اللوحة تعرض عدد «لم تُرصد» حسب الشهر والقسم والمعلم، ونسبة الرصد العامة، وأكثر الأشهر نقصاً، ومعها تصدير قائمة للجنة.
// لا اسم طالب في اللوحة. التصدير يتبع مفتاحي «إظهار أسماء الطلاب» و«أسماء الطلاب في التصدير» (الفحص في القاعدة)، ويُسجَّل في سجل الوصول.
import { h, rpc, nf, badge, toast, fail, icon, depName } from './core.js';
import { periodName, pct, arCount, obsRate } from './exams_logic.js';
import { workbook, download } from './xlsx.js';
import { offNotice } from './off_notice.js';

const KIND = { TERM: 'فصلية', MONTHLY: 'تنشيطية' };
let PRE = null;
export const prefetch = () => { PRE ||= rpc('rpc_exam_quality').catch(() => { PRE = null; return null; }); };

const fileName = (label) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${label} ${String(p.year).replace(/\D/g, '')}-${p.month}-${p.day}هـ.xlsx`;
};
const share = (nr, t) => (t ? nr / t : null);

export async function render(root) {
  const q = await (PRE || rpc('rpc_exam_quality')); PRE = null;
  const mx = Number(q.max) || 0.25;
  const total = { t: Number(q.total.t), nr: Number(q.total.nr) };
  const obs = obsRate({ t: total.t, r: total.nr });
  const months = q.months.map((m) => ({ ...m, k: m.k, label: `${KIND[m.k] || m.k} — ${periodName({ k: m.k, y: m.y, n: m.n })}`, sh: share(m.nr, m.t) }));
  const worst = months.filter((m) => m.nr > 0).slice().sort((a, b) => b.nr - a.nr || (b.sh ?? 0) - (a.sh ?? 0)).slice(0, 5);
  const rowsAll = q.rows.map(([k, y, n, dep, tid, code, name, t, nr]) => ({ k, y, n, dep, tid, code, name, t, nr }));

  root.append(h('p', { class: 'muted' }, 'نتائج الاختبارات ترصدها لجنة الاختبارات في موقعها وتسلّم الشعبة ملف Google Sheet (جدول جوجل)، فعدد «لم تُرصد» مسؤولية اللجنة لا المعلم. ',
    'هذه الأرقام تساعدك في مطالبتها بإكمال الرصد؛ ولا تدخل في حكم المعلم ولا في نقاط ضعفه.'));
  root.append(h('div', { class: 'stats compact' },
    h('div', { class: 'stat' }, h('b', null, pct(obs, 1)), h('span', null, 'نسبة الرصد العامة')),
    h('div', { class: 'stat' }, h('b', null, nf(total.nr)), h('span', null, `لم تُرصد من ${nf(total.t)} مرشحاً`)),
    h('div', { class: 'stat' }, h('b', null, nf(q.units.weak)), h('span', null, `اختباراً لمعلم ضعف رصده (أكثر من ${pct(mx, 0)} لم تُرصد) من ${nf(q.units.n)}`)),
    // «غائب» سجّلته اللجنة: ليس من «لم تُرصد» (قرار عبدالكريم 2026-11-23)، ويظهر رقماً مستقلاً إن وُجد
    Number(q.total.ab) ? h('div', { class: 'stat' }, h('b', null, nf(q.total.ab)), h('span', null, 'غائب (سجّلته اللجنة، فهو مرصود وليس من «لم تُرصد»)')) : null));

  // أكثر الأشهر نقصاً
  root.append(h('section', { class: 'card' }, h('h2', null, 'أكثر الأشهر نقصاً في الرصد'),
    worst.length ? h('ol', { class: 'xr-slist' }, worst.map((m) => h('li', { class: 'list-item' },
      h('div', { class: 'row between' }, h('b', null, m.label), badge(`${nf(m.nr)} لم تُرصد`, 'gray')),
      h('div', { class: 'muted xs' }, `من ${nf(m.t)} مرشحاً (${pct(m.sh, 1)}) • عند ${arCount(m.teachers, 'teacher', { one: false })} • نسبة الرصد ${pct(obsRate({ t: m.t, r: m.nr }), 1)}`)))) : h('p', { class: 'empty' }, 'رُصدت كل النتائج')));

  // التفصيل: الشهر ← القسم ← المعلم
  const list = h('div');
  const byMonth = new Map(); rowsAll.forEach((r) => { const k = `${r.k}|${r.y}|${r.n}`; if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(r); });
  months.filter((m) => m.nr > 0).forEach((m) => {
    const rows = byMonth.get(`${m.k}|${m.y}|${m.n}`) || [];
    let built = false; const inner = h('div');
    const el = h('details', { class: 'card' }, h('summary', null, h('b', null, m.label), ' ', badge(`${nf(m.nr)} لم تُرصد من ${nf(m.t)} (${pct(m.sh, 1)})`, 'gray')), inner);
    el.addEventListener('toggle', () => {
      if (!el.open || built) return; built = true;
      const deps = new Map(); rows.forEach((r) => { if (!deps.has(r.dep)) deps.set(r.dep, []); deps.get(r.dep).push(r); });
      const ds = [...deps].map(([dep, rs]) => ({ dep, rs, nr: rs.reduce((a, r) => a + r.nr, 0), t: rs.reduce((a, r) => a + r.t, 0) })).sort((a, b) => b.nr - a.nr);
      inner.replaceChildren(...ds.map((d) => h('details', { class: 'list-item' },
        h('summary', null, h('b', null, depName(d.dep) || q.deps[d.dep] || d.dep), ' ', h('span', { class: 'muted xs' }, `${nf(d.nr)} لم تُرصد من ${nf(d.t)}`)),
        h('div', null, d.rs.slice().sort((a, b) => b.nr - a.nr).map((r) => h('div', { class: 'row between xs', style: 'gap:8px;padding:4px 0' },
          h('span', null, `${r.code ? r.code + ' — ' : ''}${r.name || 'معلم غير مطابق'}`),
          h('span', { class: r.t && r.nr / r.t > mx ? 'xr-lowobs' : 'muted' }, `${nf(r.nr)} من ${nf(r.t)} (${pct(share(r.nr, r.t), 0)})`)))))));
    });
    list.append(el);
  });
  root.append(h('h2', null, 'لم تُرصد حسب الشهر والقسم والمعلم'), list.children.length ? list : h('p', { class: 'empty' }, 'لا نتائج غير مرصودة'));

  // تصدير قائمة للجنة الاختبارات
  const sel = h('select', { 'aria-label': 'الاختبار' }, h('option', { value: '' }, 'كل الاختبارات'),
    months.filter((m) => m.nr > 0).map((m) => h('option', { value: `${m.k}|${m.y}|${m.n}` }, `${m.label} (${nf(m.nr)})`)));
  const msg = h('p', { class: 'muted xs' }, q.names_export ? 'مفتاحا الأسماء مشغَّلان: القائمة بأسماء الطلاب وأرقام تسجيلهم، ويُسجَّل التصدير في «سجل الوصول».'
    : 'القائمة الآن بالأعداد لكل معلم واختبار، بلا أسماء طلاب.');
  // رسالة «مطفأ» الموحدة: ما المطفأ ولماذا ومن يشغّله، ولمسؤول الشعبة زر «افتح الإعداد»
  const offBox = q.names_export ? null : offNotice('students.names_in_export', { what: 'إعداد «أسماء الطلاب في التصدير» مطفأ الآن.' });
  const btn = h('button', { type: 'button', class: 'btn primary block', onclick: async () => {
    btn.disabled = true;
    try {
      const [k, y, n] = sel.value ? sel.value.split('|') : ['', '', ''];
      const r = await rpc('rpc_exam_quality_export', { p: { kind: k, year: y, no: n } });
      const pn = (x) => `${KIND[x.k] || x.k} — ${periodName({ k: x.k, y: x.y, n: x.n })}`;
      const sheet = r.names
        ? { name: 'لم تُرصد نتائجهم', columns: [{ key: 'name', label: 'الطالب', width: 32 }, { key: 'reg', label: 'رقم التسجيل', width: 14 }, { key: 'per', label: 'الاختبار', width: 28 },
          { key: 'tcode', label: 'رقم المعلم', width: 10 }, { key: 'teacher', label: 'المعلم', width: 30 }, { key: 'dep', label: 'القسم', width: 26 }, { key: 'track', label: 'المسار', width: 26 }],
        rows: r.rows.map((x) => ({ name: x.name, reg: x.reg, per: pn(x), tcode: x.tcode || '', teacher: x.teacher || '', dep: depName(x.dep) || x.dep || '', track: x.track || '' })) }
        : { name: 'لم تُرصد حسب المعلم', columns: [{ key: 'per', label: 'الاختبار', width: 28 }, { key: 'tcode', label: 'رقم المعلم', width: 10 }, { key: 'teacher', label: 'المعلم', width: 30 },
          { key: 'dep', label: 'القسم', width: 26 }, { key: 't', label: 'المرشحون' }, { key: 'nr', label: 'لم تُرصد' }, { key: 'sh', label: 'نسبة لم تُرصد (٪)' }],
        rows: r.rows.map((x) => ({ per: pn(x), tcode: x.tcode || '', teacher: x.teacher || '', dep: depName(x.dep) || x.dep || '', t: x.t, nr: x.nr, sh: x.t ? Math.round((x.nr / x.t) * 1000) / 10 : null })) };
      if (!sheet.rows.length) { toast('لا نتائج غير مرصودة في هذا الاختيار'); return; }
      download(await workbook([sheet]), fileName('قائمة للجنة الاختبارات — لم تُرصد'));
      toast(`صُدِّر ${nf(sheet.rows.length)} صفاً${r.names ? ' بالأسماء (سُجّل في سجل الوصول)' : ''}`, 'ok');
    } catch (e) { fail(e); } finally { btn.disabled = false; }
  } }, icon('layers', 20), 'تصدير قائمة للجنة الاختبارات');
  root.append(h('section', { class: 'card' }, h('h2', null, 'قائمة للجنة الاختبارات'),
    h('p', { class: 'muted small' }, 'تُرسَل للجنة لتكمل رصد النتائج. تتبع مفتاح «الأسماء في التصدير» الحالي.'),
    h('label', { class: 'field' }, h('span', null, 'الاختبار'), sel), msg, offBox, btn));
}
