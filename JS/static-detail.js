// JS/static-detail.js —— 静态详情页的目录、分享、复制链接与阅读进度
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function slugify(text, index) {
        const base = String(text || '')
            .trim()
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40);
        return base || ('section-' + index);
    }

    function buildToc() {
        const body = document.querySelector('.post-body, .detail-body');
        const toc = document.querySelector('[data-toc]');
        if (!body || !toc) return;

        const headings = Array.from(body.querySelectorAll('h2, h3')).filter(function (h) {
            return h.textContent.trim().length > 0;
        });
        if (headings.length < 2) {
            toc.hidden = true;
            return;
        }

        const list = document.createElement('ol');
        const used = Object.create(null);

        headings.forEach(function (heading, index) {
            let id = heading.id;
            if (!id) {
                id = slugify(heading.textContent, index + 1);
                let unique = id;
                let n = 2;
                while (used[unique]) unique = id + '-' + n++;
                used[unique] = true;
                id = unique;
                heading.id = id;
            }
            const li = document.createElement('li');
            li.className = 'toc-level-' + heading.tagName.toLowerCase();
            const link = document.createElement('a');
            link.href = '#' + id;
            link.textContent = heading.textContent.trim();
            li.appendChild(link);
            list.appendChild(li);
        });

        const title = document.createElement('p');
        title.className = 'post-toc-title';
        title.textContent = '📑 本文目录';
        toc.innerHTML = '';
        toc.appendChild(title);
        toc.appendChild(list);
        toc.hidden = false;
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                if (document.execCommand('copy')) resolve();
                else reject(new Error('copy failed'));
            } catch (e) {
                reject(e);
            } finally {
                document.body.removeChild(textarea);
            }
        });
    }

    function setupActions() {
        const mount = document.querySelector('[data-content-actions]');
        if (!mount || mount.dataset.ready) return;
        mount.dataset.ready = '1';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'content-action-btn';
        copyBtn.textContent = '🔗 复制链接';
        copyBtn.addEventListener('click', function () {
            copyText(window.location.href).then(function () {
                copyBtn.classList.add('copied');
                copyBtn.textContent = '✅ 已复制';
                setTimeout(function () {
                    copyBtn.classList.remove('copied');
                    copyBtn.textContent = '🔗 复制链接';
                }, 1800);
            }).catch(function () {
                copyBtn.textContent = '复制失败，请手动复制';
            });
        });
        mount.appendChild(copyBtn);

        if (navigator.share) {
            const shareBtn = document.createElement('button');
            shareBtn.type = 'button';
            shareBtn.className = 'content-action-btn';
            shareBtn.textContent = '📤 分享';
            shareBtn.addEventListener('click', function () {
                navigator.share({
                    title: document.title,
                    url: window.location.href
                }).catch(function () { /* 用户取消 */ });
            });
            mount.appendChild(shareBtn);
        }
    }

    function setupProgress() {
        if (document.querySelector('.reading-progress')) return;
        const bar = document.createElement('div');
        bar.className = 'reading-progress';
        bar.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        bar.appendChild(fill);
        document.body.appendChild(bar);

        let ticking = false;
        function update() {
            const doc = document.documentElement;
            const max = Math.max(1, doc.scrollHeight - window.innerHeight);
            const percent = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
            fill.style.width = percent.toFixed(2) + '%';
            ticking = false;
        }
        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        update();
    }

    function setupBackLink() {
        const back = document.getElementById('backLink');
        if (!back) return;
        const params = new URLSearchParams(window.location.search);
        const page = params.get('page');
        const tag = params.get('tag');
        const query = [];
        if (page) query.push('page=' + encodeURIComponent(page));
        if (tag) query.push('tag=' + encodeURIComponent(tag));
        back.href = 'index.html' + (query.length ? '?' + query.join('&') : '');
    }

    function init() {
        if (window.VTS) {
            if (window.VTS.bindImageFallbacks) window.VTS.bindImageFallbacks(document);
            if (window.VTS.setupCopyButtons) window.VTS.setupCopyButtons(document);
            if (window.VTS.highlightCode) window.VTS.highlightCode(document);
        }
        buildToc();
        setupActions();
        setupProgress();
        setupBackLink();
    }

    ready(init);
})();
