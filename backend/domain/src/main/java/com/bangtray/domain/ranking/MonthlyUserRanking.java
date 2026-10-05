package com.bangtray.domain.ranking;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 월별 리뷰 랭킹 배치 집계. 리뷰 내용은 비공개, 랭킹(닉네임/숫자)만 공개. rank 1 = 이달의 대빵 */
@Entity
@Table(name = "monthly_user_rankings")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class MonthlyUserRanking {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	/** 예: 2026-08 (YEAR_MONTH가 MySQL 예약어라 백틱) */
	@Column(name = "`year_month`", nullable = false, length = 7)
	private String yearMonth;

	@Column(nullable = false)
	@Builder.Default
	private int reviewCount = 0;

	@Column(nullable = false)
	@Builder.Default
	private int visitedBakeryCount = 0;

	@Column(nullable = false)
	private int rankNo;

	@Column(nullable = false)
	private LocalDateTime calculatedAt;

	@PrePersist
	void onCreate() {
		if (calculatedAt == null) {
			calculatedAt = LocalDateTime.now();
		}
	}
}
