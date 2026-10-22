import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperDetailResponse, PaperSummary } from '../types';
import { getTopicById } from '../utils/analyticsLogic';
import { ArrowUpRight, BookOpen, Filter, GitBranch, Info, Pin, Quote } from 'lucide-react';

interface PaperEgoNetworkProps {
  paper: PaperDetailResponse;
  onSelectPaper: (paperId: string) => void;
  onSelectTopic: (topicId: string) => void;
}

type EgoRelationType = 'focal' | 'reference' | 'citedBy' | 'related';

interface EgoNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  year: number;
  venue: string;
  citationCount: number;
  relevanceScore: number;
  primaryTopicId: string;
  authors: string[];
  relation: EgoRelationType;
  radius: number;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
}

interface EgoLink {
  id: string;
  source: EgoNode;
  target: EgoNode;
  relation: Exclude<EgoRelationType, 'focal'>;
}

export const PaperEgoNetwork: React.FC<PaperEgoNetworkProps> = ({
  paper,
  onSelectPaper,
  onSelectTopic,
}) => {
  const [relationFilter, setRelationFilter] = useState<'all' | 'reference' | 'citedBy' | 'related'>('all');
  // Graph node selection criteria controls (directly updates the D3 graph on the left)
  const [selectionMetric, setSelectionMetric] = useState<'citations' | 'recent'>('citations');
  const [sectorLimitMode, setSectorLimitMode] = useState<'compact' | 'expanded'>('compact');
  // Right list scope: show only plotted graph nodes vs all connected papers
  const [directoryScope, setDirectoryScope] = useState<'graphed' | 'all'>('graphed');

  // Separate hover states for graph vs list so hovering in the graph promotes the paper to #1,
  // while clicking a node in the graph fixes (pins) it at #1.
  const [graphHoveredNodeId, setGraphHoveredNodeId] = useState<string | null>(null);
  const [listHoveredNodeId, setListHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  const listScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setGraphHoveredNodeId(null);
    setListHoveredNodeId(null);
    setPinnedNodeId(null);
    setRelationFilter('all');
    setDirectoryScope('graphed');
  }, [paper.id]);

  // Whenever a node is hovered or clicked in the graph, scroll the right-hand list to the top
  // so the promoted #1 paper is immediately visible.
  useEffect(() => {
    if ((graphHoveredNodeId || pinnedNodeId) && listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, [graphHoveredNodeId, pinnedNodeId]);

  const width = 760;
  const height = 435;
  const cx = width / 2;
  const cy = height / 2;

  const maxPerSector =
    sectorLimitMode === 'compact'
      ? relationFilter === 'all'
        ? 6
        : 10
      : relationFilter === 'all'
      ? 10
      : 16;

  // Build ego-network nodes and links with D3 force simulation + radial sector anchors
  const {
    egoNodes,
    egoLinks,
    presentTopicIds,
    sameDomainCount,
    crossDomainCount,
    allFilteredCandidates,
  } = useMemo(() => {
    const nodeMap = new Map<string, EgoNode>();

    // 1. Center Focal Paper Node
    const focalNode: EgoNode = {
      id: paper.id,
      title: paper.title,
      year: paper.year,
      venue: paper.venue,
      citationCount: paper.citationCount,
      relevanceScore: 1.0,
      primaryTopicId: paper.primaryTopicId,
      authors: paper.authors.map((a) => a.name),
      relation: 'focal',
      radius: 24,
      x: cx,
      y: cy,
      fx: cx,
      fy: cy,
    };
    nodeMap.set(focalNode.id, focalNode);

    const allCandidates: Array<{ summary: PaperSummary; rel: Exclude<EgoRelationType, 'focal'> }> = [];
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

    const maxCite =
      d3.max(allCandidates, (c) => c.summary.citationCount) ||
      paper.citationCount ||
      1000;
    const rScale = d3
      .scaleSqrt()
      .domain([0, maxCite])
      .range(sectorLimitMode === 'expanded' ? [9, 18] : [11, 20]);

    const compareCandidate = (
      a: { summary: PaperSummary },
      b: { summary: PaperSummary }
    ) => {
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

    const refList = allCandidates
      .filter((c) => c.rel === 'reference')
      .sort(compareCandidate)
      .slice(0, maxPerSector);
    const citedByList = allCandidates
      .filter((c) => c.rel === 'citedBy')
      .sort(compareCandidate)
      .slice(0, maxPerSector);
    const relatedList = allCandidates
      .filter((c) => c.rel === 'related')
      .sort(compareCandidate)
      .slice(0, relationFilter === 'related' ? maxPerSector : Math.min(6, maxPerSector));

    const addSectorNodes = (
      items: Array<{ summary: PaperSummary; rel: Exclude<EgoRelationType, 'focal'> }>,
      angles: number[],
      distX: number,
      distY: number
    ) => {
      items.forEach((item, idx) => {
        if (nodeMap.has(item.summary.id)) return;
        const angle = angles[idx % angles.length];
        const ringOffset = idx >= angles.length ? 1.18 : 1.0;
        const targetX = cx + Math.cos(angle) * distX * ringOffset;
        const targetY = cy + Math.sin(angle) * distY * ringOffset;
        nodeMap.set(item.summary.id, {
          id: item.summary.id,
          title: item.summary.title,
          year: item.summary.year,
          venue: item.summary.venue,
          citationCount: item.summary.citationCount,
          relevanceScore: item.summary.relevanceScore,
          primaryTopicId: item.summary.primaryTopicId,
          authors: item.summary.authors.map((a) => a.name),
          relation: item.rel,
          radius: rScale(item.summary.citationCount),
          x: targetX,
          y: targetY,
        });
      });
    };

    // Left arc angles for Foundational References (around PI)
    addSectorNodes(
      refList,
      [Math.PI, Math.PI - 0.45, Math.PI + 0.45, Math.PI - 0.82, Math.PI + 0.82, Math.PI - 0.22, Math.PI + 0.22],
      225,
      145
    );

    // Right arc angles for Cited By (around 0)
    addSectorNodes(
      citedByList,
      [0, -0.45, 0.45, -0.82, 0.82, -0.22, 0.22],
      225,
      145
    );

    // Top & Bottom arcs for Conceptual Neighbors (around -PI/2 and +PI/2)
    addSectorNodes(
      relatedList,
      [
        -Math.PI / 2,
        Math.PI / 2,
        -Math.PI / 2 - 0.46,
        Math.PI / 2 + 0.46,
        -Math.PI / 2 + 0.46,
        Math.PI / 2 - 0.46,
      ],
      185,
      150
    );

    const nodesArr = Array.from(nodeMap.values());
    const targetPos = new Map(nodesArr.map((n) => [n.id, { x: n.x, y: n.y }]));

    const collidePad = sectorLimitMode === 'expanded' ? 24 : 32;

    // Run D3 collision & spring layout while keeping the focal paper locked at the exact center
    const simulation = d3
      .forceSimulation<EgoNode>(nodesArr)
      .force(
        'x',
        d3.forceX<EgoNode>((d) => targetPos.get(d.id)?.x ?? cx).strength(0.65)
      )
      .force(
        'y',
        d3.forceY<EgoNode>((d) => targetPos.get(d.id)?.y ?? cy).strength(0.65)
      )
      .force('charge', d3.forceManyBody<EgoNode>().strength(sectorLimitMode === 'expanded' ? -190 : -260))
      .force(
        'collide',
        d3
          .forceCollide<EgoNode>()
          .radius((d) => d.radius + collidePad)
          .strength(0.98)
          .iterations(4)
      )
      .stop();

    for (let i = 0; i < 160; i++) {
      simulation.tick();
      for (const n of nodesArr) {
        if (n.id === paper.id) {
          n.x = cx;
          n.y = cy;
        } else {
          n.x = Math.max(68, Math.min(width - 68, n.x));
          n.y = Math.max(44, Math.min(height - 44, n.y));
        }
      }
    }

    // Build directed & conceptual links
    const linksArr: EgoLink[] = [];
    for (const n of nodesArr) {
      if (n.id === focalNode.id) continue;
      if (n.relation === 'reference') {
        linksArr.push({
          id: `ref-${focalNode.id}->${n.id}`,
          source: focalNode,
          target: n,
          relation: 'reference',
        });
      } else if (n.relation === 'citedBy') {
        linksArr.push({
          id: `citedby-${n.id}->${focalNode.id}`,
          source: n,
          target: focalNode,
          relation: 'citedBy',
        });
      } else {
        linksArr.push({
          id: `rel-${focalNode.id}<->${n.id}`,
          source: focalNode,
          target: n,
          relation: 'related',
        });
      }
    }

    const topicSet = new Set<string>();
    let sameCnt = 0;
    let crossCnt = 0;
    for (const n of nodesArr) {
      topicSet.add(n.primaryTopicId);
      if (n.id !== focalNode.id) {
        if (n.primaryTopicId === focalNode.primaryTopicId) {
          sameCnt += 1;
        } else {
          crossCnt += 1;
        }
      }
    }

    // Deduplicate allCandidates by paper id and sort according to selectionMetric
    const seenIds = new Set<string>();
    const dedupedCandidates = allCandidates
      .filter((c) => {
        if (c.summary.id === paper.id || seenIds.has(c.summary.id)) return false;
        seenIds.add(c.summary.id);
        return true;
      })
      .sort(compareCandidate);

    return {
      egoNodes: nodesArr,
      egoLinks: linksArr,
      presentTopicIds: Array.from(topicSet),
      sameDomainCount: sameCnt,
      crossDomainCount: crossCnt,
      allFilteredCandidates: dedupedCandidates,
    };
  }, [paper, relationFilter, selectionMetric, sectorLimitMode, cx, cy, maxPerSector]);

  const plottedNeighborNodes = useMemo(
    () => egoNodes.filter((n) => n.id !== paper.id),
    [egoNodes, paper.id]
  );
  const plottedNodeIdSet = useMemo(
    () => new Set(plottedNeighborNodes.map((n) => n.id)),
    [plottedNeighborNodes]
  );

  // Active node highlighted in the graph:
  // Hovered node in graph takes visual priority; otherwise pinned node or list-hovered node
  const activeGraphFocusId = graphHoveredNodeId || pinnedNodeId || listHoveredNodeId || null;

  // The paper promoted to the #1 slot at the top of the right-hand list:
  // When hovering a node in the graph, it becomes #1 immediately;
  // when clicking a node in the graph, it fixes (pins) at #1!
  const promotedPaperId =
    graphHoveredNodeId && graphHoveredNodeId !== paper.id
      ? graphHoveredNodeId
      : pinnedNodeId && pinnedNodeId !== paper.id
      ? pinnedNodeId
      : null;

  const directoryItems = useMemo(() => {
    const basePool =
      directoryScope === 'graphed'
        ? allFilteredCandidates.filter((c) => plottedNodeIdSet.has(c.summary.id))
        : allFilteredCandidates;

    if (!promotedPaperId) {
      return basePool;
    }

    // Find the promoted paper (from allFilteredCandidates so it works even if scope is 'graphed')
    const promotedEntry =
      basePool.find((c) => c.summary.id === promotedPaperId) ||
      allFilteredCandidates.find((c) => c.summary.id === promotedPaperId);

    if (!promotedEntry) {
      return basePool;
    }

    // Place the hovered/pinned paper at index 0 and remove it from its original position so it never duplicates
    return [
      promotedEntry,
      ...basePool.filter((c) => c.summary.id !== promotedPaperId),
    ];
  }, [allFilteredCandidates, directoryScope, plottedNodeIdSet, promotedPaperId]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      {/* Header & Relation Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:flex-nowrap lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">
              Local Ego-Network Graph · Citation &amp; Topic Lineage
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono-tabular font-medium text-blue-800 bg-blue-50 border border-blue-200/80 rounded whitespace-nowrap shrink-0">
              <Info className="w-3 h-3 text-blue-600 shrink-0" />
              Plotting {plottedNeighborNodes.length} of {allFilteredCandidates.length} Connections
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 truncate">
            Hover a node to preview it at #1 on the right, or <strong>click to pin it</strong> ({sameDomainCount} same-domain · {crossDomainCount} cross-domain).
          </p>
        </div>

        {/* Interactive Relationship Filter Buttons */}
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 self-start">
          <button
            type="button"
            onClick={() => setRelationFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              relationFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Connections ({paper.referencesPapers.length + paper.citedByPapers.length + paper.relatedPapers.length})
          </button>
          <button
            type="button"
            onClick={() => setRelationFilter('reference')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              relationFilter === 'reference'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3 h-3 text-blue-600" />
            Foundational References ({paper.referencesPapers.length})
          </button>
          <button
            type="button"
            onClick={() => setRelationFilter('citedBy')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              relationFilter === 'citedBy'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Quote className="w-3 h-3 text-emerald-600" />
            Cited By ({paper.citedByPapers.length})
          </button>
          <button
            type="button"
            onClick={() => setRelationFilter('related')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              relationFilter === 'related'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitBranch className="w-3 h-3 text-purple-600" />
            Related Papers ({paper.relatedPapers.length})
          </button>
        </div>
      </div>

      {/* Topic Coloring & Edge Legend Bar */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 h-[38px] bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-600 overflow-x-auto">
        <div className="flex items-center gap-3 whitespace-nowrap min-w-0 overflow-x-auto">
          <span className="font-semibold text-slate-800 shrink-0">Node Color = Assigned Topic:</span>
          {presentTopicIds.map((tid) => {
            const t = getTopicById(tid);
            const isSame = tid === paper.primaryTopicId;
            return (
              <button
                key={tid}
                type="button"
                onClick={() => onSelectTopic(tid)}
                className="inline-flex items-center gap-1.5 hover:underline text-slate-800 shrink-0"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className={isSame ? 'font-semibold' : ''}>
                  {t.shortName} {isSame ? '(Same Domain)' : '(External Domain)'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 font-mono-tabular text-[11px] text-slate-600 shrink-0 whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-0.5 bg-slate-700 inline-block" />
            Directed Citation Arrow
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-0 border-t-2 border-dashed border-purple-500 inline-block" />
            Topic Similarity
          </span>
        </div>
      </div>

      {/* Main Split: D3 Ego-Network Canvas (Left 8 cols) + Graph Selection Criteria & Dynamic Paper List (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 border border-slate-100 bg-slate-50/50 rounded-md overflow-hidden flex items-center justify-center">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none"
            role="img"
            aria-label={`Local citation ego-network graph centered on ${paper.title}`}
            data-testid="paper-ego-network-svg"
          >
            {/* Dynamic per-node SVG markers with exact target radius refX so arrowheads stop at the circle edge */}
            <defs>
              {egoNodes.map((node) => {
                const extraRing = node.relation === 'focal' ? 5 : 2;
                const dynamicRefX = Number((9.5 + node.radius + extraRing).toFixed(1));
                return (
                  <React.Fragment key={`ego-marker-${node.id}`}>
                    <marker
                      id={`ego-arrow-${node.id}`}
                      markerUnits="userSpaceOnUse"
                      viewBox="0 -5 10 10"
                      refX={dynamicRefX}
                      refY={0}
                      markerWidth={8.5}
                      markerHeight={8.5}
                      orient="auto"
                    >
                      <path d="M0,-4L10,0L0,4" fill="#475569" />
                    </marker>
                    <marker
                      id={`ego-arrow-active-${node.id}`}
                      markerUnits="userSpaceOnUse"
                      viewBox="0 -5 10 10"
                      refX={dynamicRefX}
                      refY={0}
                      markerWidth={9}
                      markerHeight={9}
                      orient="auto"
                    >
                      <path d="M0,-4L10,0L0,4" fill="#0F172A" />
                    </marker>
                  </React.Fragment>
                );
              })}
            </defs>

            {/* Subtle Sector Backdrop Guides */}
            <g className="pointer-events-none" style={{ pointerEvents: 'none' }}>
              <text
                x={105}
                y={24}
                textAnchor="middle"
                className="text-[10px] font-mono-tabular uppercase tracking-wider fill-blue-700 font-semibold"
              >
                ← Foundational References ({Math.min(maxPerSector, paper.referencesPapers.length)} of {paper.referencesPapers.length})
              </text>
              <text
                x={width / 2}
                y={24}
                textAnchor="middle"
                className="text-[10px] font-mono-tabular uppercase tracking-wider fill-purple-700 font-semibold"
              >
                Conceptual Neighbors
              </text>
              <text
                x={width - 105}
                y={24}
                textAnchor="middle"
                className="text-[10px] font-mono-tabular uppercase tracking-wider fill-emerald-700 font-semibold"
              >
                Cited By in VIS ({Math.min(maxPerSector, paper.citedByPapers.length)} of {paper.citedByPapers.length}) →
              </text>
            </g>

            {/* Ego-Network Links */}
            {egoLinks.map((link) => {
              const isRelated = link.relation === 'related';
              const isHovered =
                activeGraphFocusId === link.source.id || activeGraphFocusId === link.target.id;

              const dx = link.target.x - link.source.x;
              const dy = link.target.y - link.source.y;
              const dr = Math.sqrt(dx * dx + dy * dy) * 1.45;
              const pathD = isRelated
                ? `M${link.source.x},${link.source.y}L${link.target.x},${link.target.y}`
                : `M${link.source.x},${link.source.y}A${dr},${dr} 0 0,1 ${link.target.x},${link.target.y}`;

              const markerId = isRelated
                ? undefined
                : isHovered
                ? `url(#ego-arrow-active-${link.target.id})`
                : `url(#ego-arrow-${link.target.id})`;

              return (
                <path
                  key={link.id}
                  d={pathD}
                  fill="none"
                  stroke={
                    isHovered
                      ? '#0F172A'
                      : isRelated
                      ? '#9333EA'
                      : '#475569'
                  }
                  strokeWidth={isHovered ? 2.25 : 1.5}
                  strokeOpacity={isHovered ? 0.92 : isRelated ? 0.55 : 0.75}
                  strokeDasharray={isRelated ? '4,4' : undefined}
                  markerEnd={markerId}
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {/* Ego-Network Nodes */}
            {egoNodes.map((node) => {
              const nodeTopic = getTopicById(node.primaryTopicId);
              const isFocal = node.relation === 'focal';
              const isSameDomain = node.primaryTopicId === paper.primaryTopicId;
              const isHovered = activeGraphFocusId === node.id;
              const isPinned = pinnedNodeId === node.id;

              const lastName = node.authors[0]?.split(' ').pop() || 'VIS';
              const shortLabel = isFocal
                ? `${lastName} '${String(node.year).slice(-2)} (This Paper)`
                : `${lastName} '${String(node.year).slice(-2)}`;

              const relationBadge =
                node.relation === 'reference'
                  ? 'Ref'
                  : node.relation === 'citedBy'
                  ? 'Cites'
                  : node.relation === 'related'
                  ? 'Sim'
                  : '';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    if (!isFocal) setGraphHoveredNodeId(node.id);
                  }}
                  onMouseLeave={() => {
                    if (!isFocal) setGraphHoveredNodeId(null);
                  }}
                  onClick={() => {
                    if (!isFocal) {
                      setPinnedNodeId((prev) => (prev === node.id ? null : node.id));
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isFocal) onSelectPaper(node.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${isFocal ? 'Current paper' : `Pin ${node.relation} paper`} ${node.title}`}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isFocal) {
                      e.preventDefault();
                      setPinnedNodeId((prev) => (prev === node.id ? null : node.id));
                    }
                  }}
                >
                  {/* Enlarged invisible hitbox circle to prevent hover flickering */}
                  <circle r={node.radius + 12} fill="transparent" opacity={0} />

                  {/* Outer focal halo ring for the center paper or pinned neighbor */}
                  {(isFocal || isPinned) && (
                    <circle
                      r={node.radius + 5}
                      fill="none"
                      stroke={isPinned ? '#2563EB' : '#0F172A'}
                      strokeWidth={2}
                      strokeDasharray={isFocal ? '3,2' : undefined}
                      className="pointer-events-none"
                    />
                  )}

                  {/* Node Circle Colored Strictly by Assigned Research Topic */}
                  <circle
                    r={node.radius}
                    fill={nodeTopic.color}
                    fillOpacity={isFocal ? 1 : isSameDomain ? 0.94 : 0.78}
                    stroke={isFocal || isHovered || isPinned ? '#0F172A' : '#FFFFFF'}
                    strokeWidth={isFocal || isHovered || isPinned ? 2.75 : 2}
                  />

                  {/* Inside Citation Count */}
                  <text
                    dy="0.35em"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                    className="text-[9px] font-mono-tabular font-semibold fill-white pointer-events-none"
                  >
                    {node.citationCount >= 1000
                      ? `${(node.citationCount / 1000).toFixed(1)}k`
                      : node.citationCount}
                  </text>

                  {/* Halo-Outlined Label Beneath Circle */}
                  <text
                    y={node.radius + (isFocal ? 17 : 13)}
                    textAnchor="middle"
                    style={{
                      paintOrder: 'stroke fill',
                      stroke: '#ffffff',
                      strokeWidth: '3.5px',
                      strokeLinejoin: 'round',
                      pointerEvents: 'none',
                    }}
                    className={`font-mono-tabular pointer-events-none ${
                      isFocal
                        ? 'text-[11px] font-bold fill-slate-950'
                        : 'text-[10px] font-semibold fill-slate-900'
                    }`}
                  >
                    {shortLabel}
                    {relationBadge ? ` · ${relationBadge}` : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right 4 Cols: Graph Node Selection Criteria Controls + Synchronized Paper List */}
        <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3">
          {/* Top Card (CSS selector 2): Graph Node Selection Criteria (Directly controls the graph on the left + list scope) */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Filter className="w-3 h-3 text-blue-600 shrink-0" />
                Node Selection Criteria
              </span>
              <span className="text-[11px] font-mono-tabular font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                {plottedNeighborNodes.length} / {allFilteredCandidates.length} in Graph
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-snug truncate">
              Rank &amp; cap nodes from the <strong>{allFilteredCandidates.length}</strong> connected papers:
            </p>

            {/* Controls that directly update the D3 Graph on the left */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center p-0.5 bg-slate-100 rounded">
                <button
                  type="button"
                  onClick={() => setSelectionMetric('citations')}
                  className={`flex-1 py-1 px-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    selectionMetric === 'citations'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Most Cited
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMetric('recent')}
                  className={`flex-1 py-1 px-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    selectionMetric === 'recent'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Newest
                </button>
              </div>

              <div className="flex items-center p-0.5 bg-slate-100 rounded">
                <button
                  type="button"
                  onClick={() => setSectorLimitMode('compact')}
                  className={`flex-1 py-1 px-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    sectorLimitMode === 'compact'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top {relationFilter === 'all' ? 6 : 10}/Sector
                </button>
                <button
                  type="button"
                  onClick={() => setSectorLimitMode('expanded')}
                  className={`flex-1 py-1 px-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    sectorLimitMode === 'expanded'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top {relationFilter === 'all' ? 10 : 16}/Sector
                </button>
              </div>
            </div>

            {/* Directory Scope Toggle: [ Graphed Nodes | All Connected ] */}
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-500 font-medium whitespace-nowrap">List below:</span>
              <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded shrink-0">
                <button
                  type="button"
                  onClick={() => setDirectoryScope('graphed')}
                  className={`py-0.5 px-2 font-medium rounded transition-colors whitespace-nowrap ${
                    directoryScope === 'graphed'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Graphed ({plottedNeighborNodes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryScope('all')}
                  className={`py-0.5 px-2 font-medium rounded transition-colors whitespace-nowrap ${
                    directoryScope === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({allFilteredCandidates.length})
                </button>
              </div>
            </div>
          </div>

          {/* Synchronized Paper List: Fixed height so the card never changes height when switching filters */}
          <div
            ref={listScrollRef}
            className="h-[295px] min-h-[295px] max-h-[295px] overflow-y-auto divide-y divide-slate-200/80 pr-1"
            data-testid="ego-network-paper-list"
          >
            {directoryItems.map(({ summary: item, rel }, idx) => {
              const nTopic = getTopicById(item.primaryTopicId);
              const isSame = item.primaryTopicId === paper.primaryTopicId;
              const isPlotted = plottedNodeIdSet.has(item.id);
              const isPromotedFirst = idx === 0 && item.id === promotedPaperId;
              const isPinned = pinnedNodeId === item.id;
              const isGraphHovered = graphHoveredNodeId === item.id;

              return (
                <div
                  key={`${rel}-${item.id}`}
                  onMouseEnter={() => {
                    if (isPlotted) setListHoveredNodeId(item.id);
                  }}
                  onMouseLeave={() => {
                    if (isPlotted) setListHoveredNodeId(null);
                  }}
                  className={`py-2.5 first:pt-1.5 px-2.5 rounded transition-colors ${
                    isPromotedFirst
                      ? 'bg-white shadow-xs border-l-3 border-blue-600 mb-1'
                      : 'hover:bg-white/80'
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setPinnedNodeId((prev) => (prev === item.id ? null : item.id))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPinnedNodeId((prev) => (prev === item.id ? null : item.id));
                      }
                    }}
                    className="w-full text-left cursor-pointer flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono-tabular text-slate-500">
                        {isPinned && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-blue-600 text-white text-[10px] font-semibold rounded">
                            <Pin className="w-2.5 h-2.5" />
                            Pinned #1
                          </span>
                        )}
                        {!isPinned && isGraphHovered && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-900 text-white text-[10px] font-semibold rounded">
                            Hovered #1
                          </span>
                        )}
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: nTopic.color }}
                        />
                        <span className="font-semibold text-slate-700">
                          {rel === 'reference'
                            ? 'Ref'
                            : rel === 'citedBy'
                            ? 'Cited By'
                            : 'Related'}
                        </span>
                        <span>·</span>
                        <span>{item.year}</span>
                        <span>·</span>
                        <span>{isSame ? 'Same Topic' : nTopic.shortName}</span>
                        {!isPlotted && (
                          <span className="text-[10px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded">
                            List Only
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 line-clamp-2 mt-0.5 font-serif-scholarly leading-snug">
                        {item.title}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono-tabular font-semibold text-slate-700 shrink-0">
                      {item.citationCount.toLocaleString()}c
                    </span>
                  </div>

                  {/* Expanded Details when Hovered or Pinned at #1 */}
                  {isPromotedFirst && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="text-[11px] text-slate-600">
                        {item.authors.map((a) => a.name).join(', ')} ·{' '}
                        <span className="font-mono-tabular text-slate-500">
                          {item.venue} ({item.year})
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-slate-500">
                          Topic:{' '}
                          <strong className="text-slate-700">
                            {nTopic.shortName}
                          </strong>{' '}
                          ({isSame ? 'Same Domain' : 'Cross-Domain'})
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isPinned && (
                            <button
                              type="button"
                              onClick={() => setPinnedNodeId(null)}
                              className="px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                              Unpin
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectPaper(item.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                          >
                            Open Paper
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
