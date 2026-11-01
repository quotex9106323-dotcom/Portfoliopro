package com.portfoliopro.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "watchlists")
public class Watchlist {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 60)
    private String name;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "watchlist_symbols", joinColumns = @JoinColumn(name = "watchlist_id"))
    @OrderColumn(name = "sort_order")
    @Column(name = "symbol", length = 24)
    private List<String> symbols = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Watchlist() {
    }

    public Watchlist(Long id, User user, String name, List<String> symbols, Instant createdAt) {
        this.id = id;
        this.user = user;
        this.name = name;
        this.symbols = symbols;
        this.createdAt = createdAt;
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

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<String> getSymbols() {
        return this.symbols;
    }

    public void setSymbols(List<String> symbols) {
        this.symbols = symbols;
    }

    public Instant getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private User user;
        private String name;
        private List<String> symbols = new ArrayList<>();
        private Instant createdAt = Instant.now();

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder user(User user) {
            this.user = user;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder symbols(List<String> symbols) {
            this.symbols = symbols;
            return this;
        }

        public Builder createdAt(Instant createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Watchlist build() {
            return new Watchlist(this.id, this.user, this.name, this.symbols, this.createdAt);
        }
    }
}
