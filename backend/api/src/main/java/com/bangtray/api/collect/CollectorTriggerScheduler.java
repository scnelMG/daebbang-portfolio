package com.bangtray.api.collect;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.client.RestClient;

/**
 * 수집 배치 트리거 — 파이프라인 ①수집을 주 1회 시작시킨다.
 *
 * <p>크롤링 실행 자체는 Python collector 컨테이너가 담당하고(2026-09-15 결정),
 * Spring 은 설계서의 "Spring Scheduler 주 1회 트리거" 역할만 한다.
 * collector 는 202(시작)/409(이미 실행 중)를 반환하며, 실행 이력은
 * collection_runs 테이블에 collector 가 직접 남기므로 여기서는 기록하지 않는다.
 *
 * <p>bangtray.collector.enabled=true 인 환경(운영 compose)에서만 활성화된다.
 * 로컬/테스트에서는 빈 자체가 뜨지 않는다.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "bangtray.collector.enabled", havingValue = "true")
public class CollectorTriggerScheduler {

    private static final Logger log = LoggerFactory.getLogger(CollectorTriggerScheduler.class);

    private final RestClient restClient;

    public CollectorTriggerScheduler(
            @Value("${bangtray.collector.url:http://collector:8000}") String collectorUrl) {
        this.restClient = RestClient.builder().baseUrl(collectorUrl).build();
    }

    /** 매주 월요일 04:00 KST — 트래픽이 가장 적은 시간대. */
    @Scheduled(cron = "${bangtray.collector.cron:0 0 4 * * MON}", zone = "Asia/Seoul")
    public void triggerWeeklyCollection() {
        try {
            String body = restClient.post()
                    .uri("/collect")
                    .retrieve()
                    .body(String.class);
            log.info("수집 배치 트리거 완료: {}", body);
        } catch (Exception e) {
            // 다음 주기에 다시 시도하면 되므로 예외를 전파하지 않는다
            log.error("수집 배치 트리거 실패", e);
        }
    }
}
