# Déploiement sur Raspberry Pi 4

Guide complet pour déployer SpreadLab sur un Raspberry Pi 4 avec:
- Bot de trading en arrière-plan 24/7
- Interface web accessible depuis le réseau local
- Notifications Telegram sur téléphone

## Prérequis

- Raspberry Pi 4 (2GB RAM minimum, 4GB recommandé)
- Carte SD 32GB+ avec Raspberry Pi OS (64-bit recommandé)
- Connexion réseau (Ethernet recommandé pour stabilité)

## 1. Configuration initiale du Raspberry Pi

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

## 2. Transférer le projet

### Option A: Via Git (recommandé)

```bash
# Sur le Raspberry Pi
cd ~
git clone <URL_DE_VOTRE_REPO> trade
cd trade/frontend
```

### Option B: Via SCP depuis votre PC

```bash
# Depuis votre PC Windows (PowerShell)
scp -r C:\Users\Jean-Baptiste\Desktop\trade\frontend pi@<IP_RASPBERRY>:~/trade/
```

## 3. Installer les dépendances

```bash
cd ~/trade/frontend

# Installer avec legacy-peer-deps (nécessaire pour better-sqlite3)
npm install --legacy-peer-deps

# Recompiler better-sqlite3 pour ARM
npm rebuild better-sqlite3
```

## 4. Configuration pour réseau local

### Créer le fichier de configuration

```bash
# Créer .env.local
cat > .env.local << 'EOF'
# Écouter sur toutes les interfaces réseau
HOST=0.0.0.0
PORT=3000

# Mode production
NODE_ENV=production
EOF
```

### Modifier next.config.js pour le réseau local

Le fichier est déjà configuré, mais vérifiez qu'il contient:

```javascript
module.exports = {
  // ... autres configs

  // Permettre les connexions depuis le réseau local
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};
```

## 5. Build de production

```bash
cd ~/trade/frontend

# Build optimisé pour production
npm run build
```

## 6. Configuration PM2

### Créer le fichier ecosystem

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'spreadlab-web',
      script: 'npm',
      args: 'start',
      cwd: '/home/pi/trade/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      // Redémarrage automatique
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // Logs
      error_file: '/home/pi/trade/frontend/logs/web-error.log',
      out_file: '/home/pi/trade/frontend/logs/web-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'spreadlab-bot',
      script: 'bot-worker.js',
      cwd: '/home/pi/trade/frontend',
      // Redémarrage automatique
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      // Logs
      error_file: '/home/pi/trade/frontend/logs/bot-error.log',
      out_file: '/home/pi/trade/frontend/logs/bot-out.log',
      merge_logs: true,
      time: true,
      // Délai avant restart en cas de crash
      restart_delay: 10000
    }
  ]
};
EOF

# Créer le dossier logs
mkdir -p ~/trade/frontend/logs
```

### Démarrer les services

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

## 7. Trouver l'IP du Raspberry Pi

```bash
# Sur le Raspberry Pi
hostname -I
# Exemple: 192.168.1.42
```

## 8. Accéder à l'application

Depuis n'importe quel appareil sur votre réseau local:

```
http://192.168.1.42:3000
```

(Remplacez par l'IP de votre Raspberry Pi)

## 9. Configurer Telegram

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

## 10. Sécurité réseau local

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

### Désactiver l'accès externe (routeur)

- Ne PAS configurer de redirection de port (port forwarding) sur votre routeur
- L'application restera accessible uniquement sur le réseau local

## 11. Commandes utiles PM2

```bash
# Voir le statut
pm2 status

# Voir les logs
pm2 logs                    # Tous les logs
pm2 logs spreadlab-bot      # Logs du bot uniquement
pm2 logs spreadlab-web      # Logs du web uniquement

# Redémarrer un service
pm2 restart spreadlab-bot
pm2 restart spreadlab-web
pm2 restart all

# Arrêter/Démarrer
pm2 stop spreadlab-bot
pm2 start spreadlab-bot

# Monitoring en temps réel
pm2 monit

# Infos détaillées
pm2 info spreadlab-bot
```

## 12. Maintenance

### Mettre à jour l'application

```bash
cd ~/trade/frontend

# Arrêter les services
pm2 stop all

# Mettre à jour le code
git pull

# Réinstaller les dépendances si nécessaire
npm install --legacy-peer-deps

# Rebuild
npm run build

# Redémarrer
pm2 restart all
```

### Sauvegarder la base de données

```bash
# Copier le fichier SQLite
cp ~/trade/frontend/data/bot.db ~/trade/frontend/data/bot.db.backup

# Ou créer un backup daté
cp ~/trade/frontend/data/bot.db ~/trade/frontend/data/bot-$(date +%Y%m%d).db
```

### Voir l'espace disque

```bash
df -h
```

## 13. Dépannage

### Le bot ne démarre pas

```bash
# Vérifier les logs
pm2 logs spreadlab-bot --lines 50

# Vérifier la base de données
ls -la ~/trade/frontend/data/
```

### L'interface web n'est pas accessible

```bash
# Vérifier que le service tourne
pm2 status

# Vérifier le port
sudo netstat -tlnp | grep 3000

# Vérifier le pare-feu
sudo ufw status
```

### Problème de mémoire

```bash
# Voir l'utilisation mémoire
free -h

# PM2 monitoring
pm2 monit
```

## Architecture finale

```
┌─────────────────────────────────────────────────────────┐
│                    RASPBERRY PI 4                        │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   PM2 Manager   │    │      SQLite Database        │ │
│  │                 │    │    data/bot.db              │ │
│  │  ┌───────────┐  │    └─────────────────────────────┘ │
│  │  │ Web App   │  │              ▲                     │
│  │  │ Port 3000 │──┼──────────────┤                     │
│  │  └───────────┘  │              │                     │
│  │  ┌───────────┐  │              │                     │
│  │  │ Bot Worker│──┼──────────────┘                     │
│  │  │  (24/7)   │──┼─────────────────────────────────┐  │
│  │  └───────────┘  │                                 │  │
│  └─────────────────┘                                 │  │
└──────────────────────────────────────────────────────┼──┘
         ▲                                             │
         │ Réseau local (192.168.x.x)                  │
         │                                             ▼
    ┌────┴────┐                              ┌─────────────┐
    │ PC/Tel  │                              │  Telegram   │
    │ Browser │                              │  (Internet) │
    └─────────┘                              └─────────────┘
```

## Résumé des commandes rapides

```bash
# Démarrer tout
pm2 start ecosystem.config.js

# Arrêter tout
pm2 stop all

# Redémarrer tout
pm2 restart all

# Voir les logs
pm2 logs

# Monitoring
pm2 monit

# Statut
pm2 status
```
