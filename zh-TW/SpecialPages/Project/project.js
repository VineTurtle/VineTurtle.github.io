// SpecialPages/Project/project.js —— 项目列表页配置（渲染逻辑见 JS/special-list.js）
window.VTS.createListPage({
    dataUrl: '../../data/project/index.json',
    perPage: 3,
    gridId: 'projectGrid',
    filterBarId: 'filterBar',
    filterCountId: 'filterCount',
    paginationId: 'pagination',
    nounKey: 'list.countProject',
    emptyKey: 'list.emptyProject',
    mainSelector: '.project-main',
    tagBadgeSelector: '.project-tag-badge',
    coverClass: 'project-card-cover',
    buildCard: function(proj, h) {
        const isPlaceholder = h.isPlaceholder;
        const cardClass = isPlaceholder ? 'project-card project-card-placeholder' : 'project-card';

        const baseLink = proj.slug
            ? encodeURIComponent(proj.slug) + '.html'
            : 'detail.html?id=' + encodeURIComponent(proj.id);
        const linkHref = isPlaceholder ? '#' : h.buildDetailLink(baseLink);

        const coverHtml = h.buildCoverHtml(proj, isPlaceholder);

        let tagsHtml = '';
        if (!isPlaceholder && proj.tags && proj.tags.length > 0) {
            tagsHtml = '<div class="project-tags">' + proj.tags.map(function(t) {
                return '<span class="project-tag-badge" data-tag="' + h.escapeHtml(t) + '">#' + h.escapeHtml(t) + '</span>';
            }).join('') + '</div>';
        }

        const footerHtml = isPlaceholder
            ? '<div class="project-footer"><span class="project-status status-plan">' + h.t('list.planning') + '</span><span class="project-link">' + h.t('list.soon') + '</span></div>'
            : '<div class="project-footer">'
                + '<span class="project-status ' + h.escapeHtml(proj.statusClass || 'status-plan') + '">' + h.escapeHtml(proj.status || h.t('list.ongoing')) + '</span>'
                + '<a href="' + h.escapeHtml(linkHref) + '" class="project-link">' + h.t('list.viewDetail') + '</a>'
                + '</div>';

        return '<div class="' + cardClass + '">'
            + coverHtml
            + '<div class="project-card-body">'
            + '<h2>' + h.escapeHtml(proj.title) + '</h2>'
            + tagsHtml
            + '<p class="project-desc">' + h.escapeHtml(proj.desc || '') + '</p>'
            + footerHtml
            + '</div>'
            + '</div>';
    }
});
