# Travel Companion

基于 Coze API 的智能旅行助手 Web 应用。

## 在线演示

🌐 **在线访问**: https://travel-companion-three-alpha.vercel.app/

## 功能特性

- 🗣️ AI 对话 - 与 AI 助手实时交流
- 🗺️ 地图展示 - 实时位置显示与周边探索
- 🔊 语音播报 - AI 回复自动语音播放
- 📍 主动推送 - 基于位置的周边景点推荐

## 技术栈

- 前端：原生 JavaScript + Leaflet 地图
- 后端：Node.js + Coze API SDK
- 地图：Leaflet + OpenStreetMap

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
# 启动前端 (端口 3000)
npx serve .

# 启动 API 代理 (端口 3001)
npm start
```

### 3. 访问应用

打开 http://localhost:3000

## 配置说明

### 本地开发

1. 复制环境变量配置文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的 Coze API token：
```
COZE_TOKEN=你的token
COZE_WORKFLOW_ID=7616752869026398250
```

### Vercel 部署

在 Vercel 项目设置中添加环境变量：
- `COZE_TOKEN`: 你的 Coze API token
- `COZE_WORKFLOW_ID`: 工作流 ID（可选，默认 7616752869026398250）

## 项目结构

```
├── index.html      # 主页面
├── app.js         # 应用入口
├── chat.js        # 聊天模块
├── maps.js        # 地图模块
├── session.js     # 会话管理
├── passive.js     # 被动推送
├── api.js         # API 调用
├── server.js      # Node.js 代理服务器
└── style.css      # 样式文件
```

## 许可证

MIT
