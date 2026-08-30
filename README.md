# Alagou 🌊

Sistema distribuído de **alertas de alagamento em tempo real**. Um app que mostra onde está alagado agora, deixa qualquer pessoa reportar um ponto de alagamento e sincroniza tudo na hora para quem está ao redor — no celular (Android) e na web.

Feito com "vibe coding": uma mistura de product thinking + código gerado por IA + ajustes manuais, empilhado sobre um backend de sistemas distribuídos estilo acadêmico.

---

## 🎯 Funcionalidades

- **Alertas de alagamento em tempo real**: título, descrição, localização (lat/lng), endereço, severidade (`low`, `moderate`, `high`, `critical`), nível d'água e causa.
- **Reporte colaborativo**: qualquer pessoa registra um alagamento ("Alagou!"); outras confirmam o alerta — um mini-consenso para evitar falso positivo.
- **Notificações push por proximidade**: o servidor cobre todos os nós conectados a ≤ 1 km do foco com uma notificação push (FCM/Expo Push Service), mesmo com o app fechado. O produtor também é notificado.
- **Geo-routing (Haversine)**: para cada alerta, o servidor calcula a distância exata até cada usuário conectado e envia a distância personalizada (`500m`, `800m`, `1.2 km`…).
- **Tempo real via WebSocket**: novas alertas, resoluções e confirmações são difundidos instantaneamente (`ALERT_BROADCAST`, `ALERT_RESOLVED`, `ALERT_CONFIRMED`, `TOPOLOGY_UPDATE`), com reconexão automática e heartbeat.
- **Radar geoespacial no mapa**: posição dos focos ao redor do usuário com toque-para-definir-posição na web (sem GPS fora de HTTPS).
- **Redes de localização inteligente**: GPS nativo no app Android (com fallback para a última posição conhecida) e seletor manual no radar para navegadores em HTTP.
- **Monitor de topologia**: nós conectados, logs de pacotes distribuídos e status do socket para visualização acadêmica.
- **Filtros**: todos / ativos / perto de mim (<2 km) / resolvidos.
- **Modo simulação acadêmica**: endpoint que simula o fluxo "Dispositivo A produz → servidor roteia para B (500m) e C (800m)".

---

## 🧱 Stack e tecnologias

