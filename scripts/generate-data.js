// scripts/generate-data.js
// 扫描 data/ 下各内容分类目录，自动生成各分类的 index.json。
// 分类配置统一来自 scripts/kinds.json（管理后台可增删分类并同步此文件）。
// 每篇内容由两部分组成：
//   data/<分类>/<name>.json        —— 元数据（title/date/tags/...）
//   data/<分类>/posts/<name>.html  —— 正文 HTML
// 本脚本只负责汇总元数据，不生成正文。
const fs = require('fs');
const path = require('path');
const { loadSiteConfig, absoluteUrl } = require('./site-config');

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
// 形如 "2026-07-22-linux-app-icon-fix" 的文件名是 slug，不是 id。
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

// ---------- 通用生成逻辑 ----------

function buildIndex(dir, indexName) {
    const files = listJsonFiles(dir);
    const items = files.map(name => {
        const item = readJson(path.join(dir, name));
        const base = name.replace(/\.json$/, '');
        const id = item.id != null ? item.id : idFromFilename(name);
        // 文件名即 slug；缺失时自动补全，保证详情页能按 slug 加载
        const slug = item.slug || base;
        return { ...item, id, slug };
    }).filter(x => x.title); // 跳过无标题的残缺文件

    // 按日期倒序稳定排序
    const sorted = items.slice().sort(sortByDateDesc);

    // 补齐缺失的 id（按排序顺序分配最小可用值）
    const used = new Set(sorted.map(x => x.id).filter(n => typeof n === 'number'));
    let next = 1;
    sorted.forEach(item => {
        if (item.id == null) {
            while (used.has(next)) next++;
            item.id = next;
            used.add(next);
        }
    });

    // 汇总到索引
    const index = sorted.map(({ id, slug, title, date, tags, excerpt, thumbnail, hero, fallbackIcon, status, statusClass, year, desc }) => ({
        id,
        ...(slug ? { slug } : {}),
        title,
        ...(date ? { date } : {}),
        ...(Array.isArray(tags) && tags.length ? { tags } : { tags: [] }),
        ...(excerpt ? { excerpt } : {}),
        ...(thumbnail ? { thumbnail } : {}),
        ...(hero ? { hero } : {}),
        ...(fallbackIcon ? { fallbackIcon } : {}),
        ...(status ? { status } : {}),
        ...(statusClass ? { statusClass } : {}),
        ...(year ? { year } : {}),
        ...(desc ? { desc } : {})
    }));

    fs.mkdirSync(dir, { recursive: true }); // 目录不存在时自动创建
    fs.writeFileSync(path.join(dir, indexName), JSON.stringify(index, null, 2) + '\n');
    return index.length;
}

// ---------- 站点地图 / RSS / 搜索索引 ----------

const SITE_URL = SITE.siteUrl;

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// 本地日期（YYYY-MM-DD）。不用 toISOString()，否则东八区凌晨会被算成前一天。
function todayLocal() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function readIndex(key) {
    const cfg = kinds[key];
    const indexFile = path.join(ROOT, cfg.dataDir || ('data/' + key), 'index.json');
    if (!fs.existsSync(indexFile)) return [];
    try {
        return JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
    } catch (e) {
        return [];
    }
}

// 固定页面的 lastmod 取所有内容里的最新日期，避免每天运行都产生无意义 diff
function latestContentDate() {
    let latest = '';
    for (const key of Object.keys(kinds)) {
        for (const item of readIndex(key)) {
            if (item.date && item.date > latest) latest = item.date;
        }
    }
    return latest;
}

function detailUrl(cfg, slug) {
    return SITE_URL + '/SpecialPages/' + cfg.pageName + '/' + encodeURIComponent(slug) + '.html';
}

