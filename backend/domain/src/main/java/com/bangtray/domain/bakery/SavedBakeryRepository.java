package com.bangtray.domain.bakery;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SavedBakeryRepository extends JpaRepository<SavedBakery, SavedBakeryId> {

	/** 내 저장 목록 — 최신순 (SAVE-003) */
	List<SavedBakery> findByIdUserIdOrderByCreatedAtDesc(Long userId);

	/** 목록/상세에 저장 여부 플래그를 얹기 위한 조회 */
	@Query("select s.id.bakeryId from SavedBakery s where s.id.userId = :userId")
	List<Long> findBakeryIdsByUserId(@Param("userId") Long userId);
}
