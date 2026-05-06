# MusicPlayer（原 MKOnlineMusicPlayer）

基于网易云音乐 API 的在线音乐播放器，部署在 EdgeOne Pages，无需服务器。

**演示地址**：[https://music.ab.cd](https://music.ab.cd)

## 功能

- 音乐搜索、播放、下载
- 歌词同步显示
- 网易云歌单同步
- 喜欢歌单跨设备同步（KV Storage）

## 技术栈

- **前端**：HTML + CSS + JavaScript（jQuery + layui）
- **音乐代理**：Cloud Function（Node.js）— 网易云 API CORS 代理
- **喜欢同步**：Edge Function（V8）+ KV Storage

## 项目结构

```
├── index.html
├── css/
├── js/
│   ├── player.js          # 播放器配置
│   ├── ajax.js            # API 请求
│   ├── functions.js       # UI 交互 + 喜欢歌单
│   ├── lyric.js           # 歌词解析
│   └── musicList.js       # 播放列表配置
├── cloud-functions/api/
│   └── music.js           # 音乐 API 代理（Node.js）
├── edge-functions/api/
│   └── favorite.js        # 喜欢 API（KV Storage）
├── edgeone.config.json
└── package.json
```

## 部署

1. 在 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages) 创建项目
2. 连接代码仓库
3. 启用 KV Storage：创建命名空间（如 `music_kv`），绑定到项目，变量名设为 `music_kv`
4. 部署

> 不配置 KV 时，喜欢歌单仅本地存储，不影响播放。

## 本地开发

```bash
npm install -g edgeone
edgeone pages dev    # http://localhost:8088
```

## API

| 路径 | 说明 |
|------|------|
| `/api/music?action=search&name=xxx` | 搜索 |
| `/api/music?action=url&id=xxx` | 播放链接 |
| `/api/music?action=pic&id=xxx` | 封面 |
| `/api/music?action=lyric&id=xxx` | 歌词 |
| `/api/music?action=playlist&id=xxx` | 歌单 |
| `/api/music?action=userlist&uid=xxx` | 用户歌单 |
| `/api/favorite?action=get&user_id=xxx` | 获取喜欢 |
| `/api/favorite` POST `action=save` | 保存喜欢 |
| `/api/favorite` POST `action=incremental_sync` | 增量同步 |

## 更新日志

#### v3.1 `2026/5/6`
- 音乐 API 从 Edge Function 迁移到 Cloud Function（Node.js），消除 200ms CPU 限制
- 去掉 Meting 第三方依赖，直连网易云音乐 API，数据格式天然匹配
- HTTP→HTTPS 替换从服务端移到客户端，减少服务端开销
- 修复 `Object.fromEntries` V8 不兼容问题

#### v3.0 `2026/5/6`
- 从 PHP 迁移到 EdgeOne Pages
- 后端改为 Edge Functions
- 喜欢歌单从 JSON 文件迁移到 KV Storage

#### v2.44 `2019/2/16` 及更早
- 见原版 [MKOnlineMusicPlayer](https://github.com/mengkunsoft/MKOnlineMusicPlayer)

## 致谢

- [mengkun](https://mkblog.cn) — 原版开发
- [Meting](https://github.com/metowolf/Meting) — 多平台音乐 API 框架
- jQuery / layui / mCustomScrollbar / background-blur
