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

/** 수집할 검색 조건 정의 (무엇을 수집하나). 실행 결과는 collection_runs에 누적 */
@Entity
@Table(name = "collection_queries")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class CollectionQuery {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, columnDefinition = "enum('tistory','instagram','naver_cafe','naver_blog')")
	private DocSource source;

	/** 검색 형식: 빵집 이름 + 빵명 */
	@Column(nullable = false, length = 200)
	private String queryText;

	@Column(name = "bakery_id")
	private Long bakeryId;

	@Column(name = "bread_id")
	private Integer breadId;

	/** 수집 대상에서 잠시 제외할 때 false (폐업 시에도 false) */
	@Column(nullable = false)
	@Builder.Default
	private boolean isActive = true;

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@PrePersist
	void onCreate() {
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	public void deactivate() {
		this.isActive = false;
	}
}
