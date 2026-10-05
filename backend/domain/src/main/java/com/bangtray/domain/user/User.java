package com.bangtray.domain.user;

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

@Entity
@Table(name = "users")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(length = 255)
	private String email;

	@Column(name = "password_hash", length = 255)
	private String passwordHash;

	@Column(nullable = false, length = 50)
	private String nickname;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, columnDefinition = "enum('local','kakao','naver','google')")
	@Builder.Default
	private AuthProvider provider = AuthProvider.local;

	@Column(name = "provider_id", length = 255)
	private String providerId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, columnDefinition = "enum('active','withdrawn')")
	@Builder.Default
	private UserStatus status = UserStatus.active;

	private LocalDateTime withdrawnAt;

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@PrePersist
	void onCreate() {
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}

	/** 탈퇴 = 익명화. 행은 보존 (chk_withdrawn 제약과 일치해야 함) */
	public void withdraw() {
		this.status = UserStatus.withdrawn;
		this.withdrawnAt = LocalDateTime.now();
		this.email = null;
		this.passwordHash = null;
		this.providerId = null;
		this.nickname = "탈퇴한사용자_" + id;  // 명세서 미확정 #6 문구 기준
	}
}
