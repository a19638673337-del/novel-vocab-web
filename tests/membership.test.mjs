import test from 'node:test';
import assert from 'node:assert/strict';
import * as membership from '../client/membership.mjs';

const valid=()=>({order:'20261102000001',activation:'CJ-ABCD-EFGH-IJKL',account:'13800138000',password:'Reading2026'});
const session={user:null,admin:false,csrf:'test-csrf'};
const user={id:'u1',phone:'138****8000',active:true};
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const courses=[['gaokao','高中'],['ielts','雅思'],['kaoyan','考研'],['cet','四六级']];
function browser(t,hash='#membership'){
 const location={hash},history=[],document={title:''};
 for(const [key,value] of Object.entries({location,document,history:{pushState(state,title,url){history.push({state,title,url});location.hash=url;}}})){
  const original=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});
  t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
 }
 return {location,history,document};
}

test('registration requires four fields and a Chinese mobile; login excludes registration fields',()=>{
 assert.deepEqual(Object.keys(membership.validateMembershipInput({})),['order','activation','account','password']);
 assert.deepEqual(Object.keys(membership.validateMembershipInput({},'login')),['account','password']);
 assert.deepEqual(membership.validateMembershipInput(valid()),{});
 for(const account of ['reader_demo','a_12','1380013800','23800138000','reader@example.com'])assert.ok(membership.validateMembershipInput({...valid(),account}).account);
 for(const account of ['13800138000','19912345678'])assert.deepEqual(membership.validateMembershipInput({...valid(),account}),{});
});

test('URL credentials are rejected, password boundaries respected, and inputs remain unchanged',()=>{
 for(const value of ['https://novel.quwanclass.com/','HTTP://example.com','www.example.com']){
  assert.match(membership.validateMembershipInput({...valid(),order:value}).order,/不是网站链接/);
  assert.match(membership.validateMembershipInput({...valid(),activation:value}).activation,/不是网站链接/);
 }
 for(const length of [8,64])assert.deepEqual(membership.validateMembershipInput({...valid(),password:'x'.repeat(length)}),{});
 for(const length of [7,65])assert.ok(membership.validateMembershipInput({...valid(),password:'x'.repeat(length)}).password);
 assert.deepEqual(membership.validateMembershipInput({account:valid().account,password:'old'},'login'),{});
 const values=Object.freeze({...valid(),order:' P12345 ',password:' pass word '});assert.deepEqual(membership.validateMembershipInput(values),{});assert.equal(values.order,' P12345 ');assert.equal(values.password,' pass word ');
 assert.doesNotThrow(()=>membership.validateMembershipInput(null));
});

test('customer purchase orders accept numeric and merchant formats without a P prefix',()=>{
 for(const order of ['000001','20261102000001','store_2026-001','a'.repeat(64)])assert.deepEqual(membership.validateMembershipInput({...valid(),order}),{});
 for(const order of ['12345','a'.repeat(65),'中文订单号1','order 123','order/123','order.123'])assert.ok(membership.validateMembershipInput({...valid(),order}).order);
});

test('real pages have no demo flow and escape server identity values',()=>{
 const html=membership.membershipPage(session);assert.match(html,/注册并开通会员/);assert.match(html,/11 位手机号/);assert.doesNotMatch(html,/DEMO-|演示密码|页面预览|填入示例|服务尚未开放/);
 const logged=membership.membershipPage({user:{...user,phone:'<img src=x onerror=alert(1)>'},admin:true,csrf:'secret'});
 assert.match(logged,/退出登录/);assert.doesNotMatch(logged,/#membership\/admin/);assert.doesNotMatch(logged,/<img src=x|secret/);assert.match(logged,/&lt;img/);
 assert.match(membership.membershipPage({user:{...user,phone:'13800138000'}}),/138\*\*\*\*8000/);
 assert.match(membership.membershipAdminPage({admin:false}),/管理员权限/);assert.doesNotMatch(membership.membershipAdminPage({admin:false}),/id="member-admin-form"/);
});

function node(){const classes=new Set();return {value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,type:'text',dataset:{},attributes:{},selectionStart:0,selectionEnd:0,events:new Map(),focused:false,
 classList:{toggle(name,force){if(force??!classes.has(name))classes.add(name);else classes.delete(name);},contains(name){return classes.has(name);}},scrollIntoView(){this.scrolled=true;},
 addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);},removeEventListener(name,fn){this.events.get(name)?.delete(fn);},
 setAttribute(name,value){this.attributes[name]=String(value);},getAttribute(name){return this.attributes[name];},removeAttribute(name){delete this.attributes[name];},focus(){this.focused=true;},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},
 async fire(name,extra={}){const event={target:this,preventDefault(){this.prevented=true;},stopPropagation(){},...extra};await Promise.all([...this.events.get(name)||[]].map(fn=>fn(event)));return event;},querySelector(){return null;},querySelectorAll(){return [];}};}
