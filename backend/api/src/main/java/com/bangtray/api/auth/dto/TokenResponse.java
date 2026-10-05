package com.bangtray.api.auth.dto;

public record TokenResponse(
		String accessToken,
		String refreshToken,
		Long userId,
		String nickname
) {
}
