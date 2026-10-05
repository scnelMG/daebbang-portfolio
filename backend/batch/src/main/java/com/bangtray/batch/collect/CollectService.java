package com.bangtray.batch.collect;

import com.bangtray.batch.collect.TistoryClient.CrawledPost;
import com.bangtray.batch.collect.TistoryClient.SearchEntry;
import com.bangtray.domain.bakery.Bakery;
import com.bangtray.domain.bakery.BakeryRepository;
import com.bangtray.domain.bread.Bread;
import com.bangtray.domain.bread.BreadRepository;
import com.bangtray.domain.collection.CollectionQuery;
import com.bangtray.domain.collection.CollectionRun;
import com.bangtray.domain.collection.CollectionRunRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

/**
 * 쿼리 1건의 수집(①)+전처리(②): 검색 → 이름 필터 → 크롤 → 정제 → 중복 제거 → Mongo 적재.
 * 실행 1회 = collection_runs 1행 (누적, 실패 추적 — 덮어쓰지 않음).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CollectService {

	private static final int MIN_TEXT_LEN = 100; // 이보다 짧으면 파싱 실패로 간주

	private final TistoryClient tistory;
	private final CollectionRunRepository runRepository;
	private final BakeryRepository bakeryRepository;
	private final BreadRepository breadRepository;
	private final MongoTemplate mongoTemplate;
	private final CollectProperties properties;

	public void collect(CollectionQuery query) {
		CollectionRun run = runRepository.save(CollectionRun.builder().queryId(query.getId()).build());
		try {
			String bakeryName = query.getBakeryId() == null ? null
					: bakeryRepository.findById(query.getBakeryId()).map(Bakery::getName).orElse(null);
			String breadName = query.getBreadId() == null ? null
					: breadRepository.findById(query.getBreadId()).map(Bread::getName).orElse(null);

			List<SearchEntry> entries = tistory.search(query.getQueryText(), properties.pages());

			// 제목/요약에 빵집명이 없는 글은 크롤 전에 컷 (bread-pipeline 검증 필터)
			Set<String> seenUrls = new HashSet<>();
			List<SearchEntry> candidates = entries.stream()
					.filter(e -> e.url().contains("tistory.com"))
					.filter(e -> bakeryName == null
							|| e.title().contains(bakeryName) || e.summary().contains(bakeryName))
					.filter(e -> seenUrls.add(e.url()))
					.limit(properties.maxPerQuery())
					.toList();

			int inserted = 0;
			int duplicated = 0;
			int failed = 0;
			for (SearchEntry entry : candidates) {
				CrawledPost post = tistory.fetchPost(entry.url());
				if (post == null) {
					failed++;
					continue;
				}
				String cleaned = TextCleaner.clean(post.rawText());
				if (cleaned.length() < MIN_TEXT_LEN) {
					failed++;
					continue;
				}
				CleanedReview review = CleanedReview.builder()
						.source(query.getSource().name())
						.url(entry.url())
						.shopId(query.getBakeryId())
						.breadType(breadName)
						.breadId(query.getBreadId())
						.title(post.title())
						.cleanedText(cleaned)
						.rawText(post.rawText())
						.contentHash(TextCleaner.sha256(cleaned))
						.publishedAt(post.publishedAt() != null ? post.publishedAt() : entry.publishedAt())
						.collectedAt(Instant.now())
						.runId(run.getId())
						.labeled(false)
						.build();
				try {
					mongoTemplate.insert(review);
					inserted++;
				} catch (DuplicateKeyException e) {
					duplicated++; // 같은 본문(content_hash) — 정상 스킵
				}
			}
			run.succeed(inserted);
			log.info("[수집] '{}' 검색 {} → 후보 {} → 적재 {} (중복 {}, 실패 {})",
					query.getQueryText(), entries.size(), candidates.size(), inserted, duplicated, failed);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			run.fail("interrupted: " + e.getMessage());
		} catch (Exception e) {
			run.fail(e.toString());
			log.warn("[수집] '{}' 실패", query.getQueryText(), e);
		} finally {
			runRepository.save(run);
		}
	}
}
