"""
FastAPI Backend for VisLit Explorer (IEEE VIS Literature Exploration System).
Serves pre-computed LDA topic prevalence, topic correlations, citation networks,
author analytics, and paper profiles from `vispub_analytics.db`.
"""

import json
from collections import defaultdict
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import build_paper_summary, get_db_connection
from .schemas import (
    AuthorDetailResponse,
    FieldOverviewResponse,
    PaperDetailResponse,
    PaperSummary,
    TopicDetailResponse,
)

app = FastAPI(
    title="VisLit Explorer API",
    description="IEEE VIS Publication Topic Evolution & Citation Network API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/field-overview", response_model=FieldOverviewResponse)
def get_field_overview() -> FieldOverviewResponse:
    """
    Task 1: Field-Level View endpoint.
    Returns all LDA topics, yearly topic prevalence for the D3 Streamgraph,
    and the topic-to-topic correlation network.
    """
    with get_db_connection() as conn:
        topic_rows = conn.execute("SELECT * FROM topics ORDER BY id ASC").fetchall()
        topics = [
            {
                "id": r["id"],
                "name": r["name"],
                "shortName": r["short_name"],
                "color": r["color"],
                "description": r["description"],
                "topKeywords": json.loads(r["top_keywords_json"]),
                "paperCount": int(r["paper_count"]),
                "totalCitations": int(r["total_citations"]),
                "peakYear": int(r["peak_year"]),
                "growthRate": float(r["growth_rate"]),
            }
            for r in topic_rows
        ]

        prev_rows = conn.execute(
            "SELECT year, topic_id, prevalence, paper_count FROM topic_yearly_prevalence ORDER BY year ASC"
        ).fetchall()
        by_year_values = defaultdict(dict)
        by_year_counts = defaultdict(dict)
        for r in prev_rows:
            yr = int(r["year"])
            by_year_values[yr][r["topic_id"]] = float(r["prevalence"])
            by_year_counts[yr][r["topic_id"]] = int(r["paper_count"])

        years_sorted = sorted(by_year_values.keys())
        stream_data = [
            {
                "year": yr,
                "values": by_year_values[yr],
                "counts": by_year_counts[yr],
            }
            for yr in years_sorted
        ]

        corr_rows = conn.execute(
            "SELECT source_topic_id, target_topic_id, correlation, co_occurrence_count FROM topic_correlations"
        ).fetchall()
        correlations = [
            {
                "sourceTopicId": r["source_topic_id"],
                "targetTopicId": r["target_topic_id"],
                "correlation": float(r["correlation"]),
                "coOccurrenceCount": int(r["co_occurrence_count"]),
            }
            for r in corr_rows
        ]

        totals = conn.execute(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(citation_count), 0) AS cites FROM papers"
        ).fetchone()
        author_cnt = conn.execute("SELECT COUNT(*) AS cnt FROM authors").fetchone()

        return FieldOverviewResponse(
            topics=topics,
            streamData=stream_data,
            correlations=correlations,
            yearRange=[years_sorted[0], years_sorted[-1]] if years_sorted else [1990, 2024],
            totalPapers=int(totals["cnt"]),
            totalCitations=int(totals["cites"]),
            totalAuthors=int(author_cnt["cnt"]),
        )


