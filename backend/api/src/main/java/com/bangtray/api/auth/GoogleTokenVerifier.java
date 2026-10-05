package com.bangtray.api.auth;

import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 구글 ID 토큰 검증 — 서명(구글 공개키, 자동 갱신)·aud(우리 클라이언트 ID)·iss·만료를 라이브러리가 검사한다.
 * 프론트가 구글 로그인 버튼으로 받은 ID 토큰을 그대로 넘겨주는 방식이라 서버 세션·리다이렉트가 없다.
 */
@Component
@Slf4j
public class GoogleTokenVerifier {

	private final GoogleProperties properties;
	private final GoogleIdTokenVerifier verifier;

	public GoogleTokenVerifier(GoogleProperties properties) {
		this.properties = properties;
		this.verifier = isConfigured()
				? new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
						.setAudience(List.of(properties.clientId()))
						.build()
				: null;
	}

	/** 검증된 구글 계정 정보. sub = 구글이 보장하는 불변 식별자 → users.provider_id */
	public record GoogleAccount(String sub, String email, String name) {
	}

	public boolean isConfigured() {
		return properties.clientId() != null && !properties.clientId().isBlank();
	}

	public GoogleAccount verify(String idToken) {
		if (!isConfigured()) {
			throw new BusinessException(ErrorCode.SOCIAL_NOT_CONFIGURED);
		}
		GoogleIdToken token;
		try {
			token = verifier.verify(idToken);
		} catch (GeneralSecurityException | IOException | RuntimeException e) {
			// 검증 실패 원인은 항상 클라이언트가 보낸 토큰이므로 500이 아니라 401로 응답한다.
			// RuntimeException까지 잡는 이유: 필수 클레임이 빠진 변형 토큰에 라이브러리가
			// NullPointerException을 던지는 사례가 있다 (iat 누락 시 실측).
			log.warn("구글 ID 토큰 검증 실패: {}", e.toString());
			throw new BusinessException(ErrorCode.SOCIAL_AUTH_FAILED);
		}
		if (token == null) {
			throw new BusinessException(ErrorCode.SOCIAL_AUTH_FAILED); // 서명·aud·만료 불일치
		}
		GoogleIdToken.Payload payload = token.getPayload();
		if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
			// 미인증 이메일은 계정 도용 위험이 있어 거부 (이메일은 식별자가 아니라 표시용이지만 최소 방어)
			log.warn("구글 이메일 미인증 계정 로그인 시도: sub={}", payload.getSubject());
		}
		return new GoogleAccount(payload.getSubject(), payload.getEmail(),
				(String) payload.get("name"));
	}
}
