const enc = new TextEncoder();
export const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async s => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
export async function passwordHash(password, salt = random()) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  return salt + ':' + hex(new Uint8Array(result));
}
export async function verify(password, stored) { return (await passwordHash(password, stored.split(':')[0])) === stored; }
export function validPassword(s) { return typeof s==='string' && s.length>=12 && s.length<=256; }
export const json = (value, status=200, headers={}) => new Response(JSON.stringify(value), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
export function fail(status,message) { throw Object.assign(new Error(message),{status}); }
export async function body(request, max=65536) {
  if (Number(request.headers.get('content-length'))>max) fail(413,'Fichier trop volumineux.');
  const reader=request.body?.getReader(); if(!reader) fail(400,'Requête vide.');
  const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'Requête trop volumineuse.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'JSON invalide.');}
}
export const cookie = (token,age=28800) => `okteo_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export async function identity(request, db) {
 const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)okteo_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 return db.prepare('SELECT users.*, sessions.token_hash, sessions.expires FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>? AND active=1').bind(await hash(token),Date.now()).first();
}
export function safeUser(u) {return {id:u.id,login:u.login,role:u.role,active:!!u.active,ai_enabled:!!u.ai_enabled,monthly_limit:u.monthly_limit,must_change:!!u.must_change};}
