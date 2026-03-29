# NebulOps Agent — Guide DevOps

## Vue d'ensemble

L'agent NebulOps est un script Python leger qui s'installe sur chaque serveur
a surveiller. Il expose des metriques systeme (CPU, RAM, disque, Docker,
reseau, processus) via une API HTTP sur le port 9101.

Le dashboard NebulOps interroge ces agents pour afficher les donnees en temps
reel.

```
                        Internet
                           |
                    +--------------+
                    |  NebulOps    |
                    |  Dashboard   |
                    |  (Next.js)   |
                    +--------------+
                      |    |    |
              +-------+    |    +-------+
              |            |            |
         +---------+  +---------+  +---------+
         | Serveur | | Serveur  | | Serveur  |
         |  Prod   | | Staging  | |   Dev    |
         |  :9101  | |  :9101   | |  :9101   |
         +---------+  +---------+  +---------+
           Agent        Agent        Agent
```


## Installation rapide (1 commande)

Se connecter en SSH au serveur cible, puis executer :

```bash
curl -sSL https://raw.githubusercontent.com/VOTRE_USER/nebulops/main/agent/install-agent.sh | \
  bash -s -- --token VOTRE_TOKEN_SECRET --port 9101
```

Ou si le script est deja sur le serveur :

```bash
chmod +x install-agent.sh
./install-agent.sh --token VOTRE_TOKEN_SECRET --port 9101
```

### Options

| Option     | Defaut                 | Description                     |
|------------|------------------------|---------------------------------|
| `--token`  | (obligatoire)          | Token d'authentification        |
| `--port`   | `9101`                 | Port d'ecoute de l'agent        |
| `--dir`    | `/opt/nebulops-agent`  | Dossier d'installation          |

### Ce que le script fait automatiquement

1. Installe Python3 + pip + psutil
2. Copie l'agent dans `/opt/nebulops-agent/`
3. Cree un service systemd `nebulops-agent`
4. Ouvre le port dans le firewall (ufw ou firewalld)
5. Demarre l'agent et verifie qu'il repond


## Deploiement sur plusieurs serveurs

### Methode 1 : Boucle SSH

Creer un fichier `servers.txt` avec un serveur par ligne :

```
root@51.91.251.5
root@51.91.252.10
root@10.0.0.42
```

Puis executer :

```bash
TOKEN="MonTokenSecret123"
PORT="9101"

while read -r server; do
  echo ">>> Installation sur $server..."
  ssh "$server" "curl -sSL https://raw.githubusercontent.com/VOTRE_USER/nebulops/main/agent/install-agent.sh | bash -s -- --token $TOKEN --port $PORT"
  echo ">>> $server OK"
  echo ""
done < servers.txt
```

### Methode 2 : Avec des tokens differents par serveur

Fichier `servers.csv` :

```
root@51.91.251.5,token-prod-abc123,9101
root@51.91.252.10,token-staging-def456,9101
root@10.0.0.42,token-dev-ghi789,9101
```

Script :

```bash
while IFS=',' read -r server token port; do
  echo ">>> $server (port $port)..."
  ssh "$server" "curl -sSL https://raw.githubusercontent.com/VOTRE_USER/nebulops/main/agent/install-agent.sh | bash -s -- --token $token --port $port"
done < servers.csv
```

### Methode 3 : Ansible (pour les infras plus grandes)

```yaml
# playbook-nebulops-agent.yml
- hosts: all
  become: yes
  vars:
    nebulops_token: "{{ vault_nebulops_token }}"
    nebulops_port: 9101

  tasks:
    - name: Install NebulOps Agent
      shell: |
        curl -sSL https://raw.githubusercontent.com/VOTRE_USER/nebulops/main/agent/install-agent.sh | \
          bash -s -- --token {{ nebulops_token }} --port {{ nebulops_port }}
      args:
        creates: /opt/nebulops-agent/nebulops-agent.py
```


## Gestion du service

