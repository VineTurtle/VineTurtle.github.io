# 藤栖龟舍官网 · 多语言（i18n）实施方案

> 本方案是实施的唯一依据。执行前必须先通读「风险清单」，任何与风险清单冲突的做法以风险清单为准。
> 项目根目录：`C:\VineTurtleStudio\VineTurtleStudio\`（纯静态站，GitHub Pages，域名 grapeleafi.top）。

## 0. 已确认的决策（用户拍板）

| 项目 | 决定 |
|---|---|
| 首批语言 | 简体中文（根路径，基线）+ 繁体中文 `zh-TW` + 英文 `en` + 日文 `ja` |
| 后续语言 | 韩 / 俄 / 越等待定；架构须数据驱动，加语言 = 加字典 + 重新构建，不改代码 |
| 翻译范围 | 先翻译界面文案；正文暂不译，缺译回退简中 |
| URL 结构 | 目录前缀：`/en/`、`/ja/`、`/zh-TW/`；简中留在根 `/` |
| 繁体方案 | OpenCC 从简中自动转换 + 术语人工校对 |
| 英/日方案 | AI 初稿 + 人工校对 |

## 1. 核心架构原则

**让「根」跟着语言走，而不是跟着域名走。** 每个语言目录是一份完整镜像，包含 `index.html`、`JS/`、`CSS/`、`Resources/`、`SpecialPages/`、`data/`。因为脚本从 `/en/JS/layout.js` 加载，`getPathPrefix()` 反推出的根就是 `/en/`，于是导航、logo、页脚、搜索链接自动留在语言目录内，无需逐条改链接。首页 hash（`#page-home`）是纯片段，天然只作用于当前文档，镜像后照常工作。

## 2. 现状（代码事实）

- 内容模型：每篇 = `data/<分类>/<slug>.json`（元数据）+ `data/<分类>/posts/<slug>.html`（正文）。
- `scripts/generate-data.js`：汇总 `index.json`，生成 `sitemap.xml`、`feed.xml`、`data/search-index.json`。
- `scripts/generate-pages.js`：把正文生成到 `SpecialPages/<Page>/<slug>.html`，模板里写死大量中文。
- `scripts/kinds.json`：分类配置（posts→Blog/blog，projects→Project/project）。
- `JS/layout.js`：公共头部/底部/移动导航/搜索弹层/SPA/无障碍标签；`getPathPrefix()` 靠脚本 src 反推根路径。
- 界面中文散落在约 20 个文件：`layout.js`、`index.html`、各 `*-list.js`/`*-detail.js`、`404.html`、`privacy/privacy.html`、`data/meta/home.json`（sections 与 badge）、`scripts/kinds.json`（label/navDesc）、`site.config.json`（siteName/shortName）。

## 3. 目标目录结构

```
i18n/                      # 新建：界面文案字典
  zh-CN.json  zh-TW.json  en.json  ja.json
data/
  blog/*.json + posts/*.html        # 正文单一来源（简中），不复制
  i18n/<lang>/*.json                # 可选：按语言覆盖 title/excerpt（P2）
/                          # 简中（现有文件，保持不动）
/en/  /ja/  /zh-TW/        # 构建产物：每语言一份完整镜像
```

## 4. 分层方案

| 层 | 做法 | 落地文件 |
|---|---|---|
| 字典 | 每语言一份 JSON，key→译文；缺 key 回退简中 | 新建 `i18n/` |
| 动态文案 | `t(key)` 按 `VTS.lang` 取值，替换导航/页脚/搜索弹层/`document.title` | `layout.js`、各 `*-list/detail.js` |
| 静态文案 | 生成详情页时把译文写死进 HTML（无首屏闪烁、利 SEO） | `generate-pages.js` |
| 语言状态 | URL 首段决定 `VTS.lang`/`VTS.base`；选择记忆到 localStorage，但 **URL 优先** | 新增 `JS/i18n.js` |
| 切换器 | 只换语言段，保留相对路径与 hash（见 §5） | `layout.js` header |
| 正文 | 单一来源简中，按语言生成镜像；缺译回退简中 | `generate-pages.js` |
| SEO | `<html lang>` + `hreflang` 互指 + `og:locale` + 分语言 sitemap/feed + canonical 自指 | 两个生成脚本 |
| 后台 | 编辑器加语言维度 | `admin/editor.js`（P2） |

