#!/bin/bash
# Script d'installation automatique pour Raspberry Pi 4
# Usage: bash setup-raspberry.sh

set -e

echo "=========================================="
echo "  SpreadLab - Installation Raspberry Pi"
echo "=========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les étapes
step() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

# Vérifier qu'on est sur Linux ARM
if [[ "$(uname -m)" != "aarch64" && "$(uname -m)" != "armv7l" ]]; then
    warn "Ce script est conçu pour Raspberry Pi (ARM)"
    read -p "Continuer quand même? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 1. Mise à jour système
echo ""
echo "1. Mise à jour du système..."
sudo apt update && sudo apt upgrade -y
step "Système mis à jour"

# 2. Installer les dépendances
echo ""
echo "2. Installation des dépendances..."
sudo apt install -y build-essential python3 git curl
step "Dépendances installées"

# 3. Vérifier/Installer Node.js
echo ""
echo "3. Vérification de Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    step "Node.js déjà installé: $NODE_VERSION"
else
    echo "Installation de Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    step "Node.js installé: $(node --version)"
fi

# 4. Installer PM2
echo ""
echo "4. Installation de PM2..."
if command -v pm2 &> /dev/null; then
    step "PM2 déjà installé"
else
    sudo npm install -g pm2
    step "PM2 installé"
fi

# 5. Aller dans le dossier du projet
echo ""
echo "5. Configuration du projet..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
step "Dossier projet: $PROJECT_DIR"

# 6. Installer les dépendances npm
echo ""
echo "6. Installation des dépendances npm..."
npm install --legacy-peer-deps
step "Dépendances npm installées"

# 7. Rebuild better-sqlite3 pour ARM
echo ""
echo "7. Compilation de better-sqlite3 pour ARM..."
npm rebuild better-sqlite3
step "better-sqlite3 compilé"

# 8. Créer les dossiers nécessaires
echo ""
echo "8. Création des dossiers..."
mkdir -p logs
mkdir -p data
step "Dossiers créés"

# 9. Build de production
echo ""
echo "9. Build de production Next.js..."
npm run build
step "Build terminé"

# 10. Configuration PM2
echo ""
echo "10. Configuration PM2..."
pm2 start ecosystem.config.js
pm2 save
step "Services PM2 démarrés"

# 11. Auto-démarrage au boot
echo ""
echo "11. Configuration auto-démarrage..."
PM2_STARTUP=$(pm2 startup | grep "sudo")
if [ -n "$PM2_STARTUP" ]; then
    echo "Exécution: $PM2_STARTUP"
    eval $PM2_STARTUP
fi
step "Auto-démarrage configuré"

# 12. Afficher l'IP
echo ""
echo "=========================================="
echo -e "${GREEN}  Installation terminée !${NC}"
echo "=========================================="
echo ""
IP_ADDR=$(hostname -I | awk '{print $1}')
echo "Accédez à l'application depuis votre réseau local:"
echo ""
echo -e "  ${GREEN}http://${IP_ADDR}:3000${NC}"
echo ""
echo "Commandes utiles:"
echo "  pm2 status        - Voir le statut des services"
echo "  pm2 logs          - Voir les logs"
echo "  pm2 monit         - Monitoring en temps réel"
echo "  pm2 restart all   - Redémarrer tous les services"
echo ""
echo "N'oubliez pas de configurer Telegram dans l'interface!"
echo ""
