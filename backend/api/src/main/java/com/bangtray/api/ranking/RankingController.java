package com.bangtray.api.ranking;

import com.bangtray.api.common.ApiResponse;
import com.bangtray.api.ranking.RankingService.RankingResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 리뷰 랭킹 — 마이페이지 하위 탭 (회원 전용). rank 1 = 이달의 대빵 (RANK-004) */
@RestController
@RequestMapping("/api/rankings")
@RequiredArgsConstructor
public class RankingController {

	private final RankingService rankingService;

	/**
	 * @param period    daily | weekly | monthly
	 * @param yearMonth monthly 전용, 예: 2026-08 (생략 시 이번 달). 지난 달은 배치 스냅샷 기준
	 */
	@GetMapping
	public ApiResponse<RankingResponse> ranking(
			@AuthenticationPrincipal Long userId,
			@RequestParam(defaultValue = "monthly") String period,
			@RequestParam(required = false) String yearMonth) {
		return ApiResponse.success(rankingService.ranking(userId, period, yearMonth));
	}
}
