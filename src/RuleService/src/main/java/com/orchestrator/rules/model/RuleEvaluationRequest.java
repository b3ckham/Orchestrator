package com.orchestrator.rules.model;

import java.util.ArrayList;
import java.util.List;

public class RuleEvaluationRequest {
    private String ruleSetName;
    private ContextPayload facts;

    public String getRuleSetName() { return ruleSetName; }
    public void setRuleSetName(String ruleSetName) { this.ruleSetName = ruleSetName; }

    public ContextPayload getFacts() { return facts; }
    public void setFacts(ContextPayload facts) { this.facts = facts; }
}
