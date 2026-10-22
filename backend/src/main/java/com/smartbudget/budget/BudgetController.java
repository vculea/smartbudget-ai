package com.smartbudget.budget;

import com.smartbudget.common.Years;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.YearMonth;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/budgets")
@Tag(name = "Budgets")
public class BudgetController {

    private final BudgetService service;
    private final Clock clock;

    public BudgetController(BudgetService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @GetMapping
    @Operation(summary = "List budgets of a month (or of a year) with spent amount, remaining amount, percentage and status",
            description = "month format YYYY-MM; defaults to the current month. With year=YYYY the limits of each "
                    + "category are summed over the 12 months and compared with the yearly spending.")
    public List<BudgetResponse> list(@RequestParam(required = false) YearMonth month,
                                     @RequestParam(required = false) Integer year) {
        Years.requireSingleSelector(month, year);
        if (year != null) {
            return service.listForYear(Years.require(year));
        }
        return service.list(month != null ? month : YearMonth.now(clock));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a budget (one per category and month)")
    public BudgetResponse create(@Valid @RequestBody BudgetRequest request) {
        return service.create(request);
    }
}
