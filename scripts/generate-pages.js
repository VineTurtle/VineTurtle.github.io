// scripts/generate-pages.js
// 为每篇文章 / 项目生成独立静态详情页，解决分享卡片与搜索引擎抓不到内容的问题。
// 生成结果：SpecialPages/<pageName>/<slug>.html
// 旧的 post.html?slug=... / detail.html?slug=... 仍然保留，作为兼容入口。
const fs = require('fs');
const path = require('path');
const { loadSiteConfig, absoluteUrl } = require('./site-config');

const ROOT = path.join(__dirname, '..');
const SITE = loadSiteConfig();
const KINDS_FILE = path.join(__dirname, 'kinds.json');

const STYLES = {
    posts: {
        mainClass: 'blog-main',
        containerClass: 'post-container',
        articleClass: 'post-article',
        headerClass: 'post-header',
        metaClass: 'post-meta',
        bodyClass: 'post-body',
        tagsClass: 'post-tags-display',
        heroClass: 'post-hero-img',
        backLabel: '返回博客列表',
        css: ['blog.css', 'post-detail.css'],
        ogType: 'article',
        schemaType: 'BlogPosting',
        feed: true
    },
    projects: {
        mainClass: 'project-main',
        containerClass: 'detail-container',
        articleClass: 'project-detail',
        headerClass: 'detail-header',
        metaClass: 'detail-meta',
        bodyClass: 'detail-body',
        tagsClass: 'detail-tags-display',
        heroClass: 'detail-hero-img',
        backLabel: '返回项目列表',
        css: ['project.css', 'project-detail.css'],
        ogType: 'article',
        schemaType: 'CreativeWork',
        feed: false
    }
};

const DEFAULT_STYLE = {
    mainClass: 'blog-main',
    containerClass: 'post-container',
    articleClass: 'post-article',
    headerClass: 'post-header',
    metaClass: 'post-meta',
    bodyClass: 'post-body',
    tagsClass: 'post-tags-display',
    heroClass: 'post-hero-img',
    backLabel: '返回列表',
    css: ['blog.css', 'post-detail.css'],
    ogType: 'article',
    schemaType: 'CreativeWork',
    feed: false
};

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stripTags(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text, max) {
    const str = String(text || '').trim();
    if (str.length <= max) return str;
    return str.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function safeJson(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function formatDate(value) {
    if (!value) return '';
    const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return String(value);
    return m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
}

function readingMinutes(content) {
    const length = stripTags(content).length;
    return Math.max(1, Math.ceil(length / 420));
}

function renderHero(item, style) {
    const icon = escapeHtml(item.fallbackIcon || '📄');
    if (!item.hero) return `<div class="fallback-hero">${icon}</div>`;
    return '<div class="hero-img-wrap">'
        + '<img src="' + escapeHtml(item.hero) + '" alt="' + escapeHtml(item.title) + '" class="' + style.heroClass + '" data-fallback="' + icon + '">'
        + '<div class="fallback-hero">' + icon + '</div>'
        + '</div>';
}

function renderTags(item, style) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    if (!tags.length) return '';
    return '<div class="' + style.tagsClass + '">' + tags.map(function (tag) {
        return '<span class="tag">#' + escapeHtml(tag) + '</span>';
    }).join('') + '</div>';
}

function buildJsonLd(item, cfg, style, pageUrl, description, imageUrl) {
    const crumbs = [
        { '@type': 'ListItem', position: 1, name: '首页', item: SITE.siteUrl + '/' },
        { '@type': 'ListItem', position: 2, name: cfg.label || cfg.pageName, item: SITE.siteUrl + '/SpecialPages/' + cfg.pageName + '/index.html' },
        { '@type': 'ListItem', position: 3, name: item.title, item: pageUrl }
    ];
    const article = {
        '@context': 'https://schema.org',
        '@type': style.schemaType,
        headline: item.title,
        name: item.title,
        description: description,
        url: pageUrl,
        datePublished: item.date || undefined,
        dateModified: item.date || undefined,
        image: imageUrl || undefined,
        author: { '@type': 'Organization', name: SITE.siteName, url: SITE.siteUrl + '/' },
        publisher: { '@type': 'Organization', name: SITE.siteName, url: SITE.siteUrl + '/' },
        keywords: (item.tags || []).join(', ') || undefined
    };
    const breadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs
    };
    return '<script type="application/ld+json">\n' + safeJson([article, breadcrumb]) + '\n</script>';
}

