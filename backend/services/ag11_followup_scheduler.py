"""
ag11_followup_scheduler.py
===========================
Automated Background Scheduler for AG-11 Follow-up Agent.

Periodically:
1. Scans for new eligible discharges and creates Day 3/7/14 follow-up plans.
2. Checks for due check-in tasks and sends interactive WhatsApp messages.
"""

import sys
import os
import asyncio
import traceback
from typing import Dict, Any

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import services.ag11_followup_service as ag11_service

_ag11_scheduler_running = False


def run_ag11_cycle() -> Dict[str, Any]:
    """Runs a single scan-and-process cycle for AG-11."""
    res_plans = ag11_service.scan_and_create_followup_plans()
    res_tasks = ag11_service.process_due_followup_tasks()
    return {
        "plans": res_plans,
        "tasks": res_tasks
    }


async def _ag11_background_loop(interval_seconds: int = 60):
    """Background async worker loop running every interval_seconds (default 60s)."""
    global _ag11_scheduler_running
    _ag11_scheduler_running = True
    print("[AG11_SCHEDULER] Background worker started for AG-11 Follow-up Agent.")
    while _ag11_scheduler_running:
        try:
            run_ag11_cycle()
        except Exception as e:
            print(f"[AG11_SCHEDULER_LOOP_ERROR] {e}")
        await asyncio.sleep(interval_seconds)


def start_ag11_followup_scheduler(app=None):
    """Registers non-blocking background scheduler on FastAPI startup."""
    try:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_ag11_background_loop(interval_seconds=60))
        except RuntimeError:
            import threading
            def run_async_loop():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(_ag11_background_loop(interval_seconds=60))

            t = threading.Thread(target=run_async_loop, daemon=True)
            t.start()
        print("[AG11_SCHEDULER] AG-11 background worker registered successfully.")
    except Exception as e:
        print(f"[AG11_SCHEDULER_INIT_WARN] {e}")
