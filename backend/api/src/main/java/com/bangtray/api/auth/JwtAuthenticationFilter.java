package com.bangtray.api.auth;

import com.bangtray.api.common.BusinessException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authorization: Bearer {accessToken} 검증.
 * 토큰이 없거나 무효면 인증 없이 통과 → 보호 엔드포인트에서 401 (EntryPoint가 공통 규격으로 응답).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtProvider jwtProvider;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {
		String header = request.getHeader("Authorization");
		if (header != null && header.startsWith("Bearer ")) {
			try {
				Long userId = jwtProvider.parseUserId(header.substring(7), JwtProvider.TYPE_ACCESS);
				var authentication = new UsernamePasswordAuthenticationToken(
						userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
				SecurityContextHolder.getContext().setAuthentication(authentication);
			} catch (BusinessException ignored) {
				// 무효 토큰은 미인증으로 처리 — 보호 자원 접근 시 EntryPoint가 401 반환
			}
		}
		filterChain.doFilter(request, response);
	}
}
