import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:8770';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('This test creates disposable local data; loopback only.');
const jar=new Map();let csrf;
async function call(path,{method='GET',body}={}){
 const response=await fetch(origin+path,{method,redirect:'manual',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json','Origin':origin,'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 for(const value of response.headers.getSetCookie()){const [pair]=value.split(';'),at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
 if(data?.csrf)csrf=data.csrf;
 return {status:response.status,text,data,headers:response.headers};
}
assert.equal((await call('/')).status,200);
for(const path of ['/app.mjs','/library-data.mjs?v=old','/story-data.mjs','/downloads/vocabulary.csv','/assets/audio/proposal-en-gb.mp3'])assert.equal((await call(path)).status,401,path);
assert.equal((await call('/api/admin/codes')).status,403);
await call('/signin-with-chatgpt?return_to=/');
const admin=await call('/api/auth/session');assert.equal(admin.data.admin,true);
const code=await call('/api/admin/codes',{method:'POST',body:{}});assert.equal(code.status,201);
const order='000QA-'+Date.now(), account='139'+String(Date.now()).slice(-8),password='Local-QA-Only-2026';
const registration=await call('/api/auth/register',{method:'POST',body:{account,password,order,activation:code.data.code.activation}});
if(registration.status===409){const login=await call('/api/auth/login',{method:'POST',body:{account,password}});assert.equal(login.status,200);}
else assert.equal(registration.status,201,registration.text);
const listed=await call('/api/admin/codes');assert.equal(listed.data.codes.find(item=>item.id===code.data.code.id).order,order);
const other=await call('/api/admin/codes',{method:'POST',body:{}});assert.equal(other.status,201);assert.equal(other.data.code.order,null);
const duplicate=await call('/api/auth/register',{method:'POST',body:{account:'138'+String(Date.now()).slice(-8),password,order,activation:other.data.code.activation}});assert.equal(duplicate.status,409);
const unchanged=await call('/api/admin/codes');assert.equal(unchanged.data.codes.find(item=>item.id===other.data.code.id).status,'available');
assert.equal((await call('/api/admin/codes/'+other.data.code.id+'/disable',{method:'POST',body:{}})).status,200);
assert.equal((await call('/library-data.mjs')).status,200);
assert.equal((await call('/downloads/vocabulary.csv')).status,200);
const stale=new Map(jar);
assert.equal((await call('/api/auth/logout',{method:'POST',body:{}})).status,200);
assert.equal((await call('/library-data.mjs')).status,401);
const revoked=await fetch(origin+'/library-data.mjs',{headers:{Cookie:[...stale].map(([k,v])=>k+'='+v).join('; ')}});assert.equal(revoked.status,401);
await call('/api/auth/session');
assert.equal((await call('/api/auth/login',{method:'POST',body:{account,password:'wrong'}})).status,401);
assert.equal((await call('/api/auth/login',{method:'POST',body:{account,password}})).status,200);
assert.equal((await call('/library-data.mjs?v=old')).status,200);
assert.equal((await call('/api/auth/logout',{method:'POST',body:{}})).status,200);
console.log(JSON.stringify({result:'pass',checks:['anonymous resource protection','admin boundary','unbound code creation','customer order binding','duplicate order leaves other code unused','password login','download permission','logout revocation'],localOnly:true}));
