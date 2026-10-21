/**
 * TypeScript Interfaces for the IEEE VIS Literature Exploration System (VisLit Explorer).
 * These interfaces match the FastAPI Pydantic v2 models in `backend/schemas.py` 1:1.
 */

export type ViewMode = 'field' | 'topic' | 'author' | 'paper';

export interface KeywordWeight {
  term: string;
  weight: number;
}

export interface TopicSummary {
  id: string;
  name: string;
  shortName: string;
  color: string;
  description: string;
  topKeywords: KeywordWeight[];
  paperCount: number;
  totalCitations: number;
  peakYear: number;
  growthRate: number; // 5-year trend percentage change
}

export interface YearlyTopicPrevalence {
  year: number;
  /** Mapping from topic_id to normalized prevalence [0, 1] */
  values: Record<string, number>;
  /** Mapping from topic_id to discrete paper count in that year */
  counts: Record<string, number>;
}

export interface TopicCorrelationEdge {
  sourceTopicId: string;
  targetTopicId: string;
  /** Pearson correlation coefficient [-1, 1] across document-topic vectors */
  correlation: number;
  /** Number of papers sharing both topics above relevance threshold (theta >= 0.18) */
  coOccurrenceCount: number;
}

export interface FieldOverviewResponse {
  topics: TopicSummary[];
  streamData: YearlyTopicPrevalence[];
  correlations: TopicCorrelationEdge[];
  yearRange: [number, number];
  totalPapers: number;
  totalCitations: number;
  totalAuthors: number;
}

export interface AuthorBrief {
  id: string;
  name: string;
  affiliation: string;
}

export interface TopicScoreItem {
  topicId: string;
  topicName: string;
  color: string;
  relevanceScore: number;
}

export interface PaperSummary {
  id: string;
  title: string;
  year: number;
  venue: 'IEEE InfoVis' | 'IEEE VAST' | 'IEEE SciVis' | 'IEEE VIS' | string;
  doi: string;
  citationCount: number;
  relevanceScore: number;
  primaryTopicId: string;
  authors: AuthorBrief[];
  keywords: string[];
}

export interface CitationNode {
  id: string;
  title: string;
  year: number;
  venue: string;
  citationCount: number;
  relevanceScore: number;
  primaryTopicId: string;
  authors: string[];
  // Optional D3 simulation coordinates
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface CitationLink {
  source: string;
  target: string;
}

export interface TopicYearlyPoint {
  year: number;
  prevalence: number;
  paperCount: number;
}

export interface TopicDetailResponse {
  topic: TopicSummary;
  papers: PaperSummary[];
  citationNetwork: {
    nodes: CitationNode[];
    links: CitationLink[];
  };
  yearlyTrend: TopicYearlyPoint[];
}

export interface AuthorYearlyStat {
  year: number;
  paperCount: number;
  citationSum: number;
  topicBreakdown: Record<string, number>;
}

export interface AuthorTopicShare {
  topicId: string;
  topicName: string;
  color: string;
  share: number;
  paperCount: number;
}

export interface AuthorDetailResponse {
  id: string;
  name: string;
  affiliation: string;
  totalPapers: number;
  totalCitations: number;
  hIndex: number;
  primaryTopicId: string;
  activeStartYear: number;
  activeEndYear: number;
  yearlyStats: AuthorYearlyStat[];
  topicDistribution: AuthorTopicShare[];
  papers: PaperSummary[];
  coAuthors: AuthorBrief[];
}

export interface PaperDetailResponse {
  id: string;
  title: string;
  year: number;
  venue: string;
  doi: string;
  url: string;
  abstract: string;
  citationCount: number;
  primaryTopicId: string;
  authors: AuthorBrief[];
  keywords: string[];
  topicBreakdown: TopicScoreItem[];
  citedByPapers: PaperSummary[];
  referencesPapers: PaperSummary[];
  relatedPapers: PaperSummary[];
}
