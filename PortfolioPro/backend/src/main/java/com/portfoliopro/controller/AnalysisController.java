package com.portfoliopro.controller;

import com.portfoliopro.dto.ApiResponse;
import com.portfoliopro.dto.MarketDtos.CandleDto;
import com.portfoliopro.dto.MarketDtos.FundamentalAnalysisDto;
import com.portfoliopro.dto.MarketDtos.TechnicalAnalysisDto;
import com.portfoliopro.service.FundamentalAnalysisService;
import com.portfoliopro.service.MarketDataService;
import com.portfoliopro.service.TechnicalIndicatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    private final MarketDataService marketDataService;
    private final TechnicalIndicatorService technicalIndicatorService;
    private final FundamentalAnalysisService fundamentalAnalysisService;

    public AnalysisController(
            MarketDataService marketDataService,
            TechnicalIndicatorService technicalIndicatorService,
            FundamentalAnalysisService fundamentalAnalysisService
    ) {
        this.marketDataService = marketDataService;
        this.technicalIndicatorService = technicalIndicatorService;
        this.fundamentalAnalysisService = fundamentalAnalysisService;
    }

    @GetMapping("/{symbol}/technicals")
    public ResponseEntity<ApiResponse<TechnicalAnalysisDto>> technicals(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1Y") String timeframe
    ) {
        List<CandleDto> candles = marketDataService.getCandles(symbol, timeframe);
        return ResponseEntity.ok(ApiResponse.ok(
                technicalIndicatorService.buildAnalysis(symbol.toUpperCase(), timeframe.toUpperCase(), candles)
        ));
    }

    @GetMapping("/{symbol}/fundamentals")
    public ResponseEntity<ApiResponse<FundamentalAnalysisDto>> fundamentals(@PathVariable String symbol) {
        return ResponseEntity.ok(ApiResponse.ok(fundamentalAnalysisService.analyze(symbol)));
    }
}
