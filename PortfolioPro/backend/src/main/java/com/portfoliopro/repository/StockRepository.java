package com.portfoliopro.repository;

import com.portfoliopro.entity.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface StockRepository extends JpaRepository<Stock, Long> {
    Optional<Stock> findBySymbolIgnoreCase(String symbol);
    List<Stock> findBySectorIgnoreCase(String sector);
}
