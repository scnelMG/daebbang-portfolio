package com.bangtray.api.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

	// 공통
	VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다."),
	UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
	FORBIDDEN(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
	NOT_FOUND(HttpStatus.NOT_FOUND, "리소스를 찾을 수 없습니다."),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),

	// 인증
	DUPLICATE_NICKNAME(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
	DUPLICATE_EMAIL(HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다."),
	PASSWORD_MISMATCH(HttpStatus.BAD_REQUEST, "비밀번호와 비밀번호 확인이 일치하지 않습니다."),
	TERMS_NOT_AGREED(HttpStatus.BAD_REQUEST, "필수 약관에 동의해야 합니다."),
	// AUTH-007: 계정 없음과 비밀번호 불일치를 같은 문구로 응답
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
	INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다."),
	EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "만료된 토큰입니다."),
	WITHDRAWN_USER(HttpStatus.UNAUTHORIZED, "탈퇴한 회원입니다."),
	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."),
	SOCIAL_AUTH_FAILED(HttpStatus.UNAUTHORIZED, "구글 인증에 실패했습니다. 다시 시도해 주세요."),
	SOCIAL_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "소셜 로그인이 설정되지 않았습니다."),

	// 리뷰
	EMPTY_REVIEW(HttpStatus.BAD_REQUEST, "먹어본 빵을 1개 이상 선택하거나 입력해야 합니다."),
	DUPLICATE_BREAD_IN_REVIEW(HttpStatus.BAD_REQUEST, "같은 빵을 중복 선택할 수 없습니다."),
	TAG_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "빵당 태그는 최대 2개까지 선택할 수 있습니다."),
	INVALID_TAG_FOR_BREAD(HttpStatus.BAD_REQUEST, "선택한 빵에 붙일 수 없는 태그입니다."),

	// 추천 (트레이 서버 재검증 — RECO-014)
	EMPTY_TRAY(HttpStatus.BAD_REQUEST, "트레이에 빵을 1종 이상 담아야 합니다."),
	TRAY_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "트레이에는 최대 8종까지 담을 수 있습니다."),
	DUPLICATE_BREAD_IN_TRAY(HttpStatus.BAD_REQUEST, "같은 빵을 트레이에 중복해서 담을 수 없습니다."),
	TAG_REQUIRED_FOR_BREAD(HttpStatus.BAD_REQUEST, "빵마다 취향 태그를 1개 이상 선택해야 합니다.");

	private final HttpStatus status;
	private final String message;
}
