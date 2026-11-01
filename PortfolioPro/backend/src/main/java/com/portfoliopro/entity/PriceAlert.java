package com.portfoliopro.entity;

import com.portfoliopro.entity.enums.AlertCondition;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "price_alerts")
public class PriceAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 24)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private AlertCondition conditionType;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal targetPrice;

    @Column(nullable = false)
    private boolean triggered = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant triggeredAt;

    public PriceAlert() {
    }

    public PriceAlert(Long id, User user, String symbol, AlertCondition conditionType, BigDecimal targetPrice, boolean triggered, Instant createdAt, Instant triggeredAt) {
        this.id = id;
        this.user = user;
        this.symbol = symbol;
        this.conditionType = conditionType;
        this.targetPrice = targetPrice;
        this.triggered = triggered;
        this.createdAt = createdAt;
        this.triggeredAt = triggeredAt;
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

    public AlertCondition getConditionType() {
        return this.conditionType;
    }

    public void setConditionType(AlertCondition conditionType) {
        this.conditionType = conditionType;
    }

    public BigDecimal getTargetPrice() {
        return this.targetPrice;
    }

    public void setTargetPrice(BigDecimal targetPrice) {
        this.targetPrice = targetPrice;
    }

    public boolean isTriggered() {
        return this.triggered;
    }

    public void setTriggered(boolean triggered) {
        this.triggered = triggered;
    }

    public Instant getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getTriggeredAt() {
        return this.triggeredAt;
    }

    public void setTriggeredAt(Instant triggeredAt) {
        this.triggeredAt = triggeredAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private User user;
        private String symbol;
        private AlertCondition conditionType;
        private BigDecimal targetPrice;
        private boolean triggered = false;
        private Instant createdAt = Instant.now();
        private Instant triggeredAt;

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

        public Builder conditionType(AlertCondition conditionType) {
            this.conditionType = conditionType;
            return this;
        }

        public Builder targetPrice(BigDecimal targetPrice) {
            this.targetPrice = targetPrice;
            return this;
        }

        public Builder triggered(boolean triggered) {
            this.triggered = triggered;
            return this;
        }

        public Builder createdAt(Instant createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder triggeredAt(Instant triggeredAt) {
            this.triggeredAt = triggeredAt;
            return this;
        }

        public PriceAlert build() {
            return new PriceAlert(this.id, this.user, this.symbol, this.conditionType, this.targetPrice, this.triggered, this.createdAt, this.triggeredAt);
        }
    }
}
