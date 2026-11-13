import {
  AUTHORS,
  RAW_PAPERS,
  RawPaperRecord,
  registerCorpusResetListener,
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
  TopicCorrelationEdge,
  TopicDetailResponse,
  TopicScoreItem,
  TopicSummary,
} from '../types';

export type PaperSortKey = 'citations' | 'relevance' | 'year';

export type AuthorRegistryEntry = AuthorBrief & {
  hIndex: number;
  visPaperCount?: number;
  visCitations?: number;
  primaryTopicId: string;
  activeStartYear: number;
  activeEndYear: number;
};

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
 * Normalizes a raw author name to an ASCII-safe kebab-case identifier while keeping
 * trailing DBLP disambiguation digits intact (e.g., "Fernanda B. Viégas" -> "fernanda-b-viegas").
 */
export function slugifyAuthorName(rawName: string): string {
  const ascii = (rawName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'anonymous-vis-researcher';
}

const NULL_PLACEHOLDERS = new Set(['', 'na', 'n/a', 'none', 'null', 'nan', '-']);

/**
 * Normalizes a DOI to trimmed lowercase and recovers upstream `0.1109/` prefix typos
 * to `10.1109/` for reliable case-insensitive reference linking.
 */
export function normalizeDoi(rawDoi?: string | null): string {
  if (!rawDoi) return '';
  const cleaned = rawDoi.trim().toLowerCase();
  return NULL_PLACEHOLDERS.has(cleaned)
    ? ''
    : cleaned.replace(/^0\.1109\//, '10.1109/');
}

/**
 * Splits semicolon- or comma-delimited Vispubdata metadata strings cleanly while filtering null placeholders.
 */
export function splitDelimitedField(raw?: string | null, delimiters: RegExp = /[;,]/): string[] {
  if (!raw) return [];
  return raw
    .split(delimiters)
    .map((item) => item.trim())
    .filter((item) => !NULL_PLACEHOLDERS.has(item.toLowerCase()));
}

/**
 * Parses a nullable citation field cleanly, preferring CitationCount_CrossRef and falling back
 * to AminerCitationCount when CrossRef is null/NA/missing.
 */
export function parseNullableCitationCount(
  crossRefVal: unknown,
  aminerVal: unknown
): number {
  const parseSingle = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
      return Number.isFinite(v) ? Math.max(0, Math.round(v)) : null;
    }
    const s = String(v).trim();
    if (NULL_PLACEHOLDERS.has(s.toLowerCase())) return null;
    const num = Number(s);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : null;
  };

  const crossRef = parseSingle(crossRefVal);
  if (crossRef !== null) return crossRef;
  const aminer = parseSingle(aminerVal);
  if (aminer !== null) return aminer;
  return 0;
}

/**
 * Parses raw Vispubdata CSV text without dropping records that have null/missing
 * AuthorKeywords, Abstract, InternalReferences, CitationCount_CrossRef, or AminerCitationCount.
 * Handles RFC-4180 quoted CSV fields, case-insensitive DOIs, and `[;,]` delimiters.
 */
