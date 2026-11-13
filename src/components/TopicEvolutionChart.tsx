import React, { useEffect, useMemo, useState } from 'react';
import { CitationLink, CitationNode, TopicSummary } from '../types';
import {
  buildTopicEvolutionGraph,
  computeNodeLineage,
  computeTopicEvolutionPositions,
  formatPaperAwardLabel,
  PositionedTopicEvolutionNode,
  TopicEvolutionRoleFilter,
  TopicEvolutionScope,
  TopicEvolutionYAxis,
} from '../utils/analyticsLogic';
import { ArrowUpRight, Award, Search, X } from 'lucide-react';

interface TopicEvolutionChartProps {
  nodes: CitationNode[];
  links: CitationLink[];
  activeTopic: TopicSummary;
  selectedPaperId?: string | null;
  onSelectPaper: (paperId: string) => void;
}

const ERA_TICKS = [1990, 2000, 2010, 2020, 2025];
const CANDIDATE_CITATION_TICKS = [0, 5, 20, 50, 150, 500, 1500, 3000];

export const TopicEvolutionChart: React.FC<TopicEvolutionChartProps> = ({
  nodes,
  links,
  activeTopic,
  selectedPaperId,
  onSelectPaper,
}) => {
  const [yAxisMode, setYAxisMode] = useState<TopicEvolutionYAxis>('citations');
  const [scope, setScope] = useState<TopicEvolutionScope>(60);
  const [roleFilter, setRoleFilter] = useState<TopicEvolutionRoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBackboneEdges, setShowBackboneEdges] = useState<boolean>(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  // Reset local exploration controls cleanly when switching subfields
  useEffect(() => {
    setHoveredNodeId(null);
    setPinnedNodeId(null);
    setSearchQuery('');
    setRoleFilter('all');
    setScope(60);
  }, [activeTopic.id]);

  // Build scoped topic graph + structural novice roles from pure analytics utilities
  const evolutionGraph = useMemo(
    () =>
      buildTopicEvolutionGraph(nodes, links, activeTopic.id, {
        scope,
        roleFilter,
        searchQuery,
        selectedPaperId: pinnedNodeId ?? selectedPaperId ?? null,
      }),
    [nodes, links, activeTopic.id, scope, roleFilter, searchQuery, pinnedNodeId, selectedPaperId]
  );

  // Responsive SVG coordinate system (wide 1990-2025 timeline)
  const width = 1160;
  const height = 430;
  const margin = { top: 22, right: 28, bottom: 38, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const positionedNodes = useMemo(
    () =>
      computeTopicEvolutionPositions(evolutionGraph.visibleNodes, yAxisMode, {
        innerWidth,
        innerHeight,
        minYear: 1990,
        maxYear: 2025,
        maxCitations: evolutionGraph.maxTopicCitations,
        minRelevance: evolutionGraph.minTopicRelevance,
        maxRelevance: evolutionGraph.maxTopicRelevance,
      }),
    [
      evolutionGraph.visibleNodes,
      evolutionGraph.maxTopicCitations,
      evolutionGraph.minTopicRelevance,
      evolutionGraph.maxTopicRelevance,
      yAxisMode,
      innerWidth,
      innerHeight,
    ]
  );

  const nodeById = useMemo(() => {
    const map = new Map<string, PositionedTopicEvolutionNode>();
    for (const n of positionedNodes) map.set(n.id, n);
    return map;
  }, [positionedNodes]);

  const allTopicNodeById = useMemo(() => {
    const map = new Map<string, (typeof evolutionGraph.allTopicNodes)[number]>();
    for (const n of evolutionGraph.allTopicNodes) map.set(n.id, n);
    return map;
  }, [evolutionGraph.allTopicNodes]);

  const activeFocusId = hoveredNodeId || pinnedNodeId || null;

  const activeLineage = useMemo(
    () => computeNodeLineage(activeFocusId, evolutionGraph.visibleLinks),
    [activeFocusId, evolutionGraph.visibleLinks]
  );

  const pinnedFullLineage = useMemo(
    () => computeNodeLineage(pinnedNodeId, evolutionGraph.allTopicLinks),
    [pinnedNodeId, evolutionGraph.allTopicLinks]
  );

  const activeFocusNode = activeFocusId ? nodeById.get(activeFocusId) ?? null : null;
  const pinnedNode = pinnedNodeId ? nodeById.get(pinnedNodeId) ?? null : null;
  const hoveredNode = hoveredNodeId ? nodeById.get(hoveredNodeId) ?? null : null;

  // Compute exact Y-axis tick positions matching computeTopicEvolutionPositions
  const yTicks = useMemo(() => {
    if (yAxisMode === 'citations') {
      const maxLog = Math.log10(Math.max(10, evolutionGraph.maxTopicCitations) + 1);
      const result: Array<{ value: number; label: string; y: number }> = [];
      let lastY = Infinity;
      for (const c of CANDIDATE_CITATION_TICKS) {
        if (c > evolutionGraph.maxTopicCitations * 1.08 && c > 10) continue;
        const normY = Math.log10(c + 1) / maxLog;
        const y = innerHeight - normY * (innerHeight - 16) - 8;
        if (y < 10 || y > innerHeight - 4) continue;
        if (Math.abs(lastY - y) < 28) continue;
        lastY = y;
        const label = c >= 1000 ? `${(c / 1000).toFixed(c % 1000 === 0 ? 0 : 1)}k` : String(c);
        result.push({ value: c, label, y });
      }
      return result;
    }

    const relFloor = Math.max(0, Math.floor(evolutionGraph.minTopicRelevance * 10) / 10);
    const relCeil = Math.min(
      1,
      Math.max(relFloor + 0.2, Math.ceil(evolutionGraph.maxTopicRelevance * 10) / 10)
    );
    const relSpan = Math.max(0.1, relCeil - relFloor);
    const step = relSpan > 0.5 ? 0.2 : 0.1;
    const result: Array<{ value: number; label: string; y: number }> = [];
    for (let v = relFloor; v <= relCeil + 0.001; v += step) {
      const clamped = Math.min(1, Number(v.toFixed(2)));
      const normY = (clamped - relFloor) / relSpan;
      const y = innerHeight - normY * (innerHeight - 16) - 8;
      result.push({
        value: clamped,
        label: `${Math.round(clamped * 100)}%`,
        y,
      });
    }
    return result;
  }, [
    yAxisMode,
    evolutionGraph.maxTopicCitations,
    evolutionGraph.minTopicRelevance,
    evolutionGraph.maxTopicRelevance,
    innerHeight,
  ]);

  const xForYear = (yr: number) => ((yr - 1990) / (2025 - 1990)) * innerWidth;

  // Optional subtle top backbone links (max 18) when user enables "Show Backbone Links"
  const backgroundBackboneLinks = useMemo(() => {
    if (!showBackboneEdges) return [];
    return [...evolutionGraph.visibleLinks]
      .map((l) => {
        const s = nodeById.get(l.source);
        const t = nodeById.get(l.target);
        if (!s || !t) return null;
        return {
          link: l,
          source: s,
          target: t,
          weight: s.citationCount + t.citationCount,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 18);
  }, [showBackboneEdges, evolutionGraph.visibleLinks, nodeById]);

  // Collision-filtered landmark labels when idle, or focused lineage labels when active
  const visibleLabels = useMemo(() => {
    const candidates: Array<{ node: PositionedTopicEvolutionNode; priority: number }> = [];

    if (activeFocusId && activeLineage) {
      const focusNode = nodeById.get(activeFocusId);
      if (focusNode) candidates.push({ node: focusNode, priority: 10000 });
      for (const aid of activeLineage.ancestorIds) {
        const n = nodeById.get(aid);
        if (n) candidates.push({ node: n, priority: 5000 + n.citationCount });
      }
      for (const did of activeLineage.descendantIds) {
        const n = nodeById.get(did);
        if (n) candidates.push({ node: n, priority: 4000 + n.citationCount });
      }
    } else if (evolutionGraph.searchMatchIds.size > 0) {
      for (const sid of evolutionGraph.searchMatchIds) {
        const n = nodeById.get(sid);
        if (n) candidates.push({ node: n, priority: 6000 + n.citationCount });
      }
    } else {
      for (const n of positionedNodes) {
        candidates.push({ node: n, priority: n.influenceScore });
      }
    }

    candidates.sort((a, b) => b.priority - a.priority);
    const maxLabels = activeFocusId ? 14 : 9;
    const placedBoxes: Array<{ x: number; y: number; w: number }> = [];
    const accepted: Array<{ node: PositionedTopicEvolutionNode; label: string }> = [];

    for (const { node } of candidates) {
      if (accepted.length >= maxLabels) break;
      const lastName = node.authors[0]?.split(' ').pop() || 'VIS';
      const shortLabel = `${lastName} '${String(node.year).slice(-2)}`;
      const w = shortLabel.length * 6.2 + 10;
      const lx = Math.max(w / 2 + 4, Math.min(innerWidth - w / 2 - 4, node.x));
      const ly = node.y + node.r + 12;

      const overlaps = placedBoxes.some(
        (b) => Math.abs(lx - b.x) < (w + b.w) / 2 + 6 && Math.abs(ly - b.y) < 15
      );
      if (overlaps && node.id !== activeFocusId) continue;

      placedBoxes.push({ x: lx, y: ly, w });
      accepted.push({ node, label: shortLabel });
    }
    return accepted;
  }, [
    activeFocusId,
    activeLineage,
    evolutionGraph.searchMatchIds,
    nodeById,
    positionedNodes,
    innerWidth,
  ]);

  // Non-clipping HTML tooltip placement near hovered node
  const tooltipLayout = useMemo(() => {
    if (!hoveredNode) return null;
    const absX = margin.left + hoveredNode.x;
    const absY = margin.top + hoveredNode.y;
    const xPct = (absX / width) * 100;
    const yPct = (absY / height) * 100;
    return {
      leftPct: xPct,
      topPct: yPct,
      flipX: xPct > 72,
      flipY: yPct > 60,
    };
  }, [hoveredNode, margin.left, margin.top, width, height]);

  const scopeOptions: Array<{ value: TopicEvolutionScope; label: string }> = [
    { value: 30, label: 'Top 30' },
    { value: 60, label: 'Top 60' },
    { value: 150, label: 'Top 150' },
    { value: 'all', label: `All (${evolutionGraph.allTopicCount})` },
  ];

  const roleOptions: Array<{
    id: TopicEvolutionRoleFilter;
    label: string;
    hint: string;
    count: number;
  }> = [
    {
      id: 'all',
      label: 'All Shown',
      hint: 'All papers in the current scope',
      count: evolutionGraph.roleCounts.all,
    },
    {
      id: 'foundations',
      label: 'Foundations',
      hint: 'Most cited by later papers inside this topic',
      count: evolutionGraph.roleCounts.foundations,
    },
    {
      id: 'bridges',
      label: 'Surveys & Bridges',
      hint: 'Papers citing many works in this topic — ideal for literature review',
      count: evolutionGraph.roleCounts.bridges,
    },
    {
      id: 'recent',
      label: 'Recent Frontiers (2023–25)',
      hint: 'Latest papers published in 2023–2025',
      count: evolutionGraph.roleCounts.recent,
    },
  ];

  const getCurvePath = (from: PositionedTopicEvolutionNode, to: PositionedTopicEvolutionNode) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const arcLift = Math.min(68, Math.max(18, dist * 0.22));
    const ctrlX = (from.x + to.x) / 2;
    const ctrlY = (from.y + to.y) / 2 - arcLift;

    // Trim curve start/end to stop cleanly at circle rims so arrowheads are never covered
    const startDx = ctrlX - from.x;
    const startDy = ctrlY - from.y;
    const startLen = Math.hypot(startDx, startDy) || 1;
    const sx = from.x + (startDx / startLen) * Math.min(dist * 0.35, from.r + 2);
    const sy = from.y + (startDy / startLen) * Math.min(dist * 0.35, from.r + 2);

    const endDx = to.x - ctrlX;
    const endDy = to.y - ctrlY;
    const endLen = Math.hypot(endDx, endDy) || 1;
    const ex = to.x - (endDx / endLen) * Math.min(dist * 0.4, to.r + 3.5);
    const ey = to.y - (endDy / endLen) * Math.min(dist * 0.4, to.r + 3.5);

    return `M${sx},${sy} Q${ctrlX},${ctrlY} ${ex},${ey}`;
  };

  return (
    <section
      className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
      aria-labelledby="topic-evolution-heading"
      data-testid="topic-evolution-section"
    >
      {/* Row 1: Header + Single-Line Scope & Y-Axis Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3
              id="topic-evolution-heading"
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              Time-Aligned Topic Evolution &amp; Citation Lineage
            </h3>
            <span className="text-xs font-mono-tabular text-slate-500 whitespace-nowrap">
              {positionedNodes.length} of {evolutionGraph.allTopicCount} papers shown · 1990–2025
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Hover or click any paper to trace older{' '}
            <span className="font-semibold text-amber-700">Foundations (Ancestors)</span> and newer{' '}
            <span className="font-semibold text-blue-700">Follow-ups (Descendants)</span>.
          </p>
        </div>

        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
          {/* Scope Selector: Top 30 / Top 60 / Top 150 / All Topic Papers */}
          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="group"
            aria-label="Displayed paper scope"
          >
            {scopeOptions.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                data-testid={`scope-btn-${opt.value}`}
                onClick={() => setScope(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  scope === opt.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Y-Axis Metric Toggle */}
          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="group"
            aria-label="Vertical axis metric"
          >
            <button
              type="button"
              data-testid="yaxis-citations-btn"
              onClick={() => setYAxisMode('citations')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                yAxisMode === 'citations'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Y: Citation Impact (Log)
            </button>
            <button
              type="button"
              data-testid="yaxis-relevance-btn"
              onClick={() => setYAxisMode('relevance')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                yAxisMode === 'relevance'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Y: Topic Relevance
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Novice "Where Should I Start?" Role Filters + Search Inclusion */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-1 whitespace-nowrap">
            Where Should I Start?
          </span>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Novice structural role filters"
          >
            {roleOptions.map((role) => {
              const active = roleFilter === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  data-testid={`role-filter-${role.id}`}
                  title={role.hint}
                  onClick={() => {
                    setRoleFilter(role.id);
                    setHoveredNodeId(null);
                    setPinnedNodeId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <span>{role.label}</span>
                  <span
                    className={`font-mono-tabular text-[11px] ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {role.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showBackboneEdges}
              onChange={(e) => setShowBackboneEdges(e.target.checked)}
              className="rounded border-slate-300 accent-slate-900 cursor-pointer"
            />
            <span>Subtle Backbone Links</span>
          </label>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find & include a paper..."
              aria-label="Search and include paper in topic evolution timeline"
              data-testid="topic-evolution-search"
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear timeline search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Concise Visual Encoding Key */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full inline-block shrink-0"
            style={{ backgroundColor: activeTopic.color }}
          />
          <span>Circle size = Citation count</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full inline-block shrink-0 border-2 border-amber-500 bg-white" />
          <span>Gold ring = Award paper (Best Paper / Hon. Mention / Test of Time)</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-amber-600" />
          <span>Ancestors (Older Foundations Cited)</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-blue-600" />
          <span>Descendants (Newer Follow-ups Citing)</span>
        </span>
      </div>

      {/* Main Responsive Time-Aligned SVG Canvas + Non-Clipping HTML Tooltip */}
      <div className="relative w-full border border-slate-200/80 bg-slate-50/40 rounded-md">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none block"
          role="img"
          aria-label={`Time-aligned citation evolution timeline for ${activeTopic.name}`}
          data-testid="citation-network-svg"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPinnedNodeId(null);
            }
          }}
        >
          <defs>
            <marker
              id="lineage-arrow-ancestor"
              viewBox="0 -4 8 8"
              refX={7}
              refY={0}
              markerWidth={6.5}
              markerHeight={6.5}
              orient="auto"
            >
              <path d="M0,-3.5L8,0L0,3.5" fill="#D97706" />
            </marker>
            <marker
              id="lineage-arrow-descendant"
              viewBox="0 -4 8 8"
              refX={7}
              refY={0}
              markerWidth={6.5}
              markerHeight={6.5}
              orient="auto"
            >
              <path d="M0,-3.5L8,0L0,3.5" fill="#2563EB" />
            </marker>
          </defs>

          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Subtle Horizontal Y-Axis Gridlines & Labels */}
            {yTicks.map((t) => (
              <g key={`y-${t.value}`} transform={`translate(0, ${t.y})`}>
                <line
                  x1={0}
                  x2={innerWidth}
                  stroke="#E2E8F0"
                  strokeDasharray="3,3"
                  strokeWidth={1}
                />
                <text
                  x={-10}
                  dy="0.32em"
                  textAnchor="end"
                  className="text-[11px] fill-slate-500 font-mono-tabular"
                >
                  {t.label}
                </text>
              </g>
            ))}

            {/* Rotated Y-Axis Title */}
            <text
              transform={`translate(-44, ${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              className="text-[11px] font-semibold fill-slate-500"
            >
              {yAxisMode === 'citations' ? 'Citations (Log Scale)' : 'Topic Relevance'}
            </text>

            {/* Subtle Vertical Era Gridlines (1990, 2000, 2010, 2020, 2025) */}
            {ERA_TICKS.map((yr) => {
              const x = xForYear(yr);
              return (
                <g key={`era-${yr}`} transform={`translate(${x}, 0)`}>
                  <line
                    y1={0}
                    y2={innerHeight}
                    stroke={yr === 1990 || yr === 2025 ? '#CBD5E1' : '#E2E8F0'}
                    strokeDasharray={yr === 1990 || yr === 2025 ? undefined : '4,4'}
                    strokeWidth={1}
                  />
                  <text
                    y={innerHeight + 22}
                    textAnchor="middle"
                    className="text-[11px] font-mono-tabular font-medium fill-slate-600"
                  >
                    {yr}
                  </text>
                </g>
              );
            })}

            {/* Optional Subtle Background Backbone Links (only when user enables toggle and idle) */}
            {!activeFocusId &&
              backgroundBackboneLinks.map((b, idx) => (
                <path
                  key={`bg-${b.link.source}-${b.link.target}-${idx}`}
                  d={getCurvePath(b.target, b.source)}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth={1}
                  strokeOpacity={0.22}
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                />
              ))}

            {/* On-Demand Citation Lineage Curves (Only when hovering or clicking a paper) */}
            {activeFocusNode && activeLineage && (
              <g className="pointer-events-none" style={{ pointerEvents: 'none' }}>
                {activeLineage.ancestorLinks.map((l, idx) => {
                  const anc = nodeById.get(l.target);
                  if (!anc) return null;
                  return (
                    <path
                      key={`anc-link-${anc.id}-${idx}`}
                      d={getCurvePath(anc, activeFocusNode)}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth={2}
                      strokeOpacity={0.85}
                      markerEnd="url(#lineage-arrow-ancestor)"
                    />
                  );
                })}
                {activeLineage.descendantLinks.map((l, idx) => {
                  const desc = nodeById.get(l.source);
                  if (!desc) return null;
                  return (
                    <path
                      key={`desc-link-${desc.id}-${idx}`}
                      d={getCurvePath(activeFocusNode, desc)}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth={2}
                      strokeOpacity={0.85}
                      markerEnd="url(#lineage-arrow-descendant)"
                    />
                  );
                })}
              </g>
            )}

            {/* Paper Nodes */}
            {positionedNodes.map((node) => {
              const hasFocus = Boolean(activeFocusId && activeLineage);
              const isFocus = node.id === activeFocusId;
              const isAncestor = Boolean(activeLineage?.ancestorIds.has(node.id));
              const isDescendant = Boolean(activeLineage?.descendantIds.has(node.id));
              const isSearchMatch = evolutionGraph.searchMatchIds.has(node.id);
              const hasSearch = evolutionGraph.searchMatchIds.size > 0;

              let opacity = 0.9;
              if (hasFocus) {
                opacity = isFocus || isAncestor || isDescendant ? 1 : 0.14;
              } else if (hasSearch) {
                opacity = isSearchMatch ? 1 : 0.2;
              }

              const fill = isAncestor
                ? '#D97706'
                : isDescendant
                ? '#2563EB'
                : activeTopic.color;

              const stroke = isFocus
                ? '#0F172A'
                : isSearchMatch
                ? '#0F172A'
                : isAncestor
                ? '#92400E'
                : isDescendant
                ? '#1E40AF'
                : '#FFFFFF';

              const strokeWidth = isFocus ? 2.8 : isSearchMatch ? 2.2 : 1.4;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-opacity duration-150 focus:outline-none"
                  style={{ opacity }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedNodeId((prev) => (prev === node.id ? null : node.id));
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelectPaper(node.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect paper ${node.title} (${node.year})`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPinnedNodeId((prev) => (prev === node.id ? null : node.id));
                    }
                  }}
                >
                  {/* Generous invisible hitbox for smooth pointer targeting */}
                  <circle r={Math.max(node.r + 7, 13)} fill="transparent" />

                  {/* Distinct Gold Ring for Award Winners (Best Paper / Hon. Mention / Test of Time) */}
                  {node.isAwardWinner && (
                    <circle
                      r={node.r + 3.2}
                      fill="none"
                      stroke="#EAB308"
                      strokeWidth={2}
                    />
                  )}

                  {/* Main Paper Circle */}
                  <circle
                    r={node.r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />

                  {/* Subtle Gold Award Corner Dot */}
                  {node.isAwardWinner && (
                    <circle
                      cx={node.r * 0.72}
                      cy={-node.r * 0.72}
                      r={2.8}
                      fill="#EAB308"
                      stroke="#FFFFFF"
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })}

            {/* Selective Collision-Free Short Labels */}
            <g className="pointer-events-none" style={{ pointerEvents: 'none' }}>
              {visibleLabels.map(({ node, label }) => {
                const lx = Math.max(36, Math.min(innerWidth - 36, node.x));
                const ly = node.y + node.r + 12;
                const isAnc = Boolean(activeLineage?.ancestorIds.has(node.id));
                const isDesc = Boolean(activeLineage?.descendantIds.has(node.id));
                return (
                  <text
                    key={`lbl-${node.id}`}
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    style={{
                      paintOrder: 'stroke fill',
                      stroke: '#FFFFFF',
                      strokeWidth: '3.2px',
                      strokeLinejoin: 'round',
                      pointerEvents: 'none',
                    }}
                    className={`text-[10px] font-mono-tabular font-semibold ${
                      isAnc
                        ? 'fill-amber-800'
                        : isDesc
                        ? 'fill-blue-800'
                        : 'fill-slate-800'
                    }`}
                  >
                    {label}
                  </text>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Clean HTML Tooltip (Smart Horizontal & Vertical Flipping — Never Clips Off-Screen) */}
        {hoveredNode && tooltipLayout && (
          <div
            data-testid="topic-evolution-tooltip"
            style={{
              left: `${tooltipLayout.leftPct}%`,
              top: `${tooltipLayout.topPct}%`,
              transform: `translate(${
                tooltipLayout.flipX ? 'calc(-100% - 14px)' : '14px'
              }, ${tooltipLayout.flipY ? 'calc(-100% - 10px)' : '10px'})`,
              pointerEvents: 'none',
            }}
            className="pointer-events-none absolute z-30 w-72 rounded-lg bg-slate-900/95 text-white px-3.5 py-2.5 shadow-xl border border-slate-700/80 text-xs"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-300 pb-1 mb-1 border-b border-slate-700/80">
              <span>
                {hoveredNode.year} · {hoveredNode.venue}
              </span>
              <span className="font-semibold text-white">
                {hoveredNode.citationCount.toLocaleString()} cites
              </span>
            </div>

            <div className="font-semibold text-white leading-snug line-clamp-2">
              {hoveredNode.title}
            </div>

            <div className="mt-1 text-[11px] text-slate-300 truncate">
              {hoveredNode.authors.slice(0, 3).join(', ')}
              {hoveredNode.authors.length > 3 ? ` +${hoveredNode.authors.length - 3}` : ''}
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-700/80 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono-tabular text-slate-300">
              <span>Topic Fit: {Math.round(hoveredNode.relevanceScore * 100)}%</span>
              {hoveredNode.awardLabel && (
                <>
                  <span>·</span>
                  <span className="text-amber-300 font-semibold">
                    {hoveredNode.awardLabel}
                  </span>
                </>
              )}
              {hoveredNode.isFoundation && (
                <>
                  <span>·</span>
                  <span className="text-amber-200">Foundation</span>
                </>
              )}
              {hoveredNode.isSurveyOrBridge && (
                <>
                  <span>·</span>
                  <span className="text-emerald-300">Bridge</span>
                </>
              )}
            </div>

            {activeLineage && activeLineage.focalId === hoveredNode.id && (
              <div className="mt-1 text-[11px] text-slate-300 font-mono-tabular">
                <span className="text-amber-300">
                  {activeLineage.ancestorIds.size} shown ancestors
                </span>{' '}
                ·{' '}
                <span className="text-blue-300">
                  {activeLineage.descendantIds.size} shown follow-ups
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Crisp Selected Paper Details & Lineage Inspector Bar */}
      <div
        className="pt-3 border-t border-slate-200"
        data-testid="citation-network-paper-details"
      >
        {pinnedNode ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/80 border border-slate-200 rounded-lg p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono-tabular text-slate-500">
                <span className="font-semibold text-slate-900">{pinnedNode.year}</span>
                <span>·</span>
                <span>{pinnedNode.venue}</span>
                <span>·</span>
                <span className="font-semibold text-slate-800">
                  {pinnedNode.citationCount.toLocaleString()} citations
                </span>
                <span>·</span>
                <span>Topic Fit: {Math.round(pinnedNode.relevanceScore * 100)}%</span>
                {pinnedNode.awardLabel && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <Award className="w-3.5 h-3.5" />
                      {pinnedNode.awardLabel}
                    </span>
                  </>
                )}
              </div>

              <h4 className="text-sm font-semibold text-slate-900 font-serif-scholarly leading-snug">
                {pinnedNode.title}
              </h4>

              <div className="text-xs text-slate-600">
                {pinnedNode.authors.join(', ')}
              </div>

              {pinnedFullLineage && (
                <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>
                    <strong className="text-amber-700 font-mono-tabular">
                      {pinnedFullLineage.ancestorIds.size}
                    </strong>{' '}
                    older topic ancestors cited
                    {activeLineage &&
                    activeLineage.focalId === pinnedNode.id &&
                    activeLineage.ancestorIds.size < pinnedFullLineage.ancestorIds.size
                      ? ` (${activeLineage.ancestorIds.size} in current view)`
                      : ''}
                  </span>
                  <span>
                    <strong className="text-blue-700 font-mono-tabular">
                      {pinnedFullLineage.descendantIds.size}
                    </strong>{' '}
                    newer topic follow-ups citing this paper
                    {activeLineage &&
                    activeLineage.focalId === pinnedNode.id &&
                    activeLineage.descendantIds.size < pinnedFullLineage.descendantIds.size
                      ? ` (${activeLineage.descendantIds.size} in current view)`
                      : ''}
                  </span>
                  {scope !== 'all' &&
                    pinnedFullLineage.ancestorIds.size +
                      pinnedFullLineage.descendantIds.size >
                      (activeLineage?.ancestorIds.size ?? 0) +
                        (activeLineage?.descendantIds.size ?? 0) && (
                      <button
                        type="button"
                        onClick={() => setScope('all')}
                        className="text-blue-700 font-medium hover:underline"
                      >
                        Show all {evolutionGraph.allTopicCount} topic papers to reveal full lineage
                      </button>
                    )}
                </div>
              )}

              {/* Quick clickable links to visible or full-topic direct ancestors/descendants */}
              {pinnedFullLineage &&
                (pinnedFullLineage.ancestorIds.size > 0 ||
                  pinnedFullLineage.descendantIds.size > 0) && (
                  <div className="pt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                    {pinnedFullLineage.ancestorIds.size > 0 && (
                      <span className="truncate max-w-md">
                        <span className="font-semibold text-amber-800">Builds on: </span>
                        {Array.from(pinnedFullLineage.ancestorIds)
                          .slice(0, 2)
                          .map((id, i) => {
                            const anc = allTopicNodeById.get(id);
                            if (!anc) return null;
                            const last = anc.authors[0]?.split(' ').pop() || 'VIS';
                            return (
                              <React.Fragment key={id}>
                                {i > 0 && ', '}
                                <button
                                  type="button"
                                  onClick={() => setPinnedNodeId(anc.id)}
                                  className="hover:underline text-slate-800 font-medium"
                                >
                                  {last} &apos;{String(anc.year).slice(-2)}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </span>
                    )}
                    {pinnedFullLineage.descendantIds.size > 0 && (
                      <span className="truncate max-w-md">
                        <span className="font-semibold text-blue-800">Cited by: </span>
                        {Array.from(pinnedFullLineage.descendantIds)
                          .slice(0, 2)
                          .map((id, i) => {
                            const desc = allTopicNodeById.get(id);
                            if (!desc) return null;
                            const last = desc.authors[0]?.split(' ').pop() || 'VIS';
                            return (
                              <React.Fragment key={id}>
                                {i > 0 && ', '}
                                <button
                                  type="button"
                                  onClick={() => setPinnedNodeId(desc.id)}
                                  className="hover:underline text-slate-800 font-medium"
                                >
                                  {last} &apos;{String(desc.year).slice(-2)}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </span>
                    )}
                  </div>
                )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPinnedNodeId(null)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                Clear
              </button>
              <button
                type="button"
                data-testid="open-paper-profile-btn"
                onClick={() => onSelectPaper(pinnedNode.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Open Paper Profile</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2.5 px-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-md text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              Hover any paper to preview its citation lineage, or click to lock selection and open its full Paper Profile.
            </span>
            <span className="font-mono-tabular text-[11px] text-slate-400">
              {evolutionGraph.visibleLinks.length} internal links among {positionedNodes.length} displayed papers
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
