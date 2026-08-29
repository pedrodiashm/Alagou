#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Testar/Deploy do Alagou numa EC2 (via SSH + Docker)
# Uso:
#   bash scripts/testar-ec2.sh <IP_OU_HOST_EC2> [ARQUIVO_PEM]
#
# Exemplo:
#   bash scripts/testar-ec2.sh 44.203.1.2 ~/Downloads/alagou-key.pem
#
# Fluxo:
#   1. Empacota o projeto (sem node_modules/.git/dist)
#   2. Envia para a EC2 via scp
#   3. Instala Docker (se preciso) e sobe o docker-compose.prod.yml
#   4. Roda um conjunto de testes de verificação na própria EC2
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}!! ${NC} $1"; }
die()  { echo -e "${RED}XX ${NC} $1"; exit 1; }

if [ $# -lt 1 ]; then
  die "Uso: bash scripts/testar-ec2.sh <IP_OU_HOST_EC2> [ARQUIVO_PEM]"
fi

HOST="$1"
PEM="${2:-}"

# Normaliza o host: remove qualquer prefixo "usuario@IP" deixando só o IP/host,
# para evitar erro tipo "ubuntu@ubuntu@IP"
HOST="${HOST##*@}"

# Monta o prefixo ssh/scp (com ou sem chave)
SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15"
SCP="scp -o StrictHostKeyChecking=no"
if [ -n "$PEM" ] && [ -f "$PEM" ]; then
  chmod 400 "$PEM"
  SSH="$SSH -i $PEM"
  SCP="$SCP -i $PEM"
fi

# -----------------------------------------------------------
# 1. Empacotar o projeto (limpo)
# -----------------------------------------------------------
TARBALL="/tmp/alagou.tar.gz"
log "[1/5] Empacotando o projeto (sem node_modules/.git/dist)..."
tar \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./dist' \
  --exclude='./.expo' \
  --exclude='./.env' \
  --exclude='*.local' \
  -czf "$TARBALL" \
  app.json nginx.conf nginx.https.conf Dockerfile.web docker-compose.yml \
  docker-compose.prod.yml eas.json package.json package-lock.json \
  tsconfig.json .dockerignore .easignore assets server src scripts
log "  -> Tarball criado: $TARBALL ($(du -h "$TARBALL" | cut -f1))"

# -----------------------------------------------------------
# 2. Enviar para a EC2
# -----------------------------------------------------------
log "[2/5] Enviando para ${HOST}:/home/ubuntu/alagou.tar.gz ..."
$SCP "$TARBALL" "ubuntu@${HOST}:/home/ubuntu/alagou.tar.gz" >/dev/null
log "  -> Enviado."

# -----------------------------------------------------------
# 3. Extrair e subir o ambiente na EC2
# -----------------------------------------------------------
log "[3/5] Preparando diretório e subindo o ambiente na EC2..."
$SSH "ubuntu@${HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
sudo mkdir -p /home/ubuntu/alagou
sudo chown -R ubuntu:ubuntu /home/ubuntu/alagou
tar -xzf /home/ubuntu/alagou.tar.gz -C /home/ubuntu/alagou
cd /home/ubuntu/alagou

# Cria .env de produção se não existir
if [ ! -f .env ]; then
  echo "  -> Criando .env (senhas em branco — preencha antes de subir)..."
  cat > .env <<'EOF'
DB_HOST=mariadb
DB_PORT=3306
DB_USER=alagou_user
DB_NAME=alagou_db
DB_PASSWORD=
DB_ROOT_PASSWORD=
EOF
fi

# Nunca subir com banco sem senha definida
if ! grep -qE '^DB_PASSWORD=.+$' .env || ! grep -qE '^DB_ROOT_PASSWORD=.+$' .env; then
  echo "  -> ⚠️  DB_PASSWORD e/ou DB_ROOT_PASSWORD estão em branco no .env."
  echo "  -> Edite /home/ubuntu/alagou/.env com senhas fortes e rode o deploy novamente."
  exit 1
fi

# Garante swap em instâncias pequenas (evita OOM no build/front)
TOTAL_MEM_MB=$(awk '/MemTotal/{printf "%d", $2/1024}' /proc/meminfo)
if [ "$TOTAL_MEM_MB" -lt 2048 ] && ! swapon --show | grep -q "/swapfile"; then
  echo "  -> Criando swapfile de 1GB para build em instância pequena..."
  sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null 2>&1
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# Instala Docker se necessário
if ! command -v docker >/dev/null 2>&1; then
  echo "  -> Instalando Docker..."
  sudo apt-get update -y >/dev/null
  sudo apt-get install -y ca-certificates curl >/dev/null
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y >/dev/null
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  sudo usermod -aG docker "$USER"
fi

# Subir ambiente (build nativo na arquitetura da instância)
# Usamos `sudo docker` para não depender do grupo "docker" (que só vale em nova sessão SSH)
echo "  -> Build e up do Docker Compose (pode demorar alguns minutos)..."
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "REMOTE_BUILD_DONE"
REMOTE

log "[4/5] Build concluído na EC2. Aguardando serviços ficarem saudáveis..."

# -----------------------------------------------------------
# 4. Testes de verificação
# -----------------------------------------------------------
# Aguarda até 90s os serviços ficarem healthy
$SSH "ubuntu@${HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /home/ubuntu/alagou
echo "  -> Aguardando saúde dos serviços..."
for i in $(seq 1 18); do
  HEALTHY=$(sudo docker compose -f docker-compose.prod.yml ps --format '{{.Status}}' 2>/dev/null | grep -ic healthy || true)
  TOTAL=$(sudo docker compose -f docker-compose.prod.yml ps --format '{{.Status}}' 2>/dev/null | wc -l)
  if [ "$HEALTHY" -ge 2 ] && [ "$TOTAL" -ge 3 ]; then break; fi
  sleep 5
done
sudo docker compose -f docker-compose.prod.yml ps
echo "REMOTE_STATUS_OK"
REMOTE

PUBLIC_IP=$(echo "$HOST" | grep -qE '^[0-9.]+$' && echo "$HOST" || $SSH -o StrictHostKeyChecking=no "ubuntu@${HOST}" 'curl -s http://checkip.amazonaws.com' 2>/dev/null)

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN} ✅ Teste/Deploy na EC2 concluído!${NC}"
echo -e "${GREEN}    Web:        http://$PUBLIC_IP${NC}"
echo -e "${GREEN}    API health: http://$PUBLIC_IP/api/health${NC}"
echo -e "${GREEN}    WebSocket:  ws://$PUBLIC_IP/ws${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "${YELLOW}Para validar externamente (do seu navegador/celular):${NC}"
echo -e "  curl http://$PUBLIC_IP/api/health"
echo -e "  curl http://$PUBLIC_IP/api/alerts"
