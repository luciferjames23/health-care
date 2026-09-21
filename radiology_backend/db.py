"""
Database connector and queries for Meridian Radiology AI.
Connects directly to the PostgreSQL Lakehouse database (rv_pbpkghvg).
"""
import logging
from typing import Any, Dict, List, Optional
import psycopg2
import psycopg2.extras

import config

logger = logging.getLogger("meridian.radiology.db")


def get_connection():
    """Establish and return an active PostgreSQL connection."""
    return psycopg2.connect(
        host=config.POSTGRES_HOST,
        port=config.POSTGRES_PORT,
        dbname=config.POSTGRES_DB,
        user=config.POSTGRES_USER,
        password=config.POSTGRES_PASSWORD,
        connect_timeout=15,
    )


def init_radiology_scan_table():
    """Create the radiology_scan table and indices if they do not exist."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS radiology_scan (
                    scan_id BIGSERIAL PRIMARY KEY,
                    patient_id BIGINT REFERENCES patients(id),
                    patient_code VARCHAR(100),
                    original_patient_id VARCHAR(100),
                    x DOUBLE PRECISION,
                    y DOUBLE PRECISION,
                    width DOUBLE PRECISION,
                    height DOUBLE PRECISION,
                    target INTEGER DEFAULT 0,
                    image TEXT,
                    scan_report TEXT,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_radiology_scan_patient_id ON radiology_scan (patient_id);
                CREATE INDEX IF NOT EXISTS idx_radiology_scan_target ON radiology_scan (target);
                CREATE INDEX IF NOT EXISTS idx_radiology_scan_orig_id ON radiology_scan (original_patient_id);
            """)
            conn.commit()
            logger.info("Table 'radiology_scan' verified / created successfully.")
    finally:
        conn.close()


def get_currently_admitted_patients() -> List[Dict[str, Any]]:
    """Retrieve all patients who currently have an active admission."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT DISTINCT 
                    p.id AS patient_id, 
                    p.patient_code, 
                    p.first_name, 
                    p.last_name, 
                    p.gender, 
                    p.date_of_birth,
                    a.admission_id,
                    a.admission_number,
                    a.admission_date,
                    a.discharge_status
                FROM admissions a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.discharge_status = 'Admitted'
                ORDER BY a.admission_date DESC;
            """)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    finally:
        conn.close()


def insert_scans(records: List[Dict[str, Any]]) -> int:
    """Bulk insert scan records into the radiology_scan table."""
    if not records:
        return 0
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            query = """
                INSERT INTO radiology_scan (
                    patient_id,
                    patient_code,
                    original_patient_id,
                    x,
                    y,
                    width,
                    height,
                    target,
                    image,
                    scan_report
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """
            rows = [
                (
                    r.get("patient_id"),
                    r.get("patient_code"),
                    r.get("original_patient_id"),
                    r.get("x"),
                    r.get("y"),
                    r.get("width"),
                    r.get("height"),
                    r.get("target", 0),
                    r.get("image"),
                    r.get("scan_report"),
                )
                for r in records
            ]
            psycopg2.extras.execute_batch(cur, query, rows, page_size=200)
            conn.commit()
            return len(rows)
    finally:
        conn.close()


def list_scans(
    patient_id: Optional[int] = None,
    target: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List scans with optional filtering by patient_id and target status."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where_clauses = []
            params = []
            if patient_id is not None:
                where_clauses.append("rs.patient_id = %s")
                params.append(patient_id)
            if target is not None:
                where_clauses.append("rs.target = %s")
                params.append(target)

            where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            # Count total matching
            count_query = f"SELECT count(*) AS total FROM radiology_scan rs{where_sql};"
            cur.execute(count_query, params)
            total = cur.fetchone()["total"]

            # Query items with joined patient info
            data_query = f"""
                SELECT 
                    rs.scan_id,
                    rs.patient_id,
                    rs.patient_code,
                    p.first_name,
                    p.last_name,
                    p.gender,
                    rs.original_patient_id,
                    rs.x,
                    rs.y,
                    rs.width,
                    rs.height,
                    rs.target,
                    rs.image,
                    rs.scan_report,
                    rs.created_at
                FROM radiology_scan rs
                LEFT JOIN patients p ON rs.patient_id = p.id
                {where_sql}
                ORDER BY rs.scan_id ASC
                LIMIT %s OFFSET %s;
            """
            cur.execute(data_query, params + [limit, offset])
            rows = [dict(r) for r in cur.fetchall()]

            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "count": len(rows),
                "data": rows,
            }
    finally:
        conn.close()


