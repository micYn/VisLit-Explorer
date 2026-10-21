import {
  AUTHORS,
  RAW_PAPERS,
   RawPaperRecord,
  STREAM_DATA,
  TOPIC_CORRELATIONS,
  TOPICS,
} from '../data/vispubCorpus';
import {
  AuthorBrief,
  AuthorDetailResponse,
  AuthorTopicShare,
  AuthorYearlyStat,
  CitationLink,
  CitationNode,
  FieldOverviewResponse,
  PaperDetailResponse,
  PaperSummary,
  TopicDetailResponse,
  TopicScoreItem,
  TopicSummary,
} from '../types';

export type PaperSortKey = 'citations' | 'relevance' | 'year';

export function getTopicById(topicId: string): TopicSummary {
  return TOPICS.find((t) => t.id === topicId) || TOPICS[0];
}

export function toPaperSummary(rec: RawPaperRecord, topicIdForRelevance?: string): PaperSummary {
  const relTopic = topicIdForRelevance || rec.primaryTopicId;
  const relevanceScore = rec.topicScores[relTopic] ?? rec.topicScores[rec.primaryTopicId] ?? 0.5;
  const authors: AuthorBrief[] = rec.authorIds
    .map((aid) => AUTHORS[aid])
    .filter(Boolean)
    .map((a) => ({ id: a.id, name: a.name, affiliation: a.affiliation }));

  return {
    id: rec.id,
    title: rec.title,
    year: rec.year,
    venue: rec.venue,
    doi: rec.doi,
    citationCount: rec.citationCount,
    relevanceScore: Number(relevanceScore.toFixed(3)),
    primaryTopicId: rec.primaryTopicId,
    authors,
    keywords: rec.keywords,
  };
}

export function sortAndFilterPapers(
  papers: PaperSummary[],
  sortBy: PaperSortKey,
  searchQuery = '',
  venueFilter = 'ALL'
): PaperSummary[] {
  const q = searchQuery.trim().toLowerCase();

  const filtered = papers.filter((p) => {
    if (venueFilter !== 'ALL' && p.venue !== venueFilter) {
      return false;
    }
    if (!q) return true;
    const matchTitle = p.title.toLowerCase().includes(q);
    const matchAuthor = p.authors.some((a) => a.name.toLowerCase().includes(q));
    const matchKw = p.keywords.some((k) => k.toLowerCase().includes(q));
    const matchYear = String(p.year).includes(q);
    return matchTitle || matchAuthor || matchKw || matchYear;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'citations') {
      return b.citationCount - a.citationCount || b.relevanceScore - a.relevanceScore;
    }
    if (sortBy === 'relevance') {
      return b.relevanceScore - a.relevanceScore || b.citationCount - a.citationCount;
    }
    return b.year - a.year || b.citationCount - a.citationCount;
  });
}

export function buildFieldOverview(): FieldOverviewResponse {
  const totalPapers = TOPICS.reduce((acc, t) => acc + t.paperCount, 0);
  const totalCitations = TOPICS.reduce((acc, t) => acc + t.totalCitations, 0);
  const totalAuthors = Object.keys(AUTHORS).length;

  return {
    topics: TOPICS,
    streamData: STREAM_DATA,
    correlations: TOPIC_CORRELATIONS,
    yearRange: [1990, 2024],
    totalPapers,
    totalCitations,
    totalAuthors,
  };
}

export function buildTopicDetail(
  topicId: string,
  sortBy: PaperSortKey = 'citations'
): TopicDetailResponse {
  const topic = getTopicById(topicId);

  // Include papers where topic score >= 0.08 so the citation network has rich intra- and bridge-topic structure
  const matchingRaw = RAW_PAPERS.filter((r) => (r.topicScores[topic.id] ?? 0) >= 0.08);
  const summaries = matchingRaw.map((r) => toPaperSummary(r, topic.id));
  const sortedPapers = sortAndFilterPapers(summaries, sortBy);

  const nodeIdSet = new Set(sortedPapers.map((p) => p.id));
  const nodes: CitationNode[] = sortedPapers.map((p) => ({
    id: p.id,
    title: p.title,
    year: p.year,
    venue: p.venue,
    citationCount: p.citationCount,
    relevanceScore: p.relevanceScore,
    primaryTopicId: p.primaryTopicId,
    authors: p.authors.map((a) => a.name),
  }));

  const links: CitationLink[] = [];
  for (const raw of matchingRaw) {
    for (const targetId of raw.references) {
      if (nodeIdSet.has(targetId) && targetId !== raw.id) {
        links.push({
          source: raw.id,
          target: targetId,
        });
      }
    }
  }

  const yearlyTrend = STREAM_DATA.map((d) => ({
    year: d.year,
    prevalence: d.values[topic.id] ?? 0,
    paperCount: d.counts[topic.id] ?? 0,
  }));

  return {
    topic,
    papers: sortedPapers,
    citationNetwork: { nodes, links },
    yearlyTrend,
  };
}

