package com.bangtray.batch.collect;

import com.bangtray.domain.collection.CollectionQueryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 파티션 하나(Source×Bakery)에 배정된 쿼리들을 순차 수집 */
@Component
@StepScope
@RequiredArgsConstructor
public class CollectTasklet implements Tasklet {

	private final CollectionQueryRepository queryRepository;
	private final CollectService collectService;

	@Value("#{stepExecutionContext['queryIds']}")
	private String queryIds;

	@Override
	public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
		if (queryIds != null && !queryIds.isBlank()) {
			for (String id : queryIds.split(",")) {
				queryRepository.findById(Long.parseLong(id)).ifPresent(collectService::collect);
			}
		}
		return RepeatStatus.FINISHED;
	}
}
