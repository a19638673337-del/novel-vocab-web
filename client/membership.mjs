/** Real membership UI. Session/activation authority belongs to the same-origin API. */
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mounted = new WeakMap();
const phoneText = phone => /^1[3-9]\d{9}$/.test(String(phone)) ? `${String(phone).slice(0,3)}****${String(phone).slice(-4)}` : String(phone ?? '');
const isUrl = value => /(?:https?:\/\/|www\.)/i.test(value);
const guideCourses = [
  {id:'fullsite',name:'全站会员',route:'#library-catalog',detail:'一个激活码 · 四个专区统一开通'},
  {id:'gaokao',name:'高中英语小说',route:'#gaokao',detail:'高中词汇 · 作品目录'},
  {id:'ielts',name:'雅思英语小说',route:'#ielts',detail:'长短篇目录 · 已收录词表'},
  {id:'kaoyan',name:'考研英语小说',route:'#kaoyan',detail:'按题材浏览 · 作品目录'},
  {id:'cet',name:'四六级英语小说',route:'#cet',detail:'原创短篇 · 词卡与填空'}
];
const coursePresentation = {
  fullsite:{short:'全站会员',image:'member-library.png',alt:'暖灯下的书房，书架环绕着摊开的书',headline:'翻开故事，让单词有了归处。',note:'从一篇小说，走向更大的世界。',intro:'高中、雅思、考研、四六级，让每个阶段都有好故事。'},
  gaokao:{short:'高中',image:'course-gaokao.png',alt:'樱花校园中的高中英语阅读插画',headline:'从校园故事开始，遇见想记住的单词。',note:'高中英语小说 · 先选一个喜欢的故事',intro:'开通学习账户，从高中英语小说目录开始。'},
  ielts:{short:'雅思',image:'course-ielts.png',alt:'雅思英语小说课程插画',headline:'走进更大的世界，让英语陪你读下去。',note:'雅思英语小说 · 长篇与短篇目录',intro:'开通学习账户，浏览雅思长短篇目录与已收录词表。'},
  kaoyan:{short:'考研',image:'course-kaoyan.png',alt:'考研英语小说课程插画',headline:'给备考留一段，愿意读下去的故事。',note:'考研英语小说 · 按题材挑选故事',intro:'开通学习账户，从考研英语小说目录开始。'},
  cet:{short:'四六级',image:'course-cet.png',alt:'四六级英语小说课程插画',headline:'把单词放进剧情，把故事读进记忆。',note:'四六级英语小说 · 原创短篇与语境练习',intro:'开通学习账户，阅读原创短篇、点词释义与练习填空。'}
};
const getCourse = id => guideCourses.find(course=>course.id===id)||guideCourses[0];
const activationRoute = course => course.id==='fullsite'?'#membership':`#membership/${course.id}`;
export function resolveMembershipCourse(hash='') {
  const matched=String(hash).match(/^#membership\/(gaokao|ielts|kaoyan|cet)$/)||String(hash).match(/^#(gaokao|ielts|kaoyan|cet)(?:\/[^?#]*)?$/);
  return getCourse(matched?.[1]).id;
}
export function membershipTitle(courseId='fullsite',session={}) {
  const course=getCourse(courseId);
  return course.id==='fullsite'?(session.user?'我的会员中心':'开通全站会员'):`${coursePresentation[course.id].short}学习账户`;
}
const submitLabel = (course,mode='register') => course.id==='fullsite'?(mode==='login'?'登录账号':'注册并开通会员'):(mode==='login'?'登录并进入':'注册并进入')+coursePresentation[course.id].short+'书架';

function membershipGuide(session) {
  return `<dialog id="member-guide-dialog" class="member-guide-dialog" aria-labelledby="member-guide-title" aria-describedby="member-guide-description"><div class="member-guide-modal">
    <button type="button" class="member-guide-close" data-member-guide-close aria-label="关闭开通引导">×</button>
    <h2 id="member-guide-title">开通账号，选择你的学习专区</h2>
    <p id="member-guide-description" class="member-guide-description">${session.user?.active ? '你的全站会员账号可进入以下四个专区，选择一个方向开始学习。' : '查看你收到的发货信息，使用本站激活码和购买订单号开通。一个全站会员账号，通用四个专区。'}</p>
    <div class="member-guide-cards">${guideCourses.map(course=>`<button type="button" class="member-guide-card member-guide-card-${course.id}" data-member-course="${course.id}"><span><strong>${course.name}</strong><small>${course.detail}</small></span><span class="member-guide-arrow" aria-hidden="true">→</span></button>`).join('')}</div>
    <p class="member-guide-note">选择卡片进入对应的账号开通页面。四个专区共用全站会员账号，已开通可直接登录。当前四六级可读原创短篇；高中、雅思和考研以已整理目录为主，雅思另有50词词表。</p>
    <button type="button" class="btn member-guide-ack" data-member-guide-close>我知道了</button>
  </div></dialog>`;
}

export function validateMembershipInput(values, mode = 'register') {
  const errors = {}, text = key => typeof values?.[key] === 'string' ? values[key].trim() : '';
  if (mode !== 'login') {
    if (!text('order')) errors.order = '请填写订单编号。';
    else if (isUrl(text('order'))) errors.order = '这里填写订单编号，不是网站链接。';
    else if (!/^[A-Z0-9_-]{6,64}$/i.test(text('order'))) errors.order = '订单编号需为 6–64 位英文字母、数字、下划线或连字符。';
    if (!text('activation')) errors.activation = '请填写激活码。';
    else if (isUrl(text('activation'))) errors.activation = '这里填写激活码，不是网站链接。';
    else if (text('activation').length > 96) errors.activation = '激活码请控制在 96 个字符以内。';
  }
  if (!text('account')) errors.account = '请填写登录手机号。';
  else if (!/^1[3-9]\d{9}$/.test(text('account'))) errors.account = '请填写 11 位中国大陆手机号。';
  const password = typeof values?.password === 'string' ? values.password : '';
  if (!password.trim()) errors.password = '请填写密码。';
  else if (mode !== 'login' && (password.length < 8 || password.length > 64)) errors.password = '密码需为 8–64 个字符。';
  else if (mode === 'login' && password.length > 64) errors.password = '密码请控制在 64 个字符以内。';
  return errors;
}

function memberForm(course) {
  return `<div class="segmented member-modes" role="group" aria-label="会员账号模式"><button type="button" data-member-mode="register" aria-pressed="true">新客户开通</button><button type="button" data-member-mode="login" aria-pressed="false">已有账号</button></div>
    <p class="member-availability">填写你的真实购买订单号和收到的激活码，首次开通时自动绑定。已有账号请直接登录。</p>
    <form id="membership-form" class="member-form" novalidate>
      <div class="member-fields">
        <div class="member-field" data-registration-field><label for="member-order">购买订单号</label><input id="member-order" name="order" type="text" placeholder="填写你的真实购买订单号" maxlength="64" autocomplete="off" aria-describedby="member-order-error" aria-invalid="false" spellcheck="false" required><p id="member-order-error" class="member-field-error"></p></div>
        <div class="member-field" data-registration-field><label for="member-activation">全站激活码</label><input id="member-activation" name="activation" type="text" placeholder="填写激活码，而非网址" maxlength="96" autocomplete="off" aria-describedby="member-activation-error" aria-invalid="false" spellcheck="false" required><p id="member-activation-error" class="member-field-error"></p></div>
        <div class="member-field"><label for="member-account">登录手机号</label><input id="member-account" name="account" type="tel" inputmode="tel" placeholder="请输入 11 位手机号，方便记住账号" maxlength="11" autocomplete="username" aria-describedby="member-account-error" aria-invalid="false" required><p id="member-account-error" class="member-field-error"></p></div>
        <div class="member-field"><label id="member-password-label" for="member-password">设置密码</label><div class="member-password-wrap"><input id="member-password" name="password" type="password" placeholder="设置 8–64 位密码" maxlength="64" autocomplete="new-password" aria-describedby="member-password-error" aria-invalid="false" required><button type="button" class="member-reveal" aria-controls="member-password" aria-pressed="false">显示密码</button></div><p id="member-password-error" class="member-field-error"></p></div>
      </div>
      <button type="submit" class="btn member-submit"><span id="member-submit-label">${submitLabel(course)}</span><span class="member-submit-arrow" aria-hidden="true">→</span></button>
      <div id="member-result" class="member-result" role="status" aria-live="polite" tabindex="-1" hidden></div>
      <div class="member-form-bottom"><span>订单号与激活码在成功开通时绑定；每个订单号、每个激活码均只能开通一个账号。</span></div>
    </form>`;
}

function accountPanel(session,course) {
  return `<div class="member-account-card"><span class="member-account-label">当前登录账号</span><h2>${esc(phoneText(session.user.phone))}</h2><p class="member-account-status">${session.user.active === true ? '会员已激活' : '会员未激活'}</p><p>学习记录仍保存在当前浏览器，登录不会自动同步其他设备的学习记录。</p><div class="member-account-actions"><a class="btn primary" data-member-enter href="${course.route}">${course.id==='fullsite'?'进入我的书架':'进入'+coursePresentation[course.id].short+'书架'} →</a><button type="button" class="btn" data-member-logout>退出登录</button></div></div><div id="member-result" class="member-result" role="status" aria-live="polite" tabindex="-1" hidden></div>`;
}

export function membershipPage(session = {},courseId='fullsite') {
  const course=getCourse(courseId),presentation=coursePresentation[course.id];
  return `<section class="membership-page${course.id==='fullsite'?'':' member-course-page'}" data-member-course-page="${course.id}" aria-labelledby="membership-title">
    <div class="member-breadcrumb"><a class="back-link" data-member-back href="#library-catalog">← 返回全站书架</a><span>ToTo趣味英语 · 会员中心</span></div>
    <nav class="member-course-switch" aria-label="选择账号开通专区">${guideCourses.map(item=>`<a href="${activationRoute(item)}" data-member-course-link="${item.id}"${item.id===course.id?' aria-current="page"':''}>${coursePresentation[item.id].short}</a>`).join('')}</nav>
    <div class="member-layout"><aside class="member-art"><img src="./assets/${presentation.image}" alt="${presentation.alt}" width="1086" height="1448"><div class="member-art-top"><span class="member-monogram">ToTo趣味英语</span><span data-member-art-course>${course.name}</span></div><div class="member-art-copy"><span class="member-art-rule"></span><p>${presentation.headline}</p><small>${presentation.note}</small></div></aside>
      <div class="member-panel"><div class="member-eyebrow"><span data-member-eyebrow>${course.id==='fullsite'?'全站会员 · 统一学习入口':'首次购买，从这里开始'}</span><span class="member-preview-badge">${session.user ? '已登录' : '账号开通'}</span></div><h1 id="membership-title" tabindex="-1">${membershipTitle(course.id,session)}</h1><p class="member-intro">${presentation.intro}</p>
        <button type="button" class="member-guide-trigger" data-member-guide-open aria-haspopup="dialog" aria-controls="member-guide-dialog">开通引导：我应该进入哪个专区？</button>
        <p class="member-guide-selection" role="status" aria-live="polite" hidden></p>
        ${session.user ? accountPanel(session,course) : memberForm(course)}
      </div></div>
    ${membershipGuide(session)}
    <section class="member-zones" aria-labelledby="member-zones-title"><div class="member-zones-heading"><h2 id="member-zones-title">选择你的阅读方向</h2><span>从当前可读的故事开始</span></div><div class="member-zone-grid">
      <div class="member-zone"><span class="zone-en">SENIOR HIGH</span><h3>高中英语</h3><p>查看作品简介、章节目录与原站词数。</p><a class="text-btn" href="${session.user?.active?'#gaokao':'#membership/gaokao'}" ${session.user?.active?'':'data-member-course-link="gaokao"'}>${session.user?.active?'浏览高中目录':'开通高中学习账户'} →</a></div>
      <div class="member-zone"><span class="zone-en">IELTS</span><h3>雅思英语</h3><p>在不同题材里，遇见更广的世界。</p><a class="text-btn" href="${session.user?.active?'#ielts':'#membership/ielts'}" ${session.user?.active?'':'data-member-course-link="ielts"'}>${session.user?.active?'浏览雅思书架':'开通雅思学习账户'} →</a></div>
      <div class="member-zone"><span class="zone-en">POSTGRADUATE</span><h3>考研英语</h3><p>按题材挑选故事，查看简介与原站标注词数。</p><a class="text-btn" href="${session.user?.active?'#kaoyan':'#membership/kaoyan'}" ${session.user?.active?'':'data-member-course-link="kaoyan"'}>${session.user?.active?'浏览考研目录':'开通考研学习账户'} →</a></div>
      <a class="member-zone member-zone-ready" href="${session.user?.active?'#cet':'#membership/cet'}" ${session.user?.active?'':'data-member-course-link="cet"'}><span class="zone-en">CET-4 / CET-6</span><h3>四六级英语 <span aria-hidden="true">↗</span></h3><p>原创短篇、语境词卡与英文填空。</p><span class="zone-status">${session.user?.active?'进入四六级专区':'开通四六级学习账户'} →</span></a>
    </div></section></section>`;
}

function lifetime(root) {
  mounted.get(root)?.();
  const listeners=[],controllers=new Set();
  const life={active:true,listen(node,type,handler){if(!node)return;node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));},controllers,
    cleanup(){if(!life.active)return;life.active=false;controllers.forEach(controller=>controller.abort());listeners.forEach(remove=>remove());if(mounted.get(root)===life.cleanup)mounted.delete(root);}};
  mounted.set(root,life.cleanup);return life;
}
async function request(life,session,path,method='GET',body) {
  if(method!=='GET'&&!session?.csrf)throw new Error('登录状态尚未加载，请刷新页面后重试。');
  const controller=new AbortController();life.controllers.add(controller);
  try {
    const headers={Accept:'application/json'};
    if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=session.csrf;}
    const response=await fetch(path,{method,credentials:'same-origin',headers,signal:controller.signal,...(body===undefined?{}:{body:JSON.stringify(body)})});
    let data;try{data=await response.json();}catch{throw new Error('服务器返回了无法读取的结果，请稍后重试。');}
    if(!response.ok){const error=new Error(typeof data?.message==='string'?data.message:(response.status===401?'登录已失效，请重新登录。':response.status===403?'当前账号没有此操作权限。':'操作未成功，请稍后重试。'));error.status=response.status;error.fields=data?.fields;throw error;}
    return data;
  } finally {life.controllers.delete(controller);}
}
function message(node,text){if(!node)return;node.textContent=text;node.hidden=false;node.focus();}
const failure = error => error?.name==='TypeError'?'暂时无法连接会员服务，请检查网络后重试。':error?.message||'操作未成功，请稍后重试。';

