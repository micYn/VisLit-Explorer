import React, { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  AuthorDetailResponse,
  PaperDetailResponse,
  TopicDetailResponse,
  TopicSummary,
} from '../types';
import { CitationNetwork } from './CitationNetwork';
import { PaperEgoNetwork } from './PaperEgoNetwork';
import {
   filterAuthorsByQuery,
  getTopicById,
  listAllAuthors,
  PaperSortKey,
  sortAndFilterPapers,
} from '../utils/analyticsLogic';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  Filter,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react';

/* ============================================================================
 * TASK 2: TOPIC NETWORK TAB (TOPIC-LEVEL VIEW)
 * ========================================================================== */

interface TopicDetailViewProps {
  data: TopicDetailResponse;
  allTopics: TopicSummary[];
  onSelectTopic: (topicId: string) => void;
  onSelectPaper: (paperId: string) => void;
  onSelectAuthor: (authorId: string) => void;
  onBackToField: () => void;
}

export const TopicDetailView: React.FC<TopicDetailViewProps> = ({
  data,
  allTopics,
  onSelectTopic,
  onSelectPaper,
  onSelectAuthor,
  onBackToField,
}) => {
  const [sortBy, setSortBy] = useState<PaperSortKey>('citations');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [venueFilter, setVenueFilter] = useState<string>('ALL');
  const [minTopicFit, setMinTopicFit] = useState<number>(0);
  const [isAllPapersModalOpen, setIsAllPapersModalOpen] = useState<boolean>(false);

  // Reset keyword search when switching topics so stale filters don't hide papers
  useEffect(() => {
    setSearchQuery('');
  }, [data.topic.id]);

  const sortedPapers = useMemo(
    () =>
      sortAndFilterPapers(
        data.papers,
        sortBy,
        searchQuery,
        venueFilter,
        minTopicFit
      ),
    [data.papers, sortBy, searchQuery, venueFilter, minTopicFit]
  );

  // Mini D3 spark-area for the topic's 1990-2024 trajectory
  const sparkGeometry = useMemo(() => {
    const w = 260;
    const h = 64;
    const x = d3
      .scaleLinear()
      .domain(d3.extent(data.yearlyTrend, (d) => d.year) as [number, number])
      .range([4, w - 4]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data.yearlyTrend, (d) => d.prevalence) || 0.35])
      .range([h - 6, 6]);

    const area = d3
      .area<(typeof data.yearlyTrend)[number]>()
      .x((d) => x(d.year))
      .y0(h - 6)
      .y1((d) => y(d.prevalence))
      .curve(d3.curveMonotoneX);

    const line = d3
      .line<(typeof data.yearlyTrend)[number]>()
      .x((d) => x(d.year))
      .y((d) => y(d.prevalence))
      .curve(d3.curveMonotoneX);

    return {
      w,
      h,
      areaPath: area(data.yearlyTrend) || '',
      linePath: line(data.yearlyTrend) || '',
    };
  }, [data.yearlyTrend]);

  return (
    <div className="space-y-6">
      {/* Top Subfield Selector & Back Navigation */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToField}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Field Overview
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-900">
              Select IEEE VIS Research Subfield
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Switch between the 8 core visualization research domains
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {allTopics.map((t) => {
            const active = t.id === data.topic.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTopic(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-Width Subfield Header Card (Key Research Themes & Keywords section removed) */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono-tabular text-slate-500">
                <span
                  className="w-3.5 h-3.5 rounded-xs shrink-0"
                  style={{ backgroundColor: data.topic.color }}
                />
                <span className="font-semibold text-slate-800">
                  IEEE VIS Research Domain
                </span>
                <span>·</span>
                <span>Peak Activity {data.topic.peakYear}</span>
                <span>·</span>
                <span
                  className={
                    data.topic.growthRate >= 0
                      ? 'text-emerald-700 font-medium'
                      : 'text-amber-700 font-medium'
                  }
                >
                  {data.topic.growthRate >= 0
                    ? `+${data.topic.growthRate}% recent 5-yr growth`
                    : `${data.topic.growthRate}% mature trend`}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {data.topic.name}
              </h1>
              <button
                type="button"
                onClick={() => setIsAllPapersModalOpen(true)}
                data-testid="view-all-papers-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-900 hover:text-white border border-slate-200 rounded-lg transition-colors shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  View Indexed Landmark Papers ({sortedPapers.length} of {data.topic.paperCount.toLocaleString()} Subfield Papers)
                </span>
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              {data.topic.description}
            </p>
          </div>

          <div className="lg:col-span-4 grid grid-cols-3 gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 items-end">
            <div>
              <div className="text-xs text-slate-500">Subfield Papers (1990–2024)</div>
              <div className="text-2xl font-mono-tabular font-bold text-slate-900">
                {data.topic.paperCount.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                {data.papers.length} indexed landmarks
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Citations</div>
              <div className="text-2xl font-mono-tabular font-bold text-slate-900">
                {data.topic.totalCitations.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                CrossRef 35-yr sum
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular mb-1">
                <span>1990</span>
                <span>Share</span>
                <span>2024</span>
              </div>
              <svg
                viewBox={`0 0 ${sparkGeometry.w} ${sparkGeometry.h}`}
                preserveAspectRatio="none"
                className="w-full h-12 bg-slate-50 rounded border border-slate-100"
              >
                <path
                  d={sparkGeometry.areaPath}
                  fill={data.topic.color}
                  fillOpacity={0.22}
                />
                <path
                  d={sparkGeometry.linePath}
                  fill="none"
                  stroke={data.topic.color}
                  strokeWidth={2}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontally & Vertically Aligned Featured / Seminal Papers + Leading Researchers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: ⭐ Featured / Seminal Papers for this Topic (Stretched to match Leading Researchers height) */}
        <div
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 h-full flex flex-col justify-between"
          data-testid="seminal-papers-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                <span>Featured / Seminal Papers in {data.topic.shortName}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                High-impact foundational papers recommended as starting points for newcomers to this subfield
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              Top {data.seminalPapers.length} Starting Points
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1 content-between">
            {data.seminalPapers.map((semPaper, sIdx) => (
              <div
                key={semPaper.id}
                className="border border-slate-200 hover:border-slate-300 bg-slate-50/60 rounded-lg p-3.5 flex flex-col justify-between transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-500 mb-1">
                    <span className="font-semibold text-amber-700">
                      Seminal #{sIdx + 1} · {semPaper.year}
                    </span>
                    <span>
                      {semPaper.citationCount.toLocaleString()} cites ·{' '}
                      {Math.round(semPaper.relevanceScore * 100)}% fit
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPaper(semPaper.id)}
                    className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 font-serif-scholarly leading-snug line-clamp-2 block"
                  >
                    {semPaper.title}
                  </button>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600 truncate">
                    {semPaper.authors.map((a) => a.name).join(', ')}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPaper(semPaper.id)}
                    className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:text-blue-900 shrink-0"
                  >
                    Read
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: Leading Researchers in this Topic */}
        <div
          className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 h-full flex flex-col justify-between"
          data-testid="leading-researchers-card"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Leading Researchers in this Topic</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Composite ranking weighting sustained output (≥3 topic papers or topic h-index) &amp; impact in {data.topic.shortName}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {data.leadingAuthors.map((leader, lIdx) => (
                <div
                  key={leader.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono-tabular font-semibold text-slate-400">
                        #{lIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectAuthor(leader.id)}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline text-left truncate"
                      >
                        {leader.name}
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 pl-6 truncate">
                      {leader.affiliation}
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono-tabular">
                    <div className="text-xs font-semibold text-slate-900">
                      {leader.topicPaperCount}{' '}
                      {leader.topicPaperCount === 1 ? 'paper' : 'papers'} · h-index{' '}
                      {leader.topicHIndex ?? 1}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {leader.topicCitations.toLocaleString()} topic cites
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>Click any researcher to inspect their career timeline.</span>
          </div>
        </div>
      </div>

      {/* Main Split: D3 Citation Network (Left 6 cols) + Ranked Paper List (Right 6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6">
          <CitationNetwork
            nodes={data.citationNetwork.nodes}
            links={data.citationNetwork.links}
            activeTopic={data.topic}
            onSelectPaper={onSelectPaper}
          />
        </div>

        {/* Right: Topic Literature Ranking with Topic Fit Relevance Threshold (Subset Preview) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    Topic Literature Ranking ({sortedPapers.length} Indexed Landmarks)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAllPapersModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-md transition-colors"
                  >
                    Expand Full Table
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing top {Math.min(4, sortedPapers.length)} of {sortedPapers.length} verified landmark papers (curated from {data.topic.paperCount.toLocaleString()} total VIS papers in {data.topic.shortName})
                </p>
              </div>

              {/* Sorting Controls: [ Most Cited | Highest Topic Fit | Newest ] */}
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'citations', label: 'Most Cited' },
                    { id: 'relevance', label: 'Highest Topic Fit' },
                    { id: 'year', label: 'Newest' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSortBy(tab.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      sortBy === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search, Venue Filter & Topic Fit Relevance Threshold Bar */}
            <div className="space-y-2.5 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter papers by title, abstract, author, or keyword..."
                    aria-label="Filter topic papers"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                {/* Topic Fit Relevance Threshold Control */}
                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <label
                    htmlFor="min-topic-fit-select"
                    className="text-xs font-medium text-slate-600 whitespace-nowrap"
                  >
                    Min Topic Fit:
                  </label>
                  <select
                    id="min-topic-fit-select"
                    aria-label="Minimum Topic Fit threshold"
                    value={String(minTopicFit)}
                    onChange={(e) => setMinTopicFit(Number(e.target.value))}
                    className="text-xs font-mono-tabular font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="0">All (≥8%)</option>
                    <option value="0.2">20%</option>
                    <option value="0.4">40%</option>
                    <option value="0.6">60%</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {['ALL', 'IEEE InfoVis', 'IEEE VAST', 'IEEE SciVis', 'IEEE VIS'].map(
                    (venue) => (
                      <button
                        key={venue}
                        type="button"
                        onClick={() => setVenueFilter(venue)}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          venueFilter === venue
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {venue === 'ALL' ? 'All Tracks' : venue.replace('IEEE ', '')}
                      </button>
                    )
                  )}
                </div>

                {(searchQuery || venueFilter !== 'ALL' || minTopicFit > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setVenueFilter('ALL');
                      setMinTopicFit(0);
                    }}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            </div>

            {/* Paper Subset List (Top 4 Preview) */}
            <div className="divide-y divide-slate-200">
              {sortedPapers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-600">
                    No papers match your current filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setVenueFilter('ALL');
                      setMinTopicFit(0);
                    }}
                    className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 hover:underline"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                sortedPapers.slice(0, 4).map((paper, idx) => (
                  <div
                    key={paper.id}
                    className="py-3 first:pt-1 hover:bg-slate-50/80 transition-colors rounded px-2 -mx-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                          <span className="font-semibold text-slate-700">
                            #{idx + 1}
                          </span>
                          <span>·</span>
                          <span>{paper.venue}</span>
                          <span>·</span>
                          <span>{paper.year}</span>
                          <span>·</span>
                          <span className="text-slate-800 font-medium">
                            {paper.citationCount.toLocaleString()} citations
                          </span>
                          <span>·</span>
                          <span className="text-blue-700 font-medium">
                            Topic Fit: {Math.round(paper.relevanceScore * 100)}%
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectPaper(paper.id)}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors mt-1 block font-serif-scholarly leading-snug"
                        >
                          {paper.title}
                        </button>

                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                          {paper.abstract}
                        </p>

                        {/* Clickable Authors */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-slate-600">
                          {paper.authors.map((author, aIdx) => (
                            <React.Fragment key={author.id}>
                              {aIdx > 0 && <span className="text-slate-300">·</span>}
                              <button
                                type="button"
                                onClick={() => onSelectAuthor(author.id)}
                                className="hover:text-slate-900 hover:underline font-medium"
                              >
                                {author.name}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectPaper(paper.id)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-md whitespace-nowrap shrink-0 mt-1"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Subset Footer with Expand Full Table Action */}
          {sortedPapers.length > 0 && (
            <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-mono-tabular">
                Showing {Math.min(4, sortedPapers.length)} of {sortedPapers.length} matching papers
              </span>
              <button
                type="button"
                onClick={() => setIsAllPapersModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Expand Full Table ({sortedPapers.length} papers)
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* "View All Papers in this Subfield" Explorer Modal (Respects active Min Topic Fit & Sorting Controls) */}
      {isAllPapersModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="all-subfield-papers-modal-title"
          data-testid="all-papers-modal"
          onClick={() => setIsAllPapersModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-5xl max-h-[86vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-xs shrink-0"
                  style={{ backgroundColor: data.topic.color }}
                />
                <div>
                  <h2
                    id="all-subfield-papers-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Indexed Landmark Papers in {data.topic.name} ({sortedPapers.length} of {data.topic.paperCount.toLocaleString()} Subfield Papers)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Curated high-impact benchmark papers with resolved citation links · Synchronized with your active Min Topic Fit threshold and sorting controls
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllPapersModalOpen(false)}
                aria-label="Close all papers modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Filter & Sort Controls Bar */}
            <div className="px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by title, author, or keyword..."
                    aria-label="Filter modal papers"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                {/* Synchronized Min Topic Fit Filter */}
                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <label
                    htmlFor="modal-min-topic-fit"
                    className="text-xs font-medium text-slate-600 whitespace-nowrap"
                  >
                    Min Topic Fit:
                  </label>
                  <select
                    id="modal-min-topic-fit"
                    value={String(minTopicFit)}
                    onChange={(e) => setMinTopicFit(Number(e.target.value))}
                    className="text-xs font-mono-tabular font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="0">All (≥8%)</option>
                    <option value="0.2">20%</option>
                    <option value="0.4">40%</option>
                    <option value="0.6">60%</option>
                  </select>
                </div>
              </div>

              {/* Synchronized Sorting Controls: [ Most Cited | Highest Topic Fit | Newest ] */}
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'citations', label: 'Most Cited' },
                    { id: 'relevance', label: 'Highest Topic Fit' },
                    { id: 'year', label: 'Newest' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSortBy(tab.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      sortBy === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Scrollable Full Data Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 px-6">
              {sortedPapers.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-slate-600">
                    No papers match the current Topic Fit or search filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setVenueFilter('ALL');
                      setMinTopicFit(0);
                    }}
                    className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Reset all filters
                  </button>
                </div>
              ) : (
                sortedPapers.map((paper, idx) => (
                  <div
                    key={paper.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                        <span className="font-semibold text-slate-800">#{idx + 1}</span>
                        <span>·</span>
                        <span>{paper.venue}</span>
                        <span>·</span>
                        <span>{paper.year}</span>
                        <span>·</span>
                        <span className="font-semibold text-slate-900">
                          {paper.citationCount.toLocaleString()} citations
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-blue-700">
                          Topic Fit: {Math.round(paper.relevanceScore * 100)}%
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAllPapersModalOpen(false);
                          onSelectPaper(paper.id);
                        }}
                        className="text-left text-sm sm:text-base font-semibold text-slate-900 hover:text-blue-700 font-serif-scholarly block leading-snug"
                      >
                        {paper.title}
                      </button>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {paper.abstract}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        {paper.authors.map((a, aIdx) => (
                          <React.Fragment key={a.id}>
                            {aIdx > 0 && <span className="text-slate-300">·</span>}
                            <button
                              type="button"
                              onClick={() => {
                                setIsAllPapersModalOpen(false);
                                onSelectAuthor(a.id);
                              }}
                              className="hover:text-slate-900 hover:underline font-medium"
                            >
                              {a.name}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAllPapersModalOpen(false);
                        onSelectPaper(paper.id);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      Open Paper Profile
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * TASK 3: AUTHOR ANALYTICS TAB (AUTHOR-LEVEL VIEW)
 * ========================================================================== */

interface AuthorDetailViewProps {
  author: AuthorDetailResponse;
  allTopics: TopicSummary[];
  onSelectAuthor: (authorId: string) => void;
  onSelectPaper: (paperId: string) => void;
  onSelectTopic: (topicId: string) => void;
  onBackToField: () => void;
}

export const AuthorDetailView: React.FC<AuthorDetailViewProps> = ({
  author,
  allTopics,
  onSelectAuthor,
  onSelectPaper,
  onSelectTopic,
  onBackToField,
}) => {
  const [authorSearch, setAuthorSearch] = useState<string>('');
  const [hoveredYearStat, setHoveredYearStat] = useState<number | null>(null);
  const [pinnedYearStat, setPinnedYearStat] = useState<number | null>(null);
  const [isAllAuthorPapersModalOpen, setIsAllAuthorPapersModalOpen] = useState<boolean>(false);
  const [authorPaperSearch, setAuthorPaperSearch] = useState<string>('');
  const [authorPaperSort, setAuthorPaperSort] = useState<'citations' | 'newest' | 'oldest'>('citations');
  const [authorVenueFilter, setAuthorVenueFilter] = useState<string>('ALL');
  const [authorYearFilter, setAuthorYearFilter] = useState<number | 'ALL'>('ALL');

  const allAuthors = useMemo(() => listAllAuthors(), []);
  const filteredAuthors = useMemo(
    () => filterAuthorsByQuery(allAuthors, authorSearch),
    [allAuthors, authorSearch]
  );

  const primaryTopic = getTopicById(author.primaryTopicId);

  const publicationYears = useMemo(() => {
    const yrs = Array.from(new Set(author.papers.map((p) => p.year))).sort((a, b) => b - a);
    return yrs;
  }, [author.papers]);

  const filteredModalAuthorPapers = useMemo(() => {
    const base = sortAndFilterPapers(
      author.papers,
      authorPaperSort === 'citations' ? 'citations' : 'year',
      authorPaperSearch,
      authorVenueFilter,
      0
    ).filter((p) => (authorYearFilter === 'ALL' ? true : p.year === authorYearFilter));
    if (authorPaperSort === 'oldest') {
      return [...base].sort((a, b) => a.year - b.year || b.citationCount - a.citationCount);
    }
    return base;
  }, [author.papers, authorPaperSort, authorPaperSearch, authorVenueFilter, authorYearFilter]);

  // Default inspected year to the author's highest-cited year so the interactive popover is immediately informative
  useEffect(() => {
    setAuthorPaperSearch('');
    setAuthorVenueFilter('ALL');
    setAuthorYearFilter('ALL');
    setPinnedYearStat(null);
    if (author.yearlyStats.length > 0) {
      const peakStat = [...author.yearlyStats].sort(
        (a, b) => b.citationSum - a.citationSum
      )[0];
      setHoveredYearStat(peakStat.year);
    }
  }, [author.id, author.yearlyStats]);

  // Consolidated Unified D3 Visualization:
  // Primary: Annual stacked bar chart showing publications per year colored by topic
  // Secondary: Overlay line showing citation count per year
  const unifiedChart = useMemo(() => {
    const w = 780;
    const h = 300;
    const margin = { top: 24, right: 54, bottom: 36, left: 44 };
    const iw = w - margin.left - margin.right;
    const ih = h - margin.top - margin.bottom;

    const topicKeys = allTopics.map((t) => t.id);
    const rows = author.yearlyStats.map((s) => {
      const r: Record<string, number> = { year: s.year };
      for (const k of topicKeys) {
        r[k] = s.topicBreakdown[k] ?? 0;
      }
      return r;
    });

    const stackGen = d3.stack<Record<string, number>>().keys(topicKeys);
    const stacked = stackGen(rows);

    const years = author.yearlyStats.map((s) => s.year);
    const xBand = d3
      .scaleBand<number>()
      .domain(years)
      .range([0, iw])
      .padding(0.24);

    const maxPapers =
      d3.max(stacked, (layer) => d3.max(layer, (d) => d[1])) || 4;
    const yLeft = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxPapers + 0.5)])
      .range([ih, 0]);

    const maxCites = d3.max(author.yearlyStats, (s) => s.citationSum) || 500;
    const yRight = d3
      .scaleLinear()
      .domain([0, maxCites * 1.12])
      .range([ih, 0]);

    const citeLine = d3
      .line<(typeof author.yearlyStats)[number]>()
      .x((d) => (xBand(d.year) ?? 0) + xBand.bandwidth() / 2)
      .y((d) => yRight(d.citationSum))
      .curve(d3.curveMonotoneX);

    return {
      w,
      h,
      margin,
      iw,
      ih,
      stacked,
      xBand,
      yLeft,
      yRight,
      citeLinePath: citeLine(author.yearlyStats) || '',
    };
  }, [author.yearlyStats, allTopics]);

  const effectiveInspectedYear = pinnedYearStat ?? hoveredYearStat;

  const activeStat = useMemo(() => {
    if (effectiveInspectedYear !== null) {
      const found = author.yearlyStats.find((s) => s.year === effectiveInspectedYear);
      if (found) return found;
    }
    return author.yearlyStats[author.yearlyStats.length - 1] || null;
  }, [author.yearlyStats, effectiveInspectedYear]);

  const activeYearPapers = useMemo(() => {
    if (!activeStat) return [];
    if (activeStat.yearPapers && activeStat.yearPapers.length > 0) {
      return activeStat.yearPapers;
    }
    return author.papers
      .filter((p) => p.year === activeStat.year)
      .sort((a, b) => b.citationCount - a.citationCount);
  }, [activeStat, author.papers]);

  const handleYearBarClick = (yr: number) => {
    setHoveredYearStat(yr);
    setPinnedYearStat((prev) => (prev === yr ? null : yr));
  };

  return (
    <div className="space-y-6">
      {/* Top Author Bar: Top VIS Contributors (Limited to 15 Researchers) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBackToField}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Field Overview
              </button>
              <span className="text-slate-300">/</span>
              <h2 className="text-sm font-bold text-slate-900">
                Top VIS Contributors · Highly Cited Researchers (Top 15)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a researcher below or search by name in any order (e.g., &ldquo;Meng Xia&rdquo;, &ldquo;Xia Meng&rdquo;, or university)
            </p>
          </div>

          {/* Quick Search / Filter Bar for Authors */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={authorSearch}
              onChange={(e) => setAuthorSearch(e.target.value)}
              placeholder="Search author (e.g. Meng Xia, Xia Meng)..."
              aria-label="Filter prominent IEEE VIS authors"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          data-testid="top-vis-contributors-list"
        >
          {filteredAuthors.length === 0 ? (
            <span className="text-xs text-slate-500 py-1">
              No authors match &ldquo;{authorSearch}&rdquo;.{' '}
              <button
                type="button"
                onClick={() => setAuthorSearch('')}
                className="text-blue-700 hover:underline font-medium"
              >
                Reset
              </button>
            </span>
          ) : (
            filteredAuthors.slice(0, 15).map((a, idx) => {
              const isSelected = a.id === author.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAuthor(a.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono-tabular opacity-65">#{idx + 1}</span>
                  <span className="font-semibold">{a.name}</span>
                  <span
                    className={`text-[11px] font-mono-tabular px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-white/15 text-slate-100'
                        : 'bg-white text-slate-600 border border-slate-200/80'
                    }`}
                  >
                    🏆 {a.paperCount} VIS {a.paperCount === 1 ? 'Paper' : 'Papers'} | ⭐{' '}
                    {a.totalCitations.toLocaleString()} Citations
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Author Header Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono-tabular">
              <span>IEEE VIS Researcher Profile</span>
              <span>·</span>
              <span>
                Active {author.activeStartYear}–{author.activeEndYear}
              </span>
              <span>·</span>
              <button
                type="button"
                onClick={() => onSelectTopic(primaryTopic.id)}
                className="inline-flex items-center gap-1.5 font-medium text-slate-800 hover:underline"
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: primaryTopic.color }}
                />
                Primary Subfield: {primaryTopic.name}
              </button>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {author.name}
            </h1>
            <p className="text-sm text-slate-600">{author.affiliation}</p>

            {/* Co-Authors */}
            {author.coAuthors.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                  <Users className="w-3.5 h-3.5" />
                  Frequent Collaborators:
                </span>
                {author.coAuthors.map((co, idx) => (
                  <React.Fragment key={co.id}>
                    {idx > 0 && <span className="text-slate-300">·</span>}
                    <button
                      type="button"
                      onClick={() => onSelectAuthor(co.id)}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {co.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 grid grid-cols-3 gap-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
            <div>
              <div className="text-xs text-slate-500">VIS Publications</div>
              <div className="text-2xl font-mono-tabular font-bold text-slate-900 mt-0.5">
                {author.totalPapers}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Citations</div>
              <div className="text-2xl font-mono-tabular font-bold text-slate-900 mt-0.5">
                {author.totalCitations.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">h-index</div>
              <div className="text-2xl font-mono-tabular font-bold text-slate-900 mt-0.5">
                {author.hIndex}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consolidated Author Visualization + Interactive Year Hover Popover Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 8 Cols: Unified Stacked Topic Bars + Citation Line Overlay */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Annual Publications by Topic &amp; Citation Trajectory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stacked bars show papers per year colored by research subfield; dark line overlays annual citation impact. Hover or click any year bar to inspect its standout paper.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-xs inline-block"
                    style={{ backgroundColor: primaryTopic.color }}
                  />
                  Stacked Bars: Papers by Topic
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-slate-900 inline-block" />
                  Line: Annual Citations
                </span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${unifiedChart.w} ${unifiedChart.h}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label={`Unified publication and citation chart for ${author.name}`}
              data-testid="author-unified-svg"
            >
              <g
                transform={`translate(${unifiedChart.margin.left}, ${unifiedChart.margin.top})`}
              >
                {/* Left Axis Grid (Paper Count) */}
                {unifiedChart.yLeft.ticks(4).map((tick) => (
                  <g
                    key={tick}
                    transform={`translate(0, ${unifiedChart.yLeft(tick)})`}
                  >
                    <line
                      x1={0}
                      x2={unifiedChart.iw}
                      stroke="#F1F5F9"
                      strokeWidth={1}
                    />
                    <text
                      x={-8}
                      dy="0.32em"
                      textAnchor="end"
                      className="text-[10px] font-mono-tabular fill-slate-400"
                    >
                      {tick}p
                    </text>
                  </g>
                ))}

                {/* Right Axis Labels (Citations) */}
                {unifiedChart.yRight.ticks(4).map((tick) => (
                  <g
                    key={`r-${tick}`}
                    transform={`translate(${unifiedChart.iw}, ${unifiedChart.yRight(
                      tick
                    )})`}
                  >
                    <text
                      x={8}
                      dy="0.32em"
                      textAnchor="start"
                      className="text-[10px] font-mono-tabular fill-slate-500"
                    >
                      {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : Math.round(tick)}
                    </text>
                  </g>
                ))}

                {/* Highlight Column Backdrop for Active / Pinned Year */}
                {activeStat && (
                  <g className="pointer-events-none">
                    <rect
                      x={(unifiedChart.xBand(activeStat.year) ?? 0) - 3}
                      y={0}
                      width={unifiedChart.xBand.bandwidth() + 6}
                      height={unifiedChart.ih}
                      fill={pinnedYearStat !== null ? '#DBEAFE' : '#E2E8F0'}
                      fillOpacity={pinnedYearStat !== null ? 0.65 : 0.5}
                      stroke={pinnedYearStat !== null ? '#2563EB' : 'none'}
                      strokeWidth={pinnedYearStat !== null ? 1.5 : 0}
                      rx={3}
                    />
                    {pinnedYearStat !== null && (
                      <g
                        transform={`translate(${
                          (unifiedChart.xBand(activeStat.year) ?? 0) +
                          unifiedChart.xBand.bandwidth() / 2
                        }, -10)`}
                      >
                        <rect
                          x={-22}
                          y={-8}
                          width={44}
                          height={14}
                          rx={3}
                          fill="#1D4ED8"
                        />
                        <text
                          dy="0.28em"
                          textAnchor="middle"
                          className="text-[8px] font-mono-tabular font-bold fill-white"
                        >
                          PINNED
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* Secondary Hover Preview Outline when another year is pinned */}
                {pinnedYearStat !== null &&
                  hoveredYearStat !== null &&
                  hoveredYearStat !== pinnedYearStat && (
                    <rect
                      x={(unifiedChart.xBand(hoveredYearStat) ?? 0) - 2}
                      y={0}
                      width={unifiedChart.xBand.bandwidth() + 4}
                      height={unifiedChart.ih}
                      fill="#94A3B8"
                      fillOpacity={0.18}
                      stroke="#64748B"
                      strokeDasharray="3,2"
                      strokeWidth={1}
                      rx={3}
                      className="pointer-events-none"
                    />
                  )}

                {/* Stacked Topic Bars per Year */}
                {unifiedChart.stacked.map((layer) => {
                  const t = getTopicById(layer.key);
                  return (
                    <g key={layer.key} fill={t.color}>
                      {layer.map((pt) => {
                        const yr = pt.data.year;
                        const bx = unifiedChart.xBand(yr) ?? 0;
                        const y0 = unifiedChart.yLeft(pt[0]);
                        const y1 = unifiedChart.yLeft(pt[1]);
                        return (
                          <rect
                            key={yr}
                            x={bx}
                            y={y1}
                            width={unifiedChart.xBand.bandwidth()}
                            height={Math.max(0, y0 - y1)}
                            rx={1}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredYearStat(yr)}
                            onClick={() => handleYearBarClick(yr)}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {/* Transparent Full-Height Hit Targets for Effortless Year Hovering & Clicking */}
                {author.yearlyStats.map((stat, idx) => {
                  const bx = unifiedChart.xBand(stat.year) ?? 0;
                  const showYear =
                    idx % Math.max(1, Math.floor(author.yearlyStats.length / 8)) === 0 ||
                    idx === author.yearlyStats.length - 1 ||
                    stat.year === pinnedYearStat;
                  return (
                    <g key={`hit-${stat.year}`}>
                      <rect
                        x={bx - 2}
                        y={0}
                        width={unifiedChart.xBand.bandwidth() + 4}
                        height={unifiedChart.ih}
                        fill="transparent"
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        data-testid={`author-year-bar-${stat.year}`}
                        aria-pressed={pinnedYearStat === stat.year}
                        aria-label={`Inspect and pin year ${stat.year} (${stat.paperCount} papers, ${stat.citationSum} citations)`}
                        onMouseEnter={() => setHoveredYearStat(stat.year)}
                        onClick={() => handleYearBarClick(stat.year)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleYearBarClick(stat.year);
                          }
                        }}
                      />
                      {showYear && (
                        <text
                          x={bx + unifiedChart.xBand.bandwidth() / 2}
                          y={unifiedChart.ih + 20}
                          textAnchor="middle"
                          className={`text-[10px] font-mono-tabular pointer-events-none ${
                            stat.year === pinnedYearStat
                              ? 'fill-blue-700 font-bold'
                              : 'fill-slate-500'
                          }`}
                        >
                          {stat.year}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Secondary Overlay: Citation Trajectory Line & Dots */}
                <path
                  d={unifiedChart.citeLinePath}
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth={2.25}
                  className="pointer-events-none"
                />
                {author.yearlyStats.map((stat) => {
                  const isFocused = activeStat?.year === stat.year;
                  return (
                    <circle
                      key={`c-${stat.year}`}
                      cx={
                        (unifiedChart.xBand(stat.year) ?? 0) +
                        unifiedChart.xBand.bandwidth() / 2
                      }
                      cy={unifiedChart.yRight(stat.citationSum)}
                      r={isFocused ? 4.5 : 2.75}
                      fill={isFocused ? '#2563EB' : '#0F172A'}
                      stroke="#FFFFFF"
                      strokeWidth={1.25}
                      className="pointer-events-none"
                    />
                  );
                })}
              </g>
            </svg>

            {/* Cumulative Career Topic Share Legend Strip */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {author.topicDistribution.slice(0, 4).map((td) => (
                <div key={td.topicId} className="flex items-center gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onSelectTopic(td.topicId)}
                    className="w-48 text-left font-medium text-slate-800 hover:underline truncate shrink-0 inline-flex items-center gap-1.5"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: td.color }}
                    />
                    {td.topicName}
                  </button>
                  <div className="flex-1 h-2 bg-slate-100 rounded-xs overflow-hidden">
                    <div
                      className="h-full rounded-xs"
                      style={{
                        width: `${Math.round(td.share * 100)}%`,
                        backgroundColor: td.color,
                      }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono-tabular text-slate-600 shrink-0">
                    {(td.share * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right 4 Cols: Interactive Year Hover & Click-to-Pin Detail Card */}
          <div
            className={`lg:col-span-4 rounded-lg p-5 flex flex-col justify-between transition-colors border ${
              pinnedYearStat !== null
                ? 'bg-blue-50/35 border-blue-300 shadow-2xs'
                : 'bg-slate-50 border-slate-200'
            }`}
            data-testid="author-inspected-year-panel"
          >
            {activeStat ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Inspected Year Summary
                      </span>
                      {pinnedYearStat !== null ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded"
                          data-testid="pinned-year-badge"
                        >
                          Pinned
                          <button
                            type="button"
                            onClick={() => setPinnedYearStat(null)}
                            aria-label="Unpin selected year"
                            className="ml-0.5 underline hover:text-blue-100"
                          >
                            (Unpin)
                          </button>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono-tabular text-slate-400">
                          (Click bar to pin)
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {activeStat.year}
                    </div>
                  </div>
                  <div className="text-right font-mono-tabular">
                    <div className="text-sm font-bold text-slate-900">
                      {activeStat.paperCount}{' '}
                      {activeStat.paperCount === 1 ? 'Paper' : 'Papers'}
                    </div>
                    <div className="text-xs text-blue-700 font-semibold">
                      {activeStat.citationSum.toLocaleString()} Citations
                    </div>
                  </div>
                </div>

                {/* Year Topic Breakdown */}
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-2">
                    Research Subfield Focus in {activeStat.year}
                  </div>
                  {activeStat.paperCount === 0 ? (
                    <div className="text-xs text-slate-500 italic py-1">
                      No publications in {activeStat.year}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(activeStat.topicBreakdown).map(([tid, weight]) => {
                        const t = getTopicById(tid);
                        const pct = Math.min(
                          100,
                          Math.round((weight / activeStat.paperCount) * 100)
                        );
                        return (
                          <div
                            key={tid}
                            className="flex items-center justify-between text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectTopic(tid)}
                              className="inline-flex items-center gap-1.5 text-slate-800 hover:underline truncate"
                            >
                              <span
                                className="w-2 h-2 rounded-xs shrink-0"
                                style={{ backgroundColor: t.color }}
                              />
                              {t.shortName}
                            </button>
                            <span className="font-mono-tabular text-slate-600">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Standout Paper + Complete List of Author's Papers in Active Year */}
                <div className="pt-3 border-t border-slate-200 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      {activeYearPapers.length > 1
                        ? `Publications in ${activeStat.year} (${activeYearPapers.length} Papers)`
                        : `Standout Contributing Paper (${activeStat.year})`}
                    </span>
                    {activeYearPapers.length > 0 && (
                      <button
                        type="button"
                        data-testid="open-year-papers-modal-btn"
                        onClick={() => {
                          setAuthorYearFilter(activeStat.year);
                          setIsAllAuthorPapersModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        Browse in Modal
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {activeYearPapers.length > 0 ? (
                    <div className="space-y-2">
                      {/* All papers from that year listed with standout badge on #1 */}
                      <div
                        className="space-y-2 max-h-56 overflow-y-auto pr-0.5"
                        data-testid="author-standout-paper-card"
                      >
                        {activeYearPapers.map((yrPaper, idx) => (
                          <div
                            key={yrPaper.id}
                            className={`bg-white border rounded-md p-2.5 space-y-1.5 transition-colors ${
                              idx === 0
                                ? 'border-slate-300 shadow-2xs'
                                : 'border-slate-200/90'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-500">
                              <span>
                                {yrPaper.venue} · {yrPaper.year ?? activeStat.year} ·{' '}
                                <strong className="text-slate-700">
                                  {yrPaper.citationCount.toLocaleString()} citations
                                </strong>
                              </span>
                              {idx === 0 && activeYearPapers.length > 1 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                                  Standout #1
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectPaper(yrPaper.id)}
                              className="text-left text-xs sm:text-sm font-semibold text-slate-900 hover:text-blue-700 font-serif-scholarly leading-snug block"
                            >
                              {yrPaper.title}
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectPaper(yrPaper.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                            >
                              View Paper Profile
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Direct Access Button to Open Full Filtered Table for This Year */}
                      <button
                        type="button"
                        data-testid="view-all-year-papers-btn"
                        onClick={() => {
                          setAuthorYearFilter(activeStat.year);
                          setIsAllAuthorPapersModalOpen(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-md shadow-2xs transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                        <span>
                          View All {activeYearPapers.length} {activeStat.year}{' '}
                          {activeYearPapers.length === 1 ? 'Paper' : 'Papers'} in Full List
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="bg-white border border-dashed border-slate-300 rounded-md p-3.5 text-xs text-slate-500 leading-relaxed"
                      data-testid="author-no-publications-card"
                    >
                      <span className="font-semibold text-slate-700 block mb-0.5">
                        No publications in {activeStat.year}
                      </span>
                      {author.name} published 0 IEEE VIS papers in {activeStat.year}. Hover or click any bar with publications to inspect and pin that year&rsquo;s papers.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="pt-3 mt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>
                {pinnedYearStat !== null
                  ? `Year ${pinnedYearStat} is pinned. Click another bar to switch or click again to unpin.`
                  : 'Click any bar in the chart to pin that year on the right.'}
              </span>
              {pinnedYearStat !== null && (
                <button
                  type="button"
                  onClick={() => setPinnedYearStat(null)}
                  className="text-blue-700 font-semibold hover:underline shrink-0"
                >
                  Unpin
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Author's Ranked Papers List by Citation Count (Short Subset + Expand Full List) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Major IEEE VIS Publications by {author.name} ({author.papers.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAuthorYearFilter('ALL');
                  setIsAllAuthorPapersModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-md transition-colors"
              >
                Expand Full List
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing top {Math.min(5, author.papers.length)} of {author.papers.length} publications ranked by citation count — expand full list to browse all
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAuthorYearFilter('ALL');
              setIsAllAuthorPapersModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
          >
            View All {author.papers.length} Publications
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {author.papers.slice(0, 5).map((paper, idx) => {
            const pTopic = getTopicById(paper.primaryTopicId);
            return (
              <div
                key={paper.id}
                className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                    <span className="font-semibold text-slate-800">Rank #{idx + 1}</span>
                    <span>·</span>
                    <span>{paper.venue}</span>
                    <span>·</span>
                    <span>{paper.year}</span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => onSelectTopic(pTopic.id)}
                      className="inline-flex items-center gap-1 text-slate-700 hover:underline"
                    >
                      <span
                        className="w-2 h-2 rounded-xs"
                        style={{ backgroundColor: pTopic.color }}
                      />
                      {pTopic.name}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectPaper(paper.id)}
                    className="text-left text-base font-semibold text-slate-900 hover:text-blue-700 transition-colors font-serif-scholarly block"
                  >
                    {paper.title}
                  </button>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {paper.abstract}
                  </p>

                  <div className="text-xs text-slate-500">
                    {paper.authors.map((a) => a.name).join(', ')} · DOI: {paper.doi}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-mono-tabular font-bold text-slate-900">
                      {paper.citationCount.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500">Citations</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPaper(paper.id)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Paper Profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Subset Footer with Expand Full List Action */}
        {author.papers.length > 0 && (
          <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-mono-tabular">
              Showing top {Math.min(5, author.papers.length)} of {author.papers.length} IEEE VIS publications by {author.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setAuthorYearFilter('ALL');
                setIsAllAuthorPapersModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-md shadow-2xs transition-colors"
            >
              Expand Full List ({author.papers.length} publications)
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        )}
      </div>

      {/* Full Author Publications Explorer Modal */}
      {isAllAuthorPapersModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="author-all-papers-modal-title"
          data-testid="author-all-papers-modal"
          onClick={() => setIsAllAuthorPapersModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-5xl max-h-[86vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-xs shrink-0"
                  style={{ backgroundColor: primaryTopic.color }}
                />
                <div>
                  <h2
                    id="author-all-papers-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    {authorYearFilter === 'ALL'
                      ? `All IEEE VIS Publications by ${author.name} (${filteredModalAuthorPapers.length})`
                      : `${authorYearFilter} IEEE VIS Publications by ${author.name} (${filteredModalAuthorPapers.length})`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {author.affiliation} · Active {author.activeStartYear}–{author.activeEndYear} · {author.totalCitations.toLocaleString()} total citations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllAuthorPapersModalOpen(false)}
                aria-label="Close author publications modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Filter & Sort Controls */}
            <div className="px-6 py-3.5 border-b border-slate-200 space-y-2.5 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={authorPaperSearch}
                      onChange={(e) => setAuthorPaperSearch(e.target.value)}
                      placeholder={`Search ${author.name}'s papers by title, keyword, co-author, or year...`}
                      aria-label="Search author publications in modal"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {['ALL', 'IEEE InfoVis', 'IEEE VAST', 'IEEE SciVis', 'IEEE VIS'].map(
                      (venue) => (
                        <button
                          key={venue}
                          type="button"
                          onClick={() => setAuthorVenueFilter(venue)}
                          className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                            authorVenueFilter === venue
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {venue === 'ALL' ? 'All Tracks' : venue.replace('IEEE ', '')}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: 'citations', label: 'Most Cited' },
                      { id: 'newest', label: 'Newest' },
                      { id: 'oldest', label: 'Oldest' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAuthorPaperSort(tab.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                        authorPaperSort === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year Filter Bar inside Modal */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">
                  Filter by Publication Year:
                </span>
                <button
                  type="button"
                  onClick={() => setAuthorYearFilter('ALL')}
                  className={`px-2.5 py-0.5 text-xs font-mono-tabular font-medium rounded transition-colors ${
                    authorYearFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Years ({author.papers.length})
                </button>
                {publicationYears.map((yr) => {
                  const countInYr = author.papers.filter((p) => p.year === yr).length;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setAuthorYearFilter(yr)}
                      className={`px-2.5 py-0.5 text-xs font-mono-tabular font-medium rounded transition-colors ${
                        authorYearFilter === yr
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {yr} ({countInYr})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Full Scrollable Publications Table */}
            <div className="flex-1 overflow-y-auto px-6 py-3 divide-y divide-slate-200">
              {filteredModalAuthorPapers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-600">
                    No publications match your current filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorPaperSearch('');
                      setAuthorVenueFilter('ALL');
                      setAuthorYearFilter('ALL');
                    }}
                    className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredModalAuthorPapers.map((paper, idx) => {
                  const pTopic = getTopicById(paper.primaryTopicId);
                  return (
                    <div
                      key={paper.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="space-y-1 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                          <span className="font-semibold text-slate-800">#{idx + 1}</span>
                          <span>·</span>
                          <span>{paper.venue}</span>
                          <span>·</span>
                          <span>{paper.year}</span>
                          <span>·</span>
                          <span className="font-semibold text-slate-900">
                            {paper.citationCount.toLocaleString()} citations
                          </span>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAllAuthorPapersModalOpen(false);
                              onSelectTopic(pTopic.id);
                            }}
                            className="inline-flex items-center gap-1 text-slate-700 hover:underline"
                          >
                            <span
                              className="w-2 h-2 rounded-xs"
                              style={{ backgroundColor: pTopic.color }}
                            />
                            {pTopic.shortName}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsAllAuthorPapersModalOpen(false);
                            onSelectPaper(paper.id);
                          }}
                          className="text-left text-sm sm:text-base font-semibold text-slate-900 hover:text-blue-700 font-serif-scholarly block leading-snug"
                        >
                          {paper.title}
                        </button>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {paper.abstract}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          {paper.authors.map((a, aIdx) => (
                            <React.Fragment key={a.id}>
                              {aIdx > 0 && <span className="text-slate-300">·</span>}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAllAuthorPapersModalOpen(false);
                                  onSelectAuthor(a.id);
                                }}
                                className="hover:text-slate-900 hover:underline font-medium"
                              >
                                {a.name}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAllAuthorPapersModalOpen(false);
                          onSelectPaper(paper.id);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                      >
                        Paper Profile
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * TASK 4: PAPER PROFILE TAB (PAPER-LEVEL VIEW)
 * ========================================================================== */

interface PaperDetailViewProps {
  paper: PaperDetailResponse;
  onSelectPaper: (paperId: string) => void;
  onSelectAuthor: (authorId: string) => void;
  onSelectTopic: (topicId: string) => void;
  onBackToTopic: (topicId: string) => void;
}

export const PaperDetailView: React.FC<PaperDetailViewProps> = ({
  paper,
  onSelectPaper,
  onSelectAuthor,
  onSelectTopic,
  onBackToTopic,
}) => {
  const [isAbstractExpanded, setIsAbstractExpanded] = useState<boolean>(true);
  const primaryTopic = getTopicById(paper.primaryTopicId);

  return (
    <div className="space-y-6">
      {/* Clean Breadcrumb Bar (Featured / Seminal Papers relocated to Topic Network tab) */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onBackToTopic(paper.primaryTopicId)}
            className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to {primaryTopic.name} (Topic Network &amp; Seminal Papers)
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-mono-tabular text-slate-700">{paper.doi}</span>
        </div>

        <div className="text-xs text-slate-500 font-mono-tabular">
          {paper.venue} · {paper.year}
        </div>
      </div>

      {/* Main Paper Monograph Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-4">
            {/* Unboxed Metadata Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-600">
              <span className="font-semibold text-slate-900">{paper.venue}</span>
              <span>·</span>
              <span>Published {paper.year}</span>
              <span>·</span>
              <span>DOI: {paper.doi}</span>
              <span>·</span>
              <button
                type="button"
                onClick={() => onSelectTopic(primaryTopic.id)}
                className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:underline"
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: primaryTopic.color }}
                />
                {primaryTopic.name}
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-serif-scholarly leading-tight">
              {paper.title}
            </h1>

            {/* Complete Ordered Authors List */}
            <div className="pt-1 space-y-2" data-testid="paper-authors-list">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Authors ({paper.authors.length} listed in publication order — click any author to view profile)
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {paper.authors.map((a, idx) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectAuthor(a.id)}
                    className="group text-left pr-4 py-1 border-r last:border-r-0 border-slate-200"
                  >
                    <div className="text-sm font-semibold text-blue-700 group-hover:underline flex items-center gap-1.5">
                      <span className="text-[11px] font-mono-tabular text-slate-400 font-normal">
                        #{idx + 1}
                      </span>
                      <span>{a.name}</span>
                    </div>
                    <div className="text-xs text-slate-500">{a.affiliation}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Abstract with flexible layout and Read more / Show less toggle */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Abstract
                </h2>
                {paper.abstract.length > 220 && (
                  <button
                    type="button"
                    onClick={() => setIsAbstractExpanded((v) => !v)}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    {isAbstractExpanded ? 'Compact view' : 'Read full abstract'}
                  </button>
                )}
              </div>
              <p
                className={`text-base text-slate-800 font-serif-scholarly leading-relaxed ${
                  isAbstractExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {paper.abstract}
              </p>
            </div>

            {/* Author Keywords (Unboxed with separators) */}
            <div className="pt-2">
              <span className="text-xs font-medium text-slate-500 mr-2">
                Research Keywords:
              </span>
              <span className="text-xs font-mono-tabular text-slate-700">
                {paper.keywords.join(' · ')}
              </span>
            </div>
          </div>

          {/* Right Column: Citation Metrics, External DOI Link & Topic Fit Breakdown */}
          <div className="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Total Citations</div>
                  <div className="text-3xl font-mono-tabular font-bold text-slate-900 mt-0.5">
                    {paper.citationCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Publication Year</div>
                  <div className="text-3xl font-mono-tabular font-bold text-slate-900 mt-0.5">
                    {paper.year}
                  </div>
                </div>
              </div>

              {/* Topic Fit & Subfield Breakdown */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-800">
                    Topic Fit by Research Subfield
                  </span>
                  <span className="font-mono-tabular text-slate-500">
                    Relevance Score (0–100%)
                  </span>
                </div>
                <div className="space-y-2.5">
                  {paper.topicBreakdown.map((item) => (
                    <div key={item.topicId}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <button
                          type="button"
                          onClick={() => onSelectTopic(item.topicId)}
                          className="font-medium text-slate-800 hover:text-blue-700 hover:underline flex items-center gap-1.5 text-left"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.topicName}
                        </button>
                        <span className="font-mono-tabular font-semibold text-slate-800">
                          {Math.round(item.relevanceScore * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-xs overflow-hidden">
                        <div
                          className="h-full rounded-xs"
                          style={{
                            width: `${Math.round(item.relevanceScore * 100)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Access Publisher DOI ({paper.doi})
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Local Citation Ego-Network Graph (Replaces 3-Column Static Text Lists) */}
      <PaperEgoNetwork
        paper={paper}
        onSelectPaper={onSelectPaper}
        onSelectTopic={onSelectTopic}
      />
    </div>
  );
};
