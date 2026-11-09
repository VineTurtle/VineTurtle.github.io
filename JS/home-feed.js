// JS/home-feed.js —— 首页动态区块
// 精选：按 data/meta/home.json 的 featured 固定顺序展示
// 最近更新：博客 + 项目按日期倒序
// 热门：阅读量（data/meta/stats.json，可选）+ 编辑权重 + 新鲜度综合排序
(function () {
    'use strict';

    var MAX_CARDS = 6;
    var FRESH_DAYS = 60; // 新鲜度线性衰减窗口（天）

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // data 里的图片路径是相对 SpecialPages 页面的 ../../，首页在根目录，去掉前缀
    function fixPath(p) {
        if (!p) return '';
        return String(p).replace(/^(\.\.\/)+/, './');
    }

    function fetchJson(url) {
        return fetch(url, { cache: 'no-cache' }).then(function (res) {
            if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
            return res.json();
        });
    }

    function toItem(entry, kind) {
        var isBlog = kind === 'blog';
        var slug = entry.slug || String(entry.id);
        var item = {
            kind: kind,
            kindLabel: isBlog ? '文章' : '项目',
            slug: slug,
            title: entry.title || '',
            date: entry.date || '',
            tags: Array.isArray(entry.tags) ? entry.tags : [],
            desc: isBlog ? (entry.excerpt || '') : (entry.desc || ''),
            cover: fixPath(entry.thumbnail || entry.hero || ''),
            icon: entry.fallbackIcon || (isBlog ? '📝' : '🚀'),
            href: (isBlog
                ? './SpecialPages/Blog/post.html?slug='
                : './SpecialPages/Project/detail.html?slug=') + encodeURIComponent(slug)
        };
        item.time = item.date ? new Date(item.date + 'T00:00:00').getTime() : 0;
        return item;
    }

    function daysOld(item) {
        if (!item.time) return 9999;
        return Math.max(0, (Date.now() - item.time) / 86400000);
    }

    function hotScore(item, weights, stats) {
        var views = Number(stats[item.slug]) || 0;
        var weight = Number(weights[item.slug]) || 0;
        var fresh = Math.max(0, FRESH_DAYS - daysOld(item)) / FRESH_DAYS; // 0~1
        return views * 10 + weight * 100 + fresh * 40;
    }

    function cardHtml(item, options) {
        var opts = options || {};
        var tags = item.tags.slice(0, 3).map(function (tag) {
            return '<span class="feed-tag">#' + esc(tag) + '</span>';
        }).join('');
        var cover = item.cover
            ? '<img src="' + esc(item.cover) + '" alt="" loading="lazy" onerror="this.remove()">'
            : '';
        return '<a class="feed-card' + (opts.featured ? ' is-featured' : '') + '" href="' + esc(item.href) + '">'
            + '<div class="feed-cover">'
            + '<span class="feed-emoji" aria-hidden="true">' + esc(item.icon) + '</span>'
            + cover
            + (opts.badge ? '<span class="feed-badge">' + esc(opts.badge) + '</span>' : '')
            + '</div>'
            + '<div class="feed-body">'
            + '<span class="feed-kind feed-kind-' + item.kind + '">' + esc(item.kindLabel) + '</span>'
            + '<h3 class="feed-title">' + esc(item.title) + '</h3>'
            + (item.desc ? '<p class="feed-desc">' + esc(item.desc) + '</p>' : '')
            + '<div class="feed-meta">' + (item.date ? '<span>📅 ' + esc(item.date) + '</span>' : '') + tags + '</div>'
            + '</div>'
            + '</a>';
    }

    function fill(slotName, items, options) {
        var block = document.querySelector('[data-block="' + slotName + '"]');
        var slot = document.querySelector('[data-slot="' + slotName + '"]');
        if (!block || !slot) return;
        if (!items.length) {
            block.hidden = true;
            return;
        }
        slot.innerHTML = items.map(function (item) {
            return cardHtml(item, options);
        }).join('');
        block.hidden = false;
    }

    function start() {
        var loading = document.getElementById('feedLoading');
        var home = './data/meta/home.json';

        Promise.all([
            fetchJson(home).catch(function () { return {}; }),
            fetchJson('./data/meta/stats.json').catch(function () { return {}; }),
            fetchJson('./data/blog/index.json').catch(function () { return []; }),
            fetchJson('./data/project/index.json').catch(function () { return []; })
        ]).then(function (results) {
            var config = results[0] || {};
            var stats = results[1] || {};
            var blogs = Array.isArray(results[2]) ? results[2].map(function (e) { return toItem(e, 'blog'); }) : [];
            var projects = Array.isArray(results[3]) ? results[3].map(function (e) { return toItem(e, 'project'); }) : [];
            var weights = config.hotWeights || {};
            var all = projects.concat(blogs);

            // 固定精选：按配置顺序，找不到的条目自动跳过
            var byKey = {};
            all.forEach(function (item) { byKey[item.kind + ':' + item.slug] = item; });
            var featured = (config.featured || []).map(function (ref) {
                return byKey[ref.type + ':' + ref.slug]
                    ? { item: byKey[ref.type + ':' + ref.slug], badge: ref.badge }
                    : null;
            }).filter(Boolean);

            var featuredKeys = {};
            featured.forEach(function (entry) { featuredKeys[entry.item.kind + ':' + entry.item.slug] = true; });

            var rest = all.filter(function (item) {
                return !featuredKeys[item.kind + ':' + item.slug];
            });

            var recent = rest.slice().sort(function (a, b) { return b.time - a.time; }).slice(0, MAX_CARDS);
            var hot = rest.slice().sort(function (a, b) {
                return hotScore(b, weights, stats) - hotScore(a, weights, stats);
            }).slice(0, MAX_CARDS);

            // 标题可在配置里改
            var titles = config.sections || {};
            ['featured', 'recent', 'hot'].forEach(function (key) {
                var block = document.querySelector('[data-block="' + key + '"] h2');
                if (block && titles[key]) block.textContent = titles[key];
            });

            // 精选卡片各自带徽标，单独渲染
            var featuredBlock = document.querySelector('[data-block="featured"]');
            var featuredSlot = document.querySelector('[data-slot="featured"]');
            if (featuredBlock && featuredSlot) {
                if (featured.length) {
                    featuredSlot.innerHTML = featured.map(function (entry) {
                        return cardHtml(entry.item, { featured: true, badge: entry.badge });
                    }).join('');
                    featuredBlock.hidden = false;
                } else {
                    featuredBlock.hidden = true;
                }
            }

            fill('recent', recent);
            fill('hot', hot);
        }).catch(function (err) {
            if (window.console) console.warn('首页动态区块加载失败：', err);
            var block = document.querySelector('[data-block="featured"]');
            if (block) block.hidden = true;
        }).then(function () {
            if (loading) loading.remove();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
