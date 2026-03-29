#!/bin/bash
# start.sh - Lance les services réels et l'agent

echo "🚀 Démarrage des services NebulOps Simulation..."

# 1. Lancer Nginx en arrière-plan
echo "  [1/3] Lancement de Nginx..."
service nginx start

# 2. Lancer Redis en arrière-plan
echo "  [2/3] Lancement de Redis..."
service redis-server start

# 3. Lancer l'agent FleetOps (en premier plan)
echo "  [3/3] Lancement de l'agent FleetOps sur port ${AGENT_PORT:-9101}..."
python fleetops-agent.py --port ${AGENT_PORT:-9101} --token ${AGENT_TOKEN:-""}
