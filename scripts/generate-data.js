// scripts/generate-data.js
// 扫描 data/ 下各内容分类目录，自动生成各分类的 index.json。
// 分类配置统一来自 scripts/kinds.json（管理后台可增删分类并同步此文件）。
// 每篇内容由两部分组成：
//   data/<分类>/<name>.json        —— 元数据（title/date/tags/...）
//   data/<分类>/posts/<name>.html  —— 正文 HTML
// 本脚本只负责汇总元数据，不生成正文。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KINDS_FILE = path.join(__dirname, 'kinds.json');

// ---------- 分类配置 ----------

function loadKinds() {
    try {
        return JSON.parse(fs.readFileSync(KINDS_FILE, 'utf-8'));
    } catch (e) {
        console.error('⚠️ 读取分类配置失败（' + KINDS_FILE + '）：' + e.message);
        return {};
    }
}

// ---------- 工具 ----------

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json') && f !== 'index.json')
        .sort();
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// 从文件名推断数字 id：仅纯数字文件名（如 "3.json" -> 3），失败返回 null。
// 形如 "2026-07-22-linux-app-icon-fix" 的文件名是 slug，不是 id。
function idFromFilename(name) {
    const base = name.replace(/\.json$/, '');
    if (!/^\d+$/.test(base)) return null;
    return parseInt(base, 10);
}

function dateKey(item) {
    return item.date || '';
}

function sortByDateDesc(a, b) {
    const da = dateKey(a), db = dateKey(b);
    if (da !== db) return da < db ? 1 : -1;
    return (a.id || 0) - (b.id || 0);
}

// ---------- 通用生成逻辑 ----------

function buildIndex(dir, indexName) {
    const files = listJsonFiles(dir);
    const items = files.map(name => {
        const item = readJson(path.join(dir, name));
        const base = name.replace(/\.json$/, '');
        const id = item.id != null ? item.id : idFromFilename(name);
        // 文件名即 slug；缺失时自动补全，保证详情页能按 slug 加载
        const slug = item.slug || base;
        return { ...item, id, slug };
    }).filter(x => x.title); // 跳过无标题的残缺文件

    // 按日期倒序稳定排序
    const sorted = items.slice().sort(sortByDateDesc);

    // 补齐缺失的 id（按排序顺序分配最小可用值）
    const used = new Set(sorted.map(x => x.id).filter(n => typeof n === 'number'));
    let next = 1;
    sorted.forEach(item => {
        if (item.id == null) {
            while (used.has(next)) next++;
            item.id = next;
            used.add(next);
        }
    });

    // 汇总到索引
    const index = sorted.map(({ id, slug, title, date, tags, excerpt, thumbnail, hero, fallbackIcon, status, statusClass, year, desc }) => ({
        id,
        ...(slug ? { slug } : {}),
        title,
        ...(date ? { date } : {}),
        ...(Array.isArray(tags) && tags.length ? { tags } : { tags: [] }),
        ...(excerpt ? { excerpt } : {}),
        ...(thumbnail ? { thumbnail } : {}),
        ...(hero ? { hero } : {}),
        ...(fallbackIcon ? { fallbackIcon } : {}),
        ...(status ? { status } : {}),
        ...(statusClass ? { statusClass } : {}),
        ...(year ? { year } : {}),
        ...(desc ? { desc } : {})
    }));

    fs.mkdirSync(dir, { recursive: true }); // 目录不存在时自动创建
    fs.writeFileSync(path.join(dir, indexName), JSON.stringify(index, null, 2) + '\n');
    return index.length;
}

// ---------- 执行 ----------

const kinds = loadKinds();
for (const key of Object.keys(kinds)) {
    const cfg = kinds[key];
    const dir = path.join(ROOT, cfg.dataDir || ('data/' + key));
    try {
        const count = buildIndex(dir, 'index.json');
        console.log(`✅ ${cfg.label || key}数据生成完成（${count} ${cfg.label ? '项' : '篇'}）`);
    } catch (e) {
        console.error(`❌ ${cfg.label || key}数据生成失败：${e.message}`);
    }
}
