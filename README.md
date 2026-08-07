# 藤栖龟舍 · VineTurtle Studio

以森林自然美学为核心的创意工作室网站。纯静态站点，无框架，内容以文件形式存放在 `data/` 目录中。

## 目录结构

```
├── index.html                  # 首页（SPA）
├── CSS/                        # 全局样式（layout.css / style.css / special/）
├── JS/                         # 全局脚本（layout.js / script.js / special-*.js）
├── SpecialPages/               # 博客 / 项目 / 画廊子页面
│   ├── Blog/                   #   博客列表 + 文章详情
│   ├── Project/                #   项目列表 + 项目详情
│   └── Gallery/                #   画廊（占位）
├── data/                       # 内容数据（见下文「数据文件格式」）
│   ├── blog/
│   │   ├── index.json          #   博客索引（自动生成，勿手改）
│   │   ├── <slug>.json         #   每篇文章的元数据
│   │   └── posts/<slug>.html   #   每篇文章的正文
│   └── project/                #   项目，结构同 blog
├── admin/                      # 本地管理后台（只在本机使用，不上线）
└── scripts/                    # 生成索引 / 管理后台 / 部署脚本
```

## 快速开始

```bash
# 1. 本地预览（纯静态）
npm run dev          # 打开 http://localhost:8000

# 2. 本地管理后台（增删文章/项目，写正文）
npm run admin
#    终端会打印管理地址：http://127.0.0.1:3000/admin?token=xxxx
#    该地址只在本次启动有效，且仅本机可访问

# 3. 手动改数据后重建索引
npm run generate

# 4. 发布网站
npm run deploy       # rsync 到服务器，或 git push 由托管平台自动发布
```

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

## 注意事项

- `data/*/index.json` 是自动生成的，请勿手动编辑；改了元数据/正文后运行 `npm run generate` 或通过后台保存。
- `admin/` 目录只用于本地管理，rsync 部署时会自动排除。
- 本项目当前未初始化 Git 仓库，若需 Git 方式发布请先 `git init`。
