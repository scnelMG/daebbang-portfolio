package com.bangtray.api.review;

import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.bangtray.api.review.ReviewDtos.CreateReviewRequest;
import com.bangtray.api.review.ReviewDtos.MyReviewItem;
import com.bangtray.api.review.ReviewDtos.ReviewBreadItem;
import com.bangtray.api.review.ReviewDtos.ReviewBreadRequest;
import com.bangtray.domain.bakery.Bakery;
import com.bangtray.domain.bakery.BakeryRepository;
import com.bangtray.domain.bread.Bread;
import com.bangtray.domain.bread.BreadRepository;
import com.bangtray.domain.bread.Tag;
import com.bangtray.domain.bread.TagRepository;
import com.bangtray.domain.recommendation.RecommendationRepository;
import com.bangtray.domain.recommendation.RecommendationResult;
import com.bangtray.domain.recommendation.RecommendationResultRepository;
import com.bangtray.domain.review.Review;
import com.bangtray.domain.review.ReviewBread;
import com.bangtray.domain.review.ReviewBreadRepository;
import com.bangtray.domain.review.ReviewBreadTag;
import com.bangtray.domain.review.ReviewBreadTagId;
import com.bangtray.domain.review.ReviewBreadTagRepository;
import com.bangtray.domain.review.ReviewRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewService {

	private static final int MAX_TAGS_PER_BREAD = 2; // REVW-006 — 앱 레벨 검증 (설계 원칙)

	private final ReviewRepository reviewRepository;
	private final ReviewBreadRepository reviewBreadRepository;
	private final ReviewBreadTagRepository reviewBreadTagRepository;
	private final BakeryRepository bakeryRepository;
	private final BreadRepository breadRepository;
	private final TagRepository tagRepository;
	private final RecommendationRepository recommendationRepository;
	private final RecommendationResultRepository recommendationResultRepository;

	/** 리뷰 3단 저장 — reviews / review_breads / review_bread_tags 한 트랜잭션 (REVW-008) */
	@Transactional
	public Long create(Long userId, CreateReviewRequest request) {
		Long bakeryId = resolveBakeryId(userId, request);
		validateBreads(request);

		Review review = reviewRepository.save(Review.builder()
				.userId(userId)
				.bakeryId(bakeryId)
				.recommendationResultId(request.recommendationResultId())
				.visitDate(request.visitDate())
				.rating(request.rating())
				.customBreadNames(emptyToNull(request.customBreadNames()))
				.build());

		for (ReviewBreadRequest breadRequest : nullSafe(request.breads())) {
			ReviewBread reviewBread = reviewBreadRepository.save(ReviewBread.builder()
					.reviewId(review.getId())
					.breadId(breadRequest.breadId())
					.build());
			for (Integer tagId : nullSafeInt(breadRequest.tagIds())) {
				// bread_id를 함께 저장 — 복합 FK 2개가 "그 빵의 태그"임을 DB에서 최종 강제 (REVW-007)
				reviewBreadTagRepository.save(ReviewBreadTag.builder()
						.id(new ReviewBreadTagId(reviewBread.getId(), tagId))
						.breadId(breadRequest.breadId())
						.build());
			}
		}
		return review.getId();
	}

	public List<MyReviewItem> myReviews(Long userId) {
		List<Review> reviews = reviewRepository.findByUserIdOrderByCreatedAtDesc(userId);
		if (reviews.isEmpty()) {
			return List.of();
		}
		List<ReviewBread> reviewBreads = reviewBreadRepository
				.findByReviewIdIn(reviews.stream().map(Review::getId).toList());
		Map<Long, List<ReviewBreadTag>> tagsByReviewBread = reviewBreadTagRepository
				.findByIdReviewBreadIdIn(reviewBreads.stream().map(ReviewBread::getId).toList())
				.stream()
				.collect(Collectors.groupingBy(t -> t.getId().getReviewBreadId()));

		Map<Long, Bakery> bakeries = bakeryRepository
				.findAllById(reviews.stream().map(Review::getBakeryId).distinct().toList()).stream()
				.collect(Collectors.toMap(Bakery::getId, Function.identity()));
		Map<Integer, String> breadNames = breadRepository.findAll().stream()
				.collect(Collectors.toMap(Bread::getId, Bread::getName));
		Map<Integer, String> tagNames = tagRepository.findAll().stream()
				.collect(Collectors.toMap(Tag::getId, Tag::getName));

		Map<Long, List<ReviewBread>> breadsByReview = reviewBreads.stream()
				.collect(Collectors.groupingBy(ReviewBread::getReviewId));

		return reviews.stream().map(review -> new MyReviewItem(
				review.getId(),
				review.getBakeryId(),
				bakeryField(bakeries, review.getBakeryId(), Bakery::getName),
				bakeryField(bakeries, review.getBakeryId(), Bakery::getImageUrl),
				review.getVisitDate(),
				review.getRating(),
				breadsByReview.getOrDefault(review.getId(), List.of()).stream()
						.map(rb -> new ReviewBreadItem(
								rb.getBreadId(),
								breadNames.getOrDefault(rb.getBreadId(), ""),
								tagsByReviewBread.getOrDefault(rb.getId(), List.of()).stream()
										.map(t -> tagNames.getOrDefault(t.getId().getTagId(), ""))
										.toList()))
						.toList(),
				review.getCustomBreadNames() == null ? List.of() : review.getCustomBreadNames(),
				review.getCreatedAt()))
				.toList();
	}

	/** 빵집이 조회되지 않아도(삭제·정합성 문제) 목록 전체가 깨지지 않도록 null 안전 접근 */
	private String bakeryField(Map<Long, Bakery> bakeries, Long bakeryId,
			Function<Bakery, String> getter) {
		Bakery bakery = bakeries.get(bakeryId);
		return bakery == null ? null : getter.apply(bakery);
	}

	/** 추천 경유면 결과에서 방문 빵집 자동 채움(REVW-002) + 내 추천인지 검증. 직접 방문이면 bakeryId 필수 */
	private Long resolveBakeryId(Long userId, CreateReviewRequest request) {
		if (request.recommendationResultId() != null) {
			RecommendationResult result = recommendationResultRepository
					.findById(request.recommendationResultId())
					.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
			boolean mine = recommendationRepository.findById(result.getRecommendationId())
					.map(reco -> reco.getUserId().equals(userId))
					.orElse(false);
			if (!mine) {
				throw new BusinessException(ErrorCode.FORBIDDEN);
			}
			return result.getBakeryId();
		}
		if (request.bakeryId() == null || !bakeryRepository.existsById(request.bakeryId())) {
			throw new BusinessException(ErrorCode.NOT_FOUND);
		}
		return request.bakeryId();
	}

	private void validateBreads(CreateReviewRequest request) {
		List<ReviewBreadRequest> breads = nullSafe(request.breads());
		boolean hasCustom = !nullSafeStr(request.customBreadNames()).isEmpty();
		if (breads.isEmpty() && !hasCustom) {
			throw new BusinessException(ErrorCode.EMPTY_REVIEW); // 빵 선택 또는 목록 외 이름 중 하나는 필수
		}
		Set<Integer> seenBreads = new HashSet<>();
		Set<Integer> allTagIds = new HashSet<>();
		for (ReviewBreadRequest bread : breads) {
			if (!seenBreads.add(bread.breadId())) {
				throw new BusinessException(ErrorCode.DUPLICATE_BREAD_IN_REVIEW);
			}
			List<Integer> tagIds = nullSafeInt(bread.tagIds());
			if (tagIds.size() > MAX_TAGS_PER_BREAD) {
				throw new BusinessException(ErrorCode.TAG_LIMIT_EXCEEDED);
			}
			if (tagIds.size() != new HashSet<>(tagIds).size()) {
				throw new BusinessException(ErrorCode.INVALID_TAG_FOR_BREAD);
			}
			allTagIds.addAll(tagIds);
		}
		// 태그가 실제로 "그 빵의 활성 태그"인지 (REVW-007) — 복합 FK가 최종 방어지만 메시지를 위해 선검증
		Map<Integer, Tag> tags = tagRepository.findAllById(allTagIds).stream()
				.collect(Collectors.toMap(Tag::getId, Function.identity()));
		for (ReviewBreadRequest bread : breads) {
			for (Integer tagId : nullSafeInt(bread.tagIds())) {
				Tag tag = tags.get(tagId);
				if (tag == null || !tag.isActive()
						|| !tag.getBread().getId().equals(bread.breadId())) {
					throw new BusinessException(ErrorCode.INVALID_TAG_FOR_BREAD);
				}
			}
		}
	}

	private List<ReviewBreadRequest> nullSafe(List<ReviewBreadRequest> list) {
		return list == null ? List.of() : list;
	}

	private List<Integer> nullSafeInt(List<Integer> list) {
		return list == null ? List.of() : list;
	}

	private List<String> nullSafeStr(List<String> list) {
		return list == null ? List.of() : list.stream().filter(s -> s != null && !s.isBlank()).toList();
	}

	private List<String> emptyToNull(List<String> list) {
		List<String> cleaned = nullSafeStr(list);
		return cleaned.isEmpty() ? null : cleaned;
	}
}
