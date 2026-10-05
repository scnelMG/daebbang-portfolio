package com.bangtray.api.auth;

import com.bangtray.api.auth.dto.GoogleLoginRequest;
import com.bangtray.api.auth.dto.LoginRequest;
import com.bangtray.api.auth.dto.RefreshRequest;
import com.bangtray.api.auth.dto.SignupRequest;
import com.bangtray.api.auth.dto.TokenResponse;
import com.bangtray.api.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

	private final AuthService authService;

	@PostMapping("/signup")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<Map<String, Long>> signup(@Valid @RequestBody SignupRequest request) {
		return ApiResponse.success(Map.of("userId", authService.signup(request)));
	}

	@GetMapping("/check-nickname")
	public ApiResponse<Map<String, Boolean>> checkNickname(@RequestParam String value) {
		return ApiResponse.success(Map.of("available", authService.isNicknameAvailable(value)));
	}

	@GetMapping("/check-email")
	public ApiResponse<Map<String, Boolean>> checkEmail(@RequestParam String value) {
		return ApiResponse.success(Map.of("available", authService.isEmailAvailable(value)));
	}

	@PostMapping("/login")
	public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
		return ApiResponse.success(authService.login(request));
	}

	/** 구글 로그인 (AUTH-008) — 프론트가 구글에서 받은 ID 토큰을 넘기면 가입·로그인을 함께 처리 */
	@PostMapping("/google")
	public ApiResponse<TokenResponse> googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
		return ApiResponse.success(authService.loginWithGoogle(request.idToken()));
	}

	@PostMapping("/token/refresh")
	public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
		return ApiResponse.success(authService.refresh(request.refreshToken()));
	}

	/** JWT는 무상태 — 서버 세션 파기 없음. 클라이언트가 토큰을 폐기하면 됨 (프론트 편의용 엔드포인트) */
	@PostMapping("/logout")
	public ApiResponse<Void> logout() {
		return ApiResponse.success(null);
	}
}
