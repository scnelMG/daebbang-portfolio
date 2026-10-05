package com.bangtray.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SignupRequest(
		@NotBlank @Size(min = 2, max = 50) String nickname,
		@NotBlank @Email String email,
		@NotBlank @Size(min = 8, max = 64) String password,
		@NotBlank String passwordConfirm,
		@NotNull Boolean termsAgreed,     // 이용약관 (AUTH-004 필수)
		@NotNull Boolean privacyAgreed    // 개인정보 처리방침 (필수)
) {
}
