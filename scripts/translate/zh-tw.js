// scripts/translate/zh-tw.js —— 简中正文 → 繁中覆盖文件（OpenCC twp 词汇级转换）
// 规则与回退逻辑一致：<pre> 逐字节保留、行内 <code> 不转、页首 <h1> 丢弃；
// 仅转换标记之间的文本节点。转换后仍需人工校对术语（R27），再跑 verify.js。
const OpenCC = require('opencc-js');
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });

// 只转换文本节点：先摘出 <code> 段，再摘出标签，其余文本转换
function convertHtmlText(html) {
    const parts = [];
    const re = /(<code\b[^>]*>[\s\S]*?<\/code>)|(<[^>]+>)/gi;
    let last = 0, m;
    while ((m = re.exec(html)) !== null) {
        if (m.index > last) parts.push(['text', html.slice(last, m.index)]);
        parts.push(m[1] ? ['raw', m[1]] : ['raw', m[2]]);
        last = re.lastIndex;
    }
    if (last < html.length) parts.push(['text', html.slice(last)]);
    return parts.map(([kind, s]) => kind === 'text' ? conv(s) : s).join('');
}

function main() {
    let count = 0;
    for (const body of lib.listBodies()) {
        const html = fs.readFileSync(body.srcPath, 'utf-8');
        const blocks = lib.splitBlocks(html).filter(b => b.action !== 'drop');
        const out = blocks.map(b => b.action === 'keep' ? b.html : convertHtmlText(b.html)).join('\n\n') + '\n';
        const dstFile = path.join(lib.ROOT, 'data', 'i18n', 'zh-TW', body.kind, body.slug + '.html');
        fs.mkdirSync(path.dirname(dstFile), { recursive: true });
        fs.writeFileSync(dstFile, out, 'utf-8');
        count++;
    }
    console.log('✅ zh-TW 正文覆盖生成 ' + count + ' 篇（OpenCC cn→twp，代码块未动；请人工校对术语后运行 verify）');
}

main();