## 5. 关键机制

1. **同页换壳**：切换器读当前 `pathname` 与 `hash`，只替换首段语言码，其余原样拼接。
   `/en/SpecialPages/Blog/a.html#sec` → `/ja/SpecialPages/Blog/a.html#sec`。
2. **正文回退**：某语言 `<slug>` 的元数据/正文缺失时，生成器自动取简中对应内容，页面不缺块、不断链。
3. **资源根路径**：镜像目录内所有内部跳转统一 `VTS.base + 相对路径`，杜绝散落的硬编码根路径。
4. **繁体生成**：OpenCC 批量转换字典与已译文案；代码标识符、 slug、标签中的专有名词不转。

## 6. 分期实施

- **P0（本次执行目标）**：建 `i18n/` 字典；抽离界面文案（导航/页脚/搜索/`document.title`）；加语言切换器与 `VTS.base`；简中/繁中/英/日可在同一页面切换。不碰内容、不碰生成脚本。
- **P1**：改造两个生成脚本，产出四语镜像目录、正文回退、SEO 标签；验证路径推断与 hash 路由。
- **P2**：后台加语言维度；按需逐篇翻译正文（走 `data/i18n/<lang>/` 覆盖）。

## 7. 风险清单（全部风险点，实施时必须逐条规避）

### A. 路径与导航

- **R1 · getPathPrefix 失效**：`getPathPrefix()` 靠脚本 src 反推根。若语言目录的页面仍从根 `/JS/layout.js` 加载脚本，会算出错误前缀，导致资源 404、导航跳出语言目录。**语言目录必须有自己的 JS/CSS 副本**；P1 第一步就验证 `/en/SpecialPages/Blog/xxx.html` 算出的 `pathPrefix` 是否为 `../../`。
- **R2 · 导航掉回简中**：`layout.js` 的 `indexUrl`、`pathPrefix` 拼接了 logo、导航、页脚、搜索、RSS、隐私链接。镜像后这些相对路径必须落在当前语言目录内，否则一点导航就回简中。
- **R3 · 首页 hash 路由**：`/en/index.html` 必须是完整独立副本，`#page-home` 等锚点和四个 `.page-section` 都要在；否则 `switchPage()` 找不到目标、`hashchange` 失效。
- **R4 · 搜索结果跳出语言目录**：`data/search-index.json` 的 `url` 是相对路径（`SpecialPages/...`）。镜像后需按语言生成对应索引，否则搜索点开落到简中页。
- **R5 · 语言切换丢 hash**：切换器必须保留 `location.hash` 与相对路径，只换语言段；否则用户停在文章某节/首页某区时一切语言就被打回首页。
- **R6 · localStorage 与 URL 冲突**：若允许 localStorage 覆盖 URL 语言，分享链接/搜索引擎抓取会错乱。**URL 优先**，localStorage 仅用于首次访问无语言前缀时的默认选择。

### B. 内容与 SEO

- **R7 · 静态模板写死中文**：`generate-pages.js` 里 backLabel、上一篇/下一篇、相关阅读、相关项目、面包屑「首页」、JSON-LD 的 name、`日期待定`、`约 N 分钟`、进行中/待定、`正文正在生长中`、noscript 提示全为中文，必须走字典。
- **R8 · 日期/时长本地化**：`formatDate()` 写死「YYYY年M月D日」，阅读时长写死「约 N 分钟」，需按语言格式化。
- **R9 · RSS/站点地图**：`feed.xml` 的 channel 标题/描述写死中文且 `<language>zh-CN</language>` 固定；`sitemap.xml` 需包含各语言 URL。
- **R10 · canonical / hreflang / og:locale**：镜像页 canonical 必须自指各自语言 URL；需加 `hreflang` 互指与 `x-default`；`og:locale`（zh_CN/zh_TW/en_US/ja_JP）目前可能缺失，需补。
- **R11 · 重复内容惩罚**：多份镜像若 canonical 都指向简中或被判重复， SEO 受损。每语言必须自指 canonical + hreflang 成对出现。
- **R12 · 缺译断链**：某语言缺某篇时不能生成空页/死链，必须回退简中内容并正确标注 lang。
- **R13 · 图片 alt**：alt 取自 `item.title`，标题翻译后 alt 要对应，否则无障碍与 SEO 降级。
- **R14 · 独立页面**：`404.html`、`privacy/privacy.html` 是独立中文页，需各语言版本，否则从英文页点进去掉回中文。

