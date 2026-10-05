package com.bangtray.domain.bread;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TagRepository extends JpaRepository<Tag, Integer> {

	/** 트레이/리뷰 선택 UI용 — 활성 태그만 (폐기 태그는 노출 금지) */
	@Query("select t from Tag t join fetch t.bread where t.isActive = true order by t.bread.id, t.id")
	List<Tag> findAllActiveWithBread();

	/** ③ LLM 라벨링 사전용 — 해당 빵의 활성 태그만 (폐기 태그는 사전에서 제외) */
	@Query("select t from Tag t where t.bread.id = :breadId and t.isActive = true order by t.id")
	List<Tag> findActiveByBreadId(@Param("breadId") int breadId);
}
