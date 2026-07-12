document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取当前月份 (0-11，所以要 +1)
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1月 = 1, 12月 = 12

    // 2. 将月份应用到 body 的 class
    document.body.className = `month-${currentMonth}`;

    // 3. 更新文字提示
    const monthTextEl = document.getElementById('monthIndicator');
    const moodTextEl = document.getElementById('moodText');

    if (monthTextEl) {
        monthTextEl.textContent = `森林小镇 · ${currentMonth}月`;
    }

    // 4. 月份对应的情感描述
    const moodDescriptions = {
        1: '❄️ 雪松覆盖，小镇在冬日的阳光下安静沉睡。',
        2: '🌲 枯枝摇曳，森林正在为春天的苏醒积蓄力量。',
        3: '🌱 初芽破土，森林小镇的春天悄然而至。',
        4: '🌸 桃花盛开，小镇里飘着淡淡的花香。',
        5: '🌿 绿荫蔽日，五月绿兄的森林迎来最繁盛的时节。',
        6: '🍊 果园硕果，阳光透过树叶洒下斑驳的光影。',
        7: '💜 薰衣草田，夏日的晚风带着静谧的芬芳。',
        8: '🌾 麦浪金黄，小镇里洋溢着丰收的喜悦。',
        9: '🍇 浆果成熟，森林的角落藏着酸甜的秘密。',
        10: '🍁 枫叶如火，小镇披上了绚丽的秋装。',
        11: '🌫️ 雾气缭绕，森林小镇显得神秘而温柔。',
        12: '🎄 深松耸立，冬日的绿意守护着温暖的家园。'
    };

    if (moodTextEl) {
        moodTextEl.textContent = moodDescriptions[currentMonth] || '🌿 森林小镇在时光中静静生长。';
    }
});