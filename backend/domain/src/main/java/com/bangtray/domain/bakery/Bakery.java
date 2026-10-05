package com.bangtray.domain.bakery;

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

@Entity
@Table(name = "bakeries")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Bakery {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false, length = 255)
	private String address;

	@Column(length = 30)
	private String district;

	/** 네이버/카카오 지도 장소 페이지 링크 — 좌표 대신 링크로 위치 연결 */
	@Column(length = 500)
	private String mapUrl;

	@Column(length = 500)
	private String linkUrl;

	@Column(length = 500)
	private String imageUrl;

	/** 폐업 = false → 추천·목록 제외, 과거 데이터는 보존 */
	@Column(nullable = false)
	@Builder.Default
	private boolean isOpen = true;

	private LocalDateTime closedAt;

	/** 지도 API로 영업 여부를 마지막으로 확인한 시각 (폐업 감지 배치가 갱신) */
	private LocalDateTime lastVerifiedAt;

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@PrePersist
	void onCreate() {
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	public void close() {
		this.isOpen = false;
		this.closedAt = LocalDateTime.now();
	}

	public void verifyOpen() {
		this.lastVerifiedAt = LocalDateTime.now();
	}
}
