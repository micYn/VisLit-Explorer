import {
  AuthorBrief,
  AuthorDetailResponse,
  FieldOverviewResponse,
  PaperDetailResponse,
  PaperSummary,
  TopicCorrelationEdge,
  TopicDetailResponse,
  TopicSummary,
  YearlyTopicPrevalence,
} from '../types';

export const TOPICS: TopicSummary[] = [
  {
    id: 'topic-0',
    name: 'Graph & Network Layout',
    shortName: 'Graph Layout',
    color: '#2563EB', // Cobalt Blue
    description:
      'Force-directed placement, hierarchical edge bundling, matrix reordering, and topological simplification for relational and biological networks.',
    topKeywords: [
      { term: 'edge bundling', weight: 0.142 },
      { term: 'force-directed', weight: 0.128 },
      { term: 'node-link', weight: 0.115 },
      { term: 'adjacency matrix', weight: 0.094 },
      { term: 'graph drawing', weight: 0.088 },
      { term: 'hierarchy', weight: 0.079 },
      { term: 'community structure', weight: 0.068 },
      { term: 'dynamic network', weight: 0.061 },
    ],
    paperCount: 412,
    totalCitations: 28450,
    peakYear: 2016,
    growthRate: 6.4,
  },
  {
    id: 'topic-1',
    name: 'Volume & Scientific Flow Rendering',
    shortName: 'Volume & Flow',
    color: '#0D9488', // Teal
    description:
      'Direct volume ray-casting, transfer function design, isosurface extraction, and Lagrangian coherent structures in 3D unsteady flow fields.',
    topKeywords: [
      { term: 'ray casting', weight: 0.156 },
      { term: 'transfer function', weight: 0.134 },
      { term: 'isosurface', weight: 0.119 },
      { term: 'streamlines', weight: 0.104 },
      { term: 'vector field', weight: 0.092 },
      { term: 'vortex core', weight: 0.081 },
      { term: 'gpu acceleration', weight: 0.075 },
      { term: 'octree', weight: 0.064 },
    ],
    paperCount: 538,
    totalCitations: 34120,
    peakYear: 2008,
    growthRate: -8.2,
  },
  {
    id: 'topic-2',
    name: 'Visual Analytics & Explainable ML',
    shortName: 'Visual Analytics & ML',
    color: '#7C3AED', // Violet
    description:
      'Human-in-the-loop model steering, deep neural network activation inspection, counterfactual probing, and interactive LLM evaluation workflows.',
    topKeywords: [
      { term: 'explainable ai', weight: 0.168 },
      { term: 'neural network', weight: 0.149 },
      { term: 'model steering', weight: 0.118 },
      { term: 'latent space', weight: 0.106 },
      { term: 'transformer', weight: 0.095 },
      { term: 'feature attribution', weight: 0.084 },
      { term: 'active learning', weight: 0.072 },
      { term: 'visual debugging', weight: 0.065 },
    ],
    paperCount: 486,
    totalCitations: 31890,
    peakYear: 2024,
    growthRate: 48.6,
  },
  {
    id: 'topic-3',
    name: 'High-Dimensional & Projections',
    shortName: 'High-Dim & Projections',
    color: '#D97706', // Amber
    description:
      'Nonlinear dimensionality reduction (t-SNE, UMAP), subspace clustering, scagnostic quality metrics, and parallel coordinate geometries.',
    topKeywords: [
      { term: 'dimensionality reduction', weight: 0.161 },
      { term: 't-sne', weight: 0.137 },
      { term: 'umap', weight: 0.122 },
      { term: 'parallel coordinates', weight: 0.109 },
      { term: 'subspace cluster', weight: 0.096 },
      { term: 'scagnostics', weight: 0.082 },
      { term: 'scatterplot matrix', weight: 0.074 },
      { term: 'neighborhood preservation', weight: 0.063 },
    ],
    paperCount: 364,
    totalCitations: 24760,
    peakYear: 2019,
    growthRate: 14.2,
  },
  {
    id: 'topic-4',
    name: 'Perceptual Evaluation & Color',
    shortName: 'Perception & Color',
    color: '#E11D48', // Rose
    description:
      'Psychophysical graphical perception experiments, luminance-calibrated colormaps, preattentive visual channels, and cognitive workload models.',
    topKeywords: [
      { term: 'graphical perception', weight: 0.159 },
      { term: 'colormap', weight: 0.138 },
      { term: 'psychophysics', weight: 0.114 },
      { term: 'crowdsourced study', weight: 0.102 },
      { term: 'just noticeable difference', weight: 0.089 },
      { term: 'preattentive', weight: 0.078 },
      { term: 'visual working memory', weight: 0.069 },
      { term: 'rainbow map', weight: 0.058 },
    ],
    paperCount: 329,
    totalCitations: 26340,
    peakYear: 2021,
    growthRate: 18.5,
  },
  {
    id: 'topic-5',
    name: 'Declarative Grammars & Narrative Vis',
    shortName: 'Grammars & Storytelling',
    color: '#059669', // Emerald
    description:
      'Formal visualization specification languages (D3, Vega-Lite), reactive interaction grammars, data-driven scrollytelling, and automated chart recommendation.',
    topKeywords: [
      { term: 'declarative grammar', weight: 0.164 },
      { term: 'narrative visualization', weight: 0.141 },
      { term: 'vega-lite', weight: 0.126 },
      { term: 'data-driven documents', weight: 0.115 },
      { term: 'chart recommendation', weight: 0.093 },
      { term: 'interaction algebra', weight: 0.084 },
      { term: 'authoring tool', weight: 0.076 },
      { term: 'annotated transition', weight: 0.062 },
    ],
    paperCount: 385,
    totalCitations: 39420,
    peakYear: 2022,
    growthRate: 27.9,
  },
  {
    id: 'topic-6',
    name: 'Spatiotemporal & Urban Analytics',
    shortName: 'Spatiotemporal & Geo',
    color: '#4F46E5', // Indigo
    description:
      'Origin-destination trajectory aggregation, urban mobility tensors, cartographic distortion lenses, and multi-scale event sequence timelines.',
    topKeywords: [
      { term: 'trajectory analysis', weight: 0.152 },
      { term: 'origin-destination', weight: 0.131 },
      { term: 'urban mobility', weight: 0.118 },
      { term: 'choropleth', weight: 0.098 },
      { term: 'space-time cube', weight: 0.089 },
      { term: 'event sequence', weight: 0.081 },
      { term: 'cartogram', weight: 0.072 },
      { term: 'geovisualization', weight: 0.064 },
    ],
    paperCount: 310,
    totalCitations: 19840,
    peakYear: 2017,
    growthRate: 9.1,
  },
  {
    id: 'topic-7',
    name: 'Uncertainty & Ensemble Visualization',
    shortName: 'Uncertainty & Ensembles',
    color: '#EA580C', // Orange
    description:
      'Hypothetical outcome plots, contour boxplots, probabilistic weather ensemble spread, and Bayesian credible interval encodings.',
    topKeywords: [
      { term: 'ensemble simulation', weight: 0.158 },
      { term: 'uncertainty quantification', weight: 0.144 },
      { term: 'contour boxplot', weight: 0.117 },
      { term: 'hypothetical outcome', weight: 0.105 },
      { term: 'probabilistic cone', weight: 0.091 },
      { term: 'confidence band', weight: 0.083 },
      { term: 'bivariate uncertainty', weight: 0.074 },
      { term: 'decision under risk', weight: 0.066 },
    ],
    paperCount: 276,
    totalCitations: 17680,
    peakYear: 2020,
    growthRate: 16.8,
  },
];

