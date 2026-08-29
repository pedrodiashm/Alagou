import { WebSocket } from 'ws';
import {
  ClientNode,
  DistributedMessage,
  FloodAlert,
  AlertBroadcastPayload,
} from './types';
import { calculateDistanceMeters, formatDistance } from './geo';

// Mapa de nós clientes conectados na rede distribuída
const connectedNodes = new Map<string, ClientNode>();

// Buffer de logs de pacotes distribuídos para visualização acadêmica
export interface DistributedPacketLog {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  destination: string;
  distanceInfo?: string;
  summary: string;
  status: 'sent' | 'received' | 'routed';
}

const packetLogs: DistributedPacketLog[] = [];
const MAX_PACKET_LOGS = 60;

// Raio de notificação push por proximidade (1 km)
export const NEARBY_PUSH_RADIUS_METERS = 1000;

/**
 * Envia uma notificação push (Expo Push Service) para um aparelho específico.
 * Não requer credenciais: o token do app carrega a autorização.
 */
async function sendNearbyPush(token: string, alert: FloodAlert, distanceMeters: number) {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: `🌊 Alagamento a ${formatDistance(distanceMeters)}`,
        body: alert.title,
        priority: 'high',
        sound: 'default',
        data: {
          url: '/',
          alertId: alert.id,
          distanceMeters,
        },
      }),
    });
    const json: any = await res.json();
    const pushResult = json.data?.[0];
    if (pushResult?.status === 'error') {
      console.warn('[Push] Falha ao enviar notificação:', pushResult.details || JSON.stringify(json));
    } else {
      console.log(`[Push] Enviado com sucesso para ${token.slice(0, 18)}... (${formatDistance(distanceMeters)} da origem)`);
    }
  } catch (e: any) {
    console.warn('[Push] Erro ao enviar notificação:', e?.message || e);
  }
}

export function addPacketLog(log: Omit<DistributedPacketLog, 'id' | 'timestamp'>) {
  const entry: DistributedPacketLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
    ...log,
  };
  packetLogs.unshift(entry);
  if (packetLogs.length > MAX_PACKET_LOGS) {
    packetLogs.pop();
  }
}

export function getPacketLogs(): DistributedPacketLog[] {
  return packetLogs;
}

/**
 * Registra ou atualiza um nó cliente na topologia distribuída
 */
export function registerClientNode(
  ws: WebSocket,
  deviceId: string,
  deviceName: string,
  lat?: number,
  lng?: number,
  pushToken?: string
): ClientNode {
  const existing = connectedNodes.get(deviceId);
  const node: ClientNode = {
    ws,
    deviceId,
    deviceName: deviceName || `Nó Móvel (${deviceId.slice(0, 6)})`,
    latitude: lat ?? existing?.latitude ?? null,
    longitude: lng ?? existing?.longitude ?? null,
    pushToken: pushToken || existing?.pushToken,
    connectedAt: existing?.connectedAt ?? new Date(),
    lastHeartbeat: new Date(),
  };

  connectedNodes.set(deviceId, node);

  console.log(
    `📡 [Registro] Nó "${node.deviceName}" conectado${node.pushToken ? ` com token de push (${node.pushToken.slice(0, 24)}...)` : ' SEM token de push (FCM/Firebase não configurado?)'}`
  );

  addPacketLog({
    type: 'CLIENT_REGISTER',
    source: node.deviceName,
    destination: '☁️ Coordenador Central',
    summary: `Nó conectado com sucesso [Lat: ${node.latitude ?? 'N/A'}, Lng: ${node.longitude ?? 'N/A'}]`,
    status: 'received',
  });

  broadcastTopologyUpdate();
  return node;
}

/**
 * Atualiza as coordenadas GPS de um nó cliente ativo
 */
export function updateNodeLocation(deviceId: string, lat: number, lng: number) {
  const node = connectedNodes.get(deviceId);
  if (node) {
    node.latitude = lat;
    node.longitude = lng;
    node.lastHeartbeat = new Date();
  }
}

/**
 * Remove um nó desconectado da topologia
 */
export function unregisterClientNode(deviceId: string) {
  const node = connectedNodes.get(deviceId);
  if (node) {
    addPacketLog({
      type: 'CLIENT_DISCONNECT',
      source: node.deviceName,
      destination: '☁️ Coordenador Central',
      summary: `Nó desconectado da rede distribuída`,
      status: 'received',
    });
    connectedNodes.delete(deviceId);
    broadcastTopologyUpdate();
  }
}

/**
 * Envia uma mensagem em formato JSON para um cliente WebSocket específico
 */
