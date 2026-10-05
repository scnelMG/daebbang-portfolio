package com.bangtray.domain.review;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {

	/** 내 리뷰 목록 — 최신순 (REVW-012). 리뷰는 본인 것만 조회 가능 (NFR-003) */
	List<Review> findByUserIdOrderByCreatedAtDesc(Long userId);

	/**
	 * 빵집 프로필의 '목록 외 빵' 집계용 — 이 빵집 리뷰 중 custom_bread_names가 있는 것만.
	 * 개별 리뷰는 밖으로 나가지 않고 이름별 건수로만 집계된다 (NFR-003 유지).
	 */
	List<Review> findByBakeryIdAndCustomBreadNamesIsNotNull(Long bakeryId);

	/** 랭킹 실시간 집계 행 (리뷰 0건 사용자는 행 자체가 없음 — RANK-007) */
	interface RankingRow {

		Long getUserId();

		long getReviewCount();

		long getVisitedBakeryCount();
	}

	/**
	 * 기간 내 리뷰 랭킹 집계 (작성일 기준).
	 * 정렬: 리뷰 수 → 방문 빵집 수(DISTINCT) → user_id (미확정 #3 승인안 — RANK-008)
	 */
	@Query("""
			select r.userId as userId,
			       count(r) as reviewCount,
			       count(distinct r.bakeryId) as visitedBakeryCount
			from Review r
			where r.createdAt >= :start and r.createdAt < :end
			group by r.userId
			order by count(r) desc, count(distinct r.bakeryId) desc, r.userId asc
			""")
	List<RankingRow> aggregateRanking(@Param("start") LocalDateTime start,
			@Param("end") LocalDateTime end);
}
