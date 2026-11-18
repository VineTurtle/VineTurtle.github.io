// SpecialPages/Blog/blog.js —— 博客列表页配置（渲染逻辑见 JS/special-list.js）
window.VTS.createListPage({
    dataUrl: '../../data/blog/index.json',
    perPage: 6,
    gridId: 'blogGrid',
    filterBarId: 'filterBar',
    filterCountId: 'filterCount',
    paginationId: 'pagination',
    nounKey: 'list.countPost',
    emptyKey: 'list.emptyPost',
    mainSelector: '.blog-main',
    tagBadgeSelector: '.blog-tag-badge',
    coverClass: 'blog-card-cover',
    buildCard: function(post, h) {
        const isPlaceholder = h.isPlaceholder;
        const cardClass = isPlaceholder ? 'blog-card blog-card-placeholder' : 'blog-card';

        const baseLink = post.slug
            ? encodeURIComponent(post.slug) + '.html'
            : 'post.html?slug=' + encodeURIComponent(post.id);
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
            ? '<div class="blog-card-meta"><span class="blog-date">' + h.escapeHtml(h.formatDate(post.date) || h.t('list.coming')) + '</span><span class="blog-tag">' + h.t('list.newPost') + '</span></div>'
            : '<div class="blog-card-meta"><span class="blog-date">' + h.escapeHtml(h.formatDate(post.date)) + '</span><span class="blog-tag">' + h.escapeHtml(post.tags[0] || h.t('list.essay')) + '</span></div>';

        const readmoreHtml = isPlaceholder
            ? '<span class="blog-readmore">' + h.t('list.soon') + '</span>'
            : '<span class="blog-readmore">' + h.t('list.readMore') + '</span>';

        return '<article class="' + cardClass + '">'
            + linkWrapper
            + coverHtml
            + '<div class="blog-card-body">'
            + metaHtml
            + '<h2>' + h.escapeHtml(post.title) + '</h2>'
            + tagsHtml
            + '<p class="blog-excerpt">' + h.escapeHtml(post.excerpt || '') + '</p>'
            + readmoreHtml
            + '</div>'
            + linkClose
            + '</article>';
    }
});