export function buildAuthorDetail(authorId: string): AuthorDetailResponse {
  const authorMeta = AUTHORS[authorId] || Object.values(AUTHORS)[0];
  const authoredRaw = RAW_PAPERS.filter((r) => r.authorIds.includes(authorMeta.id));
  const papers = sortAndFilterPapers(
    authoredRaw.map((r) => toPaperSummary(r)),
    'citations'
  );

  // Build deterministic yearly career series from activeStartYear to activeEndYear
  const startYr = authorMeta.activeStartYear;
  const endYr = authorMeta.activeEndYear;

  const yearlyStats: AuthorYearlyStat[] = [];
  const topicCumulative: Record<string, number> = {};
  const topicPaperCounts: Record<string, number> = {};

  for (let yr = startYr; yr <= endYr; yr++) {
    const exactPapers = authoredRaw.filter((p) => p.year === yr);

    // Deterministic synthetic career activity combined with landmark papers
    const seed = (yr * 31 + authorMeta.name.length * 17) % 100;
    const baseCount = exactPapers.length > 0 ? exactPapers.length + 1 : seed > 35 ? (seed > 75 ? 3 : 2) : 1;
    const exactCitations = exactPapers.reduce((acc, p) => acc + p.citationCount, 0);
    const citationSum = exactCitations > 0 ? exactCitations : baseCount * (45 + (seed % 85));

    const topicBreakdown: Record<string, number> = {};
    if (exactPapers.length > 0) {
      for (const p of exactPapers) {
        for (const [tid, score] of Object.entries(p.topicScores)) {
          const val = Number((score * (baseCount / exactPapers.length)).toFixed(2));
          topicBreakdown[tid] = Number(((topicBreakdown[tid] || 0) + val).toFixed(2));
        }
      }
    } else {
      // Distribute across primary topic and correlated secondary topic
      const primaryId = authorMeta.primaryTopicId;
      const secondaryEdge = TOPIC_CORRELATIONS.find((c) => c.sourceTopicId === primaryId);
      const secondaryId = secondaryEdge ? secondaryEdge.targetTopicId : 'topic-4';
      topicBreakdown[primaryId] = Number((baseCount * 0.68).toFixed(2));
      topicBreakdown[secondaryId] = Number((baseCount * 0.32).toFixed(2));
    }

    for (const [tid, w] of Object.entries(topicBreakdown)) {
      topicCumulative[tid] = (topicCumulative[tid] || 0) + w;
      if (w >= 0.25) {
        topicPaperCounts[tid] = (topicPaperCounts[tid] || 0) + Math.max(1, Math.round(w));
      }
    }

    yearlyStats.push({
      year: yr,
      paperCount: baseCount,
      citationSum,
      topicBreakdown,
    });
  }

  const totalTopicWeight = Object.values(topicCumulative).reduce((a, b) => a + b, 0) || 1;
  const topicDistribution: AuthorTopicShare[] = Object.entries(topicCumulative)
    .map(([tid, weight]) => {
      const t = getTopicById(tid);
      return {
        topicId: tid,
        topicName: t.name,
        color: t.color,
        share: Number((weight / totalTopicWeight).toFixed(3)),
        paperCount: topicPaperCounts[tid] || 1,
      };
    })
    .sort((a, b) => b.share - a.share);

  // Co-authors from shared papers + top research collaborators
  const coAuthorIds = new Set<string>();
  for (const p of authoredRaw) {
    for (const aid of p.authorIds) {
      if (aid !== authorMeta.id) coAuthorIds.add(aid);
    }
  }
  if (coAuthorIds.size < 3) {
    for (const candidate of Object.values(AUTHORS)) {
      if (candidate.id !== authorMeta.id && candidate.primaryTopicId === authorMeta.primaryTopicId) {
        coAuthorIds.add(candidate.id);
      }
    }
  }

  const coAuthors: AuthorBrief[] = Array.from(coAuthorIds)
    .map((id) => AUTHORS[id])
    .filter(Boolean)
    .map((a) => ({ id: a.id, name: a.name, affiliation: a.affiliation }));

  const totalPapers = yearlyStats.reduce((acc, s) => acc + s.paperCount, 0);
  const totalCitations = yearlyStats.reduce((acc, s) => acc + s.citationSum, 0);

  return {
    id: authorMeta.id,
    name: authorMeta.name,
    affiliation: authorMeta.affiliation,
    totalPapers,
    totalCitations,
    hIndex: authorMeta.hIndex,
    primaryTopicId: authorMeta.primaryTopicId,
    activeStartYear: startYr,
    activeEndYear: endYr,
    yearlyStats,
    topicDistribution,
    papers,
    coAuthors,
  };
}

