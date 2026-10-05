package com.bangtray.domain.score;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * ④ Spark 집계 배치의 결과 — 추천 엔진이 읽는 유일한 테이블 (온라인 경로는 이 테이블 조회뿐).
 * 매 실행 전체 재계산(full refresh). 분자·분모·alpha·formula_version을 함께 저장해
 * "이 점수가 어떻게 나왔나"를 항상 재계산·검증 가능.
 */
@Entity
@Table(name = "bakery_bread_tag_scores")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class BakeryBreadTagScore {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "bakery_id", nullable = false)
	private Long bakeryId;

	@Column(name = "bread_id", nullable = false)
	private Integer breadId;

	@Column(name = "tag_id", nullable = false)
	private Integer tagId;

	/** 이 특징이 언급된 외부 문서 수 (분자) */
	@Column(nullable = false)
	@Builder.Default
	private int externalCount = 0;

	/** 이 빵집×빵의 전체 외부 문서 수 (분모) */
	@Column(nullable = false)
	@Builder.Default
	private int externalSampleCount = 0;

	@Column(nullable = false)
	@Builder.Default
	private int internalCount = 0;

	@Column(nullable = false)
	@Builder.Default
	private int internalSampleCount = 0;

	@Column(precision = 8, scale = 4)
	private BigDecimal externalScore;

	@Column(precision = 8, scale = 4)
	private BigDecimal internalScore;

	/** m-추정 파라미터 — 행 단위 저장으로 과거 점수 재현 가능 (명세서 확정 v1-mest) */
	@Column(precision = 6, scale = 3)
	private BigDecimal mExt;

	@Column(precision = 6, scale = 3)
	private BigDecimal mInt;

	/** μ: (bread, tag) 조합별 전체 빵집 평균 비율 — 집계 배치가 매회 계산 */
	@Column(precision = 8, scale = 4)
	private BigDecimal muExt;

	@Column(precision = 8, scale = 4)
	private BigDecimal muInt;

	/** 이번 계산에 사용한 내부 가중치 (0~1) */
	@Column(nullable = false, precision = 4, scale = 3)
	private BigDecimal alpha;

	/** = alpha×internal + (1−alpha)×external */
	@Column(nullable = false, precision = 8, scale = 4)
	private BigDecimal finalScore;

	/** 보정 공식 버전 (예: v1-halflife180) — 점수 재현·검증 근거 */
	@Column(nullable = false, length = 20)
	private String formulaVersion;

	@Column(nullable = false)
	private LocalDateTime calculatedAt;

	@PrePersist
	void onCreate() {
		if (calculatedAt == null) {
			calculatedAt = LocalDateTime.now();
		}
	}
}
