/**
 * Portable Web API / Cloudflare D1 authentication.
 * The outer Sites handler MUST authenticate and overwrite oai-authenticated-user-*
 * before calling this module. These headers are not a browser-admin credential.
 * getSession is read-only: {user,admin,csrf,sessionId,expiresAt,inactive}.
 * requireMember returns the masked public user or throws a JSON Response.
 * PBKDF2 uses Workers' supported maximum of 100,000 iterations. A persistent,
 * atomic IP/account limiter bounds guesses; a stronger KDF needs another runtime.
 */
const DAY = 86400000;
const SESSION_AGE = 7 * DAY;
const ITERATIONS = 100000;
const BODY_LIMIT = 8192;
const encoder = new TextEncoder();
const HEX = /^[a-f0-9]{64}$/;
const PHONE = /^1[3-9]\d{9}$/;

function json(payload, status = 200, cookies = [], extra = {}) {
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'private, no-store', 'Vary':'Cookie', 'X-Content-Type-Options':'nosniff', ...extra});
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(payload), {status, headers});
}
function fail(status, error, message, fields) { throw json({error, message, ...(fields ? {fields} : {})}, status); }
function dbFor(env) { if (!env?.DB?.prepare || !env.DB.batch) fail(503, 'AUTH_UNAVAILABLE', '账号服务暂时不可用，请稍后重试。'); return env.DB; }
const hex = bytes => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
const random = bytes => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
function equal(a, b) { if (typeof a !== 'string' || typeof b !== 'string') return false; let different = a.length ^ b.length; for (let i=0; i<Math.max(a.length,b.length); i++) different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return different === 0; }
function local(request) { const url = new URL(request.url); return url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname); }
function cookieName(request, kind) { return `${local(request) ? '' : '__Host-'}cijian_${kind}`; }
function cookie(request, kind, value, age) { return `${cookieName(request,kind)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${local(request) ? '' : '; Secure'}`; }
function cookieValue(request, kind) {
  const name = cookieName(request,kind), values = (request.headers.get('cookie') || '').split(';').map(piece => piece.trim()).filter(piece => piece.startsWith(name+'='));
  // Reject duplicate cookies rather than accepting a shadowed token.
  return values.length === 1 ? values[0].slice(name.length+1) : null;
}
function csrfFor(request) { const value = cookieValue(request,'csrf'); return HEX.test(value || '') ? value : null; }
function trustedAdmin(request, env) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) return false;
  if (typeof env?.ADMIN_USER_ID === 'string' && env.ADMIN_USER_ID.trim()) return equal(id, env.ADMIN_USER_ID.trim());
  const email = request.headers.get('oai-authenticated-user-email');
  return typeof env?.ADMIN_USER_EMAIL === 'string' && !!env.ADMIN_USER_EMAIL.trim() && !!email && equal(email.trim().toLowerCase(), env.ADMIN_USER_EMAIL.trim().toLowerCase());
}
const maskPhone = phone => `${phone.slice(0,3)}****${phone.slice(-4)}`;
const publicUser = member => ({id:member.id, phone:maskPhone(member.phone), active:true});

