import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleAuth, getSession, requireMember } from '../server/auth.mjs';

// Real SQLite transactions model D1's all-or-nothing batch semantics; there is
// no mocked successful redemption. Column names mirror db/schema.ts.
function environment(overrides={}) {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));
  let failBatchAt=-1;
  const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values);},async first(){return sqlite.prepare(sql).get(...args) || null;},async all(){return {success:true,results:sqlite.prepare(sql).all(...args)};},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)},results:[]};}});
  const DB={prepare:statement,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map((item,index)=>{if(index===failBatchAt)throw Error('injected database failure');const prepared=sqlite.prepare(item.sql);if(/\bRETURNING\b/i.test(item.sql))return {success:true,results:prepared.all(...item.args),meta:{changes:1}};const result=prepared.run(...item.args);return {success:true,meta:{changes:Number(result.changes)},results:[]};});sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}finally{failBatchAt=-1;}}};
  return {env:{DB,ADMIN_USER_ID:'trusted-owner',...overrides},sqlite,injectBatchFailure(index){failBatchAt=index;}};
}

function browser(env,{admin=false,ip='192.0.2.1',origin='https://example.test'}={}) {
  const cookies=new Map(); let csrf;
  async function request(path,{method='GET',body,headers={},raw,save=true}={}) {
    const base={'Cookie':[...cookies].map(([key,value])=>`${key}=${value}`).join(';'),'CF-Connecting-IP':ip,...(admin?{'oai-authenticated-user-id':'trusted-owner'}:{})};
    if(method!=='GET')Object.assign(base,{'Origin':origin,'Content-Type':'application/json','X-CSRF-Token':csrf || ''});
    const req=new Request(origin+path,{method,headers:{...base,...headers},...(method!=='GET'?{body:raw ?? JSON.stringify(body ?? {})}:{})});
    const response=await handleAuth(req,env);
    if(save)for(const value of response.headers.getSetCookie()){const [pair]=value.split(';'),split=pair.indexOf('=');if(value.includes('Max-Age=0'))cookies.delete(pair.slice(0,split));else cookies.set(pair.slice(0,split),pair.slice(split+1));}
    const data=await response.json();if(save && data.csrf)csrf=data.csrf;
    return {response,data,request:req};
  }
  return {request,cookies,get csrf(){return csrf;},async start(){return request('/api/auth/session');},memberRequest(){return new Request(origin+'/api/content/library',{headers:{Cookie:[...cookies].map(([key,value])=>`${key}=${value}`).join(';')}});}};
}
async function createCode(env) { const owner=browser(env,{admin:true});await owner.start();const result=await owner.request('/api/admin/codes',{method:'POST',body:{}});assert.equal(result.response.status,201);return {owner,code:result.data.code}; }
const registration=(code,account='13800138000',password='a-strong-password')=>({order:`000-order-${account}`,activation:code.activation,account,password});
const count=(sqlite,table)=>sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

