import React, { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { CitationLink, CitationNode, TopicSummary } from '../types';
import { getTopicById } from '../utils/analyticsLogic';
import { Compass, Maximize2, Sparkles } from 'lucide-react';

interface CitationNetworkProps {
  nodes: CitationNode[];
  links: CitationLink[];
  activeTopic: TopicSummary;
  selectedPaperId?: string | null;
  onSelectPaper: (paperId: string) => void;
}

interface PositionedNode extends CitationNode {
  x: number;
  y: number;
}

interface PositionedLink {
  source: PositionedNode;
  target: PositionedNode;
}

export const CitationNetwork: React.FC<CitationNetworkProps> = ({
  nodes,
  links,
  activeTopic,
  selectedPaperId,
  onSelectPaper,
}) => {
  const [layoutMode, setLayoutMode] = useState<'force' | 'chronological'>('force');
  const [nodeSizing, setNodeSizing] = useState<'citations' | 'relevance'>('citations');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  const width = 640;
  const height = 390;
  const padX = 58;
  const padY = 44;

  // D3 does the math: compute force simulation positions deterministically
  const { positionedNodes, positionedLinks, yearScale } = useMemo(() => {
    const clonedNodes: PositionedNode[] = nodes.map((n, idx) => {
      const angle = (idx / Math.max(1, nodes.length)) * 2 * Math.PI;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * 115,
        y: height / 2 + Math.sin(angle) * 90,
      };
    });

    const nodeMap = new Map(clonedNodes.map((n) => [n.id, n]));
    const simLinks: d3.SimulationLinkDatum<PositionedNode>[] = links
      .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map((l) => ({
        source: l.source,
        target: l.target,
      }));

    const years = clonedNodes.map((n) => n.year);
    const minYr = d3.min(years) ?? 2000;
    const maxYr = d3.max(years) ?? 2024;
    const xYrScale = d3
      .scaleLinear()
      .domain([minYr - 1, maxYr + 1])
      .range([padX, width - padX]);

    const rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(clonedNodes, (d) => d.citationCount) || 1000])
      .range([9, 24]);

    const simulation = d3
      .forceSimulation<PositionedNode>(clonedNodes)
      .force(
        'link',
        d3
          .forceLink<PositionedNode, d3.SimulationLinkDatum<PositionedNode>>(simLinks)
          .id((d) => d.id)
          .distance(layoutMode === 'chronological' ? 95 : 108)
          .strength(0.55)
      )
      .force('charge', d3.forceManyBody().strength(layoutMode === 'chronological' ? -190 : -250))
      .force(
        'collide',
        d3.forceCollide<PositionedNode>().radius((d) => rScale(d.citationCount) + 15)
      );

    if (layoutMode === 'chronological') {
      simulation
        .force('x', d3.forceX<PositionedNode>((d) => xYrScale(d.year)).strength(0.85))
        .force('y', d3.forceY(height / 2 - 8).strength(0.24));
    } else {
      simulation
        .force('center', d3.forceCenter(width / 2, height / 2 - 8))
        .force('x', d3.forceX(width / 2).strength(0.14))
        .force('y', d3.forceY(height / 2 - 8).strength(0.18));
    }

    simulation.stop();
    for (let i = 0; i < 180; i++) {
      simulation.tick();
      // Clamp within viewport boundaries
      for (const n of clonedNodes) {
        n.x = Math.max(padX, Math.min(width - padX, n.x));
        n.y = Math.max(padY, Math.min(height - padY, n.y));
      }
    }

    const resolvedLinks: PositionedLink[] = simLinks
      .map((l) => {
        const s = typeof l.source === 'object' ? (l.source as PositionedNode) : nodeMap.get(String(l.source));
        const t = typeof l.target === 'object' ? (l.target as PositionedNode) : nodeMap.get(String(l.target));
        return s && t ? { source: s, target: t } : null;
      })
      .filter((l): l is PositionedLink => Boolean(l));

    return {
      positionedNodes: clonedNodes,
      positionedLinks: resolvedLinks,
      yearScale: xYrScale,
    };
  }, [nodes, links, layoutMode]);

  const radiusScale = useMemo(() => {
    if (nodeSizing === 'citations') {
      const maxCite = d3.max(nodes, (d) => d.citationCount) || 1000;
      return d3.scaleSqrt().domain([0, maxCite]).range([9, 23]);
    }
    return d3.scaleLinear().domain([0.05, 1.0]).range([9, 22]);
  }, [nodes, nodeSizing]);

  // Reset hover if topic changes
  useEffect(() => {
    setHoveredNodeId(null);
  }, [activeTopic.id]);

  const activeInspectNode = useMemo(() => {
    const id = hoveredNodeId || selectedPaperId;
    if (id) {
      const found = positionedNodes.find((n) => n.id === id);
      if (found) return found;
    }
    return positionedNodes[0] || null;
  }, [positionedNodes, hoveredNodeId, selectedPaperId]);

  const neighborIds = useMemo(() => {
    const set = new Set<string>();
    const focusId = hoveredNodeId || selectedPaperId;
    if (!focusId) return set;
    set.add(focusId);
    for (const l of positionedLinks) {
      if (l.source.id === focusId) set.add(l.target.id);
      if (l.target.id === focusId) set.add(l.source.id);
    }
    return set;
  }, [positionedLinks, hoveredNodeId, selectedPaperId]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between h-full">
      {/* Header & Layout Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Referencing & Citation Network
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Directed citation subgraph ({positionedNodes.length} papers · {positionedLinks.length}{' '}
            internal citation edges). Click any node to open Paper Profile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setLayoutMode('force')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                layoutMode === 'force'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Force-Directed
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('chronological')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                layoutMode === 'chronological'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Time-Aligned
            </button>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setNodeSizing('citations')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                nodeSizing === 'citations'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Size: Citations
            </button>
            <button
              type="button"
              onClick={() => setNodeSizing('relevance')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                nodeSizing === 'relevance'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Size: LDA θ
            </button>
          </div>
        </div>
      </div>

      {/* SVG Network Canvas */}
      <div className="relative border border-slate-100 bg-slate-50/50 rounded-md overflow-hidden">
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 bg-white/90 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono-tabular text-slate-600">
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(1.35, Number((z + 0.15).toFixed(2))))}
            className="px-1.5 hover:text-slate-900"
            aria-label="Zoom in network"
          >
            +
          </button>
          <span>{Math.round(zoomScale * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(0.8, Number((z - 0.15).toFixed(2))))}
            className="px-1.5 hover:text-slate-900"
            aria-label="Zoom out network"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoomScale(1)}
            className="ml-1 text-slate-500 hover:text-slate-900"
            title="Reset zoom"
            aria-label="Reset network zoom"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Citation network graph for ${activeTopic.name}`}
          data-testid="citation-network-svg"
        >
          <defs>
            <marker
              id="citation-arrow"
              viewBox="0 -5 10 10"
              refX="20"
              refY="0"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,-4L10,0L0,4" fill="#64748B" />
            </marker>
          </defs>

          <g
            transform={`translate(${(width * (1 - zoomScale)) / 2}, ${
              (height * (1 - zoomScale)) / 2
            }) scale(${zoomScale})`}
          >
            {/* Optional Time Axis Grid when in Chronological mode */}
            {layoutMode === 'chronological' &&
              yearScale.ticks(6).map((yr) => (
                <g key={yr} transform={`translate(${yearScale(yr)}, 0)`}>
                  <line
                    y1={20}
                    y2={height - 28}
                    stroke="#E2E8F0"
                    strokeDasharray="3,3"
                  />
                  <text
                    y={height - 10}
                    textAnchor="middle"
                    className="text-[10px] font-mono-tabular fill-slate-400"
                  >
                    {yr}
                  </text>
                </g>
              ))}

            {/* Directed Citation Curved Links (Citing -> Cited) */}
            {positionedLinks.map((link, idx) => {
              const dx = link.target.x - link.source.x;
              const dy = link.target.y - link.source.y;
              const dr = Math.sqrt(dx * dx + dy * dy) * 1.35;
              const pathD = `M${link.source.x},${link.source.y}A${dr},${dr} 0 0,1 ${link.target.x},${link.target.y}`;

              const hasFocus = Boolean(hoveredNodeId || selectedPaperId);
              const isHighlighted =
                !hasFocus ||
                link.source.id === (hoveredNodeId || selectedPaperId) ||
                link.target.id === (hoveredNodeId || selectedPaperId);

              return (
                <path
                  key={`${link.source.id}->${link.target.id}-${idx}`}
                  d={pathD}
                  fill="none"
                  stroke={isHighlighted && hasFocus ? '#0F172A' : '#94A3B8'}
                  strokeWidth={isHighlighted && hasFocus ? 2 : 1.25}
                  strokeOpacity={isHighlighted ? 0.75 : 0.18}
                  markerEnd="url(#citation-arrow)"
                />
              );
            })}

            {/* Paper Nodes */}
            {positionedNodes.map((node) => {
              const r = radiusScale(
                nodeSizing === 'citations' ? node.citationCount : node.relevanceScore
              );
              const nodeTopic = getTopicById(node.primaryTopicId);
              const hasFocus = Boolean(hoveredNodeId || selectedPaperId);
              const isNeighbor = !hasFocus || neighborIds.has(node.id);
              const isSelected =
                node.id === hoveredNodeId || node.id === selectedPaperId;

              const shortLabel =
                node.authors[0]?.split(' ').pop() + ' ' + node.year;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-opacity duration-150"
                  style={{ opacity: isNeighbor ? 1 : 0.25 }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => onSelectPaper(node.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect paper ${node.title}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPaper(node.id);
                    }
                  }}
                >
                  <circle
                    r={r}
                    fill={nodeTopic.color}
                    fillOpacity={0.9}
                    stroke={isSelected ? '#0F172A' : '#FFFFFF'}
                    strokeWidth={isSelected ? 2.75 : 1.5}
                  />
                  <text
                    y={r + 12}
                    textAnchor="middle"
                    className="text-[10px] font-mono-tabular font-semibold fill-slate-800 pointer-events-none"
                  >
                    {shortLabel}
                  </text>
                  {r >= 14 && (
                    <text
                      dy="0.35em"
                      textAnchor="middle"
                      className="text-[9px] font-mono-tabular font-semibold fill-white pointer-events-none"
                    >
                      {nodeSizing === 'citations'
                        ? node.citationCount >= 1000
                          ? `${(node.citationCount / 1000).toFixed(1)}k`
                          : node.citationCount
                        : `${Math.round(node.relevanceScore * 100)}%`}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Focused Node Inspector Footer */}
      {activeInspectNode && (
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-mono-tabular">
              {activeInspectNode.venue} · {activeInspectNode.year} ·{' '}
              {activeInspectNode.citationCount.toLocaleString()} citations · LDA θ ={' '}
              {(activeInspectNode.relevanceScore * 100).toFixed(1)}%
            </div>
            <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">
              {activeInspectNode.title}
            </div>
            <div className="text-xs text-slate-600 truncate">
              {activeInspectNode.authors.join(', ')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectPaper(activeInspectNode.id)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Open Paper Profile
          </button>
        </div>
      )}
    </div>
  );
};
