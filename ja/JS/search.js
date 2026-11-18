// JS/search.js —— 站内搜索（纯前端，读取 data/search-index.json）
(function () {
    'use strict';

    var t = function (key, vars) {
        return window.VTS && window.VTS.t ? window.VTS.t(key, vars) : key;
    };

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
        var y = m[1], mo = Number(m[2]), d = Number(m[3]);
        var lang = (window.VTS && VTS.lang) || 'zh-CN';
        if (lang === 'en') {
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[mo - 1] + ' ' + d + ', ' + y;
        }
        return y + '年' + mo + '月' + d + '日';
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
            statusEl.textContent = t('search.loading');
            return;
        }
        if (!entries.length) {
            statusEl.textContent = t('search.indexEmpty');
            resultsEl.innerHTML = '<div class="search-empty"><span class="big-icon">🌱</span><p data-i18n="search.noneHere">' + escapeHtml(t('search.noneHere')) + '</p></div>';
            return;
        }
        if (!q) {
            statusEl.textContent = t('search.allCount', { count: entries.length });
        } else if (results.length) {
            statusEl.textContent = t('search.foundCount', { count: results.length, q: q });
        } else {
            statusEl.textContent = t('search.noResult', { q: q });
        }

        if (!results.length) {
            resultsEl.innerHTML = '<div class="search-empty"><span class="big-icon">🔍</span><p data-i18n="search.emptyHint">' + escapeHtml(t('search.emptyHint')) + '</p></div>';
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
            statusEl.textContent = t('search.loadFail', { msg: err.message });
            resultsEl.innerHTML = '<div class="search-empty"><span class="big-icon">⚠️</span><p data-i18n="search.retry">' + escapeHtml(t('search.retry')) + '</p></div>';
        });

    // 语言切换：就地重渲染搜索结果
    window.addEventListener('vts:langchange', function () {
        render(input.value);
    });
})();
