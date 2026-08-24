// JS/special-detail.js
// 博客 / 项目详情页的共享逻辑：slug/id 加载、代码复制、hero 降级、XSS 转义
(function() {
    'use strict';

    function escapeHtml(value) {
        const str = value == null ? '' : String(value);
        return str.replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // 将 ISO 日期格式化为「YYYY年M月D日」，无法解析时原样返回
    function formatDate(value) {
        if (!value) return '';
        const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return String(value);
        return m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
    }

    function getParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    // hero 区：无图时显示 emoji，有图时显示 img + 隐藏的 fallback（图片失败时切换）
    function renderHero(item, heroImgClass) {
        const icon = escapeHtml(item.fallbackIcon || '📄');
        if (!item.hero) {
            return '<div class="fallback-hero">' + icon + '</div>';
        }
        return '<div class="hero-img-wrap">'
            + '<img src="' + escapeHtml(item.hero) + '" alt="' + escapeHtml(item.title) + '" class="' + heroImgClass + '" data-fallback="' + icon + '">'
            + '<div class="fallback-hero">' + icon + '</div>'
            + '</div>';
    }

    function bindImageFallbacks(container) {
        container.querySelectorAll('.hero-img-wrap img[data-fallback]').forEach(function(img) {
            const markFailed = function() {
                const wrap = img.closest('.hero-img-wrap');
                if (wrap) wrap.classList.add('show-fallback');
            };
            img.addEventListener('error', markFailed);
            if (img.complete && img.naturalWidth === 0) markFailed();
        });
    }

    // 为所有 <pre><code> 添加复制按钮
    function setupCopyButtons(container) {
        container.querySelectorAll('.post-body pre, .detail-body pre').forEach(function(pre) {
            if (pre.querySelector('.copy-btn')) return;
            const code = pre.querySelector('code');
            if (!code) return;

            const text = code.textContent;

            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.setAttribute('aria-label', '复制代码');

            const icon = document.createElement('span');
            icon.className = 'copy-icon';
            icon.textContent = '📋';
            const label = document.createTextNode(' 复制');
            btn.appendChild(icon);
            btn.appendChild(label);

            const restore = function() {
                btn.classList.remove('copied');
                icon.textContent = '📋';
                label.nodeValue = ' 复制';
            };
            const flashCopied = function(ok) {
                btn.classList.add('copied');
                icon.textContent = ok ? '✅' : '❌';
                label.nodeValue = ok ? ' 已复制' : ' 复制失败';
                setTimeout(restore, 2000);
            };

            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                (async function() {
                    if (navigator.clipboard && window.ClipboardItem) {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })
                        ]);
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = text;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                    }
                    flashCopied(true);
                })().catch(function() {
                    flashCopied(false);
                });
            });

            pre.style.position = 'relative';
            pre.appendChild(btn);
        });
    }

    // 轻量语法高亮（无依赖）：只对带 language-* 的代码块着色
    var HIGHLIGHT_KEYWORDS = {
        javascript: 'function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|void|delete|default|yield|static|get|set',
        typescript: 'function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|type|enum|namespace|declare|import|export|from|as|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|void|readonly|public|private|protected|abstract|keyof|never|unknown|any|string|number|boolean',
        python: 'def|class|if|elif|else|for|while|return|import|from|as|with|try|except|finally|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|yield|global|nonlocal|raise|assert|del',
        bash: 'if|then|else|elif|fi|for|do|done|while|until|case|esac|function|return|echo|export|local|cd|sudo|shift|exit|source|in|read|set',
        shell: 'if|then|else|elif|fi|for|do|done|while|until|case|esac|function|return|echo|export|local|cd|sudo|shift|exit|source|in|read|set',
        c: 'int|char|float|double|long|short|unsigned|signed|void|struct|union|enum|typedef|return|if|else|for|while|do|switch|case|break|continue|sizeof|static|const|extern|register|goto|NULL|true|false',
        cpp: 'int|char|float|double|long|short|unsigned|signed|void|struct|union|enum|typedef|return|if|else|for|while|do|switch|case|break|continue|sizeof|static|const|extern|class|namespace|template|typename|public|private|protected|virtual|override|new|delete|operator|this|using|try|catch|throw|constexpr|auto|inline|true|false|nullptr',
        java: 'public|private|protected|static|final|class|interface|extends|implements|return|if|else|for|while|do|switch|case|break|continue|new|void|int|long|double|float|boolean|char|byte|short|String|try|catch|finally|throw|throws|this|super|package|import|enum|record|var|assert|null|true|false',
        go: 'package|import|func|return|if|else|for|range|switch|case|break|continue|defer|go|chan|map|struct|interface|type|var|const|select|fallthrough|default|nil|true|false',
        rust: 'fn|let|mut|return|if|else|match|for|while|loop|break|continue|struct|enum|impl|trait|use|mod|pub|crate|super|self|ref|move|async|await|dyn|where|type|const|static|unsafe|in|as|true|false|Some|None|Ok|Err',
        sql: 'select|from|where|insert|into|values|update|set|delete|create|table|drop|alter|add|column|join|left|right|inner|outer|on|group|by|having|order|limit|offset|and|or|not|in|like|is|null|as|asc|desc|distinct|union|all|primary|key|foreign|references|default|constraint|index|unique|case|when|then|else|end|count|sum|avg|min|max',
        json: '',
        css: '',
        yaml: '',
        html: '',
        xml: '',
        text: ''
    };

    var HIGHLIGHT_CACHE = {};

    function makeHighlightRules(lang) {
        if (lang === 'html' || lang === 'xml') {
            return [
                [/&lt;!--[\s\S]*?--&gt;/g, 'comment'],
                [/&lt;\/?[a-zA-Z][\w-]*(?:\s[^&]*?)?&gt;|&lt;\/?[a-zA-Z][\w-]*&gt;|&lt;!DOCTYPE[^&]*&gt;/g, 'tag']
            ];
        }
        if (lang === 'json') {
            return [
                [/"(\\.|[^"\\])*"(?=\s*:)/g, 'string'],
                [/"(?:\\.|[^"\\])*"/g, 'string'],
                [/\b\d+(?:\.\d+)?\b/g, 'number'],
                [/\b(?:true|false|null)\b/g, 'keyword']
            ];
        }
        var rules = [];
        rules.push([/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, 'string']);
        if (lang === 'python' || lang === 'bash' || lang === 'shell' || lang === 'yaml') {
            rules.push([/#[^\n]*/g, 'comment']);
        } else if (lang === 'sql') {
            rules.push([/--[^\n]*/g, 'comment']);
        } else {
            rules.push([/\/\/[^\n]*/g, 'comment']);
        }
        if (lang === 'javascript' || lang === 'typescript' || lang === 'c' || lang === 'cpp' || lang === 'java' || lang === 'go' || lang === 'rust') {
            rules.push([/\/\*[\s\S]*?\*\//g, 'comment']);
        }
        var kw = HIGHLIGHT_KEYWORDS[lang];
        if (kw) rules.push([new RegExp('\\b(?:' + kw + ')\\b', 'g'), 'keyword']);
        rules.push([/\b\d+(?:\.\d+)?\b/g, 'number']);
        rules.push([/\b([a-zA-Z_$][\w$]*)(?=\s*\()/g, 'function']);
        return rules;
    }

    function highlightCode(container) {
        container.querySelectorAll('pre code[class*="language-"]').forEach(function(code) {
            if (code.dataset.highlighted) return;
            code.dataset.highlighted = '1';
            var m = (code.className || '').match(/language-([\w-]+)/);
            var lang = m ? m[1].toLowerCase() : 'text';
            var rules = HIGHLIGHT_CACHE[lang] || (HIGHLIGHT_CACHE[lang] = makeHighlightRules(lang));
            var html = escapeHtml(code.textContent);
            var spans = [];
            rules.forEach(function(rule) {
                html = html.replace(rule[0], function(match) {
                    var idx = spans.length;
                    spans.push('<span class="tok-' + rule[1] + '">' + match + '</span>');
                    return '\u0001' + idx + '\u0001';
                });
            });
            code.innerHTML = html.replace(/\u0001(\d+)\u0001/g, function(_, i) { return spans[+i]; });
            var pre = code.parentElement;
            if (pre && lang !== 'text') pre.setAttribute('data-lang', lang);
        });
    }

    function createDetailPage(config) {
        // config: {
        //   indexUrl, jsonDir, htmlDir,
        //   contentId, notFoundClass,
        //   backLinkId, backHref,
        //   heroImgClass,
        //   render(item, htmlContent, container)
        // }

        function tryLoadFiles(name) {
            return Promise.all([
                fetch(config.jsonDir + '/' + name + '.json'),
                fetch(config.htmlDir + '/' + name + '.html')
            ]).then(function(responses) {
                if (!responses[0].ok || !responses[1].ok) {
                    throw new Error('HTTP ' + responses[0].status);
                }
                return Promise.all(responses.map(r => r.text()));
            });
        }

        function loadById(id, container, slugHint) {
            const attempts = [];
            if (slugHint && slugHint !== String(id)) attempts.push(slugHint);
            attempts.push(id);

            let chain = Promise.reject(new Error('开始尝试'));
            attempts.forEach(name => {
                chain = chain.catch(() => tryLoadFiles(name));
            });

            return chain.then(function(results) {
                const item = JSON.parse(results[0]);
                config.render(item, results[1], container);
                return true;
            });
        }

        function loadBySlug(slug, container) {
            return fetch(config.indexUrl)
                .then(function(res) {
                    if (!res.ok) throw new Error('无法加载索引文件');
                    return res.json();
                })
                .then(function(index) {
                    let entry = index.find(p => p.slug === slug);
                    if (!entry) {
                        const id = parseInt(slug, 10);
                        if (!isNaN(id)) entry = index.find(p => p.id === id);
                    }
                    if (!entry) throw new Error('未找到「' + slug + '」对应的条目');
                    return entry;
                })
                .then(function(entry) {
                    return loadById(entry.id, container, entry.slug);
                });
        }

        function showError(container, message) {
            container.innerHTML = '<div class="' + config.notFoundClass + '">'
                + '<span class="big-icon">🔍</span>'
                + '<p>内容不存在或加载失败</p>'
                + '<p class="not-found-msg">' + escapeHtml(message) + '</p>'
                + '</div>';
        }

        function render() {
            const container = document.getElementById(config.contentId);
            const slugParam = getParam('slug');
            const idParam = getParam('id');

            const missing = '<div class="' + config.notFoundClass + '">'
                + '<span class="big-icon">🔍</span>'
                + '<p>缺少内容标识参数</p>'
                + '<p class="not-found-msg">请使用 ?slug=xxx 或 ?id=xxx 访问</p>'
                + '</div>';

            if (!slugParam && !idParam) {
                container.innerHTML = missing;
                return;
            }

            if (slugParam) {
                loadBySlug(slugParam, container)
                    .catch(function(err) {
                        console.error('通过 slug 加载失败:', err);
                        if (idParam) {
                            loadById(parseInt(idParam, 10), container)
                                .catch(err2 => showError(container, err2.message));
                        } else {
                            showError(container, err.message);
                        }
                    });
            } else if (idParam) {
                const id = parseInt(idParam, 10);
                if (isNaN(id) || id <= 0) {
                    container.innerHTML = '<div class="' + config.notFoundClass + '">'
                        + '<span class="big-icon">🔍</span>'
                        + '<p>无效的ID</p>'
                        + '</div>';
                    return;
                }
                loadById(id, container)
                    .catch(err => {
                        console.error('加载失败:', err);
                        showError(container, err.message);
                    });
            }
        }

        function setupBackLink() {
            const backLink = document.getElementById(config.backLinkId);
            if (!backLink) return;
            const page = getParam('page') || '1';
            const tag = getParam('tag') || '';
            const queryParts = [];
            if (page) queryParts.push('page=' + encodeURIComponent(page));
            if (tag) queryParts.push('tag=' + encodeURIComponent(tag));
            backLink.href = config.backHref + (queryParts.length ? '?' + queryParts.join('&') : '');
        }

        function init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    render();
                    setupBackLink();
                });
            } else {
                render();
                setupBackLink();
            }
        }

        init();
    }

    window.VTS = window.VTS || {};
    window.VTS.escapeHtml = escapeHtml;
    window.VTS.formatDate = formatDate;
    window.VTS.renderHero = renderHero;
    window.VTS.bindImageFallbacks = bindImageFallbacks;
    window.VTS.setupCopyButtons = setupCopyButtons;
    window.VTS.highlightCode = highlightCode;
    window.VTS.createDetailPage = createDetailPage;
})();
