package com.portfoliopro.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "wallets")
public class Wallet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal balance = new BigDecimal("1000000.00");

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal blockedMargin = BigDecimal.ZERO;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal totalDeposited = new BigDecimal("1000000.00");

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal totalWithdrawn = BigDecimal.ZERO;

    @Version
    private Long version;

    public Wallet() {
    }

    public Wallet(Long id, User user, BigDecimal balance, BigDecimal blockedMargin, BigDecimal totalDeposited, BigDecimal totalWithdrawn, Long version) {
        this.id = id;
        this.user = user;
        this.balance = balance;
        this.blockedMargin = blockedMargin;
        this.totalDeposited = totalDeposited;
        this.totalWithdrawn = totalWithdrawn;
        this.version = version;
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

    public BigDecimal getBalance() {
        return this.balance;
    }

    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }

    public BigDecimal getBlockedMargin() {
        return this.blockedMargin;
    }

    public void setBlockedMargin(BigDecimal blockedMargin) {
        this.blockedMargin = blockedMargin;
    }

    public BigDecimal getTotalDeposited() {
        return this.totalDeposited;
    }

    public void setTotalDeposited(BigDecimal totalDeposited) {
        this.totalDeposited = totalDeposited;
    }

    public BigDecimal getTotalWithdrawn() {
        return this.totalWithdrawn;
    }

    public void setTotalWithdrawn(BigDecimal totalWithdrawn) {
        this.totalWithdrawn = totalWithdrawn;
    }

    public Long getVersion() {
        return this.version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private User user;
        private BigDecimal balance = new BigDecimal("1000000.00");
        private BigDecimal blockedMargin = BigDecimal.ZERO;
        private BigDecimal totalDeposited = new BigDecimal("1000000.00");
        private BigDecimal totalWithdrawn = BigDecimal.ZERO;
        private Long version;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder user(User user) {
            this.user = user;
            return this;
        }

        public Builder balance(BigDecimal balance) {
            this.balance = balance;
            return this;
        }

        public Builder blockedMargin(BigDecimal blockedMargin) {
            this.blockedMargin = blockedMargin;
            return this;
        }

        public Builder totalDeposited(BigDecimal totalDeposited) {
            this.totalDeposited = totalDeposited;
            return this;
        }

        public Builder totalWithdrawn(BigDecimal totalWithdrawn) {
            this.totalWithdrawn = totalWithdrawn;
            return this;
        }

        public Builder version(Long version) {
            this.version = version;
            return this;
        }

        public Wallet build() {
            return new Wallet(this.id, this.user, this.balance, this.blockedMargin, this.totalDeposited, this.totalWithdrawn, this.version);
        }
    }
}
