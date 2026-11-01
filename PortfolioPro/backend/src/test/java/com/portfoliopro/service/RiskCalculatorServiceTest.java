package com.portfoliopro.service;

import com.portfoliopro.dto.PortfolioDtos.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class RiskCalculatorServiceTest {

    private final RiskCalculatorService riskCalculatorService =
            new RiskCalculatorService(mock(PortfolioService.class));

    @Test
    void evaluatePortfolioRisk_flagsSingleStockConcentrationAndComputesVar() {
        HoldingDto concentrated = new HoldingDto(
                1L, "ADANIGREEN", "Adani Green Energy", "Energy & Power",
                100, new BigDecimal("1600.00"), new BigDecimal("160000.00"),
                1700.00, 1680.00, new BigDecimal("170000.00"),
                new BigDecimal("10000.00"), 6.25, new BigDecimal("2000.00"), 1.19,
                null, null, 1.55, 0.38, List.of(1680.0, 1700.0)
        );
        HoldingDto minor = new HoldingDto(
                2L, "ITC", "ITC Ltd", "FMCG & Consumer",
                60, new BigDecimal("480.00"), new BigDecimal("28800.00"),
                500.00, 495.00, new BigDecimal("30000.00"),
                new BigDecimal("1200.00"), 4.17, new BigDecimal("300.00"), 1.01,
                new BigDecimal("460.00"), new BigDecimal("560.00"), 0.66, 0.16, List.of(495.0, 500.0)
        );

        PortfolioSummaryDto summary = new PortfolioSummaryDto(
                new BigDecimal("300000.00"),
                new BigDecimal("100000.00"),
                BigDecimal.ZERO,
                new BigDecimal("188800.00"),
                new BigDecimal("200000.00"),
                new BigDecimal("11200.00"),
                5.93,
                new BigDecimal("2300.00"),
                1.16,
                14.8,
                2,
                List.of(concentrated, minor),
                List.of(
                        new SectorAllocationDto("Energy & Power", new BigDecimal("170000.00"), 85.0),
                        new SectorAllocationDto("FMCG & Consumer", new BigDecimal("30000.00"), 15.0)
                )
        );

        RiskSummaryDto risk = riskCalculatorService.evaluatePortfolioRisk(summary);

        assertTrue(risk.riskScore() >= 70, "Concentrated high-beta portfolio without SL must score high risk");
        assertTrue(risk.dailyVar95().compareTo(BigDecimal.ZERO) > 0);
        assertEquals(85.0, risk.maxPositionWeightPct());
        assertEquals(15.0, risk.stopLossCoveragePct());
        assertTrue(risk.alerts().stream().anyMatch(a -> "HIGH".equals(a.severity())));
    }
}
