package com.portfoliopro;

import com.portfoliopro.dto.AuthDtos.LoginRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PortfolioProApplicationIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    @SuppressWarnings("unchecked")
    void contextLoadsSeedsMarketAndAuthenticatesDemoUser() {
        ResponseEntity<Map> stocksRes = restTemplate.getForEntity("/api/market/stocks", Map.class);
        assertEquals(HttpStatus.OK, stocksRes.getStatusCode());
        assertNotNull(stocksRes.getBody());
        assertEquals(Boolean.TRUE, stocksRes.getBody().get("success"));
        Map<String, Object> marketData = (Map<String, Object>) stocksRes.getBody().get("data");
        List<?> stocks = (List<?>) marketData.get("stocks");
        assertEquals(30, stocks.size());

        ResponseEntity<Map> loginRes = restTemplate.postForEntity(
                "/api/auth/login",
                new LoginRequest("demo@portfoliopro.in", "Demo@1234"),
                Map.class
        );
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());
        assertNotNull(loginRes.getBody());
        assertEquals(Boolean.TRUE, loginRes.getBody().get("success"));
        Map<String, Object> authData = (Map<String, Object>) loginRes.getBody().get("data");
        String accessToken = (String) authData.get("accessToken");
        assertNotNull(accessToken);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        ResponseEntity<Map> portfolioRes = restTemplate.exchange(
                "/api/portfolio/summary",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, portfolioRes.getStatusCode());
        assertNotNull(portfolioRes.getBody());
        Map<String, Object> portfolioData = (Map<String, Object>) portfolioRes.getBody().get("data");
        assertTrue(((List<?>) portfolioData.get("holdings")).size() >= 6);
    }
}
