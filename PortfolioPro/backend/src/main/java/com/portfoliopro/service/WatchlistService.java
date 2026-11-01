package com.portfoliopro.service;

import com.portfoliopro.dto.MarketDtos.StockQuoteDto;
import com.portfoliopro.dto.WatchlistDtos.*;
import com.portfoliopro.entity.PriceAlert;
import com.portfoliopro.entity.Stock;
import com.portfoliopro.entity.User;
import com.portfoliopro.entity.Watchlist;
import com.portfoliopro.exception.ApiException;
import com.portfoliopro.repository.PriceAlertRepository;
import com.portfoliopro.repository.StockRepository;
import com.portfoliopro.repository.UserRepository;
import com.portfoliopro.repository.WatchlistRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.util.*;

@Service
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;
    private final PriceAlertRepository priceAlertRepository;
    private final StockRepository stockRepository;
    private final UserRepository userRepository;
    private final MarketDataService marketDataService;

    public WatchlistService(
            WatchlistRepository watchlistRepository,
            PriceAlertRepository priceAlertRepository,
            StockRepository stockRepository,
            UserRepository userRepository,
            MarketDataService marketDataService
    ) {
        this.watchlistRepository = watchlistRepository;
        this.priceAlertRepository = priceAlertRepository;
        this.stockRepository = stockRepository;
        this.userRepository = userRepository;
        this.marketDataService = marketDataService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUserWatchlistsAndAlerts(Long userId) {
        List<WatchlistDto> lists = watchlistRepository.findByUserIdOrderByCreatedAtAsc(userId).stream()
                .map(this::toWatchlistDto)
                .toList();

        List<PriceAlertDto> alerts = priceAlertRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(a -> {
                    double ltp = stockRepository.findBySymbolIgnoreCase(a.getSymbol()).map(Stock::getLtp).orElse(0.0);
                    return new PriceAlertDto(a.getId(), a.getSymbol(), a.getConditionType(),
                            a.getTargetPrice(), ltp, a.isTriggered(), a.getCreatedAt(), a.getTriggeredAt());
                })
                .toList();

        return Map.of("watchlists", lists, "alerts", alerts);
    }

    @Transactional
    public WatchlistDto createWatchlist(Long userId, CreateWatchlistRequest req) {
        User user = userRepository.findById(userId).orElseThrow();
        Watchlist wl = watchlistRepository.save(Watchlist.builder()
                .user(user)
                .name(req.name().trim())
                .symbols(new ArrayList<>())
                .build());
        return toWatchlistDto(wl);
    }

    @Transactional
    public void deleteWatchlist(Long userId, Long id) {
        List<Watchlist> all = watchlistRepository.findByUserIdOrderByCreatedAtAsc(userId);
        if (all.size() <= 1) {
            throw new ApiException("At least one watchlist must remain", HttpStatus.BAD_REQUEST);
        }
        Watchlist wl = watchlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException("Watchlist not found", HttpStatus.NOT_FOUND));
        watchlistRepository.delete(wl);
    }

    @Transactional
    public WatchlistDto addSymbol(Long userId, Long id, String symbol) {
        Stock st = stockRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new ApiException("Stock not found: " + symbol, HttpStatus.NOT_FOUND));
        Watchlist wl = watchlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException("Watchlist not found", HttpStatus.NOT_FOUND));

        if (!wl.getSymbols().contains(st.getSymbol())) {
            wl.getSymbols().add(st.getSymbol());
            watchlistRepository.save(wl);
        }
        return toWatchlistDto(wl);
    }

    @Transactional
    public WatchlistDto removeSymbol(Long userId, Long id, String symbol) {
        Watchlist wl = watchlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException("Watchlist not found", HttpStatus.NOT_FOUND));
        wl.getSymbols().removeIf(s -> s.equalsIgnoreCase(symbol));
        watchlistRepository.save(wl);
        return toWatchlistDto(wl);
    }

    @Transactional
    public WatchlistDto reorder(Long userId, Long id, List<String> symbols) {
        Watchlist wl = watchlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException("Watchlist not found", HttpStatus.NOT_FOUND));
        List<String> valid = symbols.stream()
                .map(s -> s.trim().toUpperCase())
                .distinct()
                .filter(s -> stockRepository.findBySymbolIgnoreCase(s).isPresent())
                .toList();
        wl.setSymbols(new ArrayList<>(valid));
        watchlistRepository.save(wl);
        return toWatchlistDto(wl);
    }

    @Transactional
    public PriceAlertDto createAlert(Long userId, CreateAlertRequest req) {
        Stock st = stockRepository.findBySymbolIgnoreCase(req.symbol())
                .orElseThrow(() -> new ApiException("Stock not found", HttpStatus.NOT_FOUND));
        User user = userRepository.findById(userId).orElseThrow();

        PriceAlert alert = priceAlertRepository.save(PriceAlert.builder()
                .user(user)
                .symbol(st.getSymbol())
                .conditionType(req.condition())
                .targetPrice(req.targetPrice().setScale(2, RoundingMode.HALF_UP))
                .triggered(false)
                .build());

        return new PriceAlertDto(alert.getId(), alert.getSymbol(), alert.getConditionType(),
                alert.getTargetPrice(), st.getLtp(), false, alert.getCreatedAt(), null);
    }

    @Transactional
    public void deleteAlert(Long userId, Long alertId) {
        PriceAlert alert = priceAlertRepository.findByIdAndUserId(alertId, userId)
                .orElseThrow(() -> new ApiException("Alert not found", HttpStatus.NOT_FOUND));
        priceAlertRepository.delete(alert);
    }

    private WatchlistDto toWatchlistDto(Watchlist wl) {
        List<StockQuoteDto> items = wl.getSymbols().stream()
                .map(sym -> stockRepository.findBySymbolIgnoreCase(sym).map(marketDataService::toQuoteDto).orElse(null))
                .filter(Objects::nonNull)
                .toList();
        return new WatchlistDto(wl.getId(), wl.getName(), wl.getSymbols(), items);
    }
}
