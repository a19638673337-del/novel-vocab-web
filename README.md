# ToTo趣味英语 · 小说背词阅读器

基于 Sites / Vinext 与 Cloudflare D1 的小说背词网站，已实现本站手机号、密码和激活码兑换服务（客户首次激活时绑定订单）。当前包含 **7 篇原创短篇、1 篇截图节选、3,162 词冻结词库，以及按课程整理的公开来源目录**。全站入口使用白底紫框课程区，提供高中、雅思、考研和四六级四张卡片及五项分类筛选；会员中心保留独立入口。四六级独立学习专区集中展示可读原创、本机学习进度与词表工具，原书架仍可访问。页面与范围见 [PRODUCT.md](PRODUCT.md)，内容来源见 [SOURCE-IMPORT.md](SOURCE-IMPORT.md)，视觉与交互见 [DESIGN.md](DESIGN.md) 和 [UX-CONTRACT.md](UX-CONTRACT.md)。

账号服务已于 2026-11-02 发布；2026-11-03 改为先生成激活码、客户兑换时绑定订单，最新发布结果见项目整理记录。Sites 外层认证及仅所有者可见（owner-private）的托管范围保持不变，站内激活不自动扩大站点访问权限。

## 本地预览

在本目录运行：

```powershell
npm run dev -- --hostname 127.0.0.1 --port 8770
```

