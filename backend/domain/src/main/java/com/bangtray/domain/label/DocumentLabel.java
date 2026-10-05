package com.bangtray.domain.label;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * ③ LLM 라벨링 결과. 긍정 라벨만 저장 — "행 존재 = 이 리뷰가 이 특징을 언급" 1회.
 * UNIQUE(mongo_doc_id, tag_id)가 재실행 멱등성 보장.
 * LLM은 태그 분류까지만 — 점수는 ④ Spark 집계가 계산 (재현성 원칙).
 */
@Entity
@Table(name = "document_labels")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class DocumentLabel {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** MongoDB cleaned_reviews._id (논리 참조, FK 아님) */
	@Column(nullable = false, columnDefinition = "char(24)")
	private String mongoDocId;

	@Column(name = "bakery_id", nullable = false)
	private Long bakeryId;

	@Column(name = "bread_id", nullable = false)
	private Integer breadId;

	@Column(name = "tag_id", nullable = false)
	private Integer tagId;

	/** 리뷰 작성일 — Mongo 도큐먼트에서 복사. ④ 시간 가중치 계산용 (조인 없이 순수 SQL) */
	private LocalDateTime publishedAt;

	@Column(nullable = false, updatable = false)
	private LocalDateTime labeledAt;

	@PrePersist
	void onCreate() {
		if (labeledAt == null) {
			labeledAt = LocalDateTime.now();
		}
	}
}
