package com.bangtray.domain.score;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BakeryBreadTagScoreRepository extends JpaRepository<BakeryBreadTagScore, Long> {

	/**
	 * 추천 조회 — (빵, 태그) 후보 집합으로 넓게 가져와 서비스에서 정확한 쌍만 사용.
	 * idx_scores_lookup(bread_id, tag_id, final_score) 인덱스를 탄다.
	 */
	List<BakeryBreadTagScore> findByBreadIdInAndTagIdIn(
			Collection<Integer> breadIds, Collection<Integer> tagIds);

	/** 홈 '오늘의 빵집' 대표 빵 계산 — 후보 빵집들의 점수 행 전체 (빵집 90곳 × 최대 8종 × 태그, 수백 행) */
	List<BakeryBreadTagScore> findByBakeryIdIn(Collection<Long> bakeryIds);

	/** 빵집 프로필 — 한 빵집의 (빵, 태그) 행 전체 (최대 8종 × 태그 수, 수십 행) */
	List<BakeryBreadTagScore> findByBakeryId(Long bakeryId);
}
