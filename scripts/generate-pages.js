// scripts/generate-pages.js
// 为每篇文章 / 项目生成独立静态详情页，解决分享卡片与搜索引擎抓不到内容的问题。
// 生成结果：
//   简中 → SpecialPages/<pageName>/<slug>.html（根路径，行为保持不变，R26）
//   其他语言 → <lang>/SpecialPages/<pageName>/<slug>.html（完整镜像，R19）
// P1：所有静态模板文案（上一篇/相关阅读/面包屑/日期/时长/状态/JSON-LD）走字典，
//     写死进 HTML（无首屏闪烁、利 SEO，R7/R8）；补齐 canonical/hreflang/og:locale（R10/R11）。
//     正文仍以简中为单一来源，缺译回退简中（R12）。
const fs = require('fs');
const path = require('path');
const { loadSiteConfig, absoluteUrl } = require('./site-config');
const I18N = require('./i18n-common');

const ROOT = path.join(__dirname, '..');
const SITE = loadSiteConfig();
const KINDS_FILE = path.join(__dirname, 'kinds.json');
const SITE_URL = SITE.siteUrl;

const STYLES = {
    posts: {
        mainClass: 'blog-main', containerClass: 'post-container', articleClass: 'post-article',
        headerClass: 'post-header', metaClass: 'post-meta', bodyClass: 'post-body',
        tagsClass: 'post-tags-display', heroClass: 'post-hero-img',
        backKey: 'list.backBlog', css: ['blog.css', 'post-detail.css'],
        ogType: 'article', schemaType: 'BlogPosting', feed: true
    },
    projects: {
        mainClass: 'project-main', containerClass: 'detail-container', articleClass: 'project-detail',
        headerClass: 'detail-header', metaClass: 'detail-meta', bodyClass: 'detail-body',
        tagsClass: 'detail-tags-display', heroClass: 'detail-hero-img',
        backKey: 'list.backProject', css: ['project.css', 'project-detail.css'],
        ogType: 'article', schemaType: 'CreativeWork', feed: false
    }
};

const DEFAULT_STYLE = {
    mainClass: 'blog-main', containerClass: 'post-container', articleClass: 'post-article',
    headerClass: 'post-header', metaClass: 'post-meta', bodyClass: 'post-body',
    tagsClass: 'post-tags-display', heroClass: 'post-hero-img',
    backKey: 'list.backBlog', css: ['blog.css', 'post-detail.css'],
    ogType: 'article', schemaType: 'CreativeWork', feed: false
};

const KIND_LABEL_KEY = { posts: 'kind.postLabel', projects: 'kind.project' };

// ---------- 文本工具 ----------

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripTags(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
    const str = String(text || '').trim();
    if (str.length <= max) return str;
    return str.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function safeJson(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function formatDate(lang, value) {
    if (!value) return '';
    const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return String(value);
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (lang === 'en') {
        try {
            return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
            });
        } catch (e) { /* 回退中文格式 */ }
    }
    return y + '年' + mo + '月' + d + '日';
}

function readingMinutes(content) {
    return Math.max(1, Math.ceil(stripTags(content).length / 420));
}

function detailHref(slug) {
    return encodeURIComponent(String(slug)) + '.html';
}

function kindLabel(lang, key, cfg) {
    if (lang === I18N.DEFAULT_LANG) return cfg.label || key;
    return I18N.t(lang, KIND_LABEL_KEY[key] || key) || (cfg.label || key);
}

// ---------- 页面片段（全部本地化） ----------

