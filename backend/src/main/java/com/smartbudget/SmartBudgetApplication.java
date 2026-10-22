package com.smartbudget;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SmartBudgetApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartBudgetApplication.class, args);
    }
}
