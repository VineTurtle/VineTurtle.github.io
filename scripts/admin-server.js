// scripts/admin-server.js
// 本地管理员后台服务器（仅供本地开发使用，请勿部署到生产环境）。
//
// 用法：
//   node scripts/admin-server.js            # 默认端口 3000，随机令牌
//   PORT=8080 node scripts/admin-server.js   # 指定端口
//
// 启动后终端会打印管理员地址（含一次性令牌）：
//   http://127.0.0.1:3000/admin?token=xxxx
//
// 安全说明：
//   - 只监听 127.0.0.1，外部无法访问；
//   - /api/* 需要令牌（Authorization: Bearer <token>），防止跨站伪造请求；
//   - 后台页面 /admin 仅本机可访问，未带 token 时由 admin.js 弹出登录框；
//   - 普通用户访问的是生产环境的静态站点，本脚本不参与部署。
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 3000;
const TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(8).toString('hex');

const BLOG_DIR = path.join(ROOT, 'data', 'blog');
const PROJECT_DIR = path.join(ROOT, 'data', 'project');

const KINDS_FILE = path.join(ROOT, 'scripts', 'kinds.json');
const TEMPLATE_DIR = path.join(ROOT, 'scripts', 'templates', 'category');

// 内容分类配置统一来自 scripts/kinds.json（管理后台「分类管理」可增删，并同步建目录/页面/导航）。
// kind 键即 API 路径（/api/posts、/api/projects、/api/<新分类>）。
let KINDS = {};
function loadKinds() {
    try {
        KINDS = JSON.parse(fs.readFileSync(KINDS_FILE, 'utf-8')) || {};
    } catch (_) {
        KINDS = {};
    }
}
function saveKinds() {
    fs.writeFileSync(KINDS_FILE, JSON.stringify(KINDS, null, 2) + '\n');
}
loadKinds();

function kindDataDir(key) {
    const cfg = KINDS[key];
    return cfg ? path.join(ROOT, cfg.dataDir || ('data/' + key)) : null;
}

function kindImageDir(key) {
    const cfg = KINDS[key];
    return cfg ? path.join(ROOT, 'Resources', 'images', cfg.imageSub || key) : null;
}

// 图片目录（按分类 + 旧上传目录），用于图片管理页。
function listImageDirs() {
    const dirs = [];
    for (const key of Object.keys(KINDS)) {
        const cfg = KINDS[key];
        dirs.push({ key: cfg.imageSub || key, label: cfg.label || key, dir: kindImageDir(key) });
    }
    dirs.push({ key: 'uploads', label: '旧上传（兼容）', dir: path.join(ROOT, 'Resources', 'images', 'uploads') });
    return dirs;
}

function imageDirBySub(sub) {
    const found = listImageDirs().find(d => d.key === sub);
    return found ? found.dir : null;
}

function imageUrl(sub, fname) {
    return '../../Resources/images/' + sub + '/' + fname;
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.woff2': 'font/woff2',
};

// ---------- 工具 ----------

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, obj) {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

function safeName(name) {
    if (!name || typeof name !== 'string') return null;
    if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
    if (name === 'index' || name === '.' || name.startsWith('.')) return null;
    return name;
}

// 列出 data/<kind>/*.json（不含 index.json）
function listEntries(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json') && f !== 'index.json')
        .map(f => f.replace(/\.json$/, ''))
        .sort();
}

function nextId(dir) {
    let max = 0;
    for (const name of listEntries(dir)) {
        // 仅纯数字文件名视为 id；形如 "2026-07-22-..." 是 slug，不是 id
        if (/^\d+$/.test(name)) {
            const n = parseInt(name, 10);
            if (n > max) max = n;
        }
        try {
            const item = readJson(path.join(dir, name + '.json'));
            if (typeof item.id === 'number' && item.id > max) max = item.id;
        } catch (_) { /* ignore */ }
    }
    return max + 1;
}

function regenerateIndex(done) {
    const script = path.join(ROOT, 'scripts', 'generate-data.js');
    execFile(process.execPath, [script], { cwd: ROOT }, (err, stdout, stderr) => {
        if (err) {
            return done(new Error((stderr || stdout || 'index 生成失败').slice(0, 500)));
        }
        done(null, stdout.trim());
    });
}

// ---------- 静态文件 ----------

function serveFile(res, filePath, statusCode) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(statusCode || 200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}

function serveStatic(req, res, urlPath) {
    let p = urlPath.split('?')[0];
    if (p === '/' || p === '') p = '/index.html';

    const filePath = path.normalize(path.join(ROOT, p));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
    }
    serveFile(res, filePath);
}

