package com.bangtray.domain.bread;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 빵별 태그 사전 — 사용자 선택/자체 리뷰/LLM 라벨링의 공용어.
 * 폐기는 is_active=false (물리 삭제 금지).
 */
@Entity
@Table(name = "tags")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Tag {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "bread_id", nullable = false)
	private Bread bread;

	@Column(nullable = false, length = 30)
	private String name;

	/** true면 맛·식감이 아니라 근본/사파 같은 유형 분류 태그 */
	@Column(nullable = false)
	@Builder.Default
	private boolean isTypeTag = false;

	@Column(nullable = false)
	@Builder.Default
	private boolean isActive = true;
}
