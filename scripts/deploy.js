// scripts/deploy.js
// 一键发布网站：把本地项目上传到服务器（rsync）或推送到 Git 仓库。
//
// 两种方式：
//   1) rsync 上传到自己的服务器：
//      在 scripts/deploy.config.json 中配置目标，例如：
//        { "method": "rsync", "target": "user@你的服务器:/var/www/vineturtle" }
//      然后执行：npm run deploy
//   2) Git 仓库托管（如 GitHub Pages / Netlify）：
//      项目已 `git init` 并配置远程仓库后，直接执行：npm run deploy
//      脚本会自动 git add / commit / push，托管平台检测到推送后自动更新。
//
// 其他配置项（deploy.config.json，可选）：
//   { "excludes": ["data/downloads/"] }   # rsync 额外排除的路径
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'deploy.config.json');

function run(cmd, args) {
    const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    return r.status === 0;
}

function readConfig() {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch (e) { return null; }
}

const DEFAULT_EXCLUDES = [
    '.git/',
    'node_modules/',
    'admin/',
    'scripts/deploy.config.json',
    'data/downloads/',
];

function deployRsync(config) {
    const target = config.target;
    if (!target) {
        console.error('❌ 未配置 deploy.config.json 的 target，无法使用 rsync 方式。');
        return false;
    }
    const args = ['-avz', '--delete'];
    const excludes = DEFAULT_EXCLUDES.concat(config.excludes || []);
    excludes.forEach(x => args.push('--exclude', x));
    args.push('./', target);
    console.log('🚀 正在通过 rsync 上传到 ' + target + ' ...');
    return run('rsync', args);
}

function deployGit() {
    if (!fs.existsSync(path.join(ROOT, '.git'))) {
        console.error('❌ 当前目录不是 Git 仓库，且没有配置 rsync 目标。');
        console.error('   请先执行 git init 并关联远程仓库，或参考 deploy.config.json 配置 rsync。');
        return false;
    }
    console.log('🚀 正在提交并推送 Git 仓库 ...');
    if (!run('git', ['add', '-A'])) return false;
    if (!run('git', ['commit', '-m', '更新网站内容'])) {
        console.log('ℹ️  没有需要提交的变更（或提交失败）。');
    }
    if (!run('git', ['push'])) return false;
    console.log('✅ 已推送到远程仓库，托管平台检测到更新后会自动发布。');
    return true;
}

function main() {
    const config = readConfig();
    let ok = false;
    if (config && config.method === 'rsync') {
        ok = deployRsync(config);
    } else if (config && config.method === 'git') {
        ok = deployGit();
    } else if (config && config.target) {
        ok = deployRsync(config);
    } else {
        ok = deployGit();
    }
    process.exit(ok ? 0 : 1);
}

main();
