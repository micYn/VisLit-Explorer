import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  AuthorDetailResponse,
  PaperDetailResponse,
  PaperSummary,
  TopicDetailResponse,
  TopicSummary,
} from '../types';
import { CitationNetwork } from './CitationNetwork';
import {
  getTopicById,
  listAllAuthors,
  listAllPapers,
  PaperSortKey,
  sortAndFilterPapers,
} from '../utils/analyticsLogic';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  FileText,
  Search,
  Users,
} from 'lucide-react';

/* ============================================================================
 * TASK 2: TOPIC-LEVEL VIEW
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

  const sortedPapers = useMemo(
    () => sortAndFilterPapers(data.papers, sortBy, searchQuery, venueFilter),
    [data.papers, sortBy, searchQuery, venueFilter]
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
      {/* Top Topic Switcher & Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToField}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Field Streamgraph
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-medium text-slate-900">Topic Analysis</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {allTopics.map((t) => {
            const active = t.id === data.topic.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTopic(t.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {t.shortName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Topic Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-xs shrink-0"
                style={{ backgroundColor: data.topic.color }}
              />
              <span className="text-xs font-mono-tabular text-slate-500">
                LDA Cluster {data.topic.id.toUpperCase()} · Peak Activity {data.topic.peakYear} ·{' '}
                {data.topic.growthRate >= 0
                  ? `+${data.topic.growthRate}% 5-yr growth`
                  : `${data.topic.growthRate}% 5-yr shift`}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {data.topic.name}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              {data.topic.description}
            </p>

            {/* Unboxed LDA Posterior Term Weights */}
            <div className="pt-1">
              <div className="text-xs font-medium text-slate-500 mb-1.5">
                Top LDA Topic Terms & Posterior Weights (φ)
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 font-mono-tabular">
                {data.topic.topKeywords.map((kw, i) => (
                  <React.Fragment key={kw.term}>
                    {i > 0 && <span className="text-slate-300">·</span>}
                    <span>
                      <strong className="font-medium text-slate-900">{kw.term}</strong> (
                      {(kw.weight * 100).toFixed(1)}%)
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Right KPI + Mini D3 Trajectory */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col justify-between gap-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Topic Corpus Size</div>
                <div className="text-2xl font-mono-tabular font-bold text-slate-900">
                  {data.topic.paperCount.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 ml-1">papers</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Cumulative Impact</div>
                <div className="text-2xl font-mono-tabular font-bold text-slate-900">
                  {data.topic.totalCitations.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 ml-1">cites</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular mb-1">
                <span>1990</span>
                <span>Prevalence Trajectory</span>
                <span>2024</span>
              </div>
              <svg
                viewBox={`0 0 ${sparkGeometry.w} ${sparkGeometry.h}`}
                preserveAspectRatio="none"
                className="w-full h-14 bg-slate-50 rounded border border-slate-100"
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

        {/* Right: Dual-Ranked Paper List (Citations vs LDA Relevance Score) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Topic Literature Ranking ({sortedPapers.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordered by CrossRef Citation Count or LDA Posterior Relevance (θ)
                </p>
              </div>

              {/* Sort Segmented Control */}
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'citations', label: 'Citations' },
                    { id: 'relevance', label: 'LDA Relevance (θ)' },
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

            {/* Search & Venue Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter papers by title, author, or keyword..."
                  aria-label="Filter topic papers"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

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
            </div>

            {/* Paper List */}
            <div className="divide-y divide-slate-200 max-h-[430px] overflow-y-auto pr-1">
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
                    }}
                    className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 hover:underline"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                sortedPapers.map((paper, idx) => (
                  <div
                    key={paper.id}
                    className="py-3.5 first:pt-1 hover:bg-slate-50/80 transition-colors rounded px-2 -mx-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
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
                            θ = {(paper.relevanceScore * 100).toFixed(1)}%
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectPaper(paper.id)}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors mt-1 block font-serif-scholarly leading-snug"
                        >
                          {paper.title}
                        </button>

                        {/* Clickable Authors */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-slate-600">
                          {paper.authors.map((author, aIdx) => (
                            <React.Fragment key={author.id}>
                              {aIdx > 0 && <span className="text-slate-300">·</span>}
                              <button
                                type="button"
                                onClick={() => onSelectAuthor(author.id)}
                                className="hover:text-slate-900 hover:underline"
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
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * TASK 3: AUTHOR-LEVEL VIEW
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
  const allAuthors = useMemo(() => listAllAuthors(), []);
  const primaryTopic = getTopicById(author.primaryTopicId);

  // Chart 1 (Task 3): D3 Author Yearly Paper Throughput & Citation Trajectory
  const throughputChart = useMemo(() => {
    const w = 560;
    const h = 250;
    const margin = { top: 20, right: 42, bottom: 32, left: 36 };
    const iw = w - margin.left - margin.right;
    const ih = h - margin.top - margin.bottom;

    const years = author.yearlyStats.map((s) => s.year);
    const xBand = d3
      .scaleBand<number>()
      .domain(years)
      .range([0, iw])
      .padding(0.25);

    const maxPapers = d3.max(author.yearlyStats, (s) => s.paperCount) || 5;
    const yLeft = d3.scaleLinear().domain([0, maxPapers + 1]).range([ih, 0]);

    const maxCites = d3.max(author.yearlyStats, (s) => s.citationSum) || 500;
    const yRight = d3.scaleLinear().domain([0, maxCites * 1.1]).range([ih, 0]);

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
      xBand,
      yLeft,
      yRight,
      citeLinePath: citeLine(author.yearlyStats) || '',
    };
  }, [author.yearlyStats]);

  // Chart 2 (Task 3): D3 Stacked Topic Contribution Over Time
  const topicEvolutionChart = useMemo(() => {
    const w = 560;
    const h = 250;
    const margin = { top: 20, right: 20, bottom: 32, left: 36 };
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

    const xBand = d3
      .scaleBand<number>()
      .domain(author.yearlyStats.map((s) => s.year))
      .range([0, iw])
      .padding(0.22);

    const yMax =
      d3.max(stacked, (layer) => d3.max(layer, (d) => d[1])) || 4;
    const y = d3.scaleLinear().domain([0, yMax]).range([ih, 0]);

    return { w, h, margin, iw, ih, stacked, xBand, y };
  }, [author.yearlyStats, allTopics]);

  return (
    <div className="space-y-6">
      {/* Author Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
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
          <span className="text-xs font-medium text-slate-900">
            Author Research Profile
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {allAuthors.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelectAuthor(a.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                a.id === author.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Author Header Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
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
                  className="w-2 h-2 rounded-xs"
                  style={{ backgroundColor: primaryTopic.color }}
                />
                Primary Focus: {primaryTopic.name}
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

      {/* Dual D3 Author Charts: Yearly Paper Throughput + Topic Contribution Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Yearly Paper Throughput & Citation Line */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Yearly Publication Throughput & Citation Impact
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bars indicate annual paper count; dark trajectory line tracks annual citations
              </p>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${throughputChart.w} ${throughputChart.h}`}
            className="w-full h-auto select-none"
            role="img"
            aria-label={`Yearly paper throughput chart for ${author.name}`}
            data-testid="author-throughput-svg"
          >
            <g
              transform={`translate(${throughputChart.margin.left}, ${throughputChart.margin.top})`}
            >
              {throughputChart.yLeft.ticks(4).map((tick) => (
                <g
                  key={tick}
                  transform={`translate(0, ${throughputChart.yLeft(tick)})`}
                >
                  <line
                    x1={0}
                    x2={throughputChart.iw}
                    stroke="#F1F5F9"
                    strokeWidth={1}
                  />
                  <text
                    x={-8}
                    dy="0.32em"
                    textAnchor="end"
                    className="text-[10px] font-mono-tabular fill-slate-400"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {/* Bars for paper count */}
              {author.yearlyStats.map((stat, idx) => {
                const bx = throughputChart.xBand(stat.year) ?? 0;
                const by = throughputChart.yLeft(stat.paperCount);
                const bh = throughputChart.ih - by;
                const showYearLabel =
                  idx % Math.max(1, Math.floor(author.yearlyStats.length / 7)) === 0 ||
                  idx === author.yearlyStats.length - 1;

                return (
                  <g key={stat.year}>
                    <rect
                      x={bx}
                      y={by}
                      width={throughputChart.xBand.bandwidth()}
                      height={Math.max(2, bh)}
                      fill={primaryTopic.color}
                      fillOpacity={0.82}
                      rx={2}
                    />
                    {showYearLabel && (
                      <text
                        x={bx + throughputChart.xBand.bandwidth() / 2}
                        y={throughputChart.ih + 18}
                        textAnchor="middle"
                        className="text-[10px] font-mono-tabular fill-slate-500"
                      >
                        {stat.year}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Citation Line */}
              <path
                d={throughputChart.citeLinePath}
                fill="none"
                stroke="#0F172A"
                strokeWidth={2}
              />
              {author.yearlyStats.map((stat) => (
                <circle
                  key={`c-${stat.year}`}
                  cx={
                    (throughputChart.xBand(stat.year) ?? 0) +
                    throughputChart.xBand.bandwidth() / 2
                  }
                  cy={throughputChart.yRight(stat.citationSum)}
                  r={2.5}
                  fill="#0F172A"
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Right: Topic Contribution Distribution Over Time */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Topic Contribution Distribution Over Time
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Stacked yearly LDA topic weight and cumulative career topic share
            </p>

            <svg
              viewBox={`0 0 ${topicEvolutionChart.w} ${topicEvolutionChart.h}`}
              className="w-full h-auto select-none mt-2"
              role="img"
              aria-label={`Topic contribution over time for ${author.name}`}
              data-testid="author-topic-dist-svg"
            >
              <g
                transform={`translate(${topicEvolutionChart.margin.left}, ${topicEvolutionChart.margin.top})`}
              >
                {topicEvolutionChart.stacked.map((layer) => {
                  const t = getTopicById(layer.key);
                  return (
                    <g key={layer.key} fill={t.color}>
                      {layer.map((pt) => {
                        const yr = pt.data.year;
                        const bx = topicEvolutionChart.xBand(yr) ?? 0;
                        const y0 = topicEvolutionChart.y(pt[0]);
                        const y1 = topicEvolutionChart.y(pt[1]);
                        return (
                          <rect
                            key={yr}
                            x={bx}
                            y={y1}
                            width={topicEvolutionChart.xBand.bandwidth()}
                            height={Math.max(0, y0 - y1)}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {author.yearlyStats.map((stat, idx) => {
                  const showYear =
                    idx % Math.max(1, Math.floor(author.yearlyStats.length / 7)) === 0 ||
                    idx === author.yearlyStats.length - 1;
                  if (!showYear) return null;
                  const bx = topicEvolutionChart.xBand(stat.year) ?? 0;
                  return (
                    <text
                      key={stat.year}
                      x={bx + topicEvolutionChart.xBand.bandwidth() / 2}
                      y={topicEvolutionChart.ih + 18}
                      textAnchor="middle"
                      className="text-[10px] font-mono-tabular fill-slate-500"
                    >
                      {stat.year}
                    </text>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Career Topic Share Breakdown Bars */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            {author.topicDistribution.slice(0, 4).map((td) => (
              <div key={td.topicId} className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => onSelectTopic(td.topicId)}
                  className="w-44 text-left font-medium text-slate-800 hover:underline truncate shrink-0 inline-flex items-center gap-1.5"
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
                <span className="w-16 text-right font-mono-tabular text-slate-600 shrink-0">
                  {(td.share * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Author's Ranked Papers List by Citation Count */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Landmark IEEE VIS Publications by {author.name}
            </h3>
            <p className="text-xs text-slate-500">
              Ranked by CrossRef citation count · Click any title to inspect Paper Profile
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {author.papers.map((paper, idx) => {
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
                      {pTopic.shortName}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectPaper(paper.id)}
                    className="text-left text-base font-semibold text-slate-900 hover:text-blue-700 transition-colors font-serif-scholarly block"
                  >
                    {paper.title}
                  </button>

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
      </div>
    </div>
  );
};

/* ============================================================================
 * TASK 4: PAPER-LEVEL VIEW
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
  const allPapers = useMemo(() => listAllPapers('citations'), []);
  const primaryTopic = getTopicById(paper.primaryTopicId);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Quick Paper Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onBackToTopic(paper.primaryTopicId)}
            className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to {primaryTopic.shortName}
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-mono-tabular text-slate-700">{paper.doi}</span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="paper-quick-jump" className="text-xs text-slate-500">
            Jump to Landmark Paper:
          </label>
          <select
            id="paper-quick-jump"
            value={paper.id}
            onChange={(e) => onSelectPaper(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 font-medium text-slate-800 max-w-xs"
          >
            {allPapers.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.year}] {p.title.slice(0, 52)}...
              </option>
            ))}
          </select>
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

            {/* Authors List */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {paper.authors.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAuthor(a.id)}
                  className="group text-left pr-4 py-1 border-r last:border-r-0 border-slate-200"
                >
                  <div className="text-sm font-semibold text-blue-700 group-hover:underline">
                    {a.name}
                  </div>
                  <div className="text-xs text-slate-500">{a.affiliation}</div>
                </button>
              ))}
            </div>

            {/* Abstract */}
            <div className="pt-3 border-t border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Abstract
              </h2>
              <p className="text-base text-slate-800 font-serif-scholarly leading-relaxed">
                {paper.abstract}
              </p>
            </div>

            {/* Author Keywords (Unboxed with separators) */}
            <div className="pt-2">
              <span className="text-xs font-medium text-slate-500 mr-2">
                Author Keywords:
              </span>
              <span className="text-xs font-mono-tabular text-slate-700">
                {paper.keywords.join(' · ')}
              </span>
            </div>
          </div>

          {/* Right Column: Citation Metrics, External DOI Link & LDA Posterior Breakdown */}
          <div className="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">CrossRef Citations</div>
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

              {/* LDA Document-Topic Posterior Vector */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-800">
                    LDA Topic Mixture (θ_d)
                  </span>
                  <span className="font-mono-tabular text-slate-400">Posterior %</span>
                </div>
                <div className="space-y-2.5">
                  {paper.topicBreakdown.map((item) => (
                    <div key={item.topicId}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <button
                          type="button"
                          onClick={() => onSelectTopic(item.topicId)}
                          className="font-medium text-slate-800 hover:text-blue-700 hover:underline flex items-center gap-1.5"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.topicName}
                        </button>
                        <span className="font-mono-tabular text-slate-700">
                          {(item.relevanceScore * 100).toFixed(1)}%
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

      {/* Bottom 3-Column Citation Neighborhood & Related Literature */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Outgoing References (Papers Cited by this Paper) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Foundational References ({paper.referencesPapers.length})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Prior IEEE VIS works cited by this publication
          </p>
          <div className="divide-y divide-slate-100">
            {paper.referencesPapers.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                Foundational root node within the sampled VIS subset.
              </p>
            ) : (
              paper.referencesPapers.map((ref) => (
                <div key={ref.id} className="py-2.5 first:pt-0">
                  <div className="text-[11px] font-mono-tabular text-slate-500">
                    {ref.venue} · {ref.year} · {ref.citationCount.toLocaleString()} cites
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPaper(ref.id)}
                    className="text-left text-xs font-semibold text-slate-900 hover:text-blue-700 mt-0.5 block"
                  >
                    {ref.title}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Incoming Citations (Subsequent VIS Papers Citing This Work) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Cited By in IEEE VIS ({paper.citedByPapers.length})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Subsequent VIS publications building directly on this paper
          </p>
          <div className="divide-y divide-slate-100">
            {paper.citedByPapers.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                Recent frontier publication; citations accumulating in newer proceedings.
              </p>
            ) : (
              paper.citedByPapers.map((citing) => (
                <div key={citing.id} className="py-2.5 first:pt-0">
                  <div className="text-[11px] font-mono-tabular text-slate-500">
                    {citing.venue} · {citing.year} · {citing.citationCount.toLocaleString()}{' '}
                    cites
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPaper(citing.id)}
                    className="text-left text-xs font-semibold text-slate-900 hover:text-blue-700 mt-0.5 block"
                  >
                    {citing.title}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Related Papers by LDA Topic Vector Similarity */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Related Papers by Topic Similarity ({paper.relatedPapers.length})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Ranked by cosine similarity over LDA posterior topic distributions
          </p>
          <div className="divide-y divide-slate-100">
            {paper.relatedPapers.map((rel) => (
              <div key={rel.id} className="py-2.5 first:pt-0">
                <div className="text-[11px] font-mono-tabular text-slate-500">
                  {rel.venue} · {rel.year} · θ = {(rel.relevanceScore * 100).toFixed(1)}%
                </div>
                <button
                  type="button"
                  onClick={() => onSelectPaper(rel.id)}
                  className="text-left text-xs font-semibold text-slate-900 hover:text-blue-700 mt-0.5 block"
                >
                  {rel.title}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
