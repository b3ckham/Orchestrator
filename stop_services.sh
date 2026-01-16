#!/bin/bash

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

YELLOW='\033[1;33m'

PID_FILE=".running_services.pids"

if [ -f "$PID_FILE" ]; then
    echo -e "${RED}Stopping services listed in $PID_FILE...${NC}"
    while read -r PID; do
        if kill -0 "$PID" 2>/dev/null; then
            echo "Killing PID $PID..."
            kill "$PID"
        else
            echo "PID $PID not running."
        fi
    done < "$PID_FILE"
    rm "$PID_FILE"
    echo -e "${GREEN}All background processes stopped.${NC}"
else
    echo "No PID file found."
fi

# Fallback: Kill known ports (Zombies)
echo -e "${YELLOW}Checking for zombie processes on ports 5119, 5250, 5300, 5200, 5222, 5400, 8080...${NC}"
PORTS=(5119 5250 5300 5200 5222 5400 8080)
for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti:$PORT)
    if [ ! -z "$PID" ]; then
        echo "Killing zombie on port $PORT (PID $PID)..."
        kill -9 $PID 2>/dev/null
    fi
done

# Stop Infrastructure
echo -e "${RED}Stopping Infrastructure (Docker Compose)...${NC}"
docker compose stop

echo -e "${GREEN}Shutdown complete.${NC}"
