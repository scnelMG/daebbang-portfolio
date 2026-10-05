package com.bangtray.api.bakery;

import com.bangtray.api.bakery.BakeryDtos.BakeryCard;
import com.bangtray.api.common.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 마이페이지 "저장한 빵집" 탭 (SAVE-003~006, CMN-009) */
@RestController
@RequestMapping("/api/users/me/bookmarks")
@RequiredArgsConstructor
public class BookmarkController {

	private final BookmarkService bookmarkService;

	@GetMapping
	public ApiResponse<List<BakeryCard>> myBookmarks(@AuthenticationPrincipal Long userId) {
		return ApiResponse.success(bookmarkService.myBookmarks(userId));
	}
}
