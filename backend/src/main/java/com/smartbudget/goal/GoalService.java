package com.smartbudget.goal;

import com.smartbudget.common.ApiException;
import com.smartbudget.common.Money;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class GoalService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final SavingsGoalRepository goalRepository;
    private final GoalContributionRepository contributionRepository;
    private final Clock clock;

    public GoalService(SavingsGoalRepository goalRepository, GoalContributionRepository contributionRepository,
                       Clock clock) {
        this.goalRepository = goalRepository;
        this.contributionRepository = contributionRepository;
        this.clock = clock;
    }

    public List<GoalResponse> list() {
        List<SavingsGoal> goals = goalRepository.findAll(Sort.by("status", "targetDate", "createdAt"));
        Map<String, BigDecimal> sums = contributionRepository.sumByGoalIds(goals.stream().map(SavingsGoal::getId).toList());
        return goals.stream()
                .map(goal -> toResponse(goal, sums.getOrDefault(goal.getId(), BigDecimal.ZERO)))
                .toList();
    }

    public GoalResponse create(GoalRequest request) {
        LocalDate today = LocalDate.now(clock);
        if (request.targetDate() != null && request.targetDate().isBefore(today)) {
            throw ApiException.badRequest("Termenul obiectivului nu poate fi în trecut.");
        }
        SavingsGoal goal = new SavingsGoal();
        Instant now = clock.instant();
        goal.setName(request.name().trim());
        goal.setDescription(request.description() == null || request.description().isBlank()
                ? null : request.description().trim());
        goal.setTargetAmount(Money.scale(request.targetAmount()));
        goal.setTargetDate(request.targetDate());
        goal.setStatus(GoalStatus.ACTIVE);
        goal.setCreatedAt(now);
        goal.setUpdatedAt(now);
        return toResponse(goalRepository.save(goal), BigDecimal.ZERO);
    }

    /** Completed goals do not accept contributions: their target has been reached and the goal is closed. */
    public GoalResponse contribute(String goalId, ContributionRequest request) {
        SavingsGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> ApiException.notFound("Obiectivul nu există."));
        if (goal.getStatus() == GoalStatus.COMPLETED) {
            throw ApiException.conflict("Obiectivul este deja finalizat și nu mai acceptă contribuții.");
        }
        LocalDate today = LocalDate.now(clock);
        if (request.contributionDate() != null && request.contributionDate().isAfter(today)) {
            throw ApiException.badRequest("Data contribuției nu poate fi în viitor.");
        }

        GoalContribution contribution = new GoalContribution();
        contribution.setGoalId(goal.getId());
        contribution.setAmount(Money.scale(request.amount()));
        contribution.setContributionDate(request.contributionDate() != null ? request.contributionDate() : today);
        contribution.setNote(request.note() == null || request.note().isBlank() ? null : request.note().trim());
        contribution.setCreatedAt(clock.instant());
        contributionRepository.save(contribution);

        BigDecimal current = contributionRepository.sumByGoalIds(List.of(goal.getId()))
                .getOrDefault(goal.getId(), BigDecimal.ZERO);
        if (current.compareTo(goal.getTargetAmount()) >= 0) {
            goal.setStatus(GoalStatus.COMPLETED);
            goal.setUpdatedAt(clock.instant());
            goal = goalRepository.save(goal);
        }
        return toResponse(goal, current);
    }

    private GoalResponse toResponse(SavingsGoal goal, BigDecimal current) {
        BigDecimal progress = Money.percentage(current, goal.getTargetAmount()).min(HUNDRED.setScale(Money.SCALE));
        return new GoalResponse(goal.getId(), goal.getName(), goal.getDescription(), Money.scale(goal.getTargetAmount()),
                Money.scale(current), goal.getTargetDate(), goal.getStatus(), progress,
                goal.getCreatedAt(), goal.getUpdatedAt());
    }
}
