package com.portfoliopro.service;

import com.portfoliopro.dto.AuthDtos.*;
import com.portfoliopro.entity.RefreshToken;
import com.portfoliopro.entity.User;
import com.portfoliopro.entity.Wallet;
import com.portfoliopro.entity.WalletTransaction;
import com.portfoliopro.entity.Watchlist;
import com.portfoliopro.entity.enums.TransactionType;
import com.portfoliopro.exception.ApiException;
import com.portfoliopro.repository.RefreshTokenRepository;
import com.portfoliopro.repository.UserRepository;
import com.portfoliopro.repository.WalletRepository;
import com.portfoliopro.repository.WalletTransactionRepository;
import com.portfoliopro.repository.WatchlistRepository;
import com.portfoliopro.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final WatchlistRepository watchlistRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(
            UserRepository userRepository,
            WalletRepository walletRepository,
            WalletTransactionRepository walletTransactionRepository,
            WatchlistRepository watchlistRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider
    ) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.watchlistRepository = watchlistRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Value("${app.wallet.initial-balance:1000000.00}")
    private BigDecimal initialWalletBalance;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException("An account with this email already exists", HttpStatus.CONFLICT);
        }

        User user = userRepository.save(User.builder()
                .fullName(req.fullName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(req.password()))
                .theme("dark")
                .build());

        Wallet wallet = walletRepository.save(Wallet.builder()
                .user(user)
                .balance(initialWalletBalance)
                .blockedMargin(BigDecimal.ZERO)
                .totalDeposited(initialWalletBalance)
                .totalWithdrawn(BigDecimal.ZERO)
                .build());

        walletTransactionRepository.save(WalletTransaction.builder()
                .user(user)
                .type(TransactionType.DEPOSIT)
                .amount(wallet.getBalance())
                .balanceAfter(wallet.getBalance())
                .description("Welcome Virtual Trading Capital (₹10,00,000)")
                .build());

        watchlistRepository.save(Watchlist.builder()
                .user(user)
                .name("Core Watchlist")
                .symbols(new ArrayList<>(List.of("RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "TATAMOTORS")))
                .build());

        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmailIgnoreCase(req.email().trim())
                .orElseThrow(() -> new ApiException("Invalid email or password", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ApiException("Invalid email or password", HttpStatus.UNAUTHORIZED);
        }
        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest req) {
        RefreshToken stored = refreshTokenRepository.findByToken(req.refreshToken())
                .orElseThrow(() -> new ApiException("Refresh token revoked or unknown", HttpStatus.UNAUTHORIZED));

        if (stored.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(stored);
            throw new ApiException("Refresh token expired", HttpStatus.UNAUTHORIZED);
        }

        Long userId = jwtTokenProvider.validateAndExtractUserIdFromRefresh(req.refreshToken());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));

        refreshTokenRepository.delete(stored);
        return buildAuthResponse(user);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenRepository.deleteByToken(refreshToken);
        }
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));
        return new UserDto(u.getId(), u.getFullName(), u.getEmail(), u.getTheme());
    }

    @Transactional
    public UserDto updateTheme(Long userId, String theme) {
        if (!"light".equals(theme) && !"dark".equals(theme)) {
            throw new ApiException("Theme must be light or dark", HttpStatus.BAD_REQUEST);
        }
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));
        u.setTheme(theme);
        userRepository.save(u);
        return new UserDto(u.getId(), u.getFullName(), u.getEmail(), u.getTheme());
    }

    private AuthResponse buildAuthResponse(User user) {
        refreshTokenRepository.deleteByExpiresAtBefore(Instant.now());
        String access = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refresh = jwtTokenProvider.generateRefreshToken(user.getId());

        refreshTokenRepository.save(RefreshToken.builder()
                .token(refresh)
                .user(user)
                .expiresAt(Instant.now().plusMillis(jwtTokenProvider.getRefreshExpirationMs()))
                .build());

        return new AuthResponse(
                new UserDto(user.getId(), user.getFullName(), user.getEmail(), user.getTheme()),
                access,
                refresh
        );
    }
}
