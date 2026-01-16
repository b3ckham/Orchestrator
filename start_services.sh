#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# File to store PIDs
PID_FILE=".running_services.pids"
LOGS_DIR="logs"

# Ensure log directory exists
mkdir -p "$LOGS_DIR"

# Clear previous PID file if it exists
if [ -f "$PID_FILE" ]; then
    echo -e "${RED}Previous PID file found. Cleaning up...${NC}"
    ./stop_services.sh
fi

touch "$PID_FILE"

log_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}[ERROR] $1 is not installed.${NC}"
        return 1
    fi
    return 0
}

# 1. Check prerequisites
log_info "Checking prerequisites..."
check_command dotnet || exit 1
check_command docker || exit 1
check_command node || exit 1
check_command npm || exit 1

HAS_MVN=true
check_command mvn || check_command java || HAS_MVN=false

if [ "$HAS_MVN" = false ]; then
    echo -e "${RED}[WARNING] Maven (mvn) or Java not found. RuleService will NOT be started.${NC}"
fi

# 2. Start Infrastructure
log_info "Starting Infrastructure (MySQL, RabbitMQ)..."
docker compose up -d
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start docker compose.${NC}"
    exit 1
fi
log_success "Infrastructure started."

# Helper to start a service
start_service() {
    local NAME=$1
    local CMD=$2
    local LOG_FILE="$LOGS_DIR/$NAME.log"
    
    log_info "Starting $NAME..."
    eval "$CMD" > "$LOG_FILE" 2>&1 &
    local PID=$!
    echo "$PID" >> "$PID_FILE"
    log_success "$NAME started (PID: $PID). Logs: $LOG_FILE"
}

# 3. Start Backend Services (.NET)
# Note: Using 'dotnet run' with specific projects. 
# We assume the script is run from the root directory.

start_service "MemberService" "dotnet run --project src/MemberService/MemberService.csproj --launch-profile http"
start_service "ComplianceService" "dotnet run --project src/ComplianceService/ComplianceService.csproj --launch-profile http"
start_service "ContextProviderService" "dotnet run --project src/ContextProviderService/ContextProviderService.csproj --launch-profile http"
start_service "OrchestratorService" "dotnet run --project src/OrchestratorService/OrchestratorService.csproj --launch-profile http"
start_service "WalletService" "dotnet run --project src/WalletService/WalletService.csproj --launch-profile http"
start_service "AuditService" "dotnet run --project src/AuditService/AuditService.csproj --launch-profile http"

# 4. Start Rule Service (Java)
if [ "$HAS_MVN" = true ]; then
    log_info "Building and Starting RuleService..."
    start_service "RuleService" "cd src/RuleService && mvn spring-boot:run -Dspring-boot.run.profiles=dev"
else
    echo -e "${RED}[SKIP] RuleService skipped due to missing Maven/Java.${NC}"
fi

# 5. Start Frontend
log_info "Starting Frontend..."
# Install dependencies if node_modules missing (optional, but good for first run)
if [ ! -d "src/Frontend/node_modules" ]; then
    log_info "Installing Frontend dependencies..."
    (cd src/Frontend && npm install)
fi
start_service "Frontend" "cd src/Frontend && npm run dev"

log_success "All available services initiated. Check $LOGS_DIR for output."
log_info "To stop all services, run ./stop_services.sh"
