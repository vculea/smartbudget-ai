package com.smartbudget.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbudget.common.ApiException;
import com.smartbudget.common.Money;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;

/** Parses and validates the model's JSON answer before anything is returned to the frontend. */
public class AiResponseParser {

    static final int MAX_INSIGHTS = 3;
    static final int MAX_SUMMARY = 1000;
    static final int MAX_TITLE = 120;
    static final int MAX_REASON = 600;

    private final ObjectMapper objectMapper;

    public AiResponseParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RawAnalysis(String summary, List<RawInsight> insights) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RawInsight(String title, String reason, BigDecimal suggestedMonthlySaving, String priority) {
    }

    public AiAnalysis parse(String content, FinancialSummary summary) {
        RawAnalysis raw;
        try {
            raw = objectMapper.readValue(stripCodeFence(content), RawAnalysis.class);
        } catch (Exception ex) {
            throw invalid("JSON nevalid");
        }
        if (raw == null || isBlank(raw.summary()) || raw.summary().strip().length() > MAX_SUMMARY) {
            throw invalid("rezumat lipsă sau prea lung");
        }
        if (raw.insights() == null || raw.insights().isEmpty()) {
            throw invalid("nicio recomandare");
        }

        List<AiAnalysis.Insight> insights = new ArrayList<>();
        for (RawInsight item : raw.insights().stream().limit(MAX_INSIGHTS).toList()) {
            insights.add(validate(item, summary));
        }
        return new AiAnalysis(raw.summary().strip(), List.copyOf(insights));
    }

    private AiAnalysis.Insight validate(RawInsight item, FinancialSummary summary) {
        if (item == null || isBlank(item.title()) || item.title().strip().length() > MAX_TITLE) {
            throw invalid("titlu invalid");
        }
        if (isBlank(item.reason()) || item.reason().strip().length() > MAX_REASON) {
            throw invalid("motivație invalidă");
        }
        BigDecimal saving = item.suggestedMonthlySaving();
        if (saving == null || saving.signum() < 0 || saving.compareTo(summary.totalExpenses()) > 0) {
            throw invalid("economie sugerată în afara intervalului permis");
        }
        AiAnalysis.Priority priority;
        try {
            priority = AiAnalysis.Priority.valueOf(item.priority().strip().toUpperCase(Locale.ROOT));
        } catch (RuntimeException ex) {
            throw invalid("prioritate invalidă");
        }
        return new AiAnalysis.Insight(item.title().strip(), item.reason().strip(), Money.scale(saving), priority);
    }

    static String stripCodeFence(String content) {
        String text = content == null ? "" : content.strip();
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            int lastFence = text.lastIndexOf("```");
            if (firstNewline > 0 && lastFence > firstNewline) {
                text = text.substring(firstNewline + 1, lastFence).strip();
            }
        }
        return text;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static ApiException invalid(String reason) {
        return new ApiException(HttpStatus.BAD_GATEWAY,
                "Răspunsul furnizorului AI nu a putut fi validat (" + reason + "). Încearcă din nou.");
    }
}
