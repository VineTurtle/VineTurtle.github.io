// scripts/translate/verify.js —— 覆盖文件结构/语言校验
// 用法：node scripts/translate/verify.js [zh-TW|en|ja ...]（缺省校验全部）
// 校验不变量（对应 I18N_PLAN.md R12/R13/R27 的正文延伸）：
//   · 覆盖与源正文块级序列同构（页首 h1 丢弃除外）
//   · <pre> 代码块、行内 <code>、<img> 标签逐字节一致；链接 href 一致
//   · en：不得残留任何汉字；zh-TW/ja：不得残留简体特有字形
//   · 元数据覆盖：title/excerpt 非空，项目需提供 desc/status
const OpenCC = require('opencc-js');
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const LANGS = ['zh-TW', 'en', 'ja'];
// 与生成端一致的 twp 单字映射；共享字形豁免表：繁体/日文本身合法使用、
// OpenCC 单字映射却会改写的字（群/游/峰/秘/干/里），逐个人工核对过上下文
const convS2T = OpenCC.Converter({ from: 'cn', to: 'twp' });
const SIMPLIFIED_ALLOW = new Set(['群', '游', '峰', '秘', '干', '里', '斗', '划', '台']);
// 日文新字体与简体同形的合法汉字（残る/数字/体/点/画/辞書/占める…），
// 单字映射会把它们误标为"简体"，ja 校验需豁免；其余简体特有字（这/们/说…）仍然拦截
const JA_ALLOW = new Set([...'残断状内数体点称当会台区学双独旧条静随着声触温浅脚横号干虚黄余参朴画占担淀乱辞属里', ...'装与国来万裏滞']);

// 摘掉行内代码后做语言字符检查（代码内容逐字节校验，且可能含真实文件名的简体字）
function proseOnly(html) {
    return html.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '');
}

function verifyBody(lang, body, srcBlocks, dstHtml) {
    const issues = [];
    const dstBlocks = lib.splitBlocks(dstHtml);
    if (!lib.blockTypesAligned(srcBlocks, dstBlocks)) {
        issues.push('块级序列不同构：源 [' + srcBlocks.filter(b => b.action !== 'drop').map(b => b.type).join(',')
            + '] 覆盖 [' + dstBlocks.map(b => b.type).join(',') + ']');
        return issues;
    }
    const srcKeep = srcBlocks.filter(b => b.action !== 'drop');
    for (let i = 0; i < srcKeep.length; i++) {
        const s = srcKeep[i];
        const d = dstBlocks[i];
        if (s.action === 'keep') {
            if (s.html !== d.html) issues.push('第' + (i + 1) + '块(' + s.type + ')代码块被改动');
            continue;
        }
        if (lib.inlineTagNames(s.html).join('|') !== lib.inlineTagNames(d.html).join('|')) {
            issues.push('第' + (i + 1) + '块(' + s.type + ')行内标签结构不一致');
        }
        if (lib.codeSpans(s.html).join('\u0000') !== lib.codeSpans(d.html).join('\u0000')) {
            issues.push('第' + (i + 1) + '块(' + s.type + ')行内代码被改动');
        }
        if (lib.hrefs(s.html).join('|') !== lib.hrefs(d.html).join('|')) {
            issues.push('第' + (i + 1) + '块(' + s.type + ')链接 href 被改动');
        }
        if (lib.imgSrcs(s.html).join('|') !== lib.imgSrcs(d.html).join('|')) {
            issues.push('第' + (i + 1) + '块(' + s.type + ')img src 被改动');
        }
        if (lang === 'en' && lib.CJK_RE.test(proseOnly(d.html))) {
            issues.push('第' + (i + 1) + '块(' + s.type + ')残留汉字');
        }
        if (lang === 'zh-TW') {
            const bad = lib.findSimplifiedChars(proseOnly(d.html), convS2T, SIMPLIFIED_ALLOW);
            if (bad.length) issues.push('第' + (i + 1) + '块(' + s.type + ')残留简体字形：' + bad.join(''));
        }
        if (lang === 'ja') {
            const bad = lib.findSimplifiedChars(proseOnly(d.html), convS2T, JA_ALLOW);
            if (bad.length) issues.push('第' + (i + 1) + '块(' + s.type + ')残留简体字形：' + bad.join(''));
        }
    }
    return issues;
}

function verifyMeta(lang, body, srcMeta) {
    const issues = [];
    const file = path.join(lib.ROOT, 'data', 'i18n', lang, body.kind, body.slug + '.json');
    if (!fs.existsSync(file)) {
        issues.push('缺元数据覆盖 ' + path.relative(lib.ROOT, file));
        return issues;
    }
    let meta;
    try {
        meta = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
        issues.push('元数据 JSON 解析失败：' + e.message);
        return issues;
    }
    for (const key of ['title', 'excerpt']) {
        if (!meta[key] || !String(meta[key]).trim()) issues.push('元数据缺 ' + key);
    }
    const texts = [meta.title, meta.excerpt].concat(meta.tags || []);
    const joined = texts.filter(Boolean).join(' ');
    if (lang === 'en' && lib.CJK_RE.test(joined)) issues.push('元数据残留汉字');
    if (lang === 'zh-TW' || lang === 'ja') {
        const allow = lang === 'zh-TW' ? SIMPLIFIED_ALLOW : JA_ALLOW;
        const bad = lib.findSimplifiedChars(joined, convS2T, allow);
        if (bad.length) issues.push('元数据残留简体字形：' + bad.join(''));
    }
    if (body.kind === 'project' && srcMeta) {
        for (const key of ['desc', 'status']) {
            if (srcMeta[key] && (!meta[key] || !String(meta[key]).trim())) {
                issues.push('项目元数据缺 ' + key + '（源有 ' + srcMeta[key] + '）');
            }
        }
    }
    return issues;
}

function main() {
    const langs = process.argv.slice(2).filter(a => !a.startsWith('-'));
    const targets = langs.length ? langs : LANGS;
    let fail = 0, pass = 0, missing = 0;

    for (const lang of targets) {
        for (const body of lib.listBodies()) {
            const srcHtml = fs.readFileSync(body.srcPath, 'utf-8');
            const srcBlocks = lib.splitBlocks(srcHtml);
            const metaPath = path.join(lib.ROOT, 'data', body.kind, body.slug + '.json');
            const srcMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : null;

            const dstFile = path.join(lib.ROOT, 'data', 'i18n', lang, body.kind, body.slug + '.html');
            let issues;
            if (!fs.existsSync(dstFile)) {
                issues = ['缺正文覆盖'];
                missing++;
            } else {
                issues = verifyBody(lang, body, srcBlocks, fs.readFileSync(dstFile, 'utf-8'));
            }
            issues = issues.concat(verifyMeta(lang, body, srcMeta));

            const rel = path.relative(lib.ROOT, dstFile);
            if (issues.length) {
                fail++;
                console.log('❌ [' + lang + '] ' + rel);
                issues.forEach(s => console.log('   · ' + s));
            } else {
                pass++;
                console.log('✅ [' + lang + '] ' + rel);
            }
        }
    }
    console.log('--- 通过 ' + pass + ' / 失败 ' + fail + ' / 缺文件 ' + missing + ' ---');
    if (fail > 0) process.exitCode = 1;
}

main();
