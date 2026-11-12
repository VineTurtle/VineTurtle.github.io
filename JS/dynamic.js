// JS/dynamic.js —— 可选动态功能：giscus 评论 + 点赞/阅读量
// 配置位于 data/meta/dynamic.json。未配置或接口不可用时自动隐藏，不影响正文。
(function () {
    'use strict';

    var root = (window.VTS && window.VTS.root) || '';
    var configUrl = root + 'data/meta/dynamic.json';
    var config = null;
    var commentsLoaded = false;
    var statsLoaded = false;

    function fetchJson(url, options) {
        return fetch(url, options || { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        });
    }

    function contentKey() {
        return (document.body && document.body.dataset.contentKey) || '';
    }

    function formatCount(n) {
        var num = Number(n) || 0;
        if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return String(num);
    }

    function storageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function storageSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
    }

    function todayKey() {
        var d = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function ensureStatsMount() {
        var mount = document.querySelector('[data-dynamic-stats]');
        if (mount) return mount;
        var meta = document.querySelector('.post-meta, .detail-meta');
        if (!meta) return null;
        mount = document.createElement('div');
        mount.className = 'dynamic-stats';
        mount.setAttribute('data-dynamic-stats', '');
        meta.appendChild(mount);
        return mount;
    }

    function initStats() {
        if (!config || !config.stats || !config.stats.enabled || statsLoaded) return;
        var apiBase = String(config.stats.apiBase || '').replace(/\/+$/, '');
        var key = contentKey();
        var mount = ensureStatsMount();
        if (!apiBase || !key || !mount) return;
        statsLoaded = true;

        mount.classList.remove('is-hidden');
        mount.innerHTML = '<span class="stat-item">👁 …</span><span class="stat-item">❤️ …</span>';

        var viewKey = 'vts:view:' + key + ':' + todayKey();
        var shouldCountView = !storageGet(viewKey);
        if (shouldCountView) storageSet(viewKey, '1');

        function apply(data) {
            var views = Number(data.views) || 0;
            var likes = Number(data.likes) || 0;
            mount.innerHTML = '';

            var viewsEl = document.createElement('span');
            viewsEl.className = 'stat-item';
            viewsEl.innerHTML = '👁 <span>' + formatCount(views) + '</span> 阅读';
            mount.appendChild(viewsEl);

            var likeBtn = document.createElement('button');
            likeBtn.type = 'button';
            likeBtn.className = 'like-btn';
            var liked = storageGet('vts:liked:' + key) === '1';
            likeBtn.innerHTML = '❤️ <span>' + formatCount(likes) + '</span>';
            if (liked) {
                likeBtn.classList.add('is-liked');
                likeBtn.disabled = true;
                likeBtn.setAttribute('aria-label', '已点赞');
            } else {
                likeBtn.setAttribute('aria-label', '点赞');
                likeBtn.addEventListener('click', function () {
                    likeBtn.disabled = true;
                    fetchJson(apiBase + '/like', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: key })
                    }).then(function (result) {
                        var next = Number(result && result.likes);
                        if (!isNaN(next)) likeBtn.innerHTML = '❤️ <span>' + formatCount(next) + '</span>';
                        likeBtn.classList.add('is-liked');
                        likeBtn.setAttribute('aria-label', '已点赞');
                        storageSet('vts:liked:' + key, '1');
                    }).catch(function () {
                        likeBtn.disabled = false;
                        likeBtn.textContent = '❤️ 稍后再试';
                    });
                });
            }
            mount.appendChild(likeBtn);
        }

        function load() {
            var query = apiBase + '/stats?key=' + encodeURIComponent(key);
            fetchJson(query).then(function (data) {
                if (shouldCountView) {
                    fetchJson(apiBase + '/view', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: key })
                    }).then(function (result) {
                        apply(result || data);
                    }).catch(function () { apply(data); });
                } else {
                    apply(data);
                }
            }).catch(function () {
                mount.classList.add('is-hidden');
            });
        }

        load();
    }

    function initComments() {
        if (!config || !config.giscus || !config.giscus.enabled || commentsLoaded) return;
        var g = config.giscus;
        if (!g.repo || !g.repoId || !g.categoryId) {
            if (window.console) console.info('giscus 未配置 repoId/categoryId，评论暂不加载。');
            return;
        }

        var section = document.getElementById('commentsSection');
        if (!section) {
            var article = document.querySelector('.post-article, .project-detail');
            if (!article) return;
            section = document.createElement('section');
            section.id = 'commentsSection';
            section.className = 'comments-section';
            article.parentNode.appendChild(section);
        }

        commentsLoaded = true;
        section.hidden = false;
        section.innerHTML = '';

        var title = document.createElement('h2');
        title.className = 'comments-title';
        title.textContent = '💬 评论';
        section.appendChild(title);

        var hint = document.createElement('p');
        hint.className = 'comments-hint';
        hint.textContent = '评论由 GitHub Discussions 提供，需要登录 GitHub 账号。';
        section.appendChild(hint);

        var term = contentKey() || (window.location.pathname + window.location.search);
        var script = document.createElement('script');
        script.src = 'https://giscus.app/client.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-repo', g.repo);
        script.setAttribute('data-repo-id', g.repoId);
        script.setAttribute('data-category', g.category || 'Comments');
        script.setAttribute('data-category-id', g.categoryId);
        script.setAttribute('data-mapping', 'specific');
        script.setAttribute('data-term', term);
        script.setAttribute('data-strict', '0');
        script.setAttribute('data-reactions-enabled', g.reactionsEnabled === false ? '0' : '1');
        script.setAttribute('data-emit-metadata', '0');
        script.setAttribute('data-input-position', 'top');
        script.setAttribute('data-theme', g.theme || 'light');
        script.setAttribute('data-lang', 'zh-CN');
        script.setAttribute('data-loading', 'lazy');
        script.onerror = function () {
            hint.textContent = '评论组件加载失败，可能是网络或 GitHub 访问问题。';
        };
        section.appendChild(script);
    }

    function refresh() {
        statsLoaded = false;
        initStats();
    }

    function init() {
        fetchJson(configUrl).then(function (data) {
            config = data || {};
            initComments();
            initStats();
        }).catch(function () {
            // 没有配置文件时保持纯静态，不做任何事
        });
    }

    window.VTSDynamic = { refresh: refresh };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
