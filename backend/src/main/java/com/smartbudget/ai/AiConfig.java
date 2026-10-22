package com.smartbudget.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class AiConfig {

    @Bean
    public RestClient aiRestClient(RestClient.Builder builder, AiProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.connectTimeout().toMillis());
        factory.setReadTimeout((int) properties.readTimeout().toMillis());
        return builder.baseUrl(properties.baseUrl()).requestFactory(factory).build();
    }

    @Bean
    public AiAnalysisService aiAnalysisService(RestClient aiRestClient, AiProperties properties, ObjectMapper mapper) {
        return new OpenAiCompatibleAnalysisService(aiRestClient, properties, mapper);
    }
}
