# 🚀 Guia de Deploy do Alagou na AWS (Free Tier)

Este guia mostra, passo a passo, como criar uma instância **EC2** na AWS usando o **Free Tier** (opção mais barata possível que roda o projeto inteiro), configurar o Security Group e rodar o **Alagou** completo (Frontend Expo Web + Backend Node.js + MariaDB) com Docker Compose + Nginx.

---

## 💰 Qual a instância mais barata que funciona?

A AWS oferece **duas faixas de Free Tier** para EC2, dependendo de quando sua conta foi criada:

| Conta criada | Instâncias grátis | RAM | Recomendação |
|--------------|-------------------|-----|--------------|
| **Antes de 15/07/2025** | `t3.micro` (ou `t2.micro` em algumas regiões) | 1 GB | Funciona (com swap) |
| **No/antes de 15/07/2025** | `t3.micro`, `t3.small`, **`t4g.micro`**, **`t4g.small`** | 1–2 GB | **`t4g.small` é a melhor opção** |

### 🏆 Melhor escolha: `t4g.small` (Graviton/ARM, 2 GB RAM) — grátis

- **2 GB de RAM** (o dobro do micro) → roda MariaDB + Node + Nginx com **folga**, sem risco de OOM killer.
- **Graviton2 (ARM)** → até 40% melhor custo/desempenho que as instâncias T3 (x86).
- O stack inteiro usa **imagens Docker multi-arquitetura** (node, nginx, mariadb), então funciona nativamente em ARM, **sem nenhuma mudança no código**.