function ui(options={}){
 const fields=Object.fromEntries(['order','activation','account','password'].map(key=>[key,Object.assign(node(),{name:key})]));fields.password.type='password';
 const errors=Object.fromEntries(Object.keys(fields).map(key=>[key,node()]));
 const form=node(),result=node(),reveal=node(),passwordLabel=node(),submitLabel=node(),submit=node(),logout=node();
 const guideOpen=node(),guideSelection=Object.assign(node(),{hidden:true}),guideClose=[node(),node()];
 const guideCards=['fullsite','gaokao','ielts','kaoyan','cet'].map(id=>Object.assign(node(),{dataset:{memberCourse:id}}));
 const courseLinks=['fullsite','gaokao','ielts','kaoyan','cet'].map(id=>Object.assign(node(),{dataset:{memberCourseLink:id},href:id==='fullsite'?'#membership':`#membership/${id}`}));
 const coursePage=node(),title=node(),intro=node(),eyebrow=node(),artCourse=node(),headline=node(),note=node(),art=node(),enter=node(),layout=node();
 const guide=Object.assign(node(),{open:false,showModal(){this.open=true;},close(){this.open=false;this.fire('close');},getBoundingClientRect:()=>({left:10,top:10,right:500,bottom:700}),querySelector:()=>guideClose[0],querySelectorAll:selector=>selector==='[data-member-guide-close]'?guideClose:selector==='[data-member-course]'?guideCards:[]});
 const modes=['register','login'].map(mode=>Object.assign(node(),{dataset:{memberMode:mode}}));
 const registration=['order','activation'].map(key=>Object.assign(node(),{querySelector:()=>fields[key]}));
 const map={'#membership-form':form,'#member-result':result,'.member-reveal':reveal,'#member-password-label':passwordLabel,'#member-submit-label':submitLabel,'[data-member-logout]':logout,'#member-guide-dialog':guide,'[data-member-guide-open]':guideOpen,'.member-guide-selection':guideSelection,'[data-member-course-page]':coursePage,'#membership-title':title,'.member-intro':intro,'[data-member-eyebrow]':eyebrow,'[data-member-art-course]':artCourse,'.member-art-copy p':headline,'.member-art-copy small':note,'.member-art img':art,'[data-member-enter]':enter,'.member-layout':layout};
 form.querySelector=selector=>selector.match(/^\[name="(.+)"\]$/)?fields[selector.match(/^\[name="(.+)"\]$/)[1]]:selector.match(/^#member-(.+)-error$/)?errors[selector.match(/^#member-(.+)-error$/)[1]]:map[selector]||null;
 form.querySelectorAll=()=>[...Object.values(fields),reveal,submit];
 const root=Object.assign(node(),{querySelector:selector=>map[selector]||null,querySelectorAll:selector=>selector==='[data-member-mode]'?modes:selector==='[data-registration-field]'?registration:selector==='[data-member-course-link]'?courseLinks:[]});
 if(options.session?.user)delete map['#membership-form'];
 const cleanup=membership.mountMembership(root,{session,...options});
 return {root,fields,errors,form,result,reveal,modes,registration,submit,submitLabel,logout,guide,guideOpen,guideClose,guideCards,guideSelection,courseLinks,coursePage,title,intro,artCourse,headline,art,enter,layout,cleanup,fill(values){Object.entries(values).forEach(([k,v])=>fields[k].value=v);}};
}

test('opening and dismissing the guide keeps entered credentials and restores focus',async()=>{
 const view=ui();view.fill(valid());await view.guideOpen.fire('click');assert.equal(view.guide.open,true);assert.equal(view.guideClose[0].focused,true);
 await view.guide.fire('click',{clientX:20,clientY:20});assert.equal(view.guide.open,true);
 const escape=await view.guide.fire('cancel');assert.equal(escape.prevented,true);assert.equal(view.guide.open,false);assert.equal(view.guideOpen.focused,true);assert.equal(view.fields.password.value,valid().password);
 await view.guideOpen.fire('click');await view.guide.fire('click',{clientX:0,clientY:0});assert.equal(view.guide.open,false);
 await view.guideOpen.fire('click');view.cleanup();assert.equal(view.guide.open,false);await view.guideOpen.fire('click');assert.equal(view.guide.open,false);
});

test('course choice survives a server error and login switch without altering activation scope',async t=>{
 const navigation=browser(t);
 let attempt=0,lastRequest,authenticated;t.mock.method(globalThis,'fetch',async(url,init)=>{lastRequest={url,payload:JSON.parse(init.body)};return ++attempt===1?response({message:'暂时无法开通，请重试。'},503):response({user});});
 const view=ui({onAuthenticated:(value,destination)=>authenticated={value,destination}});view.fill(valid());await view.guideOpen.fire('click');await view.guideCards[2].fire('click');assert.equal(view.guide.open,false);assert.equal(view.title.focused,true);assert.match(view.guideSelection.textContent,/雅思英语小说/);assert.equal(navigation.location.hash,'#membership/ielts');assert.equal(view.fields.password.value,valid().password);
 await view.form.fire('submit');assert.equal(authenticated,undefined);assert.deepEqual(lastRequest.payload,valid());assert.equal(view.guideOpen.disabled,false);
 await view.modes[1].fire('click');view.fields.password.value=valid().password;await view.guideOpen.fire('click');await view.guideCards[2].fire('click');assert.equal(view.title.focused,true);assert.equal(view.submitLabel.textContent,'登录并进入雅思书架');assert.equal(navigation.history.length,1);
 await view.form.fire('submit');assert.equal(lastRequest.url,'/api/auth/login');assert.deepEqual(lastRequest.payload,{account:valid().account,password:valid().password});assert.deepEqual(authenticated,{value:user,destination:'#ielts'});view.cleanup();
});

test('active members open the selected account page with its shelf link; tampered ids cannot navigate',async t=>{
 const navigation=browser(t);
 const view=ui({session:{...session,user}});await view.guideOpen.fire('click');view.guideCards[1].dataset.memberCourse='https://example.com';await view.guideCards[1].fire('click');assert.equal(location.hash,'#membership');assert.equal(view.guide.open,true);
 await view.guideCards[4].fire('click');assert.equal(location.hash,'#membership/cet');assert.equal(view.enter.href,'#cet');assert.equal(view.enter.textContent,'进入四六级书架 →');assert.equal(view.guide.open,false);assert.equal(navigation.history.length,1);view.cleanup();
});

test('only known activation routes resolve to course pages and unknown values cannot enter markup',()=>{
 for(const [id,label] of courses){
  assert.equal(membership.resolveMembershipCourse(`#membership/${id}`),id);assert.equal(membership.resolveMembershipCourse(`#${id}`),id);
  const html=membership.membershipPage(session,id);assert.match(html,new RegExp(`data-member-course-page="${id}"`));assert.match(html,new RegExp(`assets/course-${id}\\.png`));assert.match(html,new RegExp(`href="#membership/${id}" data-member-course-link="${id}" aria-current="page"`));assert.match(html,new RegExp(`注册并进入${label}书架`));assert.match(html,/全站激活码/);
  assert.equal(membership.membershipTitle(id,session),`${label}学习账户`);
  const active=membership.membershipPage({...session,user},id);assert.match(active,new RegExp(`data-member-enter href="#${id}"`));assert.doesNotMatch(active,/id="membership-form"/);
 }
 assert.equal(membership.resolveMembershipCourse('#ielts/long/part-02'),'ielts');
 for(const hash of ['','#membership','#membership/admin','#membership/ielts/extra','#membership/unknown','#membership/<script>','#membership/%69elts','https://example.com/#membership/ielts','#ielts?secret=x'])assert.equal(membership.resolveMembershipCourse(hash),'fullsite');
 const html=membership.membershipPage(session,'<script>alert(1)</script>');assert.match(html,/data-member-course-page="fullsite"/);assert.doesNotMatch(html,/<script>/);
});

test('all four direct activation links retain their destination for registration and login',async t=>{
 const requests=[];t.mock.method(globalThis,'fetch',async(url,init)=>{requests.push({url,payload:JSON.parse(init.body)});return response({user});});
 for(const [id,label] of courses)for(const mode of ['register','login']){
  let authenticated;const courseId=membership.resolveMembershipCourse(`#membership/${id}`),view=ui({courseId,onAuthenticated:(value,destination)=>authenticated={value,destination}});
  if(mode==='login')await view.modes[1].fire('click');view.fill(valid());await view.form.fire('submit');
  assert.deepEqual(authenticated,{value:user,destination:`#${id}`});assert.equal(requests.at(-1).url,`/api/auth/${mode}`);assert.deepEqual(requests.at(-1).payload,mode==='register'?valid():{account:valid().account,password:valid().password});
  assert.equal(view.submitLabel.textContent,`${mode==='register'?'注册':'登录'}并进入${label}书架`);view.cleanup();
 }
 assert.equal(requests.length,8);
});

test('switching activation pages updates theme, title, cover and URL without losing credentials',async t=>{
 const navigation=browser(t),view=ui();view.fill(valid());
 for(const [index,[id,label]] of courses.entries()){
  const event=await view.courseLinks[index+1].fire('click');assert.equal(event.prevented,true);assert.equal(navigation.location.hash,`#membership/${id}`);assert.equal(view.coursePage.dataset.memberCoursePage,id);assert.equal(view.coursePage.classList.contains('member-course-page'),true);assert.equal(view.title.textContent,`${label}学习账户`);assert.equal(navigation.document.title,`${label}学习账户 · ToTo趣味英语`);assert.equal(view.art.src,`./assets/course-${id}.png`);assert.equal(view.submitLabel.textContent,`注册并进入${label}书架`);assert.equal(view.title.focused,true);assert.equal(view.layout.scrolled,true);
  assert.deepEqual(Object.fromEntries(Object.entries(view.fields).map(([key,field])=>[key,field.value])),valid());assert.deepEqual(view.courseLinks.map(link=>link.getAttribute('aria-current')),view.courseLinks.map((_,i)=>i===index+1?'page':undefined));
 }
 await view.courseLinks[0].fire('click');assert.equal(navigation.location.hash,'#membership');assert.equal(view.coursePage.classList.contains('member-course-page'),false);assert.equal(view.art.src,'./assets/member-library.png');assert.equal(view.submitLabel.textContent,'注册并开通会员');
 assert.deepEqual(navigation.history.map(entry=>entry.url),['#membership/gaokao','#membership/ielts','#membership/kaoyan','#membership/cet','#membership']);
 const serialized=JSON.stringify(navigation.history);for(const secret of Object.values(valid()))assert.ok(!serialized.includes(secret));
 await view.modes[1].fire('click');view.fields.password.value=valid().password;await view.courseLinks[2].fire('click');assert.equal(view.fields.password.value,valid().password);assert.equal(view.fields.order.disabled,true);assert.equal(view.submitLabel.textContent,'登录并进入雅思书架');view.cleanup();
});

test('course navigation is blocked during submission and restored after a failed request',async t=>{
 const navigation=browser(t,'#membership/gaokao');let resolve,lastRequest;
 t.mock.method(globalThis,'fetch',(url,init)=>{lastRequest={url,payload:JSON.parse(init.body)};return new Promise(done=>resolve=done);});
 const view=ui({courseId:'gaokao'});view.fill(valid());const pending=view.form.fire('submit');assert.ok(view.courseLinks.every(link=>link.getAttribute('aria-disabled')==='true'));
 await view.courseLinks[2].fire('click');await view.guideCards[3].fire('click');assert.equal(navigation.history.length,0);assert.equal(navigation.location.hash,'#membership/gaokao');assert.equal(view.submitLabel.textContent,'正在提交…');
 resolve(response({message:'请稍后再试。'},503));await pending;assert.equal(lastRequest.url,'/api/auth/register');assert.deepEqual(lastRequest.payload,valid());assert.ok(view.courseLinks.every(link=>link.getAttribute('aria-disabled')===undefined));
 await view.courseLinks[2].fire('click');assert.equal(navigation.location.hash,'#membership/ielts');assert.equal(view.fields.activation.value,valid().activation);
 const count=navigation.history.length,modified=await view.courseLinks[3].fire('click',{ctrlKey:true});assert.equal(modified.prevented,undefined);assert.equal(navigation.history.length,count);view.cleanup();await view.courseLinks[1].fire('click');assert.equal(navigation.history.length,count);
});

test('invalid submit focuses first field and never calls the server',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>response({user}));const view=ui();const event=await view.form.fire('submit');assert.equal(event.prevented,true);assert.equal(fetch.mock.calls.length,0);assert.equal(view.fields.order.focused,true);assert.equal(view.fields.order.attributes['aria-invalid'],'true');view.cleanup();
});

