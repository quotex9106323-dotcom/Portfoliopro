package com.portfoliopro.repository;

import com.portfoliopro.entity.PriceAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PriceAlertRepository extends JpaRepository<PriceAlert, Long> {
    List<PriceAlert> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<PriceAlert> findByTriggeredFalse();
    Optional<PriceAlert> findByIdAndUserId(Long id, Long userId);
}