def get_scan_by_id(scan_id: int) -> Optional[Dict[str, Any]]:
    """Get single scan by scan_id."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    rs.scan_id,
                    rs.patient_id,
                    rs.patient_code,
                    p.first_name,
                    p.last_name,
                    p.gender,
                    rs.original_patient_id,
                    rs.x,
                    rs.y,
                    rs.width,
                    rs.height,
                    rs.target,
                    rs.image,
                    rs.scan_report,
                    rs.created_at
                FROM radiology_scan rs
                LEFT JOIN patients p ON rs.patient_id = p.id
                WHERE rs.scan_id = %s;
            """, (scan_id,))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def update_scan_image_and_report(
    scan_id: int,
    image: Optional[str] = None,
    scan_report: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Update image data and/or scan report text for a given scan."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            set_parts = []
            params = []
            if image is not None:
                set_parts.append("image = %s")
                params.append(image)
            if scan_report is not None:
                set_parts.append("scan_report = %s")
                params.append(scan_report)

            if not set_parts:
                return get_scan_by_id(scan_id)

            params.append(scan_id)
            sql = f"UPDATE radiology_scan SET {', '.join(set_parts)} WHERE scan_id = %s;"
            cur.execute(sql, params)
            conn.commit()

        return get_scan_by_id(scan_id)
    finally:
        conn.close()


def get_patient_mapping_by_original_ids(original_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Lookup patient details (patient_id, patient_code, name, review status) for given original_patient_id UUIDs."""
    if not original_ids:
        return {}
    clean_ids = [str(x).strip() for x in original_ids if x and str(x).strip()]
    if not clean_ids:
        return {}
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT DISTINCT ON (rs.original_patient_id)
                    rs.original_patient_id,
                    rs.patient_id,
                    rs.patient_code,
                    rs.review_status,
                    rs.reviewed_by,
                    rs.reviewed_at,
                    rs.scan_report,
                    rs.radiologist_finding,
                    p.first_name,
                    p.last_name
                FROM radiology_scan rs
                LEFT JOIN patients p ON rs.patient_id = p.id
                WHERE rs.original_patient_id = ANY(%s);
            """, (list(set(clean_ids)),))
            rows = cur.fetchall()
            mapping = {}
            for r in rows:
                full_name = None
                if r["first_name"] or r["last_name"]:
                    full_name = f"{r['first_name'] or ''} {r['last_name'] or ''}".strip()
                mapping[r["original_patient_id"]] = {
                    "patient_id": r["patient_id"],
                    "patient_code": r["patient_code"],
                    "patient_name": full_name,
                    "original_patient_id": r["original_patient_id"],
                    "review_status": r["review_status"],
                    "reviewed_by": r["reviewed_by"],
                    "reviewed_at": r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
                    "scan_report": r["scan_report"],
                    "radiologist_finding": r["radiologist_finding"],
                }
            return mapping
    except Exception as e:
        logger.error("Error looking up patient mapping by original_patient_id: %s", e)
        return {}
    finally:
        conn.close()


def get_patient_mapping_by_original_id(original_id: str) -> Optional[Dict[str, Any]]:
    """Lookup patient details for a single original_patient_id UUID."""
    if not original_id:
        return None
    res = get_patient_mapping_by_original_ids([original_id])
    return res.get(original_id)


def update_study_report_in_db(
    original_patient_id: Optional[str] = None,
    scan_report: Optional[str] = None,
    patient_id: Optional[int] = None,
    patient_code: Optional[str] = None,
    review_status: Optional[str] = None,
    reviewed_by: Optional[str] = None,
    radiologist_finding: Optional[str] = None,
) -> bool:
    """Update or insert scan_report, review_status, and reviewer in PostgreSQL radiology_scan table."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if original_patient_id:
                cur.execute("SELECT scan_id FROM radiology_scan WHERE original_patient_id = %s;", (str(original_patient_id).strip(),))
                row = cur.fetchone()
                if row:
                    cur.execute("""
                        UPDATE radiology_scan 
                        SET scan_report = COALESCE(%s, scan_report),
                            review_status = COALESCE(%s, review_status),
                            reviewed_by = COALESCE(%s, reviewed_by),
                            radiologist_finding = COALESCE(%s, radiologist_finding),
                            reviewed_at = CURRENT_TIMESTAMP
                        WHERE original_patient_id = %s;
                    """, (scan_report, review_status, reviewed_by, radiologist_finding, str(original_patient_id).strip()))
                    conn.commit()
                    return True
            cur.execute("""
                INSERT INTO radiology_scan (patient_id, patient_code, original_patient_id, scan_report, review_status, reviewed_by, radiologist_finding, reviewed_at, target)
                VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, 0);
            """, (patient_id, patient_code, original_patient_id, scan_report, review_status, reviewed_by, radiologist_finding))
            conn.commit()
            return True
    except Exception as e:
        logger.error("Error updating/inserting scan_report in PostgreSQL: %s", e)
        return False
    finally:
        conn.close()




