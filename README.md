# Fruit Ninja 联机对战版

多人联机切水果游戏：注册登录、创建/加入房间、60 秒限时比赛、实时排名、全局排行榜、背景音乐与音效。

## 技术栈

- 前端: HTML + CSS + Canvas + Socket.IO 客户端
- 后端: Node.js + Express + Socket.IO
- 数据: JSON 文件存储 (`data/users.json`，自动创建)
- 音频: Web Audio API 实时合成（无需音频文件）

## 本地运行

需要 Node.js ≥ 18：

```bash
npm install
npm start
```

浏览器打开 http://localhost:3000

## 部署到互联网测试环境 (Render 免费版)

1. 将本目录推送到 GitHub 仓库：
   ```bash
   git remote add origin <你的仓库地址>
   git add .
   git commit -m "fruit ninja multiplayer"
   git push -u origin master
   ```
2. 打开 https://render.com 注册并登录（GitHub 授权）。
3. 点击 **New +** → **Blueprint**，选择你的 GitHub 仓库。
4. Render 会读取 `render.yaml` 自动创建 Web 服务，等待部署完成（约 2-3 分钟）。
5. 部署完成后获得公网地址，如 `https://fruit-ninja-xxxx.onrender.com`，发给朋友即可联机对战。

> 注：Render 免费版磁盘是临时的，服务重启后注册数据会清空；生产环境建议将 `data/users.json` 换成数据库。
