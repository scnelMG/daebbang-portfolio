package com.bangtray.batch.collect;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

/** ② 전처리의 텍스트 정제 — 규칙 기반만, LLM 없음 (설계 원칙) */
public final class TextCleaner {

	private TextCleaner() {
	}

	public static String clean(String raw) {
		if (raw == null) {
			return "";
		}
		String text = raw.replaceAll("https?://\\S+", " ");          // URL 제거
		text = text.replaceAll("[\\u200b\\u200c\\ufeff]", "");       // zero-width 제거
		StringBuilder sb = new StringBuilder();
		for (String line : text.split("\\R")) {
			String trimmed = line.trim();
			if (trimmed.length() >= 2) {                             // 잔여 한 글자 라인 제거
				sb.append(trimmed).append('\n');
			}
		}
		return sb.toString()
				.replaceAll("\\n{3,}", "\n\n")
				.replaceAll("[ \\t]{2,}", " ")
				.trim();
	}

	/** 중복 제거 기준 — cleaned_reviews.content_hash 유니크 인덱스와 짝 */
	public static String sha256(String text) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
