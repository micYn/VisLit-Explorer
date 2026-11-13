import {
  AuthorBrief,
  TopicCorrelationEdge,
  TopicSummary,
  YearlyTopicPrevalence,
} from '../types';

export interface VispubJsonRecord {
  doi: string;
  title: string;
  year: number;
  conference: string; // "Vis" | "InfoVis" | "VAST" | "SciVis"
  paperType: string; // "J" | "C" | "M"
  link: string;
  abstract: string;
  authors: string[];
  affiliations: string[];
  keywords: string[];
  internalReferences: string[];
  citations: number;
  citationCountCrossRef: number | null;
  aminerCitationCount: number | null;
  downloadsXplore: number;
  award: string | null;
}

export interface RawPaperRecord {
  id: string;
  title: string;
  year: number;
  venue: 'IEEE InfoVis' | 'IEEE VAST' | 'IEEE SciVis' | 'IEEE VIS';
  doi: string;
  url?: string;
  paperType?: string;
  award?: string | null;
  downloadsXplore?: number;
  citationCount: number;
  primaryTopicId: string;
  topicScores: Record<string, number>;
  authorIds: string[];
  keywords: string[];
  abstract: string;
  references: string[];
}

export type CorpusAuthorRecord = AuthorBrief & {
  hIndex: number;
  visPaperCount: number;
  visCitations: number;
  primaryTopicId: string;
  activeStartYear: number;
  activeEndYear: number;
};

interface TopicDefinition {
  id: string;
  name: string;
  shortName: string;
  color: string;
  description: string;
  keywordGroupingSummary: string;
  /** Weighted domain vocabulary (unigrams & bigrams) used to classify real papers cleanly */
  vocab: Array<[string, number]>;
  /** Default fallback keywords if a subset has sparse metadata */
  seedKeywords: Array<{ term: string; weight: number }>;
  conferencePrior: Partial<Record<RawPaperRecord['venue'], number>>;
}

