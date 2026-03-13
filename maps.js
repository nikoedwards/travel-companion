// maps.js - Leaflet + OpenStreetMap init, GPS tracking, marker updates
export const MapsModule = {
  appState: null,
  watchId: null,

  init(appState) {
    this.appState = appState;
    this.initMaps();
    this.startLocationTracking();
  },

  initMaps() {
    const defaultCenter = [39.9042, 116.4074]; // Beijing

    // Main map (full screen on map tab)
    const map = L.map('google-map', {
      center: defaultCenter,
      zoom: 17,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // Blue dot marker for current location
    const markerIcon = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;background:#4285F4;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker(defaultCenter, { icon: markerIcon }).addTo(map);

    this.appState.set('mapInstance', { map, marker });

    // Mini map (floating on chat tab)
    const miniMap = L.map('mini-map', {
      center: defaultCenter,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(miniMap);

    const miniMarkerIcon = L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;background:#4285F4;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    const miniMarker = L.marker(defaultCenter, { icon: miniMarkerIcon }).addTo(miniMap);

    this.appState.set('miniMapInstance', { map: miniMap, marker: miniMarker });

    // Listen to location updates
    this.appState.on('location', (location) => this.updateMapLocation(location));
  },

  startLocationTracking() {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      alert('你的浏览器不支持定位功能');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          last_updated: Date.now()
        };
        this.appState.set('location', location);
      },
      (error) => {
        console.warn('GPS error:', error);

        if (error.code === error.PERMISSION_DENIED) {
          alert('请允许访问位置信息以使用本应用');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.warn('位置信息暂时不可用');
        } else if (error.code === error.TIMEOUT) {
          console.warn('获取位置超时');
        }

        // Use mock location for testing if GPS fails
        if (!this.appState.get('location').lat) {
          console.log('Using mock location for testing');
          this.appState.set('location', {
            lat: 39.9042,
            lng: 116.4074,
            accuracy: 100,
            last_updated: Date.now()
          });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  },

  updateMapLocation(location) {
    if (!location.lat || !location.lng) return;

    const pos = [location.lat, location.lng];

    // Update main map
    const mapInstance = this.appState.get('mapInstance');
    if (mapInstance && mapInstance.map) {
      mapInstance.marker.setLatLng(pos);
      mapInstance.map.panTo(pos);
    }

    // Update mini map
    const miniMapInstance = this.appState.get('miniMapInstance');
    if (miniMapInstance && miniMapInstance.map) {
      miniMapInstance.marker.setLatLng(pos);
      miniMapInstance.map.setView(pos);
    }
  },

  stopLocationTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
};
