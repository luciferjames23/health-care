"""
rag_audit_service.py
====================
Audit logging and compliance service for Meridian Hospital AI Hybrid RAG.

Records every user query, correlation request ID, retrieval strategy,
retrieved source IDs, and failure reasons into `rag_query_audit`.
"""

import sys
import os
import json
import uuid
import hashlib
from typing import Dict, Any, List, Optional
import psycopg2.extras

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config


class RagAuditService:
    def log_query(
        self,
        request_id: str,
        user_id: Optional[int],
        role: Optional[str],
        area: Optional[str],
        query: str,
        expanded_query: Optional[Dict[str, Any]] = None,
        retrieval_strategy: Optional[str] = "hybrid",
        result_count: int = 0,
        source_ids: Optional[List[int]] = None,
        patient_id: Optional[int] = None,
        admission_id: Optional[int] = None,
        order_id: Optional[str] = None,
        response_status: int = 200,
        failure_reason: Optional[str] = None
    ) -> None:
        """Asynchronously or synchronously records query audit entry safely without failing user queries."""
        try:
            conn = db_config.get_db_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO rag_query_audit (
                        request_id, user_id, role, area,
                        patient_id, admission_id, order_id,
                        query, expanded_query, retrieval_strategy,
                        result_count, source_ids, response_status, failure_reason
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s
                    );
                """, (
                    request_id, user_id, role, area,
                    patient_id, admission_id, order_id,
                    "sha256:" + hashlib.sha256(query.encode("utf-8")).hexdigest(),
                    json.dumps({"intent": (expanded_query or {}).get("intent")}), retrieval_strategy,
                    result_count, json.dumps(source_ids or []), response_status,
                    failure_reason[:200] if failure_reason else None
                ))
                conn.commit()
            conn.close()
        except Exception as e:
            # Audit logging error should not block critical clinical care
            print(f"[RAG AUDIT WARNING] Failed to record audit log: {e}")


# Global singleton instance
audit_service = RagAuditService()
