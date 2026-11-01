package com.portfoliopro.controller;

import com.portfoliopro.dto.ApiResponse;
import com.portfoliopro.dto.PortfolioDtos.WalletActionRequest;
import com.portfoliopro.dto.WatchlistDtos.*;
import com.portfoliopro.entity.Notification;
import com.portfoliopro.repository.NotificationRepository;
import com.portfoliopro.service.WalletService;
import com.portfoliopro.service.WatchlistService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class WatchlistAndWalletController {

    private final WatchlistService watchlistService;
    private final WalletService walletService;
    private final NotificationRepository notificationRepository;

    public WatchlistAndWalletController(
            WatchlistService watchlistService,
            WalletService walletService,
            NotificationRepository notificationRepository
    ) {
        this.watchlistService = watchlistService;
        this.walletService = walletService;
        this.notificationRepository = notificationRepository;
    }

    @GetMapping("/watchlists")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWatchlists(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(watchlistService.getUserWatchlistsAndAlerts(userId)));
    }

    @PostMapping("/watchlists")
    public ResponseEntity<ApiResponse<WatchlistDto>> createWatchlist(
            Authentication auth,
            @Valid @RequestBody CreateWatchlistRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(watchlistService.createWatchlist(userId, req)));
    }

    @DeleteMapping("/watchlists/{id}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> deleteWatchlist(
            Authentication auth,
            @PathVariable Long id
    ) {
        Long userId = (Long) auth.getPrincipal();
        watchlistService.deleteWatchlist(userId, id);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("deleted", true)));
    }

    @PostMapping("/watchlists/{id}/items")
    public ResponseEntity<ApiResponse<WatchlistDto>> addSymbol(
            Authentication auth,
            @PathVariable Long id,
            @Valid @RequestBody AddSymbolRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(watchlistService.addSymbol(userId, id, req.symbol())));
    }

    @DeleteMapping("/watchlists/{id}/items/{symbol}")
    public ResponseEntity<ApiResponse<WatchlistDto>> removeSymbol(
            Authentication auth,
            @PathVariable Long id,
            @PathVariable String symbol
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(watchlistService.removeSymbol(userId, id, symbol)));
    }

    @PutMapping("/watchlists/{id}/reorder")
    public ResponseEntity<ApiResponse<WatchlistDto>> reorder(
            Authentication auth,
            @PathVariable Long id,
            @Valid @RequestBody ReorderSymbolsRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(watchlistService.reorder(userId, id, req.symbols())));
    }

    @PostMapping("/alerts")
    public ResponseEntity<ApiResponse<PriceAlertDto>> createAlert(
            Authentication auth,
            @Valid @RequestBody CreateAlertRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(watchlistService.createAlert(userId, req)));
    }

    @DeleteMapping("/alerts/{id}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> deleteAlert(
            Authentication auth,
            @PathVariable Long id
    ) {
        Long userId = (Long) auth.getPrincipal();
        watchlistService.deleteAlert(userId, id);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("deleted", true)));
    }

    @GetMapping("/wallet")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWallet(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(walletService.getWalletSummary(userId, page, size)));
    }

    @PostMapping("/wallet/deposit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deposit(
            Authentication auth,
            @RequestBody WalletActionRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(walletService.deposit(userId, req)));
    }

    @PostMapping("/wallet/withdraw")
    public ResponseEntity<ApiResponse<Map<String, Object>>> withdraw(
            Authentication auth,
            @RequestBody WalletActionRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(walletService.withdraw(userId, req)));
    }

    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getNotifications(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        List<Notification> list = notificationRepository.findTop40ByUserIdOrderByCreatedAtDesc(userId);
        long unread = notificationRepository.countByUserIdAndReadFalse(userId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("notifications", list, "unreadCount", unread)));
    }

    @PostMapping("/notifications/read-all")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> markAllRead(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        List<Notification> list = notificationRepository.findTop40ByUserIdOrderByCreatedAtDesc(userId);
        list.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(list);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("readAll", true)));
    }
}
