// admin/editor.js —— 可视化文章编辑器（Markdown + 工具栏 + 实时预览 + 图片上传）
// 通过 window.VTSEditor.mount(container, opts) 挂载。
// 正文始终以 HTML 存储（与前端详情页一致）；编辑时用 Markdown，保存时自动转 HTML。
(function () {
    'use strict';

    // ---------- 基础工具 ----------
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // ---------- Markdown → HTML ----------
    // 先整体做 HTML 转义（杜绝注入），再对已转义文本套用 Markdown 语法
    function inlineMd(s) {
        s = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (m, alt, url) {
            return '<img src="' + url.trim() + '" alt="' + alt + '" loading="lazy">';
        });
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, txt, url) {
            var u = url.trim();
            var ext = /^https?:\/\//i.test(u) ? ' target="_blank" rel="noopener"' : '';
            return '<a href="' + u + '"' + ext + '>' + txt + '</a>';
        });
        s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(?<![\w*])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
        return s;
    }

    function codeBlock(lang, content) {
        var cls = lang ? ' class="language-' + esc(lang.trim()) + '"' : '';
        return '<pre><code' + cls + '>' + esc(content) + '</code></pre>';
    }

    function tableAt(lines, i) {
        var hdr = lines[i].match(/^\s*\|(.+)\|\s*$/);
        if (!hdr || !lines[i + 1]) return null;
        if (!/^\s*\|[\s:| -]+\|\s*$/.test(lines[i + 1])) return null;
        function splitRow(line) {
            return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
        }
        var rows = [splitRow(hdr[1])];
        var j = i + 2;
        while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j]) && lines[j].trim() !== '') {
            rows.push(splitRow(lines[j]));
            j++;
        }
        var html = '<table><thead><tr>'
            + rows[0].map(function (c) { return '<th>' + inlineMd(c) + '</th>'; }).join('')
            + '</tr></thead><tbody>';
        for (var r = 1; r < rows.length; r++) {
            html += '<tr>' + rows[r].map(function (c) { return '<td>' + inlineMd(c) + '</td>'; }).join('') + '</tr>';
        }
        return { html: html + '</tbody></table>', next: j };
    }

    function mdToHtml(md) {
        var text = String(md == null ? '' : md).replace(/\r\n?/g, '\n');
        var lines = text.split('\n');
        var out = [];
        var para = [];
        var i = 0, n = lines.length;

        function flushPara() {
            if (para.length) {
                out.push('<p>' + inlineMd(para.join('\u0002')).replace(/\u0002/g, '<br>') + '</p>');
                para = [];
            }
        }

        while (i < n) {
            var line = lines[i];

            var fm = line.match(/^\s*(```+|~~~+)\s*([\w+#.-]*)\s*$/);
            if (fm) {
                flushPara();
                var lang = fm[2];
                var code = [];
                i++;
                while (i < n && !/^\s*(```+|~~~+)\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
                i++;
                out.push(codeBlock(lang, code.join('\n')));
                continue;
            }

            var hm = line.match(/^(#{1,6})\s+(.*)$/);
            if (hm) {
                flushPara();
                out.push('<h' + hm[1].length + '>' + inlineMd(hm[2]) + '</h' + hm[1].length + '>');
                i++;
                continue;
            }

            if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
                flushPara();
                out.push('<hr>');
                i++;
                continue;
            }

            if (/^\s*>\s?/.test(line)) {
                flushPara();
                var quote = [];
                while (i < n && /^\s*>\s?/.test(lines[i])) {
                    quote.push(lines[i].replace(/^\s*>\s?/, ''));
                    i++;
                }
                out.push('<blockquote><p>' + inlineMd(quote.join('\u0002')).replace(/\u0002/g, '<br>') + '</p></blockquote>');
                continue;
            }

            var lm = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
            if (lm) {
                flushPara();
                var items = [];
                while (i < n) {
                    var m2 = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
                    if (!m2) break;
                    items.push(m2);
                    i++;
                }
                var ordered = /^\d/.test(items[0][1]);
                var tag = ordered ? 'ol' : 'ul';
                var html = '<' + tag + '>';
                for (var k = 0; k < items.length; k++) {
                    var t = items[k][2];
                    var task = t.match(/^\[([ xX])\]\s+(.*)$/);
                    if (task) {
                        var checked = /[xX]/.test(task[1]) ? ' checked' : '';
                        html += '<li class="task-item"><input type="checkbox" disabled' + checked + '> ' + inlineMd(task[2]) + '</li>';
                    } else {
                        html += '<li>' + inlineMd(t) + '</li>';
                    }
                }
                out.push(html + '</' + tag + '>');
                continue;
            }

            var tbl = tableAt(lines, i);
            if (tbl) {
                flushPara();
                out.push(tbl.html);
                i = tbl.next;
                continue;
            }

            if (line.trim() === '') { flushPara(); i++; continue; }
            para.push(line);
            i++;
        }
        flushPara();
        return out.join('\n');
    }

    // ---------- HTML → Markdown（加载旧正文用，浏览器 DOM） ----------
    function htmlToMarkdown(html) {
        var wrap = document.createElement('div');
        wrap.innerHTML = String(html || '');

        function listToMd(listEl, ordered) {
            var lis = Array.prototype.filter.call(listEl.children, function (el) {
                return el.nodeName.toLowerCase() === 'li';
            });
            var lines = [];
            for (var i = 0; i < lis.length; i++) {
                var li = lis[i];
                var cb = li.querySelector('input[type=checkbox]');
                var marker;
                if (cb) {
                    marker = '- [' + (cb.checked ? 'x' : ' ') + ']';
                    var clone = li.cloneNode(true);
                    var box = clone.querySelector('input[type=checkbox]');
                    if (box) box.parentNode.removeChild(box);
                    lines.push(marker + ' ' + walk(clone).replace(/^\s+|\s+$/g, ''));
                } else {
                    marker = ordered ? (i + 1) + '.' : '-';
                    lines.push(marker + ' ' + walk(li).replace(/^\s+|\s+$/g, ''));
                }
            }
            return '\n' + lines.join('\n') + '\n';
        }

        function tableToMd(table) {
            var rows = table.querySelectorAll('tr');
            var out = [];
            Array.prototype.forEach.call(rows, function (tr) {
                var cells = Array.prototype.map.call(tr.children, function (td) {
                    return td.textContent.trim().replace(/\|/g, '\\|');
                });
                out.push('| ' + cells.join(' | ') + ' |');
            });
            if (rows.length) {
                var hdr = Array.prototype.map.call(rows[0].children, function () { return '---'; });
                out.splice(1, 0, '| ' + hdr.join(' | ') + ' |');
            }
            return out.join('\n');
        }

        function walk(parent) {
            var buf = [];
            var children = Array.prototype.slice.call(parent.childNodes);
            var blockSeen = false;
            for (var ci = 0; ci < children.length; ci++) {
                var node = children[ci];
                if (node.nodeType === 3) {
                    var t = node.nodeValue;
                    buf.push(t);
                    continue;
                }
                if (node.nodeType !== 1) continue;
                var tag = node.nodeName.toLowerCase();
                var inner = walk(node);
                switch (tag) {
                    case 'p': buf.push('\n\n' + inner + '\n\n'); blockSeen = true; break;
                    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
                        buf.push('\n\n' + new Array(Number(tag[1]) + 1).join('#') + ' ' + inner + '\n\n');
                        blockSeen = true;
                        break;
                    case 'br': buf.push('\n'); break;
                    case 'hr': buf.push('\n\n---\n\n'); blockSeen = true; break;
                    case 'strong': case 'b': buf.push('**' + inner + '**'); break;
                    case 'em': case 'i': buf.push('*' + inner + '*'); break;
                    case 'del': case 's': case 'strike': buf.push('~~' + inner + '~~'); break;
                    case 'code':
                        buf.push(node.parentNode && node.parentNode.nodeName.toLowerCase() === 'pre'
                            ? inner
                            : '`' + inner + '`');
                        break;
                    case 'pre': {
                        var codeNode = node.querySelector('code');
                        var codeText = codeNode ? codeNode.textContent : node.textContent;
                        var m = codeNode && codeNode.className.match(/language-([\w-]+)/);
                        buf.push('\n\n```' + (m ? m[1] : '') + '\n' + codeText + '\n```\n\n');
                        blockSeen = true;
                        break;
                    }
                    case 'a': {
                        var href = node.getAttribute('href') || '';
                        buf.push('[' + inner + '](' + href + ')');
                        break;
                    }
                    case 'img': {
                        buf.push('![' + (node.getAttribute('alt') || '') + '](' + (node.getAttribute('src') || '') + ')');
                        break;
                    }
                    case 'ul': buf.push(listToMd(node, false)); blockSeen = true; break;
                    case 'ol': buf.push(listToMd(node, true)); blockSeen = true; break;
                    case 'blockquote': {
                        var q = inner.replace(/^\s+|\s+$/g, '').split('\n').map(function (l) { return '> ' + l; }).join('\n');
                        buf.push('\n\n' + q + '\n\n');
                        blockSeen = true;
                        break;
                    }
                    case 'table': buf.push('\n\n' + tableToMd(node) + '\n\n'); blockSeen = true; break;
                    default: buf.push(inner);
                }
            }
            return buf.join('');
        }

        var md = walk(wrap);
        return md.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\s+$/, '');
    }

    // ---------- 图片上传（暴露给外部复用） ----------
    function uploadImage(file, opts) {
        opts = opts || {};
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                fetch(opts.uploadUrl || '/api/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (opts.getToken ? opts.getToken() : '')
                    },
                    body: JSON.stringify({ name: file.name, data: reader.result, kind: opts.kind })
                }).then(function (res) {
                    return res.json().then(function (d) { return res.ok ? d : Promise.reject(new Error(d.message || '上传失败')); });
                }).then(function (d) { resolve(d.url); }).catch(reject);
            };
            reader.onerror = function () { reject(new Error('读取文件失败')); };
            reader.readAsDataURL(file);
        });
    }

    // ---------- 编辑器控件 ----------
    function mount(container, opts) {
        opts = opts || {};

        var root = document.createElement('div');
        root.className = 'vts-editor';
        container.appendChild(root);

        // 工具栏
        var toolbar = document.createElement('div');
        toolbar.className = 'md-toolbar';
        root.appendChild(toolbar);

        function addBtn(cfg) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'md-btn';
            b.title = cfg.title || '';
            b.innerHTML = cfg.html;
            b.addEventListener('click', function () { exec(cfg.cmd, cfg.arg); });
            toolbar.appendChild(b);
        }

        var viewBtn = null;
        function addViewBtn() {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'md-btn';
            b.title = '切换视图';
            b.textContent = '分栏';
            viewBtn = b;
            b.addEventListener('click', function () { cycleView(); });
            toolbar.appendChild(b);
        }

        var modeBtn = null;
        function addModeBtn() {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'md-btn md-btn-mode';
            b.title = '切换 Markdown / HTML 源码';
            b.innerHTML = '</>';
            modeBtn = b;
            b.addEventListener('click', function () { toggleMode(); });
            toolbar.appendChild(b);
        }

        var groups = [
            [
                { title: '标题 1', html: 'H1', cmd: 'h', arg: 1 },
                { title: '标题 2', html: 'H2', cmd: 'h', arg: 2 },
                { title: '标题 3', html: 'H3', cmd: 'h', arg: 3 },
                { title: '标题 4', html: 'H4', cmd: 'h', arg: 4 }
            ],
            [
                { title: '加粗', html: '<b>B</b>', cmd: 'bold' },
                { title: '斜体', html: '<i>I</i>', cmd: 'italic' },
                { title: '删除线', html: '<s>S</s>', cmd: 'strike' },
                { title: '行内代码', html: '<code>&lt;/&gt;</code>', cmd: 'code' }
            ],
            [
                { title: '代码块（可选语言）', html: '代码块', cmd: 'codeblock' },
                { title: '链接', html: '🔗', cmd: 'link' },
                { title: '图片', html: '🖼️', cmd: 'image' },
                { title: '表格', html: '⊞', cmd: 'table' }
            ],
            [
                { title: '无序列表', html: '• 列表', cmd: 'ul' },
                { title: '有序列表', html: '1. 列表', cmd: 'ol' },
                { title: '任务列表', html: '☑', cmd: 'task' },
                { title: '引用', html: '❝', cmd: 'quote' },
                { title: '分割线', html: '—', cmd: 'hr' }
            ]
        ];

        groups.forEach(function (grp, gi) {
            if (gi > 0) { var sep = document.createElement('span'); sep.className = 'md-sep'; toolbar.appendChild(sep); }
            grp.forEach(function (c) { addBtn(c); });
        });
        var sep = document.createElement('span'); sep.className = 'md-sep'; toolbar.appendChild(sep);
        addViewBtn();
        addModeBtn();

        // 编辑区（Markdown 输入 + 预览）
        var row = document.createElement('div');
        row.className = 'md-row';
        var ta = document.createElement('textarea');
        ta.className = 'md-input';
        ta.placeholder = '# 文章标题\n\n在这里开始写文章…\n\n支持 Markdown：**加粗**、`代码`、``` 代码块、![图片](链接) 等，也可用上方工具栏。';
        ta.spellcheck = false;
        var preview = document.createElement('div');
        preview.className = 'md-preview';
        row.appendChild(ta);
        row.appendChild(preview);
        root.appendChild(row);

        // 源码模式（HTML）
        var srcTa = document.createElement('textarea');
        srcTa.className = 'md-source';
        srcTa.placeholder = 'HTML 源码';
        srcTa.spellcheck = false;
        root.appendChild(srcTa);

        var mode = 'md';       // md | html
        var viewMode = 'split'; // split | edit | preview

        function renderPreview() {
            preview.innerHTML = mdToHtml(ta.value);
        }

        var debounce = null;
        function notifyChange() {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                if (mode === 'md') renderPreview();
                if (opts.onChange) opts.onChange();
            }, 200);
        }
        ta.addEventListener('input', notifyChange);
        srcTa.addEventListener('input', function () {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                if (opts.onChange) opts.onChange();
            }, 200);
        });

        function currentTa() { return mode === 'md' ? ta : srcTa; }

        // ---------- 光标操作 ----------
        function wrap(before, after, placeholder) {
            var t = ta;
            var s = t.selectionStart, e = t.selectionEnd;
            var sel = t.value.slice(s, e);
            if (!sel) sel = placeholder || '';
            t.setRangeText(before + sel + after, s, e, 'end');
            t.dispatchEvent(new Event('input'));
            t.focus();
        }

        function linePrefix(prefix) {
            var t = ta;
            var s = t.selectionStart, e = t.selectionEnd;
            var text = t.value;
            var ls = text.lastIndexOf('\n', s - 1) + 1;
            var le = text.indexOf('\n', e);
            if (le === -1) le = text.length;
            var block = text.slice(ls, le);
            var lines = block.split('\n');
            var out = lines.map(function (l) {
                if (prefix === '# ' || prefix === '## ' || prefix === '### ' || prefix === '#### ') {
                    l = l.replace(/^#{1,6}\s*/, '');
                }
                return prefix + l;
            }).join('\n');
            t.setRangeText(out, ls, le, 'end');
            t.dispatchEvent(new Event('input'));
            t.focus();
        }

        function insertBlock(text) {
            var t = ta;
            var s = t.selectionStart;
            var value = t.value;
            var before = value.slice(0, s);
            // 保证前面有空白行隔开，后面补换行
            var padBefore = '';
            if (before.length) {
                if (before.slice(-2) === '\n\n') padBefore = '';
                else if (before.slice(-1) === '\n') padBefore = '\n';
                else padBefore = '\n\n';
            }
            t.value = before + padBefore + text + (text.slice(-1) === '\n' ? '' : '\n') + value.slice(s);
            t.selectionStart = t.selectionEnd = s + padBefore.length + text.length;
            t.dispatchEvent(new Event('input'));
            t.focus();
        }

        function insertAtCursor(text) {
            var t = ta;
            var s = t.selectionStart, e = t.selectionEnd;
            t.setRangeText(text, s, e, 'end');
            t.dispatchEvent(new Event('input'));
            t.focus();
        }

        // ---------- 视图 / 模式 ----------
        function cycleView() {
            if (viewMode === 'split') viewMode = 'edit';
            else if (viewMode === 'edit') viewMode = 'preview';
            else viewMode = 'split';
            root.classList.remove('is-edit', 'is-preview');
            if (viewMode === 'edit') root.classList.add('is-edit');
            if (viewMode === 'preview') root.classList.add('is-preview');
            viewBtn.textContent = viewMode === 'split' ? '分栏' : viewMode === 'edit' ? '编辑' : '预览';
        }

        function toggleMode() {
            if (mode === 'md') {
                srcTa.value = mdToHtml(ta.value);
                mode = 'html';
                root.classList.add('is-source');
                modeBtn.innerHTML = 'MD';
                modeBtn.title = '切换回 Markdown 编辑';
            } else {
                ta.value = htmlToMarkdown(srcTa.value);
                mode = 'md';
                root.classList.remove('is-source');
                modeBtn.innerHTML = '</>';
                modeBtn.title = '切换 Markdown / HTML 源码';
                renderPreview();
            }
        }

        // ---------- 弹窗 ----------
        function openDialog(title, bodyNode, onOk, okText) {
            var overlay = document.createElement('div');
            overlay.className = 'vts-dialog-overlay';
            var box = document.createElement('div');
            box.className = 'vts-dialog';
            var head = document.createElement('div');
            head.className = 'vts-dialog-head';
            head.innerHTML = '<h3>' + esc(title) + '</h3>';
            var closeX = document.createElement('button');
            closeX.type = 'button';
            closeX.className = 'vts-dialog-close';
            closeX.textContent = '✕';
            head.appendChild(closeX);
            var body = document.createElement('div');
            body.className = 'vts-dialog-body';
            body.appendChild(bodyNode);
            var foot = document.createElement('div');
            foot.className = 'vts-dialog-foot';
            var cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn';
            cancel.textContent = '取消';
            var ok = document.createElement('button');
            ok.type = 'button';
            ok.className = 'btn btn-primary';
            ok.textContent = okText || '确定';
            foot.appendChild(cancel);
            foot.appendChild(ok);
            box.appendChild(head);
            box.appendChild(body);
            box.appendChild(foot);
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            function close() { overlay.remove(); document.removeEventListener('keydown', onKey, true); }
            function onKey(e) {
                if (e.key === 'Escape') { close(); }
                else if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault(); ok.click();
                }
            }
            closeX.addEventListener('click', close);
            cancel.addEventListener('click', close);
            ok.addEventListener('click', function () { try { onOk(close); } catch (err) { alert(err.message); } });
            overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
            document.addEventListener('keydown', onKey, true);
            var first = body.querySelector('input, select, textarea');
            if (first) first.focus();
        }

        function field(label, inputHtml) {
            var d = document.createElement('div');
            d.className = 'field';
            d.innerHTML = '<label>' + esc(label) + '</label>' + inputHtml;
            return d;
        }

        // 链接
        function openLinkDialog() {
            var fText = field('显示文本', '<input type="text" id="dlg-link-text" placeholder="如：VinePalma Player">');
            var fUrl = field('链接地址', '<input type="text" id="dlg-link-url" placeholder="https://… 或 ../../页面.html">');
            var box = document.createElement('div');
            box.appendChild(fText);
            box.appendChild(fUrl);
            var text = ta.value.slice(ta.selectionStart, ta.selectionEnd);
            openDialog('插入链接', box, function (close) {
                var t = document.getElementById('dlg-link-text').value.trim() || '链接';
                var u = document.getElementById('dlg-link-url').value.trim();
                if (!u) throw new Error('请填写链接地址');
                var sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || t;
                insertAtCursor('[' + sel + '](' + u + ')');
                close();
            });
            document.getElementById('dlg-link-text').value = text;
        }

        // 图片
        function openImageDialog() {
            var tabWrap = document.createElement('div');
            tabWrap.className = 'md-tabs';
            var tabUpload = document.createElement('button');
            tabUpload.type = 'button';
            tabUpload.className = 'md-tab active';
            tabUpload.textContent = '上传图片';
            var tabUrl = document.createElement('button');
            tabUrl.type = 'button';
            tabUrl.className = 'md-tab';
            tabUrl.textContent = '图片链接';
            tabWrap.appendChild(tabUpload);
            tabWrap.appendChild(tabUrl);

            var pUpload = document.createElement('div');
            pUpload.className = 'md-tab-pane';
            var fileRow = document.createElement('div');
            var fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileRow.appendChild(fileInput);
            var upStatus = document.createElement('p');
            upStatus.className = 'md-upload-status';
            upStatus.textContent = '可一次选择多张图片，将依次插入';
            pUpload.appendChild(fileRow);
            pUpload.appendChild(upStatus);

            var pUrl = document.createElement('div');
            pUrl.className = 'md-tab-pane';
            pUrl.style.display = 'none';
            pUrl.appendChild(field('图片地址', '<input type="text" id="dlg-img-url" placeholder="../../Resources/images/uploads/x.png 或 https://…">'));

            var box = document.createElement('div');
            box.appendChild(tabWrap);
            box.appendChild(pUpload);
            box.appendChild(pUrl);

            tabUpload.addEventListener('click', function () {
                tabUpload.classList.add('active'); tabUrl.classList.remove('active');
                pUpload.style.display = ''; pUrl.style.display = 'none';
            });
            tabUrl.addEventListener('click', function () {
                tabUrl.classList.add('active'); tabUpload.classList.remove('active');
                pUpload.style.display = 'none'; pUrl.style.display = '';
            });

            openDialog('插入图片', box, function (close) {
                if (pUpload.style.display !== 'none') {
                    var files = Array.prototype.slice.call(fileInput.files || []);
                    if (!files.length) throw new Error('请先选择图片文件');
                    fileInput.disabled = true;
                    function insertSeq(i) {
                        if (i >= files.length) { close(); return; }
                        var file = files[i];
                        upStatus.textContent = '上传中 ' + (i + 1) + '/' + files.length + ' …';
                        upStatus.classList.remove('error');
                        uploadImage(file, opts).then(function (url) {
                            var alt = file.name.replace(/\.[^.]+$/, '');
                            insertAtCursor('![' + alt + '](' + url + ')\n');
                            insertSeq(i + 1);
                        }).catch(function (err) {
                            upStatus.textContent = '上传失败：' + err.message;
                            upStatus.classList.add('error');
                            fileInput.disabled = false;
                        });
                    }
                    insertSeq(0);
                } else {
                    var u = document.getElementById('dlg-img-url').value.trim();
                    var alt = document.getElementById('dlg-img-alt').value.trim() || '图片';
                    if (!u) throw new Error('请填写图片地址');
                    insertAtCursor('![' + alt + '](' + u + ')');
                    close();
                }
            }, '插入');
            var altField = pUrl.querySelector('.field');
            altField.insertAdjacentHTML('beforeend', '<input type="text" id="dlg-img-alt" placeholder="图片描述（可选）">');
        }

        // 代码块
        function openCodeDialog() {
            var langs = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'bash', 'sql', 'java', 'c', 'cpp', 'go', 'rust', 'yaml', 'text'];
            var opts = langs.map(function (l) { return '<option value="' + l + '">' + l + '</option>'; }).join('');
            var box = document.createElement('div');
            box.appendChild(field('代码语言（影响高亮样式）', '<select id="dlg-code-lang">' + opts + '</select>'));
            box.appendChild(field('代码内容', '<textarea id="dlg-code-body" rows="8" class="mono" placeholder="粘贴代码…"></textarea>'));
            openDialog('插入代码块', box, function (close) {
                var lang = document.getElementById('dlg-code-lang').value;
                var sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
                var body = document.getElementById('dlg-code-body').value || sel || '代码';
                insertBlock('```' + lang + '\n' + body + '\n```');
                close();
            });
        }

        // 表格
        function openTableDialog() {
            var box = document.createElement('div');
            var rowsF = field('行数', '<input type="number" id="dlg-tb-rows" value="3" min="2" max="20" style="width:80px">');
            var colsF = field('列数', '<input type="number" id="dlg-tb-cols" value="3" min="2" max="10" style="width:80px">');
            box.appendChild(rowsF);
            box.appendChild(colsF);
            openDialog('插入表格', box, function (close) {
                var r = parseInt(document.getElementById('dlg-tb-rows').value, 10) || 3;
                var c = parseInt(document.getElementById('dlg-tb-cols').value, 10) || 3;
                var md = '| ' + new Array(c).fill('列').join(' | ') + ' |\n';
                md += '| ' + new Array(c).fill('---').join(' | ') + ' |\n';
                for (var i = 1; i < r; i++) {
                    md += '| ' + new Array(c).fill('').join(' | ') + ' |\n';
                }
                insertBlock(md);
                close();
            });
        }

        // 命令分发
        function exec(cmd, arg) {
            if (mode !== 'md') return;
            ta.focus();
            switch (cmd) {
                case 'h': linePrefix(new Array(arg + 1).join('#') + ' '); break;
                case 'bold': wrap('**', '**', '加粗文本'); break;
                case 'italic': wrap('*', '*', '斜体文本'); break;
                case 'strike': wrap('~~', '~~', '删除内容'); break;
                case 'code': wrap('`', '`', '代码'); break;
                case 'codeblock': openCodeDialog(); break;
                case 'link': openLinkDialog(); break;
                case 'image': openImageDialog(); break;
                case 'ul': linePrefix('- '); break;
                case 'ol': linePrefix('1. '); break;
                case 'task': linePrefix('- [ ] '); break;
                case 'quote': linePrefix('> '); break;
                case 'hr': insertBlock('---'); break;
                case 'table': openTableDialog(); break;
            }
        }

        // ---------- 对外接口 ----------
        function getValue() {
            return mode === 'html' ? srcTa.value : mdToHtml(ta.value);
        }
        function setValue(html) {
            srcTa.value = html || '';
            ta.value = htmlToMarkdown(html || '');
            renderPreview();
        }
        function focus() { ta.focus(); }

        if (opts.initial) setValue(opts.initial);

        return { getValue: getValue, setValue: setValue, focus: focus };
    }

    window.VTSEditor = {
        mount: mount,
        mdToHtml: mdToHtml,
        htmlToMarkdown: htmlToMarkdown,
        uploadImage: uploadImage
    };
})();