test('registration submits once with CSRF and same-origin credentials, clears secrets after confirmed success',async t=>{
 let resolve,calls=[];t.mock.method(globalThis,'fetch',(url,init)=>{calls.push({url,init});return new Promise(r=>resolve=r);});
 let authenticated;const view=ui({onAuthenticated:value=>authenticated=value});view.fill(valid());const pending=view.form.fire('submit');assert.equal(calls.length,1);assert.equal(view.submit.disabled,true);await view.form.fire('submit');assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/api/auth/register');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.headers['X-CSRF-Token'],'test-csrf');assert.deepEqual(JSON.parse(calls[0].init.body),valid());assert.equal(authenticated,undefined);
 resolve(response({user}));await pending;assert.deepEqual(authenticated,user);assert.equal(view.fields.password.value,'');assert.equal(view.fields.activation.value,'');assert.equal(view.submit.disabled,false);view.cleanup();
});

test('server field errors do not fake success and a missing CSRF token never submits',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>response({error:'invalid_activation',message:'激活码已使用。',fields:{activation:'此激活码已兑换。'}},409));
 let authenticated=false;const view=ui({onAuthenticated:()=>authenticated=true});view.fill(valid());await view.form.fire('submit');assert.equal(authenticated,false);assert.match(view.result.textContent,/激活码已使用/);assert.match(view.errors.activation.textContent,/已兑换/);assert.equal(view.fields.activation.attributes['aria-invalid'],'true');assert.equal(view.fields.activation.focused,true);view.cleanup();
 const without=ui({session:{user:null,admin:false,csrf:''}});without.fill(valid());await without.form.fire('submit');assert.equal(fetch.mock.calls.length,1);assert.match(without.result.textContent,/刷新/);without.cleanup();
});