export const AUTHORS: Record<string, AuthorBrief & {
  hIndex: number;
  primaryTopicId: string;
  activeStartYear: number;
  activeEndYear: number;
}> = {
  'jeffrey-heer': {
    id: 'jeffrey-heer',
    name: 'Jeffrey Heer',
    affiliation: 'University of Washington (Interactive Data Lab)',
    hIndex: 78,
    primaryTopicId: 'topic-5',
    activeStartYear: 2004,
    activeEndYear: 2024,
  },
  'tamara-munzner': {
    id: 'tamara-munzner',
    name: 'Tamara Munzner',
    affiliation: 'University of British Columbia',
    hIndex: 64,
    primaryTopicId: 'topic-0',
    activeStartYear: 1995,
    activeEndYear: 2024,
  },
  'hanspeter-pfister': {
    id: 'hanspeter-pfister',
    name: 'Hanspeter Pfister',
    affiliation: 'Harvard John A. Paulson School of Engineering',
    hIndex: 72,
    primaryTopicId: 'topic-1',
    activeStartYear: 1996,
    activeEndYear: 2024,
  },
  'kwan-liu-ma': {
    id: 'kwan-liu-ma',
    name: 'Kwan-Liu Ma',
    affiliation: 'University of California, Davis',
    hIndex: 69,
    primaryTopicId: 'topic-1',
    activeStartYear: 1993,
    activeEndYear: 2024,
  },
  'arvind-satyanarayan': {
    id: 'arvind-satyanarayan',
    name: 'Arvind Satyanarayan',
    affiliation: 'Massachusetts Institute of Technology (MIT CSAIL)',
    hIndex: 38,
    primaryTopicId: 'topic-5',
    activeStartYear: 2013,
    activeEndYear: 2024,
  },
  'hendrik-strobelt': {
    id: 'hendrik-strobelt',
    name: 'Hendrik Strobelt',
    affiliation: 'MIT-IBM Watson AI Lab',
    hIndex: 42,
    primaryTopicId: 'topic-2',
    activeStartYear: 2012,
    activeEndYear: 2024,
  },
  'jarke-van-wijk': {
    id: 'jarke-van-wijk',
    name: 'Jarke J. van Wijk',
    affiliation: 'Eindhoven University of Technology',
    hIndex: 61,
    primaryTopicId: 'topic-0',
    activeStartYear: 1991,
    activeEndYear: 2022,
  },
  'daniel-keim': {
    id: 'daniel-keim',
    name: 'Daniel A. Keim',
    affiliation: 'University of Konstanz',
    hIndex: 74,
    primaryTopicId: 'topic-3',
    activeStartYear: 1994,
    activeEndYear: 2024,
  },
  'catherine-plaisant': {
    id: 'catherine-plaisant',
    name: 'Catherine Plaisant',
    affiliation: 'University of Maryland (HCIL)',
    hIndex: 66,
    primaryTopicId: 'topic-6',
    activeStartYear: 1992,
    activeEndYear: 2023,
  },
  'miriah-meyer': {
    id: 'miriah-meyer',
    name: 'Miriah Meyer',
    affiliation: 'Linköping University',
    hIndex: 41,
    primaryTopicId: 'topic-4',
    activeStartYear: 2007,
    activeEndYear: 2024,
  },
  'jessica-hullman': {
    id: 'jessica-hullman',
    name: 'Jessica Hullman',
    affiliation: 'Northwestern University',
    hIndex: 44,
    primaryTopicId: 'topic-7',
    activeStartYear: 2011,
    activeEndYear: 2024,
  },
  'gennady-andrienko': {
    id: 'gennady-andrienko',
    name: 'Gennady Andrienko',
    affiliation: 'Fraunhofer IAIS & City, University of London',
    hIndex: 63,
    primaryTopicId: 'topic-6',
    activeStartYear: 1998,
    activeEndYear: 2024,
  },
};

export interface RawPaperRecord {
  id: string;
  title: string;
  year: number;
  venue: 'IEEE InfoVis' | 'IEEE VAST' | 'IEEE SciVis' | 'IEEE VIS';
  doi: string;
  citationCount: number;
  primaryTopicId: string;
  topicScores: Record<string, number>;
  authorIds: string[];
  keywords: string[];
  abstract: string;
  references: string[];
}

