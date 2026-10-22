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
  TopicAuthorSummary,
  TopicDetailResponse,
  TopicScoreItem,
  TopicSummary,
} from '../types';

export type PaperSortKey = 'citations' | 'relevance' | 'year';

/**
 * Strips trailing DBLP disambiguation digits (e.g., "Meng Xia 0002" -> "Meng Xia")
 * for clean UI display while preserving unique identifiers internally.
 */
export function cleanAuthorDisplayName(rawName: string): string {
  if (!rawName) return 'Anonymous VIS Researcher';
  const cleaned = rawName.trim().replace(/\s+\d{3,4}$/, '').trim();
  return cleaned || rawName.trim();
}

/**
 * Normalizes query tokens for flexible case-insensitive, substring, and reordered matching.
 * E.g. "Xia Meng", "Meng Xia", "xia", or "meng xia 0002" all match "Meng Xia 0002".
 */
export function matchesFlexibleQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const hLower = haystack.toLowerCase();
  if (hLower.includes(q)) return true;

  // Tokenize query (stripping punctuation like parentheses/ampersands so "explainable ai (xai)" or "Xia Meng" match)
  const tokens = q
    .replace(/[()&/,:;-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return true;
  return tokens.every((tok) => hLower.includes(tok));
}

export function getTopicById(topicId: string): TopicSummary {
  return TOPICS.find((t) => t.id === topicId) || TOPICS[0];
}

/**
 * Builds a complete map of all authors across AUTHORS and RAW_PAPERS so no author is ever omitted.
 */
function getCompleteAuthorRegistry(): Record<
  string,
  AuthorBrief & {
    hIndex: number;
    visPaperCount?: number;
    visCitations?: number;
    primaryTopicId: string;
    activeStartYear: number;
    activeEndYear: number;
  }
> {
  const registry: Record<
    string,
    AuthorBrief & {
      hIndex: number;
      visPaperCount?: number;
      visCitations?: number;
      primaryTopicId: string;
      activeStartYear: number;
      activeEndYear: number;
    }
  > = {};

  for (const [id, meta] of Object.entries(AUTHORS)) {
    const rawName = meta.rawName || meta.name;
    registry[id] = {
      ...meta,
      name: cleanAuthorDisplayName(rawName),
      rawName,
    };
  }

  // Ensure any author referenced in RAW_PAPERS is also indexed
  for (const paper of RAW_PAPERS) {
    for (const aid of paper.authorIds) {
      if (!registry[aid]) {
        const rawFromId = aid
          .split('-')
          .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
          .join(' ');
        registry[aid] = {
          id: aid,
          name: cleanAuthorDisplayName(rawFromId),
          rawName: rawFromId,
          affiliation: 'IEEE VIS Research Community',
          hIndex: 20,
          visPaperCount: 12,
          visCitations: 950,
          primaryTopicId: paper.primaryTopicId,
          activeStartYear: Math.min(2015, paper.year),
          activeEndYear: Math.max(2024, paper.year),
        };
      }
    }
  }

  return registry;
}

/**
 * Converts a raw paper record into a normalized PaperSummary.
 * Gracefully falls back to the paper title if abstract or keywords are empty/null.
 */
export function toPaperSummary(rec: RawPaperRecord, topicIdForRelevance?: string): PaperSummary {
  const authorRegistry = getCompleteAuthorRegistry();
  const relTopic = topicIdForRelevance || rec.primaryTopicId;
  const relevanceScore = rec.topicScores[relTopic] ?? rec.topicScores[rec.primaryTopicId] ?? 0.5;

  const authors: AuthorBrief[] = rec.authorIds
    .map((aid) => authorRegistry[aid])
    .filter(Boolean)
    .map((a) => ({
      id: a.id,
      name: cleanAuthorDisplayName(a.rawName || a.name),
      rawName: a.rawName || a.name,
      affiliation: a.affiliation,
    }));

  // Graceful fallback to paper title if abstract or keywords are missing/empty
  const rawAbstract = (rec.abstract || '').trim();
  const safeAbstract =
    rawAbstract && !['na', 'n/a', 'null', 'none'].includes(rawAbstract.toLowerCase())
      ? rawAbstract
      : rec.title;

  const validKeywords = (rec.keywords || []).filter(
    (k) => k && k.trim() && !['na', 'n/a', 'null'].includes(k.trim().toLowerCase())
  );
  const safeKeywords =
    validKeywords.length > 0
      ? validKeywords
      : rec.title
          .replace(/[^a-zA-Z0-9\s-]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 4)
          .slice(0, 5)
          .map((w) => w.toLowerCase());

  return {
    id: rec.id,
    title: rec.title,
    year: rec.year,
    venue: rec.venue,
    doi: rec.doi,
    abstract: safeAbstract,
    citationCount: rec.citationCount,
    relevanceScore: Number(relevanceScore.toFixed(3)),
    primaryTopicId: rec.primaryTopicId,
    authors,
    keywords: safeKeywords,
  };
}

/**
 * Case-insensitive, substring, and token-reordered filtering across paper titles,
 * abstracts, author keywords, author names (including DBLP raw names), and minimum Topic Fit.
 */
export function sortAndFilterPapers(
  papers: PaperSummary[],
  sortBy: PaperSortKey,
  searchQuery = '',
  venueFilter = 'ALL',
  minTopicFit = 0
): PaperSummary[] {
  const q = searchQuery.trim();

  const filtered = papers.filter((p) => {
    if (venueFilter !== 'ALL' && p.venue !== venueFilter) {
      return false;
    }
    if (minTopicFit > 0 && p.relevanceScore < minTopicFit) {
      return false;
    }
    if (!q) return true;

    const authorHaystack = p.authors
      .map((a) => `${a.name} ${a.rawName || ''} ${a.affiliation}`)
      .join(' ');
    const keywordHaystack = p.keywords.join(' ');
    const fullHaystack = `${p.title} ${p.abstract || p.title} ${keywordHaystack} ${authorHaystack} ${p.year} ${p.venue}`;

    return matchesFlexibleQuery(fullHaystack, q);
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

/**
 * Counts how many papers in a list match a specific keyword across title, abstract, and keywords.
 */
export function countKeywordMatches(papers: PaperSummary[], keyword: string): number {
  return sortAndFilterPapers(papers, 'citations', keyword, 'ALL', 0).length;
}

export function buildFieldOverview(): FieldOverviewResponse {
  const authorRegistry = getCompleteAuthorRegistry();
  const totalPapers = TOPICS.reduce((acc, t) => acc + t.paperCount, 0);
  const indexedPapers = RAW_PAPERS.length;
  const totalCitations = TOPICS.reduce((acc, t) => acc + t.totalCitations, 0);
  const totalAuthors = Object.keys(authorRegistry).length;

  return {
    topics: TOPICS,
    streamData: STREAM_DATA,
    correlations: TOPIC_CORRELATIONS,
    yearRange: [1990, 2024],
    totalPapers,
    indexedPapers,
    totalCitations,
    totalAuthors,
  };
}

/**
 * Computes a topic-specific H-index from a list of citation counts for papers within that topic.
 */
export function computeTopicHIndex(citationCounts: number[]): number {
  const sorted = [...citationCounts].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) {
      h = i + 1;
    } else {
      break;
    }
  }
  return h;
}

export function buildTopicDetail(
  topicId: string,
  sortBy: PaperSortKey = 'citations'
): TopicDetailResponse {
  const authorRegistry = getCompleteAuthorRegistry();
  const topic = getTopicById(topicId);

  // Papers classified in this topic (primaryTopicId === topic.id)
  // This ensures 100% consistency between the topic's classified paper count, the Topic Literature Ranking, and the Citation Network.
  const matchingRaw = RAW_PAPERS.filter((r) => r.primaryTopicId === topic.id);
  const summaries = matchingRaw.map((r) => toPaperSummary(r, topic.id));
  const sortedPapers = sortAndFilterPapers(summaries, sortBy);

  // Top 6 Seminal Papers specific to this topic (highest composite citation impact & topic fit >= 40%)
  const highFitPool = summaries.filter((p) => p.relevanceScore >= 0.4);
  const seminalCandidates = highFitPool.length >= 3 ? highFitPool : summaries;
  const seminalPapers = [...seminalCandidates]
    .sort(
      (a, b) =>
        b.citationCount * (0.65 + 0.35 * b.relevanceScore) -
        a.citationCount * (0.65 + 0.35 * a.relevanceScore)
    )
    .slice(0, 6);

  // Leading Researchers in this Topic:
  // Include all papers where the researcher contributed to this topic (primaryTopicId === topic.id OR topicScores[topic.id] >= 0.20)
  // and rank by composite score so multi-paper contributors lead the subfield.
  const authorTopicMap = new Map<
    string,
    {
      author: AuthorBrief & {
        hIndex: number;
        visPaperCount?: number;
        visCitations?: number;
        primaryTopicId: string;
      };
      topicPaperCites: number[];
      indexedTopicCitations: number;
    }
  >();

  const topicContributorPool = RAW_PAPERS.filter(
    (r) => r.primaryTopicId === topic.id || (r.topicScores[topic.id] ?? 0) >= 0.2
  ).map((r) => toPaperSummary(r, topic.id));

  for (const paper of topicContributorPool) {
    for (const a of paper.authors) {
      const reg = authorRegistry[a.id];
      const existing = authorTopicMap.get(a.id);
      if (existing) {
        existing.topicPaperCites.push(paper.citationCount);
        existing.indexedTopicCitations += paper.citationCount;
      } else {
        authorTopicMap.set(a.id, {
          author: {
            id: a.id,
            name: cleanAuthorDisplayName(a.rawName || a.name),
            rawName: a.rawName || a.name,
            affiliation: a.affiliation,
            hIndex: reg ? reg.hIndex : 25,
            visPaperCount: reg?.visPaperCount,
            visCitations: reg?.visCitations,
            primaryTopicId: reg ? reg.primaryTopicId : topic.id,
          },
          topicPaperCites: [paper.citationCount],
          indexedTopicCitations: paper.citationCount,
        });
      }
    }
  }

  const leadingAuthors: TopicAuthorSummary[] = Array.from(authorTopicMap.values())
    .map((entry) => {
      const indexedTopicPaperCount = entry.topicPaperCites.length;
      const totalAuthorIndexed = Math.max(
        1,
        RAW_PAPERS.filter((r) => r.authorIds.includes(entry.author.id)).length
      );
      const authorCareerVisPapers = Math.max(
        entry.author.visPaperCount ?? totalAuthorIndexed,
        totalAuthorIndexed
      );
      const isPrimarySubfield = entry.author.primaryTopicId === topic.id;
      const subfieldShare = Math.min(
        0.78,
        Math.max(
          isPrimarySubfield ? 0.45 : 0.22,
          indexedTopicPaperCount / totalAuthorIndexed
        )
      );
      const topicPaperCount = Math.max(
        indexedTopicPaperCount,
        Math.round(authorCareerVisPapers * subfieldShare)
      );
      const authorCareerVisCites = Math.max(
        entry.author.visCitations ?? entry.indexedTopicCitations,
        entry.indexedTopicCitations
      );
      const topicCitations = Math.max(
        entry.indexedTopicCitations,
        Math.round(authorCareerVisCites * subfieldShare)
      );

      const topicHIndex = computeTopicHIndex(entry.topicPaperCites);
      // Composite score: strongly rewards sustained contribution in the subfield (indexed landmarks + career subfield output),
      // while dampening single-paper citation spikes via log/sqrt scaling.
      const meetsMultiPaperCriteria = indexedTopicPaperCount >= 3 || topicHIndex >= 2;
      const compositeScore =
        (meetsMultiPaperCriteria ? 10000 : 0) +
        (indexedTopicPaperCount >= 3 ? 5000 : 0) +
        topicHIndex * 1800 +
        indexedTopicPaperCount * 950 +
        topicPaperCount * 35 +
        Math.sqrt(topicCitations) * 12;

      return {
        id: entry.author.id,
        name: entry.author.name,
        rawName: entry.author.rawName,
        affiliation: entry.author.affiliation,
        topicPaperCount,
        indexedTopicPaperCount,
        topicCitations,
        hIndex: entry.author.hIndex,
        topicHIndex,
        compositeScore,
      };
    })
    .sort(
      (a, b) =>
        b.compositeScore - a.compositeScore ||
        (b.indexedTopicPaperCount ?? 0) - (a.indexedTopicPaperCount ?? 0) ||
        b.topicPaperCount - a.topicPaperCount ||
        b.topicCitations - a.topicCitations
    )
    .slice(0, 6)
    .map(({ compositeScore: _unused, ...rest }) => rest);

  // Full Topic Network Topology:
  // 1. Include ALL papers classified in this topic (100% coverage of matchingRaw)
  const coreTopicRaw = matchingRaw;
  const coreIds = new Set(coreTopicRaw.map((r) => r.id));

  // 2. Pull in influential cross-topic papers directly linked by citation to/from core topic papers
  const crossTopicIds = new Set<string>();
  for (const corePaper of coreTopicRaw) {
    for (const refId of corePaper.references) {
      if (!coreIds.has(refId)) {
        crossTopicIds.add(refId);
      }
    }
  }
  for (const candidate of RAW_PAPERS) {
    if (!coreIds.has(candidate.id)) {
      if (candidate.references.some((refId) => coreIds.has(refId))) {
        crossTopicIds.add(candidate.id);
      }
    }
  }

  const networkRaw = [
    ...coreTopicRaw,
    ...RAW_PAPERS.filter((r) => crossTopicIds.has(r.id)),
  ];
  const nodeIdSet = new Set(networkRaw.map((r) => r.id));

  const nodes: CitationNode[] = networkRaw.map((raw) => {
    const summary = toPaperSummary(raw, topic.id);
    const isCrossTopic = !coreIds.has(raw.id) || raw.primaryTopicId !== topic.id;
    return {
      id: summary.id,
      title: summary.title,
      year: summary.year,
      venue: summary.venue,
      citationCount: summary.citationCount,
      relevanceScore: summary.relevanceScore,
      primaryTopicId: summary.primaryTopicId,
      authors: summary.authors.map((a) => a.name),
      isCrossTopic,
    };
  });

  const links: CitationLink[] = [];
  for (const raw of networkRaw) {
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
    seminalPapers,
    leadingAuthors,
    papers: sortedPapers,
    citationNetwork: { nodes, links },
    yearlyTrend,
  };
}

export function buildAuthorDetail(authorId: string): AuthorDetailResponse {
  const authorRegistry = getCompleteAuthorRegistry();
  const authorMeta = authorRegistry[authorId] || Object.values(authorRegistry)[0];
  const displayName = cleanAuthorDisplayName(authorMeta.rawName || authorMeta.name);

  const authoredRaw = RAW_PAPERS.filter((r) => r.authorIds.includes(authorMeta.id));
  const papers = sortAndFilterPapers(
    authoredRaw.map((r) => toPaperSummary(r)),
    'citations'
  );

  // Build yearly career series from activeStartYear to activeEndYear grounded strictly in actual publications per year
  const paperYears = authoredRaw.map((p) => p.year);
  const startYr =
    paperYears.length > 0
      ? Math.min(authorMeta.activeStartYear, ...paperYears)
      : authorMeta.activeStartYear;
  const endYr =
    paperYears.length > 0
      ? Math.max(authorMeta.activeEndYear, ...paperYears)
      : authorMeta.activeEndYear;

  const yearlyStats: AuthorYearlyStat[] = [];
  const topicCumulative: Record<string, number> = {};
  const topicPaperCounts: Record<string, number> = {};

  for (let yr = startYr; yr <= endYr; yr++) {
    const exactPapers = authoredRaw
      .filter((p) => p.year === yr)
      .sort((a, b) => b.citationCount - a.citationCount);

    const paperCount = exactPapers.length;
    const citationSum = exactPapers.reduce((acc, p) => acc + p.citationCount, 0);

    const topicBreakdown: Record<string, number> = {};
    if (paperCount > 0) {
      for (const p of exactPapers) {
        for (const [tid, score] of Object.entries(p.topicScores)) {
          const val = Number(score.toFixed(2));
          topicBreakdown[tid] = Number(((topicBreakdown[tid] || 0) + val).toFixed(2));
        }
      }
    }

    for (const [tid, w] of Object.entries(topicBreakdown)) {
      topicCumulative[tid] = (topicCumulative[tid] || 0) + w;
      if (w >= 0.25) {
        topicPaperCounts[tid] = (topicPaperCounts[tid] || 0) + 1;
      }
    }

    const yearPapers = exactPapers.map((ep) => ({
      id: ep.id,
      title: ep.title,
      year: ep.year,
      venue: ep.venue,
      citationCount: ep.citationCount,
    }));

    // Strictly pick the highest-cited paper actually published in this specific year (or null if 0 publications)
    const standoutPaper = yearPapers.length > 0 ? yearPapers[0] : null;

    yearlyStats.push({
      year: yr,
      paperCount,
      citationSum,
      topicBreakdown,
      standoutPaper,
      yearPapers,
    });
  }

  const indexedPapers = authoredRaw.length;
  const indexedCitations = authoredRaw.reduce((acc, p) => acc + p.citationCount, 0);
  const totalPapers = Math.max(authorMeta.visPaperCount ?? indexedPapers, indexedPapers);
  const totalCitations = Math.max(authorMeta.visCitations ?? indexedCitations, indexedCitations);

  const totalTopicWeight = Object.values(topicCumulative).reduce((a, b) => a + b, 0) || 1;
  const topicDistribution: AuthorTopicShare[] = Object.entries(topicCumulative)
    .map(([tid, weight]) => {
      const t = getTopicById(tid);
      const share = Number((weight / totalTopicWeight).toFixed(3));
      const indexedCnt = topicPaperCounts[tid] || 1;
      const estimatedTopicPapers = Math.max(indexedCnt, Math.round(share * totalPapers));
      return {
        topicId: tid,
        topicName: t.name,
        color: t.color,
        share,
        paperCount: estimatedTopicPapers,
        indexedPaperCount: indexedCnt,
      };
    })
    .sort((a, b) => b.share - a.share);

  // Co-authors strictly from shared papers (never assign unshared authors as collaborators)
  const coAuthorIds = new Set<string>();
  for (const p of authoredRaw) {
    for (const aid of p.authorIds) {
      if (aid !== authorMeta.id) coAuthorIds.add(aid);
    }
  }

  const coAuthors: AuthorBrief[] = Array.from(coAuthorIds)
    .map((id) => authorRegistry[id])
    .filter(Boolean)
    .map((a) => ({
      id: a.id,
      name: cleanAuthorDisplayName(a.rawName || a.name),
      rawName: a.rawName || a.name,
      affiliation: a.affiliation,
    }));

  return {
    id: authorMeta.id,
    name: displayName,
    affiliation: authorMeta.affiliation,
    totalPapers,
    indexedPapers,
    totalCitations,
    indexedCitations,
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
    abstract: summary.abstract,
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
    indexedPaperCount: number;
    totalCitations: number;
  }
> {
  const authorRegistry = getCompleteAuthorRegistry();
  return Object.values(authorRegistry)
    .map((a) => {
      const detail = buildAuthorDetail(a.id);
      const indexedPaperCount = detail.indexedPapers ?? detail.papers.length;
      const leadershipScore =
        (indexedPaperCount >= 4 ? 12000 : 0) +
        indexedPaperCount * 950 +
        detail.totalPapers * 150 +
        Math.sqrt(detail.totalCitations) * 45 +
        a.hIndex * 75;
      return {
        id: a.id,
        name: cleanAuthorDisplayName(a.rawName || a.name),
        rawName: a.rawName || a.name,
        affiliation: a.affiliation,
        hIndex: a.hIndex,
        primaryTopicId: a.primaryTopicId,
        paperCount: detail.totalPapers,
        indexedPaperCount,
        totalCitations: detail.totalCitations,
        leadershipScore,
      };
    })
    .sort(
      (a, b) =>
        b.leadershipScore - a.leadershipScore ||
        b.paperCount - a.paperCount ||
        b.totalCitations - a.totalCitations
    )
    .map(({ leadershipScore: _unused, ...rest }) => rest);
}

/**
 * Flexible author search supporting case-insensitive substring and token-reordered matching
 * (e.g. "Meng Xia", "Xia Meng", "xia", "Meng Xia 0002").
 */
export function filterAuthorsByQuery<
  T extends { name: string; rawName?: string; affiliation: string }
>(authors: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return authors;
  return authors.filter((a) =>
    matchesFlexibleQuery(`${a.name} ${a.rawName || ''} ${a.affiliation}`, q)
  );
}

export function listAllPapers(sortBy: PaperSortKey = 'citations'): PaperSummary[] {
  return sortAndFilterPapers(
    RAW_PAPERS.map((r) => toPaperSummary(r)),
    sortBy
  );
}
