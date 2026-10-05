package com.bangtray.api.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 프론트가 구글에서 받은 ID 토큰(JWT)을 그대로 전달 */
public record GoogleLoginRequest(
		@NotBlank String idToken
) {
}
