package com.bangtray.api.recommendation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;

public final class RecommendationDtos {

	private RecommendationDtos() {
	}

	// ---------- 요청 ----------

	public record TrayBread(
			@NotNull Integer breadId,
			@NotEmpty List<Integer> tagIds   // 1~2개 (상한·일치 검증은 서비스에서)
	) {
	}

	public record RecommendRequest(
			@Valid @NotEmpty List<TrayBread> tray   // 1~8종 (TRAY-006)
	) {
	}

	// ---------- 응답 ----------

	/** 추천 이유 근거 — 그 빵집에서 점수가 높았던 (빵, 태그). 문장 조립은 프론트 (RECO-007) */
	public record Reason(String breadName, String tagName) {
	}

	public record ResultItem(
			Long recommendationResultId,   // 리뷰 작성 시 그대로 전달 (REVW-002 자동 채움)
			int rank,
			Long bakeryId,
			String bakeryName,
			String district,
			String imageUrl,
			String mapUrl,
			boolean saved,
			double score,
			List<String> coveredBreadNames,   // "이곳에서 찾아볼 빵" (RECO-008) + 커버리지 근거
			List<Reason> reasons,
			String pickType                   // "score"(점수 상위) | "random"(무작위 발견 슬롯, score=0·근거 없음)
	) {
	}

	public record RecommendResponse(
			Long recommendationId,
			int totalBreads,               // 커버리지 표기용: "담은 n종 중 k종 리뷰 기반"
			List<ResultItem> results       // 3곳 = 점수 상위 최대 2곳 + 무작위 발견 (부족분은 무작위로 채움)
	) {
	}

	// ---------- 이력 ----------

	public record TraySnapshotItem(String bread, List<String> tags) {
	}

	/** 추천 결과 카드와 같은 필드 구성 — 프론트가 ResultItem용 카드 컴포넌트를 그대로 재사용할 수 있게 */
	public record HistoryResult(Long recommendationResultId, int rank, Long bakeryId, String bakeryName,
			String district, String imageUrl, String mapUrl) {
	}

	public record HistoryItem(
			Long recommendationId,
			LocalDateTime createdAt,
			List<TraySnapshotItem> tray,
			List<HistoryResult> results
	) {
	}
}