test('login mode clears secrets, conceals password and sends only mobile/password',async t=>{
 let request;t.mock.method(globalThis,'fetch',async(url,init)=>{request={url,init};return response({user});});
 const view=ui({onAuthenticated(){}});view.fill(valid());await view.reveal.fire('click');assert.equal(view.fields.password.type,'text');await view.modes[1].fire('click');for(const key of ['order','activation','password'])assert.equal(view.fields[key].value,'');assert.equal(view.fields.account.value,valid().account);assert.equal(view.fields.password.type,'password');assert.equal(view.fields.order.disabled,true);
 view.fields.password.value='old';await view.form.fire('submit');assert.equal(request.url,'/api/auth/login');assert.deepEqual(JSON.parse(request.init.body),{account:valid().account,password:'old'});view.cleanup();
});

test('network failure and malformed success restore controls without claiming registration',async t=>{
 let attempt=0;t.mock.method(globalThis,'fetch',async()=>{attempt++;if(attempt===1)throw new TypeError('network failed');return response({ok:true});});
 let authenticated=false;const view=ui({onAuthenticated:()=>authenticated=true});view.fill(valid());await view.form.fire('submit');assert.match(view.result.textContent,/无法连接会员服务/);assert.equal(view.submit.disabled,false);assert.equal(view.fields.password.value,valid().password);
 await view.form.fire('submit');assert.match(view.result.textContent,/未确认账号状态/);assert.equal(authenticated,false);assert.equal(view.submit.disabled,false);view.cleanup();
});

