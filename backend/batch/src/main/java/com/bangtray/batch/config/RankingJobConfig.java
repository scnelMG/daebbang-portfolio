package com.bangtray.batch.config;

import com.bangtray.batch.ranking.MonthlyRankingTasklet;
import com.bangtray.batch.ranking.RankingProperties;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;

/** ⑥ 월 랭킹 배치 — 단일 스텝, DB 작업뿐이라 JPA 트랜잭션 매니저 사용 */
@Configuration
public class RankingJobConfig {

	@Bean
	public Job rankingJob(JobRepository jobRepository, Step rankingStep) {
		return new JobBuilder("rankingJob", jobRepository)
				.start(rankingStep)
				.build();
	}

	@Bean
	public Step rankingStep(JobRepository jobRepository, MonthlyRankingTasklet tasklet,
			PlatformTransactionManager transactionManager) {
		return new StepBuilder("rankingStep", jobRepository)
				.tasklet(tasklet, transactionManager)
				.build();
	}

	@Component
	@RequiredArgsConstructor
	@Slf4j
	public static class RankingJobLauncher {

		private final JobOperator jobOperator;
		private final Job rankingJob;
		private final RankingProperties properties;

		/** 매월 1일 새벽 — 지난달 확정 */
		@Scheduled(cron = "${bangtray.ranking.cron}", zone = "Asia/Seoul")
		public void runMonthly() throws Exception {
			launch("schedule");
		}

		/** 수동 테스트: --bangtray.ranking.run-on-startup=true [--bangtray.ranking.year-month=2026-09] */
		@EventListener(ApplicationReadyEvent.class)
		public void runOnStartup() throws Exception {
			if (properties.runOnStartup()) {
				launch("startup");
			}
		}

		private void launch(String trigger) throws Exception {
			log.info("rankingJob 시작 (trigger={}, yearMonth={})", trigger, properties.yearMonth());
			jobOperator.start(rankingJob, new JobParametersBuilder()
					.addString("trigger", trigger)
					.addString("yearMonth", properties.yearMonth() == null ? "" : properties.yearMonth())
					.addLocalDateTime("runAt", LocalDateTime.now())
					.toJobParameters());
		}
	}
}
