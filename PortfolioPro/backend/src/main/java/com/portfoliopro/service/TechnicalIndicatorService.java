package com.portfoliopro.service;

import com.portfoliopro.dto.MarketDtos.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class TechnicalIndicatorService {

    public List<TimeValuePoint> computeSma(List<CandleDto> candles, int period) {
        List<TimeValuePoint> out = new ArrayList<>();
        if (candles.size() < period || period <= 0) return out;
        double sum = 0;
        for (int i = 0; i < candles.size(); i++) {
            sum += candles.get(i).close();
            if (i >= period) {
                sum -= candles.get(i - period).close();
            }
            if (i >= period - 1) {
                out.add(new TimeValuePoint(candles.get(i).time(), round2(sum / period)));
            }
        }
        return out;
    }

    public List<TimeValuePoint> computeEma(List<CandleDto> candles, int period) {
        List<TimeValuePoint> out = new ArrayList<>();
        if (candles.isEmpty() || period <= 0) return out;
        double k = 2.0 / (period + 1);
        double ema = candles.get(0).close();
        for (int i = 0; i < candles.size(); i++) {
            double c = candles.get(i).close();
            ema = (i == 0) ? c : (c * k + ema * (1 - k));
            if (i >= period - 1) {
                out.add(new TimeValuePoint(candles.get(i).time(), round2(ema)));
            }
        }
        return out;
    }

    public List<BollingerPoint> computeBollingerBands(List<CandleDto> candles, int period, double stdMult) {
        List<BollingerPoint> out = new ArrayList<>();
        if (candles.size() < period) return out;
        for (int i = period - 1; i < candles.size(); i++) {
            double sum = 0;
            for (int j = i - period + 1; j <= i; j++) sum += candles.get(j).close();
            double mean = sum / period;
            double sq = 0;
            for (int j = i - period + 1; j <= i; j++) {
                double diff = candles.get(j).close() - mean;
                sq += diff * diff;
            }
            double std = Math.sqrt(sq / period);
            out.add(new BollingerPoint(
                    candles.get(i).time(),
                    round2(mean + stdMult * std),
                    round2(mean),
                    round2(Math.max(0.5, mean - stdMult * std))
            ));
        }
        return out;
    }

    public List<TimeValuePoint> computeRsi(List<CandleDto> candles, int period) {
        List<TimeValuePoint> out = new ArrayList<>();
        if (candles.size() <= period) return out;

        double gains = 0;
        double losses = 0;
        for (int i = 1; i <= period; i++) {
            double d = candles.get(i).close() - candles.get(i - 1).close();
            if (d >= 0) gains += d;
            else losses -= d;
        }
        double avgGain = gains / period;
        double avgLoss = losses / period;
        double firstRsi = avgLoss == 0 ? 100.0 : 100.0 - (100.0 / (1.0 + avgGain / avgLoss));
        out.add(new TimeValuePoint(candles.get(period).time(), round2(firstRsi)));

        for (int i = period + 1; i < candles.size(); i++) {
            double d = candles.get(i).close() - candles.get(i - 1).close();
            double gain = Math.max(0, d);
            double loss = Math.max(0, -d);
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            double rsi = avgLoss == 0 ? 100.0 : 100.0 - (100.0 / (1.0 + avgGain / avgLoss));
            out.add(new TimeValuePoint(candles.get(i).time(), round2(rsi)));
        }
        return out;
    }

    public List<MacdPoint> computeMacd(List<CandleDto> candles, int fast, int slow, int signalPeriod) {
        List<MacdPoint> out = new ArrayList<>();
        if (candles.size() < slow) return out;

        double kFast = 2.0 / (fast + 1);
        double kSlow = 2.0 / (slow + 1);
        double kSig = 2.0 / (signalPeriod + 1);

        double emaFast = candles.get(0).close();
        double emaSlow = candles.get(0).close();
        List<TimeValuePoint> rawMacd = new ArrayList<>();

        for (int i = 0; i < candles.size(); i++) {
            double c = candles.get(i).close();
            emaFast = i == 0 ? c : c * kFast + emaFast * (1 - kFast);
            emaSlow = i == 0 ? c : c * kSlow + emaSlow * (1 - kSlow);
            if (i >= slow - 1) {
                rawMacd.add(new TimeValuePoint(candles.get(i).time(), emaFast - emaSlow));
            }
        }
        if (rawMacd.isEmpty()) return out;

        double sig = rawMacd.get(0).value();
        for (int i = 0; i < rawMacd.size(); i++) {
            double m = rawMacd.get(i).value();
            sig = i == 0 ? m : m * kSig + sig * (1 - kSig);
            if (i >= signalPeriod - 1) {
                double mR = round2(m);
                double sR = round2(sig);
                out.add(new MacdPoint(rawMacd.get(i).time(), mR, sR, round2(mR - sR)));
            }
        }
        return out;
    }

    public TechnicalAnalysisDto buildAnalysis(String symbol, String timeframe, List<CandleDto> candles) {
        List<TimeValuePoint> sma20 = computeSma(candles, 20);
        List<TimeValuePoint> sma50 = computeSma(candles, 50);
        List<TimeValuePoint> ema12 = computeEma(candles, 12);
        List<TimeValuePoint> ema26 = computeEma(candles, 26);
        List<BollingerPoint> bb = computeBollingerBands(candles, 20, 2.0);
        List<TimeValuePoint> rsi14 = computeRsi(candles, 14);
        List<MacdPoint> macd = computeMacd(candles, 12, 26, 9);

        double lastClose = candles.isEmpty() ? 0 : candles.get(candles.size() - 1).close();
        double lastSma20 = sma20.isEmpty() ? lastClose : sma20.get(sma20.size() - 1).value();
        double lastSma50 = sma50.isEmpty() ? lastClose : sma50.get(sma50.size() - 1).value();
        double lastRsi = rsi14.isEmpty() ? 50.0 : rsi14.get(rsi14.size() - 1).value();
        double lastHist = macd.isEmpty() ? 0.0 : macd.get(macd.size() - 1).histogram();

        int from = Math.max(0, candles.size() - 30);
        double support = candles.subList(from, candles.size()).stream().mapToDouble(CandleDto::low).min().orElse(lastClose);
        double resistance = candles.subList(from, candles.size()).stream().mapToDouble(CandleDto::high).max().orElse(lastClose);

        int bull = 0;
        if (lastClose > lastSma20) bull++;
        if (lastSma20 >= lastSma50) bull++;
        if (lastHist > 0) bull++;
        if (lastRsi >= 45 && lastRsi <= 68) bull++;
        if (lastRsi > 74) bull--;

        String signal = bull >= 3 ? "Bullish" : (bull <= 1 ? "Bearish" : "Neutral");
        double vsSma20 = lastSma20 > 0 ? round2(((lastClose - lastSma20) / lastSma20) * 100.0) : 0.0;
        String commentary = String.format(
                "%s trades %.2f%% %s SMA(20) with RSI(14) at %.2f and MACD histogram at %.2f.",
                symbol, Math.abs(vsSma20), vsSma20 >= 0 ? "above" : "below", lastRsi, lastHist
        );

        return new TechnicalAnalysisDto(
                symbol,
                timeframe,
                candles,
                sma20,
                sma50,
                ema12,
                ema26,
                bb,
                rsi14,
                macd,
                new TechnicalSummaryDto(signal, lastRsi, lastHist, vsSma20, round2(support), round2(resistance), commentary)
        );
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
