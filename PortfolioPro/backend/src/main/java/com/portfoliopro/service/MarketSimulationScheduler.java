package com.portfoliopro.service;

import com.portfoliopro.dto.MarketDtos.TickEventDto;
import com.portfoliopro.dto.OrderDtos.PlaceOrderRequest;
import com.portfoliopro.entity.Holding;
import com.portfoliopro.entity.Notification;
import com.portfoliopro.entity.Order;
import com.portfoliopro.entity.PriceAlert;
import com.portfoliopro.entity.Stock;
import com.portfoliopro.entity.enums.AlertCondition;
import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.entity.enums.OrderType;
import com.portfoliopro.repository.HoldingRepository;
import com.portfoliopro.repository.NotificationRepository;
import com.portfoliopro.repository.OrderRepository;
import com.portfoliopro.repository.PriceAlertRepository;
import com.portfoliopro.repository.StockRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class MarketSimulationScheduler {

    private final StockRepository stockRepository;
    private final OrderRepository orderRepository;
    private final HoldingRepository holdingRepository;
    private final PriceAlertRepository priceAlertRepository;
    private final NotificationRepository notificationRepository;
    private final MarketDataService marketDataService;
    private final TradeService tradeService;
    private final SimpMessagingTemplate messagingTemplate;

    public MarketSimulationScheduler(
            StockRepository stockRepository,
            OrderRepository orderRepository,
            HoldingRepository holdingRepository,
            PriceAlertRepository priceAlertRepository,
            NotificationRepository notificationRepository,
            MarketDataService marketDataService,
            TradeService tradeService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stockRepository = stockRepository;
        this.orderRepository = orderRepository;
        this.holdingRepository = holdingRepository;
        this.priceAlertRepository = priceAlertRepository;
        this.notificationRepository = notificationRepository;
        this.marketDataService = marketDataService;
        this.tradeService = tradeService;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedDelay = 1500, initialDelay = 3000)
    public void simulateMarketTick() {
        List<Stock> stocks = stockRepository.findAll();
        if (stocks.isEmpty()) return;

        ThreadLocalRandom rng = ThreadLocalRandom.current();
        double marketPulse = (rng.nextDouble() - 0.498) * 0.0008;
        List<TickEventDto> tickEvents = new ArrayList<>(stocks.size());

        for (Stock s : stocks) {
            double sigma = (s.getAnnualVolatility() / 0.21) * 0.0019;
            double shock = (rng.nextDouble() + rng.nextDouble() + rng.nextDouble() - 1.5) * sigma + marketPulse * s.getBeta();
            double revert = ((s.getBasePrice() - s.getLtp()) / s.getBasePrice()) * 0.004;
            double next = Math.max(5.0, round2(s.getLtp() * (1.0 + shock + revert)));
            String dir = next > s.getLtp() ? "UP" : (next < s.getLtp() ? "DOWN" : "FLAT");

            s.setLtp(next);
            s.setDayHigh(Math.max(s.getDayHigh(), next));
            s.setDayLow(Math.min(s.getDayLow(), next));
            s.setVolume(s.getVolume() + rng.nextLong(60, 720));

            double chg = round2(next - s.getPrevClose());
            double chgPct = s.getPrevClose() > 0 ? round2((chg / s.getPrevClose()) * 100.0) : 0.0;
            marketDataService.updateSparkline(s.getSymbol(), next);

            tickEvents.add(new TickEventDto(
                    s.getSymbol(), next, chg, chgPct, s.getDayHigh(), s.getDayLow(), s.getVolume(), dir
            ));
        }
        stockRepository.saveAll(stocks);

        // 1. Auto-Execute Pending Limit Orders
        List<Order> pendingLimits = orderRepository.findByStatusAndOrderType(OrderStatus.PENDING, OrderType.LIMIT);
        for (Order ord : pendingLimits) {
            stockRepository.findBySymbolIgnoreCase(ord.getSymbol()).ifPresent(st -> {
                BigDecimal ltp = BigDecimal.valueOf(st.getLtp());
                boolean hitBuy = ord.getSide() == OrderSide.BUY && ord.getLimitPrice() != null && ltp.compareTo(ord.getLimitPrice()) <= 0;
                boolean hitSell = ord.getSide() == OrderSide.SELL && ord.getLimitPrice() != null && ltp.compareTo(ord.getLimitPrice()) >= 0;
                if (hitBuy || hitSell) {
                    tradeService.executeMatchingLimitOrder(ord, st);
                    messagingTemplate.convertAndSend("/topic/user/" + ord.getUser().getId(),
                            Map.of("eventType", "ORDER_EXECUTED", "symbol", ord.getSymbol()));
                }
            });
        }

        // 2. Auto-Trigger Position Stop-Loss and Target
        List<Holding> allHoldings = holdingRepository.findAll();
        for (Holding h : allHoldings) {
            stockRepository.findBySymbolIgnoreCase(h.getSymbol()).ifPresent(st -> {
                BigDecimal ltp = BigDecimal.valueOf(st.getLtp());
                if (h.getStopLossPrice() != null && ltp.compareTo(h.getStopLossPrice()) <= 0) {
                    tradeService.placeOrder(h.getUser().getId(),
                            new PlaceOrderRequest(h.getSymbol(), OrderSide.SELL, OrderType.MARKET, h.getQuantity(), null, null, null),
                            "STOP_LOSS");
                    messagingTemplate.convertAndSend("/topic/user/" + h.getUser().getId(),
                            Map.of("eventType", "RISK_TRIGGERED", "trigger", "STOP_LOSS", "symbol", h.getSymbol()));
                } else if (h.getTargetPrice() != null && ltp.compareTo(h.getTargetPrice()) >= 0) {
                    tradeService.placeOrder(h.getUser().getId(),
                            new PlaceOrderRequest(h.getSymbol(), OrderSide.SELL, OrderType.MARKET, h.getQuantity(), null, null, null),
                            "TARGET");
                    messagingTemplate.convertAndSend("/topic/user/" + h.getUser().getId(),
                            Map.of("eventType", "RISK_TRIGGERED", "trigger", "TARGET", "symbol", h.getSymbol()));
                }
            });
        }

        // 3. Evaluate Armed Price Alerts
        List<PriceAlert> armedAlerts = priceAlertRepository.findByTriggeredFalse();
        for (PriceAlert alert : armedAlerts) {
            stockRepository.findBySymbolIgnoreCase(alert.getSymbol()).ifPresent(st -> {
                BigDecimal ltp = BigDecimal.valueOf(st.getLtp());
                boolean hit = (alert.getConditionType() == AlertCondition.ABOVE && ltp.compareTo(alert.getTargetPrice()) >= 0)
                        || (alert.getConditionType() == AlertCondition.BELOW && ltp.compareTo(alert.getTargetPrice()) <= 0);
                if (hit) {
                    alert.setTriggered(true);
                    alert.setTriggeredAt(Instant.now());
                    priceAlertRepository.save(alert);

                    notificationRepository.save(Notification.builder()
                            .user(alert.getUser())
                            .title("Price Alert Hit — " + alert.getSymbol())
                            .message(alert.getSymbol() + " crossed ₹" + alert.getTargetPrice() + " (LTP ₹" + st.getLtp() + ")")
                            .category("ALERT")
                            .build());

                    messagingTemplate.convertAndSend("/topic/user/" + alert.getUser().getId(),
                            Map.of("eventType", "ALERT_TRIGGERED", "symbol", alert.getSymbol()));
                }
            });
        }

        // Broadcast STOMP live ticks & index updates
        messagingTemplate.convertAndSend("/topic/ticks", tickEvents);
        messagingTemplate.convertAndSend("/topic/indices", marketDataService.computeIndices());
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
