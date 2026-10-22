import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  TopicCorrelationEdge,
  TopicSummary,
  YearlyTopicPrevalence,
} from '../types';
import { getCorrelationBetween } from '../utils/analyticsLogic';
import { ArrowUpRight, GitCompare, Grid, Info, Network } from 'lucide-react';

interface StreamgraphProps {
  topics: TopicSummary[];
  streamData: YearlyTopicPrevalence[];
  correlations: TopicCorrelationEdge[];
  selectedTopicId: string | null;
  onSelectTopic: (topicId: string) => void;
}

export const Streamgraph: React.FC<StreamgraphProps> = ({
  topics,
  streamData,
  correlations,
  onSelectTopic,
}) => {
  // Default state loads on 'counts' = Research Volume (Total Papers)
  const [metricMode, setMetricMode] = useState<'prevalence' | 'counts'>('counts');
  const [startYear, setStartYear] = useState<number>(1990);
  const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null);
  const [hoveredYear, setHoveredYear] = useState<number | null>(2022);
  const [correlationView, setCorrelationView] = useState<'network' | 'matrix'>('network');
  const [showShareTooltip, setShowShareTooltip] = useState<boolean>(false);

  const activeHighlightTopicId = hoveredTopicId;

  const filteredStreamData = useMemo(
    () => streamData.filter((d) => d.year >= startYear),
    [streamData, startYear]
  );

  // Full-width SVG dimensions for the primary focal Streamgraph
  const width = 1120;
  const height = 360;
  const margin = { top: 20, right: 24, bottom: 34, left: 36 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Compute D3 Stack & Smooth Centered Streamgraph (ThemeRiver Silhouette)
  const { stackedSeries, xScale, yScale, areaGenerator } = useMemo(() => {
    const keys = topics.map((t) => t.id);

    const flatRows = filteredStreamData.map((row) => {
      const obj: Record<string, number> = { year: row.year };
      for (const k of keys) {
        obj[k] =
          metricMode === 'prevalence'
            ? (row.values[k] ?? 0) * 100
            : row.counts[k] ?? 0;
      }
      return obj;
    });

    // Clean, smooth centered ThemeRiver/Streamgraph layout
    const stackGen = d3
      .stack<Record<string, number>>()
      .keys(keys)
      .offset(d3.stackOffsetSilhouette)
      .order(d3.stackOrderInsideOut);

    const series = stackGen(flatRows);

    const xDomain = d3.extent(flatRows, (d) => d.year) as [number, number];
    const x = d3
      .scaleLinear()
      .domain(xDomain[0] ? xDomain : [1990, 2024])
      .range([0, innerWidth]);

    const yMin = d3.min(series, (layer) => d3.min(layer, (d) => d[0])) ?? -50;
    const yMax = d3.max(series, (layer) => d3.max(layer, (d) => d[1])) ?? 50;

    const y = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0]);

    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveBasis);

    return {
      stackedSeries: series,
      xScale: x,
      yScale: y,
      areaGenerator: area,
    };
  }, [topics, filteredStreamData, metricMode, innerWidth, innerHeight]);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicSummary>();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  // Secondary D3 Force Simulation for Inter-Topic Correlation Topology
  const correlationLayout = useMemo(() => {
    const netW = 460;
    const netH = 350;
    const cx = netW / 2;
    const cy = netH / 2 - 4;
    const initialRadius = 136;

    interface SimTopicNode extends d3.SimulationNodeDatum {
      id: string;
      topic: TopicSummary;
      x: number;
      y: number;
    }

    const nodes: SimTopicNode[] = topics.map((t, i) => {
      const angle = (i / topics.length) * 2 * Math.PI - Math.PI / 2;
      return {
        id: t.id,
        topic: t,
        x: cx + Math.cos(angle) * initialRadius,
        y: cy + Math.sin(angle) * (initialRadius * 0.84),
      };
    });

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const uniqueEdges = correlations.filter(
      (e) => e.sourceTopicId < e.targetTopicId && e.correlation >= 0.28
    );

    const simLinks = uniqueEdges
      .map((e) => ({
        source: nodeById.get(e.sourceTopicId)!,
        target: nodeById.get(e.targetTopicId)!,
        correlation: e.correlation,
        coOccurrenceCount: e.coOccurrenceCount,
      }))
      .filter((l) => l.source && l.target);

    const simulation = d3
      .forceSimulation<SimTopicNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimTopicNode, (typeof simLinks)[number]>(simLinks)
          .id((d) => d.id)
          .distance((l) => 205 * (1 - l.correlation * 0.35))
          .strength((l) => l.correlation * 0.18)
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(cx, cy))
      .force('radial', d3.forceRadial(initialRadius, cx, cy).strength(0.75))
      .force('collide', d3.forceCollide<SimTopicNode>().radius(44).iterations(3))
      .stop();

    for (let i = 0; i < 160; i++) {
      simulation.tick();
      for (const n of nodes) {
        n.x = Math.max(62, Math.min(netW - 62, n.x));
        n.y = Math.max(36, Math.min(netH - 40, n.y));
      }
    }

    return { nodes, links: simLinks, netW, netH };
  }, [topics, correlations]);

  const activeYearData = useMemo(() => {
    const targetYr = hoveredYear ?? 2022;
    return (
      filteredStreamData.find((d) => d.year === targetYr) ||
      filteredStreamData[filteredStreamData.length - 1]
    );
  }, [filteredStreamData, hoveredYear]);

  const hoveredTopic = activeHighlightTopicId
    ? topicMap.get(activeHighlightTopicId) || null
    : null;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width - margin.left;
    const clampedX = Math.max(0, Math.min(innerWidth, relX));
    const yr = Math.round(xScale.invert(clampedX));
    setHoveredYear(yr);
  };

  return (
    <div className="space-y-6">
      {/* PRIMARY FULL-WIDTH FOCAL POINT: Topic Prevalence Evolution (Streamgraph) with Embedded Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        {/* Card Header + Scoped Streamgraph Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                Topic Prevalence Evolution (IEEE VIS {startYear}–2024)
              </h2>
              {activeYearData && (
                <span className="px-2 py-0.5 text-xs font-mono-tabular font-semibold bg-slate-100 text-slate-800 rounded">
                  Inspected Year: {activeYearData.year}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {metricMode === 'counts'
                ? 'Displaying annual Research Volume (Total Papers per year) across the 8 core IEEE VIS subfields. Click any stream to open its Topic Network.'
                : 'Displaying Relative Field Share (% of VIS Papers per year) across the 8 core IEEE VIS subfields. Click any stream to open its Topic Network.'}
            </p>
          </div>

          {/* Streamgraph-Scoped Filter Controls (Metric Mode & Time Period) */}
          <div className="flex flex-wrap items-end gap-4 bg-slate-50/80 border border-slate-200/80 rounded-lg px-3.5 py-2.5">
            {/* Metric Toggle: Research Volume (Default) vs Relative Field Share (%) */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Stream Metric
                </span>
                <div
                  className="relative inline-block"
                  onMouseEnter={() => setShowShareTooltip(true)}
                  onMouseLeave={() => setShowShareTooltip(false)}
                >
                  <button
                    type="button"
                    onClick={() => setShowShareTooltip((v) => !v)}
                    onFocus={() => setShowShareTooltip(true)}
                    onBlur={() => setShowShareTooltip(false)}
                    aria-label="Explain Research Share (%)"
                    className="text-slate-400 hover:text-slate-700 transition-colors align-middle"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {showShareTooltip && (
                    <div
                      role="tooltip"
                      style={{ pointerEvents: 'none' }}
                      className="pointer-events-none absolute left-0 top-6 z-30 w-72 p-2.5 bg-slate-900 text-white text-xs rounded-lg shadow-lg leading-relaxed"
                    >
                      Research Volume shows total annual IEEE VIS papers per topic; Relative Field Share (%) represents the proportion of all VIS publications in a given year focused on that topic.
                    </div>
                  )}
                </div>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
                <button
                  type="button"
                  onClick={() => setMetricMode('counts')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    metricMode === 'counts'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Research Volume (Total Papers)
                </button>
                <button
                  type="button"
                  onClick={() => setMetricMode('prevalence')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    metricMode === 'prevalence'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Relative Field Share (%)
                </button>
              </div>
            </div>

            {/* Time Period Filter */}
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Time Period
              </span>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
                {[
                  { yr: 1990, label: '1990–2024 (All Years)' },
                  { yr: 2004, label: '2004–2024 (Modern Era)' },
                  { yr: 2014, label: '2014–2024 (Last Decade)' },
                ].map((win) => (
                  <button
                    key={win.yr}
                    type="button"
                    onClick={() => setStartYear(win.yr)}
                    className={`px-2.5 py-1 text-xs font-mono-tabular font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      startYear === win.yr
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {win.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Hover Banner for Novice Researchers (Stable height + pointer-events-none) */}
        <div
          style={{ pointerEvents: 'none' }}
          className="min-h-[48px] pointer-events-none px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
        >
          {hoveredTopic && activeYearData ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: hoveredTopic.color }}
                />
                <strong className="font-semibold text-slate-900">
                  {hoveredTopic.name}:
                </strong>
                <span className="text-slate-600 leading-relaxed">
                  {hoveredTopic.description}
                </span>
              </div>
              <span className="font-mono-tabular font-semibold text-slate-900 shrink-0">
                {activeYearData.year}: {activeYearData.counts[hoveredTopic.id] ?? 0} papers (
                {((activeYearData.values[hoveredTopic.id] ?? 0) * 100).toFixed(1)}% share)
              </span>
            </>
          ) : (
            <span className="text-slate-500 leading-relaxed">
              Hover over any colored stream to inspect annual paper volume and subfield description, or click to open its Topic Network.
            </span>
          )}
        </div>

        {/* Full-Width SVG Streamgraph Canvas */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none cursor-crosshair"
            role="img"
            aria-label="D3 Streamgraph of IEEE VIS research subfields over time"
            data-testid="streamgraph-svg"
            onMouseMove={handleSvgMouseMove}
          >
            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Vertical Year Gridlines */}
              {xScale.ticks(10).map((yrTick) => (
                <g key={yrTick} transform={`translate(${xScale(yrTick)}, 0)`}>
                  <line
                    y1={0}
                    y2={innerHeight}
                    stroke="#E2E8F0"
                    strokeDasharray="3,3"
                    strokeWidth={1}
                  />
                  <text
                    y={innerHeight + 22}
                    textAnchor="middle"
                    className="text-[11px] fill-slate-500 font-mono-tabular"
                  >
                    {yrTick}
                  </text>
                </g>
              ))}

              {/* Stream Layers */}
              {stackedSeries.map((layer) => {
                const topic = topicMap.get(layer.key);
                if (!topic) return null;
                const pathD = areaGenerator(layer) || '';
                const isHighlighted =
                  !activeHighlightTopicId || activeHighlightTopicId === topic.id;

                // Find label anchor at peak thickness
                let maxDiff = -1;
                let bestPoint = layer[Math.floor(layer.length / 2)];
                for (const pt of layer) {
                  const diff = pt[1] - pt[0];
                  if (diff > maxDiff) {
                    maxDiff = diff;
                    bestPoint = pt;
                  }
                }
                const labelX = bestPoint ? xScale(bestPoint.data.year) : innerWidth / 2;
                const labelY = bestPoint
                  ? yScale((bestPoint[0] + bestPoint[1]) / 2)
                  : innerHeight / 2;

                return (
                  <g
                    key={topic.id}
                    className="cursor-pointer transition-opacity duration-150"
                    style={{ opacity: isHighlighted ? 0.92 : 0.22 }}
                    onMouseEnter={() => setHoveredTopicId(topic.id)}
                    onMouseLeave={() => setHoveredTopicId(null)}
                    onClick={() => onSelectTopic(topic.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect topic ${topic.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectTopic(topic.id);
                      }
                    }}
                  >
                    <path
                      d={pathD}
                      fill={topic.color}
                      stroke="#FFFFFF"
                      strokeWidth={activeHighlightTopicId === topic.id ? 1.75 : 0.75}
                    />
                    {maxDiff > (yScale.domain()[1] - yScale.domain()[0]) * 0.075 && (
                      <text
                        x={Math.max(72, Math.min(innerWidth - 78, labelX))}
                        y={labelY}
                        dy="0.35em"
                        textAnchor="middle"
                        className="pointer-events-none text-[11px] font-semibold fill-white drop-shadow-xs"
                      >
                        {topic.shortName}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Interactive Year Crosshair Probe */}
              {activeYearData && (
                <line
                  x1={xScale(activeYearData.year)}
                  x2={xScale(activeYearData.year)}
                  y1={0}
                  y2={innerHeight}
                  stroke="#0F172A"
                  strokeWidth={1.25}
                  strokeDasharray="4,3"
                  className="pointer-events-none"
                />
              )}
            </g>
          </svg>
        </div>

        {/* Live Year Breakdown Legend Strip */}
        {activeYearData && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>
                Annual Subfield Breakdown in{' '}
                <strong className="font-mono-tabular text-slate-800">
                  {activeYearData.year}
                </strong>
              </span>
              <span>Click any subfield card to explore its Topic Network</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {topics.map((t) => {
                const pct = ((activeYearData.values[t.id] ?? 0) * 100).toFixed(1);
                const cnt = activeYearData.counts[t.id] ?? 0;
                const isFocused = activeHighlightTopicId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTopic(t.id)}
                    onMouseEnter={() => setHoveredTopicId(t.id)}
                    onMouseLeave={() => setHoveredTopicId(null)}
                    title={`${t.name}: ${t.description}`}
                    className={`text-left px-2.5 py-1.5 rounded border transition-colors ${
                      isFocused
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-xs font-medium text-slate-800 truncate">
                        {t.shortName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono-tabular text-slate-500">
                      {cnt} papers · {pct}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECONDARY ROW: Extracted Subfields Directory (Left 7 Cols) + Inter-Topic Correlation Topology (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Core IEEE VIS Research Subfields & Emerging Themes (Citations column removed) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Core IEEE VIS Research Subfields &amp; Emerging Themes
                </h3>
                <p className="text-xs text-slate-500">
                  Plain-English guide to the 8 major visualization research areas and how they are shifting
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                8 Core Subfields · {topics.reduce((acc, t) => acc + t.paperCount, 0).toLocaleString()} Corpus Papers ({topics.reduce((acc, t) => acc + (t.indexedPaperCount ?? 0), 0)} Indexed Landmarks)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table
                className="w-full text-left border-collapse"
                data-testid="subfields-directory-table"
              >
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                    <th className="py-2.5 px-4">Research Subfield &amp; What It Investigates</th>
                    <th className="py-2.5 px-4">Key Terms</th>
                    <th className="py-2.5 px-4 text-right">Papers (1990–2024)</th>
                    <th className="py-2.5 px-4 text-right">Peak Year</th>
                    <th className="py-2.5 px-4 text-right">5-Yr Trend</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {topics.map((topic) => (
                    <tr
                      key={topic.id}
                      onClick={() => onSelectTopic(topic.id)}
                      onMouseEnter={() => setHoveredTopicId(topic.id)}
                      onMouseLeave={() => setHoveredTopicId(null)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors align-top"
                    >
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-start gap-2.5">
                          <span
                            className="w-3 h-3 rounded-xs shrink-0 mt-1"
                            style={{ backgroundColor: topic.color }}
                          />
                          <div>
                            <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                              {topic.name}
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                              {topic.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="text-xs font-mono-tabular font-medium text-slate-700 leading-snug">
                          {topic.topKeywords
                            .slice(0, 3)
                            .map((k) => k.term)
                            .join(' · ')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        <div className="text-xs font-semibold text-slate-900">
                          {topic.paperCount.toLocaleString()}
                        </div>
                        {topic.indexedPaperCount !== undefined && (
                          <div className="text-[10px] text-slate-500">
                            {topic.indexedPaperCount} indexed
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs text-slate-600">
                        {topic.peakYear}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono-tabular text-xs font-medium ${
                          topic.growthRate >= 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {topic.growthRate >= 0 ? `+${topic.growthRate}%` : `${topic.growthRate}%`}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTopic(topic.id);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
                        >
                          Explore
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Secondary Inter-Topic Correlation Topology */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Inter-Topic Correlation Topology
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cumulative cross-subfield overlap across the 1990–2024 corpus
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setCorrelationView('network')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    correlationView === 'network'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  Graph
                </button>
                <button
                  type="button"
                  onClick={() => setCorrelationView('matrix')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    correlationView === 'matrix'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  Matrix
                </button>
              </div>
            </div>

            {correlationView === 'network' ? (
              <div className="relative flex items-center justify-center bg-slate-50/50 border border-slate-100 rounded-md p-2">
                <svg
                  viewBox={`0 0 ${correlationLayout.netW} ${correlationLayout.netH}`}
                  className="w-full h-auto max-h-[300px] select-none"
                  role="img"
                  aria-label="Topic correlation network diagram"
                  data-testid="topic-correlation-svg"
                >
                  {/* Edges */}
                  {correlationLayout.links.map((link, idx) => {
                    const isConnectedToHighlight =
                      !activeHighlightTopicId ||
                      link.source.id === activeHighlightTopicId ||
                      link.target.id === activeHighlightTopicId;

                    const isActivelyHoveredEdge =
                      Boolean(activeHighlightTopicId) &&
                      (link.source.id === activeHighlightTopicId ||
                        link.target.id === activeHighlightTopicId);

                    const midX = (link.source.x + link.target.x) / 2;
                    const midY = (link.source.y + link.target.y) / 2;

                    return (
                      <g
                        key={idx}
                        className="pointer-events-none"
                        style={{ pointerEvents: 'none' }}
                      >
                        <line
                          x1={link.source.x}
                          y1={link.source.y}
                          x2={link.target.x}
                          y2={link.target.y}
                          stroke={isActivelyHoveredEdge ? '#0F172A' : '#475569'}
                          strokeWidth={
                            isActivelyHoveredEdge
                              ? Math.max(2.5, link.correlation * 6.5)
                              : Math.max(1.5, link.correlation * 5)
                          }
                          strokeOpacity={
                            isActivelyHoveredEdge
                              ? 0.9
                              : isConnectedToHighlight
                              ? 0.48
                              : 0.12
                          }
                        />
                        {isActivelyHoveredEdge && (
                          <g
                            transform={`translate(${midX}, ${midY})`}
                            className="pointer-events-none"
                            style={{ pointerEvents: 'none' }}
                          >
                            <rect
                              x={-28}
                              y={-9}
                              width={56}
                              height={16}
                              rx={3}
                              fill="#0F172A"
                            />
                            <text
                              dy="0.32em"
                              textAnchor="middle"
                              className="text-[10px] font-mono-tabular font-semibold fill-white pointer-events-none"
                            >
                              {Math.round(link.correlation * 100)}% link
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Topic Nodes */}
                  {correlationLayout.nodes.map((node) => {
                    const maxTopicPapers = Math.max(1, ...topics.map((t) => t.paperCount));
                    const r = 16 + (node.topic.paperCount / maxTopicPapers) * 9;
                    const isFocused = activeHighlightTopicId === node.id;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredTopicId(node.id)}
                        onMouseLeave={() => setHoveredTopicId(null)}
                        onClick={() => onSelectTopic(node.id)}
                      >
                        <circle r={r + 12} fill="transparent" opacity={0} />
                        <circle
                          r={r}
                          fill={node.topic.color}
                          fillOpacity={!activeHighlightTopicId || isFocused ? 0.95 : 0.35}
                          stroke={isFocused ? '#0F172A' : '#FFFFFF'}
                          strokeWidth={isFocused ? 2.75 : 2}
                        />
                        <text
                          y={r + 14}
                          textAnchor="middle"
                          style={{
                            paintOrder: 'stroke fill',
                            stroke: '#ffffff',
                            strokeWidth: '3px',
                            strokeLinejoin: 'round',
                          }}
                          className="text-[11px] font-semibold fill-slate-900 pointer-events-none"
                        >
                          {node.topic.shortName}
                        </text>
                        <text
                          dy="0.35em"
                          textAnchor="middle"
                          className="text-[10px] font-mono-tabular font-semibold fill-white pointer-events-none"
                        >
                          {node.topic.paperCount}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              /* 8x8 Calibrated Correlation Matrix */
              <div className="flex flex-col justify-center overflow-x-auto py-1">
                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr>
                      <th className="p-1 text-[10px] text-left font-mono-tabular text-slate-400">
                        Subfield
                      </th>
                      {topics.map((t, i) => (
                        <th
                          key={t.id}
                          className="p-1 text-[10px] font-mono-tabular font-semibold text-slate-600"
                          title={t.name}
                        >
                          #{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((rowT, rIdx) => (
                      <tr key={rowT.id}>
                        <td className="p-1 text-left whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectTopic(rowT.id)}
                            className="text-[11px] font-medium text-slate-700 hover:text-blue-600 truncate max-w-[130px] inline-flex items-center gap-1"
                          >
                            <span
                              className="w-2 h-2 rounded-xs shrink-0"
                              style={{ backgroundColor: rowT.color }}
                            />
                            #{rIdx + 1} {rowT.shortName}
                          </button>
                        </td>
                        {topics.map((colT) => {
                          const corr = getCorrelationBetween(rowT.id, colT.id);
                          const bgAlpha =
                            rowT.id === colT.id ? 0.85 : Math.max(0.08, corr * 0.85);
                          return (
                            <td key={colT.id} className="p-0.5">
                              <button
                                type="button"
                                onClick={() => onSelectTopic(rowT.id)}
                                onMouseEnter={() => setHoveredTopicId(rowT.id)}
                                onMouseLeave={() => setHoveredTopicId(null)}
                                className="w-full h-7 rounded-xs text-[10px] font-mono-tabular flex items-center justify-center transition-transform hover:scale-105"
                                style={{
                                  backgroundColor:
                                    rowT.id === colT.id
                                      ? '#0F172A'
                                      : `rgba(37, 99, 235, ${bgAlpha})`,
                                  color:
                                    corr > 0.45 || rowT.id === colT.id
                                      ? '#FFFFFF'
                                      : '#1E293B',
                                }}
                                title={`${rowT.name} ↔ ${colT.name}: ${Math.round(
                                  corr * 100
                                )}% overlap strength`}
                              >
                                {Math.round(corr * 100)}%
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Strongest Cross-Subfield Bridges List */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                <GitCompare className="w-3.5 h-3.5 text-blue-600" />
                Strongest Cross-Subfield Bridges (Top 5 Couplings)
              </span>
              <span className="font-mono-tabular text-[11px]">Overlap · Shared Papers</span>
            </div>
            <div className="space-y-2">
              {correlations
                .filter((c) => c.sourceTopicId < c.targetTopicId)
                .slice(0, 5)
                .map((edge) => {
                  const s = topicMap.get(edge.sourceTopicId);
                  const t = topicMap.get(edge.targetTopicId);
                  if (!s || !t) return null;
                  const pct = Math.round(edge.correlation * 100);
                  return (
                    <div
                      key={`${edge.sourceTopicId}-${edge.targetTopicId}`}
                      className="flex items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/70 border border-slate-200/70 rounded-md px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectTopic(s.id)}
                          className="font-medium text-slate-800 hover:text-blue-700 hover:underline truncate"
                        >
                          {s.shortName}
                        </button>
                        <span className="text-slate-400 shrink-0">↔</span>
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectTopic(t.id)}
                          className="font-medium text-slate-800 hover:text-blue-700 hover:underline truncate"
                        >
                          {t.shortName}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-xs overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-slate-800 rounded-xs"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono-tabular text-slate-700 font-medium">
                          {pct}% · {edge.coOccurrenceCount}p
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5">
              Hover any node in the graph to highlight its strongest cross-subfield links, or switch to the 8×8 Matrix to compare all pairwise cosine similarities.
            </p>
          </div>
        </div>
      </div>

      {/* THIRD ROW: STANDALONE FULL-WIDTH METHODOLOGY & SYSTEM ARCHITECTURE SECTION */}
      <section
        className="bg-white border border-slate-200 rounded-lg p-6 sm:p-7 space-y-6"
        data-testid="methodology-explanation-panel"
        aria-labelledby="methodology-section-heading"
      >
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
              <Info className="w-4 h-4 shrink-0" />
              <span>System Architecture &amp; Topic Modeling Methodology</span>
            </div>
            <h2
              id="methodology-section-heading"
              className="text-lg sm:text-xl font-bold text-slate-900"
            >
              Methodology: LDA Topic Modeling, Why 8 Subfields, &amp; Corpus Preprocessing
            </h2>
            <p className="text-sm text-slate-600 max-w-4xl leading-relaxed">
              How VisLit Explorer classifies 35 years of IEEE VIS literature into 8 interpretable research subfields, computes probabilistic document-topic mixtures, and resolves author and citation entities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 text-xs font-mono-tabular font-semibold bg-slate-900 text-white rounded-md">
              Optimal K = 8 Subfields
            </span>
            <span className="px-3 py-1.5 text-xs font-mono-tabular font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded-md">
              Coherence Cv = 0.642
            </span>
            <span className="px-3 py-1.5 text-xs font-mono-tabular font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
              Priors α = 0.125 · β = 0.01
            </span>
          </div>
        </div>

        {/* 3-Column Visual & Analytical Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Column 1 (4 Cols): Why K = 8 Subfields + Coherence Curve Visual */}
          <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200/90 rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 text-xs font-mono-tabular font-bold bg-blue-600 text-white rounded">
                  01 · Model Selection
                </span>
                <span className="text-xs font-mono-tabular text-slate-500">
                  K = 5 … 15 Sweep
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Why 8 Subfields (Not 10+ or Raw Keyword Clusters)
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Sweeping Latent Dirichlet Allocation (LDA) across candidate topic counts{' '}
                <strong className="font-mono-tabular text-slate-900">K = 4…14</strong> on the IEEE VIS corpus reaches maximum semantic coherence at{' '}
                <strong className="text-blue-700 font-semibold">K = 8 (C<sub>v</sub> = 0.64)</strong>.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                At <strong className="font-mono-tabular text-slate-900">K ≥ 10</strong>, statistical models over-fragment cohesive research tracks—for example, splitting <em>SciVis</em> into separate GPU ray-casting vs. isosurface clusters, or splitting <em>Interaction</em> into separate grammar vs. brushing clusters. Rather than exposing raw unigram bags-of-words (e.g., <code className="px-1 py-0.5 bg-white border border-slate-200 rounded text-xs">&ldquo;node, edge, force&rdquo;</code>), each latent distribution is aligned with the official <strong>IEEE VIS Area Model</strong> (<em>InfoVis</em>, <em>VAST</em>, <em>SciVis</em>).
              </p>
            </div>

            {/* Visual Chart: Semantic Coherence Cv vs Topic Count K */}
            <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  LDA Semantic Coherence (C<sub>v</sub>) by Topic Count K
                </span>
                <span className="font-mono-tabular text-blue-700 font-bold">
                  Peak at K = 8
                </span>
              </div>
              <svg
                viewBox="0 0 320 120"
                className="w-full h-auto select-none"
                role="img"
                aria-label="Chart of semantic coherence peaking at K equals 8 topics"
              >
                {/* Horizontal Reference Lines */}
                <line x1="32" y1="22" x2="304" y2="22" stroke="#E2E8F0" strokeDasharray="2,2" />
                <line x1="32" y1="56" x2="304" y2="56" stroke="#E2E8F0" strokeDasharray="2,2" />
                <line x1="32" y1="90" x2="304" y2="90" stroke="#CBD5E1" />
                <text x="26" y="25" textAnchor="end" className="text-[9px] font-mono-tabular fill-slate-400">
                  0.65
                </text>
                <text x="26" y="59" textAnchor="end" className="text-[9px] font-mono-tabular fill-slate-400">
                  0.55
                </text>
                <text x="26" y="93" textAnchor="end" className="text-[9px] font-mono-tabular fill-slate-400">
                  0.45
                </text>

                {/* Highlight Band for K=8 */}
                <rect x="128" y="10" width="36" height="80" rx="4" fill="#DBEAFE" fillOpacity="0.65" />

                {/* Coherence Polyline: K=4(0.49), K=6(0.56), K=8(0.64), K=10(0.58), K=12(0.52), K=14(0.48) */}
                <polyline
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  points="52,76 99,52 146,24 193,45 240,66 287,80"
                />

                {[
                  { k: 4, x: 52, y: 76, val: '0.49', opt: false },
                  { k: 6, x: 99, y: 52, val: '0.56', opt: false },
                  { k: 8, x: 146, y: 24, val: '0.64 ★', opt: true },
                  { k: 10, x: 193, y: 45, val: '0.58', opt: false },
                  { k: 12, x: 240, y: 66, val: '0.52', opt: false },
                  { k: 14, x: 287, y: 80, val: '0.48', opt: false },
                ].map((pt) => (
                  <g key={pt.k}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.opt ? 5 : 3.5}
                      fill={pt.opt ? '#1D4ED8' : '#0F172A'}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 8}
                      textAnchor="middle"
                      className={`text-[9px] font-mono-tabular ${
                        pt.opt ? 'fill-blue-700 font-bold' : 'fill-slate-600'
                      }`}
                    >
                      {pt.val}
                    </text>
                    <text
                      x={pt.x}
                      y={106}
                      textAnchor="middle"
                      className={`text-[10px] font-mono-tabular ${
                        pt.opt ? 'fill-blue-700 font-bold' : 'fill-slate-500'
                      }`}
                    >
                      K={pt.k}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Column 2 (4 Cols): Probabilistic Topic Fit & Document-Topic Mixture */}
          <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200/90 rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 text-xs font-mono-tabular font-bold bg-violet-600 text-white rounded">
                  02 · Probabilistic Mixture
                </span>
                <span className="text-xs font-mono-tabular text-slate-500">
                  ∑ θ_d,k = 100%
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Document-Topic Distribution (θ<sub>d</sub>) &amp; Cross-Topic Bridges
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Instead of forcing a rigid binary label, LDA models each paper <em>d</em> as a continuous Dirichlet probability vector{' '}
                <strong className="font-mono-tabular text-slate-900">
                  θ<sub>d</sub> = [θ<sub>d,1</sub>, …, θ<sub>d,8</sub>]
                </strong>{' '}
                inferred from its title, abstract, and author keywords:
              </p>
              <ul className="space-y-2 text-sm text-slate-700 leading-relaxed list-disc pl-4">
                <li>
                  <strong className="text-slate-900">Primary Subfield (argmax<sub>k</sub> θ<sub>d,k</sub>):</strong>{' '}
                  Assigns the paper to its dominant subfield stream and sets its node color across citation graphs.
                </li>
                <li>
                  <strong className="text-slate-900">Cross-Subfield Bridges (θ<sub>d,k</sub> ≥ 20%):</strong>{' '}
                  Captures interdisciplinary papers that bridge multiple domains (e.g., <em>Visual Analytics &amp; XAI</em> ↔ <em>High-Dimensional Data</em>) and weights the Inter-Topic Correlation network above.
                </li>
              </ul>
            </div>

            {/* Visual Example of a Paper's Topic Mixture Vector */}
            <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Example Mixture Vector θ<sub>d</sub> (EnsembleLens, VAST &rsquo;18)
                </span>
                <span className="font-mono-tabular text-slate-500">100% Total</span>
              </div>

              {/* Stacked Mixture Bar */}
              <div className="w-full h-3.5 bg-slate-100 rounded-xs overflow-hidden flex">
                <div
                  style={{ width: '76%', backgroundColor: '#7C3AED' }}
                  title="Visual Analytics & XAI: 76%"
                />
                <div
                  style={{ width: '18%', backgroundColor: '#D97706' }}
                  title="High-Dimensional Data: 18%"
                />
                <div
                  style={{ width: '6%', backgroundColor: '#059669' }}
                  title="Interaction & Toolkits: 6%"
                />
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#7C3AED]" />
                    Visual Analytics &amp; XAI (Primary argmax)
                  </span>
                  <span className="font-mono-tabular font-bold text-slate-900">76%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706]" />
                    High-Dimensional Data (Secondary Bridge)
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-700">18%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#059669]" />
                    Interaction &amp; Toolkits (Minor Component)
                  </span>
                  <span className="font-mono-tabular text-slate-600">6%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3 (4 Cols): 4-Stage Data Preprocessing & Entity Resolution Pipeline */}
          <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200/90 rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 text-xs font-mono-tabular font-bold bg-emerald-600 text-white rounded">
                  03 · Data Pipeline
                </span>
                <span className="text-xs font-mono-tabular text-slate-500">
                  Vispubdata 1990–2024
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                4-Stage Corpus Preprocessing &amp; Entity Resolution
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Every publication record undergoes a strict four-stage normalization and verification pipeline before entering the interactive visual analytics views:
              </p>

              {/* Visual 4-Step Pipeline List */}
              <div className="space-y-2.5 pt-1">
                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <div className="text-xs font-mono-tabular font-bold text-emerald-700">
                    STAGE 1 · VERIFIED PROCEEDINGS INGESTION
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 mt-0.5 leading-snug">
                    Validates IEEE InfoVis, VAST, SciVis, and VIS records (1990–2024) against published DOIs and CrossRef citation counts.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <div className="text-xs font-mono-tabular font-bold text-emerald-700">
                    STAGE 2 · AUTHOR DISAMBIGUATION &amp; FULL CO-AUTHOR LISTS
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 mt-0.5 leading-snug">
                    Strips trailing DBLP homonym digits for clean UI display (<code className="text-xs bg-slate-100 px-1 rounded">Meng Xia 0002 → Meng Xia</code>) while retaining unique IDs and indexing every co-author in exact publication order.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <div className="text-xs font-mono-tabular font-bold text-emerald-700">
                    STAGE 3 · N-GRAM TOKENIZATION &amp; TITLE FALLBACK
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 mt-0.5 leading-snug">
                    Extracts domain bigrams (<em>volume ray-casting</em>, <em>edge bundling</em>) and falls back to title tokens when archival papers lack abstracts or keywords.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <div className="text-xs font-mono-tabular font-bold text-emerald-700">
                    STAGE 4 · CROSSREF CITATION GRAPH LINKAGE
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 mt-0.5 leading-snug">
                    Resolves in-corpus reference edges to construct Subfield Citation Backbones and 1-Hop Paper Ego-Networks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
