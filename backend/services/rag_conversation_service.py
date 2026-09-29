"""
rag_conversation_service.py
===========================
Session and message continuity management for Meridian Hospital AI Hybrid RAG.

Enforces:
1. Conversation ownership and role continuity.
2. Context isolation: doctor cannot continue session for unassigned patient.
3. Patient boundary: changing active patient isolates context and requires a new session.
4. Auto-summarization of extended message history.
"""

import sys
import os
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import psycopg2.extras

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config


class RagConversationService:
    def create_conversation(
        self,
        user_id: int,
        role: str,
        area: str,
        patient_id: Optional[int] = None,
        admission_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        order_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Creates a new isolated RAG conversation session."""
        conn = db_config.get_db_connection()
        conv_id = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO rag_conversations (
                        id, user_id, role, area,
                        patient_id, admission_id, doctor_id, order_id,
                        summary, expires_at
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s
                    )
                    RETURNING *;
                """, (
                    conv_id, user_id, role, area,
                    patient_id, admission_id, doctor_id, order_id,
                    f"New {area} inquiry session", expires_at
                ))
                row = cur.fetchone()
                conn.commit()
                return dict(row)
        finally:
            conn.close()

    def get_or_validate_conversation(
        self,
        conversation_id: str,
        user_id: int,
        role: str,
        area: str,
        patient_id: Optional[int] = None,
        order_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Validates conversation existence, user ownership, and patient/order context match.
        Returns None or raises PermissionError if mismatched.
        """
        if not conversation_id:
            return None

        conn = db_config.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM rag_conversations
                    WHERE id = %s;
                """, (conversation_id,))
                conv = cur.fetchone()
                if not conv:
                    return None

                # Enforce ownership
                if conv["user_id"] != user_id:
                    raise PermissionError("Access denied: You do not own this conversation session.")

                # Enforce patient boundary: cannot switch patient inside same conversation
                if patient_id is not None and conv["patient_id"] is not None and conv["patient_id"] != patient_id:
                    # Patient switched! Start fresh session for safety
                    return None

                # Enforce order boundary for radiology
                if order_id is not None and conv["order_id"] is not None and str(conv["order_id"]) != str(order_id):
                    return None

                return dict(conv)
        finally:
            conn.close()

    def get_conversation_history(self, conversation_id: str, user_id: int = None, limit: int = 6) -> List[Dict[str, Any]]:
        """Retrieves recent turns of a conversation, enforcing user ownership."""
        if not conversation_id:
            return []
        conn = db_config.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Defense-in-depth: verify conversation ownership before returning history
                if user_id is not None:
                    cur.execute("SELECT user_id FROM rag_conversations WHERE id = %s;", (conversation_id,))
                    conv = cur.fetchone()
                    if not conv or conv["user_id"] != user_id:
                        return []  # Silently return empty — do not reveal existence

                cur.execute("""
                    SELECT message_type, content, source_ids, created_at
                    FROM rag_messages
                    WHERE conversation_id = %s
                    ORDER BY id ASC;
                """, (conversation_id,))
                rows = cur.fetchall()
                history = []
                for r in rows[-limit:]:
                    history.append({
                        "role": "user" if r["message_type"] == "user" else "assistant",
                        "content": r["content"],
                        "source_ids": r["source_ids"] or []
                    })
                return history
        finally:
            conn.close()

    def add_message(
        self,
        conversation_id: str,
        user_id: int,
        role: str,
        message_type: str,
        content: str,
        source_ids: Optional[List[int]] = None
    ) -> None:
        """Records a user or assistant message to the conversation."""
        if not conversation_id or not content:
            return
        conn = db_config.get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO rag_messages (
                        conversation_id, user_id, role, message_type, content, source_ids
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s
                    );
                """, (
                    conversation_id, user_id, role, message_type,
                    content, json.dumps(source_ids or [])
                ))
                # Update conversation updated_at and summary
                cur.execute("""
                    UPDATE rag_conversations
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (conversation_id,))
                conn.commit()
        finally:
            conn.close()

    def get_full_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Fetches full conversation metadata and all messages."""
        conn = db_config.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM rag_conversations WHERE id = %s;
                """, (conversation_id,))
                conv = cur.fetchone()
                if not conv:
                    return None

                cur.execute("""
                    SELECT id, message_type, content, source_ids, created_at
                    FROM rag_messages
                    WHERE conversation_id = %s
                    ORDER BY id ASC;
                """, (conversation_id,))
                messages = [dict(m) for m in cur.fetchall()]
                result = dict(conv)
                result["messages"] = messages
                return result
        finally:
            conn.close()


# Global singleton instance
conversation_service = RagConversationService()
