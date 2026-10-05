package com.bangtray.api.recommendation;

import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.bangtray.api.recommendation.RecommendationDtos.HistoryItem;
import com.bangtray.api.recommendation.RecommendationDtos.HistoryResult;
import com.bangtray.api.recommendation.RecommendationDtos.Reason;
import com.bangtray.api.recommendation.RecommendationDtos.RecommendRequest;
import com.bangtray.api.recommendation.RecommendationDtos.RecommendResponse;
import com.bangtray.api.recommendation.RecommendationDtos.ResultItem;
import com.bangtray.api.recommendation.RecommendationDtos.TrayBread;
import com.bangtray.api.recommendation.RecommendationDtos.TraySnapshotItem;
import com.bangtray.domain.bakery.Bakery;
import com.bangtray.domain.bakery.BakeryRepository;
import com.bangtray.domain.bakery.SavedBakeryRepository;
import com.bangtray.domain.bread.Tag;
import com.bangtray.domain.bread.TagRepository;
import com.bangtray.domain.recommendation.Recommendation;
import com.bangtray.domain.recommendation.RecommendationRepository;
import com.bangtray.domain.recommendation.RecommendationResult;
import com.bangtray.domain.recommendation.RecommendationResultRepository;
import com.bangtray.domain.score.BakeryBreadTagScore;
import com.bangtray.domain.score.BakeryBreadTagScoreRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * ⑤ 추천 (온라인 실시간) — 온라인 경로에 배치/Spark/LLM 없음: scores 조회 + 합성뿐.
 *
 * 확정 알고리즘 (docs/architecture.md):
 *  1) 빵 단위 점수 = 선택 태그 중 데이터 있는 태그들의 final_score 평균
 *  2) 후보 자격  = 담은 n종 중 ⌈n/2⌉종 이상 데이터가 있는 빵집만 (커버리지 편향 방지)
 *  3) 빵집 점수  = 데이터 있는 빵들의 평균 (결측 빵은 0이 아니라 제외 — 합산 금지)
 *  4) is_open=true 상위 2곳, 커버리지를 결과에 명시
 *  5) [2026-09-21 결정] 결과 3곳 = 점수 상위 2곳 + 무작위 1곳 (pickType=random).
 *     데이터가 없어 점수가 없는 빵집(106곳 중 42곳)도 노출될 기회를 주기 위한 '발견' 슬롯.
 *     점수 후보가 2곳 미만이면 부족한 슬롯도 무작위로 채워 결과가 비지 않게 한다
 *     (예: 빵 1종 + '사파' 태그처럼 어느 빵집도 점수가 없는 조합에서 results=[] 로 돌아가던 문제).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecommendationService {

	private static final int MAX_TRAY = 8;
	private static final int MAX_TAGS_PER_BREAD = 2;
	private static final int SCORE_RESULT_SIZE = 2;  // 점수 기반 슬롯
	private static final int TOTAL_RESULT_SIZE = 3;  // + 무작위 발견 슬롯
	private static final String PICK_SCORE = "score";
	private static final String PICK_RANDOM = "random";

	private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

	private final TagRepository tagRepository;
	private final BakeryRepository bakeryRepository;
	private final SavedBakeryRepository savedBakeryRepository;
	private final BakeryBreadTagScoreRepository scoreRepository;
	private final RecommendationRepository recommendationRepository;
	private final RecommendationResultRepository resultRepository;

	@Transactional
	public RecommendResponse recommend(Long userId, RecommendRequest request) {
		Map<Integer, Tag> activeTags = validateTray(request.tray());

		// (빵, 태그) 정확한 쌍만 사용 (조회는 IN 두 축으로 넓게)
		Set<Integer> breadIds = request.tray().stream().map(TrayBread::breadId)
				.collect(Collectors.toSet());
		Set<Integer> tagIds = request.tray().stream().flatMap(t -> t.tagIds().stream())
				.collect(Collectors.toSet());
		Set<String> wantedPairs = new HashSet<>();
		for (TrayBread tray : request.tray()) {
			for (Integer tagId : tray.tagIds()) {
				wantedPairs.add(tray.breadId() + ":" + tagId);
			}
		}
		List<BakeryBreadTagScore> scores = scoreRepository
				.findByBreadIdInAndTagIdIn(breadIds, tagIds).stream()
				.filter(s -> wantedPairs.contains(s.getBreadId() + ":" + s.getTagId()))
				.toList();

		// 빵집 → 빵 → 태그 점수 목록
		Map<Long, Map<Integer, List<Double>>> byBakery = new HashMap<>();
		for (BakeryBreadTagScore score : scores) {
			byBakery.computeIfAbsent(score.getBakeryId(), k -> new HashMap<>())
					.computeIfAbsent(score.getBreadId(), k -> new ArrayList<>())
					.add(score.getFinalScore().doubleValue());
		}

		int n = request.tray().size();
		int requiredCoverage = (n + 1) / 2; // ⌈n/2⌉

		record Candidate(Long bakeryId, double score, Map<Integer, Double> breadScores) {
		}
		List<Candidate> candidates = new ArrayList<>();
		for (Map.Entry<Long, Map<Integer, List<Double>>> entry : byBakery.entrySet()) {
			Map<Integer, Double> breadScores = new LinkedHashMap<>();
			entry.getValue().forEach((breadId, tagScores) -> breadScores.put(breadId,
					tagScores.stream().mapToDouble(Double::doubleValue).average().orElse(0)));
			if (breadScores.size() < requiredCoverage) {
				continue; // 후보 자격 미달
			}
			double bakeryScore = breadScores.values().stream()
					.mapToDouble(Double::doubleValue).average().orElse(0);
			candidates.add(new Candidate(entry.getKey(), bakeryScore, breadScores));
		}
		candidates.sort(Comparator.comparingDouble(Candidate::score).reversed()
				.thenComparing(Candidate::bakeryId));

		// 영업 중(is_open)만 — 조회 시점 필터가 최종 방어선
		Map<Long, Bakery> bakeries = bakeryRepository
				.findAllById(candidates.stream().map(Candidate::bakeryId).toList()).stream()
				.filter(Bakery::isOpen)
				.collect(Collectors.toMap(Bakery::getId, Function.identity()));
		List<Candidate> top = candidates.stream()
				.filter(c -> bakeries.containsKey(c.bakeryId()))
				.limit(SCORE_RESULT_SIZE)
				.toList();

		// 무작위 발견 슬롯: 점수 슬롯을 뺀 나머지를 영업 중·미선정 빵집에서 채운다 (최소 1곳)
		Set<Long> chosen = top.stream().map(Candidate::bakeryId).collect(Collectors.toSet());
		List<Bakery> randomPicks = bakeryRepository
				.findRandomOpen(TOTAL_RESULT_SIZE + SCORE_RESULT_SIZE).stream()
				.filter(b -> !chosen.contains(b.getId()))
				.limit(TOTAL_RESULT_SIZE - top.size())
				.toList();

		// 스냅샷 저장 (RECO-006) — 이름 기반 JSON (ERD 예시 형식)
		Map<Integer, String> breadNames = activeTags.values().stream()
				.map(Tag::getBread).distinct()
				.collect(Collectors.toMap(b -> b.getId(), b -> b.getName(), (a, b) -> a));
		Recommendation recommendation = recommendationRepository.save(Recommendation.builder()
				.userId(userId)
				.traySnapshot(buildSnapshot(request.tray(), breadNames, activeTags))
				.build());

		Set<Long> savedIds = new HashSet<>(savedBakeryRepository.findBakeryIdsByUserId(userId));
		List<ResultItem> items = new ArrayList<>();
		for (int i = 0; i < top.size(); i++) {
			Candidate candidate = top.get(i);
			Bakery bakery = bakeries.get(candidate.bakeryId());
			RecommendationResult saved = resultRepository.save(RecommendationResult.builder()
					.recommendationId(recommendation.getId())
					.bakeryId(bakery.getId())
					.rankNo(i + 1)
					.build());
			// 추천 이유 근거: 그 빵집에서 점수 높은 (빵, 태그) 상위 2개 (RECO-007)
			List<Reason> reasons = scores.stream()
					.filter(s -> s.getBakeryId().equals(bakery.getId()))
					.sorted(Comparator.comparing(BakeryBreadTagScore::getFinalScore).reversed())
					.limit(2)
					.map(s -> new Reason(breadNames.getOrDefault(s.getBreadId(), ""),
							activeTags.get(s.getTagId()).getName()))
					.toList();
			items.add(new ResultItem(
					saved.getId(), i + 1, bakery.getId(), bakery.getName(), bakery.getDistrict(),
					bakery.getImageUrl(), bakery.getMapUrl(), savedIds.contains(bakery.getId()),
					Math.round(candidate.score() * 10000) / 10000.0,
					candidate.breadScores().keySet().stream()
							.map(id -> breadNames.getOrDefault(id, "")).toList(),
					reasons, PICK_SCORE));
		}
		for (Bakery bakery : randomPicks) {
			int rank = items.size() + 1;
			RecommendationResult saved = resultRepository.save(RecommendationResult.builder()
					.recommendationId(recommendation.getId())
					.bakeryId(bakery.getId())
					.rankNo(rank)
					.build());
			items.add(new ResultItem(
					saved.getId(), rank, bakery.getId(), bakery.getName(), bakery.getDistrict(),
					bakery.getImageUrl(), bakery.getMapUrl(), savedIds.contains(bakery.getId()),
					0.0, List.of(), List.of(), PICK_RANDOM));
		}
		return new RecommendResponse(recommendation.getId(), n, items);
	}

	public List<HistoryItem> myRecommendations(Long userId) {
		List<Recommendation> recommendations = recommendationRepository
				.findByUserIdOrderByCreatedAtDesc(userId);
		if (recommendations.isEmpty()) {
			return List.of();
		}
		Map<Long, List<RecommendationResult>> resultsByReco = resultRepository
				.findByRecommendationIdIn(recommendations.stream().map(Recommendation::getId).toList())
				.stream()
				.collect(Collectors.groupingBy(RecommendationResult::getRecommendationId));
		Set<Long> bakeryIds = resultsByReco.values().stream().flatMap(List::stream)
				.map(RecommendationResult::getBakeryId).collect(Collectors.toSet());
		Map<Long, Bakery> bakeries = bakeryRepository.findAllById(bakeryIds).stream()
				.collect(Collectors.toMap(Bakery::getId, Function.identity()));

		return recommendations.stream().map(reco -> new HistoryItem(
				reco.getId(),
				reco.getCreatedAt(),
				parseSnapshot(reco.getTraySnapshot()),
				resultsByReco.getOrDefault(reco.getId(), List.of()).stream()
						.sorted(Comparator.comparing(RecommendationResult::getRankNo))
						.map(r -> {
							Bakery bakery = bakeries.get(r.getBakeryId());
							return new HistoryResult(r.getId(), r.getRankNo(), r.getBakeryId(),
									bakery == null ? "" : bakery.getName(),
									bakery == null ? null : bakery.getDistrict(),
									bakery == null ? null : bakery.getImageUrl(),
									bakery == null ? null : bakery.getMapUrl());
						})
						.toList()))
				.toList();
	}

	/** 트레이 서버 재검증 (RECO-014): 1~8종·중복 금지·빵당 태그 1~2·그 빵의 활성 태그인지 */
	private Map<Integer, Tag> validateTray(List<TrayBread> tray) {
		if (tray == null || tray.isEmpty()) {
			throw new BusinessException(ErrorCode.EMPTY_TRAY);
		}
		if (tray.size() > MAX_TRAY) {
			throw new BusinessException(ErrorCode.TRAY_LIMIT_EXCEEDED);
		}
		Set<Integer> seenBreads = new HashSet<>();
		Set<Integer> allTagIds = new HashSet<>();
		for (TrayBread bread : tray) {
			if (!seenBreads.add(bread.breadId())) {
				throw new BusinessException(ErrorCode.DUPLICATE_BREAD_IN_TRAY);
			}
			if (bread.tagIds() == null || bread.tagIds().isEmpty()) {
				throw new BusinessException(ErrorCode.TAG_REQUIRED_FOR_BREAD);
			}
			if (bread.tagIds().size() > MAX_TAGS_PER_BREAD
					|| bread.tagIds().size() != new HashSet<>(bread.tagIds()).size()) {
				throw new BusinessException(ErrorCode.TAG_LIMIT_EXCEEDED);
			}
			allTagIds.addAll(bread.tagIds());
		}
		Map<Integer, Tag> tags = tagRepository.findAllById(allTagIds).stream()
				.collect(Collectors.toMap(Tag::getId, Function.identity()));
		for (TrayBread bread : tray) {
			for (Integer tagId : bread.tagIds()) {
				Tag tag = tags.get(tagId);
				if (tag == null || !tag.isActive()
						|| !tag.getBread().getId().equals(bread.breadId())) {
					throw new BusinessException(ErrorCode.INVALID_TAG_FOR_BREAD);
				}
			}
		}
		return tags;
	}

	private String buildSnapshot(List<TrayBread> tray, Map<Integer, String> breadNames,
			Map<Integer, Tag> tags) {
		List<TraySnapshotItem> snapshot = tray.stream()
				.map(t -> new TraySnapshotItem(
						breadNames.getOrDefault(t.breadId(), String.valueOf(t.breadId())),
						t.tagIds().stream().map(id -> tags.get(id).getName()).toList()))
				.toList();
		try {
			return OBJECT_MAPPER.writeValueAsString(snapshot);
		} catch (JsonProcessingException e) {
			throw new BusinessException(ErrorCode.INTERNAL_ERROR);
		}
	}

	private List<TraySnapshotItem> parseSnapshot(String json) {
		try {
			return OBJECT_MAPPER.readValue(json, new TypeReference<>() {
			});
		} catch (JsonProcessingException e) {
			return List.of();
		}
	}
}
