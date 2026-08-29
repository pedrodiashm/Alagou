# PROPOSTA DE PROJETO ACADÊMICO: SISTEMAS DISTRIBUÍDOS

**Título do Projeto**: Alagou — Sistema Distribuído de Alerta e Monitoramento Colaborativo de Alagamentos e Inundações Urbanas  
**Área de Aplicação**: Gerenciamento de Informações Ambientais Urbanas  
**Submissão**: Análise e Aprovação do Coordenador Auxiliar e Corpo Docente  

---

## 1. Contexto e Motivação

O crescimento desordenado das cidades e os eventos climáticos extremos têm intensificado problemas ambientais urbanos críticos, destacando-se as **áreas de alagamento, enxurradas e inundações**. O acúmulo súbito de água em vias públicas causa paralisação no trânsito, danos patrimoniais severos, riscos à vida de pedestres e motoristas, além de proliferação de doenças de veiculação hídrica.

A detecção tempestiva de pontos de alagamento por órgãos públicos tradicionais frequentemente sofre de latência e cobertura limitada. Uma abordagem baseada em **Sistemas Distribuídos Colaborativos (Crowdsourcing Ambiental)** permite que a própria população conectada em dispositivos móveis atue como uma rede distribuída de sensores humanos e nós de processamento/consumo, reduzindo o tempo de propagação do alerta de horas para milissegundos.

---

## 2. Descrição da Aplicação ("Alagou")

O **Alagou** é uma aplicação móvel integrada a uma infraestrutura de backend distribuído que permite a troca de informações críticas sobre alagamentos em tempo real.

### 2.1 Funcionalidades do Usuário no Dispositivo Móvel:
1. 📍 **Visualização de Alertas Próximos**: O usuário visualiza pontos de alagamento ordenados por distância relativa calculada em tempo real (ex.: 500m, 800m, 1.2km), com indicação de severidade e profundidade da água.
2. 🌊 **Registro Rápido de Alagamentos**: Qualquer usuário (nó produtor) pode reportar um alagamento informando sua localização GPS automática ou manual, nível da lâmina d'água e causas aparentes (bueiro entupido, chuva torrencial, transbordamento de córrego).
3. 👁️ **Visualização Temporal**: O sistema informa com precisão quando cada alerta foi emitido (ex.: "há 3 minutos", "às 23:15"), garantindo a confiabilidade e relevância da informação.
4. ✅ **Encerramento / Resolução Colaborativa**: O usuário no local pode marcar que a água baixou / o alagamento foi resolvido, sincronizando o encerramento do evento em todos os nós conectados.
5. 🤝 **Consenso Comunitário (Validação Cruzada)**: Usuários próximos podem confirmar a persistência do alagamento (+1 confirmação), mitigando falsos positivos na rede distribuída.

---

## 3. Arquitetura de Sistemas Distribuídos

O sistema é fundamentado nos seguintes paradigmas e padrões de sistemas distribuídos:

### 3.1 Diagrama de Distribuição e Fluxo de Dados

```text
               📱 Usuário A (Nó Produtor)
                     │
                     │  1. POST /api/alerts (🌊 Novo Alagamento)
                     ↓
       ☁️  Servidor / Coordenador Distribuído
             │
        ┌────┴─────────────────────────────┐
        │                                  │
        ↓                                  ↓
 🗄️  MariaDB (Persistência)    🛰️  Motor de Distribuição Pub/Sub
 [Tabela de Alertas & Geo-Índice]      [Cálculo de Distância Haversine]
                                           │
                                  ┌────────┴────────┐
                                  │ (WebSocket Push)│
                                  ↓                 ↓
                           📱 Usuário B      📱 Usuário C
                             (Nó Consumidor)   (Nó Consumidor)
                               [📍 500m]         [📍 800m]
```

### 3.2 Conceitos de Sistemas Distribuídos Implementados

