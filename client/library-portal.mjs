const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function portalCourses(library) {
  const count = name => library.catalogs.filter(book => book.course === name).length;
  const longChapters = (library.ielts?.longNovel?.parts || []).reduce((sum, part) => sum + (part.chapters?.length || 0), 0);
  return [
    {id:'gaokao', name:'高中英语', shortName:'高中', label:'SENIOR HIGH', tag:'校园与成长', description:'从校园、日常与成长故事出发，寻找适合自己的高中英语阅读方向。', status:count('高中') ? `${count('高中')} 部作品目录 · 正文未导入` : '阅读内容筹备中', href:'#gaokao', action:'进入高中专区', image:'course-gaokao.png'},
    {id:'ielts', name:'雅思英语', shortName:'雅思', label:'IELTS', tag:'多题材故事', description:'追一段连贯剧情，或挑选一个短篇。按篇章、题材与标题浏览雅思故事目录。', status:count('雅思') ? `${longChapters ? `${longChapters} 章长篇 · ` : ''}${count('雅思')} 篇短篇目录 · 正文未导入` : '阅读内容筹备中', href:'#ielts', action:'进入雅思专区', image:'course-ielts.png'},
    {id:'kaoyan', name:'考研英语', shortName:'考研', label:'POSTGRADUATE', tag:'陪伴备考时光', description:'给专注的复习留一点故事时间，按题材、标题和简介挑选下一篇。', status:count('考研') ? `${count('考研')} 部作品目录 · 正文未导入` : '阅读内容筹备中', href:'#kaoyan', action:'进入考研专区', image:'course-kaoyan.png'},
    {id:'cet', name:'四六级英语', shortName:'四六级', label:'CET-4 / CET-6', tag:'原创背词短篇', description:'悬疑、奇幻、校园与逆袭，读故事、点词卡、做填空，在情节里记住单词。', status:`${library.books.length} 篇原创可读 · ${library.stats.loaded.toLocaleString()} 词已导入`, href:'#cet', action:'进入四六级专区', image:'course-cet.png'}
  ];
}

export function libraryPortalPage(library) {
  const courses = portalCourses(library);
  return `<div class="library-portal">
    <section class="portal-hero" aria-labelledby="portal-title">
      <div class="portal-hero-copy"><p class="portal-kicker"><span aria-hidden="true">✦</span> ToTo趣味英语 · 故事里的词汇课</p>
        <h1 id="portal-title">翻开喜欢的故事，<br><span>记住遇见的单词。</span></h1>
        <p class="portal-intro">悬疑、奇幻、校园、重逢……<br>从想读的那一篇开始，让词汇有自己的情节。</p>
        <button class="btn portal-primary" type="button" data-portal-start>挑选我的阅读方向 <span aria-hidden="true">→</span></button>
        <div class="portal-proof"><span>语境词卡</span><span>英文填空</span><span>进度保存</span></div>
      </div>
      <div class="portal-hero-art" aria-hidden="true"><span class="portal-spark portal-spark-one">✦</span><div class="portal-book portal-book-back"><img src="./assets/course-gaokao.png" alt="" width="768" height="1024"><span>在故事里<br>遇见新的自己</span></div><div class="portal-book portal-book-front"><img src="./assets/course-cet.png" alt="" width="768" height="1024"><span>翻开下一页<br><small>让单词有了归处</small></span></div><span class="portal-art-note">每一页，都有新的遇见</span><span class="portal-spark portal-spark-two">✧</span></div>
    </section>
    <section class="portal-catalog" aria-labelledby="portal-catalog-title">
      <div class="portal-account-bar"><span><i aria-hidden="true"></i> 我的学习空间 <small>阅读记录保存在当前浏览器</small></span><a href="#membership">会员中心 <span aria-hidden="true">→</span></a></div>
      <div class="portal-heading"><div><h2 id="portal-catalog-title" tabindex="-1">挑选你的心动故事</h2><p>从喜欢的故事开始，开启你的阅读之旅。</p></div><span class="portal-heading-note">选好故事，快乐开读</span></div>
      <div class="portal-tabs" role="group" aria-label="学习方向筛选"><button type="button" aria-pressed="true" aria-controls="portal-course-grid" data-portal-filter="all">全部</button>${courses.map(course=>`<button type="button" aria-pressed="false" aria-controls="portal-course-grid" data-portal-filter="${course.id}">${escapeHTML(course.shortName)}</button>`).join('')}</div>
      <p class="portal-filter-status" role="status" aria-live="polite">共 ${courses.length} 个学习方向</p>
      <div id="portal-course-grid" class="portal-course-grid">${courses.map(course=>`<article class="portal-course portal-course-${course.id}" data-portal-course="${course.id}" aria-labelledby="portal-course-title-${course.id}"><a href="${course.href}" class="portal-course-cover" aria-label="${escapeHTML(course.action+'：'+course.name)}"><img src="./assets/${course.image}" alt="${escapeHTML(course.name)}原创书封插画" width="768" height="1024" loading="lazy"><div class="portal-cover-title"><span>${course.label}</span><strong>${escapeHTML(course.shortName)}英语<br>小说</strong><small>读故事 · 记单词</small></div></a><div class="portal-course-copy"><span class="portal-course-label">${escapeHTML(course.tag)}</span><h3 id="portal-course-title-${course.id}">${escapeHTML(course.shortName)}<span>英语小说</span></h3><p>${escapeHTML(course.description)}</p><span class="portal-course-status">${escapeHTML(course.status)}</span><a class="portal-course-enter" href="${course.href}" aria-label="${escapeHTML(course.action+'：'+course.name)}">${course.action}<span aria-hidden="true">→</span></a></div></article>`).join('')}</div>
      <div class="portal-note"><span aria-hidden="true">♡</span><p><strong>先读一个故事，再认识一个新词。</strong><br>四六级原创已可阅读；其他专区可浏览参考目录，全文尚未导入。<a href="#catalog">查看全部参考目录 <span aria-hidden="true">↗</span></a></p></div>
    </section>
    <section class="portal-reading-band" aria-label="我的四六级学习进度"><div><p class="section-eyebrow">我的四六级书架</p><h2>下一篇，继续你的阅读。</h2><p>${library.books.length} 篇原创短篇 · 累计核验 ${library.stats.used} 个词 · 已导入词库覆盖 ${library.stats.coverage}%</p></div><a class="btn portal-primary" href="#cet">进入四六级专区 →</a></section>
  </div>`;
}

export function mountLibraryPortal(root) {
  root.querySelector('[data-portal-start]')?.addEventListener('click', () => {
    const heading = root.querySelector('#portal-catalog-title');
    heading?.focus({preventScroll:true});
    heading?.scrollIntoView({block:'start'});
  });
  root.querySelectorAll('[data-portal-filter]').forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.portalFilter;
    root.querySelectorAll('[data-portal-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let count=0;
    root.querySelectorAll('[data-portal-course]').forEach(card => {
      card.hidden = filter !== 'all' && card.dataset.portalCourse !== filter;
      if (!card.hidden) count++;
    });
    root.querySelector('.portal-filter-status').textContent = filter === 'all' ? `共 ${count} 个学习方向` : `${button.textContent.trim()} · ${count} 个学习方向`;
  }));
}
