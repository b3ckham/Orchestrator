#!/bin/bash

# Base URLs
MEMBER_API="http://localhost:5119/api/members"
WALLET_API="http://localhost:5250/api/wallets"
COMPLIANCE_API="http://localhost:5300/api/compliance"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[TEST] $1${NC}"; }
error() { echo -e "${RED}[FAIL] $1${NC}"; exit 1; }

# 1. Health Check (Basic) - wait for services to be up
log "Waiting for services..."
sleep 2

# 2. Create Member
MEMBERSHIP_ID="TEST-USER-$(date +%s)"
log "Creating Member with ID: $MEMBERSHIP_ID"

RESPONSE=$(curl -s -X POST "$MEMBER_API" \
  -H "Content-Type: application/json" \
  -d '{
    "membershipId": "'"$MEMBERSHIP_ID"'",
    "firstName": "John",
    "lastName": "Doe",
    "email": "'"$MEMBERSHIP_ID"'@example.com",
    "phone": "1234567890",
    "status": "Active",
    "risk_Level": "Low",
    "kyC_Level": "Verified",
    "walletStatus": "Unlocked",
    "gameStatus": "Unlocked",
    "currency": "THB"
  }')

# Log response for debugging
echo "Create Response: $RESPONSE"

if [[ $RESPONSE == *"membershipId"* ]]; then
    log "Member Created Successfully."
else
    error "Failed to create member. Response: $RESPONSE"
fi

# Extract Internal ID
INTERNAL_ID=$(echo $RESPONSE | jq -r '.id')
log "Internal Member ID: $INTERNAL_ID"

# 3. Verify Initial Wallet Status
log "Waiting for Wallet Creation (Async)..."
sleep 3
log "Verifying Initial Wallet Status..."
WALLET_STATUS=$(curl -s "$WALLET_API/$MEMBERSHIP_ID" | jq -r '.status')

if [[ "$WALLET_STATUS" == "Unlocked" ]]; then
    log "Initial Wallet Status is Unlocked."
else
    error "Expected Wallet Status Unlocked, got $WALLET_STATUS"
fi

# 4. Trigger Rule: Update Status to Confiscated
log "Triggering Rule: Updating Member Status to Confiscated..."
curl -s -X PUT "$MEMBER_API/$INTERNAL_ID/status" \
  -H "Content-Type: application/json" \
  -d '{ "status": "Confiscated" }'

# 5. Wait for Orchestration
log "Waiting for Orchestration (5s)..."
sleep 5

# 6. Verify Outcome: Wallet Should be Locked
log "Verifying Final Wallet Status..."
FINAL_WALLET_STATUS=$(curl -s "$WALLET_API/$MEMBERSHIP_ID" | jq -r '.status')

echo "Final Wallet Status: $FINAL_WALLET_STATUS"

if [[ "$FINAL_WALLET_STATUS" == "Locked" ]]; then
    log "SUCCESS! Wallet is Locked. Orchestration worked."
else
    error "FAILED. Wallet Status is $FINAL_WALLET_STATUS. Expected Locked."
fi
