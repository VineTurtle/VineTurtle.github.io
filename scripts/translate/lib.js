// scripts/translate/lib.js —— 正文翻译工具链公共模块
// 职责：把正文 HTML 切成顶层块级段（p/h1-h4/ul/table/pre），并给出结构与语言校验工具。
// 设计约定（与 generate-pages.js 的回退规则对齐）：
//   · <pre> 代码块逐字节保留，任何语言都不翻译；
//   · 页首 <h1> 在覆盖文件中丢弃（模板已渲染本地化标题，避免双标题）；
//   · 其余块级元素整块翻译，行内结构（strong/b/code/a/img/li/td）保持不变。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const KINDS = ['blog', 'project'];

// ---------- 块级切分 ----------

// 顶层块开标签：块级元素全集（语料中仅出现这些；li/td/tr 等随父块整体处理）
const BLOCK_RE = /<(pre|p|h[1-4]|ul|table)\b[^>]*>/gi;

// 把正文切成段：{ type, html, action }，action ∈ keep | drop | translate
// gap（块间空白）不进入段列表，但覆盖文件里允许任意空白。
function splitBlocks(html) {
    const blocks = [];
    let pos = 0;
    BLOCK_RE.lastIndex = 0;
    let m;
    while ((m = BLOCK_RE.exec(html)) !== null) {
        const tag = m[1].toLowerCase();
        // 找匹配的闭标签（语料中同名块级标签不嵌套；必须用 /g 才能让 lastIndex 生效）
        const closeRe = new RegExp('</' + tag + '\\s*>', 'gi');
        closeRe.lastIndex = m.index + m[0].length;
        const close = closeRe.exec(html);
        if (!close) throw new Error('未找到闭标签 </' + tag + '>：' + html.slice(m.index, m.index + 80));
        if (close.index + close[0].length <= m.index) {
            throw new Error('块切分错位（闭标签早于开标签）：' + html.slice(m.index, m.index + 80));
        }
        blocks.push({ type: tag, html: html.slice(m.index, close.index + close[0].length) });
        pos = close.index + close[0].length;
    }
    if (!/<(p|h[1-4]|ul|table|pre)\b/i.test(html) && html.trim()) {
        throw new Error('正文不含已知块级标签，分段失败');
    }
    // 动作判定：pre 保留；首块为 h1 时丢弃（与回退逻辑同款去重规则）；其余翻译
    for (let i = 0; i < blocks.length; i++) {
        blocks[i].action = blocks[i].type === 'pre' ? 'keep'
            : (i === 0 && blocks[i].type === 'h1' ? 'drop' : 'translate');
    }
    return blocks;
}

// 覆盖文件与源文件的段序列必须同构：源去掉 drop 段后，类型逐一对应
function blockTypesAligned(srcBlocks, dstBlocks) {
    const expect = srcBlocks.filter(b => b.action !== 'drop').map(b => b.type);
    const actual = dstBlocks.map(b => b.type);
    if (expect.length !== actual.length) return false;
    return expect.every((t, i) => t === actual[i]);
}

// ---------- 行内结构提取（校验用） ----------

// 行内标签名序列（含开/闭），忽略属性——结构必须一一对应。
// li/tr/th/td/table 等随父块出现的结构标签一并校验，防止表格/列表结构漂移
function inlineTagNames(html) {
    const names = [];
    const re = /<(\/?)(strong|b|code|a|img|br|li|tr|th|td|thead|tbody|tfoot|table|ul|ol)\b[^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) names.push((m[1] ? '/' : '') + m[2].toLowerCase());
    return names;
}

// 行内代码段全文（逐字节必须一致）
function codeSpans(html) {
    const spans = [];
    const re = /<code\b[^>]*>[\s\S]*?<\/code>/gi;
    let m;
    while ((m = re.exec(html)) !== null) spans.push(m[0]);
    return spans;
}

// 链接目标（href 一致性）
function hrefs(html) {
    const out = [];
    const re = /href="([^"]*)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) out.push(m[1]);
    return out;
}

// 图片 src（alt 允许按语言本地化——R13；src 必须一致）
function imgSrcs(html) {
    const out = [];
    const re = /<img\b[^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const src = /src="([^"]*)"/i.exec(m[0]);
        out.push(src ? src[1] : m[0]);
    }
    return out;
}

// ---------- 语言字符校验 ----------

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

// 简体特有字判定：单字经简→繁映射后改变，即视为简体字形（供 ja/zh-TW 校验）
// conv 由调用方注入（opencc cn→t 的单字转换器），避免本模块强依赖 opencc-js
function findSimplifiedChars(text, conv, allowSet) {
    const seen = new Set();
    for (const ch of text) {
        if (!CJK_RE.test(ch)) continue;
        if (allowSet && allowSet.has(ch)) continue;
        if (seen.has(ch)) continue;
        const mapped = conv(ch);
        if (mapped !== ch) seen.add(ch);
    }
    return [...seen];
}

// ---------- 语料清单 ----------

// 汇总全部正文：[{ kind, slug, srcPath, relKey }]
function listBodies() {
    const out = [];
    for (const kind of KINDS) {
        const dir = path.join(ROOT, 'data', kind, 'posts');
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            if (!name.endsWith('.html')) continue;
            const slug = name.slice(0, -5);
            out.push({
                kind: kind,
                slug: slug,
                srcPath: path.join(dir, name),
                relKey: kind + '/' + slug
            });
        }
    }
    return out.sort((a, b) => a.relKey.localeCompare(b.relKey));
}

module.exports = {
    ROOT: ROOT,
    KINDS: KINDS,
    CJK_RE: CJK_RE,
    splitBlocks: splitBlocks,
    blockTypesAligned: blockTypesAligned,
    inlineTagNames: inlineTagNames,
    codeSpans: codeSpans,
    hrefs: hrefs,
    imgSrcs: imgSrcs,
    findSimplifiedChars: findSimplifiedChars,
    listBodies: listBodies
};
