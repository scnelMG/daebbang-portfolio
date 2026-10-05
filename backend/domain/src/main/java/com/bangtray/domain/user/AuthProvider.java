package com.bangtray.domain.user;

public enum AuthProvider {
	local, kakao, naver, google
	// 2026-09-08 확정: 소셜은 구글만 구현. kakao/naver 값은 ERD 유지 결정에 따라 남겨둠 (미사용)
}
