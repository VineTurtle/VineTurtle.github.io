// JS/layout.js —— 公共头部 / 底部 / 移动导航 / 滚动行为
(function () {
    'use strict';

    // ---------- 根据脚本位置推断根目录，并计算路径前缀 ----------
    function getPathPrefix() {
        const scriptSrc = document.currentScript && document.currentScript.src;
        if (!scriptSrc) return '';
        const url = new URL(scriptSrc);
        const scriptPath = url.pathname;
        const lastSlash = scriptPath.lastIndexOf('/');
        const scriptDir = scriptPath.substring(0, lastSlash + 1);
        let rootDir = scriptDir.replace(/\/JS\/$/, '/');

        if (rootDir === scriptDir) {
            const parts = scriptDir.split('/').filter(Boolean);
            parts.pop();
            rootDir = '/' + parts.join('/') + '/';
            if (rootDir === '//') rootDir = '/';
        }

        const pagePath = window.location.pathname;
        let relative = '';
        if (pagePath.startsWith(rootDir)) {
            relative = pagePath.substring(rootDir.length);
        } else if (rootDir === '/') {
            relative = pagePath.substring(1);
        } else {
            relative = pagePath.replace(/^\//, '');
        }

        const parts = relative.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && last.includes('.')) parts.pop();
        return parts.length ? '../'.repeat(parts.length) : '';
    }

    const pathPrefix = getPathPrefix();
    const indexUrl = `${pathPrefix}index.html`;
    const logoPath = `${pathPrefix}Resources/images/VineTurtleStudio.png`;
    const path = window.location.pathname;
    const isSpecialPage = path.includes('/SpecialPages/') || path.includes('/privacy/');

    function getCurrentSection() {
        if (path.includes('/SpecialPages/Blog/')) return 'blog';
        if (path.includes('/SpecialPages/Project/')) return 'project';
        if (path.includes('/SpecialPages/Gallery/')) return 'gallery';
        if (path.includes('/SpecialPages/Search/')) return 'search';
        return '';
    }
    const currentSection = getCurrentSection();

    // 暴露根路径，供其他脚本读取 data/ 下的配置
    window.VTS = window.VTS || {};
    window.VTS.root = pathPrefix;

    // i18n 快捷方式：i18n.js 先于本脚本加载，t() 始终可用（缺 key 回退简中）
    const t = function (key, vars) {
        return window.VTS && window.VTS.t ? window.VTS.t(key, vars) : key;
    };

    // ---------- 导航模板（data-i18n 标记供语言切换就地刷新） ----------
    const homeNav = `
        <a href="#page-home" class="nav-link" data-page="home" data-i18n="nav.home">${t('nav.home')}</a>
        <a href="#page-about" class="nav-link" data-page="about" data-i18n="nav.about">${t('nav.about')}</a>
        <a href="#page-works" class="nav-link" data-page="works" data-i18n="nav.works">${t('nav.works')}</a>
        <a href="#page-more" class="nav-link" data-page="more" data-i18n="nav.more">${t('nav.more')}</a>
        <a href="${pathPrefix}SpecialPages/Search/index.html" class="nav-link" data-i18n="nav.search">${t('nav.search')}</a>
    `;

    const specialNav = `
        <a href="${indexUrl}" class="nav-link" data-i18n="nav.main">${t('nav.main')}</a>
        <a href="${pathPrefix}SpecialPages/Blog/index.html" class="nav-link${currentSection === 'blog' ? ' active' : ''}"${currentSection === 'blog' ? ' aria-current="page"' : ''} data-i18n="nav.blog">${t('nav.blog')}</a>
        <a href="${pathPrefix}SpecialPages/Project/index.html" class="nav-link${currentSection === 'project' ? ' active' : ''}"${currentSection === 'project' ? ' aria-current="page"' : ''} data-i18n="nav.project">${t('nav.project')}</a>
        <a href="${pathPrefix}SpecialPages/Gallery/index.html" class="nav-link${currentSection === 'gallery' ? ' active' : ''}"${currentSection === 'gallery' ? ' aria-current="page"' : ''} data-i18n="nav.gallery">${t('nav.gallery')}</a>
        <a href="${pathPrefix}SpecialPages/Search/index.html" class="nav-link${currentSection === 'search' ? ' active' : ''}"${currentSection === 'search' ? ' aria-current="page"' : ''} data-i18n="nav.search">${t('nav.search')}</a>
    `;

    const logoHref = isSpecialPage ? indexUrl : '#page-home';

    // ---------- 公共头部 ----------
    const headerHTML = `
        <header class="header" id="siteHeader">
            <div class="header-container">
                <div class="logo-area">
                    <a href="${logoHref}" id="logoLink">
                        <img src="${logoPath}" alt="${t('site.name')}" class="header-logo" data-i18n-attrs="alt:site.name">
                        <span class="header-title" data-i18n="site.name">${t('site.name')}</span>
                    </a>
                </div>
                <div class="header-right">
                    <nav class="main-nav" id="mainNav" aria-label="${t('nav.mainNav')}" data-i18n-attrs="aria-label:nav.mainNav">
                        ${isSpecialPage ? specialNav : homeNav}
                    </nav>
                    <button class="palette-trigger" id="paletteTrigger" type="button" aria-label="${t('a11y.openSearch')}" aria-haspopup="dialog" aria-expanded="false" title="${t('a11y.searchShortcut')}" data-i18n-attrs="aria-label:a11y.openSearch,title:a11y.searchShortcut">
                        <span class="palette-trigger-icon" aria-hidden="true">🔍</span>
                        <kbd class="palette-trigger-kbd">Ctrl K</kbd>
                    </button>
                    <button class="theme-toggle" id="themeToggle" type="button" aria-label="${t('a11y.themeDark')}" title="${t('a11y.themeToggle')}" aria-pressed="false" data-i18n-attrs="title:a11y.themeToggle">
                        <span class="theme-icon" aria-hidden="true">🌙</span>
                    </button>
                    <button class="nav-toggle" id="navToggle" type="button" aria-label="${t('a11y.menuOpen')}" aria-expanded="false" aria-controls="mainNav">☰</button>
                    <div class="lang-switcher" id="langSwitcher"></div>
                </div>
            </div>
        </header>
    `;

    // ---------- 公共底部 ----------
    const footerHTML = `
    <footer class="footer">
        <p>© <span id="footerYear">2026</span> <span data-i18n="footer.copyright">${t('footer.copyright')}</span></p>
        <p class="privacy-row">
            <a href="${pathPrefix}SpecialPages/Search/index.html" class="privacy-link" data-i18n="footer.search">${t('footer.search')}</a>
            <span aria-hidden="true"> · </span>
            <a href="${pathPrefix}feed.xml" class="privacy-link" data-i18n="footer.rss">${t('footer.rss')}</a>
            <span aria-hidden="true"> · </span>
            <a href="${pathPrefix}privacy/privacy.html" class="privacy-link" data-i18n="footer.privacy">${t('footer.privacy')}</a>
        </p>
    </footer>
`;

    // ---------- 挂载 ----------
    document.addEventListener('DOMContentLoaded', function () {
        const headerPlaceholder = document.getElementById('header-placeholder');
        const footerPlaceholder = document.getElementById('footer-placeholder');
        const main = document.querySelector('main');

        if (main && !main.id) main.id = 'mainContent';

        // 跳到主内容（放在 body 最前面）
        if (main) {
            const skip = document.createElement('a');
            skip.className = 'skip-link';
            skip.href = '#' + main.id;
            skip.textContent = t('common.skipToContent');
            skip.setAttribute('data-i18n', 'common.skipToContent');
            document.body.insertBefore(skip, document.body.firstChild);
        }

        if (headerPlaceholder) headerPlaceholder.innerHTML = headerHTML;
        if (footerPlaceholder) footerPlaceholder.innerHTML = footerHTML;

        // header 注入后才存在 #langSwitcher，此时挂载切换器
        if (window.VTS && VTS.i18n && VTS.i18n.mountSwitcher) VTS.i18n.mountSwitcher();

        // header/footer 是动态注入的，注入后刷一次静态文案（含 aria/title/alt）
        if (window.VTS && VTS.i18n && VTS.i18n.applyStatic) {
            VTS.i18n.applyStatic(document.getElementById('siteHeader'));
            VTS.i18n.applyStatic(document.querySelector('.footer'));
        }

        const yearEl = document.getElementById('footerYear');
        if (yearEl) yearEl.textContent = String(new Date().getFullYear());

        initBackToTop();
        initHeader();
        initTheme();
        initCommandPalette();
        initImageZoom();

        if (!isSpecialPage) initSPA();
    });

    // 语言切换：刷新主题/菜单按钮的动态 aria、月份徽标，并重置切换器选中态
    window.addEventListener('vts:langchange', function () {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) themeBtn.setAttribute('aria-label', t(isDark ? 'a11y.themeLight' : 'a11y.themeDark'));
        const navToggle = document.getElementById('navToggle');
        const mainNav = document.getElementById('mainNav');
        if (navToggle && mainNav) {
            const open = mainNav.classList.contains('open');
            navToggle.setAttribute('aria-label', t(open ? 'a11y.menuClose' : 'a11y.menuOpen'));
        }
        const backTop = document.getElementById('backToTop');
        if (backTop) backTop.setAttribute('aria-label', t('a11y.backToTop'));

        // 搜索弹层：刷新静态文案、计数，并按当前查询重渲染结果
        const palette = document.getElementById('cmdPalette');
        if (palette) {
            VTS.i18n.applyStatic(palette);
            const count = document.getElementById('cmdCount');
            if (count) count.textContent = t('palette.count', { count: (paletteState.entries || []).length });
            const input = document.getElementById('cmdInput');
            if (input && !palette.hidden) renderPalette(input.value);
        }
        if (window.updateMonthColors) window.updateMonthColors();
        // 重设当前页文档标题
        if (!isSpecialPage) {
            const hash = window.location.hash;
            const page = hash && hash.indexOf('#page-') === 0 ? hash.slice(6) : 'home';
            const map = { home: 'title.home', about: 'title.about', works: 'title.works', more: 'title.more' };
            document.title = t(map[page] || 'title.home');
        }
    });

    // ---------- 主题：深色 / 浅色 ----------
    const THEME_KEY = 'vts-theme';

    function storedTheme() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    function applyTheme(theme, persist) {
        const isDark = theme === 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme-mode', persist || storedTheme() ? 'manual' : 'auto');
        document.documentElement.style.colorScheme = theme;
        if (persist) {
            try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式下忽略 */ }
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDark ? '#0f1511' : '#2a5c3a');
        const btn = document.getElementById('themeToggle');
        if (btn) {
            const icon = btn.querySelector('.theme-icon');
            if (icon) icon.textContent = isDark ? '☀️' : '🌙';
            btn.setAttribute('aria-label', t(isDark ? 'a11y.themeLight' : 'a11y.themeDark'));
            btn.setAttribute('aria-pressed', String(isDark));
        }
    }

    function initTheme() {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        applyTheme(current, false);

        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.addEventListener('click', function () {
                const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                applyTheme(next, true);
            });
        }

        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        if (!mq) return;
        const onChange = function (e) {
            if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light', false);
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    // ---------- 全站搜索弹层（Ctrl / ⌘ + K） ----------
    const paletteState = { entries: null, loading: null, filtered: [], active: -1, lastFocus: null };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function loadPaletteIndex() {
        if (paletteState.entries) return Promise.resolve(paletteState.entries);
        if (paletteState.loading) return paletteState.loading;
        paletteState.loading = fetch(pathPrefix + 'data/search-index.json', { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                paletteState.entries = Array.isArray(data) ? data : [];
                paletteState.loading = null;
                const count = document.getElementById('cmdCount');
                if (count) count.textContent = t('palette.count', { count: paletteState.entries.length });
                return paletteState.entries;
            })
            .catch(function (err) {
                paletteState.loading = null;
                throw err;
            });
        return paletteState.loading;
    }

    function paletteSearch(query) {
        const entries = paletteState.entries || [];
        const q = String(query == null ? '' : query).trim().toLowerCase();
        if (!q) return entries.slice(0, 10);
        const tokens = q.split(/\s+/).filter(Boolean);
        return entries.map(function (item) {
            const title = String(item.title || '').toLowerCase();
            const desc = String(item.desc || '').toLowerCase();
            const tags = (item.tags || []).join(' ').toLowerCase();
            const kind = String(item.kindLabel || '').toLowerCase();
            let score = 0;
            let hit = true;
            tokens.forEach(function (token) {
                let found = false;
                if (title.indexOf(token) !== -1) { score += 8; found = true; }
                if (tags.indexOf(token) !== -1) { score += 4; found = true; }
                if (kind.indexOf(token) !== -1) { score += 2; found = true; }
                if (desc.indexOf(token) !== -1) { score += 1; found = true; }
                if (!found) hit = false;
            });
            if (!hit) return null;
            if (title.indexOf(q) !== -1) score += 6;
            return { item: item, score: score };
        }).filter(Boolean).sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return String(b.item.date || '').localeCompare(String(a.item.date || ''));
        }).slice(0, 10).map(function (row) { return row.item; });
    }

    function paletteItemHtml(item) {
        const tags = (item.tags || []).slice(0, 1).map(function (t) { return '#' + t; }).join('');
        const meta = [item.kindLabel, item.date, tags].filter(Boolean).join(' · ');
        const href = pathPrefix + item.url;
        return '<a class="cmd-item" role="option" aria-selected="false" href="' + escapeHtml(href) + '">'
            + '<span class="cmd-item-icon" aria-hidden="true">' + escapeHtml(item.icon || '📄') + '</span>'
            + '<span class="cmd-item-main">'
            + '<span class="cmd-item-title">' + escapeHtml(item.title || '') + '</span>'
            + '<span class="cmd-item-meta">' + escapeHtml(meta) + '</span>'
            + '</span>'
            + '<span class="cmd-item-arrow" aria-hidden="true">↵</span>'
            + '</a>';
    }

    function setPaletteActive(index) {
        const results = document.getElementById('cmdResults');
        if (!results) return;
        const items = results.querySelectorAll('.cmd-item');
        if (!items.length) return;
        const next = Math.max(0, Math.min(items.length - 1, index));
        paletteState.active = next;
        items.forEach(function (item, i) {
            const on = i === next;
            item.classList.toggle('is-active', on);
            item.setAttribute('aria-selected', String(on));
            if (on && item.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
        });
    }

    function renderPalette(query) {
        const results = document.getElementById('cmdResults');
        if (!results) return;
        if (!paletteState.entries && paletteState.loading) {
            results.innerHTML = '<div class="cmd-empty"><span class="cmd-empty-icon">⏳</span><p data-i18n="palette.loading">' + t('palette.loading') + '</p></div>';
            return;
        }
        const list = paletteSearch(query);
        paletteState.filtered = list;
        paletteState.active = list.length ? 0 : -1;
        if (!list.length) {
            const hasQuery = !!String(query || '').trim();
            const emptyKey = hasQuery ? 'palette.emptyQuery' : 'palette.emptyIndex';
            const emptyText = t(emptyKey);
            const emptyHtml = '<div class="cmd-empty"><span class="cmd-empty-icon">🌱</span><p data-i18n="' + emptyKey + '">' + escapeHtml(emptyText) + '</p></div>';
            results.innerHTML = emptyHtml;
            return;
        }
        results.innerHTML = list.map(paletteItemHtml).join('');
        setPaletteActive(0);
    }

    function openPalette() {
        const overlay = document.getElementById('cmdPalette');
        const input = document.getElementById('cmdInput');
        const results = document.getElementById('cmdResults');
        if (!overlay || !input) return;

        paletteState.lastFocus = document.activeElement;
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';
        const trigger = document.getElementById('paletteTrigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        input.value = '';
        input.focus();

        if (paletteState.entries) {
            renderPalette('');
            return;
        }
        if (results) results.innerHTML = '<div class="cmd-empty"><span class="cmd-empty-icon">⏳</span><p data-i18n="palette.loading">' + t('palette.loading') + '</p></div>';
        loadPaletteIndex().then(function () {
            renderPalette(input.value);
        }).catch(function () {
            if (results) results.innerHTML = '<div class="cmd-empty"><span class="cmd-empty-icon">⚠️</span><p data-i18n="palette.loadFail">' + t('palette.loadFail') + '</p></div>';
        });
    }

    function closePalette() {
        const overlay = document.getElementById('cmdPalette');
        if (!overlay || overlay.hidden) return;
        overlay.hidden = true;
        document.body.style.overflow = '';
        const trigger = document.getElementById('paletteTrigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        if (paletteState.lastFocus && typeof paletteState.lastFocus.focus === 'function') {
            paletteState.lastFocus.focus();
        }
    }

    function initCommandPalette() {
        if (document.getElementById('cmdPalette')) return;

        const overlay = document.createElement('div');
        overlay.className = 'cmd-overlay';
        overlay.id = 'cmdPalette';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="cmd-dialog" role="dialog" aria-modal="true" aria-label="${t('palette.label')}" data-i18n-attrs="aria-label:palette.label">
                <div class="cmd-input-row">
                    <span class="cmd-search-icon" aria-hidden="true">🔍</span>
                    <label class="visually-hidden" for="cmdInput" data-i18n="a11y.searchSite">${t('a11y.searchSite')}</label>
                    <input id="cmdInput" type="text" placeholder="${t('palette.placeholder')}" data-i18n-attrs="placeholder:palette.placeholder" autocomplete="off" spellcheck="false" aria-controls="cmdResults" aria-autocomplete="list" />
                    <kbd class="cmd-esc">Esc</kbd>
                </div>
                <div class="cmd-results" id="cmdResults" role="listbox" aria-label="${t('a11y.searchResults')}" data-i18n-attrs="aria-label:a11y.searchResults"></div>
                <div class="cmd-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> <span data-i18n="palette.select">${t('palette.select')}</span></span>
                    <span><kbd>Enter</kbd> <span data-i18n="palette.open">${t('palette.open')}</span></span>
                    <span><kbd>Esc</kbd> <span data-i18n="palette.close">${t('palette.close')}</span></span>
                    <span class="cmd-footer-note"><span id="cmdCount">${t('palette.count', { count: 0 })}</span></span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('cmdInput');
        const results = document.getElementById('cmdResults');
        const trigger = document.getElementById('paletteTrigger');
        const pageSearch = document.getElementById('searchInput');

        if (trigger && pageSearch) {
            trigger.addEventListener('click', function (e) {
                e.preventDefault();
                pageSearch.focus();
                pageSearch.select();
            });
            trigger.style.display = 'none';
        } else if (trigger) {
            trigger.addEventListener('click', function (e) {
                e.preventDefault();
                openPalette();
            });
        }

        input.addEventListener('input', function () { renderPalette(input.value); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPaletteActive(paletteState.active + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPaletteActive(paletteState.active - 1);
            } else if (e.key === 'Enter') {
                const active = results.querySelector('.cmd-item.is-active');
                if (active) {
                    e.preventDefault();
                    window.location.href = active.href;
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closePalette();
            }
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closePalette();
        });

        results.addEventListener('mousemove', function (e) {
            const item = e.target.closest ? e.target.closest('.cmd-item') : null;
            if (!item) return;
            const items = Array.prototype.slice.call(results.querySelectorAll('.cmd-item'));
            setPaletteActive(items.indexOf(item));
        });

        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
                e.preventDefault();
                if (pageSearch) {
                    pageSearch.focus();
                    pageSearch.select();
                } else {
                    openPalette();
                }
            }
        });

        // 焦点保持在弹层内
        overlay.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab') return;
            const focusables = overlay.querySelectorAll('input, a[href], button');
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    // ---------- 正文图片点击放大 ----------
    function initImageZoom() {
        if (document.getElementById('imageZoom')) return;

        const overlay = document.createElement('div');
        overlay.className = 'image-zoom';
        overlay.id = 'imageZoom';
        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', t('a11y.viewImage'));
        overlay.setAttribute('data-i18n-attrs', 'aria-label:a11y.viewImage');
        overlay.innerHTML = `
            <button class="image-zoom-close" type="button" aria-label="${t('a11y.closeImage')}" data-i18n-attrs="aria-label:a11y.closeImage">×</button>
            <figure class="image-zoom-figure">
                <img id="imageZoomImg" alt="">
                <figcaption class="image-zoom-caption" id="imageZoomCaption"></figcaption>
            </figure>
            <a class="image-zoom-open" id="imageZoomOpen" href="#" target="_blank" rel="noopener" data-i18n="a11y.openNewTab">${t('a11y.openNewTab')}</a>
        `;
        document.body.appendChild(overlay);

        const image = document.getElementById('imageZoomImg');
        const caption = document.getElementById('imageZoomCaption');
        const openLink = document.getElementById('imageZoomOpen');
        const closeBtn = overlay.querySelector('.image-zoom-close');
        let lastFocus = null;

        function open(img) {
            const src = img.currentSrc || img.src;
            if (!src) return;
            lastFocus = document.activeElement;
            image.src = src;
            image.alt = img.alt || '';
            caption.textContent = img.alt || '';
            caption.hidden = !img.alt;
            openLink.href = src;
            overlay.hidden = false;
            document.body.style.overflow = 'hidden';
            closeBtn.focus();
        }

        function close() {
            overlay.hidden = true;
            document.body.style.overflow = '';
            image.removeAttribute('src');
            if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
        }

        function markImages(scope) {
            const root = scope && scope.querySelectorAll ? scope : document;
            root.querySelectorAll('.post-body img, .detail-body img, .privacy-container img, .hero-img-wrap img').forEach(function (img) {
                if (img.dataset.zoomBound) return;
                img.dataset.zoomBound = '1';
                if (img.closest('a')) return;
                img.classList.add('zoomable-image');
                img.tabIndex = 0;
                img.setAttribute('role', 'button');
                img.setAttribute('aria-label', img.alt
                    ? t('a11y.viewImageAlt', { alt: img.alt })
                    : t('a11y.viewImage'));
                img.addEventListener('click', function () { open(img); });
                img.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open(img);
                    }
                });
            });
        }

        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        document.addEventListener('keydown', function (e) {
            if (!overlay.hidden && e.key === 'Escape') close();
        });

        const main = document.querySelector('main') || document.body;
        markImages(main);
        if (window.MutationObserver) {
            new MutationObserver(function () { markImages(main); })
                .observe(main, { childList: true, subtree: true });
        }
    }

    // ---------- 头部：高度、紧凑、自动隐藏、移动抽屉 ----------
    function initHeader() {
        const header = document.getElementById('siteHeader');
        if (!header) return;

        const nav = document.getElementById('mainNav');
        const toggle = document.getElementById('navToggle');
        const badge = document.getElementById('monthBadge');
        const backTop = document.getElementById('backToTop');

        function syncHeaderHeight() {
            const h = header.offsetHeight;
            if (h > 0) document.documentElement.style.setProperty('--header-h', h + 'px');
        }
        syncHeaderHeight();
        window.addEventListener('resize', syncHeaderHeight, { passive: true });

        if (!nav || !toggle) return;

        function setNavOpen(open) {
            nav.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', t(open ? 'a11y.menuClose' : 'a11y.menuOpen'));
            toggle.textContent = open ? '✕' : '☰';
            if (open) header.classList.remove('is-hidden');
        }

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            setNavOpen(!nav.classList.contains('open'));
        });

        nav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () { setNavOpen(false); });
        });

        document.addEventListener('click', function (e) {
            if (!nav.classList.contains('open')) return;
            if (!nav.contains(e.target) && !toggle.contains(e.target)) setNavOpen(false);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav.classList.contains('open')) {
                setNavOpen(false);
                toggle.focus();
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 760) setNavOpen(false);
            syncHeaderHeight();
        }, { passive: true });

        let lastY = window.scrollY || 0;
        let downDistance = 0;
        let ticking = false;

        function updateOnScroll() {
            const y = window.scrollY || document.documentElement.scrollTop || 0;
            const delta = y - lastY;
            const navOpen = nav.classList.contains('open');
            const focusInHeader = header.contains(document.activeElement);

            header.classList.toggle('is-scrolled', y > 8);
            header.classList.toggle('is-compact', y > 24);

            if (delta > 0) downDistance += delta;
            else downDistance = 0;

            if (y < 80 || navOpen || focusInHeader) {
                header.classList.remove('is-hidden');
                downDistance = 0;
            } else if (downDistance > 24) {
                header.classList.add('is-hidden');
            } else if (delta < -4) {
                header.classList.remove('is-hidden');
            }

            if (badge) badge.classList.toggle('is-hidden', y > 320);
            if (backTop) backTop.classList.toggle('show', y > 600);

            lastY = y;
            ticking = false;
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(updateOnScroll);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        updateOnScroll();
    }

    // ---------- 回到顶部 ----------
    function initBackToTop() {
        if (document.getElementById('backToTop')) return;
        const btn = document.createElement('button');
        btn.id = 'backToTop';
        btn.className = 'back-to-top';
        btn.type = 'button';
        btn.setAttribute('aria-label', t('a11y.backToTop'));
        btn.setAttribute('data-i18n-attrs', 'aria-label:a11y.backToTop');
        btn.textContent = '↑';
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.body.appendChild(btn);
    }

    // ---------- SPA 切换（仅 hashchange 驱动） ----------
    function initSPA() {
        const titles = {
            home: 'title.home',
            about: 'title.about',
            works: 'title.works',
            more: 'title.more'
        };

        function switchPage(pageId) {
            if (!pageId) return;
            document.querySelectorAll('.page-section').forEach(function (el) {
                el.classList.remove('active');
            });
            const target = document.getElementById('page-' + pageId);
            if (target) {
                target.classList.add('active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            document.querySelectorAll('.nav-link[data-page]').forEach(function (link) {
                const active = link.dataset.page === pageId;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
            if (titles[pageId]) document.title = t(titles[pageId]);
        }

        function getPageFromHash() {
            const hash = window.location.hash;
            if (hash.startsWith('#page-')) return hash.replace('#page-', '');
            return 'home';
        }

        switchPage(getPageFromHash());

        window.addEventListener('hashchange', function () {
            switchPage(getPageFromHash());
            const nav = document.getElementById('mainNav');
            const toggle = document.getElementById('navToggle');
            if (nav && toggle) {
                nav.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-label', t('a11y.menuOpen'));
                toggle.textContent = '☰';
            }
        });
    }
})();
