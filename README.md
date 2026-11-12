# 藤栖龟舍 · VineTurtle Studio

以森林自然美学为核心的创意工作室网站。纯静态站点，无框架，内容以文件形式存放在 `data/` 目录中。

## 目录结构

```
├── index.html                  # 首页（SPA）
├── 404.html                    # 自定义 404 页（GitHub Pages 自动使用）
├── site.config.json            # 站点域名与公共信息的唯一配置源
├── CNAME                       # 自定义域名（npm run set-domain 自动同步）
├── robots.txt                  # 爬虫规则（后台目录不收录）
├── sitemap.xml                 # 站点地图（npm run build 自动生成）
├── feed.xml                    # 博客 RSS（npm run build 自动生成）
├── CSS/                        # 全局样式（layout.css / style.css / dynamic.css / special/）
├── JS/                         # 全局脚本（layout.js / script.js / special-*.js / dynamic.js / search.js）
├── SpecialPages/               # 博客 / 项目 / 画廊 / 搜索子页面
│   ├── Blog/                   #   博客列表 + 兼容详情入口 + 自动生成的静态详情页
│   ├── Project/                 #   项目列表 + 兼容详情入口 + 自动生成的静态详情页
│   ├── Gallery/                #   画廊（分类筛选 + 灯箱）
│   └── Search/                 #   站内搜索
├── data/                       # 内容数据（见下文「数据文件格式」）
│   ├── blog/
│   │   ├── index.json          #   博客索引（自动生成，勿手改）
│   │   ├── <slug>.json         #   每篇文章的元数据
│   │   └── posts/<slug>.html   #   每篇文章的正文
│   ├── project/                #   项目，结构同 blog
│   ├── meta/                   #   首页、动态功能等站点级配置
│   └── search-index.json       #   搜索索引（自动生成，勿手改）
├── worker/                     # 可选：Cloudflare Worker + D1（点赞/阅读量）
├── .github/workflows/          # CI：构建一致性检查
├── admin/                      # 本地管理后台（不纳入版本库，只在本机运行）
└── scripts/                    # 生成索引 / 静态详情页 / 管理后台 / 部署脚本
```

## 快速开始

```bash
# 1. 本地预览（纯静态）
npm run dev          # 打开 http://localhost:8000

# 2. 本地管理后台（增删文章/项目，写正文）
npm run admin
#    终端会打印管理地址：http://127.0.0.1:3000/admin?token=xxxx
#    该地址只在本次启动有效，且仅本机可访问

# 3. 手动改数据后重建全部产物（索引 / RSS / 搜索索引 / sitemap / 静态详情页）
npm run build

# 4. 只重建索引与 sitemap（不生成静态详情页）
npm run generate

# 5. 修改站点域名（同时同步 CNAME / canonical / OG / JSON-LD）
npm run set-domain -- https://new.example.com

# 6. 发布网站
npm run deploy       # 会先自动 build，再 rsync 或 commit + push
```

## 构建产物

`npm run build` 依次执行两个脚本，全部产物都应提交进仓库（CI 会检查）：

| 产物 | 生成脚本 | 说明 |
| --- | --- | --- |
| `data/*/index.json` | `generate-data.js` | 各分类内容索引 |
| `sitemap.xml` | `generate-data.js` | 固定页面 + 每篇内容的静态详情页 |
| `feed.xml` | `generate-data.js` | 博客 RSS（最近 30 篇，项目不进入订阅源） |
| `data/search-index.json` | `generate-data.js` | 站内搜索索引（标题 / 摘要 / 标签 / 日期 / 链接） |
| `SpecialPages/<分类>/<slug>.html` | `generate-pages.js` | 每篇内容的独立静态详情页 |

- 详情页把标题、摘要、头图、正文、目录和 JSON-LD 直接写进 HTML，分享卡片与搜索引擎无需执行 JS 就能拿到内容。
- 旧入口 `SpecialPages/Blog/post.html?slug=…`、`SpecialPages/Project/detail.html?slug=…` 仍然保留，作为兼容与本地预览入口。
- 列表页、首页与搜索结果的链接都指向静态详情页，并保留 `?page=` / `?tag=` 以便返回列表时回到原位置。
- 固定页面的 `lastmod` 取所有内容里的最新日期，避免每次构建都产生无意义 diff。

## 管理后台（推荐方式）

`npm run admin` 启动一个仅监听 `127.0.0.1` 的本地服务器：

