import { Platform } from 'react-native';
import { FloodAlert, DistributedPacket } from '@/types/alert';

const getWsBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.port) {
      // Modo desenvolvimento: usa a porta do backend explicitamente
      return `${protocol}//${window.location.hostname}:3001/ws`;
    }
    return `${protocol}//${window.location.hostname}/ws`;
  }
  return 'ws://localhost:3001/ws';
};

export type SocketStatus = 'connected' | 'connecting' | 'disconnected';

type AlertCallback = (payload: { alert: FloodAlert; distanceMeters?: number; distanceText?: string; isNearby: boolean }) => void;
type AlertResolvedCallback = (payload: { alert: FloodAlert; resolvedAt?: string; resolvedBy?: string }) => void;
type AlertConfirmedCallback = (payload: { alertId: string; confirmations: number }) => void;
type TopologyCallback = (payload: { activeNodesCount: number; nodes: any[]; recentPackets: DistributedPacket[] }) => void;
type StatusCallback = (status: SocketStatus) => void;

class DistributedSocketClient {
  private socket: WebSocket | null = null;
  private status: SocketStatus = 'disconnected';
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private deviceId: string = `node_${Math.random().toString(36).substring(2, 9)}`;
  private deviceName: string = '📱 Dispositivo Móvel';
  private currentLat: number | null = null;
  private currentLng: number | null = null;
  private pushToken: string | null = null;

  private onAlertListeners: Set<AlertCallback> = new Set();
  private onResolvedListeners: Set<AlertResolvedCallback> = new Set();
  private onConfirmedListeners: Set<AlertConfirmedCallback> = new Set();
  private onTopologyListeners: Set<TopologyCallback> = new Set();
  private onStatusListeners: Set<StatusCallback> = new Set();

  constructor() {
    this.deviceId = `node_${Math.random().toString(36).substring(2, 8)}`;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public setPushToken(token: string | null) {
    this.pushToken = token;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendRegistration();
    }
  }

  public getStatus(): SocketStatus {
    return this.status;
  }

  public connect(name?: string, lat?: number, lng?: number) {
    if (name) this.deviceName = name;
    if (lat !== undefined) this.currentLat = lat;
    if (lng !== undefined) this.currentLng = lng;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      const url = getWsBaseUrl();
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.setStatus('connected');
        this.sendRegistration();
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (e) {
          console.warn('[WS Client] Mensagem não é JSON válido:', event.data);
        }
      };

      this.socket.onclose = () => {
        this.setStatus('disconnected');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('[WS Client] Erro no socket:', err);
        this.setStatus('disconnected');
      };
    } catch (e) {
      console.warn('[WS Client] Falha ao instanciar WebSocket:', e);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  public updateLocation(lat: number, lng: number) {
    this.currentLat = lat;
    this.currentLng = lng;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'LOCATION_UPDATE',
          timestamp: new Date().toISOString(),
          payload: { latitude: lat, longitude: lng },
        })
      );
    }
  }

  private sendRegistration() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'CLIENT_REGISTER',
          timestamp: new Date().toISOString(),
          payload: {
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            latitude: this.currentLat,
            longitude: this.currentLng,
            pushToken: this.pushToken || undefined,
          },
        })
      );
    }
  }

  private handleIncomingMessage(msg: any) {
    switch (msg.type) {
      case 'ALERT_BROADCAST':
        for (const cb of this.onAlertListeners) cb(msg.payload);
        break;
      case 'ALERT_RESOLVED':
        for (const cb of this.onResolvedListeners) cb(msg.payload);
        break;
      case 'ALERT_CONFIRMED':
        for (const cb of this.onConfirmedListeners) cb(msg.payload);
        break;
      case 'TOPOLOGY_UPDATE':
        for (const cb of this.onTopologyListeners) cb(msg.payload);
        break;
      case 'DISTRIBUTED_PONG':
        // Heartbeat ok
        break;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: 'DISTRIBUTED_PING',
            timestamp: new Date().toISOString(),
            payload: { deviceId: this.deviceId },
          })
        );
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  private setStatus(s: SocketStatus) {
    this.status = s;
    for (const cb of this.onStatusListeners) cb(s);
  }

  public subscribeAlerts(cb: AlertCallback) {
    this.onAlertListeners.add(cb);
    return () => this.onAlertListeners.delete(cb);
  }

  public subscribeResolved(cb: AlertResolvedCallback) {
    this.onResolvedListeners.add(cb);
    return () => this.onResolvedListeners.delete(cb);
  }

  public subscribeConfirmed(cb: AlertConfirmedCallback) {
    this.onConfirmedListeners.add(cb);
    return () => this.onConfirmedListeners.delete(cb);
  }

  public subscribeTopology(cb: TopologyCallback) {
    this.onTopologyListeners.add(cb);
    return () => this.onTopologyListeners.delete(cb);
  }

  public subscribeStatus(cb: StatusCallback) {
    this.onStatusListeners.add(cb);
    return () => this.onStatusListeners.delete(cb);
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }
}

export const socketService = new DistributedSocketClient();