export function sendToClient(ws: WebSocket, message: DistributedMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Transmite a topologia da rede atual para todos os nós conectados
 */
export function broadcastTopologyUpdate() {
  const nodesSummary = Array.from(connectedNodes.values()).map((n) => ({
    deviceId: n.deviceId,
    deviceName: n.deviceName,
    latitude: n.latitude,
    longitude: n.longitude,
    connectedAt: n.connectedAt.toISOString(),
  }));

  const message: DistributedMessage = {
    type: 'TOPOLOGY_UPDATE',
    timestamp: new Date().toISOString(),
    originNode: '☁️ Coordenador Central',
    payload: {
      activeNodesCount: connectedNodes.size,
      nodes: nodesSummary,
      recentPackets: packetLogs.slice(0, 15),
    },
  };

  for (const client of connectedNodes.values()) {
    sendToClient(client.ws, message);
  }
}

/**
 * Núcleo da Distribuição Geoespacial:
 * Quando um novo alerta é registrado, o servidor calcula a distância relativa para CADA cliente conectado
 * e envia a notificação personalizada com a distância exata calculada (ex: 500m, 800m).
 */
export function broadcastNewAlert(alert: FloodAlert, originDeviceId?: string) {
  console.log(`🌊 [Distribuição] Difundindo novo alerta "${alert.title}" para ${connectedNodes.size} nós conectados...`);

  addPacketLog({
    type: 'NEW_ALERT',
    source: originDeviceId ? `📱 ${originDeviceId}` : '📱 Usuário Produtor (A)',
    destination: '☁️ Coordenador Central',
    summary: `Alerta "${alert.title}" registrado [${alert.severity.toUpperCase()}]`,
    status: 'received',
  });

  for (const client of connectedNodes.values()) {
    let distanceMeters: number | undefined;
    let distanceText = 'Calculando...';
    let isNearby = false;

    if (client.latitude !== null && client.longitude !== null) {
      distanceMeters = calculateDistanceMeters(
        client.latitude,
        client.longitude,
        alert.latitude,
        alert.longitude
      );
      distanceText = formatDistance(distanceMeters);
      isNearby = distanceMeters <= 2000; // Considera próximo até 2km
    }

    const payload: AlertBroadcastPayload = {
      alert: {
        ...alert,
        distanceMeters,
      },
      distanceMeters,
      distanceText,
      isNearby,
      distributedHopCount: 1,
    };

    const message: DistributedMessage<AlertBroadcastPayload> = {
      type: 'ALERT_BROADCAST',
      timestamp: new Date().toISOString(),
      originNode: originDeviceId || '☁️ Coordenador Central',
      targetNode: client.deviceId,
      payload,
    };

sendToClient(client.ws, message);

    // Notificação push: só para nós com token a menos de 1km do alagamento
    if (
      distanceMeters !== undefined &&
      distanceMeters <= NEARBY_PUSH_RADIUS_METERS &&
      client.pushToken
    ) {
      sendNearbyPush(client.pushToken, alert, distanceMeters);
    }

    addPacketLog({
      type: 'ALERT_BROADCAST',
      source: '☁️ Coordenador Central',
      destination: `📱 ${client.deviceName}`,
      distanceInfo: distanceText !== 'Calculando...' ? `Raio: ${distanceText}` : undefined,
      summary: `Pacote entregue para nó consumidor (${distanceText})`,
      status: 'sent',
    });
  }
}

/**
 * Transmite encerramento / resolução de um alerta para todos os nós
 */
export function broadcastAlertResolved(alert: FloodAlert, resolvedBy?: string) {
  addPacketLog({
    type: 'ALERT_RESOLVED',
    source: resolvedBy ? `📱 ${resolvedBy}` : '📱 Usuário no Local',
    destination: '☁️ Todos os Nós',
    summary: `Alerta "${alert.title}" marcado como RESOLVIDO / Água baixou`,
    status: 'sent',
  });

  const message: DistributedMessage = {
    type: 'ALERT_RESOLVED',
    timestamp: new Date().toISOString(),
    originNode: resolvedBy || 'Nó Local',
    payload: {
      alert,
      resolvedAt: alert.resolvedAt,
      resolvedBy: alert.resolvedBy,
    },
  };

  for (const client of connectedNodes.values()) {
    sendToClient(client.ws, message);
  }
}

/**
 * Transmite confirmação (+1) para todos os nós
 */
export function broadcastAlertConfirmed(alert: FloodAlert, confirmedBy?: string) {
  addPacketLog({
    type: 'ALERT_CONFIRMED',
    source: confirmedBy ? `📱 ${confirmedBy}` : '📱 Usuário Próximo',
    destination: '☁️ Todos os Nós',
    summary: `Alerta "${alert.title}" confirmado (+1 validação: total ${alert.confirmations})`,
    status: 'sent',
  });

  const message: DistributedMessage = {
    type: 'ALERT_CONFIRMED',
    timestamp: new Date().toISOString(),
    originNode: confirmedBy || 'Nó Local',
    payload: {
      alertId: alert.id,
      confirmations: alert.confirmations,
    },
  };

  for (const client of connectedNodes.values()) {
    sendToClient(client.ws, message);
  }
}

export function getConnectedNodesCount(): number {
  return connectedNodes.size;
}

export function getConnectedNodesList() {
  return Array.from(connectedNodes.values()).map((n) => ({
    deviceId: n.deviceId,
    deviceName: n.deviceName,
    latitude: n.latitude,
    longitude: n.longitude,
    connectedAt: n.connectedAt,
    lastHeartbeat: n.lastHeartbeat,
  }));
}