> Se sua conta só tiver direito ao `t3.micro` (1 GB), **também funciona**: o projeto foi otimizado para usar apenas ~170 MB de RAM com o MariaDB em modo leve e a criação automática de swap (veja [Otimizações](#%EF%B8%8F-otimiza%C3%A7%C3%B5es-para-o-free-tier)).

---

## 🧱 Resumo da Arquitetura

```
Usuários (celular / navegador)
        │
        ▼
http://<IP_PUBLICO_DA_INSTANCIA>   (porta 80)
        │
   ┌────▼──────────────┐
   │ Nginx (web_gateway)│  → serve o Frontend (HTML/JS)
   │  porta 80          │  → /api/*  → backend:3001
   │                    │  → /ws     → backend:3001 (WebSocket)
   └────┬──────────────┘
        │
   ┌────▼──────┐    ┌──────────┐
   │  Backend  │───▶│  MariaDB │
   │ (3001)    │    │  (3306)  │
   └───────────┘    └──────────┘
```

---

## 📦 Passo 1 — Criar a Instância EC2

1. Entre no **Console da AWS**: https://console.aws.amazon.com
2. No menu superior, selecione a região **N. Virginia (us-east-1)** ou outra de baixo custo.
3. Pesquise por **EC2** e clique em **Instances → Launch instances**.
4. Preencha:
   - **Name:** `alagou-server`
   - **Application and OS Images:** Ubuntu Server 24.04 LTS (HVM), arquitetura **ARM (64-bit - Arm)** para instâncias `t4g.*` (recomendado) **ou x86** para instâncias `t3.*`.
   - **Instance Type:**
     - **`t4g.small`** (2 GB, Graviton/ARM) → **recomendado** (2× a RAM do micro, grátis).
     - `t4g.micro` ou `t3.micro` (1 GB) → também funciona, o projeto já está otimizado.
   - **Key pair (login):** crie uma nova key pair (ex.: `alagou-key`). **Baixe o arquivo `.pem` e guarde-o com segurança — você precisa dele para acessar via SSH.**
   - **Network settings:**
     - Clique em **Edit**.
     - **Allow SSH traffic from:** My IP (ou o IP da sua máquina).
     - **Allow HTTP traffic from the internet:** ✅ marcar (porta 80).
     - **Allow HTTPS:** opcional.
   - **Configure storage:** mantenha o padrão (8–30 GB gp3). O Free Tier dá 30 GB grátis.
5. Clique em **Launch instance** e aguarde o status **Running**.

> ⚠️ **Importante:** O Security Group precisa **no mínimo** 2 regras:
> - **SSH (porta 22)** — para você administrar o servidor.
> - **HTTP (porta 80)** — para os usuários acessarem o Alagou.

Se esqueceu, edite o Security Group em **EC2 → Security Groups → Edit inbound rules** e adicione **HTTP → Anywhere-IPv4 (0.0.0.0/0)** e **SSH → Meu IP**.

---

## 🔑 Passo 2 — Conectar via SSH

No terminal do seu computador:

```bash
# Ajuste a permissão da chave (só a primeira vez)
chmod 400 ~/Downloads/alagou-key.pem

# Conecte (troque o IP pelo IP público da sua instância)
ssh -i ~/Downloads/alagou-key.pem ubuntu@<IP_PUBLICO_DA_INSTANCIA>
```

Você verá o IP público no console da AWS na descrição da instância, ou rode:

```bash
curl http://checkip.amazonaws.com   # (já na instância)
```

---

## ⚙️ Passo 3 — Rodar o Deploy & Teste Automatizado

Como ainda não há repositório Git remoto configurado, o jeito mais direto de **testar e subir** o projeto na EC2 é usando o script de envio + build + verificação (via `scp`/`ssh`), direto da sua máquina:

```bash
# No seu computador, na pasta do projeto:
#   <IP>   = IP público da sua instância EC2
#   <arq>  = caminho para o arquivo .pem da key pair (opcional)
bash scripts/testar-ec2.sh <IP_PUBLICO_DA_INSTANCIA> ~/Downloads/alagou-key.pem
```

O que esse script faz (tudo automaticamente):
1. **Empacota** o projeto (sem `node_modules`, `.git`, `dist` — ~1,5 MB).
2. **Envia** o pacote para a EC2 via `scp`.
3. **Prepara** o diretório, cria o `.env` e, se necessário, cria swap e instala Docker.
4. **Build e sobe** o `docker-compose.prod.yml` **na arquitetura nativa** da EC2 (ARM no `t4g.small` / x86 no `t3`).
5. **Verifica** que os 3 serviços ficam `healthy` e exibe as URLs públicas no final.

> 💡 Esse script é o caminho recomendado para o seu caso (projeto ainda não no GitHub). Quando você criar um repositório (ex.: no GitHub), pode usar o fluxo do `scripts/aws-deploy.sh`, que clona o repo diretamente.

---

## 🔄 Passo 4 — Primeiro Deploy Manual (Alternativa ao Script)

Se preferir fazer tudo na mão, dentro da instância:

```bash
# 1) Atualizar sistema
sudo apt-get update -y

# 2) Instalar Docker
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Liberar uso do docker sem sudo (reconecte depois)
sudo usermod -aG docker $USER
```

Reconecte o SSH e continue:

```bash
# 3) Subir o ambiente de produção (na pasta do projeto)
cd alagou
docker compose -f docker-compose.prod.yml up -d --build
```

---

## ✅ Passo 5 — Verificar o Deploy (testes de validação)

Acesse no navegador (ou no celular):

```
http://<IP_PUBLICO_DA_INSTANCIA>
```

### Checklist de testes (rode na sua máquina, contra o IP público)

Da **sua máquina local**, execute estes testes para confirmar que o deploy está saudável:

```bash
IP=<IP_PUBLICO_DA_INSTANCIA>

# 1) Frontend web está sendo servido?
curl -s -o /dev/null -w "Frontend HTTP: %{http_code}\n" http://$IP/

# 2) API / health responde com banco conectado?
curl -s http://$IP/api/health

# 3) API lista os alertas de alagamento?
curl -s http://$IP/api/alerts | python3 -m json.tool | head

# 4) WebSocket conecta e registra um nó?
node -e '
const WebSocket = require("ws");
const ws = new WebSocket("ws://'"$IP"'/ws");
const t = setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 6000);
ws.on("open", () => ws.send(JSON.stringify({type:"CLIENT_REGISTER", timestamp:new Date().toISOString(), payload:{deviceId:"teste", deviceName:"Teste Deploy"}})));
ws.on("message", (d) => { const m=JSON.parse(d.toString()); if(m.type==="CLIENT_REGISTERED"){console.log("WebSocket OK - registrado"); clearTimeout(t); process.exit(0);} });
ws.on("error", (e) => { console.log("WS ERROR:", e.message); clearTimeout(t); process.exit(1); });
'
```

O que esperar:
- **Frontend** → `HTTP: 200`.
- **API health** → `{ "status": "online", "database": { "connected": true }, ... }`.
- **Alertas** → JSON com `count` de alertas (>= 1, pois há dados de demonstração).
- **WebSocket** → `WebSocket OK - registrado`.

Para acompanhar logs/estado dos containers (dentro da EC2):

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web_gateway
```

---

## 🔄 Atualizando o Projeto

```bash
cd ~/alagou
git pull --rebase
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 🧹 Parando / Reiniciando

```bash
# Parar todos os serviços
docker compose -f docker-compose.prod.yml down

# Reiniciar
docker compose -f docker-compose.prod.yml start
```

> Os dados ficam gravados no **volume Docker** `mariadb_data` e sobrevivem a `down`/`up`. Só são apagados com `down -v`.

---

## 🔐 Segurança: senhas do banco

O projeto **não** vem com senha padrão. As credenciais são definidas no `.env` (que não é versionado) e o Docker Compose **falha de propósito** se estiverem vazias:

```bash
cd ~/alagou
nano .env   # preencha DB_PASSWORD e DB_ROOT_PASSWORD com senhas fortes
```

- Variáveis obrigatórias no `.env`: `DB_HOST=mariadb`, `DB_PORT=3306`, `DB_USER`, `DB_NAME`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`.
- **Ao trocar as senhas de um banco já existente**, é obrigatório apagar o volume, porque o MariaDB só aplica `MYSQL_PASSWORD` no **primeiro boot**:
  ```bash
  docker compose -f docker-compose.prod.yml down -v   # apaga o volume mariadb_data
  docker compose -f docker-compose.prod.yml up -d --build
  ```
  ⚠️ Isso apaga os alertas cadastrados (recriados automaticamente com os dados de demonstração).
- O script `scripts/testar-ec2.sh` também se recusa a subir se as senhas estiverem em branco.

---

## 🔒 Quando tiver um domínio (HTTPS real)

O projeto roda em HTTP usando o IP puro (sem domínio não há certificado confiável). Quando você tiver um domínio:

1. **Compre/aponte o domínio**: registre um domínio (ex.: `alagou.com.br`) e crie um **A record** `<nome> → 18.119.128.199`.
2. **Abra a porta 443** no Security Group da EC2 (inbound `HTTPS → 0.0.0.0/0`).
3. **Emita o certificado** no servidor (Let's Encrypt via nginx webroot):
   ```bash
   sudo apt-get install -y certbot
   sudo certbot certonly --webroot -w /usr/share/nginx/html -d alagou.com.br
   ```
   (o `web_gateway` já serve o frontend na porta 80 para o desafio HTTP)
4. **Monte o certificado** no container `web_gateway`:
   - Copie `nginx.https.conf` para `nginx.conf` (troque `alagou.example.com` pelo seu domínio).
   - No `docker-compose.prod.yml`, adicione ao serviço `web_gateway`:
     ```yaml
     ports:
       - "80:80"
       - "443:443"
     volumes:
       - /etc/letsencrypt:/etc/letsencrypt:ro
     ```
5. **Recrie o gateway** e atualize o app:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build web_gateway
   ```
   - `eas.json` → `EXPO_PUBLIC_API_URL=https://alagou.com.br` e `EXPO_PUBLIC_WS_URL=wss://alagou.com.br/ws`.
   - `app.json` → pode remover `usesCleartextTraffic: true` (Android).
   - O web/lógica já detecta `https`/`wss` automaticamente em `src/services/api.ts` e `src/services/socket.ts`.

---

## 💰 Custo (Free Tier)

| Recurso | Custo |
|---------|-------|
| `t4g.small` / `t3.micro` | **$0** dentro do Free Tier |
| 30 GB gp3 | **$0** dentro do Free Tier |
| Transferência de dados (mínima) | Em geral dentro da franquia |

> ⚠️ **Atenção após o término do Free Tier:** quando o benefício expirar (12 meses, ou 6 meses nos novos planos), a instância passa a ser cobrada. Para **migrar para o pago mais barato**, o `t4g.small` (~US$0,0336/h ≈ **US$8–10/mês** em uma instância) é uma das opções mais econômicas da AWS, ou considere **Hetzner** (~US$5/mês com 4 GB) se quiser migrar de provedor.

---

## ⚙️ Otimizações para o Free Tier (já embutidas)

Para garantir que o stack inteiro rode de forma estável mesmo em uma instância de **1 GB**, o projeto já inclui:

1. **MariaDB em modo leve** (`docker-compose.prod.yml`): `innodb-buffer-pool-size=64M`, `performance-schema=OFF`, cache reduzido etc. → usa apenas ~68 MB de RAM.
2. **Node com heap limitado**: `NODE_OPTIONS=--max-old-space-size=256` no backend → usa ~90 MB de RAM.
3. **Nginx enxuto**: ~10 MB de RAM.
4. **Limites de memória por container** (`deploy.resources.limits`): impede que um container estoure a memória da instância.
5. **Swap automático** (no script de deploy): em instâncias < 2 GB, o script cria um swapfile de 1 GB e ajusta o `swappiness` — evita o OOM killer derrubar o banco/o servidor.

**Consumo total em execução: ~170 MB** — cabe com folga em qualquer instância do Free Tier.

---

## ❓ Problemas Comuns

**A página abre mas a API não responde (erro 502/504)?**
- Verifique se o backend subiu: `docker compose -f docker-compose.prod.yml logs backend`.
- Confirme que o banco está saudável (o backend só inicia depois da saúde do MariaDB).

**Não consigo acessar `http://IP`?**
- O Security Group deve permitir **HTTP (porta 80)** entrando de `0.0.0.0/0`.

**O celular não conecta no WebSocket?**
- Confirme que a porta 80 está aberta e que o navegador acessa `http://<IP>` (sem porta extra).

**O build do frontend demora/trava na EC2 (t4g.small ARM)?**
- É esperado que o `expo export` demore alguns minutos na primeira vez. Verifique o progresso com:
  ```bash
  docker compose -f docker-compose.prod.yml logs web_gateway
  ```
- Se travar por falta de memória, garanta que o swap foi criado (o script cria automaticamente em instâncias < 2 GB):
  ```bash
  swapon --show   # deve mostrar /swapfile
  ```
- Reforço: rodar `docker compose -f docker-compose.prod.yml build` separadamente (antes do `up`) ajuda a isolar erros de build dos de runtime.

**Recebi erro de arquitetura/`exec format error` ao subir containers?**
- Isso indica que a imagem foi construída numa arquitetura diferente da instância. Sempre faça o **build na própria EC2** (o que os scripts fazem), nunca envie imagens construídas na sua máquina local. Se acontecer, remova as imagens e reconstrua na EC2:
  ```bash
  docker compose -f docker-compose.prod.yml down -v
  docker compose -f docker-compose.prod.yml build --no-cache
  docker compose -f docker-compose.prod.yml up -d
  ```

---

## 📁 Estrutura dos Arquivos de Produção

```
nginx.conf              → config do Nginx (proxy reverso + WebSocket)
Dockerfile.web          → build do Expo Web + Nginx
server/Dockerfile       → build do backend Node.js
docker-compose.prod.yml → orquestra mariadb + backend + web_gateway
scripts/aws-deploy.sh   → automação do deploy na EC2 (via clone do repo)
scripts/testar-ec2.sh   → envia + build + verifica na EC2 (via scp/ssh) — recomendado
GUIA_DEPLOY_AWS.md      → este passo a passo
```

---

## 📱 Gerar um APK instalável (EAS Build)

> ⚠️ **Importante:** o **Expo Go não gera APK**. Ele é apenas um sandbox para testar em tempo real. Para gerar um `.apk` instalável de verdade, use o **EAS Build** (build nativo na nuvem da Expo).

### 1. Tudo já configurado

O projeto já contém:
- `eas.json` → perfis `preview` (gera `.apk`) e `production` (gera `.aab`).
- `app.json` → `android.package: "com.alagou.app"` e `usesCleartextTraffic: true` (permite HTTP para a AWS sem HTTPS).
- `.easignore` → evita enviar o backend/servidor desnecessariamente para o build.
- Scripts: `npm run apk` e `npm run apk:local`.

### 2. IP público já preenchido

O `eas.json` (perfis `preview` e `production`) já aponta para a instância atual:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "http://18.119.128.199",
  "EXPO_PUBLIC_WS_URL": "ws://18.119.128.199/ws"
}
```

> Se a instância EC2 for recriada (muda o IP público) ou tiver domínio (HTTPS), atualize esses valores.

### 3. Logar na conta Expo

```bash
npx eas-cli login
```

### 4. Configurar o projeto (somente a primeira vez)

```bash
npx eas-cli build:configure
```

### 5. Gerar o APK

```bash
# Build na nuvem da Expo (gera o .apk e baixa quando terminar)
npm run apk

# OU build local (precisa de Android SDK instalado na sua máquina)
npm run apk:local
```

Ao final, você recebe um link para baixar o arquivo `.apk` e instalá-lo direto no celular.

### 6. Observações

- O **APK nativo** (fora do Expo Go) faz chamadas HTTP para o IP da AWS. O `usesCleartextTraffic` permite isso. Se futuramente usar HTTPS, pode remover.
- O backend/banco continuam rodando na EC2 via Docker Compose (fluxo da primeira parte do guia). O EAS Build apenas compila o app; ele **não** sobe o backend.
- O app só funcionará depois que a EC2 estiver no ar com o Docker Compose rodando (senão a API não responde).

---
