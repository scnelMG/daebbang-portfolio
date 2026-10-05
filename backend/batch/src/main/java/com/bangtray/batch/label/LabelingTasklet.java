package com.bangtray.batch.label;

import com.bangtray.batch.collect.CleanedReview;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * ③ LLM 라벨링 배치 (DATA-006, DATA-007) — labeled:false인 신규 리뷰만 증분 처리 (비용 절감).
 * 문서 단위 실패는 labeled:false로 남겨 다음 실행에서 재시도 (잡 전체는 계속 진행).
 */
@Component
@StepScope
@RequiredArgsConstructor
@Slf4j
public class LabelingTasklet implements Tasklet {

	private final MongoTemplate mongoTemplate;
	private final LabelingService labelingService;
	private final LlmLabelClient llm;
	private final LabelProperties properties;

	@Override
	public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {
		if (!llm.isEnabled()) {
			log.warn("[라벨링] OPENAI_API_KEY 미설정 — 아무것도 하지 않고 종료");
			return RepeatStatus.FINISHED;
		}

		// 매핑 없는 문서는 쿼리에서 제외 — 조회 대상에 계속 잡혀 maxDocsPerRun 슬롯을
		// 영구 점유하는 기아 현상 방지 (labeled:false로 남으므로 수집 로직 수정 후 자연 복귀)
		List<CleanedReview> targets = mongoTemplate.find(
				Query.query(Criteria.where("labeled").is(false)
						.and("shop_id").ne(null).and("bread_id").ne(null))
						.limit(properties.maxDocsPerRun()),
				CleanedReview.class);
		long unmapped = mongoTemplate.count(
				Query.query(Criteria.where("labeled").is(false).orOperator(
						Criteria.where("shop_id").is(null), Criteria.where("bread_id").is(null))),
				CleanedReview.class);
		if (unmapped > 0) {
			log.warn("[라벨링] 가게/빵 매핑 없는 문서 {}건 — 라벨 불가라 제외함 (수집 로직 점검 대상)", unmapped);
		}

		int processed = 0;
		int labelsSaved = 0;
		int failed = 0;
		for (CleanedReview doc : targets) {
			try {
				labelsSaved += labelingService.label(doc);
				processed++;
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				throw e;
			} catch (Exception e) {
				failed++;
				log.warn("[라벨링] 문서 실패 — 다음 실행에서 재시도 (doc={})", doc.getId(), e);
			}
		}
		log.info("[라벨링] 대상 {} → 처리 {} (라벨 {}건 저장, 실패 {})",
				targets.size(), processed, labelsSaved, failed);
		return RepeatStatus.FINISHED;
	}
}
