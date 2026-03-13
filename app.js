// app.js - AppState singleton, tab switching, bootstrap
import { SessionModule } from './session.js';
import { ChatModule } from './chat.js';
import { MapsModule } from './maps.js';
import { PassiveScanner } from './passive.js';

// ─── AppState ────────────────────────────────────────────────────────────────
const AppState = {
  _data: {
    currentTab: 'chat',
    activeSessionId: null,
    sessions: {},
    location: { lat: null, lng: null, accuracy: null, last_updated: null },
    mapInstance: null,
    miniMapInstance: null,
    passiveScan: { enabled: true, last_push_time: null, interval_ms: 60000 }
  },
  _listeners: {},

  get(key) {
    return this._data[key];
  },

  set(key, value) {
    this._data[key] = value;
    this._emit(key, value);
    if (key === 'sessions' || key === 'activeSessionId') {
      this._persist();
    }
  },

  on(key, fn) {
    (this._listeners[key] ??= []).push(fn);
  },

  _emit(key, value) {
    (this._listeners[key] ?? []).forEach(fn => fn(value));
  },

  _persist() {
    try {
      localStorage.setItem('app_state', JSON.stringify({
        sessions: this._data.sessions,
        activeSessionId: this._data.activeSessionId
      }));
    } catch (e) {
      console.warn('Failed to persist state:', e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem('app_state');
      if (saved) {
        const { sessions, activeSessionId } = JSON.parse(saved);
        this._data.sessions = sessions || {};
        this._data.activeSessionId = activeSessionId || null;
      }
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
  }
};

// ─── Tab Switching ────────────────────────────────────────────────────────────
function initTabs() {
  const chatBtn = document.getElementById('tab-btn-chat');
  const mapBtn = document.getElementById('tab-btn-map');
  const chatTab = document.getElementById('tab-chat');
  const mapTab = document.getElementById('tab-map');

  function switchTab(tab) {
    if (tab === 'chat') {
      chatTab.classList.add('active');
      mapTab.classList.remove('active');
      chatBtn.classList.add('active');
      mapBtn.classList.remove('active');
    } else {
      mapTab.classList.add('active');
      chatTab.classList.remove('active');
      mapBtn.classList.add('active');
      chatBtn.classList.remove('active');
      // Trigger map resize when switching to map tab
      const { map } = AppState.get('mapInstance') ?? {};
      if (map) map.invalidateSize();
    }
    AppState.set('currentTab', tab);
  }

  chatBtn.addEventListener('click', () => switchTab('chat'));
  mapBtn.addEventListener('click', () => switchTab('map'));
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function initDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawer-overlay');
  const menuBtn = document.getElementById('menu-btn');

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('visible');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
  }

  menuBtn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Close drawer when a session is selected
  document.addEventListener('session-selected', closeDrawer);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  // Load persisted state
  AppState.load();

  // Init UI
  initTabs();
  initDrawer();

  // Init modules
  SessionModule.init(AppState);
  ChatModule.init(AppState);
  MapsModule.init(AppState);
  PassiveScanner.init(AppState);

  // Create initial session if none exists
  if (!AppState.get('activeSessionId') || Object.keys(AppState.get('sessions')).length === 0) {
    SessionModule.createSession();
  } else {
    SessionModule.renderDrawer();
    ChatModule.renderMessages();
  }

  // Start passive scanner
  PassiveScanner.start();
}

// ─── Debug Console ────────────────────────────────────────────────────────────
function initDebugConsole(appState) {
  let lastUpdateTime = null;
  let elapsedTimer = null;

  function updateElapsed() {
    if (!lastUpdateTime) return;
    const sec = Math.floor((Date.now() - lastUpdateTime) / 1000);
    document.getElementById('dbg-elapsed').textContent = `${sec}s 前`;
  }

  appState.on('location', (loc) => {
    lastUpdateTime = loc.last_updated || null;

    const coords = (loc.lat && loc.lng)
      ? `(${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)})`
      : '—';
    document.getElementById('dbg-coords').textContent = coords;
    document.getElementById('dbg-acc').textContent = loc.accuracy ? `±${Math.round(loc.accuracy)}m` : '—';
    document.getElementById('dbg-time').textContent = loc.last_updated
      ? new Date(loc.last_updated).toLocaleTimeString()
      : '—';
    updateElapsed();

    if (!elapsedTimer) {
      elapsedTimer = setInterval(updateElapsed, 1000);
    }
  });

  // Passive scan toggle
  const toggleBtn = document.getElementById('passive-toggle-btn');
  toggleBtn.addEventListener('click', () => {
    const isOn = toggleBtn.classList.contains('on');
    if (isOn) {
      window.PassiveScanner.stop();
      toggleBtn.textContent = '推送 关';
      toggleBtn.classList.remove('on');
      toggleBtn.classList.add('off');
    } else {
      window.PassiveScanner.start();
      toggleBtn.textContent = '推送 开';
      toggleBtn.classList.remove('off');
      toggleBtn.classList.add('on');
    }
  });

  // ─── Draggable Console ─────────────────────────────────────────────────────
  const consoleEl = document.getElementById('debug-console');
  const dragHandle = consoleEl.querySelector('.debug-drag-handle');
  const debugToggleBtn = document.getElementById('debug-toggle-btn');
  const debugContent = consoleEl.querySelector('.debug-content');

  let isDragging = false;
  let startX, startY, consoleX, consoleY;

  // 拖拽功能
  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target === debugToggleBtn) return; // 点击按钮时不拖拽
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = consoleEl.getBoundingClientRect();
    consoleX = rect.left;
    consoleY = rect.top;
    dragHandle.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    consoleEl.style.left = `${consoleX + dx}px`;
    consoleEl.style.top = `${consoleY + dy}px`;
    consoleEl.style.right = 'auto'; // 清除 right 定位
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dragHandle.style.cursor = 'move';
    }
  });

  // 触摸设备支持
  dragHandle.addEventListener('touchstart', (e) => {
    if (e.target === debugToggleBtn) return;
    isDragging = true;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    const rect = consoleEl.getBoundingClientRect();
    consoleX = rect.left;
    consoleY = rect.top;
    e.preventDefault();
  });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    consoleEl.style.left = `${consoleX + dx}px`;
    consoleEl.style.top = `${consoleY + dy}px`;
    consoleEl.style.right = 'auto';
  });

  document.addEventListener('touchend', () => {
    isDragging = false;
  });

  // 折叠/展开功能
  debugToggleBtn.addEventListener('click', () => {
    const isOn = debugToggleBtn.classList.contains('on');
    if (isOn) {
      debugContent.classList.add('collapsed');
      debugToggleBtn.classList.remove('on');
      debugToggleBtn.classList.add('off');
      debugToggleBtn.textContent = '○';
    } else {
      debugContent.classList.remove('collapsed');
      debugToggleBtn.classList.remove('off');
      debugToggleBtn.classList.add('on');
      debugToggleBtn.textContent = '●';
    }
  });

  // ─── 探索周围功能 ─────────────────────────────────────────────────────
  const exploreBtn = document.getElementById('explore-btn');

  exploreBtn.addEventListener('click', async () => {
    const location = appState.get('location');
    if (!location.lat || !location.lng) {
      alert('正在获取位置信息，请稍候...');
      return;
    }

    // 检查是否有 ChatModule
    if (!window.ChatModule) {
      console.error('ChatModule not found');
      return;
    }

    // 禁用按钮，显示加载状态
    exploreBtn.disabled = true;
    exploreBtn.classList.add('loading');
    exploreBtn.textContent = '探索中...';

    try {
      const coords = `(${location.lat}, ${location.lng})`;
      console.log('探索坐标:', coords);

      // 调用本地代理服务器
      const response = await fetch('http://localhost:3001/api/explore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coords })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(`API error: ${response.status} - ${errorData.error}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      let resultText = data.result || '';

      // 清理结果文本
      resultText = resultText.trim();

      if (resultText) {
        // 注入消息到对话
        window.ChatModule.injectPassiveMessage(resultText);
      } else {
        alert('未能获取到景点信息，请重试');
      }

    } catch (error) {
      console.error('探索失败:', error);
      alert('探索失败: ' + error.message);
    } finally {
      // 恢复按钮状态
      exploreBtn.disabled = false;
      exploreBtn.classList.remove('loading');
      exploreBtn.textContent = '🔍 探索周围';
    }
  });
}

window.AppState = AppState;
window.PassiveScanner = PassiveScanner;
document.addEventListener('DOMContentLoaded', () => {
  init();
  initDebugConsole(AppState);
});
