// SpecialPages/Blog/post.js —— 文章详情页配置（加载逻辑见 JS/special-detail.js）
window.VTS.createDetailPage({
    indexUrl: '../../data/blog/index.json',
    jsonDir: '../../data/blog',
    htmlDir: '../../data/blog/posts',
    contentId: 'postContent',
    notFoundClass: 'post-not-found',
    backLinkId: 'backLink',
    backHref: 'index.html',
    heroImgClass: 'post-hero-img',
    render: function(post, htmlContent, container) {
        const h = window.VTS;
        const heroHtml = h.renderHero(post, 'post-hero-img');
        const tagsHtml = (post.tags || []).map(function(t) {
            return '<span class="tag">#' + h.escapeHtml(t) + '</span>';
        }).join('');

        container.innerHTML = '<article class="post-article">'
            + heroHtml
            + '<header class="post-header">'
            + '<h1>' + h.escapeHtml(post.title) + '</h1>'
            + '<div class="post-meta"><span>📅 ' + h.escapeHtml(h.formatDate(post.date)) + '</span></div>'
            + '<div class="post-tags-display">' + tagsHtml + '</div>'
            + '</header>'
            + '<div class="post-body">' + htmlContent + '</div>'
            + '</article>';

        h.bindImageFallbacks(container);
        h.setupCopyButtons(container);
        h.highlightCode(container);
        document.title = post.title + ' · 藤栖龟舍';
    }
});
