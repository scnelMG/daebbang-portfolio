package com.bangtray.batch.collect;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 수집 배치 설정 (application.yml bangtray.collect.*) */
@ConfigurationProperties(prefix = "bangtray.collect")
public record CollectProperties(
		int pages,          // 쿼리당 검색 페이지 수 (페이지당 30건)
		int maxPerQuery,    // 쿼리당 본문 크롤 상한
		boolean runOnStartup, // true면 기동 직후 1회 실행 (수동 테스트용)
		String cron         // 주 1회 트리거
) {
}
