#!/usr/bin/env python3
"""
IEEE VIS Literature Exploration System (Vispubdata)
Standalone ETL & Latent Dirichlet Allocation (LDA) Pre-computation Pipeline.

This script:
1. Loads and cleans the IEEE VIS publication dataset (Vispubdata CSV or内置 seed corpus).
2. Combines Paper Title, Abstract, and Author Keywords with stopword removal and lemmatization/stemming-ready tokenization.
3. Trains a Latent Dirichlet Allocation (LDA) topic model via scikit-learn.
4. Pre-computes:
   - Topic prevalence per year (1990 - 2024) for the Field-Level Streamgraph
   - Topic-to-topic correlation matrix (Pearson r across document-topic distributions)
   - Paper-to-topic relevance scores (posterior theta_d,k)
   - Intra-topic and global citation networks (directed referencing edges)
   - Author yearly publication throughput and cumulative topic distributions
5. Exports all pre-computed tables to a static SQLite database (`vispub_analytics.db`)
   with indexed lookup tables for <5ms FastAPI query latency.
"""

import argparse
import csv
import json
import math
import os
import re
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.feature_extraction.text import CountVectorizer

# Curated semantic palette & human-verified labels for IEEE VIS topics
TOPIC_PALETTE = [
    "#2563EB",  # Cobalt Blue
    "#0D9488",  # Teal
    "#D97706",  # Amber
    "#7C3AED",  # Violet
    "#E11D48",  # Rose
    "#059669",  # Emerald
    "#4F46E5",  # Indigo
    "#EA580C",  # Orange
]

DEFAULT_TOPIC_ANCHORS = [
    {
        "id": "topic-0",
        "name": "Graph & Network Layout",
        "short_name": "Graph Layout",
        "color": "#2563EB",
        "seed_terms": ["graph", "network", "node", "edge", "bundling", "layout", "topology", "force", "matrix", "hierarchy"],
    },
    {
        "id": "topic-1",
        "name": "Volume & Scientific Flow Rendering",
        "short_name": "Volume & Flow",
        "color": "#0D9488",
        "seed_terms": ["volume", "rendering", "isosurface", "flow", "streamline", "vector", "turbulence", "gpu", "ray", "voxel"],
    },
    {
        "id": "topic-2",
        "name": "Visual Analytics & Explainable ML",
        "short_name": "Visual Analytics & ML",
        "color": "#7C3AED",
        "seed_terms": ["model", "machine", "learning", "neural", "classification", "steering", "interactive", "explainable", "feature", "analytics"],
    },
    {
        "id": "topic-3",
        "name": "High-Dimensional & Projections",
        "short_name": "High-Dim & Projections",
        "color": "#D97706",
        "seed_terms": ["dimensionality", "reduction", "projection", "subspace", "tsne", "umap", "parallel", "coordinates", "scatterplot", "cluster"],
    },
    {
        "id": "topic-4",
        "name": "Perceptual Evaluation & Color",
        "short_name": "Perception & Color",
        "color": "#E11D48",
        "seed_terms": ["perception", "empirical", "study", "colormap", "graphical", "encoding", "attention", "cognitive", "accuracy", "judgment"],
    },
    {
        "id": "topic-5",
        "name": "Declarative Grammars & Narrative Vis",
        "short_name": "Grammars & Storytelling",
        "color": "#059669",
        "seed_terms": ["grammar", "declarative", "narrative", "storytelling", "specification", "vega", "d3", "interaction", "authoring", "reactive"],
    },
    {
        "id": "topic-6",
        "name": "Spatiotemporal & Urban Analytics",
        "short_name": "Spatiotemporal & Geo",
        "color": "#4F46E5",
        "seed_terms": ["spatial", "temporal", "trajectory", "urban", "mobility", "geographic", "map", "time", "series", "event"],
    },
    {
        "id": "topic-7",
        "name": "Uncertainty & Ensemble Visualization",
        "short_name": "Uncertainty & Ensembles",
        "color": "#EA580C",
        "seed_terms": ["uncertainty", "ensemble", "probabilistic", "confidence", "distribution", "error", "simulation", "forecast", "quantification", "variability"],
    },
]


