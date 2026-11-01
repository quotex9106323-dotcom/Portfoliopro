package com.portfoliopro.dto;

import java.util.List;

public class MarketDtos {

    public record IndexDto(
            String name,
            double value,
            double change,
            double changePct
    ) {}

    public record StockQuoteDto(
            String symbol,
            String name,
            String sector,
            String industry,
            double ltp,
            double open,
            double dayHigh,
            double dayLow,
            double prevClose,
            double change,
            double changePct,
            long volume,
            double high52w,
            double low52w,
            double marketCapCr,
            double peRatio,
            double pbRatio,
            double eps,
            double roe,
            double debtToEquity,
            double dividendYield,
            double beta,
            String about,
            List<Double> sparkline
    ) {}

    public record TickEventDto(
            String symbol,
            double ltp,
            double change,
            double changePct,
            double dayHigh,
            double dayLow,
            long volume,
            String direction
    ) {}

    public record CandleDto(
            long time,
            double open,
            double high,
            double low,
            double close,
            long volume
    ) {}

    public record TimeValuePoint(long time, double value) {}

    public record BollingerPoint(long time, double upper, double middle, double lower) {}

    public record MacdPoint(long time, double macd, double signal, double histogram) {}

    public record TechnicalSummaryDto(
            String signal,
            double rsiValue,
            double macdHistogram,
            double priceVsSma20Pct,
            double supportLevel,
            double resistanceLevel,
            String commentary
    ) {}

    public record TechnicalAnalysisDto(
            String symbol,
            String timeframe,
            List<CandleDto> candles,
            List<TimeValuePoint> sma20,
            List<TimeValuePoint> sma50,
            List<TimeValuePoint> ema12,
            List<TimeValuePoint> ema26,
            List<BollingerPoint> bollinger,
            List<TimeValuePoint> rsi14,
            List<MacdPoint> macd,
            TechnicalSummaryDto summary
    ) {}

    public record SectorBenchmarkDto(
            double avgPe,
            double avgPb,
            double avgRoe,
            double avgDebtToEquity,
            double avgDivYield
    ) {}

    public record FundamentalAnalysisDto(
            String symbol,
            String name,
            String sector,
            String industry,
            double currentPrice,
            double marketCapCr,
            double high52w,
            double low52w,
            double peRatio,
            double pbRatio,
            double eps,
            double roe,
            double debtToEquity,
            double dividendYield,
            double revenueGrowthYoY,
            double netProfitMargin,
            double beta,
            SectorBenchmarkDto sectorBenchmark,
            String rating,
            int fundamentalScore,
            String analystSummary,
            List<String> strengths,
            List<String> watchouts,
            String about
    ) {}
}
