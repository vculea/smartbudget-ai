package com.smartbudget.dashboard;

import com.smartbudget.common.Years;

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
    @Operation(summary = "Monthly or yearly financial indicators",
            description = "balance = income - expenses; savingsRate = balance / income * 100 (0 without income); "
                    + "budgetUsedPercentage = spending on budgeted categories / total limits * 100 (0 without budgets). "
                    + "month format YYYY-MM, defaults to the current month; year=YYYY returns the whole year "
                    + "(monthlyTrend then contains the 12 months of that year).")
    public DashboardResponse get(@RequestParam(required = false) YearMonth month,
                                 @RequestParam(required = false) Integer year) {
        Years.requireSingleSelector(month, year);
        if (year != null) {
            return service.getForYear(Years.require(year));
        }
        return service.get(month != null ? month : YearMonth.now(clock));
    }
}
