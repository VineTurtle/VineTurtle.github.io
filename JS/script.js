// JS/script.js
(function() {
    // 月份变色逻辑
    function updateMonthColors() {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        document.body.className = `month-${currentMonth}`;

        // 更新月份徽标（和 layout.js 同步）
        const badge = document.getElementById('monthBadge');
        if (badge) {
            const icons = ['❄️','🌲','🌱','🌸','🌿','🍊','💜','🌾','🍇','🍁','🌫️','🎄'];
            badge.textContent = `${icons[currentMonth-1] || '🌿'} ${currentMonth}月`;
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