package com.orchestrator.rules.model;

public class Compliance {
    private String riskLevel; // "Low", "Medium", "High"
    private String kycStatus; // "Verified", "Pending", "Rejected"

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public String getKycStatus() { return kycStatus; }
    public void setKycStatus(String kycStatus) { this.kycStatus = kycStatus; }
}
