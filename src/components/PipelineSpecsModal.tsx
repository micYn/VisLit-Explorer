import React, { useState } from 'react';
import { Check, Code2, Copy, Database, Server, X } from 'lucide-react';

interface PipelineSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CODE_ARTIFACTS: Record<
  'etl' | 'fastapi' | 'schemas' | 'database',
  { title: string; path: string; language: string; summary: string; code: string }
> = {
  etl: {
    title: 'LDA Topic & Citation ETL',
    path: 'data_pipeline/preprocess_lda.py',
    language: 'python',
    summary:
      'Cleans Vispubdata CSV abstracts + keywords, fits scikit-learn LatentDirichletAllocation (K=8), computes yearly prevalence & Pearson topic correlation matrix, and exports to SQLite.',
    code: `# data_pipeline/preprocess_lda.py (Full Script on Disk)
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.feature_extraction.text import CountVectorizer
import numpy as np
import sqlite3

def train_lda_and_compute_metrics(records, n_topics=8, random_state=42):
    corpus = [
        clean_text(f"{r['title']} {r['abstract']} {' '.join(r['keywords'] * 3)}")
        for r in records
    ]
    vectorizer = CountVectorizer(
        stop_words="english", max_df=0.85, min_df=2,
        max_features=4000, ngram_range=(1, 2)
    )
    doc_term_matrix = vectorizer.fit_transform(corpus)
    lda = LatentDirichletAllocation(
        n_components=n_topics, max_iter=40,
        learning_method="batch", doc_topic_prior=0.15,
        topic_word_prior=0.05, random_state=random_state
    )
    doc_topic_dist = lda.fit_transform(doc_term_matrix)
    corr_matrix = np.corrcoef(doc_topic_dist.T)
    return doc_topic_dist, corr_matrix`,
  },
  fastapi: {
    title: 'FastAPI Endpoints',
    path: 'backend/main.py',
    language: 'python',
    summary:
      'Serves pre-computed SQLite tables for Field Overview, Topic Citation Network, Author Analytics, and Paper Monograph views.',
    code: `# backend/main.py (Full File on Disk)
from fastapi import FastAPI, HTTPException, Query
from .database import get_db_connection, build_paper_summary
from .schemas import (
    FieldOverviewResponse, TopicDetailResponse,
    AuthorDetailResponse, PaperDetailResponse
)

app = FastAPI(title="VisLit Explorer API", version="1.0.0")

@app.get("/api/field-overview", response_model=FieldOverviewResponse)
def get_field_overview() -> FieldOverviewResponse: ...

@app.get("/api/topics/{topic_id}", response_model=TopicDetailResponse)
def get_topic_detail(topic_id: str, sort_by: str = Query("citations")): ...

@app.get("/api/authors/{author_id}", response_model=AuthorDetailResponse)
def get_author_detail(author_id: str) -> AuthorDetailResponse: ...

@app.get("/api/papers/{paper_id}", response_model=PaperDetailResponse)
def get_paper_detail(paper_id: str) -> PaperDetailResponse: ...`,
  },
  schemas: {
    title: 'Pydantic v2 Schemas',
    path: 'backend/schemas.py',
    language: 'python',
    summary:
      'Strict Pydantic v2 response contracts matching TypeScript interfaces in frontend/src/types.ts 1:1.',
    code: `# backend/schemas.py (Full File on Disk)
from pydantic import BaseModel
from typing import Dict, List

class TopicSummary(BaseModel):
    id: str
    name: str
    shortName: str
    color: str
    description: str
    topKeywords: List[KeywordWeight]
    paperCount: int
    totalCitations: int
    peakYear: int
    growthRate: float

class TopicDetailResponse(BaseModel):
    topic: TopicSummary
    papers: List[PaperSummary]
    citationNetwork: Dict[str, List]
    yearlyTrend: List[Dict[str, float | int]]`,
  },
  database: {
    title: 'SQLite Access Layer',
    path: 'backend/database.py',
    language: 'python',
    summary:
      'SQLite connection context manager and indexed queries over topics, topic_yearly_prevalence, topic_correlations, papers, paper_topics, authors, and paper_citations.',
    code: `# backend/database.py (Full File on Disk)
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "vispub_analytics.db"

@contextmanager
def get_db_connection(db_path: Path = DB_PATH):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()`,
  },
};

export const PipelineSpecsModal: React.FC<PipelineSpecsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'etl' | 'fastapi' | 'schemas' | 'database'>('etl');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeArtifact = CODE_ARTIFACTS[activeTab];

  const handleCopy = () => {
    navigator.clipboard?.writeText(activeArtifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Data Pipeline and FastAPI Architecture Specifications"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              System Architecture: Python LDA ETL Pipeline & FastAPI SQLite Backend
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All deliverable files are generated in the workspace (`data_pipeline/`, `backend/`, `frontend/src/`)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Architecture Modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                { id: 'etl', label: 'preprocess_lda.py', icon: Database },
                { id: 'fastapi', label: 'backend/main.py', icon: Server },
                { id: 'schemas', label: 'backend/schemas.py', icon: Code2 },
                { id: 'database', label: 'backend/database.py', icon: Database },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-tabular font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Snippet'}
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{activeArtifact.summary}</span>
            <span className="font-mono-tabular text-slate-500 shrink-0 ml-4">
              File: /{activeArtifact.path}
            </span>
          </div>

          <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono-tabular overflow-x-auto leading-relaxed">
            <code>{activeArtifact.code}</code>
          </pre>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono-tabular">
            D3 Integration Pattern: React owns the DOM (&lt;svg&gt;, &lt;path&gt;, &lt;circle&gt;), D3 computes scales, stack, &amp; forceSimulation
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
