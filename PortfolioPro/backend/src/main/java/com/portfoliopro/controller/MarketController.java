package com.portfoliopro.controller;

import com.portfoliopro.dto.ApiResponse;
import com.portfoliopro.dto.MarketDtos.*;
import com.portfoliopro.service.MarketDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketDataService marketDataService;

    public MarketController(
            MarketDataService marketDataService
    ) {
        this.marketDataService = marketDataService;
    }

    @GetMapping("/stocks")
    public ResponseEntity<ApiResponse<Map<String, Object>>> listStocks(
            @RequestParam(required = false) String sector,
            @RequestParam(required = false) String q
    ) {
        List<StockQuoteDto> stocks = marketDataService.listStocks(sector, q);
        List<String> sectors = stocks.stream().map(StockQuoteDto::sector).distinct().toList();
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "indices", marketDataService.computeIndices(),
                "stocks", stocks,
                "sectors", sectors
        )));
    }

    @GetMapping("/indices")
    public ResponseEntity<ApiResponse<List<IndexDto>>> indices() {
        return ResponseEntity.ok(ApiResponse.ok(marketDataService.computeIndices()));
    }

    @GetMapping("/stocks/{symbol}")
    public ResponseEntity<ApiResponse<StockQuoteDto>> getStock(@PathVariable String symbol) {
        return ResponseEntity.ok(ApiResponse.ok(marketDataService.getStockQuote(symbol)));
    }

    @GetMapping("/stocks/{symbol}/candles")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCandles(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1D") String timeframe
    ) {
        List<CandleDto> candles = marketDataService.getCandles(symbol, timeframe);
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "symbol", symbol.toUpperCase(),
                "timeframe", timeframe.toUpperCase(),
                "candles", candles
        )));
    }
}