| Conceito | Aplicação no Projeto Alagou |
| :--- | :--- |
| **Padrão Produtor-Consumidor** | O Dispositivo A produz o evento de alagamento; o servidor despacha e os Dispositivos B e C consomem a informação de acordo com seus interesses espaciais. |
| **Publish/Subscribe (Pub/Sub)** | Clientes se inscrevem no barramento de eventos através de WebSockets e são notificados assincronamente quando eventos relevantes ocorrem. |
| **Distribuição Geo-Particionada** | O servidor calcula a distância geodésica (fórmula de Haversine) entre a origem do alerta e a localização atual de cada nó conectado, enviando a distância exata customizada para cada dispositivo. |
| **Consenso e Validação Coletiva** | Descoberta de verdade por consenso distribuído (crowdsourced consensus), onde múltiplos nós atestam a veracidade do estado da via pública. |
| **Persistência Relacional com MariaDB** | Armazenamento de dados transacionais com integridade ACID, controle concorrente de escrita e índices para consultas geoespaciais e temporais. |
| **Tolerância a Falhas & Desconexão** | Reconexão automática com backoff exponencial via WebSocket, fila de mensagens e mecanismo de heartbeat (ping/pong) para detecção de falha de nós. |

---

## 4. Tecnologias e Protocolos Empregados

- **Frontend Móvel / Multiplataforma**: React Native com Expo (SDK 57), TypeScript, React Native Safe Area Context, Expo Location.
- **Backend & Coordenação Distribuída**: Node.js, Express, WebSockets (`ws`), TypeScript.
- **Banco de Dados**: MariaDB (com pool de conexões gerenciado via `mysql2` e script de migração/criação automática de esquemas).
- **Containerização**: Docker e Docker Compose para fácil replicação e execução do ambiente de banco de dados.
- **Protocolos de Rede**:
  - **HTTP/REST (síncrono)**: Para operações CRUD estruturadas e consultas iniciais.
  - **WebSocket (assíncrono full-duplex)**: Para streaming de eventos, broadcast de alertas e métricas de topologia em tempo real.

---

## 5. Estrutura do Esquema do Banco de Dados (MariaDB)

### Tabela `alerts`
- `id` (VARCHAR(36) PK) — Identificador único universal (UUID)
- `title` (VARCHAR(120)) — Título descritivo do ponto (ex: Av. Ipiranga x Av. São João)
- `description` (TEXT) — Detalhes da situação e pontos de referência
- `latitude` (DECIMAL(10, 8)) — Coordenada de latitude
- `longitude` (DECIMAL(11, 8)) — Coordenada de longitude
- `address` (VARCHAR(255)) — Endereço textual
- `severity` (ENUM('low', 'moderate', 'high', 'critical')) — Grau do alagamento
- `water_level` (VARCHAR(50)) — Nível da água (ex: 20cm, Metade da roda, Carros submersos)
- `cause` (VARCHAR(100)) — Causa observada (Chuva forte, bueiro entupido, transbordamento)
- `status` (ENUM('active', 'resolved')) — Estado atual do alerta
- `reported_by` (VARCHAR(100)) — Identificador do nó originador
- `confirmations` (INT) — Quantidade de confirmações comunitárias
- `created_at` (DATETIME) — Carimbo de data/hora do registro
- `resolved_at` (DATETIME NULL) — Carimbo de data/hora do encerramento
- `resolved_by` (VARCHAR(100) NULL) — Identificador do nó que encerrou

---

## 6. Resultados Esperados e Entregáveis

1. **Aplicação Móvel Funcional**: Interface moderna, intuitiva e reativa com feed de alertas, radar de proximidade, mapa e formulário de reporte.
2. **Servidor Distribuído com MariaDB**: API REST e broker WebSocket com cálculo geoespacial ativo.
3. **Monitor Visual de Topologia Distribuída**: Tela no próprio aplicativo que demonstra graficamente os nós da rede, o broker central, o banco MariaDB e a passagem de pacotes em tempo real.
4. **Relatório Técnico e Guia de Execução**: Instruções de instalação, execução via Docker e documentação dos endpoints.

---

**Submetido para análise do Coordenador Auxiliar.**  
*Projeto desenvolvido para a disciplina de Sistemas Distribuídos.*
