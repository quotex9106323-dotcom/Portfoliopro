package com.portfoliopro.dto;

import java.math.BigDecimal;
import java.util.List;

public class PortfolioDtos {

    public record HoldingDto(
            Long id,
            String symbol,
            String name,
            String sector,
            int quantity,
            BigDecimal avgBuyPrice,
            BigDecimal investedAmount,
            double ltp,
            double prevClose,
            BigDecimal currentValue,
            BigDecimal totalPnl,
            double totalPnlPct,
            BigDecimal dayPnl,
            double dayPnlPct,
            BigDecimal stopLossPrice,
            BigDecimal targetPrice,
            double beta,
            double annualVolatility,
            List<Double> sparkline
    ) {}

    public record SectorAllocationDto(
            String sector,
            BigDecimal value,
            double weightPct
    ) {}

    public record PortfolioSummaryDto(
            BigDecimal totalAccountEquity,
            BigDecimal walletBalance,
            BigDecimal blockedMargin,
            BigDecimal totalInvested,
            BigDecimal currentValue,
            BigDecimal totalPnl,
            double totalPnlPct,
            BigDecimal dayPnl,
            double dayPnlPct,
            double xirrPct,
            int holdingsCount,
            List<HoldingDto> holdings,
            List<SectorAllocationDto> sectorAllocation
    ) {}

    public record PositionRiskUpdateRequest(
            BigDecimal stopLossPrice,
            BigDecimal targetPrice
    ) {}

    public record RiskAlertDto(
            String severity,
            String title,
            String detail
    ) {}

    public record PositionRiskDto(
            String symbol,
            String name,
            String sector,
            int quantity,
            BigDecimal avgBuyPrice,
            double ltp,
            BigDecimal currentValue,
            double weightPct,
            double beta,
            BigDecimal stopLossPrice,
            BigDecimal targetPrice,
            boolean oversizedWarning
    ) {}

    public record RiskSummaryDto(
            int riskScore,
            String riskLabel,
            double weightedBeta,
            double annualizedVolatilityPct,
            BigDecimal dailyVar95,
            double dailyVar95Pct,
            double estimatedMaxDrawdownPct,
            int hhiConcentration,
            double maxPositionWeightPct,
            double topSectorWeightPct,
            double stopLossCoveragePct,
            List<RiskAlertDto> alerts,
            List<PositionRiskDto> positions
    ) {}

    public record WalletActionRequest(
            BigDecimal amount,
            String note
    ) {}
}
