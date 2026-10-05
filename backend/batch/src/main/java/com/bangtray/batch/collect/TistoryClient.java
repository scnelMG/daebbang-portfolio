package com.bangtray.batch.collect;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

/**
 * 티스토리 검색 + 본문 크롤링 (bread-pipeline에서 검증된 방식의 Java 이식).
 *
 * 검색: www.tistory.com/api/v1/search/posts — 비공식 내부 API(키 불필요),
 *   검색어당 최대 ~540건(18페이지×30건)에서 잘림. 스펙이 바뀌면 이 클래스만 수정.
 * 본문: JSON-LD(BlogPosting) 발행일 + contents_style 셀렉터(구스킨 폴백) + 광고 제거.
 * 예절(DATA-022): 소스 전체 동시 요청 2개 제한 + 검색 0.5초 / 본문 1.0초 간격.
 */
@Component
public class TistoryClient {

	private static final String SEARCH_API = "https://www.tistory.com/api/v1/search/posts";
	private static final String UA =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
	private static final List<String> CONTENT_SELECTORS = List.of(
			".contents_style", ".entry-content", ".article_view", ".tt_article_useless_p_margin");
	private static final String JUNK_SELECTOR =
			"script, style, iframe, ins, .revenue_unit_item, .container_postbtn, .another_category";
	private static final long SEARCH_DELAY_MS = 500;
	private static final long CRAWL_DELAY_MS = 1_000;

	private final HttpClient http = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.followRedirects(HttpClient.Redirect.NORMAL)
			.build();
	private final ObjectMapper objectMapper = new ObjectMapper();
	private final Semaphore permits = new Semaphore(2);

	public record SearchEntry(String url, String title, String summary, Instant publishedAt) {
	}

	public record CrawledPost(String rawText, String title, Instant publishedAt) {
	}

	/** 검색어 하나로 글 메타(제목/요약/URL/발행일) 목록을 반환 */
	public List<SearchEntry> search(String query, int pages) throws IOException, InterruptedException {
		List<SearchEntry> entries = new ArrayList<>();
		for (int page = 1; page <= pages; page++) {
			String url = SEARCH_API + "?keyword=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
					+ "&page=" + page + "&sort=ACCURACY";
			JsonNode data = getJson(url).path("data");
			for (JsonNode e : data.path("searchedEntries")) {
				entries.add(new SearchEntry(
						e.path("entryUrl").asText(),
						e.path("entryTitle").asText(""),
						e.path("entrySummary").asText(""),
						parseInstant(e.path("entryPublished"))));
			}
			if (data.path("nextPage").isMissingNode() || data.path("nextPage").isNull()) {
				break;
			}
		}
		return entries;
	}

	/** 본문 크롤링. 파싱 실패(비티스토리 스킨, 삭제된 글 등)는 null */
	public CrawledPost fetchPost(String url) throws InterruptedException {
		Document doc;
		try {
			permits.acquire();
			try {
				Thread.sleep(CRAWL_DELAY_MS);
				doc = Jsoup.connect(url).userAgent(UA).timeout(10_000).get();
			} finally {
				permits.release();
			}
		} catch (IOException e) {
			return null;
		}

		Element body = CONTENT_SELECTORS.stream()
				.map(doc::selectFirst)
				.filter(el -> el != null)
				.findFirst()
				.orElse(null);
		if (body == null) {
			return null;
		}
		body.select(JUNK_SELECTOR).remove();

		Instant published = null;
		for (Element script : doc.select("script[type=application/ld+json]")) {
			try {
				JsonNode node = objectMapper.readTree(script.data());
				if ("BlogPosting".equals(node.path("@type").asText())) {
					published = parseInstant(node.path("datePublished"));
					break;
				}
			} catch (IOException ignored) {
				// JSON-LD가 깨진 스킨은 발행일 없이 진행
			}
		}
		return new CrawledPost(body.wholeText(), doc.title(), published);
	}

	private JsonNode getJson(String url) throws IOException, InterruptedException {
		permits.acquire();
		try {
			Thread.sleep(SEARCH_DELAY_MS);
			HttpRequest request = HttpRequest.newBuilder(URI.create(url))
					.header("User-Agent", UA)
					.timeout(Duration.ofSeconds(10))
					.GET()
					.build();
			HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() != 200) {
				throw new IOException("search API HTTP " + response.statusCode());
			}
			return objectMapper.readTree(response.body());
		} finally {
			permits.release();
		}
	}

	private Instant parseInstant(JsonNode node) {
		if (node == null || node.isMissingNode() || node.isNull()) {
			return null;
		}
		if (node.isNumber()) {
			return Instant.ofEpochMilli(node.asLong());
		}
		try {
			return OffsetDateTime.parse(node.asText()).toInstant();
		} catch (Exception e) {
			return null;
		}
	}
}
