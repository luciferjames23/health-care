"""
cache_service.py
================
Centralized thread-safe TTL cache for slow-changing hospital master data.
Strictly NEVER caches real-time transactional data (slots, payments, bookings).
"""

import time
import threading
from typing import Any, Optional, Dict

_lock = threading.Lock()
_cache_store: Dict[str, Dict[str, Any]] = {}

def get_cache(key: str) -> Optional[Any]:
    with _lock:
        entry = _cache_store.get(key)
        if entry:
            if time.time() < entry["expires_at"]:
                return entry["value"]
            else:
                del _cache_store[key]
    return None

def set_cache(key: str, value: Any, ttl_seconds: float = 300.0):
    with _lock:
        _cache_store[key] = {
            "value": value,
            "expires_at": time.time() + ttl_seconds
        }

def invalidate_cache(key_prefix: Optional[str] = None):
    with _lock:
        if not key_prefix:
            _cache_store.clear()
        else:
            keys_to_del = [k for k in _cache_store if k.startswith(key_prefix)]
            for k in keys_to_del:
                del _cache_store[k]
