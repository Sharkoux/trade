# Déploiement sur Raspberry Pi 4

Guide complet pour déployer SpreadLab sur un Raspberry Pi 4 avec:
- Bot de trading en arrière-plan 24/7
- Interface web accessible depuis le réseau local
- Notifications Telegram sur téléphone
- Chiffrement des credentials sensibles

## Prérequis

- Raspberry Pi 4 (4GB RAM recommandé, 2GB minimum)
- Carte SD 32GB+ avec Raspberry Pi OS (64-bit)
- Connexion réseau (Ethernet recommandé pour stabilité)

## Choisir sa méthode de déploiement

| Méthode | Avantages | Inconvénients |
|---------|-----------|---------------|
| **Docker** (recommandé) | Simple, reproductible, mises à jour faciles | +150MB RAM overhead |
| **PM2** (classique) | Moins de RAM utilisée | Plus de configuration manuelle |

---

# Méthode 1 : Docker (Recommandé)

## 1.1 Installer Docker sur le Raspberry Pi

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker via le script officiel
curl -fsSL https://get.docker.com | sh

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER

# Se déconnecter/reconnecter pour appliquer les permissions
logout
# puis se reconnecter

# Vérifier l'installation
docker --version
docker compose version
```

## 1.2 Transférer le projet

```bash
cd ~
git clone <URL_DE_VOTRE_REPO> trade
cd trade/frontend
```

## 1.3 Configuration

```bash
# Créer le dossier de données
mkdir -p data logs

# Générer une clé de chiffrement (optionnel mais recommandé)
openssl rand -hex 32 > data/.encryption_key
chmod 600 data/.encryption_key

# Créer le fichier .env (optionnel)
cp .env.example .env.local
```

## 1.4 Lancer avec Docker Compose

```bash
cd ~/trade/frontend

# Build et démarrage (première fois, peut prendre 10-15 min)
docker compose up -d --build

# Voir les logs
docker compose logs -f

# Vérifier le statut
docker compose ps
```

## 1.5 Commandes Docker utiles

```bash
# Voir le statut
docker compose ps

# Voir les logs
docker compose logs -f          # Tous les logs
docker compose logs -f web      # Logs web uniquement
docker compose logs -f bot      # Logs bot uniquement

# Redémarrer
docker compose restart
docker compose restart bot      # Bot uniquement

# Arrêter
docker compose down

# Mettre à jour l'application
cd ~/trade/frontend
git pull
docker compose build
docker compose up -d
```

## 1.6 Démarrage automatique au boot

```bash
# Docker redémarre automatiquement les conteneurs avec restart: unless-stopped
# Pour activer Docker au démarrage:
sudo systemctl enable docker
```

---

# Méthode 2 : PM2 (Classique)

## 2.1 Configuration initiale du Raspberry Pi

### Installer Node.js 20 LTS

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node --version  # v20.x.x
npm --version   # 10.x.x
```

### Installer les dépendances pour better-sqlite3

```bash
sudo apt install -y build-essential python3
```

### Installer PM2 (gestionnaire de processus)

```bash
sudo npm install -g pm2
```

## 2.2 Transférer le projet

### Option A: Via Git (recommandé)

```bash
cd ~
git clone <URL_DE_VOTRE_REPO> trade
cd trade/frontend
```

### Option B: Via SCP depuis votre PC

```bash
# Depuis votre PC Windows (PowerShell)
scp -r C:\Users\<USER>\trade\frontend pi@<IP_RASPBERRY>:~/trade/
```

## 2.3 Installer les dépendances

```bash
cd ~/trade/frontend

# Installer avec legacy-peer-deps
npm install --legacy-peer-deps

# Recompiler better-sqlite3 pour ARM
npm rebuild better-sqlite3
```

## 2.4 Configuration

```bash
# Créer les dossiers nécessaires
mkdir -p data logs

# Créer .env.local
cat > .env.local << 'EOF'
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
EOF

# Générer une clé de chiffrement (optionnel)
openssl rand -hex 32 > data/.encryption_key
chmod 600 data/.encryption_key
```

## 2.5 Build de production

```bash
cd ~/trade/frontend
npm run build
```

## 2.6 Lancer les tests (optionnel)

```bash
# Vérifier que tout fonctionne
npm run test:run
```

## 2.7 Configuration PM2

Le fichier `ecosystem.config.js` est déjà inclus dans le projet.

```bash
cd ~/trade/frontend

# Démarrer tous les services
pm2 start ecosystem.config.js

# Vérifier le statut
pm2 status

# Voir les logs en temps réel
pm2 logs

# Sauvegarder la config pour auto-démarrage
pm2 save

# Configurer le démarrage automatique au boot
pm2 startup
# Suivre les instructions affichées (copier/coller la commande sudo)
```

## 2.8 Commandes PM2 utiles

```bash
# Statut
pm2 status

# Logs
pm2 logs                    # Tous les logs
pm2 logs spreadlab-bot      # Bot uniquement
pm2 logs spreadlab-web      # Web uniquement

# Redémarrer
pm2 restart all
pm2 restart spreadlab-bot

# Arrêter/Démarrer
pm2 stop all
pm2 start all

# Monitoring en temps réel
pm2 monit

# Infos détaillées
pm2 info spreadlab-bot
```

---

# Configuration commune

## Trouver l'IP du Raspberry Pi

```bash
hostname -I
# Exemple: 192.168.1.42
```

## Accéder à l'application

Depuis n'importe quel appareil sur votre réseau local:

```
http://192.168.1.42:3000
```

## Configurer Telegram

### Créer un bot Telegram

