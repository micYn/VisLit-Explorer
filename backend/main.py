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
    min_topic_fit: float = Query(0.08, ge=0.0, le=1.0),
) -> TopicDetailResponse:
    """
    Task 2: Topic-Level View endpoint.
    Returns topic metadata, top seminal papers for the topic, leading researchers in the topic,
    ranked papers (filtered by min_topic_fit), and the intra-topic D3 citation network.
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
            "keywordGroupingSummary": t_row["description"],
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
            WHERE pt.topic_id = ? AND pt.relevance_score >= ?
            ORDER BY {order_clause}
            """,
            (topic_id, min_topic_fit),
        ).fetchall()

        papers = [
            build_paper_summary(conn, row, relevance_override=float(row["relevance_score"]))
            for row in paper_rows
        ]
        paper_id_set = {p["id"] for p in papers}

        # Top 4 Seminal Papers specific to this topic (highest composite citation impact & topic fit)
        seminal_papers = sorted(
            [p for p in papers if p["relevanceScore"] >= 0.35] or papers,
            key=lambda p: p["citationCount"] * (0.6 + 0.4 * p["relevanceScore"]),
            reverse=True,
        )[:4]

        # Leading Researchers in this Topic (composite score: >=3 papers or topic H-index + damped citations)
        author_topic_stats = defaultdict(lambda: {"cites_list": [], "citations": 0, "meta": None})
        for p in papers:
            if p["relevanceScore"] < 0.25:
                continue
            for a in p["authors"]:
                aid = a["id"]
                author_topic_stats[aid]["cites_list"].append(int(p["citationCount"]))
                author_topic_stats[aid]["citations"] += int(p["citationCount"])
                author_topic_stats[aid]["meta"] = a

        scored_authors = []
        for aid, st in author_topic_stats.items():
            cites_sorted = sorted(st["cites_list"], reverse=True)
            topic_h = 0
            for idx, c_val in enumerate(cites_sorted):
                if c_val >= idx + 1:
                    topic_h = idx + 1
                else:
                    break
            p_cnt = len(cites_sorted)
            meets_threshold = p_cnt >= 3 or topic_h >= 2
            comp_score = (
                (10000 if meets_threshold else 0)
                + (5000 if p_cnt >= 3 else 0)
                + topic_h * 1800
                + p_cnt * 950
                + (st["citations"] ** 0.5) * 12
            )
            scored_authors.append((comp_score, p_cnt, st["citations"], topic_h, aid, st))

        scored_authors.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)

        leading_authors = []
        for _, p_cnt, tot_cites, topic_h, aid, st in scored_authors[:6]:
            a_row = conn.execute("SELECT h_index, raw_name FROM authors WHERE id = ?", (aid,)).fetchone()
            leading_authors.append(
                {
                    "id": aid,
                    "name": st["meta"]["name"],
                    "rawName": a_row["raw_name"] if a_row and "raw_name" in a_row.keys() else st["meta"]["name"],
                    "affiliation": st["meta"]["affiliation"],
                    "topicPaperCount": p_cnt,
                    "topicCitations": tot_cites,
                    "hIndex": int(a_row["h_index"]) if a_row else 25,
                    "topicHIndex": topic_h,
                }
            )

        # =====================================================================
        # EXPLICIT GRAPH FILTERING METHOD (NO SQL LIMIT CLAUSE):
        # Active Method: "Strict >=40% Topic Fit Cutoff + 1-Hop Cross-Topic Citation Bridges"
        # 1. Core Subfield Nodes: Select ALL papers where relevanceScore >= 0.40
        #    for this topic with zero SQL LIMIT cap.
        # 2. Cross-Topic Bridge Nodes: Pull in external papers from other topics
        #    that directly cite or are cited by the core >=40% subfield papers
        #    (`isCrossTopic = True`).
        # 3. Standalone Papers: Nodes with 0 citation edges in the subfield view
        #    are included in the response so the frontend can toggle them via
        #    "Hide Standalone Papers".
        # =====================================================================
        core_papers = [p for p in papers if p["relevanceScore"] >= 0.40] or papers
        core_id_set = {p["id"] for p in core_papers}

        cross_nodes_map = {}
        if core_id_set:
            placeholders = ",".join("?" for _ in core_id_set)
            core_list = list(core_id_set)
            cross_rows = conn.execute(
                f"""
                SELECT DISTINCT p.*
                FROM paper_citations pc
                JOIN papers p ON (p.id = pc.target_paper_id OR p.id = pc.source_paper_id)
                WHERE (pc.source_paper_id IN ({placeholders}) OR pc.target_paper_id IN ({placeholders}))
                  AND p.id NOT IN ({placeholders})
                """,
                core_list + core_list + core_list,
            ).fetchall()
            for r in cross_rows:
                summary = build_paper_summary(conn, r)
                cross_nodes_map[summary["id"]] = summary

        all_network_papers = core_papers + list(cross_nodes_map.values())
        network_id_set = {p["id"] for p in all_network_papers}

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
                "isCrossTopic": (p["id"] not in core_id_set) or (p["primaryTopicId"] != topic_id),
            }
            for p in all_network_papers
        ]

        links = []
        degree_counts = defaultdict(int)
        if network_id_set:
            placeholders = ",".join("?" for _ in network_id_set)
            id_list = list(network_id_set)
            edge_rows = conn.execute(
                f"""
                SELECT source_paper_id, target_paper_id
                FROM paper_citations
                WHERE source_paper_id IN ({placeholders})
                  AND target_paper_id IN ({placeholders})
                """,
                id_list + id_list,
            ).fetchall()
            for r in edge_rows:
                src = r["source_paper_id"]
                tgt = r["target_paper_id"]
                links.append({"source": src, "target": tgt})
                degree_counts[src] += 1
                degree_counts[tgt] += 1

        core_cnt = sum(1 for n in nodes if not n["isCrossTopic"])
        cross_cnt = sum(1 for n in nodes if n["isCrossTopic"])
        standalone_cnt = sum(1 for n in nodes if degree_counts[n["id"]] == 0)

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
            seminalPapers=seminal_papers,
            leadingAuthors=leading_authors,
            papers=papers,
            citationNetwork={
                "nodes": nodes,
                "links": links,
                "filteringCriteria": "Strict ≥40% Topic Fit Cutoff + 1-Hop Cross-Topic Citation Bridges (No Node Cap)",
                "coreSubfieldNodeCount": core_cnt,
                "crossTopicNodeCount": cross_cnt,
                "standaloneNodeCount": standalone_cnt,
            },
            yearlyTrend=yearly_trend,
        )


