package com.bangtray.api.auth;

import com.bangtray.api.auth.dto.LoginRequest;
import com.bangtray.api.auth.dto.SignupRequest;
import com.bangtray.api.auth.dto.TokenResponse;
import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.bangtray.domain.user.AuthProvider;
import com.bangtray.domain.user.User;
import com.bangtray.domain.user.UserRepository;
import com.bangtray.domain.user.UserStatus;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

	private static final int NICKNAME_MAX_LENGTH = 20;
	private static final int NICKNAME_RETRY = 5;

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtProvider jwtProvider;
	private final GoogleTokenVerifier googleTokenVerifier;

	@Transactional
	public Long signup(SignupRequest request) {
		if (!request.password().equals(request.passwordConfirm())) {
			throw new BusinessException(ErrorCode.PASSWORD_MISMATCH);
		}
		if (!Boolean.TRUE.equals(request.termsAgreed()) || !Boolean.TRUE.equals(request.privacyAgreed())) {
			throw new BusinessException(ErrorCode.TERMS_NOT_AGREED);
		}
		if (userRepository.existsByNickname(request.nickname())) {
			throw new BusinessException(ErrorCode.DUPLICATE_NICKNAME);
		}
		if (userRepository.existsByEmail(request.email())) {
			throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
		}
		User user = User.builder()
				.nickname(request.nickname())
				.email(request.email())
				.passwordHash(passwordEncoder.encode(request.password()))
				.build(); // provider=local, status=active 기본값
		return userRepository.save(user).getId();
	}

	public boolean isNicknameAvailable(String nickname) {
		return !userRepository.existsByNickname(nickname);
	}

	public boolean isEmailAvailable(String email) {
		return !userRepository.existsByEmail(email);
	}

	public TokenResponse login(LoginRequest request) {
		// AUTH-007: 계정 없음 / 비밀번호 불일치 / 탈퇴를 같은 문구(INVALID_CREDENTIALS)로 응답
		User user = userRepository.findByEmailAndProvider(request.email(), AuthProvider.local)
				.orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));
		if (user.getStatus() != UserStatus.active
				|| !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
		}
		return issueTokens(user);
	}

	public TokenResponse refresh(String refreshToken) {
		Long userId = jwtProvider.parseUserId(refreshToken, JwtProvider.TYPE_REFRESH);
		User user = userRepository.findById(userId)
				.filter(u -> u.getStatus() == UserStatus.active)
				.orElseThrow(() -> new BusinessException(ErrorCode.WITHDRAWN_USER));
		return issueTokens(user); // 리프레시 토큰도 회전(rotate)
	}

	/**
	 * 구글 로그인 (AUTH-008) — 가입과 로그인을 한 번에 처리한다.
	 * 계정 식별은 이메일이 아니라 (provider=google, provider_id=구글 sub):
	 * 같은 이메일이라도 로컬 계정과는 별개 계정으로 취급한다 (AUTH-015).
	 */
	@Transactional
	public TokenResponse loginWithGoogle(String idToken) {
		GoogleTokenVerifier.GoogleAccount account = googleTokenVerifier.verify(idToken);
		User user = userRepository
				.findByProviderAndProviderId(AuthProvider.google, account.sub())
				.map(existing -> {
					if (existing.getStatus() != UserStatus.active) {
						throw new BusinessException(ErrorCode.WITHDRAWN_USER);
					}
					return existing;
				})
				.orElseGet(() -> registerGoogleUser(account));
		return issueTokens(user);
	}

	private User registerGoogleUser(GoogleTokenVerifier.GoogleAccount account) {
		// email UNIQUE 제약: 로컬 계정 등이 이미 쓰는 주소면 NULL로 둔다
		// (소셜 계정은 provider_id로 식별되므로 이메일 없이도 동작 — ERD "소셜 무이메일 가입")
		String email = (account.email() == null || userRepository.existsByEmail(account.email()))
				? null : account.email();
		return userRepository.save(User.builder()
				.nickname(generateUniqueNickname(account.name()))
				.email(email)
				.provider(AuthProvider.google)
				.providerId(account.sub())
				.build()); // passwordHash는 null — chk_social 제약과 일치
	}

	/** 구글 이름을 기본값으로 쓰되 nickname UNIQUE 충돌 시 숫자 접미사를 붙인다 */
	private String generateUniqueNickname(String googleName) {
		String base = googleName == null ? "" : googleName.replaceAll("[^가-힣a-zA-Z0-9]", "");
		if (base.isBlank()) {
			base = "빵친구";
		}
		if (base.length() > NICKNAME_MAX_LENGTH) {
			base = base.substring(0, NICKNAME_MAX_LENGTH);
		}
		if (!userRepository.existsByNickname(base)) {
			return base;
		}
		for (int i = 0; i < NICKNAME_RETRY; i++) {
			String candidate = base + ThreadLocalRandom.current().nextInt(1000, 10000);
			if (!userRepository.existsByNickname(candidate)) {
				return candidate;
			}
		}
		return base + UUID.randomUUID().toString().substring(0, 8);
	}

	@Transactional
	public void withdraw(Long userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
		user.withdraw(); // 익명화 — 행 보존 (설계 원칙)
	}

	private TokenResponse issueTokens(User user) {
		return new TokenResponse(
				jwtProvider.createAccessToken(user.getId()),
				jwtProvider.createRefreshToken(user.getId()),
				user.getId(),
				user.getNickname());
	}
}