export const BASE_TOPICS: TopicDefinition[] = [
  {
    id: 'topic-0',
    name: 'Graph & Network Visualization',
    shortName: 'Graph & Network',
    color: '#2B5C8F',
    description:
      'Investigates how to draw complex networks, hierarchies, and connected systems clearly without tangled links.',
    keywordGroupingSummary:
      'Co-occurs in papers designing readable node-link diagrams, matrix views, tree layouts, and edge-bundling algorithms.',
    vocab: [
      ['graph drawing', 4.2],
      ['node-link', 4.0],
      ['edge bundling', 4.2],
      ['force-directed', 3.8],
      ['adjacency matrix', 3.8],
      ['treemap', 3.8],
      ['hierarchy', 3.0],
      ['hierarchical', 2.8],
      ['graph', 3.2],
      ['graphs', 3.2],
      ['network', 2.9],
      ['networks', 2.9],
      ['tree', 2.4],
      ['trees', 2.4],
      ['layout', 2.2],
      ['edge', 2.2],
      ['edges', 2.2],
      ['node', 2.0],
      ['nodes', 2.0],
      ['chord', 2.2],
      ['planar', 2.8],
      ['crossing', 2.4],
      ['subgraph', 3.0],
      ['bipartite', 3.0],
      ['hypergraph', 3.4],
      ['dynamic graph', 3.8],
      ['dynamic network', 3.8],
      ['ego-network', 3.4],
      ['community detection', 2.8],
      ['social network', 2.8],
      ['citation network', 2.8],
      ['taxonomy', 2.0],
    ],
    seedKeywords: [
      { term: 'graph drawing', weight: 0.2 },
      { term: 'node-link diagram', weight: 0.18 },
      { term: 'edge bundling', weight: 0.16 },
      { term: 'treemap', weight: 0.14 },
      { term: 'dynamic network', weight: 0.12 },
      { term: 'adjacency matrix', weight: 0.1 },
      { term: 'force-directed layout', weight: 0.06 },
      { term: 'hierarchy', weight: 0.04 },
    ],
    conferencePrior: { 'IEEE InfoVis': 0.25 },
  },
  {
    id: 'topic-1',
    name: 'Scientific & Volume Visualization (SciVis)',
    shortName: 'SciVis & Volume',
    color: '#1F9D8B',
    description:
      'Focuses on rendering medical scans, fluid flows, scalar/vector fields, and physical simulations from engineering and biology.',
    keywordGroupingSummary:
      'Groups around algorithms for direct volume rendering, flow streamlines, isosurfaces, unstructured meshes, and topological data analysis.',
    vocab: [
      ['volume rendering', 4.2],
      ['direct volume', 4.0],
      ['ray casting', 3.8],
      ['ray-casting', 3.8],
      ['transfer function', 3.8],
      ['isosurface', 3.8],
      ['isosurfaces', 3.8],
      ['marching cubes', 3.8],
      ['scalar field', 3.6],
      ['vector field', 3.6],
      ['tensor field', 3.6],
      ['flow visualization', 3.8],
      ['streamline', 3.5],
      ['streamlines', 3.5],
      ['pathline', 3.5],
      ['stream surface', 3.6],
      ['fluid', 3.2],
      ['vortex', 3.4],
      ['turbulence', 3.2],
      ['molecular', 3.2],
      ['medical visualization', 3.8],
      ['ct', 2.8],
      ['mri', 3.0],
      ['unstructured mesh', 3.8],
      ['unstructured grid', 3.8],
      ['tetrahedral', 3.5],
      ['hexahedral', 3.5],
      ['topological data analysis', 3.8],
      ['morse-smale', 3.8],
      ['scientific visualization', 3.4],
    ],
    seedKeywords: [
      { term: 'volume rendering', weight: 0.22 },
      { term: 'flow visualization', weight: 0.18 },
      { term: 'isosurface', weight: 0.16 },
      { term: 'transfer function', weight: 0.14 },
      { term: 'vector field', weight: 0.11 },
      { term: 'scalar field', weight: 0.08 },
      { term: 'unstructured mesh', weight: 0.06 },
      { term: 'topological data analysis', weight: 0.05 },
    ],
    conferencePrior: { 'IEEE SciVis': 0.45 },
  },
  {
    id: 'topic-2',
    name: 'Visual Analytics & Machine Learning / XAI',
    shortName: 'Visual Analytics & XAI',
    color: '#7B5EA7',
    description:
      'Designs interactive visual tools that help people inspect, debug, steer, and explain machine learning and AI models.',
    keywordGroupingSummary:
      'Clusters around opening black-box neural networks, auditing model predictions, anomaly detection, and interactive AI steering.',
    vocab: [
      ['explainable ai', 4.5],
      ['xai', 4.2],
      ['machine learning', 4.0],
      ['deep learning', 4.0],
      ['neural network', 4.0],
      ['neural networks', 4.0],
      ['large language model', 4.2],
      ['llm', 4.0],
      ['llms', 4.0],
      ['multimodal model', 3.8],
      ['transformer', 3.4],
      ['attention mechanism', 3.4],
      ['reinforcement learning', 3.8],
      ['federated learning', 3.8],
      ['graph neural network', 4.0],
      ['gnn', 3.6],
      ['anomaly detection', 3.6],
      ['model steering', 3.8],
      ['model debugging', 3.8],
      ['classifier', 3.0],
      ['classification', 2.8],
      ['training', 2.4],
      ['inference', 2.4],
      ['prediction', 2.4],
      ['predictions', 2.4],
      ['visual analytics', 2.8],
      ['interpretable', 3.0],
      ['interpretability', 3.4],
      ['explainability', 3.6],
      ['explain', 2.2],
      ['fairness', 3.0],
      ['bias', 2.2],
      ['robustness', 2.8],
      ['adversarial', 3.2],
      ['saliency', 2.6],
      ['ai', 2.6],
      ['decision tree', 2.8],
      ['random forest', 3.0],
      ['ensemble', 2.4],
      ['generative', 3.0],
      ['diffusion', 2.8],
    ],
    seedKeywords: [
      { term: 'explainable ai', weight: 0.22 },
      { term: 'machine learning', weight: 0.19 },
      { term: 'deep learning', weight: 0.16 },
      { term: 'neural network', weight: 0.14 },
      { term: 'interpretability', weight: 0.11 },
      { term: 'anomaly detection', weight: 0.08 },
      { term: 'large language model', weight: 0.06 },
      { term: 'model steering', weight: 0.04 },
    ],
    conferencePrior: { 'IEEE VAST': 0.5 },
  },
  {
    id: 'topic-3',
    name: 'High-Dimensional & Multivariate Data',
    shortName: 'High-Dimensional Data',
    color: '#D9822B',
    description:
      'Explores techniques for summarizing datasets with dozens or hundreds of variables into readable 2D visual patterns.',
    keywordGroupingSummary:
      'Connects dimensionality reduction (t-SNE, UMAP, PCA) with parallel coordinates, scatterplots, and multi-attribute tables.',
    vocab: [
      ['dimensionality reduction', 4.5],
      ['high-dimensional', 4.2],
      ['high dimensional', 4.2],
      ['multidimensional', 3.8],
      ['multivariate', 3.8],
      ['parallel coordinates', 4.2],
      ['scatterplot', 3.6],
      ['scatterplots', 3.6],
      ['scatter plot', 3.6],
      ['t-sne', 4.2],
      ['tsne', 4.2],
      ['umap', 4.2],
      ['pca', 3.6],
      ['principal component', 3.8],
      ['mds', 3.4],
      ['projection', 3.2],
      ['projections', 3.2],
      ['embedding', 3.0],
      ['embeddings', 3.0],
      ['latent space', 3.6],
      ['subspace', 3.6],
      ['cluster', 2.6],
      ['clustering', 2.8],
      ['clusters', 2.6],
      ['correlation', 2.6],
      ['attribute', 2.2],
      ['attributes', 2.2],
      ['tabular', 3.0],
      ['table', 2.4],
      ['splom', 3.8],
      ['glyph', 2.4],
      ['glyphs', 2.4],
      ['heatmap', 2.8],
      ['bicluster', 3.4],
      ['time series', 2.6],
      ['time-series', 2.6],
    ],
    seedKeywords: [
      { term: 'dimensionality reduction', weight: 0.21 },
      { term: 'high-dimensional data', weight: 0.18 },
      { term: 'parallel coordinates', weight: 0.15 },
      { term: 'scatterplot', weight: 0.14 },
      { term: 'projection', weight: 0.12 },
      { term: 'clustering', weight: 0.08 },
      { term: 'multivariate', weight: 0.07 },
      { term: 'embedding', weight: 0.05 },
    ],
    conferencePrior: { 'IEEE InfoVis': 0.15, 'IEEE VAST': 0.2 },
  },
  {
    id: 'topic-4',
    name: 'Perception & Color / Evaluation',
    shortName: 'Perception & Evaluation',
    color: '#C84B5A',
    description:
      'Studies how human vision and cognition interpret charts, color scales, and uncertainty through empirical user studies.',
    keywordGroupingSummary:
      'Links human-subject experiments, perceptual accuracy benchmarks, uncertainty communication, and accessible colormap design.',
    vocab: [
      ['perception', 4.2],
      ['perceptual', 4.0],
      ['graphical perception', 4.5],
      ['user study', 3.8],
      ['empirical study', 4.0],
      ['evaluation', 3.0],
      ['crowdsourced', 3.6],
      ['crowdsourcing', 3.6],
      ['colormap', 4.2],
      ['colormaps', 4.2],
      ['color scale', 4.0],
      ['color', 2.8],
      ['colour', 2.8],
      ['cognition', 3.8],
      ['cognitive', 3.6],
      ['visual attention', 3.8],
      ['eye tracking', 4.0],
      ['eye-tracking', 4.0],
      ['gaze', 3.4],
      ['uncertainty', 3.4],
      ['memorability', 3.8],
      ['readability', 3.2],
      ['clutter', 3.0],
      ['bias', 2.6],
      ['trust', 2.8],
      ['literacy', 3.8],
      ['accessible', 3.4],
      ['accessibility', 3.6],
      ['tactile', 3.4],
      ['blind', 3.2],
      ['human-subject', 3.8],
      ['experiment', 2.6],
      ['psychophysics', 3.8],
      ['accuracy', 2.2],
      ['judgment', 3.2],
      ['judgments', 3.2],
      ['qualitative', 2.4],
      ['design study', 2.8],
    ],
    seedKeywords: [
      { term: 'user study', weight: 0.2 },
      { term: 'perception', weight: 0.19 },
      { term: 'evaluation', weight: 0.16 },
      { term: 'colormap', weight: 0.14 },
      { term: 'uncertainty', weight: 0.11 },
      { term: 'cognition', weight: 0.08 },
      { term: 'visualization literacy', weight: 0.07 },
      { term: 'accessibility', weight: 0.05 },
    ],
    conferencePrior: { 'IEEE InfoVis': 0.2 },
  },
  {
    id: 'topic-5',
    name: 'Interaction Techniques & Human-in-the-Loop',
    shortName: 'Interaction & Toolkits',
    color: '#4E9A51',
    description:
      'Builds declarative visualization toolkits, grammars, and direct-manipulation interactions that support rapid visual exploration.',
    keywordGroupingSummary:
      'Unites declarative visualization grammars, SVG/canvas authoring tools, mixed-initiative interfaces, and responsive interaction.',
    vocab: [
      ['declarative', 4.2],
      ['grammar', 4.0],
      ['grammar of graphics', 4.5],
      ['vega-lite', 4.5],
      ['vega', 3.8],
      ['d3', 3.8],
      ['toolkit', 3.8],
      ['toolkits', 3.8],
      ['authoring', 4.0],
      ['visualization by example', 4.2],
      ['visualization template', 4.0],
      ['svg', 3.8],
      ['interaction', 3.2],
      ['interactive', 2.4],
      ['direct manipulation', 4.0],
      ['brushing', 3.6],
      ['linking', 2.6],
      ['specification', 3.4],
      ['sketch', 3.4],
      ['sketching', 3.4],
      ['gesture', 3.4],
      ['touch', 2.8],
      ['mobile', 2.8],
      ['immersive', 3.2],
      ['virtual reality', 3.4],
      ['augmented reality', 3.4],
      ['ar/vr', 3.6],
      ['dashboard', 3.2],
      ['dashboards', 3.2],
      ['provenance', 3.2],
      ['recommender', 3.4],
      ['recommendation', 3.2],
      ['chart', 2.4],
      ['infographic', 3.2],
      ['infographics', 3.2],
      ['reusing', 3.0],
      ['adapting', 2.8],
      ['animation', 3.2],
      ['animated', 3.0],
      ['transition', 2.8],
      ['transitions', 2.8],
      ['widget', 2.8],
      ['widgets', 2.8],
      ['mixed-initiative', 3.2],
      ['conversational', 2.8],
      ['query', 2.2],
      ['browser', 2.4],
    ],
    seedKeywords: [
      { term: 'interaction', weight: 0.2 },
      { term: 'authoring tool', weight: 0.17 },
      { term: 'declarative grammar', weight: 0.16 },
      { term: 'visualization toolkit', weight: 0.13 },
      { term: 'direct manipulation', weight: 0.12 },
      { term: 'brushing & linking', weight: 0.09 },
      { term: 'animation', weight: 0.07 },
      { term: 'recommendation', weight: 0.06 },
    ],
    conferencePrior: { 'IEEE InfoVis': 0.25 },
  },
  {
    id: 'topic-6',
    name: 'Geospatial & Spatial Data',
    shortName: 'Geospatial & Spatial',
    color: '#5B8DBE',
    description:
      'Develops map-based visualizations and trajectory views to analyze human mobility, urban infrastructure, and geographic patterns.',
    keywordGroupingSummary:
      'Combines trajectory analytics, origin-destination flows, cartograms, climate/weather maps, and urban spatio-temporal systems.',
    vocab: [
      ['geospatial', 4.5],
      ['geographic', 4.0],
      ['cartogram', 4.2],
      ['cartographic', 4.0],
      ['cartography', 4.0],
      ['trajectory', 4.2],
      ['trajectories', 4.2],
      ['spatiotemporal', 4.2],
      ['spatio-temporal', 4.2],
      ['urban', 4.0],
      ['city', 3.4],
      ['cities', 3.4],
      ['mobility', 4.0],
      ['traffic', 3.8],
      ['origin-destination', 4.2],
      ['flow map', 4.2],
      ['choropleth', 4.2],
      ['map', 3.2],
      ['maps', 3.2],
      ['gis', 3.8],
      ['gps', 3.8],
      ['spatial', 2.8],
      ['movement', 3.2],
      ['location', 2.6],
      ['region', 2.2],
      ['regional', 2.2],
      ['climate', 2.8],
      ['weather', 2.8],
      ['ocean', 2.6],
      ['terrain', 3.2],
      ['satellite', 2.8],
      ['transportation', 3.6],
      ['route', 3.0],
      ['routes', 3.0],
    ],
    seedKeywords: [
      { term: 'geospatial', weight: 0.21 },
      { term: 'spatio-temporal', weight: 0.18 },
      { term: 'trajectory', weight: 0.16 },
      { term: 'urban mobility', weight: 0.14 },
      { term: 'cartography', weight: 0.11 },
      { term: 'flow map', weight: 0.09 },
      { term: 'choropleth', weight: 0.06 },
      { term: 'gis', weight: 0.05 },
    ],
    conferencePrior: { 'IEEE VAST': 0.25 },
  },
  {
    id: 'topic-7',
    name: 'Text & Document Analytics',
    shortName: 'Text & Documents',
    color: '#B85D3B',
    description:
      'Creates visual summaries and narrative timelines to help people read, search, and synthesize large collections of documents.',
    keywordGroupingSummary:
      'Brings together document topic streams, visual storytelling, event sequences, news corpora, and discourse/sentiment analysis.',
    vocab: [
      ['text visualization', 4.5],
      ['document', 3.6],
      ['documents', 3.6],
      ['text', 3.2],
      ['corpus', 3.6],
      ['corpora', 3.6],
      ['topic model', 4.0],
      ['topic modeling', 4.0],
      ['lda', 3.8],
      ['narrative', 4.0],
      ['storytelling', 4.2],
      ['data storytelling', 4.4],
      ['news', 3.0],
      ['social media', 3.4],
      ['twitter', 3.4],
      ['sentiment', 3.8],
      ['discourse', 3.8],
      ['conversation', 3.0],
      ['timeline', 3.2],
      ['event sequence', 3.8],
      ['event sequences', 3.8],
      ['word cloud', 4.0],
      ['wordcloud', 4.0],
      ['natural language', 3.8],
      ['nlp', 3.6],
      ['literature', 3.0],
      ['citation', 2.4],
      ['scholarly', 3.0],
      ['journalism', 3.6],
      ['annotation', 2.8],
      ['annotations', 2.8],
      ['caption', 3.2],
      ['captions', 3.2],
      ['video', 2.6],
      ['music', 2.6],
      ['digital humanities', 3.6],
    ],
    seedKeywords: [
      { term: 'text analytics', weight: 0.2 },
      { term: 'data storytelling', weight: 0.18 },
      { term: 'document collection', weight: 0.16 },
      { term: 'narrative', weight: 0.14 },
      { term: 'event sequence', weight: 0.11 },
      { term: 'topic modeling', weight: 0.09 },
      { term: 'sentiment analysis', weight: 0.07 },
      { term: 'natural language', weight: 0.05 },
    ],
    conferencePrior: { 'IEEE VAST': 0.2 },
  },
];

