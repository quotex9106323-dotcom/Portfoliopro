package com.portfoliopro.service;

import com.portfoliopro.dto.OrderDtos.*;
import com.portfoliopro.dto.PagedResponse;
import com.portfoliopro.entity.*;
import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.entity.enums.OrderType;
import com.portfoliopro.entity.enums.TransactionType;
import com.portfoliopro.exception.ApiException;
import com.portfoliopro.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Service
public class TradeService {

    private final UserRepository userRepository;
    private final StockRepository stockRepository;
    private final WalletRepository walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final HoldingRepository holdingRepository;
    private final OrderRepository orderRepository;
    private final NotificationRepository notificationRepository;

    public TradeService(
            UserRepository userRepository,
            StockRepository stockRepository,
            WalletRepository walletRepository,
            WalletTransactionRepository walletTransactionRepository,
            HoldingRepository holdingRepository,
            OrderRepository orderRepository,
            NotificationRepository notificationRepository
    ) {
        this.userRepository = userRepository;
        this.stockRepository = stockRepository;
        this.walletRepository = walletRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.holdingRepository = holdingRepository;
        this.orderRepository = orderRepository;
        this.notificationRepository = notificationRepository;
    }

    public ChargeEstimateDto calculateCharges(OrderSide side, BigDecimal price, int quantity) {
        BigDecimal qty = BigDecimal.valueOf(quantity);
        BigDecimal turnover = price.multiply(qty).setScale(2, RoundingMode.HALF_UP);
        BigDecimal brokerage = turnover.multiply(new BigDecimal("0.0003"))
                .min(new BigDecimal("20.00")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal stt = turnover.multiply(new BigDecimal("0.001")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal exchangeTxn = turnover.multiply(new BigDecimal("0.0000325")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal sebi = turnover.multiply(new BigDecimal("0.000001")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal stamp = side == OrderSide.BUY
                ? turnover.multiply(new BigDecimal("0.00015")).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal gst = brokerage.add(exchangeTxn).add(sebi)
                .multiply(new BigDecimal("0.18")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalCharges = brokerage.add(stt).add(exchangeTxn).add(sebi).add(stamp).add(gst)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = side == OrderSide.BUY
                ? turnover.add(totalCharges).setScale(2, RoundingMode.HALF_UP)
                : turnover.subtract(totalCharges).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        return new ChargeEstimateDto(
                price.setScale(2, RoundingMode.HALF_UP),
                quantity,
                turnover,
                brokerage,
                stt,
                exchangeTxn,
                sebi,
                stamp,
                gst,
                totalCharges,
                netAmount
        );
    }

    @Transactional(readOnly = true)
    public ChargeEstimateDto estimateOrder(PlaceOrderRequest req) {
        Stock stock = stockRepository.findBySymbolIgnoreCase(req.symbol())
                .orElseThrow(() -> new ApiException("Unknown stock: " + req.symbol(), HttpStatus.NOT_FOUND));
        BigDecimal refPrice = (req.orderType() == OrderType.LIMIT && req.limitPrice() != null && req.limitPrice().compareTo(BigDecimal.ZERO) > 0)
                ? req.limitPrice()
                : BigDecimal.valueOf(stock.getLtp());
        return calculateCharges(req.side(), refPrice, Math.max(1, req.quantity()));
    }

    @Transactional
    public OrderDto placeOrder(Long userId, PlaceOrderRequest req, String triggerSource) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));
        Stock stock = stockRepository.findBySymbolIgnoreCase(req.symbol())
                .orElseThrow(() -> new ApiException("Unknown stock: " + req.symbol(), HttpStatus.NOT_FOUND));
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException("Wallet not found", HttpStatus.NOT_FOUND));

        if (req.quantity() <= 0) {
            throw new ApiException("Quantity must be greater than zero", HttpStatus.BAD_REQUEST);
        }
        if (req.orderType() == OrderType.LIMIT && (req.limitPrice() == null || req.limitPrice().compareTo(BigDecimal.ZERO) <= 0)) {
            throw new ApiException("Valid limit price is required for Limit orders", HttpStatus.BAD_REQUEST);
        }

        BigDecimal ltp = BigDecimal.valueOf(stock.getLtp()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal refPrice = req.orderType() == OrderType.LIMIT ? req.limitPrice().setScale(2, RoundingMode.HALF_UP) : ltp;
        ChargeEstimateDto est = calculateCharges(req.side(), refPrice, req.quantity());

        boolean executeNow = req.orderType() == OrderType.MARKET
                || (req.side() == OrderSide.BUY && ltp.compareTo(refPrice) <= 0)
                || (req.side() == OrderSide.SELL && ltp.compareTo(refPrice) >= 0);

        if (req.side() == OrderSide.BUY) {
            if (wallet.getBalance().compareTo(est.netAmount()) < 0) {
                Order rejected = orderRepository.save(Order.builder()
                        .user(user)
                        .symbol(stock.getSymbol())
                        .side(OrderSide.BUY)
                        .orderType(req.orderType())
                        .quantity(req.quantity())
                        .requestedPrice(ltp)
                        .limitPrice(req.limitPrice())
                        .status(OrderStatus.REJECTED)
                        .rejectionReason("Insufficient available margin: required ₹" + est.netAmount())
                        .triggerSource(triggerSource)
                        .charges(est.totalCharges())
                        .totalValue(est.turnover())
                        .build());
                return toDto(rejected, stock.getLtp());
            }

            if (executeNow) {
                ChargeEstimateDto execEst = calculateCharges(OrderSide.BUY, ltp, req.quantity());
                wallet.setBalance(wallet.getBalance().subtract(execEst.netAmount()));
                walletRepository.save(wallet);

                upsertHoldingOnBuy(user, stock.getSymbol(), req.quantity(), ltp, req.stopLossPrice(), req.targetPrice());

                Order executed = orderRepository.save(Order.builder()
                        .user(user)
                        .symbol(stock.getSymbol())
                        .side(OrderSide.BUY)
                        .orderType(req.orderType())
                        .quantity(req.quantity())
                        .requestedPrice(ltp)
                        .limitPrice(req.limitPrice())
                        .executedPrice(ltp)
                        .status(OrderStatus.EXECUTED)
                        .triggerSource(triggerSource)
                        .stopLossPrice(req.stopLossPrice())
                        .targetPrice(req.targetPrice())
                        .charges(execEst.totalCharges())
                        .totalValue(execEst.turnover())
                        .executedAt(Instant.now())
                        .build());

                walletTransactionRepository.save(WalletTransaction.builder()
                        .user(user)
                        .type(TransactionType.TRADE_BUY)
                        .amount(execEst.netAmount().negate())
                        .balanceAfter(wallet.getBalance())
                        .description("Bought " + req.quantity() + " " + stock.getSymbol() + " @ ₹" + ltp)
                        .referenceId(String.valueOf(executed.getId()))
                        .build());

                saveNotification(user, "Buy Executed — " + stock.getSymbol(),
                        "Bought " + req.quantity() + " shares @ ₹" + ltp, "ORDER");

                return toDto(executed, stock.getLtp());
            } else {
                wallet.setBalance(wallet.getBalance().subtract(est.netAmount()));
                wallet.setBlockedMargin(wallet.getBlockedMargin().add(est.netAmount()));
                walletRepository.save(wallet);

                Order pending = orderRepository.save(Order.builder()
                        .user(user)
                        .symbol(stock.getSymbol())
                        .side(OrderSide.BUY)
                        .orderType(OrderType.LIMIT)
                        .quantity(req.quantity())
                        .requestedPrice(ltp)
                        .limitPrice(refPrice)
                        .status(OrderStatus.PENDING)
                        .triggerSource(triggerSource)
                        .stopLossPrice(req.stopLossPrice())
                        .targetPrice(req.targetPrice())
                        .charges(est.totalCharges())
                        .totalValue(est.turnover())
                        .build());
                return toDto(pending, stock.getLtp());
            }
        } else {
            Holding holding = holdingRepository.findByUserIdAndSymbolIgnoreCase(userId, stock.getSymbol()).orElse(null);
            int pendingSellQty = "MANUAL".equals(triggerSource)
                    ? orderRepository.findByUserIdAndSymbolAndSideAndStatus(userId, stock.getSymbol(), OrderSide.SELL, OrderStatus.PENDING)
                    .stream().mapToInt(Order::getQuantity).sum()
                    : 0;
            int availableQty = (holding == null ? 0 : holding.getQuantity()) - pendingSellQty;

            if (holding == null || availableQty < req.quantity()) {
                Order rejected = orderRepository.save(Order.builder()
                        .user(user)
                        .symbol(stock.getSymbol())
                        .side(OrderSide.SELL)
                        .orderType(req.orderType())
                        .quantity(req.quantity())
                        .requestedPrice(ltp)
                        .limitPrice(req.limitPrice())
                        .status(OrderStatus.REJECTED)
                        .rejectionReason("Insufficient sellable holdings (" + Math.max(0, availableQty) + " available)")
                        .triggerSource(triggerSource)
                        .charges(est.totalCharges())
                        .totalValue(est.turnover())
                        .build());
                return toDto(rejected, stock.getLtp());
            }

            if (executeNow) {
                ChargeEstimateDto execEst = calculateCharges(OrderSide.SELL, ltp, req.quantity());
                wallet.setBalance(wallet.getBalance().add(execEst.netAmount()));
                walletRepository.save(wallet);

                reduceHoldingOnSell(holding, req.quantity());

                Order executed = orderRepository.save(Order.builder()
                        .user(user)
                        .symbol(stock.getSymbol())
                        .side(OrderSide.SELL)
                        .orderType(req.orderType())
                        .quantity(req.quantity())
                        .requestedPrice(ltp)
                        .limitPrice(req.limitPrice())
                        .executedPrice(ltp)
                        .status(OrderStatus.EXECUTED)
                        .triggerSource(triggerSource)
                        .charges(execEst.totalCharges())
                        .totalValue(execEst.turnover())
                        .executedAt(Instant.now())
                        .build());

                walletTransactionRepository.save(WalletTransaction.builder()
                        .user(user)
                        .type(TransactionType.TRADE_SELL)
                        .amount(execEst.netAmount())
                        .balanceAfter(wallet.getBalance())
                        .description("Sold " + req.quantity() + " " + stock.getSymbol() + " @ ₹" + ltp)
                        .referenceId(String.valueOf(executed.getId()))
                        .build());

                saveNotification(user, "Sell Executed — " + stock.getSymbol(),
                        "Sold " + req.quantity() + " shares @ ₹" + ltp + ("MANUAL".equals(triggerSource) ? "" : " (" + triggerSource + ")"),
                        "MANUAL".equals(triggerSource) ? "ORDER" : "RISK");

                return toDto(executed, stock.getLtp());
            } else {
                Order pending = orderRepository.save(Order.builder()
                        .user(user)
                        .symbol(stock.getSymbol())
                        .side(OrderSide.SELL)
                        .orderType(OrderType.LIMIT)
                        .quantity(req.quantity())
                        .requestedPrice(ltp)
                        .limitPrice(refPrice)
                        .status(OrderStatus.PENDING)
                        .triggerSource(triggerSource)
                        .charges(est.totalCharges())
                        .totalValue(est.turnover())
                        .build());
                return toDto(pending, stock.getLtp());
            }
        }
    }

    @Transactional
    public OrderDto cancelOrder(Long userId, Long orderId) {
        Order order = orderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new ApiException("Order not found", HttpStatus.NOT_FOUND));
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new ApiException("Only PENDING orders can be cancelled", HttpStatus.BAD_REQUEST);
        }

        order.setStatus(OrderStatus.CANCELLED);
        if (order.getSide() == OrderSide.BUY && order.getLimitPrice() != null) {
            ChargeEstimateDto blocked = calculateCharges(OrderSide.BUY, order.getLimitPrice(), order.getQuantity());
            Wallet wallet = walletRepository.findByUserId(userId).orElseThrow();
            wallet.setBalance(wallet.getBalance().add(blocked.netAmount()));
            wallet.setBlockedMargin(wallet.getBlockedMargin().subtract(blocked.netAmount()).max(BigDecimal.ZERO));
            walletRepository.save(wallet);
        }
        orderRepository.save(order);
        double ltp = stockRepository.findBySymbolIgnoreCase(order.getSymbol()).map(Stock::getLtp).orElse(0.0);
        return toDto(order, ltp);
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderDto> listOrders(Long userId, String status, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(5, size)));
        Page<Order> result;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            OrderStatus st = OrderStatus.valueOf(status.trim().toUpperCase());
            result = orderRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, st, pageable);
        } else {
            result = orderRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        }

        List<OrderDto> items = result.getContent().stream().map(o -> {
            double ltp = stockRepository.findBySymbolIgnoreCase(o.getSymbol()).map(Stock::getLtp).orElse(0.0);
            return toDto(o, ltp);
        }).toList();

        return new PagedResponse<>(items, result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public void executeMatchingLimitOrder(Order pending, Stock stock) {
        BigDecimal execPrice = BigDecimal.valueOf(stock.getLtp()).setScale(2, RoundingMode.HALF_UP);
        User user = pending.getUser();
        Wallet wallet = walletRepository.findByUserId(user.getId()).orElse(null);
        if (wallet == null) return;

        if (pending.getSide() == OrderSide.BUY) {
            ChargeEstimateDto originallyBlocked = calculateCharges(OrderSide.BUY, pending.getLimitPrice(), pending.getQuantity());
            ChargeEstimateDto actual = calculateCharges(OrderSide.BUY, execPrice, pending.getQuantity());

            wallet.setBlockedMargin(wallet.getBlockedMargin().subtract(originallyBlocked.netAmount()).max(BigDecimal.ZERO));
            BigDecimal diff = originallyBlocked.netAmount().subtract(actual.netAmount());
            if (diff.compareTo(BigDecimal.ZERO) != 0) {
                wallet.setBalance(wallet.getBalance().add(diff));
            }
            walletRepository.save(wallet);

            upsertHoldingOnBuy(user, stock.getSymbol(), pending.getQuantity(), execPrice, pending.getStopLossPrice(), pending.getTargetPrice());

            pending.setStatus(OrderStatus.EXECUTED);
            pending.setExecutedPrice(execPrice);
            pending.setExecutedAt(Instant.now());
            pending.setTriggerSource("LIMIT_MATCH");
            pending.setCharges(actual.totalCharges());
            pending.setTotalValue(actual.turnover());
            orderRepository.save(pending);

            walletTransactionRepository.save(WalletTransaction.builder()
                    .user(user)
                    .type(TransactionType.TRADE_BUY)
                    .amount(actual.netAmount().negate())
                    .balanceAfter(wallet.getBalance())
                    .description("Limit Buy Filled: " + pending.getQuantity() + " " + stock.getSymbol() + " @ ₹" + execPrice)
                    .referenceId(String.valueOf(pending.getId()))
                    .build());

            saveNotification(user, "Limit Buy Filled — " + stock.getSymbol(),
                    "Filled " + pending.getQuantity() + " @ ₹" + execPrice, "ORDER");
        } else {
            Holding holding = holdingRepository.findByUserIdAndSymbolIgnoreCase(user.getId(), stock.getSymbol()).orElse(null);
            if (holding == null || holding.getQuantity() < pending.getQuantity()) {
                pending.setStatus(OrderStatus.REJECTED);
                pending.setRejectionReason("Holdings unavailable when limit triggered");
                orderRepository.save(pending);
                return;
            }
            ChargeEstimateDto actual = calculateCharges(OrderSide.SELL, execPrice, pending.getQuantity());
            wallet.setBalance(wallet.getBalance().add(actual.netAmount()));
            walletRepository.save(wallet);

            reduceHoldingOnSell(holding, pending.getQuantity());

            pending.setStatus(OrderStatus.EXECUTED);
            pending.setExecutedPrice(execPrice);
            pending.setExecutedAt(Instant.now());
            pending.setTriggerSource("LIMIT_MATCH");
            pending.setCharges(actual.totalCharges());
            pending.setTotalValue(actual.turnover());
            orderRepository.save(pending);

            walletTransactionRepository.save(WalletTransaction.builder()
                    .user(user)
                    .type(TransactionType.TRADE_SELL)
                    .amount(actual.netAmount())
                    .balanceAfter(wallet.getBalance())
                    .description("Limit Sell Filled: " + pending.getQuantity() + " " + stock.getSymbol() + " @ ₹" + execPrice)
                    .referenceId(String.valueOf(pending.getId()))
                    .build());

            saveNotification(user, "Limit Sell Filled — " + stock.getSymbol(),
                    "Sold " + pending.getQuantity() + " @ ₹" + execPrice, "ORDER");
        }
    }

    private void upsertHoldingOnBuy(User user, String symbol, int qty, BigDecimal execPrice, BigDecimal sl, BigDecimal tp) {
        Holding existing = holdingRepository.findByUserIdAndSymbolIgnoreCase(user.getId(), symbol).orElse(null);
        if (existing != null) {
            BigDecimal prevCost = existing.getAvgBuyPrice().multiply(BigDecimal.valueOf(existing.getQuantity()));
            BigDecimal addCost = execPrice.multiply(BigDecimal.valueOf(qty));
            int newQty = existing.getQuantity() + qty;
            BigDecimal newAvg = prevCost.add(addCost).divide(BigDecimal.valueOf(newQty), 2, RoundingMode.HALF_UP);
            existing.setQuantity(newQty);
            existing.setAvgBuyPrice(newAvg);
            existing.setInvestedAmount(newAvg.multiply(BigDecimal.valueOf(newQty)).setScale(2, RoundingMode.HALF_UP));
            if (sl != null && sl.compareTo(BigDecimal.ZERO) > 0) existing.setStopLossPrice(sl);
            if (tp != null && tp.compareTo(BigDecimal.ZERO) > 0) existing.setTargetPrice(tp);
            existing.setUpdatedAt(Instant.now());
            holdingRepository.save(existing);
        } else {
            holdingRepository.save(Holding.builder()
                    .user(user)
                    .symbol(symbol)
                    .quantity(qty)
                    .avgBuyPrice(execPrice)
                    .investedAmount(execPrice.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP))
                    .stopLossPrice(sl != null && sl.compareTo(BigDecimal.ZERO) > 0 ? sl : null)
                    .targetPrice(tp != null && tp.compareTo(BigDecimal.ZERO) > 0 ? tp : null)
                    .build());
        }
    }

    private void reduceHoldingOnSell(Holding holding, int qty) {
        int rem = holding.getQuantity() - qty;
        if (rem <= 0) {
            holdingRepository.delete(holding);
        } else {
            holding.setQuantity(rem);
            holding.setInvestedAmount(holding.getAvgBuyPrice().multiply(BigDecimal.valueOf(rem)).setScale(2, RoundingMode.HALF_UP));
            holding.setUpdatedAt(Instant.now());
            holdingRepository.save(holding);
        }
    }

    private void saveNotification(User user, String title, String msg, String category) {
        notificationRepository.save(Notification.builder()
                .user(user)
                .title(title)
                .message(msg)
                .category(category)
                .build());
    }

    private OrderDto toDto(Order o, double currentLtp) {
        return new OrderDto(
                o.getId(),
                o.getSymbol(),
                o.getSide(),
                o.getOrderType(),
                o.getQuantity(),
                o.getRequestedPrice(),
                o.getLimitPrice(),
                o.getExecutedPrice(),
                currentLtp,
                o.getStatus(),
                o.getRejectionReason(),
                o.getTriggerSource(),
                o.getStopLossPrice(),
                o.getTargetPrice(),
                o.getCharges(),
                o.getTotalValue(),
                o.getCreatedAt(),
                o.getExecutedAt()
        );
    }
}