function buildPage(item, cfg, content, style) {
    const slug = String(item.slug);
    const pageUrl = SITE.siteUrl + '/SpecialPages/' + cfg.pageName + '/' + encodeURIComponent(slug) + '.html';
    const description = truncate(item.excerpt || item.desc || stripTags(content) || ('藤栖龟舍 · ' + item.title), 150);
    const imageUrl = absoluteUrl(SITE, item.hero || item.thumbnail);
    const dateText = formatDate(item.date);
    const minutes = readingMinutes(content);
    const icon = escapeHtml(item.fallbackIcon || '📄');
    const tags = renderTags(item, style);
    const hero = renderHero(item, style);

    const projectMeta = cfg.pageName === 'Project'
        ? '<span class="project-status ' + escapeHtml(item.statusClass || 'status-plan') + '">' + escapeHtml(item.status || '进行中') + '</span>'
        + '<span class="detail-year">📅 ' + escapeHtml(item.year || '待定') + '</span>'
        + '<div class="dynamic-stats" data-dynamic-stats></div>'
        : '<span>📅 ' + escapeHtml(dateText || '日期待定') + '</span>'
        + '<span>⏱ 约 ' + minutes + ' 分钟</span>'
        + '<div class="dynamic-stats" data-dynamic-stats></div>';

    const feedLink = style.feed
        ? '    <link rel="alternate" type="application/rss+xml" title="藤栖博客 RSS" href="' + SITE.siteUrl + '/feed.xml">\n'
        : '';

    const cssLinks = style.css.map(function (file) {
        return '    <link rel="stylesheet" href="../../CSS/special/' + file + '">';
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#2a5c3a" />
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(item.title)} · 藤栖龟舍</title>
    <link rel="canonical" href="${pageUrl}" />
    <meta property="og:type" content="${style.ogType}" />
    <meta property="og:site_name" content="藤栖龟舍 VineTurtle Studio" />
    <meta property="og:title" content="${escapeHtml(item.title)} · 藤栖龟舍" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    ${item.date ? '<meta property="article:published_time" content="' + escapeHtml(item.date) + '" />' : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../../Resources/images/VineTurtleStudio.png" type="image/png" />
${feedLink}    <link rel="stylesheet" href="../../CSS/layout.css" />
    <link rel="stylesheet" href="../../CSS/style.css" />
${cssLinks}
    <link rel="stylesheet" href="../../CSS/dynamic.css" />
    <script src="../../JS/layout.js" defer></script>
    <script src="../../JS/script.js" defer></script>
    <script src="../../JS/special-detail.js" defer></script>
    <script src="../../JS/static-detail.js" defer></script>
    <script src="../../JS/dynamic.js" defer></script>
${buildJsonLd(item, cfg, style, pageUrl, description, imageUrl)}
</head>
<body data-content-kind="${escapeHtml(cfg.pageName === 'Project' ? 'project' : 'blog')}" data-content-slug="${escapeHtml(slug)}" data-content-key="${escapeHtml((cfg.pageName === 'Project' ? 'project' : 'blog') + ':' + slug)}">
<noscript><div class="noscript-warn">本站需要启用 JavaScript 才能正常显示内容。</div></noscript>
<div id="header-placeholder"></div>
<main class="${style.mainClass}">
    <div class="container ${style.containerClass}">
        <a href="index.html" class="back-link" id="backLink">← ${escapeHtml(style.backLabel)}</a>
        <article class="${style.articleClass}">
            ${hero}
            <header class="${style.headerClass}">
                <h1>${escapeHtml(item.title)}</h1>
                <div class="${style.metaClass}">${projectMeta}</div>
${tags}
                <div class="content-actions" data-content-actions></div>
            </header>
            <nav class="post-toc" data-toc hidden aria-label="文章目录"></nav>
            <div class="${style.bodyClass}">
${content || '<p>正文正在生长中……</p>'}
            </div>
        </article>
        <section class="comments-section" id="commentsSection" hidden></section>
    </div>
</main>
<div id="footer-placeholder"></div>
<div class="month-badge" id="monthBadge">🌿 1月</div>
</body>
</html>
`;
}

function main() {
    const kinds = JSON.parse(fs.readFileSync(KINDS_FILE, 'utf-8'));
    let total = 0;

    for (const key of Object.keys(kinds)) {
        const cfg = kinds[key];
        const style = STYLES[key] || DEFAULT_STYLE;
        const dataDir = path.join(ROOT, cfg.dataDir || ('data/' + key));
        const indexFile = path.join(dataDir, 'index.json');
        if (!fs.existsSync(indexFile)) continue;

        const items = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
        const outDir = path.join(ROOT, 'SpecialPages', cfg.pageName);
        fs.mkdirSync(outDir, { recursive: true });

        for (const item of items) {
            if (!item.slug) continue;
            if (!/^[A-Za-z0-9._-]+$/.test(String(item.slug))) {
                console.warn('⚠️ 跳过不安全的 slug：' + item.slug);
                continue;
            }

            const jsonFile = path.join(dataDir, item.slug + '.json');
            const htmlFile = path.join(dataDir, 'posts', item.slug + '.html');
            if (!fs.existsSync(jsonFile) || !fs.existsSync(htmlFile)) {
                console.warn('⚠️ 缺少正文或元数据，跳过：' + key + '/' + item.slug);
                continue;
            }

            const full = { ...item, ...JSON.parse(fs.readFileSync(jsonFile, 'utf-8')) };
            const content = fs.readFileSync(htmlFile, 'utf-8');
            const html = buildPage(full, cfg, content, style);
            fs.writeFileSync(path.join(outDir, item.slug + '.html'), html);
            total++;
        }
        console.log(`✅ ${cfg.label || key}静态详情页生成完成（${cfg.pageName}）`);
    }

    console.log(`✅ 共生成 ${total} 个静态详情页。`);
}

main();
