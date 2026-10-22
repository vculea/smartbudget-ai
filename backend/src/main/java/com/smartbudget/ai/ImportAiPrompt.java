package com.smartbudget.ai;

/** Prompt for a model that runs in the browser (local AI); the browser sends it and posts the answer back. */
public record ImportAiPrompt(String systemPrompt, String userMessage) {
}
