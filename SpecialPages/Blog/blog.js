// SpecialPages/Blog/blog.js —— 博客列表页配置（渲染逻辑见 JS/special-list.js）
window.VTS.createListPage({
    dataUrl: '../../data/blog/index.json',
    perPage: 6,
    gridId: 'blogGrid',
    filterBarId: 'filterBar',
    filterCountId: 'filterCount',
    paginationId: 'pagination',
    noun: '篇',
    emptyNoun: '标签的文章',
    mainSelector: '.blog-main',
    tagBadgeSelector: '.blog-tag-badge',
    coverClass: 'blog-card-cover',
    buildCard: function(post, h) {
        const isPlaceholder = h.isPlaceholder;
        const cardClass = isPlaceholder ? 'blog-card blog-card-placeholder' : 'blog-card';

        const baseLink = post.link || 'post.html?slug=' + encodeURIComponent(post.slug || post.id);
        const linkHref = isPlaceholder ? '#' : h.buildDetailLink(baseLink);
        const linkWrapper = isPlaceholder ? '' : '<a href="' + h.escapeHtml(linkHref) + '" class="blog-card-link">';
        const linkClose = isPlaceholder ? '' : '</a>';

        const coverHtml = h.buildCoverHtml(post, isPlaceholder);

        let tagsHtml = '';
        if (!isPlaceholder && post.tags && post.tags.length > 0) {
            tagsHtml = '<div class="blog-tags">' + post.tags.map(function(t) {
                return '<span class="blog-tag-badge" data-tag="' + h.escapeHtml(t) + '">#' + h.escapeHtml(t) + '</span>';
            }).join('') + '</div>';
        }

        const metaHtml = isPlaceholder
            ? '<div class="blog-card-meta"><span class="blog-date">' + h.escapeHtml(h.formatDate(post.date) || '即将发布') + '</span><span class="blog-tag">新文</span></div>'
            : '<div class="blog-card-meta"><span class="blog-date">' + h.escapeHtml(h.formatDate(post.date)) + '</span><span class="blog-tag">' + h.escapeHtml(post.tags[0] || '随笔') + '</span></div>';

        const readmoreHtml = isPlaceholder
            ? '<span class="blog-readmore">敬请期待</span>'
            : '<span class="blog-readmore">阅读全文 →</span>';

        return '<article class="' + cardClass + '">'
            + linkWrapper
            + coverHtml
            + '<div class="blog-card-body">'
            + metaHtml
            + '<h3>' + h.escapeHtml(post.title) + '</h3>'
            + tagsHtml
            + '<p class="blog-excerpt">' + h.escapeHtml(post.excerpt || '') + '</p>'
            + readmoreHtml
            + '</div>'
            + linkClose
            + '</article>';
    }
});
