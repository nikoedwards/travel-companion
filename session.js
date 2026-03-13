// session.js - Session CRUD, localStorage, drawer UI
export const SessionModule = {
  appState: null,

  init(appState) {
    this.appState = appState;
    this.bindEvents();
  },

  bindEvents() {
    const newSessionBtn = document.getElementById('new-session-btn');
    newSessionBtn.addEventListener('click', () => this.createSession());
  },

  createSession() {
    const location = this.appState.get('location');
    const sessionId = 'sess_' + Date.now();

    // Generate title from location (or use default)
    let title = '新对话';
    if (location.lat && location.lng) {
      const date = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      title = `旅行 · ${date}`;
    }

    const session = {
      id: sessionId,
      title,
      created_at: Date.now(),
      messages: [],
      last_location: { lat: location.lat, lng: location.lng }
    };

    const sessions = { ...this.appState.get('sessions'), [sessionId]: session };
    this.appState.set('sessions', sessions);
    this.appState.set('activeSessionId', sessionId);

    this.renderDrawer();
    this.updateSessionTitle();

    // Dispatch event for drawer to close
    document.dispatchEvent(new CustomEvent('session-selected'));
  },

  switchSession(sessionId) {
    this.appState.set('activeSessionId', sessionId);
    this.renderDrawer();
    this.updateSessionTitle();

    // Re-render chat messages
    const ChatModule = window.ChatModule;
    if (ChatModule) ChatModule.renderMessages();

    document.dispatchEvent(new CustomEvent('session-selected'));
  },

  deleteSession(sessionId) {
    const sessions = { ...this.appState.get('sessions') };
    delete sessions[sessionId];
    this.appState.set('sessions', sessions);

    // If deleted session was active, switch to another or create new
    if (this.appState.get('activeSessionId') === sessionId) {
      const remaining = Object.keys(sessions);
      if (remaining.length > 0) {
        this.appState.set('activeSessionId', remaining[remaining.length - 1]);
        this.updateSessionTitle();
        const ChatModule = window.ChatModule;
        if (ChatModule) ChatModule.renderMessages();
      } else {
        this.appState.set('activeSessionId', null);
        this.createSession();
        return;
      }
    }

    this.renderDrawer();
  },

  renderDrawer() {
    const sessions = this.appState.get('sessions');
    const activeId = this.appState.get('activeSessionId');
    const container = document.getElementById('session-list');

    const sessionArray = Object.values(sessions).sort((a, b) => b.created_at - a.created_at);

    if (sessionArray.length === 0) {
      container.innerHTML = '<div style="padding: 16px; text-align: center; color: #5f6368;">暂无对话</div>';
      return;
    }

    container.innerHTML = sessionArray.map(session => {
      const date = new Date(session.created_at).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const isActive = session.id === activeId;
      return `
        <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
          <div class="session-item-body">
            <div class="session-item-title">${session.title}</div>
            <div class="session-item-date">${date}</div>
          </div>
          <button class="session-delete-btn" data-session-id="${session.id}" title="删除">×</button>
        </div>
      `;
    }).join('');

    // Bind click events
    container.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const sessionId = item.dataset.sessionId;
        this.switchSession(sessionId);
      });
    });

    container.querySelectorAll('.session-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSession(btn.dataset.sessionId);
      });
    });
  },

  updateSessionTitle() {
    const activeId = this.appState.get('activeSessionId');
    const sessions = this.appState.get('sessions');
    const session = sessions[activeId];

    const titleEl = document.getElementById('session-title');
    if (session) {
      titleEl.textContent = session.title;
    } else {
      titleEl.textContent = '本地耳语';
    }
  },

  getCurrentSession() {
    const activeId = this.appState.get('activeSessionId');
    const sessions = this.appState.get('sessions');
    return sessions[activeId] || null;
  },

  addMessage(message) {
    const activeId = this.appState.get('activeSessionId');
    const sessions = this.appState.get('sessions');
    const session = sessions[activeId];

    if (!session) return;

    session.messages.push(message);
    session.last_location = message.location;

    this.appState.set('sessions', { ...sessions, [activeId]: session });
  }
};
