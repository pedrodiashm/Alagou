import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

import { initializeDatabase } from './db/connection';
import {
  getAllAlerts,
  getAlertById,
  createAlert,
  resolveAlert,
  confirmAlert,
  getSystemStats,
} from './store';
import {
  registerClientNode,
  unregisterClientNode,
  updateNodeLocation,
  broadcastNewAlert,
  broadcastAlertResolved,
  broadcastAlertConfirmed,
  getConnectedNodesCount,
  getConnectedNodesList,
  getPacketLogs,
  addPacketLog,
  sendToClient,
} from './distribution';
import { DistributedMessage } from './types';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

// ==========================================
// ROTAS DA API REST (Sistemas Distribuídos)
// ==========================================

// Status e Saúde do Nó Central / Cluster
app.get('/api/health', async (_req, res) => {
  const stats = await getSystemStats();
  res.json({
    status: 'online',
    service: 'Alagou Distributed Coordinator',
    timestamp: new Date().toISOString(),
    connectedNodes: getConnectedNodesCount(),
    database: {
      driver: 'MariaDB',
      connected: stats.isDatabaseActive,
    },
    metrics: stats,
  });
});

// Listagem de Alertas com Filtros Geoespaciais (Haversine)
app.get('/api/alerts', async (req, res) => {
  try {
    const { status, severity, lat, lng, radiusMeters } = req.query;

    const parsedLat = lat ? Number(lat) : undefined;
    const parsedLng = lng ? Number(lng) : undefined;
    const parsedRadius = radiusMeters ? Number(radiusMeters) : undefined;

    const alerts = await getAllAlerts({
      status: status as string,
      severity: severity as string,
      lat: parsedLat,
      lng: parsedLng,
      radiusMeters: parsedRadius,
    });

    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Detalhes de um Alerta
app.get('/api/alerts/:id', async (req, res) => {
  try {
    const alert = await getAlertById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alerta não encontrado' });
    }
    res.json({ success: true, alert });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Registro de Novo Alagamento (🌊 Usuário A -> Servidor -> Distribuição)
app.post('/api/alerts', async (req, res) => {
  try {
    const { title, description, latitude, longitude, address, severity, waterLevel, cause, reportedBy, deviceId } = req.body;

    if (!title || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: title, latitude e longitude',
      });
    }

    const alert = await createAlert({
      title,
      description,
      latitude: Number(latitude),
      longitude: Number(longitude),
      address,
      severity,
      waterLevel,
      cause,
      reportedBy,
    });

    // Dispara difusão em tempo real para os nós conectados via WebSocket
    broadcastNewAlert(alert, deviceId || reportedBy);

    res.status(201).json({
      success: true,
      message: 'Alerta de alagamento registrado e propagado na rede distribuída com sucesso!',
      alert,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resolução / Encerramento do Alerta (✅ Usuário no Local)
app.patch('/api/alerts/:id/resolve', async (req, res) => {
  try {
    const { resolvedBy, resolutionNote } = req.body;
    const alert = await resolveAlert(req.params.id, { resolvedBy, resolutionNote });

    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alerta não encontrado' });
    }

    // Notifica todos os nós que o alagamento foi resolvido
    broadcastAlertResolved(alert, resolvedBy);

    res.json({
      success: true,
      message: 'Alerta marcado como resolvido e sincronizado na rede.',
      alert,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirmação Coletiva de Alagamento (Consenso / Anti-falso positivo)
app.post('/api/alerts/:id/confirm', async (req, res) => {
  try {
    const { deviceId } = req.body;
    const alert = await confirmAlert(req.params.id, deviceId || 'anonymous_node');

    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alerta não encontrado' });
    }

    broadcastAlertConfirmed(alert, deviceId);

    res.json({
      success: true,
      message: 'Confirmação registrada com sucesso no consenso distribuído.',
      alert,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Métricas e Estatísticas
app.get('/api/stats', async (_req, res) => {
  try {
    const stats = await getSystemStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Topologia da Rede Distribuída & Logs de Pacotes
app.get('/api/topology', (_req, res) => {
  res.json({
    success: true,
    nodesCount: getConnectedNodesCount(),
    nodes: getConnectedNodesList(),
    packets: getPacketLogs(),
  });
});

// Rota de Simulação Acadêmica (Dispositivo A produz -> Servidor calcula distâncias para B 500m e C 800m)
app.post('/api/simulate-scenario', async (_req, res) => {
  try {
    // Alerta simulado no centro de São Paulo
    const simulatedAlert = await createAlert({
      title: '🌊 Inundação Cruzamento Av. São João x Av. Ipiranga',
      description: 'Chuva torrencial rápida causou alagamento repentino da via.',
      latitude: -23.5435,
      longitude: -46.6415,
      address: 'Av. São João, 1100 - República',
      severity: 'high',
      waterLevel: '45cm (Nível da Porta)',
      cause: 'Chuva Forte + Transbordamento',
      reportedBy: '📱 Dispositivo A (Produtor)',
    });

    addPacketLog({
      type: 'SIMULATED_SCENARIO',
      source: '📱 Dispositivo A (Produtor)',
      destination: '☁️ Coordenador Central',
      summary: 'Dispositivo A enviou "Alagamento"',
      status: 'received',
    });

    addPacketLog({
      type: 'GEO_ROUTING',
      source: '☁️ Coordenador Central',
      destination: '📱 Dispositivo B',
      distanceInfo: 'Raio: 500m',
      summary: 'Notificação enviada ao Dispositivo B (500m)',
      status: 'sent',
    });

    addPacketLog({
      type: 'GEO_ROUTING',
      source: '☁️ Coordenador Central',
      destination: '📱 Dispositivo C',
      distanceInfo: 'Raio: 800m',
      summary: 'Notificação enviada ao Dispositivo C (800m)',
      status: 'sent',
    });

    broadcastNewAlert(simulatedAlert, '📱 Dispositivo A');

    res.json({
      success: true,
      message: 'Cenário acadêmico simulado com sucesso (A -> Servidor -> B [500m], C [800m])',
      alert: simulatedAlert,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SERVIDOR HTTP & WEBSOCKET EM TEMPO REAL
// ==========================================

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  let clientDeviceId = `node_${Math.random().toString(36).substring(2, 9)}`;

  ws.on('message', (rawData) => {
    try {
      const message: DistributedMessage<any> = JSON.parse(rawData.toString());

      switch (message.type) {
        case 'CLIENT_REGISTER': {
          const { deviceId, deviceName, latitude, longitude, pushToken } = message.payload || {};
          if (deviceId) {
            clientDeviceId = deviceId;
          }
          registerClientNode(ws, clientDeviceId, deviceName || 'Nó Móvel', latitude, longitude, pushToken);

          // Responde com confirmação de registro
          sendToClient(ws, {
            type: 'CLIENT_REGISTERED',
            timestamp: new Date().toISOString(),
            originNode: '☁️ Coordenador Central',
            payload: {
              deviceId: clientDeviceId,
              registered: true,
              message: 'Conectado à rede distribuída Alagou',
            },
          });
          break;
        }

        case 'LOCATION_UPDATE': {
          const { latitude, longitude } = message.payload || {};
          if (latitude !== undefined && longitude !== undefined) {
            updateNodeLocation(clientDeviceId, latitude, longitude);
          }
          break;
        }

        case 'DISTRIBUTED_PING': {
          sendToClient(ws, {
            type: 'DISTRIBUTED_PONG',
            timestamp: new Date().toISOString(),
            originNode: '☁️ Coordenador Central',
            payload: { ok: true },
          });
          break;
        }

        default:
          console.log(`[WS] Mensagem recebida: ${message.type}`);
      }
    } catch (err) {
      console.error('[WS] Erro ao processar mensagem JSON:', err);
    }
  });

  ws.on('close', () => {
    unregisterClientNode(clientDeviceId);
  });

  ws.on('error', (err) => {
    console.error(`[WS Error] ${clientDeviceId}:`, err.message);
  });
});

// Inicialização do Servidor e Banco MariaDB
async function start() {
  await initializeDatabase();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 SERVIDOR DISTRIBUÍDO ALAGOU INICIALIZADO`);
    console.log(`📡 HTTP REST API: http://0.0.0.0:${PORT}`);
    console.log(`⚡ WebSocket Stream: ws://0.0.0.0:${PORT}/ws`);
    console.log(`🗄️  Banco de Dados: MariaDB (porta 3306)`);
    console.log(`======================================================\n`);
  });
}

start();
