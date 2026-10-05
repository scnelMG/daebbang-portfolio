package com.bangtray.api.user;

import com.bangtray.api.auth.AuthService;
import com.bangtray.api.common.ApiResponse;
import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.bangtray.domain.user.User;
import com.bangtray.domain.user.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

	private final UserRepository userRepository;
	private final AuthService authService;

	@GetMapping("/me")
	public ApiResponse<Map<String, Object>> me(@AuthenticationPrincipal Long userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
		return ApiResponse.success(Map.of(
				"userId", user.getId(),
				"nickname", user.getNickname(),
				"provider", user.getProvider().name()));
	}

	/** 탈퇴 = 익명화 (행 보존, 리뷰·랭킹 유지 — NFR-004) */
	@DeleteMapping("/me")
	public ApiResponse<Void> withdraw(@AuthenticationPrincipal Long userId) {
		authService.withdraw(userId);
		return ApiResponse.success(null);
	}
}
