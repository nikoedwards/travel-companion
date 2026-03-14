// passive.js - Adaptive scan timer, passive message injection
import { API } from './api.js';
import { SessionModule } from './session.js';

export const PassiveScanner = {
  appState: null,
  timer: null,
  isRunning: false,

  // 动态参数
  currentInterval: 30000,    // 当前间隔 (ms)
  minInterval: 30000,         // 最小间隔 30s (高密度区域)
  maxInterval: 300000,       // 最大间隔 5min (低密度/静止)

  // 移动检测
  lastLocation: null,
  lastLocationTime: null,
  stationaryThreshold: 100,   // 100m 内视为静止

  // 用户反馈调整
  feedbackMultiplier: 1.0,    // 用户反馈倍数
  lastPushTime: null,
  consecutiveNoPush: 0,      // 连续未推送次数

  init(appState) {
    this.appState = appState;
  },

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentInterval = 30000; // 重置为默认 30s
    this.feedbackMultiplier = 1.0;
    this.consecutiveNoPush = 0;

    console.log('🔍 陪伴模式已开启');

    // 立即触发一次扫描，不等待
    this.tick();
  },

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🔍 陪伴模式已关闭');
  },

  schedule(ms) {
    // 应用用户反馈调整
    const adjustedMs = ms * this.feedbackMultiplier;
    const adjustedSec = Math.round(adjustedMs / 1000);
    const originalSec = Math.round(ms / 1000);
    const note = this.feedbackMultiplier !== 1.0 ? ` (反馈调整 x${this.feedbackMultiplier.toFixed(1)})` : '';
    console.log(`⏱️ 下次扫描: ${adjustedSec}秒后${note}`);
    this.timer = setTimeout(() => this.tick(), adjustedMs);
  },

  // 分析用户反馈并调整频率
  analyzeFeedback(userMessage) {
    const msg = userMessage.toLowerCase();

    // 用户觉得太频繁
    const frequentPatterns = [
      '不用说太多', '太频繁了', '少说点', '安静点',
      '别总说', '少打扰', '不要一直说', '太吵了'
    ];

    // 用户觉得太少
    const rarePatterns = [
      '多说点', '多告诉我', '多说一些', '可以多说点',
      '怎么不说话', '可以活跃点'
    ];

    for (const pattern of frequentPatterns) {
      if (msg.includes(pattern)) {
        this.feedbackMultiplier = Math.min(this.feedbackMultiplier * 1.5, 5);
        console.log('📉 用户反馈: 太频繁，调整间隔 x1.5');
        return;
      }
    }

    for (const pattern of rarePatterns) {
      if (msg.includes(pattern)) {
        this.feedbackMultiplier = Math.max(this.feedbackMultiplier * 0.6, 0.3);
        console.log('📈 用户反馈: 太少，调整间隔 x0.6');
        return;
      }
    }
  },

  // 检测用户是否在移动
  isStationary() {
    const currentLoc = this.appState.get('location');
    if (!currentLoc || !this.lastLocation) return false;

    // 计算距离
    const distance = this.calculateDistance(
      this.lastLocation.lat, this.lastLocation.lng,
      currentLoc.lat, currentLoc.lng
    );

    // 如果是模拟位置，使用模拟的速度来判断
    if (currentLoc.isSimulated) {
      // CityWalk 模拟时，每秒移动距离约等于速度
      // 如果速度 > 0.1 m/s 则视为移动
      return currentLoc.speed < 0.1;
    }

    // 真实 GPS：检查 2 分钟内移动距离
    const timeDiff = (Date.now() - this.lastLocationTime) / 1000 / 60; // 分钟
    if (timeDiff < 2) return false; // 时间太短不判断

    return distance < this.stationaryThreshold;
  },

  // Haversine 公式计算距离 (米)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球半径 (米)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  // 打印当前状态参数
  logStatus(action, detail = '') {
    const location = this.appState.get('location');
    const timeSinceLastPush = this.lastPushTime ? Math.round((Date.now() - this.lastPushTime) / 1000) : -1;
    const distance = this.lastLocation && location
      ? Math.round(this.calculateDistance(this.lastLocation.lat, this.lastLocation.lng, location.lat, location.lng))
      : 0;

    console.log('%c📊 陪伴模式状态', 'color: #4CAF50; font-weight: bold');
    console.log(`   ▶️ 动作: ${action}`);
    console.log(`   ⏱️ 间隔: ${Math.round(this.currentInterval/1000)}s (min:${this.minInterval/1000}s max:${this.maxInterval/1000}s)`);
    console.log(`   🎯 反馈倍数: x${this.feedbackMultiplier.toFixed(2)} | 连续未推送: ${this.consecutiveNoPush}`);
    console.log(`   🕐 上次推送: ${timeSinceLastPush > 0 ? timeSinceLastPush + 's前' : '无'}`);
    console.log(`   📍 移动距离: ${distance}m`);
    if (detail) console.log(`   💡 ${detail}`);
  },

  async tick() {
    const location = this.appState.get('location');

    // Skip if no location yet
    if (!location.lat || !location.lng) {
      this.logStatus('跳过', '无位置信息');
      this.schedule(this.currentInterval);
      return;
    }

    // 检测静止状态
    if (this.isStationary()) {
      // 静止时大幅增加间隔
      this.currentInterval = Math.min(this.currentInterval * 2, this.maxInterval);
      this.consecutiveNoPush++;

      // 连续静止 3 次不推送，考虑停止
      if (this.consecutiveNoPush >= 3) {
        this.logStatus('休眠', '💤 用户长时间静止，进入休眠');
        this.currentInterval = this.maxInterval;
      } else {
        this.logStatus('跳过', '用户静止，增加间隔');
      }

      this.updateLastLocation(location);
      this.schedule(this.currentInterval);
      return;
    }

    // 恢复移动后，重置连续未推送计数
    this.consecutiveNoPush = 0;

    // 检查是否有活跃会话
    const session = SessionModule.getCurrentSession();
    if (!session) {
      this.logStatus('跳过', '无活跃会话');
      this.schedule(this.currentInterval);
      return;
    }

    // 检查距离上次推送是否太近 (避免重复) - 首次扫描不检查
    if (this.lastPushTime) {
      const timeSinceLastPush = Date.now() - this.lastPushTime;
      if (timeSinceLastPush < 30000) {
        this.logStatus('跳过', `距离上次推送太近 (${Math.round(timeSinceLastPush/1000)}s < 30s)`);
        this.schedule(this.currentInterval);
        return;
      }
    }

    this.logStatus('扫描中', `位置: (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`);

    try {
      console.log('🔄 正在调用 API...');
      const result = await API.passiveScan({
        location: { lat: location.lat, lng: location.lng }
      });
      console.log('📥 API 返回:', result);

      if (result.should_push && result.message) {
        console.log(`%c✅ 推送成功: ${result.message.slice(0, 30)}...`, 'color: #2196F3');

        // 注入消息
        const ChatModule = window.ChatModule;
        if (ChatModule) {
          ChatModule.injectPassiveMessage(result.message);
        }

        this.lastPushTime = Date.now();
        this.updateLastLocation(location);

        // 有推送时，可以更频繁扫描
        this.currentInterval = Math.max(this.currentInterval * 0.7, this.minInterval);

        this.schedule(this.currentInterval);

      } else {
        this.logStatus('无推送', 'API 返回无需推送');

        // 无推送时，降低频率
        this.currentInterval = Math.min(this.currentInterval * 1.3, this.maxInterval);

        this.updateLastLocation(location);
        this.schedule(this.currentInterval);
      }

    } catch (error) {
      console.error('❌ 陪伴模式 API 错误:', error.message);
      this.schedule(this.currentInterval);
    }
  },

  updateLastLocation(location) {
    this.lastLocation = {
      lat: location.lat,
      lng: location.lng
    };
    this.lastLocationTime = Date.now();
  }
};
