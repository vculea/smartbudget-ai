package com.smartbudget.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI budget plan")
public class BudgetPlanController {

    private final BudgetPlanService service;

    public BudgetPlanController(BudgetPlanService service) {
        this.service = service;
    }

    @PostMapping("/budget-plan")
    @Operation(summary = "Propose the monthly budget of a year with the server AI",
            description = "Spending limits for expense categories and expected amounts for income categories, based on "
                    + "the monthly averages in the selected year and the year before (complete months only). Nothing "
                    + "is saved. Errors: 400 invalid year, 422 no transactions, 429/502/503/504 AI provider problems.")
    public BudgetPlanResponse budgetPlan(@Valid @RequestBody BudgetPlanRequest request) {
        return service.generate(request.year());
    }

    @PostMapping("/local/budget-plan/prompt")
    @Operation(summary = "Prompt for proposing the budget of a year with a model run by the browser")
    public ImportAiPrompt budgetPlanPrompt(@Valid @RequestBody BudgetPlanRequest request) {
        return service.prompt(request.year());
    }

    @PostMapping("/local/budget-plan/result")
    @Operation(summary = "Validates the budget proposal of a model run by the browser",
            description = "Unknown categories and invalid limits are dropped. Errors: 422 no spending, "
                    + "502 invalid AI answer.")
    public BudgetPlanResponse budgetPlanResult(@Valid @RequestBody BudgetPlanResultRequest request) {
        return service.result(request.year(), request.content());
    }
}
