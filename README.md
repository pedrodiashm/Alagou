# Alagou 🌊

Sistema distribuído de **alertas de alagamento em tempo real**. Um app que mostra onde está alagado agora, deixa qualquer pessoa reportar um ponto de alagamento e sincroniza tudo na hora para os outros usuários ao redor — no celular e na web.

Feito com "vibe coding": uma mistura de product thinking + código gerado por IA + ajustes manuais, empilhado sobre um backend de sistemas distribuídos estilo acadêmico.

---

## 🎯 O que é / funcionalidades

- **Alertas de alagamento em tempo real**: cada alerta tem título, descrição, local (lat/lng), endereço, severidade (`low`, `moderate`, `high`, `critical`), nível d'água e causa.
- **Reporte colaborativo**: qualquer pessoa registra um alagamento; outras pessoas **confirmam** o alerta — um mini-consenso para evitar falso positivo.
- **Notificações por proximidade (geo-routing)**: o servidor calcula a distância (Haversine) de cada alerta até cada usuário conectado e a roteia para quem está perto.
- **Tempo real via WebSocket**: novos alertas, resoluções e confirmações são difundidos instantaneamente para os nós conectados (`ALERT_BROADCAST`, `ALERT_RESOLVED`, `ALERT_CONFIRMED`, `TOPOLOGY_UPDATE`).
- **Dashboard/topologia**: monitor da rede distribuída (nós conectados, pacotes e status do socket).
- **Filtros**: todos / ativos / perto de mim / resolvidos.
- **Modo simulação acadêmica**: endpoint que simula o fluxo "Dispositivo A produz → servidor roteia para B (500m) e C (800m)".

---

## 🧱 Stack e tecnologias

