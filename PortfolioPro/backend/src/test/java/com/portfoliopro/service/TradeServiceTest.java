package com.portfoliopro.service;

import com.portfoliopro.dto.OrderDtos.ChargeEstimateDto;
import com.portfoliopro.dto.OrderDtos.OrderDto;
import com.portfoliopro.dto.OrderDtos.PlaceOrderRequest;
import com.portfoliopro.entity.Order;
import com.portfoliopro.entity.Stock;
import com.portfoliopro.entity.User;
import com.portfoliopro.entity.Wallet;
import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.entity.enums.OrderType;
import com.portfoliopro.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TradeServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private StockRepository stockRepository;
    @Mock private WalletRepository walletRepository;
    @Mock private WalletTransactionRepository walletTransactionRepository;
    @Mock private HoldingRepository holdingRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private NotificationRepository notificationRepository;

    @InjectMocks
    private TradeService tradeService;

    private User demoUser;
    private Stock reliance;
    private Wallet wallet;

    @BeforeEach
    void setUp() {
        demoUser = User.builder().id(1L).fullName("Aarav Mehta").email("demo@portfoliopro.in").build();
        reliance = Stock.builder().id(1L).symbol("RELIANCE").name("Reliance Industries").ltp(2500.00).basePrice(2500.00).prevClose(2480.00).build();
        wallet = Wallet.builder().id(1L).user(demoUser).balance(new BigDecimal("100000.00")).blockedMargin(BigDecimal.ZERO).build();
    }

    @Test
    void calculateCharges_capsBrokerageAtTwentyRupees() {
        ChargeEstimateDto est = tradeService.calculateCharges(OrderSide.BUY, new BigDecimal("2500.00"), 100);
        assertEquals(new BigDecimal("250000.00"), est.turnover());
        assertEquals(new BigDecimal("20.00"), est.brokerage());
        assertTrue(est.totalCharges().compareTo(new BigDecimal("20.00")) > 0);
        assertEquals(est.turnover().add(est.totalCharges()), est.netAmount());
    }

    @Test
    void placeMarketBuyOrder_executesAndDebitsWallet() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(demoUser));
        when(stockRepository.findBySymbolIgnoreCase("RELIANCE")).thenReturn(Optional.of(reliance));
        when(walletRepository.findByUserId(1L)).thenReturn(Optional.of(wallet));
        when(holdingRepository.findByUserIdAndSymbolIgnoreCase(1L, "RELIANCE")).thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(99L);
            return o;
        });

        PlaceOrderRequest req = new PlaceOrderRequest("RELIANCE", OrderSide.BUY, OrderType.MARKET, 10, null, null, null);
        OrderDto result = tradeService.placeOrder(1L, req, "MANUAL");

        assertEquals(OrderStatus.EXECUTED, result.status());
        assertEquals(new BigDecimal("2500.00"), result.executedPrice());
        assertTrue(wallet.getBalance().compareTo(new BigDecimal("75000.00")) < 0);
        verify(holdingRepository, times(1)).save(any());
    }

    @Test
    void placeMarketBuyOrder_rejectsWhenBalanceInsufficient() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(demoUser));
        when(stockRepository.findBySymbolIgnoreCase("RELIANCE")).thenReturn(Optional.of(reliance));
        when(walletRepository.findByUserId(1L)).thenReturn(Optional.of(wallet));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        PlaceOrderRequest req = new PlaceOrderRequest("RELIANCE", OrderSide.BUY, OrderType.MARKET, 100, null, null, null);
        OrderDto result = tradeService.placeOrder(1L, req, "MANUAL");

        assertEquals(OrderStatus.REJECTED, result.status());
        assertNotNull(result.rejectionReason());
        assertEquals(new BigDecimal("100000.00"), wallet.getBalance());
    }
}
