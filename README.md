# PokeFactory

本地开发（PowerShell）：先运行 `$env:PORT='3001'; go run ./backend/cmd/server`，再在另一个终端运行 `npm run dev`。前端默认将 `/api` 转发到 3001 端口。

生产部署：`docker compose up -d --build`

未安装 Docker 的 Linux 服务器可使用 `deploy/pokefactory.service` 与 `deploy/nginx-pokefactory.conf`，由 systemd 运行 Go 服务、Nginx 提供 HTTPS 入口。

Go 数据存储、版本同步和反向代理配置见 [服务器部署说明.md](./服务器部署说明.md)。
