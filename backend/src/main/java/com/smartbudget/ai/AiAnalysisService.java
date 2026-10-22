package com.smartbudget.ai;

/**
 * Port to the AI provider. The financial logic only depends on this interface, so the provider
 * can be replaced without touching the rest of the application.
 */
public interface AiAnalysisService {

    /**
     * Analyses the summary and returns at most three validated recommendations.
     *
     * @throws com.smartbudget.common.ApiException when the provider is unavailable, times out,
     *                                              rate-limits or returns an invalid answer
     */
    AiAnalysis analyze(FinancialSummary summary);
}
