// SpecialPages/Project/detail.js —— 项目详情页配置（加载逻辑见 JS/special-detail.js）
window.VTS.createDetailPage({
    indexUrl: '../../data/project/index.json',
    jsonDir: '../../data/project',
    htmlDir: '../../data/project/posts',
    contentId: 'detailContent',
    notFoundClass: 'detail-not-found',
    backLinkId: 'backLink',
    backHref: 'index.html',
    heroImgClass: 'detail-hero-img',
    render: function(project, htmlContent, container) {
        const h = window.VTS;
        const heroHtml = h.renderHero(project, 'detail-hero-img');
        const tagsHtml = (project.tags || []).map(function(t) {
            return '<span class="tag">#' + h.escapeHtml(t) + '</span>';
        }).join('');

        container.innerHTML = '<article class="project-detail">'
            + heroHtml
            + '<div class="detail-header">'
            + '<h1>' + h.escapeHtml(project.title) + '</h1>'
            + '<div class="detail-meta">'
            + '<span class="project-status ' + h.escapeHtml(project.statusClass || 'status-plan') + '">' + h.escapeHtml(project.status || '进行中') + '</span>'
            + '<span class="detail-year">📅 ' + h.escapeHtml(project.year || '待定') + '</span>'
            + '</div>'
            + '</div>'
            + '<div class="detail-tags-display">' + tagsHtml + '</div>'
            + '<div class="detail-body">' + htmlContent + '</div>'
            + '</article>';

        h.bindImageFallbacks(container);
        h.setupCopyButtons(container);
        h.highlightCode(container);
        document.title = project.title + ' · 藤栖龟舍';
    }
});
