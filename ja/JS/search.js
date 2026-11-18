// JS/search.js —— 站内搜索（纯前端，读取 data/search-index.json）
// B5：关键词高亮（escape 后包裹 <mark>，R40）+ 分页（复用 list.css 页码样式）
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
    var paginationEl = document.getElementById('searchPagination');

    if (!input || !form || !statusEl || !resultsEl) return;

    var PER_PAGE = 10;
    var entries = [];
    var loaded = false;
    var timer = 0;
    var currentPage = 1;

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

    // 在已转义的文本上按 token 区间包裹 <mark>（R40：先 escape 再包裹，绝不回填未转义输入）
    function highlight(text, tokens) {
        var escaped = escapeHtml(text);
        if (!tokens.length) return escaped;
        var lowerEscaped = escaped.toLowerCase();
        var ranges = [];
        tokens.forEach(function (token) {
            var tok = escapeHtml(token).toLowerCase();
            if (!tok) return;
            var idx = 0;
            while ((idx = lowerEscaped.indexOf(tok, idx)) !== -1) {
                ranges.push([idx, idx + tok.length]);
                idx += tok.length;
            }
        });
        if (!ranges.length) return escaped;
        ranges.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
        var merged = [ranges[0].slice()];
        for (var i = 1; i < ranges.length; i++) {
            var last = merged[merged.length - 1];
            if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
            else merged.push(ranges[i].slice());
        }
        var out = '';
        var pos = 0;
        merged.forEach(function (r) {
            out += escaped.slice(pos, r[0]) + '<mark class="search-hl">' + escaped.slice(r[0], r[1]) + '</mark>';
            pos = r[1];
        });
        return out + escaped.slice(pos);
    }

    function search(query) {
        var q = normalize(query).trim();
        if (!q) return entries.slice();
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

    function cardHtml(item, tokens) {
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
            + '<h2>' + highlight(item.title, tokens) + '</h2>'
            + (item.desc ? '<p class="search-desc">' + highlight(item.desc, tokens) + '</p>' : '')
            + '<span class="search-meta">'
            + (item.date ? '<span>📅 ' + escapeHtml(formatDate(item.date)) + '</span>' : '')
            + tags
            + '</span>'
            + '</span>'
            + '</a>';
    }

    // 页码条：与列表页（JS/special-list.js）同构的视觉样式，样式来自 CSS/special/list.css
    function renderPager(totalPages) {
        if (!paginationEl) return;
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }
        var html = '';
        html += '<button type="button" class="page-prev" ' + (currentPage <= 1 ? 'disabled' : '') + ' data-page="' + (currentPage - 1) + '">‹</button>';

        var maxVisible = 5;
        var startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        var endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        if (startPage > 1) {
            html += '<button type="button" class="page-num" data-page="1">1</button>';
            if (startPage > 2) html += '<span class="page-info">…</span>';
        }
        for (var i = startPage; i <= endPage; i++) {
            html += '<button type="button" class="page-num ' + (i === currentPage ? 'active' : '') + '"'
                + (i === currentPage ? ' aria-current="page"' : '') + ' data-page="' + i + '">' + i + '</button>';
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span class="page-info">…</span>';
            html += '<button type="button" class="page-num" data-page="' + totalPages + '">' + totalPages + '</button>';
        }
        html += '<button type="button" class="page-next" ' + (currentPage >= totalPages ? 'disabled' : '') + ' data-page="' + (currentPage + 1) + '">›</button>';
        html += '<span class="page-info">' + escapeHtml(t('list.pageInfo', { current: currentPage, total: totalPages })) + '</span>';

        paginationEl.innerHTML = html;
        paginationEl.querySelectorAll('button[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var page = parseInt(this.dataset.page, 10);
                if (isNaN(page) || page < 1 || page > totalPages || page === currentPage) return;
                currentPage = page;
                updateUrl();
                render(input.value);
                statusEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
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
            renderPager(1);
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
            renderPager(1);
            return;
        }

        var totalPages = Math.ceil(results.length / PER_PAGE) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        // 高亮 token 用小写化的查询词（匹配本身不区分大小写）
        var tokens = normalize(q).split(/\s+/).filter(Boolean);
        var start = (currentPage - 1) * PER_PAGE;
        resultsEl.innerHTML = results.slice(start, start + PER_PAGE).map(function (item) {
            return cardHtml(item, tokens);
        }).join('');
        renderPager(totalPages);
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
        if (currentPage > 1) url.searchParams.set('page', String(currentPage));
        else url.searchParams.delete('page');
        history.replaceState({}, '', url);
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        currentPage = 1;
        updateUrl();
        render(input.value);
    });

    input.addEventListener('input', function () {
        currentPage = 1; // 新查询回到第一页（R41）
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

    var params = new URLSearchParams(window.location.search);
    var initial = params.get('q') || '';
    var initialPage = parseInt(params.get('page') || '1', 10);
    if (!isNaN(initialPage) && initialPage > 0) currentPage = initialPage;
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

    // 语言切换：就地重渲染搜索结果（保留当前查询与页码）
    window.addEventListener('vts:langchange', function () {
        render(input.value);
    });
})();
