import json
import datetime
import decimal
import uuid
import time
import requests
from typing import Optional
from databricks import sql
from config.config import Config

class DatabricksConnector:
    _connection_failed_until: float = 0.0
    _query_cache: dict = {}
    _CACHE_TTL_SECONDS: int = 15  # 15s cache to prevent query flooding

    def __init__(self):
        self.config = Config

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
    def set_cached_result(cls, cache_key: str, data: any):
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
    def mark_connection_failed(cls, cooldown_seconds: int = 15):
        cls._connection_failed_until = time.time() + cooldown_seconds

    @classmethod
    def mark_connection_healthy(cls):
        cls._connection_failed_until = 0.0

    @property
    def _connection_failed(self) -> bool:
        return not self.is_connection_available()

    def get_connection(self):
        if not self.is_connection_available():
            raise RuntimeError("Databricks connection is in temporary cooldown. Retrying soon.")
        try:
            conn = sql.connect(
                server_hostname=self.config.DATABRICKS_SERVER_HOSTNAME,
                http_path=self.config.DATABRICKS_HTTP_PATH,
                access_token=self.config.DATABRICKS_ACCESS_TOKEN,
                _retry_delay=1
            )
            DatabricksConnector.mark_connection_healthy()
            return conn
        except Exception as e:
            DatabricksConnector.mark_connection_failed()
            raise e

    def init_catalog_and_schema(self):
        """Creates catalog and schema dynamically in Databricks if not exists."""
        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = self.config.DATABRICKS_SCHEMA

        cursor.execute(f"CREATE CATALOG IF NOT EXISTS `{catalog}`")
        cursor.execute(f"USE CATALOG `{catalog}`")
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS `{schema}`")
        cursor.execute(f"USE SCHEMA `{schema}`")
        
        cursor.close()
        conn.close()

    def create_table_from_pg_schema(self, table_name: str, col_meta_list: list):
        """Creates Delta table dynamically based on column metadata."""
        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = self.config.DATABRICKS_SCHEMA

        cols_def = []
        for col in col_meta_list:
            col_name = col["column_name"]
            pg_type_lower = col["data_type"].lower()
            if "int" in pg_type_lower:
                db_type = "BIGINT" if "big" in pg_type_lower else "INT"
            elif any(t in pg_type_lower for t in ["numeric", "decimal", "double", "real"]):
                db_type = "DOUBLE"
            elif "bool" in pg_type_lower:
                db_type = "BOOLEAN"
            elif pg_type_lower == "date":
                db_type = "DATE"
            elif "timestamp" in pg_type_lower or "time" in pg_type_lower:
                db_type = "TIMESTAMP"
            else:
                db_type = "STRING"

            cols_def.append(f"`{col_name}` {db_type}")

        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"
        create_sql = f"CREATE OR REPLACE TABLE {full_table_name} (\n  " + ",\n  ".join(cols_def) + "\n) USING DELTA;"
        
        cursor.execute(create_sql)
        cursor.close()
        conn.close()

    @staticmethod
    def _sql_quote(val):
        if val is None:
            return "NULL"
        if isinstance(val, bool):
            return "TRUE" if val else "FALSE"
        if isinstance(val, (int, float, decimal.Decimal)):
            return str(val)
        if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
            return f"'{val}'"
        if isinstance(val, (dict, list)):
            s = json.dumps(val).replace("\\", "\\\\").replace("'", "''")
            return f"'{s}'"
        if isinstance(val, uuid.UUID):
            return f"'{val}'"
        
        s = str(val).replace("\\", "\\\\").replace("'", "''")
        return f"'{s}'"

    def insert_batch_fast(self, table_name: str, col_names: list, rows: list, batch_chunk_size=1500):
        """Inserts batch records dynamically into Databricks Delta table."""
        if not rows:
            return

        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG or "health_care"
        schema = self.config.DATABRICKS_SCHEMA or "gold"
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        escaped_cols = ", ".join([f"`{col}`" for col in col_names])

        total_rows = len(rows)
        for i in range(0, total_rows, batch_chunk_size):
            chunk = rows[i:i + batch_chunk_size]
            val_tuples = []
            for row in chunk:
                tuple_str = "(" + ", ".join(self._sql_quote(v) for v in row) + ")"
                val_tuples.append(tuple_str)
            
            sql_stmt = f"INSERT INTO {full_table_name} ({escaped_cols}) VALUES " + ", ".join(val_tuples)
            try:
                cursor.execute(sql_stmt)
            except Exception as insert_err:
                if "TABLE_OR_VIEW_NOT_FOUND" in str(insert_err):
                    # Auto-create table with STRING / BIGINT columns dynamically
                    col_defs = []
                    for c in col_names:
                        col_type = "BIGINT" if "id" in c.lower() and "summary" not in c.lower() else "STRING"
                        col_defs.append(f"`{c}` {col_type}")
                    create_sql = f"CREATE TABLE IF NOT EXISTS {full_table_name} (\n  " + ",\n  ".join(col_defs) + "\n) USING DELTA;"
                    cursor.execute(create_sql)
                    cursor.execute(sql_stmt)
                else:
                    raise insert_err

        cursor.close()
        conn.close()

    def update_record(self, table_name: str, key_field: str, key_value: any, updates: dict, schema: str = None) -> dict:
        """Updates one or more fields of a row dynamically in Databricks Delta table and clears cache."""
        if not updates:
            return {"status": "no_op", "message": "No fields to update"}

        catalog = self.config.DATABRICKS_CATALOG or "health_care"
        schema = schema or self.config.DATABRICKS_SCHEMA or "gold"
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        set_clauses = []
        for col, val in updates.items():
            quoted_val = self._sql_quote(val)
            set_clauses.append(f"`{col}` = {quoted_val}")

        set_sql = ", ".join(set_clauses)
        quoted_key = self._sql_quote(key_value)

        sql_stmt = f"UPDATE {full_table_name} SET {set_sql} WHERE `{key_field}` = {quoted_key}"

        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(sql_stmt)
        cursor.close()
        conn.close()

        self.clear_cache()

        # Query updated row
        updated_res = self.query_gold_table(table_name, filters={key_field: key_value}, limit=1)
        updated_data = updated_res.get("data", [])
        return {
            "status": "success",
            "table_name": table_name,
            "key_field": key_field,
            "key_value": key_value,
            "updated_fields": list(updates.keys()),
            "data": updated_data[0] if updated_data else None
        }


    def get_row_count(self, table_name: str, schema: str = None) -> int:
        """Retrieves exact dynamic row count for a table from Databricks."""
        catalog = self.config.DATABRICKS_CATALOG
        schema = schema or self.config.DATABRICKS_SCHEMA
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {full_table_name}")
            cnt = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            return cnt
        except Exception:
            return 0

    def list_tables(self, schema: str = None) -> list:
        """Returns dynamic list of table metadata from Databricks SHOW TABLES."""
        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = schema or self.config.DATABRICKS_SCHEMA

        cursor.execute(f"SHOW TABLES IN `{catalog}`.`{schema}`")
        raw_tables = cursor.fetchall()
        cursor.close()
        conn.close()

        result = []
        for r in raw_tables:
            t_name = getattr(r, 'tableName', None) or r[1]
            if t_name:
                row_cnt = self.get_row_count(t_name, schema=schema)
                result.append({
                    "table_name": t_name,
                    "catalog": catalog,
                    "schema": schema,
                    "row_count": row_cnt
                })
        return result

    def get_table_schema(self, table_name: str, schema: str = None) -> list:
        """Returns dynamic column definitions from Databricks DESCRIBE TABLE."""
        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = schema or self.config.DATABRICKS_SCHEMA
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        cursor.execute(f"DESCRIBE TABLE {full_table_name}")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        cols = []
        for r in rows:
            col_name = r[0]
            data_type = r[1]
            if col_name and not col_name.startswith("#") and col_name.strip() != "":
                cols.append({
                    "column_name": col_name,
                    "data_type": data_type
                })
        return cols

    @classmethod
    def _serialize_val(cls, v):
        if v is None:
            return None
        if hasattr(v, "tolist") and callable(v.tolist):
            return [cls._serialize_val(x) for x in v.tolist()]
        if hasattr(v, "item") and callable(v.item):
            return cls._serialize_val(v.item())
        if isinstance(v, (list, tuple, set)):
            return [cls._serialize_val(x) for x in v]
        if isinstance(v, dict):
            return {str(k): cls._serialize_val(val) for k, val in v.items()}
        if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
            return v.isoformat()
        if isinstance(v, decimal.Decimal):
            return float(v)
        if isinstance(v, uuid.UUID):
            return str(v)
        if isinstance(v, (bytes, bytearray)):
            return v.decode('utf-8', errors='ignore')
        return v

    def execute_custom_query(self, query: str) -> list:
        """Executes a custom dynamic SQL query against Databricks and returns dict records."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(query)
        col_names = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        records = []
        for row in rows:
            row_dict = {}
            for col_idx, col_name in enumerate(col_names):
                val = row[col_idx]
                row_dict[col_name] = self._serialize_val(val)
            records.append(row_dict)
        return records

    def query_table(self, table_name: str, limit: Optional[int] = None, offset: int = 0, schema: str = None) -> dict:
        """Query rows from Databricks table with dynamic pagination."""
        catalog = self.config.DATABRICKS_CATALOG
        schema = schema or self.config.DATABRICKS_SCHEMA
        cache_key = f"table:{catalog}:{schema}:{table_name}:{limit}:{offset}"
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            return cached

        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        offset = max(0, offset)
        limit_sql = f" LIMIT {limit}" if limit is not None and limit > 0 else ""
        offset_sql = f" OFFSET {offset}" if offset > 0 else ""

        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            total_rows = self.get_row_count(table_name, schema=schema)

            query = f"SELECT * FROM {full_table_name}{limit_sql}{offset_sql}"
            cursor.execute(query)
            
            col_names = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()

            cursor.close()
            conn.close()

            records = []
            for row in rows:
                row_dict = {}
                for col_idx, col_name in enumerate(col_names):
                    val = row[col_idx]
                    row_dict[col_name] = self._serialize_val(val)
                records.append(row_dict)

            res = {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": total_rows,
                "limit": limit,
                "offset": offset,
                "returned_rows": len(records),
                "data": records,
                "source": "databricks"
            }
            self.set_cached_result(cache_key, res)
            return res
        except Exception as e:
            return {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": 0,
                "limit": limit,
                "offset": offset,
                "returned_rows": 0,
                "data": [],
                "source": "databricks",
                "error": str(e)
            }

    def query_gold_table(self, table_name: str, filters: dict = None, limit: Optional[int] = None, offset: int = 0) -> dict:
        """Query Gold schema table with dynamic WHERE filters and pagination from Databricks."""
        filters = filters or {}
        catalog = self.config.DATABRICKS_CATALOG
        schema = self.config.DATABRICKS_SCHEMA or "gold"
        filter_str = json.dumps(filters, sort_keys=True)
        cache_key = f"gold:{catalog}:{schema}:{table_name}:{filter_str}:{limit}:{offset}"
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            return cached

        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        offset = max(0, offset)
        limit_sql = f" LIMIT {limit}" if limit is not None and limit > 0 else ""
        offset_sql = f" OFFSET {offset}" if offset > 0 else ""

        where_clauses = []
        for col, val in filters.items():
            if val is not None:
                if isinstance(val, bool):
                    where_clauses.append(f"`{col}` = {str(val).upper()}")
                elif isinstance(val, (int, float)):
                    where_clauses.append(f"`{col}` = {val}")
                elif col.endswith("_gt"):
                    real_col = col[:-3]
                    where_clauses.append(f"`{real_col}` >= {val}")
                elif col.endswith("_lt"):
                    real_col = col[:-3]
                    where_clauses.append(f"`{real_col}` <= {val}")
                elif col.endswith("_from"):
                    real_col = col[:-5]
                    where_clauses.append(f"`{real_col}` >= '{val}'")
                elif col.endswith("_to"):
                    real_col = col[:-3]
                    where_clauses.append(f"`{real_col}` <= '{val}'")
                else:
                    escaped = str(val).replace("'", "''")
                    where_clauses.append(f"`{col}` = '{escaped}'")

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            cnt_sql = f"SELECT COUNT(*) FROM {full_table_name}{where_sql}"
            cursor.execute(cnt_sql)
            total_rows = cursor.fetchone()[0]

            query_sql = f"SELECT * FROM {full_table_name}{where_sql}{limit_sql}{offset_sql}"
            cursor.execute(query_sql)

            col_names = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            records = []
            for row in rows:
                row_dict = {}
                for col_idx, col_name in enumerate(col_names):
                    val = row[col_idx]
                    row_dict[col_name] = self._serialize_val(val)
                records.append(row_dict)

            res = {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": total_rows,
                "limit": limit,
                "offset": offset,
                "returned_rows": len(records),
                "data": records,
                "applied_filters": filters,
                "source": "databricks"
            }
            self.set_cached_result(cache_key, res)
            return res
        except Exception as e:
            return {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": 0,
                "limit": limit,
                "offset": offset,
                "returned_rows": 0,
                "data": [],
                "applied_filters": filters,
                "source": "databricks",
                "error": str(e)
            }

    def query_bronze_table(self, table_name: str, filters: dict = None, limit: Optional[int] = None, offset: int = 0) -> dict:
        """Query Bronze schema table with dynamic WHERE filters and pagination from Databricks."""
        filters = filters or {}
        catalog = self.config.DATABRICKS_CATALOG
        schema = "bronze"
        filter_str = json.dumps(filters, sort_keys=True)
        cache_key = f"bronze:{catalog}:{schema}:{table_name}:{filter_str}:{limit}:{offset}"
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            return cached

        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        offset = max(0, offset)
        limit_sql = f" LIMIT {limit}" if limit is not None and limit > 0 else ""
        offset_sql = f" OFFSET {offset}" if offset > 0 else ""

        where_clauses = []
        for col, val in filters.items():
            if val is not None:
                if isinstance(val, bool):
                    where_clauses.append(f"`{col}` = {str(val).upper()}")
                elif isinstance(val, (int, float)):
                    where_clauses.append(f"`{col}` = {val}")
                elif col.endswith("_gt"):
                    real_col = col[:-3]
                    where_clauses.append(f"`{real_col}` >= {val}")
                elif col.endswith("_lt"):
                    real_col = col[:-3]
                    where_clauses.append(f"`{real_col}` <= {val}")
                elif col.endswith("_from"):
                    real_col = col[:-5]
                    where_clauses.append(f"`{real_col}` >= '{val}'")
                elif col.endswith("_to"):
                    real_col = col[:-3]
                    where_clauses.append(f"`{real_col}` <= '{val}'")
                else:
                    escaped = str(val).replace("'", "''")
                    where_clauses.append(f"`{col}` = '{escaped}'")

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            cnt_sql = f"SELECT COUNT(*) FROM {full_table_name}{where_sql}"
            cursor.execute(cnt_sql)
            total_rows = cursor.fetchone()[0]

            query_sql = f"SELECT * FROM {full_table_name}{where_sql}{limit_sql}{offset_sql}"
            cursor.execute(query_sql)

            col_names = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            records = []
            for row in rows:
                row_dict = {}
                for col_idx, col_name in enumerate(col_names):
                    val = row[col_idx]
                    row_dict[col_name] = self._serialize_val(val)
                records.append(row_dict)

            res = {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": total_rows,
                "limit": limit,
                "offset": offset,
                "returned_rows": len(records),
                "data": records,
                "applied_filters": filters,
                "source": "databricks"
            }
            self.set_cached_result(cache_key, res)
            return res
        except Exception as e:
            return {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": 0,
                "limit": limit,
                "offset": offset,
                "returned_rows": 0,
                "data": [],
                "applied_filters": filters,
                "source": "databricks",
                "error": str(e)
            }

    def _resolve_notebook_path(self, notebook_id_or_path: str) -> str:
        """Resolve a Databricks notebook object ID or path dynamically via Workspace API."""
        nb_id = str(notebook_id_or_path).strip()

        if nb_id.startswith("/"):
            return nb_id

        hostname = self.config.DATABRICKS_SERVER_HOSTNAME
        token    = self.config.DATABRICKS_ACCESS_TOKEN
        if hostname and token:
            headers = {"Authorization": f"Bearer {token}"}
            base_url = f"https://{hostname}"

            def _walk(path: str, depth: int = 0) -> Optional[str]:
                if depth > 6:
                    return None
                try:
                    r = requests.get(
                        f"{base_url}/api/2.0/workspace/list",
                        headers=headers, params={"path": path}, timeout=15
                    )
                    if r.status_code != 200:
                        return None
                    for obj in r.json().get("objects", []):
                        if str(obj.get("object_id", "")) == nb_id:
                            return obj.get("path")
                        if obj.get("object_type") == "DIRECTORY":
                            found = _walk(obj["path"], depth + 1)
                            if found:
                                return found
                except Exception:
                    pass
                return None

            for root in ["/Users", "/Shared", "/Repos"]:
                found_path = _walk(root)
                if found_path:
                    return found_path

        raise ValueError(
            f"Cannot resolve notebook ID '{nb_id}' to a workspace path dynamically. "
            f"Please provide the absolute path (e.g. /Users/.../NotebookName)."
        )

    def run_databricks_notebook(self, notebook_path_or_id: str = "2865138219507461", parameters: dict = None, timeout_seconds: int = 300) -> dict:
        """Executes a Databricks Notebook directly via runs/submit API (or Job if job_id specified) and returns execution output."""
        parameters = parameters or {}
        hostname = self.config.DATABRICKS_SERVER_HOSTNAME
        token    = self.config.DATABRICKS_ACCESS_TOKEN
        workspace_id = self.config.DATABRICKS_WORKSPACE_ID or "7474647603878213"

        if not hostname or not token:
            raise RuntimeError("Databricks credentials missing in configuration.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json"
        }

        patient_id = str(parameters.get("patient_id", "unknown")).strip()
        target_str = str(notebook_path_or_id or "2865138219507461").strip()

        # Known notebook IDs mapped to their workspace paths
        KNOWN_NOTEBOOKS = {
            "2865138219507461": "/Users/jamesrubert02@gmail.com/POC/Health-care/code/Discharge_summary/Discharge Summary LLM Generation",
            "3655906645282312": "/Users/gaberieljayaraj05@gmail.com/POC/Health-care/code/Discharge_summary/Discharge Summary LLM Generation",
        }

        # Check if target is explicitly a registered Job ID (e.g. 63391549950619)
        if target_str == "63391549950619":
            job_id_int = int(target_str)
            payload = {
                "job_id": job_id_int,
                "job_parameters": {str(k): str(v) for k, v in parameters.items()}
            }
            submit_resp = requests.post(
                f"https://{hostname}/api/2.1/jobs/run-now",
                headers=headers, json=payload, timeout=25
            )
            nb_path = f"Job ID {job_id_int}"
        else:
            # Execute the Notebook directly
            if target_str in KNOWN_NOTEBOOKS:
                nb_path = KNOWN_NOTEBOOKS[target_str]
            elif target_str.startswith("/"):
                nb_path = target_str
            else:
                try:
                    nb_path = self._resolve_notebook_path(target_str)
                except Exception:
                    nb_path = KNOWN_NOTEBOOKS.get("2865138219507461")

            payload = {
                "run_name": f"Discharge Summary Notebook Run - patient_id={patient_id}",
                "tasks": [
                    {
                        "task_key": "discharge_summary_notebook_task",
                        "notebook_task": {
                            "notebook_path": nb_path,
                            "base_parameters": {str(k): str(v) for k, v in parameters.items()},
                            "source": "WORKSPACE"
                        }
                    }
                ]
            }
            submit_resp = requests.post(
                f"https://{hostname}/api/2.1/jobs/runs/submit",
                headers=headers, json=payload, timeout=25
            )


        if submit_resp.status_code != 200:
            raise RuntimeError(f"Jobs API submission failed ({submit_resp.status_code}): {submit_resp.text}")

        run_id = submit_resp.json().get("run_id")

        start_ts  = time.time()
        final_lc  = "RUNNING"
        final_rs  = ""
        run_page_url = f"https://{hostname}/?o={workspace_id}#job/runs/{run_id}"

        while time.time() - start_ts < timeout_seconds:
            time.sleep(4)
            poll = requests.get(
                f"https://{hostname}/api/2.1/jobs/runs/get",
                headers=headers, params={"run_id": run_id}, timeout=15
            )
            if poll.status_code == 200:
                poll_json = poll.json()
                state = poll_json.get("state", {})
                final_lc = state.get("life_cycle_state", "RUNNING")
                final_rs = state.get("result_state", "")
                if poll_json.get("run_page_url"):
                    run_page_url = poll_json.get("run_page_url")
                if final_lc in ["TERMINATED", "SKIPPED", "INTERNAL_ERROR"]:
                    break

        duration = round(time.time() - start_ts, 1)

        output_data = {}
        error_msg   = None

        run_detail = requests.get(
            f"https://{hostname}/api/2.1/jobs/runs/get",
            headers=headers, params={"run_id": run_id}, timeout=15
        )
        task_run_id = None
        if run_detail.status_code == 200:
            detail_json = run_detail.json()
            if detail_json.get("run_page_url"):
                run_page_url = detail_json.get("run_page_url")
            tasks = detail_json.get("tasks", [])
            if tasks:
                task_run_id = tasks[0].get("run_id")

        if task_run_id:
            out_resp = requests.get(
                f"https://{hostname}/api/2.1/jobs/runs/get-output",
                headers=headers, params={"run_id": task_run_id}, timeout=15
            )
            if out_resp.status_code == 200:
                out_json   = out_resp.json()
                nb_output  = out_json.get("notebook_output", {}).get("result")
                error_msg  = out_json.get("error") or out_json.get("error_trace", "")
                if nb_output:
                    try:
                        output_data = json.loads(nb_output)
                    except Exception:
                        output_data = {"raw_output": nb_output}

        return {
            "status":            "success" if final_rs == "SUCCESS" else ("running" if final_lc in ["RUNNING", "QUEUED", "PENDING"] else "completed_with_issues"),
            "notebook_id":       target_str,
            "notebook_path":     nb_path,
            "run_id":            run_id,
            "task_run_id":       task_run_id,
            "life_cycle_state":  final_lc,
            "execution_state":   final_rs or final_lc,
            "duration_seconds":  duration,
            "parameters_supplied": parameters,
            "output_type":       "discharge_summary_generation",
            "error":             error_msg,
            "data":              output_data.get("data", []) if isinstance(output_data, dict) else [],
            "result":            output_data,
            "source":            "databricks_jobs_api",
            "databricks_run_url": run_page_url
        }