### C. 构建与数据

- **R15 · 字典一致性**：同一 key 在四种语言都要有；缺 key 必须回退简中，不能渲染成空白或 key 本身。
- **R16 · 前后端共享字典**：生成脚本是 Node CommonJS，浏览器要读同一份字典。用纯 JSON：Node 用 `require`/读文件，浏览器用 fetch 或构建时内联，避免两套数据源漂移。
- **R17 · 数据文件里的中文**：`data/meta/home.json`（精选/最近/热门、badge）、`scripts/kinds.json`（label/navDesc）、`site.config.json`（siteName/shortName）含中文，若不本地化，首页动态区块与分类标签仍是中文。
- **R18 · 后台写入维度**：`admin/editor.js` 若不加语言选择，新内容只能写进默认语言，多语言不可持续（P2 必须做）。
- **R19 · 资源镜像完整性**：语言目录须复制 JS/CSS/Resources/data/SpecialPages；漏复制任一资源即 404。建议写进构建脚本自动复制，不手工维护。
- **R20 · 大小写敏感**：GitHub Pages 大小写敏感（本项目曾踩坑）。新目录/文件名统一小写，slug 保持原样。
- **R21 · 仓库体积**：每语言一份镜像会增大体积；注意 GitHub Pages 单文件 100MB、仓库 1GB 限制，预览大图 `_preview-*.png` 不要重复复制。

### D. 运行与质量

- **R22 · 无障碍文案**：`aria-label`、`title` 属性（打开菜单/切换主题/查看大图/关闭/在新标签页打开/搜索站内内容等）全为中文，需一并翻译，否则屏幕阅读器读中文。
- **R23 · 搜索弹层文案**：`layout.js` 的 placeholder、加载中/空结果/加载失败提示、底部快捷键说明共约 10 处中文需翻译。
- **R24 · SPA 标题表**：`initSPA()` 的 `titles`（首页/关于/作品/更多）写死中文，需按语言取值。
- **R25 · 排版溢出**：英/日/俄等文本长度与断词规则和中文不同（俄语有长词），CSS 需检查换行与溢出；这些语言均为 LTR，`dir` 无需改，但加 RTL 语言时要处理。
- **R26 · 简中基线不可破坏**：所有改动不得改变根路径简体中文站的现有行为；建议先备份或在改动前确认可回滚。
- **R27 · 繁体转换质量**：OpenCC 对技术术语、代码标识符、产品名可能误转，转换后需人工校对；勿转 slug、文件名、代码。
- **R28 · 生成/部署联动**：改完文案后须运行 `npm run build`（= generate-data + generate-pages）重新生成镜像与索引；只改字典不重建不会生效。
- **R29 · giscus 评论**：若日后启用 giscus，其语言/主题配置需按语言设置（`data/meta/dynamic.json`）。
- **R30 · 执行模型能力限制**：本次用免费 deepseek 模型执行，上下文与工具调用能力有限；应小步提交、逐步验证，每步完成后核对文件，避免一次性大改写导致不可控。

## 8. 验收标准（P0）

- [ ] 页面右上角有语言切换器，简中/繁中/英/日可互相切换。
- [ ] 切换后导航、页脚、搜索弹层、按钮、aria-label、页面标题均为目标语言。
- [ ] 在文章页/首页某 section 切换语言，停留位置（hash）不丢失。
- [ ] 简中根路径原有行为完全不变。
- [ ] 缺 key 时回退简中，无空白。
- [ ] 未运行 `npm run build` 前，内容页正文仍为简中（符合「正文回退」策略）。

## 9. 本次执行指令（供 OpenCode 使用）

- 工作目录：`C:\VineTurtleStudio\VineTurtleStudio\`
- 范围：实施 **P0**，动手前通读本文件「风险清单」，遵守与 P0 相关的 R1/R2/R3/R5/R6/R15/R16/R17/R22/R23/R24/R26/R27/R28/R30。
- 要求：小步实施、每步核对；完成后列出改动文件清单与验收自查结果；不要提交 git。
