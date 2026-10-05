package com.bangtray.api.bread;

import com.bangtray.api.common.ApiResponse;
import com.bangtray.domain.bread.Bread;
import com.bangtray.domain.bread.BreadRepository;
import com.bangtray.domain.bread.Tag;
import com.bangtray.domain.bread.TagRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 트레이 화면 마스터 조회 — 빵 8종 + 빵별 활성 태그 (비회원 허용) */
@RestController
@RequestMapping("/api/breads")
@RequiredArgsConstructor
public class BreadController {

	private final BreadRepository breadRepository;
	private final TagRepository tagRepository;

	public record TagItem(Integer id, String name, boolean isTypeTag) {
	}

	public record BreadItem(Integer id, String name, String imageUrl, List<TagItem> tags) {
	}

	@GetMapping
	public ApiResponse<List<BreadItem>> breads() {
		Map<Integer, List<Tag>> tagsByBread = tagRepository.findAllActiveWithBread().stream()
				.collect(Collectors.groupingBy(tag -> tag.getBread().getId()));

		List<BreadItem> items = breadRepository
				.findAll(Sort.by("displayOrder", "id")).stream()
				.map(bread -> new BreadItem(
						bread.getId(), bread.getName(), bread.getImageUrl(),
						tagsByBread.getOrDefault(bread.getId(), List.of()).stream()
								.map(t -> new TagItem(t.getId(), t.getName(), t.isTypeTag()))
								.toList()))
				.toList();
		return ApiResponse.success(items);
	}
}
