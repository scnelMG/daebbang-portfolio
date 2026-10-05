package com.bangtray.api.bakery;

import com.bangtray.api.bakery.BakeryDtos.BakeryCard;
import com.bangtray.api.bakery.BakeryDtos.BakeryDetail;
import com.bangtray.api.bakery.BakeryDtos.BakeryProfile;
import com.bangtray.api.bakery.BakeryDtos.NamedCount;
import com.bangtray.api.bakery.BakeryDtos.ProfileBread;
import com.bangtray.api.bakery.BakeryDtos.ProfileTag;
import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.bangtray.domain.bakery.Bakery;
import com.bangtray.domain.bakery.BakeryRepository;
import com.bangtray.domain.bakery.SavedBakeryId;
import com.bangtray.domain.bakery.SavedBakeryRepository;
import com.bangtray.domain.bread.Bread;
import com.bangtray.domain.bread.BreadRepository;
import com.bangtray.domain.bread.Tag;
import com.bangtray.domain.bread.TagRepository;
import com.bangtray.domain.review.Review;
import com.bangtray.domain.review.ReviewRepository;
import com.bangtray.domain.score.BakeryBreadTagScore;
import com.bangtray.domain.score.BakeryBreadTagScoreRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BakeryService {

	private static final ZoneId KST = ZoneId.of("Asia/Seoul");

	/**
	 * 하루 동안 고정되는 선정 결과. 날짜 시드 셔플이라 같은 날엔 결과가 완전히 같으므로
	 * 후보 조회·대표 빵 집계·셔플은 하루 1회만 하고, 요청마다 달라지는 것은 사용자별 saved뿐이다.
	 * api 컨테이너가 1대라 인스턴스 로컬 캐시로 충분하다. 날짜가 바뀌면 다음 요청이 재계산하고,
	 * 그날 중의 마스터 변경(폐업·사진 추가)은 다음 날 반영된다 — 홈 카드 용도라 허용.
	 */
	private record DailyPick(LocalDate date, List<Bakery> shuffled, Map<Long, String> breadOf) {
	}

	private final AtomicReference<DailyPick> dailyPick = new AtomicReference<>();
	private final Object dailyPickLock = new Object();

	private final BakeryRepository bakeryRepository;
	private final SavedBakeryRepository savedBakeryRepository;
	private final BreadRepository breadRepository;
	private final BakeryBreadTagScoreRepository scoreRepository;
	private final TagRepository tagRepository;
	private final ReviewRepository reviewRepository;

	private static final int TOP_TAG_COUNT = 3;
	private static final int OTHER_BREAD_LIMIT = 10;

	/** 홈 '오늘의 빵집' 카드 — 오늘(KST) 기준 N곳 (HOME-003, HOME-005) */
	public List<BakeryCard> homeCards(Long userId, int size) {
		return homeCards(userId, size, LocalDate.now(KST));
	}

	/**
	 * 날짜를 시드로 고정 셔플한다 — 같은 날엔 모든 사용자가 같은 카드를 보고, 날이 바뀌면 카드가 바뀐다.
	 * 후보: 영업 중 + 사진 + 지도 링크 + 리뷰 점수 데이터(대표 빵)가 있는 빵집. 개인화 추천이 아니다.
	 */
	List<BakeryCard> homeCards(Long userId, int size, LocalDate date) {
		DailyPick pick = dailyPickFor(date);
		Set<Long> savedIds = savedIdsOf(userId);
		return pickDistinctBreads(pick.shuffled(), pick.breadOf(), Math.max(size, 0)).stream()
				.map(bakery -> BakeryCard.of(bakery, savedIds.contains(bakery.getId()),
						pick.breadOf().get(bakery.getId())))
				.toList();
	}

	/**
	 * 캐시 히트는 잠금 없이 반환하고, 비어 있거나 날짜가 바뀐 경우에만 잠근다(double-checked).
	 * 기동 직후·자정 직후 요청이 몰려도 computeDailyPick(DB 조회 + 집계)은 하루 한 번만 실행된다.
	 */
	private DailyPick dailyPickFor(LocalDate date) {
		DailyPick current = dailyPick.get();
		if (isFor(current, date)) {
			return current;
		}
		synchronized (dailyPickLock) {
			current = dailyPick.get();
			if (isFor(current, date)) {
				return current;
			}
			DailyPick fresh = computeDailyPick(date);
			dailyPick.set(fresh);
			return fresh;
		}
	}

	private static boolean isFor(DailyPick pick, LocalDate date) {
		return pick != null && pick.date().equals(date);
	}

	/** 후보 조회 → 대표 빵 집계 → 날짜 시드 셔플. 하루 1회 (첫 요청 시) 실행된다 */
	private DailyPick computeDailyPick(LocalDate date) {
		List<Bakery> candidates = new ArrayList<>(
				bakeryRepository.findByIsOpenTrueAndImageUrlIsNotNullAndMapUrlIsNotNullOrderByIdAsc());
		Map<Long, String> breadOf = representativeBreads(candidates);
		candidates.removeIf(bakery -> !breadOf.containsKey(bakery.getId()));
		Collections.shuffle(candidates, new Random(date.toEpochDay()));
		return new DailyPick(date, List.copyOf(candidates), Map.copyOf(breadOf));
	}

	/**
	 * 섞인 순서를 지키되 대표 빵이 겹치지 않는 빵집을 먼저 고른다 — 하루 카드 3장의 헤드라인이
	 * 전부 "소금빵에 진심인 당신에게"가 되는 것을 막기 위함. 서로 다른 빵이 부족하면 남은 자리는 순서대로 채운다.
	 */
	private static List<Bakery> pickDistinctBreads(List<Bakery> shuffled, Map<Long, String> breadOf, int size) {
		List<Bakery> picked = new ArrayList<>();
		Set<String> usedBreads = new HashSet<>();
		for (Bakery bakery : shuffled) {
			if (picked.size() >= size) {
				break;
			}
			if (usedBreads.add(breadOf.get(bakery.getId()))) {
				picked.add(bakery);
			}
		}
		for (Bakery bakery : shuffled) {
			if (picked.size() >= size) {
				break;
			}
			if (!picked.contains(bakery)) {
				picked.add(bakery);
			}
		}
		return picked;
	}

	/**
	 * 빵집별 대표 빵 = 리뷰 표본(외부 + 내부)이 가장 많은 빵. 동률이면 빵 id가 작은 쪽.
	 * 점수 행이 하나도 없는 빵집은 결과에 없다 (헤드라인을 만들 수 없으므로 후보에서 제외).
	 *
	 * <p>표본 수를 {@code Integer::max}로 모으는 이유: {@code bakery_bread_tag_scores}는
	 * (빵집, 빵, 태그) 행이지만 {@code external_sample_count}·{@code internal_sample_count}는
	 * 점수 공식의 분모, 즉 그 (빵집, 빵)의 전체 리뷰 수라서 같은 (빵집, 빵)의 모든 태그 행에
	 * 같은 값이 반복 저장된다 (2026-09-22 덤프 173개 조합 전부 확인). 태그 수만큼 더하면
	 * 리뷰가 중복 집계되므로(예: 성심당 바게트 52건 × 태그 2 = 104) max로 그 값을 한 번만 취한다.
	 * 집계 방식이 바뀌어 태그별 분모가 달라지면 이 가정을 다시 확인할 것.
	 */
	private Map<Long, String> representativeBreads(List<Bakery> bakeries) {
		if (bakeries.isEmpty()) {
			return Map.of();
		}
		Map<Integer, String> breadNames = breadRepository.findAll().stream()
				.collect(Collectors.toMap(Bread::getId, Bread::getName));
		List<Long> ids = bakeries.stream().map(Bakery::getId).toList();
		Map<Long, Map<Integer, Integer>> samples = new HashMap<>();
		for (BakeryBreadTagScore score : scoreRepository.findByBakeryIdIn(ids)) {
			int sample = score.getExternalSampleCount() + score.getInternalSampleCount();
			samples.computeIfAbsent(score.getBakeryId(), key -> new HashMap<>())
					.merge(score.getBreadId(), sample, Integer::max); // 태그 행마다 같은 분모 → 합산 아님
		}
		Map<Long, String> result = new HashMap<>();
		samples.forEach((bakeryId, byBread) -> byBread.entrySet().stream()
				.max(Comparator.<Map.Entry<Integer, Integer>>comparingInt(Map.Entry::getValue)
						.thenComparing(Map.Entry::getKey, Comparator.<Integer>reverseOrder()))
				.map(entry -> breadNames.get(entry.getKey()))
				.filter(name -> name != null && !name.isBlank())
				.ifPresent(name -> result.put(bakeryId, name)));
		return result;
	}

	public BakeryDetail detail(Long userId, Long bakeryId) {
		Bakery bakery = bakeryRepository.findById(bakeryId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		boolean saved = userId != null
				&& savedBakeryRepository.existsById(new SavedBakeryId(userId, bakeryId));
		return BakeryDetail.of(bakery, saved);
	}

	/**
	 * 빵집 프로필 (project issue) — 추천 결과 카드 아래에 펼쳐지는 집계.
	 * 점수 테이블의 (빵, 태그) 행을 빵별로 묶는다. reviewCount는 태그 행마다 반복되는 (빵집, 빵) 분모라
	 * 합산하지 않고 max, 태그 count는 외부 언급 + 자체 클릭. 폐업 빵집도 조회된다.
	 */
	public BakeryProfile profile(Long bakeryId) {
		Bakery bakery = bakeryRepository.findById(bakeryId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		Map<Integer, String> breadNames = breadRepository.findAll().stream()
				.collect(Collectors.toMap(Bread::getId, Bread::getName));
		Map<Integer, String> tagNames = tagRepository.findAllActiveWithBread().stream()
				.collect(Collectors.toMap(Tag::getId, Tag::getName)); // 폐기 태그는 프로필에서도 제외

		Map<Integer, List<BakeryBreadTagScore>> byBread = new LinkedHashMap<>();
		for (BakeryBreadTagScore score : scoreRepository.findByBakeryId(bakeryId)) {
			byBread.computeIfAbsent(score.getBreadId(), key -> new ArrayList<>()).add(score);
		}
		List<ProfileBread> breads = new ArrayList<>();
		Map<String, Integer> tagTotals = new HashMap<>();
		byBread.forEach((breadId, rows) -> {
			String breadName = breadNames.get(breadId);
			if (breadName == null) {
				return;
			}
			int reviewCount = rows.stream()
					.mapToInt(row -> row.getExternalSampleCount() + row.getInternalSampleCount())
					.max().orElse(0);
			List<ProfileTag> tags = rows.stream()
					.filter(row -> row.getExternalCount() + row.getInternalCount() > 0)
					.filter(row -> tagNames.containsKey(row.getTagId()))
					.sorted(Comparator.comparingInt(
							(BakeryBreadTagScore row) -> row.getExternalCount() + row.getInternalCount())
							.reversed()
							.thenComparing(BakeryBreadTagScore::getFinalScore, Comparator.<BigDecimal>reverseOrder())
							.thenComparing(BakeryBreadTagScore::getTagId))
					.map(row -> new ProfileTag(row.getTagId(), tagNames.get(row.getTagId()),
							row.getExternalCount() + row.getInternalCount()))
					.toList();
			if (reviewCount == 0 && tags.isEmpty()) {
				return;
			}
			tags.forEach(tag -> tagTotals.merge(tag.name(), tag.count(), Integer::sum));
			breads.add(new ProfileBread(breadId, breadName, false, reviewCount, tags));
		});
		breads.sort(Comparator.comparingInt(ProfileBread::reviewCount).reversed()
				.thenComparing(ProfileBread::breadId));
		if (!breads.isEmpty()) {
			ProfileBread top = breads.get(0);
			breads.set(0, new ProfileBread(top.breadId(), top.name(), true, top.reviewCount(), top.tags()));
		}
		List<String> topTags = tagTotals.entrySet().stream()
				.sorted(Map.Entry.<String, Integer>comparingByValue().reversed()
						.thenComparing(Map.Entry.<String, Integer>comparingByKey()))
				.limit(TOP_TAG_COUNT)
				.map(Map.Entry::getKey)
				.toList();

		return new BakeryProfile(bakery.getId(), bakery.getName(), bakery.getDistrict(),
				bakery.getImageUrl(), bakery.getMapUrl(), bakery.isOpen(), topTags,
				List.copyOf(breads), otherBreads(bakeryId));
	}

	/** 리뷰의 목록 외 빵 이름을 건수로만 집계 — 개별 리뷰는 나가지 않는다 */
	private List<NamedCount> otherBreads(Long bakeryId) {
		Map<String, Integer> counts = new HashMap<>();
		for (Review review : reviewRepository.findByBakeryIdAndCustomBreadNamesIsNotNull(bakeryId)) {
			if (review.getCustomBreadNames() == null) {
				continue;
			}
			review.getCustomBreadNames().stream()
					.filter(name -> name != null && !name.isBlank())
					.map(String::trim)
					.distinct()
					.forEach(name -> counts.merge(name, 1, Integer::sum));
		}
		return counts.entrySet().stream()
				.sorted(Map.Entry.<String, Integer>comparingByValue().reversed()
						.thenComparing(Map.Entry.<String, Integer>comparingByKey()))
				.limit(OTHER_BREAD_LIMIT)
				.map(entry -> new NamedCount(entry.getKey(), entry.getValue()))
				.toList();
	}

	private Set<Long> savedIdsOf(Long userId) {
		if (userId == null) {
			return Set.of();
		}
		return savedBakeryRepository.findBakeryIdsByUserId(userId).stream()
				.collect(Collectors.toSet());
	}
}
