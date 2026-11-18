// scripts/check-links.js —— 站内死链检查（C2）
// 扫描全站 HTML（含四语镜像）的 href / src / srcset / poster，校验内部目标文件存在，
// 并校验 #锚点 在目标文件中可达。跳过外链 / mailto / tel / data: 等（运行时 JS 拼接的
// 链接不在静态扫描范围内）。发现死链时以退出码 1 结束，供 CI（build-check.yml）硬门槛。
//
// 覆盖范围说明：pre/code/script/style/注释内容先剔除，代码示例里的字符串不会误报；
// 锚点解析按 id="…" / name="…" 字面匹配，运行时 JS 生成的动态 id（如目录 slug）不在范围。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'admin', 'worker', 'scripts', '.lighthouseci']);
// data 目录整体跳过：正文片段与覆盖源不是页面，链接由生成器而非源文件保证
// admin 为本地开发后台（npm run admin），依赖 dev server 路由，不做静态校验

const EXTERNAL = /^(https?:)?\/\//i;
const NON_PAGE = /^(mailto:|tel:|javascript:|data:|blob:)/i;

function stripInvisible(html) {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '')
        .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '');
}

function collectHtmlFiles(dir, out) {
    for (const name of fs.readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) collectHtmlFiles(full, out);
        else if (name.endsWith('.html')) out.push(full);
    }
    return out;
}

// 从属性值（含 srcset 多值）拆出 URL 列表
function extractUrls(value) {
    return String(value || '')
        .split(',')
        .map(part => part.trim().split(/\s+/)[0])
        .filter(Boolean);
}

const idCache = new Map(); // 文件绝对路径 → Set(锚点名)

function idsOf(file) {
    if (idCache.has(file)) return idCache.get(file);
    let ids = new Set();
    try {
        const html = stripInvisible(fs.readFileSync(file, 'utf-8'));
        const re = /\b(?:id|name)\s*=\s*["']([^"']+)["']/gi;
        let m;
        while ((m = re.exec(html))) ids.add(m[1]);
    } catch (e) { /* 读不到就当作无锚点 */ }
    idCache.set(file, ids);
    return ids;
}

// 解析引用 → { target, fragment }。手工解析而非 new URL：Windows 下
// 'file://' + 'C:/…' 会把盘符解析成 host，相对路径全部错位（已踩坑）。
function resolveRef(htmlFile, raw) {
    let value = raw.trim();
    if (!value || value.startsWith('#')) return null; // 纯同页锚点在主循环单独处理
    if (EXTERNAL.test(value) || NON_PAGE.test(value)) return null;

    let fragment = '';
    const hashIdx = value.indexOf('#');
    if (hashIdx !== -1) {
        fragment = value.slice(hashIdx + 1);
        value = value.slice(0, hashIdx);
    }
    const qIdx = value.indexOf('?');
    if (qIdx !== -1) value = value.slice(0, qIdx);
    value = value.trim();
    if (!value) return null;

    let pathname;
    try { pathname = decodeURIComponent(value); } catch (e) { pathname = value; }

    let target;
    if (pathname.startsWith('/')) target = path.join(ROOT, pathname.replace(/^\/+/, ''));
    else target = path.join(path.dirname(htmlFile), pathname);
    // 目录形式 → index.html；无扩展名 → 补 .html
    if (pathname.endsWith('/')) target = path.join(target, 'index.html');
    else if (!path.extname(target)) target += '.html';
    return { target, fragment };
}

function main() {
    const files = collectHtmlFiles(ROOT, []);
    const broken = [];   // 文件不存在
    const deadAnchors = []; // 目标文件存在但锚点不存在
    let checked = 0;

    for (const file of files) {
        const html = stripInvisible(fs.readFileSync(file, 'utf-8'));
        const attrRe = /\b(?:href|src|srcset|poster)\s*=\s*["']([^"']+)["']/gi;
        let m;
        while ((m = attrRe.exec(html))) {
            for (const raw of extractUrls(m[1])) {
                // 同页锚点：#frag
                if (raw.startsWith('#') && raw.length > 1) {
                    checked++;
                    const frag = decodeURIComponent(raw.slice(1));
                    if (!idsOf(file).has(frag)) {
                        deadAnchors.push(path.relative(ROOT, file) + '  ' + raw);
                    }
                    continue;
                }
                const ref = resolveRef(file, raw);
                if (!ref) continue;
                checked++;
                if (!fs.existsSync(ref.target)) {
                    broken.push(path.relative(ROOT, file) + '  →  ' + raw);
                    continue;
                }
                if (ref.fragment) {
                    const frag = decodeURIComponent(ref.fragment);
                    if (!idsOf(ref.target).has(frag)) {
                        deadAnchors.push(path.relative(ROOT, file) + '  →  ' + raw);
                    }
                }
            }
        }
    }

    console.log('扫描 ' + files.length + ' 个 HTML 文件，校验 ' + checked + ' 个内部引用。');
    if (broken.length) {
        console.log('\n❌ 死链 ' + broken.length + ' 处：');
        broken.forEach(s => console.log('   ' + s));
    }
    if (deadAnchors.length) {
        console.log('\n⚠️ 失效锚点 ' + deadAnchors.length + ' 处（目标存在但 id/name 未命中）：');
        deadAnchors.forEach(s => console.log('   ' + s));
    }
    if (!broken.length && !deadAnchors.length) {
        console.log('🎉 站内链接全部可达。');
    } else {
        process.exitCode = 1;
    }
}

main();
