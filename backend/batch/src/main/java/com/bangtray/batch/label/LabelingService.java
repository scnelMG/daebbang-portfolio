package com.bangtray.batch.label;

import com.bangtray.batch.collect.CleanedReview;
import com.bangtray.domain.bakery.Bakery;
import com.bangtray.domain.bakery.BakeryRepository;
import com.bangtray.domain.bread.Tag;
import com.bangtray.domain.bread.TagRepository;
import com.bangtray.domain.label.DocumentLabel;
import com.bangtray.domain.label.DocumentLabelRepository;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * 문서 1건의 라벨링(③): 태그 사전 조회 → LLM 분류 → 사전 검증 → document_labels INSERT
 * → Mongo labeled:true 갱신. UNIQUE(mongo_doc_id, tag_id)가 재실행 멱등성을 보장한다.
 * LLM 호출 실패는 예외로 전파 — labeled:false로 남아 다음 실행에서 재시도된다.
 *
 * [원자성 정책 — 의도된 설계] 트랜잭션 경계를 두지 않는다(스텝은 ResourcelessTransactionManager).
 * save()는 태그 단위로 즉시 커밋되므로, 중간 실패나 Mongo 갱신 직전 실패 시
 * "MySQL 라벨 일부 존재 + Mongo labeled:false" 상태가 될 수 있다. 이는 오류가 아니라
 * 재시도 단위다: 다음 실행이 같은 문서를 다시 처리하면 exists 선확인 + UNIQUE 제약이
 * 이미 저장된 태그를 건너뛰고 나머지만 채운 뒤 labeled:true로 마감한다 (중복·유실 없음).
 * MySQL-Mongo 간 분산 트랜잭션은 이 규모에서 비용 대비 이득이 없어 채택하지 않았다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LabelingService {

	private static final ZoneId KST = ZoneId.of("Asia/Seoul");

	private final TagRepository tagRepository;
	private final DocumentLabelRepository labelRepository;
	private final BakeryRepository bakeryRepository;
	private final LlmLabelClient llm;
	private final MongoTemplate mongoTemplate;

	/** @return 새로 저장한 라벨 수 */
	public int label(CleanedReview review) throws IOException, InterruptedException {
		List<Tag> dictionary = tagRepository.findActiveByBreadId(review.getBreadId());
		// 가게명을 프롬프트에 넘겨 관련성 게이트(방문 후기가 아니면 라벨 0) 판단 근거로 사용 —
		// 일반명사 가게명(레시피·시나몬)이 무관 글을 쓸어오는 오염 대응 (project issue)
		String bakeryName = bakeryRepository.findById(review.getShopId())
				.map(Bakery::getName).orElse("(이름 미상)");
		List<String> mentioned = llm.extractTags(
				review.getCleanedText(), bakeryName, review.getBreadType(), dictionary);

		// 사전 검증: 사전에 없는 태그는 버림 (복합 FK (tag_id, bread_id)가 최종 안전망)
		Map<String, Tag> byName = dictionary.stream().collect(Collectors.toMap(Tag::getName, Function.identity()));
		List<Tag> valid = mentioned.stream()
				.distinct()
				.map(byName::get)
				.filter(Objects::nonNull)
				.toList();
		if (valid.size() < mentioned.stream().distinct().count()) {
			log.warn("[라벨링] 사전에 없는 태그 응답 무시 (doc={}, 응답={})", review.getId(), mentioned);
		}

		// 근본·사파 동시 부여 금지 — 프롬프트 위반 시 판정 불확실로 보고 유형 태그를 모두 버린다
		boolean conflictingType = valid.stream().filter(Tag::isTypeTag).count() > 1;
		if (conflictingType) {
			log.warn("[라벨링] 근본·사파 동시 응답 — 유형 태그 제외 (doc={})", review.getId());
			valid = valid.stream().filter(t -> !t.isTypeTag()).toList();
		}

		LocalDateTime publishedAt = review.getPublishedAt() == null ? null
				: LocalDateTime.ofInstant(review.getPublishedAt(), KST);
		int saved = 0;
		for (Tag tag : valid) {
			if (labelRepository.existsByMongoDocIdAndTagId(review.getId(), tag.getId())) {
				continue;
			}
			try {
				labelRepository.save(DocumentLabel.builder()
						.mongoDocId(review.getId())
						.bakeryId(review.getShopId())
						.breadId(review.getBreadId())
						.tagId(tag.getId())
						.publishedAt(publishedAt)
						.build());
				saved++;
			} catch (DataIntegrityViolationException e) {
				// 동시 실행 레이스 — UNIQUE 제약이 거부한 것이므로 정상 스킵
			}
		}

		mongoTemplate.updateFirst(
				Query.query(Criteria.where("_id").is(review.getId())),
				Update.update("labeled", true),
				CleanedReview.class);
		return saved;
	}
}
