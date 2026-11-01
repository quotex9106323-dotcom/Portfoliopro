package com.portfoliopro.service;

import com.portfoliopro.dto.MarketDtos.FundamentalAnalysisDto;
import com.portfoliopro.dto.MarketDtos.SectorBenchmarkDto;
import com.portfoliopro.entity.Stock;
import com.portfoliopro.exception.ApiException;
import com.portfoliopro.repository.StockRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class FundamentalAnalysisService {

    private final StockRepository stockRepository;

    public FundamentalAnalysisService(
            StockRepository stockRepository
    ) {
        this.stockRepository = stockRepository;
    }

    private static final Map<String, SectorBenchmarkDto> BENCHMARKS = Map.of(
            "Information Technology", new SectorBenchmarkDto(28.4, 7.8, 26.5, 0.08, 2.1),
            "Banking & Financials", new SectorBenchmarkDto(17.6, 2.7, 16.2, 1.15, 1.1),
            "Energy & Power", new SectorBenchmarkDto(19.2, 2.4, 14.8, 0.72, 2.3),
            "Automobile", new SectorBenchmarkDto(24.5, 4.9, 19.4, 0.38, 1.0),
            "FMCG & Consumer", new SectorBenchmarkDto(46.0, 11.2, 29.0, 0.14, 1.8),
            "Pharmaceuticals", new SectorBenchmarkDto(31.2, 4.6, 17.8, 0.19, 0.8),
            "Metals & Mining", new SectorBenchmarkDto(14.8, 1.9, 13.5, 0.68, 2.4),
            "Infrastructure & Cement", new SectorBenchmarkDto(33.5, 4.5, 15.6, 0.54, 0.9)
    );

    public FundamentalAnalysisDto analyze(String symbol) {
        Stock stock = stockRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new ApiException("Stock not found: " + symbol, HttpStatus.NOT_FOUND));

        SectorBenchmarkDto bench = BENCHMARKS.getOrDefault(
                stock.getSector(),
                new SectorBenchmarkDto(25.0, 4.0, 16.0, 0.60, 1.4)
        );

        double scale = stock.getLtp() / Math.max(1.0, stock.getBasePrice());
        double livePe = round2(stock.getPeRatio() * scale);
        double livePb = round2(stock.getPbRatio() * scale);
        double liveMcap = Math.round(stock.getMarketCapCr() * scale);

        int valScore = (int) Math.max(4, Math.min(25, Math.round(25 - ((livePe / bench.avgPe()) - 0.75) * 12)));
        int profScore = (int) Math.max(6, Math.min(30, Math.round((stock.getRoe() / bench.avgRoe()) * 14 + (stock.getNetProfitMargin() / 18.0) * 10)));
        boolean isBank = "Banking & Financials".equals(stock.getSector());
        double deNorm = isBank ? stock.getDebtToEquity() / 2.2 : stock.getDebtToEquity();
        int bsScore = (int) Math.max(5, Math.min(25, Math.round(24 - deNorm * 11 + Math.min(4, stock.getDividendYield() * 1.4))));
        int growthScore = (int) Math.max(4, Math.min(20, Math.round((stock.getRevenueGrowthYoY() / 16.0) * 16 + 3)));

        int totalScore = Math.max(20, Math.min(98, valScore + profScore + bsScore + growthScore));
        String rating = totalScore >= 70 ? "Strong" : (totalScore >= 52 ? "Neutral" : "Weak");

        List<String> strengths = new ArrayList<>();
        List<String> watchouts = new ArrayList<>();

        if (stock.getRoe() >= bench.avgRoe()) {
            strengths.add("ROE of " + stock.getRoe() + "% outperforms sector peer average of " + bench.avgRoe() + "%.");
        } else {
            watchouts.add("ROE of " + stock.getRoe() + "% trails sector average of " + bench.avgRoe() + "%.");
        }
        if (livePe <= bench.avgPe() * 1.05) {
            strengths.add("Reasonable P/E multiple (" + livePe + "x) relative to sector (" + bench.avgPe() + "x).");
        } else {
            watchouts.add("Trades at a P/E premium (" + livePe + "x vs " + bench.avgPe() + "x sector average).");
        }
        if (!isBank && stock.getDebtToEquity() <= 0.4) {
            strengths.add("Low balance-sheet leverage (" + stock.getDebtToEquity() + "x D/E).");
        } else if (!isBank && stock.getDebtToEquity() > 1.0) {
            watchouts.add("Elevated debt-to-equity ratio (" + stock.getDebtToEquity() + "x).");
        }
        if (watchouts.isEmpty()) {
            watchouts.add("Monitor quarterly revenue momentum and sector input cost cycle.");
        }

        String summary = String.format(
                "%s screens as %s (%d/100) with %.1f%% ROE, %.2fx P/E (vs %.1fx %s peer avg), and %.1f%% YoY revenue growth.",
                stock.getName(), rating, totalScore, stock.getRoe(), livePe, bench.avgPe(), stock.getSector(), stock.getRevenueGrowthYoY()
        );

        return new FundamentalAnalysisDto(
                stock.getSymbol(),
                stock.getName(),
                stock.getSector(),
                stock.getIndustry(),
                stock.getLtp(),
                liveMcap,
                Math.max(stock.getHigh52w(), stock.getLtp()),
                Math.min(stock.getLow52w(), stock.getLtp()),
                livePe,
                livePb,
                stock.getEps(),
                stock.getRoe(),
                stock.getDebtToEquity(),
                stock.getDividendYield(),
                stock.getRevenueGrowthYoY(),
                stock.getNetProfitMargin(),
                stock.getBeta(),
                bench,
                rating,
                totalScore,
                summary,
                strengths,
                watchouts,
                stock.getAbout()
        );
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
