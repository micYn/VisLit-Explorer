import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  TopicCorrelationEdge,
  TopicSummary,
  YearlyTopicPrevalence,
} from '../types';
import {
  computeTopicMomentum,
  getCorrelationBetween,
  getCorrelationEdge,
  getCorrelationGraphEdges,
} from '../utils/analyticsLogic';
import { ArrowUpRight, ChevronDown, ChevronUp, Grid, Network, TrendingUp } from 'lucide-react';

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
  // Default to Paper Count silhouette (narrower early years, wider recent years) + 3-Year Rolling Smoothing
  const [metricMode, setMetricMode] = useState<'prevalence' | 'counts'>('counts');
  const [smoothingMode, setSmoothingMode] = useState<'smoothed' | 'raw'>('smoothed');
  const [startYear, setStartYear] = useState<number>(1990);
  const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null);
  const [pinnedTopicId, setPinnedTopicId] = useState<string | null>(null);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const [isPointerInsideChart, setIsPointerInsideChart] = useState<boolean>(false);
  const [spotlightMode, setSpotlightMode] = useState<'all' | 'surging' | 'dropping'>('all');

  const [correlationView, setCorrelationView] = useState<'network' | 'matrix'>('network');
  const [hoveredMatrixCell, setHoveredMatrixCell] = useState<{
    rowId: string;
    colId: string;
  } | null>(null);
  const [showAllBridges, setShowAllBridges] = useState<boolean>(false);
  const [correlationThreshold, setCorrelationThreshold] = useState<number>(0.2);
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  const topicMomentum = useMemo(
    () => computeTopicMomentum(topics, streamData),
    [topics, streamData]
  );
  const topRisingMomentum = useMemo(() => {
    const surging = topicMomentum.filter((m) => m.regime === 'Surging');
    if (surging.length >= 3) return surging.slice(0, 3);
    const seen = new Set(surging.map((m) => m.topicId));
    const extras = topicMomentum.filter((m) => m.isRising && !seen.has(m.topicId));
    return [...surging, ...extras].slice(0, 3);
  }, [topicMomentum]);
  const topRisingIdSet = useMemo(
    () => new Set(topRisingMomentum.map((m) => m.topicId)),
    [topRisingMomentum]
  );
  const droppingMomentum = useMemo(
    () =>
      topicMomentum
        .filter((m) => m.regime === 'Past Peak' || (m.dropFromPeak <= -0.04 && !m.isRising))
        .sort((a, b) => a.dropFromPeak - b.dropFromPeak),
    [topicMomentum]
  );
  const droppingIdSet = useMemo(
    () => new Set(droppingMomentum.map((m) => m.topicId)),
    [droppingMomentum]
  );
  const momentumByTopicId = useMemo(
    () => new Map(topicMomentum.map((m) => [m.topicId, m])),
    [topicMomentum]
  );

  const activeFocusTopicId = hoveredTopicId ?? pinnedTopicId;

  const minStreamYear = streamData[0]?.year ?? 1990;
  const maxStreamYear = streamData[streamData.length - 1]?.year ?? 2025;
  const totalCorpusPapers = topics.reduce((acc, t) => acc + t.paperCount, 0);

  const uniqueBridgePairs = useMemo(
    () => correlations.filter((c) => c.sourceTopicId < c.targetTopicId),
    [correlations]
  );

  const filteredStreamData = useMemo(
    () => streamData.filter((d) => d.year >= startYear),
    [streamData, startYear]
  );

  const rawByYear = useMemo(() => {
    const map = new Map<number, YearlyTopicPrevalence>();
    for (const row of filteredStreamData) {
      map.set(row.year, row);
    }
    return map;
  }, [filteredStreamData]);

  // SVG dimensions with generous vertical breathing room
  const width = 1160;
  const height = 410;
  const margin = { top: 18, right: 20, bottom: 32, left: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Compute smoothed or raw series with D3 Catmull-Rom curve interpolation
  const {
    stackedSeries,
    xScale,
    yScale,
    areaGenerator,
    yTicks,
  } = useMemo(() => {
    const keys = topics.map((t) => t.id);

    const flatRows = filteredStreamData.map((row, idx) => {
      const obj: Record<string, number> = { year: row.year };
      const lo = smoothingMode === 'smoothed' ? Math.max(0, idx - 1) : idx;
      const hi =
        smoothingMode === 'smoothed'
          ? Math.min(filteredStreamData.length - 1, idx + 1)
          : idx;
      const winLen = hi - lo + 1;

      if (metricMode === 'prevalence') {
        let rowSum = 0;
        for (const k of keys) {
          let acc = 0;
          for (let j = lo; j <= hi; j++) {
            acc += filteredStreamData[j].values[k] ?? 0;
          }
          const avg = acc / winLen;
          obj[k] = avg;
          rowSum += avg;
        }
        const normFactor = rowSum > 0 ? 100 / rowSum : 0;
        for (const k of keys) {
          obj[k] = obj[k] * normFactor;
        }
      } else {
        for (const k of keys) {
          let acc = 0;
          for (let j = lo; j <= hi; j++) {
            acc += filteredStreamData[j].counts[k] ?? 0;
          }
          obj[k] = acc / winLen;
        }
      }
      return obj;
    });

    const stackGen = d3
      .stack<Record<string, number>>()
      .keys(keys)
      .order(d3.stackOrderNone)
      .offset(
        metricMode === 'prevalence'
          ? d3.stackOffsetNone
          : d3.stackOffsetSilhouette
      );

    const series = stackGen(flatRows);

    const xDomain = d3.extent(flatRows, (d) => d.year) as [number, number];
    const x = d3
      .scaleLinear()
      .domain(xDomain[0] ? xDomain : [1990, 2025])
      .range([0, innerWidth]);

    let yMin = 0;
    let yMax = 100;
    if (metricMode === 'counts') {
      yMin = d3.min(series, (layer) => d3.min(layer, (d) => d[0])) ?? -80;
      yMax = d3.max(series, (layer) => d3.max(layer, (d) => d[1])) ?? 80;
      const pad = Math.max(4, (yMax - yMin) * 0.06);
      yMin -= pad;
      yMax += pad;
    }

    const y = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const ticks = metricMode === 'prevalence' ? [0, 25, 50, 75, 100] : [];

    return {
      stackedSeries: series,
      xScale: x,
      yScale: y,
      areaGenerator: area,
      yTicks: ticks,
    };
  }, [topics, filteredStreamData, metricMode, smoothingMode, innerWidth, innerHeight]);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicSummary>();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  // Collision-aware direct ribbon label placement so all 8 topic names sit cleanly on their streams without overlap
  const ribbonLabels = useMemo(() => {
    interface PlacedLabel {
      topicId: string;
      shortName: string;
      color: string;
      x: number;
      y: number;
      w: number;
      thickness: number;
    }

    const layerStats = stackedSeries
      .map((layer) => {
        const topic = topicMap.get(layer.key);
        if (!topic || layer.length === 0) return null;
        let maxThickness = 0;
        for (const pt of layer) {
          const th = Math.abs(yScale(pt[0]) - yScale(pt[1]));
          if (th > maxThickness) maxThickness = th;
        }
        return { layer, topic, maxThickness };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      // Place narrowest ribbons first so wide ribbons adjust around them cleanly
      .sort((a, b) => a.maxThickness - b.maxThickness);

    const placed: PlacedLabel[] = [];

    for (const { layer, topic } of layerStats) {
      const labelW = topic.shortName.length * 6.8 + 18;
      const minX = labelW / 2 + 14;
      const maxX = innerWidth - labelW / 2 - 14;

      let bestScore = -Infinity;
      let bestX = innerWidth / 2;
      let bestY = innerHeight / 2;
      let bestThickness = 0;

      for (const pt of layer) {
        const cx = xScale(pt.data.year);
        if (cx < minX || cx > maxX) continue;
        const y0 = yScale(pt[0]);
        const y1 = yScale(pt[1]);
        const thickness = Math.abs(y0 - y1);
        const cy = Math.max(14, Math.min(innerHeight - 14, (y0 + y1) / 2));

        const overlaps = placed.some(
          (p) =>
            Math.abs(cx - p.x) < (labelW + p.w) / 2 + 10 &&
            Math.abs(cy - p.y) < 20
        );

        const spreadBonus = -Math.abs(cx - innerWidth * 0.52) * 0.012;
        const score = thickness + spreadBonus + (overlaps ? -1000 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestX = cx;
          bestY = cy;
          bestThickness = thickness;
        }
      }

      placed.push({
        topicId: topic.id,
        shortName: topic.shortName,
        color: topic.color,
        x: bestX,
        y: bestY,
        w: labelW,
        thickness: bestThickness,
      });
    }

    return placed;
  }, [stackedSeries, topicMap, xScale, yScale, innerWidth, innerHeight]);

  // Non-overlapping 2021-2025 surge callouts & takeoff markers when "▲ Surging" is active
  const risingCallouts = useMemo(() => {
    if (spotlightMode !== 'surging' || topRisingMomentum.length === 0) return [];
    const anchorYear = Math.min(maxStreamYear, Math.max(startYear, 2023));
    const anchorX = xScale(anchorYear);
    const boxWidth = 258;
    const boxHeight = 38;
    const boxX = Math.max(8, Math.min(innerWidth - boxWidth - 8, anchorX - boxWidth - 18));

    const items = topRisingMomentum
      .map((m) => {
        const layer = stackedSeries.find((s) => s.key === m.topicId);
        if (!layer || layer.length === 0) return null;
        const pt =
          layer.find((p) => p.data.year === anchorYear) ?? layer[layer.length - 1];
        const targetY = (yScale(pt[0]) + yScale(pt[1])) / 2;
        const takeoffPt =
          m.takeoffInflectionYear !== null && m.takeoffInflectionYear >= startYear
            ? layer.find((p) => p.data.year === m.takeoffInflectionYear) ?? null
            : null;
        return {
          momentum: m,
          targetX: xScale(pt.data.year),
          targetY,
          takeoffX: takeoffPt ? xScale(takeoffPt.data.year) : null,
          takeoffY: takeoffPt ? (yScale(takeoffPt[0]) + yScale(takeoffPt[1])) / 2 : null,
          boxY: Math.max(8, Math.min(innerHeight - boxHeight - 8, targetY - boxHeight / 2)),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.boxY - b.boxY);

    // Enforce vertical separation so callouts never overlap even in compressed years
    const minGap = boxHeight + 10;
    for (let i = 1; i < items.length; i++) {
      if (items[i].boxY - items[i - 1].boxY < minGap) {
        items[i].boxY = items[i - 1].boxY + minGap;
      }
    }
    if (items.length > 0 && items[items.length - 1].boxY + boxHeight > innerHeight - 6) {
      items[items.length - 1].boxY = innerHeight - boxHeight - 6;
      for (let i = items.length - 2; i >= 0; i--) {
        if (items[i + 1].boxY - items[i].boxY < minGap) {
          items[i].boxY = Math.max(6, items[i + 1].boxY - minGap);
        }
      }
    }

    return items.map((item) => ({
      ...item,
      boxX,
      boxWidth,
      boxHeight,
    }));
  }, [
    spotlightMode,
    topRisingMomentum,
    stackedSeries,
    xScale,
    yScale,
    innerWidth,
    innerHeight,
    startYear,
    maxStreamYear,
  ]);

  // Non-overlapping Peak & Drop-Off Inflection annotations when "▼ Dropping / Past Peak" is active
  const droppingCallouts = useMemo(() => {
    if (spotlightMode !== 'dropping' || droppingMomentum.length === 0) return [];
    const boxWidth = 244;
    const boxHeight = 38;

    const rawItems = droppingMomentum
      .map((m) => {
        const layer = stackedSeries.find((s) => s.key === m.topicId);
        if (!layer || layer.length === 0) return null;
        const dropYear = m.dropInflectionYear ?? Math.min(maxStreamYear, m.peakYear + 1);
        const anchorYr = Math.max(startYear, Math.min(maxStreamYear, dropYear));
        const anchorPt =
          layer.find((p) => p.data.year === anchorYr) ?? layer[layer.length - 1];
        const targetX = xScale(anchorPt.data.year);
        const targetY = (yScale(anchorPt[0]) + yScale(anchorPt[1])) / 2;

        const peakPt =
          m.peakYear >= startYear
            ? layer.find((p) => p.data.year === m.peakYear) ?? null
            : null;
        const peakX = peakPt ? xScale(peakPt.data.year) : null;
        const peakY = peakPt ? (yScale(peakPt[0]) + yScale(peakPt[1])) / 2 : null;

        // Place box to the right of early inflections and to the left of late inflections
        const preferRight = targetX < innerWidth * 0.56;
        const rawBoxX = preferRight ? targetX + 18 : targetX - boxWidth - 18;
        const boxX = Math.max(8, Math.min(innerWidth - boxWidth - 8, rawBoxX));

        return {
          momentum: m,
          dropYear,
          targetX,
          targetY,
          peakX,
          peakY,
          boxX,
          boxY: Math.max(6, Math.min(innerHeight - boxHeight - 6, targetY - boxHeight / 2)),
          boxWidth,
          boxHeight,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.boxY - b.boxY);

    // 2D vertical separation for any boxes with overlapping horizontal spans
    const minGap = boxHeight + 10;
    for (let i = 1; i < rawItems.length; i++) {
      for (let j = 0; j < i; j++) {
        const xOverlaps =
          Math.abs(rawItems[i].boxX - rawItems[j].boxX) < boxWidth + 10;
        if (xOverlaps && rawItems[i].boxY - rawItems[j].boxY < minGap) {
          rawItems[i].boxY = rawItems[j].boxY + minGap;
        }
      }
    }
    if (
      rawItems.length > 0 &&
      rawItems[rawItems.length - 1].boxY + boxHeight > innerHeight - 6
    ) {
      rawItems[rawItems.length - 1].boxY = innerHeight - boxHeight - 6;
      for (let i = rawItems.length - 2; i >= 0; i--) {
        for (let j = rawItems.length - 1; j > i; j--) {
          const xOverlaps =
            Math.abs(rawItems[i].boxX - rawItems[j].boxX) < boxWidth + 10;
          if (xOverlaps && rawItems[j].boxY - rawItems[i].boxY < minGap) {
            rawItems[i].boxY = Math.max(6, rawItems[j].boxY - minGap);
          }
        }
      }
    }

    return rawItems;
  }, [
    spotlightMode,
    droppingMomentum,
    stackedSeries,
    xScale,
    yScale,
    innerWidth,
    innerHeight,
    startYear,
    maxStreamYear,
  ]);

  // Vertical dashed markers + staggered top labels when hovering/pinning a single topic
  const focusInflectionMarkers = useMemo(() => {
    if (!activeFocusTopicId) return [];
    const m = momentumByTopicId.get(activeFocusTopicId);
    const layer = stackedSeries.find((s) => s.key === activeFocusTopicId);
    if (!m || !layer || layer.length === 0) return [];

    interface MarkerItem {
      kind: 'peak' | 'drop' | 'takeoff';
      year: number;
      x: number;
      dotY: number;
      label: string;
      badgeW: number;
      badgeX: number;
      badgeY: number;
      strokeColor: string;
      bgColor: string;
      textColor: string;
    }

    const candidates: MarkerItem[] = [];
    const addMarker = (
      kind: 'peak' | 'drop' | 'takeoff',
      year: number | null,
      label: string,
      strokeColor: string,
      bgColor: string,
      textColor: string
    ) => {
      if (year === null || year < startYear || year > maxStreamYear) return;
      const pt = layer.find((p) => p.data.year === year);
      if (!pt) return;
      const x = xScale(year);
      const dotY = (yScale(pt[0]) + yScale(pt[1])) / 2;
      const badgeW = label.length * 6.1 + 16;
      const badgeX = Math.max(4, Math.min(innerWidth - badgeW - 4, x - badgeW / 2));
      candidates.push({
        kind,
        year,
        x,
        dotY,
        label,
        badgeW,
        badgeX,
        badgeY: 4,
        strokeColor,
        bgColor,
        textColor,
      });
    };

    addMarker(
      'peak',
      m.peakYear,
      `Peak '${String(m.peakYear).slice(2)} · ${m.peakSharePct.toFixed(1)}%`,
      m.color,
      '#FFFFFF',
      '#0F172A'
    );

    if (m.dropInflectionYear !== null && m.dropInflectionYear !== m.peakYear) {
      addMarker(
        'drop',
        m.dropInflectionYear,
        `Drop-off '${String(m.dropInflectionYear).slice(2)}`,
        '#B45309',
        '#FFFBEB',
        '#92400E'
      );
    } else if (m.takeoffInflectionYear !== null && m.takeoffInflectionYear !== m.peakYear) {
      addMarker(
        'takeoff',
        m.takeoffInflectionYear,
        `Takeoff '${String(m.takeoffInflectionYear).slice(2)}`,
        '#047857',
        '#ECFDF5',
        '#065F46'
      );
    }

    // Stagger second badge downward if horizontal overlap occurs
    candidates.sort((a, b) => a.badgeX - b.badgeX);
    for (let i = 1; i < candidates.length; i++) {
      const prev = candidates[i - 1];
      const cur = candidates[i];
      if (cur.badgeX < prev.badgeX + prev.badgeW + 6) {
        cur.badgeY = prev.badgeY + 22;
      }
    }

    return candidates;
  }, [
    activeFocusTopicId,
    momentumByTopicId,
    stackedSeries,
    startYear,
    maxStreamYear,
    xScale,
    yScale,
    innerWidth,
  ]);

  // D3 Force Simulation for Inter-Topic Correlation Topology
  const correlationLayout = useMemo(() => {
    const netW = 460;
    const netH = 340;
    const cx = netW / 2;
    const cy = netH / 2 - 4;
    const initialRadius = 132;

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
    const uniqueEdges = getCorrelationGraphEdges(correlations, correlationThreshold);

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
          .distance((l) => 200 * (1 - l.correlation * 0.35))
          .strength((l) => l.correlation * 0.18)
      )
      .force('charge', d3.forceManyBody().strength(-480))
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
  }, [topics, correlations, correlationThreshold]);

  const activeYearData = useMemo(() => {
    if (hoveredYear !== null) {
      return rawByYear.get(hoveredYear) ?? filteredStreamData[filteredStreamData.length - 1];
    }
    return null;
  }, [rawByYear, hoveredYear, filteredStreamData]);

  const activeYearTotalPapers = useMemo(() => {
    if (!activeYearData) return 0;
    return Object.values(activeYearData.counts).reduce((sum, n) => sum + n, 0);
  }, [activeYearData]);

  const hoveredTopic = hoveredTopicId ? topicMap.get(hoveredTopicId) || null : null;

  const focusedYearTopic = useMemo(() => {
    if (!activeYearData) return null;
    if (hoveredTopic) return hoveredTopic;
    let topTopic: TopicSummary | null = null;
    let topCnt = -1;
    for (const t of topics) {
      const cnt = activeYearData.counts[t.id] ?? 0;
      if (cnt > topCnt) {
        topCnt = cnt;
        topTopic = t;
      }
    }
    return topTopic;
  }, [activeYearData, hoveredTopic, topics]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width - margin.left;
    const clampedX = Math.max(0, Math.min(innerWidth, relX));
    const yr = Math.max(
      startYear,
      Math.min(maxStreamYear, Math.round(xScale.invert(clampedX)))
    );
    setHoveredYear(yr);
    setIsPointerInsideChart(true);
  };

  const handleSvgMouseLeave = () => {
    setIsPointerInsideChart(false);
    setHoveredYear(null);
    setHoveredTopicId(null);
  };

  // Compute crosshair Y dot position on the hovered ribbon if present
  const crosshairDotY = useMemo(() => {
    if (!activeYearData || !hoveredTopicId) return null;
    const layer = stackedSeries.find((s) => s.key === hoveredTopicId);
    if (!layer) return null;
    const pt = layer.find((p) => p.data.year === activeYearData.year);
    if (!pt) return null;
    return yScale((pt[0] + pt[1]) / 2);
  }, [activeYearData, hoveredTopicId, stackedSeries, yScale]);

  const tooltipPercentLeft = activeYearData
    ? ((margin.left + xScale(activeYearData.year)) / width) * 100
    : 50;
  const flipTooltipLeft = tooltipPercentLeft > 64;

  return (
    <div className="space-y-6">
      {/* PRIMARY FOCAL ANCHOR: CLEAN STREAMGRAPH */}
      <section
        className="bg-white border border-slate-200 rounded-lg p-6 space-y-5"
        aria-labelledby="streamgraph-heading"
      >
        {/* Header & Single-Line Segmented Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h2
              id="streamgraph-heading"
              className="text-lg sm:text-xl font-bold tracking-tight text-slate-900"
            >
              Topic Evolution Across IEEE VIS ({startYear}–{maxStreamYear})
            </h2>
            <p className="text-xs text-slate-500">
              {metricMode === 'prevalence'
                ? '100% normalized share across all 8 subfields'
                : 'Centered stream silhouette of annual paper volume'}{' '}
              · {smoothingMode === 'smoothed' ? '3-year rolling average' : 'raw yearly values'} ·{' '}
              <span className="font-mono-tabular">
                {totalCorpusPapers.toLocaleString()} papers
              </span>
            </p>
          </div>

          <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 shrink-0">
            {/* Scale Mode Toggle */}
            <div
              className="inline-flex items-center gap-0.5 p-1 bg-slate-100 rounded-lg"
              role="group"
              aria-label="Streamgraph scale mode"
            >
              <button
                type="button"
                data-testid="stream-mode-counts-btn"
                onClick={() => setMetricMode('counts')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  metricMode === 'counts'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paper Count
              </button>
              <button
                type="button"
                data-testid="stream-mode-share-btn"
                onClick={() => setMetricMode('prevalence')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  metricMode === 'prevalence'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Share (%)
              </button>
            </div>

            {/* Smoothing Toggle */}
            <div
              className="inline-flex items-center gap-0.5 p-1 bg-slate-100 rounded-lg"
              role="group"
              aria-label="Streamgraph temporal smoothing"
            >
              <button
                type="button"
                data-testid="stream-smooth-btn"
                onClick={() => setSmoothingMode('smoothed')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  smoothingMode === 'smoothed'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3-Year Rolling
              </button>
              <button
                type="button"
                data-testid="stream-raw-btn"
                onClick={() => setSmoothingMode('raw')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  smoothingMode === 'raw'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Raw Yearly
              </button>
            </div>

            {/* Time Period Selector */}
            <div
              className="inline-flex items-center gap-0.5 p-1 bg-slate-100 rounded-lg"
              role="group"
              aria-label="Time window"
            >
              {[
                { yr: 1990, label: `1990–${maxStreamYear}` },
                { yr: 2004, label: `2004–${maxStreamYear}` },
                { yr: 2014, label: `2014–${maxStreamYear}` },
              ].map((win) => (
                <button
                  key={win.yr}
                  type="button"
                  onClick={() => setStartYear(win.yr)}
                  className={`px-2 py-1 text-[11px] font-mono-tabular font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    startYear === win.yr
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {win.label}
                </button>
              ))}
            </div>

            {/* 3-State Trajectory Spotlight Segmented Control */}
            <div
              className="inline-flex items-center gap-0.5 p-1 bg-slate-100 rounded-lg"
              role="group"
              aria-label="Trajectory spotlight mode"
              data-testid="spotlight-segmented-control"
            >
              <button
                type="button"
                data-testid="spotlight-all-btn"
                aria-pressed={spotlightMode === 'all'}
                onClick={() => setSpotlightMode('all')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  spotlightMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                data-testid="spotlight-surging-btn"
                aria-pressed={spotlightMode === 'surging'}
                onClick={() =>
                  setSpotlightMode((prev) => (prev === 'surging' ? 'all' : 'surging'))
                }
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  spotlightMode === 'surging'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ▲ Surging
              </button>
              <button
                type="button"
                data-testid="spotlight-dropping-btn"
                aria-pressed={spotlightMode === 'dropping'}
                onClick={() =>
                  setSpotlightMode((prev) => (prev === 'dropping' ? 'all' : 'dropping'))
                }
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  spotlightMode === 'dropping'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ▼ Dropping / Past Peak
              </button>
            </div>
          </div>
        </div>

        {/* Compact Topic Trajectory & Inflection Pill Strip (4x2 Responsive Grid) */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">
              Topic Trajectory &amp; Inflection Detector (1990–{maxStreamYear})
            </span>
            <div className="flex items-center gap-3">
              {pinnedTopicId && (
                <button
                  type="button"
                  data-testid="clear-trajectory-pin-btn"
                  onClick={() => setPinnedTopicId(null)}
                  className="text-[11px] font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  Clear pinned marker
                </button>
              )}
              <span className="hidden sm:inline text-slate-400">
                Hover or click card to pin Peak &amp; Inflection markers · Click ↗ or ribbon to inspect subfield
              </span>
            </div>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
            data-testid="topic-momentum-strip"
            aria-label="Topic trajectory and inflection summary cards"
          >
            {topicMomentum.map((m) => {
              const isHovered = hoveredTopicId === m.topicId;
              const isPinned = pinnedTopicId === m.topicId;
              const isSpotlightMatch =
                (spotlightMode === 'surging' && topRisingIdSet.has(m.topicId)) ||
                (spotlightMode === 'dropping' && droppingIdSet.has(m.topicId));
              const signPrefix = m.shareDeltaPct > 0 ? '+' : '';
              const deltaText = `${m.isRising ? '▲' : '▼'} ${signPrefix}${m.shareDeltaPct.toFixed(1)}%`;

              const regimeBadgeClass =
                m.regime === 'Surging'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : m.regime === 'Rebounding'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : m.regime === 'Past Peak'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200';

              const peakYrShort = `'${String(m.peakYear).slice(2)}`;
              const peakNowLabel =
                m.regime === 'Surging' || m.peakYear >= 2024
                  ? `All-time high ${peakYrShort} (${Math.round(m.peakSharePct)}%)`
                  : m.dropFromPeak <= -0.04
                  ? `Peak ${peakYrShort}: ${Math.round(m.peakSharePct)}% → ${Math.round(m.recentAvgSharePct)}%`
                  : `Peak ${peakYrShort}: ${Math.round(m.peakSharePct)}% · Now ${Math.round(m.recentAvgSharePct)}%`;

              // Inline SVG sparkline coordinates (56x18)
              const sparkW = 56;
              const sparkH = 18;
              const series = m.smoothedSeries;
              const maxS = Math.max(0.05, ...series.map((p) => p.share));
              const sparkX = (idx: number) =>
                series.length > 1 ? 2 + (idx / (series.length - 1)) * (sparkW - 4) : sparkW / 2;
              const sparkY = (val: number) =>
                sparkH - 2 - (val / maxS) * (sparkH - 5);
              const sparkPath = series
                .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${sparkX(idx).toFixed(1)},${sparkY(p.share).toFixed(1)}`)
                .join(' ');
              const peakIdx = series.findIndex((p) => p.year === m.peakYear);
              const infYr = m.dropInflectionYear ?? m.takeoffInflectionYear;
              const infIdx = infYr !== null ? series.findIndex((p) => p.year === infYr) : -1;

              return (
                <div
                  key={`mom-${m.topicId}`}
                  role="button"
                  tabIndex={0}
                  data-testid={`momentum-pill-${m.topicId}`}
                  aria-pressed={isPinned}
                  onMouseEnter={() => setHoveredTopicId(m.topicId)}
                  onMouseLeave={() => setHoveredTopicId(null)}
                  onClick={() =>
                    setPinnedTopicId((prev) => (prev === m.topicId ? null : m.topicId))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPinnedTopicId((prev) => (prev === m.topicId ? null : m.topicId));
                    }
                  }}
                  title={`${m.shortName} (${m.regime}) · Peak ${m.peakYear} (${m.peakSharePct}%) → 2021–25 avg ${m.recentAvgSharePct}% · 5-yr shift ${signPrefix}${m.shareDeltaPct.toFixed(1)}%${m.dropInflectionYear ? ` · Drop-off onset ${m.dropInflectionYear}` : ''}${m.takeoffInflectionYear ? ` · Takeoff ${m.takeoffInflectionYear}` : ''} · Emerging: ${m.emergingKeywords.join(', ')}`}
                  className={`group cursor-pointer rounded-md border px-2.5 py-1.5 transition-colors flex flex-col justify-between gap-1 ${
                    isPinned
                      ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900/15'
                      : isHovered || isSpotlightMatch
                      ? 'border-slate-900 bg-slate-50/70'
                      : 'border-slate-200/90 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Row 1: Dot + Name + Regime Badge + Inline Sparkline */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="text-[11px] font-semibold text-slate-900 truncate">
                        {m.shortName}
                      </span>
                      <span
                        className={`text-[9.5px] font-medium px-1.5 py-0.2 rounded border whitespace-nowrap shrink-0 ${regimeBadgeClass}`}
                      >
                        {m.regime}
                      </span>
                    </div>

                    <svg
                      width={sparkW}
                      height={sparkH}
                      viewBox={`0 0 ${sparkW} ${sparkH}`}
                      className="shrink-0 overflow-visible"
                      aria-hidden="true"
                    >
                      {sparkPath && (
                        <path
                          d={sparkPath}
                          fill="none"
                          stroke={m.color}
                          strokeWidth={1.35}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {peakIdx >= 0 && (
                        <circle
                          cx={sparkX(peakIdx)}
                          cy={sparkY(series[peakIdx].share)}
                          r={2.1}
                          fill="#FFFFFF"
                          stroke={m.color}
                          strokeWidth={1.25}
                        />
                      )}
                      {infIdx >= 0 && infIdx !== peakIdx && (
                        <circle
                          cx={sparkX(infIdx)}
                          cy={sparkY(series[infIdx].share)}
                          r={2}
                          fill={m.dropInflectionYear ? '#D97706' : '#059669'}
                        />
                      )}
                    </svg>
                  </div>

                  {/* Row 2: 5-Yr Shift + Peak->Now + Inspect Link */}
                  <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-mono-tabular">
                    <span
                      className={`font-semibold whitespace-nowrap ${
                        m.isRising ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      {deltaText}
                    </span>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[10px] text-slate-500 truncate">
                        {peakNowLabel}
                      </span>
                      <button
                        type="button"
                        data-testid={`inspect-topic-btn-${m.topicId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTopic(m.topicId);
                        }}
                        aria-label={`Open ${m.shortName} Topic Network`}
                        title={`Open ${m.shortName} Topic Network`}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 transition-colors shrink-0"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full-Width SVG Streamgraph + Floating Crosshair Tooltip */}
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none cursor-crosshair block"
            role="img"
            aria-label="Streamgraph of IEEE VIS research subfields from 1990 to 2025"
            data-testid="streamgraph-svg"
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={handleSvgMouseLeave}
          >
            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Horizontal Y-Axis Gridlines (Normalized Share mode) or Center Baseline (Paper Count Silhouette) */}
              {metricMode === 'prevalence' ? (
                yTicks.map((tickVal) => (
                  <g key={tickVal} transform={`translate(0, ${yScale(tickVal)})`}>
                    <line
                      x1={0}
                      x2={innerWidth}
                      stroke="#E2E8F0"
                      strokeDasharray={tickVal === 0 || tickVal === 100 ? undefined : '3,3'}
                      strokeWidth={1}
                    />
                    <text
                      x={-10}
                      dy="0.32em"
                      textAnchor="end"
                      className="text-[11px] fill-slate-400 font-mono-tabular"
                    >
                      {tickVal}%
                    </text>
                  </g>
                ))
              ) : (
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={yScale(0)}
                  y2={yScale(0)}
                  stroke="#CBD5E1"
                  strokeDasharray="3,3"
                  strokeWidth={1}
                />
              )}

              {/* Vertical Year Gridlines */}
              {xScale.ticks(10).map((yrTick) => (
                <g key={yrTick} transform={`translate(${xScale(yrTick)}, 0)`}>
                  <line
                    y1={0}
                    y2={innerHeight}
                    stroke="#F1F5F9"
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

              {/* Subtle 2021-2025 Window Highlight when "▲ Surging" is active */}
              {spotlightMode === 'surging' && !activeFocusTopicId && maxStreamYear >= 2021 && (
                <rect
                  x={xScale(Math.max(startYear, 2021))}
                  y={0}
                  width={Math.max(0, xScale(maxStreamYear) - xScale(Math.max(startYear, 2021)))}
                  height={innerHeight}
                  fill="#10B981"
                  fillOpacity={0.05}
                  stroke="#10B981"
                  strokeOpacity={0.22}
                  strokeDasharray="3,3"
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Smooth Stream Ribbons */}
              {stackedSeries.map((layer) => {
                const topic = topicMap.get(layer.key);
                if (!topic) return null;
                const pathD = areaGenerator(layer) || '';
                const isSpotlightMatch =
                  (spotlightMode === 'surging' && topRisingIdSet.has(topic.id)) ||
                  (spotlightMode === 'dropping' && droppingIdSet.has(topic.id));
                const ribbonOpacity = activeFocusTopicId
                  ? activeFocusTopicId === topic.id
                    ? 0.96
                    : 0.2
                  : spotlightMode !== 'all'
                  ? isSpotlightMatch
                    ? 0.96
                    : 0.18
                  : 0.94;

                return (
                  <g
                    key={topic.id}
                    className="cursor-pointer transition-opacity duration-150"
                    style={{ opacity: ribbonOpacity }}
                    onMouseEnter={() => setHoveredTopicId(topic.id)}
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
                      strokeWidth={
                        activeFocusTopicId === topic.id ||
                        (spotlightMode !== 'all' && isSpotlightMatch)
                          ? 2
                          : 1.25
                      }
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}

              {/* Direct Non-Overlapping Subfield Name Labels on Ribbons */}
              <g
                className="pointer-events-none"
                style={{ pointerEvents: 'none' }}
                data-testid="streamgraph-ribbon-labels"
              >
                {ribbonLabels.map((lbl) => {
                  const isSurgingActive =
                    spotlightMode === 'surging' && !activeFocusTopicId;
                  const isDroppingActive =
                    spotlightMode === 'dropping' && !activeFocusTopicId;

                  const overlapsSurging =
                    isSurgingActive &&
                    (topRisingIdSet.has(lbl.topicId) ||
                      risingCallouts.some(
                        (c) =>
                          lbl.x + lbl.w / 2 > c.boxX - 6 &&
                          lbl.x - lbl.w / 2 < c.boxX + c.boxWidth + 6 &&
                          lbl.y + 10 > c.boxY - 4 &&
                          lbl.y - 10 < c.boxY + c.boxHeight + 4
                      ));
                  const overlapsDropping =
                    isDroppingActive &&
                    (droppingIdSet.has(lbl.topicId) ||
                      droppingCallouts.some(
                        (c) =>
                          lbl.x + lbl.w / 2 > c.boxX - 6 &&
                          lbl.x - lbl.w / 2 < c.boxX + c.boxWidth + 6 &&
                          lbl.y + 10 > c.boxY - 4 &&
                          lbl.y - 10 < c.boxY + c.boxHeight + 4
                      ));
                  if (overlapsSurging || overlapsDropping) return null;

                  const labelOpacity = activeFocusTopicId
                    ? activeFocusTopicId === lbl.topicId
                      ? 1
                      : 0.2
                    : spotlightMode !== 'all'
                    ? 0.2
                    : 1;
                  return (
                    <text
                      key={`lbl-${lbl.topicId}`}
                      x={lbl.x}
                      y={lbl.y}
                      dy="0.35em"
                      textAnchor="middle"
                      style={{
                        opacity: labelOpacity,
                        paintOrder: 'stroke fill',
                        stroke: 'rgba(15, 23, 42, 0.58)',
                        strokeWidth: '3.2px',
                        strokeLinejoin: 'round',
                        pointerEvents: 'none',
                      }}
                      className="text-[11px] font-semibold fill-white transition-opacity duration-150 select-none"
                    >
                      {lbl.shortName}
                    </text>
                  );
                })}
              </g>

              {/* Single-Topic Peak & Inflection Dashed Markers (on Pill/Ribbon Hover or Pin) */}
              {focusInflectionMarkers.length > 0 && (
                <g
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                  data-testid="trajectory-focus-markers"
                >
                  {focusInflectionMarkers.map((mk) => (
                    <g key={`mk-${mk.kind}-${mk.year}`}>
                      <line
                        x1={mk.x}
                        x2={mk.x}
                        y1={mk.badgeY + 18}
                        y2={innerHeight}
                        stroke={mk.strokeColor}
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                        strokeOpacity={0.85}
                      />
                      <circle
                        cx={mk.x}
                        cy={mk.dotY}
                        r={5}
                        fill={mk.kind === 'peak' ? '#FFFFFF' : mk.strokeColor}
                        stroke={mk.strokeColor}
                        strokeWidth={2}
                      />
                      <rect
                        x={mk.badgeX}
                        y={mk.badgeY}
                        width={mk.badgeW}
                        height={18}
                        rx={4}
                        fill={mk.bgColor}
                        stroke={mk.strokeColor}
                        strokeWidth={1.25}
                      />
                      <text
                        x={mk.badgeX + mk.badgeW / 2}
                        y={mk.badgeY + 12.5}
                        textAnchor="middle"
                        style={{ fill: mk.textColor }}
                        className="text-[10px] font-semibold font-mono-tabular"
                      >
                        {mk.label}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Non-Overlapping 2021-2025 Surge Callouts & Takeoff Markers when "▲ Surging" is active */}
              {spotlightMode === 'surging' && !activeFocusTopicId && risingCallouts.length > 0 && (
                <g
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                  data-testid="rising-trend-callouts"
                >
                  {risingCallouts.map((c) => {
                    const boxRightX = c.boxX + c.boxWidth;
                    const boxMidY = c.boxY + c.boxHeight / 2;
                    const rawKw = c.momentum.emergingKeywords[0] ?? 'recent surge';
                    const takeoffStr = c.momentum.takeoffInflectionYear
                      ? `Takeoff '${String(c.momentum.takeoffInflectionYear).slice(2)} · `
                      : '';
                    const sublineRaw = `${c.momentum.shortName} · ${takeoffStr}${rawKw}`;
                    const subline =
                      sublineRaw.length > 48 ? `${sublineRaw.slice(0, 47)}…` : sublineRaw;
                    const clipId = `callout-clip-${c.momentum.topicId}`;
                    return (
                      <g key={`callout-${c.momentum.topicId}`}>
                        <defs>
                          <clipPath id={clipId}>
                            <rect
                              x={c.boxX + 4}
                              y={c.boxY + 2}
                              width={c.boxWidth - 8}
                              height={c.boxHeight - 4}
                              rx={4}
                            />
                          </clipPath>
                        </defs>
                        {c.takeoffX !== null && c.takeoffY !== null && (
                          <>
                            <line
                              x1={c.takeoffX}
                              x2={c.takeoffX}
                              y1={0}
                              y2={innerHeight}
                              stroke={c.momentum.color}
                              strokeWidth={1.1}
                              strokeDasharray="3,3"
                              strokeOpacity={0.45}
                            />
                            <circle
                              cx={c.takeoffX}
                              cy={c.takeoffY}
                              r={4}
                              fill="#ECFDF5"
                              stroke={c.momentum.color}
                              strokeWidth={1.75}
                            />
                          </>
                        )}
                        <line
                          x1={boxRightX}
                          y1={boxMidY}
                          x2={c.targetX}
                          y2={c.targetY}
                          stroke="#0F172A"
                          strokeWidth={1.25}
                          strokeDasharray="3,2"
                          strokeOpacity={0.7}
                        />
                        <circle
                          cx={c.targetX}
                          cy={c.targetY}
                          r={3.5}
                          fill={c.momentum.color}
                          stroke="#FFFFFF"
                          strokeWidth={1.5}
                        />
                        <rect
                          x={c.boxX}
                          y={c.boxY}
                          width={c.boxWidth}
                          height={c.boxHeight}
                          rx={6}
                          fill="#FFFFFF"
                          fillOpacity={0.97}
                          stroke={c.momentum.color}
                          strokeWidth={1.5}
                        />
                        <g clipPath={`url(#${clipId})`}>
                          <circle
                            cx={c.boxX + 12}
                            cy={c.boxY + 12.5}
                            r={3.5}
                            fill={c.momentum.color}
                          />
                          <text
                            x={c.boxX + 20}
                            y={c.boxY + 15.5}
                            className="text-[10.5px] font-semibold fill-slate-900"
                          >
                            2021–25 Surge: +{c.momentum.shareDeltaPct.toFixed(1)}% share
                          </text>
                          <text
                            x={c.boxX + 10}
                            y={c.boxY + 29}
                            className="text-[9.5px] fill-slate-600"
                          >
                            {subline}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Non-Overlapping Peak & Drop-Off Inflection Callouts when "▼ Dropping / Past Peak" is active */}
              {spotlightMode === 'dropping' && !activeFocusTopicId && droppingCallouts.length > 0 && (
                <g
                  className="pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                  data-testid="dropping-trend-callouts"
                >
                  {droppingCallouts.map((c) => {
                    const boxMidY = c.boxY + c.boxHeight / 2;
                    const leaderStartX =
                      c.targetX < c.boxX ? c.boxX : c.boxX + c.boxWidth;
                    const clipId = `drop-clip-${c.momentum.topicId}`;
                    const peakYrShort = `'${String(c.momentum.peakYear).slice(2)}`;
                    const dropYrShort = `'${String(c.dropYear).slice(2)}`;
                    const line1 = `${c.momentum.shortName} (${c.momentum.dropFromPeakPct.toFixed(1)}% vs peak)`;
                    const line2 = `Peak ${peakYrShort} (${c.momentum.peakSharePct}%) · Drop ${dropYrShort} → Now ${c.momentum.recentAvgSharePct}%`;

                    return (
                      <g key={`drop-callout-${c.momentum.topicId}`}>
                        <defs>
                          <clipPath id={clipId}>
                            <rect
                              x={c.boxX + 4}
                              y={c.boxY + 2}
                              width={c.boxWidth - 8}
                              height={c.boxHeight - 4}
                              rx={4}
                            />
                          </clipPath>
                        </defs>
                        {c.peakX !== null && c.peakY !== null && (
                          <>
                            <line
                              x1={c.peakX}
                              x2={c.peakX}
                              y1={0}
                              y2={innerHeight}
                              stroke={c.momentum.color}
                              strokeWidth={1}
                              strokeDasharray="2,3"
                              strokeOpacity={0.38}
                            />
                            <circle
                              cx={c.peakX}
                              cy={c.peakY}
                              r={4}
                              fill="#FFFFFF"
                              stroke={c.momentum.color}
                              strokeWidth={1.75}
                            />
                          </>
                        )}
                        <line
                          x1={c.targetX}
                          x2={c.targetX}
                          y1={0}
                          y2={innerHeight}
                          stroke="#B45309"
                          strokeWidth={1.15}
                          strokeDasharray="3,3"
                          strokeOpacity={0.5}
                        />
                        <line
                          x1={leaderStartX}
                          y1={boxMidY}
                          x2={c.targetX}
                          y2={c.targetY}
                          stroke="#0F172A"
                          strokeWidth={1.2}
                          strokeDasharray="3,2"
                          strokeOpacity={0.7}
                        />
                        <circle
                          cx={c.targetX}
                          cy={c.targetY}
                          r={4}
                          fill="#FEF3C7"
                          stroke="#B45309"
                          strokeWidth={1.75}
                        />
                        <rect
                          x={c.boxX}
                          y={c.boxY}
                          width={c.boxWidth}
                          height={c.boxHeight}
                          rx={6}
                          fill="#FFFFFF"
                          fillOpacity={0.97}
                          stroke={c.momentum.color}
                          strokeWidth={1.5}
                        />
                        <g clipPath={`url(#${clipId})`}>
                          <circle
                            cx={c.boxX + 12}
                            cy={c.boxY + 12.5}
                            r={3.5}
                            fill={c.momentum.color}
                          />
                          <text
                            x={c.boxX + 20}
                            y={c.boxY + 15.5}
                            className="text-[10.5px] font-semibold fill-slate-900"
                          >
                            {line1}
                          </text>
                          <text
                            x={c.boxX + 10}
                            y={c.boxY + 29}
                            className="text-[9.5px] fill-slate-600"
                          >
                            {line2}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Interactive Hover Crosshair */}
              {isPointerInsideChart && activeYearData && (
                <g className="pointer-events-none" style={{ pointerEvents: 'none' }}>
                  <line
                    x1={xScale(activeYearData.year)}
                    x2={xScale(activeYearData.year)}
                    y1={0}
                    y2={innerHeight}
                    stroke="#0F172A"
                    strokeWidth={1.25}
                    strokeDasharray="4,3"
                  />
                  {crosshairDotY !== null && hoveredTopic && (
                    <circle
                      cx={xScale(activeYearData.year)}
                      cy={crosshairDotY}
                      r={4.5}
                      fill={hoveredTopic.color}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  )}
                </g>
              )}
            </g>
          </svg>

          {/* Compact Floating Tooltip on Hover */}
          {isPointerInsideChart && activeYearData && focusedYearTopic && (
            <div
              data-testid="streamgraph-tooltip"
              style={{
                left: `${tooltipPercentLeft}%`,
                transform: flipTooltipLeft
                  ? 'translate(calc(-100% - 14px), 0)'
                  : 'translate(14px, 0)',
                pointerEvents: 'none',
              }}
              className="pointer-events-none absolute top-4 z-20 w-60 rounded-lg bg-slate-900/95 text-white px-3.5 py-2.5 shadow-lg border border-slate-700/80 text-xs"
            >
              <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-700/80 font-mono-tabular">
                <span className="font-bold text-white">{activeYearData.year}</span>
                <span className="text-slate-300">
                  {activeYearTotalPapers} papers total
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: focusedYearTopic.color }}
                  />
                  <span className="font-semibold text-white truncate">
                    {focusedYearTopic.shortName}
                  </span>
                </span>
                <span className="font-mono-tabular text-slate-200 shrink-0 font-semibold">
                  {activeYearData.counts[focusedYearTopic.id] ?? 0}p ·{' '}
                  {((activeYearData.values[focusedYearTopic.id] ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {hoveredTopic ? (
                  (() => {
                    const m = momentumByTopicId.get(hoveredTopic.id);
                    return m
                      ? `5-yr momentum: ${m.shareDeltaPct > 0 ? '+' : ''}${m.shareDeltaPct.toFixed(1)}% · Click ribbon to inspect`
                      : 'Click ribbon to open Topic Network';
                  })()
                ) : (
                  'Hover any ribbon for details'
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clean 8-Item Interactive Color Legend (Zero Overlapping Text) */}
        <div
          className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2"
          data-testid="streamgraph-legend"
        >
          {topics.map((t) => {
            const isHovered = hoveredTopicId === t.id;
            const yearCount = activeYearData ? activeYearData.counts[t.id] ?? 0 : t.paperCount;
            const yearShare = activeYearData
              ? ((activeYearData.values[t.id] ?? 0) * 100).toFixed(1)
              : ((t.paperCount / Math.max(1, totalCorpusPapers)) * 100).toFixed(1);

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTopic(t.id)}
                onMouseEnter={() => setHoveredTopicId(t.id)}
                onMouseLeave={() => setHoveredTopicId(null)}
                className={`text-left px-2.5 py-2 rounded-md border transition-colors ${
                  isHovered
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200/80 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {t.shortName}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-mono-tabular text-slate-500 whitespace-nowrap">
                  {yearCount.toLocaleString()}p · {yearShare}%
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECONDARY ROW: TOPIC SUMMARY CARDS (LEFT 7 COLS) + TOPIC CORRELATION GRAPH (RIGHT 5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Clean Topic Summary Cards Grid */}
        <section
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4"
          aria-labelledby="subfields-directory-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3
                id="subfields-directory-heading"
                className="text-base font-semibold text-slate-900"
              >
                Research Subfields ({topics.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any subfield to inspect its citation network and contributing papers
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              {totalCorpusPapers.toLocaleString()} papers · {minStreamYear}–{maxStreamYear}
            </span>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            data-testid="subfields-directory-table"
          >
            {topics.map((topic) => {
              const corpusShare = (
                (topic.paperCount / Math.max(1, totalCorpusPapers)) *
                100
              ).toFixed(1);
              const isHighlighted = hoveredTopicId === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
                  onMouseEnter={() => setHoveredTopicId(topic.id)}
                  onMouseLeave={() => setHoveredTopicId(null)}
                  className={`text-left p-3.5 rounded-md border transition-colors flex flex-col justify-between gap-2.5 ${
                    isHighlighted
                      ? 'border-slate-900 bg-slate-50/80'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: topic.color }}
                        />
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {topic.shortName}
                        </span>
                      </div>
                      <span className="text-xs font-mono-tabular font-semibold text-slate-900 shrink-0">
                        {topic.paperCount.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {topic.description}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-mono-tabular text-slate-600 truncate">
                      {topic.topKeywords
                        .slice(0, 3)
                        .map((k) => k.term)
                        .join(' · ')}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-500">
                      <span>
                        {corpusShare}% share · Peak {topic.peakYear}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 font-semibold ${
                          topic.growthRate >= 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {topic.growthRate >= 0
                          ? `+${topic.growthRate}%`
                          : `${topic.growthRate}%`}
                        <ArrowUpRight className="w-3 h-3 text-slate-400 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right 5 Cols: Inter-Topic Correlation Topology */}
        <section
          className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4"
          aria-labelledby="correlation-heading"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3
                  id="correlation-heading"
                  className="text-base font-semibold text-slate-900"
                >
                  Topic Correlation Graph
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subfield co-occurrence overlap ({minStreamYear}–{maxStreamYear})
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

            {correlationView === 'network' && (
              <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-md flex items-center justify-between gap-3 text-[11px]">
                <label
                  htmlFor="correlation-threshold-slider"
                  className="font-medium text-slate-600 whitespace-nowrap"
                >
                  Link Cutoff:{' '}
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    ≥ {Math.round(correlationThreshold * 100)}%
                  </span>
                </label>
                <input
                  id="correlation-threshold-slider"
                  type="range"
                  min={0.1}
                  max={0.32}
                  step={0.02}
                  value={correlationThreshold}
                  onChange={(e) => setCorrelationThreshold(Number(e.target.value))}
                  aria-label="Minimum topic correlation link threshold"
                  className="flex-1 max-w-[140px] accent-slate-900 cursor-pointer"
                />
                <span className="font-mono-tabular text-slate-500 whitespace-nowrap">
                  {correlationLayout.links.length}/{uniqueBridgePairs.length} edges
                </span>
              </div>
            )}

            {correlationView === 'network' ? (
              <div className="relative flex items-center justify-center bg-slate-50/50 border border-slate-100 rounded-md p-2">
                <svg
                  viewBox={`0 0 ${correlationLayout.netW} ${correlationLayout.netH}`}
                  className="w-full h-auto max-h-[305px] select-none"
                  role="img"
                  aria-label="Topic correlation network diagram"
                  data-testid="topic-correlation-svg"
                >
                  {correlationLayout.links.map((link, idx) => {
                    const isConnectedToHighlight =
                      !hoveredTopicId ||
                      link.source.id === hoveredTopicId ||
                      link.target.id === hoveredTopicId;

                    const isActivelyHoveredEdge =
                      Boolean(hoveredTopicId) &&
                      (link.source.id === hoveredTopicId ||
                        link.target.id === hoveredTopicId);

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
                          stroke={isActivelyHoveredEdge ? '#0F172A' : '#64748B'}
                          strokeWidth={
                            isActivelyHoveredEdge
                              ? Math.max(2.5, link.correlation * 6.5)
                              : Math.max(1.25, link.correlation * 4.5)
                          }
                          strokeOpacity={
                            isActivelyHoveredEdge
                              ? 0.9
                              : isConnectedToHighlight
                              ? 0.45
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
                              x={-26}
                              y={-9}
                              width={52}
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

                  {correlationLayout.nodes.map((node) => {
                    const maxTopicPapers = Math.max(1, ...topics.map((t) => t.paperCount));
                    const r = 16 + (node.topic.paperCount / maxTopicPapers) * 9;
                    const isFocused = hoveredTopicId === node.id;
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
                          fillOpacity={!hoveredTopicId || isFocused ? 0.95 : 0.3}
                          stroke={isFocused ? '#0F172A' : '#FFFFFF'}
                          strokeWidth={isFocused ? 2.5 : 1.75}
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
              /* 8x8 Correlation Matrix */
              <div className="flex flex-col justify-center overflow-x-auto py-1 space-y-2">
                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr>
                      <th className="p-1 text-[10px] text-left font-mono-tabular text-slate-400">
                        Subfield
                      </th>
                      {topics.map((t, i) => {
                        const isColHighlighted = hoveredMatrixCell?.colId === t.id;
                        return (
                          <th
                            key={t.id}
                            className={`p-1 text-[10px] font-mono-tabular font-semibold transition-colors ${
                              isColHighlighted
                                ? 'text-blue-700 bg-blue-50 rounded'
                                : 'text-slate-600'
                            }`}
                            title={t.name}
                          >
                            #{i + 1}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((rowT, rIdx) => {
                      const isRowHighlighted = hoveredMatrixCell?.rowId === rowT.id;
                      return (
                        <tr key={rowT.id}>
                          <td className="p-1 text-left whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectTopic(rowT.id)}
                              className={`text-[11px] font-medium truncate max-w-[130px] inline-flex items-center gap-1 transition-colors ${
                                isRowHighlighted
                                  ? 'text-blue-700 font-semibold'
                                  : 'text-slate-700 hover:text-blue-600'
                              }`}
                            >
                              <span
                                className="w-2 h-2 rounded-xs shrink-0"
                                style={{ backgroundColor: rowT.color }}
                              />
                              #{rIdx + 1} {rowT.shortName}
                            </button>
                          </td>
                          {topics.map((colT) => {
                            const corr = getCorrelationBetween(rowT.id, colT.id, correlations);
                            const isSelf = rowT.id === colT.id;
                            const isCellHovered =
                              hoveredMatrixCell?.rowId === rowT.id &&
                              hoveredMatrixCell?.colId === colT.id;
                            const bgAlpha = isSelf ? 0.85 : Math.max(0.08, corr * 0.85);
                            return (
                              <td key={colT.id} className="p-0.5">
                                <button
                                  type="button"
                                  onClick={() => onSelectTopic(isSelf ? rowT.id : colT.id)}
                                  onMouseEnter={() => {
                                    setHoveredTopicId(rowT.id);
                                    setHoveredMatrixCell({
                                      rowId: rowT.id,
                                      colId: colT.id,
                                    });
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredTopicId(null);
                                    setHoveredMatrixCell(null);
                                  }}
                                  className={`w-full h-7 rounded-xs text-[10px] font-mono-tabular flex items-center justify-center transition-transform hover:scale-105 ${
                                    isCellHovered ? 'ring-2 ring-slate-900' : ''
                                  }`}
                                  style={{
                                    backgroundColor: isSelf
                                      ? '#0F172A'
                                      : `rgba(43, 92, 143, ${bgAlpha})`,
                                    color:
                                      corr > 0.45 || isSelf ? '#FFFFFF' : '#1E293B',
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
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-2 py-1 bg-slate-50 border border-slate-200/70 rounded text-[11px] font-mono-tabular text-slate-600 flex items-center justify-between gap-2 min-h-[26px]">
                  {hoveredMatrixCell ? (() => {
                    const rTopic = topicMap.get(hoveredMatrixCell.rowId);
                    const cTopic = topicMap.get(hoveredMatrixCell.colId);
                    const edge =
                      hoveredMatrixCell.rowId === hoveredMatrixCell.colId
                        ? null
                        : getCorrelationEdge(
                            hoveredMatrixCell.rowId,
                            hoveredMatrixCell.colId,
                            correlations
                          );
                    const pct = Math.round(
                      getCorrelationBetween(
                        hoveredMatrixCell.rowId,
                        hoveredMatrixCell.colId,
                        correlations
                      ) * 100
                    );
                    return (
                      <>
                        <span className="truncate font-medium text-slate-800">
                          {rTopic?.shortName} ↔ {cTopic?.shortName}
                        </span>
                        <span className="shrink-0 font-semibold text-blue-700">
                          {pct}% overlap
                          {edge ? ` · ${edge.coOccurrenceCount} shared papers` : ' (Self)'}
                        </span>
                      </>
                    );
                  })() : (
                    <span className="text-slate-500">
                      Hover a cell to inspect overlap; click to open column topic.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Strongest Cross-Subfield Bridges List */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                {showAllBridges
                  ? `All Subfield Bridges (${uniqueBridgePairs.length})`
                  : 'Strongest Subfield Bridges'}
              </span>
              <button
                type="button"
                data-testid="toggle-all-bridges-btn"
                onClick={() => setShowAllBridges((v) => !v)}
                className="text-[11px] font-semibold text-blue-700 hover:underline whitespace-nowrap"
              >
                {showAllBridges
                  ? 'Show Top 5'
                  : `View All ${uniqueBridgePairs.length} Pairs`}
              </button>
            </div>
            <div
              className={
                showAllBridges
                  ? 'divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1'
                  : 'divide-y divide-slate-100'
              }
              data-testid="cross-subfield-bridges-list"
            >
              {(showAllBridges
                ? uniqueBridgePairs
                : uniqueBridgePairs.slice(0, 5)
              ).map((edge) => {
                const s = topicMap.get(edge.sourceTopicId);
                const t = topicMap.get(edge.targetTopicId);
                if (!s || !t) return null;
                const pct = Math.round(edge.correlation * 100);
                return (
                  <div
                    key={`${edge.sourceTopicId}-${edge.targetTopicId}`}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs text-slate-600"
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
                    <span className="font-mono-tabular text-[11px] text-slate-600 shrink-0">
                      {pct}% · {edge.coOccurrenceCount}p
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* COLLAPSIBLE METHODOLOGY & CORPUS NOTES (CLEAN, LOW VISUAL WEIGHT) */}
      <section
        className="bg-white border border-slate-200 rounded-lg px-5 py-3.5"
        data-testid="methodology-explanation-panel"
        aria-label="Classification and corpus pipeline notes"
      >
        <button
          type="button"
          onClick={() => setShowMethodology((v) => !v)}
          aria-expanded={showMethodology}
          className="w-full flex items-center justify-between gap-4 text-left"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Classification &amp; Corpus Pipeline
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>
              Weighted multi-field classifier (Keywords 2.2×, Title 1.6×, Abstract 0.75×, α = 0.125)
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono-tabular">
              {totalCorpusPapers.toLocaleString()} papers ({minStreamYear}–{maxStreamYear})
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 shrink-0">
            {showMethodology ? 'Hide Notes' : 'Read Notes'}
            {showMethodology ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </button>

        {showMethodology && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 leading-relaxed">
            <div className="space-y-1.5">
              <h4 className="font-semibold text-slate-900">
                1. Weighted Multi-Field Scoring
              </h4>
              <p>
                Each paper in Vispubdata ({minStreamYear}–{maxStreamYear}) is scored against 8
                subfield vocabularies aligned with InfoVis, VAST, and SciVis using{' '}
                <strong className="text-slate-800 font-mono-tabular">
                  AuthorKeywords × 2.2
                </strong>
                ,{' '}
                <strong className="text-slate-800 font-mono-tabular">
                  Title × 1.6
                </strong>
                ,{' '}
                <strong className="text-slate-800 font-mono-tabular">
                  Abstract × 0.75
                </strong>
                , and moderate venue priors (SciVis 0.45, VAST 0.5/0.25, InfoVis 0.25).
              </p>
            </div>
            <div className="space-y-1.5">
              <h4 className="font-semibold text-slate-900">
                2. Topic Vectors &amp; Correlation Edges
              </h4>
              <p>
                Scores smoothed with Dirichlet baseline{' '}
                <strong className="text-slate-800 font-mono-tabular">α = 0.125</strong> are
                L1-normalized into probability vectors θ<sub>d</sub>. Pairwise topic edges
                reflect cosine similarity across all {totalCorpusPapers.toLocaleString()} vectors
                (currently{' '}
                <span className="font-mono-tabular font-semibold text-slate-800">
                  {correlationLayout.links.length}/{uniqueBridgePairs.length}
                </span>{' '}
                active at ≥{Math.round(correlationThreshold * 100)}%).
              </p>
            </div>
            <div className="space-y-1.5">
              <h4 className="font-semibold text-slate-900">
                3. Citation &amp; Author Normalization
              </h4>
              <p>
                CrossRef citations fall back cleanly to AMiner counts and 0; trailing DBLP
                disambiguation digits are stripped on display labels; generic field bigrams are
                filtered from subfield keywords; and{' '}
                <code className="text-[11px] bg-slate-100 px-1 rounded">
                  0.1109/ → 10.1109/
                </code>{' '}
                DOI typos are repaired prior to citation graph linking.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