// Mutable runtime dataset populated either from fetch('/data/vispubdata_1990_2025.json') in the browser
// or via initializeCorpus() in Node tests. Starts empty with zero synthetic/hardcoded papers.
export let RAW_PAPERS: RawPaperRecord[] = [];
export let AUTHORS: Record<string, CorpusAuthorRecord> = {};
export let VISPUB_YEARLY_TOTALS: Record<number, number> = {};
export let STREAM_DATA: YearlyTopicPrevalence[] = [];
export let TOPICS: TopicSummary[] = BASE_TOPICS.map((t) => ({
  id: t.id,
  name: t.name,
  shortName: t.shortName,
  color: t.color,
  description: t.description,
  keywordGroupingSummary: t.keywordGroupingSummary,
  topKeywords: t.seedKeywords,
  paperCount: 0,
  indexedPaperCount: 0,
  totalCitations: 0,
  peakYear: 2025,
  growthRate: 0,
}));
export let TOPIC_CORRELATIONS: TopicCorrelationEdge[] = [];

const CORPUS_START_YEAR = 1990;
const CORPUS_END_YEAR = 2025;
const STOP_WORDS = new Set([
  'about', 'above', 'across', 'after', 'against', 'among', 'analysis', 'approach', 'based',
  'between', 'beyond', 'building', 'case', 'charts', 'data', 'design', 'different', 'domain',
  'effective', 'enable', 'enables', 'evaluate', 'evaluating', 'evaluation', 'existing',
  'exploration', 'explore', 'exploring', 'framework', 'from', 'however', 'improve', 'improved',
  'improving', 'information', 'large', 'methods', 'multiple', 'novel', 'other', 'overview',
  'paper', 'patterns', 'present', 'presents', 'propose', 'proposed', 'provide', 'provides',
  'recent', 'representation', 'results', 'several', 'show', 'shows', 'single', 'small',
  'support', 'supports', 'system', 'systems', 'tasks', 'technique', 'techniques', 'their',
  'these', 'this', 'three', 'through', 'tools', 'understanding', 'user', 'users', 'using',
  'various', 'visual', 'visualization', 'visualizations', 'visualize', 'visualizing',
  'while', 'with', 'within', 'without', 'workflow', 'study',
]);

