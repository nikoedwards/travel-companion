// server.js - 代理服务器，转发 Coze API 请求
// 使用 Coze 官方 SDK

import 'dotenv/config';
import http from 'http';
import { CozeAPI } from '@coze/api';

const PORT = 3001;

// Coze API 配置（从环境变量读取）
const TOKEN = process.env.COZE_TOKEN;
const WORKFLOW_ID = process.env.COZE_WORKFLOW_ID || '7616752869026398250';

if (!TOKEN) {
  console.error('请设置 COZE_TOKEN 环境变量');
  process.exit(1);
}

// 创建 Coze 客户端
const apiClient = new CozeAPI({
  token: TOKEN,
  baseURL: 'https://api.coze.cn'
});

// 简单的 CORS 头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// 解析请求体
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  // 添加 CORS 头
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 只处理 POST /api/explore
  if (req.method === 'POST' && req.url === '/api/explore') {
    try {
      const body = await parseBody(req);
      const { coords } = JSON.parse(body);

      if (!coords) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '缺少坐标参数' }));
        return;
      }

      console.log('收到探索请求，坐标:', coords);

      // 使用 Coze SDK 调用工作流
      const stream = await apiClient.workflows.runs.stream({
        workflow_id: WORKFLOW_ID,
        parameters: {
          input: coords
        }
      });

      // 收集流式响应
      let resultText = '';
      let rawContent = '';

      for await (const event of stream) {
        console.log('Event:', JSON.stringify(event));

        // 处理消息事件 - SDK 使用 Message (大写 M)
        if (event.event === 'Message' && event.data) {
          // content 可能是字符串，需要提取
          if (event.data.content) {
            rawContent = event.data.content;

            // 如果 content 是 JSON 字符串，尝试解析
            try {
              const parsed = JSON.parse(rawContent);
              if (parsed.output) {
                resultText = parsed.output;
              } else if (parsed.text) {
                resultText = parsed.text;
              }
            } catch (e) {
              // 如果不是 JSON，直接使用
              resultText = rawContent;
            }
          }
        }

        // 处理完成
        if (event.event === 'Done') {
          break;
        }
      }

      console.log('最终结果:', resultText);

      if (resultText.trim()) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: resultText.trim() }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: '未获取到结果，请重试' }));
      }

    } catch (error) {
      console.error('代理服务器错误:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
});