@app.get("/api/topics/{topic_id}", response_model=TopicDetailResponse)
def get_topic_detail(
    topic_id: str,
    sort_by: str = Query("citations", pattern="^(citations|relevance|year)$"),
) -> TopicDetailResponse:
    """
    Task 2: Topic-Level View endpoint.
    Returns topic metadata, ranked papers (by citation count or LDA relevance score),
    and the intra-topic D3 force-directed citation network.
    """
    with get_db_connection() as conn:
        t_row = conn.execute("SELECT * FROM topics WHERE id = ?", (topic_id,)).fetchone()
        if not t_row:
            raise HTTPException(status_code=404, detail=f"Topic '{topic_id}' not found")

        topic_summary = {
            "id": t_row["id"],
            "name": t_row["name"],
            "shortName": t_row["short_name"],
            "color": t_row["color"],
            "description": t_row["description"],
            "topKeywords": json.loads(t_row["top_keywords_json"]),
            "paperCount": int(t_row["paper_count"]),
            "totalCitations": int(t_row["total_citations"]),
            "peakYear": int(t_row["peak_year"]),
            "growthRate": float(t_row["growth_rate"]),
        }

        order_clause = {
            "citations": "p.citation_count DESC, pt.relevance_score DESC",
            "relevance": "pt.relevance_score DESC, p.citation_count DESC",
            "year": "p.year DESC, p.citation_count DESC",
        }[sort_by]

        paper_rows = conn.execute(
            f"""
            SELECT p.*, pt.relevance_score
            FROM paper_topics pt
            JOIN papers p ON p.id = pt.paper_id
            WHERE pt.topic_id = ? AND pt.relevance_score >= 0.15
            ORDER BY {order_clause}
            """,
            (topic_id,),
        ).fetchall()

        papers = [
            build_paper_summary(conn, row, relevance_override=float(row["relevance_score"]))
            for row in paper_rows
        ]
        paper_id_set = {p["id"] for p in papers}

        nodes = [
            {
                "id": p["id"],
                "title": p["title"],
                "year": p["year"],
                "venue": p["venue"],
                "citationCount": p["citationCount"],
                "relevanceScore": p["relevanceScore"],
                "primaryTopicId": p["primaryTopicId"],
                "authors": [a["name"] for a in p["authors"]],
            }
            for p in papers
        ]

        links = []
        if paper_id_set:
            placeholders = ",".join("?" for _ in paper_id_set)
            id_list = list(paper_id_set)
            edge_rows = conn.execute(
                f"""
                SELECT source_paper_id, target_paper_id
                FROM paper_citations
                WHERE source_paper_id IN ({placeholders})
                  AND target_paper_id IN ({placeholders})
                """,
                id_list + id_list,
            ).fetchall()
            links = [
                {"source": r["source_paper_id"], "target": r["target_paper_id"]}
                for r in edge_rows
            ]

        trend_rows = conn.execute(
            """
            SELECT year, prevalence, paper_count
            FROM topic_yearly_prevalence
            WHERE topic_id = ?
            ORDER BY year ASC
            """,
            (topic_id,),
        ).fetchall()
        yearly_trend = [
            {
                "year": int(r["year"]),
                "prevalence": float(r["prevalence"]),
                "paperCount": int(r["paper_count"]),
            }
            for r in trend_rows
        ]

        return TopicDetailResponse(
            topic=topic_summary,
            papers=papers,
            citationNetwork={"nodes": nodes, "links": links},
            yearlyTrend=yearly_trend,
        )


@app.get("/api/authors/{author_id}", response_model=AuthorDetailResponse)
def get_author_detail(author_id: str) -> AuthorDetailResponse:
    """
    Task 3: Author-Level View endpoint.
    Returns an author's yearly publication throughput, topic contribution distribution
    over time, and ranked paper list by citation count.
    """
    with get_db_connection() as conn:
        a_row = conn.execute("SELECT * FROM authors WHERE id = ?", (author_id,)).fetchone()
        if not a_row:
            raise HTTPException(status_code=404, detail=f"Author '{author_id}' not found")

        stat_rows = conn.execute(
            "SELECT * FROM author_yearly_stats WHERE author_id = ? ORDER BY year ASC",
            (author_id,),
        ).fetchall()

        yearly_stats = [
            {
                "year": int(r["year"]),
                "paperCount": int(r["paper_count"]),
                "citationSum": int(r["citation_sum"]),
                "topicBreakdown": json.loads(r["topic_breakdown_json"]),
            }
            for r in stat_rows
        ]

        paper_rows = conn.execute(
            """
            SELECT p.*
            FROM paper_authors pa
            JOIN papers p ON p.id = pa.paper_id
            WHERE pa.author_id = ?
            ORDER BY p.citation_count DESC, p.year DESC
            """,
            (author_id,),
        ).fetchall()
        papers = [build_paper_summary(conn, r) for r in paper_rows]

        # Compute aggregate topic distribution across the author's career
        topic_meta = {
            r["id"]: {"name": r["name"], "color": r["color"]}
            for r in conn.execute("SELECT id, name, color FROM topics").fetchall()
        }
        topic_totals = defaultdict(float)
        topic_counts = defaultdict(int)
        for st in yearly_stats:
            for tid, weight in st["topicBreakdown"].items():
                topic_totals[tid] += float(weight)
                if weight >= 0.2:
                    topic_counts[tid] += 1

        total_weight = sum(topic_totals.values()) or 1.0
        topic_distribution = [
            {
                "topicId": tid,
                "topicName": topic_meta[tid]["name"],
                "color": topic_meta[tid]["color"],
                "share": round(weight / total_weight, 4),
                "paperCount": max(1, topic_counts[tid]),
            }
            for tid, weight in sorted(topic_totals.items(), key=lambda x: x[1], reverse=True)
            if tid in topic_meta and weight > 0.01
        ]

        # Co-authors
        co_rows = conn.execute(
            """
            SELECT DISTINCT a.id, a.name, a.affiliation
            FROM paper_authors pa1
            JOIN paper_authors pa2 ON pa1.paper_id = pa2.paper_id
            JOIN authors a ON a.id = pa2.author_id
            WHERE pa1.author_id = ? AND pa2.author_id != ?
            LIMIT 12
            """,
            (author_id, author_id),
        ).fetchall()
        co_authors = [{"id": r["id"], "name": r["name"], "affiliation": r["affiliation"]} for r in co_rows]

        return AuthorDetailResponse(
            id=a_row["id"],
            name=a_row["name"],
            affiliation=a_row["affiliation"],
            totalPapers=int(a_row["total_papers"]),
            totalCitations=int(a_row["total_citations"]),
            hIndex=int(a_row["h_index"]),
            primaryTopicId=a_row["primary_topic_id"],
            activeStartYear=int(a_row["active_start_year"]),
            activeEndYear=int(a_row["active_end_year"]),
            yearlyStats=yearly_stats,
            topicDistribution=topic_distribution,
            papers=papers,
            coAuthors=co_authors,
        )


