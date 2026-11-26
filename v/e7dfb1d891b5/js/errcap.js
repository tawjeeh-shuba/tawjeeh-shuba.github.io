// التقاط أخطاء الواجهة تلقائياً (الاستعداد التشغيلي، 2026-11-24): تُحمَّل في وقت الفراغ فقط حين يكون المفتاح مشغّلاً.
// كل خطأ له بصمة (الرسالة والملف والسطر)؛ الخطأ نفسه يُرسل مرة واحدة في الجلسة، وبحد 15 خطأ مختلفاً في الجلسة.
// الخادم يزيد عدّاد المتكرر فقط، وله حد يومي للجديد. لا يُرسل أي نص كتبه المستخدم.
import { rpc } from './core.js';

const sent = new Set(); const MAX = 15; let on = false;
const version = () => document.querySelector('meta[name="tawjeeh-version"]')?.content || 'محلي';
// FNV-1a 32 بت مرتين (بذرتان) ← 16 خانة سداسية
function fp(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x5bd1e995); }
  return ((a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'));
}
// إزالة ما قد يكون بيانات: الأرقام الطويلة ومعرفات UUID من الرسالة (البصمة تبقى ثابتة للخطأ نفسه)
const clean = (m) => String(m || '').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>').replace(/\d{5,}/g, '<n>').slice(0, 500);

function send(message, source) {
  try {
    const msg = clean(message); const src = String(source || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 300);
    const key = fp(msg + '|' + src);
    if (sent.has(key) || sent.size >= MAX) return;
    sent.add(key);
    rpc('rpc_client_error', { p: { fp: key, message: msg, source: src, page: decodeURIComponent(location.hash || '#/').slice(0, 200), version: version(), ua: navigator.userAgent.slice(0, 300) } }).catch(() => {});
  } catch { /* لا يُلتقط خطأ الالتقاط نفسه */ }
}

export function start() {
  if (on) return; on = true;
  addEventListener('error', (e) => send(e.message || e.error?.message || 'خطأ', `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`));
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason; const m = r instanceof Error ? r.message : String(r ?? '');
    // انتهاء الجلسة وانقطاع الشبكة ليسا أخطاء في الواجهة
    if (/انتهت الجلسة|Failed to fetch|NetworkError|Load failed|تعذّر الاتصال/i.test(m)) return;
    send(m, (r?.stack || '').split('\n')[1]?.trim() || 'promise');
  });
}
