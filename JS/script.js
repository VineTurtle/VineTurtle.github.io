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

        // 更新月份徽标
        const badge = document.getElementById('monthBadge');
        if (badge) {
            badge.textContent = `${MONTH_ICONS[currentMonth - 1] || '🌿'} ${currentMonth}月`;
        }

        // 更新月份显示（如果页面里有）
        const monthEl = document.querySelector('.month-indicator');
        if (monthEl) {
            monthEl.textContent = `森林小镇 · ${currentMonth}月`;
        }
    }

    // 暴露给 layout.js 调用
    window.updateMonthColors = updateMonthColors;

    // 页面加载时执行
    document.addEventListener('DOMContentLoaded', updateMonthColors);
})();
