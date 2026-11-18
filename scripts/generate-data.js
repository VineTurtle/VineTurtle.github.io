// scripts/generate-data.js
// 扫描 data/ 下各内容分类目录，自动生成各分类的 index.json。
// 分类配置统一来自 scripts/kinds.json（管理后台可增删分类并同步此文件）。
// 每篇内容由两部分组成：
//   data/<分类>/<name>.json        —— 元数据（title/date/tags/...）
//   data/<分类>/posts/<name>.html  —— 正文 HTML
// 本脚本只负责汇总元数据，不生成正文。
// P1：额外按语言生成 sitemap / feed / 搜索索引，输出到各语言镜像目录；
//     正文与元数据仍以简中为单一来源（P2 才逐篇翻译），缺译回退简中。
const fs = require('fs');
const path = require('path');
const { loadSiteConfig, absoluteUrl } = require('./site-config');
const I18N = require('./i18n-common');

const ROOT = path.join(__dirname, '..');
const KINDS_FILE = path.join(__dirname, 'kinds.json');
const SITE = loadSiteConfig();

// ---------- 分类配置 ----------

function loadKinds() {
    try {
        return JSON.parse(fs.readFileSync(KINDS_FILE, 'utf-8'));
    } catch (e) {
        console.error('⚠️ 读取分类配置失败（' + KINDS_FILE + '）：' + e.message);
        return {};
    }
}

// ---------- 工具 ----------

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json') && f !== 'index.json')
        .sort();
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// 从文件名推断数字 id：仅纯数字文件名（如 "3.json" -> 3），失败返回 null。
function idFromFilename(name) {
    const base = name.replace(/\.json$/, '');
    if (!/^\d+$/.test(base)) return null;
    return parseInt(base, 10);
}

function dateKey(item) {
    return item.date || '';
}

function sortByDateDesc(a, b) {
    const da = dateKey(a), db = dateKey(b);
    if (da !== db) return da < db ? 1 : -1;
    return (a.id || 0) - (b.id || 0);
}

// 列表/卡片优先使用 Resources/images/<分类>/thumbnails/ 下的压缩图。
function preferThumbnail(url) {
    if (!url) return url;
    const value = String(url);
    const match = value.match(/^(.*\/)hero\/([^/]+)$/i);
    if (!match) return url;
    const candidate = match[1] + 'thumbnails/' + match[2];
    const rel = candidate.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '').replace(/^\//, '');
    return fs.existsSync(path.join(ROOT, rel)) ? candidate : url;
}

// ---------- 通用生成逻辑 ----------

function buildIndex(dir, indexName) {
    const files = listJsonFiles(dir);
    const items = files.map(name => {
        const item = readJson(path.join(dir, name));
        const base = name.replace(/\.json$/, '');
        const id = item.id != null ? item.id : idFromFilename(name);
        const slug = item.slug || base;
        return { ...item, id, slug };
    }).filter(x => x.title);

    const sorted = items.slice().sort(sortByDateDesc);
    const used = new Set(sorted.map(x => x.id).filter(n => typeof n === 'number'));
    let next = 1;
    sorted.forEach(item => {
        if (item.id == null) {
            while (used.has(next)) next++;
            item.id = next;
            used.add(next);
        }
    });

    const index = sorted.map(({ id, slug, title, date, tags, excerpt, thumbnail, hero, fallbackIcon, status, statusClass, year, desc }) => ({
        id,
        ...(slug ? { slug } : {}),
        title,
        ...(date ? { date } : {}),
        ...(Array.isArray(tags) && tags.length ? { tags } : { tags: [] }),
        ...(excerpt ? { excerpt } : {}),
        ...(thumbnail ? { thumbnail: preferThumbnail(thumbnail) } : {}),
        ...(hero ? { hero } : {}),
        ...(fallbackIcon ? { fallbackIcon } : {}),
        ...(status ? { status } : {}),
        ...(statusClass ? { statusClass } : {}),
        ...(year ? { year } : {}),
        ...(desc ? { desc } : {})
    }));

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, indexName), JSON.stringify(index, null, 2) + '\n');
    return index.length;
}

