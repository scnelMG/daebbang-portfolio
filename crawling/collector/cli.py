"""수동 실행용: docker compose exec collector python -m collector.cli [--pages 2]"""

import argparse
import json
import logging
import sys

from collector.runner import run_collection

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=2)
    ap.add_argument("--max-per-query", type=int, default=30)
    a = ap.parse_args()
    summary = run_collection(a.pages, a.max_per_query)
    json.dump(summary, sys.stdout, ensure_ascii=False, indent=2, default=str)
