"""수집 서비스 HTTP 진입점.

Spring Scheduler(@Scheduled, 주 1회)가 POST /collect 로 트리거한다 (2026-09-15 결정:
배치 오케스트레이션은 Spring, 크롤링 실행은 Python). 컨테이너는 app 네트워크에만
붙고 포트를 publish 하지 않으므로 별도 인증 없이 내부 호출 전용이다.

수동 실행:  docker compose exec collector python -m collector.cli
"""

import logging
import threading

from fastapi import FastAPI, HTTPException

from collector.runner import run_collection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="bangtray-collector")

_lock = threading.Lock()
_last: dict = {"status": "never_ran"}


def _run(pages: int, max_per_query: int) -> None:
    global _last
    try:
        _last = {"status": "success", **run_collection(pages, max_per_query)}
    except Exception as e:  # noqa: BLE001
        logger.exception("수집 실행 실패")
        _last = {"status": "failed", "error": str(e)[:500]}
    finally:
        _lock.release()


@app.post("/collect", status_code=202)
def collect(pages: int = 2, max_per_query: int = 30) -> dict:
    """수집 1회를 백그라운드로 시작한다. 이미 실행 중이면 409."""
    if not _lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="수집이 이미 실행 중입니다")
    threading.Thread(target=_run, args=(pages, max_per_query), daemon=True).start()
    return {"status": "started"}


@app.get("/status")
def status() -> dict:
    """마지막 실행 결과 (실행 중이면 running)."""
    if _lock.locked():
        return {"status": "running"}
    return _last


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