@app.get("/api/search")
def search_corpus(q: str = Query("", min_length=1)) -> dict:
    """
    Case-insensitive, substring, and token-order-independent search across
    all indexed authors, papers, and topics in the Vispubdata database.
    """
    tokens = [t.strip().lower() for t in q.split() if t.strip()]
    if not tokens:
        return {"authors": [], "papers": []}

    with get_db_connection() as conn:
        author_rows = conn.execute("SELECT * FROM authors ORDER BY total_citations DESC").fetchall()
        matched_authors = []
        for r in author_rows:
            raw_name = r["raw_name"] if "raw_name" in r.keys() else r["name"]
            haystack = f"{r['name']} {raw_name} {r['affiliation']}".lower()
            if all(tok in haystack for tok in tokens):
                matched_authors.append(
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "rawName": raw_name,
                        "affiliation": r["affiliation"],
                        "totalPapers": int(r["total_papers"]),
                        "totalCitations": int(r["total_citations"]),
                    }
                )

        paper_rows = conn.execute("SELECT * FROM papers ORDER BY citation_count DESC").fetchall()
        matched_papers = []
        for r in paper_rows:
            summary = build_paper_summary(conn, r)
            author_names = " ".join(
                f"{a['name']} {a.get('rawName', '')}" for a in summary["authors"]
            )
            kw_str = " ".join(summary["keywords"])
            haystack = f"{summary['title']} {summary['abstract']} {kw_str} {author_names} {summary['year']} {summary['venue']}".lower()
            if all(tok in haystack for tok in tokens):
                matched_papers.append(summary)

        return {"authors": matched_authors[:20], "papers": matched_papers[:25]}


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

        start_yr = int(a_row["active_start_year"])
        end_yr = int(a_row["active_end_year"])
        if papers:
            start_yr = min(start_yr, min(p["year"] for p in papers))
            end_yr = max(end_yr, max(p["year"] for p in papers))

        papers_by_year = defaultdict(list)
        for p in papers:
            papers_by_year[int(p["year"])].append(p)

        yearly_stats = []
        for yr in range(start_yr, end_yr + 1):
            yr_papers = sorted(
                papers_by_year.get(yr, []),
                key=lambda x: x["citationCount"],
                reverse=True,
            )
            p_cnt = len(yr_papers)
            c_sum = sum(x["citationCount"] for x in yr_papers)
            tb = defaultdict(float)
            for yp in yr_papers:
                tb_rows = conn.execute(
                    "SELECT topic_id, relevance_score FROM paper_topics WHERE paper_id = ?",
                    (yp["id"],),
                ).fetchall()
                for tr in tb_rows:
                    tb[tr["topic_id"]] = round(tb[tr["topic_id"]] + float(tr["relevance_score"]), 2)

            standout = (
                {
                    "id": yr_papers[0]["id"],
                    "title": yr_papers[0]["title"],
                    "year": yr_papers[0]["year"],
                    "venue": yr_papers[0]["venue"],
                    "citationCount": yr_papers[0]["citationCount"],
                }
                if yr_papers
                else None
            )

            yearly_stats.append(
                {
                    "year": yr,
                    "paperCount": p_cnt,
                    "citationSum": c_sum,
                    "topicBreakdown": dict(tb),
                    "standoutPaper": standout,
                }
            )

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

        primary_tid = a_row["primary_topic_id"]
        secondary_tid = next(
            (td["topicId"] for td in topic_distribution if td["topicId"] != primary_tid),
            "topic-4" if primary_tid == "topic-5" else "topic-5",
        )

        return AuthorDetailResponse(
            id=a_row["id"],
            name=a_row["name"],
            affiliation=a_row["affiliation"],
            totalPapers=int(a_row["total_papers"]),
            totalCitations=int(a_row["total_citations"]),
            hIndex=int(a_row["h_index"]),
            primaryTopicId=primary_tid,
            secondaryTopicId=secondary_tid,
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
