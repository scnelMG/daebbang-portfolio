package com.bangtray.api.review;

import com.bangtray.api.common.ApiResponse;
import com.bangtray.api.review.ReviewDtos.CreateReviewRequest;
import com.bangtray.api.review.ReviewDtos.MyReviewItem;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 리뷰 — 전면 비공개(REVW-011): 작성·조회 모두 본인 것만 (NFR-003) */
@RestController
@RequiredArgsConstructor
public class ReviewController {

	private final ReviewService reviewService;

	@PostMapping("/api/reviews")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<Map<String, Long>> create(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody CreateReviewRequest request) {
		return ApiResponse.success(Map.of("reviewId", reviewService.create(userId, request)));
	}

	@GetMapping("/api/users/me/reviews")
	public ApiResponse<List<MyReviewItem>> myReviews(@AuthenticationPrincipal Long userId) {
		return ApiResponse.success(reviewService.myReviews(userId));
	}
}
