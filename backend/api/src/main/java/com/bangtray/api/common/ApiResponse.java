package com.bangtray.api.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * API 공통 응답 규격.
 * 성공: { "success": true,  "data": {...}, "error": null }
 * 실패: { "success": false, "data": null,  "error": { "code": "...", "message": "..." } }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, T data, ErrorBody error) {

	public record ErrorBody(String code, String message) {
	}

	// 주의: 인자 없는 success()는 record 접근자 success()와 시그니처가 겹쳐 컴파일 불가.
	// 본문 없는 성공 응답은 success(null)로 쓴다.
	public static <T> ApiResponse<T> success(T data) {
		return new ApiResponse<>(true, data, null);
	}

	public static <T> ApiResponse<T> error(ErrorCode code, String message) {
		return new ApiResponse<>(false, null, new ErrorBody(code.name(), message));
	}

	public static <T> ApiResponse<T> error(ErrorCode code) {
		return error(code, code.getMessage());
	}
}
