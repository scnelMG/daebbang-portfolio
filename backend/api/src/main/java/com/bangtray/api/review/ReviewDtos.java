package com.bangtray.api.review;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class ReviewDtos {

	private ReviewDtos() {
	}

	public record ReviewBreadRequest(
			@NotNull Integer breadId,
			List<Integer> tagIds   // 0~2개 (REVW-006 — 상한은 서비스에서 검증해 공통 에러코드로 응답)
	) {
	}

	public record CreateReviewRequest(
			Long bakeryId,                 // recommendationResultId가 없으면 필수 (직접 방문)
			Long recommendationResultId,   // 있으면 방문 빵집을 추천 결과에서 자동 채움 (REVW-002)
			@NotNull @PastOrPresent LocalDate visitDate,
			@NotNull @Min(1) @Max(5) Integer rating,
			@Valid List<ReviewBreadRequest> breads,
			@Size(max = 5) List<String> customBreadNames   // 목록 외 빵 이름 (REVW-017)
	) {
	}

	public record ReviewBreadItem(Integer breadId, String breadName, List<String> tagNames) {
	}

	public record MyReviewItem(
			Long reviewId,
			Long bakeryId,
			String bakeryName,
			String bakeryImageUrl,   // 리뷰 카드의 매장 사진 (없으면 null → 프론트 플레이스홀더)
			LocalDate visitDate,
			Integer rating,
			List<ReviewBreadItem> breads,
			List<String> customBreadNames,
			LocalDateTime createdAt
	) {
	}
}
