package com.bangtray.api.bakery;

import com.bangtray.domain.bakery.Bakery;
import java.util.List;

/** 빵집 응답 DTO 모음. 대표 메뉴·가격은 설계상 미노출 (BKRY-003) */
public final class BakeryDtos {

	private BakeryDtos() {
	}

	/**
	 * 홈 카드·사이드 패널·저장 목록용 카드. saved는 비로그인 시 항상 false.
	 * representativeBread는 홈 '오늘의 빵집'에서만 채워진다 — 그 빵집 리뷰 표본이 가장 많은 빵 이름
	 * (헤드라인 "○○에 진심인 당신에게"의 ○○). 다른 용도에서는 null.
	 */
	public record BakeryCard(Long id, String name, String district, String imageUrl,
			String mapUrl, boolean saved, String representativeBread) {

		public static BakeryCard of(Bakery bakery, boolean saved) {
			return of(bakery, saved, null);
		}

		public static BakeryCard of(Bakery bakery, boolean saved, String representativeBread) {
			return new BakeryCard(bakery.getId(), bakery.getName(), bakery.getDistrict(),
					bakery.getImageUrl(), bakery.getMapUrl(), saved, representativeBread);
		}
	}

	/**
	 * 프로필 — 추천 결과 카드 아래에 펼쳐지는 "이 빵집이 어떤 평가를 받는지" 집계 (project issue).
	 * 개인 리뷰는 노출하지 않는다: breads는 bakery_bread_tag_scores(외부 후기 + 자체 리뷰 클릭)의
	 * 빵별 태그 건수, otherBreads는 리뷰의 목록 외 빵 이름 건수. 둘 다 데이터가 있는 것만 담긴다.
	 */
	public record BakeryProfile(Long id, String name, String district, String imageUrl, String mapUrl,
			boolean isOpen, List<String> topTags, List<ProfileBread> breads, List<NamedCount> otherBreads) {
	}

	/** 8종 중 이 빵집에 데이터가 있는 빵 하나. representative = 리뷰 표본이 가장 많은 빵 */
	public record ProfileBread(Integer breadId, String name, boolean representative, int reviewCount,
			List<ProfileTag> tags) {
	}

	/** 빵 하나의 특징 태그와 언급·클릭 건수 (외부 + 자체) */
	public record ProfileTag(Integer tagId, String name, int count) {
	}

	/** 이름과 건수 — 목록 외 빵 */
	public record NamedCount(String name, int count) {
	}

	/** 상세 — 이름/위치/가게 링크(BKRY-001). 폐업이어도 조회는 가능하고 isOpen으로 표시 */
	public record BakeryDetail(Long id, String name, String address, String district,
			String mapUrl, String linkUrl, String imageUrl, boolean isOpen, boolean saved) {

		public static BakeryDetail of(Bakery bakery, boolean saved) {
			return new BakeryDetail(bakery.getId(), bakery.getName(), bakery.getAddress(),
					bakery.getDistrict(), bakery.getMapUrl(), bakery.getLinkUrl(),
					bakery.getImageUrl(), bakery.isOpen(), saved);
		}
	}
}
