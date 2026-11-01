package com.portfoliopro.service;

import com.portfoliopro.dto.PortfolioDtos.*;
import com.portfoliopro.entity.Holding;
import com.portfoliopro.entity.Order;
import com.portfoliopro.entity.Stock;
import com.portfoliopro.entity.Wallet;
import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.exception.ApiException;
import com.portfoliopro.repository.HoldingRepository;
import com.portfoliopro.repository.OrderRepository;
import com.portfoliopro.repository.StockRepository;
import com.portfoliopro.repository.WalletRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
public class PortfolioService {

    private final HoldingRepository holdingRepository;
    private final StockRepository stockRepository;
    private final WalletRepository walletRepository;
    private final OrderRepository orderRepository;
    private final MarketDataService marketDataService;

    public PortfolioService(
            HoldingRepository holdingRepository,
            StockRepository stockRepository,
            WalletRepository walletRepository,
            OrderRepository orderRepository,
            MarketDataService marketDataService
    ) {
        this.holdingRepository = holdingRepository;
        this.stockRepository = stockRepository;
        this.walletRepository = walletRepository;
        this.orderRepository = orderRepository;
        this.marketDataService = marketDataService;
    }

    @Transactional(readOnly = true)
    public PortfolioSummaryDto getPortfolioSummary(Long userId) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException("Wallet not found", HttpStatus.NOT_FOUND));
        List<Holding> holdings = holdingRepository.findByUserId(userId);

        BigDecimal totalInvested = BigDecimal.ZERO;
        BigDecimal currentValue = BigDecimal.ZERO;
        BigDecimal dayPnl = BigDecimal.ZERO;

        List<HoldingDto> enriched = new ArrayList<>();
        Map<String, BigDecimal> sectorMap = new HashMap<>();

        for (Holding h : holdings) {
            Stock st = stockRepository.findBySymbolIgnoreCase(h.getSymbol()).orElse(null);
            double ltp = st != null ? st.getLtp() : h.getAvgBuyPrice().doubleValue();
            double prev = st != null ? st.getPrevClose() : ltp;
            String name = st != null ? st.getName() : h.getSymbol();
            String sector = st != null ? st.getSector() : "Other";
            double beta = st != null ? st.getBeta() : 1.0;
            double vol = st != null ? st.getAnnualVolatility() : 0.20;
            List<Double> spark = st != null ? marketDataService.toQuoteDto(st).sparkline() : List.of();

            BigDecimal mktVal = BigDecimal.valueOf(ltp).multiply(BigDecimal.valueOf(h.getQuantity())).setScale(2, RoundingMode.HALF_UP);
            BigDecimal invVal = h.getAvgBuyPrice().multiply(BigDecimal.valueOf(h.getQuantity())).setScale(2, RoundingMode.HALF_UP);
            BigDecimal itemPnl = mktVal.subtract(invVal);
            double itemPnlPct = invVal.compareTo(BigDecimal.ZERO) > 0
                    ? round2(itemPnl.doubleValue() / invVal.doubleValue() * 100.0) : 0.0;

            BigDecimal itemDay = BigDecimal.valueOf(ltp - prev).multiply(BigDecimal.valueOf(h.getQuantity())).setScale(2, RoundingMode.HALF_UP);
            double itemDayPct = prev > 0 ? round2(((ltp - prev) / prev) * 100.0) : 0.0;

            totalInvested = totalInvested.add(invVal);
            currentValue = currentValue.add(mktVal);
            dayPnl = dayPnl.add(itemDay);
            sectorMap.merge(sector, mktVal, BigDecimal::add);

            enriched.add(new HoldingDto(
                    h.getId(), h.getSymbol(), name, sector, h.getQuantity(),
                    h.getAvgBuyPrice(), invVal, ltp, prev, mktVal,
                    itemPnl, itemPnlPct, itemDay, itemDayPct,
                    h.getStopLossPrice(), h.getTargetPrice(), beta, vol, spark
            ));
        }

        enriched.sort(Comparator.comparing(HoldingDto::currentValue).reversed());

        BigDecimal totalPnl = currentValue.subtract(totalInvested);
        double totalPnlPct = totalInvested.compareTo(BigDecimal.ZERO) > 0
                ? round2(totalPnl.doubleValue() / totalInvested.doubleValue() * 100.0) : 0.0;
        double prevTotal = currentValue.subtract(dayPnl).doubleValue();
        double dayPnlPct = prevTotal > 0 ? round2((dayPnl.doubleValue() / prevTotal) * 100.0) : 0.0;

        BigDecimal finalCurrentValue = currentValue;
        List<SectorAllocationDto> sectors = sectorMap.entrySet().stream()
                .map(e -> new SectorAllocationDto(
                        e.getKey(),
                        e.getValue(),
                        finalCurrentValue.compareTo(BigDecimal.ZERO) > 0
                                ? round2(e.getValue().doubleValue() / finalCurrentValue.doubleValue() * 100.0) : 0.0
                ))
                .sorted(Comparator.comparing(SectorAllocationDto::value).reversed())
                .toList();

        double xirr = computePortfolioXirr(userId, currentValue.doubleValue(), totalPnlPct);
        BigDecimal totalEquity = currentValue.add(wallet.getBalance()).add(wallet.getBlockedMargin());

        return new PortfolioSummaryDto(
                totalEquity, wallet.getBalance(), wallet.getBlockedMargin(),
                totalInvested, currentValue, totalPnl, totalPnlPct,
                dayPnl, dayPnlPct, xirr, enriched.size(), enriched, sectors
        );
    }

    @Transactional
    public Holding updatePositionRisk(Long userId, String symbol, PositionRiskUpdateRequest req) {
        Holding h = holdingRepository.findByUserIdAndSymbolIgnoreCase(userId, symbol)
                .orElseThrow(() -> new ApiException("No active holding for " + symbol, HttpStatus.NOT_FOUND));
        h.setStopLossPrice(req.stopLossPrice() != null && req.stopLossPrice().compareTo(BigDecimal.ZERO) > 0
                ? req.stopLossPrice().setScale(2, RoundingMode.HALF_UP) : null);
        h.setTargetPrice(req.targetPrice() != null && req.targetPrice().compareTo(BigDecimal.ZERO) > 0
                ? req.targetPrice().setScale(2, RoundingMode.HALF_UP) : null);
        h.setUpdatedAt(Instant.now());
        return holdingRepository.save(h);
    }

    private double computePortfolioXirr(Long userId, double terminalValue, double fallbackReturnPct) {
        List<Order> exec = orderRepository.findByUserIdAndStatusOrderByCreatedAtAsc(userId, OrderStatus.EXECUTED);
        if (exec.isEmpty()) return 0.0;

        long t0 = exec.get(0).getCreatedAt().toEpochMilli();
        long now = Instant.now().toEpochMilli();
        double spanYears = (now - t0) / (365.25 * 86400_000.0);
        if (spanYears < 1.0 / 365.0) return fallbackReturnPct;

        double rate = 0.12;
        for (int iter = 0; iter < 50; iter++) {
            double f = 0.0;
            double df = 0.0;
            for (Order o : exec) {
                double cf = o.getSide() == OrderSide.BUY
                        ? -(o.getTotalValue().add(o.getCharges()).doubleValue())
                        : o.getTotalValue().subtract(o.getCharges()).doubleValue();
                double yrs = (o.getCreatedAt().toEpochMilli() - t0) / (365.25 * 86400_000.0);
                double base = Math.max(0.05, 1.0 + rate);
                f += cf / Math.pow(base, yrs);
                if (yrs > 0) df -= (yrs * cf) / Math.pow(base, yrs + 1.0);
            }
            if (terminalValue > 0) {
                double base = Math.max(0.05, 1.0 + rate);
                f += terminalValue / Math.pow(base, spanYears);
                df -= (spanYears * terminalValue) / Math.pow(base, spanYears + 1.0);
            }
            if (Math.abs(f) < 1e-4 || Math.abs(df) < 1e-9) break;
            rate = Math.max(-0.85, Math.min(3.5, rate - f / df));
        }
        return round2(rate * 100.0);
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