export function buildPaperDetail(paperId: string): PaperDetailResponse {
  const raw = RAW_PAPERS.find((p) => p.id === paperId) || RAW_PAPERS[0];
  const summary = toPaperSummary(raw);

  const topicBreakdown: TopicScoreItem[] = Object.entries(raw.topicScores)
    .map(([tid, score]) => {
      const t = getTopicById(tid);
      return {
        topicId: tid,
        topicName: t.name,
        color: t.color,
        relevanceScore: Number(score.toFixed(3)),
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const referencesPapers = raw.references
    .map((refId) => RAW_PAPERS.find((p) => p.id === refId))
    .filter((p): p is RawPaperRecord => Boolean(p))
    .map((p) => toPaperSummary(p));

  const citedByPapers = RAW_PAPERS.filter((p) => p.references.includes(raw.id)).map((p) =>
    toPaperSummary(p)
  );

  // Related papers by cosine similarity of topic vectors
  const relatedPapers = RAW_PAPERS.filter((p) => p.id !== raw.id)
    .map((candidate) => {
      let dot = 0;
      for (const [tid, s1] of Object.entries(raw.topicScores)) {
        const s2 = candidate.topicScores[tid] || 0;
        dot += s1 * s2;
      }
      return { rec: candidate, sim: dot };
    })
    .sort((a, b) => b.sim - a.sim || b.rec.citationCount - a.rec.citationCount)
    .slice(0, 5)
    .map((item) => toPaperSummary(item.rec, raw.primaryTopicId));

  return {
    id: summary.id,
    title: summary.title,
    year: summary.year,
    venue: summary.venue,
    doi: summary.doi,
    url: `https://doi.org/${summary.doi}`,
    abstract: raw.abstract,
    citationCount: summary.citationCount,
    primaryTopicId: summary.primaryTopicId,
    authors: summary.authors,
    keywords: summary.keywords,
    topicBreakdown,
    citedByPapers,
    referencesPapers,
    relatedPapers,
  };
}

export function getCorrelationBetween(topicA: string, topicB: string): number {
  if (topicA === topicB) return 1.0;
  const edge = TOPIC_CORRELATIONS.find(
    (e) =>
      (e.sourceTopicId === topicA && e.targetTopicId === topicB) ||
      (e.sourceTopicId === topicB && e.targetTopicId === topicA)
  );
  return edge ? edge.correlation : 0.08;
}

export function listAllAuthors(): Array<
  AuthorBrief & {
    hIndex: number;
    primaryTopicId: string;
    paperCount: number;
    totalCitations: number;
  }
> {
  return Object.values(AUTHORS).map((a) => {
    const detail = buildAuthorDetail(a.id);
    return {
      id: a.id,
      name: a.name,
      affiliation: a.affiliation,
      hIndex: a.hIndex,
      primaryTopicId: a.primaryTopicId,
      paperCount: detail.totalPapers,
      totalCitations: detail.totalCitations,
    };
  });
}

export function listAllPapers(sortBy: PaperSortKey = 'citations'): PaperSummary[] {
  return sortAndFilterPapers(
    RAW_PAPERS.map((r) => toPaperSummary(r)),
    sortBy
  );
}
