package com.portfoliopro.dto;

import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.entity.enums.OrderType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

public class OrderDtos {

    public record PlaceOrderRequest(
            @NotBlank(message = "Symbol is required")
            String symbol,

            @NotNull(message = "Order side is required")
            OrderSide side,

            @NotNull(message = "Order type is required")
            OrderType orderType,

            @Min(value = 1, message = "Quantity must be at least 1")
            int quantity,

            BigDecimal limitPrice,
            BigDecimal stopLossPrice,
            BigDecimal targetPrice
    ) {}

    public record ChargeEstimateDto(
            BigDecimal referencePrice,
            int quantity,
            BigDecimal turnover,
            BigDecimal brokerage,
            BigDecimal stt,
            BigDecimal exchangeTxnCharge,
            BigDecimal sebiTurnoverFee,
            BigDecimal stampDuty,
            BigDecimal gst,
            BigDecimal totalCharges,
            BigDecimal netAmount
    ) {}

    public record OrderDto(
            Long id,
            String symbol,
            OrderSide side,
            OrderType orderType,
            int quantity,
            BigDecimal requestedPrice,
            BigDecimal limitPrice,
            BigDecimal executedPrice,
            double currentLtp,
            OrderStatus status,
            String rejectionReason,
            String triggerSource,
            BigDecimal stopLossPrice,
            BigDecimal targetPrice,
            BigDecimal charges,
            BigDecimal totalValue,
            Instant createdAt,
            Instant executedAt
    ) {}
}
