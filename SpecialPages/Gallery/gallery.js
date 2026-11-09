(function () {
    'use strict';

    var CATEGORIES = [
        { key: 'all', label: '✨ 全部' },
        { key: 'scene', label: '🌸 场景插画' },
        { key: 'character', label: '🎭 角色立绘' },
        { key: 'cover', label: '💿 软件封面' }
    ];

    var BASE = '../../Resources/images/gallery/';

    var WORKS = [
        {
            src: BASE + 'sakura-tea.jpg',
            thumb: BASE + 'thumbs/sakura-tea.jpg',
            title: '春庭樱茶',
            desc: '樱花树下的午后茶会，粉瓣落满石板路',
            cat: 'scene'
        },
        {
            src: BASE + 'sakura-reading.jpg',
            thumb: BASE + 'thumbs/sakura-reading.jpg',
            title: '樱庭读书',
            desc: '公园长椅上的阅读时光，小梦与一本旧书',
            cat: 'scene'
        },
        {
            src: BASE + 'grape-arbor.jpg',
            thumb: BASE + 'thumbs/grape-arbor.jpg',
            title: '葡萄架下的微笑',
            desc: '藤蔓棚架下，葡叶酱与一篮紫葡萄',
            cat: 'scene'
        },
        {
            src: BASE + 'vineyard-picnic.jpg',
            thumb: BASE + 'thumbs/vineyard-picnic.jpg',
            title: '葡萄园野餐',
            desc: '橙果子与小梦的葡萄园野餐，分享新摘的葡萄',
            cat: 'scene'
        },
        {
            src: BASE + 'orange-teatime.jpg',
            thumb: BASE + 'thumbs/orange-teatime.jpg',
            title: '柑橘下午茶',
            desc: '橙果子与小葡叶的下午茶，满室橙香',
            cat: 'scene'
        },
        {
            src: BASE + 'apple-orchard.jpg',
            thumb: BASE + 'thumbs/apple-orchard.jpg',
            title: '苹果园的丰收',
            desc: '提着果篮穿行果园，摘下秋天第一颗红苹果',
            cat: 'scene'
        },
        {
            src: BASE + 'grapeleafi-summer.jpg',
            thumb: BASE + 'thumbs/grapeleafi-summer.jpg',
            title: '葡叶酱 · 夏日葡萄',
            desc: '葡园管理者葡叶酱的夏日立绘',
            cat: 'character'
        },
        {
            src: BASE + 'orchard-outfit.jpg',
            thumb: BASE + 'thumbs/orchard-outfit.jpg',
            title: '果园穿搭 · 橙果子',
            desc: '草帽与背带短裤，果园劳作装扮',
            cat: 'character'
        },
        {
            src: BASE + 'xiaomeng-chibi.jpg',
            thumb: BASE + 'thumbs/xiaomeng-chibi.jpg',
            title: '小梦妹妹 Q版',
            desc: '捧着书本与红茶的小梦，樱花瓣落在发梢',
            cat: 'character'
        },
        {
            src: BASE + 'grapeleafi-chibi.jpg',
            thumb: BASE + 'thumbs/grapeleafi-chibi.jpg',
            title: '葡叶酱 Q版',
            desc: '软萌坐姿，暖棕色开衫配红丝带',
            cat: 'character'
        },
        {
            src: BASE + 'toolbox-cover.jpg',
            thumb: BASE + 'thumbs/toolbox-cover.jpg',
            title: 'VinePalmaToolbox 封面',
            desc: '工具箱软件的官方封面视觉',
            cat: 'cover'
        }
    ];

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
            btn.appendChild(document.createTextNode(c.label + ' '));
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
            card.setAttribute('aria-label', '查看大图：' + w.title);

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
        closeBtn.setAttribute('aria-label', '关闭');
        var prevBtn = el('button', 'gallery-lb-nav gallery-lb-prev', '‹');
        prevBtn.type = 'button';
        prevBtn.setAttribute('aria-label', '上一张');
        var nextBtn = el('button', 'gallery-lb-nav gallery-lb-next', '›');
        nextBtn.type = 'button';
        nextBtn.setAttribute('aria-label', '下一张');

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
        renderFilter();
        renderGrid();
    });
})();