// 汇总固定页面 + 每个分类下所有内容的静态详情页，输出 sitemap.xml
function buildSitemap() {
    const today = todayLocal();
    const latest = latestContentDate() || today;
    const urls = [
        { loc: SITE_URL + '/', lastmod: latest, changefreq: 'weekly', priority: '1.0' },
        { loc: SITE_URL + '/SpecialPages/Blog/index.html', lastmod: latest, changefreq: 'weekly', priority: '0.9' },
        { loc: SITE_URL + '/SpecialPages/Project/index.html', lastmod: latest, changefreq: 'weekly', priority: '0.9' },
        { loc: SITE_URL + '/SpecialPages/Gallery/index.html', lastmod: latest, changefreq: 'monthly', priority: '0.8' },
        { loc: SITE_URL + '/SpecialPages/Search/index.html', lastmod: latest, changefreq: 'monthly', priority: '0.4' },
        { loc: SITE_URL + '/privacy/privacy.html', lastmod: latest, changefreq: 'yearly', priority: '0.3' }
    ];

    for (const key of Object.keys(kinds)) {
        const cfg = kinds[key];
        for (const item of readIndex(key)) {
            if (!item.slug) continue;
            urls.push({
                loc: detailUrl(cfg, item.slug),
                lastmod: item.date || today,
                changefreq: 'monthly',
                priority: '0.6'
            });
        }
    }

    const rows = urls.map(u =>
        '  <url>\n'
        + '    <loc>' + xmlEscape(u.loc) + '</loc>\n'
        + '    <lastmod>' + u.lastmod + '</lastmod>\n'
        + '    <changefreq>' + u.changefreq + '</changefreq>\n'
        + '    <priority>' + u.priority + '</priority>\n'
        + '  </url>'
    ).join('\n');

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + rows + '\n</urlset>\n';

    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
    return urls.length;
}

function rfc822(date) {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00+08:00');
    return isNaN(d.getTime()) ? '' : d.toUTCString();
}

// 博客 RSS。项目内容不放进来，保持订阅源聚焦。
function buildFeed() {
    const blog = readIndex('posts');
    const latest = latestContentDate() || todayLocal();
    const items = blog.slice(0, 30).map(item => {
        const link = detailUrl(kinds.posts, item.slug);
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

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        + '  <channel>\n'
        + '    <title>藤栖博客 · VineTurtle Studio</title>\n'
        + '    <link>' + SITE_URL + '/SpecialPages/Blog/index.html</link>\n'
        + '    <description>记录森林小镇的灵感碎片与创作手记。</description>\n'
        + '    <language>zh-CN</language>\n'
        + '    <lastBuildDate>' + rfc822(latest) + '</lastBuildDate>\n'
        + '    <atom:link href="' + SITE_URL + '/feed.xml" rel="self" type="application/rss+xml" />\n'
        + items + '\n'
        + '  </channel>\n'
        + '</rss>\n';

    fs.writeFileSync(path.join(ROOT, 'feed.xml'), xml);
    return blog.length;
}

// 站内搜索索引：标题、摘要、标签、日期、静态详情页地址
function buildSearchIndex() {
    const entries = [];
    for (const key of Object.keys(kinds)) {
        const cfg = kinds[key];
        for (const item of readIndex(key)) {
            if (!item.slug) continue;
            entries.push({
                kind: key,
                kindLabel: cfg.label || key,
                title: item.title,
                slug: item.slug,
                date: item.date || '',
                tags: item.tags || [],
                desc: item.excerpt || item.desc || '',
                icon: item.fallbackIcon || cfg.navIcon || '📄',
                cover: item.hero || item.thumbnail || '',
                url: 'SpecialPages/' + cfg.pageName + '/' + encodeURIComponent(item.slug) + '.html'
            });
        }
    }
    entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    fs.writeFileSync(path.join(ROOT, 'data', 'search-index.json'), JSON.stringify(entries, null, 2) + '\n');
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

// 以下产物依赖上面的索引，放在最后生成
try {
    const total = buildSitemap();
    console.log(`✅ sitemap.xml 生成完成（${total} 个地址）`);
} catch (e) {
    console.error('❌ sitemap.xml 生成失败：' + e.message);
}

try {
    const total = buildFeed();
    console.log(`✅ feed.xml 生成完成（${total} 篇文章）`);
} catch (e) {
    console.error('❌ feed.xml 生成失败：' + e.message);
}

try {
    const total = buildSearchIndex();
    console.log(`✅ data/search-index.json 生成完成（${total} 条）`);
} catch (e) {
    console.error('❌ 搜索索引生成失败：' + e.message);
}
