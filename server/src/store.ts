import crypto from 'crypto';
import { FloodAlert, CreateAlertDTO, ResolveAlertDTO, SeverityLevel, AlertStatus } from './types';
import { getDbPool, isDatabaseConnected } from './db/connection';
import { calculateDistanceMeters } from './geo';

// Repositório em memória para alta disponibilidade e fallback
let memoryAlerts: FloodAlert[] = [
  {
    id: 'a1b2c3d4-0001-4000-8000-000000000001',
    title: 'Túnel Anhangabaú Intransitável',
    description: 'Acúmulo intenso de água na saída para a Av. 23 de Maio. Carros baixos não passam.',
    latitude: -23.5489,
    longitude: -46.6388,
    address: 'Vale do Anhangabaú, Centro Histórico',
    severity: 'critical',
    waterLevel: '50cm (Nível da Porta)',
    cause: 'Transbordamento de Galeria',
    status: 'active',
    reportedBy: 'Nó-Móvel-01 (Usuário A)',
    confirmations: 6,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'a1b2c3d4-0002-4000-8000-000000000002',
    title: 'Av. Paulista x Rua Augusta',
    description: 'Lâmina d água avançando na calçada e faixa da direita. Bueiro entupido com folhas.',
    latitude: -23.5587,
    longitude: -46.6601,
    address: 'Av. Paulista, 1800 - Bela Vista',
    severity: 'moderate',
    waterLevel: '25cm (Metade da Roda)',
    cause: 'Bueiro Obstruído',
    status: 'active',
    reportedBy: 'Nó-Móvel-02 (Usuário B)',
    confirmations: 3,
    createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
  },
  {
    id: 'a1b2c3d4-0003-4000-8000-000000000003',
    title: 'Marginal Pinheiros próx. Ponte Cidade Jardim',
    description: 'Pista expressa com trecho alagado no sentido Castelo. Trânsito completamente parado.',
    latitude: -23.5852,
    longitude: -46.6912,
    address: 'Marginal Pinheiros - Itaim Bibi',
    severity: 'high',
    waterLevel: '40cm (Acima do Eixo)',
    cause: 'Chuva Torrencial Contínua',
    status: 'active',
    reportedBy: 'Nó-Móvel-03 (Usuário C)',
    confirmations: 8,
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: 'a1b2c3d4-0004-4000-8000-000000000004',
    title: 'Rua da Mooca x Rua Taquari',
    description: 'Água já escoou completamente pelas bocas de lobo. Tráfego liberado normalmente.',
    latitude: -23.5532,
    longitude: -46.5987,
    address: 'Rua da Mooca, 2100 - Mooca',
    severity: 'low',
    waterLevel: '5cm (Água Baixou)',
    cause: 'Drenagem Urbana Concluída',
    status: 'resolved',
    reportedBy: 'Nó-Móvel-04 (Usuário D)',
    confirmations: 4,
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    resolvedBy: 'Nó-Móvel-04 (Usuário D)',
  },
];

function mapDbRowToAlert(row: any): FloodAlert {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    address: row.address,
    severity: row.severity as SeverityLevel,
    waterLevel: row.water_level,
    cause: row.cause,
    status: row.status as AlertStatus,
    reportedBy: row.reported_by,
    confirmations: Number(row.confirmations),
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolvedBy: row.resolved_by || null,
  };
}

export async function getAllAlerts(filters?: {
  status?: string;
  severity?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
}): Promise<FloodAlert[]> {
  const pool = getDbPool();

  if (isDatabaseConnected() && pool) {
    try {
      let query = 'SELECT * FROM alerts WHERE 1=1';
      const params: any[] = [];

      if (filters?.status && filters.status !== 'all') {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters?.severity) {
        query += ' AND severity = ?';
        params.push(filters.severity);
      }

      query += ' ORDER BY created_at DESC';

      const [rows]: [any[], any] = await pool.query(query, params);
      let alerts = rows.map(mapDbRowToAlert);

      // Aplica cálculo de distância e filtro de raio se coordenadas forem fornecidas
      if (filters?.lat !== undefined && filters?.lng !== undefined) {
        alerts = alerts.map((alert) => ({
          ...alert,
          distanceMeters: calculateDistanceMeters(filters.lat!, filters.lng!, alert.latitude, alert.longitude),
        }));

        if (filters.radiusMeters) {
          alerts = alerts.filter((a) => (a.distanceMeters ?? Infinity) <= filters.radiusMeters!);
        }

        alerts.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
      }

      return alerts;
    } catch (err) {
      console.error('Erro ao consultar MariaDB, usando cache:', err);
    }
  }

  // Fallback em memória
  let result = [...memoryAlerts];
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((a) => a.status === filters.status);
  }
  if (filters?.severity) {
    result = result.filter((a) => a.severity === filters.severity);
  }

  if (filters?.lat !== undefined && filters?.lng !== undefined) {
    result = result.map((alert) => ({
      ...alert,
      distanceMeters: calculateDistanceMeters(filters.lat!, filters.lng!, alert.latitude, alert.longitude),
    }));

    if (filters.radiusMeters) {
      result = result.filter((a) => (a.distanceMeters ?? Infinity) <= filters.radiusMeters!);
    }

    result.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  } else {
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return result;
}

