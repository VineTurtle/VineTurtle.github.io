// JS/layout.js
(function() {
    // ---------- 检测当前页面类型 ----------
    const isSpecialPage = window.location.pathname.includes('SpecialPages/');

    // ---------- 导航模板 ----------
    const homeNav = `
        <a href="#" class="nav-link" data-page="home">🏠 首页</a>
        <a href="#" class="nav-link" data-page="about">📖 关于</a>
        <a href="#" class="nav-link" data-page="works">🎨 作品</a>
        <a href="#" class="nav-link" data-page="more">🌿 更多</a>
    `;

    const specialNav = `
        <a href="../index.html" class="nav-link">🏠 返回主页</a>
        <a href="../index.html#page-about" class="nav-link">📖 关于</a>
        <a href="../index.html#page-works" class="nav-link">🎨 作品</a>
        <a href="../index.html#page-more" class="nav-link">🌿 更多</a>
    `;

    // ---------- 公共头部 ----------
    const headerHTML = `
        <header class="header">
            <div class="header-container">
                <div class="logo-area">
                    <a href="#" id="logoLink">
                        <img src="${isSpecialPage ? '../Resources/images/VineTurtleStudio.png' : './Resources/images/VineTurtleStudio.png'}" alt="藤栖龟舍" class="header-logo">
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
        </footer>
    `;

    // ---------- 挂载模板 ----------
    document.addEventListener('DOMContentLoaded', function() {
        const headerPlaceholder = document.getElementById('header-placeholder');
        const footerPlaceholder = document.getElementById('footer-placeholder');

        if (headerPlaceholder) headerPlaceholder.innerHTML = headerHTML;
        if (footerPlaceholder) footerPlaceholder.innerHTML = footerHTML;

        // 只有主页启用 SPA 切换
        if (!isSpecialPage) {
            initSPA();
        }

        updateMonthBadge();
    });

    // ---------- SPA 切换逻辑 ----------
    function initSPA() {
        // 默认显示首页
        switchPage('home');

        // 全局点击监听：点击任何带有 data-page 的元素都触发切换
        document.addEventListener('click', function(e) {
            const target = e.target.closest('[data-page]');

            // ✅ 关键修复：如果点击的是 <a> 标签（外部链接），不要阻止默认行为
            const isAnchor = e.target.closest('a');
            if (isAnchor && !isAnchor.hasAttribute('data-page')) {
                // 这是普通链接，让浏览器正常跳转
                return;
            }

            if (target) {
                e.preventDefault();
                const pageId = target.dataset.page;
                switchPage(pageId);
                return;
            }

            // Logo 回到首页
            const logo = e.target.closest('#logoLink');
            if (logo) {
                e.preventDefault();
                switchPage('home');
            }
        });

        // 暴露到全局
        window.switchPage = switchPage;
    }

    // ---------- 切换页面核心函数 ----------
    function switchPage(pageId) {
        if (!pageId) return;

        // 隐藏所有页面
        document.querySelectorAll('.page-section').forEach(el => {
            el.classList.remove('active');
        });

        // 显示目标页面
        const target = document.getElementById(`page-${pageId}`);
        if (target) {
            target.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // 更新导航高亮：只有 data-page 的导航项才参与高亮
        document.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
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