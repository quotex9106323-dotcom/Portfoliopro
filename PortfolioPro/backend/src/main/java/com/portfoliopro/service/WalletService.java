package com.portfoliopro.service;

import com.portfoliopro.dto.PortfolioDtos.WalletActionRequest;
import com.portfoliopro.entity.User;
import com.portfoliopro.entity.Wallet;
import com.portfoliopro.entity.WalletTransaction;
import com.portfoliopro.entity.enums.TransactionType;
import com.portfoliopro.exception.ApiException;
import com.portfoliopro.repository.UserRepository;
import com.portfoliopro.repository.WalletRepository;
import com.portfoliopro.repository.WalletTransactionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Service
public class WalletService {

    private final WalletRepository walletRepository;
    private final WalletTransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public WalletService(
            WalletRepository walletRepository,
            WalletTransactionRepository transactionRepository,
            UserRepository userRepository
    ) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getWalletSummary(Long userId, int page, int size) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException("Wallet not found", HttpStatus.NOT_FOUND));
        Page<WalletTransaction> txns = transactionRepository.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(Math.max(0, page), Math.min(100, Math.max(5, size)))
        );

        return Map.of(
                "wallet", Map.of(
                        "userId", userId,
                        "balance", wallet.getBalance(),
                        "blockedMargin", wallet.getBlockedMargin(),
                        "totalDeposited", wallet.getTotalDeposited(),
                        "totalWithdrawn", wallet.getTotalWithdrawn()
                ),
                "transactions", txns.getContent(),
                "page", txns.getNumber(),
                "size", txns.getSize(),
                "totalElements", txns.getTotalElements(),
                "totalPages", txns.getTotalPages()
        );
    }

    @Transactional
    public Map<String, Object> deposit(Long userId, WalletActionRequest req) {
        if (req.amount() == null || req.amount().compareTo(new BigDecimal("100")) < 0) {
            throw new ApiException("Minimum deposit is ₹100", HttpStatus.BAD_REQUEST);
        }
        User user = userRepository.findById(userId).orElseThrow();
        Wallet wallet = walletRepository.findByUserId(userId).orElseThrow();
        BigDecimal amt = req.amount().setScale(2, RoundingMode.HALF_UP);

        wallet.setBalance(wallet.getBalance().add(amt));
        wallet.setTotalDeposited(wallet.getTotalDeposited().add(amt));
        walletRepository.save(wallet);

        WalletTransaction txn = transactionRepository.save(WalletTransaction.builder()
                .user(user)
                .type(TransactionType.DEPOSIT)
                .amount(amt)
                .balanceAfter(wallet.getBalance())
                .description(req.note() != null && !req.note().isBlank() ? req.note().trim() : "Instant Virtual UPI Deposit")
                .build());

        return Map.of("wallet", wallet, "transaction", txn);
    }

    @Transactional
    public Map<String, Object> withdraw(Long userId, WalletActionRequest req) {
        if (req.amount() == null || req.amount().compareTo(new BigDecimal("100")) < 0) {
            throw new ApiException("Minimum withdrawal is ₹100", HttpStatus.BAD_REQUEST);
        }
        User user = userRepository.findById(userId).orElseThrow();
        Wallet wallet = walletRepository.findByUserId(userId).orElseThrow();
        BigDecimal amt = req.amount().setScale(2, RoundingMode.HALF_UP);

        if (wallet.getBalance().compareTo(amt) < 0) {
            throw new ApiException("Insufficient withdrawable balance (₹" + wallet.getBalance() + ")", HttpStatus.BAD_REQUEST);
        }

        wallet.setBalance(wallet.getBalance().subtract(amt));
        wallet.setTotalWithdrawn(wallet.getTotalWithdrawn().add(amt));
        walletRepository.save(wallet);

        WalletTransaction txn = transactionRepository.save(WalletTransaction.builder()
                .user(user)
                .type(TransactionType.WITHDRAWAL)
                .amount(amt.negate())
                .balanceAfter(wallet.getBalance())
                .description(req.note() != null && !req.note().isBlank() ? req.note().trim() : "Bank Settlement Payout")
                .build());

        return Map.of("wallet", wallet, "transaction", txn);
    }
}
