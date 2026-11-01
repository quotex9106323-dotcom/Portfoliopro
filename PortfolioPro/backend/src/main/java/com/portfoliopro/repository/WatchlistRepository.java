package com.portfoliopro.repository;

import com.portfoliopro.entity.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface WatchlistRepository extends JpaRepository<Watchlist, Long> {
    List<Watchlist> findByUserIdOrderByCreatedAtAsc(Long userId);
    Optional<Watchlist> findByIdAndUserId(Long id, Long userId);
}