test('cleanup aborts pending requests and ignores late success; remount does not double submit',async t=>{
 let resolve,signal,calls=0;t.mock.method(globalThis,'fetch',(_,init)=>{calls++;signal=init.signal;return new Promise(r=>resolve=r);});
 let authenticated=false;const view=ui({onAuthenticated:()=>authenticated=true});view.fill(valid());const pending=view.form.fire('submit');view.cleanup();assert.equal(signal.aborted,true);resolve(response({user}));await pending;assert.equal(authenticated,false);
 const cleanup=membership.mountMembership(view.root,{session,onAuthenticated(){}});view.fill(valid());const next=view.form.fire('submit');assert.equal(calls,2);resolve(response({user}));await next;cleanup();
});

test('logout waits for API confirmation; failure keeps the session',async t=>{
 let fail=true,calls=0;t.mock.method(globalThis,'fetch',async(url,init)=>{calls++;assert.equal(url,'/api/auth/logout');assert.equal(init.headers['X-CSRF-Token'],'test-csrf');return response(fail?{message:'暂时无法退出，请重试。'}:{ok:true},fail?503:200);});
 let loggedOut=false;const view=ui({session:{...session,user},onLogout:()=>loggedOut=true});await view.logout.fire('click');assert.equal(loggedOut,false);assert.match(view.result.textContent,/无法退出/);fail=false;await view.logout.fire('click');assert.equal(loggedOut,true);assert.equal(calls,2);view.cleanup();
});

