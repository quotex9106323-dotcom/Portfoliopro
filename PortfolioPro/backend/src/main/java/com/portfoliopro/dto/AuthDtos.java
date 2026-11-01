package com.portfoliopro.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record RegisterRequest(
            @NotBlank(message = "Full name is required")
            @Size(min = 2, max = 120, message = "Full name must be 2 to 120 characters")
            String fullName,

            @NotBlank(message = "Email is required")
            @Email(message = "Enter a valid email address")
            String email,

            @NotBlank(message = "Password is required")
            @Size(min = 6, max = 100, message = "Password must be at least 6 characters")
            String password
    ) {}

    public record LoginRequest(
            @NotBlank(message = "Email is required")
            @Email(message = "Enter a valid email address")
            String email,

            @NotBlank(message = "Password is required")
            String password
    ) {}

    public record RefreshRequest(
            @NotBlank(message = "Refresh token is required")
            String refreshToken
    ) {}

    public record ThemeRequest(
            @NotBlank(message = "Theme is required")
            String theme
    ) {}

    public record UserDto(
            Long id,
            String fullName,
            String email,
            String theme
    ) {}

    public record AuthResponse(
            UserDto user,
            String accessToken,
            String refreshToken
    ) {}
}
