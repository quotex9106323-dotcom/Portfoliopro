package com.portfoliopro.controller;

import com.portfoliopro.dto.ApiResponse;
import com.portfoliopro.dto.PortfolioDtos.*;
import com.portfoliopro.entity.Holding;
import com.portfoliopro.service.PortfolioService;
import com.portfoliopro.service.RiskCalculatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class PortfolioAndRiskController {

    private final PortfolioService portfolioService;
    private final RiskCalculatorService riskCalculatorService;

    public PortfolioAndRiskController(
            PortfolioService portfolioService,
            RiskCalculatorService riskCalculatorService
    ) {
        this.portfolioService = portfolioService;
        this.riskCalculatorService = riskCalculatorService;
    }

    @GetMapping("/portfolio/summary")
    public ResponseEntity<ApiResponse<PortfolioSummaryDto>> portfolioSummary(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(portfolioService.getPortfolioSummary(userId)));
    }

    @PutMapping("/portfolio/holdings/{symbol}/risk")
    public ResponseEntity<ApiResponse<Holding>> updateHoldingRisk(
            Authentication auth,
            @PathVariable String symbol,
            @RequestBody PositionRiskUpdateRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(portfolioService.updatePositionRisk(userId, symbol, req)));
    }

    @GetMapping("/risk/summary")
    public ResponseEntity<ApiResponse<RiskSummaryDto>> riskSummary(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(riskCalculatorService.computeUserRisk(userId)));
    }
}
