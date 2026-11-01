package com.portfoliopro.repository;

import com.portfoliopro.entity.Holding;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface HoldingRepository extends JpaRepository<Holding, Long> {
    List<Holding> findByUserId(Long userId);
    Optional<Holding> findByUserIdAndSymbolIgnoreCase(Long userId, String symbol);
}
