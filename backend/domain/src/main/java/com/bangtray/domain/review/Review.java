package com.bangtray.domain.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 자체 리뷰. 라벨 클릭 + 별점만 수집. 타 사용자에게 전면 비공개 — 내부 추천 데이터 전용 */
@Entity
@Table(name = "reviews")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Review {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "bakery_id", nullable = false)
	private Long bakeryId;

	/** 어떤 추천을 받고 방문했는지 (직접 방문 리뷰면 null) */
	@Column(name = "recommendation_result_id")
	private Long recommendationResultId;

	@Column(nullable = false)
	private LocalDate visitDate;

	/** CHECK chk_rating: 1~5 */
	@Column(nullable = false, columnDefinition = "tinyint")
	private Integer rating;

	/**
	 * 목록 외 빵 이름 (REVW-017) — 8종에 없는 빵은 이름만 수집.
	 * 태그 불가·점수 집계 제외, 향후 빵 종류 확장 근거 데이터 (확정 #14)
	 */
	@JdbcTypeCode(SqlTypes.JSON)
	private List<String> customBreadNames;

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@PrePersist
	void onCreate() {
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}
}
