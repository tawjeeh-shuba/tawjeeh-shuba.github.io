// بناة الاستعلامات (دوال نقية بلا اعتماد على المتصفح، فتُختبر محلياً).
export const SIZE = 25;
// فلتر «إخفاء الحلقات غير محددة القطاع» (واجهة فقط): تضبطه core.js من اختيار المستخدم المحفوظ في جهازه. الافتراضي: الإظهار.
// (إخفاء الحلقات النسائية ليس هنا: هو إعداد في لوحة التحكم ويُطبَّق في القاعدة.)
export const HIDE = { unspecified: false };
// شرط PostgREST على عمود القطاع (prefix للجداول المضمّنة مثل 'h.' أو 'links.h.'). فارغ إن لم يُخفَ شيء. القطاع غير المحدد = null.
export function sectorParam(prefix = '') {
  if (HIDE.unspecified) return `${prefix}sector=not.is.null`;
  return '';
}
export const sectorQS = (prefix = '') => { const p = sectorParam(prefix); return p ? '&' + p : ''; };
// للصفوف المجمّعة (dept_period_summary) حيث غير المحدد نصّ «غير محدد»
export const sectorOK = (s) => !(HIDE.unspecified && (!s || s === 'غير محدد'));
const E = encodeURIComponent;
// مطابقة عربية متسامحة: الألف والياء والتاء المربوطة تقابل أي حرف
export const fuzzy = (q) => String(q).trim().replace(/[%*,()."\\]/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/[أإآا]/g, '_').replace(/[ةه]/g, '_').replace(/[يى]/g, '_').replace(/ /g, '*');
const like = (q) => E('*' + fuzzy(q) + '*');

export const HALAQA_SELECT = 'number,sector,is_active,is_approved,department_code,period_code,period_detail,needs_confirmation,confirmation_reason,notes,'
  + 'halaqa_teachers(id,type,valid_to,person:persons!person_id(id,full_name,display_code)),'
  + 'halaqa_supervisors(id,valid_to,person:persons!person_id(id,full_name))';

// f: {q, dep, per, sector, status, me}
export function halaqatQuery(f, offset = 0, size = SIZE) {
  let sel = HALAQA_SELECT;
  const p = [];
  const q = (f.q || '').trim();
  if (q) {
    if (/^\d+$/.test(q)) p.push('number=like.' + E(q + '*'));
    else {
      sel = sel.replace('halaqa_teachers(', 'halaqa_teachers!inner(').replace('person:persons!person_id(id,full_name,display_code)', 'person:persons!person_id!inner(id,full_name,display_code)');
      p.push('halaqa_teachers.person.full_name=ilike.' + like(q));
    }
  }
  if (f.dep) p.push('department_code=eq.' + E(f.dep));
  if (f.per) p.push('period_code=eq.' + E(f.per));
  if (f.sector) p.push('sector=eq.' + E(f.sector));
  if (f.status === 'نشطة') p.push('is_active=eq.true');
  if (f.status === 'غير نشطة') p.push('is_active=eq.false');
  if (f.status === 'بلا معلم') { p.push('is_active=eq.true', 'halaqa_teachers=is.null'); }
  if (f.status === 'بلا موجه') { p.push('is_active=eq.true', 'halaqa_supervisors=is.null'); }
  if (f.status === 'مسندة لي' && f.me) {
    sel = sel.replace('halaqa_supervisors(', 'halaqa_supervisors!inner(');
    p.push('halaqa_supervisors.person_id=eq.' + E(f.me));
  }
  if (f.status === 'عند غيري' && f.me) {
    sel = sel.replace('halaqa_supervisors(', 'halaqa_supervisors!inner(');
    p.push('halaqa_supervisors.person_id=neq.' + E(f.me));
  }
  if (f.active) p.push('is_active=eq.true');
  if (f.status === 'تحتاج تأكيد') p.push('needs_confirmation=eq.true');
  { const sp = sectorParam(); if (sp) p.push(sp); }
  p.push('halaqa_teachers.valid_to=is.null', 'halaqa_supervisors.valid_to=is.null');
  return `halaqat?select=${sel}&${p.join('&')}&order=number&limit=${size}&offset=${offset}`;
}

export const TEACHER_SELECT = 'id,display_code,full_name,sector,mob:person_mobiles(mobile),nat:person_nationalities(nationality),'
  + 'links:halaqa_teachers!person_id!inner(halaqa_number,type,valid_to,h:halaqat!inner(department_code,period_code,sector,is_active))';
export function teachersQuery(f, offset = 0, size = SIZE) {
  const p = ['links.valid_to=is.null'];
  const q = (f.q || '').trim();
  if (q) {
    if (/^\d{1,5}$/.test(q)) p.push('links.halaqa_number=eq.' + E(q));
    else if (/^\d+$/.test(q)) p.push('display_code=like.' + E(q + '*'));
    else p.push('full_name=ilike.' + like(q));
  }
  if (f.dep) p.push('links.h.department_code=eq.' + E(f.dep));
  if (f.per) p.push('links.h.period_code=eq.' + E(f.per));
  if (f.sector) p.push('sector=eq.' + E(f.sector));
  { const sp = sectorParam('links.h.'); if (sp) p.push(sp); }
  return `persons?select=${TEACHER_SELECT}&${p.join('&')}&order=full_name&limit=${size}&offset=${offset}`;
}
