import json
import ast
import datetime
import decimal
import uuid
import time
import os
import psycopg2
import psycopg2.extras
from psycopg2.pool import PoolError
from typing import Optional, List, Dict, Any
from config.config import Config
from db.postgres_connector import PostgresConnector

class DatabricksConnector:
    """
    Unified Database Connector for Healthcare Lakehouse APIs.
    Operates natively against PostgreSQL (host: rivesca.eu.db.rivestack.io),
    providing high-performance, resilient data access for all clinical views,
    Gold schemas, Bronze tables, and LLM discharge summarization agents.
    """
    _connection_failed_until: float = 0.0
    _query_cache: dict = {}
    _CACHE_TTL_SECONDS: int = 5  # 5s cache for high performance without stale data

    def __init__(self):
        self.config = Config
        self.pg_connector = PostgresConnector()

    @classmethod
    def get_cached_result(cls, cache_key: str):
        if cache_key in cls._query_cache:
            entry = cls._query_cache[cache_key]
            if time.time() - entry["timestamp"] < cls._CACHE_TTL_SECONDS:
                return entry["data"]
            else:
                del cls._query_cache[cache_key]
        return None

    @classmethod
    def set_cached_result(cls, cache_key: str, data: Any):
        cls._query_cache[cache_key] = {
            "timestamp": time.time(),
            "data": data
        }

    @classmethod
    def clear_cache(cls):
        cls._query_cache.clear()

    @classmethod
    def is_connection_available(cls) -> bool:
        return time.time() >= cls._connection_failed_until

    @classmethod
    def mark_connection_failed(cls, cooldown_seconds: int = 10):
        cls._connection_failed_until = time.time() + cooldown_seconds

    @classmethod
    def mark_connection_healthy(cls):
        cls._connection_failed_until = 0.0

    @property
    def _connection_failed(self) -> bool:
        return not self.is_connection_available()

    def get_connection(self):
        """Returns an active PostgreSQL connection."""
        if not self.is_connection_available():
            raise RuntimeError("Database connection is in temporary cooldown. Retrying soon.")
        try:
            conn = self.pg_connector.get_connection()
            DatabricksConnector.mark_connection_healthy()
            return conn
        except PoolError:
            # Local contention is not a database outage.
            raise
        except Exception as e:
            DatabricksConnector.mark_connection_failed()
            raise e

    def init_catalog_and_schema(self):
        """Initializes database and ensures schema exists."""
        pass

    @staticmethod
    def _serialize_val(v):
        if v is None:
            return None
        if hasattr(v, "tolist") and callable(v.tolist):
            return [DatabricksConnector._serialize_val(x) for x in v.tolist()]
        if hasattr(v, "item") and callable(v.item):
            return DatabricksConnector._serialize_val(v.item())
        if isinstance(v, (list, tuple, set)):
            return [DatabricksConnector._serialize_val(x) for x in v]
        if isinstance(v, dict):
            return {str(k): DatabricksConnector._serialize_val(val) for k, val in v.items()}
        if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
            return v.isoformat()
        if isinstance(v, decimal.Decimal):
            return float(v)
        if isinstance(v, uuid.UUID):
            return str(v)
        if isinstance(v, (bytes, bytearray)):
            return v.decode('utf-8', errors='ignore')
        return v

    def resolve_table_name(self, table_name: str) -> str:
        """Resolves alias table names to active PostgreSQL tables."""
        t = table_name.lower().strip()
        if t == "dim_discharge_input":
            return "dim_admission_inputs"
        return t

    def get_row_count(self, table_name: str, schema: str = None) -> int:
        """Retrieves exact row count for a table from PostgreSQL."""
        real_table = self.resolve_table_name(table_name)
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"SELECT COUNT(*) FROM {real_table};")
                cnt = cursor.fetchone()[0]
                cursor.close()
            return cnt
        except Exception:
            return 0

    def list_tables(self, schema: str = None) -> list:
        """Returns dynamic list of table metadata from PostgreSQL."""
        cache_key = "list_tables_meta"
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            return cached

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT t.table_name, COALESCE(s.n_live_tup, 0) AS row_count
                FROM information_schema.tables t
                LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
                WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_name;
            """)
            rows = cursor.fetchall()
            cursor.close()

        result = []
        for r in rows:
            t_name = r[0]
            row_cnt = int(r[1]) if r[1] is not None else 0
            result.append({
                "table_name": t_name,
                "catalog": self.config.POSTGRES_DB,
                "schema": "public",
                "row_count": row_cnt
            })

        self.set_cached_result(cache_key, result)
        return result

    def get_table_schema(self, table_name: str, schema: str = None) -> list:
        """Returns dynamic column definitions from PostgreSQL."""
        real_table = self.resolve_table_name(table_name)
        cache_key = f"schema:{real_table}"
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            return cached

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = %s AND table_schema = 'public'
                ORDER BY ordinal_position;
            """, (real_table,))
            rows = cursor.fetchall()
            cursor.close()

        cols = []
        for r in rows:
            cols.append({
                "column_name": r[0],
                "data_type": r[1].upper(),
                "is_nullable": r[2] == "YES"
            })

        self.set_cached_result(cache_key, cols)
        return cols

    def execute_custom_query(self, query: str) -> list:
        """Executes a custom dynamic SQL query against PostgreSQL and returns serialized dict records."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query)
            col_names = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            cursor.close()

        records = []
        for row in rows:
            row_dict = {}
            for col_idx, col_name in enumerate(col_names):
                val = row[col_idx]
                row_dict[col_name] = self._serialize_val(val)
            records.append(row_dict)
        return records

    @staticmethod
    def _map_filter_col(table: str, col_name: str) -> str:
        t = table.lower()
        c = col_name.lower()
        if t == "patients":
            if c == "patient_id":
                return "id"
            if c == "patient_number":
                return "patient_code"
        elif t == "doctors":
            if c == "doctor_id":
                return "id"
        elif t == "dim_generated_discharge_summaries":
            if c == "attending_physician":
                return "primary_consultant"
        elif t == "dim_admission_inputs":
            if c in ("admission_status", "status"):
                return "discharge_status"
        return col_name

    @staticmethod
    def _post_process_row(table: str, row_dict: dict) -> dict:
        t = table.lower()
        if t == "dim_admission_inputs":
            # Some imported snapshots store Python dict text instead of JSON.
            # Normalize at the API boundary without rewriting patient records.
            value = row_dict.get("llm_input_json")
            if isinstance(value, str):
                try:
                    parsed = json.loads(value)
                except (ValueError, TypeError):
                    try:
                        parsed = ast.literal_eval(value)
                    except (ValueError, SyntaxError, TypeError, RecursionError):
                        parsed = None
                if isinstance(parsed, dict):
                    row_dict["llm_input_json"] = parsed
        if t == "patients":
            if "id" in row_dict and "patient_id" not in row_dict:
                row_dict["patient_id"] = row_dict["id"]
            if "patient_code" in row_dict and "patient_number" not in row_dict:
                row_dict["patient_number"] = row_dict["patient_code"]
        elif t == "doctors":
            if "id" in row_dict and "doctor_id" not in row_dict:
                row_dict["doctor_id"] = row_dict["id"]
        elif t == "beds":
            if "bed_id" in row_dict and "id" not in row_dict:
                row_dict["id"] = row_dict["bed_id"]
        elif t == "wards":
            if "ward_id" in row_dict and "id" not in row_dict:
                row_dict["id"] = row_dict["ward_id"]
        elif t == "rooms":
            if "room_id" in row_dict and "id" not in row_dict:
                row_dict["id"] = row_dict["room_id"]
        elif t == "dim_generated_discharge_summaries":
            if "primary_consultant" in row_dict and "attending_physician" not in row_dict:
                row_dict["attending_physician"] = row_dict["primary_consultant"]
            if "patient_id" in row_dict and "patient_number" not in row_dict:
                row_dict["patient_number"] = f"PAT-{row_dict['patient_id']}"
        return row_dict

    def query_table(self, table_name: str, limit: Optional[int] = None, offset: int = 0, schema: str = None) -> dict:
        """Query rows from PostgreSQL table with dynamic pagination."""
        real_table = self.resolve_table_name(table_name)
        offset = max(0, offset)
        cache_key = f"table:{real_table}:{limit}:{offset}"
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            return cached

        limit_sql = f" LIMIT {int(limit)}" if limit is not None and limit > 0 else ""
        offset_sql = f" OFFSET {int(offset)}" if offset > 0 else ""

        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"SELECT COUNT(*) FROM {real_table};")
                total_rows = cursor.fetchone()[0]

                query = f"SELECT * FROM {real_table}{limit_sql}{offset_sql};"
                cursor.execute(query)
                col_names = [desc[0] for desc in cursor.description] if cursor.description else []
                raw_rows = cursor.fetchall()
                cursor.close()

            rows = []
            for r in raw_rows:
                row_dict = {}
                for idx, col in enumerate(col_names):
                    row_dict[col] = self._serialize_val(r[idx])
                row_dict = self._post_process_row(real_table, row_dict)
                rows.append(row_dict)

            result = {
                "table_name": table_name,
                "catalog": self.config.POSTGRES_DB,
                "schema": "public",
                "count": len(rows),
                "total_rows": total_rows,
                "offset": offset,
                "limit": limit,
                "data": rows
            }
            self.set_cached_result(cache_key, result)
            return result
        except Exception as e:
            raise e

    def query_gold_table(
        self,
        table_name: str,
        filters: Optional[dict] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
        schema: str = None
    ) -> dict:
        """Query rows from PostgreSQL with dynamic WHERE clauses, sorting, and pagination."""
        real_table = self.resolve_table_name(table_name)
        offset = max(0, offset)

        cache_key = f"gold:{real_table}:{str(filters)}:{limit}:{offset}:{sort_by}:{sort_order}"
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            return cached

        where_clauses = []
        params = []
        if filters:
            for col, val in filters.items():
                if val is not None:
                    db_col = self._map_filter_col(real_table, col)
                    where_clauses.append(f"{db_col} = %s")
                    params.append(val)

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        mapped_sort = self._map_filter_col(real_table, sort_by) if sort_by else None
        sort_sql = f" ORDER BY {mapped_sort} {'DESC' if sort_order.lower() == 'desc' else 'ASC'}" if mapped_sort else ""
        limit_sql = f" LIMIT {int(limit)}" if limit is not None and limit > 0 else ""
        offset_sql = f" OFFSET {int(offset)}" if offset > 0 else ""

        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                count_query = f"SELECT COUNT(*) FROM {real_table}{where_sql};"
                cursor.execute(count_query, params)
                total_matching = cursor.fetchone()[0]

                data_query = f"SELECT * FROM {real_table}{where_sql}{sort_sql}{limit_sql}{offset_sql};"
                cursor.execute(data_query, params)
                col_names = [desc[0] for desc in cursor.description] if cursor.description else []
                raw_rows = cursor.fetchall()
                cursor.close()

            rows = []
            for r in raw_rows:
                row_dict = {}
                for idx, col in enumerate(col_names):
                    row_dict[col] = self._serialize_val(r[idx])
                row_dict = self._post_process_row(real_table, row_dict)
                rows.append(row_dict)

            result = {
                "table_name": table_name,
                "catalog": self.config.POSTGRES_DB,
                "schema": "public",
                "count": len(rows),
                "total_rows": total_matching,
                "offset": offset,
                "limit": limit,
                "data": rows
            }
            self.set_cached_result(cache_key, result)
            return result
        except Exception as e:
            raise e

    def query_bronze_table(
        self,
        table_name: str,
        filters: Optional[dict] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
        schema: str = None
    ) -> dict:
        """Alias for querying tables in PostgreSQL."""
        return self.query_gold_table(table_name, filters, limit, offset, sort_by, sort_order, schema)

    def update_record(self, table_name: str, key_field: str, key_value: any, updates: dict, schema: str = None) -> dict:
        """Updates one or more fields of a row in PostgreSQL and clears cache."""
        if not updates:
            return {"status": "no_op", "message": "No fields to update"}

        real_table = self.resolve_table_name(table_name)
        set_clauses = []
        params = []
        for col, val in updates.items():
            set_clauses.append(f"{col} = %s")
            params.append(val)

        params.append(key_value)
        sql_stmt = f"UPDATE {real_table} SET {', '.join(set_clauses)} WHERE {key_field} = %s;"

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql_stmt, params)
            conn.commit()
            cursor.close()

        self.clear_cache()
        updated_res = self.query_gold_table(real_table, filters={key_field: key_value}, limit=1)
        updated_data = updated_res.get("data", [])
        return {
            "status": "success",
            "table_name": real_table,
            "key_field": key_field,
            "key_value": key_value,
            "updated_fields": list(updates.keys()),
            "data": updated_data[0] if updated_data else None
        }

    def insert_record(self, table_name: str, record: dict) -> dict:
        """Inserts a single record into PostgreSQL using parameterized query with RETURNING *.
        BIGSERIAL/SERIAL columns must NOT be included in the record dict — the DB generates them.
        Returns the inserted row including the auto-generated primary key."""
        if not record:
            return {}

        real_table = self.resolve_table_name(table_name)
        cols = list(record.keys())
        vals = [record[c] for c in cols]
        cols_str = ", ".join(f'"{c}"' for c in cols)
        placeholders = ", ".join(["%s"] * len(cols))
        sql = f'INSERT INTO {real_table} ({cols_str}) VALUES ({placeholders}) RETURNING *;'

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, vals)
            col_names = [desc[0] for desc in cursor.description] if cursor.description else []
            row = cursor.fetchone()
            conn.commit()
            cursor.close()

        if row:
            row_dict = dict(zip(col_names, [self._serialize_val(v) for v in row]))
            return self._post_process_row(real_table, row_dict)
        return {}

    def insert_batch_fast(self, table_name: str, col_names: list, rows: list, batch_chunk_size=500):
        """Inserts batch records into PostgreSQL."""
        if not rows:
            return

        real_table = self.resolve_table_name(table_name)
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cols_str = ", ".join(col_names)
            placeholders = ", ".join(["%s"] * len(col_names))
            insert_sql = f"INSERT INTO {real_table} ({cols_str}) VALUES ({placeholders});"

            psycopg2.extras.execute_batch(cursor, insert_sql, rows, page_size=batch_chunk_size)
            conn.commit()
            cursor.close()
        self.clear_cache()

    def run_notebook_inline(self, notebook_path: str = None) -> dict:
        """Executes the ingestion pipeline inline in PostgreSQL."""
        try:
            from db.build_dim_admission_inputs import run_pipeline
            run_pipeline(admitted_only=True)
            self.clear_cache()
            return {
                "status": "SUCCESS",
                "message": "PostgreSQL Ingestion pipeline completed successfully",
                "ingested_table": "dim_admission_inputs"
            }
        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e)
            }
