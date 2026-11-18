# 交接文档 · 2026-11-19 正文翻译会话结束

> 用途:重开新会话时把本文件发给新会话(或让它先读本文件),即可无损接续。
> 项目:藤栖龟舍官网 `C:\VineTurtleStudio\VineTurtleStudio`(纯静态,GitHub Pages,grapeleafi.top)。

## 一、上次会话完成了什么(已全部验证通过)

1. **正文翻译全量完成并封存**:11 篇(项目 5 + 博客 6)× zh-TW/en/ja = 33 份正文覆盖 + 元数据覆盖,位于 `data/i18n/<lang>/<分类>/`。en/ja 为人工 AI 分段翻译,zh-TW 为 OpenCC(c→twp)+ 人工校对。**用户决定:后续正文翻译暂停投入**,新文章缺译走回退机制(详情页回落简中并正确标注 lang),`npm run i18n:status` 可查缺口。
2. **翻译工具链**(`scripts/translate/`,npm 前缀 `i18n:*`):extract / zh-tw / verify / audit-mirrors / status。校验不变量:块级结构同构、`<pre>` 与行内 `<code>` 逐字节不动(代码注释保持简中是**预期行为**)、行内代码 span 顺序也与源文一致、en 零汉字、ja/zh-TW 无简体特有字形(豁免集在 verify.js / audit-mirrors.js 顶部)。
3. **隐私页字典化**:`privacy/privacy.html` 全文挂 `privacy.*` 键(74 键 × 4 语,简中值=源文原文),富文本段拆成 `strong 标签 + span 正文` 纯文本节点;`generate-pages.js` 已移除 `main lang="zh-CN"` 注入。
4. **顺手修复**:ja 字典「藤栖→藤棲」笔误(2 处);`generate-data.js` 列表索引合并字段补 `status`;CI `build-check.yml` 补 `npm install`(opencc-js 成为构建依赖);镜像复制 skip 列表补 `data/i18n-work`;月份徽章静态文本改语言中立 `🌿`(JS 运行时按字典填充)。
5. **README** 新增「多语言(i18n)」一节,记录四语机制与翻译流程命令。

## 二、⚠️ 当前工作区状态(新会话第一件事)

- **142 个文件已修改未提交**(107 改 + 35 新),包括全部翻译产物、工具链、生成镜像、CI 修改。
- 验证状态:`i18n:verify` 33/33 通过;`audit-mirrors` 三语镜像干净;`npm run build` 生成 44 个详情页正常。
- **建议新会话开头先与用户确认提交**:`git add -A && git commit && git push`(推送后 GitHub Pages 自动部署四语完整版;CI 已加 npm install,可通过)。
- 术语基准:en 站名 "Vine Turtle Nest"、ja "藤棲亀舎"、zh-TW "藤棲龜舍";状态词 🚧 In progress / 継続開発中 / 🚧 迭代中。

## 三、下一步候选方案(见会话方案,编号一致)

A1 CI 加 i18n 校验 · A2 链接预取 · A3 代码块复制按钮 · A4 阅读进度条 · A5 图片 lazy/srcset · A6 日英排版断词收尾
B1 giscus 评论接入 · B2 点赞/阅读量 worker 部署 · B3 admin 后台多语言维度 · B4 归档页 · B5 搜索高亮/分页 · B6 PWA 离线
C1 构建期 minify · C2 死链检查 · C3 Lighthouse CI · C4 无障碍审计

## 四、关键文件索引

- 生成脚本:`scripts/generate-data.js`(索引/sitemap/feed/搜索)、`scripts/generate-pages.js`(详情页+四语镜像)、`scripts/i18n-common.js`(构建期多语言公共模块)
- 运行时:`JS/i18n.js`(t()/切换器)、`JS/layout.js`(页头页脚)、`JS/script.js`(月份徽章)
- 字典:`i18n/<lang>.json`(界面+隐私页);内容覆盖:`data/i18n/<lang>/`;正文单一来源:`data/<分类>/posts/`
- 约束:简中根路径行为不可破坏(I18N_PLAN.md R26);构建产物需提交(CI diff 检查);`data/i18n-work/` 已 gitignore
- 历史方案文档:`I18N_PLAN.md`(P0-P2 风险清单 R1-R30 仍有效)
