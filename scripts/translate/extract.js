// scripts/translate/extract.js —— 产出正文分段参考（供人工翻译阅读）
// 输出 data/i18n-work/<分类>/<slug>.segments.json：每段标注 keep/drop/translate，
// translate 段附纯文本预览。此目录是工作参考，不参与站点构建（已加入 .gitignore）。
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const OUT_DIR = path.join(lib.ROOT, 'data', 'i18n-work');

function textPreview(html) {
    return html
        .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '⟦code⟧')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    let translateChars = 0;
    for (const body of lib.listBodies()) {
        const html = fs.readFileSync(body.srcPath, 'utf-8');
        const blocks = lib.splitBlocks(html);
        const segments = blocks.map((b, i) => ({
            i: i,
            type: b.type,
            action: b.action,
            chars: b.action === 'translate' ? textPreview(b.html).replace(/[^\u3400-\u4dbf\u4e00-\u9fff]/g, '').length : 0,
            preview: b.action === 'translate' ? textPreview(b.html) : (b.action === 'keep' ? '（代码块，逐字节保留）' : '（页首标题，丢弃）')
        }));
        translateChars += segments.reduce((s, seg) => s + seg.chars, 0);
        const out = path.join(OUT_DIR, body.kind, body.slug + '.segments.json');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify({ source: body.relKey, segments: segments }, null, 2), 'utf-8');
    }
    console.log('✅ 分段参考已写入 ' + path.relative(lib.ROOT, OUT_DIR) + '/（可翻译汉字合计 ' + translateChars + '）');
}

main();
