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

    // ---------- 导航模板 ----------
    const homeNav = `
        <a href="#page-home" class="nav-link" data-page="home">🏠 首页</a>
        <a href="#page-about" class="nav-link" data-page="about">📖 关于</a>
        <a href="#page-works" class="nav-link" data-page="works">🎨 作品</a>
        <a href="#page-more" class="nav-link" data-page="more">🌿 更多</a>
        <a href="${pathPrefix}SpecialPages/Search/index.html" class="nav-link">🔍 搜索</a>
    `;

    const specialNav = `
        <a href="${indexUrl}" class="nav-link">🏠 主页</a>
        <a href="${pathPrefix}SpecialPages/Blog/index.html" class="nav-link${currentSection === 'blog' ? ' active' : ''}"${currentSection === 'blog' ? ' aria-current="page"' : ''}>📝 博客</a>
        <a href="${pathPrefix}SpecialPages/Project/index.html" class="nav-link${currentSection === 'project' ? ' active' : ''}"${currentSection === 'project' ? ' aria-current="page"' : ''}>🚀 项目</a>
        <a href="${pathPrefix}SpecialPages/Gallery/index.html" class="nav-link${currentSection === 'gallery' ? ' active' : ''}"${currentSection === 'gallery' ? ' aria-current="page"' : ''}>🖼️ 画廊</a>
        <a href="${pathPrefix}SpecialPages/Search/index.html" class="nav-link${currentSection === 'search' ? ' active' : ''}"${currentSection === 'search' ? ' aria-current="page"' : ''}>🔍 搜索</a>
    `;

    const logoHref = isSpecialPage ? indexUrl : '#page-home';

    // ---------- 公共头部 ----------
    const headerHTML = `
        <header class="header" id="siteHeader">
            <div class="header-container">
                <div class="logo-area">
                    <a href="${logoHref}" id="logoLink">
                        <img src="${logoPath}" alt="藤栖龟舍" class="header-logo">
                        <span class="header-title">藤栖龟舍</span>
                    </a>
                </div>
                <button class="nav-toggle" id="navToggle" type="button" aria-label="打开菜单" aria-expanded="false" aria-controls="mainNav">☰</button>
                <nav class="main-nav" id="mainNav" aria-label="主导航">
                    ${isSpecialPage ? specialNav : homeNav}
                </nav>
            </div>
        </header>
    `;

    // ---------- 公共底部 ----------
    const footerHTML = `
    <footer class="footer">
        <p>© <span id="footerYear">2026</span> 藤栖龟舍 VineTurtle Studio. 林间岁月，温柔相守。</p>
        <p class="privacy-row">
            <a href="${pathPrefix}SpecialPages/Search/index.html" class="privacy-link">搜索</a>
            <span aria-hidden="true"> · </span>
            <a href="${pathPrefix}feed.xml" class="privacy-link">RSS</a>
            <span aria-hidden="true"> · </span>
            <a href="${pathPrefix}privacy/privacy.html" class="privacy-link">隐私策略</a>
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
            skip.textContent = '跳到主要内容';
            document.body.insertBefore(skip, document.body.firstChild);
        }

        if (headerPlaceholder) headerPlaceholder.innerHTML = headerHTML;
        if (footerPlaceholder) footerPlaceholder.innerHTML = footerHTML;

        const yearEl = document.getElementById('footerYear');
        if (yearEl) yearEl.textContent = String(new Date().getFullYear());

        initBackToTop();
        initHeader();

        if (!isSpecialPage) initSPA();
    });

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
            toggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
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
        btn.setAttribute('aria-label', '回到顶部');
        btn.textContent = '↑';
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.body.appendChild(btn);
    }

    // ---------- SPA 切换（仅 hashchange 驱动） ----------
    function initSPA() {
        const titles = {
            home: '藤栖龟舍 - VineTurtle Studio',
            about: '关于 · 藤栖龟舍',
            works: '作品 · 藤栖龟舍',
            more: '更多 · 藤栖龟舍'
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
            if (titles[pageId]) document.title = titles[pageId];
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
                toggle.setAttribute('aria-label', '打开菜单');
                toggle.textContent = '☰';
            }
        });
    }
})();
