// passive.js - Adaptive scan timer, passive message injection
import { API } from './api.js';
import { SessionModule } from './session.js';

export const PassiveScanner = {
  appState: null,
  timer: null,
  baseInterval: 60000,      // 1 minute default
  minInterval: 20000,       // 20 seconds in dense areas
  maxInterval: 300000,      // 5 minutes in empty areas
  isRunning: false,

  init(appState) {
    this.appState = appState;
  },

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    const scanConfig = this.appState.get('passiveScan');

    console.log('🔍 Passive scanner started');
    this.schedule(scanConfig.interval_ms || this.baseInterval);
  },

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🔍 Passive scanner stopped');
  },

  schedule(ms) {
    this.timer = setTimeout(() => this.tick(), ms);
  },

  async tick() {
    const location = this.appState.get('location');

    // Skip if no location yet
    if (!location.lat || !location.lng) {
      console.log('⏭️ Passive scan skipped: no location');
      this.schedule(this.baseInterval);
      return;
    }

    const session = SessionModule.getCurrentSession();
    if (!session) {
      console.log('⏭️ Passive scan skipped: no active session');
      this.schedule(this.baseInterval);
      return;
    }

    const scanConfig = this.appState.get('passiveScan');

    try {
      console.log('🔍 Passive scan triggered');

      const result = await API.passiveScan({
        location: { lat: location.lat, lng: location.lng },
        session_id: session.id,
        last_push_time: scanConfig.last_push_time
      });

      if (result.should_push && result.message) {
        console.log('✅ Passive push:', result.message.slice(0, 50) + '...');

        // Inject message via ChatModule
        const ChatModule = window.ChatModule;
        if (ChatModule) {
          ChatModule.injectPassiveMessage(result.message);
        }

        // Update scan config: got a hit, scan faster
        this.appState.set('passiveScan', {
          enabled: true,
          last_push_time: Date.now(),
          interval_ms: this.minInterval
        });

        this.schedule(this.minInterval);

      } else {
        console.log('⏭️ No push needed, backing off');

        // No push: slow down
        const currentInterval = scanConfig.interval_ms || this.baseInterval;
        const nextInterval = Math.min(currentInterval * 1.5, this.maxInterval);

        this.appState.set('passiveScan', {
          ...scanConfig,
          interval_ms: nextInterval
        });

        this.schedule(nextInterval);
      }

    } catch (error) {
      console.error('❌ Passive scan error:', error);

      // On error, retry with base interval
      this.schedule(this.baseInterval);
    }
  }
};
