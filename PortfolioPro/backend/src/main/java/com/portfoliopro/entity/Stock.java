package com.portfoliopro.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "stocks", indexes = @Index(name = "idx_stock_symbol", columnList = "symbol", unique = true))
public class Stock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 24)
    private String symbol;

    @Column(nullable = false, length = 140)
    private String name;

    @Column(nullable = false, length = 80)
    private String sector;

    @Column(nullable = false, length = 120)
    private String industry;

    @Column(nullable = false)
    private double basePrice;

    @Column(nullable = false)
    private double ltp;

    @Column(nullable = false)
    private double openPrice;

    @Column(nullable = false)
    private double dayHigh;

    @Column(nullable = false)
    private double dayLow;

    @Column(nullable = false)
    private double prevClose;

    @Column(nullable = false)
    private long volume;

    @Column(nullable = false)
    private double high52w;

    @Column(nullable = false)
    private double low52w;

    @Column(nullable = false)
    private double marketCapCr;

    @Column(nullable = false)
    private double peRatio;

    @Column(nullable = false)
    private double pbRatio;

    @Column(nullable = false)
    private double eps;

    @Column(nullable = false)
    private double roe;

    @Column(nullable = false)
    private double debtToEquity;

    @Column(nullable = false)
    private double dividendYield;

    @Column(nullable = false)
    private double beta;

    @Column(nullable = false)
    private double annualVolatility;

    @Column(nullable = false)
    private double revenueGrowthYoY;

    @Column(nullable = false)
    private double netProfitMargin;

    @Column(length = 600)
    private String about;

    public Stock() {
    }

    public Stock(Long id, String symbol, String name, String sector, String industry, double basePrice, double ltp, double openPrice, double dayHigh, double dayLow, double prevClose, long volume, double high52w, double low52w, double marketCapCr, double peRatio, double pbRatio, double eps, double roe, double debtToEquity, double dividendYield, double beta, double annualVolatility, double revenueGrowthYoY, double netProfitMargin, String about) {
        this.id = id;
        this.symbol = symbol;
        this.name = name;
        this.sector = sector;
        this.industry = industry;
        this.basePrice = basePrice;
        this.ltp = ltp;
        this.openPrice = openPrice;
        this.dayHigh = dayHigh;
        this.dayLow = dayLow;
        this.prevClose = prevClose;
        this.volume = volume;
        this.high52w = high52w;
        this.low52w = low52w;
        this.marketCapCr = marketCapCr;
        this.peRatio = peRatio;
        this.pbRatio = pbRatio;
        this.eps = eps;
        this.roe = roe;
        this.debtToEquity = debtToEquity;
        this.dividendYield = dividendYield;
        this.beta = beta;
        this.annualVolatility = annualVolatility;
        this.revenueGrowthYoY = revenueGrowthYoY;
        this.netProfitMargin = netProfitMargin;
        this.about = about;
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

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSector() {
        return this.sector;
    }

    public void setSector(String sector) {
        this.sector = sector;
    }

    public String getIndustry() {
        return this.industry;
    }

    public void setIndustry(String industry) {
        this.industry = industry;
    }

    public double getBasePrice() {
        return this.basePrice;
    }

    public void setBasePrice(double basePrice) {
        this.basePrice = basePrice;
    }

    public double getLtp() {
        return this.ltp;
    }

    public void setLtp(double ltp) {
        this.ltp = ltp;
    }

    public double getOpenPrice() {
        return this.openPrice;
    }

    public void setOpenPrice(double openPrice) {
        this.openPrice = openPrice;
    }

    public double getDayHigh() {
        return this.dayHigh;
    }

    public void setDayHigh(double dayHigh) {
        this.dayHigh = dayHigh;
    }

    public double getDayLow() {
        return this.dayLow;
    }

    public void setDayLow(double dayLow) {
        this.dayLow = dayLow;
    }

    public double getPrevClose() {
        return this.prevClose;
    }

    public void setPrevClose(double prevClose) {
        this.prevClose = prevClose;
    }

    public long getVolume() {
        return this.volume;
    }

    public void setVolume(long volume) {
        this.volume = volume;
    }

    public double getHigh52w() {
        return this.high52w;
    }

    public void setHigh52w(double high52w) {
        this.high52w = high52w;
    }

    public double getLow52w() {
        return this.low52w;
    }

    public void setLow52w(double low52w) {
        this.low52w = low52w;
    }

    public double getMarketCapCr() {
        return this.marketCapCr;
    }

    public void setMarketCapCr(double marketCapCr) {
        this.marketCapCr = marketCapCr;
    }

    public double getPeRatio() {
        return this.peRatio;
    }

    public void setPeRatio(double peRatio) {
        this.peRatio = peRatio;
    }

    public double getPbRatio() {
        return this.pbRatio;
    }

    public void setPbRatio(double pbRatio) {
        this.pbRatio = pbRatio;
    }

    public double getEps() {
        return this.eps;
    }

    public void setEps(double eps) {
        this.eps = eps;
    }

    public double getRoe() {
        return this.roe;
    }

    public void setRoe(double roe) {
        this.roe = roe;
    }

    public double getDebtToEquity() {
        return this.debtToEquity;
    }

    public void setDebtToEquity(double debtToEquity) {
        this.debtToEquity = debtToEquity;
    }

    public double getDividendYield() {
        return this.dividendYield;
    }

    public void setDividendYield(double dividendYield) {
        this.dividendYield = dividendYield;
    }

    public double getBeta() {
        return this.beta;
    }

    public void setBeta(double beta) {
        this.beta = beta;
    }

    public double getAnnualVolatility() {
        return this.annualVolatility;
    }

    public void setAnnualVolatility(double annualVolatility) {
        this.annualVolatility = annualVolatility;
    }

    public double getRevenueGrowthYoY() {
        return this.revenueGrowthYoY;
    }

    public void setRevenueGrowthYoY(double revenueGrowthYoY) {
        this.revenueGrowthYoY = revenueGrowthYoY;
    }

    public double getNetProfitMargin() {
        return this.netProfitMargin;
    }

    public void setNetProfitMargin(double netProfitMargin) {
        this.netProfitMargin = netProfitMargin;
    }

    public String getAbout() {
        return this.about;
    }

    public void setAbout(String about) {
        this.about = about;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private String symbol;
        private String name;
        private String sector;
        private String industry;
        private double basePrice;
        private double ltp;
        private double openPrice;
        private double dayHigh;
        private double dayLow;
        private double prevClose;
        private long volume;
        private double high52w;
        private double low52w;
        private double marketCapCr;
        private double peRatio;
        private double pbRatio;
        private double eps;
        private double roe;
        private double debtToEquity;
        private double dividendYield;
        private double beta;
        private double annualVolatility;
        private double revenueGrowthYoY;
        private double netProfitMargin;
        private String about;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder sector(String sector) {
            this.sector = sector;
            return this;
        }

        public Builder industry(String industry) {
            this.industry = industry;
            return this;
        }

        public Builder basePrice(double basePrice) {
            this.basePrice = basePrice;
            return this;
        }

        public Builder ltp(double ltp) {
            this.ltp = ltp;
            return this;
        }

        public Builder openPrice(double openPrice) {
            this.openPrice = openPrice;
            return this;
        }

        public Builder dayHigh(double dayHigh) {
            this.dayHigh = dayHigh;
            return this;
        }

        public Builder dayLow(double dayLow) {
            this.dayLow = dayLow;
            return this;
        }

        public Builder prevClose(double prevClose) {
            this.prevClose = prevClose;
            return this;
        }

        public Builder volume(long volume) {
            this.volume = volume;
            return this;
        }

        public Builder high52w(double high52w) {
            this.high52w = high52w;
            return this;
        }

        public Builder low52w(double low52w) {
            this.low52w = low52w;
            return this;
        }

        public Builder marketCapCr(double marketCapCr) {
            this.marketCapCr = marketCapCr;
            return this;
        }

        public Builder peRatio(double peRatio) {
            this.peRatio = peRatio;
            return this;
        }

        public Builder pbRatio(double pbRatio) {
            this.pbRatio = pbRatio;
            return this;
        }

        public Builder eps(double eps) {
            this.eps = eps;
            return this;
        }

        public Builder roe(double roe) {
            this.roe = roe;
            return this;
        }

        public Builder debtToEquity(double debtToEquity) {
            this.debtToEquity = debtToEquity;
            return this;
        }

        public Builder dividendYield(double dividendYield) {
            this.dividendYield = dividendYield;
            return this;
        }

        public Builder beta(double beta) {
            this.beta = beta;
            return this;
        }

        public Builder annualVolatility(double annualVolatility) {
            this.annualVolatility = annualVolatility;
            return this;
        }

        public Builder revenueGrowthYoY(double revenueGrowthYoY) {
            this.revenueGrowthYoY = revenueGrowthYoY;
            return this;
        }

        public Builder netProfitMargin(double netProfitMargin) {
            this.netProfitMargin = netProfitMargin;
            return this;
        }

        public Builder about(String about) {
            this.about = about;
            return this;
        }

        public Stock build() {
            return new Stock(this.id, this.symbol, this.name, this.sector, this.industry, this.basePrice, this.ltp, this.openPrice, this.dayHigh, this.dayLow, this.prevClose, this.volume, this.high52w, this.low52w, this.marketCapCr, this.peRatio, this.pbRatio, this.eps, this.roe, this.debtToEquity, this.dividendYield, this.beta, this.annualVolatility, this.revenueGrowthYoY, this.netProfitMargin, this.about);
        }
    }
}
