// JS/layout.js
(function() {
    // ---------- 根据脚本位置推断根目录，并计算路径前缀 ----------
    function getPathPrefix() {
        // 1. 获取当前脚本的绝对 URL
        const scriptSrc = document.currentScript.src;
        const url = new URL(scriptSrc);
        let scriptPath = url.pathname; // 例如 "/JS/layout.js" 或 "/myapp/JS/layout.js"

        // 2. 去掉文件名，得到脚本所在目录（以 / 结尾）
        const lastSlash = scriptPath.lastIndexOf('/');
        const scriptDir = scriptPath.substring(0, lastSlash + 1); // 例如 "/JS/"

        // 3. 假设脚本在根目录下的 JS/ 文件夹，则根目录是脚本目录的父目录
        //    如果脚本目录就是根目录（例如根目录下直接放 layout.js），则根目录就是脚本目录本身
        //    这里我们约定脚本放在 JS/ 下，所以根目录为 scriptDir 的上一级
        let rootDir = scriptDir.replace(/\/JS\/$/, '/'); // 去掉末尾的 JS/
        // 如果 scriptDir 不是以 /JS/ 结尾，则直接取父目录
        if (rootDir === scriptDir) {
            // 若没有 JS/ 子目录，则取父目录（去掉最后一个目录）
            const parts = scriptDir.split('/').filter(p => p.length > 0);
            parts.pop(); // 去掉最后一个目录（即脚本所在目录名）
            rootDir = '/' + parts.join('/') + '/';
            if (rootDir === '//') rootDir = '/';
        }

        // 4. 计算当前页面路径相对于 rootDir 的深度
        const pagePath = window.location.pathname; // 例如 "/SpecialPages/page.html" 或 "/myapp/SpecialPages/page.html"
        let relative = '';
        if (pagePath.startsWith(rootDir)) {
            relative = pagePath.substring(rootDir.length);
        } else {
            // 如果 rootDir 是 '/'，则直接去掉开头的 '/'
            if (rootDir === '/') {
                relative = pagePath.substring(1);
            } else {
                // 容错：如果页面路径不以 rootDir 开头，则按原逻辑处理（备用）
                relative = pagePath.replace(/^\//, '');
            }
        }
        // 按 / 分割，过滤空项
        let parts = relative.split('/').filter(p => p.length > 0);
        // 如果最后一部分包含 '.'，认为是文件名，去掉
        const last = parts[parts.length - 1];
        if (last && last.includes('.')) {
            parts.pop();
        }
        // 深度 = 目录数量
        const depth = parts.length;
        // 生成前缀：depth 个 '../'
        return depth > 0 ? '../'.repeat(depth) : '';
    }

    const pathPrefix = getPathPrefix();

    // ---------- 构建带前缀的资源路径 ----------
    const indexUrl = `${pathPrefix}index.html`;
    const logoPath = `${pathPrefix}Resources/images/VineTurtleStudio.png`;

    // ---------- 导航模板 ----------
    const homeNav = `
        <a href="#page-home" class="nav-link" data-page="home">🏠 首页</a>
        <a href="#page-about" class="nav-link" data-page="about">📖 关于</a>
        <a href="#page-works" class="nav-link" data-page="works">🎨 作品</a>
        <a href="#page-more" class="nav-link" data-page="more">🌿 更多</a>
    `;

    // 特殊页面的导航链接（跳转主页，带 hash）
    const specialNav = `
        <a href="${indexUrl}" class="nav-link">🏠 返回主页</a>
        <a href="${indexUrl}#page-about" class="nav-link">📖 关于</a>
        <a href="${indexUrl}#page-works" class="nav-link">🎨 作品</a>
        <a href="${indexUrl}#page-more" class="nav-link">🌿 更多</a>
    `;

    //const isSpecialPage = window.location.pathname.includes('/SpecialPages/');
    const isSpecialPage = window.location.pathname.includes('/SpecialPages/') || window.location.pathname.includes('/privacy/');
    // ---------- 公共头部 ----------
    const headerHTML = `
        <header class="header">
            <div class="header-container">
                <div class="logo-area">
                    <a href="${indexUrl}" id="logoLink">
                        <img src="${logoPath}" alt="藤栖龟舍" class="header-logo">
                        <span class="header-title">藤栖龟舍</span>
                    </a>
                </div>
                <nav class="main-nav" id="mainNav">
                    ${isSpecialPage ? specialNav : homeNav}
                </nav>
            </div>
        </header>
    `;

    // ---------- 公共底部 ----------
    const footerHTML = `
    <footer class="footer">
        <p>© 2026 藤栖龟舍 VineTurtle Studio. 林间岁月，温柔相守。</p>
        <p style="margin-top: 6px; font-size: 0.8rem;">
            <a href="../privacy/privacy.html" style="color: var(--primary, #2a5c3a); text-decoration: underline; opacity: 0.7;">隐私策略</a>
        </p>
    </footer>
`;

    // ---------- 挂载模板 ----------
    document.addEventListener('DOMContentLoaded', function() {
        const headerPlaceholder = document.getElementById('header-placeholder');
        const footerPlaceholder = document.getElementById('footer-placeholder');
        if (headerPlaceholder) headerPlaceholder.innerHTML = headerHTML;
        if (footerPlaceholder) footerPlaceholder.innerHTML = footerHTML;

        // 只有主页启用 SPA 切换（非特殊页面）
        if (!isSpecialPage) {
            initSPA();
        }

        updateMonthBadge();
    });

    // ---------- SPA 切换（仅 hashchange 驱动） ----------
    function initSPA() {
        function switchPage(pageId) {
            if (!pageId) return;
            document.querySelectorAll('.page-section').forEach(el => {
                el.classList.remove('active');
            });
            const target = document.getElementById(`page-${pageId}`);
            if (target) {
                target.classList.add('active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            document.querySelectorAll('.nav-link[data-page]').forEach(link => {
                link.classList.toggle('active', link.dataset.page === pageId);
            });
        }
        window.switchPage = switchPage;

        function getPageFromHash() {
            const hash = window.location.hash;
            if (hash.startsWith('#page-')) {
                return hash.replace('#page-', '');
            }
            return 'home';
        }

        // 首次加载
        const initialPage = getPageFromHash();
        switchPage(initialPage);

        // 监听 hashchange
        window.addEventListener('hashchange', function() {
            const page = getPageFromHash();
            switchPage(page);
        });
    }

    // ---------- 月份徽标 ----------
    function updateMonthBadge() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const badge = document.getElementById('monthBadge');
        if (badge) {
            const icons = ['❄️','🌲','🌱','🌸','🌿','🍊','💜','🌾','🍇','🍁','🌫️','🎄'];
            badge.textContent = `${icons[month-1] || '🌿'} ${month}月`;
        }
    }
})();