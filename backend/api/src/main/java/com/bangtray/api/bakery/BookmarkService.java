package com.bangtray.api.bakery;

import com.bangtray.api.bakery.BakeryDtos.BakeryCard;
import com.bangtray.api.common.BusinessException;
import com.bangtray.api.common.ErrorCode;
import com.bangtray.domain.bakery.Bakery;
import com.bangtray.domain.bakery.BakeryRepository;
import com.bangtray.domain.bakery.SavedBakery;
import com.bangtray.domain.bakery.SavedBakeryId;
import com.bangtray.domain.bakery.SavedBakeryRepository;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BookmarkService {

	private final BakeryRepository bakeryRepository;
	private final SavedBakeryRepository savedBakeryRepository;

	/**
	 * 저장 토글 (SAVE-001) — 반환값은 토글 후 저장 상태.
	 * 중복 저장은 복합 PK가 최종 방어 (SAVE-002).
	 */
	@Transactional
	public boolean toggle(Long userId, Long bakeryId) {
		if (!bakeryRepository.existsById(bakeryId)) {
			throw new BusinessException(ErrorCode.NOT_FOUND);
		}
		SavedBakeryId id = new SavedBakeryId(userId, bakeryId);
		if (savedBakeryRepository.existsById(id)) {
			savedBakeryRepository.deleteById(id);
			return false;
		}
		savedBakeryRepository.save(SavedBakery.builder().id(id).build());
		return true;
	}

	/** 내 저장 목록 — 최신순 (SAVE-003). 폐업 빵집도 저장했다면 그대로 노출(카드에서 지도 링크는 유효) */
	public List<BakeryCard> myBookmarks(Long userId) {
		List<SavedBakery> saved = savedBakeryRepository.findByIdUserIdOrderByCreatedAtDesc(userId);
		Map<Long, Bakery> bakeries = bakeryRepository
				.findAllById(saved.stream().map(s -> s.getId().getBakeryId()).toList()).stream()
				.collect(Collectors.toMap(Bakery::getId, Function.identity()));
		return saved.stream()
				.map(s -> bakeries.get(s.getId().getBakeryId()))
				.filter(bakery -> bakery != null)
				.map(bakery -> BakeryCard.of(bakery, true))
				.toList();
	}
}
