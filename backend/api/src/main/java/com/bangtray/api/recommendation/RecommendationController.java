package com.bangtray.api.recommendation;

import com.bangtray.api.common.ApiResponse;
import com.bangtray.api.recommendation.RecommendationDtos.HistoryItem;
import com.bangtray.api.recommendation.RecommendationDtos.RecommendRequest;
import com.bangtray.api.recommendation.RecommendationDtos.RecommendResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 추천 — 회원 전용 (2026-09-08 확정: 비회원 추천 기각). [추천받기] 클릭 시에만 계산 (TRAY-014) */
@RestController
@RequiredArgsConstructor
public class RecommendationController {

	private final RecommendationService recommendationService;

	@PostMapping("/api/recommendations")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<RecommendResponse> recommend(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody RecommendRequest request) {
		return ApiResponse.success(recommendationService.recommend(userId, request));
	}

	/** 마이페이지 "추천받은 빵집" — 리뷰 작성 진입점 (REVW-001) */
	@GetMapping("/api/users/me/recommendations")
	public ApiResponse<List<HistoryItem>> myRecommendations(@AuthenticationPrincipal Long userId) {
		return ApiResponse.success(recommendationService.myRecommendations(userId));
	}
}