1. Ouvrir Telegram sur votre téléphone
2. Chercher `@BotFather`
3. Envoyer `/newbot`
4. Suivre les instructions (nom, username)
5. Copier le **token** fourni (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Obtenir votre Chat ID

1. Chercher `@userinfobot` sur Telegram
2. Envoyer `/start`
3. Copier votre **ID** (nombre)

### Configurer dans l'app

1. Aller sur `http://<IP_RASPBERRY>:3000/bot`
2. Section "Notifications Telegram"
3. Entrer le Bot Token et Chat ID
4. Cliquer "Tester" pour vérifier
5. Activer les notifications

## Sécurité réseau local

### Pare-feu UFW (recommandé)

```bash
# Installer UFW
sudo apt install -y ufw

# Règles par défaut
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser SSH (important!)
sudo ufw allow ssh

# Autoriser le port 3000 uniquement depuis le réseau local
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Activer le pare-feu
sudo ufw enable

# Vérifier le statut
sudo ufw status
```

### Bonnes pratiques

- Ne PAS configurer de redirection de port sur votre routeur
- L'application reste accessible uniquement sur le réseau local
- Les API keys sont chiffrées en base de données
- La clé de chiffrement est stockée dans `data/.encryption_key`

---

# Maintenance

## Mettre à jour l'application

### Avec Docker

```bash
cd ~/trade/frontend
git pull
docker compose build
docker compose up -d
```

### Avec PM2

```bash
cd ~/trade/frontend
pm2 stop all
git pull
npm install --legacy-peer-deps
npm run build
pm2 restart all
```

## Sauvegarder la base de données

```bash
# Backup simple
cp ~/trade/frontend/data/bot.db ~/trade/frontend/data/bot.db.backup

# Backup daté
cp ~/trade/frontend/data/bot.db ~/trade/frontend/data/bot-$(date +%Y%m%d).db

# Ne pas oublier la clé de chiffrement!
cp ~/trade/frontend/data/.encryption_key ~/trade/frontend/data/.encryption_key.backup
```

## Restaurer depuis un backup

```bash
# Arrêter les services
pm2 stop all  # ou: docker compose down

# Restaurer
cp ~/trade/frontend/data/bot.db.backup ~/trade/frontend/data/bot.db

# Redémarrer
pm2 start all  # ou: docker compose up -d
```

## Voir l'espace disque

```bash
df -h
```

---

# Dépannage

## Le bot ne démarre pas

```bash
# Vérifier les logs
pm2 logs spreadlab-bot --lines 50
# ou
docker compose logs bot --tail 50

# Vérifier la base de données
ls -la ~/trade/frontend/data/

# Vérifier les permissions
chmod 755 ~/trade/frontend/data
chmod 644 ~/trade/frontend/data/bot.db
```

## L'interface web n'est pas accessible

```bash
# Vérifier que le service tourne
pm2 status  # ou: docker compose ps

# Vérifier le port
sudo netstat -tlnp | grep 3000

# Vérifier le pare-feu
sudo ufw status
```

## Problème de mémoire

```bash
# Voir l'utilisation mémoire
free -h

# Voir les processus
htop

# PM2 monitoring
pm2 monit

# Docker stats
docker stats
```

## Erreur de chiffrement

Si vous avez des erreurs liées au chiffrement après une mise à jour:

```bash
# Régénérer la clé (ATTENTION: les anciennes données chiffrées seront perdues)
rm ~/trade/frontend/data/.encryption_key
# Redémarrer l'app - une nouvelle clé sera générée

# Alternative: reconfigurer les API keys dans l'interface web
```

---

# Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      RASPBERRY PI 4                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Docker / PM2 Manager                        ││
│  │  ┌─────────────────┐    ┌─────────────────────────────┐ ││
│  │  │   Web App       │    │      SQLite Database        │ ││
│  │  │   (Next.js)     │    │    data/bot.db (chiffré)    │ ││
│  │  │   Port 3000     │◄───┤                             │ ││
│  │  └─────────────────┘    └─────────────────────────────┘ ││
│  │  ┌─────────────────┐              ▲                     ││
│  │  │   Bot Worker    │──────────────┘                     ││
│  │  │   (24/7)        │─────────────────────────────────┐  ││
│  │  └─────────────────┘                                 │  ││
│  └──────────────────────────────────────────────────────┼──┘│
└─────────────────────────────────────────────────────────┼───┘
         ▲                                                │
         │ Réseau local (192.168.x.x)                     │
         │                                                ▼
    ┌────┴────┐                                 ┌─────────────┐
    │ PC/Tel  │                                 │  Telegram   │
    │ Browser │                                 │  (Notifs)   │
    └─────────┘                                 └─────────────┘
```

---

# Résumé des commandes rapides

## Docker

```bash
docker compose up -d        # Démarrer
docker compose down         # Arrêter
docker compose restart      # Redémarrer
docker compose logs -f      # Logs
docker compose ps           # Statut
```

## PM2

```bash
pm2 start ecosystem.config.js  # Démarrer
pm2 stop all                   # Arrêter
pm2 restart all                # Redémarrer
pm2 logs                       # Logs
pm2 status                     # Statut
pm2 monit                      # Monitoring
```

---

# Nouveautés v2.0

- **Chiffrement AES-256** des API keys et tokens
- **Validation des entrées** avec Zod
- **Tests automatisés** avec Vitest (`npm run test`)
- **Déploiement Docker** simplifié
- **CI/CD GitHub Actions** intégré
- **Cache API** pour de meilleures performances
- **Index SQLite** optimisés
- **Architecture modulaire** du bot