// ---------- 管理 API ----------

function isAuthorized(req) {
    const auth = req.headers.authorization || '';
    return auth === 'Bearer ' + TOKEN;
}

// 令牌只用于保护 /api/*（防止跨站伪造请求）。
// 后台静态页面 /admin 不设令牌（仅本机可访问），未带 token 时由 admin.js 显示登录框。
function allowAdmin() {
    return true;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
            if (data.length > 20 * 1024 * 1024) {
                reject(new Error('请求体过大'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

function json(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
}

// 列表：返回元数据 + 正文是否存在
function listFor(kind) {
    const dir = kindDataDir(kind);
    if (!dir) return [];
    const postsDir = path.join(dir, 'posts');
    const names = listEntries(dir);
    const items = names.map(name => {
        let meta = {};
        try { meta = readJson(path.join(dir, name + '.json')); } catch (_) {}
        return {
            name,
            ...meta,
            hasBody: fs.existsSync(path.join(postsDir, name + '.html'))
        };
    });
    return items;
}

// ---------- 原子保存 / 删除（含回滚） ----------

// 读取一对文件（meta + body）作为备份；文件不存在则置 null
function readPair(dir, postsDir, name) {
    const jsonFile = path.join(dir, name + '.json');
    const htmlFile = path.join(postsDir, name + '.html');
    return {
        name,
        json: fs.existsSync(jsonFile) ? fs.readFileSync(jsonFile, 'utf-8') : null,
        html: fs.existsSync(htmlFile) ? fs.readFileSync(htmlFile, 'utf-8') : null
    };
}

function writePair(dir, postsDir, name, jsonText, htmlText) {
    fs.mkdirSync(postsDir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.json'), jsonText);
    fs.writeFileSync(path.join(postsDir, name + '.html'), htmlText);
}

function deletePair(dir, postsDir, name) {
    for (const f of [path.join(dir, name + '.json'), path.join(postsDir, name + '.html')]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
}

// 用备份恢复（json/html 为 null 表示原本不存在，则删除）
function restorePair(dir, postsDir, backup) {
    if (!backup) return;
    const jsonFile = path.join(dir, backup.name + '.json');
    const htmlFile = path.join(postsDir, backup.name + '.html');
    if (backup.json == null) { if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile); }
    else fs.writeFileSync(jsonFile, backup.json);
    if (backup.html == null) { if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile); }
    else { fs.mkdirSync(postsDir, { recursive: true }); fs.writeFileSync(htmlFile, backup.html); }
}

function entriesDir(kind) {
    return kindDataDir(kind) || BLOG_DIR;
}

// 生成不重复的文件名（存在则追加 -2 / -3 …）
function uniqueName(dir, name) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let candidate = name;
    let i = 2;
    while (fs.existsSync(path.join(dir, candidate))) {
        candidate = base + '-' + i + ext;
        i++;
    }
    return candidate;
}

// 汇总所有分类的标签
function allTags() {
    const set = new Set();
    for (const kind of Object.keys(KINDS)) {
        for (const it of listFor(kind)) {
            if (Array.isArray(it.tags)) it.tags.forEach(t => set.add(t));
        }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

// 转移内容到另一分类：移动 meta + 正文两文件（图片不动，按路径仍有效），成功后重建索引
function moveWithIndex(kind, name, toKind, done) {
    if (!KINDS[kind]) return done(new Error('无效的分类'));
    if (!KINDS[toKind]) return done(new Error('无效的目标分类'));
    if (kind === toKind) return done(new Error('目标分类与当前相同'));
    const target = safeName(name);
    if (!target) return done(new Error('无效的文件名'));

    const fromDir = kindDataDir(kind), fromPosts = path.join(fromDir, 'posts');
    const toDir = kindDataDir(toKind), toPosts = path.join(toDir, 'posts');

    const src = readPair(fromDir, fromPosts, target);
    if (src.json == null && src.html == null) {
        return done(Object.assign(new Error('内容不存在'), { code: 404 }));
    }
    const dst = readPair(toDir, toPosts, target);
    if (dst.json != null || dst.html != null) {
        return done(Object.assign(new Error('目标分类已存在同名内容「' + target + '」'), { code: 409 }));
    }

    // 换新 id（目标分类自己的 id 序号），文件名/slug 保持不变
    let meta = {};
    try { meta = JSON.parse(src.json || '{}'); } catch (_) {}
    meta.id = nextId(toDir);
    const metaText = JSON.stringify(meta, null, 2) + '\n';

    try {
        writePair(toDir, toPosts, target, metaText, src.html || '');
        deletePair(fromDir, fromPosts, target);
    } catch (e) {
        restorePair(toDir, toPosts, dst);
        restorePair(fromDir, fromPosts, src);
        return done(new Error('转移失败，已回滚：' + e.message));
    }

    regenerateIndex(function (err, out) {
        if (err) {
            // 回滚：目标删除，源恢复
            deletePair(toDir, toPosts, target);
            restorePair(fromDir, fromPosts, src);
            return done(new Error('索引重建异常，已回滚：' + err.message));
        }
        done(null, { name: target, from: kind, to: toKind, out });
    });
}

function saveWithIndex(kind, body, done) {
    const dir = entriesDir(kind);
    const postsDir = path.join(dir, 'posts');
    const target = safeName(body.name);
    if (!target) return done(new Error('无效的文件名'));
    const old = safeName(body.oldName);

    // 受影响的文件先备份，索引重建失败时用于回滚
    const backups = [readPair(dir, postsDir, target)];
    if (old && old !== target) backups.push(readPair(dir, postsDir, old));

    // 计算 id（已存在则沿用，否则取新 id）
    let id = null;
    const existing = path.join(dir, target + '.json');
    if (fs.existsSync(existing)) {
        try { id = readJson(existing).id || null; } catch (_) {}
    }
    if (id == null) id = nextId(dir);

    const meta = Object.assign({}, body.post || {});
    meta.id = id;
    meta.slug = target; // 文件名即 slug

    try {
        writePair(dir, postsDir, target, JSON.stringify(meta, null, 2) + '\n', body.content || '');
        if (old && old !== target) deletePair(dir, postsDir, old); // 重命名时清理旧文件
    } catch (e) {
        for (const b of backups) restorePair(dir, postsDir, b);
        return done(new Error('写入失败，已回滚：' + e.message));
    }

    regenerateIndex(function (err, out) {
        if (err) {
            for (const b of backups) restorePair(dir, postsDir, b);
            return done(new Error('索引重建异常，已回滚原内容：' + err.message));
        }
        done(null, { name: target, id, out });
    });
}

function deleteWithIndex(kind, name, done) {
    const dir = entriesDir(kind);
    const postsDir = path.join(dir, 'posts');
    const target = safeName(name);
    if (!target) return done(new Error('无效的文件名'));

    const backup = readPair(dir, postsDir, target);
    if (backup.json == null && backup.html == null) {
        return done(Object.assign(new Error('内容不存在'), { code: 404 }));
    }

    deletePair(dir, postsDir, target);
    regenerateIndex(function (err, out) {
        if (err) {
            restorePair(dir, postsDir, backup);
            return done(new Error('索引重建异常，已恢复原内容：' + err.message));
        }
        done(null, { name: target, out });
    });
}

// ---------- 分类管理（新增/删除会自动同步文件夹、页面与导航） ----------

function renderTemplate(text, repl) {
    for (const k of Object.keys(repl)) text = text.split(k).join(repl[k]);
    return text;
}

// 在首页「更多」区插入该分类的入口卡片
function addHomeNav(cfg) {
    const home = path.join(ROOT, 'index.html');
    const html = fs.readFileSync(home, 'utf-8');
    const card = `<a href="./SpecialPages/${cfg.pageName}/index.html" class="more-card">
                        <div class="more-icon">${cfg.navIcon}</div><h3>${cfg.label}</h3><p>${cfg.navDesc}</p><span class="more-badge">点击进入</span>
                    </a>`;
    if (html.includes(card)) return; // 已存在
    const marker = '<div class="more-card" onclick="alert(\'更多展示开发中，敬请期待！\')">';
    if (!html.includes(marker)) throw new Error('首页「更多」区结构变化，请手动添加导航链接');
    fs.writeFileSync(home, html.replace(marker, card + '\n                    ' + marker));
}

// 移除首页导航中指向该分类页面的入口卡片
function removeHomeNav(cfg) {
    const home = path.join(ROOT, 'index.html');
    const html = fs.readFileSync(home, 'utf-8');
    const re = new RegExp('<a href="\\./SpecialPages/' + cfg.pageName + '/index\\.html" class="more-card">[\\s\\S]*?</a>\\s*');
    if (!re.test(html)) return;
    fs.writeFileSync(home, html.replace(re, ''));
}

// 创建分类所需的目录、空索引、列表页与详情页。返回 null 表示成功，否则返回错误信息。
function createCategoryFiles(key, cfg) {
    try {
        const dataDir = path.join(ROOT, cfg.dataDir || ('data/' + key));
        const imageDir = path.join(ROOT, 'Resources', 'images', cfg.imageSub || key);
        fs.mkdirSync(path.join(dataDir, 'posts'), { recursive: true });
        fs.mkdirSync(imageDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'index.json'), '[]\n');

        const pageDir = path.join(ROOT, 'SpecialPages', cfg.pageName);
        fs.mkdirSync(pageDir, { recursive: true });
        const repl = {
            '{{KEY}}': key,
            '{{LABEL}}': cfg.label,
            '{{PAGE_NAME}}': cfg.pageName,
            '{{NAV_ICON}}': cfg.navIcon,
            '{{DESC}}': cfg.navDesc
        };
        const mapping = [
            ['index.html', 'index.html'],
            ['post.html', 'post.html'],
            ['list.js', key + '.js'],
            ['post.js', 'post.js']
        ];
        for (const [tpl, dest] of mapping) {
            const text = fs.readFileSync(path.join(TEMPLATE_DIR, tpl), 'utf-8');
            fs.writeFileSync(path.join(pageDir, dest), renderTemplate(text, repl));
        }

        addHomeNav(cfg);
        return null;
    } catch (e) {
        return e.message;
    }
}

// 删除分类相关目录与页面、移除首页导航。返回 null 表示成功，否则返回错误信息。
function removeCategoryFiles(key, cfg) {
    try {
        const dataDir = path.join(ROOT, cfg.dataDir || ('data/' + key));
        const imageDir = path.join(ROOT, 'Resources', 'images', cfg.imageSub || key);
        for (const dir of [dataDir, imageDir, path.join(ROOT, 'SpecialPages', cfg.pageName)]) {
            if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        }
        removeHomeNav(cfg);
        return null;
    } catch (e) {
        return e.message;
    }
}

// ---------- 图片管理 ----------

function uploadsDir() {
    return path.join(ROOT, 'Resources', 'images', 'uploads');
}

// 扫描 data/ 下所有 json/html，找出引用了该图片的条目
function collectImageRefs(sub, name) {
    const needle = '/images/' + sub + '/' + name;
    const dataDir = path.join(ROOT, 'data');
    const refs = [];
    if (!fs.existsSync(dataDir)) return refs;
    (function walk(dir) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (/\.(html|json)$/.test(ent.name)) {
                let txt = '';
                try { txt = fs.readFileSync(full, 'utf-8'); } catch (_) { continue; }
                if (txt.includes(needle)) refs.push(path.relative(dataDir, full));
            }
        }
    })(dataDir);
    return refs;
}

function listImages() {
    const items = [];
    for (const d of listImageDirs()) {
        if (!d.dir || !fs.existsSync(d.dir)) continue;
        for (const f of fs.readdirSync(d.dir)) {
            const full = path.join(d.dir, f);
            if (!fs.statSync(full).isFile()) continue;
            const st = fs.statSync(full);
            items.push({
                name: f,
                dirKey: d.key,
                dirLabel: d.label,
                size: st.size,
                mtime: st.mtimeMs,
                url: imageUrl(d.key, f),
                refs: collectImageRefs(d.key, f)
            });
        }
    }
    return items.sort((a, b) => b.mtime - a.mtime);
}

const ALLOWED_IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];

// 保存一张 base64 图片到指定目录，返回最终文件名（自动去重命名）
function saveImage(dir, name, data) {
    const base64 = String(data).replace(/^data:[^;]*;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    if (!buf.length) return { error: '空文件' };
    if (buf.length > 8 * 1024 * 1024) return { error: '图片不能超过 8MB' };
    fs.mkdirSync(dir, { recursive: true });
    const safeBase = path.basename(name).replace(/[^a-zA-Z0-9.\u4e00-\u9fa5_-]/g, '_');
    const fname = uniqueName(dir, safeBase);
    fs.writeFileSync(path.join(dir, fname), buf);
    return { fname };
}

// ---------- 路由 ----------

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://' + req.headers.host);
    const pathname = url.pathname;

    try {
        // 管理后台页面与静态资源（仅本机，无需令牌；接口层另有 /api 保护）
        if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/')) {
            if (!allowAdmin()) {
                json(res, 403, { message: '禁止访问' });
                return;
            }
            // /admin 与 /admin/ 统一跳转到 /admin/index.html（保留 token 查询参数），
            // 否则相对路径 admin.css / admin.js 会相对根目录解析而 404。
            if (pathname === '/admin' || pathname === '/admin/') {
                res.writeHead(302, { 'Location': '/admin/index.html' + (url.search || '') });
                res.end();
                return;
            }
            const rel = pathname === '/admin' || pathname === '/admin/' ? '/index.html' : pathname.slice('/admin'.length);
            const filePath = path.normalize(path.join(ROOT, 'admin', rel));
            if (!filePath.startsWith(path.join(ROOT, 'admin') + path.sep)) {
                json(res, 403, { message: '禁止访问' });
                return;
            }
            serveFile(res, filePath);
            return;
        }

        // API
        if (pathname.startsWith('/api/')) {
            if (!isAuthorized(req)) {
                json(res, 401, { message: '未授权，请使用带 token 的地址访问' });
                return;
            }

            if (req.method === 'GET' && pathname === '/api/status') {
                json(res, 200, {
                    ok: true,
                    kinds: Object.keys(KINDS).map(k => {
                        const cfg = KINDS[k];
                        return {
                            key: k,
                            label: cfg.label || k,
                            count: listFor(k).length,
                            pageName: cfg.pageName,
                            dataDir: cfg.dataDir,
                            imageSub: cfg.imageSub,
                            navIcon: cfg.navIcon,
                            navDesc: cfg.navDesc,
                            builtin: !!cfg.builtin
                        };
                    }),
                    git: fs.existsSync(path.join(ROOT, '.git')),
                    host: HOST,
                    port: PORT
                });
                return;
            }

            if (req.method === 'GET' && pathname === '/api/tags') {
                json(res, 200, { ok: true, tags: allTags() });
                return;
            }

            if (req.method === 'POST' && pathname === '/api/regenerate') {
                regenerateIndex((err, out) => {
                    if (err) return json(res, 500, { ok: false, message: err.message });
                    json(res, 200, { ok: true, message: '索引已重新生成：' + out });
                });
                return;
            }

            // 图片上传：按内容分类保存到 Resources/images/<分类>/，返回相对站点根两级路径（详情页可用）。
            // 支持可选 thumbName/thumbData：由浏览器端生成的压缩小图，仅用于列表卡片加载加速。
            if (req.method === 'POST' && pathname === '/api/upload') {
                const body = JSON.parse(await readBody(req));
                const name = String(body.name || '');
                const data = String(body.data || '');
                const ext = path.extname(name).toLowerCase();
                if (!ALLOWED_IMAGE_EXT.includes(ext)) {
                    json(res, 400, { ok: false, message: '不支持的图片格式（仅 ' + ALLOWED_IMAGE_EXT.join(' / ') + '）' });
                    return;
                }
                const kindCfg = KINDS[body.kind];
                const sub = kindCfg ? kindCfg.imageSub : 'uploads';
                const dir = kindCfg ? kindCfg.imageDir : uploadsDir();

                const saved = saveImage(dir, name, data);
                if (saved.error) { json(res, 400, { ok: false, message: saved.error }); return; }

                let thumbUrl = null;
                if (body.thumbName && body.thumbData) {
                    const savedThumb = saveImage(dir, String(body.thumbName), String(body.thumbData));
                    if (!savedThumb.error) thumbUrl = imageUrl(sub, savedThumb.fname);
                }

                json(res, 200, {
                    ok: true,
                    url: imageUrl(sub, saved.fname),
                    thumbUrl
                });
                return;
            }

            if (req.method === 'POST' && pathname === '/api/deploy') {
                const script = path.join(ROOT, 'scripts', 'deploy.js');
                const child = require('child_process').spawn(process.execPath, [script], { cwd: ROOT });
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                child.stdout.on('data', d => res.write(d));
                child.stderr.on('data', d => res.write(d));
                child.on('close', code => {
                    res.write('\n[退出码 ' + code + ']');
                    res.end();
                });
                return;
            }

            // 图片列表与删除（按目录）
            if (pathname === '/api/images' && req.method === 'GET') {
                json(res, 200, { ok: true, items: listImages() });
                return;
            }
            const imgDel = pathname.match(/^\/api\/images\/([^/]+)\/([^/]+)$/);
            if (imgDel && req.method === 'DELETE') {
                const sub = imgDel[1];
                const name = safeName(imgDel[2]);
                const dir = imageDirBySub(sub);
                if (!name || !dir) { json(res, 400, { ok: false, message: '无效的文件名' }); return; }
                const file = path.join(dir, name);
                if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) {
                    json(res, 404, { ok: false, message: '图片不存在' });
                    return;
                }
                fs.unlinkSync(file);
                json(res, 200, { ok: true, message: '已删除图片 ' + name });
                return;
            }

            // 转移内容到另一分类
            if (req.method === 'POST' && pathname === '/api/move') {
                const body = JSON.parse(await readBody(req));
                moveWithIndex(String(body.kind), String(body.name), String(body.toKind), (err, result) => {
                    if (err) {
                        if (err.code === 404) return json(res, 404, { ok: false, message: '内容不存在' });
                        if (err.code === 409) return json(res, 409, { ok: false, message: err.message });
                        return json(res, 500, { ok: false, message: err.message });
                    }
                    json(res, 200, { ok: true, message: '已转移「' + result.name + '」到新分类并更新索引', result });
                });
                return;
            }

            // 新增分类：自动创建数据/图片目录、空索引、列表页/详情页，并接入首页导航
            if (req.method === 'POST' && pathname === '/api/kinds') {
                const body = JSON.parse(await readBody(req));
                const key = String(body.key || '').trim();
                const label = String(body.label || '').trim();
                if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) {
                    json(res, 400, { ok: false, message: '分类标识需为小写字母/数字/连字符（如 notes）' });
                    return;
                }
                if (!label) { json(res, 400, { ok: false, message: '请填写分类名称' }); return; }
                if (KINDS[key]) { json(res, 400, { ok: false, message: '分类「' + key + '」已存在' }); return; }

                const navIcon = String(body.navIcon || '📄').trim().slice(0, 8) || '📄';
                const navDesc = String(body.navDesc || '').trim() || '「' + label + '」内容';
                const pageName = key.charAt(0).toUpperCase() + key.slice(1).replace(/-([a-z0-9])/g, (m, c) => c.toUpperCase());
                const cfg = {
                    label,
                    dataDir: 'data/' + key,
                    imageSub: key,
                    pageName,
                    navIcon,
                    navDesc
                };

                const err = createCategoryFiles(key, cfg);
                if (err) {
                    // 回滚已建的文件
                    removeCategoryFiles(key, cfg);
                    json(res, 500, { ok: false, message: '创建失败：' + err });
                    return;
                }
                KINDS[key] = cfg;
                saveKinds();
                json(res, 200, { ok: true, message: '已创建分类「' + label + '」并生成页面与导航', kind: cfg });
                return;
            }

            // 删除分类（内置分类与有内容的分类不可删除）
            const kindDel = pathname.match(/^\/api\/kinds\/([a-z0-9-]+)$/);
            if (kindDel && req.method === 'DELETE') {
                const key = kindDel[1];
                const cfg = KINDS[key];
                if (!cfg) { json(res, 404, { ok: false, message: '分类不存在' }); return; }
                if (cfg.builtin) { json(res, 403, { ok: false, message: '内置分类不可删除' }); return; }
                if (listFor(key).length) {
                    json(res, 409, { ok: false, message: '该分类下仍有内容，请先清空（转移或删除）再移除分类' });
                    return;
                }
                const err = removeCategoryFiles(key, cfg);
                if (err) { json(res, 500, { ok: false, message: '删除失败：' + err }); return; }
                delete KINDS[key];
                saveKinds();
                json(res, 200, { ok: true, message: '已移除分类「' + (cfg.label || key) + '」' });
                return;
            }

            // /api/<kind> 与 /api/<kind>/<name> 共用逻辑（kind 来自 kinds.json 配置）
            const m = pathname.match(/^\/api\/([a-z0-9-]+)(?:\/([^/]+))?$/);
            if (m && KINDS[m[1]]) {
                const kind = m[1];
                const name = m[2];

                if (req.method === 'GET' && !name) {
                    json(res, 200, { ok: true, items: listFor(kind) });
                    return;
                }
                if (req.method === 'GET' && name) {
                    const dir = entriesDir(kind);
                    const metaFile = path.join(dir, safeName(name) + '.json');
                    const bodyFile = path.join(dir, 'posts', safeName(name) + '.html');
                    if (!fs.existsSync(metaFile)) {
                        json(res, 404, { ok: false, message: '内容不存在' });
                        return;
                    }
                    const meta = readJson(metaFile);
                    const content = fs.existsSync(bodyFile) ? fs.readFileSync(bodyFile, 'utf-8') : '';
                    json(res, 200, { ok: true, post: meta, content });
                    return;
                }
                if (req.method === 'POST' && !name) {
                    const body = JSON.parse(await readBody(req));
                    saveWithIndex(kind, body, (err, saved) => {
                        if (err) return json(res, 500, { ok: false, message: err.message });
                        json(res, 200, { ok: true, saved: { name: saved.name, id: saved.id }, message: '已保存并更新索引' });
                    });
                    return;
                }
                if (req.method === 'DELETE' && name) {
                    deleteWithIndex(kind, name, (err, result) => {
                        if (err) {
                            if (err.code === 404) return json(res, 404, { ok: false, message: '内容不存在' });
                            return json(res, 500, { ok: false, message: err.message });
                        }
                        json(res, 200, { ok: true, removed: true, message: '已删除并更新索引' });
                    });
                    return;
                }
            }

            json(res, 404, { ok: false, message: '未知接口' });
            return;
        }

        // 其余：作为静态站点预览
        serveStatic(req, res, pathname);
    } catch (e) {
        console.error('处理请求出错:', e);
        if (!res.headersSent) {
            json(res, 500, { ok: false, message: '服务器错误：' + e.message });
        }
    }
});

server.listen(PORT, HOST, () => {
    const siteUrl = `http://${HOST}:${PORT}/index.html`;
    const adminUrl = `http://${HOST}:${PORT}/admin?token=${TOKEN}`;
    console.log('');
    console.log('  🌿 藤栖龟舍 · 本地管理员后台已启动');
    console.log('  ----------------------------------------------');
    console.log('  站点预览 : ' + siteUrl);
    console.log('  管理后台 : ' + adminUrl);
    console.log('  令牌(仅本次启动有效) : ' + TOKEN);
    console.log('  按 Ctrl+C 停止');
    console.log('');
});