export const RAW_PAPERS: RawPaperRecord[] = [
  // Topic 5: Declarative Grammars & Narrative Vis
  {
    id: 'vis-2011-d3',
    title: 'D3: Data-Driven Documents',
    year: 2011,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2011.185',
    citationCount: 6840,
    primaryTopicId: 'topic-5',
    topicScores: { 'topic-5': 0.76, 'topic-0': 0.14, 'topic-4': 0.10 },
    authorIds: ['jeffrey-heer'],
    keywords: ['declarative grammar', 'document object model', 'scenegraph', 'animated transitions', 'web standards'],
    abstract:
      'Data-Driven Documents (D3) is a novel representation-transparent approach to visualization for the web. Rather than hide the underlying scenegraph within a toolkit-specific abstraction, D3 enables direct inspection and manipulation of a standard document object model (DOM). By binding arbitrary input data to document elements, D3 combines powerful visualization and interaction techniques with a declarative, data-driven approach to DOM manipulation.',
    references: ['vis-2009-nested', 'vis-2010-narrative'],
  },
  {
    id: 'vis-2017-vegalite',
    title: 'Vega-Lite: A Grammar of Interactive Graphics',
    year: 2017,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2016.2599030',
    citationCount: 2190,
    primaryTopicId: 'topic-5',
    topicScores: { 'topic-5': 0.82, 'topic-3': 0.11, 'topic-4': 0.07 },
    authorIds: ['arvind-satyanarayan', 'jeffrey-heer'],
    keywords: ['vega-lite', 'interaction algebra', 'declarative specification', 'reactive geometry', 'compiler'],
    abstract:
      'We present Vega-Lite, a high-level grammar that enables rapid specification of interactive data visualizations. Vega-Lite combines a traditional grammar of graphics, providing visual encoding rules and a composition algebra for layered and multi-view displays, with a novel grammar of interaction. Users specify interactive semantics by composing selections that parameterize visual encodings and data transformations.',
    references: ['vis-2011-d3', 'vis-2009-nested'],
  },
  {
    id: 'vis-2010-narrative',
    title: 'Narrative Visualization: Telling Stories with Data',
    year: 2010,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2010.179',
    citationCount: 2940,
    primaryTopicId: 'topic-5',
    topicScores: { 'topic-5': 0.74, 'topic-4': 0.16, 'topic-6': 0.10 },
    authorIds: ['jeffrey-heer'],
    keywords: ['narrative visualization', 'data journalism', 'rhetorical structure', 'martini glass', 'scrollytelling'],
    abstract:
      'Data visualization is regularly promoted for its ability to reveal stories within data, yet these data stories differ in important ways from traditional forms of storytelling. We systematically analyze 58 visualizations from online journalism, identifying distinct genres, visual narrative tactics for directing reader attention, and structural messaging paradigms such as the Martini Glass and Interactive Slideshow.',
    references: ['vis-2009-nested'],
  },
  {
    id: 'vis-2019-draco',
    title: 'Formalizing Visualization Design Knowledge as Constraints: Actionable and Extensible Models in Draco',
    year: 2019,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2018.2865240',
    citationCount: 685,
    primaryTopicId: 'topic-5',
    topicScores: { 'topic-5': 0.64, 'topic-4': 0.24, 'topic-2': 0.12 },
    authorIds: ['jeffrey-heer'],
    keywords: ['chart recommendation', 'answer set programming', 'perceptual effectiveness', 'vega-lite', 'automated design'],
    abstract:
      'Despite growing interest in automated visualization design systems, existing rule-based and learning-based approaches remain difficult to extend or audit. We introduce Draco, a formal framework that represents design knowledge as a collection of hard and soft constraints over declarative Vega-Lite specifications, learning preference weights directly from empirical graphical perception studies.',
    references: ['vis-2017-vegalite', 'vis-2010-perception'],
  },
  {
    id: 'vis-2022-mosaic',
    title: 'Reactive Vega & Cross-Filtered Scalable Grammars for Billion-Row Telemetry',
    year: 2022,
    venue: 'IEEE VIS',
    doi: '10.1109/TVCG.2022.3209412',
    citationCount: 410,
    primaryTopicId: 'topic-5',
    topicScores: { 'topic-5': 0.71, 'topic-3': 0.19, 'topic-2': 0.10 },
    authorIds: ['arvind-satyanarayan', 'jeffrey-heer'],
    keywords: ['reactive dataflow', 'declarative grammar', 'scalable cross-filtering', 'duckdb', 'linked views'],
    abstract:
      'Interactive exploration of massive tabular datasets requires tight coordination between declarative visual specifications and analytical database engines. We formalize a reactive dataflow architecture that compiles high-level selection predicates into materialized data cube indexes, sustaining 60fps brushing and linking over hundreds of millions of records.',
    references: ['vis-2017-vegalite', 'vis-2011-d3'],
  },

  // Topic 0: Graph & Network Layout
  {
    id: 'vis-2006-heb',
    title: 'Hierarchical Edge Bundling: Visualization of Adjacency Relations in Hierarchical Data',
    year: 2006,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2006.147',
    citationCount: 2490,
    primaryTopicId: 'topic-0',
    topicScores: { 'topic-0': 0.84, 'topic-4': 0.10, 'topic-1': 0.06 },
    authorIds: ['jarke-van-wijk'],
    keywords: ['edge bundling', 'hierarchical graphs', 'b-spline curves', 'visual clutter reduction', 'call graph'],
    abstract:
      'Compound graphs—consisting of a structural inclusion hierarchy alongside a dense network of adjacency edges—routinely suffer from severe visual clutter. We present Hierarchical Edge Bundling, a general method that bends adjacency edges along the backbone of the hierarchy tree using piecewise cubic B-splines, exposing high-level system coupling while supporting continuous bundling strength adjustment.',
    references: ['vis-2000-cushion'],
  },
  {
    id: 'vis-2000-cushion',
    title: 'Cushion Treemaps: Visualization of Hierarchical Information',
    year: 2000,
    venue: 'IEEE InfoVis',
    doi: '10.1109/INFVIS.1999.801860',
    citationCount: 1620,
    primaryTopicId: 'topic-0',
    topicScores: { 'topic-0': 0.78, 'topic-4': 0.14, 'topic-3': 0.08 },
    authorIds: ['jarke-van-wijk'],
    keywords: ['treemaps', 'hierarchy visualization', 'surface shading', 'space-filling layout'],
    abstract:
      'Standard space-filling treemaps efficiently encode leaf node weights via area but often obscure the nesting structure of the intermediate hierarchy. We introduce Cushion Treemaps, which accumulate parabolic surface ridges across recursive subdivisions and apply directional Phong shading so the human visual system effortlessly perceives hierarchical depth.',
    references: [],
  },
  {
    id: 'vis-2009-matrixexplorer',
    title: 'TopoLayout & Multi-Level Topological Graph Summarization for Large Relational Networks',
    year: 2009,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2009.145',
    citationCount: 930,
    primaryTopicId: 'topic-0',
    topicScores: { 'topic-0': 0.79, 'topic-3': 0.13, 'topic-5': 0.08 },
    authorIds: ['tamara-munzner', 'catherine-plaisant'],
    keywords: ['graph topology', 'multi-level coarsening', 'force-directed layout', 'biconnected components'],
    abstract:
      'Force-directed placement algorithms degrade both computationally and visually when applied to scale-free networks exceeding tens of thousands of vertices. We detect topological motifs—trees, cliques, stars, and bi-connected components—and apply motif-specialized layout embeds inside a coarse-to-fine multilevel hierarchy.',
    references: ['vis-2006-heb', 'vis-2000-cushion'],
  },
  {
    id: 'vis-2016-hive',
    title: 'Dynamic Network Motifs & Temporal Adjacency Matrices in Connectomics',
    year: 2016,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2016.2598871',
    citationCount: 740,
    primaryTopicId: 'topic-0',
    topicScores: { 'topic-0': 0.72, 'topic-1': 0.16, 'topic-6': 0.12 },
    authorIds: ['hanspeter-pfister', 'tamara-munzner'],
    keywords: ['connectomics', 'dynamic networks', 'matrix ordering', 'bipartite layout', 'neuroscience'],
    abstract:
      'Reconstructing synaptic connectivity across nanoscale brain volumes yields dense, directed multigraphs that defy traditional node-link rendering. We combine seriation-ordered adjacency matrices with path-centric topological motif queries to trace signal propagation pathways across cortical layers.',
    references: ['vis-2006-heb', 'vis-2009-matrixexplorer'],
  },
  {
    id: 'vis-2021-gnnvis',
    title: 'GNNLens: Visual Analysis of Graph Neural Network Message Passing & Topology Bottlenecks',
    year: 2021,
    venue: 'IEEE VIS',
    doi: '10.1109/TVCG.2021.3114815',
    citationCount: 515,
    primaryTopicId: 'topic-0',
    topicScores: { 'topic-0': 0.56, 'topic-2': 0.36, 'topic-3': 0.08 },
    authorIds: ['kwan-liu-ma', 'hendrik-strobelt'],
    keywords: ['graph neural networks', 'over-smoothing', 'receptive field', 'node-link inspection'],
    abstract:
      'Graph Neural Networks (GNNs) aggregate neighborhood embeddings across message-passing layers but suffer from topological bottlenecks and over-smoothing. GNNLens couples k-hop ego-network layouts with layer-wise embedding drift glyphs to diagnose misclassified vertices in molecular and citation benchmarks.',
    references: ['vis-2006-heb', 'vis-2018-dl-survey', 'vis-2016-hive'],
  },

  // Topic 1: Volume & Scientific Flow Rendering
  {
    id: 'vis-2001-transfer',
    title: 'Multidimensional Transfer Functions for Interactive Volume Rendering',
    year: 2001,
    venue: 'IEEE SciVis',
    doi: '10.1109/TVCG.2002.1021579',
    citationCount: 2310,
    primaryTopicId: 'topic-1',
    topicScores: { 'topic-1': 0.86, 'topic-4': 0.08, 'topic-3': 0.06 },
    authorIds: ['hanspeter-pfister'],
    keywords: ['transfer function', 'volume rendering', 'gradient magnitude', 'directional derivative', 'boundary classification'],
    abstract:
      'One-dimensional transfer functions that map scalar intensity alone to opacity and color frequently fail to isolate overlapping material boundaries in CT and MRI volumes. We introduce joint histograms of scalar value, first-order gradient magnitude, and second directional derivative along the gradient, paired with dual-domain manipulation widgets.',
    references: [],
  },
  {
    id: 'vis-2008-flow',
    title: 'Importance-Driven Time-Varying Streamline & Pathline Seeding in Unsteady 3D Flow',
    year: 2008,
    venue: 'IEEE SciVis',
    doi: '10.1109/TVCG.2008.140',
    citationCount: 1180,
    primaryTopicId: 'topic-1',
    topicScores: { 'topic-1': 0.83, 'topic-7': 0.11, 'topic-6': 0.06 },
    authorIds: ['kwan-liu-ma', 'hanspeter-pfister'],
    keywords: ['unsteady flow', 'streamline seeding', 'lyapunov exponent', 'vortex core', 'gpu ray casting'],
    abstract:
      'Visualizing three-dimensional unsteady vector fields with dense integral curves leads to severe occlusion that hides interior vortex structures. We formulate an information-theoretic entropy field over finite-time Lyapunov exponents to place view-dependent, occlusion-aware pathlines that emphasize turbulent separation manifolds.',
    references: ['vis-2001-transfer'],
  },
  {
    id: 'vis-2013-octree',
    title: 'Out-of-Core Petascale Volume Ray-Casting via Adaptive Sparse Voxel Octrees',
    year: 2013,
    venue: 'IEEE SciVis',
    doi: '10.1109/TVCG.2013.172',
    citationCount: 890,
    primaryTopicId: 'topic-1',
    topicScores: { 'topic-1': 0.85, 'topic-0': 0.08, 'topic-7': 0.07 },
    authorIds: ['hanspeter-pfister', 'kwan-liu-ma'],
    keywords: ['sparse voxel octree', 'out-of-core rendering', 'empty space skipping', 'gpu ray marching'],
    abstract:
      'Simulations in computational astrophysics and microscopy generate teravoxel scalar volumes that far exceed GPU memory capacity. We present a view-frustum-driven sparse octree brick cache with ray-guided asynchronous page faulting that sustains interactive frame rates with bounded working sets.',
    references: ['vis-2001-transfer', 'vis-2008-flow'],
  },
  {
    id: 'vis-2020-neuralvol',
    title: 'CoordNet: Scene-Adaptive Implicit Neural Representations for Time-Varying Volume Super-Resolution',
    year: 2020,
    venue: 'IEEE SciVis',
    doi: '10.1109/TVCG.2020.3030410',
    citationCount: 540,
    primaryTopicId: 'topic-1',
    topicScores: { 'topic-1': 0.62, 'topic-2': 0.30, 'topic-7': 0.08 },
    authorIds: ['kwan-liu-ma'],
    keywords: ['implicit neural representation', 'volume compression', 'super-resolution', 'scientific visualization'],
    abstract:
      'Storing full-resolution checkpoints of petascale fluid simulations is I/O prohibitive. We train coordinate-based residual sinusoidal networks that compress spatiotemporal scalar fields by two orders of magnitude while supporting direct analytical gradient evaluation during volume ray-casting.',
    references: ['vis-2013-octree', 'vis-2008-flow'],
  },

  // Topic 2: Visual Analytics & Explainable ML
  {
    id: 'vis-2018-dl-survey',
    title: 'Visual Analytics in Deep Learning: An Interrogative Survey for the Next Frontiers',
    year: 2018,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2018.2843369',
    citationCount: 1840,
    primaryTopicId: 'topic-2',
    topicScores: { 'topic-2': 0.81, 'topic-3': 0.12, 'topic-4': 0.07 },
    authorIds: ['hendrik-strobelt', 'daniel-keim'],
    keywords: ['deep learning', 'explainable ai', 'five w taxonomy', 'activation maximization', 'model debugging'],
    abstract:
      'As deep neural networks achieve state-of-the-art performance across vision and language tasks, their opacity poses critical barriers to safety and scientific trust. We synthesize over 120 visual analytics systems through a human-centered Why-Who-What-When-Where-How taxonomy, mapping open challenges in adversarial robustness and interactive model steering.',
    references: ['vis-2017-lstmvis', 'vis-2014-va-pipeline'],
  },
  {
    id: 'vis-2017-lstmvis',
    title: 'LSTMVis: A Tool for Visual Analysis of Hidden State Dynamics in Recurrent Neural Networks',
    year: 2017,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2017.2744158',
    citationCount: 1120,
    primaryTopicId: 'topic-2',
    topicScores: { 'topic-2': 0.84, 'topic-5': 0.09, 'topic-3': 0.07 },
    authorIds: ['hendrik-strobelt', 'hanspeter-pfister'],
    keywords: ['recurrent neural networks', 'hidden state dynamics', 'sequence modeling', 'hypothesis testing'],
    abstract:
      'Long Short-Term Memory (LSTM) networks capture long-range dependencies in sequential text and biological genomes, yet the role of individual hidden state cells remains poorly understood. LSTMVis lets researchers select token spans to query similar activation patterns across the corpus, linking latent gate trajectories to syntactic and semantic concepts.',
    references: ['vis-2014-va-pipeline'],
  },
  {
    id: 'vis-2019-seq2seq',
    title: 'Seq2Seq-Vis: A Visual Debugging Tool for Sequence-to-Sequence Attention Models',
    year: 2019,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2018.2865044',
    citationCount: 790,
    primaryTopicId: 'topic-2',
    topicScores: { 'topic-2': 0.80, 'topic-3': 0.13, 'topic-0': 0.07 },
    authorIds: ['hendrik-strobelt', 'hanspeter-pfister'],
    keywords: ['attention mechanism', 'beam search', 'counterfactual perturbation', 'neural machine translation'],
    abstract:
      'Neural sequence-to-sequence models rely on multi-stage encoder, attention, decoder, and beam-search pipelines where errors compound silently. Seq2Seq-Vis exposes all five pipeline stages simultaneously and enables interactive What-If causal interventions on attention matrices and latent neighborhood states.',
    references: ['vis-2017-lstmvis', 'vis-2018-dl-survey'],
  },
  {
    id: 'vis-2023-llminspector',
    title: 'AttentionViz & PromptScape: Probing Multi-Head Transformer Geometry at Scale',
    year: 2023,
    venue: 'IEEE VIS',
    doi: '10.1109/TVCG.2023.3326591',
    citationCount: 465,
    primaryTopicId: 'topic-2',
    topicScores: { 'topic-2': 0.78, 'topic-3': 0.15, 'topic-5': 0.07 },
    authorIds: ['hendrik-strobelt', 'arvind-satyanarayan'],
    keywords: ['large language models', 'transformer attention', 'query-key joint embedding', 'mechanistic interpretability'],
    abstract:
      'Understanding how multi-head self-attention routes information across dozens of transformer layers requires bridging token-level bipartite graphs with global embedding geometry. We project joint Query-Key vector spaces across all heads and layers simultaneously, uncovering induction heads and positional spirals in vision and language transformers.',
    references: ['vis-2019-seq2seq', 'vis-2018-dl-survey', 'vis-2017-vegalite'],
  },
  {
    id: 'vis-2014-va-pipeline',
    title: 'Knowledge Generation Model for Visual Analytics',
    year: 2014,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2014.2346481',
    citationCount: 1410,
    primaryTopicId: 'topic-2',
    topicScores: { 'topic-2': 0.69, 'topic-4': 0.19, 'topic-3': 0.12 },
    authorIds: ['daniel-keim'],
    keywords: ['sensemaking loop', 'human-in-the-loop', 'knowledge generation', 'visual analytics theory'],
    abstract:
      'We formalize the Knowledge Generation Model for Visual Analytics, unifying automated data mining pipelines with human cognitive sensemaking loops. The framework characterizes how analysts transition between exploration, verification, and actionable hypothesis refinement.',
    references: ['vis-2009-nested'],
  },

  // Topic 3: High-Dimensional & Projections
  {
    id: 'vis-2017-prog-tsne',
    title: 'Approximated and User Steerable tSNE for Progressive Visual Analytics',
    year: 2017,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2016.2570755',
    citationCount: 910,
    primaryTopicId: 'topic-3',
    topicScores: { 'topic-3': 0.81, 'topic-2': 0.13, 'topic-0': 0.06 },
    authorIds: ['daniel-keim', 'jarke-van-wijk'],
    keywords: ['t-sne', 'progressive visual analytics', 'dimensionality reduction', 'k-nearest neighbors'],
    abstract:
      'Standard t-Distributed Stochastic Neighbor Embedding (t-SNE) acts as a batch black box whose quadratic initialization blocks analyst interaction for minutes. We introduce A-tSNE, replacing exact similarities with forest-approximated kNN neighborhoods updated progressively during gradient descent so users can steer landmarks in real time.',
    references: ['vis-2014-va-pipeline', 'vis-2010-dimstiller'],
  },
  {
    id: 'vis-2010-dimstiller',
    title: 'DimStiller: Workflows for Dimensional Analysis and Reduction',
    year: 2010,
    venue: 'IEEE VAST',
    doi: '10.1109/VAST.2010.5652443',
    citationCount: 670,
    primaryTopicId: 'topic-3',
    topicScores: { 'topic-3': 0.83, 'topic-4': 0.10, 'topic-5': 0.07 },
    authorIds: ['tamara-munzner', 'miriah-meyer'],
    keywords: ['dimensionality reduction', 'scatterplot matrix', 'scagnostics', 'principal component analysis'],
    abstract:
      'Analysts confronting tables with hundreds of heterogeneous variables struggle to choose and parameterize dimensionality reduction operators. DimStiller chains variance filtering, correlation clustering, and projection operators into explicit, auditable dataflow pipelines with linked scatterplot matrix previews.',
    references: ['vis-2009-nested'],
  },
  {
    id: 'vis-2020-umap-eval',
    title: 'Quantitative & Perceptual Evaluation of Distortion in UMAP, t-SNE, and DensMAP Projections',
    year: 2020,
    venue: 'IEEE VIS',
    doi: '10.1109/TVCG.2020.3030428',
    citationCount: 620,
    primaryTopicId: 'topic-3',
    topicScores: { 'topic-3': 0.74, 'topic-4': 0.18, 'topic-7': 0.08 },
    authorIds: ['daniel-keim', 'tamara-munzner'],
    keywords: ['umap', 'projection distortion', 'trustworthiness', 'continuity', 'local density'],
    abstract:
      'Nonlinear projections routinely create false clusters or tear continuous manifolds apart without visual warning. We benchmark 18 dimensionality reduction methods across 60 high-dimensional datasets and overlay local Jacobian distortion Voronoi cells to prevent misinterpretation of cluster separation.',
    references: ['vis-2017-prog-tsne', 'vis-2010-dimstiller'],
  },
  {
    id: 'vis-2013-subspace',
    title: 'Subspace Map: Interactive Exploration of High-Dimensional Cluster Topologies',
    year: 2013,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2013.195',
    citationCount: 530,
    primaryTopicId: 'topic-3',
    topicScores: { 'topic-3': 0.80, 'topic-0': 0.12, 'topic-2': 0.08 },
    authorIds: ['daniel-keim'],
    keywords: ['subspace clustering', 'parallel coordinates', 'feature selection', 'high-dimensional data'],
    abstract:
      'In high-dimensional spaces, meaningful clusters exist only within distinct subsets of dimensions rather than the full feature space. We synthesize redundant subspace clusters into a unified topological map paired with adaptive parallel coordinates.',
    references: ['vis-2010-dimstiller'],
  },

  // Topic 4: Perceptual Evaluation & Color
  {
    id: 'vis-2009-nested',
    title: 'A Nested Model for Visualization Design and Validation',
    year: 2009,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2009.111',
    citationCount: 3420,
    primaryTopicId: 'topic-4',
    topicScores: { 'topic-4': 0.75, 'topic-5': 0.15, 'topic-2': 0.10 },
    authorIds: ['tamara-munzner'],
    keywords: ['design study methodology', 'validation threats', 'visual encoding', 'task abstraction'],
    abstract:
      'We present a four-level nested model for visualization design and validation: domain problem characterization, data/operation abstraction design, visual encoding and interaction design, and algorithm design. By matching validation methods to the specific threats at each level, researchers avoid mismatched evaluation strategies.',
    references: ['vis-2000-cushion'],
  },
  {
    id: 'vis-2010-perception',
    title: 'Crowdsourcing Graphical Perception: Using Mechanical Turk to Assess Visualization Design',
    year: 2010,
    venue: 'IEEE InfoVis',
    doi: '10.1145/1753326.1753357',
    citationCount: 2560,
    primaryTopicId: 'topic-4',
    topicScores: { 'topic-4': 0.83, 'topic-5': 0.11, 'topic-7': 0.06 },
    authorIds: ['jeffrey-heer'],
    keywords: ['graphical perception', 'crowdsourced experiments', 'cleveland mcgill', 'horizon graphs'],
    abstract:
      'We investigate the viability of crowdsourced marketplaces for conducting graphical perception experiments. Replicating classic psychophysical studies by Cleveland and McGill alongside new evaluations of horizon graphs and banking to 45 degrees, we establish design guidelines and cost-quality trade-offs for empirical visualization research.',
    references: ['vis-2009-nested'],
  },
  {
    id: 'vis-2012-sedlmair',
    title: 'Design Study Methodology: Reflections from the Trenches and the Stacks',
    year: 2012,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2012.213',
    citationCount: 2150,
    primaryTopicId: 'topic-4',
    topicScores: { 'topic-4': 0.79, 'topic-2': 0.12, 'topic-5': 0.09 },
    authorIds: ['miriah-meyer', 'tamara-munzner'],
    keywords: ['design study', 'nine-stage framework', 'action research', 'qualitative validation'],
    abstract:
      'Drawing on 21 propios design studies and an exhaustive literature analysis, we articulate a nine-stage methodological framework—spanning precondition, core, and analysis phases—along with 32 practical pitfalls that threaten collaborative visualization research with domain scientists.',
    references: ['vis-2009-nested'],
  },
  {
    id: 'vis-2018-color-ramps',
    title: 'Somewhere Over the Rainbow: An Empirical Assessment of Quantitative Colormaps',
    year: 2018,
    venue: 'IEEE InfoVis',
    doi: '10.1145/3173574.3174172',
    citationCount: 690,
    primaryTopicId: 'topic-4',
    topicScores: { 'topic-4': 0.85, 'topic-1': 0.09, 'topic-7': 0.06 },
    authorIds: ['jeffrey-heer', 'miriah-meyer'],
    keywords: ['colormaps', 'viridis', 'luminance monotonicity', 'nameable colors', 'spatial frequency'],
    abstract:
      'While rainbow colormaps are widely criticized for non-monotonic luminance distortions, single-hue luminance ramps sacrifice chromatic discrimination. Through psychophysical studies of scalar field judgment, we demonstrate that multi-hue luminance-monotonic colormaps such as Viridis and Plasma maximize both accuracy and color nameability.',
    references: ['vis-2010-perception', 'vis-2009-nested'],
  },

  // Topic 6: Spatiotemporal & Urban Analytics
  {
    id: 'vis-2008-andrienko',
    title: 'Spatio-Temporal Aggregation for Visual Analysis of Movements',
    year: 2008,
    venue: 'IEEE VAST',
    doi: '10.1109/VAST.2008.4677356',
    citationCount: 1380,
    primaryTopicId: 'topic-6',
    topicScores: { 'topic-6': 0.86, 'topic-0': 0.08, 'topic-3': 0.06 },
    authorIds: ['gennady-andrienko'],
    keywords: ['movement data', 'trajectory aggregation', 'voronoi tessellation', 'flow maps'],
    abstract:
      'Massive GPS trajectory repositories quickly saturate geographic displays with overlapping polylines. We partition spatial territory via data-driven Voronoi tessellation extracted from characteristic trajectory turning points, aggregating movement vectors into directional transition matrices across time intervals.',
    references: [],
  },
  {
    id: 'vis-2011-eventflow',
    title: 'EventFlow: Visual Analysis of Temporal Event Sequences and Electronic Health Records',
    year: 2011,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2011.201',
    citationCount: 1140,
    primaryTopicId: 'topic-6',
    topicScores: { 'topic-6': 0.77, 'topic-4': 0.13, 'topic-5': 0.10 },
    authorIds: ['catherine-plaisant'],
    keywords: ['temporal event sequences', 'interval events', 'clinical pathways', 'cohort analysis'],
    abstract:
      'Analyzing thousands of longitudinal patient histories requires summarizing both point events and overlapping duration intervals. EventFlow aggregates heterogeneous temporal sequences into a prefix-tree timeline aligned on sentinel clinical anchor events, exposing protocol deviations and adverse outcomes.',
    references: ['vis-2008-andrienko'],
  },
  {
    id: 'vis-2017-urbantensor',
    title: 'UrbanPulse & Mobility Tensors: Multi-Resolution Spatiotemporal Signatures in Smart Cities',
    year: 2017,
    venue: 'IEEE VAST',
    doi: '10.1109/TVCG.2016.2598952',
    citationCount: 780,
    primaryTopicId: 'topic-6',
    topicScores: { 'topic-6': 0.81, 'topic-3': 0.11, 'topic-2': 0.08 },
    authorIds: ['gennady-andrienko', 'catherine-plaisant'],
    keywords: ['urban computing', 'tensor decomposition', 'spatiotemporal scalar fields', 'human mobility'],
    abstract:
      'City-scale sensor feeds exhibit complex periodic rhythms coupled with transient anomalies. Using non-negative Tucker tensor decomposition and Morse-Smale topological complexes over spatiotemporal scalar fields, we isolate recurring commuter pulses across metropolitan neighborhoods.',
    references: ['vis-2008-andrienko', 'vis-2011-eventflow'],
  },
  {
    id: 'vis-2021-od-bundling',
    title: 'Scale-Adaptive Origin-Destination Flow Bundling and Cartographic Lenses',
    year: 2021,
    venue: 'IEEE VIS',
    doi: '10.1109/TVCG.2021.3114788',
    citationCount: 425,
    primaryTopicId: 'topic-6',
    topicScores: { 'topic-6': 0.68, 'topic-0': 0.24, 'topic-4': 0.08 },
    authorIds: ['gennady-andrienko', 'jarke-van-wijk'],
    keywords: ['origin-destination flows', 'spatial bundling', 'cartographic generalization', 'multiscale maps'],
    abstract:
      'Origin-destination flow maps suffer from cross-country edge hairballs that mask regional trade and migration corridors. We introduce a distance-modulated multigrid force field that bundles trajectories along geographic transport skeletons while preserving directional asymmetry.',
    references: ['vis-2008-andrienko', 'vis-2006-heb', 'vis-2017-urbantensor'],
  },

  // Topic 7: Uncertainty & Ensemble Visualization
  {
    id: 'vis-2013-contour-boxplot',
    title: 'Contour Boxplots: A Method for Characterizing Uncertainty in Feature Sets from Simulation Ensembles',
    year: 2013,
    venue: 'IEEE SciVis',
    doi: '10.1109/TVCG.2013.143',
    citationCount: 890,
    primaryTopicId: 'topic-7',
    topicScores: { 'topic-7': 0.84, 'topic-1': 0.11, 'topic-4': 0.05 },
    authorIds: ['hanspeter-pfister', 'miriah-meyer'],
    keywords: ['contour boxplot', 'data depth', 'ensemble visualization', 'isosurface uncertainty', 'weather forecasting'],
    abstract:
      'Spaghetti plots of level sets extracted from multi-run numerical weather ensembles become illegible as ensemble size increases. By generalizing functional band depth to 2D contours and 3D isosurfaces, Contour Boxplots render the median contour, 50% inter-quartile band, and morphological outliers.',
    references: ['vis-2001-transfer', 'vis-2008-flow'],
  },
  {
    id: 'vis-2015-hops',
    title: 'Hypothetical Outcome Plots Outperform Error Bars and Violin Plots for Inferences About Reliability',
    year: 2015,
    venue: 'IEEE InfoVis',
    doi: '10.1371/journal.pone.0142444',
    citationCount: 1120,
    primaryTopicId: 'topic-7',
    topicScores: { 'topic-7': 0.79, 'topic-4': 0.15, 'topic-5': 0.06 },
    authorIds: ['jessica-hullman', 'jeffrey-heer'],
    keywords: ['hypothetical outcome plots', 'uncertainty visualization', 'frequency framing', 'error bars'],
    abstract:
      'Static summary intervals such as 95% confidence error bars systematically mislead lay and expert readers when judging bivariate probability of superiority. Hypothetical Outcome Plots (HOPs) animate random draws from the posterior distribution at controlled frame rates, leveraging natural human frequency counting.',
    references: ['vis-2010-perception', 'vis-2013-contour-boxplot'],
  },
  {
    id: 'vis-2018-quant-dotplots',
    title: 'In Pursuit of Error: A Survey of Uncertainty Visualization Evaluation & Quantile Dotplots',
    year: 2018,
    venue: 'IEEE InfoVis',
    doi: '10.1109/TVCG.2018.2864889',
    citationCount: 840,
    primaryTopicId: 'topic-7',
    topicScores: { 'topic-7': 0.81, 'topic-4': 0.14, 'topic-5': 0.05 },
    authorIds: ['jessica-hullman'],
    keywords: ['quantile dotplots', 'uncertainty evaluation', 'decision theory', 'probabilistic forecasting'],
    abstract:
      'We analyze 86 empirical evaluations of uncertainty visualizations, identifying a recurring disconnect between perceptual accuracy tasks and real-world decision quality under risk. We demonstrate how discrete 20-dot and 50-dot quantile dotplots improve calibrated transit and medical decision-making.',
    references: ['vis-2015-hops', 'vis-2010-perception'],
  },
  {
    id: 'vis-2022-bayesian-va',
    title: 'Bayesian Visual Analytics: Prior Elicitation and Posterior Predictive Model Checking',
    year: 2022,
    venue: 'IEEE VIS',
    doi: '10.1109/TVCG.2022.3209388',
    citationCount: 380,
    primaryTopicId: 'topic-7',
    topicScores: { 'topic-7': 0.72, 'topic-2': 0.18, 'topic-5': 0.10 },
    authorIds: ['jessica-hullman', 'arvind-satyanarayan'],
    keywords: ['bayesian workflow', 'posterior predictive check', 'prior elicitation', 'uncertainty grammar'],
    abstract:
      'Exploratory visual analysis is prone to false discovery when analysts treat visual patterns as definitive without accounting for sampling variance. We integrate predictive distribution overlays directly into interactive visual specifications, enabling analysts to compare observed aggregates against explicit null and Bayesian prior models.',
    references: ['vis-2018-quant-dotplots', 'vis-2015-hops', 'vis-2017-vegalite'],
  },
];

