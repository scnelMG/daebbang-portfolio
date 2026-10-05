package com.bangtray.batch.label;

import com.bangtray.domain.bread.Tag;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * ③ LLM 라벨 추출 — 리뷰 1건 + 그 빵의 활성 태그 사전을 주고 "언급된 태그"만 고르게 한다 (0/1 분류).
 * 절대 점수를 매기지 않는다 (재현성·검증 가능성 원칙 — 점수는 ④ Spark 집계가 계산).
 * 프롬프트에 동의어 매핑을 명시해 리뷰 표현이 무엇이든 한 태그로 수렴시킨다 (예: 구멍/벌집 → 기공).
 */
@Component
public class LlmLabelClient {

	/** 순차 호출 간격 — LLM API rate limit(429) 예방 */
	private static final long REQUEST_DELAY_MS = 500;
	private static final int MAX_TEXT_LEN = 3_000; // 리뷰 본문 프롬프트 상한 (비용·컨텍스트 절약)

	/** 동의어 → 대표 태그 수렴 힌트 (2026-09-07 확정: 구멍/벌집 → 기공. 추가는 태그 사전 확정 절차를 거칠 것) */
	private static final Map<String, String> SYNONYM_HINTS = Map.of(
			"기공", "구멍, 벌집");

	/** 근본/사파 유형 태그 판정 기준 — 해석이 필요한 판정이라 프롬프트에 기준을 명시 */
	private static final Map<String, String> TYPE_TAG_GUIDE = Map.of(
			"근본", "정석적·클래식한 빵이라는 평가가 명확할 때만",
			"사파", "정석에서 벗어나거나 기존 상식과 다른 빵이라는 평가가 명확할 때만");

	private static final String SYSTEM_PROMPT = """
			너는 대전 빵집 리뷰에서 특정 빵에 대한 언급을 분류하는 라벨러다.
			반드시 {"visit_review": true|false, "tags": ["태그명", ...]} 형식의 JSON만 출력한다.

			visit_review 판정 — 지정된 "대전 소재 빵집 매장"을 실제로 방문·구매한 후기라는
			명확한 근거(매장 방문, 대전 위치, 그 가게에서 산 빵의 경험)가 있을 때만 true.
			다음은 전부 false: 홈베이킹·요리법·레시피 소개 글, 다른 브랜드·프랜차이즈·마트 제품 리뷰,
			가게 이름과 같은 일반 단어가 우연히 쓰인 글, 어느 가게인지 불분명한 글.
			주의: 가게 이름이 '레시피', '시나몬'처럼 일반 단어와 같을 수 있다 — 단어 등장은 근거가 아니다.

			tags는 visit_review가 true일 때만 고른다. 리뷰가 실제로 언급한 태그만, 점수·순위는 절대 매기지 않는다.
			visit_review가 false면 {"visit_review": false, "tags": []}.""";

	private final HttpClient http = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.build();
	private final ObjectMapper objectMapper = new ObjectMapper();
	private final LabelProperties properties;

	public LlmLabelClient(LabelProperties properties) {
		this.properties = properties;
	}

	/** API 키가 설정돼 있어야만 라벨링 가능 (키 없이 기동하면 잡이 건너뜀) */
	public boolean isEnabled() {
		return properties.apiKey() != null && !properties.apiKey().isBlank();
	}

	/** 리뷰가 언급한 태그명 목록을 반환. 사전 검증(존재 확인)은 호출 측 책임 */
	public List<String> extractTags(String reviewText, String bakeryName, String breadName, List<Tag> dictionary)
			throws IOException, InterruptedException {
		Thread.sleep(REQUEST_DELAY_MS);

		ObjectNode payload = objectMapper.createObjectNode();
		payload.put("model", properties.model());
		payload.put("temperature", 0);
		payload.set("response_format", objectMapper.createObjectNode().put("type", "json_object"));
		ArrayNode messages = payload.putArray("messages");
		messages.addObject().put("role", "system").put("content", SYSTEM_PROMPT);
		messages.addObject().put("role", "user")
				.put("content", buildUserPrompt(reviewText, bakeryName, breadName, dictionary));

		HttpRequest request = HttpRequest.newBuilder(URI.create(properties.apiUrl()))
				.header("Authorization", "Bearer " + properties.apiKey())
				.header("Content-Type", "application/json")
				.timeout(Duration.ofSeconds(60))
				.POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
				.build();
		HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
		if (response.statusCode() != 200) {
			throw new IOException("LLM API HTTP " + response.statusCode() + ": " + snippet(response.body()));
		}

		String content = objectMapper.readTree(response.body())
				.path("choices").path(0).path("message").path("content").asText();
		JsonNode parsed = objectMapper.readTree(content);
		// 관련성 게이트: 방문 후기가 아니라고 판정되면 태그를 버린다 (명시 필드 강제 — 암묵 판단은 새는 사례 있었음)
		if (!parsed.path("visit_review").asBoolean(false)) {
			return List.of();
		}
		JsonNode tags = parsed.path("tags");
		List<String> result = new ArrayList<>();
		for (JsonNode tag : tags) {
			result.add(tag.asText());
		}
		return result;
	}

	private String buildUserPrompt(String reviewText, String bakeryName, String breadName, List<Tag> dictionary) {
		StringBuilder sb = new StringBuilder();
		sb.append("[빵집]: ").append(bakeryName).append(" (대전 소재 빵집)\n");
		sb.append("[빵]: ").append(breadName).append('\n');
		sb.append("[태그 후보 — 아래 이름 그대로만 사용]\n");
		for (Tag tag : dictionary) {
			sb.append("- ").append(tag.getName());
			String synonyms = SYNONYM_HINTS.get(tag.getName());
			if (synonyms != null) {
				sb.append(" (동의어: ").append(synonyms).append(" — 표현이 달라도 이 태그로 수렴)");
			}
			String guide = tag.isTypeTag() ? TYPE_TAG_GUIDE.get(tag.getName()) : null;
			if (guide != null) {
				sb.append(" (유형 태그: ").append(guide).append(')');
			}
			sb.append('\n');
		}
		sb.append("""
				[규칙]
				0. 먼저 visit_review를 판정한다 — 위 빵집 매장 방문·구매 후기라는 명확한 근거가 없으면 false.
				1. 리뷰가 이 빵에 대해 실제로 언급한 특징 태그만 고른다.
				2. 후보에 없는 태그를 만들지 않는다.
				3. 표현이 달라도 의미가 같으면 해당 태그로 수렴시킨다.
				4. '근본'과 '사파'는 근거가 명확할 때만 고르고, 절대 동시에 넣지 않는다.
				[리뷰]
				""");
		sb.append(reviewText.length() > MAX_TEXT_LEN ? reviewText.substring(0, MAX_TEXT_LEN) : reviewText);
		return sb.toString();
	}

	private String snippet(String body) {
		return body == null ? "" : body.substring(0, Math.min(body.length(), 300));
	}
}
