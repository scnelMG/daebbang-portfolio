package com.bangtray.batch.config;

import com.bangtray.batch.label.LabelProperties;
import com.bangtray.batch.label.LabelingTasklet;
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
import org.springframework.batch.infrastructure.support.transaction.ResourcelessTransactionManager;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * ③ LLM 라벨링 Job — 단일 스텝. LLM HTTP 호출이 대부분이라 ResourcelessTransactionManager 사용
 * (긴 트랜잭션 방지 — MySQL INSERT는 문서·태그 단위로 커밋, UNIQUE가 멱등성 보장).
 */
@Configuration
public class LabelingJobConfig {

	@Bean
	public Job labelingJob(JobRepository jobRepository, Step labelingStep) {
		return new JobBuilder("labelingJob", jobRepository)
				.start(labelingStep)
				.build();
	}

	@Bean
	public Step labelingStep(JobRepository jobRepository, LabelingTasklet tasklet) {
		return new StepBuilder("labelingStep", jobRepository)
				.tasklet(tasklet, new ResourcelessTransactionManager())
				.build();
	}

	@Component
	@RequiredArgsConstructor
	@Slf4j
	public static class LabelingJobLauncher {

		private final JobOperator jobOperator;
		private final Job labelingJob;
		private final LabelProperties properties;

		/** 주 1회 — 수집 잡(월 04:00) 이후에 신규 문서를 증분 처리 */
		@Scheduled(cron = "${bangtray.label.cron}", zone = "Asia/Seoul")
		public void runWeekly() throws Exception {
			launch("schedule");
		}

		/** 수동 테스트: --bangtray.label.run-on-startup=true */
		@EventListener(ApplicationReadyEvent.class)
		public void runOnStartup() throws Exception {
			if (properties.runOnStartup()) {
				launch("startup");
			}
		}

		private void launch(String trigger) throws Exception {
			log.info("labelingJob 시작 (trigger={}, model={})", trigger, properties.model());
			jobOperator.start(labelingJob, new JobParametersBuilder()
					.addString("trigger", trigger)
					.addLocalDateTime("runAt", LocalDateTime.now())
					.toJobParameters());
		}
	}
}
