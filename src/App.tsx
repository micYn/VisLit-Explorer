/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ViewMode } from './types';
import {
  AUTHORS,
  loadVispubCorpusFromPublic,
  RAW_PAPERS,
  TOPICS,
} from './data/vispubCorpus';
import {
  buildAuthorDetail,
  buildFieldOverview,
  buildPaperDetail,
  buildTopicDetail,
  filterAuthorsByQuery,
  listAllAuthors,
  listAllPapers,
  matchesFlexibleQuery,
  sortAndFilterPapers,
} from './utils/analyticsLogic';
import { Streamgraph } from './components/Streamgraph';
import {
  AuthorDetailView,
  PaperDetailView,
  TopicDetailView,
} from './components/Views';
import { AlertCircle, Loader2, RefreshCw, Search } from 'lucide-react';

export default function App() {
  const [corpusStatus, setCorpusStatus] = useState<'loading' | 'ready' | 'error'>(
    () => (RAW_PAPERS.length > 0 ? 'ready' : 'loading')
  );
  const [corpusError, setCorpusError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [viewMode, setViewMode] = useState<ViewMode>('field');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [globalQuery, setGlobalQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [searchAuthorLimit, setSearchAuthorLimit] = useState<number>(8);
  const [searchPaperLimit, setSearchPaperLimit] = useState<number>(6);

  // Load real 4,008-paper Vispubdata JSON at startup
  useEffect(() => {
    if (RAW_PAPERS.length > 0) {
      setCorpusStatus('ready');
      return;
    }
    let cancelled = false;
    setCorpusStatus('loading');
    setCorpusError(null);

    loadVispubCorpusFromPublic()
      .then(() => {
        if (!cancelled) {
          setCorpusStatus('ready');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Unable to load IEEE VIS dataset.';
          setCorpusError(msg);
          setCorpusStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  // Force window scroll to the very top whenever transitioning between tabs or navigating to a new entity view
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [viewMode, selectedTopicId, selectedAuthorId, selectedPaperId]);

  useEffect(() => {
    setSearchAuthorLimit(8);
    setSearchPaperLimit(6);
  }, [globalQuery]);

  // Computed models strictly hydrated from the loaded 4,008-paper corpus
  const fieldOverview = useMemo(
    () => (corpusStatus === 'ready' ? buildFieldOverview() : null),
    [corpusStatus]
  );

  const allAuthors = useMemo(
    () => (corpusStatus === 'ready' ? listAllAuthors() : []),
    [corpusStatus]
  );
  const allPapers = useMemo(
    () => (corpusStatus === 'ready' ? listAllPapers('citations') : []),
    [corpusStatus]
  );

  // Dynamically derive safe default entity IDs from the loaded corpus
  const effectiveTopicId = useMemo(() => {
    if (corpusStatus !== 'ready') return '';
    if (selectedTopicId && TOPICS.some((t) => t.id === selectedTopicId)) {
      return selectedTopicId;
    }
    return TOPICS.find((t) => t.id === 'topic-5')?.id ?? TOPICS[0]?.id ?? '';
  }, [corpusStatus, selectedTopicId]);

  const effectiveAuthorId = useMemo(() => {
    if (corpusStatus !== 'ready') return '';
    if (selectedAuthorId && AUTHORS[selectedAuthorId]) {
      return selectedAuthorId;
    }
    if (AUTHORS['jeffrey-heer']) return 'jeffrey-heer';
    return allAuthors[0]?.id ?? '';
  }, [corpusStatus, selectedAuthorId, allAuthors]);

  const effectivePaperId = useMemo(() => {
    if (corpusStatus !== 'ready') return '';
    if (selectedPaperId && RAW_PAPERS.some((p) => p.id === selectedPaperId)) {
      return selectedPaperId;
    }
    const preferred = RAW_PAPERS.find((p) => p.id === '10.1109/tvcg.2011.185');
    return preferred?.id ?? allPapers[0]?.id ?? '';
  }, [corpusStatus, selectedPaperId, allPapers]);

  const topicDetail = useMemo(
    () =>
      corpusStatus === 'ready' && effectiveTopicId
        ? buildTopicDetail(effectiveTopicId, 'citations')
        : null,
    [corpusStatus, effectiveTopicId]
  );
  const authorDetail = useMemo(
    () =>
      corpusStatus === 'ready' && effectiveAuthorId
        ? buildAuthorDetail(effectiveAuthorId)
        : null,
    [corpusStatus, effectiveAuthorId]
  );
  const paperDetail = useMemo(
    () =>
      corpusStatus === 'ready' && effectivePaperId
        ? buildPaperDetail(effectivePaperId)
        : null,
    [corpusStatus, effectivePaperId]
  );

  // Global Omni-Search results across Topics, Authors, and Papers (case-insensitive & token-reordered, 100% unclipped)
  const searchResults = useMemo(() => {
    const q = globalQuery.trim();
    if (!q || !fieldOverview) return null;

    const matchedTopics = fieldOverview.topics.filter((t) =>
      matchesFlexibleQuery(
        `${t.name} ${t.description} ${t.topKeywords.map((k) => k.term).join(' ')}`,
        q
      )
    );
    const matchedAuthors = filterAuthorsByQuery(allAuthors, q);
    const matchedPapers = sortAndFilterPapers(allPapers, 'citations', q);

    return { matchedTopics, matchedAuthors, matchedPapers };
  }, [globalQuery, fieldOverview, allAuthors, allPapers]);

  // Navigation Handlers wiring all 4 Tasks with immediate scroll-to-top
  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setViewMode('topic');
    setGlobalQuery('');
    setIsSearchFocused(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleSelectAuthor = (authorId: string) => {
    setSelectedAuthorId(authorId);
    setViewMode('author');
    setGlobalQuery('');
    setIsSearchFocused(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
    setViewMode('paper');
    setGlobalQuery('');
    setIsSearchFocused(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar: Clean Wordmark + 4 Primary View Tabs (Developer clutter removed) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setViewMode('field')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
          >
            VisLit Explorer
          </button>

          {/* Zone 2: 4 clean single-line text navigation links */}
          <nav
            aria-label="Primary View Modes"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              data-testid="nav-field"
              onClick={() => setViewMode('field')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                viewMode === 'field'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Field Overview
            </button>
            <button
              type="button"
              data-testid="nav-topic"
              onClick={() => setViewMode('topic')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                viewMode === 'topic'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Topic Network
            </button>
            <button
              type="button"
              data-testid="nav-author"
              onClick={() => setViewMode('author')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                viewMode === 'author'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Author Analytics
            </button>
            <button
              type="button"
              data-testid="nav-paper"
              onClick={() => setViewMode('paper')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                viewMode === 'paper'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Paper Profile
            </button>
          </nav>

          {/* Zone 3: Corpus Edition Context */}
          <div className="hidden lg:flex items-center text-xs font-mono-tabular text-slate-500 shrink-0">
            IEEE VIS {fieldOverview ? `${fieldOverview.yearRange[0]}–${fieldOverview.yearRange[1]}` : '1990–2025'}
          </div>
        </div>

        {/* Mobile View Mode Bar (< md) */}
        <div className="flex md:hidden items-center justify-between gap-2 px-4 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto">
          {(
            [
              { id: 'field', label: 'Field Overview' },
              { id: 'topic', label: 'Topic Network' },
              { id: 'author', label: 'Author Analytics' },
              { id: 'paper', label: 'Paper Profile' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewMode(item.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                viewMode === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Workspace Context Sub-Toolbar & Global Corpus Search */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              IEEE VIS Literature Corpus (Vispubdata{' '}
              {fieldOverview ? `${fieldOverview.yearRange[0]}–${fieldOverview.yearRange[1]}` : '1990–2025'})
            </span>
            {fieldOverview ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono-tabular">
                  {fieldOverview.totalPapers.toLocaleString()} Total Papers ·{' '}
                  {fieldOverview.totalAuthors.toLocaleString()} Researchers
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-mono-tabular">
                  {fieldOverview.topics.length} Core Research Subfields
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-mono-tabular">
                  {fieldOverview.totalCitations.toLocaleString()} CrossRef Citations
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono-tabular text-slate-500">
                  {corpusStatus === 'error' ? 'Dataset unavailable' : 'Loading dataset...'}
                </span>
              </>
            )}
          </div>

          {/* Global Omni-Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 180)}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Search subfields, papers, or VIS authors..."
              aria-label="Global literature search"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
            />

            {isSearchFocused && searchResults && (
              <div className="absolute right-0 mt-1.5 w-full sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-40 p-3 space-y-3 max-h-96 overflow-y-auto">
                {searchResults.matchedTopics.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Research Subfields
                    </div>
                    {searchResults.matchedTopics.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={() => handleSelectTopic(t.id)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-900 flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.name}
                        </span>
                        <span className="font-mono-tabular text-slate-400 shrink-0">
                          {t.paperCount.toLocaleString()} papers
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.matchedAuthors.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Researchers ({Math.min(searchAuthorLimit, searchResults.matchedAuthors.length)} of {searchResults.matchedAuthors.length})
                      </div>
                      <div className="flex items-center gap-2">
                        {searchResults.matchedAuthors.length > searchAuthorLimit && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearchAuthorLimit((n) => n + 100);
                            }}
                            className="text-[10px] font-semibold text-blue-700 hover:underline"
                          >
                            Load {Math.min(100, searchResults.matchedAuthors.length - searchAuthorLimit)} More
                          </button>
                        )}
                        {searchAuthorLimit > 8 && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearchAuthorLimit(8);
                            }}
                            className="text-[10px] font-medium text-slate-500 hover:underline"
                          >
                            Top 8
                          </button>
                        )}
                      </div>
                    </div>
                    {searchResults.matchedAuthors
                      .slice(0, searchAuthorLimit)
                      .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={() => handleSelectAuthor(a.id)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{a.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {a.affiliation}
                          </div>
                        </div>
                        <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                          {a.paperCount} VIS papers · h-{a.hIndex}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.matchedPapers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Publications ({Math.min(searchPaperLimit, searchResults.matchedPapers.length)} of {searchResults.matchedPapers.length})
                      </div>
                      <div className="flex items-center gap-2">
                        {searchResults.matchedPapers.length > searchPaperLimit && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearchPaperLimit((n) => n + 100);
                            }}
                            className="text-[10px] font-semibold text-blue-700 hover:underline"
                          >
                            Load {Math.min(100, searchResults.matchedPapers.length - searchPaperLimit)} More
                          </button>
                        )}
                        {searchPaperLimit > 6 && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearchPaperLimit(6);
                            }}
                            className="text-[10px] font-medium text-slate-500 hover:underline"
                          >
                            Top 6
                          </button>
                        )}
                      </div>
                    </div>
                    {searchResults.matchedPapers
                      .slice(0, searchPaperLimit)
                      .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => handleSelectPaper(p.id)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded block"
                      >
                        <div className="font-medium text-slate-900 line-clamp-2 leading-snug">
                          {p.title}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                          {p.venue} · {p.year} · {p.citationCount} citations ·{' '}
                          {p.authors.map((a) => a.name).join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.matchedTopics.length === 0 &&
                  searchResults.matchedAuthors.length === 0 &&
                  searchResults.matchedPapers.length === 0 && (
                    <div className="text-xs text-slate-500 py-2 text-center">
                      No matching topics, authors, or papers found.
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        {corpusStatus === 'loading' && (
          <div
            data-testid="corpus-loading"
            className="bg-white border border-slate-200 rounded-lg p-12 flex flex-col items-center justify-center text-center gap-3 my-8"
          >
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            <div className="text-base font-semibold text-slate-900">
              Loading IEEE VIS Literature Corpus (1990–2025)
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              Fetching all 4,008 real Vispubdata records, author publication histories, and internal citation links...
            </p>
          </div>
        )}

        {corpusStatus === 'error' && (
          <div
            data-testid="corpus-error"
            className="bg-white border border-rose-200 rounded-lg p-10 flex flex-col items-center justify-center text-center gap-3 my-8"
          >
            <AlertCircle className="w-7 h-7 text-rose-600" />
            <div className="text-base font-semibold text-slate-900">
              Failed to Load IEEE VIS Dataset
            </div>
            <p className="text-xs text-slate-600 max-w-lg font-mono-tabular">
              {corpusError || 'An unexpected error occurred while fetching the Vispubdata JSON file.'}
            </p>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Loading Dataset
            </button>
          </div>
        )}

        {corpusStatus === 'ready' && fieldOverview && (
          <>
            {viewMode === 'field' && (
              <Streamgraph
                topics={fieldOverview.topics}
                streamData={fieldOverview.streamData}
                correlations={fieldOverview.correlations}
                selectedTopicId={effectiveTopicId}
                onSelectTopic={handleSelectTopic}
              />
            )}

            {viewMode === 'topic' && topicDetail && (
              <TopicDetailView
                data={topicDetail}
                allTopics={fieldOverview.topics}
                onSelectTopic={handleSelectTopic}
                onSelectPaper={handleSelectPaper}
                onSelectAuthor={handleSelectAuthor}
                onBackToField={() => setViewMode('field')}
              />
            )}

            {viewMode === 'author' && authorDetail && (
              <AuthorDetailView
                author={authorDetail}
                allTopics={fieldOverview.topics}
                onSelectAuthor={handleSelectAuthor}
                onSelectPaper={handleSelectPaper}
                onSelectTopic={handleSelectTopic}
                onBackToField={() => setViewMode('field')}
              />
            )}

            {viewMode === 'paper' && paperDetail && (
              <PaperDetailView
                paper={paperDetail}
                onSelectPaper={handleSelectPaper}
                onSelectAuthor={handleSelectAuthor}
                onSelectTopic={handleSelectTopic}
                onBackToTopic={handleSelectTopic}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            VisLit Explorer · IEEE VIS (InfoVis, VAST, SciVis) Literature Exploration System
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setViewMode('field')}
              className="hover:text-slate-900"
            >
              Field Streamgraph
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setViewMode('topic')}
              className="hover:text-slate-900"
            >
              Topic Citation Graph
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setViewMode('author')}
              className="hover:text-slate-900"
            >
              Author Trajectories
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setViewMode('paper')}
              className="hover:text-slate-900"
            >
              Paper Profiles
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
