// قارئ Excel صغير بلا مكتبات خارجية (مصادر البيانات ← رفع Excel، 2026-11-22). يقرأ الملف في جهاز المستخدم فقط.
// يفك ZIP بأداة المتصفح DecompressionStream، ويقرأ الأوراق والنصوص المشتركة والخلايا (نص، رقم، نعم/لا). التواريخ تبقى أرقام Excel وتقرؤها القاعدة.
// يعمل في المتصفح وفي Node 18+ (للاختبارات).
const dec = new TextDecoder();
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflate(data) {
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// الدليل المركزي ← {الاسم: البيانات}
export async function unzip(buf, want = () => true) {
  const b = new Uint8Array(buf);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('الملف ليس ملف Excel صالحاً (xlsx)');
  const n = u16(b, e + 10); let p = u32(b, e + 16); const out = {};
  for (let k = 0; k < n; k++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('ملف Excel تالف');
    const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), lho = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!want(name)) continue;
    const lnl = u16(b, lho + 26), lxl = u16(b, lho + 28);
    const raw = b.subarray(lho + 30 + lnl + lxl, lho + 30 + lnl + lxl + csize);
    out[name] = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
    if (out[name] === null) throw new Error('ضغط غير مدعوم في ملف Excel');
  }
  return out;
}
const ent = (s) => s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (m, x) => (x[0] === '#' ? String.fromCodePoint(x[1] === 'x' || x[1] === 'X' ? parseInt(x.slice(2), 16) : parseInt(x.slice(1), 10))
  : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[x.toLowerCase()]));
const attr = (tag, a) => { const m = tag.match(new RegExp(`\\s${a}="([^"]*)"`)); return m ? ent(m[1]) : null; };
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => ent(m[1])).join('');
const colIdx = (ref) => { const L = (ref.match(/^[A-Z]+/) || ['A'])[0]; let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

// يعيد {sheets: [{name, rows: [[نص…]…]}]}، كل خلية نصاً
export async function readXlsx(buf, { maxRows = 200000 } = {}) {
  const files = await unzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n));
  const wb = files['xl/workbook.xml'] ? dec.decode(files['xl/workbook.xml']) : '';
  if (!wb) throw new Error('الملف ليس ملف Excel صالحاً (لا أوراق فيه)');
  const rels = files['xl/_rels/workbook.xml.rels'] ? dec.decode(files['xl/_rels/workbook.xml.rels']) : '';
  const relMap = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const ss = files['xl/sharedStrings.xml'] ? [...dec.decode(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = attr(m[0], 'name'); const rid = attr(m[0], 'r:id');
    let target = relMap[rid] || ''; target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
    const xml = files[`xl/${target}`] ? dec.decode(files[`xl/${target}`]) : null;
    if (!xml) { sheets.push({ name, rows: [] }); continue; }
    const rows = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
      if (rows.length >= maxRows) break;
      const rIdx = Number(attr(`<x ${rm[1] || rm[3] || ''}>`, 'r')) || rows.length + 1;
      const row = [];
      for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = `<c ${cm[1]}>`; const t = attr(tag, 't'); const ref = attr(tag, 'r'); const inner = cm[2] || '';
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let val = '';
        if (t === 's') val = ss[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(inner);
        else if (t === 'b') val = v === '1' ? 'نعم' : 'لا';
        else if (v != null) val = ent(v);
        const ci = ref ? colIdx(ref) : row.length;
        while (row.length < ci) row.push('');
        row[ci] = val;
      }
      while (rows.length < rIdx - 1) rows.push([]);
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return { sheets };
}

export async function sha256Hex(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
