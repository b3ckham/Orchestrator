#!/bin/bash

# Apply Migration V2 (Enhanced Policy Fields)
echo "Applying Enhanced Policy Migration to OrchestratorDb..."

docker exec -i orchestrator-mysql mysql -uroot -ppassword OrchestratorDb < ./infrastructure/mysql/migration_v2.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration Applied Successfully."
else
    echo "❌ Migration Failed."
    exit 1
fi
