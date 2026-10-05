package com.bangtray.batch.label;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** ③ LLM 라벨링 배치 설정 (application.yml bangtray.label.*) */
@ConfigurationProperties(prefix = "bangtray.label")
public record LabelProperties(
		boolean runOnStartup, // true면 기동 직후 1회 실행 (수동 테스트용)
		String cron,          // 주 1회 트리거 — 수집 잡 이후
		int maxDocsPerRun,    // 실행당 문서 상한 (증분 — labeled:false만 대상)
		String model,         // LLM 모델명
		String apiUrl,        // Chat Completions 엔드포인트
		String apiKey         // 미설정(빈 값)이면 잡이 아무것도 하지 않고 종료
) {
}
