package com.bangtray.domain.ranking;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MonthlyUserRankingRepository extends JpaRepository<MonthlyUserRanking, Long> {

	@Query("select m from MonthlyUserRanking m where m.yearMonth = :yearMonth order by m.rankNo asc")
	List<MonthlyUserRanking> findByYearMonth(@Param("yearMonth") String yearMonth);

	/** 배치 재실행 멱등성 — 해당 월 스냅샷을 지우고 다시 계산 (집계 산출물은 재생성 대상) */
	@Modifying
	@Query("delete from MonthlyUserRanking m where m.yearMonth = :yearMonth")
	void deleteByYearMonth(@Param("yearMonth") String yearMonth);
}
