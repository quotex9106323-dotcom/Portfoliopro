package com.portfoliopro;

import com.portfoliopro.config.DatabaseStartupInitializer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = {UserDetailsServiceAutoConfiguration.class})
@EnableScheduling
public class PortfolioProApplication {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(PortfolioProApplication.class);
        app.addInitializers(new DatabaseStartupInitializer());
        app.run(args);
    }
}
