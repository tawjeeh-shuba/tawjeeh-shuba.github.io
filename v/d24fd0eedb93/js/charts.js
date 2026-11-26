// رسوم بيانية بسيطة بـ SVG بلا مكتبات. كل رسم: عنوان عربي، وأرقام ظاهرة، ويتكيّف مع الوضع الليلي (ألوان من متغيرات الهوية)،
// وكل جزء يُضغط يفتح القائمة المفلترة إن أُعطي رابطاً (قراءة فقط).
import { h, nf } from './core.js';
import { icon } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(String(c))));
  return e;
};
const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);
const frame = (title, ico, sub, ...body) => h('section', { class: 'card chart', 'aria-label': title },
  h('h2', null, ico ? icon(ico, 20) : null, title), sub ? h('p', { class: 'sub' }, sub) : null, ...body);
const link = (href, attrs, ...kids) => (href ? h('a', { href, ...attrs }, ...kids) : h('div', attrs, ...kids));

// حلقة نسبة: parts = [{label, value, color, href}]
export function donut({ title, ico, sub, parts, center }) {
  const total = parts.reduce((a, p) => a + (p.value || 0), 0);
  const r = 46, C = 2 * Math.PI * r, gap = total && parts.filter((p) => p.value).length > 1 ? 2 : 0;
  const g = s('g', { transform: 'rotate(-90 60 60)' }, s('circle', { cx: 60, cy: 60, r, fill: 'none', stroke: 'var(--ch-track)', 'stroke-width': 16 }));
  let off = 0;
  parts.forEach((p) => {
    if (!p.value) return;
    const len = (p.value / total) * C;
    const arc = s('circle', { cx: 60, cy: 60, r, fill: 'none', stroke: p.color, 'stroke-width': 16,
      'stroke-dasharray': `${Math.max(len - gap, 0.01)} ${C}`, 'stroke-dashoffset': -off });
    arc.append(s('title', {}, `${p.label}: ${nf(p.value)} (${pct(p.value, total)}٪)`));
    g.append(p.href ? s('a', { href: p.href, 'aria-label': `${p.label}: ${nf(p.value)}` }, arc) : arc);
    off += len;
  });
  const svgEl = s('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': `${title}: ` + parts.map((p) => `${p.label} ${nf(p.value)}`).join('، ') }, g,
    s('text', { x: 60, y: 58, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:22px;font-weight:700;font-variant-numeric:tabular-nums' }, center?.value ?? nf(total)),
    s('text', { x: 60, y: 77, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font-size:10.5px;font-weight:600' }, center?.label ?? 'المجموع'));
  const legend = h('div', { class: 'legend' }, parts.map((p) => link(p.href, { 'aria-label': `${p.label}: ${nf(p.value)}` },
    h('i', { class: 'dot', style: `background:${p.color}` }), h('span', { class: 'lb' }, p.label),
    h('span', { class: 'v' }, nf(p.value)), h('span', { class: 'p' }, `${pct(p.value, total)}٪`))));
  return frame(title, ico, sub, h('div', { class: 'donut' }, svgEl, legend));
}

// أعمدة رأسية: items = [{label, value, href}] بترتيبها (مثل ترتيب الفترات في اليوم)
export function columns({ title, ico, sub, items, color = 'var(--ch-1)', height = 140 }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  const box = h('div', { class: items.length > 6 ? 'cols stagger' : 'cols', role: 'list' }, items.map((it) => {
    const bh = Math.max(3, Math.round(((it.value || 0) / max) * height));
    const bar = s('svg', { viewBox: `0 0 28 ${bh}`, height: bh, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      s('rect', { x: 0, y: 0, width: 28, height: bh, rx: Math.min(6, bh / 2), fill: it.value ? (it.color || color) : 'var(--ch-track)' }));
    return link(it.href, { role: 'listitem', 'aria-label': `${it.label}: ${nf(it.value)}` },
      h('span', { class: 'v' }, nf(it.value)), bar, h('span', { class: 'lb' }, it.label));
  }));
  return frame(title, ico, sub, box);
}

// أشرطة أفقية مرتبة ومجزأة: items = [{label, parts:[{value,color}], href, extra}], keys = [{label,color}]
export function hbars({ title, ico, sub, items, keys, limit = 8, moreLabel = 'عرض الكل' }) {
  const totals = items.map((i) => i.parts.reduce((a, p) => a + (p.value || 0), 0));
  const max = Math.max(1, ...totals);
  const row = (it, i) => {
    const t = totals[i];
    const svgEl = s('svg', { viewBox: '0 0 100 10', preserveAspectRatio: 'none', 'aria-hidden': 'true', style: 'border-radius:99px' },
      s('rect', { x: 0, y: 0, width: 100, height: 10, fill: 'var(--ch-track)' }));
    let x = 100;                                    // من اليمين (اتجاه القراءة العربي)
    it.parts.forEach((p) => {
      const w = ((p.value || 0) / max) * 100;
      if (w > 0) { x -= w; svgEl.append(s('rect', { x, y: 0, width: w, height: 10, fill: p.color })); }
    });
    return link(it.href, { 'aria-label': `${it.label}: ${nf(t)}${it.extra ? '، ' + it.extra : ''}` },
      h('div', { class: 't' }, h('span', { class: 'lb' }, it.label), it.extra ? h('span', { class: 'x' }, it.extra) : null, h('span', { class: 'v' }, nf(t))), svgEl);
  };
  const list = h('div', { class: 'hbars' });
  const draw = (all) => list.replaceChildren(...items.slice(0, all ? items.length : limit).map(row));
  draw(false);
  const more = items.length > limit ? h('button', { class: 'btn ghost block more-btn', type: 'button', 'aria-expanded': 'false' }, `${moreLabel} (${nf(items.length)})`) : null;
  more?.addEventListener('click', () => {
    const open = more.getAttribute('aria-expanded') !== 'true';
    draw(open); more.setAttribute('aria-expanded', String(open)); more.textContent = open ? 'عرض أقل' : `${moreLabel} (${nf(items.length)})`;
  });
  const keyRow = keys?.length ? h('div', { class: 'keys' }, keys.map((k) => h('span', null, h('i', { class: 'dot', style: `background:${k.color}` }), k.label))) : null;
  return frame(title, ico, sub, keyRow, list, more);
}
