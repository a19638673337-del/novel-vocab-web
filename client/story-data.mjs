export const story = {
  id: 'last-page-excerpt', title: '最后一页，请保留我的名字',
  genre: '职场逆袭', label: '截图节选',
  introduction: '方案封面上，她的名字被换掉了。风险确认栏里，却只留下她的署名。',
  sourceNote: '根据你提供的阅读页与单词卡图片录入，包含两整段和第三段可确认的部分。尚未取得可核验全文，因此不补写被遮挡或未展示的内容。',
  paragraphs: [
    '距离客户验收还有四十八小时，我在会议室的大屏幕上，看见自己的名字从封面上消失了。那份我熬了六周写出的 [[proposal]]，第一页的负责人换成了陈峥。翻到最后一页，我的 [[signature]] 倒还留着——在风险确认栏。',
    '陈峥把笔推过来：“许知微，先签字。项目过了，你的转正我来争取。”他是部门的 [[executive]]，我是入职三个月的 [[subordinate]]。这句话听上去像给机会，可他把所有人的目光都挡在了自己身后，只把责任留给我。',
    '我没接笔。上一周的 [[preliminary]] 测试里，配送系统曾把同一张订单派给两辆车。客户没丢货，是调度员半夜打电话追回了其中一辆。'
  ],
  sections: ['名字与署名', '递来的那支笔', '被遗漏的测试'],
};
export const words = [
  {id:'proposal',en:'proposal',zh:'方案',pos:'n.',paragraph:0,tip:'这里指她花六周撰写的项目方案。',definition:'提议；建议；方案'},
  {id:'signature',en:'signature',zh:'署名',pos:'n.',paragraph:0,tip:'这里指风险确认栏中留下的署名。',definition:'签名；署名'},
  {id:'executive',en:'executive',zh:'主管',pos:'n.',paragraph:1,tip:'在本句中作名词，表示部门管理人员。',definition:'主管；管理人员'},
  {id:'subordinate',en:'subordinate',zh:'下属',pos:'n.',paragraph:1,tip:'这里作名词，指工作关系中的下级。',definition:'下属；下级'},
  {id:'preliminary',en:'preliminary',zh:'初步的',pos:'adj.',paragraph:2,tip:'修饰测试，强调正式验收之前的初步阶段。',definition:'初步的；预备的'},
];
