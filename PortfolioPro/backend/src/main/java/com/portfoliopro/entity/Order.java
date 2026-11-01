package com.portfoliopro.entity;

import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.entity.enums.OrderType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_order_user_created", columnList = "user_id,createdAt"),
    @Index(name = "idx_order_status", columnList = "status")
})
public class Order {
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
    private OrderSide side;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private OrderType orderType;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal requestedPrice;

    @Column(precision = 18, scale = 2)
    private BigDecimal limitPrice;

    @Column(precision = 18, scale = 2)
    private BigDecimal executedPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private OrderStatus status;

    @Column(length = 255)
    private String rejectionReason;

    @Column(length = 24)
    private String triggerSource = "MANUAL";

    @Column(precision = 18, scale = 2)
    private BigDecimal stopLossPrice;

    @Column(precision = 18, scale = 2)
    private BigDecimal targetPrice;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal charges = BigDecimal.ZERO;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal totalValue = BigDecimal.ZERO;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant executedAt;

    public Order() {
    }

    public Order(Long id, User user, String symbol, OrderSide side, OrderType orderType, int quantity, BigDecimal requestedPrice, BigDecimal limitPrice, BigDecimal executedPrice, OrderStatus status, String rejectionReason, String triggerSource, BigDecimal stopLossPrice, BigDecimal targetPrice, BigDecimal charges, BigDecimal totalValue, Instant createdAt, Instant executedAt) {
        this.id = id;
        this.user = user;
        this.symbol = symbol;
        this.side = side;
        this.orderType = orderType;
        this.quantity = quantity;
        this.requestedPrice = requestedPrice;
        this.limitPrice = limitPrice;
        this.executedPrice = executedPrice;
        this.status = status;
        this.rejectionReason = rejectionReason;
        this.triggerSource = triggerSource;
        this.stopLossPrice = stopLossPrice;
        this.targetPrice = targetPrice;
        this.charges = charges;
        this.totalValue = totalValue;
        this.createdAt = createdAt;
        this.executedAt = executedAt;
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

    public OrderSide getSide() {
        return this.side;
    }

    public void setSide(OrderSide side) {
        this.side = side;
    }

    public OrderType getOrderType() {
        return this.orderType;
    }

    public void setOrderType(OrderType orderType) {
        this.orderType = orderType;
    }

    public int getQuantity() {
        return this.quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getRequestedPrice() {
        return this.requestedPrice;
    }

    public void setRequestedPrice(BigDecimal requestedPrice) {
        this.requestedPrice = requestedPrice;
    }

    public BigDecimal getLimitPrice() {
        return this.limitPrice;
    }

    public void setLimitPrice(BigDecimal limitPrice) {
        this.limitPrice = limitPrice;
    }

    public BigDecimal getExecutedPrice() {
        return this.executedPrice;
    }

    public void setExecutedPrice(BigDecimal executedPrice) {
        this.executedPrice = executedPrice;
    }

    public OrderStatus getStatus() {
        return this.status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public String getRejectionReason() {
        return this.rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getTriggerSource() {
        return this.triggerSource;
    }

    public void setTriggerSource(String triggerSource) {
        this.triggerSource = triggerSource;
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

    public BigDecimal getCharges() {
        return this.charges;
    }

    public void setCharges(BigDecimal charges) {
        this.charges = charges;
    }

    public BigDecimal getTotalValue() {
        return this.totalValue;
    }

    public void setTotalValue(BigDecimal totalValue) {
        this.totalValue = totalValue;
    }

    public Instant getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getExecutedAt() {
        return this.executedAt;
    }

    public void setExecutedAt(Instant executedAt) {
        this.executedAt = executedAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private User user;
        private String symbol;
        private OrderSide side;
        private OrderType orderType;
        private int quantity;
        private BigDecimal requestedPrice;
        private BigDecimal limitPrice;
        private BigDecimal executedPrice;
        private OrderStatus status;
        private String rejectionReason;
        private String triggerSource = "MANUAL";
        private BigDecimal stopLossPrice;
        private BigDecimal targetPrice;
        private BigDecimal charges = BigDecimal.ZERO;
        private BigDecimal totalValue = BigDecimal.ZERO;
        private Instant createdAt = Instant.now();
        private Instant executedAt;

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

        public Builder side(OrderSide side) {
            this.side = side;
            return this;
        }

        public Builder orderType(OrderType orderType) {
            this.orderType = orderType;
            return this;
        }

        public Builder quantity(int quantity) {
            this.quantity = quantity;
            return this;
        }

        public Builder requestedPrice(BigDecimal requestedPrice) {
            this.requestedPrice = requestedPrice;
            return this;
        }

        public Builder limitPrice(BigDecimal limitPrice) {
            this.limitPrice = limitPrice;
            return this;
        }

        public Builder executedPrice(BigDecimal executedPrice) {
            this.executedPrice = executedPrice;
            return this;
        }

        public Builder status(OrderStatus status) {
            this.status = status;
            return this;
        }

        public Builder rejectionReason(String rejectionReason) {
            this.rejectionReason = rejectionReason;
            return this;
        }

        public Builder triggerSource(String triggerSource) {
            this.triggerSource = triggerSource;
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

        public Builder charges(BigDecimal charges) {
            this.charges = charges;
            return this;
        }

        public Builder totalValue(BigDecimal totalValue) {
            this.totalValue = totalValue;
            return this;
        }

        public Builder createdAt(Instant createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder executedAt(Instant executedAt) {
            this.executedAt = executedAt;
            return this;
        }

        public Order build() {
            return new Order(this.id, this.user, this.symbol, this.side, this.orderType, this.quantity, this.requestedPrice, this.limitPrice, this.executedPrice, this.status, this.rejectionReason, this.triggerSource, this.stopLossPrice, this.targetPrice, this.charges, this.totalValue, this.createdAt, this.executedAt);
        }
    }
}
