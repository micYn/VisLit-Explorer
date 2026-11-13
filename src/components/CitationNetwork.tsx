import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CitationLink, CitationNode, TopicSummary } from '../types';
import { buildCitationNetworkTopology, getTopicById } from '../utils/analyticsLogic';
import { ArrowUpRight, EyeOff, Maximize2, Search, X } from 'lucide-react';

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
  degree: number;
}

interface PositionedLink {
  source: PositionedNode;
  target: PositionedNode;
}

const INLINE_CORE_SUBSET_SIZE = 24;
const MARKER_RADIUS_BUCKETS = Array.from({ length: 22 }, (_, i) => i + 5);

function getBucketedRadius(r: number): number {
  return Math.max(5, Math.min(26, Math.round(r)));
}

function computeGraphLayout(
  activeNodes: Array<CitationNode & { degree: number }>,
  activeLinks: CitationLink[],
  layoutMode: 'chronological' | 'force',
  width: number,
  height: number,
  padX: number,
  padY: number,
  isDenseFullGraph: boolean
): {
  positionedNodes: PositionedNode[];
  positionedLinks: PositionedLink[];
  yearScale: d3.ScaleLinear<number, number>;
} {
  const years = activeNodes.map((n) => n.year);
  const minYr = d3.min(years) ?? 1990;
  const maxYr = d3.max(years) ?? 2025;
  const xYrScale = d3
    .scaleLinear()
    .domain([minYr - 1, maxYr + 1])
    .range([padX, width - padX]);

  const rScale = d3
    .scaleSqrt()
    .domain([0, d3.max(activeNodes, (d) => d.citationCount) || 1000])
    .range(isDenseFullGraph ? [6, 18] : [9, 22]);

  // Group by year to stagger initial vertical positions cleanly in Time-Aligned mode
  const yearBuckets = new Map<number, number>();
  const clonedNodes: PositionedNode[] = activeNodes.map((n, idx) => {
    const yrCount = yearBuckets.get(n.year) ?? 0;
    yearBuckets.set(n.year, yrCount + 1);
    const angle = (idx / Math.max(1, activeNodes.length)) * 2 * Math.PI;
    const initX =
      layoutMode === 'chronological'
        ? xYrScale(n.year)
        : width / 2 + Math.cos(angle) * (isDenseFullGraph ? 210 : 130);
    const initY =
      layoutMode === 'chronological'
        ? height / 2 - 12 + (yrCount % 2 === 0 ? -1 : 1) * (28 + yrCount * (isDenseFullGraph ? 18 : 28))
        : height / 2 + Math.sin(angle) * (isDenseFullGraph ? 160 : 100);

    return {
      ...n,
      x: initX,
      y: initY,
    };
  });

  const nodeMap = new Map(clonedNodes.map((n) => [n.id, n]));
  const simLinks: d3.SimulationLinkDatum<PositionedNode>[] = activeLinks
    .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
    .map((l) => ({
      source: l.source,
      target: l.target,
    }));

  const isUltraDense = activeNodes.length > 250;
  const collidePad = isUltraDense ? 4 : isDenseFullGraph ? 11 : 22;

  const simulation = d3
    .forceSimulation<PositionedNode>(clonedNodes)
    .force(
      'collide',
      d3
        .forceCollide<PositionedNode>()
        .radius((d) => rScale(d.citationCount) + collidePad)
        .strength(0.95)
        .iterations(isUltraDense ? 2 : 3)
    );

  if (!isUltraDense) {
    simulation
      .force(
        'link',
        d3
          .forceLink<PositionedNode, d3.SimulationLinkDatum<PositionedNode>>(simLinks)
          .id((d) => d.id)
          .distance(layoutMode === 'chronological' ? 88 : 105)
          .strength(layoutMode === 'chronological' ? 0.25 : 0.45)
      )
      .force(
        'charge',
        d3.forceManyBody().strength(
          layoutMode === 'chronological'
            ? isDenseFullGraph
              ? -110
              : -210
            : isDenseFullGraph
            ? -180
            : -310
        )
      );
  } else if (layoutMode === 'force') {
    simulation.force('charge', d3.forceManyBody().theta(0.95).strength(-45));
  }

  if (layoutMode === 'chronological') {
    simulation
      .force('x', d3.forceX<PositionedNode>((d) => xYrScale(d.year)).strength(1.0))
      .force('y', d3.forceY(height / 2 - 10).strength(isUltraDense ? 0.35 : 0.22));
  } else {
    simulation
      .force('center', d3.forceCenter(width / 2, height / 2 - 8))
      .force('x', d3.forceX(width / 2).strength(0.14))
      .force('y', d3.forceY(height / 2 - 8).strength(0.18));
  }

  simulation.stop();
  const ticks = isUltraDense ? (layoutMode === 'chronological' ? 20 : 40) : isDenseFullGraph ? (activeNodes.length > 150 ? 75 : 135) : 190;
  for (let i = 0; i < ticks; i++) {
    simulation.tick();
    for (const n of clonedNodes) {
      if (layoutMode === 'chronological') {
        n.x = xYrScale(n.year);
      } else {
        n.x = Math.max(padX, Math.min(width - padX, n.x));
      }
      n.y = Math.max(padY, Math.min(height - padY - 14, n.y));
    }
  }

  // Vertical de-confliction pass in Time-Aligned mode with O(n log n) early break
  if (layoutMode === 'chronological' && !isUltraDense) {
    const minVerticalGap = isDenseFullGraph
      ? activeNodes.length > 180
        ? 8
        : 18
      : 38;
    const xProximity = isDenseFullGraph ? 48 : 88;
    for (let pass = 0; pass < 3; pass++) {
      clonedNodes.sort((a, b) => a.y - b.y);
      for (let i = 0; i < clonedNodes.length; i++) {
        const a = clonedNodes[i];
        for (let j = i + 1; j < clonedNodes.length; j++) {
          const b = clonedNodes[j];
          const dy = b.y - a.y;
          if (dy >= minVerticalGap) break;
          if (Math.abs(a.x - b.x) < xProximity) {
            const push = (minVerticalGap - dy) / 2 + 0.5;
            a.y = Math.max(padY + 10, a.y - push);
            b.y = Math.min(height - padY - 16, b.y + push);
          }
        }
      }
    }
  }

  const resolvedLinks: PositionedLink[] = simLinks
    .map((l) => {
      const s =
        typeof l.source === 'object'
          ? (l.source as PositionedNode)
          : nodeMap.get(String(l.source));
      const t =
        typeof l.target === 'object'
          ? (l.target as PositionedNode)
          : nodeMap.get(String(l.target));
      return s && t ? { source: s, target: t } : null;
    })
    .filter((l): l is PositionedLink => Boolean(l));

  return {
    positionedNodes: clonedNodes,
    positionedLinks: resolvedLinks,
    yearScale: xYrScale,
  };
}