```bash
# Voir le statut
systemctl status nebulops-agent

# Redemarrer apres une mise a jour
systemctl restart nebulops-agent

# Arreter
systemctl stop nebulops-agent

# Logs en temps reel
journalctl -u nebulops-agent -f

# Logs des 50 dernieres lignes
journalctl -u nebulops-agent -n 50 --no-pager

# Desactiver le demarrage automatique
systemctl disable nebulops-agent
```


## API de l'agent

Tous les endpoints necessitent le header `X-NebulOps-Token` si un token est configure.

### Endpoints

| Endpoint     | Description                          |
|--------------|--------------------------------------|
| `/health`    | Statut rapide (version, hostname)    |
| `/metrics`   | Metriques completes                  |
| `/docker`    | Containers, images, stats Docker     |
| `/network`   | Interfaces reseau, connexions TCP    |
| `/processes` | Top 10 processus CPU/RAM             |

### Exemples

```bash
# Tester la connectivite
curl -H "X-NebulOps-Token: VOTRE_TOKEN" http://IP_SERVEUR:9101/health

# Metriques completes
curl -H "X-NebulOps-Token: VOTRE_TOKEN" http://IP_SERVEUR:9101/metrics

# Info Docker
curl -H "X-NebulOps-Token: VOTRE_TOKEN" http://IP_SERVEUR:9101/docker
```

### Reponse /health

```json
{
  "status": "ok",
  "agentVersion": "2.0.0",
  "hostname": "vps-prod-01",
  "uptime": 720.5
}
```

### Statuts possibles (champ `status` de /metrics)

| Statut     | Condition                                  |
|------------|--------------------------------------------|
| `online`   | Tout va bien                               |
| `degraded` | Disque >= 80% OU CPU >= 80% OU RAM >= 85%  |
| `critical` | Disque >= 95% OU CPU >= 95% OU RAM >= 95%  |


## Ajouter le serveur dans NebulOps Dashboard

Apres l'installation de l'agent, aller dans le dashboard NebulOps :

1. **Admin** > **Ajouter un serveur**
2. Remplir :
   - **IP** : l'IP du serveur (ex: `51.91.251.5`)
   - **Port** : `9101` (ou le port choisi)
   - **Token** : le token utilise lors de l'installation
   - **Nom** : un nom descriptif (ex: `Prod-Web-01`)
   - **Environnement** : `Production`, `Staging`, ou `Dev`
   - **Provider** : `OVH`, `Azure`, ou `AWS`
3. Sauvegarder — le serveur apparait dans le dashboard


## Mise a jour de l'agent

```bash
# Sur le serveur cible
curl -sSL https://raw.githubusercontent.com/VOTRE_USER/nebulops/main/agent/install-agent.sh | \
  bash -s -- --token MEME_TOKEN --port 9101
```

Le script ecrase l'ancien agent et redemarre le service.


## Desinstallation

```bash
systemctl stop nebulops-agent
systemctl disable nebulops-agent
rm /etc/systemd/system/nebulops-agent.service
systemctl daemon-reload
rm -rf /opt/nebulops-agent
```


## Troubleshooting

### L'agent ne demarre pas

```bash
journalctl -u nebulops-agent -n 30 --no-pager
```

Causes frequentes :
- `psutil` non installe → `pip3 install psutil`
- Port deja utilise → changer avec `--port 9102`
- Python3 absent → installer avec `apt install python3`

### Le dashboard ne voit pas le serveur

1. Verifier que l'agent tourne : `systemctl status nebulops-agent`
2. Tester en local : `curl -H "X-NebulOps-Token: TOKEN" http://127.0.0.1:9101/health`
3. Tester depuis l'exterieur : `curl -H "X-NebulOps-Token: TOKEN" http://IP:9101/health`
4. Si 3 echoue mais 2 marche → probleme firewall : `ufw allow 9101/tcp`
5. Verifier que le token dans le dashboard correspond au token de l'agent

### L'agent affiche "degraded"

C'est normal si le disque est utilise a plus de 80%, le CPU a plus de 80%,
ou la RAM a plus de 85%. Ce n'est pas une erreur de l'agent, c'est un
avertissement sur l'etat du serveur.
