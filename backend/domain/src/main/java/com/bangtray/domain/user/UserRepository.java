package com.bangtray.domain.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByEmailAndProvider(String email, AuthProvider provider);

	/** 소셜 로그인 조회 — 계정 식별은 이메일이 아니라 (provider, provider_id) (AUTH-015 계정 분리) */
	Optional<User> findByProviderAndProviderId(AuthProvider provider, String providerId);

	boolean existsByNickname(String nickname);

	boolean existsByEmail(String email);
}
