package com.smartbudget.ai;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the OpenAI-compatible chat completions provider (OpenAI, Groq, Gemini OpenAI endpoint,
 * Ollama, ...). The key is read from the AI_API_KEY environment variable and never logged.
 */
@ConfigurationProperties(prefix = "smartbudget.ai")
public record AiProperties(
        String baseUrl,
        String apiKey,
        String model,
        Duration connectTimeout,
        Duration readTimeout,
        /** Optional; some models only accept their default temperature. */
        Double temperature,
        /** Sends response_format=json_object (supported by most compatible providers). */
        Boolean jsonMode) {

    public AiProperties {
        baseUrl = baseUrl == null || baseUrl.isBlank() ? "https://api.openai.com/v1" : baseUrl.strip();
        model = model == null || model.isBlank() ? "gpt-4o-mini" : model.strip();
        connectTimeout = connectTimeout == null ? Duration.ofSeconds(5) : connectTimeout;
        readTimeout = readTimeout == null ? Duration.ofSeconds(30) : readTimeout;
        jsonMode = jsonMode == null || jsonMode;
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
