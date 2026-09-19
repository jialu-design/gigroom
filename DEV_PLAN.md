# MVP 开发计划 — GigRoom

**基于 PRD.md V1 最终规格**
**技术栈**：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase
**开发原则**：简单、稳定、可运行、方便扩展，不 over-engineer

---

## 阶段总览

| 阶段 | 名称 | 预计工时 | 核心产出 |
|---|---|---|---|
| P0 | 项目初始化与基础设施 | 1-2天 | 可运行的Next.js项目+Design System基础+Mock数据 |
| P1 | 布局框架与导航 | 1天 | AppLayout、TopNav、BottomTab、响应式框架 |
| P2 | 核心数据层与Mock数据 | 1天 | TypeScript类型定义、Mock数据、API层封装 |
| P3 | 发现页与演出列表 | 1-2天 | 发现页、演出列表页、筛选功能、演出卡片组件 |
| P4 | 演出详情Hero Page | 2-3天 | Hero区、公告、Show Room框架、状态按钮、购票按钮 |
| P5 | Show Room 四个Tab | 2-3天 | 讨论、找搭子、出收票、现场（全Mock数据驱动） |
| P6 | 乐队相关页面 | 1天 | 乐队列表、乐队详情、关注按钮 |
| P7 | 账号系统与Onboarding | 1-2天 | Supabase Auth接入、登录弹层、Onboarding流程 |
| P8 | 个人中心与房间页 | 1天 | Profile页、Rooms页、编辑资料 |
| P9 | 通知系统 | 1天 | 通知中心、通知badge、三种通知类型mock |
| P10 | Supabase集成与数据持久化 | 2-3天 | 数据库schema、migration、API对接、Supabase Auth |
| P11 | 社区治理与细节打磨 | 1-2天 | 删除/举报、频率限制、规则提示、空状态/加载/错误状态 |
| P12 | 视觉打磨与响应式测试 | 1-2天 | 噪点纹理、字体调整、移动端适配、最终polish |
| P13 | 部署准备 | 0.5天 | Vercel部署配置、环境变量、README |

**总计预估**：16-23个工作日（一个人全职开发约3-5周）

---

## P0：项目初始化与基础设施

