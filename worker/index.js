// worker/index.js —— Cloudflare Worker + D1：点赞与阅读量 API
// 部署后把 data/meta/dynamic.json 的 stats.apiBase 指向你的 Worker 域名。
// 只保存内容 key 与计数；IP 仅以哈希形式参与每日限流。

function json(data, status, cors) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...cors
        }
    });
}

function corsHeaders(env) {
    return {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin'
    };
}

function validKey(key) {
    return typeof key === 'string'
        && key.length > 0
        && key.length <= 160
        && /^[A-Za-z0-9:._-]+$/.test(key);
}

async function hashIp(request, env) {
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const data = new TextEncoder().encode(ip + '|' + (env.IP_SALT || 'vts'));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function dayKey() {
    return new Date().toISOString().slice(0, 10);
}

async function overLimit(env, request, bucket, max) {
    const ipHash = await hashIp(request, env);
    const day = dayKey();
    await env.DB.prepare(
        'INSERT INTO rate_limits (ip_hash, day, bucket, count) VALUES (?, ?, ?, 1) '
        + 'ON CONFLICT(ip_hash, day, bucket) DO UPDATE SET count = count + 1'
    ).bind(ipHash, day, bucket).run();
    const row = await env.DB.prepare(
        'SELECT count FROM rate_limits WHERE ip_hash = ? AND day = ? AND bucket = ?'
    ).bind(ipHash, day, bucket).first();
    return !row || Number(row.count) > max;
}

async function getStats(env, key) {
    const row = await env.DB.prepare('SELECT key, views, likes FROM stats WHERE key = ?').bind(key).first();
    return row || { key, views: 0, likes: 0 };
}

async function handleStats(request, env, cors) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    if (!validKey(key)) return json({ error: 'invalid key' }, 400, cors);
    return json(await getStats(env, key), 200, cors);
}

async function handleView(request, env, cors) {
    const body = await request.json().catch(() => null);
    const key = body && body.key;
    if (!validKey(key)) return json({ error: 'invalid key' }, 400, cors);
    if (await overLimit(env, request, 'view', 100)) return json({ error: 'rate limited' }, 429, cors);

    await env.DB.prepare(
        'INSERT INTO stats (key, views, likes) VALUES (?, 1, 0) '
        + 'ON CONFLICT(key) DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP'
    ).bind(key).run();
    return json(await getStats(env, key), 200, cors);
}

async function handleLike(request, env, cors) {
    const body = await request.json().catch(() => null);
    const key = body && body.key;
    if (!validKey(key)) return json({ error: 'invalid key' }, 400, cors);
    if (await overLimit(env, request, 'like', 30)) return json({ error: 'rate limited' }, 429, cors);

    await env.DB.prepare(
        'INSERT INTO stats (key, views, likes) VALUES (?, 0, 1) '
        + 'ON CONFLICT(key) DO UPDATE SET likes = likes + 1, updated_at = CURRENT_TIMESTAMP'
    ).bind(key).run();
    return json(await getStats(env, key), 200, cors);
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(env);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

        const url = new URL(request.url);
        try {
            if (request.method === 'GET' && url.pathname === '/stats') return handleStats(request, env, cors);
            if (request.method === 'POST' && url.pathname === '/view') return handleView(request, env, cors);
            if (request.method === 'POST' && url.pathname === '/like') return handleLike(request, env, cors);
            return json({ error: 'not found' }, 404, cors);
        } catch (err) {
            console.error(err);
            return json({ error: 'server error' }, 500, cors);
        }
    }
};
