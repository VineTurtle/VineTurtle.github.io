// scripts/site-config.js —— 读取站点配置，供构建脚本共用
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'site.config.json');

const DEFAULTS = {
    siteUrl: 'https://grapeleafi.top',
    siteName: '藤栖龟舍 VineTurtle Studio',
    shortName: '藤栖龟舍',
    defaultOgImage: '/Resources/images/og-cover.png',
    rssPath: '/feed.xml',
    searchPath: '/SpecialPages/Search/index.html'
};

function loadSiteConfig() {
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
        console.warn('⚠️ 读取 site.config.json 失败，使用默认配置：' + e.message);
    }
    const merged = { ...DEFAULTS, ...config };
    merged.siteUrl = String(merged.siteUrl || DEFAULTS.siteUrl).replace(/\/+$/, '');
    try {
        merged.host = new URL(merged.siteUrl).host;
    } catch (e) {
        merged.host = 'grapeleafi.top';
    }
    return merged;
}

function absoluteUrl(config, value) {
    if (!value) return config.siteUrl + config.defaultOgImage;
    const str = String(value);
    if (/^https?:\/\//i.test(str)) return str;
    return config.siteUrl + '/' + str.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
}

module.exports = { ROOT, CONFIG_FILE, loadSiteConfig, absoluteUrl };