| Camada | Tecnologia |
|--------|------------|
| App (Android + web) | [Expo SDK 57](https://expo.dev) / React Native 0.86 / React 19, `expo-router`, React Native Web |
| Estado global | React Context (`AlertsProvider`) |
| Localização | `expo-location` (GPS + última posição conhecida) |
| Push | `expo-notifications` + Expo Push Service (FCM no Android), sem credenciais no servidor |
| Backend | Node.js + Express 5 (TypeScript, executado com `tsx`) |
| Tempo real | WebSocket (`ws`) com protocolo próprio de mensagens distribuídas |
| Banco de dados | MariaDB 11.4 (via `mysql2`), com *fallback em memória* se o banco estiver fora |
| Reverse proxy | Nginx (serve o estático + proxy `/api/*` e `/ws`) |
| CI/CD | GitHub Actions (lint, typecheck, build web e deploy automático na EC2) |
| Build mobile | EAS Build (APK/AAB) |
| Deploy | Docker Compose (3 serviços) na AWS EC2 Free Tier |

---

## 🏗️ Arquitetura

```
Android (APK)  ──┐
Navegador (web) ─┼──▶ http://<IP_PUBLICO>            (porta 80)
                 │
            ┌────▼─────────────────┐
            │  web_gateway (Nginx) │  → serve o frontend estático (Expo export)
            │  porta 80            │  → /api/*  → backend:3001
            │                      │  → /ws     → backend:3001
            └────┬─────────────────┘
                 │
            ┌────▼──────┐    ┌──────────┐
            │  Backend  │───▶│  MariaDB │
            │  (3001)   │    │  (3306)  │
            │  + Push   │    └──────────┘
            └────┬──────┘───▶ Expo Push Service (FCM)
```

- **Frontend** (`src/`): em produção vira um site estático (`web-dist/`) servido pelo Nginx, sem Node na EC2. A URL da API/WS é derivada da própria origem na web; no app Android vem de `EXPO_PUBLIC_*` injetadas no build do EAS.
- **Estado global**: `AlertsProvider` (Context) mantém alertas, localização, socket, push e estatísticas — uma única conexão de WebSocket para todas as telas.
- **Backend** (`server/`): REST API + WebSocket num mesmo processo. O módulo de **distribuição** registra nós, calcula distâncias, difunde mensagens, loga pacotes e dispara os push por proximidade.
- **Banco**: MariaDB com auto-migração das tabelas e seed de demonstração no primeiro boot. Se o banco falhar, o servidor segue no topo da memória (modo demonstração).

### Localização por plataforma

| Plataforma | Mecanismo |
|------------|-----------|
| Android (APK) | GPS nativo (`expo-location`), fallback para `getLastKnownPositionAsync()` |
| Web (HTTP) | toque no radar define a posição (geolocalização só funciona em HTTPS) |
| Web (HTTPS) | geolocalização do navegador — ativa ao configurar domínio |

### Notificações push

1. O app pede permissão e obtém um token do Expo Push Service (`registerForPushNotificationsAsync`).
2. O token vai junto no registro do nó (`CLIENT_REGISTER`) pela WebSocket.
3. Quando um alerta nasce, o servidor envia push aos nós com token a ≤ 1 km do foco (`NEARBY_PUSH_RADIUS_METERS`), incluindo o nó produtor — funciona com o app fechado. Zero credenciais no servidor.

---

## 📁 Estrutura do projeto

```
.github/workflows/ci.yml → CI/CD: checks + deploy automático na EC2
server/                  → backend Node/Express + WebSocket
  src/server.ts          → API REST + servidor WS (/ws)
  src/store.ts           → banco + fallback em memória
  src/distribution.ts    → nós, difusão de mensagens, push por proximidade
  src/geo.ts             → Haversine + formatação de distância
  src/db/connection.ts   → MariaDB + auto-migração + seed
src/                     → app Expo (React Native + Web)
  app/                   → rotas (expo-router): index, explore, proposal
  components/            → radar-map-view, cards, modal, network-monitor…
  services/api.ts        → cliente REST
  services/socket.ts     → cliente WebSocket (reconexão + heartbeat)
  services/notifications.ts → push (permissão + token)
  hooks/use-alerts.tsx   → AlertsProvider: estado global + integração
nginx.conf               → config do Nginx (HTTP; template HTTPS em nginx.https.conf)
Dockerfile.web           → só serve o estático (web-dist) + nginx
docker-compose.prod.yml  → produção: mariadb + backend + web_gateway
eas.json                 → perfis de build mobile (EAS)
scripts/testar-ec2.sh    → deploy manual/teste na EC2
```

---

## 🚀 Rodando em desenvolvimento

### 1. Instale e suba o banco

```bash
npm install
npm run db:up            # docker compose up -d (MariaDB)
```

> O Docker Compose exige as variáveis `DB_USER`, `DB_PASSWORD`, `DB_NAME` e `DB_ROOT_PASSWORD` em um arquivo `.env` (veja a seção de produção).

### 2. Backend

```bash
npm run server           # tsx server/src/server.ts → http://localhost:3001
```

### 3. App

```bash
npm start                # Expo dev server (QR code / teclas a/i/w)
# ou:
npm run web              # web: http://localhost:8081
npm run android
```

Em dev web, o app detecta a porta e chama o backend em `localhost:3001` automaticamente.

---

## ☁️ Produção (AWS + Docker)

### Deploy manual

```bash
bash scripts/testar-ec2.sh <IP_PUBLICO> ~/.ssh/sua-chave.pem
```

O script (5 passos): **builda o Expo Web localmente** (`web-dist/`), empacota, envia via `scp`, extrai na EC2 e sobe os containers com `docker compose up --build`. O build pesado do Expo acontece na máquina de deploy (não na EC2), evitando bundles corrompidos por falta de memória no Free Tier.

### Variáveis de ambiente (`.env` — nunca versionado)

O projeto **não** tem senha padrão: o Compose falha de propósito se faltar credencial.

```env
DB_HOST=mariadb
DB_PORT=3306
DB_USER=alagou_user
DB_NAME=alagou_db
DB_PASSWORD=<senha forte>
DB_ROOT_PASSWORD=<outra senha forte>
```

### Deploy automático (CI/CD)

Ao dar **push na `main`** (ou manualmente via *Run workflow*), o GitHub Actions roda:
1. **CI** — lint, typecheck (app e servidor) e build do Expo Web.
2. **CD (deploy)** — se tudo passou, builda o `web-dist` no runner e executa o mesmo `scripts/testar-ec2.sh` via SSH.

> ⚠️ **HTTPS**: sem domínio não há certificado confiável para IP puro — o projeto roda em HTTP (a geolocalização do navegador fica desativada nesse caso; use o toque no radar). Quando tiver um domínio, ative o `nginx.https.conf` (Let's Encrypt) e troque para `https://` / `wss://`.

---

## 📱 Gerando o APK (EAS Build)

```bash
npx eas-cli login        # primeira vez
npm run apk              # build na nuvem → link de download do APK
npm run apk:local        # build local (exige Android SDK)
```

As URLs da API/WS do ambiente de produção vêm de `eas.json` (`EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL`).

---

## 🧰 Scripts úteis

| Comando | O que faz |
|---------|-----------|
| `npm start` | Expo dev server |
| `npm run server` | Backend (Express + WS) em `localhost:3001` |
| `npm run db:up` / `db:down` | Sobe/para o MariaDB local |
| `npm run apk` | Gera APK via EAS Build |
| `npm run lint` | ESLint do app (`expo lint`) |
| `cd server && npm run typecheck` | Typecheck do servidor |
| `bash scripts/testar-ec2.sh <IP> <pem>` | Deploy/teste na EC2 |

---

## 📄 Licença

MIT — veja [LICENSE](LICENSE).

---

Feito para o trabalho/disciplina de sistemas distribuídos, com muita vibração 🌊 e a ajuda de modelos de linguagem.