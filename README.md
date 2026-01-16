# Orchestrator

The **Orchestrator** is the central nervous system for business flow management. It decouples business policy (decisions) from technical execution (actions), ensuring that workflows are reliable, auditable, and idempotent.

## 📚 Documentation
The primary source of truth for this repository is the **Orchestrator Specification**.
- **Specification**: [docs/Orchestrator_Specification.md](docs/Orchestrator_Specification.md)

### Core Sections
- **Architecture Overview**: [Section 2](docs/Orchestrator_Specification.md#2-architecture-overview)
    - Describes the "Brain" (Drools) vs "Muscle" (Adapters) decoupling.
- **System Context Diagram**: [Section 2.2](docs/Orchestrator_Specification.md#22-system-context)
    - Visualizes the flow between Event > Orchestrator > Context > Rules > Actions.
- **Core Modules**: [Section 4](docs/Orchestrator_Specification.md#4-component-specifications)
    - **Orchestrator Service**: Coordinator & State Machine.
    - **Rule Service**: Drools-based decision engine (Java).
    - **Context Provider**: Aggregates facts from Member/Wallet/Compliance services.
    - **Action Adapter**: Executes side-effects (HTTP calls).
    - **N8n**: Manages human operation workflows and notifications.

## 🔄 Key Sequences
- **Runtime Execution Flow**: [Section 7.2](docs/Orchestrator_Specification.md#72-runtime-execution-flow)
    1. Ingress (RabbitMQ)
    2. Context Resolution
    3. Rule Evaluation
    4. Action Determination
    5. Execution
- **Data Lineage (Traceability)**: [Section 17](docs/Orchestrator_Specification.md#17-level-5-data-lineage--traceability)

## 🛠 Project Structure
- `src/Orchestrator.Shared` - Shared Contracts, Enums, and Audit Models.
- `src/OrchestratorService` - Core logic (.NET).
- `src/RuleService` - Decision Engine (Java).
- `src/MemberService` - Domain Service (MySQL).
- `src/WalletService` - Domain Service (MySQL).
- `src/ComplianceService` - Domain Service (MySQL).