export async function getSession(request, env) {
  const state = {user:null, admin:trustedAdmin(request,env), csrf:csrfFor(request), sessionId:null, expiresAt:null, inactive:false};
  const token = cookieValue(request,'session');
  if (!HEX.test(token || '')) return state;
  const tokenHash = await digest(token);
  let row;
  try {
    row = await dbFor(env).prepare(`SELECT m.id,m.phone,m.active,c.status,c.redeemed_by,s.expires_at
      FROM member_sessions s JOIN members m ON m.id=s.member_id
      JOIN activation_codes c ON c.id=m.activation_code_id WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash,Date.now()).first();
  } catch(error) {
    if(error instanceof Response)throw error;
    fail(503,'AUTH_UNAVAILABLE','账号服务暂时不可用，请稍后重试。');
  }
  if (!row) return state;
  state.sessionId=tokenHash; state.expiresAt=row.expires_at;
  state.inactive=!(row.active === 1 && row.status === 'used' && row.redeemed_by === row.id);
  if (!state.inactive) state.user=publicUser(row);
  return state;
}

export async function requireMember(request, env) {
  const session = await getSession(request,env);
  if (session.inactive) fail(403,'MEMBERSHIP_INACTIVE','该账号的开通权限已停用。');
  if (!session.user) fail(401,'LOGIN_REQUIRED','请先使用已开通的账号登录。');
  return session.user;
}

async function mutationBody(request) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) fail(403,'ORIGIN_MISMATCH','请求来源不正确，请从本站页面重试。');
  if ((request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') fail(415,'JSON_REQUIRED','请使用 JSON 提交。');
  const csrf=csrfFor(request), supplied=request.headers.get('X-CSRF-Token');
  if (!csrf || !HEX.test(supplied || '') || !equal(csrf,supplied)) fail(403,'CSRF_INVALID','页面验证已失效，请刷新后重试。');
  if (Number(request.headers.get('Content-Length') || 0)>BODY_LIMIT) fail(413,'BODY_TOO_LARGE','提交内容过大。');
  const reader=request.body?.getReader(); let length=0; const chunks=[];
  if (reader) { try { while(true) { const {done,value}=await reader.read(); if(done)break; length+=value.byteLength; if(length>BODY_LIMIT) { await reader.cancel(); fail(413,'BODY_TOO_LARGE','提交内容过大。'); } chunks.push(value); } } finally { reader.releaseLock(); } }
  const bytes=new Uint8Array(length); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let value; try { value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { fail(400,'INVALID_JSON','提交内容格式不正确。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400,'INVALID_JSON','请提交有效的 JSON 对象。');
  return value;
}

function accountInput(body, registering) {
  const account = typeof body.account === 'string' ? body.account.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fields={};
  if (!PHONE.test(account)) fields.account='请输入 11 位手机号。';
  if (!password.trim() || password.length>64 || (registering && password.length<8)) fields.password=registering?'密码须为 8–64 个字符。':'请输入有效密码。';
  if (Object.keys(fields).length) fail(400,'VALIDATION_ERROR','请检查填写内容。',fields);
  return {account,password};
}
function orderInput(value) { const order=typeof value === 'string'?value.trim():''; if(!/^[A-Za-z0-9_-]{6,64}$/.test(order)) fail(400,'VALIDATION_ERROR','请检查客户订单号。',{order:'请输入 6–64 位订单号，仅支持英文字母、数字、连字符和下划线。'}); return order.toUpperCase(); }
function activationInput(value) { if(typeof value !== 'string' || value.length>96) fail(400,'VALIDATION_ERROR','请填写正确的激活码。',{activation:'请输入本站提供的激活码。'}); const code=value.replace(/[\s-]/g,'').toUpperCase(); if(!/^CJ[A-F0-9]{32}$/.test(code)) fail(400,'VALIDATION_ERROR','请填写正确的激活码。',{activation:'请输入本站提供的激活码。'}); return code; }

async function passwordHash(password,salt,iterations=ITERATIONS) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256)));
}
async function limit(request,env,action,account) {
  // CF-Connecting-IP is trusted only through the deployed Cloudflare/Sites edge;
  // absent IPs share one fail-closed bucket, never a browser X-Forwarded-For value.
  const ip=request.headers.get('CF-Connecting-IP') || 'unknown';
  const now=Date.now(), window=Math.floor(now/(15*60000)), expires=(window+1)*15*60000;
  const db=dbFor(env), keys=await Promise.all([digest(`${action}|ip|${ip}|${window}`),digest(`${action}|account|${account}|${window}`)]);
  const results=await db.batch(keys.map(key=>db.prepare(`INSERT INTO auth_rate_limits(bucket_key,attempts,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket_key) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(key,expires)));
  const ipMax=action==='register'?20:50, accountMax=action==='register'?5:10;
  const counts=results.map(result=>result?.results?.[0]?.attempts);
  if(counts.length!==2 || counts.some(count=>!Number.isInteger(count) || count<1))fail(503,'AUTH_UNAVAILABLE','账号服务暂时不可用，请稍后重试。');
  if (counts[0]>ipMax || counts[1]>accountMax) throw json({error:'RATE_LIMITED',message:'尝试次数过多，请稍后再试。'},429,[],{'Retry-After':String(Math.max(1,Math.ceil((expires-now)/1000)))});
  // Bounded, persistent cleanup; never needed to make a current limit effective.
  await db.prepare('DELETE FROM auth_rate_limits WHERE bucket_key IN (SELECT bucket_key FROM auth_rate_limits WHERE expires_at<? LIMIT 100)').bind(now).run();
}
function sessionCookies(request,token,csrf) { return [cookie(request,'session',token,SESSION_AGE/1000),cookie(request,'csrf',csrf,SESSION_AGE/1000)]; }