// ---------- 站点地图 / RSS / 搜索索引（按语言） ----------

const SITE_URL = SITE.siteUrl;

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function todayLocal() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// 画廊数据：简中 data/gallery.json 为唯一来源，其他语言按 data/i18n/<lang>/gallery.json 覆盖标题与说明
function buildGallery(lang) {
    const srcFile = path.join(ROOT, 'data', 'gallery.json');
    if (!fs.existsSync(srcFile) || lang === I18N.DEFAULT_LANG) return 0;
    const base = JSON.parse(fs.readFileSync(srcFile, 'utf-8'));
    const ovFile = path.join(ROOT, 'data', 'i18n', lang, 'gallery.json');
    let overrides = {};
    if (fs.existsSync(ovFile)) {
        try { overrides = JSON.parse(fs.readFileSync(ovFile, 'utf-8')).items || {}; } catch (e) { /* 回退简中 */ }
    }
    const items = (base.items || []).map(function (item) {
        const ov = overrides[item.id];
        if (!ov) return item;
        return Object.assign({}, item, {
            title: ov.title || item.title,
            desc: ov.desc || item.desc
        });
    });
    const out = path.join(I18N.langRoot(lang), 'data', 'gallery.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(Object.assign({}, base, { items: items }), null, 2) + '\n');
    return items.length;
}

// 索引文件的落盘位置：简中在源目录，其他语言在镜像目录内（各自一份，R4/R12）
function subDirName(key) {
    return path.basename(kinds[key].dataDir || ('data/' + key));
}

function langIndexFile(lang, key) {
    const sub = subDirName(key);
    return lang === I18N.DEFAULT_LANG
        ? path.join(ROOT, kinds[key].dataDir || ('data/' + key), 'index.json')
        : path.join(I18N.langRoot(lang), 'data', sub, 'index.json');
}

function readIndex(key, lang) {
    const file = langIndexFile(lang || I18N.DEFAULT_LANG, key);
    if (!fs.existsSync(file)) return [];
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
        return [];
    }
}

// 按语言生成一份列表索引：有 data/i18n/<lang>/<分类>/<slug>.json 就覆盖标题与摘要，否则保持简中（R12）
function buildLocalizedIndex(lang, key) {
    const items = readIndex(key, I18N.DEFAULT_LANG);
    if (lang === I18N.DEFAULT_LANG) return items.length;
    const sub = subDirName(key);
    const localized = items.map(function (item) {
        const meta = I18N.loadContentMeta(lang, sub, item.slug);
        if (!meta) return item;
        const patch = {};
        ['title', 'excerpt', 'desc', 'tags'].forEach(function (field) {
            if (meta[field] != null) patch[field] = meta[field];
        });
        return Object.assign({}, item, patch);
    });
    const out = langIndexFile(lang, key);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(localized, null, 2) + '\n');
    return localized.length;
}

function latestContentDate() {
    let latest = '';
    for (const key of Object.keys(kinds)) {
        for (const item of readIndex(key)) {
            if (item.date && item.date > latest) latest = item.date;
        }
    }
    return latest;
}

// 详情页站点内相对路径（不含语言前缀），sitemap 与详情页共用
function detailPath(cfg, slug) {
    return '/SpecialPages/' + cfg.pageName + '/' + encodeURIComponent(slug) + '.html';
}

function detailUrl(lang, cfg, slug) {
    return I18N.urlPrefix(SITE_URL, lang) + detailPath(cfg, slug);
}

// 同一条路径在各语言下的 hreflang 互指（sitemap 内声明，R10/R11）
function alternateLinks(pathPart) {
    const rows = I18N.LANGS.map(function (lang) {
        return '    <xhtml:link rel="alternate" hreflang="' + lang + '" href="'
            + xmlEscape(I18N.urlPrefix(SITE_URL, lang) + pathPart) + '" />';
    });
    rows.push('    <xhtml:link rel="alternate" hreflang="x-default" href="' + xmlEscape(SITE_URL + pathPart) + '" />');
    return rows.join('\n');
}

