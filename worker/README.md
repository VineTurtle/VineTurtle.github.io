# 点赞 / 阅读量 Worker（可选）

这是给 `data/meta/dynamic.json` 用的可选后端，部署在 Cloudflare Workers + D1。
不部署也不影响站点：`stats.enabled` 保持 `false` 时，前端不会发任何请求。

## 部署步骤

1. 安装 Wrangler：`npm install -g wrangler`
2. 登录：`wrangler login`
3. 创建 D1 数据库：

   ```bash
   wrangler d1 create vts-stats
   ```

   把输出的 `database_id` 填进 `wrangler.toml`。

4. 初始化表结构：

   ```bash
   wrangler d1 execute vts-stats --file=./schema.sql --remote
   ```

5. 设置 IP 哈希盐（不要提交到仓库）：

   ```bash
   wrangler secret put IP_SALT
   ```

6. 部署：

   ```bash
   wrangler deploy
   ```

7. 在 Cloudflare 控制台给 Worker 绑定自定义域名 `api.grapeleafi.top`（或直接用 `*.workers.dev`）。

8. 修改 `data/meta/dynamic.json`：

   ```json
   "stats": {
     "enabled": true,
     "apiBase": "https://api.grapeleafi.top"
   }
   ```

9. 重新生成并发布：

   ```bash
   npm run build
   npm run deploy
   ```

## 接口

- `GET /stats?key=blog:my-post` → `{ key, views, likes }`
- `POST /view` body `{ "key": "blog:my-post" }`
- `POST /like` body `{ "key": "blog:my-post" }`

限流：同一 IP 每天最多 100 次阅读计数、30 次点赞；IP 只保存哈希，用于当日限流。