export function mountMembership(root,{session={},courseId='fullsite',onAuthenticated,onLogout}={}) {
  const life=lifetime(root),form=root.querySelector('#membership-form'),result=root.querySelector('#member-result');
  let pending=false,selectedCourse=getCourse(courseId),guideFocus=null,mode='register',submitted=false;
  const guide=root.querySelector('#member-guide-dialog'),guideOpen=root.querySelector('[data-member-guide-open]'),guideSelection=root.querySelector('.member-guide-selection');
  const courseLinks=[...root.querySelectorAll('[data-member-course-link]')];
  const chooseCourse=id=>{
    if(pending||!life.active)return;const course=guideCourses.find(item=>item.id===id);if(!course)return;
    selectedCourse=course;const presentation=coursePresentation[course.id],page=root.querySelector('[data-member-course-page]');
    if(page){page.dataset.memberCoursePage=course.id;page.classList.toggle('member-course-page',course.id!=='fullsite');}
    const setText=(selector,text)=>{const node=root.querySelector(selector);if(node)node.textContent=text;};
    setText('#membership-title',membershipTitle(course.id,session));setText('.member-intro',presentation.intro);
    setText('[data-member-eyebrow]',course.id==='fullsite'?'全站会员 · 统一学习入口':'首次购买，从这里开始');
    setText('[data-member-art-course]',course.name);setText('.member-art-copy p',presentation.headline);setText('.member-art-copy small',presentation.note);
    const art=root.querySelector('.member-art img');if(art){art.src=`./assets/${presentation.image}`;art.alt=presentation.alt;}
    setText('#member-submit-label',submitLabel(course,mode));
    const enter=root.querySelector('[data-member-enter]');if(enter){enter.href=course.route;enter.textContent=(course.id==='fullsite'?'进入我的书架':'进入'+presentation.short+'书架')+' →';}
    for(const link of courseLinks)link.dataset.memberCourseLink===course.id?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current');
    if(guideSelection){guideSelection.textContent=`当前为${course.name}账号页面。全站激活码通用，已开通可直接登录。`;guideSelection.hidden=false;}
    if(globalThis.location?.hash!==activationRoute(course))globalThis.history?.pushState(null,'',activationRoute(course));
    if(globalThis.document)document.title=membershipTitle(course.id,session)+' · ToTo趣味英语';
    closeGuide(root.querySelector('#membership-title'));root.querySelector('#membership-title')?.focus({preventScroll:true});
    root.querySelector('.member-layout')?.scrollIntoView?.({block:'start',behavior:'instant'});
  };
  const closeGuide=focus=>{guideFocus=focus||guideOpen;if(guide?.open)guide.close();};
  life.listen(guideOpen,'click',()=>{if(pending||!life.active||!guide||guide.open)return;guideFocus=guideOpen;guide.showModal();guide.querySelector('[data-member-guide-close]')?.focus();});
  for(const button of guide?.querySelectorAll('[data-member-guide-close]')||[])life.listen(button,'click',()=>closeGuide());
  life.listen(guide,'cancel',event=>{event.preventDefault();closeGuide();});
  life.listen(guide,'close',()=>{if(life.active&&guideFocus?.isConnected!==false)guideFocus?.focus({preventScroll:true});});
  life.listen(guide,'click',event=>{if(event.target!==guide)return;const box=guide.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeGuide();});
  for(const button of guide?.querySelectorAll('[data-member-course]')||[])life.listen(button,'click',()=>{
    chooseCourse(button.dataset.memberCourse);
  });
  for(const link of courseLinks)life.listen(link,'click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();chooseCourse(link.dataset.memberCourseLink);});
  const dispose=life.cleanup;life.cleanup=()=>{dispose();if(guide?.open)guide.close();};mounted.set(root,life.cleanup);
  const logout=root.querySelector('[data-member-logout]');
  life.listen(logout,'click',async()=>{
    if(pending||!life.active)return;pending=true;logout.disabled=true;
    try{await request(life,session,'/api/auth/logout','POST',{});if(!life.active)return;if(typeof onLogout==='function')onLogout(activationRoute(selectedCourse));else{life.cleanup();root.innerHTML=membershipPage({...session,user:null},selectedCourse.id);mountMembership(root,{session:{...session,user:null},courseId:selectedCourse.id});}}
    catch(error){if(life.active)message(result,failure(error));}
    finally{pending=false;if(life.active)logout.disabled=false;}
  });
  if(!form)return life.cleanup;
  const keys=['order','activation','account','password'],field=key=>form.querySelector(`[name="${key}"]`),reveal=form.querySelector('.member-reveal');
  const modes=[...root.querySelectorAll('[data-member-mode]')];
  const clearResult=()=>{result.hidden=true;result.textContent='';};
  const showErrors=errors=>{for(const key of keys){const text=typeof errors?.[key]==='string'?errors[key]:'';field(key).setAttribute('aria-invalid',String(!!text));form.querySelector(`#member-${key}-error`).textContent=text;}};
  const values=()=>Object.fromEntries(keys.map(key=>[key,field(key).value]));
  const conceal=()=>{field('password').type='password';reveal.textContent='显示密码';reveal.setAttribute('aria-pressed','false');};
  const busy=value=>{pending=value;if(guideOpen)guideOpen.disabled=value;for(const link of courseLinks)value?link.setAttribute('aria-disabled','true'):link.removeAttribute('aria-disabled');form.setAttribute('aria-busy',String(value));for(const el of [...form.querySelectorAll('input,button'),...modes])el.disabled=value;for(const key of ['order','activation'])field(key).disabled=value||mode==='login';root.querySelector('#member-submit-label').textContent=value?'正在提交…':submitLabel(selectedCourse,mode);};
  for(const button of modes)life.listen(button,'click',()=>{
    if(pending||mode===button.dataset.memberMode)return;mode=button.dataset.memberMode==='login'?'login':'register';
    modes.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    root.querySelectorAll('[data-registration-field]').forEach(el=>{el.hidden=mode==='login';el.querySelector('input').disabled=mode==='login';});
    for(const key of ['order','activation','password'])field(key).value='';conceal();submitted=false;showErrors({});clearResult();
    root.querySelector('#member-password-label').textContent=mode==='login'?'登录密码':'设置密码';field('password').placeholder=mode==='login'?'填写登录密码':'设置 8–64 位密码';field('password').autocomplete=mode==='login'?'current-password':'new-password';busy(false);
  });
  life.listen(reveal,'click',()=>{const input=field('password'),show=input.type==='password',start=input.selectionStart,end=input.selectionEnd;input.type=show?'text':'password';reveal.textContent=show?'隐藏密码':'显示密码';reveal.setAttribute('aria-pressed',String(show));input.focus();if(start!==null&&end!==null)input.setSelectionRange(start,end);});
  life.listen(form,'input',event=>{event.stopPropagation();clearResult();if(submitted&&!event.isComposing){const key=event.target.name;if(keys.includes(key)){const error=validateMembershipInput(values(),mode)[key];event.target.setAttribute('aria-invalid',String(!!error));form.querySelector(`#member-${key}-error`).textContent=error||'';}}});
  life.listen(form,'submit',async event=>{
    event.preventDefault();if(pending||!life.active)return;submitted=true;const errors=validateMembershipInput(values(),mode);showErrors(errors);clearResult();const invalid=keys.find(key=>errors[key]);
    if(invalid){result.textContent='请检查标出的填写项。';result.hidden=false;field(invalid).focus();return;}
    const raw=values(),payload={account:raw.account.trim(),password:raw.password};if(mode==='register'){payload.order=raw.order.trim();payload.activation=raw.activation.trim();}busy(true);
    try{const data=await request(life,session,`/api/auth/${mode==='login'?'login':'register'}`,'POST',payload);if(!life.active)return;if(!data?.user||typeof data.user.phone!=='string')throw new Error('服务器未确认账号状态，请刷新后重试。');for(const key of ['password','activation','order'])field(key).value='';conceal();message(result,mode==='login'?'登录成功。':data.user.active===true?'注册成功，会员已激活。':'注册成功，请查看会员状态。');if(typeof onAuthenticated==='function')onAuthenticated(data.user,selectedCourse.route);else{life.cleanup();const next={...session,user:data.user};root.innerHTML=membershipPage(next,selectedCourse.id);mountMembership(root,{session:next,courseId:selectedCourse.id,onAuthenticated,onLogout});}}
    catch(error){if(!life.active)return;showErrors(error.fields||{});message(result,failure(error));const invalid=keys.find(key=>typeof error.fields?.[key]==='string');if(invalid)field(invalid).focus();}
    finally{if(life.active)busy(false);}
  });
  const cleanup=life.cleanup;life.cleanup=()=>{for(const key of ['order','activation','password'])field(key).value='';cleanup();};mounted.set(root,life.cleanup);
  return life.cleanup;
}

export function membershipAdminPage(session={}) {
  if(session.admin!==true)return `<section class="membership-page member-admin-page"><div class="member-breadcrumb"><a href="#membership">← 返回会员中心</a></div><div class="member-panel member-admin-shell"><h1>需要管理员权限</h1><p>当前账号无法管理激活码。请返回会员中心，使用具有管理权限的账号。</p><a class="btn" href="#membership">返回会员中心</a></div></section>`;
  return `<section class="membership-page member-admin-page" aria-labelledby="member-admin-title"><div class="member-breadcrumb"><a href="#membership">← 返回会员中心</a><span>ToTo趣味英语 · 会员管理</span></div><div class="member-panel member-admin-shell"><div class="member-eyebrow"><span>会员管理</span><span class="member-preview-badge">管理员</span></div><h1 id="member-admin-title">激活码管理</h1><p class="member-intro">先生成激活码，再发给客户。客户开通时填写自己的购买订单号，成功激活后才绑定订单与账号。本站不自动核验付款。</p>
    <form id="member-admin-form" novalidate><button id="member-admin-generate" class="btn member-submit" type="submit"><span>生成激活码</span><span class="member-submit-arrow" aria-hidden="true">→</span></button></form>
    <div id="member-admin-result" class="member-result" role="status" aria-live="polite" tabindex="-1" hidden></div>
    <section id="member-admin-generated" class="member-generated" hidden aria-labelledby="member-generated-title"><h2 id="member-generated-title">本次生成的激活码</h2><p>完整激活码只在生成时显示，请现在复制并妥善保存，离开页面后无法再次查看。</p><dl><dt>激活码 · 待客户激活后绑定</dt><dd><code id="member-admin-generated-code"></code></dd></dl><button id="member-admin-copy" type="button" class="btn">复制激活码</button></section>
    <div class="member-admin-heading"><h2>兑换记录</h2><button id="member-admin-refresh" type="button" class="btn">刷新记录</button></div><p id="member-admin-list-status" role="status" aria-live="polite">正在读取兑换记录…</p><div id="member-admin-list" class="member-code-list"></div><div class="member-admin-pagination"><button id="member-admin-prev" type="button" class="btn" disabled>上一页</button><span id="member-admin-page-status" role="status" aria-live="polite">第 1 页</span><button id="member-admin-next" type="button" class="btn" disabled>下一页</button></div><p class="member-availability">停用仅适用于未使用的激活码，不会撤销已兑换账号的会员资格。</p>
  </div></section>`;
}

function codeList(codes){
  if(!codes.length)return '<p class="member-code-empty">还没有激活码。点击“生成激活码”即可创建，无需填写订单号。</p>';
  const labels={available:'未使用',used:'已兑换',disabled:'已停用',expired:'已过期'};
  return codes.map(code=>{const reference=String(code.id??'').slice(0,8)||'未提供';return `<article class="member-code-row"><div><span class="member-account-label">激活码记录</span><strong>${esc(reference)}</strong><span class="member-code-meta">${code.order?`客户订单号：${esc(code.order)}`:'待客户激活后绑定'}</span></div><div><span class="member-code-status">${esc(labels[code.status]||'状态未知')}</span><span class="member-code-meta">${code.phone?`兑换账号：${esc(phoneText(code.phone))}`:'尚无兑换账号'}</span><span class="member-code-meta">生成时间：${esc(typeof code.createdAt==='string'?code.createdAt.replace('T',' ').replace(/\.\d+Z$/,' UTC').replace(/Z$/,' UTC'):'未提供')}</span></div>${code.status==='available'&&/^[\w-]{1,128}$/.test(code.id)?`<button class="btn" type="button" data-member-disable="${esc(code.id)}" aria-label="停用未使用激活码 ${esc(reference)}">停用</button>`:''}</article>`;}).join('');
}

export function mountMembershipAdmin(root,{session={}}={}) {
  const life=lifetime(root);if(session.admin!==true)return life.cleanup;
  const get=selector=>root.querySelector(selector),form=get('#member-admin-form');if(!form)return life.cleanup;
  const result=get('#member-admin-result'),list=get('#member-admin-list'),status=get('#member-admin-list-status'),generate=get('#member-admin-generate'),refresh=get('#member-admin-refresh'),copy=get('#member-admin-copy'),generated=get('#member-admin-generated'),codeNode=get('#member-admin-generated-code'),previous=get('#member-admin-prev'),next=get('#member-admin-next'),pageStatus=get('#member-admin-page-status');
  let codes=[],mutationPending=false,listLoading=false,listSequence=0,generatedCode=null,offset=0,total=0;
  const limit=50;
  function syncControls(){const disabled=mutationPending||listLoading;generate.disabled=disabled;refresh.disabled=disabled;previous.disabled=disabled||offset===0;next.disabled=disabled||offset+limit>=total;form.setAttribute('aria-busy',String(disabled));for(const button of list.querySelectorAll('[data-member-disable]'))button.disabled=disabled;}
  function busy(value){mutationPending=value;syncControls();}
  async function load(target=offset){
    const sequence=++listSequence;listLoading=true;syncControls();status.textContent='正在读取兑换记录…';
    try{const data=await request(life,session,`/api/admin/codes?offset=${target}&limit=${limit}`);if(!life.active||sequence!==listSequence)return;
      if(!Array.isArray(data?.codes)||!Number.isInteger(data.total)||data.total<0)throw new Error('服务器未返回有效的兑换记录。');
      codes=data.codes.filter(code=>code&&typeof code==='object').slice(0,limit);offset=target;total=data.total;list.innerHTML=codeList(codes);status.textContent=`共 ${total} 条激活码记录 · 本页 ${codes.length} 条`;pageStatus.textContent=`第 ${Math.floor(offset/limit)+1} / ${Math.max(1,Math.ceil(total/limit))} 页`;
    }catch(error){if(life.active&&sequence===listSequence)status.textContent=failure(error);}
    finally{if(life.active&&sequence===listSequence){listLoading=false;syncControls();}}
  }
  life.listen(refresh,'click',()=>{if(!mutationPending&&!listLoading)return load();});
  life.listen(previous,'click',()=>{if(!mutationPending&&!listLoading&&offset>0)return load(Math.max(0,offset-limit));});
  life.listen(next,'click',()=>{if(!mutationPending&&!listLoading&&offset+limit<total)return load(offset+limit);});
  life.listen(form,'submit',async event=>{
    event.preventDefault();if(mutationPending||listLoading||!life.active)return;
    generatedCode=null;generated.hidden=true;codeNode.textContent='';result.hidden=true;busy(true);
    try{const data=await request(life,session,'/api/admin/codes','POST',{});if(!life.active)return;if(typeof data?.code?.activation!=='string'||!data.code.activation||data.code.order!==null||typeof data.code.id!=='string'||data.code.status!=='available')throw new Error('服务器未返回完整的未绑定激活码。请刷新记录核对，勿重复提交。');generatedCode={id:data.code.id,activation:data.code.activation};codeNode.textContent=generatedCode.activation;generated.hidden=false;message(result,'激活码已生成，请复制保存后发给客户。');await load(0);}
    catch(error){if(life.active)message(result,failure(error));}
    finally{if(life.active)busy(false);}
  });
  life.listen(list,'click',async event=>{
    const button=event.target.closest?.('[data-member-disable]');if(!button||mutationPending||listLoading||!life.active)return;
    const id=button.dataset.memberDisable,code=codes.find(item=>item.id===id);if(!code||code.status!=='available'||!/^[\w-]{1,128}$/.test(id))return;
    busy(true);button.disabled=true;
    try{await request(life,session,`/api/admin/codes/${encodeURIComponent(id)}/disable`,'POST',{});if(!life.active)return;if(generatedCode?.id===id){generatedCode=null;generated.hidden=true;codeNode.textContent='';}message(result,'激活码已停用。');await load();}catch(error){if(life.active)message(result,failure(error));}finally{if(life.active)busy(false);}
  });
  life.listen(copy,'click',async()=>{
    if(!generatedCode||!life.active)return;
    try{if(!globalThis.navigator?.clipboard?.writeText)throw new Error('请选中上方激活码手动复制。');await navigator.clipboard.writeText(generatedCode.activation);if(life.active)message(result,'激活码已复制。');}catch{if(life.active)message(result,'自动复制不可用，请选中上方激活码手动复制。');}
  });
  const cleanup=life.cleanup;life.cleanup=()=>{generatedCode=null;codeNode.textContent='';generated.hidden=true;cleanup();};mounted.set(root,life.cleanup);
  void load();return life.cleanup;
}
