export interface WorkflowDefinition {
    id: number;
    name: string;
    triggerEvent: string;
    conditionCriteria: string;
    actionType: string;
    isActive: boolean;
    ruleSet?: string;
    contextProfile?: string;
}

export interface WorkflowExecution {
    id: number;
    workflowDefinitionId: number;
    membershipId: string;
    traceId: string;
    status: string;
    logs: string;
    executedAt: string;
    workflowName?: string;
}
