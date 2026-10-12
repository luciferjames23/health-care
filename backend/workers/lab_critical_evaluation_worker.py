"""Isolated polling/reconciliation worker for AG-10 evaluation events.

Run with: python -m workers.lab_critical_evaluation_worker [--once]
This worker is intentionally not started inside the API process.
"""
import argparse
import os
import time

from services.lab_critical_evaluator import run_batch


def run_forever(batch_size=200, interval_seconds=30, force_reconcile=False):
    while True:
        try:
            result = run_batch(batch_size=batch_size, reconcile=force_reconcile)
            force_reconcile = False
            print("[AG10_EVALUATOR]", result)
        except Exception as exc:
            # A failed DB transaction does not commit the scan cursor; retry on
            # the next interval and log no patient/result content.
            print(f"[AG10_EVALUATOR] batch failed; checkpoint retained: {type(exc).__name__}")
        time.sleep(interval_seconds)


def main():
    parser = argparse.ArgumentParser(description="AG-10 Lab critical-rule evaluator worker")
    parser.add_argument("--once", action="store_true", help="run one bounded batch and exit")
    parser.add_argument("--reconcile", action="store_true", help="force a reconciliation batch")
    parser.add_argument("--batch-size", type=int, default=int(os.getenv("AG10_CRITICAL_BATCH_SIZE", "200")))
    parser.add_argument("--interval", type=int, default=int(os.getenv("AG10_CRITICAL_POLL_INTERVAL_SECONDS", "30")))
    args = parser.parse_args()
    if args.batch_size < 1 or args.batch_size > 2000 or args.interval < 1:
        parser.error("batch-size must be 1..2000 and interval must be positive")
    if args.once:
        print("[AG10_EVALUATOR]", run_batch(batch_size=args.batch_size, reconcile=args.reconcile))
        return
    run_forever(args.batch_size, args.interval, args.reconcile)


if __name__ == "__main__":
    main()