打开 [全站入口](http://127.0.0.1:8770/#library-catalog)，或直接进入 [四六级学习专区](http://127.0.0.1:8770/#cet)。[原作品书架](http://127.0.0.1:8770/#shelf)保留兼容。未登录时先显示会员中心；激活或登录后可使用学习入口。开发服务需要项目 Node / Vinext 运行时及本地 D1，不能用静态服务器或双击 HTML 代替后端。

`npm run prepare:site` 从 `client/` 生成公开文件与服务器私有资源，`predev`、`prebuild` 会自动调用。生产构建使用官方 Sites 流程 `npm run build`。`dist/` 是 Vinext 生成输出，不直接编辑，不可作为无鉴权静态网站发布；准备与构建不等于发布。

`#library-catalog` 是课程总览，`#catalog` 是独立来源小说目录。来源课程可直达 `#catalog/cet`、`#catalog/ielts`、`#catalog/gaokao`、`#catalog/kaoyan`；目录内支持课程、题材与标题搜索，每次展示 24 条，可下载 JSON。计数由实际导入条目计算，没有数据的课程显示可返回的空状态。入口和来源目录过滤仅在本页生效，不改写学习记录。

独立考研书架入口为 [考研专区](http://127.0.0.1:8770/#kaoyan)，可从课程总览和会员页进入；原 `#catalog/kaoyan` 通用目录继续保留。

独立雅思书架入口为 [雅思首页](http://127.0.0.1:8770/#ielts)、[长篇目录](http://127.0.0.1:8770/#ielts/long) 和 [短篇目录](http://127.0.0.1:8770/#ielts/short)。从课程总览或会员页可进入首页；原 `#catalog/ielts` 通用目录继续保留。

## 内容和统计

- 新增 `story-0002` 至 `story-0007` 六篇中文夹英文原创，各有 104–106 个不同重点词；采用截图中的题材类别，人物、情节和正文重新创作。
- 原创 `story-0001` 保留英文叙事与逐段中文对照：112 个重点词，156 个正文核验词。
- 《最后一页，请保留我的名字》保留三段可确认截图节选，共 5 个重点词，不冒充完整小说，也不计入原创覆盖台账。
- 已导入词库 3,162，原创累计已用 596、未用 2,566，覆盖率 18.85%。5,500 是学习目标，目前还缺 2,338 个经核验条目。
- 来源目录按已取得的公开元数据扩充，条目与课程数以导出数据及页面动态计数为准。高中38条已补全公开课程目录提供的序号、简介、章节标题和修正后的原站词数；考研56条已由公开课程目录补全序号、45个原始题材字符串、简介、章数、原站词数和封面路径，标记 `public-catalog`。考研章数均为1，未取得独立章节标题。两者均不是正文已导入的证明，缺失字段不补造。原站词数仅供参考，完整词表接口的访问边界见 SOURCE-IMPORT.md，未导入其全文或完整词库。
- 高中、雅思、考研和四六级课程封面为本站原创视觉，不是来源原作书封。入口与目录改版没有新增原作正文，也没有改变原创覆盖台账。
- 2026-11-01 雅思目录更新：五个篇章、100章长篇目录另存于 `library.ielts.longNovel.parts`；100篇短篇补充公开简介等元数据。全站 `catalogs` 仍247条，没有新增雅思正文、词表或音频，原站报告词数不计入本地覆盖。雅思首页两张1086×1448 PNG为本站自生成插画。

## 文件与内容更新

| 文件 | 用途 |
|---|---|
| `client/library-data.mjs` | 已完成原创、冻结词库、覆盖统计和来源目录的生成快照 |
| `client/story-data.mjs` | 保留旧截图节选与五词数据 |
| `client/app.mjs` | 全站入口、来源目录、学习页面与会员中心的路由及共用交互 |
| `client/cet-shelf.mjs` / `client/cet.css` | 四六级学习专区、本机进度摘要、原创搜索/题材/阅读状态筛选与学习入口；只读既有学习状态 |
| `client/library-portal.mjs` | 四张课程卡、独立会员入口、五项筛选与真实内容状态 |
| `client/gaokao-shelf.mjs` / `client/gaokao.css` | 高中独立书架、推荐切换、目录搜索、分页与章节展开 |
| `client/kaoyan-shelf.mjs` / `client/kaoyan.css` | 考研独立书架、标题/题材搜索、题材筛选、每批12条与资料详情 |
| `client/ielts-shelf.mjs` / `client/ielts.css` | 雅思首页、长篇章节搜索/展开、短篇搜索/题材/12篇分页 |
| `client/reference-catalog.mjs` | 来源目录局部筛选、分批展示、转义和安全来源链接 |
| `client/styles.css` / `client/portal.css` | 共用变量与阅读/会员样式；入口和来源目录组件样式 |
| `client/membership.mjs` | 激活注册、手机号密码登录、退出和管理员发码界面；调用同源 API |
| `client/bootstrap.mjs` | 先读取会话，再显示会员页或加载阅读器 |
| `server/auth.mjs` / `server/member-resources.mjs` | 账号、会话、管理员及会员资源服务端鉴权 |
| `db/schema.ts` / `drizzle/` | D1 四表与迁移；初始迁移为 `drizzle/0000_open_luckman.sql` |
| `scripts/prepare-member-site.mjs` | 从 `client/` 生成 `public/` 和 `server/generated-*.mjs`，分开公开与会员资源 |
| `public/` / `server/generated-*.mjs` / `dist/` | 准备或构建生成的资源，不作为手工编辑源 |
| `client/library-state.mjs` / `client/member-storage.mjs` | 学习状态 v2、校验及按账号 ID 隔离的本机存储 |
| `client/exercise.mjs` | 按实际 token 生成填空与核算结果 |
| `client/pronunciation.mjs` / `pronunciations.mjs` | 音频播放器与可用资源清单 |
| `client/downloads/` | 创作进度、词表 CSV、原创 Markdown 和来源目录下载 |
| `scripts/build-library.py` | 从相邻小说项目的已记账成稿生成网站内容 |
| `catalog-sources.json` | 构建与来源测试共用的课程文件、课程名称与唯一 ID 前缀配置 |
| `competitor-ielts-catalog-public.json` | 当前雅思公开目录事实源；旧 `competitor-catalog-public.json` 保留作历史快照 |
| `client/downloads/ielts-catalog.json` | 雅思长篇篇章/章节、短篇目录与来源统计的导出；不含正文或词表 |
| `competitor-kaoyan-catalog-public.json` | 当前考研56部公开目录事实源；旧 `competitor-kaoyan-title-index-public.json` 保留作历史快照 |
| `client/downloads/kaoyan-catalog.json` | 考研公开目录和来源信息导出；不含独立章节标题、正文或词表 |

内容事实源位于相邻的 `../小说背词项目`。新增原创需先完成正文审核及 skill 台账核验，再运行：

```powershell
python scripts/build-library.py
```

脚本读取项目 `state.json`、各篇 `drafts/<id>/source.json` 与文章/词表导出文件，按 `catalog-sources.json` 合并各课程来源元数据，生成 `client/library-data.mjs` 及 `client/downloads/`；同时同步项目内的公开来源目录副本。随后运行 `npm run prepare:site` 准备私有/公开资源，再使用官方 Sites 构建流程。每个来源保留其类型与字段缺失状态，课程 ID 前缀防止原站同名 ID 冲突。它不创作故事，不把来源目录算作已用词，也不代替创作记账。发布前应确认源稿与已记账成稿一致。

## 学习记录

学习数据仍为 v2，按服务器返回的账号 ID 隔离到 `cijian-member:<编码账号ID>:cijian-library-v2`，保存跨书收藏与熟悉度、逐书阅读位置、逐 token 答案、字号和模式。记录只属于当前账号在本浏览器、当前域名的学习；登录没有跨设备云同步，D1 不保存学习数据。备份导入需确认，只覆盖当前账号本机记录；跨标签冲突暂停保存并提示先备份再刷新。

未分配账号的旧 `cijian-library-v2`、`cijian-progress-v1` 不会自动归入新账号。设置中的“导入本机旧记录”先预览，再显式确认属于自己后导入，旧键保留。切换账号或退出会重载会话，学习行为不修改原创覆盖台账。

## 四六级学习专区（2026-11-01）

`#cet` 是课程总览、会员引导和顶部书架导航共用的四六级入口；`#shelf` 保留原作品列表，阅读页顶部返回 `#cet`。专区提供继续阅读、原创筛选、总词表、生词本与复习入口。原创按标题、简介和题材检索，可筛选题材及本机阅读状态，每批12篇；不凭题材把作品划为四级或六级难度。参考目录仍在 `#catalog/cet`，不计作本站可读小说。

专区读取 `library.books`、`library.lexicon` 和当前账号已校验的 `progress`，专区本身不另建存储键。阅读位置沿用 `readings[storyId]`，收藏和自评沿用词条 ID；页面浏览与筛选不改写记录。7篇原创每篇有104–112个重点词，原创词卡合并去重为554词；计入截图节选后，本站可练习词卡共558词，个人收藏/自评摘要采用这个本站范围。596是创作正文核验覆盖数，与词卡数、自评掌握数分别说明，冻结台账不变。原有 `bookCard`、`cover` 仍由 `app.mjs` 持有并供专区复用。

词表可直达 `#vocabulary/<all|cet4|cet6>/<all|used|unused>`，分别预选联合/四级/六级词库与全部/已用/未用状态；普通 `#vocabulary` 重置为全部。范围总词数、已用及未用数量按所选词库独立计算，四六级共有词不能相加为联合总量。进入后修改的筛选只在当前页面暂存；搜索框的清空按钮保留当前词库和使用状态，空结果的“清空筛选”才重置全部。`#review/notebook` 明确复习生词本，`#review/<story-id>` 复习指定真实作品；阅读进度、自评掌握与创作覆盖不互相推导。

## 会员开通与管理员发码

`#membership` 提供新客户激活注册与已有账号登录。首次提交自己的购买订单号、一个未使用激活码、11 位中国大陆手机号和 8–64 位密码；服务器原子完成订单绑定、账号创建、兑换和会话建立。每码和每个订单分别只能兑换一次，重复手机号不能注册。以后用手机号和密码登录，不再填写订单与激活码。手机号只是登录名，无短信或归属验证；本站不连接外站账号和支付系统，订单号不代表已核验付款。

所有者在 Sites 外层认证通过后，可进入 `#membership/admin`：

1. 直接点击生成激活码，不填订单。客户兑换时填写自己的购买订单编号：6–64位英文字母、数字、连字符或下划线，服务器统一为大写并保留前导零。
2. 生成未绑定订单的激活码，立即复制并妥善保存。完整码只在本次成功生成时显示，数据库只存摘要，历史列表不能重新查看原码。
3. 核对付款后，只将一个激活码交给对应读者用于注册；列表每页50条，显示未使用、已兑换、已停用，成功兑换后显示客户订单和脱敏手机号。
4. 仅未使用码可停用。已兑换码返回冲突，不改变会员或会话；本次没有会员撤权功能。

管理员身份优先由环境 `ADMIN_USER_ID` 精确匹配 Sites 可信 `oai-authenticated-user-id`；仅未配置 ID 时才使用 `ADMIN_USER_EMAIL` 匹配可信邮箱，并仍要求非空可信用户 ID。不接受普通手机号账号、首次注册、浏览器状态或未经外层认证的请求头作为管理员。`local_seedy` 仅为本地开发身份，托管仍保持 owner-private。

账号 API：`GET /api/auth/session`；`POST /api/auth/register`、`/api/auth/login`、`/api/auth/logout`。管理 API：`GET/POST /api/admin/codes`，`POST /api/admin/codes/:id/disable`。所有写入要求同源、JSON 和 CSRF token；会话采用 HttpOnly cookie，托管启用 Secure，7天到期。注册和登录使用持久化限流。

D1 四表为 `activation_codes`、`members`、`member_sessions`、`auth_rate_limits`，保存激活记录、手机号及加盐密码摘要、会话摘要和限流计数；不存学习进度。密码使用 PBKDF2-SHA256 100,000轮，适配当前 Workers Web Crypto 限制。数据库不存明文密码、原始激活码或原始会话 token。

启动先确认会话，再加载阅读器。服务器逐次保护 `app.mjs`、`library-data.mjs`、`story-data.mjs`、`/downloads/*` 与 `/assets/audio/*`；直接访问这些资源也需会员会话。源文件保存在 `client/`，准备脚本将会员资源打包到服务器私有清单，下载 URL 保持原形状但不再是公开静态文件。激活不增加未取得的高中、雅思或考研原作正文。

## 发音范围

proposal、signature、executive、subordinate、preliminary 五个词已有英音与美音各一份 MP3，共 10 个文件。只有这些词可播放，包括它们在其他故事中的同词复现。其余词明确标为暂未配音，可打开词典；没有整篇朗读。

播放使用同源音频，不依赖设备语音包或运行时语音服务。`scripts/generate-pronunciations.py` 只是构建时生成工具，网页不运行它。音频为合成语音，来源记录见 [AUDIO.md](AUDIO.md)。

## 验证

```powershell
node --check client/app.mjs
node --test --test-isolation=none tests/*.test.mjs
```

测试涵盖学习状态、旧记录迁移、空位隔离、课程入口与目录交互、来源链接边界、跨标签冲突和音频。命令清单不代表本次已经通过，实际运行与浏览器检查见 [QA.md](QA.md)。

## 高中专区

`#gaokao` 是高中独立书架，可从全站高中卡片或会员页引导进入。作品来自公开目录，支持推荐切换、搜索、每批12条和章节标题展开；`downloads/gaokao-catalog.json` 仅下载高中来源资料。`#catalog/gaokao` 继续保留通用目录视图。3,500是原站标注的高中学习目标，本站尚未导入高中正文与高中词表，不能据此计算覆盖率。

## 雅思专区

`#ielts` 首页选择长篇或短篇。`#ielts/long` 支持章节标题或章号搜索、匹配篇章自动展开；`#ielts/short` 支持标题/题材检索和题材单选，每批12篇。清空关键词保留题材，空态“清空筛选”重置两者。计数均来自现有目录，搜索、分页及导出不写入学习记录。`downloads/ielts-catalog.json` 提供完整的本地雅思目录副本，来源统计不代表本站词库或覆盖率。

## 雅思篇章补充

长篇书架新增对应封面和独立篇章地址 `#ielts/long/part-01` 至 `part-05`。每篇展示20章目录并支持本篇搜索与前后篇导航。五张本地WebP位于 `client/assets/ielts-parts/`，来源与校验记录见 `../整理记录/2026-11-01-雅思篇章封面来源.json`。这次不新增小说正文、词表或覆盖率。

## 雅思词表（2026-11-01）

雅思专区增加 `#ielts/vocabulary`，与首页、长篇目录、短篇目录互通。当前有 50 条用户 PDF 词条，支持英文或中文释义搜索、英美音标、CSV/JSON 下载。目录仍为 5 篇章 / 100 章长篇标题与 100 篇短篇记录，没有小说正文。9,399 为原资料标注总数，另 9,349 词尚未提供。

`ielts-vocabulary-source.json` 为脱敏来源；构建校验后写入 `library.ielts.vocabulary` 和独立下载 `downloads/ielts-vocabulary.{csv,json}`。保留 PDF 的音标、释义和页码，未做词典校订，没有新增词表音频。这批参考词不修改四六级原创台账或浏览器学习记录。

## 考研专区（2026-11-01）

`#kaoyan` 收录56部公开故事目录，支持标题或题材关键词搜索、45个来源题材字符串的单选筛选、每批12条展示、资料详情及 JSON 下载。45是原始题材标签去重数，不是重新归并后的题材大类。清空关键词保留题材，空态“清空筛选”重置两者；浏览不写入学习记录。

本轮只补齐公开元数据：原站章数均为1，但没有独立章节标题、小说全文、考研词表或音频。封面路径只随目录导出，页面复用本站已有课程插画和文字书封。总目录仍为247条，原7篇原创、3,162词冻结词库、已用596词和18.85%覆盖率保持不变。2026-11-01 此次目录更新记录为110项自动测试已通过，不代表本轮账号版本已发布；具体运行与浏览器检查见 [QA.md](QA.md)。


### 激活码数据升级（2026-11-03）

新增 `drizzle/0001_steady_norrin_radd.sql`，只增加可空的 `customer_order_number` 与唯一索引。旧 `order_number` 为兼容历史数据保留；新码在此列使用内部引用，不作为客户购买订单。未兑换旧码不再按旧订单配对，实际客户订单仅在成功兑换时写入新列；历史已兑换订单继续防止重复使用。

本地仅执行尚未应用的迁移（不要重放0000）：

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_steady_norrin_radd.sql
```

生产迁移由 Sites 发布流程执行。该变更不改原激活码摘要，不迁移或清除会员、会话。