test('anonymous session only issues an HttpOnly host CSRF cookie and never grants membership',async()=>{
  const {env}=environment(),client=browser(env);const result=await client.start();
  assert.deepEqual({...result.data,csrf:undefined},{user:null,admin:false,csrf:undefined});assert.match(result.data.csrf,/^[a-f0-9]{64}$/);
  const cookie=result.response.headers.getSetCookie()[0];assert.match(cookie,/^__Host-cijian_csrf=/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  assert.equal(result.response.headers.get('cache-control'),'private, no-store');assert.equal(count(environment().sqlite,'members'),0);
  await assert.rejects(requireMember(client.memberRequest(),env),error=>error instanceof Response && error.status===401);
});

test('admin authority is exclusively the configured trusted identity; email fallback requires a trusted id',async()=>{
  const {env}=environment({ADMIN_USER_ID:undefined,ADMIN_USER_EMAIL:'owner@example.test'}),client=browser(env);
  assert.equal((await client.start()).data.admin,false);
  assert.equal((await client.request('/api/auth/session',{headers:{'oai-authenticated-user-email':'owner@example.test'}})).data.admin,false);
  assert.equal((await client.request('/api/auth/session',{headers:{'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-id':'trusted-id'}})).data.admin,true);
  const preferred=environment({ADMIN_USER_ID:'preferred',ADMIN_USER_EMAIL:'owner@example.test'}).env;
  assert.equal((await browser(preferred).request('/api/auth/session',{headers:{'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-id':'other'}})).data.admin,false);
  await client.start();const denied=await client.request('/api/admin/codes',{method:'POST',body:{admin:true,account:'13800138000'}});assert.equal(denied.response.status,403);
});

test('creation reveals the raw code once; list and database contain only its digest and safe metadata',async()=>{
  const {env,sqlite}=environment();const {owner,code}=await createCode(env);
  assert.equal(code.order,null);assert.match(code.activation,/^CJ-(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/);
  const row=sqlite.prepare('SELECT * FROM activation_codes').get();assert.match(row.code_hash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(row).includes(code.activation));
  const listed=await owner.request('/api/admin/codes');assert.equal(listed.data.codes.length,1);assert.equal(listed.data.codes[0].status,'available');assert.equal('activation' in listed.data.codes[0],false);assert.equal('code_hash' in listed.data.codes[0],false);
  assert.equal(row.customer_order_number,null);assert.equal(listed.data.codes[0].order,null);
  const prebound=await owner.request('/api/admin/codes',{method:'POST',body:{order:'P20261103-OLD'}});assert.equal(prebound.response.status,400);assert.equal(prebound.data.error,'ORDER_NOT_ACCEPTED');assert.equal(count(sqlite,'activation_codes'),1);
});

test('simultaneous admin requests create distinct unbound codes',async()=>{
  const {env,sqlite}=environment();const owner=browser(env,{admin:true});await owner.start();
  const results=await Promise.all([owner.request('/api/admin/codes',{method:'POST'}),owner.request('/api/admin/codes',{method:'POST'})]);
  assert.deepEqual(results.map(result=>result.response.status),[201,201]);assert.equal(count(sqlite,'activation_codes'),2);assert.notEqual(results[0].data.code.activation,results[1].data.code.activation);assert.ok(results.every(result=>result.data.code.order===null));
});

test('registration binds a customer order at redemption and creates a salted hash plus 7-day session',async()=>{
  const {env,sqlite}=environment();const {code}=await createCode(env);const client=browser(env);await client.start();
  const result=await client.request('/api/auth/register',{method:'POST',body:registration(code)});assert.equal(result.response.status,201);assert.equal(result.data.user.phone,'138****8000');assert.equal(result.data.admin,false);
  const member=sqlite.prepare('SELECT * FROM members').get();assert.match(member.password_hash,/^[a-f0-9]{64}$/);assert.match(member.password_salt,/^[a-f0-9]{32}$/);assert.equal(member.password_iterations,100000);assert.ok(!JSON.stringify(member).includes('a-strong-password'));
  const session=sqlite.prepare('SELECT * FROM member_sessions').get();assert.equal(session.expires_at-session.created_at,7*86400000);assert.notEqual(session.token_hash,client.cookies.get('__Host-cijian_session'));
  const activated=sqlite.prepare('SELECT status,redeemed_by,customer_order_number FROM activation_codes').get();assert.equal(activated.status,'used');assert.equal(activated.redeemed_by,member.id);assert.equal(activated.customer_order_number,'000-ORDER-13800138000');
  assert.deepEqual(await requireMember(client.memberRequest(),env),result.data.user);assert.equal((await client.start()).data.user.id,member.id);
});

test('invalid codes, reused codes and duplicate accounts cannot consume another code or create an orphan',async()=>{
  const {env,sqlite}=environment();const {code:a}=await createCode(env);const {code:b}=await createCode(env);const client=browser(env);await client.start();
  const mismatch=await client.request('/api/auth/register',{method:'POST',body:{...registration(a),activation:'CJ-'+ '0'.repeat(32)}});assert.equal(mismatch.response.status,400);assert.equal(count(sqlite,'members'),0);assert.equal(count(sqlite,'member_sessions'),0);
  assert.equal((await client.request('/api/auth/register',{method:'POST',body:registration(a)})).response.status,201);
  const used=await client.request('/api/auth/register',{method:'POST',body:registration(a,'13900139000')});assert.equal(used.response.status,400);
  const duplicate=await client.request('/api/auth/register',{method:'POST',body:registration(b)});assert.equal(duplicate.response.status,409);
  assert.equal(count(sqlite,'members'),1);assert.equal(sqlite.prepare('SELECT status FROM activation_codes WHERE id=?').get(b.id).status,'available');
});

test('concurrent redemption of one code creates exactly one member and one session',async()=>{
  const {env,sqlite}=environment();const {code}=await createCode(env);const a=browser(env,{ip:'192.0.2.2'}),b=browser(env,{ip:'192.0.2.3'});await Promise.all([a.start(),b.start()]);
  const results=await Promise.all([a.request('/api/auth/register',{method:'POST',body:registration(code,'13800138001')}),b.request('/api/auth/register',{method:'POST',body:registration(code,'13800138002')})]);
  assert.equal(results.filter(result=>result.response.status===201).length,1);assert.ok(results.every(result=>[201,400,409].includes(result.response.status)));
  assert.equal(count(sqlite,'members'),1);assert.equal(count(sqlite,'member_sessions'),1);assert.equal(sqlite.prepare('SELECT status FROM activation_codes').get().status,'used');
});

test('concurrent same-account registrations consume only one of two valid codes',async()=>{
  const {env,sqlite}=environment();const {code:aCode}=await createCode(env),{code:bCode}=await createCode(env);const a=browser(env),b=browser(env,{ip:'192.0.2.2'});await Promise.all([a.start(),b.start()]);
  const results=await Promise.all([a.request('/api/auth/register',{method:'POST',body:registration(aCode)}),b.request('/api/auth/register',{method:'POST',body:{...registration(bCode),order:'00000-DIFFERENT-ORDER'}})]);
  assert.equal(results.filter(result=>result.response.status===201).length,1);assert.ok(results.every(result=>[201,409].includes(result.response.status)));assert.equal(count(sqlite,'members'),1);assert.equal(count(sqlite,'member_sessions'),1);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM activation_codes WHERE status='available'").get().n,1);
});

test('concurrent duplicate customer orders consume only one code and can never be reused',async()=>{
  const {env,sqlite}=environment();const {code:aCode}=await createCode(env),{code:bCode}=await createCode(env);const a=browser(env),b=browser(env,{ip:'192.0.2.2'});await Promise.all([a.start(),b.start()]);
  const results=await Promise.all([
    a.request('/api/auth/register',{method:'POST',body:{...registration(aCode,'13800138001'),order:'  00001_ab-123  '}}),
    b.request('/api/auth/register',{method:'POST',body:{...registration(bCode,'13800138002'),order:'00001_AB-123'}})
  ]);
  assert.deepEqual(results.map(result=>result.response.status).sort(),[201,409]);assert.equal(count(sqlite,'members'),1);assert.equal(count(sqlite,'member_sessions'),1);
  assert.equal(sqlite.prepare("SELECT customer_order_number FROM activation_codes WHERE status='used'").get().customer_order_number,'00001_AB-123');
  const untouched=sqlite.prepare("SELECT id,customer_order_number FROM activation_codes WHERE status='available'").get();assert.equal(untouched.customer_order_number,null);
  const remaining=untouched.id===aCode.id?aCode:bCode;
  const duplicate=await a.request('/api/auth/register',{method:'POST',body:{...registration(remaining,'13800138003'),order:'00001_ab-123'}});assert.equal(duplicate.response.status,409);assert.equal(duplicate.data.error,'ORDER_USED');
  assert.equal((await a.request('/api/auth/register',{method:'POST',body:{...registration(remaining,'13800138003'),order:'000000123456'}})).response.status,201);
  assert.equal(count(sqlite,'members'),2);assert.equal(count(sqlite,'member_sessions'),2);
});

test('customer order validation rejects unsupported or oversized values before consuming a code',async()=>{
  for(const order of ['',123456,'12345','订单123456','000 12345','A'.repeat(65),'x";DROP TABLE members;--','ß123456','ı123456']){
    const {env,sqlite}=environment();const {code}=await createCode(env);const client=browser(env);await client.start();
    const result=await client.request('/api/auth/register',{method:'POST',body:{...registration(code),order}});assert.equal(result.response.status,400);assert.ok(result.data.fields.order);assert.equal(count(sqlite,'members'),0);assert.equal(sqlite.prepare('SELECT status FROM activation_codes').get().status,'available');
  }
  for(const order of ['000001','0001234567890123456789','a'.repeat(64)]){
    const {env,sqlite}=environment();const {code}=await createCode(env);const client=browser(env);await client.start();
    assert.equal((await client.request('/api/auth/register',{method:'POST',body:{...registration(code),order}})).response.status,201);
    assert.equal(sqlite.prepare('SELECT customer_order_number FROM activation_codes').get().customer_order_number,order.toUpperCase());
  }
});

test('unused legacy codes ignore old pairings and expose no reserved customer order',async()=>{
  const {env,sqlite}=environment();const {owner,code}=await createCode(env);sqlite.prepare('UPDATE activation_codes SET order_number=? WHERE id=?').run('P20261103-B01-001',code.id);
  assert.equal((await owner.request('/api/admin/codes')).data.codes[0].order,null);
  const client=browser(env);await client.start();assert.equal((await client.request('/api/auth/register',{method:'POST',body:{...registration(code),order:'000123_CUSTOMER'}})).response.status,201);
  assert.equal((await owner.request('/api/admin/codes')).data.codes[0].order,'000123_CUSTOMER');
});

test('historically redeemed orders remain reserved without a backfill and existing sessions stay valid',async()=>{
  const {env,sqlite}=environment();const {owner,code:old}=await createCode(env);const client=browser(env);await client.start();await client.request('/api/auth/register',{method:'POST',body:registration(old)});
  sqlite.prepare('UPDATE activation_codes SET order_number=?,customer_order_number=NULL WHERE id=?').run('P20261102-LEGACY',old.id);
  assert.equal((await owner.request('/api/admin/codes')).data.codes[0].order,'P20261102-LEGACY');assert.ok((await client.start()).data.user);
  const {code:unused}=await createCode(env);const duplicate=await client.request('/api/auth/register',{method:'POST',body:{...registration(unused,'13900139000'),order:'p20261102-legacy'}});
  assert.equal(duplicate.response.status,409);assert.equal(duplicate.data.error,'ORDER_USED');assert.equal(count(sqlite,'members'),1);assert.equal(count(sqlite,'member_sessions'),1);assert.equal(sqlite.prepare('SELECT status FROM activation_codes WHERE id=?').get(unused.id).status,'available');
});

test('a failure inside redemption batch rolls back account, code and session together',async()=>{
  for(const failureIndex of [0,1,2]){
  const fixture=environment();const {env,sqlite}=fixture;const {code}=await createCode(env);const client=browser(env);await client.start();
  // Rate limiting also uses batch; inject only into the three-statement redemption.
  const original=env.DB.batch.bind(env.DB);env.DB.batch=statements=>{if(statements.length===3)fixture.injectBatchFailure(failureIndex);return original(statements);};
  const result=await client.request('/api/auth/register',{method:'POST',body:registration(code)});assert.equal(result.response.status,503);
  assert.equal(count(sqlite,'members'),0);assert.equal(count(sqlite,'member_sessions'),0);assert.equal(sqlite.prepare('SELECT status FROM activation_codes').get().status,'available');assert.equal(sqlite.prepare('SELECT customer_order_number FROM activation_codes').get().customer_order_number,null);assert.ok(!JSON.stringify(result.data).includes('injected'));
  }
});

test('login rejects wrong passwords, rotates sessions, and logout revokes the server token',async()=>{
  const {env,sqlite}=environment();const {code}=await createCode(env);const client=browser(env);await client.start();await client.request('/api/auth/register',{method:'POST',body:registration(code)});
  const old=client.cookies.get('__Host-cijian_session');
  assert.equal((await client.request('/api/auth/login',{method:'POST',body:{account:'13800138000',password:'wrong-password'}})).response.status,401);
  assert.equal((await client.request('/api/auth/login',{method:'POST',body:{account:'13800138000',password:'a-strong-password'}})).response.status,200);
  assert.notEqual(client.cookies.get('__Host-cijian_session'),old);assert.equal(count(sqlite,'member_sessions'),1);
  const oldRequest=new Request('https://example.test/api/content',{headers:{Cookie:`__Host-cijian_session=${old}`}});assert.equal((await getSession(oldRequest,env)).user,null);
  assert.equal((await client.request('/api/auth/logout',{method:'POST'})).response.status,200);assert.equal(count(sqlite,'member_sessions'),0);assert.equal((await client.start()).data.user,null);
});

test('admin disables only unused codes; used codes cannot revoke accounts or sessions',async()=>{
  const {env,sqlite}=environment();const {owner,code}=await createCode(env);const client=browser(env);await client.start();await client.request('/api/auth/register',{method:'POST',body:registration(code)});const oldRequest=client.memberRequest();
  assert.equal((await owner.request(`/api/admin/codes/${code.id}/disable`,{method:'POST'})).response.status,409);assert.equal(count(sqlite,'member_sessions'),1);assert.equal((await getSession(oldRequest,env)).user.active,true);assert.equal(sqlite.prepare('SELECT active FROM members').get().active,1);assert.equal(sqlite.prepare('SELECT status FROM activation_codes WHERE id=?').get(code.id).status,'used');
  assert.equal((await client.request('/api/auth/login',{method:'POST',body:{account:'13800138000',password:'a-strong-password'}})).response.status,200);
  const {code:unused}=await createCode(env);await owner.request(`/api/admin/codes/${unused.id}/disable`,{method:'POST'});
  assert.equal((await owner.request(`/api/admin/codes/${unused.id}/disable`,{method:'POST'})).response.status,200);
  assert.equal((await owner.request('/api/admin/codes/00000000-0000-0000-0000-000000000000/disable',{method:'POST'})).response.status,404);
  assert.equal((await client.request('/api/auth/register',{method:'POST',body:registration(unused,'13900139000')})).response.status,400);assert.equal(count(sqlite,'members'),1);
});

test('code listing has stable 50-row pages, total counts and validated offsets',async()=>{
  const {env,sqlite}=environment();const owner=browser(env,{admin:true});await owner.start();
  const insert=sqlite.prepare("INSERT INTO activation_codes(id,order_number,code_hash,status,created_at) VALUES(?,?,?,'available',?)");
  for(let i=0;i<53;i++)insert.run(crypto.randomUUID(),`P20261102-${i}`,String(i).padStart(64,'0'),Date.now()+i);
  const first=await owner.request('/api/admin/codes'),second=await owner.request('/api/admin/codes?offset=50');
  assert.equal(first.data.limit,50);assert.equal(first.data.offset,0);assert.equal(first.data.total,53);assert.equal(first.data.codes.length,50);assert.equal(second.data.codes.length,3);assert.equal(second.data.offset,50);assert.equal(second.data.total,53);
  assert.equal(new Set([...first.data.codes,...second.data.codes].map(row=>row.id)).size,53);
  assert.equal((await owner.request('/api/admin/codes?offset=-1')).response.status,400);assert.equal((await owner.request('/api/admin/codes?offset=1e6')).response.status,400);
});

test('expiry and tampered cookies cannot authorize content, and inactive sessions produce 403',async()=>{
  const {env,sqlite}=environment();const {code}=await createCode(env);const client=browser(env);await client.start();await client.request('/api/auth/register',{method:'POST',body:registration(code)});
  sqlite.prepare('UPDATE members SET active=0').run();await assert.rejects(requireMember(client.memberRequest(),env),error=>error instanceof Response && error.status===403);
  sqlite.prepare('UPDATE members SET active=1').run();sqlite.prepare('UPDATE member_sessions SET expires_at=?').run(Date.now()-1);assert.equal((await getSession(client.memberRequest(),env)).user,null);
  client.cookies.set('__Host-cijian_session','a'.repeat(64));assert.equal((await getSession(client.memberRequest(),env)).user,null);
});

test('strict origin, CSRF, JSON type and streaming body limits reject mutations before database writes',async()=>{
  const {env,sqlite}=environment();const client=browser(env,{admin:true});await client.start();
  assert.equal((await client.request('/api/admin/codes',{method:'POST',headers:{Origin:'https://evil.test'}})).response.status,403);
  assert.equal((await client.request('/api/admin/codes',{method:'POST',headers:{'X-CSRF-Token':'0'.repeat(64)}})).response.status,403);
  assert.equal((await client.request('/api/admin/codes',{method:'POST',headers:{'Content-Type':'text/plain'}})).response.status,415);
  assert.equal((await client.request('/api/admin/codes',{method:'POST',raw:'{'})).response.status,400);
  assert.equal((await client.request('/api/admin/codes',{method:'POST',body:{text:'x'.repeat(9000)}})).response.status,413);
  assert.equal(count(sqlite,'activation_codes'),0);
});

test('persistent account limiter applies across separate clients, with a bounded retry time',async()=>{
  const {env,sqlite}=environment();const a=browser(env,{ip:'192.0.2.2'}),b=browser(env,{ip:'192.0.2.3'});await Promise.all([a.start(),b.start()]);
  for(let i=0;i<10;i++){const result=await (i%2?a:b).request('/api/auth/login',{method:'POST',body:{account:'13800138000',password:'unknown-password'}});assert.equal(result.response.status,401);}
  const result=await a.request('/api/auth/login',{method:'POST',body:{account:'13800138000',password:'unknown-password'}});assert.equal(result.response.status,429);assert.ok(Number(result.response.headers.get('retry-after'))>0);assert.ok(count(sqlite,'auth_rate_limits')>=3);
});

test('persistent IP limiter cannot be bypassed by changing registration phone or X-Forwarded-For',async()=>{
  const {env}=environment();const client=browser(env);await client.start();
  for(let i=0;i<20;i++){const result=await client.request('/api/auth/register',{method:'POST',headers:{'X-Forwarded-For':`203.0.113.${i}`},body:{account:`1380013${String(i).padStart(4,'0')}`,password:'strong-password',order:'PBADORDER',activation:'CJ-'+ 'A'.repeat(32)}});assert.equal(result.response.status,400);}
  const result=await client.request('/api/auth/register',{method:'POST',body:{account:'13900139000',password:'strong-password',order:'PBADORDER',activation:'CJ-'+ 'A'.repeat(32)}});assert.equal(result.response.status,429);
});

test('local development cookies omit Secure only on loopback, never on a plain remote HTTP host',async()=>{
  const {env}=environment();const local=await browser(env,{origin:'http://127.0.0.1:8774'}).start();assert.match(local.response.headers.getSetCookie()[0],/^cijian_csrf=/);assert.ok(!local.response.headers.getSetCookie()[0].includes('; Secure'));
  const remote=await browser(env,{origin:'http://remote.test'}).start();assert.match(remote.response.headers.getSetCookie()[0],/^__Host-cijian_csrf=/);assert.match(remote.response.headers.getSetCookie()[0],/; Secure/);
});

test('a session lookup database failure throws a generic response, never database internals',async()=>{
  const {env,sqlite}=environment();const {code}=await createCode(env);const client=browser(env);await client.start();await client.request('/api/auth/register',{method:'POST',body:registration(code)});
  sqlite.exec('DROP TABLE member_sessions');
  let response;await assert.rejects(requireMember(client.memberRequest(),env),error=>{assert.ok(error instanceof Response);assert.equal(error.status,503);response=error;return true;});
  const data=await response.json();assert.equal(data.error,'AUTH_UNAVAILABLE');assert.ok(!JSON.stringify(data).includes('member_sessions'));
});
