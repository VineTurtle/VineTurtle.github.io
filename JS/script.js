// JS/script.js
(function() {
    const MONTH_ICONS = ['❄️', '🌲', '🌱', '🌸', '🌿', '🍊', '💜', '🌾', '🍇', '🍁', '🌫️', '🎄'];

    // 月份变色逻辑
    function updateMonthColors() {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;

        // 只维护 month-x 类，避免覆盖 body 上的其他类
        for (let m = 1; m <= 12; m++) {
            document.body.classList.toggle('month-' + m, m === currentMonth);
        }

        // 更新月份徽标：英文字典的模板是「{icon} {month}」，需要月份名而不是数字（R8）
        const t = window.VTS && window.VTS.t ? window.VTS.t : function (k, v) { return k; };
        const lang = (window.VTS && window.VTS.lang) || 'zh-CN';
        const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthValue = lang === 'en' ? MONTHS_EN[currentMonth - 1] : currentMonth;
        const badge = document.getElementById('monthBadge');
        if (badge) {
            badge.textContent = t('common.monthBadge', { icon: MONTH_ICONS[currentMonth - 1] || '🌿', month: monthValue });
        }

        // 更新月份显示（如果页面里有）
        const monthEl = document.querySelector('.month-indicator');
        if (monthEl) {
            monthEl.textContent = t('common.monthIndicator', { month: currentMonth });
        }
    }

    // 暴露给 layout.js 调用
    window.updateMonthColors = updateMonthColors;

    // 页面加载时执行
    document.addEventListener('DOMContentLoaded', updateMonthColors);
})();