- 打开终端打印的 **管理后台** 地址（含一次性令牌），可增删改博客文章与项目；
- 正文用**可视化编辑器**编写，无需写 HTML：工具栏支持各级标题、加粗/斜体、代码块（可选语言、带语法高亮）、列表、引用、表格、分割线；「🖼️」可上传图片到 `Resources/images/`（支持多选）或填图片链接；右上角「</>」可切换 HTML 源码模式；
- **列表封面图 / 详情头图**直接在编辑器里点「⬆ 上传」或「📁 选择已有」完成，自动填入路径并实时预览，无需手动把图片复制进项目再粘贴路径；
- 图片**按内容分类存放**：博客文章 → `Resources/images/blog/`，项目 → `Resources/images/projects/`；封面图与头图共用同一目录，同一张图用作封面+头图时只存一份原图；
- 上传图片会**自动去重命名**（同名自动加 `-2/-3` 后缀），避免覆盖；封面图上传时自动生成 `@thumb` 压缩小图，列表卡片优先加载小图（加载更快、缺省自动回退原图）以加速页面；
- 标签输入带**已有标签联想**（下拉 + 可点选）；列表有「复制」与「转移」按钮，可一键复制文章/项目，或转移到其他分类；
- 「🗂 分类管理」标签页可**新增/删除分类**：新增自动创建 `data/<key>/`、`Resources/images/<key>/`、`SpecialPages/` 页面并接入首页「更多」导航与后台标签页；删除需多重确认且只允许删空分类（分类配置统一维护在 `scripts/kinds.json`）；
- 编辑内容**自动保存草稿**（存在本机浏览器），意外关闭后重开会提示恢复；摘要留空时保存会自动从正文提取；
- 保存时自动重建 `index.json`，无需手动维护索引；
- **增删改即时写入本地文件**（`data/` 与 `Resources/`）；保存前若文件名与已有内容冲突会先确认；索引重建异常时自动回滚，保证文件与索引一致；
- 「🖼️ 图片」标签页可查看已上传图片、标注被哪些内容引用，可删除（含孤儿图片清理）；
- 「部署发布」页一键上传到服务器或推送 Git；
- 后台和令牌只在你的本机生效，**生产环境不会部署本后台**，普通用户无法进入。

## 数据文件格式

每篇文章由两个文件组成（`<slug>` 与元数据中的文件名一致）：

`data/blog/<slug>.json`（元数据）：

```json
{
  "title": "文章标题",
  "slug": "my-post-slug",
  "date": "2026-08-04",
  "tags": ["技术笔记", "Electron"],
  "excerpt": "列表页显示的摘要",
  "thumbnail": "../../Resources/images/blog/thumbnails/xxx.jpg",
  "hero": "../../Resources/images/blog/hero/xxx.jpg",
  "fallbackIcon": "🌲"
}
```

`data/blog/posts/<slug>.html`（正文）：HTML 片段，直接写 `<p>`、`<h2>`、`<pre><code>` 等即可，**不要写 `<html>` 外壳**。

项目文件结构相同，额外支持 `desc / status / statusClass / year` 字段。

> 封面图路径下暂时没有图片时，页面会自动用 `fallbackIcon` 的 emoji 占位，图片放进去即可显示。
> 列表卡片会自动尝试加载路径旁的同名 `@thumb.jpg` 压缩图（仅当该图存在时使用），没有则用原图，不改变元数据里填写的路径。

## 首页动态展示

首页的「精选 / 最近更新 / 热门内容」由 `JS/home-feed.js` 读取数据后渲染，不需要手动改 HTML：

- **精选**（固定顺序）：`data/meta/home.json` 的 `featured` 数组，按 `{ "type": "project" | "blog", "slug": "…", "badge": "…" }` 配置，顺序即展示顺序；条目被删除后会自动跳过。
- **最近更新**（自动）：`data/blog/index.json` 与 `data/project/index.json` 合并后按日期倒序。
- **热门内容**：按「阅读量 ×10 + 编辑权重 ×100 + 新鲜度」排序。`hotWeights` 是手动维护的 0~1 权重；如果以后接入统计，只需生成 `data/meta/stats.json`（`{ "slug": 阅读量 }`），无需改代码。
- 区块标题可在 `data/meta/home.json` 的 `sections` 中修改；数据加载失败时页面会自动隐藏这些区块，不影响其余内容。

## 页头与导航

- 页头由 `JS/layout.js` 统一注入，各页面只需保留 `<div id="header-placeholder"></div>`。
- 采用 `position: fixed` + 等高占位，滚动时变紧凑；向下滚动自动收起，向上滚动立即显示。
- 桌面端为单行布局；≤760px 切换为抽屉导航，支持点击外部 / `Esc` / 选择链接后关闭，并同步 `aria-expanded`。
- 锚点跳转与标题定位通过 `scroll-padding-top` / `scroll-margin-top` 避开固定页头。
- 提供「跳到主要内容」skip link、`:focus-visible` 焦点样式与「回到顶部」按钮。

## 站内搜索

- 入口：导航栏「🔍 搜索」、首页「更多」卡片，以及页脚的「搜索」链接。
- 页面：`SpecialPages/Search/index.html`，纯前端实现，读取 `data/search-index.json`，不依赖任何后端。
- 排序按「标题命中 > 标签命中 > 摘要命中」，同分时按日期倒序；按 `/` 可快速聚焦搜索框，关键词会同步到 URL 的 `?q=`，可直接分享。
- 新增内容后运行 `npm run build` 即可出现在搜索结果里。

