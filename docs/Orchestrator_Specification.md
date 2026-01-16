# Orchestrator Specification

## 1. Executive Summary
The **Orchestrator** is the central nervous system for business flow management. It decouples business policy (decisions) from technical execution (actions), ensuring that workflows are reliable, auditable, and idempotent.

Unlike a traditional message handler that hardcodes logic, the Orchestrator acts as a **State Machine and Coordinator**:
1.  **Listens** to domain events (e.g., `MemberStatusChanged`).
2.  **Enriches** contexts by fetching current facts.
3.  **Evaluates** decisions using a pure rule engine (Drools).
4.  **Executes** side effects via standardized adapters or integration tools (n8n).

This architecture allows for "Workflow as a Product," enabling non-engineering teams to adjust policies (via Drools) and notifications (via n8n) without code deployments to core services.

---

## 2. Architecture Overview

### 2.1 High-Level Design Principles
-   **Orchestrator-First**: The orchestrator is the source of truth for "what happens next."
-   **Decoupled Decisioning**: The "Brain" (Drools) is separate from the "Muscle" (Action Adapter).
-   **Idempotency**: Every event and command is uniquely identified to prevent duplicate processing.
-   **Convergent State**: Actions are designed to bring the system to a desired state (e.g., "Ensure Wallet is Locked") rather than just firing commands blindly.

### 2.2 System Context
```mermaid
graph TD
    %% 1. Event Sources
    subgraph Layer_1 [1. Event Sources]
        Events[Login / Deposit / Risk / KYC Events]
    end

    %% 2. Orchestration Layer
    subgraph Layer_2 [2. Orchestration Layer]
        Core[Core Orchestrator - .NET]
        n8n[n8n - Integration Engine]
        
        Meta[Capabilities: Idempotency, Retries, Dead Letter Queue]
        Core -.- Meta
    end

    %% 3. Decision Support Layers (Detailed)
    subgraph Layer_3 [3. Context Provider]
        direction TB
        CP[Context Aggregator]
        
        subgraph CP_Meta [Metadata & Control]
            Registry[Attribute Registry\n(Contract Definitions)]
            Cache[Redis Cache\n(Coalescing & Auth)]
        end
        
        subgraph CP_Connectors [Connector Catalog]
            Conn_M[Member Adapter]
            Conn_W[Wallet Adapter]
            Conn_C[Compliance Adapter]
        end
        
        CP -->|1. Resolve Contract| Registry
        CP -->|2. Check Cache| Cache
        CP -->|3. Fetch Attributes| CP_Connectors
    end

    %% External Data Stores
    subgraph Data_Sources [Source Systems / Data Stores]
        DB_M[(Member DB)]
        DB_W[(Wallet DB)]
        API_C[Compliance API]
    end

    %% 4. Rule Engine
    subgraph Layer_4 [4. Rule Engine]
        Rules[Drools Service]
        DetailsR[DRL Rulesets / Stateless Logic]
        Rules -.- DetailsR
    end

    %% 5. Execution / Materialization
    subgraph Layer_5 [5. Execution & Materialization]
        direction LR
        Fast[Segment Materializer / Wallet DB]
        Slow[Human Notifications: Teams/Email]
    end

    %% Main Flow Connections
    Events -->|Publish| Core
    
    %% Context Data Flow
    Core -->|1. Request Context| CP
    Conn_M --> DB_M
    Conn_W --> DB_W
    Conn_C --> API_C
    
    %% Decision Flow
    Core -->|2. Evaluate| Rules
    
    %% Action Dispatch
    Core -->|3a. Fast Path: Lock/Update| Fast
    Core -->|3b. Slow Path: Webhook| n8n
    
    %% n8n downstream
    n8n -->|Fan-out| Slow
```

---

## 3. Core Concepts & Data Models

