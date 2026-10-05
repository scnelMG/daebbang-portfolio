package com.bangtray.batch.config;

import com.bangtray.batch.collect.CollectProperties;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 주 1회 스케줄 트리거 (spring.batch.job.enabled=false — 기동만으로는 실행 안 됨) */
@Component
@RequiredArgsConstructor
@Slf4j
public class CollectJobLauncher {

	private final JobOperator jobOperator;
	private final Job collectJob;
	private final CollectProperties properties;

	@Scheduled(cron = "${bangtray.collect.cron}", zone = "Asia/Seoul")
	public void runWeekly() throws Exception {
		launch("schedule");
	}

	/** 수동 테스트용: --bangtray.collect.run-on-startup=true 로 기동 직후 1회 실행 */
	@EventListener(ApplicationReadyEvent.class)
	public void runOnStartup() throws Exception {
		if (properties.runOnStartup()) {
			launch("startup");
		}
	}

	private void launch(String trigger) throws Exception {
		log.info("collectJob 시작 (trigger={})", trigger);
		jobOperator.start(collectJob, new JobParametersBuilder()
				.addString("trigger", trigger)
				.addLocalDateTime("runAt", LocalDateTime.now())
				.toJobParameters());
	}
}
