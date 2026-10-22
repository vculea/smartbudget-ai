package com.smartbudget.ai;

/** What the browser sends to the user's local model to get recommendations for {@code period}. */
public record LocalInsightsPrompt(String period, String systemPrompt, String userMessage) {
}