// 汇总固定页面 + 每个分类下所有内容的静态详情页，输出某语言的 sitemap.xml
// 每条 URL 带 xhtml:link 互指，搜索引擎可据此把四语版本识别为同一页面的语言变体（R9/R10/R11）
function buildSitemap(lang) {
    const today = todayLocal();
    const latest = latestContentDate() || today;
    const base = I18N.urlPrefix(SITE_URL, lang);
    const urls = [
        { path: '/', lastmod: latest, changefreq: 'weekly', priority: '1.0' },
        { path: '/SpecialPages/Blog/index.html', lastmod: latest, changefreq: 'weekly', priority: '0.9' },
        { path: '/SpecialPages/Project/index.html', lastmod: latest, changefreq: 'weekly', priority: '0.9' },
        { path: '/SpecialPages/Gallery/index.html', lastmod: latest, changefreq: 'monthly', priority: '0.8' },
        { path: '/SpecialPages/Search/index.html', lastmod: latest, changefreq: 'monthly', priority: '0.4' },
        { path: '/privacy/privacy.html', lastmod: latest, changefreq: 'yearly', priority: '0.3' }
    ];

    for (const key of Object.keys(kinds)) {
        const cfg = kinds[key];
        for (const item of readIndex(key, lang)) {
            if (!item.slug) continue;
            urls.push({
                path: detailPath(cfg, item.slug),
                lastmod: item.date || today,
                changefreq: 'monthly',
                priority: '0.6'
            });
        }
    }

    const rows = urls.map(u =>
        '  <url>\n'
        + '    <loc>' + xmlEscape(base + u.path) + '</loc>\n'
        + alternateLinks(u.path) + '\n'
        + '    <lastmod>' + u.lastmod + '</lastmod>\n'
        + '    <changefreq>' + u.changefreq + '</changefreq>\n'
        + '    <priority>' + u.priority + '</priority>\n'
        + '  </url>'
    ).join('\n');

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + rows + '\n</urlset>\n';

    const outDir = I18N.langRoot(lang);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml);
    return urls.length;
}

// 根路径 sitemap 索引：一次提交即可让搜索引擎发现四份语言 sitemap（R9）
function buildSitemapIndex() {
    const rows = I18N.LANGS.map(function (lang) {
        return '  <sitemap>\n'
            + '    <loc>' + xmlEscape(I18N.urlPrefix(SITE_URL, lang) + '/sitemap.xml') + '</loc>\n'
            + '    <lastmod>' + todayLocal() + '</lastmod>\n'
            + '  </sitemap>';
    }).join('\n');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + rows + '\n</sitemapindex>\n';
    fs.writeFileSync(path.join(ROOT, 'sitemap-index.xml'), xml);
    return I18N.LANGS.length;
}

function rfc822(date) {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00+08:00');
    return isNaN(d.getTime()) ? '' : d.toUTCString();
}

// 某语言的博客 RSS。channel 标题/描述与 <language> 按语言本地化（R9）。
function buildFeed(lang) {
    const blog = readIndex('posts', lang);
    const latest = latestContentDate() || todayLocal();
    const items = blog.slice(0, 30).map(item => {
        const link = detailUrl(lang, kinds.posts, item.slug);
        const pubDate = rfc822(item.date);
        const categories = (item.tags || []).map(t => '      <category>' + xmlEscape(t) + '</category>').join('\n');
        return '    <item>\n'
            + '      <title>' + xmlEscape(item.title) + '</title>\n'
            + '      <link>' + xmlEscape(link) + '</link>\n'
            + '      <guid isPermaLink="true">' + xmlEscape(link) + '</guid>\n'
            + (pubDate ? '      <pubDate>' + pubDate + '</pubDate>\n' : '')
            + '      <description>' + xmlEscape(item.excerpt || '') + '</description>\n'
            + categories + (categories ? '\n' : '')
            + '    </item>';
    }).join('\n');

    const base = I18N.urlPrefix(SITE_URL, lang);
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        + '  <channel>\n'
        + '    <title>' + xmlEscape(I18N.t(lang, 'feed.title')) + '</title>\n'
        + '    <link>' + base + '/SpecialPages/Blog/index.html</link>\n'
        + '    <description>' + xmlEscape(I18N.t(lang, 'feed.description')) + '</description>\n'
        + '    <language>' + I18N.FEED_LANG[lang] + '</language>\n'
        + '    <lastBuildDate>' + rfc822(latest) + '</lastBuildDate>\n'
        + '    <atom:link href="' + base + '/feed.xml" rel="self" type="application/rss+xml" />\n'
        + items + '\n'
        + '  </channel>\n'
        + '</rss>\n';

    const outDir = I18N.langRoot(lang);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'feed.xml'), xml);
    return blog.length;
}

