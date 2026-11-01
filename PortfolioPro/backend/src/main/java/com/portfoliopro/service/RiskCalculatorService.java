package com.portfoliopro.service;

import com.portfoliopro.dto.PortfolioDtos.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
public class RiskCalculatorService {

    private final PortfolioService portfolioService;

    public RiskCalculatorService(
            PortfolioService portfolioService
    ) {
        this.portfolioService = portfolioService;
    }

    public RiskSummaryDto computeUserRisk(Long userId) {
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);
        return evaluatePortfolioRisk(summary);
    }

    public RiskSummaryDto evaluatePortfolioRisk(PortfolioSummaryDto summary) {
        List<HoldingDto> holdings = summary.holdings();
        double totalVal = summary.currentValue().doubleValue();

        if (holdings.isEmpty() || totalVal <= 0) {
            return new RiskSummaryDto(
                    12, "Conservative", 0.0, 0.0, BigDecimal.ZERO, 0.0, 0.0,
                    0, 0.0, 0.0, 100.0,
                    List.of(new RiskAlertDto("INFO", "100% Cash Allocation",
                            "Portfolio currently holds no equity exposure; market VaR and concentration risks are zero.")),
                    List.of()
            );
        }

        double weightedBeta = 0.0;
        double weightedVol = 0.0;
        double hhi = 0.0;
        double maxPosWeight = 0.0;
        String maxPosSym = "";
        double coveredValue = 0.0;

        List<PositionRiskDto> positions = new ArrayList<>();
        for (HoldingDto h : holdings) {
            double val = h.currentValue().doubleValue();
            double w = val / totalVal;
            double wPct = round2(w * 100.0);
            weightedBeta += w * h.beta();
            weightedVol += w * h.annualVolatility();
            hhi += wPct * wPct;
            if (wPct > maxPosWeight) {
                maxPosWeight = wPct;
                maxPosSym = h.symbol();
            }
            if (h.stopLossPrice() != null && h.stopLossPrice().compareTo(BigDecimal.ZERO) > 0) {
                coveredValue += val;
            }

            positions.add(new PositionRiskDto(
                    h.symbol(), h.name(), h.sector(), h.quantity(),
                    h.avgBuyPrice(), h.ltp(), h.currentValue(),
                    wPct, h.beta(), h.stopLossPrice(), h.targetPrice(), wPct > 22.0
            ));
        }

        double divFactor = Math.max(0.68, Math.min(1.0, Math.sqrt(0.42 * (hhi / 10000.0) + 0.58)));
        double portAnnualVol = weightedVol * divFactor;
        double dailyVol = portAnnualVol / Math.sqrt(252.0);
        BigDecimal dailyVar95 = BigDecimal.valueOf(1.645 * dailyVol * totalVal).setScale(2, RoundingMode.HALF_UP);
        double dailyVarPct = round2((dailyVar95.doubleValue() / totalVal) * 100.0);
        double estMaxDrawdownPct = round2(portAnnualVol * 100.0 * 0.42);

        double topSectorWeight = summary.sectorAllocation().isEmpty() ? 0.0 : summary.sectorAllocation().get(0).weightPct();
        String topSectorName = summary.sectorAllocation().isEmpty() ? "" : summary.sectorAllocation().get(0).sector();
        double slCoveragePct = round2((coveredValue / totalVal) * 100.0);

        double concScore = Math.min(35.0, (hhi / 3200.0) * 35.0);
        double secScore = Math.min(25.0, (topSectorWeight / 55.0) * 25.0);
        double betaScore = Math.min(28.0, (((weightedBeta * 0.5 + (portAnnualVol / 0.22) * 0.5) / 1.45) * 28.0));
        double slPenalty = ((100.0 - slCoveragePct) / 100.0) * 12.0;

        int riskScore = (int) Math.max(10, Math.min(96, Math.round(concScore + secScore + betaScore + slPenalty)));
        String riskLabel = riskScore < 35 ? "Conservative" : (riskScore < 58 ? "Moderate" : (riskScore < 76 ? "Elevated" : "Aggressive"));

        List<RiskAlertDto> alerts = new ArrayList<>();
        if (maxPosWeight > 22.0) {
            alerts.add(new RiskAlertDto("HIGH",
                    "Position Concentration Warning: " + maxPosSym + " (" + maxPosWeight + "%)",
                    maxPosSym + " exceeds the 22% single-position guideline. Consider trimming to reduce stock-specific gap risk."));
        }
        if (topSectorWeight > 35.0) {
            alerts.add(new RiskAlertDto("MEDIUM",
                    "Sector Overweight: " + topSectorName + " (" + topSectorWeight + "%)",
                    "Over 35% of equity exposure sits in " + topSectorName + ". Diversifying across defensive sectors reduces drawdown correlation."));
        }
        if (slCoveragePct < 85.0) {
            alerts.add(new RiskAlertDto("MEDIUM",
                    "Unprotected Positions (" + Math.round(100.0 - slCoveragePct) + "% without Stop-Loss)",
                    "Set automated Stop-Loss levels on remaining holdings to protect capital against sharp intraday reversals."));
        }
        if (weightedBeta > 1.15) {
            alerts.add(new RiskAlertDto("MEDIUM",
                    "Elevated Portfolio Beta (" + round2(weightedBeta) + "x)",
                    "Holdings amplify Nifty 50 swings; expect above-market volatility."));
        }
        if (alerts.isEmpty()) {
            alerts.add(new RiskAlertDto("LOW", "Balanced Risk Posture",
                    "Position sizing, sector spread, beta, and stop-loss coverage are within institutional risk guardrails."));
        }

        return new RiskSummaryDto(
                riskScore, riskLabel, round2(weightedBeta), round2(portAnnualVol * 100.0),
                dailyVar95, dailyVarPct, estMaxDrawdownPct, (int) Math.round(hhi),
                maxPosWeight, topSectorWeight, slCoveragePct, alerts, positions
        );
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