async function register(request,env,body) {
  const {account,password}=accountInput(body,true);
  await limit(request,env,'register',account);
  const order=orderInput(body.order), activation=activationInput(body.activation), hash=await digest(activation), db=dbFor(env);
  const code=await db.prepare("SELECT id FROM activation_codes WHERE code_hash=? AND status='available'").bind(hash).first();
  if(!code) fail(400,'ACTIVATION_INVALID','激活码不正确，或已经使用、已停用。',{activation:'请填写一个未使用的有效激活码。'});
  if(await db.prepare('SELECT id FROM members WHERE phone=?').bind(account).first()) fail(409,'ACCOUNT_EXISTS','该手机号已注册，请使用已有账号登录。',{account:'该手机号已注册。'});
  if(await db.prepare("SELECT id FROM activation_codes WHERE customer_order_number=? OR (customer_order_number IS NULL AND status='used' AND order_number=?)").bind(order,order).first())fail(409,'ORDER_USED','这个客户订单号已经激活过账号，不能重复使用。',{order:'每个客户订单号只能激活一次。'});
  const id=crypto.randomUUID(), salt=random(16), passwordDigest=await passwordHash(password,salt), token=random(32), tokenHash=await digest(token), csrf=random(32), now=Date.now();
  // D1 batch is a transaction. All three statements use the same new member id;
  // a competing redemption inserts nothing and cannot consume a code or session.
  let result;
  try { result=await db.batch([
    db.prepare(`INSERT INTO members(id,phone,password_hash,password_salt,password_iterations,activation_code_id,active,created_at)
      SELECT ?,?,?,?,?,c.id,1,? FROM activation_codes c WHERE c.id=? AND c.code_hash=? AND c.status='available'
      AND NOT EXISTS(SELECT 1 FROM members WHERE phone=?)
      AND NOT EXISTS(SELECT 1 FROM activation_codes WHERE customer_order_number=? OR (customer_order_number IS NULL AND status='used' AND order_number=?))`).bind(id,account,passwordDigest,salt,ITERATIONS,now,code.id,hash,account,order,order),
    db.prepare(`UPDATE activation_codes SET status='used',redeemed_by=?,redeemed_at=?,customer_order_number=? WHERE id=? AND status='available'
      AND EXISTS(SELECT 1 FROM members WHERE id=? AND activation_code_id=activation_codes.id)`).bind(id,now,order,code.id,id),
    db.prepare(`INSERT INTO member_sessions(token_hash,member_id,created_at,expires_at)
      SELECT ?,m.id,?,? FROM members m JOIN activation_codes c ON c.id=m.activation_code_id
      WHERE m.id=? AND c.status='used' AND c.redeemed_by=m.id`).bind(tokenHash,now,now+SESSION_AGE,id),
  ]); } catch(error) {
    // D1 rolls the whole batch back on a uniqueness conflict. Only known
    // redemption collisions are user conflicts; infrastructure failures stay 503.
    if(/UNIQUE constraint failed: (?:activation_codes\.customer_order_number|members\.(?:phone|activation_code_id))/i.test(String(error?.message || '')))fail(409,'ACTIVATION_CONFLICT','订单、激活码或手机号刚刚被使用，请核对后重试。');
    throw error;
  }
  if(result[0]?.meta?.changes!==1 || result[1]?.meta?.changes!==1 || result[2]?.meta?.changes!==1) fail(409,'ACTIVATION_CONFLICT','订单、激活码或手机号已被使用，请核对后重试。');
  return json({user:publicUser({id,phone:account}),admin:trustedAdmin(request,env),csrf},201,sessionCookies(request,token,csrf));
}

