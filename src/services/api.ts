import { FloodAlert, CreateAlertInput, SystemStats } from '@/types/alert';
import { Platform } from 'react-native';

export const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    // Requisições na web são relativas à mesma origem (servidas via Nginx)
    // evita problemas de CORS quando publicado na AWS sem domínio
    if (window.location.port) {
      // Modo desenvolvimento: usa a porta do backend explicitamente
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return '';
  }
  return 'http://localhost:3001';
};

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
};

export async function fetchAlerts(params?: {
  status?: string;
  severity?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
}): Promise<FloodAlert[]> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.severity) query.append('severity', params.severity);
  if (params?.lat !== undefined) query.append('lat', params.lat.toString());
  if (params?.lng !== undefined) query.append('lng', params.lng.toString());
  if (params?.radiusMeters !== undefined) query.append('radiusMeters', params.radiusMeters.toString());

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/alerts?${query.toString()}`;
  const response = await fetch(url, {
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Erro na requisição: ${response.statusText}`);
  }

  const data = await response.json();
  return data.alerts || [];
}

export async function createAlertApi(alertInput: CreateAlertInput): Promise<FloodAlert> {
  const url = `${getApiBaseUrl()}/api/alerts`;
  const response = await fetch(url, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify(alertInput),
  });

  if (!response.ok) {
    throw new Error(`Erro ao registrar alerta: ${response.statusText}`);
  }

  const data = await response.json();
  return data.alert;
}

export async function resolveAlertApi(id: string, resolvedBy: string): Promise<FloodAlert> {
  const url = `${getApiBaseUrl()}/api/alerts/${id}/resolve`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: COMMON_HEADERS,
    body: JSON.stringify({ resolvedBy, resolutionNote: 'Água baixou / Via liberada' }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao encerrar alerta: ${response.statusText}`);
  }

  const data = await response.json();
  return data.alert;
}

export async function confirmAlertApi(id: string, deviceId: string): Promise<FloodAlert> {
  const url = `${getApiBaseUrl()}/api/alerts/${id}/confirm`;
  const response = await fetch(url, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({ deviceId }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao confirmar alerta: ${response.statusText}`);
  }

  const data = await response.json();
  return data.alert;
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const url = `${getApiBaseUrl()}/api/stats`;
  const response = await fetch(url, {
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar estatísticas`);
  }

  const data = await response.json();
  return data.stats;
}

export async function fetchTopologyData() {
  const url = `${getApiBaseUrl()}/api/topology`;
  const response = await fetch(url, {
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar topologia`);
  }

  return await response.json();
}

export async function simulateAcademicScenario(): Promise<FloodAlert> {
  const url = `${getApiBaseUrl()}/api/simulate-scenario`;
  const response = await fetch(url, {
    method: 'POST',
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Erro ao executar simulação`);
  }

  const data = await response.json();
  return data.alert;
}
