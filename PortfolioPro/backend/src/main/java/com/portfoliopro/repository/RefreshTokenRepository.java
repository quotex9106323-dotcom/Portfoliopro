package com.portfoliopro.repository;

import com.portfoliopro.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    void deleteByToken(String token);
    void deleteByExpiresAtBefore(Instant cutoff);
}