async function login(request,env,body) {
  const {account,password}=accountInput(body,false); await limit(request,env,'login',account);
  const db=dbFor(env), row=await db.prepare(`SELECT m.*,c.status,c.redeemed_by FROM members m JOIN activation_codes c ON c.id=m.activation_code_id WHERE m.phone=?`).bind(account).first();
  const derived=await passwordHash(password,row?.password_salt || '00000000000000000000000000000000');
  if(!row || row.password_iterations!==ITERATIONS || !equal(derived,row.password_hash)) fail(401,'INVALID_CREDENTIALS','手机号或密码不正确。');
  if(row.active!==1 || row.status!=='used' || row.redeemed_by!==row.id) fail(403,'MEMBERSHIP_INACTIVE','该账号的开通权限已停用。');
  const token=random(32), tokenHash=await digest(token), csrf=random(32), now=Date.now();
  // Recheck entitlement in the insertion, so a concurrent disable cannot create
  // a usable new session after the initial password check.
  const inserted=await db.prepare(`INSERT INTO member_sessions(token_hash,member_id,created_at,expires_at)
    SELECT ?,m.id,?,? FROM members m JOIN activation_codes c ON c.id=m.activation_code_id
    WHERE m.id=? AND m.active=1 AND c.status='used' AND c.redeemed_by=m.id`).bind(tokenHash,now,now+SESSION_AGE,row.id).run();
  if(inserted.meta?.changes!==1) fail(403,'MEMBERSHIP_INACTIVE','该账号的开通权限已停用。');
  const previous=cookieValue(request,'session');
  if(HEX.test(previous || '')) await db.prepare('DELETE FROM member_sessions WHERE token_hash=?').bind(await digest(previous)).run();
  await db.prepare('DELETE FROM member_sessions WHERE token_hash IN (SELECT token_hash FROM member_sessions WHERE expires_at<=? LIMIT 100)').bind(now).run();
  return json({user:publicUser(row),admin:trustedAdmin(request,env),csrf},200,sessionCookies(request,token,csrf));
}

