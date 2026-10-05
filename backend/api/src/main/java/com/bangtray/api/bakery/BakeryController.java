package com.bangtray.api.bakery;

import com.bangtray.api.bakery.BakeryDtos.BakeryCard;
import com.bangtray.api.bakery.BakeryDtos.BakeryDetail;
import com.bangtray.api.bakery.BakeryDtos.BakeryProfile;
import com.bangtray.api.common.ApiResponse;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 빵집 조회(비회원 허용) + 저장 토글(회원 전용).
 * 별도 목록 화면은 없음(확정 #13) — 홈 카드와 사이드 패널이 목록 역할.
 */
@RestController
@RequestMapping("/api/bakeries")
@RequiredArgsConstructor
public class BakeryController {

	private final BakeryService bakeryService;
	private final BookmarkService bookmarkService;

	/** 홈 "대전에서 발견한 빵집" 카드 (HOME-003) / 트레이 사이드 패널 (TRAY-003) 공용 */
	@GetMapping("/home")
	public ApiResponse<List<BakeryCard>> homeCards(
			@AuthenticationPrincipal Long userId,
			@RequestParam(defaultValue = "6") int size) {
		return ApiResponse.success(bakeryService.homeCards(userId, Math.min(size, 20)));
	}

	@GetMapping("/{bakeryId}")
	public ApiResponse<BakeryDetail> detail(
			@AuthenticationPrincipal Long userId,
			@PathVariable Long bakeryId) {
		return ApiResponse.success(bakeryService.detail(userId, bakeryId));
	}

	/** 빵집 프로필 — 추천 결과 카드의 빵별 특징 집계 · 목록 외 빵 (project issue). 공개 */
	@GetMapping("/{bakeryId}/profile")
	public ApiResponse<BakeryProfile> profile(@PathVariable Long bakeryId) {
		return ApiResponse.success(bakeryService.profile(bakeryId));
	}

	/** 저장 토글 (SAVE-001) — POST라서 Security 설정상 회원 전용 */
	@PostMapping("/{bakeryId}/bookmark")
	public ApiResponse<Map<String, Boolean>> toggleBookmark(
			@AuthenticationPrincipal Long userId,
			@PathVariable Long bakeryId) {
		return ApiResponse.success(Map.of("saved", bookmarkService.toggle(userId, bakeryId)));
	}
}
