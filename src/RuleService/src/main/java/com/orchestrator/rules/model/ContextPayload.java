package com.orchestrator.rules.model;

import java.util.ArrayList;
import java.util.List;

public class ContextPayload {
    private Member member;
    private Wallet wallet;
    private Compliance compliance;

    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }

    public Wallet getWallet() { return wallet; }
    public void setWallet(Wallet wallet) { this.wallet = wallet; }

    public Compliance getCompliance() { return compliance; }
    public void setCompliance(Compliance compliance) { this.compliance = compliance; }
}
