/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ViewMode } from './types';
import {
  buildAuthorDetail,
  buildFieldOverview,
  buildPaperDetail,
  buildTopicDetail,
  listAllAuthors,
  listAllPapers,
} from './utils/analyticsLogic';
import { Streamgraph } from './components/Streamgraph';
import {
  AuthorDetailView,
  PaperDetailView,
  TopicDetailView,
} from './components/Views';
import { PipelineSpecsModal } from './components/PipelineSpecsModal';
import { Search } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('field');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('topic-5');
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('jeffrey-heer');
  const [selectedPaperId, setSelectedPaperId] = useState<string>('vis-2011-d3');
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState<boolean>(false);
  const [globalQuery, setGlobalQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  // Pre-computed / API-synchronized models
  const fieldOverview = useMemo(() => buildFieldOverview(), []);
  const topicDetail = useMemo(
    () => buildTopicDetail(selectedTopicId, 'citations'),
    [selectedTopicId]
  );
  const authorDetail = useMemo(
    () => buildAuthorDetail(selectedAuthorId),
    [selectedAuthorId]
  );
  const paperDetail = useMemo(
    () => buildPaperDetail(selectedPaperId),
    [selectedPaperId]
  );

  const allAuthors = useMemo(() => listAllAuthors(), []);
  const allPapers = useMemo(() => listAllPapers('citations'), []);

  // Global Omni-Search results across Topics, Authors, and Papers
  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedTopics = fieldOverview.topics.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.topKeywords.some((k) => k.term.toLowerCase().includes(q))
    );
    const matchedAuthors = allAuthors.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.affiliation.toLowerCase().includes(q)
    );
    const matchedPapers = allPapers
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.keywords.some((k) => k.toLowerCase().includes(q)) ||
          String(p.year).includes(q)
      )
      .slice(0, 5);

    return { matchedTopics, matchedAuthors, matchedPapers };
  }, [globalQuery, fieldOverview.topics, allAuthors, allPapers]);

  // Navigation Handlers wiring all 4 Tasks
  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setViewMode('topic');
    setGlobalQuery('');
    setIsSearchFocused(false);
  };

  const handleSelectAuthor = (authorId: string) => {
    setSelectedAuthorId(authorId);
    setViewMode('author');
    setGlobalQuery('');
    setIsSearchFocused(false);
  };

  const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
    setViewMode('paper');
    setGlobalQuery('');
    setIsSearchFocused(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
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

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsSpecsModalOpen(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Pipeline &amp; API Specs
            </button>
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
              IEEE VIS Literature Corpus (Vispubdata 1990–2024)
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono-tabular">
              {fieldOverview.totalPapers.toLocaleString()} Papers
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono-tabular">
              {fieldOverview.topics.length} LDA Topics
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono-tabular">
              {fieldOverview.totalCitations.toLocaleString()} CrossRef Citations
            </span>
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
              placeholder="Search topics, papers, or VIS authors..."
              aria-label="Global literature search"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
            />

            {isSearchFocused && searchResults && (
              <div className="absolute right-0 mt-1.5 w-full sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-40 p-3 space-y-3 max-h-96 overflow-y-auto">
                {searchResults.matchedTopics.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      LDA Topics
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
                            className="w-2 h-2 rounded-xs"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.name}
                        </span>
                        <span className="font-mono-tabular text-slate-400">
                          {t.paperCount} papers
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.matchedAuthors.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Researchers
                    </div>
                    {searchResults.matchedAuthors.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={() => handleSelectAuthor(a.id)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-900">{a.name}</span>
                        <span className="text-slate-400 truncate max-w-[160px]">
                          {a.affiliation}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.matchedPapers.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Publications
                    </div>
                    {searchResults.matchedPapers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => handleSelectPaper(p.id)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded block"
                      >
                        <div className="font-medium text-slate-900 truncate">
                          {p.title}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-slate-400">
                          {p.venue} · {p.year} · {p.citationCount} citations
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
        {viewMode === 'field' && (
          <Streamgraph
            topics={fieldOverview.topics}
            streamData={fieldOverview.streamData}
            correlations={fieldOverview.correlations}
            selectedTopicId={selectedTopicId}
            onSelectTopic={handleSelectTopic}
          />
        )}

        {viewMode === 'topic' && (
          <TopicDetailView
            data={topicDetail}
            allTopics={fieldOverview.topics}
            onSelectTopic={handleSelectTopic}
            onSelectPaper={handleSelectPaper}
            onSelectAuthor={handleSelectAuthor}
            onBackToField={() => setViewMode('field')}
          />
        )}

        {viewMode === 'author' && (
          <AuthorDetailView
            author={authorDetail}
            allTopics={fieldOverview.topics}
            onSelectAuthor={handleSelectAuthor}
            onSelectPaper={handleSelectPaper}
            onSelectTopic={handleSelectTopic}
            onBackToField={() => setViewMode('field')}
          />
        )}

        {viewMode === 'paper' && (
          <PaperDetailView
            paper={paperDetail}
            onSelectPaper={handleSelectPaper}
            onSelectAuthor={handleSelectAuthor}
            onSelectTopic={handleSelectTopic}
            onBackToTopic={handleSelectTopic}
          />
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
              onClick={() => setIsSpecsModalOpen(true)}
              className="hover:text-slate-900"
            >
              Python LDA &amp; FastAPI Source
            </button>
          </div>
        </div>
      </footer>

      {/* Architecture & Code Inspector Modal */}
      <PipelineSpecsModal
        isOpen={isSpecsModalOpen}
        onClose={() => setIsSpecsModalOpen(false)}
      />
    </div>
  );
}
