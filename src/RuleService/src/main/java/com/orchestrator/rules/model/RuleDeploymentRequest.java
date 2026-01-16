package com.orchestrator.rules.model;

public class RuleDeploymentRequest {
    private String ruleSetName;
    private String drlContent;

    public String getRuleSetName() {
        return ruleSetName;
    }

    public void setRuleSetName(String ruleSetName) {
        this.ruleSetName = ruleSetName;
    }

    public String getDrlContent() {
        return drlContent;
    }

    public void setDrlContent(String drlContent) {
        this.drlContent = drlContent;
    }
}