| Concept | Description | Example |
| :--- | :--- | :--- |
| **Trigger** | The domain event that initiates a workflow. | `MemberStatusChanged` |
| **Workflow** | A defined sequence regarding how to handle a trigger. | `member-status-governance-v1` |
| **Context Profile** | Defines what data (facts) are needed for decisioning. | `MemberStatusGate_v1` (requires Member Profile + Wallet Balance) |
| **RuleSet** | A collection of deterministic business rules. | `member_status_policy_v3` |
| **Action** | A concrete side-effect to be executed. | `LOCK_WITHDRAWAL`, `SEND_NOTIFICATION` |

### 3.1 Workflow Primitives
The Orchestrator supports robust flow control primitives:

1.  **EXECUTE(command)**: Run a synchronous action via the Action Adapter.
2.  **WAIT(duration)**: Pause execution for a set time (e.g., cooldown).
3.  **WAIT_UNTIL(condition)**: Polling or event-driven wait (e.g., wait until `WalletLocked` event).
4.  **WAIT_FOR_CALLBACK(token)**: Pause until an external system (n8n/User) notifies completion.
5.  **RETRY(policy)**: Exponential backoff for transient failures.
6.  **BRANCH**: Conditional logic based on step outcomes.

---

## 4. Component Specifications

### 4.1 Orchestrator Service (.NET Web API)
**Role**: The coordinator. Manages workflow state, audit trails, and dispatching.
-   **Responsibilities**:
    -   Event consumption (MassTransit/RabbitMQ).
    -   Idempotency checks (EventID deduplication).
    -   Audit logging (`RUN_STARTED`, `DECISION_MADE`, `ACTION_SENT`).
    -   Dispatching logic (System actions -> Adapter, Notifications -> n8n).

### 3.4 Universal Action Router
The **Universal Action Router** replaces hardcoded adapters with a dynamic, configuration-driven system.

