package com.portfoliopro.service;

import com.portfoliopro.dto.MarketDtos.*;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TechnicalIndicatorServiceTest {

    private final TechnicalIndicatorService service = new TechnicalIndicatorService();

    @Test
    void computeIndicators_calculatesAccurateSmaRsiAndBollinger() {
        List<CandleDto> candles = new ArrayList<>();
        for (int i = 0; i < 60; i++) {
            double price = 1000.0 + i * 5.0;
            candles.add(new CandleDto(1700000000L + i * 86400L, price - 3, price + 6, price - 5, price, 50_000L));
        }

        List<TimeValuePoint> sma20 = service.computeSma(candles, 20);
        assertEquals(41, sma20.size());
        // First 20 closes: 1000, 1005, ..., 1095 -> average = 1047.50
        assertEquals(1047.50, sma20.get(0).value(), 0.01);

        List<TimeValuePoint> rsi14 = service.computeRsi(candles, 14);
        assertFalse(rsi14.isEmpty());
        // Strictly rising series should produce RSI = 100
        assertEquals(100.0, rsi14.get(rsi14.size() - 1).value(), 0.01);

        List<BollingerPoint> bb = service.computeBollingerBands(candles, 20, 2.0);
        assertEquals(41, bb.size());
        BollingerPoint lastBb = bb.get(bb.size() - 1);
        assertTrue(lastBb.upper() > lastBb.middle());
        assertTrue(lastBb.middle() > lastBb.lower());

        TechnicalAnalysisDto full = service.buildAnalysis("TCS", "1Y", candles);
        assertNotNull(full.summary());
        assertFalse(full.macd().isEmpty());
    }
}
