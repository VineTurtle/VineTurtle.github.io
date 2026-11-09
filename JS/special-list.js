// JS/special-list.js
// 博客 / 项目列表页的共享逻辑：标签筛选、分页、URL 参数、封面降级、XSS 转义
(function() {
    'use strict';

    function escapeHtml(value) {
        const str = value == null ? '' : String(value);
        return str.replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // 将 ISO 日期格式化为「YYYY年M月D日」，无法解析时原样返回
    function formatDate(value) {
        if (!value) return '';
        const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return String(value);
        return m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
    }

    // 在详情链接上附加 page / tag 参数
    function buildDetailHref(baseLink, page, tag) {
        const url = new URL(baseLink, window.location.href);
        url.searchParams.set('page', page);
        if (tag && tag !== '全部') {
            url.searchParams.set('tag', tag);
        } else {
            url.searchParams.delete('tag');
        }
        return url.pathname + url.search;
    }

    // 列表卡片优先使用压缩小图（原图旁自动生成的 foo@thumb.jpg）加快加载；
    // 已是 @thumb、无扩展名或外链等无法推导时，原样使用。
    function thumbUrl(url) {
        if (!url) return url;
        const s = String(url);
        if (/@thumb\./i.test(s)) return s;
        const m = s.match(/^(.+?)(\.(?:png|jpe?g|gif|webp|bmp|svg|ico))$/i);
        return m ? m[1] + '@thumb.jpg' : s;
    }

    // 封面区：placeholder / 无图时只显示 emoji，有图时显示 img + 隐藏的 fallback
    function buildCoverHtml(post, isPlaceholder, coverClass) {
        const icon = escapeHtml(post.fallbackIcon || '📄');
        if (isPlaceholder || !post.thumbnail) {
            return '<div class="' + coverClass + ' card-cover fallback-only"><span class="fallback-icon">' + icon + '</span></div>';
        }
        return '<div class="' + coverClass + ' card-cover">'
            + '<img src="' + escapeHtml(thumbUrl(post.thumbnail)) + '" data-src="' + escapeHtml(post.thumbnail) + '" alt="' + escapeHtml(post.title) + '" loading="lazy" data-fallback="' + icon + '">'
            + '<span class="fallback-icon">' + icon + '</span>'
            + '</div>';
    }

    function bindCoverFallbacks(grid) {
        grid.querySelectorAll('.card-cover img[data-fallback]').forEach(function(img) {
            const cover = img.closest('.card-cover');
            const showFallback = function() {
                if (cover) cover.classList.add('show-fallback');
            };
            img.addEventListener('error', function() {
                const original = img.getAttribute('data-src');
                if (original && img.getAttribute('src') !== original) {
                    img.setAttribute('src', original); // 缩略图失败 → 回退到原图
                } else {
                    showFallback();                    // 原图也失败 → 回退到 emoji
                }
            });
            // 缓存命中且损坏的图片不会再次触发 error
            if (img.complete && img.naturalWidth === 0) showFallback();
        });
    }

    function createListPage(config) {
        const grid = document.getElementById(config.gridId);
        const filterBar = document.getElementById(config.filterBarId);
        const filterCount = document.getElementById(config.filterCountId);
        const paginationEl = document.getElementById(config.paginationId);

        let items = [];
        let activeTag = '全部';
        let currentPage = 1;

        function getAllTags() {
            const tagSet = new Set();
            items.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
            return ['全部', ...Array.from(tagSet).sort()];
        }

        function getFiltered() {
            if (activeTag === '全部') return items.slice();
            return items.filter(p => (p.tags || []).includes(activeTag));
        }

        function getTotalPages(filtered) {
            return Math.ceil(filtered.length / config.perPage) || 1;
        }

        function updateUrlParams() {
            const url = new URL(window.location.href);
            url.searchParams.set('page', currentPage);
            if (activeTag !== '全部') {
                url.searchParams.set('tag', activeTag);
            } else {
                url.searchParams.delete('tag');
            }
            history.replaceState({}, '', url);
        }

        function renderFilters() {
            const allTags = getAllTags();
            filterBar.querySelectorAll('.filter-tag').forEach(el => el.remove());

            allTags.forEach(tag => {
                const btn = document.createElement('span');
                btn.className = 'filter-tag' + (tag === '全部' ? ' all-tag' : '');
                if (tag === activeTag) btn.classList.add('active');
                btn.textContent = tag;
                btn.dataset.tag = tag;
                btn.addEventListener('click', function() {
                    if (activeTag === tag) return;
                    activeTag = tag;
                    currentPage = 1;
                    updateUrlParams();
                    renderAll();
                });
                filterBar.insertBefore(btn, filterCount);
            });

            filterCount.textContent = '共 ' + getFiltered().length + ' ' + config.noun;
        }

        function renderGrid() {
            const filtered = getFiltered();
            const totalPages = getTotalPages(filtered);
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const start = (currentPage - 1) * config.perPage;
            const pageData = filtered.slice(start, start + config.perPage);

            let html = '';
            if (pageData.length === 0) {
                html = '<div class="empty-state">'
                    + '<span class="empty-icon">' + (config.emptyIcon || '🔍') + '</span>'
                    + '<p>没有找到包含「' + escapeHtml(activeTag) + '」' + (config.emptyNoun || config.noun) + '</p>'
                    + '</div>';
            } else {
                pageData.forEach(item => {
                    const isPlaceholder = !!item.placeholder;
                    const helpers = {
                        escapeHtml: escapeHtml,
                        formatDate: formatDate,
                        isPlaceholder: isPlaceholder,
                        page: currentPage,
                        tag: activeTag,
                        buildCoverHtml: function(post, placeholder) {
                            return buildCoverHtml(post, placeholder, config.coverClass);
                        },
                        buildDetailLink: function(baseLink) {
                            return buildDetailHref(baseLink, currentPage, activeTag);
                        }
                    };
                    html += config.buildCard(item, helpers);
                });
            }

            grid.innerHTML = html;
            bindCoverFallbacks(grid);
        }

        function renderPagination() {
            const filtered = getFiltered();
            const totalPages = getTotalPages(filtered);

            if (totalPages <= 1) {
                paginationEl.innerHTML = '';
                return;
            }

            let html = '';
            html += '<button class="page-prev" ' + (currentPage <= 1 ? 'disabled' : '') + ' data-page="' + (currentPage - 1) + '">‹</button>';

            const maxVisible = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            let endPage = Math.min(totalPages, startPage + maxVisible - 1);
            if (endPage - startPage < maxVisible - 1) {
                startPage = Math.max(1, endPage - maxVisible + 1);
            }

            if (startPage > 1) {
                html += '<button class="page-num" data-page="1">1</button>';
                if (startPage > 2) html += '<span class="page-info">…</span>';
            }

            for (let i = startPage; i <= endPage; i++) {
                html += '<button class="page-num ' + (i === currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) html += '<span class="page-info">…</span>';
                html += '<button class="page-num" data-page="' + totalPages + '">' + totalPages + '</button>';
            }

            html += '<button class="page-next" ' + (currentPage >= totalPages ? 'disabled' : '') + ' data-page="' + (currentPage + 1) + '">›</button>';
            html += '<span class="page-info">第 ' + currentPage + ' / ' + totalPages + ' 页</span>';

            paginationEl.innerHTML = html;

            paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const page = parseInt(this.dataset.page, 10);
                    if (isNaN(page) || page < 1 || page > totalPages) return;
                    if (page === currentPage) return;
                    currentPage = page;
                    updateUrlParams();
                    renderGrid();
                    renderPagination();
                    const main = document.querySelector(config.mainSelector);
                    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            });
        }

        function renderAll() {
            renderFilters();
            renderGrid();
            renderPagination();
        }

        // 卡片内标签徽章：事件委托
        function bindTagBadges() {
            grid.addEventListener('click', function(e) {
                const badge = e.target.closest(config.tagBadgeSelector);
                if (!badge) return;
                e.preventDefault();
                e.stopPropagation();
                const tag = badge.dataset.tag;
                if (tag && activeTag !== tag) {
                    activeTag = tag;
                    currentPage = 1;
                    updateUrlParams();
                    renderAll();
                }
            });
        }

        function loadDataAndRender() {
            fetch(config.dataUrl)
                .then(res => {
                    if (!res.ok) throw new Error('网络请求失败');
                    return res.json();
                })
                .then(data => {
                    items = data;
                    const params = new URLSearchParams(window.location.search);
                    const tagParam = params.get('tag');
                    const pageParam = params.get('page');
                    if (tagParam) {
                        const allTags = getAllTags();
                        if (allTags.includes(tagParam)) activeTag = tagParam;
                    }
                    if (pageParam) {
                        const page = parseInt(pageParam, 10);
                        if (!isNaN(page) && page > 0) currentPage = page;
                    }
                    renderAll();
                })
                .catch(err => {
                    console.error('加载数据失败:', err);
                    grid.innerHTML = '<div class="empty-state">'
                        + '<span class="empty-icon">⚠️</span>'
                        + '<p>数据加载失败，请刷新重试</p>'
                        + '<p class="empty-msg">' + escapeHtml(err.message) + '</p>'
                        + '</div>';
                });
        }

        function init() {
            bindTagBadges();
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', loadDataAndRender);
            } else {
                loadDataAndRender();
            }
        }

        init();
    }

    window.VTS = window.VTS || {};
    window.VTS.escapeHtml = escapeHtml;
    window.VTS.formatDate = formatDate;
    window.VTS.createListPage = createListPage;
})();
