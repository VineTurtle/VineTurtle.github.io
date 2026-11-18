// JS/theme-init.js —— 在样式加载前确定主题，避免深色模式闪白
// 独立成阻塞脚本，必须放在 CSS 之前引入。
(function () {
    'use strict';

    var KEY = 'vts-theme';
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) { /* 隐私模式下忽略 */ }

    var prefersDark = false;
    try {
        prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) { /* 老浏览器忽略 */ }

    var theme = stored === 'light' || stored === 'dark'
        ? stored
        : (prefersDark ? 'dark' : 'light');

    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', stored ? 'manual' : 'auto');
    root.style.colorScheme = theme;

    // 让浏览器地址栏 / 状态栏颜色与页面主题一致
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f1511' : '#2a5c3a');
})();
