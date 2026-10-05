package com.bangtray.domain.bakery;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BakeryRepository extends JpaRepository<Bakery, Long> {

	List<Bakery> findByIsOpenTrue();

	/**
	 * 홈 '오늘의 빵집' 후보 — 영업 중이며 사진·지도 링크가 모두 있는 빵집.
	 * id 순으로 고정해 두고 서비스가 날짜 시드로 섞는다 (HOME-005: 매일 다른 카드, 같은 날엔 모두 같은 카드).
	 */
	List<Bakery> findByIsOpenTrueAndImageUrlIsNotNullAndMapUrlIsNotNullOrderByIdAsc();

	/** 추천 무작위 발견 슬롯용 무작위 노출 (106행이라 RAND() 부담 없음) */
	@Query(value = "SELECT * FROM bakeries WHERE is_open = TRUE ORDER BY RAND() LIMIT :size",
			nativeQuery = true)
	List<Bakery> findRandomOpen(@Param("size") int size);
}
