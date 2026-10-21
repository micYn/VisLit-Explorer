"""
Pydantic v2 Response Schemas for the IEEE VIS Literature Exploration System.
These models correspond 1:1 with the TypeScript interfaces in `frontend/src/types.ts`.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class KeywordWeight(BaseModel):
    term: str
    weight: float


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
    growthRate: float = Field(..., description="5-year trend percentage change")


class YearlyTopicPrevalence(BaseModel):
    year: int
    values: Dict[str, float] = Field(
        ..., description="Mapping from topic_id to normalized prevalence/paper count"
    )
    counts: Dict[str, int] = Field(
        ..., description="Mapping from topic_id to discrete paper count in that year"
    )


class TopicCorrelationEdge(BaseModel):
    sourceTopicId: str
    targetTopicId: str
    correlation: float = Field(..., description="Pearson correlation or cosine similarity [-1, 1]")
    coOccurrenceCount: int = Field(..., description="Number of papers sharing both topics above threshold")


class FieldOverviewResponse(BaseModel):
    topics: List[TopicSummary]
    streamData: List[YearlyTopicPrevalence]
    correlations: List[TopicCorrelationEdge]
    yearRange: List[int]
    totalPapers: int
    totalCitations: int
    totalAuthors: int


class AuthorBrief(BaseModel):
    id: str
    name: str
    affiliation: str


class TopicScoreItem(BaseModel):
    topicId: str
    topicName: str
    color: str
    relevanceScore: float


class PaperSummary(BaseModel):
    id: str
    title: str
    year: int
    venue: str
    doi: str
    citationCount: int
    relevanceScore: float
    primaryTopicId: str
    authors: List[AuthorBrief]
    keywords: List[str]


class CitationNode(BaseModel):
    id: str
    title: str
    year: int
    venue: str
    citationCount: int
    relevanceScore: float
    primaryTopicId: str
    authors: List[str]


class CitationLink(BaseModel):
    source: str = Field(..., description="Citing paper ID")
    target: str = Field(..., description="Cited paper ID")


class TopicDetailResponse(BaseModel):
    topic: TopicSummary
    papers: List[PaperSummary]
    citationNetwork: Dict[str, List] = Field(
        ..., description="Contains 'nodes' (List[CitationNode]) and 'links' (List[CitationLink])"
    )
    yearlyTrend: List[Dict[str, float | int]]


class AuthorYearlyStat(BaseModel):
    year: int
    paperCount: int
    citationSum: int
    topicBreakdown: Dict[str, float] = Field(
        ..., description="Mapping of topic_id to author's fractional topic output in that year"
    )


class AuthorTopicShare(BaseModel):
    topicId: str
    topicName: str
    color: str
    share: float
    paperCount: int


class AuthorDetailResponse(BaseModel):
    id: str
    name: str
    affiliation: str
    totalPapers: int
    totalCitations: int
    hIndex: int
    primaryTopicId: str
    activeStartYear: int
    activeEndYear: int
    yearlyStats: List[AuthorYearlyStat]
    topicDistribution: List[AuthorTopicShare]
    papers: List[PaperSummary]
    coAuthors: List[AuthorBrief]


class PaperDetailResponse(BaseModel):
    id: str
    title: str
    year: int
    venue: str
    doi: str
    url: str
    abstract: str
    citationCount: int
    primaryTopicId: str
    authors: List[AuthorBrief]
    keywords: List[str]
    topicBreakdown: List[TopicScoreItem]
    citedByPapers: List[PaperSummary]
    referencesPapers: List[PaperSummary]
    relatedPapers: List[PaperSummary]
