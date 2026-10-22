package com.smartbudget.dashboard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.YearMonth;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard")
public class DashboardController {

    private final DashboardService service;
    private final Clock clock;

    public DashboardController(DashboardService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @GetMapping
    @Operation(summary = "Monthly financial indicators",
            description = "balance = income - expenses; savingsRate = balance / income * 100 (0 without income); "
                    + "budgetUsedPercentage = spending on budgeted categories / total limits * 100 (0 without budgets). "
                    + "month format YYYY-MM, defaults to the current month.")
    public DashboardResponse get(@RequestParam(required = false) YearMonth month) {
        return service.get(month != null ? month : YearMonth.now(clock));
    }
}
