package com.portfoliopro.repository;

import com.portfoliopro.entity.OhlcvCandle;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OhlcvCandleRepository extends JpaRepository<OhlcvCandle, Long> {
    List<OhlcvCandle> findBySymbolAndTimeframeOrderByEpochSecAsc(String symbol, String timeframe);
}
