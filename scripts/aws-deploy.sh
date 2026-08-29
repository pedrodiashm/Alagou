#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Script de Deploy Automatizado do Alagou na AWS EC2 (Ubuntu)
# Otimizado para o Free Tier (t3.micro / t4g.small, 1–2 GB)
#
# Uso: bash scripts/aws-deploy.sh
# Requisitos: Ubuntu 22.04/24.04, usuário com sudo
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}!! ${NC} $1"; }
die()  { echo -e "${RED}XX ${NC} $1"; exit 1; }

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN} 🚀 Deploy do Alagou na AWS EC2 (Free Tier)     ${NC}"
echo -e "${GREEN}================================================${NC}"

# -----------------------------------------------------------
# 0. Detecção de arquitetura e memória
# -----------------------------------------------------------
ARCH=$(uname -m)
TOTAL_MEM_MB=$(awk '/MemTotal/{printf "%d", $2/1024}' /proc/meminfo)
log "Arquitetura: $ARCH | Memória total: ${TOTAL_MEM_MB} MB"
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  log "Detectada arquitetura ARM (Graviton/t4g). Usando imagens multi-arquitetura do Docker (automático)."
fi

# -----------------------------------------------------------
# 1. Swap (ESSENCIAL em instâncias de 1 GB: evita OOM Killer)
# -----------------------------------------------------------
if [ "$TOTAL_MEM_MB" -lt 2048 ]; then
  log "[1/7] Instância com ${TOTAL_MEM_MB} MB. Criando swapfile de 1 GB..."
  if ! swapon --show | grep -q "/swapfile"; then
    sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile >/dev/null 2>&1
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
    # Ajusta swappiness para usar swap somente quando necessário
    echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-alagou.conf >/dev/null
    sudo sysctl -p /etc/sysctl.d/99-alagou.conf >/dev/null
    log "  -> Swapfile de 1 GB criado e ativado. swappiness=10."
  else
    log "  -> Swap já existe."
  fi
else
  log "[1/7] Memória suficiente (>= 2 GB). Swap não necessário."
fi

# -----------------------------------------------------------
# 2. Instalação do Docker e Docker Compose (se necessário)
# -----------------------------------------------------------
log "[2/7] Verificando Docker..."
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker não encontrado. Instalando..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  log "  -> Docker instalado com sucesso."
else
  log "  -> Docker já instalado."
fi

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose (plugin) não disponível. Instale a versão 2+."
fi

# -----------------------------------------------------------
# 3. Git
# -----------------------------------------------------------
log "[3/7] Verificando Git..."
if ! command -v git >/dev/null 2>&1; then
  sudo apt-get install -y git
fi

# -----------------------------------------------------------
# 4. Clonar / Atualizar repositório
# -----------------------------------------------------------
REPO_DIR="${REPO_DIR:-$HOME/alagou}"
REPO_URL="${REPO_URL:-https://github.com/SEU_USUARIO/alagou.git}"

log "[4/7] Repositório em: $REPO_DIR"
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  warn "Atualizando repositório (git pull)..."
  (cd "$REPO_DIR" && git pull --rebase)
fi

# -----------------------------------------------------------
# 5. Arquivo .env de produção (cria se não existir)
# -----------------------------------------------------------
ENV_FILE="$REPO_DIR/.env"
log "[5/7] Arquivo .env"
if [ ! -f "$ENV_FILE" ]; then
  warn "Criando .env de produção (senhas em branco — preencha antes de subir)..."
  cat > "$ENV_FILE" <<'EOF'
DB_HOST=mariadb
DB_PORT=3306
DB_USER=alagou_user
DB_NAME=alagou_db
DB_PASSWORD=
DB_ROOT_PASSWORD=
EOF
else
  log "  -> .env já existe. Mantendo."
fi

# Nunca subir com banco sem senha definida
if ! grep -qE '^DB_PASSWORD=.+$' "$ENV_FILE" || ! grep -qE '^DB_ROOT_PASSWORD=.+$' "$ENV_FILE"; then
  die "Senhas de banco em branco em $ENV_FILE. Defina DB_PASSWORD e DB_ROOT_PASSWORD antes de continuar."
fi

# -----------------------------------------------------------
# 6. Build e subida do ambiente de produção
# -----------------------------------------------------------
log "[6/7] Subindo ambiente de produção (build + up)..."
cd "$REPO_DIR"
docker compose -f docker-compose.prod.yml up -d --build

# -----------------------------------------------------------
# 7. Confirmação e IP público
# -----------------------------------------------------------
log "[7/7] Verificando serviços..."
sleep 5
docker compose -f docker-compose.prod.yml ps

PUBLIC_IP=$(curl -s --max-time 10 http://checkip.amazonaws.com || echo "IP_NAO_DETECTADO")

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN} ✅ Deploy concluído!${NC}"
echo -e "${GREEN}    Web (navegador): http://$PUBLIC_IP${NC}"
echo -e "${GREEN}    API  (health):   http://$PUBLIC_IP/api/health${NC}"
echo -e "${GREEN}    WebSocket:       ws://$PUBLIC_IP/ws${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "${YELLOW}Dica: use essas mesmas URLs no eas.json (EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WS_URL) para o APK.${NC}"
