package com.bangtray.domain.collection;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/** 실행 1회 = 1행. 덮어쓰지 않고 누적 — 과거 성공/실패 이력·오류 원인 추적용 */
@Entity
@Table(name = "collection_runs")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class CollectionRun {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "query_id", nullable = false)
	private Long queryId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, columnDefinition = "enum('running','success','failed')")
	@Builder.Default
	private RunStatus status = RunStatus.running;

	@Column(nullable = false, updatable = false)
	private LocalDateTime startedAt;

	private LocalDateTime finishedAt;

	/** 이번 실행에서 새로 저장된 문서 수 */
	@Column(nullable = false)
	@Builder.Default
	private int collectedCount = 0;

	@Column(length = 500)
	private String errorMessage;

	@PrePersist
	void onCreate() {
		if (startedAt == null) {
			startedAt = LocalDateTime.now();
		}
	}

	public void succeed(int collectedCount) {
		this.status = RunStatus.success;
		this.collectedCount = collectedCount;
		this.finishedAt = LocalDateTime.now();
	}

	public void fail(String errorMessage) {
		this.status = RunStatus.failed;
		this.errorMessage = errorMessage == null ? null
				: errorMessage.substring(0, Math.min(errorMessage.length(), 500));
		this.finishedAt = LocalDateTime.now();
	}
}
