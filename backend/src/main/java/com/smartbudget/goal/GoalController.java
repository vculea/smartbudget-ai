package com.smartbudget.goal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/goals")
@Tag(name = "Savings goals")
public class GoalController {

    private final GoalService service;

    public GoalController(GoalService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List savings goals with accumulated amount and progress")
    public List<GoalResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a savings goal")
    public GoalResponse create(@Valid @RequestBody GoalRequest request) {
        return service.create(request);
    }

    @PostMapping("/{id}/contributions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a contribution; the goal becomes COMPLETED when the target is reached",
            description = "Returns the updated goal. Completed goals reject further contributions (409).")
    public GoalResponse contribute(@PathVariable String id, @Valid @RequestBody ContributionRequest request) {
        return service.contribute(id, request);
    }
}
