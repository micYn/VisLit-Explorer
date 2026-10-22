"""
SQLite Database Access Layer for the IEEE VIS Literature Exploration Backend.
Provides connection pooling, context managers, and structured query helpers
for the pre-computed `vispub_analytics.db` database.
"""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

DB_PATH = Path(__file__).resolve().parent / "vispub_analytics.db"


@contextmanager
def get_db_connection(db_path: Path = DB_PATH) -> Generator[sqlite3.Connection, None, None]:
    """Yields a SQLite connection configured with Row factory for dict-like access."""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def fetch_paper_authors(conn: sqlite3.Connection, paper_id: str) -> List[Dict[str, str]]:
    rows = conn.execute(
        """
        SELECT a.id, a.name, a.raw_name, a.affiliation
        FROM paper_authors pa
        JOIN authors a ON a.id = pa.author_id
        WHERE pa.paper_id = ?
        ORDER BY pa.author_order ASC
        """,
        (paper_id,),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "rawName": r["raw_name"] if "raw_name" in r.keys() else r["name"],
            "affiliation": r["affiliation"],
        }
        for r in rows
    ]


def build_paper_summary(
    conn: sqlite3.Connection, row: sqlite3.Row, relevance_override: Optional[float] = None
) -> Dict[str, Any]:
    paper_id = row["id"]
    authors = fetch_paper_authors(conn, paper_id)
    keywords = json.loads(row["keywords_json"]) if row["keywords_json"] else []
    raw_abstract = (row["abstract"] or "").strip() if "abstract" in row.keys() else ""
    abstract = raw_abstract if raw_abstract and raw_abstract.lower() not in {"na", "n/a"} else row["title"]

    if relevance_override is not None:
        rel_score = float(relevance_override)
    else:
        rel_row = conn.execute(
            "SELECT relevance_score FROM paper_topics WHERE paper_id = ? AND topic_id = ?",
            (paper_id, row["primary_topic_id"]),
        ).fetchone()
        rel_score = float(rel_row["relevance_score"]) if rel_row else 0.85

    return {
        "id": paper_id,
        "title": row["title"],
        "year": int(row["year"]),
        "venue": row["venue"],
        "doi": row["doi"],
        "abstract": abstract,
        "citationCount": int(row["citation_count"]),
        "relevanceScore": round(rel_score, 4),
        "primaryTopicId": row["primary_topic_id"],
        "authors": authors,
        "keywords": keywords,
    }