@app.get("/api/papers/{paper_id}", response_model=PaperDetailResponse)
def get_paper_detail(paper_id: str) -> PaperDetailResponse:
    """
    Task 4: Paper-Level View endpoint.
    Returns full abstract, citation count, authors, DOI link, topic relevance breakdown,
    citing/referenced papers, and top related papers.
    """
    with get_db_connection() as conn:
        p_row = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
        if not p_row:
            raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")

        summary = build_paper_summary(conn, p_row)

        tb_rows = conn.execute(
            """
            SELECT pt.topic_id, pt.relevance_score, t.name, t.color
            FROM paper_topics pt
            JOIN topics t ON t.id = pt.topic_id
            WHERE pt.paper_id = ?
            ORDER BY pt.relevance_score DESC
            """,
            (paper_id,),
        ).fetchall()
        topic_breakdown = [
            {
                "topicId": r["topic_id"],
                "topicName": r["name"],
                "color": r["color"],
                "relevanceScore": round(float(r["relevance_score"]), 4),
            }
            for r in tb_rows
        ]

        cited_by_rows = conn.execute(
            """
            SELECT p.*
            FROM paper_citations pc
            JOIN papers p ON p.id = pc.source_paper_id
            WHERE pc.target_paper_id = ?
            ORDER BY p.citation_count DESC
            """,
            (paper_id,),
        ).fetchall()
        cited_by = [build_paper_summary(conn, r) for r in cited_by_rows]

        ref_rows = conn.execute(
            """
            SELECT p.*
            FROM paper_citations pc
            JOIN papers p ON p.id = pc.target_paper_id
            WHERE pc.source_paper_id = ?
            ORDER BY p.citation_count DESC
            """,
            (paper_id,),
        ).fetchall()
        references = [build_paper_summary(conn, r) for r in ref_rows]

        related_rows = conn.execute(
            """
            SELECT p.*, pt.relevance_score
            FROM paper_topics pt
            JOIN papers p ON p.id = pt.paper_id
            WHERE pt.topic_id = ? AND p.id != ?
            ORDER BY pt.relevance_score DESC, p.citation_count DESC
            LIMIT 6
            """,
            (p_row["primary_topic_id"], paper_id),
        ).fetchall()
        related = [
            build_paper_summary(conn, r, relevance_override=float(r["relevance_score"]))
            for r in related_rows
        ]

        return PaperDetailResponse(
            id=summary["id"],
            title=summary["title"],
            year=summary["year"],
            venue=summary["venue"],
            doi=summary["doi"],
            url=f"https://doi.org/{summary['doi']}",
            abstract=p_row["abstract"],
            citationCount=summary["citationCount"],
            primaryTopicId=summary["primaryTopicId"],
            authors=summary["authors"],
            keywords=summary["keywords"],
            topicBreakdown=topic_breakdown,
            citedByPapers=cited_by,
            referencesPapers=references,
            relatedPapers=related,
        )