| Camada | Tecnologia |
|--------|------------|
| App (celular + web) | [Expo SDK 57](https://expo.dev) / React Native 0.86 / React 19, `expo-router` (file-based routing) |
| Backend | Node.js + Express 5 (TypeScript, executado com `tsx`) |
| Tempo real | WebSocket (`ws`) com protocolo próprio de mensagens distribuídas |
| Banco de dados | MariaDB 11.4 (via `mysql2`), com *fallback em memória* se o banco estiver fora |
| Proxy/reverse proxy | Nginx (serve o build web estático + proxy `/api/*` e `/ws` para o backend) |
| Deploy | Docker + Docker Compose (3 serviços) na AWS EC2 Free Tier |
| Build mobile | EAS Build (geração de APK/AAB) |

---

## 🏗️ Arquitetura

```
Celular (Expo Go/APK)  ──┐
Navegador (web)        ──┼──▶ http://<IP_PUBLICO>  (porta 80)
                         │
                    ┌────▼─────────────────┐
                    │  web_gateway (Nginx) │  → serve o frontend (HTML/JS/CSS)
                    │  porta 80            │  → /api/*  → backend:3001
                    │                      │  → /ws     → backend:3001
                    └────┬─────────────────┘
                         │
                    ┌────▼──────┐    ┌──────────┐
                    │  Backend  │───▶│  MariaDB │
                    │  (3001)   │    │  (3306)  │
                    └───────────┘    └──────────┘
```

- **Frontend** (`src/`): em produção é exportado como site estático pela imagem `web_gateway` (Expo export + Nginx). No app/PN igual, mas com URLs absolutas vindas de variáveis de ambiente.
- **Backend** (`server/`): REST API + WebSocket. Usa uma camada de "sistemas distribuídos" (`distribuição` de mensagens, registro de nós, heartbeat).
- **Banco**: MariaDB; faz *auto-migração* das tabelas e carrega alertas de demonstração no primeiro boot. Se o banco falhar, o servidor segue no topo da memória (modo apresentação).

---

## 📁 Estrutura do projeto

```
server/                 → backend Node/Express + WebSocket
  src/server.ts         → API REST + servidor WS
  src/store.ts          → banco + fallback em memória
  src/distribution.ts   → lógica de nós / difusão de mensagens
  src/db/connection.ts  → conexão MariaDB + auto-migração
src/                    → app Expo (React Native + Web)
  app/                  → rotas (expo-router): index, explore, proposal
  components/           → cards, mapa, modal, monitor de rede, etc.
  services/api.ts       → cliente REST
  services/socket.ts    → cliente WebSocket
  hooks/use-alerts.ts   → estado dos alertas + integração WS
nginx.conf              → config do Nginx (HTTP; template HTTPS em nginx.https.conf)
Dockerfile.web          → build do Expo Web + Nginx
docker-compose.yml      → ambiente local de desenvolvimento (banco)
docker-compose.prod.yml → produção: mariadb + backend + web_gateway
eas.json                → perfis de build mobile (EAS)
scripts/                → deploy/testes na EC2
```

---

## 🚀 Rodando em desenvolvimento

### 1. Suba o banco de dados

```bash
npm install
npm run db:up            # docker compose up -d (MariaDB) — requer DB_* no .env
npm run db:down          # para o banco
```

> O Docker Compose exige as variáveis `DB_USER`, `DB_PASSWORD`, `DB_NAME` e `DB_ROOT_PASSWORD` em um arquivo `.env` (veja a seção de produção).

### 2. Rode o backend

```bash
npm run server           # tsx server/src/server.ts → http://localhost:3001
```

### 3. Rode o app

```bash
npm start                # Expo (QR code / teclas a/i/w)
# ou:
npm run web              # web: http://localhost:8081
npm run android
npm run ios
```

No modo web em dev, o app detecta que há porta e chama o backend em `localhost:3001` automaticamente.

---

## ☁️ Deploy de produção (AWS + Docker)

O stack inteiro roda com **Docker Compose** em uma EC2 (t3.micro / t4g.small Free Tier):

```bash
bash scripts/testar-ec2.sh <IP_PUBLICO> ~/.ssh/sua-chave.pem
```

O script empacota o projeto, envia via `scp`, cria o `.env`, instala Docker se preciso e sobe os 3 containers (build nativo na arquitetura da instância).

### Variáveis de ambiente (`.env` — nunca versionado)

O projeto **não** tem senha padrão: o Docker Compose falha de propósito se faltar credencial.

```env
DB_HOST=mariadb
DB_PORT=3306
DB_USER=alagou_user
DB_NAME=alagou_db
DB_PASSWORD=<senha forte>
DB_ROOT_PASSWORD=<outra senha forte>
```

Para o **APK**, o `eas.json` já define as URLs do app no build:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "http://<IP_PUBLICO>",
  "EXPO_PUBLIC_WS_URL": "ws://<IP_PUBLICO>/ws"
}
```

> ⚠️ **HTTPS**: sem domínio, não há certificado confiável para IP puro — o projeto roda em HTTP. Quando tiver um domínio, ative o `nginx.https.conf` (Let's Encrypt) e troque para `https://` / `wss://`. Passo a passo completo: [GUIA_DEPLOY_AWS.md](GUIA_DEPLOY_AWS.md).

---

## 📱 Gerando o APK (EAS Build)

```bash
npx eas-cli login        # primeira vez
npx eas-cli build:configure  # primeira vez
npm run apk              # build na nuvem (APK → instala no celular)
npm run apk:local        # build local (exige Android SDK)
```

---

## 🧰 Scripts úteis

| Comando | O que faz |
|---------|-----------|
| `npm start` | Expo dev server |
| `npm run server` | Backend (Express + WS) em `localhost:3001` |
| `npm run db:up` / `db:down` | Sobe/para o MariaDB local |
| `npm run apk` | Gera APK via EAS Build |
| `npm run lint` | ESLint do app |
| `bash scripts/testar-ec2.sh <IP> <pem>` | Deploy/teste na EC2 |

---

## 📄 Licença

MIT — veja [LICENSE](LICENSE).

---

Feito para o trabalho/disciplina de sistemas distribuídos, com muita vibração 🌊 e a ajuda de modelos de linguagem.