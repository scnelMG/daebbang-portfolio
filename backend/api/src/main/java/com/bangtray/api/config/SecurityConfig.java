package com.bangtray.api.config;

import com.bangtray.api.auth.JwtAuthenticationFilter;
import com.bangtray.api.common.ApiResponse;
import com.bangtray.api.common.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.Customizer;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

	private final JwtAuthenticationFilter jwtAuthenticationFilter;
	// Boot 4는 ObjectMapper 빈을 기본 제공하지 않음 — 401 응답 직렬화 전용으로 직접 생성
	private final ObjectMapper objectMapper = new ObjectMapper();

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
				.csrf(csrf -> csrf.disable())
				.formLogin(form -> form.disable())
				.httpBasic(basic -> basic.disable())
				.cors(Customizer.withDefaults())   // CorsConfigurationSource 빈을 사용
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/api/auth/**").permitAll()
						// 비회원 허용 범위(AUTH-016): 홈·빵집 상세·트레이(마스터 조회). 추천·리뷰·저장은 회원 전용
						.requestMatchers(HttpMethod.GET, "/api/breads/**", "/api/bakeries/**").permitAll()
						.anyRequest().authenticated())
				.exceptionHandling(handler -> handler.authenticationEntryPoint(unauthorizedEntryPoint()))
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
		return http.build();
	}

	/** 401도 공통 응답 규격으로 */
	private AuthenticationEntryPoint unauthorizedEntryPoint() {
		return (request, response, authException) -> {
			response.setStatus(ErrorCode.UNAUTHORIZED.getStatus().value());
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			response.setCharacterEncoding("UTF-8");
			response.getWriter().write(
					objectMapper.writeValueAsString(ApiResponse.error(ErrorCode.UNAUTHORIZED)));
		};
	}

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	/**
	 * 허용 출처는 환경변수 CORS_ALLOWED_ORIGINS(쉼표 구분)로 덮어쓸 수 있다.
	 * 주의: 브라우저는 같은 출처라도 POST 등에는 Origin 헤더를 보내므로, 배포 도메인이 목록에 없으면
	 * 프론트의 모든 쓰기 요청이 403 "Invalid CORS request"로 막힌다 (2026-09-15 실제 장애).
	 */
	@Bean
	public CorsConfigurationSource corsConfigurationSource(
			@Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOrigins(allowedOrigins);
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		config.setAllowedHeaders(List.of("*"));
		config.setAllowCredentials(true);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", config);
		return source;
	}
}
