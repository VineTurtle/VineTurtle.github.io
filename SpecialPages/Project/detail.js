// JS/special/progects/detail.js
(function() {
    'use strict';

    function getParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    // ============================================================
    //  核心加载函数（支持 slug 和 id）
    // ============================================================
    function tryLoadFiles(name) {
        return Promise.all([
            fetch(`../../data/project/${name}.json`),
            fetch(`../../data/project/details/${name}.html`)
        ]).then(responses => {
            if (!responses[0].ok || !responses[1].ok) {
                throw new Error('HTTP ' + responses[0].status);
            }
            return Promise.all(responses.map(r => r.text()));
        });
    }

    function loadProjectById(id, container, slugHint) {
        const attempts = [];
        if (slugHint && slugHint !== String(id)) {
            attempts.push(slugHint);
        }
        attempts.push(id);

        let chain = Promise.reject(new Error('开始尝试'));
        attempts.forEach(name => {
            chain = chain.catch(() => tryLoadFiles(name));
        });

        return chain
            .then(([metaText, htmlContent]) => {
                const project = JSON.parse(metaText);
                renderDetail(project, htmlContent, container);
                return true;
            });
    }

    function loadProjectBySlug(slug, container) {
        return fetch('../../data/project/index.json')
            .then(res => {
                if (!res.ok) throw new Error('无法加载索引文件');
                return res.json();
            })
            .then(index => {
                let entry = index.find(p => p.slug === slug);
                if (!entry) {
                    // 如果没找到，尝试将 slug 视为数字 id
                    const id = parseInt(slug, 10);
                    if (!isNaN(id)) {
                        entry = index.find(p => p.id === id);
                    }
                }
                if (!entry) {
                    throw new Error(`未找到 slug 为 "${slug}" 的项目`);
                }
                return entry;
            })
            .then(entry => loadProjectById(entry.id, container, entry.slug))
            .catch(err => {
                throw err;
            });
    }

    // ============================================================
    //  渲染详情
    // ============================================================
    function renderDetail(project, htmlContent, container) {
        let heroHtml = '';
        if (project.hero) {
            heroHtml = `
                <img src="${project.hero}" alt="${project.title}" class="detail-hero-img"
                     onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-hero').style.display='flex';">
                <div class="fallback-hero" style="display: none;">${project.fallbackIcon || '📄'}</div>
            `;
        } else {
            heroHtml = `<div class="fallback-hero">${project.fallbackIcon || '📄'}</div>`;
        }

        const tagsHtml = project.tags.map(t => `<span class="tag">#${t}</span>`).join('');

        container.innerHTML = `
            <article class="project-detail">
                ${heroHtml}
                <div class="detail-header">
                    <h1>${project.title}</h1>
                    <div class="detail-meta">
                        <span class="project-status ${project.statusClass || 'status-plan'}">${project.status || '进行中'}</span>
                        <span class="detail-year">📅 ${project.year || '待定'}</span>
                    </div>
                </div>
                <div class="detail-tags-display">${tagsHtml}</div>
                <div class="detail-body">
                    ${htmlContent}
                </div>
            </article>
        `;

        document.title = `${project.title} · 藤栖龟舍`;
    }

    // ============================================================
    //  主渲染入口
    // ============================================================
    function renderProject() {
        const container = document.getElementById('detailContent');

        const slugParam = getParam('slug');
        const idParam = getParam('id');

        if (!slugParam && !idParam) {
            container.innerHTML = `
                <div class="detail-not-found">
                    <span class="big-icon">🔍</span>
                    <p>缺少项目标识参数</p>
                    <p style="font-size:0.85rem;opacity:0.6;">请使用 ?slug=xxx 或 ?id=xxx 访问</p>
                </div>
            `;
            return;
        }

        if (slugParam) {
            loadProjectBySlug(slugParam, container)
                .catch(err => {
                    console.error('通过 slug 加载失败:', err);
                    if (idParam) {
                        console.log('尝试使用 id 参数作为 fallback...');
                        loadProjectById(parseInt(idParam, 10), container)
                            .catch(err2 => {
                                container.innerHTML = `
                                    <div class="detail-not-found">
                                        <span class="big-icon">🔍</span>
                                        <p>项目不存在或加载失败</p>
                                        <p style="font-size:0.85rem;opacity:0.6;">${err2.message}</p>
                                    </div>
                                `;
                            });
                    } else {
                        container.innerHTML = `
                            <div class="detail-not-found">
                                <span class="big-icon">🔍</span>
                                <p>项目不存在或加载失败</p>
                                <p style="font-size:0.85rem;opacity:0.6;">${err.message}</p>
                            </div>
                        `;
                    }
                });
        } else if (idParam) {
            const id = parseInt(idParam, 10);
            if (isNaN(id) || id <= 0) {
                container.innerHTML = `
                    <div class="detail-not-found">
                        <span class="big-icon">🔍</span>
                        <p>无效的项目ID</p>
                    </div>
                `;
                return;
            }
            loadProjectById(id, container)
                .catch(err => {
                    console.error('加载项目失败:', err);
                    container.innerHTML = `
                        <div class="detail-not-found">
                            <span class="big-icon">🔍</span>
                            <p>项目不存在或加载失败</p>
                            <p style="font-size:0.85rem;opacity:0.6;">${err.message}</p>
                        </div>
                    `;
                });
        }
    }

    // ============================================================
    //  返回链接
    // ============================================================
    function setupBackLink() {
        const backLink = document.getElementById('backLink');
        if (!backLink) return;
        const page = getParam('page') || '1';
        const tag = getParam('tag') || '';
        let href = 'index.html';
        const queryParts = [];
        if (page) queryParts.push('page=' + encodeURIComponent(page));
        if (tag) queryParts.push('tag=' + encodeURIComponent(tag));
        if (queryParts.length > 0) href += '?' + queryParts.join('&');
        backLink.href = href;
    }

    // ============================================================
    //  初始化
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        renderProject();
        setupBackLink();
    });
})();