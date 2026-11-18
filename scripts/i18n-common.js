// scripts/i18n-common.js —— 构建期多语言公共模块
// 职责：读取 i18n/*.json 纯 JSON 字典（与浏览器端共享同一数据源，R16），
//       提供缺 key 回退简中（R15）、语言目录映射、SEO 标签生成、镜像资源复制。
// 本模块被 generate-data.js / generate-pages.js / mirror-site.js 共用。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const I18N_DIR = path.join(ROOT, 'i18n');

const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja'];
const DEFAULT_LANG = 'zh-CN';
// 各语言对应的目录前缀；简中留在根路径
const PREFIX = {
    'zh-CN': '',
    'zh-TW': 'zh-TW',
    'en': 'en',
    'ja': 'ja'
};
// og:locale 取值（R10）
const OG_LOCALE = {
    'zh-CN': 'zh_CN',
    'zh-TW': 'zh_TW',
    'en': 'en_US',
    'ja': 'ja_JP'
};
// feed 的 <language>（R9）
const FEED_LANG = {
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    'en': 'en-US',
    'ja': 'ja'
};

const dictCache = {};
function loadDict(lang) {
    if (dictCache[lang]) return dictCache[lang];
    let dict = {};
    try {
        dict = JSON.parse(fs.readFileSync(path.join(I18N_DIR, lang + '.json'), 'utf-8'));
    } catch (e) {
        // 缺字典文件时回退空对象，最终由 t() 回退简中
    }
    dictCache[lang] = dict;
    return dict;
}

// t(lang, key, vars) —— 缺 key / 缺译文一律回退简中，绝不渲染 key 本身或空白
function t(lang, key, vars) {
    let value = loadDict(lang)[key];
    if (value == null || value === '') value = loadDict(DEFAULT_LANG)[key];
    if (value == null || value === '') return '';
    if (vars) {
        return String(value).replace(/\{(\w+)\}/g, function (m, k) {
            return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
        });
    }
    return String(value);
}

// 语言目录在磁盘上的绝对路径；简中返回 ROOT
function langRoot(lang) {
    const p = PREFIX[lang];
    return p ? path.join(ROOT, p) : ROOT;
}

// 站点 URL 前缀（如 https://grapeleafi.top/en）
function urlPrefix(siteUrl, lang) {
    const p = PREFIX[lang];
    return p ? siteUrl + '/' + p : siteUrl;
}

// 生成 hreflang 互指 + x-default 标签（R10/R11）
// relPath 为相对站点根的路径（如 'SpecialPages/Blog/x.html' 或 ''）
function hreflangTags(siteUrl, relPath) {
    const suffix = relPath ? '/' + relPath.replace(/^\/+/, '') : '/';
    const rows = LANGS.map(function (lang) {
        const href = urlPrefix(siteUrl, lang) + suffix;
        return '    <link rel="alternate" hreflang="' + lang + '" href="' + href + '" />';
    });
    rows.push('    <link rel="alternate" hreflang="x-default" href="' + siteUrl + suffix + '" />');
    return rows.join('\n');
}

// 递归复制目录（镜像资源，R19）；skip 为相对 ROOT 的正则数组
function copyDir(src, dest, skip) {
    if (!fs.existsSync(src)) return 0;
    let count = 0;
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
        const srcPath = path.join(src, name);
        const destPath = path.join(dest, name);
        const stat = fs.statSync(srcPath);
        const rel = path.relative(ROOT, srcPath).replace(/\\/g, '/');
        const shouldSkip = skip && skip.some(function (re) { return re.test(rel) || re.test(name); });
        if (shouldSkip) continue;
        if (stat.isDirectory()) {
            count += copyDir(srcPath, destPath, skip);
        } else if (stat.isFile()) {
            fs.copyFileSync(srcPath, destPath);
            count++;
        }
    }
    return count;
}

// ---------- 按语言覆盖正文/元数据（P2） ----------
// 目录约定：data/i18n/<lang>/<分类目录>/<slug>.json —— 元数据覆盖（title/excerpt/desc/tags）
//           data/i18n/<lang>/<分类目录>/<slug>.html —— 正文覆盖
// 文件不存在即回退简中（R12），不生成空页、不断链。
const CONTENT_I18N_DIR = path.join(ROOT, 'data', 'i18n');

function contentOverridePath(lang, sub, slug, ext) {
    return path.join(CONTENT_I18N_DIR, lang, sub, slug + ext);
}

function loadContentMeta(lang, sub, slug) {
    if (lang === DEFAULT_LANG || !slug) return null;
    const file = contentOverridePath(lang, sub, slug, '.json');
    try {
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
        return null;
    }
}

function loadContentBody(lang, sub, slug) {
    if (lang === DEFAULT_LANG || !slug) return null;
    const file = contentOverridePath(lang, sub, slug, '.html');
    if (!fs.existsSync(file)) return null;
    try {
        return fs.readFileSync(file, 'utf-8');
    } catch (e) {
        return null;
    }
}

module.exports = {
    ROOT, LANGS, DEFAULT_LANG, PREFIX, OG_LOCALE, FEED_LANG,
    loadDict, t, langRoot, urlPrefix, hreflangTags, copyDir,
    CONTENT_I18N_DIR, loadContentMeta, loadContentBody
};
