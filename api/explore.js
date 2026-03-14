// api/explore.js - Vercel API route for exploring nearby
import { CozeAPI } from '@coze/api';

const TOKEN = process.env.COZE_TOKEN || 'cztei_hGETAGqOiPeG3BhAws2GJgUCtGsnW8ZfaJHRML8pvCfKoJ6NeVvh63Wu38L4fXPTp';
const WORKFLOW_ID = process.env.COZE_WORKFLOW_ID || '7616752869026398250';

const apiClient = new CozeAPI({
  token: TOKEN,
  baseURL: 'https://api.coze.cn'
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  try {
    const { coords } = req.body;

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

      if (event.event === 'Message' && event.data) {
        if (event.data.content) {
          rawContent = event.data.content;

          try {
            const parsed = JSON.parse(rawContent);
            if (parsed.output) {
              resultText = parsed.output;
            } else if (parsed.text) {
              resultText = parsed.text;
            }
          } catch (e) {
            resultText = rawContent;
          }
        }
      }

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
}
