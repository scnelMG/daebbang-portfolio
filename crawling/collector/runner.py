"""수집 실행기 — 파이프라인 ①수집+②전처리 담당 (2026-09-15 팀 결정: 크롤링은 Python).

MySQL collection_queries(is_active, source='tistory')를 읽어 쿼리마다:
  collection_runs INSERT(running) → 검색 → 이름 필터 → 신규 URL 만 크롤
  → 정제 → Mongo cleaned_reviews 적재 → runs UPDATE(success/failed + collected_count)

멱등성:
  - cleaned_reviews 의 uq_content_hash 유니크 인덱스가 같은 본문 재적재를 거부
  - 이미 적재된 URL 은 크롤 전에 건너뛴다 (재실행 시 신규 글만 수집)
스키마는 poc_collect.py 와 동일하되 poc_* 검증 필드만 제거했다.
"""

import hashlib
import logging
import os
from datetime import datetime, timezone

import pymysql
import requests
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from collector.tistory import (
    CRAWL_DELAY,
    MIN_TEXT_LEN,
    clean_text,
    crawl_post,
    parse_dt,
    search_posts,
)
import time

logger = logging.getLogger(__name__)


def _mysql():
    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        user=os.environ.get("MYSQL_USER", "bangtray"),
        password=os.environ["MYSQL_PASSWORD"],
        database=os.environ.get("MYSQL_DATABASE", "bangtray"),
        charset="utf8mb4",
        autocommit=True,
    )


def _mongo_reviews():
    uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/?directConnection=true")
    return MongoClient(uri).bangtray.cleaned_reviews


def run_collection(pages: int = 2, max_per_query: int = 30) -> dict:
    """활성 티스토리 쿼리 전체를 1회 수집. 쿼리별 결과 요약을 반환한다."""
    run_started = datetime.now(timezone.utc)
    col = _mongo_reviews()
    db = _mysql()

    with db.cursor() as cur:
        cur.execute(
            "SELECT q.id, q.query_text, q.bakery_id, q.bread_id, b.name, br.name"
            "  FROM collection_queries q"
            "  JOIN bakeries b ON b.id = q.bakery_id"
            "  JOIN breads  br ON br.id = q.bread_id"
            " WHERE q.is_active = TRUE AND q.source = 'tistory'"
            " ORDER BY q.id"
        )
        queries = cur.fetchall()

    summary = {"queries": len(queries), "inserted": 0, "dup": 0, "failed_queries": 0}
    results = []

    for query_id, query_text, bakery_id, bread_id, bakery_name, bread_name in queries:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO collection_runs (query_id, status) VALUES (%s, 'running')",
                (query_id,),
            )
            run_id = cur.lastrowid

        try:
            stats = _collect_one(
                col, query_text, bakery_name, bread_name, bakery_id, bread_id,
                run_id, pages, max_per_query,
            )
            with db.cursor() as cur:
                cur.execute(
                    "UPDATE collection_runs SET status='success', finished_at=NOW(),"
                    " collected_count=%s WHERE id=%s",
                    (stats["inserted"], run_id),
                )
            summary["inserted"] += stats["inserted"]
            summary["dup"] += stats["dup"]
            results.append({"query": query_text, **stats})
            logger.info("[수집] %s: %s", query_text, stats)
        except Exception as e:  # noqa: BLE001 - 한 쿼리 실패가 전체 실행을 죽이면 안 된다
            with db.cursor() as cur:
                cur.execute(
                    "UPDATE collection_runs SET status='failed', finished_at=NOW(),"
                    " error_message=%s WHERE id=%s",
                    (str(e)[:500], run_id),
                )
            summary["failed_queries"] += 1
            logger.exception("[수집] %s 실패", query_text)

    db.close()
    summary["elapsed_sec"] = int((datetime.now(timezone.utc) - run_started).total_seconds())
    summary["results"] = results
    return summary


def _collect_one(
    col, query_text, bakery_name, bread_name, bakery_id, bread_id,
    run_id, pages, max_per_query,
) -> dict:
    entries = search_posts(query_text, pages)
    stats = {"found": len(entries), "inserted": 0, "dup": 0, "fetch_fail": 0, "parse_fail": 0}

    # 제목/요약에 빵집명 없는 글은 사전 컷 (PoC 와 동일한 필터)
    candidates = [
        e for e in entries
        if bakery_name in e["title"] or bakery_name in e["summary"]
    ]

    # 이미 적재된 URL 은 크롤 전에 건너뛴다 (증분 수집의 핵심)
    known = {d["url"] for d in col.find({"shop_id": bakery_id}, {"url": 1})}
    candidates = [e for e in candidates if e["url"] not in known][:max_per_query]

    for e in candidates:
        time.sleep(CRAWL_DELAY)
        post = crawl_post(e["url"])
        if post is None:
            stats["fetch_fail"] += 1
            continue

        cleaned = clean_text(post["raw"])
        if len(cleaned) < MIN_TEXT_LEN:
            stats["parse_fail"] += 1
            continue

        doc = {
            "source": "tistory",
            "url": e["url"],
            "shop_id": bakery_id,
            "bread_type": bread_name,          # 표시용 이름 (설계 문서 필드)
            "bread_id": bread_id,              # ③ 라벨링이 document_labels 에 쓸 정수 id
            "title": post["title"],
            "cleaned_text": cleaned,
            "raw_text": post["raw"],           # 재정제 대비 보존
            "content_hash": hashlib.sha256(cleaned.encode()).hexdigest(),
            "published_at": parse_dt(post["published"]) or parse_dt(e["published"]),
            "collected_at": datetime.now(timezone.utc),
            "run_id": run_id,                  # collection_runs.id (PoC 의 문자열과 달리 정수)
            "labeled": False,
        }
        try:
            col.insert_one(doc)
            stats["inserted"] += 1
        except DuplicateKeyError:
            stats["dup"] += 1

    return stats
