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
  /** 1-sentence plain-English description explaining what research in this subfield investigates */
  description: string;
  /** 1-line plain-language summary explaining why the top keywords group together */
  keywordGroupingSummary: string;
  topKeywords: KeywordWeight[];
  paperCount: number;
  indexedPaperCount?: number;
  totalCitations: number;
  peakYear: number;
  growthRate: number; // 5-year trend percentage change
}

export interface YearlyTopicPrevalence {
  year: number;
  /** Mapping from topic_id to normalized share [0, 1] */
  values: Record<string, number>;
  /** Mapping from topic_id to discrete paper count in that year */
  counts: Record<string, number>;
}

export interface TopicCorrelationEdge {
  sourceTopicId: string;
  targetTopicId: string;
  /** Topic similarity / correlation score [-1, 1] */
  correlation: number;
  /** Number of papers bridging both subfields */
  coOccurrenceCount: number;
}

export interface FieldOverviewResponse {
  topics: TopicSummary[];
  streamData: YearlyTopicPrevalence[];
  correlations: TopicCorrelationEdge[];
  yearRange: [number, number];
  totalPapers: number;
  indexedPapers?: number;
  totalCitations: number;
  totalAuthors: number;
}

export interface AuthorBrief {
  id: string;
  name: str_alias;
  rawName?: string;
  affiliation: string;
}
type str_alias = string;

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
  abstract: string;
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
  /** True when node belongs primarily to a different research topic and is pulled in via citation linkage */
  isCrossTopic?: boolean;
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

export interface TopicAuthorSummary {
  id: string;
  name: string;
  rawName?: string;
  affiliation: string;
  topicPaperCount: number;
  topicCitations: number;
  hIndex: number;
  topicHIndex?: number;
}

export interface TopicDetailResponse {
  topic: TopicSummary;
  seminalPapers: PaperSummary[];
  leadingAuthors: TopicAuthorSummary[];
  papers: PaperSummary[];
  citationNetwork: {
    nodes: CitationNode[];
    links: CitationLink[];
    /** Explicit description of the active backend/frontend graph filtering method */
    filteringCriteria?: string;
    coreSubfieldNodeCount?: number;
    crossTopicNodeCount?: number;
    standaloneNodeCount?: number;
  };
  yearlyTrend: TopicYearlyPoint[];
}

export interface StandoutPaperBrief {
  id: string;
  title: string;
  year?: number;
  venue: string;
  citationCount: number;
}

export interface AuthorYearlyStat {
  year: number;
  paperCount: number;
  citationSum: number;
  topicBreakdown: Record<string, number>;
  standoutPaper: StandoutPaperBrief | null;
  yearPapers?: StandoutPaperBrief[];
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
  secondaryTopicId: string;
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
