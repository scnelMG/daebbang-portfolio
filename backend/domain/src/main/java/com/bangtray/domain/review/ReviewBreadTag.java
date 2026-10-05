package com.bangtray.domain.review;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 리뷰 시 빵마다 클릭한 라벨 = 그대로 추천 데이터.
 * bread_id는 복합 FK 2개의 대상 — (review_bread_id, bread_id)와 (tag_id, bread_id)가
 * 같은 빵임을 DB가 강제하므로, 저장 시 반드시 부모 ReviewBread의 breadId를 넣을 것.
 * 빵당 최대 2개 제한은 앱(서비스 레이어) 검증.
 */
@Entity
@Table(name = "review_bread_tags")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ReviewBreadTag {

	@EmbeddedId
	private ReviewBreadTagId id;

	@Column(name = "bread_id", nullable = false)
	private Integer breadId;
}