function adminUi(options={}){
 const ids=['#member-admin-form','#member-admin-result','#member-admin-generated','#member-admin-generated-code','#member-admin-list','#member-admin-list-status','#member-admin-generate','#member-admin-refresh','#member-admin-copy','#member-admin-prev','#member-admin-next','#member-admin-page-status'];
 const map=Object.fromEntries(ids.map(id=>[id,node()]));const root=Object.assign(node(),{querySelector:selector=>map[selector]||null});map['#member-admin-form'].querySelectorAll=()=>[map['#member-admin-generate']];
 const cleanup=membership.mountMembershipAdmin(root,{session:{...session,admin:true},...options});return {root,map,cleanup};
}

test('admin creates an unbound code without an order, copies only the code, and clears it on disable',async t=>{
 const requests=[];t.mock.method(globalThis,'fetch',async(url,init={})=>{requests.push({url,init});if(init.method==='POST'&&url.endsWith('/disable'))return response({ok:true});if(init.method==='POST')return response({code:{id:'c1',order:null,activation:'CJ-SECRET-ONCE',status:'available'}});return response({total:2,offset:0,limit:50,codes:[{id:'c1',order:null,status:'available',createdAt:'2026-11-02T00:00:00Z'},{id:'c2',order:'<script>x</script>',status:'used',phone:'13800138000',createdAt:'2026-11-02T00:00:00Z'}]});});
 let copied;const descriptor=Object.getOwnPropertyDescriptor(globalThis.navigator,'clipboard');Object.defineProperty(globalThis.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});t.after(()=>{if(descriptor)Object.defineProperty(globalThis.navigator,'clipboard',descriptor);else delete globalThis.navigator.clipboard;});
 const view=adminUi();await tick();assert.match(view.map['#member-admin-list'].innerHTML,/&lt;script/);assert.doesNotMatch(view.map['#member-admin-list'].innerHTML,/<script>/);assert.match(view.map['#member-admin-list'].innerHTML,/data-member-disable="c1"/);assert.doesNotMatch(view.map['#member-admin-list'].innerHTML,/data-member-disable="c2"/);
 assert.match(view.map['#member-admin-list'].innerHTML,/待客户激活后绑定/);assert.match(view.map['#member-admin-list'].innerHTML,/138\*\*\*\*8000/);assert.doesNotMatch(view.map['#member-admin-list'].innerHTML,/停用订单 null|13800138000/);
 await view.map['#member-admin-form'].fire('submit');const creation=requests.find(r=>r.url==='/api/admin/codes'&&r.init.method==='POST');assert.ok(creation);assert.deepEqual(JSON.parse(creation.init.body),{});assert.equal(creation.init.headers['X-CSRF-Token'],'test-csrf');assert.equal(view.map['#member-admin-generated-code'].textContent,'CJ-SECRET-ONCE');assert.equal(view.map['#member-admin-generated'].hidden,false);
 await view.map['#member-admin-copy'].fire('click');assert.equal(copied,'CJ-SECRET-ONCE');
 const button=Object.assign(node(),{dataset:{memberDisable:'c1'},closest(){return this;}});await view.map['#member-admin-list'].fire('click',{target:button});const post=requests.find(r=>r.url==='/api/admin/codes/c1/disable');assert.ok(post);assert.equal(post.init.headers['X-CSRF-Token'],'test-csrf');assert.equal(view.map['#member-admin-generated-code'].textContent,'');assert.equal(view.map['#member-admin-generated'].hidden,true);view.cleanup();
});

