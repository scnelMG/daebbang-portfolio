package com.bangtray.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 구글 로그인 설정 (application.yml google.*).
 * ID 토큰 검증 방식이라 클라이언트 시크릿은 필요 없고, aud 검사용 클라이언트 ID만 쓴다.
 * 값이 비어 있으면 /api/auth/google 이 SOCIAL_NOT_CONFIGURED 로 응답한다 (키 대기 중 상태).
 */
@ConfigurationProperties(prefix = "google")
public record GoogleProperties(String clientId) {
}
