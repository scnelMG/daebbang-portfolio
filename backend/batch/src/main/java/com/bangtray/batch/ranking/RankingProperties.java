package com.bangtray.batch.ranking;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 월 랭킹 배치 설정 (application.yml bangtray.ranking.*) */
@ConfigurationProperties(prefix = "bangtray.ranking")
public record RankingProperties(
		boolean runOnStartup,  // true면 기동 직후 1회 실행 (수동 테스트용)
		String cron,           // 매월 1일 새벽 — 지난달 확정 집계
		String yearMonth       // 수동 대상 월 지정 (예: 2026-08). 비우면 지난달
) {
}
