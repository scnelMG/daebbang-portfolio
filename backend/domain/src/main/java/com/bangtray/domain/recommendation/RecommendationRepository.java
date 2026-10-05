package com.bangtray.domain.recommendation;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationRepository extends JpaRepository<Recommendation, Long> {

	/** 마이페이지 "추천받은 빵집" — 최신순 (리뷰 작성 진입점, REVW-001) */
	List<Recommendation> findByUserIdOrderByCreatedAtDesc(Long userId);
}
