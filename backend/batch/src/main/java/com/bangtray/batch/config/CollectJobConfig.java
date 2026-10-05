package com.bangtray.batch.config;

import com.bangtray.batch.collect.CollectTasklet;
import com.bangtray.batch.collect.QueryPartitioner;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.support.transaction.ResourcelessTransactionManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * ①수집+②전처리 Job — Source×Bakery 파티션 병렬 (설계 확정).
 * 워커 스텝은 HTTP 크롤이 대부분이라 ResourcelessTransactionManager 사용
 * (긴 트랜잭션 방지 — MySQL/Mongo 쓰기는 각 리포지토리 호출 단위로 커밋).
 */
@Configuration
public class CollectJobConfig {

	@Bean
	public Job collectJob(JobRepository jobRepository, Step collectMasterStep) {
		return new JobBuilder("collectJob", jobRepository)
				.start(collectMasterStep)
				.build();
	}

	@Bean
	public Step collectMasterStep(JobRepository jobRepository, QueryPartitioner partitioner,
			Step collectWorkerStep, TaskExecutor collectTaskExecutor) {
		return new StepBuilder("collectMasterStep", jobRepository)
				.partitioner("collectWorkerStep", partitioner)
				.step(collectWorkerStep)
				.taskExecutor(collectTaskExecutor)
				.gridSize(4)
				.build();
	}

	@Bean
	public Step collectWorkerStep(JobRepository jobRepository, CollectTasklet collectTasklet) {
		return new StepBuilder("collectWorkerStep", jobRepository)
				.tasklet(collectTasklet, new ResourcelessTransactionManager())
				.build();
	}

	@Bean
	public TaskExecutor collectTaskExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(4);
		executor.setMaxPoolSize(4);
		executor.setThreadNamePrefix("collect-");
		executor.initialize();
		return executor;
	}
}
