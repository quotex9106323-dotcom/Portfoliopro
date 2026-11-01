package com.portfoliopro.repository;

import com.portfoliopro.entity.Order;
import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderStatus;
import com.portfoliopro.entity.enums.OrderType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<Order> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, OrderStatus status, Pageable pageable);
    List<Order> findByUserIdAndStatusOrderByCreatedAtAsc(Long userId, OrderStatus status);
    List<Order> findByStatusAndOrderType(OrderStatus status, OrderType orderType);
    List<Order> findByUserIdAndSymbolAndSideAndStatus(Long userId, String symbol, OrderSide side, OrderStatus status);
    Optional<Order> findByIdAndUserId(Long id, Long userId);
}
