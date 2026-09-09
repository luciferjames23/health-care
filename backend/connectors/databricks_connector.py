import json
import datetime
import decimal
import uuid
from databricks import sql
from config.config import Config

class DatabricksConnector:
    _connection_failed = False

    def __init__(self):
        self.config = Config

    def get_connection(self):
        if DatabricksConnector._connection_failed:
            raise RuntimeError("Databricks connection previously failed. Using fast offline fallback mode.")
        try:
            return sql.connect(
                server_hostname=self.config.DATABRICKS_SERVER_HOSTNAME,
                http_path=self.config.DATABRICKS_HTTP_PATH,
                access_token=self.config.DATABRICKS_ACCESS_TOKEN,
                _retry_delay=1
            )
        except Exception as e:
            DatabricksConnector._connection_failed = True
            raise e

    def init_catalog_and_schema(self):
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
        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = self.config.DATABRICKS_SCHEMA

        cols_def = []
        for col in col_meta_list:
            col_name = col["column_name"]
            # Map type
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
        
        # String escaping: escape backslash and single quotes
        s = str(val).replace("\\", "\\\\").replace("'", "''")
        return f"'{s}'"

    def insert_batch_fast(self, table_name: str, col_names: list, rows: list, batch_chunk_size=1500):
        if not rows:
            return

        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = self.config.DATABRICKS_SCHEMA
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
            cursor.execute(sql_stmt)

        cursor.close()
        conn.close()

    def get_row_count(self, table_name: str, schema: str = None) -> int:
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
        """Returns list of table metadata including name and row count."""
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
            # DB-SQL connector returns rows with tableName attribute or dict indexing
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
        """Returns column names and data types for a given table."""
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
        # Handle numpy arrays and objects with tolist()
        if hasattr(v, "tolist") and callable(v.tolist):
            return [cls._serialize_val(x) for x in v.tolist()]
        # Handle numpy scalars / item()
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
        """Executes a custom SQL query against Databricks and returns dict records."""
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

    def query_table(self, table_name: str, limit: int = 100, offset: int = 0, schema: str = None) -> dict:
        """Query rows from table with pagination and return serializable dict list."""
        catalog = self.config.DATABRICKS_CATALOG
        schema = schema or self.config.DATABRICKS_SCHEMA
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        limit = max(1, min(limit, 1000))
        offset = max(0, offset)

        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            total_rows = self.get_row_count(table_name, schema=schema)

            query = f"SELECT * FROM {full_table_name} LIMIT {limit} OFFSET {offset}"
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

            return {
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
        except Exception as e:
            # Fallback to mock data if Databricks connection fails
            mock_rows = MOCK_GOLD_DATA.get(table_name, [])
            sliced = mock_rows[offset:offset+limit]
            return {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": len(mock_rows),
                "limit": limit,
                "offset": offset,
                "returned_rows": len(sliced),
                "data": sliced,
                "source": "mock_fallback",
                "notice": f"Databricks unreachable ({str(e)}). Returned mock data."
            }

    def query_gold_table(self, table_name: str, filters: dict = None, limit: int = 50, offset: int = 0) -> dict:
        """Query Gold schema table with dynamic WHERE filters."""
        filters = filters or {}
        catalog = self.config.DATABRICKS_CATALOG
        schema = self.config.DATABRICKS_SCHEMA
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        limit = max(1, min(limit, 1000))
        offset = max(0, offset)

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

            query_sql = f"SELECT * FROM {full_table_name}{where_sql} LIMIT {limit} OFFSET {offset}"
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

            return {
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
        except Exception as e:
            # Filter mock data in memory
            mock_rows = MOCK_GOLD_DATA.get(table_name, [])
            filtered = []
            for item in mock_rows:
                match = True
                for k, v in filters.items():
                    if v is None:
                        continue
                    if k in item:
                        if isinstance(v, bool):
                            if item[k] != v:
                                match = False
                        elif str(item[k]).lower() != str(v).lower():
                            match = False
                    elif k.endswith("_from"):
                        real_col = k[:-5]
                        if real_col in item and str(item[real_col]) < str(v):
                            match = False
                    elif k.endswith("_to"):
                        real_col = k[:-3]
                        if real_col in item and str(item[real_col]) > str(v):
                            match = False
                    elif k.endswith("_gt"):
                        real_col = k[:-3]
                        if real_col in item and float(item[real_col]) < float(v):
                            match = False
                    elif k.endswith("_lt"):
                        real_col = k[:-3]
                        if real_col in item and float(item[real_col]) > float(v):
                            match = False
                if match:
                    filtered.append(item)

            sliced = filtered[offset:offset+limit]
            return {
                "table_name": table_name,
                "catalog": catalog,
                "schema": schema,
                "total_rows": len(filtered),
                "limit": limit,
                "offset": offset,
                "returned_rows": len(sliced),
                "data": sliced,
                "applied_filters": filters,
                "source": "mock_fallback",
                "notice": f"Databricks unreachable ({str(e)}). Returned filtered mock data."
            }


# Comprehensive Gold Schema Mock Datasets for requested tables
MOCK_GOLD_DATA = {
    "dim_revenue_predictions": [
        { "prediction_id": "REV-PRED-2026-001", "department": "Cardiology", "facility_name": "Massachusetts General Hospital", "prediction_date": "2026-03-01", "target_period": "2026-Q1", "predicted_revenue": 4250000.00, "confidence_lower_bound": 3980000.00, "confidence_upper_bound": 4520000.00, "actual_revenue": 4180000.00, "accuracy_pct": 98.35, "growth_rate_pct": 5.4, "risk_level": "LOW", "model_version": "REV-PROJ-v2.4", "created_at": "2026-03-01T00:00:00" },
        { "prediction_id": "REV-PRED-2026-002", "department": "Oncology", "facility_name": "Brigham and Women's Hospital", "prediction_date": "2026-03-01", "target_period": "2026-Q1", "predicted_revenue": 5800000.00, "confidence_lower_bound": 5400000.00, "confidence_upper_bound": 6150000.00, "actual_revenue": 5750000.00, "accuracy_pct": 99.14, "growth_rate_pct": 7.2, "risk_level": "LOW", "model_version": "REV-PROJ-v2.4", "created_at": "2026-03-01T00:00:00" },
        { "prediction_id": "REV-PRED-2026-003", "department": "Orthopedics", "facility_name": "Beth Israel Deaconess Center", "prediction_date": "2026-03-01", "target_period": "2026-Q1", "predicted_revenue": 3100000.00, "confidence_lower_bound": 2850000.00, "confidence_upper_bound": 3350000.00, "actual_revenue": None, "accuracy_pct": None, "growth_rate_pct": 3.8, "risk_level": "MEDIUM", "model_version": "REV-PROJ-v2.4", "created_at": "2026-03-01T00:00:00" },
        { "prediction_id": "REV-PRED-2026-004", "department": "Emergency Services", "facility_name": "Massachusetts General Hospital", "prediction_date": "2026-03-01", "target_period": "2026-Q1", "predicted_revenue": 6400000.00, "confidence_lower_bound": 5900000.00, "confidence_upper_bound": 6850000.00, "actual_revenue": None, "accuracy_pct": None, "growth_rate_pct": 8.1, "risk_level": "HIGH", "model_version": "REV-PROJ-v2.4", "created_at": "2026-03-01T00:00:00" },
        { "prediction_id": "REV-PRED-2026-005", "department": "Neurology", "facility_name": "Brigham and Women's Hospital", "prediction_date": "2026-03-01", "target_period": "2026-Q2", "predicted_revenue": 2900000.00, "confidence_lower_bound": 2700000.00, "confidence_upper_bound": 3120000.00, "actual_revenue": None, "accuracy_pct": None, "growth_rate_pct": 4.1, "risk_level": "LOW", "model_version": "REV-PROJ-v2.4", "created_at": "2026-03-01T00:00:00" },
        { "prediction_id": "REV-PRED-2026-006", "department": "Pediatrics", "facility_name": "Massachusetts General Hospital", "prediction_date": "2026-03-01", "target_period": "2026-Q2", "predicted_revenue": 2150000.00, "confidence_lower_bound": 1950000.00, "confidence_upper_bound": 2350000.00, "actual_revenue": None, "accuracy_pct": None, "growth_rate_pct": 2.9, "risk_level": "LOW", "model_version": "REV-PROJ-v2.4", "created_at": "2026-03-01T00:00:00" },
        { "prediction_id": "REV-PRED-2026-007", "department": "General Surgery", "facility_name": "Beth Israel Deaconess Center", "prediction_date": "2026-03-01", "target_period": "2026-Q2", "predicted_revenue": 4800000.00, "confidence_lower_bound": 4400000.00, "confidence_upper_bound": 5150000.00, "actual_revenue": None, "accuracy_pct": None, "growth_rate_pct": 6.0, "risk_level": "MEDIUM", "model_version": "REV-PROJ-v2.4", "created_at": "2026-03-01T00:00:00" }
    ],
    "fact_bed_demand_forecast_7day_detailed": [
        { "forecast_date": "2026-09-13", "day_of_week": 1, "day_name": "Sunday", "is_weekend": 1, "ward_id": 1, "ward_name": "Diamond Suite Ward", "floor_number": 1, "department_name": "Administration", "predicted_beds": 3, "predicted_emergency": 0, "predicted_elective": 2, "avg_length_of_stay": 5.825, "prev_year_occupancy_rate": 38.46, "predicted_occupancy_rate": 8.11, "prediction_generated_at": "2026-09-08T05:51:24.855527+00:00", "model_name": "health_care.ml_models.bed_demand_prediction_prophet", "model_source": "ml_forecasting_pipeline", "prediction_version": "v1.0_detailed" },
        { "forecast_date": "2026-09-14", "day_of_week": 2, "day_name": "Monday", "is_weekend": 0, "ward_id": 1, "ward_name": "Diamond Suite Ward", "floor_number": 1, "department_name": "Administration", "predicted_beds": 5, "predicted_emergency": 1, "predicted_elective": 3, "avg_length_of_stay": 5.200, "prev_year_occupancy_rate": 42.10, "predicted_occupancy_rate": 12.50, "prediction_generated_at": "2026-09-08T05:51:24.855527+00:00", "model_name": "health_care.ml_models.bed_demand_prediction_prophet", "model_source": "ml_forecasting_pipeline", "prediction_version": "v1.0_detailed" },
        { "forecast_date": "2026-09-13", "day_of_week": 1, "day_name": "Sunday", "is_weekend": 1, "ward_id": 2, "ward_name": "ICU Intensive Unit", "floor_number": 2, "department_name": "Cardiology", "predicted_beds": 18, "predicted_emergency": 12, "predicted_elective": 4, "avg_length_of_stay": 7.450, "prev_year_occupancy_rate": 88.50, "predicted_occupancy_rate": 90.00, "prediction_generated_at": "2026-09-08T05:51:24.855527+00:00", "model_name": "health_care.ml_models.bed_demand_prediction_prophet", "model_source": "ml_forecasting_pipeline", "prediction_version": "v1.0_detailed" }
    ]
}