function buildPager(lang, item, items, cfg) {
    const index = items.findIndex(function (entry) { return entry.slug === item.slug; });
    if (index < 0) return '';
    const prev = index < items.length - 1 ? items[index + 1] : null;
    const next = index > 0 ? items[index - 1] : null;
    if (!prev && !next) return '';

    const isProject = cfg.pageName === 'Project';
    const prevLabel = I18N.t(lang, isProject ? 'detail.prevProject' : 'detail.prev');
    const nextLabel = I18N.t(lang, isProject ? 'detail.nextProject' : 'detail.next');

    function link(target, label, cls, arrowAfter) {
        if (!target) return '<span class="pager-link is-empty" aria-hidden="true"></span>';
        const text = arrowAfter ? escapeHtml(label) + ' →' : '← ' + escapeHtml(label);
        return '<a class="pager-link ' + cls + '" href="' + escapeHtml(detailHref(target.slug)) + '" rel="' + (cls === 'pager-prev' ? 'prev' : 'next') + '">'
            + '<span class="pager-label">' + text + '</span>'
            + '<span class="pager-title">' + escapeHtml(target.title) + '</span>'
            + '</a>';
    }

    return '<nav class="content-pager" aria-label="' + escapeHtml(I18N.t(lang, 'detail.pagerAria')) + '">'
        + link(prev, prevLabel, 'pager-prev', false)
        + link(next, nextLabel, 'pager-next', true)
        + '</nav>';
}

function buildRelated(lang, item, items, cfg) {
    const tags = new Set((item.tags || []).map(function (tag) { return String(tag).toLowerCase(); }));
    const candidates = items.filter(function (entry) { return entry.slug && entry.slug !== item.slug; });

    const scored = candidates.map(function (entry) {
        const overlap = (entry.tags || []).filter(function (tag) { return tags.has(String(tag).toLowerCase()); }).length;
        return { item: entry, overlap: overlap };
    }).filter(function (row) { return row.overlap > 0; }).sort(function (a, b) {
        return b.overlap - a.overlap || String(b.item.date || '').localeCompare(String(a.item.date || ''));
    });

    const picked = [];
    function push(entry) {
        if (!entry || picked.length >= 3) return;
        if (picked.some(function (x) { return x.slug === entry.slug; })) return;
        picked.push(entry);
    }
    scored.forEach(function (row) { push(row.item); });
    if (picked.length < 3) {
        candidates.slice().sort(function (a, b) {
            return String(b.date || '').localeCompare(String(a.date || ''));
        }).forEach(push);
    }
    if (!picked.length) return '';

    const isProject = cfg.pageName === 'Project';
    const dateLabel = I18N.t(lang, 'detail.dateLabel');
    return '<section class="related-content" aria-labelledby="relatedTitle">'
        + '<h2 id="relatedTitle">' + escapeHtml(I18N.t(lang, isProject ? 'detail.relatedProject' : 'detail.related')) + '</h2>'
        + '<div class="related-grid">'
        + picked.map(function (entry) {
            return '<a class="related-card" href="' + escapeHtml(detailHref(entry.slug)) + '">'
                + '<span class="related-kind">' + escapeHtml(I18N.t(lang, isProject ? 'detail.projectKind' : 'detail.articleKind')) + '</span>'
                + '<span class="related-title">' + escapeHtml(entry.title) + '</span>'
                + (entry.date ? '<span class="related-date">' + escapeHtml(dateLabel) + escapeHtml(entry.date) + '</span>' : '')
                + '</a>';
        }).join('')
        + '</div></section>';
}

function buildBreadcrumb(lang, item, cfg, key) {
    const label = kindLabel(lang, key, cfg);
    return '<nav class="breadcrumb" aria-label="' + escapeHtml(I18N.t(lang, 'detail.breadcrumbAria')) + '">'
        + '<a href="../../index.html">' + escapeHtml(I18N.t(lang, 'common.home')) + '</a>'
        + '<span class="crumb-sep" aria-hidden="true">/</span>'
        + '<a href="index.html">' + escapeHtml(label) + '</a>'
        + '<span class="crumb-sep" aria-hidden="true">/</span>'
        + '<span aria-current="page">' + escapeHtml(item.title) + '</span>'
        + '</nav>';
}