export const CitationNetwork: React.FC<CitationNetworkProps> = ({
  nodes,
  links,
  activeTopic,
  selectedPaperId,
  onSelectPaper,
}) => {
  // Default view set to Time-Aligned (Chronological) so citation arrows flow right (newer) to left (older)
  const [layoutMode, setLayoutMode] = useState<'chronological' | 'force'>('chronological');
  const [nodeSizing, setNodeSizing] = useState<'citations' | 'relevance'>('citations');
  const [hideStandalone, setHideStandalone] = useState<boolean>(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Full Network Modal State + Explicit Visual Density Controls
  // Defaults to Top 150 for instant render; user can toggle "Render All N Nodes" (HTML5 Canvas >250 nodes)
  const [isFullNetworkModalOpen, setIsFullNetworkModalOpen] = useState<boolean>(false);
  const [modalZoomScale, setModalZoomScale] = useState<number>(1);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');
  const [modalMinCitations, setModalMinCitations] = useState<number>(0);
  const [modalMaxNodes, setModalMaxNodes] = useState<number | null>(150);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const width = 660;
  const height = 395;
  const padX = 58;
  const padY = 42;

  const modalWidth = 1080;
  const modalHeight = 580;

  // Full topology metrics & degree map across ALL topic papers + cross-topic citation bridges
  const {
    fullActiveNodes,
    modalDisplayNodes,
    modalDisplayLinks,
    subsetActiveNodes,
    subsetActiveLinks,
    standaloneCount,
    totalSubfieldCount,
    totalCrossTopicCount,
  } = useMemo(
    () =>
      buildCitationNetworkTopology(
        nodes,
        links,
        activeTopic.id,
        hideStandalone,
        INLINE_CORE_SUBSET_SIZE,
        {
          minCitations: modalMinCitations,
          maxNodes: modalMaxNodes,
        }
      ),
    [nodes, links, hideStandalone, activeTopic.id, modalMinCitations, modalMaxNodes]
  );

  // Inline Core Backbone Layout
  const { positionedNodes, positionedLinks, yearScale } = useMemo(
    () =>
      computeGraphLayout(
        subsetActiveNodes,
        subsetActiveLinks,
        layoutMode,
        width,
        height,
        padX,
        padY,
        false
      ),
    [subsetActiveNodes, subsetActiveLinks, layoutMode]
  );

  // Full Expanded Modal Layout (computed on demand when modal is open)
  const fullGraphLayout = useMemo(() => {
    if (!isFullNetworkModalOpen) return null;
    return computeGraphLayout(
      modalDisplayNodes,
      modalDisplayLinks,
      layoutMode,
      modalWidth,
      modalHeight,
      68,
      46,
      true
    );
  }, [isFullNetworkModalOpen, modalDisplayNodes, modalDisplayLinks, layoutMode]);

  const radiusScale = useMemo(() => {
    if (nodeSizing === 'citations') {
      const maxCite = d3.max(subsetActiveNodes, (d) => d.citationCount) || 1000;
      return d3.scaleSqrt().domain([0, maxCite]).range([9, 22]).clamp(true);
    }
    return d3.scaleLinear().domain([0, 1.0]).range([9, 21]).clamp(true);
  }, [subsetActiveNodes, nodeSizing]);

  const modalRadiusScale = useMemo(() => {
    if (nodeSizing === 'citations') {
      const maxCite = d3.max(modalDisplayNodes, (d) => d.citationCount) || 1000;
      return d3.scaleSqrt().domain([0, maxCite]).range([5, 18]).clamp(true);
    }
    return d3.scaleLinear().domain([0, 1.0]).range([5, 17]).clamp(true);
  }, [modalDisplayNodes, nodeSizing]);

  // Reset hover, pinned node, and modal density filters when topic changes
  useEffect(() => {
    setHoveredNodeId(null);
    setPinnedNodeId(null);
    setModalSearchQuery('');
    setModalMinCitations(0);
    setModalMaxNodes(150);
  }, [activeTopic.id]);

  const activeFocusId = hoveredNodeId || pinnedNodeId || selectedPaperId || null;

  // Initialize selected/inspected state to null (never default to a random first node)
  const activeInspectNode = useMemo(() => {
    if (!activeFocusId) return null;
    return (
      fullActiveNodes.find((n) => n.id === activeFocusId) ||
      positionedNodes.find((n) => n.id === activeFocusId) ||
      null
    );
  }, [fullActiveNodes, positionedNodes, activeFocusId]);

  const neighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!activeFocusId) return set;
    set.add(activeFocusId);
    const linksToScan = isFullNetworkModalOpen && fullGraphLayout
      ? fullGraphLayout.positionedLinks
      : positionedLinks;
    for (const l of linksToScan) {
      if (l.source.id === activeFocusId) set.add(l.target.id);
      if (l.target.id === activeFocusId) set.add(l.source.id);
    }
    return set;
  }, [positionedLinks, fullGraphLayout, isFullNetworkModalOpen, activeFocusId]);

  const subsetCrossTopicCount = useMemo(
    () =>
      positionedNodes.filter(
        (n) => n.isCrossTopic || n.primaryTopicId !== activeTopic.id
      ).length,
    [positionedNodes, activeTopic.id]
  );

  // Search matching inside Full Network Modal
  const matchingModalIds = useMemo(() => {
    const q = modalSearchQuery.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const n of fullActiveNodes) {
      const hay = `${n.title} ${n.authors.join(' ')} ${n.year} ${n.venue}`.toLowerCase();
      if (hay.includes(q)) set.add(n.id);
    }
    return set;
  }, [fullActiveNodes, modalSearchQuery]);

  const useModalCanvas = Boolean(
    isFullNetworkModalOpen &&
      fullGraphLayout &&
      fullGraphLayout.positionedNodes.length > 250
  );

  // High-DPI HTML5 Canvas renderer for dense >250-node Full Network views (prevents SVG DOM freezes)
  useEffect(() => {
    if (!useModalCanvas || !fullGraphLayout) return;
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = modalWidth * dpr;
    canvas.height = modalHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, modalWidth, modalHeight);

    ctx.save();
    ctx.translate((modalWidth * (1 - modalZoomScale)) / 2, (modalHeight * (1 - modalZoomScale)) / 2);
    ctx.scale(modalZoomScale, modalZoomScale);

    // 1. Chronological grid lines
    if (layoutMode === 'chronological') {
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      for (const yr of fullGraphLayout.yearScale.ticks(10)) {
        const xPos = fullGraphLayout.yearScale(yr);
        ctx.save();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xPos, 16);
        ctx.lineTo(xPos, modalHeight - 28);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#64748B';
        ctx.fillText(String(yr), xPos, modalHeight - 10);
      }
    }

    const hasFocus = Boolean(activeFocusId);

    // 2. Curved citation links (draw subtle background edges first, highlighted edges on top)
    const drawLinks = (highlightedPass: boolean) => {
      for (const link of fullGraphLayout.positionedLinks) {
        const isHighlighted =
          !hasFocus || link.source.id === activeFocusId || link.target.id === activeFocusId;
        if (highlightedPass !== (hasFocus && isHighlighted)) continue;

        const sx = link.source.x;
        const sy = link.source.y;
        const tx = link.target.x;
        const ty = link.target.y;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const dx = tx - sx;
        const dy = ty - sy;
        const cx = mx - dy * 0.14;
        const cy = my + dx * 0.14;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.strokeStyle = highlightedPass ? '#0F172A' : '#94A3B8';
        ctx.lineWidth = highlightedPass ? 1.6 : 0.7;
        ctx.globalAlpha = highlightedPass ? 0.85 : hasFocus ? 0.05 : 0.18;
        ctx.stroke();
      }
    };
    drawLinks(false);
    if (hasFocus) drawLinks(true);

    // 3. Paper nodes
    for (const node of fullGraphLayout.positionedNodes) {
      const r = modalRadiusScale(
        nodeSizing === 'citations' ? node.citationCount : node.relevanceScore
      );
      const nodeTopic = getTopicById(node.primaryTopicId);
      const isCrossTopicNode = Boolean(node.isCrossTopic) || node.primaryTopicId !== activeTopic.id;
      const isNeighbor = !hasFocus || neighborIds.has(node.id);
      const matchesSearch = !matchingModalIds || matchingModalIds.has(node.id);
      const isSelected = node.id === activeFocusId;

      ctx.globalAlpha = !matchesSearch ? 0.14 : isNeighbor ? (isCrossTopicNode ? 0.65 : 0.92) : 0.18;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeTopic.color;
      ctx.fill();

      ctx.globalAlpha = !matchesSearch ? 0.2 : isNeighbor ? 1 : 0.25;
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.strokeStyle = isSelected ? '#0F172A' : isCrossTopicNode ? '#334155' : '#FFFFFF';
      ctx.stroke();
    }

    // 4. Selective node labels (selected, search matches, or top cited)
    ctx.globalAlpha = 1;
    ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    for (const node of fullGraphLayout.positionedNodes) {
      const isSelected = node.id === activeFocusId;
      const showLabel =
        isSelected ||
        node.citationCount >= 550 ||
        (matchingModalIds && matchingModalIds.has(node.id));
      if (!showLabel) continue;

      const r = modalRadiusScale(
        nodeSizing === 'citations' ? node.citationCount : node.relevanceScore
      );
      const lastName = node.authors[0]?.split(' ').pop() || 'VIS';
      const shortLabel = `${lastName} '${String(node.year).slice(-2)}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(shortLabel, node.x, node.y + r + 11);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(shortLabel, node.x, node.y + r + 11);
    }

    ctx.restore();
  }, [
    useModalCanvas,
    fullGraphLayout,
    modalZoomScale,
    layoutMode,
    activeFocusId,
    neighborIds,
    matchingModalIds,
    modalRadiusScale,
    nodeSizing,
    activeTopic.id,
  ]);

  const hitTestModalCanvasNode = (e: React.MouseEvent<HTMLCanvasElement>): PositionedNode | null => {
    const canvas = modalCanvasRef.current;
    if (!canvas || !fullGraphLayout) return null;
    const rect = canvas.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * modalWidth;
    const rawY = ((e.clientY - rect.top) / rect.height) * modalHeight;
    const graphX = (rawX - (modalWidth * (1 - modalZoomScale)) / 2) / modalZoomScale;
    const graphY = (rawY - (modalHeight * (1 - modalZoomScale)) / 2) / modalZoomScale;

    let bestNode: PositionedNode | null = null;
    let bestDist = Infinity;
    for (const node of fullGraphLayout.positionedNodes) {
      const r = modalRadiusScale(
        nodeSizing === 'citations' ? node.citationCount : node.relevanceScore
      );
      const d = Math.hypot(node.x - graphX, node.y - graphY);
      if (d <= r + 7 && d < bestDist) {
        bestDist = d;
        bestNode = node;
      }
    }
    return bestNode;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between h-full">
      {/* Header & Layout Controls */}
      <div className="space-y-2.5 mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Referencing &amp; Citation Network ({totalSubfieldCount} Subfield Papers)
              </h3>
              <button
                type="button"
                onClick={() => setIsFullNetworkModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-md transition-colors"
              >
                Expand Full Network
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing Core Citation Backbone ({positionedNodes.length} key papers ·{' '}
              {positionedLinks.length} links) — expand full network to explore all{' '}
              {totalSubfieldCount} subfield papers (+{totalCrossTopicCount} cross-topic citations)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle: [ Time-Aligned (Chronological) | Force-Directed (Clustered) ] */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setLayoutMode('chronological')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  layoutMode === 'chronological'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Time-Aligned (Chronological)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('force')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  layoutMode === 'force'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Force-Directed (Clustered)
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
                Size: Topic Fit
              </button>
            </div>

            {/* Standalone / Unlinked Papers Filter Toggle */}
            <button
              type="button"
              onClick={() => setHideStandalone((prev) => !prev)}
              aria-pressed={hideStandalone}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                hideStandalone
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              <span>Hide Standalone Papers (Unlinked)</span>
              {standaloneCount > 0 && (
                <span
                  className={`font-mono-tabular text-[10px] px-1 rounded ${
                    hideStandalone
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {standaloneCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Concise Visual Encoding Legend + Cross-Topic Citation Clarity Note */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: activeTopic.color }}
            />
            <strong>Node size</strong> ={' '}
            {nodeSizing === 'citations' ? 'Citation count' : 'Topic Fit (%)'}
          </span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono-tabular font-bold text-slate-700">←</span>
            <strong>Arrow direction</strong> = Cites previous work
            {layoutMode === 'chronological' ? ' (Newer → Older)' : ''}
          </span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-dashed border-slate-700 bg-slate-400/50" />
            <span>
              Includes influential cross-topic citations
              {subsetCrossTopicCount > 0 ? ` (${subsetCrossTopicCount} in preview)` : ''}
            </span>
          </span>
        </div>
      </div>

      {/* SVG Network Canvas (Core Citation Backbone Preview) */}
      <div className="relative border border-slate-100 bg-slate-50/50 rounded-md overflow-hidden">
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 bg-white/90 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono-tabular text-slate-600">
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(1.45, Number((z + 0.15).toFixed(2))))}
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
          {/* Bucketed SVG markers by integer radius so arrowheads stop cleanly at the circle rim */}
          <defs>
            {MARKER_RADIUS_BUCKETS.map((rb) => {
              const dynamicRefX = Number((9.5 + rb + 2).toFixed(1));
              return (
                <React.Fragment key={`marker-bucket-${rb}`}>
                  <marker
                    id={`citation-arrow-r${rb}`}
                    markerUnits="userSpaceOnUse"
                    viewBox="0 -5 10 10"
                    refX={dynamicRefX}
                    refY={0}
                    markerWidth={8}
                    markerHeight={8}
                    orient="auto"
                  >
                    <path d="M0,-4L10,0L0,4" fill="#64748B" />
                  </marker>
                  <marker
                    id={`citation-arrow-active-r${rb}`}
                    markerUnits="userSpaceOnUse"
                    viewBox="0 -5 10 10"
                    refX={dynamicRefX}
                    refY={0}
                    markerWidth={8.5}
                    markerHeight={8.5}
                    orient="auto"
                  >
                    <path d="M0,-4L10,0L0,4" fill="#0F172A" />
                  </marker>
                </React.Fragment>
              );
            })}
          </defs>

          <g
            transform={`translate(${(width * (1 - zoomScale)) / 2}, ${
              (height * (1 - zoomScale)) / 2
            }) scale(${zoomScale})`}
          >
            {/* Time Axis Grid when in Chronological mode */}
            {layoutMode === 'chronological' &&
              yearScale.ticks(6).map((yr) => (
                <g
                  key={yr}
                  transform={`translate(${yearScale(yr)}, 0)`}
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                >
                  <line
                    y1={18}
                    y2={height - 28}
                    stroke="#E2E8F0"
                    strokeDasharray="3,3"
                  />
                  <text
                    y={height - 10}
                    textAnchor="middle"
                    className="text-[10px] font-mono-tabular fill-slate-500"
                  >
                    {yr}
                  </text>
                </g>
              ))}

            {/* Directed Citation Curved Links (Citing Newer -> Cited Older) */}
            {positionedLinks.map((link, idx) => {
              const dx = link.target.x - link.source.x;
              const dy = link.target.y - link.source.y;
              const dr = Math.sqrt(dx * dx + dy * dy) * 1.35;
              const pathD = `M${link.source.x},${link.source.y}A${dr},${dr} 0 0,1 ${link.target.x},${link.target.y}`;

              const hasFocus = Boolean(activeFocusId);
              const isHighlighted =
                !hasFocus ||
                link.source.id === activeFocusId ||
                link.target.id === activeFocusId;

              const targetRadius = getBucketedRadius(
                radiusScale(
                  nodeSizing === 'citations'
                    ? link.target.citationCount
                    : link.target.relevanceScore
                )
              );

              const markerId =
                isHighlighted && hasFocus
                  ? `citation-arrow-active-r${targetRadius}`
                  : `citation-arrow-r${targetRadius}`;

              return (
                <path
                  key={`${link.source.id}->${link.target.id}-${idx}`}
                  d={pathD}
                  fill="none"
                  stroke={isHighlighted && hasFocus ? '#0F172A' : '#64748B'}
                  strokeWidth={isHighlighted && hasFocus ? 2 : 1.35}
                  strokeOpacity={isHighlighted ? 0.78 : 0.18}
                  markerEnd={`url(#${markerId})`}
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {/* Paper Nodes & Halo-Outlined Labels */}
            {positionedNodes.map((node) => {
              const r = radiusScale(
                nodeSizing === 'citations' ? node.citationCount : node.relevanceScore
              );
              const nodeTopic = getTopicById(node.primaryTopicId);
              const isCrossTopicNode =
                Boolean(node.isCrossTopic) || node.primaryTopicId !== activeTopic.id;
              const hasFocus = Boolean(activeFocusId);
              const isNeighbor = !hasFocus || neighborIds.has(node.id);
              const isSelected = node.id === activeFocusId;

              const lastName = node.authors[0]?.split(' ').pop() || 'VIS';
              const shortLabel = `${lastName} '${String(node.year).slice(-2)}`;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-opacity duration-150"
                  style={{ opacity: isNeighbor ? 1 : 0.25 }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() =>
                    setPinnedNodeId((prev) => (prev === node.id ? null : node.id))
                  }
                  onDoubleClick={() => onSelectPaper(node.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect paper ${node.title}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPinnedNodeId((prev) => (prev === node.id ? null : node.id));
                    }
                  }}
                >
                  {/* Enlarged invisible hitbox behind visible node to eliminate hover jitter */}
                  <circle r={r + 10} fill="transparent" opacity={0} />

                  {/* Visible Paper Circle (Cross-topic nodes use lower opacity & dashed border) */}
                  <circle
                    r={r}
                    fill={nodeTopic.color}
                    fillOpacity={isCrossTopicNode ? 0.58 : 0.92}
                    stroke={
                      isSelected
                        ? '#0F172A'
                        : isCrossTopicNode
                        ? '#334155'
                        : '#FFFFFF'
                    }
                    strokeWidth={isSelected ? 2.75 : 1.75}
                    strokeDasharray={isCrossTopicNode && !isSelected ? '3.5,2.5' : undefined}
                  />

                  {/* Offset label with white SVG halo outline for crisp readability over links */}
                  <text
                    y={r + 13}
                    textAnchor="middle"
                    style={{
                      paintOrder: 'stroke fill',
                      stroke: '#ffffff',
                      strokeWidth: '3px',
                      strokeLinejoin: 'round',
                      pointerEvents: 'none',
                    }}
                    className="text-[10px] font-mono-tabular font-semibold fill-slate-900 pointer-events-none"
                  >
                    {shortLabel}
                  </text>
                  {r >= 13 && (
                    <text
                      dy="0.35em"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none' }}
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

      {/* Focused Node Inspector Footer + Expand Full Network Action */}
      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2.5">
        <div
          className="min-h-[56px] flex items-center"
          data-testid="citation-network-paper-details"
        >
          {activeInspectNode ? (
            <div className="w-full flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500 font-mono-tabular flex flex-wrap items-center gap-1.5">
                  <span>{activeInspectNode.venue}</span>
                  <span>·</span>
                  <span>{activeInspectNode.year}</span>
                  <span>·</span>
                  <span>{activeInspectNode.citationCount.toLocaleString()} citations</span>
                  <span>·</span>
                  <span>Topic Fit: {Math.round(activeInspectNode.relevanceScore * 100)}%</span>
                  {(activeInspectNode.isCrossTopic ||
                    activeInspectNode.primaryTopicId !== activeTopic.id) && (
                    <>
                      <span>·</span>
                      <span className="text-slate-700 font-medium">
                        Cross-Topic ({getTopicById(activeInspectNode.primaryTopicId).shortName})
                      </span>
                    </>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-900 line-clamp-1 leading-snug mt-0.5">
                  {activeInspectNode.title}
                </div>
                <div className="text-xs text-slate-600 mt-0.5 line-clamp-1">
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
          ) : (
            <div className="w-full py-2 px-3 bg-slate-50 border border-dashed border-slate-200 rounded-md text-xs text-slate-500 text-center">
              Hover or click a node in the graph to view paper details.
            </div>
          )}
        </div>

        {/* Subset Summary Footer matching Topic Literature Ranking */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-mono-tabular">
            Showing {positionedNodes.length} core backbone papers of {totalSubfieldCount} subfield papers (+{totalCrossTopicCount} cross-topic)
          </span>
          <button
            type="button"
            data-testid="expand-full-network-btn"
            onClick={() => setIsFullNetworkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors shrink-0"
          >
            Expand Full Network ({fullActiveNodes.length} nodes)
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Full Citation Network Explorer Modal (All Subfield Papers + Cross-Topic Citation Bridges + Explicit UI Density Controls) */}
      {isFullNetworkModalOpen && fullGraphLayout && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="full-network-modal-title"
          data-testid="full-citation-network-modal"
          onClick={() => setIsFullNetworkModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-xs shrink-0"
                  style={{ backgroundColor: activeTopic.color }}
                />
                <div>
                  <h2
                    id="full-network-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Complete Citation Network — {activeTopic.name} ({fullGraphLayout.positionedNodes.length} nodes ·{' '}
                    {fullGraphLayout.positionedLinks.length} citation links)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Covers all {totalSubfieldCount} subfield papers plus {totalCrossTopicCount} directly cited/citing cross-topic papers (100% dataset fidelity; adjustable UI density filters below)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFullNetworkModalOpen(false)}
                aria-label="Close full network modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Controls Bar */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Highlight papers by title, author, or year..."
                  aria-label="Search nodes in full network"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLayoutMode('chronological')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      layoutMode === 'chronological'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Time-Aligned (Chronological)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('force')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      layoutMode === 'force'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Force-Directed (Clustered)
                  </button>
                </div>

                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setNodeSizing('citations')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
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
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      nodeSizing === 'relevance'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Size: Topic Fit
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setHideStandalone((prev) => !prev)}
                  aria-pressed={hideStandalone}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    hideStandalone
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                  <span>Hide Standalone Papers ({standaloneCount})</span>
                </button>

                {/* Explicit Visual Density Parameter Controls */}
                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <label
                    htmlFor="modal-node-limit-select"
                    className="text-[11px] font-medium text-slate-600 whitespace-nowrap"
                  >
                    Display:
                  </label>
                  <select
                    id="modal-node-limit-select"
                    aria-label="Modal node density limit"
                    value={modalMaxNodes === null ? 'ALL' : String(modalMaxNodes)}
                    onChange={(e) =>
                      setModalMaxNodes(e.target.value === 'ALL' ? null : Number(e.target.value))
                    }
                    className="text-xs font-mono-tabular font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="150">Top 150 (Fast)</option>
                    <option value="60">Top 60</option>
                    <option value="ALL">All ({fullActiveNodes.length})</option>
                  </select>
                </div>

                {fullActiveNodes.length > 150 && (
                  <button
                    type="button"
                    data-testid="modal-render-all-nodes-btn"
                    onClick={() =>
                      setModalMaxNodes((prev) => (prev === null ? 150 : null))
                    }
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                      modalMaxNodes === null
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {modalMaxNodes === null
                      ? 'Back to Top 150'
                      : `Render All ${fullActiveNodes.length} Nodes${fullActiveNodes.length > 250 ? ' (Canvas)' : ''}`}
                  </button>
                )}

                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <label
                    htmlFor="modal-min-cites-select"
                    className="text-[11px] font-medium text-slate-600 whitespace-nowrap"
                  >
                    Min Cites:
                  </label>
                  <select
                    id="modal-min-cites-select"
                    aria-label="Modal minimum citations filter"
                    value={String(modalMinCitations)}
                    onChange={(e) => setModalMinCitations(Number(e.target.value))}
                    className="text-xs font-mono-tabular font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="0">All (0+)</option>
                    <option value="10">≥ 10</option>
                    <option value="50">≥ 50</option>
                    <option value="150">≥ 150</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Full Network SVG Canvas */}
            <div className="relative flex-1 bg-slate-50/60 overflow-hidden px-4 py-2">
              <div className="absolute top-4 right-6 z-10 flex items-center gap-1 bg-white/95 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono-tabular text-slate-600 shadow-xs">
                <button
                  type="button"
                  onClick={() =>
                    setModalZoomScale((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))
                  }
                  className="px-1.5 hover:text-slate-900"
                  aria-label="Zoom in full network"
                >
                  +
                </button>
                <span>{Math.round(modalZoomScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() =>
                    setModalZoomScale((z) => Math.max(0.7, Number((z - 0.2).toFixed(2))))
                  }
                  className="px-1.5 hover:text-slate-900"
                  aria-label="Zoom out full network"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setModalZoomScale(1)}
                  className="ml-1 text-slate-500 hover:text-slate-900"
                  title="Reset zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {useModalCanvas ? (
                <canvas
                  ref={modalCanvasRef}
                  data-testid="full-network-canvas"
                  role="img"
                  aria-label={`Complete citation network canvas for ${activeTopic.name} (${fullGraphLayout.positionedNodes.length} nodes)`}
                  className="w-full h-auto max-h-[58vh] select-none cursor-pointer block"
                  onMouseMove={(e) => {
                    const hit = hitTestModalCanvasNode(e);
                    setHoveredNodeId(hit ? hit.id : null);
                  }}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={(e) => {
                    const hit = hitTestModalCanvasNode(e);
                    if (hit) {
                      setPinnedNodeId((prev) => (prev === hit.id ? null : hit.id));
                    }
                  }}
                  onDoubleClick={(e) => {
                    const hit = hitTestModalCanvasNode(e);
                    if (hit) {
                      setIsFullNetworkModalOpen(false);
                      onSelectPaper(hit.id);
                    }
                  }}
                />
              ) : (
                <svg
                  viewBox={`0 0 ${modalWidth} ${modalHeight}`}
                  className="w-full h-auto max-h-[58vh] select-none"
                  role="img"
                  aria-label={`Complete citation network graph for ${activeTopic.name}`}
                >
                  <defs>
                    {MARKER_RADIUS_BUCKETS.map((rb) => {
                      const dynamicRefX = Number((8.5 + rb + 2).toFixed(1));
                      return (
                        <React.Fragment key={`modal-marker-bucket-${rb}`}>
                          <marker
                            id={`modal-citation-arrow-r${rb}`}
                            markerUnits="userSpaceOnUse"
                            viewBox="0 -5 10 10"
                            refX={dynamicRefX}
                            refY={0}
                            markerWidth={7}
                            markerHeight={7}
                            orient="auto"
                          >
                            <path d="M0,-4L10,0L0,4" fill="#94A3B8" />
                          </marker>
                          <marker
                            id={`modal-citation-arrow-active-r${rb}`}
                            markerUnits="userSpaceOnUse"
                            viewBox="0 -5 10 10"
                            refX={dynamicRefX}
                            refY={0}
                            markerWidth={8}
                            markerHeight={8}
                            orient="auto"
                          >
                            <path d="M0,-4L10,0L0,4" fill="#0F172A" />
                          </marker>
                        </React.Fragment>
                      );
                    })}
                  </defs>

                  <g
                    transform={`translate(${(modalWidth * (1 - modalZoomScale)) / 2}, ${
                      (modalHeight * (1 - modalZoomScale)) / 2
                    }) scale(${modalZoomScale})`}
                  >
                    {layoutMode === 'chronological' &&
                      fullGraphLayout.yearScale.ticks(10).map((yr) => (
                        <g
                          key={yr}
                          transform={`translate(${fullGraphLayout.yearScale(yr)}, 0)`}
                          style={{ pointerEvents: 'none' }}
                        >
                          <line
                            y1={16}
                            y2={modalHeight - 28}
                            stroke="#E2E8F0"
                            strokeDasharray="3,3"
                          />
                          <text
                            y={modalHeight - 10}
                            textAnchor="middle"
                            className="text-[10px] font-mono-tabular fill-slate-500"
                          >
                            {yr}
                          </text>
                        </g>
                      ))}

                    {fullGraphLayout.positionedLinks.map((link, idx) => {
                      const dx = link.target.x - link.source.x;
                      const dy = link.target.y - link.source.y;
                      const dr = Math.sqrt(dx * dx + dy * dy) * 1.35;
                      const pathD = `M${link.source.x},${link.source.y}A${dr},${dr} 0 0,1 ${link.target.x},${link.target.y}`;

                      const hasFocus = Boolean(activeFocusId);
                      const isHighlighted =
                        !hasFocus ||
                        link.source.id === activeFocusId ||
                        link.target.id === activeFocusId;

                      const targetRadius = getBucketedRadius(
                        modalRadiusScale(
                          nodeSizing === 'citations'
                            ? link.target.citationCount
                            : link.target.relevanceScore
                        )
                      );

                      const markerId =
                        isHighlighted && hasFocus
                          ? `modal-citation-arrow-active-r${targetRadius}`
                          : `modal-citation-arrow-r${targetRadius}`;

                      return (
                        <path
                          key={`modal-${link.source.id}->${link.target.id}-${idx}`}
                          d={pathD}
                          fill="none"
                          stroke={isHighlighted && hasFocus ? '#0F172A' : '#94A3B8'}
                          strokeWidth={isHighlighted && hasFocus ? 1.8 : 0.9}
                          strokeOpacity={isHighlighted ? (hasFocus ? 0.85 : 0.36) : 0.08}
                          markerEnd={`url(#${markerId})`}
                          style={{ pointerEvents: 'none' }}
                        />
                      );
                    })}

                    {fullGraphLayout.positionedNodes.map((node) => {
                      const r = modalRadiusScale(
                        nodeSizing === 'citations' ? node.citationCount : node.relevanceScore
                      );
                      const nodeTopic = getTopicById(node.primaryTopicId);
                      const isCrossTopicNode =
                        Boolean(node.isCrossTopic) || node.primaryTopicId !== activeTopic.id;
                      const hasFocus = Boolean(activeFocusId);
                      const isNeighbor = !hasFocus || neighborIds.has(node.id);
                      const matchesSearch = !matchingModalIds || matchingModalIds.has(node.id);
                      const isSelected = node.id === activeFocusId;

                      const lastName = node.authors[0]?.split(' ').pop() || 'VIS';
                      const shortLabel = `${lastName} '${String(node.year).slice(-2)}`;
                      const showLabel =
                        isSelected ||
                        node.citationCount >= 550 ||
                        (matchingModalIds && matchingModalIds.has(node.id));

                      return (
                        <g
                          key={`modal-node-${node.id}`}
                          transform={`translate(${node.x}, ${node.y})`}
                          className="cursor-pointer transition-opacity duration-150"
                          style={{
                            opacity: !matchesSearch
                              ? 0.14
                              : isNeighbor
                              ? 1
                              : 0.22,
                          }}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onClick={() =>
                            setPinnedNodeId((prev) => (prev === node.id ? null : node.id))
                          }
                          onDoubleClick={() => {
                            setIsFullNetworkModalOpen(false);
                            onSelectPaper(node.id);
                          }}
                        >
                          <circle r={r + 8} fill="transparent" opacity={0} />
                          <circle
                            r={r}
                            fill={nodeTopic.color}
                            fillOpacity={isCrossTopicNode ? 0.55 : 0.92}
                            stroke={
                              isSelected
                                ? '#0F172A'
                                : isCrossTopicNode
                                ? '#334155'
                                : '#FFFFFF'
                            }
                            strokeWidth={isSelected ? 2.5 : 1.4}
                            strokeDasharray={isCrossTopicNode && !isSelected ? '3,2' : undefined}
                          />
                          {showLabel && (
                            <text
                              y={r + 11}
                              textAnchor="middle"
                              style={{
                                paintOrder: 'stroke fill',
                                stroke: '#ffffff',
                                strokeWidth: '3px',
                                strokeLinejoin: 'round',
                                pointerEvents: 'none',
                              }}
                              className="text-[9.5px] font-mono-tabular font-semibold fill-slate-900 pointer-events-none"
                            >
                              {shortLabel}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}
            </div>

            {/* Modal Footer Inspector */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              {activeInspectNode ? (
                <div className="w-full flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500 font-mono-tabular flex flex-wrap items-center gap-1.5">
                      <span>{activeInspectNode.venue}</span>
                      <span>·</span>
                      <span>{activeInspectNode.year}</span>
                      <span>·</span>
                      <span>{activeInspectNode.citationCount.toLocaleString()} citations</span>
                      <span>·</span>
                      <span>Topic Fit: {Math.round(activeInspectNode.relevanceScore * 100)}%</span>
                      {(activeInspectNode.isCrossTopic ||
                        activeInspectNode.primaryTopicId !== activeTopic.id) && (
                        <>
                          <span>·</span>
                          <span className="text-slate-700 font-medium">
                            Cross-Topic ({getTopicById(activeInspectNode.primaryTopicId).shortName})
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 line-clamp-1 mt-0.5">
                      {activeInspectNode.title}
                    </div>
                    <div className="text-xs text-slate-600">
                      {activeInspectNode.authors.join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFullNetworkModalOpen(false);
                        onSelectPaper(activeInspectNode.id);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Open Paper Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFullNetworkModalOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Hover or click any node in the complete network to inspect paper metadata, or double-click to open its Paper Profile.
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFullNetworkModalOpen(false)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
