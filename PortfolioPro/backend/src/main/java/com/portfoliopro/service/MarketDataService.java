package com.portfoliopro.service;

import com.portfoliopro.dto.MarketDtos.*;
import com.portfoliopro.entity.OhlcvCandle;
import com.portfoliopro.entity.Stock;
import com.portfoliopro.exception.ApiException;
import com.portfoliopro.repository.OhlcvCandleRepository;
import com.portfoliopro.repository.StockRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class MarketDataService {

    private final StockRepository stockRepository;
    private final OhlcvCandleRepository candleRepository;

    public MarketDataService(
            StockRepository stockRepository,
            OhlcvCandleRepository candleRepository
    ) {
        this.stockRepository = stockRepository;
        this.candleRepository = candleRepository;
    }

    private final Map<String, List<Double>> sparklineCache = new ConcurrentHashMap<>();

    public List<StockQuoteDto> listStocks(String sector, String query) {
        List<Stock> stocks = (sector != null && !sector.isBlank() && !"ALL".equalsIgnoreCase(sector))
                ? stockRepository.findBySectorIgnoreCase(sector.trim())
                : stockRepository.findAll();

        if (query != null && !query.isBlank()) {
            String q = query.trim().toLowerCase();
            stocks = stocks.stream()
                    .filter(s -> s.getSymbol().toLowerCase().contains(q)
                            || s.getName().toLowerCase().contains(q)
                            || s.getSector().toLowerCase().contains(q))
                    .collect(Collectors.toList());
        }
        return stocks.stream().map(this::toQuoteDto).collect(Collectors.toList());
    }

    public StockQuoteDto getStockQuote(String symbol) {
        Stock s = stockRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new ApiException("Unknown stock symbol: " + symbol, HttpStatus.NOT_FOUND));
        return toQuoteDto(s);
    }

    public List<IndexDto> computeIndices() {
        List<Stock> all = stockRepository.findAll();
        double avgPct = all.stream().mapToDouble(this::changePct).average().orElse(0.0);
        double bankPct = all.stream()
                .filter(s -> "Banking & Financials".equals(s.getSector()))
                .mapToDouble(this::changePct).average().orElse(avgPct);
        double itPct = all.stream()
                .filter(s -> "Information Technology".equals(s.getSector()))
                .mapToDouble(this::changePct).average().orElse(avgPct);

        return List.of(
                buildIndex("NIFTY 50", 24680.50, avgPct),
                buildIndex("SENSEX", 81145.20, avgPct),
                buildIndex("NIFTY BANK", 52340.00, bankPct),
                buildIndex("NIFTY IT", 42190.00, itPct)
        );
    }

    public List<CandleDto> getCandles(String symbol, String timeframe) {
        Stock stock = stockRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new ApiException("Unknown stock symbol: " + symbol, HttpStatus.NOT_FOUND));

        String tf = normalizeTimeframe(timeframe);
        List<OhlcvCandle> stored = candleRepository.findBySymbolAndTimeframeOrderByEpochSecAsc(stock.getSymbol(), tf);
        if (!stored.isEmpty()) {
            List<CandleDto> list = stored.stream()
                    .map(c -> new CandleDto(c.getEpochSec(), c.getOpenPrice(), c.getHighPrice(), c.getLowPrice(), c.getClosePrice(), c.getVolume()))
                    .collect(Collectors.toCollection(ArrayList::new));
            CandleDto last = list.get(list.size() - 1);
            list.set(list.size() - 1, new CandleDto(
                    last.time(),
                    last.open(),
                    Math.max(last.high(), stock.getLtp()),
                    Math.min(last.low(), stock.getLtp()),
                    stock.getLtp(),
                    last.volume()
            ));
            return list;
        }
        return synthesizeCandles(stock, tf);
    }

    public List<CandleDto> synthesizeCandles(Stock stock, String tf) {
        int count = switch (tf) {
            case "1D" -> 78;
            case "1W" -> 95;
            case "1M" -> 65;
            case "5Y" -> 260;
            default -> 252;
        };
        long stepSec = switch (tf) {
            case "1D" -> 300L;
            case "1W" -> 1800L;
            case "1M" -> 14400L;
            case "5Y" -> 604800L;
            default -> 86400L;
        };
        double volScale = switch (tf) {
            case "1D" -> 0.0028;
            case "1W" -> 0.0055;
            case "1M" -> 0.0095;
            case "5Y" -> 0.032;
            default -> 0.0155;
        };

        Random rng = new Random((stock.getSymbol() + ":" + tf).hashCode());
        double[] prices = new double[count];
        prices[count - 1] = stock.getLtp();
        double vf = (stock.getAnnualVolatility() / 0.21) * volScale;
        for (int i = count - 2; i >= 0; i--) {
            double r = 0.0004 + rng.nextGaussian() * vf;
            prices[i] = Math.max(5.0, prices[i + 1] / Math.exp(r));
        }

        long nowBucket = (Instant.now().getEpochSecond() / stepSec) * stepSec;
        List<CandleDto> result = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            double close = round2(prices[i]);
            double open = i == 0 ? round2(close * 0.997) : result.get(i - 1).close();
            double spread = Math.abs(close - open) + close * vf * (0.3 + rng.nextDouble() * 0.8);
            double high = round2(Math.max(open, close) + spread * 0.45);
            double low = round2(Math.max(1.0, Math.min(open, close) - spread * 0.45));
            long vol = Math.max(1500L, Math.round((stock.getMarketCapCr() / Math.max(80.0, stock.getBasePrice())) * 600 * (0.6 + rng.nextDouble())));
            result.add(new CandleDto(nowBucket - (long) (count - 1 - i) * stepSec, open, high, low, close, vol));
        }
        return result;
    }

    public void updateSparkline(String symbol, double ltp) {
        sparklineCache.compute(symbol, (k, existing) -> {
            List<Double> next = existing == null ? new ArrayList<>() : new ArrayList<>(existing);
            next.add(ltp);
            if (next.size() > 28) {
                next = new ArrayList<>(next.subList(next.size() - 28, next.size()));
            }
            return next;
        });
    }

    public StockQuoteDto toQuoteDto(Stock s) {
        double chg = round2(s.getLtp() - s.getPrevClose());
        double chgPct = changePct(s);
        List<Double> spark = sparklineCache.computeIfAbsent(s.getSymbol(), sym ->
                synthesizeCandles(s, "1D").stream().skip(50).map(CandleDto::close).collect(Collectors.toList())
        );

        return new StockQuoteDto(
                s.getSymbol(),
                s.getName(),
                s.getSector(),
                s.getIndustry(),
                s.getLtp(),
                s.getOpenPrice(),
                s.getDayHigh(),
                s.getDayLow(),
                s.getPrevClose(),
                chg,
                chgPct,
                s.getVolume(),
                Math.max(s.getHigh52w(), s.getLtp()),
                Math.min(s.getLow52w(), s.getLtp()),
                Math.round(s.getMarketCapCr() * (s.getLtp() / s.getBasePrice())),
                round2(s.getPeRatio() * (s.getLtp() / s.getBasePrice())),
                round2(s.getPbRatio() * (s.getLtp() / s.getBasePrice())),
                s.getEps(),
                s.getRoe(),
                s.getDebtToEquity(),
                s.getDividendYield(),
                s.getBeta(),
                s.getAbout(),
                spark
        );
    }

    private IndexDto buildIndex(String name, double base, double pct) {
        double val = round2(base * (1.0 + pct / 100.0));
        return new IndexDto(name, val, round2(val - base), round2(pct));
    }

    private double changePct(Stock s) {
        if (s.getPrevClose() <= 0) return 0.0;
        return round2(((s.getLtp() - s.getPrevClose()) / s.getPrevClose()) * 100.0);
    }

    private String normalizeTimeframe(String tf) {
        if (tf == null) return "1D";
        String upper = tf.trim().toUpperCase();
        return Set.of("1D", "1W", "1M", "1Y", "5Y").contains(upper) ? upper : "1D";
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
