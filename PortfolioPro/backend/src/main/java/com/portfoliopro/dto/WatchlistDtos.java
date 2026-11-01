package com.portfoliopro.dto;

import com.portfoliopro.entity.enums.AlertCondition;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class WatchlistDtos {

    public record CreateWatchlistRequest(
            @NotBlank(message = "Watchlist name is required")
            String name
    ) {}

    public record AddSymbolRequest(
            @NotBlank(message = "Symbol is required")
            String symbol
    ) {}

    public record ReorderSymbolsRequest(
            @NotNull
            List<String> symbols
    ) {}

    public record WatchlistDto(
            Long id,
            String name,
            List<String> symbols,
            List<MarketDtos.StockQuoteDto> items
    ) {}

    public record CreateAlertRequest(
            @NotBlank(message = "Symbol is required")
            String symbol,

            @NotNull(message = "Condition is required")
            AlertCondition condition,

            @NotNull(message = "Target price is required")
            BigDecimal targetPrice
    ) {}

    public record PriceAlertDto(
            Long id,
            String symbol,
            AlertCondition condition,
            BigDecimal targetPrice,
            double currentLtp,
            boolean triggered,
            Instant createdAt,
            Instant triggeredAt
    ) {}
}
