package com.portfoliopro.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "ohlcv_candles", indexes = @Index(name = "idx_candle_sym_tf_ts", columnList = "symbol,timeframe,epochSec"))
public class OhlcvCandle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 24)
    private String symbol;

    @Column(nullable = false, length = 8)
    private String timeframe;

    @Column(nullable = false)
    private long epochSec;

    @Column(nullable = false)
    private double openPrice;

    @Column(nullable = false)
    private double highPrice;

    @Column(nullable = false)
    private double lowPrice;

    @Column(nullable = false)
    private double closePrice;

    @Column(nullable = false)
    private long volume;

    public OhlcvCandle() {
    }

    public OhlcvCandle(Long id, String symbol, String timeframe, long epochSec, double openPrice, double highPrice, double lowPrice, double closePrice, long volume) {
        this.id = id;
        this.symbol = symbol;
        this.timeframe = timeframe;
        this.epochSec = epochSec;
        this.openPrice = openPrice;
        this.highPrice = highPrice;
        this.lowPrice = lowPrice;
        this.closePrice = closePrice;
        this.volume = volume;
    }

    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSymbol() {
        return this.symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public String getTimeframe() {
        return this.timeframe;
    }

    public void setTimeframe(String timeframe) {
        this.timeframe = timeframe;
    }

    public long getEpochSec() {
        return this.epochSec;
    }

    public void setEpochSec(long epochSec) {
        this.epochSec = epochSec;
    }

    public double getOpenPrice() {
        return this.openPrice;
    }

    public void setOpenPrice(double openPrice) {
        this.openPrice = openPrice;
    }

    public double getHighPrice() {
        return this.highPrice;
    }

    public void setHighPrice(double highPrice) {
        this.highPrice = highPrice;
    }

    public double getLowPrice() {
        return this.lowPrice;
    }

    public void setLowPrice(double lowPrice) {
        this.lowPrice = lowPrice;
    }

    public double getClosePrice() {
        return this.closePrice;
    }

    public void setClosePrice(double closePrice) {
        this.closePrice = closePrice;
    }

    public long getVolume() {
        return this.volume;
    }

    public void setVolume(long volume) {
        this.volume = volume;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private String symbol;
        private String timeframe;
        private long epochSec;
        private double openPrice;
        private double highPrice;
        private double lowPrice;
        private double closePrice;
        private long volume;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        public Builder timeframe(String timeframe) {
            this.timeframe = timeframe;
            return this;
        }

        public Builder epochSec(long epochSec) {
            this.epochSec = epochSec;
            return this;
        }

        public Builder openPrice(double openPrice) {
            this.openPrice = openPrice;
            return this;
        }

        public Builder highPrice(double highPrice) {
            this.highPrice = highPrice;
            return this;
        }

        public Builder lowPrice(double lowPrice) {
            this.lowPrice = lowPrice;
            return this;
        }

        public Builder closePrice(double closePrice) {
            this.closePrice = closePrice;
            return this;
        }

        public Builder volume(long volume) {
            this.volume = volume;
            return this;
        }

        public OhlcvCandle build() {
            return new OhlcvCandle(this.id, this.symbol, this.timeframe, this.epochSec, this.openPrice, this.highPrice, this.lowPrice, this.closePrice, this.volume);
        }
    }
}
