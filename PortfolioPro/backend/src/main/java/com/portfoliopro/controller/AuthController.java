package com.portfoliopro.controller;

import com.portfoliopro.dto.ApiResponse;
import com.portfoliopro.dto.AuthDtos.*;
import com.portfoliopro.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(
            AuthService authService
    ) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Account created", authService.register(req)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(req)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refresh(req)));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> logout(@RequestBody(required = false) Map<String, String> body) {
        authService.logout(body != null ? body.get("refreshToken") : null);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("loggedOut", true)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> me(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(authService.getCurrentUser(userId)));
    }

    @PutMapping("/theme")
    public ResponseEntity<ApiResponse<UserDto>> updateTheme(
            Authentication auth,
            @Valid @RequestBody ThemeRequest req
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(authService.updateTheme(userId, req.theme())));
    }
}