### P0.1 创建Next.js项目
```bash
cd /workspace/gigroom
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```
确认选项：
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: Yes
- App Router: Yes
- Import alias: @/*

### P0.2 安装依赖
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install lucide-react          # 图标库（轻量、现代）
npm install date-fns              # 日期处理
npm install clsx                  # className合并
npm install zustand               # 轻量状态管理（用户状态、UI状态）
npm install react-hook-form       # 表单处理（简单场景）
```

### P0.3 配置 Tailwind CSS Design System
修改 `tailwind.config.ts`，定义所有设计token：
- 颜色（深色背景、off-white文字、暗红强调、深绿/洗水蓝辅助）
- 字体层级（hero/h1/h2/h3/lg/body/sm/xs）
- 间距scale
- 圆角（sm:2px, md:4px, lg:8px，不用大圆角）
- 自定义字体（配置Inter或系统无衬线，优先英文无衬线+中文字体栈）

修改 `src/app/globals.css`：
- 设置 body 深色背景 `#111111`，文字颜色 `#F0EDE6`
- 设置基础字体族（中文使用"PingFang SC"/"Noto Sans SC"/系统无衬线）
- 定义 CSS 变量（颜色、间距等从Tailwind config导出）
- 添加噪点纹理CSS类（noise grain效果）
- 重置默认样式（去除蓝色focus outline，改用暗红；按钮cursor样式等）

### P0.4 基础目录结构创建
创建以下目录结构（src/下）：
```
src/
├── app/                    # Next.js App Router 页面
│   ├── layout.tsx          # 根布局（html/body/AuthProvider）
│   ├── page.tsx            # 发现页（首页）
│   ├── shows/
│   │   └── page.tsx        # 演出列表
│   ├── show/
│   │   └── [id]/
│   │       └── page.tsx    # 演出详情
│   ├── rooms/
│   │   └── page.tsx        # 我的房间
│   ├── profile/
│   │   └── page.tsx        # 个人主页
│   ├── artists/
│   │   └── page.tsx        # 乐队发现
│   ├── artist/
│   │   └── [id]/
│   │       └── page.tsx    # 乐队详情
│   ├── notifications/
│   │   └── page.tsx        # 通知中心
│   └── globals.css
├── components/             # 所有组件
│   ├── layout/             # AppLayout, TopNav, BottomTabNav
│   ├── show/               # ShowCard, ShowHero, AnnouncementList等
│   ├── room/               # RoomEntry, MessageList, BuddyPostCard等
│   ├── artist/             # ArtistCard, ArtistHeader等
│   ├── user/               # ProfileHeader, LoginModal, OnboardingModal等
│   ├── ui/                 # Button, Input, Modal, TabBar, Badge等基础组件
│   └── shared/             # EmptyState, LoadingSpinner等
├── lib/                    # 工具库
│   ├── supabase/           # Supabase客户端（server+client）
│   ├── types/              # TypeScript类型定义
│   ├── stores/             # Zustand stores
│   ├── utils/              # 工具函数（日期格式化、cn()等）
│   └── constants/          # 常量（城市列表、风格标签等）
├── mocks/                  # Mock数据
│   ├── artists.ts
│   ├── shows.ts
│   ├── venues.ts
│   ├── users.ts
│   ├── messages.ts
│   ├── buddyPosts.ts
│   ├── ticketPosts.ts
│   ├── livePosts.ts
│   └── announcements.ts
└── hooks/                  # 自定义React Hooks
    ├── useAuth.ts
    ├── useShows.ts
    ├── useRoom.ts
    └── ...
```

### P0.5 验收
- [ ] `npm run dev` 启动成功，访问 localhost:3000 看到深色背景的页面
- [ ] Tailwind 颜色token可用（bg-[--bg-primary]、text-[--accent-red]等或通过Tailwind自定义类）
- [ ] 目录结构创建完成
- [ ] TypeScript 无编译错误

---

## P1：布局框架与导航

### P1.1 基础UI组件库（components/ui/）
优先搭建所有后续要用的基础组件：
- **Button**：primary/secondary/ghost/link/danger 五种variant，sm/md/lg三种尺寸
- **Input**：文本输入框（深色背景+边框样式）
- **Textarea**：多行文本域
- **Modal/BottomSheet**：桌面模态弹窗/移动底部面板（同一组件根据屏幕尺寸自适应）
- **TabBar**：横向Tab切换组件（支持激活态下划线）
- **Badge/Tag**：状态标签、风格标签
- **Select/Dropdown**：下拉选择器（城市、时间筛选）
- **Avatar**：用户/乐队头像（圆形/方形，支持fallback）
- **Toast**：操作成功/失败提示
- **ConfirmDialog**：确认对话框（删除等）
- **Skeleton**：骨架屏加载

### P1.2 AppLayout
- 桌面端：顶部导航 TopNav，内容区 Container（max-width 居中）
- 移动端：内容区 + 底部固定 BottomTabNav
- 响应式断点：sm:640px / md:768px / lg:1024px
- 在 `src/app/layout.tsx` 中包裹所有页面

### P1.3 TopNav（桌面）
- 左侧：Logo文字"GigRoom/声场"
- 中间：导航链接（发现/演出/房间/我的），当前路由激活态（暗红下划线/加粗）
- 右侧：城市选择器（显示当前城市）、🔔通知图标（带badge）、用户头像/未登录显示"登录"
- 固定在页面顶部，z-index高

### P1.4 BottomTabNav（移动端）
- 四个Tab：发现/演出/房间/我的
- 每个Tab：图标+文字
- 当前路由激活态：图标+文字变暗红色
- 固定在视口底部，背景深色，顶部细线分隔

### P1.5 验收
- [ ] 桌面端访问看到顶部导航栏，四个导航链接可点击切换
- [ ] 移动端宽度下看到底部Tab栏，顶部导航简化
- [ ] 路由切换时导航激活态正确变化
- [ ] Button/Tab/Modal等基础组件可正常使用（创建测试页面验证）
- [ ] 导航在深色背景上视觉清晰，符合zine风格

---

## P2：核心数据层与Mock数据

### P2.1 TypeScript类型定义（lib/types/）
创建 `index.ts` 导出所有核心类型：
- User, Artist, Venue, Show, ShowArtist, ShowRoom
- RoomMembership, UserArtistFollow, UserShowStatus
- Announcement, DiscussionMessage, BuddyPost, BuddyPostComment
- TicketPost, TicketPostComment, LivePost, Notification
- 枚举类型：ShowStatus, TicketStatus, PostType, NotificationType等

严格按照PRD附录A的数据模型定义。

### P2.2 Mock数据（mocks/）
创建有真实感的中文Mock数据：
- **venues.ts**：至少10个真实中国Livehouse（MAO Livehouse上海/北京、育音堂、School、VOX、MAO杭州、小酒馆成都等）
- **artists.ts**：至少15支中国独立乐队（Chinese Football、柏林护士、Default、Shanghai Qiutian、DOC、海朋森、惘闻、万能青年旅店、回春丹、蛙池、脏手指、过失、Snapline、Carsick Cars、P.K.14等），每支包含封面图URL（可用picsum占位）、城市、风格标签（Emo/Shoegaze/Math Rock/Indie Rock/Post-Punk等）、简介、网易云链接
- **shows.ts**：至少20场演出，覆盖未来2个月，不同城市、不同乐队组合（headliner+support），不同状态（在售/售罄/即将开票/已结束数场），真实票价、真实海报占位
- **users.ts**：至少5个mock用户（带头像、用户名、城市、bio）
- **announcements.ts**：为部分演出绑定公告（开票通知、入场时间调整、加场、售罄等）
- **messages.ts**：为部分演出房间创建讨论消息（有头像、真实感聊天内容、含回复@）
- **buddyPosts.ts**：找搭子帖子10+条
- **ticketPosts.ts**：出收票帖子8+条（含已出/已收到状态的样本）
- **livePosts.ts**：为已结束的演出创建现场帖子（含图片数组和B站链接样本）

Mock规则：
- 海报使用 picsum.photos 或占位图服务，但要指定真实比例（3:4或2:3演出海报比例）
- 乐队封面使用方形占位图
- 用户头像使用圆形占位图
- 日期从2026-08-12开始，未来演出分布在未来2个月内
- 至少3场演出已结束（用于测试过往演出和现场Tab）

### P2.3 API抽象层（lib/api/）
创建API封装层（P10前使用mock数据，后续切换为真实Supabase调用）：
```
lib/api/
├── shows.ts       # getShows(filters), getShowById(id), getShowsByArtist(artistId)
├── artists.ts     # getArtists(filters), getArtistById(id), getFollowedArtists(userId)
├── rooms.ts       # getRoomsByUser(userId), getRoomByShow(showId), joinRoom, leaveRoom
├── messages.ts    # getMessages(roomId), sendMessage, deleteMessage
├── posts/         # buddyPosts, ticketPosts, livePosts的CRUD
├── announcements.ts
├── notifications.ts
├── user.ts        # getUser, updateUser, followArtist, unfollowArtist, setShowStatus
└── index.ts       # 统一导出
```
每个函数在mock阶段直接返回Promise resolved mock数据，接口签名与未来真实API一致。

### P2.4 全局状态管理（lib/stores/）
使用Zustand创建：
- **useUserStore**：当前用户信息、登录状态、关注乐队列表、showStatuses、roomMemberships
- **useUIStore**：当前城市、登录弹层开关状态、onboarding弹层状态、toast消息
- **useCityStore**：用户选择的城市

Mock阶段：提供一个mock登录用户，预置一些关注乐队、going状态和房间加入记录，方便开发测试。

### P2.5 验收
- [ ] 所有TypeScript类型定义无编译错误
- [ ] Mock数据覆盖所有场景（在售/售罄/延期/已结束演出，不同类型帖子等）
- [ ] API函数可以在页面/组件中调用并返回数据
- [ ] Zustand store可以存取用户状态和UI状态
- [ ] 城市列表、风格标签等常量定义完成

---

## P3：发现页与演出列表

### P3.1 共用组件：ShowCard
创建 `components/show/ShowCard.tsx`：
- 大图海报（顶部，占卡片65-70%）
- 乐队名（粗体）
- 日期 + 城市·Venue
- ❤️感兴趣数  👥要去数
- 推荐原因标签（小字，蓝色/暗红）
- 卡片圆角4px或直角，hover轻微变亮
- 点击跳转 `/show/[id]`

### P3.2 共用组件：ShowCardCompact
紧凑版演出卡片，用于Profile和Rooms：
- 海报缩略图（小尺寸）+ 乐队名 + 日期 + 城市
- 用于列表/侧边栏场景

### P3.3 共用组件：SectionDivider
板块分隔符（粗横线或编辑式装饰字符），用于区分首页不同区域。

### P3.4 发现页实现（app/page.tsx）
从上到下实现：
1. 页面顶部区域："为你推荐"大标题 + "根据你关注的乐队和城市推荐"副标题
2. 演出卡片网格（桌面2-3列，移动单列），从mock API获取推荐演出
3. 板块分隔
4. "本城近期演出"区域 + 引导文案（cold start状态时显示）+ 演出卡片网格
5. 板块分隔
6. "发现乐队"区域 + 横向滚动乐队列表（使用ArtistCardSmall）

### P3.5 演出列表页实现（app/shows/page.tsx）
1. 页面标题"演出"
2. 二级TabBar："全部" / "我关注的"（使用TabBar组件）
3. Filter行：城市选择器 + 时间筛选下拉 + 风格标签多选
4. 演出列表（按日期分组显示，月份分隔符如"8月"），卡片使用ShowCard或列表样式
5. 演出列表项在列表页可以更紧凑：左侧日期，中间海报缩略图+信息，右侧要去人数

### P3.6 城市选择器
- 点击弹出城市列表（桌面下拉/移动全屏面板）
- 城市列表：北京、上海、广州、深圳、成都、武汉、杭州、南京、西安、重庆、长沙、广州等主要Livehouse城市
- 支持搜索城市名
- 选择后更新useCityStore，页面数据刷新
- 不做GPS定位

### P3.7 验收
- [ ] 发现页正确显示"为你推荐"演出卡片，海报大图视觉突出
- [ ] 每张卡片信息完整（海报/乐队名/日期/场地/人数/推荐原因）
- [ ] Cold start状态显示"本城近期演出"和引导关注文案
- [ ] "发现乐队"区域横向滚动显示乐队
- [ ] 演出列表页Tab切换（全部/我关注的）有效
- [ ] 城市/时间/风格筛选器可交互（mock阶段前端过滤）
- [ ] 演出卡片点击跳转到演出详情页（空白页面但URL正确）
- [ ] 响应式：桌面多列、移动单列布局正确

---

## P4：演出详情Hero Page

这是第一版最重要的页面，开发精力集中。

### P4.1 演出数据获取
在 `app/show/[id]/page.tsx` 中：
- 根据路由参数id获取演出详情
- 获取关联的乐队列表（headliner/support/guest按billing_order排序）
- 获取Venue信息
- 获取公告列表
- 获取房间信息和用户房间状态
- 获取当前用户对该演出的状态（intereste/going/attended）

### P4.2 Hero区实现（components/show/ShowHero.tsx）
从上到下严格按照视觉层级：
1. **大幅演出海报**：居中或偏左，宽度约占视口55-65%（桌面），移动端全宽；有细微白边模拟海报贴墙
2. **乐队名/演出名**：超大号hero字体（48-64px桌面/32-40px移动），粗体
3. **日期时间**：如"2026年8月21日 周五 · 20:00"（等宽字体可选）
4. **城市 · Venue**：如"上海 · MAO Livehouse"
5. **票价**：如"¥180 预售 / ¥220 现场"
6. **状态Badge**：在售（暗红）/售罄（灰）/延期（黄）/取消（暗红灰）/已结束（灰）
7. **人数统计**：❤️ 1,342 人感兴趣 · 👥 318 人要去（间距大，字号适中）
8. **主状态按钮**：[感兴趣] 和 [我要去] 并排，
   - 未选中状态：深色底+边框
   - "感兴趣"选中：边框+文字变暗红
   - "我要去"选中：暗红填充+白色文字
   - 点击更新store中的UserShowStatus
9. **购票按钮**：[秀动购票 ↗] （根据ticket_platform显示平台名），全宽大按钮，outline/绿色风格，点击window.open(ticket_url)
10. **演出房间入口区**（RoomEntry组件）：
    - 小标题"演出房间"
    - 未加入："286 人已加入" + "43条新讨论 · 12人找搭子 · 6条票务" + [加入演出房间]按钮
    - 已加入："你已加入 · 286 位乐迷" + [进入演出房间]按钮
    - 点击"加入"创建RoomMembership；点击"进入"平滑滚动到Show Room区域

### P4.3 公告区（components/show/AnnouncementList.tsx）
- 板块标题"📢 演出公告"
- 与Hero和Show Room有视觉区分（左边框+稍亮背景）
- 公告卡片列表，按时间倒序
- 每条公告：类型标签（开票/售罄/加场等，对应颜色）+ 标题/正文 + 发布日期
- 无公告时：不显示整个区域（V1简单处理）

### P4.4 Show Room 容器框架（components/room/ShowRoom.tsx）
- 板块标题"演出房间"
- TabBar：讨论|找搭子|出收票|现场（四个Tab）
- Tab内容区域：根据activeTab渲染对应组件
- Tab栏sticky（在Show Room区域内sticky top，不随页面滚走）
- 默认激活"讨论"Tab
- 支持URL hash（#discussion/#buddy/#ticket/#live）预激活对应Tab（P4可先简化）
- 未加入房间的用户可以看到内容，但在各Tab内部禁用输入操作

### P4.5 点击流验证
- 从发现页点击演出卡片 → 进入演出详情页，所有信息正确显示
- 点击感兴趣/我要去 → 按钮状态变化，store中数据更新
- 点击购票 → 新标签页打开链接
- 点击加入房间 → 按钮变为"进入演出房间"，房间人数更新
- 点击乐队名 → 跳转到乐队详情页（P6前可先显示"即将推出"或链接到空白页）
- 点击进入演出房间 → 页面滚动到Show Room区域

### P4.6 验收
- [ ] 海报是页面最大视觉元素，比例正确
- [ ] 信息显示完整：乐队名（大）、日期、城市场地、票价、状态、人数统计
- [ ] 感兴趣/我要去按钮三态切换正确（未选/已选感兴趣/已选要去）
- [ ] 购票按钮显示正确平台名，点击打开新标签
- [ ] 演出房间入口区有"有人感"（人数+活跃度），加入/进入功能正常
- [ ] 公告区正确显示公告列表（类型标签、内容、时间）
- [ ] Show Room四个Tab可以切换（内容可以先用占位符，P5完整实现）
- [ ] 未登录点击感兴趣/我要去/加入房间 → 触发登录拦截（P7前先弹alert或console.log标记）
- [ ] 桌面/移动端布局均正确

---

## P5：Show Room 四个Tab

### P5.1 讨论Tab（components/room/DiscussionTab.tsx）
- **MessageList组件**：
  - 消息按时间正序排列（最新在底部）
  - 每条消息：左侧头像（圆形，小）+ 右侧用户名+时间+内容
  - 回复消息：缩进一小段，显示"回复 @xxx"在内容前
  - 自己发的消息右上角显示删除[×]按钮
  - 每条消息右下角显示"举报"小字链接（低调）
- **MessageInput组件**：
  - 固定在讨论区底部（不是整个页面底部，是Tab内容区内底部，如果内容多则scroll后能看到）
  - 文字输入框："说点什么……" + [发送]按钮
  - 未加入房间：输入框禁用，显示"加入演出房间后参与讨论"
  - 发送后清空输入框，消息追加到列表
  - Rate limit：发送后10秒内按钮disabled，显示倒计时
- 滚动行为：首次进入时自动滚动到底部（最新消息）

### P5.2 找搭子Tab（components/room/BuddyTab.tsx）
- 顶部右侧：[+ 发布] 按钮
- **BuddyPostCard组件**：
  - 顶部：头像+用户名+发布时间
  - 正文内容
  - 标签行：#一起看演出 #排队 #吃饭 #拼车（小标签，背景--bg-tertiary）
  - 底部："X条回复"文字 + 点击展开/收起回复区
  - 右上角：自己帖子显示删除按钮
- 回复区（内联展开）：
  - 回复列表（同消息样式，简单文字回复）
  - 回复输入框（加入房间后可用）
- **发布弹层（BuddyPostModal）**：
  - 文本域（placeholder："介绍下自己，想找什么样的朋友一起……"）
  - 标签多选：四个复选框（一起看演出/排队/吃饭/拼车）
  - [发布] 和 [取消] 按钮
- 帖子按时间倒序排列

### P5.3 出收票Tab（components/room/TicketTab.tsx）
- **规则提示条**（固定在子Tab栏下方，视觉醒目）：
  - 第一行："⚠️ 原价及以下友好转让"（加粗）
  - 第二行："平台不参与资金交易，请注意交易风险。"（小字）
  - 暗黄/暗红边框左边框，不同背景色
- **子TabBar**：全部 | 出票 | 收票（筛选帖子类型）
- 顶部并排按钮：[我要出票] [我要收票]
- **TicketPostCard组件**：
  - 类型标签（[出票]暗红/[收票]深绿）+ 状态标签（进行中蓝/已出/已收到灰）
  - 头像+用户名+发布时间
  - 出票帖显示："1张 · 票面原价 ¥180 · 出票价格 ¥160" + 备注
  - 收票帖显示："求1张 · 预算原价" + 备注
  - 完成状态帖子内容降权显示（降低透明度）
  - 回复区（同找搭子展开方式）
  - 作者可见：[标记已出]/[标记已收到]按钮（点击后状态变completed，帖子变灰）
  - 作者可见：删除按钮
- **发布弹层**：
  - 类型切换（出票/收票，顶部大按钮切换）
  - 出票表单：张数（数字输入）+ 票面原价 + 出票价格 + 备注（文本域）
  - 收票表单：张数（数字输入）+ 预算（可选，标注"可不填"）+ 备注
  - [发布] [取消]
  - 顶部同样显示规则提示文字

### P5.4 现场Tab（components/room/LiveTab.tsx）
- **开放时间判断逻辑**：
  - 获取演出date_time，对比当前时间
  - 演出日之前（当天0点前）：显示锁定状态
  - 演出日0点之后：解锁发布功能
- **锁定状态**：
  - 居中占位区域
  - 📷 图标 + "演出当天可以在这里分享现场" + "演出结束后，这里会留下属于这一晚的现场记录"
  - 无发布按钮
- **解锁后**：
  - 顶部右侧：[分享现场]按钮
  - **LivePostCard组件**：
    - 头像+用户名+发布时间
    - 文字描述
    - 图片网格（桌面3列/移动2列，图片间无间距或1px间距，拼贴感，点击可放大V1可不做lightbox）
    - 视频链接卡片：平台图标（B站/小红书/抖音/YouTube）+ 链接域名，点击新标签页打开
    - 右上角：自己的帖子有删除按钮
    - **V1 无评论区**（简化，不做CommentSection）
  - 按时间倒序排列
- **发布弹层（LivePostModal）**：
  - 文字描述（文本域，可选）
  - 图片上传区域：点击选择图片（支持多张），显示缩略图预览，可删除单张（V1先用本地URL预览，P10对接Storage）
  - 视频链接输入框（placeholder："粘贴B站/小红书/抖音/YouTube链接"）
  - [发布] [取消]

### P5.5 治理功能基础版
- 删除：作者在自己的消息/帖子上看到删除按钮，点击后ConfirmDialog确认，然后从列表移除
- 举报：每个帖子/消息右下角有"举报"小字链接，点击弹简单举报弹层（选择原因+提交，V1先mock提交，toast显示"已收到举报，感谢反馈"）
- 频率限制：发消息10秒cooldown，发帖也加类似限制（30秒）

### P5.6 验收
- [ ] 讨论Tab：消息正确显示，可发文字消息，可回复，10秒频率限制生效，自己可删除
- [ ] 未加入房间用户在讨论区看到禁用输入框和提示文字
- [ ] 找搭子Tab：帖子列表正确显示标签/回复数，可发布新帖子（弹层），可展开回复
- [ ] 出收票Tab：规则提示条始终显示，出票/收票帖子样式区分，状态标记功能正常，价格信息完整（含票面原价+实际价格）
- [ ] 现场Tab：演出日前显示锁定提示，演出日可发布，图片网格显示，视频链接卡片可跳转
- [ ] 四个Tab切换流畅，不刷新页面
- [ ] 删除和举报入口存在且可用（mock阶段console或toast）
- [ ] Tab栏在Show Room区域内sticky

---

## P6：乐队相关页面

### P6.1 乐队卡片组件
- **ArtistCard**（用于乐队列表）：方形封面 + 乐队名 + 城市 + 风格标签 + [+关注]/[已关注]按钮
- **ArtistCardSmall**（用于发现页横向列表）：小封面 + 名字 + 小关注按钮

### P6.2 乐队列表页（app/artists/page.tsx）
- 顶部：搜索框（按乐队名模糊搜索，前端过滤即可）
- 风格筛选标签（多选）：Emo/Shoegaze/Math Rock/Indie Rock/Post-Punk等
- 乐队卡片网格（桌面3-4列，移动2列）
- 点击卡片进入 `/artist/[id]`
- 关注按钮直接在卡片上操作（无需进详情页）

### P6.3 乐队详情页（app/artist/[id]/page.tsx）
从上到下：
1. **乐队封面大图**（宽度100%，高度300px左右，cover模式，有暗化渐变）
2. **乐队名称**（大号标题，叠加在封面图下方或图片上）
3. **城市/国家**（如"武汉 · 中国"）
4. **风格标签行**
5. **简介文字**（一段，约50-100字）
6. **按钮行**：[关注]/[已关注] 主按钮 + [在网易云音乐听 ↗] 外链按钮（小按钮）
7. **二级Tab**："即将演出" | "过往演出"
   - 即将演出：该乐队的未来演出列表（ShowCardCompact样式），按日期升序
   - 过往演出：该乐队的已结束演出列表，标注"已结束"状态
8. 底部：不做相似乐队。如要占位，用极小灰色文字"更多相关乐队即将推出"即可，不占大块UI。

### P6.4 关注逻辑
- 点击FollowButton切换关注状态
- 更新useUserStore中的followedArtists列表
- Mock阶段直接在store中操作，P10对接API

### P6.5 验收
- [ ] 乐队列表页搜索可用（前端过滤），风格筛选可用
- [ ] 点击乐队进入详情页，所有信息正确显示
- [ ] 关注按钮切换状态正确（+关注 ↔ ✓已关注）
- [ ] 网易云链接按钮点击新标签页打开
- [ ] 即将演出/过往演出Tab切换正确，演出列表显示
- [ ] 演出列表项点击跳转到对应演出详情

---

## P7：账号系统与Onboarding

### P7.1 Supabase配置（P7先创建基础配置，P10完整对接数据库）
- 在 Supabase 创建项目（或本地用 Supabase CLI）
- 在 `lib/supabase/` 创建 `client.ts` 和 `server.ts`（使用 @supabase/auth-helpers-nextjs）
- 在 `.env.local` 配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### P7.2 Auth Provider & useAuth
- 创建 `components/user/AuthProvider.tsx`，在根layout包裹，监听Supabase auth状态变化
- 创建 `hooks/useAuth.ts` 封装：user、loading、signIn、signUp、signOut
- Mock阶段：提供mock auth（使用localStorage持久化mock用户），后续切换为真实Supabase auth时接口不变

### P7.3 登录弹层（LoginModal）
- 触发方式：未登录用户点击互动按钮时，通过UIStore控制打开
- 弹层内容（Tab切换）：
  - **登录Tab**：邮箱输入框 + 密码输入框 + [登录]按钮
  - **注册Tab**：邮箱+密码+确认密码+用户名输入框 + [注册]按钮
- 底部：关闭按钮
- 登录/注册成功后：
  1. 关闭弹层
  2. 检查onboarding_completed
  3. 未完成 → 打开OnboardingModal
  4. 已完成 → 执行回调函数（之前触发登录的操作，如标记going、加入房间等）

**关键：登录不跳转页面，始终是弹层。需要支持"登录后回调"机制**（类似：点击我要去→弹登录→登录成功后自动执行"标记going"）。

实现方案：useUIStore中保存 `loginCallback: (() => void) | null`，打开登录弹层时设置回调，登录成功后执行并清空。

### P7.4 Onboarding弹层（OnboardingModal）
两步流程，不可整体跳过（注册后强制完成）：

**Step 1：选择城市**
- 标题："你通常在哪座城市看演出？"
- 副标题："我们会优先为你推荐该城市的演出"
- 城市列表（同城市选择器，带搜索）
- 选中城市后高亮
- [下一步]按钮（未选城市时禁用）

**Step 2：关注喜欢的乐队**
- 标题："关注喜欢的乐队，有新演出时第一时间告诉你"
- 推荐乐队列表（同发现页发现乐队区域，但更大更全，支持搜索）
- 每个乐队右侧[+关注]/[已关注]按钮
- 无最低数量要求
- 两个按钮：主按钮[开始探索] + 弱化文字按钮[暂时跳过]
- 点击任一按钮：保存城市和关注数据，标记onboarding_completed=true，关闭弹层，执行loginCallback

### P7.5 登录拦截封装
创建 `hooks/useRequireAuth.ts` 或工具函数 `withAuth`：
```
用法：const wrapWithAuth = useRequireAuth()
<button onClick={() => wrapWithAuth(() => handleJoinRoom(showId))}>
  加入演出房间
</button>
```
- 未登录 → 打开LoginModal，设置loginCallback
- 已登录但未完成onboarding → 打开OnboardingModal（设置回调）
- 已登录且完成onboarding → 直接执行

### P7.6 验收
- [ ] 未登录点击感兴趣/我要去/加入房间/发布/关注等按钮 → 弹出登录弹层
- [ ] 可以用邮箱+密码注册（mock阶段成功即可）
- [ ] 注册后自动进入Onboarding流程
- [ ] Onboarding Step 1必须选择城市才能继续
- [ ] Onboarding Step 2可关注多个乐队，也可点"暂时跳过"
- [ ] 完成Onboarding后自动执行之前的操作（如点击"我要去"，登录完成后自动标记为going）
- [ ] 刷新页面后登录状态保持（localStorage/mock）
- [ ] 点击右上角"登录"也可打开登录弹层
- [ ] 已登录时右上角显示用户头像，点击有下拉菜单（退出登录等）

---

## P8：个人中心与房间页

### P8.1 个人主页（app/profile/page.tsx）
未登录重定向到发现页或提示登录。

#### ProfileHeader组件
- 大头像（圆形，80-100px）
- 用户名（大号粗体）
- 城市
- Bio一句话（斜体或不同颜色）
- 统计行："XX 个喜欢的乐队 · XX 场现场"
- [编辑资料]按钮

#### 编辑资料弹层（EditProfileModal）
- 头像上传（V1可先做URL输入或占位，P10对接真上传）
- 用户名输入
- 城市选择
- Bio文本域
- [保存] [取消]

#### Profile二级Tab
使用TabBar：乐队 | 演出 | 房间

**Tab1：乐队**
- 标题"我喜欢的乐队"
- 已关注乐队列表（ArtistCard网格或列表样式）
- 空状态："还没有关注乐队，去发现页看看吧"

**Tab2：演出**
- 三级Tab：我要去 | 感兴趣 | 去过
- 每个Tab下是演出卡片列表（ShowCardCompact），按日期排序
  - 我要去：status=going，未来演出，日期升序
  - 感兴趣：status=interested，未来演出，日期升序
  - 去过：status=attended，按时间倒序
- 每个列表显示数量（如"3场"）

**Tab3：房间**
- 标题"我的房间"
- 显示最近加入的3-5个房间（用RoomCardCompact样式）
- 底部[查看全部 →]链接，跳转到/rooms

### P8.2 房间页（app/rooms/page.tsx）
页面标题"房间"。

二级Tab：即将到来 | 过往

**即将到来Tab**：
- 按日期升序排列用户已加入的未来演出房间
- RoomCard：
  - 海报缩略图+乐队名+日期+城市·Venue
  - 加入人数+活跃度（如新讨论数）
  - [进入房间 →]按钮 → 跳/show/[id]
- 空状态："你还没有加入任何演出房间。去发现页看看有什么演出吧" + [去发现演出]按钮

**过往Tab**：
- 按时间倒序排列已结束演出的房间
- RoomCard类似：
  - 海报缩略图+乐队名+日期+城市
  - 现场内容数（如"156条现场内容"）+ "最近活跃：昨天"
  - [回到房间 →]按钮
- 空状态："还没有去过的演出记录"

### P8.3 验收
- [ ] 个人主页头部正确显示用户信息（头像/用户名/城市/Bio/统计）
- [ ] 编辑资料弹层可以修改信息并保存
- [ ] "乐队"Tab显示已关注乐队列表
- [ ] "演出"Tab下三级Tab分别显示going/interested/attended演出
- [ ] "房间"Tab显示最近房间，可跳转到/rooms
- [ ] /rooms页面"即将到来"和"过往"Tab正确显示房间列表
- [ ] 房间页点击"进入房间"跳转到对应演出详情
- [ ] 空状态提示正确显示
- [ ] 标记Interested/Going/Attended后，Profile对应列表实时更新
- [ ] 加入房间后，Rooms页面实时出现该房间

---

## P9：通知系统

### P9.1 通知数据与生成逻辑
Mock阶段：创建通知mock数据（三种类型各几条），同时实现mock的通知生成逻辑：
- 关注新乐队后，如果该乐队在用户城市有演出，模拟生成new_show通知
- 演出有公告时，给相关用户生成announcement通知（mock阶段用setTimeout模拟）
- Mock几个演出已结束，对going用户生成attended_check通知

### P9.2 通知Badge
- TopNav右侧🔔图标
- 未读通知数 > 0时，图标右上角显示红色小圆点+数字
- 点击🔔跳转 `/notifications`

### P9.3 通知中心页（app/notifications/page.tsx）
- 页面标题"通知"
- 顶部操作：[全部标为已读]
- 通知列表，按时间倒序
- **NotificationItem组件**：
  - 左侧图标（🔔新演出/📢公告/❓attended询问）
  - 标题加粗（未读）或正常（已读）
  - 辅助信息：如"8月21日 · MAO Livehouse"
  - 时间（如"2小时前"）
  - 未读：左侧红色竖条标识
  - 点击：标记为已读，跳转到对应演出详情（公告类型滚到公告区域）
- **AttendedCheck通知特殊交互**：
  - 通知内容："你去了 Chinese Football 上海站吗？"
  - 通知下方直接显示两个按钮：[是的，我去了] [没去成]
  - 点击"是的"：设置UserShowStatus为attended，通知标记已读
  - 点击"没去成"：清除going状态（设回null），通知标记已读

### P9.4 验收
- [ ] 导航栏🔔图标正确显示未读数badge
- [ ] 通知中心显示三种类型通知
- [ ] 未读通知视觉区分（加粗+红条）
- [ ] 点击通知跳转对应演出页
- [ ] "全部标为已读"功能正常
- [ ] Attended check通知的两个按钮操作正确，Profile"去过"列表更新
- [ ] 标记已读后badge数字更新

---

## P10：Supabase集成与数据持久化

### P10.1 数据库Schema设计与Migration
编写SQL migration文件（`supabase/migrations/001_init.sql`）：
- 启用UUID扩展
- 创建所有表（按PRD附录A，字段类型明确）
- 设置主键、外键、唯一约束
- 创建索引（user_id, show_id, room_id等常用查询字段）
- 设置Row Level Security (RLS) 策略：
  - 公开表（artists, venues, shows, announcements）：所有人可读，只有认证的服务角色可写
  - 用户私有表（user_artist_follows, user_show_statuses, room_memberships）：用户只能读写自己的数据
  - 社区内容表（discussion_messages, buddy_posts, ticket_posts, live_posts, comments）：所有人可读，认证用户可创建，作者可更新/删除自己的内容
  - 通知：用户只能读自己的通知

### P10.2 Supabase客户端封装
完善 `lib/supabase/`：
- `client.ts`：客户端组件使用的createClientComponentClient
- `server.ts`：服务端组件使用的createServerComponentClient
- `middleware.ts`：处理session刷新

### P10.3 替换Mock API为真实API
逐步将 `lib/api/` 中的mock函数替换为Supabase查询：
- shows.ts：从shows表联表artists/venues查询
- artists.ts：从artists表查询
- 房间/消息/帖子/通知：全部替换为Supabase查询
- 用户相关：follow/unfollow、setShowStatus、joinRoom等调用Supabase mutation

**关键查询逻辑**：
- 发现页推荐：查询用户关注乐队的未来演出（在用户城市）→ 推荐原因="因你关注了XX"；补充当前城市的近期演出作为fallback
- 演出详情：联表查询show+show_artists+artists+venue+announcements
- Show Room内容：按room_id(show_id)查询对应表
- 讨论消息：按room_id查询，按created_at正序，支持realtime订阅（P10可做realtime新消息推送）

### P10.4 Supabase Auth对接
- 替换mock auth为真实Supabase Auth
- 注册时：创建auth用户后，在profiles表创建对应记录（通过database trigger或signUp后手动插入）
- 登录/登出：使用Supabase auth方法
- 邮箱验证：V1可以先关闭邮箱验证（在Supabase dashboard设置），简化开发

### P10.5 文件存储（Supabase Storage）
- 创建Storage bucket：`posters`（公开读，服务角色写/管理后台上传）、`avatars`（认证用户可上传自己的）、`live-photos`（认证用户可上传）
- 配置bucket政策：
  - posters：public read，只有service role可写（演出海报由管理员添加）
  - avatars：认证用户可上传自己的，public read
  - live-photos：认证用户可上传，public read
- 图片上传组件对接Storage：上传后获取public URL
- 头像和现场照片上传真实可用
- 海报：V1先使用URL字符串（不做海报上传后台），mock数据中的海报URL直接存数据库

### P10.6 Realtime（可选P10或后续）
- 讨论区消息：订阅realtime，新消息自动追加到列表（不用刷新）
- V1如果时间紧张，realtime可以作为增强，先保证轮询/刷新可用

### P10.7 数据Seed
创建seed脚本（`supabase/seed.sql`）：
- 插入mock artists/venues/shows数据到真实数据库
- 插入mock announcements
- 这样生产/测试环境初始化有真实感数据

### P10.8 验收
- [ ] 所有数据从Supabase数据库读取，不再依赖前端mock
- [ ] 用户注册/登录真实可用（邮箱+密码）
- [ ] 关注/取消关注乐队持久化到数据库
- [ ] 标记感兴趣/我要去持久化
- [ ] 加入房间持久化
- [ ] 发消息/发帖/出收票/现场分享全部持久化
- [ ] 头像上传和现场图片上传真实可用（Supabase Storage）
- [ ] RLS策略正确：用户A不能修改/删除用户B的内容
- [ ] 刷新页面后所有数据正确加载
- [ ] （可选）讨论区新消息realtime推送

---

## P11：社区治理与细节打磨

### P11.1 删除功能
- 所有自己的内容（消息、帖子）显示删除按钮
- 删除时弹ConfirmDialog确认
- 确认后调用API删除，UI同步移除
- 删除操作需要验证RLS（数据库层面保证只能删自己的）

### P11.2 举报功能
- 举报弹层：选择举报原因（垃圾信息/黄牛/不当内容/骚扰/其他）+ 可选补充说明 + 提交
- V1：举报内容存入reports表（简单表：id, reporter_id, target_type, target_id, reason, created_at）
- 提交后toast提示"已收到举报，我们会尽快处理"
- V1不做后台审核界面，管理员通过数据库查看处理

### P11.3 频率限制
- 前端：发消息10秒cooldown，发帖30秒cooldown
- 后端（可选/简单版）：通过PostgreSQL触发器或Edge Function做简单限流（如每用户每分钟最多5条消息）；V1前端限流即可

### P11.4 空状态/加载/错误处理
- **EmptyState组件**：统一空状态样式（图标+文字+操作按钮），覆盖：
  - 发现页无推荐（未关注乐队且城市无演出）
  - 演出列表无演出
  - 房间页无房间
  - 各Tab无帖子/消息
  - 搜索无结果
- **LoadingSpinner组件**：页面加载/列表加载时的loading状态
- **错误提示**：API请求失败时显示友好错误信息（toast或错误区域）
- **骨架屏**：演出详情Hero等大区域加载时显示Skeleton

### P11.5 演出结束后的Attended Check
- 实现一个定时/触发逻辑：演出时间过后24小时内，对status=going的用户生成attended_check通知
- V1简化：不做cron job，可以在用户登录/打开APP时检查"我要去"列表中有无已结束但未确认的演出，自动生成通知
- 通知交互见P9.3

### P11.6 验收
- [ ] 删除功能正常，ConfirmDialog确认后删除
- [ ] 举报入口可用，提交后有反馈
- [ ] 频率限制在发帖/发消息时生效
- [ ] 所有空状态页面有友好提示
- [ ] 加载状态有spinner或skeleton
- [ ] API错误有友好提示，不会白屏/崩溃
- [ ] 演出结束后going用户收到attended确认通知

---

## P12：视觉打磨与响应式测试

### P12.1 视觉Polish
- 添加CSS噪点纹理（body背景上叠加一层低透明度noise，营造印刷质感）
- 海报添加细微白色边框（1px solid rgba(240,237,230,0.15)）模拟印刷品边缘
- 检查所有字号是否符合Design System层级（hero/h1/h2/h3/body/sm/xs）
- 检查所有颜色使用是否正确（暗红只用于主CTA和强调，不要滥用）
- 分隔线使用编辑式装饰（如加粗的短横线"—"居中，或CSS画的装饰线）
- 大标题添加tracking-tight（字间距紧缩）增强编辑感
- 检查所有hover/active/focus状态
- 焦点样式：去掉浏览器默认蓝色outline，改用暗红outline

### P12.2 移动端适配
- 测试设备宽度：375px（iPhone SE）、390px（iPhone 14）、430px（iPhone 14 Pro Max）、768px（iPad mini竖屏）
- 确保：
  - 底部Tab栏不遮挡内容（内容区域加padding-bottom）
  - 按钮在移动端可点击区域≥44px高度
  - 弹层在移动端是底部Sheet样式
  - 演出卡片在移动单列布局下海报宽度合理
  - 讨论区消息输入框固定在键盘上方（V1可用fixed bottom）
  - Tab文字在小屏幕不换行或截断
  - 现场图片2列网格在移动端正常显示

### P12.3 桌面端测试
- 测试宽度：1024px、1280px、1440px、1920px
- 确保：
  - Container最大宽度合理（约1200-1400px），超宽屏不拉伸过度
  - 多列网格正确排列
  - TopNav在所有桌面宽度正常显示
  - 海报在Hero区比例协调

### P12.4 动画与交互细节
- Tab切换：下划线平滑移动
- 弹层：fade+slide动画
- 按钮hover：颜色渐变过渡（transition 150ms）
- 消息发送：轻微fade in动画
- 页面切换：使用Next.js loading.tsx或简单fade
- 避免过度炫技动画，保持zine的克制感

### P12.5 验收
- [ ] 整体视觉符合"中国独立音乐/Livehouse/Zine"风格，没有SaaS/AI startup感
- [ ] 深色背景+off-white文字+暗红强调，三色搭配协调
- [ ] 演出海报是最醒目的视觉元素
- [ ] 所有页面在375px/768px/1280px宽度下布局正确、无错位
- [ ] 所有按钮/链接hover/active状态正确
- [ ] 弹层在桌面是模态、在移动端是底部sheet
- [ ] 动画流畅但不夸张
- [ ] 无控制台报错（React warnings, 404资源等）

---

## P13：部署准备

### P13.1 环境变量整理
确保 `.env.example` 包含所有需要的环境变量：
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=（仅服务端使用）
NEXT_PUBLIC_SITE_URL=（生产域名）
```
`.env.local` 加入 `.gitignore`，不提交。

### P13.2 部署到Vercel
- 将代码推送到GitHub仓库
- 在Vercel导入项目
- 配置环境变量
- 部署生产环境
- 配置自定义域名（可选）

### P13.3 Supabase生产配置
- 在Supabase dashboard确认production项目的RLS策略全部启用
- 确认Storage bucket权限正确
- 配置Site URL为生产域名（用于auth redirect）
- 运行migration到production数据库
- 运行seed脚本（可选，初始化基础乐队/Venue/演出数据）

### P13.4 README编写
创建项目README.md，包含：
- 项目简介（一句话）
- 技术栈
- 本地开发：`npm install` → 配置.env.local → `npm run dev`
- 环境变量说明
- 部署说明
- 项目结构说明

### P13.5 验收
- [ ] `npm run build` 构建成功，无TypeScript错误
- [ ] Vercel部署成功，访问生产URL可正常使用
- [ ] 生产环境可注册/登录/发布内容
- [ ] Supabase生产数据库RLS生效
- [ ] README文档完整

---

## 开发顺序建议（快速验证路径）

如果想最快看到核心价值（Happy Path），推荐按此顺序开发：

1. **P0 → P1 → P2**：基础设施、布局、Mock数据（先让App骨架跑起来）
2. **P3**：发现页+演出卡片（用户能看到演出列表）
3. **P4**：演出详情Hero（最重要页面，先做海报+信息+按钮，Room区域先放占位）
4. **P5.1**：讨论Tab先实现（最核心社区功能）
5. **P7 Mock版**：用localStorage做mock登录和onboarding，让交互完整可体验
6. **P5.2-P5.4**：补齐找搭子、出收票、现场Tab
7. **P6**：乐队页和关注
8. **P8-P9**：个人中心、房间页、通知
9. **P10**：替换为Supabase真实数据
10. **P11-P13**：治理、打磨、部署

这样在第1周结束就应该能跑通核心Happy Path（发现演出→点进去→标记要去→加入房间→发消息），然后逐步补全功能。

---

## 关键开发原则

1. **先Mock后真实**：所有功能先用mock数据开发跑通，P10再统一对接Supabase，避免后端阻塞前端开发
2. **组件复用**：ShowCard、Button、Modal、TabBar等基础组件优先搭建，后续页面复用
3. **类型安全**：所有数据用TypeScript类型定义，不用any
4. **中文UI英文代码**：用户可见文案全中文，变量/函数/类型/数据库字段全英文
5. **不做未来才需要的功能**：严格按PRD"明确不做"清单，不超范围开发
6. **每次提交可运行**：不要让项目长期处于broken状态，每个小功能完成后都要能npm run dev跑起来
7. **视觉早介入**：Design System在P0就配置好颜色/字体/间距，不要最后再调样式

---

## 风险与注意事项

1. **Supabase RLS**：一定要在早期就启用RLS，避免后期补写出安全漏洞
2. **图片上传大小限制**：现场图片上传要在前端做压缩/大小限制（单张<5MB），避免Storage爆满
3. **外部视频链接只做跳转**：V1绝对不做embed/播放器，点击直接新标签页打开外链
4. **演出时间处理**：所有时间用UTC存储，显示时转换为中国时区（Asia/Shanghai）
5. **Mock数据真实性**：乐队名/场地/票价尽量用真实数据，让演示时有真实感
6. **移动端优先检查**：开发每个组件时先在移动端宽度看效果，再适配桌面