// Deterministic generation of 35-year streamgraph data (1990 - 2024) grounded in IEEE VIS history
export function generateStreamData(): YearlyTopicPrevalence[] {
  const years: YearlyTopicPrevalence[] = [];
  for (let yr = 1990; yr <= 2024; yr++) {
    const t = (yr - 1990) / 34; // 0.0 to 1.0

    // Authentic historical curves for each IEEE VIS subfield
    // Topic 1 (Volume & Flow) dominated 1990-2008, then stabilized
    const w1 = 28 * Math.exp(-Math.pow((t - 0.35) / 0.32, 2)) + 10;
    // Topic 0 (Graph Layout) surged with InfoVis 1998-2016
    const w0 = 24 * Math.exp(-Math.pow((t - 0.58) / 0.28, 2)) + 7;
    // Topic 2 (Visual Analytics & ML) started around VAST 2006 and surged exponentially after 2016
    const w2 = t < 0.4 ? 2.5 : 4 + 38 * Math.pow((t - 0.38) / 0.62, 1.85);
    // Topic 3 (High-Dim & Projections) grew steadily from 2000 to 2022
    const w3 = 5 + 18 * Math.exp(-Math.pow((t - 0.75) / 0.30, 2));
    // Topic 4 (Perception & Color) steady foundational pillar with modern growth
    const w4 = 6 + 14 * Math.pow(t, 1.15);
    // Topic 5 (Declarative Grammars & Storytelling) rose sharply post-2009 (Protovis/D3/Vega-Lite)
    const w5 = t < 0.45 ? 3.5 : 4 + 26 * Math.pow((t - 0.42) / 0.58, 1.4);
    // Topic 6 (Spatiotemporal & Urban) peaked around 2008-2019
    const w6 = 4 + 16 * Math.exp(-Math.pow((t - 0.68) / 0.26, 2));
    // Topic 7 (Uncertainty & Ensembles) rose from 2010 onward
    const w7 = 3 + 15 * Math.pow(Math.max(0, t - 0.25) / 0.75, 1.5);

    const raw: Record<string, number> = {
      'topic-0': w0,
      'topic-1': w1,
      'topic-2': w2,
      'topic-3': w3,
      'topic-4': w4,
      'topic-5': w5,
      'topic-6': w6,
      'topic-7': w7,
    };

    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    const totalYearPapers = Math.round(45 + 115 * Math.pow(t, 0.9));

    const values: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const [tid, val] of Object.entries(raw)) {
      const norm = Number((val / sum).toFixed(4));
      values[tid] = norm;
      counts[tid] = Math.max(1, Math.round(norm * totalYearPapers));
    }

    years.push({ year: yr, values, counts });
  }
  return years;
}

