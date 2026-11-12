// JS/search.js —— 站内搜索（纯前端，读取 data/search-index.json）
(function () {
    'use strict';

    var root = (window.VTS && window.VTS.root) || '';
    var input = document.getElementById('searchInput');
    var form = document.getElementById('searchForm');
    var statusEl = document.getElementById('searchStatus');
    var resultsEl = document.getElementById('searchResults');

    if (!input || !form || !statusEl || !resultsEl) return;

    var entries = [];
    var loaded = false;
    var timer = 0;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) return '';
        var m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return String(value);
        return m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
    }

    function normalize(value) {
        return String(value == null ? '' : value).toLowerCase();
    }

    function search(query) {
        var q = normalize(query).trim();
        if (!q) return entries.slice(0, 12);
        var tokens = q.split(/\s+/).filter(Boolean);
        return entries
            .map(function (item) {
                var title = normalize(item.title);
                var desc = normalize(item.desc);
                var tags = normalize((item.tags || []).join(' '));
                var kind = normalize(item.kindLabel);
                var score = 0;
                var hit = true;
                tokens.forEach(function (token) {
                    var found = false;
                    if (title.indexOf(token) !== -1) { score += 6; found = true; }
                    if (tags.indexOf(token) !== -1) { score += 3; found = true; }
                    if (desc.indexOf(token) !== -1) { score += 1; found = true; }
                    if (kind.indexOf(token) !== -1) { score += 1; found = true; }
                    if (!found) hit = false;
                });
                return hit ? { item: item, score: score } : null;
            })
            .filter(Boolean)
            .sort(function (a, b) {
                if (b.score !== a.score) return b.score - a.score;
                return String(b.item.date).localeCompare(String(a.item.date));
            })
            .map(function (row) { return row.item; });
    }

    function cardHtml(item) {
        var cover = item.cover
            ? '<img src="' + escapeHtml(item.cover) + '" alt="" loading="lazy" onerror="this.remove()">'
            : '';
        var tags = (item.tags || []).slice(0, 3).map(function (tag) {
            return '<span>#' + escapeHtml(tag) + '</span>';
        }).join('');
        return '<a class="search-card" href="' + escapeHtml(root + item.url) + '">'
            + '<span class="search-cover">' + (cover || escapeHtml(item.icon || '📄')) + '</span>'
            + '<span class="search-body">'
            + '<span class="search-kind">' + escapeHtml(item.kindLabel) + '</span>'
            + '<h2>' + escapeHtml(item.title) + '</h2>'
            + (item.desc ? '<p class="search-desc">' + escapeHtml(item.desc) + '</p>' : '')
            + '<span class="search-meta">'
            + (item.date ? '<span>📅 ' + escapeHtml(formatDate(item.date)) + '</span>' : '')
            + tags
            + '</span>'
            + '</span>'
            + '</a>';
    }

    function render(query) {
        var results = search(query);
        var q = String(query || '').trim();
        if (!loaded) {
            statusEl.textContent = '正在加载索引…';
            return;
        }
        if (!entries.length) {
            statusEl.textContent = '搜索索引为空，可能还没有内容。';
            resultsEl.innerHTML = '<div class="search-empty"><span class="big-icon">🌱</span><p>还没有可搜索的内容。</p></div>';
            return;
        }
        if (!q) {
            statusEl.textContent = '共 ' + entries.length + ' 条内容，显示最近更新。按 / 可快速聚焦搜索框。';
        } else if (results.length) {
            statusEl.textContent = '找到 ' + results.length + ' 条与「' + q + '」相关的内容。';
        } else {
            statusEl.textContent = '没有找到与「' + q + '」相关的内容。';
        }

        if (!results.length) {
            resultsEl.innerHTML = '<div class="search-empty"><span class="big-icon">🔍</span><p>换个关键词试试，比如标签、软件名或文章标题。</p></div>';
            return;
        }
        resultsEl.innerHTML = results.slice(0, 40).map(cardHtml).join('');
    }

    function scheduleRender() {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () { render(input.value); }, 120);
    }

    function updateUrl() {
        var url = new URL(window.location.href);
        var q = input.value.trim();
        if (q) url.searchParams.set('q', q);
        else url.searchParams.delete('q');
        history.replaceState({}, '', url);
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        updateUrl();
        render(input.value);
    });

    input.addEventListener('input', function () {
        updateUrl();
        scheduleRender();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== '/') return;
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        input.focus();
        input.select();
    });

    var initial = new URLSearchParams(window.location.search).get('q') || '';
    input.value = initial;

    fetch(root + 'data/search-index.json', { cache: 'no-cache' })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            entries = Array.isArray(data) ? data : [];
            loaded = true;
            render(initial);
        })
        .catch(function (err) {
            statusEl.textContent = '搜索索引加载失败：' + err.message;
            resultsEl.innerHTML = '<div class="search-empty"><span class="big-icon">⚠️</span><p>请刷新重试，或直接浏览博客与项目列表。</p></div>';
        });
})();
