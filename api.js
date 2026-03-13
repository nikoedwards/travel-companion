// api.js - API layer (mock + Dify stubs)
const USE_MOCK = true;

// Mock delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Mock POI data for demo
const MOCK_POIS = [
  { name: '故宫博物院', note: '明清两代的皇家宫殿，建于1420年' },
  { name: '南锣鼓巷', note: '北京最古老的街区之一，有700多年历史' },
  { name: '景山公园', note: '明朝崇祯皇帝自缢的地方，可俯瞰故宫全景' },
  { name: '北海公园', note: '中国现存最古老、最完整的皇家园林之一' },
  { name: '什刹海', note: '老北京风貌保存最完好的地方，酒吧街聚集地' }
];

export const API = {
  /**
   * Send user message to backend
   * @param {Object} params
   * @param {string} params.message - User message
   * @param {Object} params.location - {lat, lng}
   * @param {string} params.session_id - Session ID
   * @param {Array} params.history - Recent messages for context
   * @returns {Promise<{reply: string, poi_highlights: Array}>}
   */
  async chatSend({ message, location, session_id, history }) {
    if (USE_MOCK) {
      await delay(800 + Math.random() * 400);

      const randomPoi = MOCK_POIS[Math.floor(Math.random() * MOCK_POIS.length)];

      return {
        reply: `关于"${message.slice(0, 20)}${message.length > 20 ? '...' : ''}"：\n\n这是一个很有意思的问题！根据你当前的位置，附近有${randomPoi.name}。${randomPoi.note}。\n\n你想了解更多关于这个地方的信息吗？`,
        poi_highlights: [
          { name: randomPoi.name, distance_m: Math.floor(Math.random() * 500) + 100, note: randomPoi.note }
        ]
      };
    }

    // Real Dify API call
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, location, session_id, history })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Passive location scan - backend decides whether to push
   * @param {Object} params
   * @param {Object} params.location - {lat, lng}
   * @param {string} params.session_id - Session ID
   * @param {number} params.last_push_time - Timestamp of last push
   * @returns {Promise<{should_push: boolean, message?: string}>}
   */
  async passiveScan({ location, session_id, last_push_time }) {
    if (USE_MOCK) {
      await delay(300 + Math.random() * 200);

      // 30% chance of pushing something
      const should_push = Math.random() < 0.3;

      if (should_push) {
        const randomPoi = MOCK_POIS[Math.floor(Math.random() * MOCK_POIS.length)];
        const messages = [
          `你刚经过了${randomPoi.name}，${randomPoi.note}。`,
          `注意看你右手边，那是${randomPoi.name}。${randomPoi.note}。`,
          `有意思的是，${randomPoi.name}就在附近。${randomPoi.note}。`,
          `别错过了！${randomPoi.name}值得一看。${randomPoi.note}。`
        ];

        return {
          should_push: true,
          message: messages[Math.floor(Math.random() * messages.length)]
        };
      }

      return { should_push: false };
    }

    // Real Dify API call
    const response = await fetch('/api/passive-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, session_id, last_push_time })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  }
};