const GENERIC_FIELD_PHRASES = new Set([
  'information visualization',
  'information visualisation',
  'visual analytics',
  'data visualization',
  'data visualisation',
  'scientific visualization',
  'scientific visualisation',
  'visualization',
  'visualizations',
  'visualisation',
  'interactive visualization',
  'visual analysis',
  'visual exploration',
  'exploratory data analysis',
  'computer graphics',
]);

let onCorpusUpdatedCallback: (() => void) | null = null;
export function registerCorpusResetListener(cb: () => void): void {
  onCorpusUpdatedCallback = cb;
}

export function normalizeVispubDoi(rawDoi?: string | null): string {
  if (!rawDoi) return '';
  const cleaned = rawDoi.trim().toLowerCase();
  if (
    !cleaned ||
    cleaned === 'na' ||
    cleaned === 'n/a' ||
    cleaned === 'null' ||
    cleaned === 'none' ||
    cleaned === 'nan' ||
    cleaned === '-'
  ) {
    return '';
  }
  // Recover upstream Vispubdata DOI typos missing the leading "1" (e.g., "0.1109/tvcg..." -> "10.1109/tvcg...")
  return cleaned.replace(/^0\.1109\//, '10.1109/');
}

export function cleanAuthorDisplayName(rawName: string): string {
  if (!rawName) return 'Anonymous VIS Researcher';
  const cleaned = rawName.trim().replace(/\s+\d{3,4}$/, '').trim();
  return cleaned || rawName.trim();
}

export function slugifyAuthorName(rawName: string): string {
  const ascii = (rawName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'anonymous-vis-researcher';
}

export function normalizeConferenceToVenue(conference: string): RawPaperRecord['venue'] {
  const c = (conference || '').trim().toLowerCase();
  if (c === 'infovis' || c.includes('infovis')) return 'IEEE InfoVis';
  if (c === 'vast' || c.includes('vast')) return 'IEEE VAST';
  if (c === 'scivis' || c.includes('scivis')) return 'IEEE SciVis';
  return 'IEEE VIS';
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Precompile whole-word/phrase RegExps once for fast classification across 4,008 real papers
const COMPILED_TOPIC_VOCAB = BASE_TOPICS.map((t) => ({
  id: t.id,
  patterns: t.vocab.map(([term, weight]) => ({
    regex: new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?=$|[^a-z0-9])`, 'g'),
    weight,
  })),
  conferencePrior: t.conferencePrior,
}));

/**
 * Classifies a real Vispubdata paper into the 8 canonical IEEE VIS research subfields
 * using weighted multi-field evidence: 2.2x AuthorKeywords + 1.6x Title + 0.75x Abstract + Venue prior,
 * smoothed with Dirichlet prior alpha = 0.125.
 * When a paper has zero vocabulary matches and uniform baseline scores, breaks ties deterministically
 * via venue/era/paperType metadata instead of defaulting blindly to BASE_TOPICS[0] (Graph & Network).
 */
export function classifyRealPaperTopics(params: {
  title: string;
  abstract: string;
  keywords: string[];
  venue: RawPaperRecord['venue'];
  year?: number;
  paperType?: string;
}): { primaryTopicId: string; topicScores: Record<string, number> } {
  const titleLower = (params.title || '').toLowerCase();
  const abstractLower = (params.abstract || '').toLowerCase();
  const kwLower = (params.keywords || []).join(' , ').toLowerCase();

  const rawScores: Record<string, number> = {};
  let total = 0;

  for (const topic of COMPILED_TOPIC_VOCAB) {
    let score = 0.125 + (topic.conferencePrior[params.venue] ?? 0);

    for (const { regex, weight } of topic.patterns) {
      if (kwLower) {
        regex.lastIndex = 0;
        const mKw = kwLower.match(regex);
        if (mKw) score += Math.min(2, mKw.length) * weight * 2.2;
      }
      if (titleLower) {
        regex.lastIndex = 0;
        const mTitle = titleLower.match(regex);
        if (mTitle) score += Math.min(2, mTitle.length) * weight * 1.6;
      }
      if (abstractLower) {
        regex.lastIndex = 0;
        const mAbs = abstractLower.match(regex);
        if (mAbs) score += Math.min(3, mAbs.length) * weight * 0.75;
      }
    }

    rawScores[topic.id] = score;
    total += score;
  }

  // Detect uniform zero-signal tie across all 8 subfields so Graph & Network (topic-0)
  // never silently swallows unmatched papers.
  const scoreValues = Object.values(rawScores);
  const maxRaw = Math.max(...scoreValues);
  const minRaw = Math.min(...scoreValues);
  if (maxRaw - minRaw <= 1e-6) {
    let metadataTargetTopicId = 'topic-5';
    if (params.venue === 'IEEE SciVis') {
      metadataTargetTopicId = 'topic-1';
    } else if (params.venue === 'IEEE VAST') {
      metadataTargetTopicId = 'topic-2';
    } else if (params.venue === 'IEEE InfoVis') {
      metadataTargetTopicId = 'topic-5';
    } else if ((params.paperType || '').toUpperCase() === 'J') {
      // General VIS journal papers without domain keywords typically concern pedagogy/theory/design evaluation
      metadataTargetTopicId = 'topic-4';
    } else {
      metadataTargetTopicId = 'topic-5';
    }
    rawScores[metadataTargetTopicId] = (rawScores[metadataTargetTopicId] ?? 0.125) + 0.12;
    total += 0.12;
  }

  const denom = total || 1;
  const topicScores: Record<string, number> = {};
  let primaryTopicId = BASE_TOPICS[0].id;
  let bestScore = -1;

  for (const topic of BASE_TOPICS) {
    const prob = Number(((rawScores[topic.id] ?? 0.125) / denom).toFixed(4));
    topicScores[topic.id] = prob;
    if (prob > bestScore) {
      bestScore = prob;
      primaryTopicId = topic.id;
    }
  }

  return { primaryTopicId, topicScores };
}

function computeAuthorHIndex(citationCounts: number[]): number {
  const sorted = [...citationCounts].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

export function generateStreamData(papers: RawPaperRecord[] = RAW_PAPERS): {
  streamData: YearlyTopicPrevalence[];
  yearlyTotals: Record<number, number>;
} {
  if (papers.length === 0) {
    return { streamData: [], yearlyTotals: {} };
  }

  const minYear = Math.min(...papers.map((p) => p.year), CORPUS_START_YEAR);
  const maxYear = Math.max(...papers.map((p) => p.year), CORPUS_END_YEAR);
  const topicIds = BASE_TOPICS.map((t) => t.id);

  const byYearCount = new Map<number, Record<string, number>>();
  const byYearWeight = new Map<number, Record<string, number>>();
  const yearlyTotals: Record<number, number> = {};

  for (let yr = minYear; yr <= maxYear; yr++) {
    const cInit: Record<string, number> = {};
    const wInit: Record<string, number> = {};
    for (const tid of topicIds) {
      cInit[tid] = 0;
      wInit[tid] = 0;
    }
    byYearCount.set(yr, cInit);
    byYearWeight.set(yr, wInit);
    yearlyTotals[yr] = 0;
  }

  for (const p of papers) {
    const cMap = byYearCount.get(p.year);
    const wMap = byYearWeight.get(p.year);
    if (!cMap || !wMap) continue;
    yearlyTotals[p.year] = (yearlyTotals[p.year] ?? 0) + 1;
    cMap[p.primaryTopicId] = (cMap[p.primaryTopicId] ?? 0) + 1;
    let scoreSum = 0;
    for (const tid of topicIds) {
      const s = p.topicScores[tid] ?? 0;
      wMap[tid] = (wMap[tid] ?? 0) + s;
      scoreSum += s;
    }
    if (scoreSum <= 0) {
      wMap[p.primaryTopicId] = (wMap[p.primaryTopicId] ?? 0) + 1;
    }
  }

  const streamData: YearlyTopicPrevalence[] = [];
  for (let yr = minYear; yr <= maxYear; yr++) {
    const counts = byYearCount.get(yr)!;
    const weights = byYearWeight.get(yr)!;
    const totalWeight = topicIds.reduce((sum, tid) => sum + (weights[tid] ?? 0), 0) || 1;
    const values: Record<string, number> = {};
    let runningShare = 0;
    topicIds.forEach((tid, idx) => {
      const norm =
        idx === topicIds.length - 1
          ? Number(Math.max(0, 1 - runningShare).toFixed(4))
          : Number(((weights[tid] ?? 0) / totalWeight).toFixed(4));
      runningShare += norm;
      values[tid] = norm;
    });
    streamData.push({ year: yr, values, counts });
  }

  return { streamData, yearlyTotals };
}

function computeTopicTopKeywords(
  topicPapers: RawPaperRecord[],
  fallback: Array<{ term: string; weight: number }>
): Array<{ term: string; weight: number }> {
  const termCounts = new Map<string, number>();

  for (const p of topicPapers) {
    const seenInPaper = new Set<string>();
    for (const rawKw of p.keywords) {
      const cleanKw = rawKw.trim().toLowerCase();
      if (
        cleanKw.length >= 3 &&
        !STOP_WORDS.has(cleanKw) &&
        !GENERIC_FIELD_PHRASES.has(cleanKw) &&
        !seenInPaper.has(cleanKw)
      ) {
        seenInPaper.add(cleanKw);
        termCounts.set(cleanKw, (termCounts.get(cleanKw) ?? 0) + 3);
      }
    }

    const titleTokens = (p.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

    for (let i = 0; i < titleTokens.length - 1; i++) {
      const bigram = `${titleTokens[i]} ${titleTokens[i + 1]}`;
      if (!GENERIC_FIELD_PHRASES.has(bigram) && !seenInPaper.has(bigram)) {
        seenInPaper.add(bigram);
        termCounts.set(bigram, (termCounts.get(bigram) ?? 0) + 1);
      }
    }
  }

  const top = Array.from(termCounts.entries())
    .filter(([, count]) => count >= 6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (top.length < 5) return fallback;

  const weightSum = top.reduce((sum, [, c]) => sum + c, 0) || 1;
  return top.map(([term, c]) => ({
    term,
    weight: Number((c / weightSum).toFixed(3)),
  }));
}

/**
 * Hydrates all dataset exports (RAW_PAPERS, AUTHORS, TOPICS, STREAM_DATA, TOPIC_CORRELATIONS,
 * VISPUB_YEARLY_TOTALS) directly from the real JSON array with zero synthetic records.
 */
export function initializeCorpus(jsonRecords: VispubJsonRecord[]): void {
  const seenIds = new Map<string, number>();
  const rawPapers: RawPaperRecord[] = [];
  const authorAccMap = new Map<
    string,
    {
      id: string;
      name: string;
      rawName: string;
      affiliationsByYear: Array<{ year: number; aff: string }>;
      paperCitations: number[];
      years: number[];
      topicWeights: Record<string, number>;
    }
  >();

  for (let idx = 0; idx < jsonRecords.length; idx++) {
    const item = jsonRecords[idx];
    const normalizedDoi = normalizeVispubDoi(item.doi);
    const baseId = normalizedDoi || `vis-${item.year}-${idx}`;
    const dupCount = seenIds.get(baseId) ?? -1;
    seenIds.set(baseId, dupCount + 1);
    const id = dupCount >= 0 ? `${baseId}#${dupCount + 1}` : baseId;

    const year = Number.isFinite(item.year) ? item.year : 2015;
    const title = (item.title || '').trim() || `Untitled IEEE VIS Paper (${year})`;
    const abstract = (item.abstract || '').trim();
    const keywords = Array.isArray(item.keywords)
      ? item.keywords.map((k) => k.trim()).filter(Boolean)
      : [];
    const venue = normalizeConferenceToVenue(item.conference);

    const { primaryTopicId, topicScores } = classifyRealPaperTopics({
      title,
      abstract,
      keywords,
      venue,
      year,
      paperType: item.paperType,
    });

    const rawAuthors = Array.isArray(item.authors)
      ? item.authors.map((a) => a.trim()).filter(Boolean)
      : [];
    const rawAffs = Array.isArray(item.affiliations) ? item.affiliations : [];
    const fallbackAff =
      rawAffs.find((a) => a && a.trim())?.trim() || 'IEEE VIS Research Community';

    const authorIds: string[] = [];
    const citations = Math.max(
      0,
      Number(
        item.citations ??
          item.citationCountCrossRef ??
          item.aminerCitationCount ??
          0
      ) || 0
    );

    rawAuthors.forEach((rawAuthorName, aIdx) => {
      const aid = slugifyAuthorName(rawAuthorName);
      authorIds.push(aid);

      const aff = (rawAffs[aIdx] || '').trim() || fallbackAff;
      let acc = authorAccMap.get(aid);
      if (!acc) {
        acc = {
          id: aid,
          name: cleanAuthorDisplayName(rawAuthorName),
          rawName: rawAuthorName,
          affiliationsByYear: [],
          paperCitations: [],
          years: [],
          topicWeights: {},
        };
        authorAccMap.set(aid, acc);
      }
      if (aff !== 'IEEE VIS Research Community') {
        acc.affiliationsByYear.push({ year, aff });
      }
      acc.paperCitations.push(citations);
      acc.years.push(year);
      for (const [tid, score] of Object.entries(topicScores)) {
        acc.topicWeights[tid] = (acc.topicWeights[tid] ?? 0) + score;
      }
    });

    const references = Array.isArray(item.internalReferences)
      ? Array.from(
          new Set(
            item.internalReferences
              .map((r) => normalizeVispubDoi(r))
              .filter((r) => Boolean(r) && r !== normalizedDoi)
          )
        )
      : [];

    rawPapers.push({
      id,
      title,
      year,
      venue,
      doi: normalizedDoi || id,
      url: item.link || (normalizedDoi ? `https://doi.org/${normalizedDoi}` : undefined),
      paperType: item.paperType,
      award: item.award ?? null,
      downloadsXplore: item.downloadsXplore ?? 0,
      citationCount: citations,
      primaryTopicId,
      topicScores,
      authorIds,
      keywords,
      abstract,
      references,
    });
  }

  // Build real AUTHORS registry directly from the extracted author publications
  const authorsRegistry: Record<string, CorpusAuthorRecord> = {};
  for (const acc of authorAccMap.values()) {
    const sortedAffs = [...acc.affiliationsByYear].sort((a, b) => b.year - a.year);
    const primaryAffiliation = sortedAffs[0]?.aff || 'IEEE VIS Research Community';
    const domTopic =
      Object.entries(acc.topicWeights).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      BASE_TOPICS[0].id;
    const totalCitations = acc.paperCitations.reduce((sum, c) => sum + c, 0);

    authorsRegistry[acc.id] = {
      id: acc.id,
      name: acc.name,
      rawName: acc.rawName,
      affiliation: primaryAffiliation,
      hIndex: computeAuthorHIndex(acc.paperCitations),
      visPaperCount: acc.paperCitations.length,
      visCitations: totalCitations,
      primaryTopicId: domTopic,
      activeStartYear: Math.min(...acc.years),
      activeEndYear: Math.max(...acc.years),
    };
  }

  // Build STREAM_DATA and VISPUB_YEARLY_TOTALS across all 4,008 real papers
  const { streamData, yearlyTotals } = generateStreamData(rawPapers);

  // Build TOPICS metrics + empirical topKeywords directly from all real papers
  const topicsComputed: TopicSummary[] = BASE_TOPICS.map((t) => {
    const topicPapers = rawPapers.filter((p) => p.primaryTopicId === t.id);
    const paperCount = topicPapers.length;
    const totalCitations = topicPapers.reduce((acc, p) => acc + p.citationCount, 0);

    let peakYear = 2025;
    let maxYrCount = -1;
    for (const row of streamData) {
      const cnt = row.counts[t.id] ?? 0;
      if (cnt >= maxYrCount) {
        maxYrCount = cnt;
        peakYear = row.year;
      }
    }

    const recent5 = streamData.slice(-5).reduce((s, r) => s + (r.counts[t.id] ?? 0), 0);
    const prev5 = Math.max(
      1,
      streamData.slice(-10, -5).reduce((s, r) => s + (r.counts[t.id] ?? 0), 0)
    );
    const growthRate = Number((((recent5 - prev5) / prev5) * 100).toFixed(1));

    return {
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      description: t.description,
      keywordGroupingSummary: t.keywordGroupingSummary,
      topKeywords: computeTopicTopKeywords(topicPapers, t.seedKeywords),
      paperCount,
      indexedPaperCount: paperCount,
      totalCitations,
      peakYear,
      growthRate,
    };
  });

  // Build TOPIC_CORRELATIONS across all 4,008 real paper topic vectors (56 directed / 28 unique pairs)
  const topicIds = topicsComputed.map((t) => t.id);
  const norms = new Map<string, number>();
  for (const tid of topicIds) {
    let sq = 0;
    for (const p of rawPapers) {
      const v = p.topicScores[tid] ?? 0;
      sq += v * v;
    }
    norms.set(tid, Math.sqrt(sq) || 1);
  }

  const correlationsComputed: TopicCorrelationEdge[] = [];
  for (let i = 0; i < topicIds.length; i++) {
    for (let j = 0; j < topicIds.length; j++) {
      if (i === j) continue;
      const sId = topicIds[i];
      const tId = topicIds[j];
      let dot = 0;
      let coOcc = 0;
      for (const p of rawPapers) {
        const sv = p.topicScores[sId] ?? 0;
        const tv = p.topicScores[tId] ?? 0;
        dot += sv * tv;
        if (sv >= 0.12 && tv >= 0.12) coOcc += 1;
      }
      const cosine = dot / ((norms.get(sId) ?? 1) * (norms.get(tId) ?? 1));
      const corr = Number(Math.max(0.05, Math.min(0.88, cosine * 1.45)).toFixed(3));
      correlationsComputed.push({
        sourceTopicId: sId,
        targetTopicId: tId,
        correlation: corr,
        coOccurrenceCount: coOcc,
      });
    }
  }

  RAW_PAPERS = rawPapers;
  AUTHORS = authorsRegistry;
  VISPUB_YEARLY_TOTALS = yearlyTotals;
  STREAM_DATA = streamData;
  TOPICS = topicsComputed;
  TOPIC_CORRELATIONS = correlationsComputed;

  if (onCorpusUpdatedCallback) {
    onCorpusUpdatedCallback();
  }
}

let pendingFetchPromise: Promise<void> | null = null;

/**
 * Fetches /data/vispubdata_1990_2025.json once at browser startup and hydrates the entire corpus.
 */
export async function loadVispubCorpusFromPublic(): Promise<void> {
  if (RAW_PAPERS.length > 0) return;
  if (pendingFetchPromise) return pendingFetchPromise;

  const baseUrl =
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = `${normalizedBase}data/vispubdata_1990_2025.json`;

  pendingFetchPromise = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load IEEE VIS dataset (${response.status} ${response.statusText}) from ${url}`
      );
    }
    const payload = (await response.json()) as VispubJsonRecord[];
    if (!Array.isArray(payload) || payload.length === 0) {
      throw new Error(`Invalid or empty IEEE VIS dataset received from ${url}`);
    }
    initializeCorpus(payload);
  })();

  try {
    await pendingFetchPromise;
  } catch (err) {
    pendingFetchPromise = null;
    throw err;
  }
}
