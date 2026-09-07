import json
import datetime
import decimal
import uuid
from databricks import sql
from config.config import Config

class DatabricksConnector:
    def __init__(self):
        self.config = Config

    def get_connection(self):
        return sql.connect(
            server_hostname=self.config.DATABRICKS_SERVER_HOSTNAME,
            http_path=self.config.DATABRICKS_HTTP_PATH,
            access_token=self.config.DATABRICKS_ACCESS_TOKEN
        )

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
        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = schema or self.config.DATABRICKS_SCHEMA
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        try:
            cursor.execute(f"SELECT COUNT(*) FROM {full_table_name}")
            cnt = cursor.fetchone()[0]
        except Exception:
            cnt = 0

        cursor.close()
        conn.close()
        return cnt

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

    @staticmethod
    def _serialize_val(v):
        if v is None:
            return None
        if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
            return v.isoformat()
        if isinstance(v, decimal.Decimal):
            return float(v)
        if isinstance(v, uuid.UUID):
            return str(v)
        if isinstance(v, (bytes, bytearray)):
            return v.decode('utf-8', errors='ignore')
        return v

    def query_table(self, table_name: str, limit: int = 100, offset: int = 0, schema: str = None) -> dict:
        """Query rows from table with pagination and return serializable dict list."""
        conn = self.get_connection()
        cursor = conn.cursor()
        catalog = self.config.DATABRICKS_CATALOG
        schema = schema or self.config.DATABRICKS_SCHEMA
        full_table_name = f"`{catalog}`.`{schema}`.`{table_name}`"

        # Sanitize limit & offset
        limit = max(1, min(limit, 1000))
        offset = max(0, offset)

        total_rows = self.get_row_count(table_name, schema=schema)

        query = f"SELECT * FROM {full_table_name} LIMIT {limit} OFFSET {offset}"
        cursor.execute(query)
        
        # Get column headers
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
            "data": records
        }