## RSS 订阅

- `feed.xml` 由构建脚本生成，包含最近 30 篇博客文章（标题、链接、日期、摘要、标签）。
- 首页与博客列表页的 `<head>` 中带 `application/rss+xml` 发现标签，页脚也有「RSS」入口。

## 可选动态功能（评论 / 点赞 / 阅读量）

默认关闭，站点保持纯静态。配置集中在 `data/meta/dynamic.json`：

```json
{
  "giscus": { "enabled": false, "repo": "…", "repoId": "", "category": "Comments", "categoryId": "" },
  "stats": { "enabled": false, "apiBase": "https://api.example.com" }
}
```

- **评论（giscus）**：需要仓库启用 Discussions 并安装 giscus App，把 `repoId` / `categoryId` 填进配置后把 `enabled` 改为 `true`。评论按内容 key（`blog:<slug>`）映射到 Discussions。
- **点赞 / 阅读量**：后端在 `worker/`，Cloudflare Workers + D1，部署步骤见 `worker/README.md`。前端用 `localStorage` 做「今天已读」「已点赞」去重，计数接口失败时整块统计自动隐藏，不影响正文。
- 两项功能任一未启用或加载失败，页面都不会出现空白占位，也不会阻塞正文渲染。

## 域名与子域名

- 主站（本站）使用 apex 域名 `grapeleafi.top`，`www.grapeleafi.top` 建议在 DNS / GitHub Pages 中 301 到 apex，避免重复收录。
- 域名只在 `site.config.json` 里改，然后运行 `npm run set-domain`：它会同步 `CNAME`、所有 HTML 里的 `canonical` / `og:url` / JSON-LD，以及 `robots.txt`；接着 `npm run build` 重建 `sitemap.xml` 与 `feed.xml`。
- 姊妹项目 **GrapeLeafi** 独立部署在子域名 `leafi.grapeleafi.top`（独立仓库、独立 `CNAME`），与主站互不影响；主站只在内容中链接过去，不共享构建。

## 发布

### 方式一：rsync 上传到自己的服务器

新建 `scripts/deploy.config.json`：

```json
{ "method": "rsync", "target": "user@你的服务器:/var/www/vineturtle" }
```

然后 `npm run deploy`。默认会排除 `.git/`、`node_modules/`、`admin/` 等不该上线的目录。

### 方式二：Git 仓库托管（GitHub Pages / Netlify / Vercel 等）

```bash
git init
git remote add origin <你的仓库地址>
git add -A && git commit -m "init"
git push
```

之后每次更新只需 `npm run deploy`（会自动 commit + push，托管平台检测到更新即自动发布）。

## SEO 与分享

- `npm run build` 生成 `sitemap.xml`（固定页面 + 每篇内容的静态详情页，`lastmod` 取内容日期）、`feed.xml` 和 `data/search-index.json`。
- `robots.txt` 指向站点地图，并排除 `/admin/`。
- 列表页与固定页带 `canonical`、Open Graph 与 Twitter 卡片标签。
- 静态详情页在构建时就把独立 `title`、`description`、`og:image`、`article:published_time`、`BlogPosting` / `CreativeWork` 与 `BreadcrumbList` 结构化数据写进 HTML，无需 JS 也能被完整抓取。
- 分享封面默认是 `Resources/images/og-cover.png`（1200×630），有头图的内容会优先使用自己的头图。
- `404.html` 为独立样式页，GitHub Pages 对未知路径会自动返回它。
- 隐私策略已升级为站点级（`privacy/privacy.html`），同时覆盖站点、可选互动功能与桌面应用。

## 注意事项

- `data/*/index.json`、`data/search-index.json`、`sitemap.xml`、`feed.xml` 与 `SpecialPages/<分类>/<slug>.html` 都是自动生成的，请勿手动编辑；改了元数据/正文后运行 `npm run build` 或通过后台保存。
- `admin/` 是只在本机运行的便携式内容管理器（`npm run admin`），已加入 `.gitignore`、不再纳入版本库，所以不会被推送到 GitHub Pages；换电脑时手动把该目录拷走即可。注意它在早期提交里曾公开过，如需彻底抹除要重写 git 历史。
- 仓库已初始化并绑定 `VineTurtle/VineTurtle.github.io`，自定义域名为 `grapeleafi.top`（见 `CNAME`），推送到 `main` 后由 GitHub Pages 自动发布。
- `.github/workflows/build-check.yml` 会在 push / PR 时执行 `npm run build` 并检查产物是否已提交，防止忘记重建生成文件。
- 首页「更多」区保留 `<!-- more-nav-anchor -->` 注释作为新增分类卡片的插入锚点，删除会导致后台「新增分类」报错。