export function parseVispubdataCsv(csvText: string): RawPaperRecord[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && csvText[i + 1] === '\n') i += 1;
      currentRow.push(currentField);
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((cell) => cell.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  const colIdx = (name: string) => header.indexOf(name);

  const idxYear = colIdx('Year');
  const idxTitle = colIdx('Title');
  const idxAbstract = colIdx('Abstract');
  const idxDoi = colIdx('DOI');
  const idxConf = colIdx('Conference');
  const idxCrossRef = colIdx('CitationCount_CrossRef');
  const idxAminer = colIdx('AminerCitationCount');
  const idxAuthorsDedup = colIdx('AuthorNames-Deduped');
  const idxAuthorsRaw = colIdx('AuthorNames');
  const idxKeywords = colIdx('AuthorKeywords');
  const idxRefs = colIdx('InternalReferences');

  const records: RawPaperRecord[] = [];
  const seenIds = new Map<string, number>();

  for (let rIdx = 1; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    const get = (idx: number) => (idx >= 0 && idx < r.length ? r[idx] : '');

    const rawYear = parseInt(String(get(idxYear)).trim(), 10);
    const year = Number.isFinite(rawYear) && rawYear >= 1985 && rawYear <= 2030 ? rawYear : 2015;

    const rawTitle = get(idxTitle).trim();
    const title =
      rawTitle && !NULL_PLACEHOLDERS.has(rawTitle.toLowerCase())
        ? rawTitle
        : `Untitled IEEE VIS Paper (${year} #${rIdx})`;

    const rawAbstract = get(idxAbstract).trim();
    const abstract =
      rawAbstract && !NULL_PLACEHOLDERS.has(rawAbstract.toLowerCase()) ? rawAbstract : title;

    const doi = normalizeDoi(get(idxDoi));
    const baseId = doi || `vis-${year}-${rIdx}`;
    const prevSeen = seenIds.get(baseId) ?? -1;
    seenIds.set(baseId, prevSeen + 1);
    const id = prevSeen >= 0 ? `${baseId}#${prevSeen + 1}` : baseId;

    const rawVenue = get(idxConf).trim();
    const venue: RawPaperRecord['venue'] =
      rawVenue === 'IEEE InfoVis' ||
      rawVenue === 'IEEE VAST' ||
      rawVenue === 'IEEE SciVis' ||
      rawVenue === 'IEEE VIS'
        ? rawVenue
        : rawVenue.toLowerCase().includes('infovis')
        ? 'IEEE InfoVis'
        : rawVenue.toLowerCase().includes('vast')
        ? 'IEEE VAST'
        : rawVenue.toLowerCase().includes('scivis')
        ? 'IEEE SciVis'
        : 'IEEE VIS';

    const citationCount = parseNullableCitationCount(get(idxCrossRef), get(idxAminer));

    const authorsRaw = splitDelimitedField(get(idxAuthorsDedup) || get(idxAuthorsRaw), /;/);
    const authorIds =
      authorsRaw.length > 0
        ? authorsRaw.map((a) => slugifyAuthorName(a))
        : ['anonymous-vis-researcher'];

    const keywordsRaw = splitDelimitedField(get(idxKeywords), /[;,]/);
    const keywords =
      keywordsRaw.length > 0
        ? keywordsRaw
        : title
            .replace(/[^a-zA-Z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 4)
            .slice(0, 6)
            .map((w) => w.toLowerCase());

    const references = splitDelimitedField(get(idxRefs), /[;,]/).map((ref) => normalizeDoi(ref)).filter(Boolean);

    // Lightweight anchor keyword match so parsed CSV records always receive a full 8-topic probability vector
    const haystack = `${title} ${abstract} ${keywords.join(' ')}`.toLowerCase();
    const rawTopicScores: Record<string, number> = {};
    let totalScore = 0;
    for (const t of TOPICS) {
      let score = 0.05;
      for (const kw of t.topKeywords) {
        if (haystack.includes(kw.term.split(' ')[0])) {
          score += kw.weight * 4;
        }
      }
      rawTopicScores[t.id] = score;
      totalScore += score;
    }
    const topicScores: Record<string, number> = {};
    let primaryTopicId = 'topic-5';
    let bestScore = -1;
    for (const t of TOPICS) {
      const norm = Number(((rawTopicScores[t.id] ?? 0.05) / (totalScore || 1)).toFixed(4));
      topicScores[t.id] = norm;
      if (norm > bestScore) {
        bestScore = norm;
        primaryTopicId = t.id;
      }
    }

    records.push({
      id,
      title,
      year,
      venue,
      doi: doi || id,
      citationCount,
      primaryTopicId,
      topicScores,
      authorIds,
      keywords,
      abstract,
      references,
    });
  }

  return records;
}

/**
 * Computes normalized cosine similarity [0, 1] between two topic distribution vectors.
 */
export function computeTopicVectorCosineSimilarity(
  vecA: Record<string, number>,
  vecB: Record<string, number>
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const val of Object.values(vecA)) {
    normA += val * val;
  }
  for (const val of Object.values(vecB)) {
    normB += val * val;
  }
  if (normA <= 0 || normB <= 0) return 0;

  for (const [tid, s1] of Object.entries(vecA)) {
    const s2 = vecB[tid] ?? 0;
    dot += s1 * s2;
  }

  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
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

/* ============================================================================
 * CACHED FULL-CORPUS INDEX (ALL 4,008 PAPERS IN O(1)/O(N))
 * ========================================================================== */

interface CorpusIndex {
  authorRegistry: Record<string, AuthorRegistryEntry>;
  papersById: Map<string, RawPaperRecord>;
  papersByTopic: Map<string, RawPaperRecord[]>;
  papersByAuthor: Map<string, RawPaperRecord[]>;
  citedByMap: Map<string, RawPaperRecord[]>;
}

let cachedCorpusIndex: CorpusIndex | null = null;

registerCorpusResetListener(() => {
  cachedCorpusIndex = null;
});

function getCorpusIndex(): CorpusIndex {
  if (cachedCorpusIndex) return cachedCorpusIndex;

  const papersById = new Map<string, RawPaperRecord>();
  const papersByTopic = new Map<string, RawPaperRecord[]>();
  const papersByAuthor = new Map<string, RawPaperRecord[]>();
  const citedByMap = new Map<string, RawPaperRecord[]>();

  for (const t of TOPICS) {
    papersByTopic.set(t.id, []);
  }

  for (const p of RAW_PAPERS) {
    papersById.set(p.id, p);
    const tList = papersByTopic.get(p.primaryTopicId);
    if (tList) tList.push(p);
    else papersByTopic.set(p.primaryTopicId, [p]);

    for (const aid of p.authorIds) {
      const aList = papersByAuthor.get(aid);
      if (aList) aList.push(p);
      else papersByAuthor.set(aid, [p]);
    }
  }

  for (const p of RAW_PAPERS) {
    for (const refId of p.references) {
      if (refId === p.id) continue;
      const list = citedByMap.get(refId);
      if (list) list.push(p);
      else citedByMap.set(refId, [p]);
    }
  }

  const authorRegistry: Record<string, AuthorRegistryEntry> = {};

  for (const [id, meta] of Object.entries(AUTHORS)) {
    const authored = papersByAuthor.get(id) ?? [];
    const rawName = meta.rawName || meta.name;
    const cites = authored.map((p) => p.citationCount);
    const years = authored.map((p) => p.year);
    const actualPaperCount = authored.length;
    const actualCitations = cites.reduce((a, b) => a + b, 0);

    authorRegistry[id] = {
      ...meta,
      name: cleanAuthorDisplayName(rawName),
      rawName,
      visPaperCount: actualPaperCount,
      visCitations: actualCitations,
      hIndex: authored.length > 0 ? Math.max(meta.hIndex, computeTopicHIndex(cites)) : meta.hIndex,
      activeStartYear: years.length > 0 ? Math.min(meta.activeStartYear, ...years) : meta.activeStartYear,
      activeEndYear: years.length > 0 ? Math.max(meta.activeEndYear, ...years) : meta.activeEndYear,
    };
  }

  for (const [aid, authored] of papersByAuthor.entries()) {
    if (authorRegistry[aid]) continue;
    const rawFromId = aid
      .split('-')
      .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(' ');
    const citationCounts = authored.map((p) => p.citationCount);
    const totalCites = citationCounts.reduce((acc, c) => acc + c, 0);
    const years = authored.map((p) => p.year);

    const topicWeights: Record<string, number> = {};
    for (const p of authored) {
      for (const [tid, score] of Object.entries(p.topicScores)) {
        topicWeights[tid] = (topicWeights[tid] || 0) + score;
      }
    }
    const dominantTopicId =
      Object.entries(topicWeights).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      authored[0].primaryTopicId;

    authorRegistry[aid] = {
      id: aid,
      name: cleanAuthorDisplayName(rawFromId),
      rawName: rawFromId,
      affiliation: 'IEEE VIS Research Community',
      hIndex: computeTopicHIndex(citationCounts),
      visPaperCount: authored.length,
      visCitations: totalCites,
      primaryTopicId: dominantTopicId,
      activeStartYear: Math.min(...years),
      activeEndYear: Math.max(...years),
    };
  }

  cachedCorpusIndex = {
    authorRegistry,
    papersById,
    papersByTopic,
    papersByAuthor,
    citedByMap,
  };
  return cachedCorpusIndex;
}

/**
 * Builds a complete map of all authors across AUTHORS and all 4,008 RAW_PAPERS so no author is ever omitted.
 */
function getCompleteAuthorRegistry(): Record<string, AuthorRegistryEntry> {
  return getCorpusIndex().authorRegistry;
}

/**
 * Converts a raw paper record into a normalized PaperSummary.
 * When `topicIdForRelevance` is specified, strictly returns the paper's score for that
 * requested topic (defaulting to 0 if unlisted) instead of leaking its primary topic score.
 * Gracefully falls back to the paper title if abstract or keywords are empty/null.
 */
export function toPaperSummary(rec: RawPaperRecord, topicIdForRelevance?: string): PaperSummary {
  const { authorRegistry } = getCorpusIndex();
  const relevanceScore = topicIdForRelevance
    ? (rec.topicScores[topicIdForRelevance] ?? 0)
    : (rec.topicScores[rec.primaryTopicId] ?? 0);

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
    rawAbstract && !NULL_PLACEHOLDERS.has(rawAbstract.toLowerCase())
      ? rawAbstract
      : rec.title;

  const validKeywords = (rec.keywords || []).filter(
    (k) => k && k.trim() && !NULL_PLACEHOLDERS.has(k.trim().toLowerCase())
  );
  const safeKeywords =
    validKeywords.length > 0
      ? validKeywords
      : rec.title
          .replace(/[^a-zA-Z0-9\s-]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 4)
          .slice(0, 6)
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
  const { authorRegistry } = getCorpusIndex();
  const totalPapers = RAW_PAPERS.length;
  const indexedPapers = RAW_PAPERS.length;
  const totalCitations = RAW_PAPERS.reduce((acc, p) => acc + p.citationCount, 0);
  const totalAuthors = Object.keys(authorRegistry).length;
  const minYear = STREAM_DATA[0]?.year ?? 1990;
  const maxYear = STREAM_DATA[STREAM_DATA.length - 1]?.year ?? 2025;

  return {
    topics: TOPICS,
    streamData: STREAM_DATA,
    correlations: TOPIC_CORRELATIONS,
    yearRange: [minYear, maxYear],
    totalPapers,
    indexedPapers,
    totalCitations,
    totalAuthors,
  };
}

export interface TopicDetailOptions {
  /** Explicit optional limit for the featured seminal starting-points card (null = all) */
  seminalLimit?: number | null;
  /** Explicit optional limit for leading researchers (null = return 100% of matching researchers) */
  authorLimit?: number | null;
}

export function buildTopicDetail(
  topicId: string,
  sortBy: PaperSortKey = 'citations',
  options: TopicDetailOptions = {}
): TopicDetailResponse {
  const { authorRegistry, papersByTopic, papersByAuthor, citedByMap } = getCorpusIndex();
  const topic = getTopicById(topicId);
  const { seminalLimit = 6, authorLimit = null } = options;

  // ALL papers classified in this topic across the complete 4,008-paper corpus (no landmark cap)
  const matchingRaw = papersByTopic.get(topic.id) ?? [];
  const summaries = matchingRaw.map((r) => toPaperSummary(r, topic.id));
  const sortedPapers = sortAndFilterPapers(summaries, sortBy);

  // Featured / Seminal Papers for this topic across the full subfield corpus
  const rankedSeminal = [...summaries].sort(
    (a, b) =>
      b.citationCount * (0.65 + 0.35 * b.relevanceScore) -
      a.citationCount * (0.65 + 0.35 * a.relevanceScore)
  );
  const seminalPapers =
    seminalLimit !== null && seminalLimit > 0
      ? rankedSeminal.slice(0, seminalLimit)
      : rankedSeminal;

  // Leading Researchers computed strictly from actual papers in all 4,008 corpus records (zero synthetic estimates)
  const authorTopicMap = new Map<
    string,
    {
      author: AuthorRegistryEntry;
      topicPaperCites: number[];
      topicCitations: number;
    }
  >();

  const topicContributorPool = RAW_PAPERS.filter(
    (r) => r.primaryTopicId === topic.id || (r.topicScores[topic.id] ?? 0) >= 0.2
  );

  for (const paper of topicContributorPool) {
    for (const aid of paper.authorIds) {
      const reg = authorRegistry[aid];
      if (!reg) continue;
      const existing = authorTopicMap.get(aid);
      if (existing) {
        existing.topicPaperCites.push(paper.citationCount);
        existing.topicCitations += paper.citationCount;
      } else {
        authorTopicMap.set(aid, {
          author: reg,
          topicPaperCites: [paper.citationCount],
          topicCitations: paper.citationCount,
        });
      }
    }
  }

  const rankedAuthorsAll: TopicAuthorSummary[] = Array.from(authorTopicMap.values())
    .map((entry) => {
      const topicPaperCount = entry.topicPaperCites.length;
      const topicHIndex = computeTopicHIndex(entry.topicPaperCites);
      const authorTotalPapers = (papersByAuthor.get(entry.author.id) ?? []).length;
      const meetsMultiPaperCriteria = topicPaperCount >= 3 || topicHIndex >= 2;
      const compositeScore =
        (meetsMultiPaperCriteria ? 10000 : 0) +
        (topicPaperCount >= 5 ? 4000 : 0) +
        topicHIndex * 1800 +
        topicPaperCount * 650 +
        Math.min(authorTotalPapers, 120) * 15 +
        Math.sqrt(entry.topicCitations) * 12;

      return {
        id: entry.author.id,
        name: entry.author.name,
        rawName: entry.author.rawName,
        affiliation: entry.author.affiliation,
        topicPaperCount,
        indexedTopicPaperCount: topicPaperCount,
        topicCitations: entry.topicCitations,
        hIndex: entry.author.hIndex,
        topicHIndex,
        compositeScore,
      };
    })
    .sort(
      (a, b) =>
        b.compositeScore - a.compositeScore ||
        b.topicPaperCount - a.topicPaperCount ||
        b.topicCitations - a.topicCitations
    )
    .map(({ compositeScore: _unused, ...rest }) => rest);

  const leadingAuthors =
    authorLimit !== null && authorLimit > 0
      ? rankedAuthorsAll.slice(0, authorLimit)
      : rankedAuthorsAll;

  // Full Topic Network Topology:
  // 1. Include 100% of papers classified in this topic (`matchingRaw`)
  const coreTopicRaw = matchingRaw;
  const coreIds = new Set(coreTopicRaw.map((r) => r.id));

  // 2. Pull in cross-topic papers directly linked by citation to/from core topic papers
  const crossTopicIds = new Set<string>();
  const { papersById } = getCorpusIndex();
  for (const corePaper of coreTopicRaw) {
    for (const refId of corePaper.references) {
      if (!coreIds.has(refId) && papersById.has(refId)) {
        crossTopicIds.add(refId);
      }
    }
    const citers = citedByMap.get(corePaper.id) ?? [];
    for (const citer of citers) {
      if (!coreIds.has(citer.id)) {
        crossTopicIds.add(citer.id);
      }
    }
  }

  const networkRaw = [
    ...coreTopicRaw,
    ...Array.from(crossTopicIds)
      .map((id) => papersById.get(id))
      .filter((r): r is RawPaperRecord => Boolean(r)),
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
  const { authorRegistry, papersByAuthor } = getCorpusIndex();
  const authorMeta = authorRegistry[authorId] || Object.values(authorRegistry)[0];
  const displayName = cleanAuthorDisplayName(authorMeta.rawName || authorMeta.name);

  // Strictly all papers authored in the full 4,008-paper corpus
  const authoredRaw = papersByAuthor.get(authorMeta.id) ?? [];
  const papers = sortAndFilterPapers(
    authoredRaw.map((r) => toPaperSummary(r)),
    'citations'
  );

  // Build yearly career series across active window grounded strictly in actual publications per year
  const paperYears = authoredRaw.map((p) => p.year);
  const startYr =
    paperYears.length > 0
      ? Math.min(authorMeta.activeStartYear, ...paperYears)
      : authorMeta.activeStartYear;
  const endYr =
    paperYears.length > 0
      ? Math.max(authorMeta.activeEndYear, ...paperYears)
      : authorMeta.activeEndYear;

  const papersByYear = new Map<number, RawPaperRecord[]>();
  for (const p of authoredRaw) {
    const arr = papersByYear.get(p.year);
    if (arr) arr.push(p);
    else papersByYear.set(p.year, [p]);
  }

  const yearlyStats: AuthorYearlyStat[] = [];
  const topicCumulative: Record<string, number> = {};
  const topicPaperCounts: Record<string, number> = {};

  for (let yr = startYr; yr <= endYr; yr++) {
    const exactPapers = [...(papersByYear.get(yr) ?? [])].sort(
      (a, b) => b.citationCount - a.citationCount
    );

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
    }

    const yearPapers = exactPapers.map((ep) => ({
      id: ep.id,
      title: ep.title,
      year: ep.year,
      venue: ep.venue,
      citationCount: ep.citationCount,
    }));

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

  // Count actual authored papers contributing to each topic (primary topic OR relevance >= 0.18)
  for (const p of authoredRaw) {
    const matchedTopics = new Set<string>([p.primaryTopicId]);
    for (const [tid, score] of Object.entries(p.topicScores)) {
      if (score >= 0.18) {
        matchedTopics.add(tid);
      }
    }
    for (const tid of matchedTopics) {
      topicPaperCounts[tid] = (topicPaperCounts[tid] || 0) + 1;
    }
  }

  const totalPapers = authoredRaw.length;
  const totalCitations = authoredRaw.reduce((acc, p) => acc + p.citationCount, 0);

  const totalTopicWeight = Object.values(topicCumulative).reduce((a, b) => a + b, 0) || 1;
  const topicDistribution: AuthorTopicShare[] = Object.entries(topicCumulative)
    .map(([tid, weight]) => {
      const t = getTopicById(tid);
      const share = Number((weight / totalTopicWeight).toFixed(3));
      const exactTopicPapers = topicPaperCounts[tid] ?? 0;
      return {
        topicId: tid,
        topicName: t.name,
        color: t.color,
        share,
        paperCount: exactTopicPapers,
        indexedPaperCount: exactTopicPapers,
      };
    })
    .sort((a, b) => b.share - a.share);

  // Co-authors strictly from shared papers across the full corpus (no arbitrary LIMIT)
  const coAuthorCounts = new Map<string, number>();
  for (const p of authoredRaw) {
    for (const aid of p.authorIds) {
      if (aid !== authorMeta.id) {
        coAuthorCounts.set(aid, (coAuthorCounts.get(aid) ?? 0) + 1);
      }
    }
  }

  const coAuthors: AuthorBrief[] = Array.from(coAuthorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => authorRegistry[id])
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
    indexedPapers: totalPapers,
    totalCitations,
    indexedCitations: totalCitations,
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

export interface PaperDetailOptions {
  /** Minimum topic-vector cosine similarity threshold for conceptual neighbors */
  minSimilarity?: number;
  /** Explicit optional limit (null = return 100% of matches meeting similarity threshold) */
  relatedLimit?: number | null;
}

export function buildPaperDetail(
  paperId: string,
  options: PaperDetailOptions = {}
): PaperDetailResponse {
  const { papersById, citedByMap } = getCorpusIndex();
  const raw = papersById.get(paperId) || RAW_PAPERS[0];
  const summary = toPaperSummary(raw);
  const { minSimilarity = 0.85, relatedLimit = null } = options;

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
    .map((refId) => papersById.get(refId))
    .filter((p): p is RawPaperRecord => Boolean(p))
    .map((p) => toPaperSummary(p));

  const citedByPapers = (citedByMap.get(raw.id) ?? []).map((p) => toPaperSummary(p));

  // Conceptual neighbors ranked by normalized cosine similarity across all 4,008 records (no hidden 5-paper slice!)
  const scoredCandidates = RAW_PAPERS.filter((p) => p.id !== raw.id)
    .map((candidate) => ({
      rec: candidate,
      sim: computeTopicVectorCosineSimilarity(raw.topicScores, candidate.topicScores),
    }))
    .sort((a, b) => b.sim - a.sim || b.rec.citationCount - a.rec.citationCount);

  const highSim = scoredCandidates.filter((c) => c.sim >= minSimilarity);
  const matchedRelated =
    highSim.length >= 12
      ? highSim
      : scoredCandidates.filter((c) => c.sim >= 0.65);

  const finalRelated =
    relatedLimit !== null && relatedLimit > 0
      ? matchedRelated.slice(0, relatedLimit)
      : matchedRelated;

  const relatedPapers = finalRelated.map((item) => toPaperSummary(item.rec));

  return {
    id: summary.id,
    title: summary.title,
    year: summary.year,
    venue: summary.venue,
    doi: summary.doi,
    url: raw.url || (summary.doi ? `https://doi.org/${summary.doi}` : ''),
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

export function getCorrelationEdge(
  topicA: string,
  topicB: string,
  correlations: TopicCorrelationEdge[] = TOPIC_CORRELATIONS
): TopicCorrelationEdge | null {
  return (
    correlations.find(
      (e) =>
        (e.sourceTopicId === topicA && e.targetTopicId === topicB) ||
        (e.sourceTopicId === topicB && e.targetTopicId === topicA)
    ) ?? null
  );
}

export function getCorrelationBetween(
  topicA: string,
  topicB: string,
  correlations: TopicCorrelationEdge[] = TOPIC_CORRELATIONS
): number {
  if (topicA === topicB) return 1.0;
  const edge = getCorrelationEdge(topicA, topicB, correlations);
  return edge ? edge.correlation : 0;
}

/**
 * Filters undirected correlation edges above the display threshold for the Topic Correlation Graph.
 */
export function getCorrelationGraphEdges(
  correlations: TopicCorrelationEdge[],
  minCorrelation = 0.2
): TopicCorrelationEdge[] {
  return correlations.filter(
    (e) => e.sourceTopicId < e.targetTopicId && e.correlation >= minCorrelation
  );
}

/* ============================================================================
 * PURE GRAPH TOPOLOGY & CANDIDATE BUILDERS (DECOUPLED FROM UI COMPONENTS)
 * ========================================================================== */

export interface CitationTopologyOptions {
  /** Explicit UI visual density threshold: hide nodes with <= this citation count */
  minCitations?: number;
  /** Explicit UI visual density limit on number of rendered nodes (null = 100% of nodes) */
  maxNodes?: number | null;
}

export interface CitationTopologyResult {
  fullActiveNodes: Array<CitationNode & { degree: number }>;
  fullActiveLinks: CitationLink[];
  modalDisplayNodes: Array<CitationNode & { degree: number }>;
  modalDisplayLinks: CitationLink[];
  subsetActiveNodes: Array<CitationNode & { degree: number }>;
  subsetActiveLinks: CitationLink[];
  standaloneCount: number;
  totalSubfieldCount: number;
  totalCrossTopicCount: number;
}

/**
 * Computes full-topic, optional UI-density-filtered modal, and core-backbone citation network sets,
 * keeping dataset totals 100% independent of visual density parameters.
 */
export function buildCitationNetworkTopology(
  nodes: CitationNode[],
  links: CitationLink[],
  activeTopicId: string,
  hideStandalone: boolean,
  inlineSubsetSize = 24,
  modalOptions: CitationTopologyOptions = {}
): CitationTopologyResult {
  const { minCitations = 0, maxNodes = null } = modalOptions;
  const validNodeIds = new Set(nodes.map((n) => n.id));
  const validLinks = links.filter(
    (l) => validNodeIds.has(l.source) && validNodeIds.has(l.target) && l.source !== l.target
  );

  const degreeMap = new Map<string, number>();
  for (const n of nodes) degreeMap.set(n.id, 0);
  for (const l of validLinks) {
    degreeMap.set(l.source, (degreeMap.get(l.source) ?? 0) + 1);
    degreeMap.set(l.target, (degreeMap.get(l.target) ?? 0) + 1);
  }

  const totalStandalone = nodes.filter((n) => (degreeMap.get(n.id) ?? 0) === 0).length;
  const subfieldNodesAll = nodes.filter(
    (n) => !n.isCrossTopic && n.primaryTopicId === activeTopicId
  );
  const crossNodesAll = nodes.filter(
    (n) => n.isCrossTopic || n.primaryTopicId !== activeTopicId
  );

  // 1. Full Graph Nodes (Filtered only by Hide Standalone toggle)
  const fullFilteredNodes = hideStandalone
    ? nodes.filter((n) => (degreeMap.get(n.id) ?? 0) > 0)
    : nodes;
  const fullKeptIds = new Set(fullFilteredNodes.map((n) => n.id));
  const fullFilteredLinks = validLinks.filter(
    (l) => fullKeptIds.has(l.source) && fullKeptIds.has(l.target)
  );

  // 2. Explicit UI Visual Density Projection for Full Network Modal (if user chooses a cap or min-citations threshold)
  let modalPool = fullFilteredNodes;
  if (minCitations > 0) {
    modalPool = modalPool.filter((n) => n.citationCount >= minCitations);
  }
  if (maxNodes !== null && maxNodes > 0 && modalPool.length > maxNodes) {
    modalPool = [...modalPool]
      .sort(
        (a, b) =>
          b.citationCount * (1 + 0.3 * (degreeMap.get(b.id) ?? 0)) -
          a.citationCount * (1 + 0.3 * (degreeMap.get(a.id) ?? 0))
      )
      .slice(0, maxNodes);
  }
  const modalKeptIds = new Set(modalPool.map((n) => n.id));
  const modalLinks = fullFilteredLinks.filter(
    (l) => modalKeptIds.has(l.source) && modalKeptIds.has(l.target)
  );

  // 3. Inline Backbone Preview ("Core Citation Backbone") for inline card clarity
  const connectedSubfield = [...subfieldNodesAll]
    .filter((n) => (degreeMap.get(n.id) ?? 0) > 0)
    .sort(
      (a, b) =>
        b.citationCount * (1 + 0.25 * (degreeMap.get(b.id) ?? 0)) -
        a.citationCount * (1 + 0.25 * (degreeMap.get(a.id) ?? 0))
    )
    .slice(0, 16);

  const standaloneSample = hideStandalone
    ? []
    : [...subfieldNodesAll]
        .filter((n) => (degreeMap.get(n.id) ?? 0) === 0)
        .sort((a, b) => b.citationCount - a.citationCount)
        .slice(0, 3);

  const coreSubfieldSet = new Set([
    ...connectedSubfield.map((n) => n.id),
    ...standaloneSample.map((n) => n.id),
  ]);

  const bridgeCrossNodes = [...crossNodesAll]
    .filter((cn) =>
      validLinks.some(
        (l) =>
          (l.source === cn.id && coreSubfieldSet.has(l.target)) ||
          (l.target === cn.id && coreSubfieldSet.has(l.source))
      )
    )
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(
      0,
      Math.max(4, inlineSubsetSize - connectedSubfield.length - standaloneSample.length)
    );

  const subsetNodeList = [...connectedSubfield, ...standaloneSample, ...bridgeCrossNodes];
  const subsetIdSet = new Set(subsetNodeList.map((n) => n.id));
  const subsetLinks = validLinks.filter(
    (l) => subsetIdSet.has(l.source) && subsetIdSet.has(l.target)
  );

  const subsetDegreeMap = new Map<string, number>();
  for (const n of subsetNodeList) subsetDegreeMap.set(n.id, 0);
  for (const l of subsetLinks) {
    subsetDegreeMap.set(l.source, (subsetDegreeMap.get(l.source) ?? 0) + 1);
    subsetDegreeMap.set(l.target, (subsetDegreeMap.get(l.target) ?? 0) + 1);
  }

  const finalSubsetNodes = hideStandalone
    ? subsetNodeList.filter((n) => (subsetDegreeMap.get(n.id) ?? 0) > 0)
    : subsetNodeList;
  const finalSubsetIds = new Set(finalSubsetNodes.map((n) => n.id));
  const finalSubsetLinks = subsetLinks.filter(
    (l) => finalSubsetIds.has(l.source) && finalSubsetIds.has(l.target)
  );

  return {
    fullActiveNodes: fullFilteredNodes.map((n) => ({
      ...n,
      degree: degreeMap.get(n.id) ?? 0,
    })),
    fullActiveLinks: fullFilteredLinks,
    modalDisplayNodes: modalPool.map((n) => ({
      ...n,
      degree: degreeMap.get(n.id) ?? 0,
    })),
    modalDisplayLinks: modalLinks,
    subsetActiveNodes: finalSubsetNodes.map((n) => ({
      ...n,
      degree: subsetDegreeMap.get(n.id) ?? 0,
    })),
    subsetActiveLinks: finalSubsetLinks,
    standaloneCount: totalStandalone,
    totalSubfieldCount: subfieldNodesAll.length,
    totalCrossTopicCount: crossNodesAll.length,
  };
}

export type EgoRelationFilter = 'all' | 'reference' | 'citedBy' | 'related';
export type EgoCandidateRel = Exclude<EgoRelationFilter, 'all'>;
export type EgoSectorLimitMode = 'compact' | 'expanded' | 'all';

export interface EgoCandidateItem {
  summary: PaperSummary;
  rel: EgoCandidateRel;
}

export interface EgoNetworkCandidatesResult {
  allUniqueCount: number;
  maxPerSector: number;
  refList: EgoCandidateItem[];
  citedByList: EgoCandidateItem[];
  relatedList: EgoCandidateItem[];
  allFilteredCandidates: EgoCandidateItem[];
  maxCitationCount: number;
}

/**
 * Builds deduplicated, sorted, and UI-density-controlled ego-network candidates for a focal paper.
 * Passing `sectorLimitMode = 'all'` removes all sector truncation caps and returns 100% of nodes.
 */
export function buildEgoNetworkCandidates(
  paper: PaperDetailResponse,
  relationFilter: EgoRelationFilter,
  selectionMetric: 'citations' | 'recent',
  sectorLimitMode: EgoSectorLimitMode
): EgoNetworkCandidatesResult {
  const maxPerSector =
    sectorLimitMode === 'all'
      ? Number.POSITIVE_INFINITY
      : sectorLimitMode === 'compact'
      ? relationFilter === 'all'
        ? 6
        : 10
      : relationFilter === 'all'
      ? 12
      : 20;

  // Deduplicated count across all 3 relationship types (references + citedBy + related)
  const uniqueAllIds = new Set<string>();
  for (const p of paper.referencesPapers) {
    if (p.id !== paper.id) uniqueAllIds.add(p.id);
  }
  for (const p of paper.citedByPapers) {
    if (p.id !== paper.id) uniqueAllIds.add(p.id);
  }
  for (const p of paper.relatedPapers) {
    if (p.id !== paper.id) uniqueAllIds.add(p.id);
  }

  const allCandidates: EgoCandidateItem[] = [];
  if (relationFilter === 'all' || relationFilter === 'reference') {
    for (const ref of paper.referencesPapers) {
      allCandidates.push({ summary: ref, rel: 'reference' });
    }
  }
  if (relationFilter === 'all' || relationFilter === 'citedBy') {
    for (const cb of paper.citedByPapers) {
      allCandidates.push({ summary: cb, rel: 'citedBy' });
    }
  }
  if (relationFilter === 'all' || relationFilter === 'related') {
    for (const relP of paper.relatedPapers) {
      allCandidates.push({ summary: relP, rel: 'related' });
    }
  }

  const compareCandidate = (a: EgoCandidateItem, b: EgoCandidateItem) => {
    if (selectionMetric === 'recent') {
      return (
        b.summary.year - a.summary.year ||
        b.summary.citationCount - a.summary.citationCount
      );
    }
    return (
      b.summary.citationCount - a.summary.citationCount ||
      b.summary.year - a.summary.year
    );
  };

  const applyCap = (arr: EgoCandidateItem[]) =>
    Number.isFinite(maxPerSector) ? arr.slice(0, maxPerSector) : arr;

  const refList = applyCap(allCandidates.filter((c) => c.rel === 'reference').sort(compareCandidate));
  const citedByList = applyCap(allCandidates.filter((c) => c.rel === 'citedBy').sort(compareCandidate));
  const relatedList = applyCap(allCandidates.filter((c) => c.rel === 'related').sort(compareCandidate));

  const seenIds = new Set<string>();
  const dedupedCandidates = allCandidates
    .filter((c) => {
      if (c.summary.id === paper.id || seenIds.has(c.summary.id)) return false;
      seenIds.add(c.summary.id);
      return true;
    })
    .sort(compareCandidate);

  const maxCitationCount =
    allCandidates.reduce((max, c) => Math.max(max, c.summary.citationCount), 0) ||
    paper.citationCount ||
    1000;

  return {
    allUniqueCount: uniqueAllIds.size,
    maxPerSector,
    refList,
    citedByList,
    relatedList,
    allFilteredCandidates: dedupedCandidates,
    maxCitationCount,
  };
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
  const { authorRegistry, papersByAuthor } = getCorpusIndex();
  return Object.values(authorRegistry)
    .map((a) => {
      const authored = papersByAuthor.get(a.id) ?? [];
      const paperCount = authored.length;
      const totalCitations = authored.reduce((acc, p) => acc + p.citationCount, 0);
      const leadershipScore =
        paperCount * 220 +
        Math.sqrt(totalCitations) * 45 +
        a.hIndex * 75;
      return {
        id: a.id,
        name: cleanAuthorDisplayName(a.rawName || a.name),
        rawName: a.rawName || a.name,
        affiliation: a.affiliation,
        hIndex: a.hIndex,
        primaryTopicId: a.primaryTopicId,
        paperCount,
        indexedPaperCount: paperCount,
        totalCitations,
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
