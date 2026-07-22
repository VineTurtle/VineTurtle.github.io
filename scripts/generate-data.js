// scripts/generate-data.js
const fs = require('fs');
const path = require('path');

// ================================================================
//  1. 从你的原始 JS 文件中复制数据（请替换为实际内容）
// ================================================================

// ---------- 博客数据 ----------
// 从 SpecialPages/Blog/ 下的 blog.js 中复制 blogPosts 数组（不含 link 字段，因为详情页通过 id 拼接）
const blogPosts = [
    // 粘贴你的 blogPosts 内容，例如：
    // { id: 1, title: '森林四季配色系统 · 诞生记', date: '2026-07-15', tags: ['设计思考'], excerpt: '...', thumbnail: '...', hero: '...', fallbackIcon: '🌲' },
    // ...
];

// 从 SpecialPages/Blog/ 下的 post.js 中复制 postsData 数组（含 content 字段）
const postsData = [
    // 粘贴你的 postsData 内容，例如：
    // { id: 1, title: '森林四季配色系统 · 诞生记', date: '2026-07-15', tags: ['设计思考'], hero: '...', fallbackIcon: '🌲', content: '...' },
    // ...
];

// ---------- 项目数据 ----------
// 从 SpecialPages/Project/ 下的 project.js 中复制 projects 数组（不含 link）
const projectList = [
    // 粘贴你的 projects 内容，例如：
    // { id: 1, title: '藤栖龟舍 · 品牌全案', thumbnail: '...', hero: '...', fallbackIcon: '🌳', tags: ['品牌设计'], status: '✅ 已完成', statusClass: 'status-done', year: '2026', desc: '...' },
    // ...
];

// 从 SpecialPages/Project/ 下的 detail.js 中复制 projectsData 数组（含 content）
const projectDetails = [
    // 粘贴你的 projectsData 内容，例如：
    // { id: 1, title: '藤栖龟舍 · 品牌全案', hero: '...', fallbackIcon: '🌳', tags: ['品牌设计'], status: '✅ 已完成', statusClass: 'status-done', year: '2026', content: '...' },
    // ...
];

// ================================================================
//  2. 生成 JSON 文件
// ================================================================

function generateBlogData() {
    const dataDir = path.join(__dirname, '../data/blog');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // 索引：只取元数据
    const index = blogPosts.map(({ id, title, date, tags, excerpt, thumbnail, hero, fallbackIcon }) => ({
        id, title, date, tags, excerpt, thumbnail, hero, fallbackIcon
    }));
    fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(index, null, 2));

    // 每篇文章的完整数据（不含 id，因为文件名已经包含 id）
    postsData.forEach(post => {
        const { id, ...rest } = post;
        fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(rest, null, 2));
    });

    console.log('✅ 博客数据生成完成');
}

function generateProjectData() {
    const dataDir = path.join(__dirname, '../data/project');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // 索引
    const index = projectList.map(({ id, title, thumbnail, hero, fallbackIcon, tags, status, statusClass, year, desc }) => ({
        id, title, thumbnail, hero, fallbackIcon, tags, status, statusClass, year, desc
    }));
    fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(index, null, 2));

    // 每个项目的完整数据
    projectDetails.forEach(item => {
        const { id, ...rest } = item;
        fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(rest, null, 2));
    });

    console.log('✅ 项目数据生成完成');
}

// 执行
generateBlogData();
generateProjectData();