function renderHero(item, style) {
    const icon = escapeHtml(item.fallbackIcon || '📄');
    if (!item.hero) return '<div class="fallback-hero">' + icon + '</div>';
    // hero 是 LCP 元素：高优先级加载，不做 lazy（旧浏览器不识别 fetchpriority 时忽略即可，R37）
    return '<div class="hero-img-wrap">'
        + '<img src="' + escapeHtml(item.hero) + '" alt="' + escapeHtml(item.title) + '" class="' + style.heroClass + '" data-fallback="' + icon + '" fetchpriority="high" decoding="async">'
        + '<div class="fallback-hero">' + icon + '</div></div>';
}

// 正文图片统一懒加载（R35）：仅前缀注入属性，已有 loading= 的跳过；正文图片不会出现在 pre/code 内。
function enrichBodyImages(html) {
    return html.replace(/<img\b(?![^>]*\sloading=)/gi, '<img loading="lazy" decoding="async"');
}

function renderTags(item, style) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    if (!tags.length) return '';
    return '<div class="' + style.tagsClass + '">' + tags.map(function (tag) {
        return '<span class="tag">#' + escapeHtml(tag) + '</span>';
    }).join('') + '</div>';
}

function buildJsonLd(lang, item, cfg, style, key, pageUrl, description, imageUrl) {
    const base = I18N.urlPrefix(SITE_URL, lang);
    const siteName = I18N.t(lang, 'site.fullName') || SITE.siteName;
    const crumbs = [
        { '@type': 'ListItem', position: 1, name: I18N.t(lang, 'common.home'), item: base + '/' },
        { '@type': 'ListItem', position: 2, name: kindLabel(lang, key, cfg), item: base + '/SpecialPages/' + cfg.pageName + '/index.html' },
        { '@type': 'ListItem', position: 3, name: item.title, item: pageUrl }
    ];
    const article = {
        '@context': 'https://schema.org', '@type': style.schemaType,
        headline: item.title, name: item.title, description: description, url: pageUrl,
        datePublished: item.date || undefined, dateModified: item.date || undefined,
        image: imageUrl || undefined, inLanguage: lang,
        author: { '@type': 'Organization', name: siteName, url: base + '/' },
        publisher: { '@type': 'Organization', name: siteName, url: base + '/' },
        keywords: (item.tags || []).join(', ') || undefined
    };
    return '<script type="application/ld+json">\n' + safeJson([article, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs }]) + '\n</script>';
}

