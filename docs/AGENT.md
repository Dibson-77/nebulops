# FleetOps — Guide d'installation de l'agent

L'agent est un micro-service léger installé sur chaque serveur distant.  
Il expose les métriques système sur `/metrics` (JSON) via HTTP sur le port `9101`.  
FleetOps le poll depuis ses API Routes toutes les 60 secondes — aucune donnée n'est jamais
poussée depuis le serveur : c'est FleetOps qui vient lire.

---

## Architecture de communication

```
FleetOps (Next.js)                    Serveur distant
┌─────────────────────┐               ┌──────────────────────┐
│                     │  GET /metrics │                      │
│ /api/servers/[id]/  │ ─────────────►│ fleetops-agent.py    │
│ metrics/route.ts    │ ◄─────────────│ port 9101            │
│                     │  JSON réponse │                      │
└─────────────────────┘               └──────────────────────┘
```

---

## Prérequis sur le serveur distant

| Élément        | Version minimale | Vérification              |
|----------------|------------------|---------------------------|
| Python         | 3.6+             | `python3 --version`       |
| pip3           | n'importe        | `pip3 --version`          |
| psutil         | 5.x              | `pip3 show psutil`        |
| Port 9101      | ouvert           | voir section Firewall     |

---

## Installation rapide (recommandée)

```bash
# 1. Télécharger et installer l'agent
sudo curl -sSL https://raw.githubusercontent.com/VOTRE_PSEUDO/fleetops/main/agent/fleetops-agent.py \
  -o /opt/fleetops-agent.py

# 2. Installer la dépendance Python
pip3 install psutil

# 3. Démarrer l'agent en arrière-plan
nohup python3 /opt/fleetops-agent.py > /var/log/fleetops-agent.log 2>&1 &

# 4. Vérifier qu'il répond
curl http://localhost:9101/metrics
```

---

## Installation comme service systemd (production)

Pour que l'agent redémarre automatiquement au reboot :

```bash
# Créer le fichier service
sudo tee /etc/systemd/system/fleetops-agent.service > /dev/null << 'SERVICE'
[Unit]
Description=FleetOps Metrics Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/fleetops-agent.py
Restart=always
RestartSec=10
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

# Activer et démarrer
sudo systemctl daemon-reload
sudo systemctl enable fleetops-agent
sudo systemctl start fleetops-agent

# Vérifier le statut
sudo systemctl status fleetops-agent
```

---

## Configuration du Firewall

### Ubuntu / Debian (UFW)
```bash
sudo ufw allow 9101/tcp
sudo ufw reload
```

### CentOS / RHEL (firewalld)
```bash
sudo firewall-cmd --permanent --add-port=9101/tcp
sudo firewall-cmd --reload
```

### OVH (iptables)
```bash
sudo iptables -A INPUT -p tcp --dport 9101 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

### AWS (Security Group)
Dans la console AWS → EC2 → Security Groups → Inbound rules :
- Type : Custom TCP
- Port : 9101
- Source : IP de votre serveur FleetOps (ou 0.0.0.0/0 si réseau privé)

### Azure (Network Security Group)
Dans le portail Azure → NSG → Inbound security rules :
- Destination port : 9101
- Protocol : TCP
- Action : Allow

---

## Sécurité

> ⚠️ L'agent expose des métriques système. Restreindre l'accès à l'IP de FleetOps uniquement.

### Restreindre l'accès à une IP spécifique (UFW)
```bash
# Remplacer X.X.X.X par l'IP de votre serveur FleetOps
sudo ufw allow from X.X.X.X to any port 9101
sudo ufw deny 9101
```

### Ajouter un token d'authentification
Modifier `/opt/fleetops-agent.py` — section `AUTH_TOKEN` :
```python
AUTH_TOKEN = "votre-token-secret-ici"
```
Puis dans FleetOps, ajouter dans `.env.local` :
```
AGENT_AUTH_TOKEN=votre-token-secret-ici
```
La route `/api/servers/[id]/metrics/route.ts` l'envoie automatiquement en header.

---

## Vérification manuelle

```bash
# Tester depuis FleetOps
curl http://IP_SERVEUR:9101/metrics

# Réponse attendue (JSON)
{
  "diskTotalGb": 177.0,
  "diskUsedGb": 103.2,
  "diskFreeGb": 73.8,
  "diskUsedPct": 58,
  "ramTotalGb": 15.5,
  "ramUsedGb": 7.8,
  "ramUsedPct": 50,
  "ramFreePct": 50,
  "cpuLoadPct": 31,
  "cpuCores": 4,
  "uptimeHours": 512,
  "loadAvg": [0.8, 1.2, 1.1],
  "services": [
    { "name": "nginx",  "status": "running" },
    { "name": "docker", "status": "running" }
  ],
  "hostname": "srv-applicatif",
  "os": "Ubuntu 22.04.3 LTS",
  "kernel": "5.15.0-88-generic",
  "agentVersion": "1.0.0",
  "status": "online"
}
```

---

## Dépannage

### L'agent ne répond pas
```bash
# Vérifier qu'il tourne
ps aux | grep fleetops

# Voir les logs
tail -f /var/log/fleetops-agent.log
# ou si systemd :
journalctl -u fleetops-agent -f

# Tester en local sur le serveur
curl http://127.0.0.1:9101/metrics
```

### Port 9101 refusé
```bash
# Vérifier qu'il écoute bien
ss -tlnp | grep 9101
netstat -tlnp | grep 9101
```

### psutil non trouvé
```bash
# Debian/Ubuntu
sudo apt-get install python3-psutil

# CentOS/RHEL
sudo yum install python3-psutil

# ou pip
sudo pip3 install psutil
```

### Redémarrer l'agent
```bash
# Si systemd
sudo systemctl restart fleetops-agent

# Si nohup
pkill -f fleetops-agent.py
nohup python3 /opt/fleetops-agent.py > /var/log/fleetops-agent.log 2>&1 &
```

---

## Désinstallation

```bash
sudo systemctl stop fleetops-agent
sudo systemctl disable fleetops-agent
sudo rm /etc/systemd/system/fleetops-agent.service
sudo rm /opt/fleetops-agent.py
sudo systemctl daemon-reload
```

---

## Changelog

| Version | Date       | Changements              |
|---------|------------|--------------------------|
| 1.0.0   | 2026-03-18 | Version initiale         |
