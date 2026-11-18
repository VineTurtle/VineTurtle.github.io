// SpecialPages/Blog/archive.js —— 文章归档页：按年分组的时间线（列表逻辑参考 JS/special-list.js）
(function () {
    'use strict';

    var t = function (key, vars) {
        return window.VTS && window.VTS.t ? window.VTS.t(key, vars) : key;
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 将 ISO 日期按语言本地化；无法解析时原样返回（R8）
    function formatDate(value) {
        if (!value) return '';
        var m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return String(value);
        var y = m[1], mo = Number(m[2]), d = Number(m[3]);
        var lang = (window.VTS && VTS.lang) || 'zh-CN';
        if (lang === 'en') {
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[mo - 1] + ' ' + d + ', ' + y;
        }
        return y + '年' + mo + '月' + d + '日';
    }

    var timeline = document.getElementById('archiveTimeline');
    var countEl = document.getElementById('archiveCount');
    var emptyEl = document.getElementById('archiveEmpty');
    if (!timeline || !emptyEl) return;

    var items = [];

    function archiveHref(post) {
        return post.slug
            ? encodeURIComponent(post.slug) + '.html'
            : 'post.html?slug=' + encodeURIComponent(post.id);
    }

    function render() {
        // 索引已按日期倒序，首次出现的年份即倒序分组
        var byYear = {};
        var years = [];
        items.forEach(function (post) {
            var y = String(post.date || '').slice(0, 4) || '----';
            if (!byYear[y]) { byYear[y] = []; years.push(y); }
            byYear[y].push(post);
        });

        var html = '';
        years.forEach(function (y) {
            html += '<section class="archive-year">'
                + '<h2 class="archive-year-title">' + escapeHtml(y) + '</h2>'
                + '<ul class="archive-list">';
            byYear[y].forEach(function (post) {
                html += '<li class="archive-item"><a href="' + escapeHtml(archiveHref(post)) + '">'
                    + '<span class="archive-date">' + escapeHtml(formatDate(post.date)) + '</span>'
                    + '<span class="archive-title">' + escapeHtml(post.title) + '</span>'
                    + '</a></li>';
            });
            html += '</ul></section>';
        });
        timeline.innerHTML = html;

        if (countEl) {
            countEl.textContent = t('archive.count', { count: items.length });
            countEl.hidden = items.length === 0;
        }
        emptyEl.hidden = items.length > 0;
        timeline.hidden = items.length === 0;
    }

    function load() {
        fetch('../../data/blog/index.json')
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                items = Array.isArray(data) ? data : [];
                render();
            })
            .catch(function (err) {
                console.error('归档数据加载失败:', err);
                emptyEl.hidden = false;
                timeline.hidden = true;
            });
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', load);
        } else {
            load();
        }
        // 语言切换：用已加载数据就地重渲染（标题随本地化索引、日期随语言）
        window.addEventListener('vts:langchange', function () {
            if (items.length) render();
        });
    }

    init();
})();
