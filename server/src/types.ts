import { WebSocket } from 'ws';

export type SeverityLevel = 'low' | 'moderate' | 'high' | 'critical';
export type AlertStatus = 'active' | 'resolved';

export interface FloodAlert {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  severity: SeverityLevel;
  waterLevel: string;
  cause: string;
  status: AlertStatus;
  reportedBy: string;
  confirmations: number;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  distanceMeters?: number; // Preenchido dinamicamente de acordo com o nó receptor
}

export interface CreateAlertDTO {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  severity?: SeverityLevel;
  waterLevel?: string;
  cause?: string;
  reportedBy?: string;
}

export interface ResolveAlertDTO {
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface ClientNode {
  ws: WebSocket;
  deviceId: string;
  deviceName: string;
  latitude: number | null;
  longitude: number | null;
  pushToken?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

export type DistributedMessageType =
  | 'CLIENT_REGISTER'
  | 'CLIENT_REGISTERED'
  | 'LOCATION_UPDATE'
  | 'NEW_ALERT'
  | 'ALERT_BROADCAST'
  | 'ALERT_RESOLVED'
  | 'ALERT_CONFIRMED'
  | 'TOPOLOGY_UPDATE'
  | 'DISTRIBUTED_PING'
  | 'DISTRIBUTED_PONG'
  | 'SIMULATE_PACKET';

export interface DistributedMessage<T = unknown> {
  type: DistributedMessageType;
  timestamp: string;
  originNode?: string;
  targetNode?: string;
  payload: T;
}

export interface AlertBroadcastPayload {
  alert: FloodAlert;
  distanceMeters?: number;
  distanceText?: string;
  isNearby: boolean;
  distributedHopCount: number;
}
