-- Migration Script for Enhanced Workflow Policies
-- This script demonstrates how to update existing workflows or insert new ones using the JSON-based policy format.

-- 1. Add New Columns (Already executed)
-- ALTER TABLE WorkflowDefinitions ADD COLUMN TriggerConditionJson LONGTEXT;
-- ALTER TABLE WorkflowDefinitions ADD COLUMN OnMatchActionsJson LONGTEXT;
-- ALTER TABLE WorkflowDefinitions ADD COLUMN OnNoMatchActionsJson LONGTEXT;

-- 2. Example: Update an existing workflow to use Multi-Action Logic
-- Scenario: If Member Status is 'Suspended', Lock Wallet AND Send Email.
UPDATE WorkflowDefinitions
SET 
    -- Trigger Logic: Status == 'Suspended'
    TriggerConditionJson = '{ "Logic": "AND", "Criteria": [ { "Field": "NewStatus", "Operator": "==", "Value": "Suspended" } ] }',
    
    -- On Match: Lock Wallet, Send Notification
    OnMatchActionsJson = '[ { "Type": "LOCK_WALLET", "Params": {} }, { "Type": "SEND_EMAIL", "Params": { "template": "account_suspended" } } ]',
    
    -- On No Match: (Optional) Log it
    OnNoMatchActionsJson = '[]',
    
    -- Clear legacy fields to avoid confusion (Set to empty string, not NULL)
    ConditionCriteria = '',
    ActionType = ''
WHERE Name = 'Suspension';

-- 3. Insert New Workflow: Risk High -> Compliance Check
INSERT INTO WorkflowDefinitions 
(Name, EntityType, TriggerEvent, TriggerKey, TriggerConditionJson, OnMatchActionsJson, RuleSet, ContextProfile, IsActive, Version, ConditionCriteria, ActionType)
VALUES 
(
    'High Risk Compliance', 
    'Member', 
    'ComplianceStatusChanged', 
    'RiskCheck_v1',
    -- Trigger: RiskLevel == 'High'
    '{ "Logic": "AND", "Criteria": [ { "Field": "NewRiskLevel", "Operator": "==", "Value": "High" } ] }',
    -- Action: Create Jira Ticket
    '[ { "Type": "CREATE_TICKET", "Params": { "priority": "Critical" } } ]',
    'risk_policy',
    'Standard',
    1,
    1,
    '', 
    ''
);
