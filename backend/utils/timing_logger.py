"""
timing_logger.py
================
Structured telemetry and latency profiling for WhatsApp Patient Desk pipeline.
Tracks stages a through h per message correlation ID.
"""

import time
import uuid
import threading
from typing import Dict, Any, List, Optional

_lock = threading.Lock()
_active_traces: Dict[str, Dict[str, Any]] = {}
_trace_history: List[Dict[str, Any]] = []

def start_trace(corr_id: Optional[str] = None) -> str:
    if not corr_id:
        corr_id = f"msg_{uuid.uuid4().hex[:8]}"
    with _lock:
        trace = {
            "corr_id": corr_id,
            "start_time": time.monotonic(),
            "stages": {},
            "llm_calls": [],
            "db_queries": [],
            "rag": None,
            "external_api": [],
            "outbound_wa": []
        }
        _active_traces[corr_id] = trace
    return corr_id

def record_stage(corr_id: str, stage_id: str, stage_name: str, duration_ms: float, details: Optional[Dict] = None):
    if not corr_id:
        return
    with _lock:
        if corr_id in _active_traces:
            _active_traces[corr_id]["stages"][stage_id] = {
                "name": stage_name,
                "duration_ms": round(duration_ms, 2),
                "details": details or {}
            }

def record_llm_call(corr_id: str, model: str, prompt_tokens: int, latency_ms: float, details: Optional[Dict] = None):
    if not corr_id:
        return
    with _lock:
        if corr_id in _active_traces:
            _active_traces[corr_id]["llm_calls"].append({
                "model": model,
                "prompt_tokens": prompt_tokens,
                "latency_ms": round(latency_ms, 2),
                "details": details or {}
            })

def record_db_query(corr_id: str, query_type: str, duration_ms: float):
    if not corr_id:
        return
    with _lock:
        if corr_id in _active_traces:
            _active_traces[corr_id]["db_queries"].append({
                "query": query_type,
                "duration_ms": round(duration_ms, 2)
            })

def record_rag(corr_id: str, embedding_ms: float, vector_search_ms: float, top_k: int, context_size_bytes: int):
    if not corr_id:
        return
    with _lock:
        if corr_id in _active_traces:
            _active_traces[corr_id]["rag"] = {
                "embedding_ms": round(embedding_ms, 2),
                "vector_search_ms": round(vector_search_ms, 2),
                "top_k": top_k,
                "context_size_bytes": context_size_bytes
            }

def record_external_api(corr_id: str, api_name: str, duration_ms: float):
    if not corr_id:
        return
    with _lock:
        if corr_id in _active_traces:
            _active_traces[corr_id]["external_api"].append({
                "api": api_name,
                "duration_ms": round(duration_ms, 2)
            })

def record_outbound_wa(corr_id: str, msg_type: str, duration_ms: float, wamid: Optional[str] = None):
    if not corr_id:
        return
    with _lock:
        if corr_id in _active_traces:
            _active_traces[corr_id]["outbound_wa"].append({
                "type": msg_type,
                "duration_ms": round(duration_ms, 2),
                "wamid": wamid
            })

def finish_trace(corr_id: str) -> Optional[Dict[str, Any]]:
    if not corr_id:
        return None
    with _lock:
        trace = _active_traces.pop(corr_id, None)
        if trace:
            trace["total_ms"] = round((time.monotonic() - trace["start_time"]) * 1000, 2)
            _trace_history.append(trace)
            return trace
    return None

def get_trace(corr_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        return _active_traces.get(corr_id)

def get_history() -> List[Dict[str, Any]]:
    with _lock:
        return list(_trace_history)
