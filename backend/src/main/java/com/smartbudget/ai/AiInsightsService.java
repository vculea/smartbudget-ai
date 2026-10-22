package com.smartbudget.ai;

import com.smartbudget.common.ApiException;
import com.smartbudget.dashboard.DashboardResponse;
import com.smartbudget.dashboard.DashboardService;
import java.time.Clock;
import java.time.YearMonth;
import org.springframework.stereotype.Service;

@Service
public class AiInsightsService {

    private final DashboardService dashboardService;
    private final AiAnalysisService analysisService;
    private final Clock clock;

    public AiInsightsService(DashboardService dashboardService, AiAnalysisService analysisService, Clock clock) {
        this.dashboardService = dashboardService;
        this.analysisService = analysisService;
        this.clock = clock;
    }

    public AiInsightsResponse generate(YearMonth requestedMonth) {
        YearMonth month = requestedMonth != null ? requestedMonth : YearMonth.now(clock);
        FinancialSummary summary = toSummary(dashboardService.get(month));
        if (summary.totalIncome().signum() == 0 && summary.totalExpenses().signum() == 0) {
            throw ApiException.unprocessable("Nu există tranzacții în luna selectată pentru a genera recomandări.");
        }
        AiAnalysis analysis = analysisService.analyze(summary);
        return new AiInsightsResponse(month, analysis.summary(), analysis.insights(), clock.instant());
    }

    static FinancialSummary toSummary(DashboardResponse dashboard) {
        return new FinancialSummary(
                dashboard.month(),
                dashboard.totalIncome(),
                dashboard.totalExpenses(),
                dashboard.balance(),
                dashboard.savingsRate(),
                dashboard.budgetUsedPercentage(),
                dashboard.expensesByCategory().stream()
                        .map(c -> new FinancialSummary.CategorySpending(c.categoryName(), c.amount(), c.percentage()))
                        .toList(),
                dashboard.budgets().stream()
                        .map(b -> new FinancialSummary.BudgetUsage(b.categoryName(), b.limitAmount(), b.spentAmount(),
                                b.percentageUsed(), b.status().name()))
                        .toList(),
                dashboard.goals().stream()
                        .map(g -> new FinancialSummary.GoalProgress(g.name(), g.targetAmount(), g.currentAmount(),
                                g.progressPercentage(), g.targetDate(), g.status().name()))
                        .toList(),
                dashboard.monthlyTrend().stream()
                        .filter(p -> !p.month().equals(dashboard.month()))
                        .map(p -> new FinancialSummary.MonthTotals(p.month(), p.income(), p.expenses()))
                        .toList());
    }
}
