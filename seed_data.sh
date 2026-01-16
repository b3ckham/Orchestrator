#!/bin/bash

# Base URL for MemberService
BASE_URL="http://localhost:5119/api/members"

# Function to create a member
create_member() {
    local membershipId=$1
    local firstName=$2
    local lastName=$3
    local status=$4
    local walletStatus=$5
    local gameStatus=$6
    local currency=$7
    local risk_Level=$8
    local kyc_Level=$9

    # Generate email and phone number based on other data
    # Generate email and phone number based on other data
    local email="$(echo "${firstName}.${lastName}" | tr '[:upper:]' '[:lower:]')@example.com"
    local phone="+1555$(printf "%04d" $((RANDOM % 10000)))" # Random 4-digit suffix

    local DATA="{
        \"membershipId\": \"$membershipId\",
        \"firstName\": \"$firstName\",
        \"lastName\": \"$lastName\",
        \"email\": \"$email\",
        \"phone\": \"$phone\",
        \"status\": \"$status\",
        \"walletStatus\": \"$walletStatus\",
        \"gameStatus\": \"$gameStatus\",
        \"risk_Level\": \"$risk_Level\",
        \"kyc_Level\": \"$kyc_Level\",
        \"currency\": \"$currency\"
    }"
    echo "Creating member with payload: $DATA"
    curl -X POST "$BASE_URL" \
         -H "Content-Type: application/json" \
         -d "$DATA"
    echo ""
}

# Function to generate valid random data based on Status Matrix
generate_random_member() {
    local index=$1
    local id_padding=$(printf "%03d" $index)
    local membership_id="M$id_padding"
    
    local first_names=("James" "Mary" "John" "Patricia" "Robert" "Jennifer" "Michael" "Linda" "William" "Elizabeth" "David" "Barbara" "Richard" "Susan" "Joseph" "Jessica" "Thomas" "Sarah" "Charles" "Karen")
    local last_names=("Smith" "Johnson" "Williams" "Brown" "Jones" "Garcia" "Miller" "Davis" "Rodriguez" "Martinez" "Hernandez" "Lopez" "Gonzalez" "Wilson" "Anderson" "Thomas" "Taylor" "Moore" "Jackson" "Martin")
    
    local rand_first=${first_names[$RANDOM % ${#first_names[@]}]}
    local rand_last=${last_names[$RANDOM % ${#last_names[@]}]}
    
    # Status Matrix Logic
    # 70% Active (Unlocked/Unlocked)
    # 10% Suspended (Locked/Locked)
    # 5% Confiscated (Locked/Locked)
    # 5% Active (Locked/Unlocked) - Wallet restriction
    # 5% Active (Unlocked/Locked) - Game restriction
    # 5% Inactive (Unlocked/Unlocked) - Dormant
    
    local rand_seed=$((RANDOM % 100))
    local status="Active"
    local wallet_status="Unlocked"
    local game_status="Unlocked"

    if [ $rand_seed -lt 70 ]; then
        status="Active"; wallet_status="Unlocked"; game_status="Unlocked"
    elif [ $rand_seed -lt 80 ]; then
        status="Suspended"; wallet_status="Locked"; game_status="Locked"
    elif [ $rand_seed -lt 85 ]; then
        status="Confiscated"; wallet_status="Locked"; game_status="Locked"
    elif [ $rand_seed -lt 90 ]; then
        status="Active"; wallet_status="Locked"; game_status="Unlocked"
    elif [ $rand_seed -lt 95 ]; then
        status="Active"; wallet_status="Unlocked"; game_status="Locked"
    else
        status="Inactive"; wallet_status="Unlocked"; game_status="Unlocked"
    fi

    # Currencies
    local currencies=("CNY" "THB" "VND")
    local currency=${currencies[$RANDOM % ${#currencies[@]}]}

    # Risk Levels (Weighted)
    local risk_val=$((RANDOM % 100))
    local risk="Low"
    if [ $risk_val -lt 10 ]; then risk="High"; elif [ $risk_val -lt 30 ]; then risk="Medium"; fi
    
    # KYC Levels
    local kyc_levels=("Pending" "Verified" "Rejected" "UnderReview")
    local kyc=${kyc_levels[$RANDOM % ${#kyc_levels[@]}]}

    create_member "$membership_id" "$rand_first" "$rand_last" "$status" "$wallet_status" "$game_status" "$currency" "$risk" "$kyc"
}

# Generate 100 Records
echo "Generating 100 seed records..."
for i in {1..100}; do
    generate_random_member $i
done

echo "Seeding completed."
