import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || '';

if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.warn('⚠️ Credenciais de banco ausentes (DB_USER/DB_PASSWORD/DB_NAME). O servidor usará o fallback em memória.');
  console.warn('💡 Defina essas variáveis no .env (use .env.example como base).');
}

const dbConfig: PoolOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000,
};

let pool: Pool | null = null;
let isDbConnected = false;

export function getDbPool(): Pool | null {
  return pool;
}

export function isDatabaseConnected(): boolean {
  return isDbConnected;
}

/**
 * Inicializa a conexão com o MariaDB e executa auto-migração de tabelas e carga inicial
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    console.log(`🔌 Conectando ao MariaDB em ${dbConfig.host}:${dbConfig.port} (banco: ${dbConfig.database})...`);
    pool = mysql.createPool(dbConfig);

    // Testa a conexão
    const connection = await pool.getConnection();
    console.log('✅ Conexão com MariaDB estabelecida com sucesso!');
    isDbConnected = true;

    // Garante que a tabela alerts exista
    await connection.query(`
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
    `);

    // Garante que a tabela confirmations exista
    await connection.query(`
      CREATE TABLE IF NOT EXISTS confirmations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        alert_id VARCHAR(36) NOT NULL,
        device_id VARCHAR(100) NOT NULL,
        confirmed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_alert_device (alert_id, device_id),
        CONSTRAINT fk_alert_confirm FOREIGN KEY (alert_id) REFERENCES alerts (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Verifica se já existem alertas cadastrados
    const [rows]: [any[], any] = await connection.query('SELECT COUNT(*) as count FROM alerts');
    if (rows[0].count === 0) {
      console.log('🌱 Inserindo alertas iniciais de demonstração no MariaDB...');
      await connection.query(`
        INSERT INTO alerts (id, title, description, latitude, longitude, address, severity, water_level, cause, status, reported_by, confirmations, created_at)
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
      `);
      await connection.query(`
        UPDATE alerts 
        SET resolved_at = NOW() - INTERVAL 15 MINUTE, resolved_by = 'Nó-Móvel-04 (Usuário D)'
        WHERE id = 'a1b2c3d4-0004-4000-8000-000000000004';
      `);
      console.log('✅ Alertas de demonstração inseridos no MariaDB.');
    }

    connection.release();
    return true;
  } catch (error: any) {
    console.warn('⚠️ Não foi possível conectar ao MariaDB diretamente:', error.message);
    console.warn('💡 Dica: Suba o banco via Docker executando: docker compose up -d');
    console.log('🔄 O servidor utilizará a camada em memória com sincronização transparente para demonstração contínua.');
    isDbConnected = false;
    return false;
  }
}
