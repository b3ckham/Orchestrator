package com.orchestrator.rules.model;

import java.math.BigDecimal;

public class Wallet {
    private BigDecimal balance;
    private String currency; // "CNY", "USD"
    private String status;   // "Active", "Locked"

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
