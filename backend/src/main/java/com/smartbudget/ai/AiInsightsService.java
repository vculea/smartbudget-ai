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
        return analyze(dashboardService.get(month));
    }

    public AiInsightsResponse generateForYear(int year) {
        return analyze(dashboardService.getForYear(year));
    }

    private AiInsightsResponse analyze(DashboardResponse dashboard) {
        AiAnalysis analysis = analysisService.analyze(requireSummary(dashboard));
        return new AiInsightsResponse(dashboard.month(), analysis.summary(), analysis.insights(), clock.instant());
    }

    /** Summary sent to the model; refuses periods without any income or expense. */
    static FinancialSummary requireSummary(DashboardResponse dashboard) {
        FinancialSummary summary = toSummary(dashboard);
        if (summary.totalIncome().signum() == 0 && summary.totalExpenses().signum() == 0) {
            throw ApiException.unprocessable("Nu există tranzacții în perioada selectată pentru a genera recomandări.");
        }
        return summary;
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
                        .filter(p -> !p.month().toString().equals(dashboard.month()))
                        .map(p -> new FinancialSummary.MonthTotals(p.month(), p.income(), p.expenses()))
                        .toList());
    }
}
