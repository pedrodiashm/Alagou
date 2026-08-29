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
  distanceMeters?: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string;
}

export interface CreateAlertInput {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  severity: SeverityLevel;
  waterLevel: string;
  cause: string;
  reportedBy?: string;
  deviceId?: string;
}

export interface SystemStats {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
  isDatabaseActive: boolean;
}

export interface DistributedPacket {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  destination: string;
  distanceInfo?: string;
  summary: string;
  status: 'sent' | 'received' | 'routed';
}
