package com.orchestrator.rules.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class RuleEvaluationResponse {
    private boolean isMatch;
    private String outcome;
    private List<String> reasons = new ArrayList<>();
    private Map<String, Object> facts;

    public boolean isMatch() {
        return isMatch;
    }

    public void setMatch(boolean match) {
        isMatch = match;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public List<String> getReasons() {
        return reasons;
    }

    public void setReasons(List<String> reasons) {
        this.reasons = reasons;
    }

    public void addReason(String reason) {
        this.reasons.add(reason);
    }

    public Map<String, Object> getFacts() {
        return facts;
    }

    public void setFacts(Map<String, Object> facts) {
        this.facts = facts;
    }
}
