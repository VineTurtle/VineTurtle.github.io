// JS/special/blog/post.js
(function() {
    'use strict';

    function getParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    // ============================================================
    //  为所有 <pre><code> 添加复制按钮
    // ============================================================
    function addCopyButtons() {
        const preElements = document.querySelectorAll('.post-body pre');
        preElements.forEach(pre => {
            if (pre.querySelector('.copy-btn')) return;

            const code = pre.querySelector('code');
            if (!code) return;

            const text = code.textContent;

            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.innerHTML = `<span class="copy-icon">📋</span> 复制`;
            btn.setAttribute('aria-label', '复制代码');

            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(text);
                    this.classList.add('copied');
                    this.innerHTML = `<span class="copy-icon">✅</span> 已复制`;
                    setTimeout(() => {
                        this.classList.remove('copied');
                        this.innerHTML = `<span class="copy-icon">📋</span> 复制`;
                    }, 2000);
                } catch (err) {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    this.classList.add('copied');
                    this.innerHTML = `<span class="copy-icon">✅</span> 已复制`;
                    setTimeout(() => {
                        this.classList.remove('copied');
                        this.innerHTML = `<span class="copy-icon">📋</span> 复制`;
                    }, 2000);
                }
            });

            pre.style.position = 'relative';
            pre.appendChild(btn);
        });
    }

    // ============================================================
    //  🔥 核心修复：加载文章文件（slug 优先，id 回退）
    // ============================================================
    function tryLoadFiles(name) {
        return Promise.all([
            fetch(`../../data/blog/${name}.json`),
            fetch(`../../data/blog/posts/${name}.html`)
        ]).then(responses => {
            if (!responses[0].ok || !responses[1].ok) {
                throw new Error('HTTP ' + responses[0].status);
            }
            return Promise.all(responses.map(r => r.text()));
        });
    }

    function loadPostById(id, container, slugHint) {
        // 构建尝试顺序：优先 slug，回退数字 id
        const attempts = [];
        if (slugHint && slugHint !== String(id)) {
            attempts.push(slugHint);
        }
        attempts.push(id);

        // 依次尝试，任一成功即返回
        let chain = Promise.reject(new Error('开始尝试'));
        attempts.forEach(name => {
            chain = chain.catch(() => tryLoadFiles(name));
        });

        return chain
            .then(([metaText, htmlContent]) => {
                const post = JSON.parse(metaText);
                renderPostContent(post, htmlContent, container);
                return true;
            });
    }

    // ============================================================
    //  通过 Slug 加载文章（先查 index.json 获取 id 和 slug）
    // ============================================================
    function loadPostBySlug(slug, container) {
        return fetch('../../data/blog/index.json')
            .then(res => {
                if (!res.ok) throw new Error('无法加载索引文件');
                return res.json();
            })
            .then(index => {
                let entry = index.find(p => p.slug === slug);
                if (!entry) {
                    const id = parseInt(slug, 10);
                    if (!isNaN(id)) {
                        entry = index.find(p => p.id === id);
                    }
                }
                if (!entry) {
                    throw new Error(`未找到 slug 为 "${slug}" 的文章`);
                }
                return entry;
            })
            .then(entry => loadPostById(entry.id, container, entry.slug))
            .catch(err => {
                throw err;
            });
    }

    // ============================================================
    //  渲染文章内容
    // ============================================================
    function renderPostContent(post, htmlContent, container) {
        let heroHtml = '';
        if (post.hero) {
            heroHtml = `
                <img src="${post.hero}" alt="${post.title}" class="post-hero-img"
                     onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-hero').style.display='flex';">
                <div class="fallback-hero" style="display: none;">${post.fallbackIcon || '📄'}</div>
            `;
        } else {
            heroHtml = `<div class="fallback-hero">${post.fallbackIcon || '📄'}</div>`;
        }

        const tagsHtml = post.tags.map(t => `<span class="tag">#${t}</span>`).join('');

        container.innerHTML = `
            <article class="post-article">
                ${heroHtml}
                <header class="post-header">
                    <h1>${post.title}</h1>
                    <div class="post-meta">
                        <span>📅 ${post.date}</span>
                    </div>
                    <div class="post-tags-display">${tagsHtml}</div>
                </header>
                <div class="post-body">
                    ${htmlContent}
                </div>
            </article>
        `;

        addCopyButtons();
        document.title = `${post.title} · 藤栖龟舍`;
    }

    // ============================================================
    //  主渲染入口
    // ============================================================
    function renderPost() {
        const container = document.getElementById('postContent');

        const slugParam = getParam('slug');
        const idParam = getParam('id');

        if (!slugParam && !idParam) {
            container.innerHTML = `
                <div class="post-not-found">
                    <span class="big-icon">🔍</span>
                    <p>缺少文章标识参数</p>
                    <p style="font-size:0.85rem;opacity:0.6;">请使用 ?slug=xxx 或 ?id=xxx 访问</p>
                </div>
            `;
            return;
        }

        if (slugParam) {
            loadPostBySlug(slugParam, container)
                .catch(err => {
                    console.error('通过 slug 加载失败:', err);
                    if (idParam) {
                        console.log('尝试使用 id 参数作为 fallback...');
                        loadPostById(parseInt(idParam, 10), container)
                            .catch(err2 => {
                                container.innerHTML = `
                                    <div class="post-not-found">
                                        <span class="big-icon">🔍</span>
                                        <p>文章不存在或加载失败</p>
                                        <p style="font-size:0.85rem;opacity:0.6;">${err2.message}</p>
                                    </div>
                                `;
                            });
                    } else {
                        container.innerHTML = `
                            <div class="post-not-found">
                                <span class="big-icon">🔍</span>
                                <p>文章不存在或加载失败</p>
                                <p style="font-size:0.85rem;opacity:0.6;">${err.message}</p>
                            </div>
                        `;
                    }
                });
        } else if (idParam) {
            const id = parseInt(idParam, 10);
            if (isNaN(id) || id <= 0) {
                container.innerHTML = `
                    <div class="post-not-found">
                        <span class="big-icon">🔍</span>
                        <p>无效的文章ID</p>
                    </div>
                `;
                return;
            }
            loadPostById(id, container)
                .catch(err => {
                    console.error('加载文章失败:', err);
                    container.innerHTML = `
                        <div class="post-not-found">
                            <span class="big-icon">🔍</span>
                            <p>文章不存在或加载失败</p>
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
        renderPost();
        setupBackLink();
    });
})();