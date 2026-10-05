package com.bangtray.domain.review;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewBreadRepository extends JpaRepository<ReviewBread, Long> {

	List<ReviewBread> findByReviewIdIn(Collection<Long> reviewIds);
}