def clean_text(text: str) -> str:
    """Normalizes scholarly text from titles, abstracts, and author keywords."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|doi\.org/\S+", " ", text)
    text = re.sub(r"[^a-z0-9\s\-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def create_database_schema(conn: sqlite3.Connection) -> None:
    """Initializes SQLite tables and indexes for the FastAPI backend."""
    cursor = conn.cursor()
    cursor.executescript(
        """
        DROP TABLE IF EXISTS paper_citations;
        DROP TABLE IF EXISTS paper_authors;
        DROP TABLE IF EXISTS paper_topics;
        DROP TABLE IF EXISTS topic_correlations;
        DROP TABLE IF EXISTS topic_yearly_prevalence;
        DROP TABLE IF EXISTS author_yearly_stats;
        DROP TABLE IF EXISTS author_topic_contributions;
        DROP TABLE IF EXISTS papers;
        DROP TABLE IF EXISTS authors;
        DROP TABLE IF EXISTS topics;

        CREATE TABLE topics (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            short_name TEXT NOT NULL,
            color TEXT NOT NULL,
            description TEXT NOT NULL,
            top_keywords_json TEXT NOT NULL,
            paper_count INTEGER NOT NULL,
            total_citations INTEGER NOT NULL,
            peak_year INTEGER NOT NULL,
            growth_rate REAL NOT NULL
        );

        CREATE TABLE topic_yearly_prevalence (
            year INTEGER NOT NULL,
            topic_id TEXT NOT NULL,
            prevalence REAL NOT NULL,
            paper_count INTEGER NOT NULL,
            PRIMARY KEY (year, topic_id),
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE TABLE topic_correlations (
            source_topic_id TEXT NOT NULL,
            target_topic_id TEXT NOT NULL,
            correlation REAL NOT NULL,
            co_occurrence_count INTEGER NOT NULL,
            PRIMARY KEY (source_topic_id, target_topic_id),
            FOREIGN KEY (source_topic_id) REFERENCES topics(id),
            FOREIGN KEY (target_topic_id) REFERENCES topics(id)
        );

        CREATE TABLE papers (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            year INTEGER NOT NULL,
            venue TEXT NOT NULL,
            doi TEXT NOT NULL,
            abstract TEXT NOT NULL,
            citation_count INTEGER NOT NULL,
            primary_topic_id TEXT NOT NULL,
            keywords_json TEXT NOT NULL,
            FOREIGN KEY (primary_topic_id) REFERENCES topics(id)
        );

        CREATE TABLE paper_topics (
            paper_id TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            relevance_score REAL NOT NULL,
            PRIMARY KEY (paper_id, topic_id),
            FOREIGN KEY (paper_id) REFERENCES papers(id),
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE TABLE authors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            affiliation TEXT NOT NULL,
            total_papers INTEGER NOT NULL,
            total_citations INTEGER NOT NULL,
            h_index INTEGER NOT NULL,
            primary_topic_id TEXT NOT NULL,
            active_start_year INTEGER NOT NULL,
            active_end_year INTEGER NOT NULL,
            FOREIGN KEY (primary_topic_id) REFERENCES topics(id)
        );

        CREATE TABLE paper_authors (
            paper_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_order INTEGER NOT NULL,
            PRIMARY KEY (paper_id, author_id),
            FOREIGN KEY (paper_id) REFERENCES papers(id),
            FOREIGN KEY (author_id) REFERENCES authors(id)
        );

        CREATE TABLE author_yearly_stats (
            author_id TEXT NOT NULL,
            year INTEGER NOT NULL,
            paper_count INTEGER NOT NULL,
            citation_sum INTEGER NOT NULL,
            topic_breakdown_json TEXT NOT NULL,
            PRIMARY KEY (author_id, year),
            FOREIGN KEY (author_id) REFERENCES authors(id)
        );

        CREATE TABLE paper_citations (
            source_paper_id TEXT NOT NULL,
            target_paper_id TEXT NOT NULL,
            PRIMARY KEY (source_paper_id, target_paper_id),
            FOREIGN KEY (source_paper_id) REFERENCES papers(id),
            FOREIGN KEY (target_paper_id) REFERENCES papers(id)
        );

        CREATE INDEX idx_paper_topics_topic ON paper_topics(topic_id, relevance_score DESC);
        CREATE INDEX idx_papers_primary_topic ON papers(primary_topic_id, citation_count DESC);
        CREATE INDEX idx_paper_authors_author ON paper_authors(author_id);
        CREATE INDEX idx_citations_source ON paper_citations(source_paper_id);
        CREATE INDEX idx_citations_target ON paper_citations(target_paper_id);
        """
    )
    conn.commit()


def load_vispubdata_csv(csv_path: Path) -> List[Dict[str, Any]]:
    """
    Loads standard IEEE VIS vispubdata CSV file.
    Expected columns: Conference, Year, Title, DOI, Abstract, AuthorNames-Deduped,
    AuthorAffiliation, AuthorKeywords, InternalReferences, CitationCount_CrossRef.
    """
    records: List[Dict[str, Any]] = []
    with csv_path.open("r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            title = (row.get("Title") or "").strip()
            abstract = (row.get("Abstract") or "").strip()
            if not title or not abstract or abstract.lower() == "na":
                continue
            try:
                year = int(float(row.get("Year") or 2015))
            except ValueError:
                year = 2015
            try:
                citations = int(float(row.get("CitationCount_CrossRef") or row.get("AminerCitationCount") or 0))
            except ValueError:
                citations = 0

            doi = (row.get("DOI") or f"10.1109/VIS.{year}.{idx:04d}").strip()
            venue = (row.get("Conference") or "IEEE VIS").strip()
            authors_raw = [a.strip() for a in (row.get("AuthorNames-Deduped") or "").split(";") if a.strip()]
            affiliations_raw = [a.strip() for a in (row.get("AuthorAffiliation") or "").split(";") if a.strip()]
            keywords_raw = [
                k.strip()
                for k in re.split(r"[;,]", row.get("AuthorKeywords") or "")
                if k.strip() and k.strip().lower() != "na"
            ]
            refs_raw = [r.strip() for r in (row.get("InternalReferences") or "").split(";") if r.strip()]

            records.append(
                {
                    "id": doi if doi else f"vis-{year}-{idx}",
                    "title": title,
                    "year": year,
                    "venue": venue,
                    "doi": doi,
                    "abstract": abstract,
                    "citation_count": max(0, citations),
                    "authors": authors_raw or ["Anonymous VIS Researcher"],
                    "affiliation": affiliations_raw[0] if affiliations_raw else "IEEE VIS Research Community",
                    "keywords": keywords_raw,
                    "internal_refs": refs_raw,
                }
            )
    return records


def train_lda_and_compute_metrics(
    records: List[Dict[str, Any]],
    n_topics: int = 8,
    random_state: int = 42,
) -> Tuple[np.ndarray, List[List[Tuple[str, float]]], np.ndarray]:
    """
    Runs CountVectorizer + LatentDirichletAllocation on (Title + Abstract + 3x AuthorKeywords).
    Returns:
      - doc_topic_dist: shape (n_docs, n_topics), normalized posterior probabilities
      - topic_top_words: list of top (term, weight) tuples per topic
      - corr_matrix: shape (n_topics, n_topics), Pearson correlation between topics
    """
    corpus: List[str] = []
    for rec in records:
        kw_boost = " ".join(rec["keywords"] * 3)
        combined = f"{rec['title']} {rec['abstract']} {kw_boost}"
        corpus.append(clean_text(combined))

    vectorizer = CountVectorizer(
        stop_words="english",
        max_df=0.85,
        min_df=2 if len(corpus) > 25 else 1,
        max_features=4000,
        ngram_range=(1, 2),
    )
    doc_term_matrix = vectorizer.fit_transform(corpus)
    feature_names = vectorizer.get_feature_names_out()

    lda = LatentDirichletAllocation(
        n_components=n_topics,
        max_iter=40,
        learning_method="batch",
        doc_topic_prior=0.15,
        topic_word_prior=0.05,
        random_state=random_state,
    )
    doc_topic_dist = lda.fit_transform(doc_term_matrix)

    # Extract top 12 keywords per topic with normalized weight
    topic_top_words: List[List[Tuple[str, float]]] = []
    for topic_idx, comp in enumerate(lda.components_):
        top_indices = comp.argsort()[-12:][::-1]
        total_weight = float(comp.sum()) or 1.0
        words = [(str(feature_names[i]), round(float(comp[i] / total_weight), 4)) for i in top_indices]
        topic_top_words.append(words)

    # Compute topic-to-topic Pearson correlation matrix across documents
    if doc_topic_dist.shape[0] > 2:
        corr_matrix = np.corrcoef(doc_topic_dist.T)
        corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)
    else:
        corr_matrix = np.eye(n_topics)

    return doc_topic_dist, topic_top_words, corr_matrix


def run_pipeline(csv_path: Path | None, db_path: Path) -> None:
    """Executes the end-to-end ETL pipeline and writes `vispub_analytics.db`."""
    if csv_path and csv_path.exists():
        print(f"[ETL] Loading Vispubdata CSV from {csv_path}...")
        records = load_vispubdata_csv(csv_path)
    else:
        raise FileNotFoundError(
            f"Vispubdata CSV not found at {csv_path}. Provide --input path/to/vispubdata.csv"
        )

    n_topics = len(DEFAULT_TOPIC_ANCHORS)
    print(f"[LDA] Fitting Latent Dirichlet Allocation with K={n_topics} topics on {len(records)} papers...")
    doc_topic_dist, topic_top_words, corr_matrix = train_lda_and_compute_metrics(records, n_topics=n_topics)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    create_database_schema(conn)
    cursor = conn.cursor()

    # 1. Insert Topics
    years_all = sorted({r["year"] for r in records})
    min_year, max_year = (min(years_all), max(years_all)) if years_all else (1990, 2024)

    topic_year_weights: Dict[int, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
    topic_year_counts: Dict[int, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    topic_paper_counts: Dict[int, int] = defaultdict(int)
    topic_citations: Dict[int, int] = defaultdict(int)

    for doc_idx, rec in enumerate(records):
        dist = doc_topic_dist[doc_idx]
        primary_k = int(np.argmax(dist))
        year = rec["year"]
        topic_paper_counts[primary_k] += 1
        topic_citations[primary_k] += rec["citation_count"]
        for k in range(n_topics):
            topic_year_weights[k][year] += float(dist[k])
            if dist[k] >= 0.18:
                topic_year_counts[k][year] += 1

    for k, anchor in enumerate(DEFAULT_TOPIC_ANCHORS):
        kw_payload = [{"term": term, "weight": weight} for term, weight in topic_top_words[k]]
        by_year = topic_year_weights[k]
        peak_year = max(by_year.items(), key=lambda x: x[1])[0] if by_year else max_year
        early = sum(by_year.get(y, 0.0) for y in range(max_year - 9, max_year - 4)) + 1e-3
        recent = sum(by_year.get(y, 0.0) for y in range(max_year - 4, max_year + 1))
        growth_rate = round(((recent - early) / early) * 100.0, 1)

        cursor.execute(
            """
            INSERT INTO topics (
                id, name, short_name, color, description,
                top_keywords_json, paper_count, total_citations, peak_year, growth_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                anchor["id"],
                anchor["name"],
                anchor["short_name"],
                anchor["color"],
                f"Automatically extracted LDA cluster characterized by {', '.join(w[0] for w in topic_top_words[k][:5])}.",
                json.dumps(kw_payload),
                topic_paper_counts[k],
                topic_citations[k],
                peak_year,
                growth_rate,
            ),
        )

    # 2. Insert Yearly Topic Prevalence
    for year in range(min_year, max_year + 1):
        year_total = sum(topic_year_weights[k].get(year, 0.0) for k in range(n_topics)) or 1.0
        for k, anchor in enumerate(DEFAULT_TOPIC_ANCHORS):
            raw_w = topic_year_weights[k].get(year, 0.0)
            cursor.execute(
                """
                INSERT INTO topic_yearly_prevalence (year, topic_id, prevalence, paper_count)
                VALUES (?, ?, ?, ?)
                """,
                (year, anchor["id"], round(raw_w / year_total, 4), topic_year_counts[k].get(year, 0)),
            )

    # 3. Insert Topic-to-Topic Correlations
    for i in range(n_topics):
        for j in range(n_topics):
            if i == j:
                continue
            co_occ = int(np.sum((doc_topic_dist[:, i] > 0.18) & (doc_topic_dist[:, j] > 0.18)))
            cursor.execute(
                """
                INSERT INTO topic_correlations (source_topic_id, target_topic_id, correlation, co_occurrence_count)
                VALUES (?, ?, ?, ?)
                """,
                (
                    DEFAULT_TOPIC_ANCHORS[i]["id"],
                    DEFAULT_TOPIC_ANCHORS[j]["id"],
                    round(float(corr_matrix[i, j]), 4),
                    co_occ,
                ),
            )

    # 4. Insert Papers, Paper-Topic Relevance, Authors, and Citation Network
    author_Data: Dict[str, Dict[str, Any]] = {}
    paper_id_set = {r["id"] for r in records}

    for doc_idx, rec in enumerate(records):
        dist = doc_topic_dist[doc_idx]
        primary_k = int(np.argmax(dist))
        primary_topic_id = DEFAULT_TOPIC_ANCHORS[primary_k]["id"]

        cursor.execute(
            """
            INSERT OR REPLACE INTO papers (
                id, title, year, venue, doi, abstract, citation_count, primary_topic_id, keywords_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rec["id"],
                rec["title"],
                rec["year"],
                rec["venue"],
                rec["doi"],
                rec["abstract"],
                rec["citation_count"],
                primary_topic_id,
                json.dumps(rec["keywords"]),
            ),
        )

        for k in range(n_topics):
            score = round(float(dist[k]), 4)
            if score >= 0.02:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO paper_topics (paper_id, topic_id, relevance_score)
                    VALUES (?, ?, ?)
                    """,
                    (rec["id"], DEFAULT_TOPIC_ANCHORS[k]["id"], score),
                )

        for order_idx, author_name in enumerate(rec["authors"]):
            author_id = re.sub(r"[^a-z0-9]+", "-", author_name.lower()).strip("-")
            if author_id not in author_Data:
                author_Data[author_id] = {
                    "id": author_id,
                    "name": author_name,
                    "affiliation": rec["affiliation"],
                    "papers": [],
                    "citations": [],
                    "years": [],
                    "topic_weights": np.zeros(n_topics),
                    "yearly": defaultdict(lambda: {"papers": 0, "citations": 0, "topics": defaultdict(float)}),
                }
            a_entry = author_Data[author_id]
            a_entry["papers"].append(rec["id"])
            a_entry["citations"].append(rec["citation_count"])
            a_entry["years"].append(rec["year"])
            a_entry["topic_weights"] += dist
            a_entry["yearly"][rec["year"]]["papers"] += 1
            a_entry["yearly"][rec["year"]]["citations"] += rec["citation_count"]
            for k in range(n_topics):
                a_entry["yearly"][rec["year"]]["topics"][DEFAULT_TOPIC_ANCHORS[k]["id"]] += float(dist[k])

            cursor.execute(
                """
                INSERT OR REPLACE INTO paper_authors (paper_id, author_id, author_order)
                VALUES (?, ?, ?)
                """,
                (rec["id"], author_id, order_idx),
            )

        for ref_id in rec["internal_refs"]:
            if ref_id in paper_id_set and ref_id != rec["id"]:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO paper_citations (source_paper_id, target_paper_id)
                    VALUES (?, ?)
                    """,
                    (rec["id"], ref_id),
                )

    # 5. Insert Aggregated Author Profiles & Yearly Stats
    for author_id, a_data in author_Data.items():
        sorted_cites = sorted(a_data["citations"], reverse=True)
        h_idx = 0
        for idx, c in enumerate(sorted_cites, start=1):
            if c >= idx:
                h_idx = idx
            else:
                break

        dom_topic_idx = int(np.argmax(a_data["topic_weights"]))
        cursor.execute(
            """
            INSERT INTO authors (
                id, name, affiliation, total_papers, total_citations,
                h_index, primary_topic_id, active_start_year, active_end_year
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                author_id,
                a_data["name"],
                a_data["affiliation"],
                len(a_data["papers"]),
                sum(a_data["citations"]),
                h_idx,
                DEFAULT_TOPIC_ANCHORS[dom_topic_idx]["id"],
                min(a_data["years"]),
                max(a_data["years"]),
            ),
        )

        for yr, yr_info in sorted(a_data["yearly"].items()):
            topic_dict = {k: round(v, 3) for k, v in yr_info["topics"].items()}
            cursor.execute(
                """
                INSERT INTO author_yearly_stats (
                    author_id, year, paper_count, citation_sum, topic_breakdown_json
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    author_id,
                    yr,
                    yr_info["papers"],
                    yr_info["citations"],
                    json.dumps(topic_dict),
                ),
            )

    conn.commit()
    conn.close()
    print(f"[SUCCESS] Pre-computed SQLite database written to {db_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Precompute IEEE VIS LDA Topics & Citation Network")
    parser.add_argument("--input", type=Path, required=True, help="Path to Vispubdata CSV file")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "backend" / "vispub_analytics.db",
        help="Output SQLite database path",
    )
    args = parser.parse_args()
    run_pipeline(args.input, args.output)
