package com.smartbudget.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearer-jwt";

    @Bean
    public OpenAPI smartBudgetOpenApi() {
        return new OpenAPI()
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER))
                .info(new Info()
                .title("SmartBudget AI API")
                .version("1.0.0")
                .description("""
                        Personal finance API: transactions, budgets, savings goals, dashboard and AI coach.

                        Formats: money amounts are JSON numbers with at most 2 decimals (e.g. 1234.50, backed by BigDecimal / Decimal128);
                        dates are ISO-8601 `YYYY-MM-DD`; months are `YYYY-MM`; timestamps are ISO-8601 UTC instants."""));
    }
}
