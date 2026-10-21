import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  TopicCorrelationEdge,
  TopicSummary,
  YearlyTopicPrevalence,
} from '../types';
import { getCorrelationBetween } from '../utils/analyticsLogic';
import { ArrowUpRight, GitCompare, Grid, Network } from 'lucide-react';

export type StreamOffsetMode = 'wiggle' | 'expand' | 'silhouette' | 'none';

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
  selectedTopicId,
  onSelectTopic,
}) => {
  const [offsetMode, setOffsetMode] = useState<StreamOffsetMode>('wiggle');
  const [metricMode, setMetricMode] = useState<'prevalence' | 'counts'>('prevalence');
  const [startYear, setStartYear] = useState<number>(1990);
  const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null);
  const [hoveredYear, setHoveredYear] = useState<number | null>(2022);
  const [correlationView, setCorrelationView] = useState<'network' | 'matrix'>('network');

  const activeHighlightTopicId = hoveredTopicId;

  const filteredStreamData = useMemo(
    () => streamData.filter((d) => d.year >= startYear),
    [streamData, startYear]
  );

  // SVG dimensions for D3 math
  const width = 820;
  const height = 400;
  const margin = { top: 24, right: 24, bottom: 36, left: 48 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Compute D3 Stack & Area Generator (React owns the DOM, D3 does the math)
  const { stackedSeries, xScale, yScale, areaGenerator, yTicks } = useMemo(() => {
    const keys = topics.map((t) => t.id);

    const flatRows = filteredStreamData.map((row) => {
      const obj: Record<string, number> = { year: row.year };
      for (const k of keys) {
        obj[k] = metricMode === 'prevalence' ? (row.values[k] ?? 0) * 100 : row.counts[k] ?? 0;
      }
      return obj;
    });

    const stackGen = d3.stack<Record<string, number>>().keys(keys);
    if (offsetMode === 'wiggle') {
      stackGen.offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
    } else if (offsetMode === 'expand') {
      stackGen.offset(d3.stackOffsetExpand).order(d3.stackOrderNone);
    } else if (offsetMode === 'silhouette') {
      stackGen.offset(d3.stackOffsetSilhouette).order(d3.stackOrderInsideOut);
    } else {
      stackGen.offset(d3.stackOffsetNone).order(d3.stackOrderNone);
    }

    const series = stackGen(flatRows);

    const xDomain = d3.extent(flatRows, (d) => d.year) as [number, number];
    const x = d3
      .scaleLinear()
      .domain(xDomain[0] ? xDomain : [1990, 2024])
      .range([0, innerWidth]);

    const yMin = d3.min(series, (layer) => d3.min(layer, (d) => d[0])) ?? 0;
    const yMax = d3.max(series, (layer) => d3.max(layer, (d) => d[1])) ?? 1;

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
      yTicks: y.ticks(5),
    };
  }, [topics, filteredStreamData, offsetMode, metricMode, innerWidth, innerHeight]);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicSummary>();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  // Compute circular/force-stabilized coordinates for Topic Correlation Network using D3
  const correlationLayout = useMemo(() => {
    const netW = 420;
    const netH = 350;
    const cx = netW / 2;
    const cy = netH / 2 - 4;
    const radius = 126;

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
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * (radius * 0.88),
      };
    });

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const uniqueEdges = correlations.filter(
      (e) => e.sourceTopicId < e.targetTopicId && e.correlation >= 0.25
    );

    const simLinks = uniqueEdges
      .map((e) => ({
        source: nodeById.get(e.sourceTopicId)!,
        target: nodeById.get(e.targetTopicId)!,
        correlation: e.correlation,
        coOccurrenceCount: e.coOccurrenceCount,
      }))
      .filter((l) => l.source && l.target);

    return { nodes, links: simLinks, netW, netH };
  }, [topics, correlations]);

  const activeYearData = useMemo(() => {
    const targetYr = hoveredYear ?? 2022;
    return (
      filteredStreamData.find((d) => d.year === targetYr) ||
      filteredStreamData[filteredStreamData.length - 1]
    );
  }, [filteredStreamData, hoveredYear]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width - margin.left;
    const clampedX = Math.max(0, Math.min(innerWidth, relX));
    const yr = Math.round(xScale.invert(clampedX));
    setHoveredYear(yr);
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">
              Stream Geometry (D3 Stack Offset)
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'wiggle', label: 'ThemeRiver (Wiggle)' },
                  { id: 'expand', label: 'Normalized Share (100%)' },
                  { id: 'none', label: 'Absolute Stacked' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOffsetMode(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    offsetMode === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">
              Metric Encoding
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMetricMode('prevalence')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  metricMode === 'prevalence'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                LDA Prevalence (%)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('counts')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  metricMode === 'counts'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paper Volume
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">
              Temporal Window
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { yr: 1990, label: '1990–2024 (Full)' },
                { yr: 2004, label: '2004–2024 (VAST Era)' },
                { yr: 2014, label: '2014–2024 (Recent)' },
              ].map((win) => (
                <button
                  key={win.yr}
                  type="button"
                  onClick={() => setStartYear(win.yr)}
                  className={`px-3 py-1.5 text-xs font-mono-tabular font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
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

      {/* Main Split Stage: Streamgraph (Left 7 cols) + Topic Correlation Topology (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: D3 Streamgraph */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Topic Prevalence Evolution (IEEE VIS {startYear}–2024)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any topic stream to inspect its citation network and ranked papers
              </p>
            </div>
            {activeYearData && (
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-500">Probed Year</div>
                <div className="text-lg font-mono-tabular font-semibold text-slate-900">
                  {activeYearData.year}
                </div>
              </div>
            )}
          </div>

          {/* SVG Streamgraph Canvas */}
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none cursor-crosshair"
              role="img"
              aria-label="D3 Streamgraph of IEEE VIS research topics over time"
              data-testid="streamgraph-svg"
              onMouseMove={handleSvgMouseMove}
            >
              <g transform={`translate(${margin.left}, ${margin.top})`}>
                {/* Horizontal & Vertical Reference Gridlines */}
                {xScale.ticks(8).map((yrTick) => (
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

                {offsetMode !== 'wiggle' &&
                  yTicks.map((tickVal, idx) => (
                    <g key={idx} transform={`translate(0, ${yScale(tickVal)})`}>
                      <line
                        x1={0}
                        x2={innerWidth}
                        stroke="#F1F5F9"
                        strokeWidth={1}
                      />
                      <text
                        x={-8}
                        dy="0.32em"
                        textAnchor="end"
                        className="text-[10px] fill-slate-400 font-mono-tabular"
                      >
                        {offsetMode === 'expand'
                          ? `${Math.round(tickVal * 100)}%`
                          : Math.round(tickVal)}
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
                  const labelY = bestPoint ? yScale((bestPoint[0] + bestPoint[1]) / 2) : innerHeight / 2;

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
                      {maxDiff > (yScale.domain()[1] - yScale.domain()[0]) * 0.08 && (
                        <text
                          x={Math.max(55, Math.min(innerWidth - 65, labelX))}
                          y={labelY}
                          dy="0.35em"
                          textAnchor="middle"
                          className="pointer-events-none text-[10px] font-semibold fill-white drop-shadow-xs"
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

          {/* Live Year Breakdown Strip */}
          {activeYearData && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>
                  Topic distribution in <strong className="font-mono-tabular text-slate-800">{activeYearData.year}</strong>
                </span>
                <span>Click any topic to drill down</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        {pct}% · {cnt} papers
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Topic Correlation Network / Matrix (Task 1 Adjacent Layout) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Inter-Topic Correlation Topology
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pearson r & document co-occurrence across LDA posterior vectors
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
            <div className="relative flex-1 flex items-center justify-center">
              <svg
                viewBox={`0 0 ${correlationLayout.netW} ${correlationLayout.netH}`}
                className="w-full h-auto max-h-[340px] select-none"
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

                  return (
                    <g key={idx}>
                      <line
                        x1={link.source.x}
                        y1={link.source.y}
                        x2={link.target.x}
                        y2={link.target.y}
                        stroke={isConnectedToHighlight ? '#475569' : '#E2E8F0'}
                        strokeWidth={Math.max(1.2, link.correlation * 6.5)}
                        strokeOpacity={isConnectedToHighlight ? 0.65 : 0.2}
                      />
                      {activeHighlightTopicId &&
                        (link.source.id === activeHighlightTopicId ||
                          link.target.id === activeHighlightTopicId) && (
                          <text
                            x={(link.source.x + link.target.x) / 2}
                            y={(link.source.y + link.target.y) / 2 - 4}
                            textAnchor="middle"
                            className="text-[10px] font-mono-tabular font-semibold fill-slate-800"
                          >
                            r={link.correlation.toFixed(2)}
                          </text>
                        )}
                    </g>
                  );
                })}

                {/* Topic Nodes */}
                {correlationLayout.nodes.map((node) => {
                  const r = 14 + (node.topic.paperCount / 550) * 12;
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
                      <circle
                        r={r}
                        fill={node.topic.color}
                        fillOpacity={
                          !activeHighlightTopicId || isFocused ? 0.92 : 0.45
                        }
                        stroke={isFocused ? '#0F172A' : '#FFFFFF'}
                        strokeWidth={isFocused ? 2.5 : 1.5}
                      />
                      <text
                        y={r + 13}
                        textAnchor="middle"
                        className="text-[11px] font-semibold fill-slate-800"
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
            <div className="flex-1 flex flex-col justify-center overflow-x-auto">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr>
                    <th className="p-1 text-[10px] text-left font-mono-tabular text-slate-400">
                      Topic
                    </th>
                    {topics.map((t, i) => (
                      <th
                        key={t.id}
                        className="p-1 text-[10px] font-mono-tabular font-semibold text-slate-600"
                        title={t.name}
                      >
                        T{i + 1}
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
                          className="text-[11px] font-medium text-slate-700 hover:text-blue-600 truncate max-w-[115px] inline-flex items-center gap-1"
                        >
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: rowT.color }}
                          />
                          T{rIdx + 1} {rowT.shortName}
                        </button>
                      </td>
                      {topics.map((colT) => {
                        const corr = getCorrelationBetween(rowT.id, colT.id);
                        const bgAlpha = rowT.id === colT.id ? 0.85 : Math.max(0.06, corr * 0.85);
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
                                color: corr > 0.45 || rowT.id === colT.id ? '#FFFFFF' : '#1E293B',
                              }}
                              title={`${rowT.shortName} × ${colT.shortName}: r = ${corr.toFixed(2)}`}
                            >
                              {corr.toFixed(2)}
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

          {/* Strongest Topic Couplings Footer */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <GitCompare className="w-3.5 h-3.5 text-slate-500" />
                Strongest Inter-Topic Bridges
              </span>
              <span className="font-mono-tabular">Pearson r</span>
            </div>
            <div className="space-y-1">
              {correlations
                .filter((c) => c.sourceTopicId < c.targetTopicId)
                .slice(0, 3)
                .map((edge) => {
                  const s = topicMap.get(edge.sourceTopicId);
                  const t = topicMap.get(edge.targetTopicId);
                  if (!s || !t) return null;
                  return (
                    <div
                      key={`${edge.sourceTopicId}-${edge.targetTopicId}`}
                      className="flex items-center justify-between text-xs text-slate-600"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <button
                          type="button"
                          onClick={() => onSelectTopic(s.id)}
                          className="font-medium text-slate-800 hover:underline truncate"
                        >
                          {s.shortName}
                        </button>
                        <span className="text-slate-400">↔</span>
                        <button
                          type="button"
                          onClick={() => onSelectTopic(t.id)}
                          className="font-medium text-slate-800 hover:underline truncate"
                        >
                          {t.shortName}
                        </button>
                      </div>
                      <span className="font-mono-tabular text-slate-700 shrink-0">
                        r = {edge.correlation.toFixed(2)} · {edge.coOccurrenceCount} shared papers
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Field-Level LDA Topic Directory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Extracted LDA Research Topics (K = 8)
            </h3>
            <p className="text-xs text-slate-500">
              Click any row to open the Topic-Level Citation Network and Ranked Literature View
            </p>
          </div>
          <span className="text-xs font-mono-tabular text-slate-500">
            Corpus: 3,100 IEEE VIS Papers · 222,500 Total Citations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                <th className="py-2.5 px-4">Research Topic</th>
                <th className="py-2.5 px-4">Top Extracted LDA Terms</th>
                <th className="py-2.5 px-4 text-right">Papers</th>
                <th className="py-2.5 px-4 text-right">Citations</th>
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
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: topic.color }}
                      />
                      <div>
                        <div className="font-semibold text-slate-900">{topic.name}</div>
                        <div className="text-xs text-slate-500 line-clamp-1 max-w-md">
                          {topic.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 font-mono-tabular">
                    {topic.topKeywords
                      .slice(0, 4)
                      .map((k) => k.term)
                      .join(' · ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-slate-800">
                    {topic.paperCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-slate-800">
                    {topic.totalCitations.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-slate-600">
                    {topic.peakYear}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono-tabular font-medium ${
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
                    >
                      Explore Topic
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
  );
};
