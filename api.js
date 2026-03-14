// api.js - API layer for Coze API

export const API = {
  /**
   * Send user message to Coze workflow
   * @param {Object} params
   * @param {string} params.message - User message
   * @param {Object} params.location - {lat, lng}
   * @param {string} params.session_id - Session ID
   * @param {Array} params.history - Recent messages for context
   * @returns {Promise<{reply: string}>}
   */
  async chatSend({ message, location }) {
    // Call Coze API via local proxy
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        location: { lat: location.lat, lng: location.lng }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `API error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Passive location scan - call Coze explore API
   * @param {Object} params
   * @param {Object} params.location - {lat, lng}
   * @param {string} params.session_id - Session ID
   * @param {number} params.last_push_time - Timestamp of last push
   * @returns {Promise<{should_push: boolean, message?: string}>}
   */
  async passiveScan({ location }) {
    // Call Coze explore API
    const response = await fetch('http://localhost:3001/api/explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coords: `(${location.lat}, ${location.lng})` })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      should_push: true,
      message: data.result
    };
  }
};
