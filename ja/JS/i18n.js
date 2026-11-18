// JS/i18n.js —— 多语言运行时
// 职责：判定语言、加载字典、提供 t(key)、静态文案替换、语言目录跳转切换器。
// 设计要点（遵守 I18N_PLAN.md §7）：
//  - R16 纯 JSON 单一数据源；R15 缺 key / 缺译文回退简中。
//  - R6 语言判定 URL 优先，localStorage 仅用于无语言前缀时的默认选择。
//  - R5 切换只换 URL 首段语言码，保留相对路径、查询参数与 hash，就地渲染作为兜底。
//  - R26 简中根路径行为不变：zh-CN 字典值等于原文案。
//  - P1：镜像目录 /en/ /ja/ /zh-TW/ 各带一份资源，切换通过 URL 跳转完成。
(function () {
    'use strict';

    var LANGS = ['zh-CN', 'zh-TW', 'en', 'ja'];
    var DEFAULT_LANG = 'zh-CN';
    var STORAGE_KEY = 'vts-lang';
    var I18N_DIR = 'i18n/';

    // 语言显示名（切选项用，不进字典，属于语言自身名称）
    var LANG_LABELS = {
        'zh-CN': '简体中文',
        'zh-TW': '繁體中文',
        'en': 'English',
        'ja': '日本語'
    };

    var VTS = (window.VTS = window.VTS || {});

    // ---------- 路径前缀：与 layout.js 的 getPathPrefix 同逻辑 ----------
    function getPathPrefix() {
        var scriptSrc = document.currentScript && document.currentScript.src;
        if (!scriptSrc) return '';
        try {
            var url = new URL(scriptSrc);
            var scriptPath = url.pathname;
            var lastSlash = scriptPath.lastIndexOf('/');
            var scriptDir = scriptPath.substring(0, lastSlash + 1);
            var rootDir = scriptDir.replace(/\/JS\/$/, '/');
            if (rootDir === scriptDir) {
                var parts = scriptDir.split('/').filter(Boolean);
                parts.pop();
                rootDir = '/' + parts.join('/') + '/';
                if (rootDir === '//') rootDir = '/';
            }
            var pagePath = window.location.pathname;
            var relative = '';
            if (pagePath.indexOf(rootDir) === 0) relative = pagePath.substring(rootDir.length);
            else if (rootDir === '/') relative = pagePath.substring(1);
            else relative = pagePath.replace(/^\//, '');
            var segs = relative.split('/').filter(Boolean);
            var last = segs[segs.length - 1];
            if (last && last.indexOf('.') !== -1) segs.pop();
            return segs.length ? '../'.repeat(segs.length) : '';
        } catch (e) {
            return '';
        }
    }

    var base = getPathPrefix();

    // ---------- 语言判定：URL 优先 → localStorage → 默认 ----------
    // P1 镜像目录形如 /en/ /ja/ /zh-TW/；P0 根路径无前缀即简中。
    function langFromUrl() {
        var segs = window.location.pathname.split('/').filter(Boolean);
        var first = segs.length ? segs[0] : '';
        if (LANGS.indexOf(first) !== -1) return first;
        return '';
    }

    function langFromStorage() {
        try {
            var v = window.localStorage.getItem(STORAGE_KEY);
            return LANGS.indexOf(v) !== -1 ? v : '';
        } catch (e) {
            return '';
        }
    }

    function persistLang(lang) {
        try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 隐私模式忽略 */ }
    }

    // P1：镜像目录已就位，语言一律由 URL 决定（R6 URL 优先）。
    // 无语言前缀的根路径恒为简中基线（R26），localStorage 不再覆盖渲染语言；
    // 它仅记录上次选择，供首次访问时可选地引导跳转（见 langUrl/切换器），不参与当前页语言判定。
    var urlLang = langFromUrl();
    var currentLang = urlLang || DEFAULT_LANG;

    // ---------- 字典加载（同步，保证 t() 立即可用）----------
    var dicts = {}; // lang -> object

    function loadDictSync(lang) {
        var url = base + I18N_DIR + lang + '.json';
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false); // 同步：避免首屏出现 key 或中文闪烁
            xhr.send(null);
            if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
        } catch (e) { /* 回退简中 */ }
        return null;
    }

    // 先加载简中作为兜底，再加载目标语言
    dicts[DEFAULT_LANG] = loadDictSync(DEFAULT_LANG) || {};
    if (currentLang !== DEFAULT_LANG) {
        dicts[currentLang] = loadDictSync(currentLang) || null;
    }

    function fill(template, vars) {
        if (!vars) return template;
        return String(template).replace(/\{(\w+)\}/g, function (m, key) {
            return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m;
        });
    }

    // t(key, vars) —— 缺 key / 缺译文一律回退简中，绝不渲染 key 本身或空白
    function t(key, vars) {
        var active = dicts[currentLang];
        var value = active && Object.prototype.hasOwnProperty.call(active, key) ? active[key] : null;
        if (value == null || value === '') {
            value = dicts[DEFAULT_LANG] && dicts[DEFAULT_LANG][key];
        }
        if (value == null || value === '') return key; // 极端情况：简中字典也缺失
        return fill(value, vars);
    }

    // ---------- 对外暴露 VTS ----------
    VTS.lang = currentLang;
    VTS.base = base; // P1 镜像目录将据此拼接资源路径
    VTS.t = t;
    VTS.i18n = {
        langs: LANGS.slice(),
        labels: LANG_LABELS,
        t: t,
        getLang: function () { return currentLang; },
        setLang: setLang,
        navigateToLang: navigateToLang,
        langUrl: langUrl,
        applyStatic: applyStatic,
        mountSwitcher: buildSwitcher
    };

    // ---------- 静态文案替换：扫描 [data-i18n] ----------
    // 元素文本 = t(key)；可选 data-i18n-attrs="aria-label:key,title:key" 处理属性。
    function applyStatic(root) {
        var scope = root || document;
        var nodes = scope.querySelectorAll('[data-i18n], [data-i18n-attrs]');
        Array.prototype.forEach.call(nodes, function (el) {
            var key = el.getAttribute('data-i18n');
            if (key) el.textContent = t(key);
            var attrs = el.getAttribute('data-i18n-attrs');
            if (attrs) {
                attrs.split(',').forEach(function (pair) {
                    var idx = pair.indexOf(':');
                    if (idx === -1) return;
                    var attrName = pair.substring(0, idx).trim();
                    var attrKey = pair.substring(idx + 1).trim();
                    if (attrName && attrKey) el.setAttribute(attrName, t(attrKey));
                });
            }
        });
    }

    // ---------- 语言切换器 UI ----------
    function buildSwitcher() {
        var container = document.getElementById('langSwitcher');
        if (!container || container.getAttribute('data-ready') === '1') return;
        container.setAttribute('data-ready', '1');

        var select = document.createElement('select');
        select.className = 'lang-select';
        select.id = 'langSelect';
        select.setAttribute('aria-label', 'Language / 语言');
        LANGS.forEach(function (lang) {
            var opt = document.createElement('option');
            opt.value = lang;
            opt.textContent = LANG_LABELS[lang];
            if (lang === currentLang) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', function () {
            navigateToLang(select.value);
        });
        container.appendChild(select);
    }

    // ---------- P1 语言目录跳转 ----------
    // 从当前 pathname 中剥离语言首段，得到「与语言无关」的相对路径。
    // 例：/en/SpecialPages/Blog/a.html → SpecialPages/Blog/a.html
    //     /SpecialPages/Blog/a.html   → SpecialPages/Blog/a.html（简中根路径）
    function stripLangSegment(pathname) {
        var segs = String(pathname).split('/');
        // segs[0] 为 ''（绝对路径以 / 开头）
        if (segs.length > 1 && LANGS.indexOf(segs[1]) !== -1) {
            segs.splice(1, 1);
        }
        var rel = segs.join('/');
        if (rel.charAt(0) === '/') rel = rel.substring(1);
        return rel;
    }

    // 生成目标语言的完整 URL；简中返回根路径，其他语言加 /<lang>/ 前缀。
    // 保留 query 与 hash（R5），并确保目录路径以 / 结尾。
    function langUrl(lang) {
        if (LANGS.indexOf(lang) === -1) return '';
        var rel = stripLangSegment(window.location.pathname);
        var path;
        if (lang === DEFAULT_LANG) {
            path = '/' + rel;
        } else {
            path = '/' + lang + '/' + rel;
        }
        if (!rel || /\/$/.test(rel)) {
            if (path.charAt(path.length - 1) !== '/') path += '/';
        }
        var suffix = window.location.search + window.location.hash;
        return path + suffix;
    }

    // 切换语言：跳转到对应语言目录；文件协议（本地直接打开）或跳转不可用时回退就地渲染。
    function navigateToLang(lang) {
        if (LANGS.indexOf(lang) === -1) return;
        var url = langUrl(lang);
        if (!url) return;
        persistLang(lang);
        if (window.location.protocol === 'file:' || !window.location.assign) {
            setLang(lang); // 本地 file:// 下无法保证镜像目录存在，退回就地换壳
            return;
        }
        window.location.assign(url);
    }

    // ---------- 就地切换：保留 hash 与相对路径（R5）----------
    function setLang(lang) {
        if (LANGS.indexOf(lang) === -1) return;
        if (lang !== DEFAULT_LANG && !dicts[lang]) {
            dicts[lang] = loadDictSync(lang) || {};
        }
        currentLang = lang;
        VTS.lang = lang;
        persistLang(lang);
        document.documentElement.setAttribute('lang', lang);

        // 先刷新现有静态/动态文案节点
        applyStatic(document);
        // 通知其他模块用新语言重渲染它们的动态区域
        try {
            window.dispatchEvent(new CustomEvent('vts:langchange', { detail: { lang: lang } }));
        } catch (e) {
            window.dispatchEvent(new Event('vts:langchange'));
        }
        // 模块重渲染可能新建节点，再刷一次确保 data-i18n 全部生效
        applyStatic(document);
    }

    // ---------- 初始化 ----------
    function init() {
        document.documentElement.setAttribute('lang', currentLang);
        buildSwitcher();
        applyStatic(document);
        try {
            window.dispatchEvent(new CustomEvent('vts:i18nready', { detail: { lang: currentLang } }));
        } catch (e) {
            window.dispatchEvent(new Event('vts:i18nready'));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
