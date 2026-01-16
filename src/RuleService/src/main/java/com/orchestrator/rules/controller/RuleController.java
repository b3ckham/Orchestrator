package com.orchestrator.rules.controller;

import com.orchestrator.rules.model.RuleDeploymentRequest;
import com.orchestrator.rules.model.RuleEvaluationRequest;
import com.orchestrator.rules.model.RuleEvaluationResponse;
import com.orchestrator.rules.model.ContextPayload;
import org.kie.api.KieServices;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/rules")
public class RuleController {

    // Rule Repository: PolicyName -> DRL Content
    private final Map<String, String> ruleRepository = new java.util.concurrent.ConcurrentHashMap<>();

    // Mutable container to support hot-swapping
    private KieContainer kieContainer;
    private final KieServices ks;

    public RuleController() {
        this.ks = KieServices.Factory.get();
        // Initial load from classpath
        this.kieContainer = ks.getKieClasspathContainer();

        // Note: For a real persistent system, we would load existing rules from DB
        // here.
    }

    @PostMapping("/deploy")
    public String deployRule(@RequestBody RuleDeploymentRequest request) {
        System.out.println("Deploying new rules for RuleSet: " + request.getRuleSetName());

        try {
            // 1. Update Repository
            ruleRepository.put(request.getRuleSetName(), request.getDrlContent());

            // 2. Rebuild Everything from Repository
            org.kie.api.builder.KieFileSystem kfs = ks.newKieFileSystem();

            for (Map.Entry<String, String> entry : ruleRepository.entrySet()) {
                String path = "src/main/resources/rules/" + entry.getKey() + ".drl";
                kfs.write(path, entry.getValue());
            }

            // 3. Build
            org.kie.api.builder.KieBuilder kb = ks.newKieBuilder(kfs);
            kb.buildAll();

            if (kb.getResults().hasMessages(org.kie.api.builder.Message.Level.ERROR)) {
                return "Compilation Error: " + kb.getResults().toString();
            }

            // 4. Update the Container
            this.kieContainer = ks.newKieContainer(kb.getKieModule().getReleaseId());

            return "RuleSet " + request.getRuleSetName() + " Deployed Successfully. Active Rules: "
                    + ruleRepository.keySet().size();

        } catch (Exception e) {
            e.printStackTrace();
            return "Deployment Failed: " + e.getMessage();
        }
    }

    @GetMapping("/active")
    public Map<String, Object> getActiveRules() {
        Map<String, Object> result = new HashMap<>();
        result.put("count", ruleRepository.size());
        result.put("ruleSets", ruleRepository.keySet());
        return result;
    }

    @PostMapping("/evaluate")
    public RuleEvaluationResponse evaluate(@RequestBody RuleEvaluationRequest request) {
        RuleEvaluationResponse response = new RuleEvaluationResponse();
        KieSession kSession = null;

        try {
            // Use the current dynamic container
            kSession = kieContainer.newKieSession();
            kSession.setGlobal("response", response);

            ContextPayload facts = request.getFacts();
            if (facts != null) {
                Map<String, Object> factsMap = new HashMap<>();
                if (facts.getMember() != null) {
                    factsMap.put("Member", facts.getMember());
                    kSession.insert(facts.getMember());
                }
                if (facts.getWallet() != null) {
                    factsMap.put("Wallet", facts.getWallet());
                    kSession.insert(facts.getWallet());
                }
                if (facts.getCompliance() != null) {
                    factsMap.put("Compliance", facts.getCompliance());
                    kSession.insert(facts.getCompliance());
                }
                response.setFacts(factsMap);
            }

            // Agenda Group Isolation
            String ruleSet = request.getRuleSetName();
            if (ruleSet != null && !ruleSet.isEmpty()) {
                kSession.getAgenda().getAgendaGroup(ruleSet).setFocus();
            }

            kSession.fireAllRules();

        } catch (Exception e) {
            System.err.println("Evaluation Failed: " + e.getMessage());
            e.printStackTrace();
        } finally {
            if (kSession != null)
                kSession.dispose();
        }

        return response;
    }
}
