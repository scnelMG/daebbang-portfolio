package com.bangtray.api.auth;

import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtProvider {

	public static final String TYPE_ACCESS = "access";
	public static final String TYPE_REFRESH = "refresh";

	private final SecretKey key;
	private final long accessValidityMs;
	private final long refreshValidityMs;

	public JwtProvider(JwtProperties properties) {
		this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
		this.accessValidityMs = properties.accessValidityMs();
		this.refreshValidityMs = properties.refreshValidityMs();
	}

	public String createAccessToken(Long userId) {
		return create(userId, TYPE_ACCESS, accessValidityMs);
	}

	public String createRefreshToken(Long userId) {
		return create(userId, TYPE_REFRESH, refreshValidityMs);
	}

	private String create(Long userId, String type, long validityMs) {
		Date now = new Date();
		return Jwts.builder()
				.subject(String.valueOf(userId))
				.claim("type", type)
				.issuedAt(now)
				.expiration(new Date(now.getTime() + validityMs))
				.signWith(key)
				.compact();
	}

	/** 검증 실패 시 BusinessException(EXPIRED_TOKEN / INVALID_TOKEN) */
	public Long parseUserId(String token, String expectedType) {
		try {
			Claims claims = Jwts.parser().verifyWith(key).build()
					.parseSignedClaims(token).getPayload();
			if (!expectedType.equals(claims.get("type", String.class))) {
				throw new BusinessException(ErrorCode.INVALID_TOKEN);
			}
			return Long.parseLong(claims.getSubject());
		} catch (ExpiredJwtException e) {
			throw new BusinessException(ErrorCode.EXPIRED_TOKEN);
		} catch (JwtException | IllegalArgumentException e) {
			throw new BusinessException(ErrorCode.INVALID_TOKEN);
		}
	}
}
