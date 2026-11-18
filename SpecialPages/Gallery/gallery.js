(function () {
    'use strict';

    var t = function (key, vars) {
        return window.VTS && window.VTS.t ? window.VTS.t(key, vars) : key;
    };

    var CATEGORIES = [
        { key: 'all', i18n: 'gallery.all' },
        { key: 'scene', i18n: 'gallery.scene' },
        { key: 'character', i18n: 'gallery.character' },
        { key: 'cover', i18n: 'gallery.cover' }
    ];

    // 页面相对路径：画廊数据与图片都相对于本页（各语言目录各有一份，R4/R19）
    var DATA_URL = '../../data/gallery.json';
    var DEFAULT_BASE = '../../Resources/images/gallery/';

    var WORKS = [];
    var loading = false;

    // 把数据文件里的相对文件名拼成页面相对路径；缺字段时回退默认目录
    function normalize(data) {
        var base = data.imagesBase || DEFAULT_BASE;
        var items = data.items || [];
        return items.map(function (it) {
            var src = String(it.src || '');
            var thumb = String(it.thumb || it.src || '');
            return {
                src: src.indexOf('/') === 0 || /^http/.test(src) ? src : base + src,
                thumb: thumb.indexOf('/') === 0 || /^http/.test(thumb) ? thumb : base + thumb,
                title: it.title || '',
                desc: it.desc || '',
                cat: it.cat || 'scene'
            };
        });
    }

    function loadWorks(done) {
        if (loading) return;
        loading = true;
        fetch(DATA_URL, { cache: 'no-cache' })
            .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('gallery')); })
            .then(function (data) { WORKS = normalize(data); })
            .catch(function () { WORKS = []; })
            .then(function () {
                loading = false;
                if (done) done();
            });
    }

    var currentFilter = 'all';
    var lightboxIndex = -1;
    var visibleWorks = [];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function renderFilter() {
        var bar = document.getElementById('galleryFilter');
        bar.innerHTML = '';
        CATEGORIES.forEach(function (c) {
            var count = c.key === 'all'
                ? WORKS.length
                : WORKS.filter(function (w) { return w.cat === c.key; }).length;
            var btn = el('button', 'gallery-filter-btn' + (c.key === currentFilter ? ' active' : ''));
            btn.type = 'button';
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', c.key === currentFilter ? 'true' : 'false');
            btn.appendChild(document.createTextNode(t(c.i18n) + ' '));
            btn.appendChild(el('span', 'gallery-filter-count', String(count)));
            btn.addEventListener('click', function () {
                currentFilter = c.key;
                renderFilter();
                renderGrid();
            });
            bar.appendChild(btn);
        });
    }

    function renderGrid() {
        var grid = document.getElementById('galleryGrid');
        var empty = document.getElementById('galleryEmpty');
        grid.innerHTML = '';
        visibleWorks = WORKS.filter(function (w) {
            return currentFilter === 'all' || w.cat === currentFilter;
        });
        empty.hidden = visibleWorks.length > 0;
        visibleWorks.forEach(function (w, i) {
            var card = el('figure', 'gallery-item');
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', t('a11y.viewImageAlt', { alt: w.title }));

            var imgWrap = el('div', 'gallery-item-img');
            var img = document.createElement('img');
            img.src = w.thumb;
            img.alt = w.title;
            img.loading = 'lazy';
            img.decoding = 'async';
            imgWrap.appendChild(img);

            var cap = el('figcaption', 'gallery-item-caption');
            cap.appendChild(el('span', 'gallery-item-title', w.title));
            cap.appendChild(el('span', 'gallery-item-desc', w.desc));

            card.appendChild(imgWrap);
            card.appendChild(cap);
            card.addEventListener('click', function () { openLightbox(i); });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(i);
                }
            });
            grid.appendChild(card);
        });
    }

    function buildLightbox() {
        if (document.getElementById('galleryLightbox')) return;
        var box = el('div', 'gallery-lightbox');
        box.id = 'galleryLightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.hidden = true;

        var closeBtn = el('button', 'gallery-lb-close', '×');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', t('a11y.close'));
        var prevBtn = el('button', 'gallery-lb-nav gallery-lb-prev', '‹');
        prevBtn.type = 'button';
        prevBtn.setAttribute('aria-label', t('a11y.prev'));
        var nextBtn = el('button', 'gallery-lb-nav gallery-lb-next', '›');
        nextBtn.type = 'button';
        nextBtn.setAttribute('aria-label', t('a11y.next'));

        var img = document.createElement('img');
        img.id = 'galleryLbImg';
        img.alt = '';

        var meta = el('div', 'gallery-lb-meta');
        meta.appendChild(el('div', 'gallery-lb-title'));
        meta.appendChild(el('div', 'gallery-lb-desc'));
        meta.appendChild(el('div', 'gallery-lb-counter'));

        box.appendChild(closeBtn);
        box.appendChild(prevBtn);
        box.appendChild(img);
        box.appendChild(nextBtn);
        box.appendChild(meta);
        document.body.appendChild(box);

        closeBtn.addEventListener('click', closeLightbox);
        prevBtn.addEventListener('click', function () { stepLightbox(-1); });
        nextBtn.addEventListener('click', function () { stepLightbox(1); });
        box.addEventListener('click', function (e) {
            if (e.target === box) closeLightbox();
        });
        document.addEventListener('keydown', function (e) {
            if (box.hidden) return;
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowLeft') stepLightbox(-1);
            else if (e.key === 'ArrowRight') stepLightbox(1);
        });
    }

    function updateLightbox() {
        var box = document.getElementById('galleryLightbox');
        var w = visibleWorks[lightboxIndex];
        if (!w) return;
        box.querySelector('#galleryLbImg').src = w.src;
        box.querySelector('#galleryLbImg').alt = w.title;
        box.querySelector('.gallery-lb-title').textContent = w.title;
        box.querySelector('.gallery-lb-desc').textContent = w.desc;
        box.querySelector('.gallery-lb-counter').textContent =
            (lightboxIndex + 1) + ' / ' + visibleWorks.length;
    }

    function openLightbox(i) {
        buildLightbox();
        lightboxIndex = i;
        updateLightbox();
        document.getElementById('galleryLightbox').hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        document.getElementById('galleryLightbox').hidden = true;
        document.body.style.overflow = '';
        lightboxIndex = -1;
    }

    function stepLightbox(delta) {
        if (lightboxIndex < 0) return;
        lightboxIndex = (lightboxIndex + delta + visibleWorks.length) % visibleWorks.length;
        updateLightbox();
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadWorks(function () {
            renderFilter();
            renderGrid();
        });
    });
    window.addEventListener('vts:langchange', function () {
        loadWorks(function () {
            renderFilter();
            renderGrid();
        });
    });
})();
