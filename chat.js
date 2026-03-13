// chat.js - Chat UI, message rendering, input handling
import { SessionModule } from './session.js';
import { API } from './api.js';

export const ChatModule = {
  appState: null,
  isProcessing: false,

  init(appState) {
    this.appState = appState;
    this.bindEvents();

    // Listen to session changes
    appState.on('activeSessionId', () => this.renderMessages());
    appState.on('sessions', () => this.renderMessages());

    // Expose globally for other modules
    window.ChatModule = this;
  },

  bindEvents() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    sendBtn.addEventListener('click', () => this.sendMessage());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });
  },

  async sendMessage() {
    if (this.isProcessing) return;

    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (!message) return;

    const location = this.appState.get('location');
    if (!location.lat || !location.lng) {
      alert('正在获取位置信息，请稍候...');
      return;
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Add user message
    const userMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
      location: { lat: location.lat, lng: location.lng },
      source: 'active'
    };

    SessionModule.addMessage(userMessage);
    this.renderMessages();
    this.scrollToBottom();

    // Show loading
    this.isProcessing = true;
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中...';

    try {
      // Get recent history for context
      const session = SessionModule.getCurrentSession();
      const history = session.messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call API
      const response = await API.chatSend({
        message,
        location: { lat: location.lat, lng: location.lng },
        session_id: session.id,
        history
      });

      // Add assistant message
      const assistantMessage = {
        id: 'msg_' + Date.now(),
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        location: { lat: location.lat, lng: location.lng },
        source: 'active'
      };

      SessionModule.addMessage(assistantMessage);
      this.renderMessages();
      this.scrollToBottom();

    } catch (error) {
      console.error('Failed to send message:', error);
      alert('发送失败，请重试');
    } finally {
      this.isProcessing = false;
      sendBtn.disabled = false;
      sendBtn.textContent = '发送';
    }
  },

  injectPassiveMessage(content) {
    const location = this.appState.get('location');

    const message = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      location: { lat: location.lat, lng: location.lng },
      source: 'passive'
    };

    SessionModule.addMessage(message);
    this.renderMessages();
    this.scrollToBottom();

    // 自动播放语音
    this.speak(content);

    // Update AI bubble on map page
    this.updateAIBubble(content);
  },

  renderMessages() {
    const session = SessionModule.getCurrentSession();
    if (!session) return;

    const container = document.getElementById('message-list');

    if (session.messages.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #5f6368; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">👋</div>
          <div style="font-size: 16px; margin-bottom: 8px;">你好！我是你的本地向导</div>
          <div style="font-size: 14px;">问我关于周围的任何事情，或者让我主动告诉你有趣的地方</div>
        </div>
      `;
      return;
    }

    container.innerHTML = session.messages.map((msg, index) => {
      const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const passiveBadge = msg.source === 'passive' ? '<span class="passive-badge">主动推送</span>' : '';

      // 只有助手消息才显示喇叭按钮
      const speakerBtn = msg.role === 'assistant'
        ? `<button class="msg-speaker-btn" data-index="${index}" title="播放语音">🔊</button>`
        : '';

      return `
        <div class="message ${msg.role}">
          <div class="message-bubble">
            ${this.escapeHtml(msg.content)}
            <div class="message-meta">
              ${passiveBadge}
              ${speakerBtn}
              <span>${time}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 绑定喇叭按钮点击事件
    container.querySelectorAll('.msg-speaker-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const msg = session.messages[index];
        this.speakWithHighlight(msg.content, e.target);
      });
    });
  },

  scrollToBottom() {
    const container = document.getElementById('message-list');
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
  },

  updateAIBubble(content) {
    const bubble = document.getElementById('ai-bubble');
    const bubbleContent = bubble.querySelector('.bubble-content');
    const closeBtn = bubble.querySelector('.bubble-close');

    bubbleContent.textContent = content;
    bubble.classList.remove('hidden');

    // Auto-hide after 10 seconds
    setTimeout(() => {
      bubble.classList.add('hidden');
    }, 10000);

    // Close button
    closeBtn.onclick = () => bubble.classList.add('hidden');
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  },

  // 语音播放
  speak(text) {
    // 停止当前播放
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  },

  // 语音播放并高亮按钮
  speakWithHighlight(text, btnElement) {
    // 停止当前播放
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    // 高亮按钮
    if (btnElement) {
      btnElement.classList.add('playing');
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (btnElement) {
        btnElement.classList.remove('playing');
      }
    };

    utterance.onerror = () => {
      if (btnElement) {
        btnElement.classList.remove('playing');
      }
    };

    window.speechSynthesis.speak(utterance);
  }
};
