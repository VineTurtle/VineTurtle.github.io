// scripts/translate/status.js —— 正文翻译覆盖矩阵（信息性报告）
// 列出每篇内容在各语言的正文/元数据覆盖情况，供查缺口；不设退出码。
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const LANGS = ['zh-TW', 'en', 'ja'];

function main() {
    const rows = lib.listBodies().map(body => {
        const cells = LANGS.map(lang => {
            const dir = path.join(lib.ROOT, 'data', 'i18n', lang, body.kind);
            const bodyOk = fs.existsSync(path.join(dir, body.slug + '.html'));
            const metaOk = fs.existsSync(path.join(dir, body.slug + '.json'));
            return (bodyOk ? '正文✅' : '正文—') + (metaOk ? ' 元✅' : ' 元—');
        });
        return { key: body.relKey, cells: cells };
    });
    const header = '内容'.padEnd(44, ' ') + '  ' + LANGS.map(l => l.padEnd(14, ' ')).join('  ');
    console.log(header);
    console.log('-'.repeat(header.length));
    for (const row of rows) {
        console.log(row.key.padEnd(44, ' ') + '  ' + row.cells.map(c => c.padEnd(14, ' ')).join('  '));
    }
    for (const lang of LANGS) {
        const done = lib.listBodies().filter(b => fs.existsSync(path.join(lib.ROOT, 'data', 'i18n', lang, b.kind, b.slug + '.html'))).length;
        console.log(lang + ' 正文覆盖：' + done + '/' + lib.listBodies().length);
    }
}

main();
