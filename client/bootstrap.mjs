import {membershipPage,mountMembership,membershipAdminPage,mountMembershipAdmin,resolveMembershipCourse,membershipTitle} from './membership.mjs?v=zones1';

const main=document.querySelector('#main');
let cleanup=()=>{},session,readerStarted=false,requestId=0;
function notice(message){main.replaceChildren();const p=document.createElement('p');p.className='member-availability';p.textContent=message;main.append(p);}
function changeAccount(_user,destination='#library-catalog'){
 try{localStorage.setItem('cijian-account-session-changed',String(Date.now()));}catch{}
 location.hash=['#library-catalog','#gaokao','#ielts','#kaoyan','#cet'].includes(destination)?destination:'#library-catalog';location.reload();
}
function leaveAccount(destination='#membership'){
 try{localStorage.setItem('cijian-account-session-changed',String(Date.now()));}catch{}
 location.hash=destination;location.reload();
}
function showMembership(){
 cleanup();const admin=location.hash==='#membership/admin',courseId=resolveMembershipCourse(location.hash);
 document.title=(admin?'激活码管理':membershipTitle(courseId,session))+' · ToTo趣味英语';
 main.innerHTML=admin?membershipAdminPage(session):membershipPage(session,courseId);
 cleanup=admin?mountMembershipAdmin(main,{session}):mountMembership(main,{session,courseId,onAuthenticated:changeAccount,onLogout:leaveAccount});
}
async function start(){
 const id=++requestId;notice('正在确认账号状态…');
 try{
  const response=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('账号服务暂时无法连接，请稍后重试。');
  const value=await response.json();if(id!==requestId)return;session=value;window.cijianSession=session;
  if(session.user?.active){await import('./app.mjs?v=zones1');readerStarted=true;}
  else showMembership();
 }catch(error){
  if(id!==requestId)return;notice(error.message||'账号服务暂时无法连接。');
  const retry=document.createElement('button');retry.className='btn primary';retry.textContent='重新连接';retry.addEventListener('click',()=>location.reload());main.append(retry);
 }
}
window.addEventListener('hashchange',()=>{if(!readerStarted&&session)showMembership();});
window.addEventListener('storage',event=>{if(event.key==='cijian-account-session-changed')location.reload();});
let checking=false;
async function checkSession(){
 if(!session||checking)return;checking=true;
  try{const response=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});if(response.ok){const fresh=await response.json();if(fresh.user?.id!==session.user?.id||!!fresh.user?.active!==!!session.user?.active||fresh.admin!==session.admin){location.reload();return;}Object.assign(session,fresh);}}catch{}finally{checking=false;}
}
window.addEventListener('focus',checkSession);
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
setInterval(checkSession,60000);
window.addEventListener('pagehide',()=>cleanup());
start();
