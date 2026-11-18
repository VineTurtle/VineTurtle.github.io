// JS/script.js
(function() {
    const MONTH_ICONS = ['❄️', '🌲', '🌱', '🌸', '🌿', '🍊', '💜', '🌾', '🍇', '🍁', '🌫️', '🎄'];

    // 月份变色逻辑
    function updateMonthColors() {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;

        // 只维护 month-x 类，避免覆盖 body 上的其他类
        for (let m = 1; m <= 12; m++) {
            document.body.classList.toggle('month-' + m, m === currentMonth);
        }

        // 更新月份徽标：英文字典的模板是「{icon} {month}」，需要月份名而不是数字（R8）
        const t = window.VTS && window.VTS.t ? window.VTS.t : function (k, v) { return k; };
        const lang = (window.VTS && window.VTS.lang) || 'zh-CN';
        const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthValue = lang === 'en' ? MONTHS_EN[currentMonth - 1] : currentMonth;
        const badge = document.getElementById('monthBadge');
        if (badge) {
            badge.textContent = t('common.monthBadge', { icon: MONTH_ICONS[currentMonth - 1] || '🌿', month: monthValue });
        }

        // 更新月份显示（如果页面里有）
        const monthEl = document.querySelector('.month-indicator');
        if (monthEl) {
            monthEl.textContent = t('common.monthIndicator', { month: currentMonth });
        }
    }

    // 暴露给 layout.js 调用
    window.updateMonthColors = updateMonthColors;

    // 页面加载时执行
    document.addEventListener('DOMContentLoaded', updateMonthColors);
})();

// ---------- 站内链接预取（A2） ----------
// hover/focus/触摸时预取目标页 HTML，依赖 HTTP 缓存（GitHub Pages max-age=600）加速整页导航。
// 预取不执行 JS，不影响点赞/阅读量等动态逻辑（R34）；失败静默，点击后照常导航。
(function () {
    'use strict';

    // 本地 file:// 预览与低流量模式不预取（R33）
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;

    const seen = Object.create(null);
    const timers = new WeakMap();

    function prefetchable(url) {
        if (url.origin !== location.origin) return false; // 外链/协议异常（mailto: 等）不预取
        if (url.search || url.hash) return false;         // 动态兼容路径（?slug=）与锚点不预取
        if (url.pathname.startsWith('/admin')) return false;
        if (!url.pathname.endsWith('.html') && !url.pathname.endsWith('/')) return false; // 仅页面
        if (url.href === location.origin + location.pathname) return false; // 当前页本身
        return true;
    }

    function prefetch(href) {
        let url;
        try { url = new URL(href, location.href); } catch (e) { return; }
        if (!prefetchable(url) || seen[url.href]) return;
        seen[url.href] = true;
        fetch(url.href).catch(function () { /* 预取失败无副作用 */ });
    }

    function linkFromEvent(e) {
        return e.target && e.target.closest ? e.target.closest('a[href]') : null;
    }

    document.addEventListener('mouseover', function (e) {
        const link = linkFromEvent(e);
        if (!link || seen[link.href] || timers.get(link)) return;
        timers.set(link, setTimeout(function () {
            timers.delete(link);
            prefetch(link.href);
        }, 80));
    });
    document.addEventListener('mouseout', function (e) {
        const link = linkFromEvent(e);
        const timer = link && timers.get(link);
        if (timer) { clearTimeout(timer); timers.delete(link); }
    });
    // 键盘聚焦与触屏是无意图探测的点击前奏，立即预取
    document.addEventListener('focusin', function (e) {
        const link = linkFromEvent(e);
        if (link) prefetch(link.href);
    });
    document.addEventListener('touchstart', function (e) {
        const link = linkFromEvent(e);
        if (link) prefetch(link.href);
    }, { passive: true });
})();
