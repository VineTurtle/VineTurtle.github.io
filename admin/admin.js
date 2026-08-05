// admin/admin.js —— 本地管理后台逻辑
(function () {
    'use strict';

    // ---------- 令牌 ----------
    function getToken() {
        const urlToken = new URLSearchParams(location.search).get('token');
        if (urlToken) {
            sessionStorage.setItem('vts_token', urlToken);
            history.replaceState(null, '', location.pathname);
        }
        return urlToken || sessionStorage.getItem('vts_token');
    }

    let token = getToken();

    // 分类信息（来自 /api/status），驱动标签页与列表
    let kindsInfo = [];
    function kindInfo(key) {
        return kindsInfo.find(k => k.key === key) || { key, label: key, icon: '📄' };
    }
    function refreshStatus() {
        return api('/status').then(res => {
            kindsInfo = (res.kinds || []).slice().sort((a, b) => {
                const aBuiltin = a.builtin ? 0 : 1;
                const bBuiltin = b.builtin ? 0 : 1;
                return aBuiltin - bBuiltin || a.label.localeCompare(b.label, 'zh');
            });
            renderTabs(kindsInfo);
        });
    }
    function renderTabs(kinds) {
        const tabsEl = document.getElementById('tabs');
        let html = '';
        kinds.forEach(k => {
            html += `<button class="tab" data-tab="${esc(k.key)}">${esc(k.navIcon || '📄')} ${esc(k.label)}</button>`;
        });
        html += '<button class="tab" data-tab="images">🖼️ 图片</button>';
        html += '<button class="tab" data-tab="kinds">🗂 分类管理</button>';
        html += '<button class="tab" data-tab="deploy">📤 部署发布</button>';
        html += '<button class="tab" data-tab="help">❓ 使用说明</button>';
        tabsEl.innerHTML = html;
    }
    function setActiveTab(tabEl) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
    }

    // ---------- 通用弹窗 ----------
    function modal({ title, bodyHTML, okText, cancelText, onOk, danger }) {
        const overlay = document.createElement('div');
        overlay.className = 'vts-dialog-overlay';
        const box = document.createElement('div');
        box.className = 'vts-dialog' + (danger ? ' vts-dialog-danger' : '');
        box.innerHTML = `
            <div class="vts-dialog-head"><h3>${esc(title)}</h3><button type="button" class="vts-dialog-close">✕</button></div>
            <div class="vts-dialog-body">${bodyHTML}</div>
            <div class="vts-dialog-foot">
                <button type="button" class="btn" data-dlg-cancel>${esc(cancelText || '取消')}</button>
                <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-dlg-ok>${esc(okText || '确定')}</button>
            </div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        function close() { overlay.remove(); document.removeEventListener('keydown', onKey, true); }
        function onKey(e) { if (e.key === 'Escape') close(); }
        box.querySelector('[data-dlg-cancel]').addEventListener('click', close);
        box.querySelector('.vts-dialog-close').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey, true);
        const okBtn = box.querySelector('[data-dlg-ok]');
        okBtn.addEventListener('click', () => { try { onOk && onOk(close); } catch (err) { toast(err.message, true); } });
        const first = box.querySelector('input, select, textarea');
        if (first) first.focus();
        return { close, box, okBtn };
    }
    function confirmDialog({ title, bodyHTML, okText, danger, onOk }) {
        modal({ title, bodyHTML: bodyHTML || '', okText, danger, onOk });
    }

    // ---------- 工具 ----------
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toast(msg, isError) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.toggle('error', !!isError);
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 3000);
    }

    function todayStr() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }

    function fmtSize(bytes) {
        if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    function tagsToArray(s) {
        return s.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    }

    // ---------- 图片上传（含缩略图生成） ----------
    // 读取图片并在本地压缩生成一张小图（@thumb），上传时一并发送，用于列表卡片加载加速。
    // 返回 { data, thumbName?, thumbData? }；小图仅在图片比阈值大时才生成。
    function prepareUpload(file, maxDim) {
        maxDim = maxDim || 800;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const data = reader.result;
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    if (scale >= 1 || !img.width || !img.height) {
                        resolve({ data });
                        return;
                    }
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * scale));
                    c.height = Math.max(1, Math.round(img.height * scale));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    resolve({
                        data,
                        thumbName: file.name.replace(/\.[^.]+$/, '') + '@thumb.jpg',
                        thumbData: c.toDataURL('image/jpeg', 0.8)
                    });
                };
                img.onerror = () => reject(new Error('无法读取该图片'));
                img.src = reader.result;
            };
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    }

    // 上传原图 + 压缩小图到当前分类的图片目录
    function uploadWithThumb(file, kind) {
        return prepareUpload(file).then(prep =>
            fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    name: file.name,
                    data: prep.data,
                    kind,
                    thumbName: prep.thumbName,
                    thumbData: prep.thumbData
                })
            }).then(res => res.json().then(d => res.ok ? d : Promise.reject(new Error(d.message || '上传失败'))))
        );
    }

    // ---------- API ----------
    async function api(path, opts) {
        opts = opts || {};
        const headers = { 'Authorization': 'Bearer ' + token };
        if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
        const res = await fetch('/api' + path, {
            method: opts.method || 'GET',
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
        });
        if (res.status === 401) {
            showLogin();
            throw new Error('未授权');
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || '请求失败');
        return data;
    }

    // ---------- 登录 ----------
    function showLogin() {
        if (document.querySelector('.login-overlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        overlay.innerHTML = `
            <div class="login-box">
                <h2>🔑 需要管理员令牌</h2>
                <p>请从启动后台的终端复制带 token 的完整地址访问。</p>
                <div class="field">
                    <label for="loginToken">管理员令牌</label>
                    <input id="loginToken" type="password" placeholder="粘贴 token" autocomplete="off">
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" id="loginBtn">进入后台</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('loginBtn').addEventListener('click', () => {
            token = document.getElementById('loginToken').value.trim();
            if (!token) return toast('请输入令牌', true);
            sessionStorage.setItem('vts_token', token);
            overlay.remove();
            init();
        });
    }

    // ---------- 视图容器 ----------
    const view = document.getElementById('view');

    // ---------- 分类内容列表 ----------
    function renderList(kind) {
        const info = kindInfo(kind);
        view.innerHTML = '<div class="card"><p class="empty">加载中…</p></div>';
        api('/' + kind).then(res => {
            const items = res.items || [];
            const rows = items.map(it => {
                const missing = it.hasBody ? '' : '<span class="badge-missing">缺正文</span>';
                const tags = (it.tags || []).map(t => '#' + esc(t)).join(' ');
                return `
                    <div class="item-row">
                        <div class="item-main">
                            <div class="item-title">${esc(it.title)} ${missing}</div>
                            <div class="item-meta">
                                ${esc(it.date || '')} · ${esc(it.name)} ${tags ? '<span class="item-tags">' + tags + '</span>' : ''}
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="btn" data-action="copy-${esc(kind)}" data-name="${esc(it.name)}">复制</button>
                            <button class="btn" data-action="edit-${esc(kind)}" data-name="${esc(it.name)}">编辑</button>
                            <button class="btn" data-action="move-${esc(kind)}" data-name="${esc(it.name)}">转移</button>
                            <button class="btn btn-danger" data-action="delete-${esc(kind)}" data-name="${esc(it.name)}">删除</button>
                        </div>
                    </div>`;
            }).join('');

            view.innerHTML = `
                <div class="card">
                    <div class="card-head">
                        <h2>${esc(info.navIcon || '📄')} ${esc(info.label)}（${items.length}）</h2>
                        <button class="btn btn-primary" data-action="new-${esc(kind)}">＋ 新建</button>
                    </div>
                    ${items.length ? rows : '<p class="empty">还没有内容，点击「新建」开始。</p>'}
                </div>
                <div class="card">
                    <p class="form-hint">💾 操作即时生效：保存/删除会<strong>直接写入本地文件</strong>（data/ 与 Resources/），并自动重建索引。上传的图片在「🖼️ 图片」标签页管理。部署到线上需到「部署发布」执行。</p>
                </div>`;
        }).catch(err => {
            view.innerHTML = '<div class="card"><p class="empty">加载失败：' + esc(err.message) + '</p></div>';
        });
    }

    // ---------- 编辑器 ----------
    function inputField(name, label, value, opts) {
        opts = opts || {};
        return `
            <div class="field ${opts.full ? 'full' : ''}">
                <label for="f-${name}">${label}</label>
                <input id="f-${name}" name="${name}" type="${opts.type || 'text'}"
                       value="${esc(value == null ? '' : value)}" ${opts.placeholder ? 'placeholder="' + esc(opts.placeholder) + '"' : ''}>
            </div>`;
    }

    function textareaField(name, label, value, opts) {
        opts = opts || {};
        return `
            <div class="field full">
                <label for="f-${name}">${label}</label>
                <textarea id="f-${name}" name="${name}" class="${opts.mono ? 'mono' : ''}"
                          rows="${opts.rows || 4}" placeholder="${opts.placeholder ? esc(opts.placeholder) : ''}">${esc(value || '')}</textarea>
            </div>`;
    }

    // 图片路径选择字段：可直接上传 / 从已上传图中选择 / 预览
    function imagePickerField(name, label, value) {
        return `
            <div class="field full img-pick-field">
                <label for="f-${name}">${label}</label>
                <div class="img-pick-row">
                    <input id="f-${name}" name="${name}" type="text"
                           value="${esc(value == null ? '' : value)}" placeholder="../../Resources/images/… 或留空不显示">
                    <button type="button" class="btn" data-img-upload="${name}">⬆ 上传</button>
                    <button type="button" class="btn" data-img-browse="${name}">📁 选择已有</button>
                    <button type="button" class="btn" data-img-preview-toggle="${name}">👁 预览</button>
                </div>
                <div class="img-pick-preview" id="prev-${name}" hidden>
                    <img src="" alt="图片预览"><p class="img-pick-empty">该路径暂无可用图片</p>
                </div>
            </div>`;
    }

    // 挂载图片字段的上传 / 选择 / 预览行为
    function wireImagePicker(name, kind) {
        const input = document.getElementById('f-' + name);
        const preview = document.getElementById('prev-' + name);
        if (!input || !preview) return;
        const img = preview.querySelector('img');

        function refreshPreview() {
            const v = input.value.trim();
            if (!v) { preview.hidden = true; return; }
            preview.hidden = false;
            img.style.display = '';
            img.src = v;
            img.onerror = () => { img.style.display = 'none'; };
            img.onload = () => { img.style.display = ''; };
        }
        input.addEventListener('input', refreshPreview);

        const upBtn = preview.parentElement.querySelector('[data-img-upload="' + name + '"]');
        if (upBtn) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            upBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
                if (!fileInput.files.length) return;
                const f = fileInput.files[0];
                upBtn.disabled = true;
                uploadWithThumb(f, kind)
                    .then(d => {
                        input.value = d.url;
                        refreshPreview();
                        toast('已上传并填入路径' + (d.thumbUrl ? '（含列表小图）' : ''));
                    })
                    .catch(err => toast('上传失败：' + err.message, true))
                    .finally(() => { upBtn.disabled = false; fileInput.value = ''; });
            });
        }

        const brBtn = preview.parentElement.querySelector('[data-img-browse="' + name + '"]');
        if (brBtn) brBtn.addEventListener('click', () =>
            openImagePickerDialog(url => { input.value = url; refreshPreview(); toast('已填入路径'); }));

        const pvBtn = preview.parentElement.querySelector('[data-img-preview-toggle="' + name + '"]');
        if (pvBtn) pvBtn.addEventListener('click', () => {
            preview.hidden = !preview.hidden;
            if (!preview.hidden) refreshPreview();
        });

        refreshPreview();
    }

    // 从已上传图片中选择（弹窗）
    function openImagePickerDialog(cb) {
        api('/images').then(res => {
            const items = res.items || [];
            const overlay = document.createElement('div');
            overlay.className = 'vts-dialog-overlay';
            const box = document.createElement('div');
            box.className = 'vts-dialog vts-dialog-wide';
            box.innerHTML = `
                <div class="vts-dialog-head">
                    <h3>选择已有图片</h3>
                    <button type="button" class="vts-dialog-close">✕</button>
                </div>
                <div class="vts-dialog-body">
                    <div class="img-pick-list">
                        ${items.length
                            ? items.map(it => `
                                <button type="button" class="img-pick-item" data-url="${esc(it.url)}">
                                    <img src="${esc(it.url)}" alt="${esc(it.name)}" loading="lazy">
                                    <span>${esc(it.name)}</span>
                                </button>`).join('')
                            : '<p class="empty">还没有上传过图片，可先用「⬆ 上传」。</p>'}
                    </div>
                </div>`;
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            function close() { overlay.remove(); }
            box.querySelector('.vts-dialog-close').addEventListener('click', close);
            overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
            box.querySelectorAll('.img-pick-item').forEach(btn => {
                btn.addEventListener('click', () => { cb(btn.dataset.url); close(); });
            });
        }).catch(err => toast('加载图片失败：' + err.message, true));
    }

    // 标签联想：datalist 下拉 + 可点选的小标签
    function renderTagSuggestions(allTags) {
        const tagsInput = document.getElementById('f-tags');
        if (!tagsInput || !allTags.length) return;
        const dl = document.createElement('datalist');
        dl.id = 'vts-tag-list';
        allTags.forEach(t => {
            const o = document.createElement('option');
            o.value = t;
            dl.appendChild(o);
        });
        document.body.appendChild(dl);
        tagsInput.setAttribute('list', 'vts-tag-list');

        const chips = document.createElement('div');
        chips.className = 'tag-chips';
        allTags.forEach(t => {
            const c = document.createElement('button');
            c.type = 'button';
            c.className = 'tag-chip';
            c.textContent = '#' + t;
            c.addEventListener('click', () => {
                const arr = tagsToArray(tagsInput.value);
                if (!arr.includes(t)) {
                    arr.push(t);
                    tagsInput.value = arr.join(', ');
                    tagsInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
            chips.appendChild(c);
        });
        tagsInput.parentElement.appendChild(chips);
    }

    // ---------- 转移分类 ----------
    function openMoveDialog(kind, name) {
        api('/status').then(res => {
            const targets = (res.kinds || []).filter(k => k.key !== kind);
            const overlay = document.createElement('div');
            overlay.className = 'vts-dialog-overlay';
            const box = document.createElement('div');
            box.className = 'vts-dialog';
            box.innerHTML = `
                <div class="vts-dialog-head">
                    <h3>转移「${esc(name)}」</h3>
                    <button type="button" class="vts-dialog-close">✕</button>
                </div>
                <div class="vts-dialog-body">
                    <p class="form-hint">把「${esc(name)}」移动到其他分类。正文与元数据会一起移动，图片留在原目录、按路径仍正常显示。</p>
                    ${targets.length
                        ? targets.map(t => `<button type="button" class="btn btn-primary move-target" data-key="${esc(t.key)}">→ 移动到「${esc(t.label)}」</button>`).join(' ')
                        : '<p class="empty">没有其他分类可选。</p>'}
                </div>`;
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            function close() { overlay.remove(); }
            box.querySelector('.vts-dialog-close').addEventListener('click', close);
            overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
            box.querySelectorAll('.move-target').forEach(btn => {
                btn.addEventListener('click', () => { close(); doMove(kind, name, btn.dataset.key); });
            });
        }).catch(err => toast('加载分类失败：' + err.message, true));
    }

    function doMove(kind, name, toKind) {
        if (!confirm('确定把「' + name + '」转移到该分类吗？转移后请在对应分类中编辑。')) return;
        api('/move', { method: 'POST', body: { kind, name, toKind } })
            .then(res => { toast(res.message || '已转移'); renderList(kind); })
            .catch(err => toast('转移失败：' + err.message, true));
    }

    function renderEditor(kind, name, opts) {
        opts = opts || {};
        const info = kindInfo(kind);
        const isProject = kind === 'projects';
        const isNew = opts.duplicate ? true : !name;
        const srcName = opts.duplicate ? name : name; // 复制时源内容
        const load = isNew && !opts.duplicate
            ? Promise.resolve({ post: { date: todayStr() }, content: '' })
            : api('/' + kind + '/' + encodeURIComponent(srcName)).then(res => ({ post: res.post, content: res.content }));

        view.innerHTML = '<div class="card"><p class="empty">加载中…</p></div>';

        // 标签联想：并行获取已有标签
        const tagsPromise = api('/tags').catch(() => ({ tags: [] }));

        Promise.all([load, tagsPromise]).then(([{ post, content }, tagRes]) => {
            const p = post || {};
            const allTags = (tagRes && tagRes.tags) || [];
            const meta = {
                title: inputField('title', '标题 *', opts.duplicate ? (p.title || '') + '（副本）' : p.title, { full: true }),
                slug: inputField('slug', '文件名 / slug', opts.duplicate ? '' : p.slug, { placeholder: '留空自动生成，建议英文/数字/连字符' }),
                date: inputField('date', '日期', p.date, { type: 'date' }),
                tags: inputField('tags', '标签（逗号分隔，可从下方点选）', (p.tags || []).join(', '), { placeholder: '如：技术笔记, Electron', full: true }),
                fallbackIcon: inputField('fallbackIcon', '占位图标 (emoji)', p.fallbackIcon, { placeholder: '🌲' }),
                thumbnail: imagePickerField('thumbnail', '列表封面图（可上传或选择已有）', p.thumbnail),
                hero: imagePickerField('hero', '详情头图（可上传或选择已有）', p.hero),
            };

            const extra = isProject
                ? (inputField('desc', '简介', p.desc, { full: true })
                    + inputField('status', '状态', p.status, { placeholder: '✅ 已完成' })
                    + inputField('statusClass', '状态样式', p.statusClass, { placeholder: 'status-done' })
                    + inputField('year', '年份', p.year, { placeholder: '2026' }))
                : textareaField('excerpt', '摘要', p.excerpt, { rows: 3 });

            const form = `
                <div class="card">
                    <div class="card-head">
                        <h2>${isNew ? '新建' : '编辑'}${info.label}${isNew ? '' : '：' + esc(p.title)}</h2>
                        <div>
                            <button class="btn" data-action="cancel-edit">返回</button>
                            <button class="btn btn-primary" data-action="save-editor">💾 保存</button>
                        </div>
                    </div>
                    <form id="editorForm">
                        <div class="form-grid">
                            ${meta.title}
                            ${meta.slug}
                            ${meta.date}
                            ${meta.tags}
                            ${meta.thumbnail}
                            ${meta.hero}
                            ${meta.fallbackIcon}
                            ${extra}
                        </div>
                        <div class="field full">
                            <label>正文（可视化编辑，无需写 HTML）</label>
                            <div id="editorMount"></div>
                            <p class="form-hint">用工具栏设置标题 / 加粗 / 代码块 / 图片等；插入图片可多选上传到本机或填链接。点击工具栏「&lt;/&gt;」可切换 HTML 源码模式。编辑内容会自动保存草稿。</p>
                        </div>
                    </form>
                </div>`;

            view.innerHTML = form;
            const formEl = document.getElementById('editorForm');
            formEl.addEventListener('submit', function (e) { e.preventDefault(); });
            wireImagePicker('thumbnail', kind);
            wireImagePicker('hero', kind);
            renderTagSuggestions(allTags);

            // ---------- 草稿自动保存 / 恢复 ----------
            const DRAFT_KEY = 'vts_draft';
            const draftKey = opts.duplicate ? null : (name || null); // 复制按“新建”算
            function currentDraft() {
                try {
                    return JSON.parse(localStorage.getItem(DRAFT_KEY));
                } catch (_) { return null; }
            }
            function saveDraft() {
                const fd = new FormData(formEl);
                const d = {
                    kind,
                    name: draftKey,
                    savedAt: Date.now(),
                    fields: {},
                    content: editor.getValue()
                };
                ['title', 'slug', 'date', 'tags', 'excerpt', 'fallbackIcon', 'thumbnail', 'hero',
                 'desc', 'status', 'statusClass', 'year'].forEach(k => {
                    d.fields[k] = fd.get(k) || '';
                });
                try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (_) {}
            }
            function clearDraft() {
                clearTimeout(draftDebounce);
                try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
            }
            function applyDraft(d) {
                Object.keys(d.fields).forEach(k => {
                    const el = document.getElementById('f-' + k);
                    if (el) el.value = d.fields[k];
                });
                editor.setValue(d.content);
                toast('已恢复未保存的草稿');
            }
            let draftDebounce = null;
            function scheduleDraftSave() {
                clearTimeout(draftDebounce);
                draftDebounce = setTimeout(saveDraft, 400);
            }
            formEl.addEventListener('input', scheduleDraftSave);

            // 挂载可视化编辑器（正文 HTML 由它统一维护）
            const editor = window.VTSEditor.mount(document.getElementById('editorMount'), {
                initial: content,
                kind: kind,
                getToken: function () { return token; },
                onChange: scheduleDraftSave
            });

            // 恢复草稿：仅当同一篇文章（或同为新建）且确有草稿时提示
            const draft = currentDraft();
            if (draft && draft.kind === kind && (draft.name || null) === draftKey) {
                const t = new Date(draft.savedAt);
                if (confirm('检测到「' + (draft.fields.title || '未命名') + '」的未保存草稿（' + t.toLocaleString() + '），是否恢复？')) {
                    applyDraft(draft);
                } else {
                    clearDraft();
                }
            }

            // 保存
            document.querySelector('[data-action="save-editor"]').addEventListener('click', () => {
                const fd = new FormData(formEl);
                const meta = {};
                ['title', 'slug', 'date', 'tags', 'excerpt', 'fallbackIcon', 'thumbnail', 'hero',
                 'desc', 'status', 'statusClass', 'year'].forEach(k => {
                    if (fd.get(k)) meta[k] = fd.get(k);
                });
                if (meta.tags) meta.tags = tagsToArray(meta.tags);

                if (!meta.title) return toast('请填写标题', true);

                // 摘要留空时自动从正文提取
                if (!isProject && !meta.excerpt) {
                    const text = (editor.getValue() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (text) meta.excerpt = text.slice(0, 80) + (text.length > 80 ? '…' : '');
                }

                let newName;
                const slug = (meta.slug || '').trim();
                if (isNew) {
                    newName = slug || 'post-' + Date.now();
                } else {
                    newName = slug || name; // 留空则保持原文件名
                }

                // slug 冲突确认：防止静默覆盖其他已有内容
                const btn = document.querySelector('[data-action="save-editor"]');
                btn.disabled = true;
                api('/' + kind).then(res => {
                    const exists = (res.items || []).some(it => it.name === newName && it.name !== name);
                    if (exists && !confirm('「' + newName + '」已存在，保存将覆盖该文件原有内容，确定继续吗？')) {
                        btn.disabled = false;
                        return;
                    }
                    return api('/' + kind, {
                        method: 'POST',
                        body: { oldName: isNew ? undefined : name, name: newName, post: meta, content: editor.getValue() || '' }
                    });
                }).then(res => {
                    if (!res) return;
                    toast('已保存：' + (res.saved.name || ''));
                    clearDraft();
                    btn.disabled = false;
                    renderList(kind);
                }).catch(err => {
                    toast('保存失败：' + err.message, true);
                    btn.disabled = false;
                });
            });

            document.querySelector('[data-action="cancel-edit"]').addEventListener('click', () => renderList(kind));
        }).catch(err => {
            view.innerHTML = '<div class="card"><p class="empty">加载失败：' + esc(err.message) + '</p></div>';
        });
    }

    // ---------- 删除 ----------
    async function deleteItem(kind, name) {
        if (!confirm('确定删除「' + name + '」吗？此操作不可恢复。')) return;
        try {
            const res = await api('/' + kind + '/' + encodeURIComponent(name), { method: 'DELETE' });
            toast(res.message || '已删除');
            renderList(kind);
        } catch (err) {
            toast('删除失败：' + err.message, true);
        }
    }

    // ---------- 图片 ----------
    function renderImages() {
        view.innerHTML = '<div class="card"><p class="empty">加载中…</p></div>';
        api('/images').then(res => {
            const items = res.items || [];
            const total = items.reduce((a, b) => a + (b.size || 0), 0);

            // 按目录分组，每个分类一组（顺序跟随分类配置，旧 uploads 兼容）
            const groups = [];
            const order = kindsInfo.map(k => k.imageSub).filter(Boolean).concat(['uploads']);
            items.forEach(img => {
                const dirKey = order.includes(img.dirKey) ? img.dirKey : 'uploads';
                let g = groups.find(x => x.key === dirKey);
                if (!g) { g = { key: dirKey, label: img.dirLabel || dirKey, list: [] }; groups.push(g); }
                g.list.push(img);
            });
            groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

            const sections = groups.map(g => {
                const cards = g.list.map(img => {
                    const refs = img.refs || [];
                    const refHtml = refs.length
                        ? '<div class="img-refs"><span class="badge-missing">被 ' + refs.length + ' 处引用</span>' + refs.slice(0, 3).map(r => '<span class="img-ref">' + esc(r) + '</span>').join('') + (refs.length > 3 ? '<span class="img-ref">…</span>' : '') + '</div>'
                        : '<div class="img-refs"><span class="badge-ok">未被引用</span></div>';
                    return `
                        <div class="img-card">
                            <div class="img-thumb"><img src="${esc(img.url)}" alt="${esc(img.name)}" loading="lazy"></div>
                            <div class="img-info">
                                <div class="img-name" title="${esc(img.name)}">${esc(img.name)}</div>
                                <div class="img-meta">${fmtSize(img.size)}</div>
                                ${refHtml}
                            </div>
                            <button class="btn btn-danger" data-action="delete-image" data-dir="${esc(g.key)}" data-name="${esc(img.name)}" data-refs="${refs.length}">删除</button>
                        </div>`;
                }).join('');
                return `<div class="img-group">
                            <h3 class="img-group-title">${esc(g.label)}（${g.list.length}）</h3>
                            <div class="img-grid">${cards}</div>
                        </div>`;
            }).join('');

            view.innerHTML = `
                <div class="card">
                    <div class="card-head">
                        <h2>🖼️ 图片管理（${items.length}）</h2>
                        <span class="pill">共 ${fmtSize(total)}</span>
                    </div>
                    <p class="form-hint">图片按内容分类存放（每个分类一个目录）。上传时同名文件会自动重命名避免覆盖；列表封面图会自动生成 <code>@thumb</code> 小图加速加载，这里只需管理原图。删除前请确认没有文章引用。</p>
                    ${items.length ? sections : '<p class="empty">还没有上传过图片。在编辑正文时点「🖼️ 上传」即可添加。</p>'}
                </div>`;
        }).catch(err => {
            view.innerHTML = '<div class="card"><p class="empty">加载失败：' + esc(err.message) + '</p></div>';
        });
    }

    async function deleteImage(dir, name, refCount) {
        const msg = refCount > 0
            ? '图片「' + name + '」被 ' + refCount + ' 处内容引用，删除后这些位置将显示占位图标。确定删除吗？'
            : '确定删除图片「' + name + '」吗？此操作不可恢复。';
        if (!confirm(msg)) return;
        try {
            const res = await api('/images/' + encodeURIComponent(dir) + '/' + encodeURIComponent(name), { method: 'DELETE' });
            toast(res.message || '已删除');
            renderImages();
        } catch (err) {
            toast('删除失败：' + err.message, true);
        }
    }

    // ---------- 分类管理 ----------
    function renderKinds() {
        const rows = kindsInfo.map(k => `
            <tr>
                <td>${esc(k.navIcon || '')} ${esc(k.label)} ${k.builtin ? '<span class="badge-ok">内置</span>' : ''}</td>
                <td><code>${esc(k.key)}</code></td>
                <td>${k.count || 0}</td>
                <td><code>SpecialPages/${esc(k.pageName || '')}</code></td>
                <td><code>${esc(k.dataDir || '')}</code></td>
                <td><code>Resources/images/${esc(k.imageSub || '')}</code></td>
                <td class="kinds-actions">${k.builtin
                    ? '<span class="pill">不可删除</span>'
                    : `<button class="btn btn-danger" data-action="delete-kind" data-key="${esc(k.key)}" data-label="${esc(k.label)}">删除分类</button>`}</td>
            </tr>`).join('');

        view.innerHTML = `
            <div class="card">
                <div class="card-head"><h2>🗂 分类管理</h2></div>
                <p class="form-hint">新增分类会自动创建 <code>data/&lt;key&gt;/</code>（含 posts/ 与空索引）、<code>Resources/images/&lt;key&gt;/</code>，并生成列表页/详情页、接入首页「更多」导航与后台标签页。删除分类有风险且不可恢复，需要<strong>多重确认</strong>，且只允许删除空分类（请先把内容转移或删除）。</p>
                <table class="kinds-table">
                    <thead><tr><th>分类</th><th>标识 key</th><th>内容数</th><th>页面目录</th><th>数据目录</th><th>图片目录</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="card">
                <div class="card-head"><h2>＋ 新增分类</h2></div>
                <form id="kindForm">
                    <div class="form-grid">
                        <div class="field">
                            <label for="k-key">分类标识 key *</label>
                            <input id="k-key" type="text" placeholder="如 notes（小写英文/数字/连字符，用作目录与网址）">
                        </div>
                        <div class="field">
                            <label for="k-label">分类名称 *</label>
                            <input id="k-label" type="text" placeholder="如 笔记">
                        </div>
                        <div class="field">
                            <label for="k-icon">首页图标 (emoji)</label>
                            <input id="k-icon" type="text" placeholder="📓">
                        </div>
                        <div class="field">
                            <label for="k-desc">一句话简介</label>
                            <input id="k-desc" type="text" placeholder="显示在列表页头部与首页卡片">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="kindAddBtn">创建分类</button>
                    </div>
                </form>
            </div>`;

        document.getElementById('kindForm').addEventListener('submit', e => {
            e.preventDefault();
            const key = document.getElementById('k-key').value.trim();
            const label = document.getElementById('k-label').value.trim();
            const navIcon = document.getElementById('k-icon').value.trim();
            const navDesc = document.getElementById('k-desc').value.trim();
            if (!key || !label) return toast('请填写分类标识和名称', true);
            if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) return toast('分类标识仅支持小写字母、数字与连字符', true);
            const btn = document.getElementById('kindAddBtn');
            btn.disabled = true;
            api('/kinds', { method: 'POST', body: { key, label, navIcon, navDesc } })
                .then(res => toast(res.message || '已创建分类'))
                .then(() => refreshStatus())
                .then(() => {
                    const tabEl = Array.from(document.querySelectorAll('#tabs .tab')).find(t => t.dataset.tab === key);
                    if (tabEl) setActiveTab(tabEl);
                    renderList(key);
                })
                .catch(err => {
                    toast('创建失败：' + err.message, true);
                    btn.disabled = false;
                });
        });
    }

    function deleteKind(key, label) {
        // 第一次确认：说明风险
        confirmDialog({
            title: '⚠️ 删除分类「' + label + '」',
            bodyHTML: '<p>此操作<strong>不可恢复</strong>，将删除：</p>'
                + '<ul style="margin:8px 0;padding-left:20px;font-size:0.9rem;">'
                + '<li>数据与正文：<code>data/' + esc(key) + '/</code></li>'
                + '<li>该分类图片：<code>Resources/images/' + esc(key) + '/</code></li>'
                + '<li>列表页/详情页：<code>SpecialPages/…/</code></li>'
                + '<li>首页导航卡片与后台标签页</li></ul>'
                + '<p class="form-hint">仅允许删除空分类（内容数为 0）。请先把内容转移或删除后再操作。</p>',
            okText: '继续',
            danger: true,
            onOk: (close) => {
                close();
                // 第二次确认：输入分类标识，防止误删
                typeToConfirm(key, label);
            }
        });
    }

    function typeToConfirm(key, label) {
        const m = modal({
            title: '最后确认：输入分类标识',
            bodyHTML: '<p>请输入分类标识 <code>' + esc(key) + '</code> 以确认删除：</p>'
                + '<div class="field" style="margin-top:8px;">'
                + '<input type="text" id="dlg-type" class="mono" placeholder="' + esc(key) + '" autocomplete="off">'
                + '</div>',
            okText: '永久删除',
            danger: true,
            onOk: (close) => {
                const val = m.box.querySelector('#dlg-type').value.trim();
                if (val !== key) return toast('输入的标识不匹配，已取消删除', true);
                close();
                api('/kinds/' + encodeURIComponent(key), { method: 'DELETE' })
                    .then(res => toast(res.message || '已删除分类'))
                    .then(() => refreshStatus())
                    .then(() => renderKinds())
                    .catch(err => toast('删除失败：' + err.message, true));
            }
        });
        const input = m.box.querySelector('#dlg-type');
        input.focus();
        input.addEventListener('input', () => { m.okBtn.disabled = input.value.trim() !== key; });
        m.okBtn.disabled = true;
    }

    // ---------- 部署 ----------
    function renderDeploy() {
        view.innerHTML = `
            <div class="card">
                <div class="card-head">
                    <h2>📤 部署发布</h2>
                    <button class="btn btn-primary" data-action="deploy-run">🚀 开始部署</button>
                </div>
                <p class="form-hint">部署会先重建索引，然后执行 scripts/deploy.js：</p>
                <ul class="help" style="margin:8px 0 14px;padding-left:20px;font-size:0.9rem;">
                    <li>配置了 <code>scripts/deploy.config.json</code>（rsync 目标）→ 上传到服务器；</li>
                    <li>否则项目是 Git 仓库 → 自动 commit + push，由托管平台自动发布。</li>
                </ul>
                <pre class="deploy-output" id="deployOutput">等待执行…</pre>
            </div>`;
    }

    async function runDeploy() {
        const out = document.getElementById('deployOutput');
        if (!out) return;
        const btn = document.querySelector('[data-action="deploy-run"]');
        btn.disabled = true;
        out.textContent = '正在执行部署…\n';
        try {
            const res = await fetch('/api/deploy', { headers: { 'Authorization': 'Bearer ' + token } });
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                out.textContent += dec.decode(value, { stream: true });
            }
        } catch (err) {
            out.textContent += '\n❌ 部署失败：' + err.message;
        }
        btn.disabled = false;
    }

    // ---------- 说明 ----------
    function renderHelp() {
        view.innerHTML = `
            <div class="card help">
                <h2>❓ 使用说明</h2>
                <h3>日常发布流程</h3>
                <ol>
                    <li>本机启动后台：<code>npm run admin</code></li>
                    <li>浏览器打开终端打印的「管理后台」地址（仅本机可访问，带一次性令牌）。</li>
                    <li>在「博客文章 / 项目」中增删改内容：正文用可视化编辑器写（标题/加粗/代码块/图片等），无需写 HTML；保存时自动重建索引。</li>
                    <li>正文里插图片：点工具栏「🖼️」→ 上传图片（可多选，按分类存到 <code>Resources/images/blog</code> 或 <code>projects</code>）或填图片链接。</li>
                    <li>列表封面图 / 详情头图：直接点「⬆ 上传」传图并自动填入路径，或点「📁 选择已有」从已上传图中挑；同一张图做封面+头图只存一份。同名图片会自动重命名不覆盖。</li>
                    <li>列表卡片优先加载自动生成的 <code>@thumb</code> 小图，加快加载；「🖼️ 图片」页按分类管理，可看到每个图片被哪些内容引用。</li>
                    <li>编辑会自动保存草稿（本机浏览器），意外关闭后重开会提示恢复；摘要留空时保存会自动从正文提取。</li>
                    <li>标签框支持联想已有标签（点下方小标签快速添加）；「复制」可一键复制内容，「转移」可移到其他分类。</li>
                    <li>「🗂 分类管理」可新增/删除分类：新增自动建目录、页面与首页导航；删除需多重确认且只允许删空分类。</li>
                    <li>到「部署发布」点开始部署，把本项目上传到服务器或推送 Git。</li>
                </ol>
                <h3>安全说明</h3>
                <p>后台只监听本机 127.0.0.1，生产环境不会部署本后台，普通用户永远无法进入。</p>
                <h3>部署配置</h3>
                <p>rsync 方式：新建 <code>scripts/deploy.config.json</code>：
                    <br><code>{ "method": "rsync", "target": "user@服务器:/var/www/vineturtle" }</code></p>
                <p>Git 方式：<code>git init</code> 并 <code>git remote add origin &lt;仓库地址&gt;</code> 后直接部署。</p>
                <h3>手动写文章（不用后台时）</h3>
                <ol>
                    <li>在 <code>data/blog/posts/</code> 新建 <code>&lt;slug&gt;.html</code> 写正文。</li>
                    <li>在 <code>data/blog/</code> 新建 <code>&lt;slug&gt;.json</code> 写元数据（title/date/tags/excerpt/hero/fallbackIcon）。</li>
                    <li>运行 <code>npm run generate</code> 重建索引。</li>
                </ol>
                <h3>本地预览</h3>
                <p>直接 <code>npm run dev</code>，或用后台里的「站点预览」链接。</p>
            </div>`;
    }

    // ---------- 事件委托 ----------
    document.getElementById('view').addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.dataset.action;
        const name = el.dataset.name;

        // 动态分类操作：new-<kind> / edit-<kind> / copy-<kind> / move-<kind> / delete-<kind>
        // 仅当 kind 是真实分类时才走动态分支，避免吞掉 delete-kind 等固定操作
        const m = action.match(/^(new|edit|copy|move|delete)-(.+)$/);
        if (m && kindsInfo.some(k => k.key === m[2])) {
            const op = m[1], kind = m[2];
            if (op === 'new') renderEditor(kind, null);
            else if (op === 'edit') renderEditor(kind, name);
            else if (op === 'copy') renderEditor(kind, name, { duplicate: true });
            else if (op === 'move') openMoveDialog(kind, name);
            else if (op === 'delete') deleteItem(kind, name);
            return;
        }
        switch (action) {
            case 'delete-kind': deleteKind(el.dataset.key, el.dataset.label); break;
            case 'deploy-run': runDeploy(); break;
            case 'delete-image': deleteImage(el.dataset.dir, name, parseInt(el.dataset.refs || '0', 10)); break;
        }
    });

    // ---------- 标签页 ----------
    document.getElementById('tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (!btn) return;
        setActiveTab(btn);
        const tab = btn.dataset.tab;
        if (kindsInfo.some(k => k.key === tab)) renderList(tab);
        else if (tab === 'images') renderImages();
        else if (tab === 'kinds') renderKinds();
        else if (tab === 'deploy') renderDeploy();
        else if (tab === 'help') renderHelp();
    });

    // ---------- 启动 ----------
    function init() {
        if (!token) { showLogin(); return; }
        refreshStatus()
            .then(() => { if (kindsInfo.length) renderList(kindsInfo[0].key); else renderKinds(); })
            .catch(() => { /* 已由 api() 处理登录页 */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
