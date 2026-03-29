# Dockerfile pour FleetOps Agent
FROM python:3.9-slim

WORKDIR /app

# Installation des dépendances système et des services réels
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    nginx \
    redis-server \
    procps \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Installation de psutil
RUN pip install --no-cache-dir psutil

# Copie du script de l'agent et du script de démarrage
COPY fleetops-agent.py .
COPY start.sh .
RUN chmod +x start.sh

# Port par défaut
EXPOSE 9101

# Lancement via le script de démarrage
CMD ["/bin/bash", "start.sh"]
