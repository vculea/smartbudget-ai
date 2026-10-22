package com.smartbudget.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.common.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GoalServiceTest {

    private final SavingsGoalRepository goals = mock(SavingsGoalRepository.class);
    private final GoalContributionRepository contributions = mock(GoalContributionRepository.class);
    private GoalService service;

    @BeforeEach
    void setUp() {
        service = new GoalService(goals, contributions, TestClock.FIXED);
        when(goals.save(any(SavingsGoal.class))).thenAnswer(inv -> {
            SavingsGoal g = inv.getArgument(0);
            if (g.getId() == null) {
                g.setId("g1");
            }
            return g;
        });
    }

    @Test
    void createsActiveGoalWithZeroProgress() {
        GoalResponse response = service.create(new GoalRequest("Laptop", null, new BigDecimal("5000"),
                LocalDate.of(2027, 3, 1)));

        assertThat(response.status()).isEqualTo(GoalStatus.ACTIVE);
        assertThat(response.currentAmount()).isEqualByComparingTo("0");
        assertThat(response.progressPercentage()).isEqualByComparingTo("0");
        assertThat(response.targetAmount()).isEqualByComparingTo("5000.00");
    }

    @Test
    void rejectsTargetDateInThePast() {
        assertThatThrownBy(() -> service.create(new GoalRequest("Laptop", null, BigDecimal.TEN, LocalDate.of(2026, 10, 21))))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void acceptsGoalWithoutTargetDate() {
        GoalResponse response = service.create(new GoalRequest("Fond", "desc", BigDecimal.TEN, null));

        assertThat(response.targetDate()).isNull();
    }

    @Test
    void contributionBelowTargetKeepsGoalActiveAndUpdatesProgress() {
        when(goals.findById("g1")).thenReturn(Optional.of(goal("g1", "1000", GoalStatus.ACTIVE)));
        when(contributions.sumByGoalIds(List.of("g1"))).thenReturn(Map.of("g1", new BigDecimal("250")));

        GoalResponse response = service.contribute("g1", new ContributionRequest(new BigDecimal("250"), null, "  prima  "));

        assertThat(response.status()).isEqualTo(GoalStatus.ACTIVE);
        assertThat(response.currentAmount()).isEqualByComparingTo("250.00");
        assertThat(response.progressPercentage()).isEqualByComparingTo("25.00");
        verify(contributions).save(org.mockito.ArgumentMatchers.argThat((GoalContribution c) ->
                c.getGoalId().equals("g1") && c.getAmount().compareTo(new BigDecimal("250")) == 0
                        && c.getContributionDate().equals(LocalDate.of(2026, 10, 22)) && "prima".equals(c.getNote())));
    }

    @Test
    void contributionReachingTargetCompletesGoal() {
        when(goals.findById("g1")).thenReturn(Optional.of(goal("g1", "1000", GoalStatus.ACTIVE)));
        when(contributions.sumByGoalIds(List.of("g1"))).thenReturn(Map.of("g1", new BigDecimal("1000")));

        GoalResponse response = service.contribute("g1", new ContributionRequest(new BigDecimal("400"), null, null));

        assertThat(response.status()).isEqualTo(GoalStatus.COMPLETED);
        assertThat(response.progressPercentage()).isEqualByComparingTo("100.00");
    }

    @Test
    void overshootingTheTargetCompletesGoalAndCapsProgressAt100() {
        when(goals.findById("g1")).thenReturn(Optional.of(goal("g1", "1000", GoalStatus.ACTIVE)));
        when(contributions.sumByGoalIds(List.of("g1"))).thenReturn(Map.of("g1", new BigDecimal("1200")));

        GoalResponse response = service.contribute("g1", new ContributionRequest(new BigDecimal("700"), null, null));

        assertThat(response.status()).isEqualTo(GoalStatus.COMPLETED);
        assertThat(response.currentAmount()).isEqualByComparingTo("1200.00");
        assertThat(response.progressPercentage()).isEqualByComparingTo("100.00");
    }

    @Test
    void completedGoalRejectsContributions() {
        when(goals.findById("g1")).thenReturn(Optional.of(goal("g1", "1000", GoalStatus.COMPLETED)));

        assertThatThrownBy(() -> service.contribute("g1", new ContributionRequest(BigDecimal.TEN, null, null)))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        verify(contributions, never()).save(any());
    }

    @Test
    void contributionToMissingGoalIsNotFound() {
        when(goals.findById("zzz")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.contribute("zzz", new ContributionRequest(BigDecimal.TEN, null, null)))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void rejectsContributionDatedInTheFuture() {
        when(goals.findById("g1")).thenReturn(Optional.of(goal("g1", "1000", GoalStatus.ACTIVE)));

        assertThatThrownBy(() -> service.contribute("g1",
                new ContributionRequest(BigDecimal.TEN, LocalDate.of(2026, 10, 23), null)))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(contributions, never()).save(any());
    }

    @Test
    void listDerivesCurrentAmountFromContributions() {
        when(goals.findAll(any(org.springframework.data.domain.Sort.class))).thenReturn(List.of(
                goal("g1", "1000", GoalStatus.ACTIVE), goal("g2", "500", GoalStatus.ACTIVE)));
        when(contributions.sumByGoalIds(List.of("g1", "g2"))).thenReturn(Map.of("g1", new BigDecimal("333.33")));

        List<GoalResponse> result = service.list();

        assertThat(result.get(0).currentAmount()).isEqualByComparingTo("333.33");
        assertThat(result.get(0).progressPercentage()).isEqualByComparingTo("33.33");
        assertThat(result.get(1).currentAmount()).isEqualByComparingTo("0");
    }

    private static SavingsGoal goal(String id, String target, GoalStatus status) {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(id);
        goal.setName("Goal " + id);
        goal.setTargetAmount(new BigDecimal(target));
        goal.setStatus(status);
        return goal;
    }
}