// 站内搜索索引：相对 URL 保持不变（各语言目录各有自己的副本，R4）
const KIND_LABEL_KEY = { posts: 'kind.postLabel', projects: 'kind.project' };

function buildSearchIndex(lang) {
    const entries = [];
    for (const key of Object.keys(kinds)) {
        const cfg = kinds[key];
        const label = lang === I18N.DEFAULT_LANG
            ? (cfg.label || key)
            : I18N.t(lang, KIND_LABEL_KEY[key] || key) || (cfg.label || key);
        for (const item of readIndex(key, lang)) {
            if (!item.slug) continue;
            entries.push({
                kind: key,
                kindLabel: label,
                title: item.title,
                slug: item.slug,
                date: item.date || '',
                tags: item.tags || [],
                desc: item.excerpt || item.desc || '',
                icon: item.fallbackIcon || cfg.navIcon || '📄',
                cover: item.thumbnail || item.hero || '',
                url: 'SpecialPages/' + cfg.pageName + '/' + encodeURIComponent(item.slug) + '.html'
            });
        }
    }
    entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const outDir = path.join(I18N.langRoot(lang), 'data');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'search-index.json'), JSON.stringify(entries, null, 2) + '\n');
    return entries.length;
}

// ---------- 执行 ----------

const kinds = loadKinds();
for (const key of Object.keys(kinds)) {
    const cfg = kinds[key];
    const dir = path.join(ROOT, cfg.dataDir || ('data/' + key));
    try {
        const count = buildIndex(dir, 'index.json');
        console.log(`✅ ${cfg.label || key}数据生成完成（${count} ${cfg.label ? '项' : '篇'}）`);
    } catch (e) {
        console.error(`❌ ${cfg.label || key}数据生成失败：${e.message}`);
    }
}

// 以下产物依赖上面的索引，按语言循环生成到各自镜像目录
for (const lang of I18N.LANGS) {
    try {
        let localized = 0;
        for (const key of Object.keys(kinds)) localized += buildLocalizedIndex(lang, key);
        if (lang !== I18N.DEFAULT_LANG) console.log(`✅ [${lang}] 列表索引本地化完成（${localized} 项）`);
    } catch (e) {
        console.error(`❌ [${lang}] 列表索引本地化失败：` + e.message);
    }
    try {
        const total = buildGallery(lang);
        if (lang !== I18N.DEFAULT_LANG) console.log(`✅ [${lang}] 画廊数据本地化完成（${total} 件）`);
    } catch (e) {
        console.error(`❌ [${lang}] 画廊数据本地化失败：` + e.message);
    }
    try {
        const total = buildSitemap(lang);
        console.log(`✅ [${lang}] sitemap.xml 生成完成（${total} 个地址）`);
    } catch (e) {
        console.error(`❌ [${lang}] sitemap.xml 生成失败：` + e.message);
    }
    try {
        const total = buildFeed(lang);
        console.log(`✅ [${lang}] feed.xml 生成完成（${total} 篇文章）`);
    } catch (e) {
        console.error(`❌ [${lang}] feed.xml 生成失败：` + e.message);
    }
    try {
        const total = buildSearchIndex(lang);
        console.log(`✅ [${lang}] data/search-index.json 生成完成（${total} 条）`);
    } catch (e) {
        console.error(`❌ [${lang}] 搜索索引生成失败：` + e.message);
    }
}

try {
    const total = buildSitemapIndex();
    console.log(`✅ sitemap-index.xml 生成完成（${total} 份语言 sitemap）`);
} catch (e) {
    console.error('❌ sitemap-index.xml 生成失败：' + e.message);
}
