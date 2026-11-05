import test from 'node:test';
import assert from 'node:assert/strict';
import {portalCourses,libraryPortalPage,mountLibraryPortal} from '../client/library-portal.mjs';

const library={books:[{id:'story-1'}],catalogs:[{course:'四六级'},{course:'雅思'},{course:'高中'}],stats:{loaded:3162,used:156,coverage:4.93}};

test('four study directions keep readable originals separate from references and membership',()=>{
  const courses=portalCourses(library);
  assert.deepEqual(courses.map(course=>course.id),['gaokao','ielts','kaoyan','cet']);
  assert.equal(courses.find(course=>course.id==='cet').href,'#cet');
  assert.equal(courses.find(course=>course.id==='gaokao').href,'#gaokao');
  assert.equal(courses.find(course=>course.id==='ielts').href,'#ielts');
  assert.match(courses.find(course=>course.id==='cet').status,/1 篇原创可读/);
  assert.match(courses.find(course=>course.id==='gaokao').status,/1 部作品目录.*正文未导入/);
  assert.equal(courses.find(course=>course.id==='kaoyan').status,'阅读内容筹备中');
  assert.equal(courses.find(course=>course.id==='kaoyan').href,'#kaoyan');
  const html=libraryPortalPage(library);
  assert.match(html,/href="#membership"/);
  assert.doesNotMatch(html,/data-portal-filter="membership"|data-portal-course="membership"/);
  assert.equal((html.match(/data-portal-filter=/g)||[]).length,5);
  assert.equal((html.match(/aria-controls="portal-course-grid"/g)||[]).length,5);
  assert.match(html,/3162|3,162/);
  assert.doesNotMatch(html,/9400|9399|永久开通|账号已开通/);
});

test('portal filters show the chosen card and restore all without changing learning records',()=>{
  const originalData=JSON.stringify(library);
  const labels={all:'全部',gaokao:'高中',ielts:'雅思',kaoyan:'考研',cet:'四六级'};
  const buttons=Object.entries(labels).map(([id,textContent])=>({textContent,dataset:{portalFilter:id},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(name,value){this[name]=value;}}));
  const cards=buttons.slice(1).map(button=>({dataset:{portalCourse:button.dataset.portalFilter},hidden:false}));
  const status={textContent:''};
  const root={querySelector:selector=>selector==='.portal-filter-status'?status:null,querySelectorAll:selector=>selector==='[data-portal-filter]'?buttons:cards};
  mountLibraryPortal(root);
  for(const id of ['gaokao','ielts','cet','kaoyan']){
    const button=buttons.find(button=>button.dataset.portalFilter===id);
    button.handlers.click();
    assert.deepEqual(cards.filter(card=>!card.hidden).map(card=>card.dataset.portalCourse),[id]);
    assert.deepEqual(buttons.filter(button=>button['aria-pressed']==='true').map(button=>button.dataset.portalFilter),[id]);
    assert.equal(status.textContent,`${labels[id]} · 1 个学习方向`);
  }
  buttons.find(button=>button.dataset.portalFilter==='all').handlers.click();
  assert.equal(cards.filter(card=>!card.hidden).length,4);
  assert.equal(status.textContent,'共 4 个学习方向');
  assert.equal(JSON.stringify(library),originalData);
});

test('an empty course does not claim imported content or an activated subscription',()=>{
  const empty={books:[],catalogs:[],stats:{loaded:0,used:0,coverage:0}};
  const courses=portalCourses(empty);
  assert.ok(courses.filter(course=>course.id!=='cet').every(course=>course.status==='阅读内容筹备中'));
  const html=libraryPortalPage(empty);
  assert.doesNotMatch(html,/已开通|永久使用|账号已开通/);
  assert.match(html,/0 篇原创可读/);
});

test('the hero action focuses the course heading before scrolling',()=>{
  const calls=[];
  const start={addEventListener(type,handler){this[type]=handler;}};
  const heading={focus(options){calls.push(['focus',options]);},scrollIntoView(options){calls.push(['scroll',options]);}};
  const root={querySelector:selector=>selector==='[data-portal-start]'?start:selector==='#portal-catalog-title'?heading:null,querySelectorAll:()=>[]};
  mountLibraryPortal(root);
  start.click();
  assert.deepEqual(calls,[['focus',{preventScroll:true}],['scroll',{block:'start'}]]);
});
