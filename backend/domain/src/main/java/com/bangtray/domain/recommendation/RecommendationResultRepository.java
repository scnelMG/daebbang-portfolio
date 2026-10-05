package com.bangtray.domain.recommendation;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationResultRepository extends JpaRepository<RecommendationResult, Long> {

	List<RecommendationResult> findByRecommendationIdIn(Collection<Long> recommendationIds);
}
