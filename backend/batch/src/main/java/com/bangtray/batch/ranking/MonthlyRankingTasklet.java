package com.bangtray.batch.ranking;

import com.bangtray.domain.ranking.MonthlyUserRanking;
import com.bangtray.domain.ranking.MonthlyUserRankingRepository;
import com.bangtray.domain.review.ReviewRepository;
import com.bangtray.domain.review.ReviewRepository.RankingRow;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * ⑥ 월별 리뷰 랭킹 확정 스냅샷 (DATA-016) — rank 1 = "이달의 대빵".
 * 정렬: 리뷰 수 → 방문 빵집 수 → user_id (미확정 #3 승인안, RANK-008).
 * 리뷰 0건 사용자는 행을 만들지 않음 (RANK-007).
 * 재실행 멱등: 대상 월 스냅샷 삭제 후 재계산 (온라인 API의 "지난달 조회"가 이 결과를 읽음).
 */
@Component
@StepScope
@RequiredArgsConstructor
@Slf4j
public class MonthlyRankingTasklet implements Tasklet {

	private final ReviewRepository reviewRepository;
	private final MonthlyUserRankingRepository rankingRepository;

	@Value("#{jobParameters['yearMonth']}")
	private String yearMonthParam;

	@Override
	public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
		YearMonth target = (yearMonthParam == null || yearMonthParam.isBlank())
				? YearMonth.now().minusMonths(1)
				: YearMonth.parse(yearMonthParam);
		LocalDateTime start = target.atDay(1).atStartOfDay();

		List<RankingRow> rows = reviewRepository.aggregateRanking(start, start.plusMonths(1));

		rankingRepository.deleteByYearMonth(target.toString());
		List<MonthlyUserRanking> rankings = new ArrayList<>(rows.size());
		for (int i = 0; i < rows.size(); i++) {
			RankingRow row = rows.get(i);
			rankings.add(MonthlyUserRanking.builder()
					.userId(row.getUserId())
					.yearMonth(target.toString())
					.reviewCount((int) row.getReviewCount())
					.visitedBakeryCount((int) row.getVisitedBakeryCount())
					.rankNo(i + 1)
					.build());
		}
		rankingRepository.saveAll(rankings);
		log.info("[월랭킹] {} 집계 완료 — {}명 (1위 = 이달의 대빵: userId {})",
				target, rankings.size(),
				rankings.isEmpty() ? "-" : rankings.get(0).getUserId());
		return RepeatStatus.FINISHED;
	}
}