*   **ActionRouteConfig**: Maps an `ActionType` (e.g., `LOCK_WALLET`, `TEAM_NOTIFY`) to a target HTTP endpoint.
    *   `ActionType` (string): Unique identifier (e.g., "LOCK_WALLET").
    *   `TargetUrl` (string): The URL to call (supports handlebars replacement: `{{membershipId}}`).
    *   `HttpMethod` (string): GET, POST, PUT, PATCH, DELETE.
    *   `PayloadTemplate` (json string): Template for the request body. Supports variable interpolation using single braces `{variable}` (sanitized from `{{variable}}` during seeding to avoid C# string interpolation conflicts).
    *   `AuthSecret` (optional): Override for specific routes.
*   **ActionAdapterConfig**: Defines "Core Adapters" (services) that routes can be linked to.
    *   `AdapterName` (e.g., "MemberService", "N8n").
    *   `BaseUrl` (e.g., "http://localhost:5002").
    *   `ApiKey` (optional): For services like n8n.
*   **GenericHttpAdapter**: The single execution engine that executes *all* actions by looking up the route configuration and dispatching an HTTP request.
*   **N8n Integration**:
    *   **Discovery**: The Orchestrator can fetch available workflows from n8n using the Public API.
    *   **Templating**: Routes can be auto-configured by selecting an n8n workflow.

### 3.5 Workflow Policy Engine
(No changes to Rule Evaluation logic, but Action Execution now uses the Universal Router).

### 4.2 Context Provider Service (.NET Web API)
**Role**: The Data Aggregator.
-   **Responsibilities**:
    *   Receives a `ContextProfile` (e.g., `MemberGovernance`).
    *   Parallel fetch from domain services (Member, Wallet, Compliance).
    *   Returns a flattened "Fact Object" for the Rule Engine.
-   **Design Intent**: Keeps the Rule Service pure (no side effects/IO) and the Orchestrator lightweight.

### 4.3 Rule Service (Java / Spring Boot / Drools)
**Role**: The Decision Brain.
-   **Implementation**: A standalone Java microservice running Drools 8.x.
-   **API**: Exposes `POST /api/rules/evaluate` accepting a JSON payload of Facts.
-   **Responsibilities**:
    -   **Stateless Execution**: Validates facts against DRL text files loaded on startup.
    -   **Fact Payload**: Accepts generic Key-Value maps (e.g., `member`, `wallet`, `compliance`).
    -   **RuleSets**: Segregates logic by domain (e.g., `compliance_policy`, `eligibility_policy`, `RiskAssessment`).
    -   **Outcome**: Returns simple `isMatch` boolean and a list of `reasons` or `actions` to take.
-   **Constraint**: Drools NEVER calls external services or performs IO. It only computes decisions based on provided facts.

### 4.4 Action Adapter (.NET Web API)
**Role**: The Execution Layer (Muscle).
-   **Responsibilities**:
    -   Translates abstract commands (`LOCK_WALLET`) into specific service calls (`POST /wallet/locks`).
    -   Handles technical retries and service-specific auth.
    -   Ensures command idempotency keys are forwarded downstream.

### 4.5 n8n (Integration & Human Ops)
**Role**: The Router for human tasks, notifications, and cross-system glue.
-   **Implementation**: Running as a Docker container (`dms_n8n`), separate from the core backend.
-   **Responsibilities**:
    -   **Notification Gateway**: Handles `SEND_EMAIL`, `SEND_SMS`, and `TEAM_NOTIFY` actions dispatched by the Orchestrator.
    -   **Audit & Ticketing**: Handles `LOG_AUDIT` for system trails and `CREATE_TICKET` for operational issues.
    -   **Approval Workflows**: Manages state for long-running human approvals (e.g., "Approve Unlocking").
-   **Integration**:
    -   Receives HTTP Webhooks from `ActionExecutionService` based on dynamic `ActionAdapterConfigs` (BaseUrl, AuthToken, Headers).
    -   Processes data visually using n8n workflow nodes.
    -   (Future) Calls back to Orchestrator to resume suspended workflows.

### 4.6 Workflow Scheduler (Background Service)
**Role**: Time-based Execution.
-   **Implementation**: `IHostedService` running alongisde the Orchestrator API.
-   **Responsibilities**:
    -   Periodic scanning for scheduled workflows.
    -   Batch processing of members satisfying temporal conditions.
    -   Generating `TraceId` for cron-jobs to ensure auditability.

### 4.7 Infrastructure & Data Consistency
-   **RabbitMQ**: Message Broker (Topic: `member.*`, DLQ: `member.*.dlq`).
-   **Database**: MySQL (Workflow Definitions, Run History, Service Data).
    -   **Shared Schema**: Members, Wallets, and ComplianceProfiles are mapped 1:1:1 via `MembershipId`.
    -   **Member Master**: Includes `Phone`, `Risk_Level`, `KYC_Level`, `Email_Verified`, `Phone_Verified`, and `GameStatus`.
-   **Redis**: Idempotency locks, Rate limiting, Transient state.

---

## 5. API Contracts & Schemas

### 5.1 Domain Events (RabbitMQ Ingress)
Supported events: `MemberStatusChanged`, `WalletUpdated`, `ComplianceStatusChanged`, `MemberUpdated`.

**Crucial Implementation Note**: To ensure interoperability between microservices that may share overlapping Enum names but different namespaces (e.g., `MemberService.Models.WalletStatus` vs `WalletService.Models.WalletStatus`), all Enum fields in MassTransit contracts are serialized as **Strings**. Consumers manually parse these strings back to their local Enum types.

```json
{
  "eventId": "uuid-v4",
  "eventType": "MemberUpdated", 
  "occurredAt": "2023-10-27T10:00:00Z",
  "data": {
    "membershipId": "M123",
    "walletStatus": "Locked", // String, not Enum Int
    "email": "user@example.com",
    "status": "Active"
  }
}
```

### 5.2 Fact Lookup API (Member Service)
**GET** `/api/members/by-membership/{membershipId}`
- Returns the complete member profile for fact enrichment.

### 5.3 Context Resolution (Orchestrator -> Context Provider)
**GET** `/api/context/resolve`
*   **Query Params**: `membershipId=M123&profile=Standard_v1`
**Response**:
```json
{
  "member": { 
    "membershipId": "M123",
    "status": "Active",
    "phone": "123-456-7890",
    "risk_Level": "Low",
    "kyC_Level": "Verified",
    "gameStatus": "Unlocked"
  },
  "wallet": { "balance": 1000.00, "currency": "CNY", "status": "Active" },
  "compliance": { "riskLevel": "Low", "kycStatus": "Verified" }
}
```

### 5.4 Rule Evaluation (Orchestrator -> Rule Service)
**POST** `/api/rules/evaluate`
```json
{
  "ruleSetName": "member-status-policy",
  "facts": {
    "member": {
      "membershipId": "M123",
      "status": "Active",
      "risk_Level": "High",
      "kyC_Level": "Verified"
    },
    "wallet": {
      "balance": 500.0,
      "currency": "CNY",
      "status": "Active"
    },
    "compliance": {
      "riskLevel": "High",
      "kycStatus": "Verified"
    },
    "trigger": "MemberStatusChanged"
  }
}
```
**Response**:
```json
{
  "isMatch": true,
  "outcome": "RISK_DETECTED",
  "reasons": ["Member Risk Level is High", "Wallet Balance > threshold"]
}
```

### 5.5 Command Execution (Orchestrator -> Action Adapter)
**POST** `/commands/execute`
```json
{
  "commandId": "uuid-cmd-1",
  "actionType": "LOCK_WITHDRAWAL",
  "parameters": { "reason": "Confiscation" },
  "membershipId": "M123"
}
```

### 5.6 Test Action (Debug)
**POST** `/api/workflows/actions/test`
Allows developers to trigger an action route immediately with a custom payload to verify connectivity and template resolution.
```json
{
  "actionType": "LOCK_WALLET",
  "payload": { "membershipId": "TEST-USER-1" }
}
```

### 5.7 Notification Webhook (Orchestrator -> n8n)
**POST** `https://n8n-instance/webhook/member-status-notify`
```json
{
  "actionType": "SEND_EMAIL",
  "membershipId": "M123",
  "contextStatus": "Suspended",
  "parameters": {
    "template": "account_suspended",
    "reason": "Compliance Review"
  },
  "timestamp": "2023-10-27T10:05:00Z"
}
```

---

## 6. Frontend: Member Directory & Insights
The Frontend provides high-level visibility into the domain state and workflow telemetry.
- **Member Directory**:
    - **Insights**: Direct visibility into Wallet Balance, Risk Level, and KYC Status for every member.
    - **Sorting**: Advanced sorting by Joined Date, Member ID, Status, Wallet Balance (High/Low), and Risk Level.
    - **Actions**: Trigger on-demand status updates which automatically initiate backend workflows.
- **Workflow Dashboard**:
    - **Configuration**: Management of `TriggerEvent`, `ContextProfile`, and `RuleSet` mappings.
    - **Monitoring**: Live execution log detailing every step of the orchestrated flow.

This section details how a **New Workflow** is defined and how that definition drives the runtime behavior of all three services.

### 7.1 Storing the Definition
When a user creates a workflow, it is stored in the **Orchestrator Database**. The definition contains **Routing Metadata** for the other services.

**WorkflowDefinition Table**:
| Field | Purpose |
| :--- | :--- |
| `TriggerEvent` | **When** to start (e.g., `MemberStatusChanged`). |
| `EntityType` | **What** triggered it (e.g., `Member`, `Wallet`). |
| `ContextProfile` | **What data** the Context Provider must fetch (e.g., `MemberGovernance_v1`). |
| `RuleSet` | **Which Rules** the Rule Service must execute (e.g., `compliance_policy_v2`). |
| `Version` | Configuration Version for deterministic replay. |
| `Action` | **What to do** if rules match (e.g., `LOCK_WALLET`). |

### 7.2 Runtime Execution Flow
The Orchestrator acts as the "Director" in a 5-step lifecycle:
1.  **Event Ingress & Lookup**: Consumer receives event from RabbitMQ and finds the active `WorkflowDefinition`.
2.  **Context Resolution**: Orchestrator calls Context Provider using the `ContextProfile` defined in the workflow.
3.  **Rule Evaluation**: Orchestrator calls Rule Service using the `RuleSet` and the facts fetched in step 2.
4.  **Action Determination**: If the rules return `isMatch: true`, the Orchestrator identifies the mapped `Action`.
5.  **Final Execution**: Orchestrator executes the action via the **Action Adapter**.

---

## 8. Extensibility: Adding New Triggers
The architecture supports adding new triggers without changing core Rule or Context services:
1.  **Create Consumer**: Add a new MassTransit Consumer in Orchestrator for the new event.
2.  **Define Workflow**: Insert a new row into `WorkflowDefinitions` with the relevant `ContextProfile`, `RuleSet`, and `Action`.
3.  **Deploy**: No code changes to Rule/Context services if existing logic/data support the requirement.

---

## 9. Observability: Live Execution Log
Every workflow execution is recorded with granular details to ensure transparency.

| Flow Step | Log Step Name | Data Captured |
| :--- | :--- | :--- |
| **1. Event Ingress** | `Workflow Trigger` | Trigger Metadata + Raw Event Payload |
| **2. Context Resolution** | `Context Fetch` | **Full Fact Snapshot**: Member, Wallet, Compliance state exactly when fetched. |
| **3. Rule Evaluation** | `Rule Evaluation` | **EvaluationTraceDetail**: Rule Name, Conditions Checked, IsMatch, Reasons. |
| **4. Action Execution** | `Action Execution` | **ActionTraceDetail**: Endpoint called, Request Payload, Response Payload, Duration. |

---

## 10. Migration Strategy
To transition from legacy hardcoded logic to this engine:
1.  **Schema Updates**: Add `ContextProfile` and `RuleSet` columns to `WorkflowDefinitions`.
2.  **Data Backfill**: Map existing `ConditionCriteria` (old string logic) to new `RuleSet` identifiers.
3.  **Validation**: Run in "Shadow Mode" (log but don't execute) to verify decisions before cutting over.

---

## 11. Workflows (Examples)

### 11.1 Member Status Change (Confiscation - **VERIFIED**)
**Trigger**: Operator changes Member Status from **Active** to **Confiscated**.
1.  **Event**: `MemberStatusChanged` published by `MemberService`.
2.  **Context**: Orchestrator fetches `Member` (Status: Confiscated), `Wallet` (Status: Unlocked), and `Compliance` (Risk: Low).
3.  **Rule Execution**: Calls `RuleService` with `RuleSet: compliance_policy`.
    -   **Input Facts**: Member Status = Confiscated.
    -   **DRL Logic**: "If Status is Confiscated, Action is LOCK_WALLET".
    -   **Result**: `isMatch: true`, `Action: LOCK_WALLET`.
4.  **Action**: `ActionExecutionService` sends `PUT /api/wallets/{id}/status` with `Locked`.
5.  **Outcome**: Wallet is Locked. Audit log records `Success`.

### 11.2 Wallet Balance Threshold (AML)
**Trigger**: A large deposit or transfer occurs.
1.  **Event**: `WalletUpdated` published.
2.  **Context Provider**: Returns Member KYC Level + Transaction History.
3.  **Rule Service**: Evaluates `aml_threshold_policy`. Returns `outcome: HIGH_RISK`.
4.  **Action Adapter**: Executes `LOCK_WITHDRAWAL` and notifies Compliance.

### 11.3 Compliance Level Change
**Trigger**: KYC verification or background check update.
1.  **Event**: `ComplianceStatusChanged` published.
2.  **Context Provider**: Returns Member Account Status.
3.  **Rule Service**: Evaluates `kyc_upgrade_policy`. Checks if account was previously `Suspended`.
4.  **Action Adapter**: Executes `UNLOCK_WALLET` if status is now `Verified`.

---

## 12. POC Scope & Requirements

### 12.1 Goal
Prove the end-to-end flow from a UI event -> Orchestrator -> Drools Logic -> Side Effect (Wallet Lock + Email).

### 12.2 Minimal Components
1.  **POC UI**: Simple page to toggle Member Status.
2.  **Docker Compose Environment**: RabbitMQ, Redis, MySQL.
3.  **Services**: Orchestrator (.NET), Context Provider (.NET), Rule Service (Java), Action Adapter (.NET), n8n.

### 12.3 Success Criteria
-   [x] Changing status to "Confiscated" triggers a "Lock" log in Action Adapter.
-   [x] Changing status to "Active" triggers a "Welcome Back" log.
-   [x] Idempotency: Replaying the same RabbitMQ message does not trigger duplicate actions.

---

## 13. Non-Functional Requirements (NFRs)
-   **Reliability**: Workflow state must be persisted in MySQL.
-   **Observability**: Trace ID propagation and granular step logging.
-   **Latency**: P99 processing time < 500ms.
-   **Scalability**: Stateless evaluation allows horizontal scaling of Rule and Context services.

---

## 14. Level 2: Configuration & Resiliency (Completed)
To ensure the system is Production-Ready, all services have been refactored to eliminate hardcoded dependencies.

### 14.1 Configuration Management
*   **ServiceUrls**: All inter-service communication is driven by `appsettings.json` under the `ServiceUrls` section. Includes `RuleService`, `MemberService`, `WalletService`, `ComplianceService`, `AuditService`, `ContextProvider`, `RabbitMqMgr`, and `N8n`.
*   **Strict Validation**: Services now strictly validate configuration on startup. Missing keys (e.g., `RabbitMQ:Host`) cause an immediate crash (Fail Fast) rather than silent fallbacks to `localhost`.
*   **Environment Awareness**: `appsettings.Development.json` vs `appsettings.Production.json` handles environment switching.

---

## 15. Level 3: Enterprise Rule Engine (Design)
We are evolving the Rule Service from a simple POC to a multi-tenant, enterprise-grade decision engine.

### 15.1 Core Problem
The POC used a single global rule namespace. This means "Marketing Rules" could accidentally fire during a "Compliance Check" if conditions overlapped. Enterprise systems require **Policy Isolation**.

### 15.2 Solution: Agenda Groups & Stateful Repository
We introduce **Agenda Groups** to isolate rulesets and an **In-Memory Repository** for safe hot-reloading.

```mermaid
graph TD
    subgraph Rule_Service [Rule Service - Enterprise]
        direction TB
        Repo[In-Memory Rule Repository\n(Map<RuleSet, DRL>)]
        FS[KieFileSystem]
        Container[Hot-Swappable KieContainer]
        
        Deploy[POST /deploy]
        Execution[POST /evaluate]
        
        Deploy -->|1. Store DRL| Repo
        Repo -->|2. Rebuild All| FS
        FS -->|3. Update| Container
        
        Execution -->|1. Select Policy| Container
        Container -->|2. Set Focus 'Agenda Group'| Session
        Session -->|3. Fire Matching Rules| Outcome
    end
```

### 15.3 Key Structural Changes
1.  **Rule Repository**: A `Map<String, String>` stores all active DRLs in memory. This ensures that when a new rule is deployed, we don't lose the existing ones during the `KieFileSystem` rebuild.
2.  **Agenda Groups**: Every DRL file now declares an `agenda-group "policy_name"`.
    *   *Effect*: When Orchestrator requests `compliance_policy`, ONLY rules tagged with `agenda-group "compliance_policy"` are added to the active execution agenda.
3.  **Hot Swap**: The deployment endpoint triggers a full rebuild of the `KieContainer` in milliseconds, updating the live engine without downtime.

---

## 16. Level 4: System Observability 
A centralized "Control Tower" for monitoring system health and business logic failures.

### 16.1 Architecture
The observability stack consists of three layers:

```mermaid
graph LR
    subgraph Services [Microservices]
        M[Member]
        W[Wallet]
        O[Orchestrator]
    end
    
    subgraph Middleware [Global Error Middleware]
        Filter[Exception Processor]
        Pattern[Pattern Matcher\n(DB/API/Business)]
    end
    
    subgraph Observability [Observability Stack]
        Audit[Audit Service]
        DB[(Audit DB)]
        Dash[Frontend Dashboard]
    end
    
    M --> Filter
    W --> Filter
    O --> Filter
    
    Filter -->|Fire & Forget Log| Audit
    Audit -->|Store| DB
    Dash -->|Read Logs| Audit
```

### 16.2 Components
1.  **GlobalExceptionMiddleware**:
    *   Intercepts ALL unhandled exceptions.
    *   **Classifies** errors into categories: `Database`, `Connectivity`, `Business`, `Security`.
    *   **Enriches** logs with `TraceId`, `Service`, and environmental Context.
    *   Asynchronously POSTs to AuditService.
2.  **AuditService (Port 5400)**:
    *   Dedicated microservice for writing logs to MySQL (`SystemErrors` table).
    *   API: `POST /api/errors`, `GET /api/errors`.
3.  **Frontend Dashboard**:
    *   Real-time visualization of system health.
    *   Filter by Service, Severity, and Category.
    *   Drill-down views for Stack Traces and Execution Contexts.

---

## 17. Level 5: Data Lineage & Traceability 
We have implemented a comprehensive "Flight Recorder" for every workflow execution, enabling full replayability and auditing.

### 17.1 Problem
In distributed systems, knowing *why* a decision was made is difficult.
- "Why was Wallet Locked?" (Because Rule X matched).
- "Why did Rule X match?" (Because at T-minus-1 second, Balance was 0).
- "What was the exact API response from the Wallet Service?"

### 17.2 Solution: Shared Trace Contracts
We extracted the trace models into a shared library (`Orchestrator.Shared`) to standardize logging across all consumers and schedulers.

**Key Models**:
*   `ExecutionTrace`: The root object containing the entire story.
*   `TraceStep`: A granular action (e.g., "Rule Evaluation", "Action Execution").
*   `EvaluationTraceDetail`: Snapshotted **FACTS** (Member, Wallet, Compliance state) at the exact moment of evaluation.

### 17.3 Architecture Adaptation
1.  **Shared Library**: `Orchestrator.Shared.dll` is referenced by `OrchestratorService`.
2.  **Standardized Logging**: All Consumers (`MemberStatusChanged`, `WalletUpdated`, `ComplianceStatusChanged`) and the `WorkflowScheduler` use a unified `SaveExecution` helper to populate the trace.
3.  **Frontend Lazy Loading**: The Dashboard now fetches the heavy trace JSON only on demand via `GET /api/workflows/executions/{id}/trace`.

### 17.4 Trace API
**GET** `/api/workflows/executions/{id}/trace`
*   **Response**: Returns the full `ExecutionTrace` JSON (Facts, Rules, Outcomes, API Raw Requests/Responses).
*   **UI Integration**: The "Live Execution Log" modal renders this data rich components (JSON Tree View for Facts).

---

## 18. Scheduled Workflows
Beyond event-driven triggers, the Orchestrator now supports **Time-Based Triggers**.

### 18.1 Architecture
*   **WorkflowScheduler**: A Background Service (`IHostedService`) running inside `OrchestratorService`.
*   **Polling Loop**:
    1.  Wakes up every X seconds (Default: 60s).
    2.  Scans `WorkflowDefinitions` for time-based triggers (e.g., `DailyCheck`).
    3.  Fetches active members via `MemberService`.
    4.  Evaluates rules for each member (just like an event).
*   **Concurrency**: Uses `SemaphoreSlim` to throttle parallel processing and prevent system overload.

### 18.2 Use Cases
*   **Birthday Rewards**: "If Today == Birthday, Grant Bonus".
*   **Membership Expiry**: "If ExpiryDate < Today, Downgrade Status".
*   **Dormancy Check**: "If LastLogin > 30 Days, Send Re-engagement Email".

