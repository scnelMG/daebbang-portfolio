package com.bangtray.api.ranking;

import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.bangtray.domain.ranking.MonthlyUserRanking;
import com.bangtray.domain.ranking.MonthlyUserRankingRepository;
import com.bangtray.domain.review.ReviewRepository;
import com.bangtray.domain.review.ReviewRepository.RankingRow;
import com.bangtray.domain.user.User;
import com.bangtray.domain.user.UserRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 리뷰 랭킹 (RANK-001 월/주/일).
 * - 일별·주별·이번 달: reviews 실시간 집계 (데이터가 적어 배치 불필요 — 확정 판단)
 * - 지난 달: 월 1회 배치가 남긴 monthly_user_rankings 스냅샷 (DATA-016, 이달의 대빵 칭호 근거)
 * - 공개 범위: 닉네임과 집계 숫자만 (RANK-005). 탈퇴 회원은 익명화된 닉네임 그대로 (순위 보존)
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RankingService {

	private static final int PAGE_LIMIT = 100;

	private final ReviewRepository reviewRepository;
	private final MonthlyUserRankingRepository monthlyRankingRepository;
	private final UserRepository userRepository;

	public record RankingEntry(int rank, String nickname, long reviewCount,
			long visitedBakeryCount, boolean isMe) {
	}

	public record RankingResponse(String period, String yearMonth,
			List<RankingEntry> entries, RankingEntry myRank) {
	}

	public RankingResponse ranking(Long userId, String period, String yearMonth) {
		return switch (period) {
			case "daily" -> realtime(userId, "daily", LocalDate.now().atStartOfDay(), 1);
			case "weekly" -> realtime(userId, "weekly",
					LocalDate.now().with(DayOfWeek.MONDAY).atStartOfDay(), 7);
			case "monthly" -> monthly(userId, yearMonth);
			default -> throw new BusinessException(ErrorCode.VALIDATION_ERROR);
		};
	}

	private RankingResponse realtime(Long userId, String period, LocalDateTime start, int days) {
		List<RankingRow> rows = reviewRepository.aggregateRanking(start, start.plusDays(days));
		Map<Long, String> nicknames = nicknamesOf(rows.stream().map(RankingRow::getUserId).toList());

		List<RankingEntry> all = new java.util.ArrayList<>(rows.size());
		for (int i = 0; i < rows.size(); i++) {
			RankingRow row = rows.get(i);
			all.add(new RankingEntry(i + 1, nicknames.getOrDefault(row.getUserId(), ""),
					row.getReviewCount(), row.getVisitedBakeryCount(),
					row.getUserId().equals(userId)));
		}
		return new RankingResponse(period, null, page(all), myEntry(all));
	}

	/** 이번 달은 실시간, 지난 달은 배치 스냅샷 (집계 전이면 빈 목록 — RANK-006) */
	private RankingResponse monthly(Long userId, String yearMonthParam) {
		YearMonth target = parseYearMonth(yearMonthParam);
		if (target.equals(YearMonth.now())) {
			LocalDateTime start = target.atDay(1).atStartOfDay();
			RankingResponse response = realtime(userId, "monthly", start,
					target.lengthOfMonth());
			return new RankingResponse("monthly", target.toString(),
					response.entries(), response.myRank());
		}
		List<MonthlyUserRanking> snapshot = monthlyRankingRepository.findByYearMonth(target.toString());
		Map<Long, String> nicknames = nicknamesOf(
				snapshot.stream().map(MonthlyUserRanking::getUserId).toList());
		List<RankingEntry> all = snapshot.stream()
				.map(m -> new RankingEntry(m.getRankNo(),
						nicknames.getOrDefault(m.getUserId(), ""),
						m.getReviewCount(), m.getVisitedBakeryCount(),
						m.getUserId().equals(userId)))
				.toList();
		return new RankingResponse("monthly", target.toString(), page(all), myEntry(all));
	}

	private YearMonth parseYearMonth(String yearMonthParam) {
		if (yearMonthParam == null || yearMonthParam.isBlank()) {
			return YearMonth.now();
		}
		try {
			return YearMonth.parse(yearMonthParam);
		} catch (DateTimeParseException e) {
			throw new BusinessException(ErrorCode.VALIDATION_ERROR);
		}
	}

	private Map<Long, String> nicknamesOf(List<Long> userIds) {
		return userRepository.findAllById(userIds).stream()
				.collect(Collectors.toMap(User::getId, User::getNickname));
	}

	private List<RankingEntry> page(List<RankingEntry> all) {
		return all.size() <= PAGE_LIMIT ? all : all.subList(0, PAGE_LIMIT);
	}

	/** 내 순위 하이라이트 (RANK-002) — 100위 밖이어도 내 행은 별도 제공 */
	private RankingEntry myEntry(List<RankingEntry> all) {
		return all.stream().filter(RankingEntry::isMe).findFirst().orElse(null);
	}
}
