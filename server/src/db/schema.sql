-- Esquema do Banco de Dados MariaDB para o Sistema Distribuído Alagou

CREATE DATABASE IF NOT EXISTS alagou_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE alagou_db;

-- Tabela principal de Alertas de Alagamento
CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address VARCHAR(255) NOT NULL,
  severity ENUM('low', 'moderate', 'high', 'critical') NOT NULL DEFAULT 'moderate',
  water_level VARCHAR(60) NOT NULL DEFAULT '20cm',
  cause VARCHAR(120) NOT NULL DEFAULT 'Chuva Torrencial',
  status ENUM('active', 'resolved') NOT NULL DEFAULT 'active',
  reported_by VARCHAR(100) NOT NULL,
  confirmations INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  resolved_by VARCHAR(100) NULL,
  INDEX idx_status (status),
  INDEX idx_created (created_at),
  INDEX idx_lat_lng (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Confirmações Coletivas (Consenso Distribuído / Evita votos duplicados)
CREATE TABLE IF NOT EXISTS confirmations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alert_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  confirmed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alert_device (alert_id, device_id),
  CONSTRAINT fk_alert_confirm FOREIGN KEY (alert_id) REFERENCES alerts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Registro de Nós Conectados na Topologia Distribuída
CREATE TABLE IF NOT EXISTS distributed_nodes (
  device_id VARCHAR(100) PRIMARY KEY,
  device_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'consumer',
  latitude DECIMAL(10, 8) NULL,
  longitude DECIMAL(11, 8) NULL,
  last_heartbeat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('online', 'offline') NOT NULL DEFAULT 'online'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carga inicial de dados representativos para teste e demonstração imediata
INSERT IGNORE INTO alerts (id, title, description, latitude, longitude, address, severity, water_level, cause, status, reported_by, confirmations, created_at)
VALUES 
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Túnel Anhangabaú Intransitável',
    'Acúmulo intenso de água na saída para a Av. 23 de Maio. Carros baixos não passam.',
    -23.54890000,
    -46.63880000,
    'Vale do Anhangabaú, Centro Histórico',
    'critical',
    '50cm (Nível da Porta)',
    'Transbordamento de Galeria',
    'active',
    'Nó-Móvel-01 (Usuário A)',
    6,
    NOW() - INTERVAL 8 MINUTE
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Av. Paulista x Rua Augusta',
    'Lâmina d água avançando na calçada e faixa da direita. Bueiro entupido com folhas.',
    -23.55870000,
    -46.66010000,
    'Av. Paulista, 1800 - Bela Vista',
    'moderate',
    '25cm (Metade da Roda)',
    'Bueiro Obstruído',
    'active',
    'Nó-Móvel-02 (Usuário B)',
    3,
    NOW() - INTERVAL 19 MINUTE
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Marginal Pinheiros próx. Ponte Cidade Jardim',
    'Pista expressa com trecho alagado no sentido Castelo. Trânsito completamente parado.',
    -23.58520000,
    -46.69120000,
    'Marginal Pinheiros - Itaim Bibi',
    'high',
    '40cm (Acima do Eixo)',
    'Chuva Torrencial Contínua',
    'active',
    'Nó-Móvel-03 (Usuário C)',
    8,
    NOW() - INTERVAL 35 MINUTE
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Rua da Mooca x Rua Taquari',
    'Água já escoou completamente pelas bocas de lobo. Tráfego liberado normalmente.',
    -23.55320000,
    -46.59870000,
    'Rua da Mooca, 2100 - Mooca',
    'low',
    '5cm (Água Baixou)',
    'Drenagem Urbana Concluída',
    'resolved',
    'Nó-Móvel-04 (Usuário D)',
    4,
    NOW() - INTERVAL 2 HOUR
  );

-- Atualiza dados do alerta resolvido
UPDATE alerts 
SET resolved_at = NOW() - INTERVAL 15 MINUTE, resolved_by = 'Nó-Móvel-04 (Usuário D)'
WHERE id = 'a1b2c3d4-0004-4000-8000-000000000004';
