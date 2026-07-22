// JS/special/progects/project.js
(function() {
    'use strict';

    // ============================================================
    //  配置
    // ============================================================
    const PER_PAGE = 3;
    const DATA_URL = '../../data/project/index.json';

    // ============================================================
    //  状态
    // ============================================================
    let projects = [];
    let activeTag = '全部';
    let currentPage = 1;

    // ============================================================
    //  DOM 引用
    // ============================================================
    const grid = document.getElementById('projectGrid');
    const filterBar = document.getElementById('filterBar');
    const filterCount = document.getElementById('filterCount');
    const paginationEl = document.getElementById('pagination');

    // ============================================================
    //  工具函数
    // ============================================================
    function getAllTags() {
        const tagSet = new Set();
        projects.forEach(p => p.tags.forEach(t => tagSet.add(t)));
        return ['全部', ...Array.from(tagSet).sort()];
    }

    function getFilteredProjects(tag) {
        if (tag === '全部') return projects.slice();
        return projects.filter(p => p.tags.includes(tag));
    }

    function getCurrentPageData(filtered, page) {
        const start = (page - 1) * PER_PAGE;
        const end = Math.min(start + PER_PAGE, filtered.length);
        return filtered.slice(start, end);
    }

    function getTotalPages(filtered) {
        return Math.ceil(filtered.length / PER_PAGE) || 1;
    }

    // 构建详情链接：优先使用 slug，否则使用 id
    function buildDetailLink(proj, page, tag) {
        const param = proj.slug ? `slug=${encodeURIComponent(proj.slug)}` : `id=${proj.id}`;
        let href = `detail.html?${param}`;
        const url = new URL(href, window.location.href);
        url.searchParams.set('page', page);
        if (tag && tag !== '全部') {
            url.searchParams.set('tag', tag);
        } else {
            url.searchParams.delete('tag');
        }
        return url.pathname + url.search;
    }

    // ============================================================
    //  渲染函数
    // ============================================================
    function renderFilters() {
        const allTags = getAllTags();
        const countSpan = filterCount;

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
            filterBar.insertBefore(btn, countSpan);
        });

        const filtered = getFilteredProjects(activeTag);
        countSpan.textContent = `共 ${filtered.length} 个项目`;
    }

    function renderGrid() {
        const filtered = getFilteredProjects(activeTag);
        const totalPages = getTotalPages(filtered);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const pageData = getCurrentPageData(filtered, currentPage);

        let html = '';
        if (pageData.length === 0) {
            html = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>没有找到包含「${activeTag}」标签的项目</p>
                </div>
            `;
        } else {
            pageData.forEach(proj => {
                const isPlaceholder = proj.placeholder || false;
                const cardClass = isPlaceholder ? 'project-card project-card-placeholder' : 'project-card';

                // 构建详情链接（使用 slug 或 id）
                const linkHref = isPlaceholder ? '#' : buildDetailLink(proj, currentPage, activeTag);

                // ---- 封面图 ----
                let coverHtml = '';
                if (isPlaceholder) {
                    coverHtml = `<div class="project-card-cover"><span class="fallback-icon">${proj.fallbackIcon || '📄'}</span></div>`;
                } else if (proj.thumbnail) {
                    coverHtml = `
                        <div class="project-card-cover">
                            <img src="${proj.thumbnail}" alt="${proj.title}" loading="lazy" 
                                 onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-icon').style.display='flex';">
                            <span class="fallback-icon" style="display: none; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 3rem; opacity: 0.6;">${proj.fallbackIcon || '📄'}</span>
                        </div>
                    `;
                } else {
                    coverHtml = `<div class="project-card-cover"><span class="fallback-icon">${proj.fallbackIcon || '📄'}</span></div>`;
                }

                // 标签徽章
                let tagsHtml = '';
                if (!isPlaceholder && proj.tags.length > 0) {
                    tagsHtml = `<div class="project-tags">`;
                    proj.tags.forEach(t => {
                        tagsHtml += `<span class="project-tag-badge" data-tag="${t}">#${t}</span>`;
                    });
                    tagsHtml += `</div>`;
                }

                const footerHtml = isPlaceholder ?
                    `<div class="project-footer">
                        <span class="project-status status-plan">⏳ 规划中</span>
                        <span class="project-link" style="opacity:0.4;">即将揭晓</span>
                    </div>` :
                    `<div class="project-footer">
                        <span class="project-status ${proj.statusClass || 'status-plan'}">${proj.status || '进行中'}</span>
                        <a href="${linkHref}" class="project-link">查看详情 →</a>
                    </div>`;

                html += `
                    <div class="${cardClass}">
                        ${coverHtml}
                        <div class="project-card-body">
                            <h3>${proj.title}</h3>
                            ${tagsHtml}
                            <p class="project-desc">${proj.desc || ''}</p>
                            ${footerHtml}
                        </div>
                    </div>
                `;
            });
        }

        grid.innerHTML = html;

        grid.querySelectorAll('.project-tag-badge').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                const tag = this.dataset.tag;
                if (tag && activeTag !== tag) {
                    activeTag = tag;
                    currentPage = 1;
                    updateUrlParams();
                    renderAll();
                }
            });
        });
    }

    function renderPagination() {
        const filtered = getFilteredProjects(activeTag);
        const totalPages = getTotalPages(filtered);

        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button class="page-prev" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>`;

        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button class="page-num" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="page-info">…</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-num ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="page-info">…</span>`;
            html += `<button class="page-num" data-page="${totalPages}">${totalPages}</button>`;
        }

        html += `<button class="page-next" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>`;
        html += `<span class="page-info">第 ${currentPage} / ${totalPages} 页</span>`;

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
                document.querySelector('.project-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
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

    function renderAll() {
        renderFilters();
        renderGrid();
        renderPagination();
    }

    // ============================================================
    //  加载数据并初始化
    // ============================================================
    function loadDataAndRender() {
        fetch(DATA_URL)
            .then(res => {
                if (!res.ok) throw new Error('网络请求失败');
                return res.json();
            })
            .then(data => {
                projects = data;
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
                console.error('加载项目数据失败:', err);
                grid.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">⚠️</span>
                        <p>数据加载失败，请刷新重试</p>
                        <p style="font-size:0.8rem;opacity:0.5;">${err.message}</p>
                    </div>
                `;
            });
    }

    // ============================================================
    //  初始化
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        if (!filterBar.querySelector('.filter-label')) {
            const label = document.createElement('span');
            label.className = 'filter-label';
            label.textContent = '🏷️ 筛选：';
            filterBar.prepend(label);
        }
        if (!filterCount) {
            const count = document.createElement('span');
            count.className = 'filter-count';
            count.id = 'filterCount';
            filterBar.appendChild(count);
        }
        loadDataAndRender();
    });
})();