// scripts/translate/audit-mirrors.js —— 构建后镜像语言审计
// 检查 en/ja/zh-TW 镜像的可见文本（剔除 script/style/pre/code/注释与缺译回落正文块）：
//   · en：不得残留任何汉字（代码块中的简体注释属预期，逐字节保留）
//   · ja/zh-TW：不得残留简体特有字形（日文新字体/繁体共享字形已豁免）
// HTML 注释（开发者向）不计入。全绿退出码 0，否则 1。
const fs = require('fs');
const path = require('path');
const OpenCC = require('opencc-js');

const ROOT = path.join(__dirname, '..', '..');
const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });
const JA_ALLOW = new Set([...'残断状内数体点称当会台区学双独旧条静随着声触温浅脚横号干虚黄余参朴画占担淀乱辞属里装与国来万裏滞']);
const TW_ALLOW = new Set(['群', '游', '峰', '秘', '干', '里', '斗', '划', '台']);
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const SKIP_DIRS = ['Resources', 'CSS', 'JS', 'i18n', 'data'];

function stripInvisible(t) {
    return t.replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '')
        .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '');
}

// 缺译回落页豁免（R31）：正文块带 data-content-lang="zh-CN" 时，简中正文属预期回退，
// 整块剔除后只审计页头页脚等 UI 文本。用平衡 div 扫描取整块，避免正则嵌套误截。
function stripFallbackContent(html) {
    const opening = /<div\b[^>]*\bdata-content-lang="zh-CN"[^>]*>/i;
    let m;
    while ((m = opening.exec(html))) {
        const token = /<div\b[^>]*>|<\/div>/gi;
        token.lastIndex = m.index + m[0].length;
        let depth = 1;
        let t;
        while (depth > 0 && (t = token.exec(html))) {
            depth += t[0][1] === '/' ? -1 : 1;
        }
        const end = t ? t.index + t[0].length : html.length;
        html = html.slice(0, m.index) + html.slice(end);
    }
    return html;
}

function main() {
    let totalBad = 0;
    for (const lang of ['en', 'ja', 'zh-TW']) {
        const allow = lang === 'ja' ? JA_ALLOW : (lang === 'zh-TW' ? TW_ALLOW : null);
        const issues = [];
        (function walk(dir) {
            for (const name of fs.readdirSync(dir)) {
                const p = path.join(dir, name);
                if (fs.statSync(p).isDirectory()) {
                    if (!SKIP_DIRS.includes(name)) walk(p);
                    continue;
                }
                if (!name.endsWith('.html')) continue;
                const prose = stripInvisible(stripFallbackContent(fs.readFileSync(p, 'utf-8')));
                const bad = new Set();
                if (lang === 'en') {
                    for (const ch of prose) if (CJK.test(ch)) bad.add(ch);
                } else {
                    for (const ch of prose) if (CJK.test(ch) && !allow.has(ch) && conv(ch) !== ch) bad.add(ch);
                }
                if (bad.size) issues.push(path.relative(ROOT, p) + ' → ' + [...bad].join(''));
            }
        })(path.join(ROOT, lang));
        console.log('== ' + lang + ': ' + (issues.length ? issues.length + ' 个文件残留' : '✅ 干净'));
        issues.forEach(s => console.log('   ' + s));
        totalBad += issues.length;
    }
    console.log(totalBad === 0 ? '🎉 三语镜像可见文本全部干净' : '⚠️ 共 ' + totalBad + ' 个文件需处理');
    if (totalBad > 0) process.exitCode = 1;
}

main();