async function adminCodes(request,env,body,path) {
  if(!trustedAdmin(request,env)) fail(403,'ADMIN_REQUIRED','只有站点管理员可以管理激活码。');
  const db=dbFor(env);
  if(request.method==='GET' && path==='/api/admin/codes') {
    const params=new URL(request.url).searchParams, rawOffset=params.get('offset') || '0';
    if(!/^\d{1,7}$/.test(rawOffset) || Number(rawOffset)>1000000)fail(400,'INVALID_PAGINATION','分页位置不正确。');
    const offset=Number(rawOffset), limit=50;
    const [result,count]=await Promise.all([
      db.prepare(`SELECT c.id,c.order_number,c.customer_order_number,c.status,c.created_at,m.phone FROM activation_codes c LEFT JOIN members m ON m.id=c.redeemed_by ORDER BY c.created_at DESC,c.id LIMIT ? OFFSET ?`).bind(limit,offset).all(),
      db.prepare('SELECT count(*) AS total FROM activation_codes').first(),
    ]);
    return json({codes:result.results.map(row=>({id:row.id,order:row.status==='used'?(row.customer_order_number ?? row.order_number):null,status:row.status,createdAt:new Date(row.created_at).toISOString(),...(row.phone?{phone:maskPhone(row.phone)}:{})})),total:count.total,offset,limit});
  }
  if(path==='/api/admin/codes' && request.method==='POST') {
    if(body.order !== undefined && body.order !== '')fail(400,'ORDER_NOT_ACCEPTED','生成激活码时不绑定订单号，请清空订单字段后重试。',{order:'客户订单号由客户在激活时填写。'});
    const id=crypto.randomUUID(), raw=random(16).toUpperCase(), activation=`CJ-${raw.match(/.{8}/g).join('-')}`;
    const inserted=await db.prepare("INSERT INTO activation_codes(id,order_number,code_hash,status,created_at) VALUES(?,?,?,'available',?)").bind(id,`INTERNAL-${id}`,await digest(activationInput(activation)),Date.now()).run();
    if(inserted.meta?.changes!==1)fail(503,'AUTH_UNAVAILABLE','激活码暂未生成，请稍后重试。');
    return json({code:{id,order:null,activation,status:'available'}},201);
  }
  const match=path.match(/^\/api\/admin\/codes\/([a-f0-9-]{36})\/disable$/);
  if(match && request.method==='POST') {
    const id=match[1];
    // Disabling an unused code is not revocation of an activated membership.
    // The single conditional write also protects a concurrent redemption.
    const result=await db.prepare("UPDATE activation_codes SET status='disabled',disabled_at=? WHERE id=? AND status='available'").bind(Date.now(),id).run();
    if(result.meta?.changes!==1) {
      const code=await db.prepare('SELECT status FROM activation_codes WHERE id=?').bind(id).first();
      if(!code)fail(404,'CODE_NOT_FOUND','没有找到该激活码。');
      if(code.status!=='disabled')fail(409,'CODE_ALREADY_USED','该激活码已经使用，不能停用已开通的账号。');
    }
    return json({ok:true});
  }
  fail(405,'METHOD_NOT_ALLOWED','该操作不支持此请求方式。');
}

export async function handleAuth(request,env) {
  try {
    const path=new URL(request.url).pathname;
    if(request.method==='GET' && path==='/api/auth/session') {
      const session=await getSession(request,env), csrf=session.csrf || random(32);
      return json({user:session.user,admin:session.admin,csrf},200,session.csrf?[]:[cookie(request,'csrf',csrf,SESSION_AGE/1000)]);
    }
    if(path.startsWith('/api/admin/codes')) {
      if(!trustedAdmin(request,env)) fail(403,'ADMIN_REQUIRED','只有站点管理员可以管理激活码。');
      return await adminCodes(request,env,request.method==='POST'?await mutationBody(request):null,path);
    }
    if(!['/api/auth/register','/api/auth/login','/api/auth/logout'].includes(path)) fail(404,'NOT_FOUND','接口不存在。');
    if(request.method!=='POST') fail(405,'METHOD_NOT_ALLOWED','请使用 POST 提交。');
    const body=await mutationBody(request);
    if(path==='/api/auth/register')return await register(request,env,body);
    if(path==='/api/auth/login')return await login(request,env,body);
    const token=cookieValue(request,'session');
    if(HEX.test(token || ''))await dbFor(env).prepare('DELETE FROM member_sessions WHERE token_hash=?').bind(await digest(token)).run();
    return json({ok:true},200,[cookie(request,'session','',0),cookie(request,'csrf','',0)]);
  } catch(error) {
    if(error instanceof Response)return error;
    // Never serialize database errors, submitted fields, password/code material.
    return json({error:'AUTH_UNAVAILABLE',message:'账号服务暂时不可用，请稍后重试。'},503);
  }
}
