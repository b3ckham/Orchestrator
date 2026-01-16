# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Initiating Fresh Start Protocol...${NC}"

# 1. Stop everything
echo -e "${YELLOW}[1/5] Stopping existing services...${NC}"
./stop_services.sh

# 2. Start Infrastructure (needed for DB clear)
echo -e "${YELLOW}[2/5] Starting Infrastructure...${NC}"
docker compose up -d
echo "Waiting 10s for Database to initialize..."
sleep 10

# 3. Clear Data
echo -e "${YELLOW}[3/5] Clearing Databases...${NC}"
DB_USER="root"
DB_PASS="password"
DB_HOST="localhost"

truncate_table() {
    local db=$1
    local table=$2
    # Try using docker exec if mysql client not found, else fall back to mysql
    if command -v mysql &> /dev/null; then
        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "TRUNCATE TABLE $db.$table;" 2>/dev/null
    else
        # Assuming container name 'mysql' or similar - check compose file if needed.
        # Fallback to just warning if we can't easily connect
        echo "⚠️  'mysql' client not found. Attempting via Docker container 'orchestrator-mysql'..."
        docker exec orchestrator-mysql mysql -u"$DB_USER" -p"$DB_PASS" -e "TRUNCATE TABLE $db.$table;" 2>/dev/null
    fi
}

# Note: Adjust container name if different
truncate_table "MemberDB" "Members"
truncate_table "WalletDB" "Wallets"
truncate_table "ComplianceDB" "ComplianceProfiles"
truncate_table "OrchestratorDb" "WorkflowExecutions" # Also clear logs?
echo -e "${GREEN}Data cleared.${NC}"

# 4. Start Services
echo -e "${YELLOW}[4/5] Starting Applications...${NC}"
./start_services.sh

echo "Waiting 15s for services to warm up..."
sleep 15

# 5. Seed Data
echo -e "${YELLOW}[5/5] Seeding Initial Data...${NC}"
./seed_data.sh

echo -e "${GREEN}✅ Fresh Start Complete! System is ready.${NC}"
