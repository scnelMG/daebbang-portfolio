package com.bangtray.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml jwt.* — secret은 운영에서 반드시 환경변수(JWT_SECRET)로 주입 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
		String secret,              // HS256 — 32바이트 이상
		long accessValidityMs,      // 액세스 토큰 유효기간
		long refreshValidityMs      // 리프레시 토큰 유효기간
) {
}
