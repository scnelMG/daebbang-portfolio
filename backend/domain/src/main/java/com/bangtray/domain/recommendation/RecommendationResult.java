package com.bangtray.domain.recommendation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 추천된 빵집 (3곳: 점수 상위 1~2 + 무작위 3, 2026-09-21). 리뷰가 이 행을 참조해 "방문한 빵집" 자동 채움 */
@Entity
@Table(name = "recommendation_results")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class RecommendationResult {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "recommendation_id", nullable = false)
	private Long recommendationId;

	@Column(name = "bakery_id", nullable = false)
	private Long bakeryId;

	/** CHECK chk_rank: 1~3 (3 = 무작위 발견 슬롯) */
	@Column(nullable = false, columnDefinition = "tinyint")
	private Integer rankNo;
}
