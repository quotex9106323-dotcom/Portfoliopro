package com.portfoliopro.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "holdings", uniqueConstraints = @UniqueConstraint(name = "uk_holding_user_sym", columnNames = {"user_id", "symbol"}))
public class Holding {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 24)
    private String symbol;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal avgBuyPrice;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal investedAmount;

    @Column(precision = 18, scale = 2)
    private BigDecimal stopLossPrice;

    @Column(precision = 18, scale = 2)
    private BigDecimal targetPrice;

    @Column(nullable = false, updatable = false)
    private Instant firstBoughtAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public Holding() {
    }

    public Holding(Long id, User user, String symbol, int quantity, BigDecimal avgBuyPrice, BigDecimal investedAmount, BigDecimal stopLossPrice, BigDecimal targetPrice, Instant firstBoughtAt, Instant updatedAt) {
        this.id = id;
        this.user = user;
        this.symbol = symbol;
        this.quantity = quantity;
        this.avgBuyPrice = avgBuyPrice;
        this.investedAmount = investedAmount;
        this.stopLossPrice = stopLossPrice;
        this.targetPrice = targetPrice;
        this.firstBoughtAt = firstBoughtAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return this.user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getSymbol() {
        return this.symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public int getQuantity() {
        return this.quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getAvgBuyPrice() {
        return this.avgBuyPrice;
    }

    public void setAvgBuyPrice(BigDecimal avgBuyPrice) {
        this.avgBuyPrice = avgBuyPrice;
    }

    public BigDecimal getInvestedAmount() {
        return this.investedAmount;
    }

    public void setInvestedAmount(BigDecimal investedAmount) {
        this.investedAmount = investedAmount;
    }

    public BigDecimal getStopLossPrice() {
        return this.stopLossPrice;
    }

    public void setStopLossPrice(BigDecimal stopLossPrice) {
        this.stopLossPrice = stopLossPrice;
    }

    public BigDecimal getTargetPrice() {
        return this.targetPrice;
    }

    public void setTargetPrice(BigDecimal targetPrice) {
        this.targetPrice = targetPrice;
    }

    public Instant getFirstBoughtAt() {
        return this.firstBoughtAt;
    }

    public void setFirstBoughtAt(Instant firstBoughtAt) {
        this.firstBoughtAt = firstBoughtAt;
    }

    public Instant getUpdatedAt() {
        return this.updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private User user;
        private String symbol;
        private int quantity;
        private BigDecimal avgBuyPrice;
        private BigDecimal investedAmount;
        private BigDecimal stopLossPrice;
        private BigDecimal targetPrice;
        private Instant firstBoughtAt = Instant.now();
        private Instant updatedAt = Instant.now();

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder user(User user) {
            this.user = user;
            return this;
        }

        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        public Builder quantity(int quantity) {
            this.quantity = quantity;
            return this;
        }

        public Builder avgBuyPrice(BigDecimal avgBuyPrice) {
            this.avgBuyPrice = avgBuyPrice;
            return this;
        }

        public Builder investedAmount(BigDecimal investedAmount) {
            this.investedAmount = investedAmount;
            return this;
        }

        public Builder stopLossPrice(BigDecimal stopLossPrice) {
            this.stopLossPrice = stopLossPrice;
            return this;
        }

        public Builder targetPrice(BigDecimal targetPrice) {
            this.targetPrice = targetPrice;
            return this;
        }

        public Builder firstBoughtAt(Instant firstBoughtAt) {
            this.firstBoughtAt = firstBoughtAt;
            return this;
        }

        public Builder updatedAt(Instant updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public Holding build() {
            return new Holding(this.id, this.user, this.symbol, this.quantity, this.avgBuyPrice, this.investedAmount, this.stopLossPrice, this.targetPrice, this.firstBoughtAt, this.updatedAt);
        }
    }
}
