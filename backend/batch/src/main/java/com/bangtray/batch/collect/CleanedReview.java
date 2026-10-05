package com.bangtray.batch.collect;

import java.time.Instant;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * MongoDB cleaned_reviews — 리뷰 원문·메타의 단일 원천 (설계 원칙: MySQL 이중 저장 금지).
 * content_hash 유니크 인덱스가 중복 저장을 거부한다 (mongo-init.js).
 */
@Document(collection = "cleaned_reviews")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class CleanedReview {

	@Id
	private String id;

	private String source;

	private String url;

	@Field("shop_id")
	private Long shopId;

	@Field("bread_type")
	private String breadType;

	@Field("bread_id")
	private Integer breadId;

	private String title;

	@Field("cleaned_text")
	private String cleanedText;

	/** 재정제 대비 원문 보존 (DATA-005) */
	@Field("raw_text")
	private String rawText;

	@Field("content_hash")
	private String contentHash;

	/** ④ 시간 가중치 계산용 발행일 */
	@Field("published_at")
	private Instant publishedAt;

	@Field("collected_at")
	private Instant collectedAt;

	/** collection_runs.id — 어느 실행이 가져왔나 */
	@Field("run_id")
	private Long runId;

	/** ③ LLM 라벨링 증분 처리 플래그 */
	private boolean labeled;
}