function buildPage(lang, key, item, cfg, content, style, extra, relPath, contentLang) {
    const slug = String(item.slug);
    const additions = extra || {};
    const base = I18N.urlPrefix(SITE_URL, lang);
    const pageUrl = base + '/SpecialPages/' + cfg.pageName + '/' + encodeURIComponent(slug) + '.html';
    const siteName = I18N.t(lang, 'site.name') || SITE.shortName;
    const description = truncate(item.excerpt || item.desc || stripTags(content) || (siteName + ' · ' + item.title), 150);
    const imageUrl = absoluteUrl(SITE, item.hero || item.thumbnail);
    const icon = escapeHtml(item.fallbackIcon || '📄');
    const tags = renderTags(item, style);
    const hero = renderHero(item, style);
    const fullTitle = escapeHtml(item.title) + ' · ' + escapeHtml(siteName);

    const projectMeta = cfg.pageName === 'Project'
        ? '<span class="project-status ' + escapeHtml(item.statusClass || 'status-plan') + '">' + escapeHtml(item.status || I18N.t(lang, 'list.ongoing')) + '</span>'
        + '<span class="detail-year">' + escapeHtml(I18N.t(lang, 'detail.yearLabel')) + escapeHtml(item.year || I18N.t(lang, 'list.tbd')) + '</span>'
        + '<div class="dynamic-stats" data-dynamic-stats></div>'
        : '<span>' + escapeHtml(I18N.t(lang, 'detail.dateLabel')) + escapeHtml(formatDate(lang, item.date) || I18N.t(lang, 'detail.dateTbd')) + '</span>'
        + '<span>' + escapeHtml(I18N.t(lang, 'detail.timeLabel')) + escapeHtml(I18N.t(lang, 'detail.readingTime', { minutes: readingMinutes(content) })) + '</span>'
        + '<div class="dynamic-stats" data-dynamic-stats></div>';

    // 简中保留原 RSS 标题（R26 基线不变），其他语言用本地化标题
    const feedTitle = lang === I18N.DEFAULT_LANG ? '藤栖博客 RSS' : I18N.t(lang, 'feed.title');
    const feedLink = style.feed
        ? '    <link rel="alternate" type="application/rss+xml" title="' + escapeHtml(feedTitle) + '" href="' + base + '/feed.xml">\n'
        : '';

    const cssLinks = style.css.map(function (file) {
        return '    <link rel="stylesheet" href="../../CSS/special/' + file + '">';
    }).join('\n');

    const hreflang = I18N.hreflangTags(SITE_URL, relPath);
    const backKey = style.backKey || 'list.backBlog';

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#2a5c3a" />
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${fullTitle}</title>
    <link rel="canonical" href="${pageUrl}" />
${hreflang}
    <meta property="og:type" content="${style.ogType}" />
    <meta property="og:locale" content="${I18N.OG_LOCALE[lang]}" />
    <meta property="og:site_name" content="${escapeHtml(I18N.t(lang, 'site.fullName') || SITE.siteName)}" />
    <meta property="og:title" content="${fullTitle}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    ${item.date ? '<meta property="article:published_time" content="' + escapeHtml(item.date) + '" />' : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../../Resources/images/VineTurtleStudio.png" type="image/png" />
    <script src="../../JS/theme-init.js"></script>
${feedLink}    <link rel="stylesheet" href="../../CSS/layout.css" />
    <link rel="stylesheet" href="../../CSS/i18n.css">
    <link rel="stylesheet" href="../../CSS/style.css" />
${cssLinks}
    <link rel="stylesheet" href="../../CSS/dynamic.css" />
    <script src="../../JS/i18n.js"></script>
    <script src="../../JS/layout.js" defer></script>
    <script src="../../JS/script.js" defer></script>
    <script src="../../JS/special-detail.js" defer></script>
    <script src="../../JS/static-detail.js" defer></script>
    <script src="../../JS/dynamic.js" defer></script>
${buildJsonLd(lang, item, cfg, style, key, pageUrl, description, imageUrl)}
</head>
<body data-content-kind="${escapeHtml(cfg.pageName === 'Project' ? 'project' : 'blog')}" data-content-slug="${escapeHtml(slug)}" data-content-key="${escapeHtml((cfg.pageName === 'Project' ? 'project' : 'blog') + ':' + slug)}">
<noscript><div class="noscript-warn" data-i18n="common.noscript">${escapeHtml(I18N.t(lang, 'common.noscript'))}</div></noscript>
<div id="header-placeholder"></div>
<main class="${style.mainClass}">
    <div class="container ${style.containerClass}">
        ${buildBreadcrumb(lang, item, cfg, key)}
        <a href="index.html" class="back-link" id="backLink" data-i18n="${backKey}">${escapeHtml(I18N.t(lang, backKey))}</a>
        <article class="${style.articleClass}">
            ${hero}
            <header class="${style.headerClass}">
                <h1>${escapeHtml(item.title)}</h1>
                <div class="${style.metaClass}">${projectMeta}</div>
${tags}
                <div class="content-actions" data-content-actions></div>
            </header>
            <nav class="post-toc" data-toc hidden aria-label="${escapeHtml(lang === I18N.DEFAULT_LANG ? '文章目录' : I18N.t(lang, 'a11y.toc'))}"></nav>
            <div class="${style.bodyClass}" lang="${contentLang || lang}" data-content-lang="${contentLang || lang}">
${enrichBodyImages(content) || ('<p>' + escapeHtml(I18N.t(lang, 'detail.growing')) + '</p>')}
            </div>
        </article>
        ${additions.pager || ''}
        ${additions.related || ''}
        <section class="comments-section" id="commentsSection" hidden></section>
    </div>
</main>
<div id="footer-placeholder"></div>
<div class="month-badge" id="monthBadge" aria-hidden="true">${escapeHtml(I18N.t(lang, 'common.monthBadge', { icon: '🌿', month: 1 }))}</div>
</body>
</html>
`;
}

// ---------- 镜像：静态页面本地化 ----------

// 静态页 title / description 对应的字典 key
const STATIC_SEO = {
    'index.html': { title: 'title.home', desc: 'seo.homeDesc' },
    '404.html': { title: 'title.notFound', desc: 'notfound.p1' },
    'privacy/privacy.html': { title: 'title.privacy', desc: 'site.tagline' },
    'SpecialPages/Blog/index.html': { title: 'title.blog', desc: 'title.blogListDesc' },
    'SpecialPages/Project/index.html': { title: 'title.project', desc: 'title.projectListDesc' },
    'SpecialPages/Gallery/index.html': { title: 'title.gallery', desc: 'gallery.desc' },
    'SpecialPages/Search/index.html': { title: 'title.search', desc: 'title.searchDesc' },
    'SpecialPages/Blog/archive.html': { title: 'title.archive', desc: 'archive.desc' },
    'SpecialPages/Blog/post.html': { title: 'title.blogPost', desc: 'site.tagline' },
    'SpecialPages/Project/detail.html': { title: 'title.projectDetail', desc: 'site.tagline' }
};

function localizeStaticHtml(html, lang, rel, seo) {
    const base = I18N.urlPrefix(SITE_URL, lang);
    const relPath = rel === 'index.html' ? '' : rel.replace(/\\/g, '/');
    // 首页 canonical 统一指向目录（/en/），与 hreflang 的写法保持一致，避免同一页面两个规范 URL
    const pageUrl = relPath ? base + '/' + relPath : base + '/';
    const title = I18N.t(lang, seo.title) || I18N.t(lang, 'site.name');
    const desc = I18N.t(lang, seo.desc) || I18N.t(lang, 'site.tagline');
    let out = html;

    out = out.replace(/<html\b[^>]*>/i, function (m) {
        return /lang=/i.test(m) ? m.replace(/lang="[^"]*"/i, 'lang="' + lang + '"') : m.replace(/^<html/i, '<html lang="' + lang + '"');
    });
    out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(title) + '</title>');
    out = out.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, function (m, a, b) { return a + escapeHtml(desc) + b; });

    if (/<link\s+rel="canonical"/i.test(out)) {
        out = out.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, function (m, a, b) { return a + pageUrl + b; });
    } else {
        out = out.replace('</title>', '</title>\n    <link rel="canonical" href="' + pageUrl + '" />');
    }
    out = out.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/i, function (m, a, b) { return a + pageUrl + b; });
    out = out.replace(/(<meta\s+property="og:site_name"\s+content=")[^"]*(")/i, function (m, a, b) {
        return a + escapeHtmlSafe(I18N.t(lang, 'site.fullName')) + b;
    });
    out = out.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, function (m, a, b) { return a + escapeHtml(title) + b; });
    out = out.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, function (m, a, b) { return a + escapeHtml(desc) + b; });
    if (!/og:locale/i.test(out)) {
        out = out.replace('</head>', '    <meta property="og:locale" content="' + I18N.OG_LOCALE[lang] + '" />\n</head>');
    }
    // 移除旧 hreflang，按当前语言重写互指（R10/R11）
    out = out.replace(/\n?[ \t]*<link rel="alternate" hreflang="[^"]*"[^>]*\/>/g, '');
    out = out.replace('</head>', I18N.hreflangTags(SITE_URL, relPath) + '\n</head>');

    // 静态可见文案：把带 data-i18n 的纯文本节点写死为译文（运行时再刷一次值一致）
    out = out.replace(/data-i18n="([^"]+)"([^>]*)>([^<]*)</g, function (m, key, mid, text) {
        return 'data-i18n="' + key + '"' + mid + '>' + I18N.t(lang, key) + '<';
    });

    // 属性文案（alt / aria-label 等，声明形如 data-i18n-attrs="alt:site.name"），构建期先写死译文（R13/R22）
    out = out.replace(/<[^>]*data-i18n-attrs="([^"]+)"[^>]*>/g, function (tag, specs) {
        let result = tag;
        specs.split(/[,;]/).forEach(function (spec) {
            const parts = spec.split(':');
            const attr = (parts.shift() || '').trim();
            const key = parts.join(':').trim();
            if (!attr || !key) return;
            const value = I18N.t(lang, key);
            if (!value) return;
            const re = new RegExp('(\\s' + attr + '=")[^"]*(")');
            if (re.test(result)) {
                result = result.replace(re, function (m, a, b) { return a + escapeHtml(value) + b; });
            } else {
                result = result.replace(/(<[^\s>]+)/, function (m) { return m + ' ' + attr + '="' + escapeHtml(value) + '"'; });
            }
        });
        return result;
    });

    // RSS 订阅链接的 title 属于界面文案（R7/R9）
    out = out.replace(/(<link\s+rel="alternate"\s+type="application\/rss\+xml"\s+title=")[^"]*(")/i, function (m, a, b) {
        return a + escapeHtml(I18N.t(lang, 'feed.title')) + b;
    });

    // 内联 JSON-LD：name / description / slogan / url 按语言重写，避免结构化数据仍是中文站点名（R7）
    out = out.replace(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g, function (m, body) {
        let data;
        try { data = JSON.parse(body); } catch (e) { return m; }
        const nodes = Array.isArray(data) ? data : (data['@graph'] || [data]);
        const siteName = I18N.t(lang, 'site.fullName');
        const tagline = I18N.t(lang, 'site.tagline');
        const homeUrl = pageUrl.replace(/\/index\.html$/, '/');
        const langBase = I18N.urlPrefix(SITE_URL, lang) + '/';
        nodes.forEach(function (node) {
            if (!node || typeof node !== 'object') return;
            if (node.name) node.name = siteName;
            if (node.description) node.description = tagline;
            if (node.slogan) node.slogan = tagline;
            const types = [].concat(node['@type'] || []);
            const isSite = types.indexOf('WebSite') !== -1 || types.indexOf('WebPage') !== -1 || types.indexOf('Organization') !== -1;
            if (isSite || types.length) node.inLanguage = lang;
            if (node.url) node.url = isSite ? homeUrl : pageUrl;
            if (typeof node.logo === 'string' && node.logo.indexOf(SITE_URL + '/Resources/') === 0) {
                node.logo = langBase + node.logo.slice(SITE_URL.length + 1);
            }
            const action = node.potentialAction;
            if (action && action.target && typeof action.target.urlTemplate === 'string') {
                action.target.urlTemplate = action.target.urlTemplate.indexOf(SITE_URL + '/') === 0
                    ? langBase + action.target.urlTemplate.slice(SITE_URL.length + 1)
                    : action.target.urlTemplate;
            }
        });
        return '<script type="application/ld+json">\n' + safeJson(data) + '\n</script>';
    });

    // 隐私页正文已按语言字典化（privacy.*），<html lang> 已标注页面语言，无需容器级覆盖

    return out;
}

function escapeHtmlSafe(v) { return String(v == null ? '' : v).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// 复制 SpecialPages 下的页面脚本（blog.js / project.js / gallery.js / post.js / detail.js）。
// 这些文件被列表页以相对路径引用，镜像缺少就会 404，列表页直接空白（R1/R19）。
function copySpecialPageScripts(dest) {
    const srcRoot = path.join(ROOT, 'SpecialPages');
    if (!fs.existsSync(srcRoot)) return 0;
    let count = 0;
    (function walk(dir) {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
                walk(full);
            } else if (name.endsWith('.js')) {
                const out = path.join(dest, path.relative(ROOT, full));
                fs.mkdirSync(path.dirname(out), { recursive: true });
                fs.copyFileSync(full, out);
                count++;
            }
        }
    })(srcRoot);
    return count;
}

function mirrorLanguages() {
    // 跳过预览大图、已本地化的索引与画廊数据，以及翻译覆盖源目录（R21/R4）
    const skip = [/_preview/, /_crop/, /search-index\.json$/, /^data\/i18n($|\/)/, /^data\/i18n-work($|\/)/, /(^|\/)index\.json$/, /^data\/gallery\.json$/];
    for (const lang of I18N.LANGS) {
        if (lang === I18N.DEFAULT_LANG) continue; // 简中根路径保持原样
        const dest = I18N.langRoot(lang);
        fs.mkdirSync(dest, { recursive: true });

        // 资源镜像（R19）：JS/CSS/i18n/Resources/data，跳过预览大图与已本地化的搜索索引
        for (const dir of ['JS', 'CSS', 'i18n', 'Resources', 'data']) {
            const src = path.join(ROOT, dir);
            if (fs.existsSync(src)) I18N.copyDir(src, path.join(dest, dir), skip);
        }

        // 静态页面本地化镜像
        for (const rel of Object.keys(STATIC_SEO)) {
            const src = path.join(ROOT, rel);
            if (!fs.existsSync(src)) continue;
            const html = fs.readFileSync(src, 'utf-8');
            const out = localizeStaticHtml(html, lang, rel, STATIC_SEO[rel]);
            const destFile = path.join(dest, rel);
            fs.mkdirSync(path.dirname(destFile), { recursive: true });
            fs.writeFileSync(destFile, out);
        }
        // 页面级脚本（blog.js / project.js / gallery.js 等）必须随镜像复制，否则列表页 404（R19）
        copySpecialPageScripts(dest);

        console.log(`✅ [${lang}] 镜像资源与静态页面生成完成`);
    }
}

// ---------- 执行 ----------

function main() {
    const kinds = JSON.parse(fs.readFileSync(KINDS_FILE, 'utf-8'));
    let total = 0;

    for (const lang of I18N.LANGS) {
        for (const key of Object.keys(kinds)) {
            const cfg = kinds[key];
            const style = STYLES[key] || DEFAULT_STYLE;
            const dataDir = path.join(ROOT, cfg.dataDir || ('data/' + key));
            const sub = path.basename(cfg.dataDir || ('data/' + key));
            // 列表用当前语言的索引（上一篇/相关阅读的标题随之本地化），缺失时回退简中
            const localizedIndex = path.join(I18N.langRoot(lang), 'data', sub, 'index.json');
            const indexFile = lang !== I18N.DEFAULT_LANG && fs.existsSync(localizedIndex)
                ? localizedIndex
                : path.join(dataDir, 'index.json');
            if (!fs.existsSync(indexFile)) continue;

            const items = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
            const outDir = path.join(I18N.langRoot(lang), 'SpecialPages', cfg.pageName);
            fs.mkdirSync(outDir, { recursive: true });
            const relDir = 'SpecialPages/' + cfg.pageName;

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

                const overrideMeta = I18N.loadContentMeta(lang, sub, item.slug);
                const full = { ...item, ...JSON.parse(fs.readFileSync(jsonFile, 'utf-8')), ...(overrideMeta || {}) };
                const overrideBody = I18N.loadContentBody(lang, sub, item.slug);
                let content = overrideBody || fs.readFileSync(htmlFile, 'utf-8');
                // 回退简中正文自带 <h1>，与模板的（已本地化）标题重复，非简中页去掉这一个，避免双标题
                if (!overrideBody && lang !== I18N.DEFAULT_LANG) {
                    content = content.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '');
                }
                const contentLang = overrideBody ? lang : 'zh-CN';
                const extra = {
                    pager: buildPager(lang, full, items, cfg),
                    related: buildRelated(lang, full, items, cfg)
                };
                const relPath = relDir + '/' + item.slug + '.html';
                const html = buildPage(lang, key, full, cfg, content, style, extra, relPath, contentLang);
                fs.writeFileSync(path.join(outDir, item.slug + '.html'), html);
                total++;
            }
        }
        console.log(`✅ [${lang}] 静态详情页生成完成`);
    }

    mirrorLanguages();
    console.log(`✅ 共生成 ${total} 个静态详情页（四语）。`);
}

main();