test('unauthorized admin never fetches and forged redeemed disable targets never issue mutations',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>response({total:1,offset:0,limit:50,codes:[{id:'c2',order:'P002',status:'used'}]}));const denied=adminUi({session:{...session,admin:false}});await tick();assert.equal(fetch.mock.calls.length,0);denied.cleanup();const view=adminUi();await tick();const button=Object.assign(node(),{dataset:{memberDisable:'c2'},closest(){return this;}});await view.map['#member-admin-list'].fire('click',{target:button});assert.equal(fetch.mock.calls.length,1);view.cleanup();
});

test('admin pages are bounded to 50 rows and navigation stays disabled while loading',async t=>{
 const requests=[],resolvers=[];t.mock.method(globalThis,'fetch',(url,init)=>{requests.push({url,init});return new Promise(resolve=>resolvers.push(resolve));});
 const view=adminUi(),previous=view.map['#member-admin-prev'],next=view.map['#member-admin-next'];
 assert.equal(requests[0].url,'/api/admin/codes?offset=0&limit=50');assert.equal(previous.disabled,true);assert.equal(next.disabled,true);
 const rows=Array.from({length:50},(_,i)=>({id:`c${i}`,order:`P${String(i).padStart(5,'0')}`,status:'available'}));
 resolvers.shift()(response({codes:rows,total:51,offset:0,limit:50}));await tick();assert.equal(previous.disabled,true);assert.equal(next.disabled,false);assert.match(view.map['#member-admin-page-status'].textContent,/1 \/ 2/);assert.match(view.map['#member-admin-list-status'].textContent,/共 51/);
 const pending=next.fire('click');assert.equal(requests[1].url,'/api/admin/codes?offset=50&limit=50');assert.equal(previous.disabled,true);assert.equal(next.disabled,true);await next.fire('click');assert.equal(requests.length,2);
 resolvers.shift()(response({codes:[{id:'c50',order:'P00050',status:'used'}],total:51,offset:50,limit:50}));await pending;assert.equal(previous.disabled,false);assert.equal(next.disabled,true);assert.match(view.map['#member-admin-page-status'].textContent,/2 \/ 2/);
 const back=previous.fire('click');assert.equal(requests[2].url,'/api/admin/codes?offset=0&limit=50');resolvers.shift()(response({codes:rows,total:51,offset:0,limit:50}));await back;assert.equal(previous.disabled,true);view.cleanup();
});
