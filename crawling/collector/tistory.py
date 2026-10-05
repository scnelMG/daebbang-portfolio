"""티스토리 검색·본문 크롤링 — poc_collect.py 에서 검증된 로직을 그대로 모듈화.

- 검색: www.tistory.com/api/v1/search/posts (비공식 내부 API, 키 불필요).
  검색어당 최대 ~540건(18페이지×30건)에서 잘림. 스펙이 바뀌면 이 파일만 수정.
- 본문: JSON-LD(BlogPosting) 발행일 + contents_style 셀렉터(구스킨 폴백) + 광고 제거
- 요청 간격: 검색 0.5초 / 본문 1.0초 (블로그별 robots.txt 는 글 본문 허용 확인됨)
"""

import json
import re
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

SEARCH_API = "https://www.tistory.com/api/v1/search/posts"
SEARCH_DELAY = 0.5
CRAWL_DELAY = 1.0
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
}
CONTENT_SELECTORS = (".contents_style", ".entry-content", ".article_view", ".tt_article_useless_p_margin")
JUNK_SELECTOR = "script, style, iframe, ins, .revenue_unit_item, .container_postbtn, .another_category"
MIN_TEXT_LEN = 100  # 이보다 짧으면 파싱 실패로 간주


def search_posts(query: str, pages: int) -> list[dict]:
    """글 메타(제목/요약/URL/발행일) 목록 반환."""
    entries: list[dict] = []
    for page in range(1, pages + 1):
        r = requests.get(
            SEARCH_API,
            headers=UA,
            timeout=10,
            params={"keyword": query, "page": page, "sort": "ACCURACY"},
        )
        r.raise_for_status()
        data = r.json()["data"]
        for e in data["searchedEntries"]:
            entries.append(
                {
                    "url": e["entryUrl"],
                    "title": e.get("entryTitle") or "",
                    "summary": e.get("entrySummary") or "",
                    "published": e.get("entryPublished"),
                }
            )
        if not data.get("nextPage"):
            break
        time.sleep(SEARCH_DELAY)
    return entries


def crawl_post(url: str) -> dict | None:
    """본문 텍스트 + 제목 + JSON-LD 발행일. 실패 시 None."""
    try:
        r = requests.get(url, headers=UA, timeout=10)
        r.raise_for_status()
    except requests.RequestException:
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    body = next((soup.select_one(s) for s in CONTENT_SELECTORS if soup.select_one(s)), None)
    if body is None:
        return None
    for junk in body.select(JUNK_SELECTOR):
        junk.decompose()

    published = None
    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            d = json.loads(tag.string or "")
        except json.JSONDecodeError:
            continue
        if d.get("@type") == "BlogPosting":
            published = d.get("datePublished")
            break

    raw = body.get_text("\n", strip=True)
    title = soup.title.string.strip() if soup.title and soup.title.string else None
    return {"raw": raw, "title": title, "published": published}


def clean_text(raw: str) -> str:
    text = re.sub(r"https?://\S+", " ", raw)  # URL 제거
    text = re.sub(r"[​‌﻿]", "", text)  # zero-width 제거
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if len(ln) >= 2]  # 잔여 한 글자 라인 제거
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def parse_dt(value) -> datetime | None:
    """JSON-LD ISO 문자열 또는 검색 API 의 epoch(ms) 모두 수용."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None
