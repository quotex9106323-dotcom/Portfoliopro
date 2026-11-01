package com.portfoliopro.controller;

import com.portfoliopro.dto.ApiResponse;
import com.portfoliopro.dto.OrderDtos.*;
import com.portfoliopro.dto.PagedResponse;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.service.TradeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final TradeService tradeService;

    public OrderController(
            TradeService tradeService
    ) {
        this.tradeService = tradeService;
    }

    @PostMapping("/estimate")
    public ResponseEntity<ApiResponse<ChargeEstimateDto>> estimate(@Valid @RequestBody PlaceOrderRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(tradeService.estimateOrder(req)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OrderDto>> placeOrder(
            Authentication auth,
            @Valid @RequestBody PlaceOrderRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        OrderDto dto = tradeService.placeOrder(userId, req, "MANUAL");
        if (dto.status() == OrderStatus.REJECTED) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(new ApiResponse<>(false, dto.rejectionReason(), dto, java.time.Instant.now()));
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Order " + dto.status().name().toLowerCase(), dto));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<OrderDto>>> listOrders(
            Authentication auth,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(tradeService.listOrders(userId, status, page, size)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<OrderDto>> cancelOrder(
            Authentication auth,
            @PathVariable Long id
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Order cancelled", tradeService.cancelOrder(userId, id)));
    }
}
