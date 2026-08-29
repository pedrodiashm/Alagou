# Plano de Deploy do Alagou na AWS (Sem Domínio Próprio)

Este plano detalha como adaptar e empacotar a arquitetura completa do projeto **Alagou** (Frontend Expo Web, Backend Node.js com WebSockets e Banco MariaDB) para deploy em um servidor **AWS EC2 (Free Tier)** utilizando **Docker Compose** e **Nginx** como Proxy Reverso.

---

## 🏗️ Arquitetura de Deploy na AWS

Como você não possui um domínio registrado, a estratégia mais robusta, econômica e simples é utilizar um **Reverse Proxy (Nginx)** unificando o Frontend e o Backend sob o mesmo **IP Público da AWS (ou DNS público do EC2)** na porta padrão `80` (HTTP):

```mermaid
graph TD
    User["📱 Usuários Móveis / Web (Internet)"] -->|Acessa http://IP_PUBLICO_AWS| Nginx["🛡️ Nginx Reverse Proxy (Porta 80)"]
    
    subgraph AWS EC2 Instance ["☁️ Instância AWS EC2 (Ubuntu Free Tier)"]
        Nginx -->|/ (HTML/CSS/JS Estático)| Front["📱 Expo Web Build (dist/)"]
        Nginx -->|/api/* (Chamadas REST)| Back["⚙️ Backend Node.js API (Porta 3001)"]
        Nginx -->|/ws (WebSocket Stream)| Back
        Back -->|Persistência SQL| DB[("🗄️ MariaDB Container (Porta 3306)")]
    end
```

### Vantagens dessa Abordagem:
1. **Sem Domínio:** Acesso direto via `http://<IP_DA_AWS>` ou `http://ec2-xx-xx-xx-xx.compute-1.amazonaws.com`.
2. **Sem Erros de CORS / Portas:** Como o Frontend e a API rodam sob a mesma origem (`/` e `/api`), não há bloqueios de segurança do navegador.
3. **Custo Zero (AWS Free Tier):** Roda perfeitamente em uma instância `t4g.small` (2 GB, Graviton/ARM — melhor custo/benefício) ou `t3.micro` (1 GB) com 30GB de disco gratuito por 12 meses. O stack inteiro consome apenas ~170 MB em execução.
4. **Deploy com 1 Comando:** Usando Docker Compose com build multi-etapa, subir o sistema todo no servidor será tão simples quanto rodar `docker compose -f docker-compose.prod.yml up -d --build`.

---

## 📋 Alterações Propostas no Código

### 1. Configuração do Nginx e Dockerfiles

#### [NEW] [`nginx.conf`](file:///home/ubel/Alagou/nginx.conf)
- Configura o Nginx para servir os arquivos estáticos do Expo Web (`/dist`).
- Faz o proxy reverso transparente de `/api/` para `http://backend:3001/api/`.
- Faz o upgrade e proxy do WebSocket de `/ws` para `ws://backend:3001/ws`.

#### [NEW] [`server/Dockerfile`](file:///home/ubel/Alagou/server/Dockerfile)
- Imagem Node.js otimizada para o backend TypeScript/tsx e conexão com o MariaDB.

#### [NEW] [`Dockerfile.web`](file:///home/ubel/Alagou/Dockerfile.web)
- Build multi-stage: compila o Expo Web (`npx expo export -p web`) e injeta os arquivos no Nginx.

#### [NEW] [`docker-compose.prod.yml`](file:///home/ubel/Alagou/docker-compose.prod.yml)
- Orquestra os 3 serviços em produção:
  - `mariadb`: com volume persistente.
  - `backend`: com auto-restart e dependência do banco.
  - `web_gateway`: Nginx servindo a porta 80 e encaminhando tráfego.

### 2. Ajustes no Frontend e Scripts

#### [MODIFY] [`src/services/api.ts`](file:///home/ubel/Alagou/src/services/api.ts) e [`src/services/socket.ts`](file:///home/ubel/Alagou/src/services/socket.ts)
- Adicionar suporte a caminhos relativos quando executado atrás do Nginx (ex: quando acessado via `http://IP_DA_AWS/`, a API usa `/api` e o WebSocket usa `/ws` diretamente, sem precisar de portas extras).

#### [NEW] [`scripts/aws-deploy.sh`](file:///home/ubel/Alagou/scripts/aws-deploy.sh)
- Script automatizado para preparar a máquina Ubuntu na AWS (instalação de Docker, Docker Compose, clone do repo e start do compose).

#### [NEW] [`GUIA_DEPLOY_AWS.md`](file:///home/ubel/Alagou/GUIA_DEPLOY_AWS.md)
- Passo a passo visual de como criar a instância EC2 no console da AWS, configurar o Security Group (abrir portas 80, 22) e rodar o projeto.

---

## ✅ Status da Implementação

Todos os arquivos acima foram criados. Foram feitos ainda dois ajustes necessários para viabilizar o build:

### Ajustes extras
- **`package.json` / `app.json`**: alinhados ao **Expo SDK 57** (o `package-lock.json` já referenciava versões `~57.0.x`). Sem essa correção o `npm ci` falhava por inconsistência entre `package.json` (SDK 54) e o lockfile (SDK 57).
- **`server/package.json` e `server/tsconfig.json`**: novos, tornam o backend auto-contido no build Docker (o backend antes dependia apenas do `package.json` da raiz).
- **`.dockerignore`**: evita copiar `node_modules`, `.git`, `dist` etc. para o contexto de build.
- Backend Dockerfile simplificado (instala todas as deps para rodar com `tsx`).

### Verificação (concluída com sucesso)
1. `npx expo export -p web` → gera `dist/` sem erros.
2. `docker compose -f docker-compose.prod.yml up -d --build` → os 3 serviços (mariadb, backend, web_gateway) sobem e ficam **healthy**.
3. Testes efetivos:
   - `http://localhost/` → servido (HTTP 200).
   - `http://localhost/api/health` → `{ status: "online", database.connected: true }`.
   - `http://localhost/api/alerts` → retorna lista de alertas.
   - WebSocket `ws://localhost/ws` através do Nginx → registra nó com sucesso.

### Otimização para o Free Tier (instância mais barata que funciona)
- **Instância recomendada:** `t4g.small` (2 GB, Graviton/ARM) — grátis no Free Tier, dobro da RAM dos micros.
- **MariaDB em modo leve** (`docker-compose.prod.yml`): `innodb-buffer-pool-size=64M`, `performance-schema=OFF`, cache reduzido → ~68 MB.
- **Node com heap limitado**: `NODE_OPTIONS=--max-old-space-size=256` → ~90 MB.
- **Nginx enxuto** → ~10 MB.
- **Limites de memória por container** (`deploy.resources.limits`).
- **Swap automático** no `scripts/aws-deploy.sh` para instâncias < 2 GB (evita OOM killer).
- **Consumo total verificado em execução: ~170 MB** — cabe folgado em qualquer instância do Free Tier.

### Manual / AWS
1. Testar o script de deploy na instância AWS EC2 criada pelo usuário.
2. Validar o acesso pelo IP público via celular e navegador.

---

> [!NOTE]
> Você já possui uma conta na AWS criada para criarmos a instância EC2, ou precisa de orientações desde o cadastro?
