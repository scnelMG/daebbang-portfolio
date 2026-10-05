package com.bangtray.domain.review;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewBreadTagRepository extends JpaRepository<ReviewBreadTag, ReviewBreadTagId> {

	List<ReviewBreadTag> findByIdReviewBreadIdIn(Collection<Long> reviewBreadIds);
}
