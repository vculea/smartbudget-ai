package com.smartbudget.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smartbudget.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

class AiResponseParserTest {

    private final AiResponseParser parser = new AiResponseParser(AiTestData.MAPPER);

    @Test
    void parsesValidResponse() {
        AiAnalysis analysis = parser.parse(AiTestData.validJson(), AiTestData.summary());

        assertThat(analysis.summary()).isEqualTo("Luna a fost echilibrată.");
        assertThat(analysis.insights()).hasSize(2);
        assertThat(analysis.insights().get(0).priority()).isEqualTo(AiAnalysis.Priority.MEDIUM);
        assertThat(analysis.insights().get(0).suggestedMonthlySaving()).isEqualByComparingTo("80.50");
        assertThat(analysis.insights().get(1).priority()).isEqualTo(AiAnalysis.Priority.HIGH);
    }

    @Test
    void acceptsJsonWrappedInMarkdownFence() {
        AiAnalysis analysis = parser.parse("```json\n" + AiTestData.validJson() + "\n```", AiTestData.summary());

        assertThat(analysis.insights()).hasSize(2);
    }

    @Test
    void keepsAtMostThreeInsights() {
        String insight = "{\"title\":\"t\",\"reason\":\"r\",\"suggestedMonthlySaving\":10,\"priority\":\"LOW\"}";
        String json = "{\"summary\":\"s\",\"insights\":[" + String.join(",", insight, insight, insight, insight, insight) + "]}";

        assertThat(parser.parse(json, AiTestData.summary()).insights()).hasSize(3);
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource(delimiter = '|', value = {
            "Cheltuieli de 43,36€ și zero venituri.|Cheltuieli de 43,36 lei și zero venituri.",
            "Credit de -4336,55€.|Credit de -4336,55 lei.",
            "Ai cheltuit € 250 la restaurante.|Ai cheltuit 250 lei la restaurante.",
            "Ai cheltuit 250 EUR, adică 250 euro.|Ai cheltuit 250 lei, adică 250 lei.",
            "Ai depășit bugetul cu 85 RON.|Ai depășit bugetul cu 85 lei.",
            "Ai cheltuit 85 lei.|Ai cheltuit 85 lei."
    })
    void normalizesCurrencyToLei(String input, String expected) {
        assertThat(AiResponseParser.normalizeCurrency(input)).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "not json at all",
            "",
            "[]",
            "{\"summary\":\"s\"}",
            "{\"summary\":\"s\",\"insights\":[]}",
            "{\"insights\":[{\"title\":\"t\",\"reason\":\"r\",\"suggestedMonthlySaving\":1,\"priority\":\"LOW\"}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"\",\"reason\":\"r\",\"suggestedMonthlySaving\":1,\"priority\":\"LOW\"}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"t\",\"reason\":\"\",\"suggestedMonthlySaving\":1,\"priority\":\"LOW\"}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"t\",\"reason\":\"r\",\"priority\":\"LOW\"}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"t\",\"reason\":\"r\",\"suggestedMonthlySaving\":-5,\"priority\":\"LOW\"}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"t\",\"reason\":\"r\",\"suggestedMonthlySaving\":9999,\"priority\":\"LOW\"}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"t\",\"reason\":\"r\",\"suggestedMonthlySaving\":1,\"priority\":\"URGENT\"}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"t\",\"reason\":\"r\",\"suggestedMonthlySaving\":1}]}",
            "{\"summary\":\"s\",\"insights\":[{\"title\":\"t\",\"reason\":\"r\",\"suggestedMonthlySaving\":\"abc\",\"priority\":\"LOW\"}]}"
    })
    void rejectsInvalidResponses(String content) {
        assertThatThrownBy(() -> parser.parse(content, AiTestData.summary()))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }
}