export async function getAlertById(id: string): Promise<FloodAlert | null> {
  const pool = getDbPool();
  if (isDatabaseConnected() && pool) {
    try {
      const [rows]: [any[], any] = await pool.query('SELECT * FROM alerts WHERE id = ? LIMIT 1', [id]);
      if (rows.length > 0) {
        return mapDbRowToAlert(rows[0]);
      }
      return null;
    } catch (err) {
      console.error('Erro ao buscar alerta no MariaDB:', err);
    }
  }

  const alert = memoryAlerts.find((a) => a.id === id);
  return alert || null;
}

export async function createAlert(dto: CreateAlertDTO): Promise<FloodAlert> {
  const id = crypto.randomUUID();
  const now = new Date();

  const newAlert: FloodAlert = {
    id,
    title: dto.title.trim(),
    description: dto.description?.trim() || 'Sem observações adicionais.',
    latitude: dto.latitude,
    longitude: dto.longitude,
    address: dto.address?.trim() || `Coordenadas: ${dto.latitude.toFixed(4)}, ${dto.longitude.toFixed(4)}`,
    severity: dto.severity || 'moderate',
    waterLevel: dto.waterLevel || '30cm (Metade da Roda)',
    cause: dto.cause || 'Chuva Torrencial',
    status: 'active',
    reportedBy: dto.reportedBy?.trim() || 'Usuário Anônimo (Nó Móvel)',
    confirmations: 1,
    createdAt: now.toISOString(),
  };

  const pool = getDbPool();
  if (isDatabaseConnected() && pool) {
    try {
      await pool.query(
        `INSERT INTO alerts (id, title, description, latitude, longitude, address, severity, water_level, cause, status, reported_by, confirmations, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newAlert.id,
          newAlert.title,
          newAlert.description,
          newAlert.latitude,
          newAlert.longitude,
          newAlert.address,
          newAlert.severity,
          newAlert.waterLevel,
          newAlert.cause,
          newAlert.status,
          newAlert.reportedBy,
          newAlert.confirmations,
          now,
        ]
      );
    } catch (err) {
      console.error('Erro ao salvar alerta no MariaDB:', err);
    }
  }

  memoryAlerts.unshift(newAlert);
  return newAlert;
}

export async function resolveAlert(id: string, dto: ResolveAlertDTO): Promise<FloodAlert | null> {
  const now = new Date();
  const pool = getDbPool();

  if (isDatabaseConnected() && pool) {
    try {
      await pool.query(
        `UPDATE alerts 
         SET status = 'resolved', resolved_at = ?, resolved_by = ?
         WHERE id = ?`,
        [now, dto.resolvedBy || 'Usuário Local', id]
      );
    } catch (err) {
      console.error('Erro ao resolver alerta no MariaDB:', err);
    }
  }

  const index = memoryAlerts.findIndex((a) => a.id === id);
  if (index !== -1) {
    memoryAlerts[index] = {
      ...memoryAlerts[index],
      status: 'resolved',
      resolvedAt: now.toISOString(),
      resolvedBy: dto.resolvedBy || 'Usuário Local',
    };
    return memoryAlerts[index];
  }

  return await getAlertById(id);
}

export async function confirmAlert(id: string, deviceId: string): Promise<FloodAlert | null> {
  const pool = getDbPool();

  if (isDatabaseConnected() && pool) {
    try {
      await pool.query(
        `INSERT IGNORE INTO confirmations (alert_id, device_id) VALUES (?, ?)`,
        [id, deviceId]
      );
      await pool.query(
        `UPDATE alerts 
         SET confirmations = (SELECT COUNT(*) FROM confirmations WHERE alert_id = ?) + 1
         WHERE id = ?`,
        [id, id]
      );
    } catch (err) {
      console.error('Erro ao confirmar alerta no MariaDB:', err);
    }
  }

  const index = memoryAlerts.findIndex((a) => a.id === id);
  if (index !== -1) {
    memoryAlerts[index].confirmations += 1;
    return memoryAlerts[index];
  }

  return await getAlertById(id);
}

export async function getSystemStats() {
  const alerts = await getAllAlerts();
  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;

  return {
    totalAlerts: alerts.length,
    activeAlerts: activeCount,
    resolvedAlerts: resolvedCount,
    criticalAlerts: criticalCount,
    isDatabaseActive: isDatabaseConnected(),
  };
}