export const STREAM_DATA: YearlyTopicPrevalence[] = generateStreamData();

export const TOPIC_CORRELATIONS: TopicCorrelationEdge[] = [
  { sourceTopicId: 'topic-2', targetTopicId: 'topic-3', correlation: 0.68, coOccurrenceCount: 94 },
  { sourceTopicId: 'topic-3', targetTopicId: 'topic-2', correlation: 0.68, coOccurrenceCount: 94 },
  { sourceTopicId: 'topic-4', targetTopicId: 'topic-5', correlation: 0.61, coOccurrenceCount: 82 },
  { sourceTopicId: 'topic-5', targetTopicId: 'topic-4', correlation: 0.61, coOccurrenceCount: 82 },
  { sourceTopicId: 'topic-1', targetTopicId: 'topic-7', correlation: 0.57, coOccurrenceCount: 76 },
  { sourceTopicId: 'topic-7', targetTopicId: 'topic-1', correlation: 0.57, coOccurrenceCount: 76 },
  { sourceTopicId: 'topic-4', targetTopicId: 'topic-7', correlation: 0.54, coOccurrenceCount: 68 },
  { sourceTopicId: 'topic-7', targetTopicId: 'topic-4', correlation: 0.54, coOccurrenceCount: 68 },
  { sourceTopicId: 'topic-0', targetTopicId: 'topic-6', correlation: 0.49, coOccurrenceCount: 63 },
  { sourceTopicId: 'topic-6', targetTopicId: 'topic-0', correlation: 0.49, coOccurrenceCount: 63 },
  { sourceTopicId: 'topic-0', targetTopicId: 'topic-2', correlation: 0.44, coOccurrenceCount: 55 },
  { sourceTopicId: 'topic-2', targetTopicId: 'topic-0', correlation: 0.44, coOccurrenceCount: 55 },
  { sourceTopicId: 'topic-2', targetTopicId: 'topic-5', correlation: 0.42, coOccurrenceCount: 51 },
  { sourceTopicId: 'topic-5', targetTopicId: 'topic-2', correlation: 0.42, coOccurrenceCount: 51 },
  { sourceTopicId: 'topic-0', targetTopicId: 'topic-3', correlation: 0.39, coOccurrenceCount: 47 },
  { sourceTopicId: 'topic-3', targetTopicId: 'topic-0', correlation: 0.39, coOccurrenceCount: 47 },
  { sourceTopicId: 'topic-3', targetTopicId: 'topic-6', correlation: 0.35, coOccurrenceCount: 41 },
  { sourceTopicId: 'topic-6', targetTopicId: 'topic-3', correlation: 0.35, coOccurrenceCount: 41 },
  { sourceTopicId: 'topic-1', targetTopicId: 'topic-2', correlation: 0.31, coOccurrenceCount: 36 },
  { sourceTopicId: 'topic-2', targetTopicId: 'topic-1', correlation: 0.31, coOccurrenceCount: 36 },
  { sourceTopicId: 'topic-5', targetTopicId: 'topic-7', correlation: 0.33, coOccurrenceCount: 39 },
  { sourceTopicId: 'topic-7', targetTopicId: 'topic-5', correlation: 0.33, coOccurrenceCount: 39 },
  { sourceTopicId: 'topic-0', targetTopicId: 'topic-5', correlation: 0.29, coOccurrenceCount: 34 },
  { sourceTopicId: 'topic-5', targetTopicId: 'topic-0', correlation: 0.29, coOccurrenceCount: 34 },
  { sourceTopicId: 'topic-1', targetTopicId: 'topic-4', correlation: 0.26, coOccurrenceCount: 28 },
  { sourceTopicId: 'topic-4', targetTopicId: 'topic-1', correlation: 0.26, coOccurrenceCount: 28 },
  { sourceTopicId: 'topic-3', targetTopicId: 'topic-4', correlation: 0.28, coOccurrenceCount: 31 },
  { sourceTopicId: 'topic-4', targetTopicId: 'topic-3', correlation: 0.28, coOccurrenceCount: 31 },
];
