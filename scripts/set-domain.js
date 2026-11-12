// scripts/set-domain.js
// 统一修改站点域名：site.config.json、CNAME、robots.txt、各 HTML 的 canonical/OG/JSON-LD。
// 用法：
//   node scripts/set-domain.js https://new.example.com
//   node scripts/set-domain.js            # 使用 site.config.json 里的 siteUrl 同步旧文件
const fs = require('fs');
const path = require('path');
const { ROOT, CONFIG_FILE, loadSiteConfig } = require('./site-config');

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'admin') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
}

function main() {
    const arg = process.argv[2];
    let config = loadSiteConfig();
    if (arg) {
        const siteUrl = String(arg).replace(/\/+$/, '');
        let host;
        try { host = new URL(siteUrl).host; } catch (e) {
            console.error('❌ 域名格式不正确：' + arg);
            process.exit(1);
        }
        config = { ...config, siteUrl, host };
        const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        raw.siteUrl = siteUrl;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(raw, null, 2) + '\n');
        console.log('✅ 已更新 site.config.json → ' + siteUrl);
    }

    const oldHosts = new Set(['grapeleafi.top', 'www.grapeleafi.top']);
    const files = [];
    walk(ROOT, files);

    let changed = 0;
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.html', '.txt'].includes(ext)) continue;
        if (file.endsWith('sitemap.xml') || file.endsWith('feed.xml')) continue;
        let text = fs.readFileSync(file, 'utf-8');
        let next = text;
        for (const oldHost of oldHosts) {
            next = next.split('https://' + oldHost).join(config.siteUrl);
            next = next.split('http://' + oldHost).join(config.siteUrl);
            next = next.split(oldHost).join(config.host);
        }
        if (next !== text) {
            fs.writeFileSync(file, next);
            changed++;
            console.log('  · ' + path.relative(ROOT, file));
        }
    }

    // CNAME 只写主机名
    fs.writeFileSync(path.join(ROOT, 'CNAME'), config.host + '\n');
    console.log('✅ CNAME → ' + config.host);
    console.log(`✅ 完成，共更新 ${changed} 个文件。请再运行 npm run build 重新生成 sitemap/feed。`);
}

main();
