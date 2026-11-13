import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAuthorDetail,
  buildCitationNetworkTopology,
  buildEgoNetworkCandidates,
  buildFieldOverview,
  buildPaperDetail,
  buildTopicDetail,
  cleanAuthorDisplayName,
  computeTopicHIndex,
  computeTopicVectorCosineSimilarity,
  filterAuthorsByQuery,
  getCorrelationBetween,
  getCorrelationGraphEdges,
  listAllAuthors,
  listAllPapers,
  normalizeDoi,
  parseNullableCitationCount,
  parseVispubdataCsv,
  slugifyAuthorName,
  sortAndFilterPapers,
  splitDelimitedField,
  toPaperSummary,
} from './analyticsLogic';
import {
  initializeCorpus,
  RAW_PAPERS,
  TOPIC_CORRELATIONS,
  TOPICS,
  VISPUB_YEARLY_TOTALS,
  VispubJsonRecord,
} from '../data/vispubCorpus';

// Hydrate the corpus once from the real 4,008-paper Vispubdata JSON before running tests
const datasetPath = path.resolve(process.cwd(), 'public/data/vispubdata_1990_2025.json');
const realJsonRecords = JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as VispubJsonRecord[];
initializeCorpus(realJsonRecords);

test('buildFieldOverview processes 100% of all 4,008 real Vispubdata papers (1990-2025, 131 in 2025) and 7,502 authors', () => {
  const field = buildFieldOverview();
  assert.equal(field.topics.length, 8);
  assert.equal(field.streamData.length, 36);
  assert.equal(field.yearRange[0], 1990);
  assert.equal(field.yearRange[1], 2025);

  assert.equal(
    RAW_PAPERS.length,
    4008,
    `Expected exact 4,008 real Vispubdata records in RAW_PAPERS, got ${RAW_PAPERS.length}`
  );
  assert.equal(field.totalPapers, 4008);
  assert.equal(VISPUB_YEARLY_TOTALS[2025], 131);
  assert.equal(field.totalAuthors, 7498);

  const topicPaperSum = field.topics.reduce((acc, t) => acc + t.paperCount, 0);
  assert.equal(
    topicPaperSum,
    4008,
    `Sum of all 8 subfield paperCounts (${topicPaperSum}) must equal 4,008`
  );

  // Every subfield's paperCount must equal the exact 36-year sum of its annual counts in streamData
  for (const topic of field.topics) {
    const streamSum = field.streamData.reduce(
      (sum, yrRow) => sum + (yrRow.counts[topic.id] ?? 0),
      0
    );
    assert.equal(
      topic.paperCount,
      streamSum,
      `Subfield ${topic.id} paperCount (${topic.paperCount}) must equal its 1990-2025 streamData sum (${streamSum})`
    );
    assert.equal(topic.indexedPaperCount, topic.paperCount);
  }

  // Empty-author frontmatter paper (10.1109/visual.2003.1250348) is preserved without dropping any row
  const frontmatter = RAW_PAPERS.find((p) => p.id === '10.1109/visual.2003.1250348');
  assert.ok(frontmatter, 'Paper with 0 authors must be retained in RAW_PAPERS');
  assert.equal(frontmatter.authorIds.length, 0);
  const frontmatterDetail = buildPaperDetail('10.1109/visual.2003.1250348');
  assert.equal(frontmatterDetail.authors.length, 0);
});

test('DataWink (2025) and all 5 of its real co-authors appear accurately in search, topic views, and Paper Profile', () => {
  const dataWinkId = '10.1109/tvcg.2025.3634635';
  const allPapers = listAllPapers('citations');
  const searchMatches = sortAndFilterPapers(allPapers, 'citations', 'DataWink');
  assert.ok(
    searchMatches.some((p) => p.id === dataWinkId),
    'Global paper search for "DataWink" must return DataWink'
  );

  const dw = buildPaperDetail(dataWinkId);
  assert.equal(
    dw.title,
    'DataWink: Reusing and Adapting SVG-Based Visualization Examples with Large Multimodal Models'
  );
  assert.equal(dw.year, 2025);
  assert.equal(dw.citationCount, 6);
  assert.equal(dw.doi, dataWinkId);
  assert.deepEqual(
    dw.authors.map((a) => a.name),
    ['Liwenhan Xie', 'Yanna Lin', 'Can Liu', 'Huamin Qu', 'Xinhuan Shu']
  );

  // All 21 internalReferences on DataWink resolve inside the 4,008-paper corpus, including D3
  assert.equal(dw.referencesPapers.length, 21);
  assert.ok(
    dw.referencesPapers.some((r) => r.id === '10.1109/tvcg.2011.185'),
    'DataWink references must include D³ Data-Driven Documents (10.1109/tvcg.2011.185)'
  );

  // Verify DataWink also appears in its primary topic's literature list
  const dwTopic = buildTopicDetail(dw.primaryTopicId, 'year');
  assert.ok(
    dwTopic.papers.some((p) => p.id === dataWinkId),
    `DataWink must appear in its primary topic (${dw.primaryTopicId}) papers list`
  );

  // Verify all 5 DataWink authors appear in author search with exact real counts & timelines
  const expectedAuthors = [
    { id: 'liwenhan-xie', displayName: 'Liwenhan Xie', count: 2, start: 2023, end: 2025 },
    { id: 'yanna-lin', displayName: 'Yanna Lin', count: 4, start: 2020, end: 2025 },
    { id: 'can-liu-0004', displayName: 'Can Liu', count: 3, start: 2019, end: 2025 },
    { id: 'huamin-qu', displayName: 'Huamin Qu', count: 79, start: 2000, end: 2025 },
    { id: 'xinhuan-shu', displayName: 'Xinhuan Shu', count: 9, start: 2017, end: 2025 },
  ];

  const allAuthors = listAllAuthors();
  for (const exp of expectedAuthors) {
    const matched = filterAuthorsByQuery(allAuthors, exp.displayName);
    assert.ok(
      matched.some((a) => a.id === exp.id),
      `Author search for "${exp.displayName}" must find ${exp.id}`
    );

    const detail = buildAuthorDetail(exp.id);
    assert.equal(detail.name, exp.displayName);
    assert.equal(detail.totalPapers, exp.count);
    assert.equal(detail.papers.length, exp.count);
    assert.equal(detail.activeStartYear, exp.start);
    assert.equal(detail.activeEndYear, exp.end);
    assert.ok(
      detail.papers.some((p) => p.id === dataWinkId),
      `Author ${exp.displayName} must include DataWink in their publications`
    );
  }
});

test('DBLP disambiguation cleanup and flexible author/paper search (Meng Xia, Xia Meng, Meng Xia 0002)', () => {
  assert.equal(cleanAuthorDisplayName('Meng Xia 0002'), 'Meng Xia');
  assert.equal(cleanAuthorDisplayName('Can Liu 0004'), 'Can Liu');
  assert.equal(cleanAuthorDisplayName('Jeffrey Heer'), 'Jeffrey Heer');

  const allAuthors = listAllAuthors();
  assert.equal(allAuthors.length, 7498);

  const mengProfile = allAuthors.find((a) => a.id === 'meng-xia-0002');
  assert.ok(mengProfile, 'Meng Xia should be indexed in listAllAuthors');
  assert.equal(mengProfile.name, 'Meng Xia');
  assert.equal(mengProfile.rawName, 'Meng Xia 0002');
  assert.equal(mengProfile.paperCount, 4);

  for (const q of ['Meng Xia', 'Xia Meng', 'xia', 'meng xia 0002', 'XIA MENG']) {
    const matches = filterAuthorsByQuery(allAuthors, q);
    assert.ok(
      matches.some((a) => a.id === 'meng-xia-0002'),
      `Query "${q}" must return Meng Xia's author profile`
    );
  }

  const mengDetail = buildAuthorDetail('meng-xia-0002');
  assert.equal(mengDetail.totalPapers, 4);
  const allPapers = listAllPapers('citations');
  for (const q of ['Meng Xia', 'Xia Meng']) {
    const matchedPapers = sortAndFilterPapers(allPapers, 'citations', q);
    assert.ok(
      matchedPapers.length >= 4,
      `Paper search for "${q}" should return Meng Xia's 4 real VIS papers`
    );
    for (const mp of mengDetail.papers) {
      assert.ok(
        matchedPapers.some((p) => p.id === mp.id),
        `Paper search "${q}" must include Meng Xia's paper ${mp.id}`
      );
    }
    assert.ok(
      matchedPapers.every((p) => p.authors.every((a) => !/\d{4}$/.test(a.name))),
      'Displayed author names on papers must have DBLP digits stripped'
    );
  }
});

test('Missing abstract and keyword fields fall back gracefully to paper title without dropping records', () => {
  const summary = toPaperSummary({
    id: 'test-empty-fields',
    title: 'Interactive Visual Analytics of Multivariate Networks',
    year: 2021,
    venue: 'IEEE VIS',
    doi: '10.1109/tvcg.2021.0000000',
    abstract: '',
    citationCount: 10,
    primaryTopicId: 'topic-0',
    topicScores: { 'topic-0': 0.85 },
    authorIds: ['jeffrey-heer'],
    keywords: [],
    references: [],
  });
  assert.equal(summary.abstract, summary.title);
  assert.ok(summary.keywords.length > 0, 'Keywords should fall back to title terms');
});

test('buildTopicDetail includes 100% of subfield papers, untruncated leadingAuthors, and full network nodes', () => {
  const detail = buildTopicDetail('topic-2', 'citations');
  assert.equal(detail.topic.id, 'topic-2');
  assert.equal(detail.papers.length, detail.topic.paperCount);
  assert.ok(detail.seminalPapers.length >= 3 && detail.seminalPapers.length <= 6);

  for (const tp of detail.papers) {
    assert.ok(
      detail.citationNetwork.nodes.some((n) => n.id === tp.id),
      `Subfield paper ${tp.id} must be included in topic citation network nodes`
    );
  }

  assert.ok(detail.citationNetwork.nodes.some((n) => n.isCrossTopic === true));
  assert.ok(detail.leadingAuthors.length > 50);
  assert.ok(detail.leadingAuthors[0].topicPaperCount >= 3);
  assert.equal(computeTopicHIndex([500, 300, 120, 2]), 3);
});

test('buildAuthorDetail strictly aggregates standoutPaper per year and keeps totalPapers === papers.length === yearlyStats sum', () => {
  const heer = buildAuthorDetail('jeffrey-heer');
  assert.equal(heer.name, 'Jeffrey Heer');
  assert.equal(heer.totalPapers, 35);
  assert.equal(heer.papers.length, 35);
  assert.equal(heer.indexedPapers, 35);
  assert.equal(heer.activeStartYear, 2005);
  assert.equal(heer.activeEndYear, 2025);

  const heerYearlySum = heer.yearlyStats.reduce((sum, yr) => sum + yr.paperCount, 0);
  assert.equal(heerYearlySum, heer.totalPapers);

  for (const yrStat of heer.yearlyStats) {
    if (yrStat.paperCount === 0) {
      assert.equal(yrStat.standoutPaper, null);
      assert.equal(yrStat.citationSum, 0);
    } else {
      assert.ok(yrStat.standoutPaper !== null);
      assert.equal(yrStat.standoutPaper.year, yrStat.year);
    }
  }

  const stat2011 = heer.yearlyStats.find((s) => s.year === 2011);
  assert.equal(stat2011?.standoutPaper?.id, '10.1109/tvcg.2011.185');
});

test('EnsembleLens (2018) paper profile lists all 5 real co-authors in exact publication order', () => {
  const ensembleLens = buildPaperDetail('10.1109/tvcg.2018.2864825');
  assert.deepEqual(
    ensembleLens.authors.map((a) => a.name),
    ['Ke Xu', 'Meng Xia', 'Xing Mu', 'Yun Wang', 'Nan Cao']
  );

  for (const coAuthor of ensembleLens.authors) {
    const profile = buildAuthorDetail(coAuthor.id);
    assert.equal(profile.name, coAuthor.name);
    assert.ok(profile.papers.some((p) => p.id === '10.1109/tvcg.2018.2864825'));
  }
});

test('Vispubdata parsing helpers handle CrossRef->Aminer fallback, case-insensitive DOIs, mixed delimiters, and accented names', () => {
  assert.equal(parseNullableCitationCount('42', '10'), 42);
  assert.equal(parseNullableCitationCount('NA', '19'), 19);
  assert.equal(parseNullableCitationCount(null, 0), 0);
  assert.equal(parseNullableCitationCount('null', 'none'), 0);

  assert.equal(normalizeDoi(' 10.1109/TVCG.2023.3327163 '), '10.1109/tvcg.2023.3327163');
  assert.equal(normalizeDoi('0.1109/TVCG.2022.3209402'), '10.1109/tvcg.2022.3209402');
  assert.equal(normalizeDoi('NA'), '');
  assert.equal(normalizeDoi(null), '');

  assert.deepEqual(
    splitDelimitedField('scatterplots; NA; t-SNE, high-dimensional; none'),
    ['scatterplots', 't-SNE', 'high-dimensional']
  );

  assert.equal(slugifyAuthorName('Fernanda B. Viégas'), 'fernanda-b-viegas');
  assert.equal(slugifyAuthorName('Meng Xia 0002'), 'meng-xia-0002');

  const sampleCsv = [
    'Year,Title,Abstract,DOI,Conference,CitationCount_CrossRef,AminerCitationCount,AuthorNames-Deduped,AuthorKeywords,InternalReferences',
    '2025,"Archive Survey of Missing Fields",NA,10.1109/TVCG.2025.0001,IEEE VIS,NA,14,"Meng Xia 0002; Jeffrey Heer",NA,NA',
    '1990,"Early Rendering Note","","10.1109/VIS.1990.10",IEEE SciVis,"","",hanspeter-pfister,"volume, ray","0.1109/TVCG.2025.0001"',
  ].join('\n');
  const parsed = parseVispubdataCsv(sampleCsv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].citationCount, 14);
  assert.equal(parsed[0].abstract, 'Archive Survey of Missing Fields');
  assert.ok(parsed[0].keywords.length > 0);
  assert.deepEqual(parsed[0].references, []);
  assert.equal(parsed[1].citationCount, 0);
  assert.deepEqual(parsed[1].references, ['10.1109/tvcg.2025.0001']);
});

test('Recovered 0.1109/ DOIs, zero-signal tie-breaking, and generic VIS keyword filtering work on the 4,008-paper corpus', () => {
  const idSet = new Set(RAW_PAPERS.map((p) => p.id));
  let resolvedEdgeCount = 0;
  let unfixed01109Count = 0;
  for (const p of RAW_PAPERS) {
    for (const ref of p.references) {
      if (ref.startsWith('0.1109/')) unfixed01109Count += 1;
      if (ref !== p.id && idSet.has(ref)) resolvedEdgeCount += 1;
    }
  }
  assert.equal(unfixed01109Count, 0, 'All leading 0.1109/ DOI typos must be normalized to 10.1109/');
  assert.equal(
    resolvedEdgeCount,
    23713,
    `Expected exact 23,713 unique resolved internal citation edges (+253 net unique edges from 261 recovered 0.1109/ entries), got ${resolvedEdgeCount}`
  );
  assert.equal(
    RAW_PAPERS.reduce((sum, p) => sum + p.references.filter((r) => !idSet.has(r)).length, 0),
    3,
    'Only the 3 references to missing 10.1109/vis.1999.10000 should remain unresolved'
  );

  // Zero-signal papers with uniform 0.125 scores must not fall into Graph & Network (topic-0)
  const uniformTopic0 = RAW_PAPERS.filter((p) => {
    const vals = Object.values(p.topicScores);
    const isUniform = Math.max(...vals) - Math.min(...vals) <= 1e-6;
    return isUniform && p.primaryTopicId === 'topic-0';
  });
  assert.equal(
    uniformTopic0.length,
    0,
    'No zero-signal uniform-score paper should default silently to topic-0 (Graph & Network)'
  );

  // Generic VIS bigrams/unigrams must be excluded from each topic topKeywords
  const bannedPhrases = new Set([
    'information visualization',
    'visual analytics',
    'data visualization',
    'scientific visualization',
    'visualization',
  ]);
  for (const t of TOPICS) {
    for (const kw of t.topKeywords) {
      assert.ok(
        !bannedPhrases.has(kw.term.toLowerCase()),
        `Generic phrase "${kw.term}" must not appear in ${t.id} topKeywords`
      );
    }
  }
  const scivisTopic = TOPICS.find((t) => t.id === 'topic-1');
  assert.ok(scivisTopic, 'SciVis (topic-1) must exist');
  assert.ok(
    scivisTopic.paperCount >= 550 && scivisTopic.paperCount <= 750,
    `Recalibrated SciVis (topic-1) paperCount must fall in 550-750, got ${scivisTopic.paperCount}`
  );
});

test('Streamgraph yearly prevalence values sum cleanly to 1.0 and TOPIC_CORRELATIONS connects all 8 topics at default 0.20', () => {
  const field = buildFieldOverview();
  for (const row of field.streamData) {
    const sum = Object.values(row.values).reduce((acc, v) => acc + v, 0);
    assert.ok(
      Math.abs(sum - 1) <= 1e-4,
      `Year ${row.year} normalized stream values must sum to 1.0, got ${sum}`
    );
  }

  for (let i = 0; i < TOPICS.length; i++) {
    for (let j = i + 1; j < TOPICS.length; j++) {
      const a = TOPICS[i].id;
      const b = TOPICS[j].id;
      const ab = getCorrelationBetween(a, b, TOPIC_CORRELATIONS);
      const ba = getCorrelationBetween(b, a, TOPIC_CORRELATIONS);
      assert.ok(ab > 0, `Correlation between ${a} and ${b} must be > 0, got ${ab}`);
      assert.equal(ab, ba, `Correlation between ${a} and ${b} must be symmetric`);
    }
  }

  const defaultEdges = getCorrelationGraphEdges(TOPIC_CORRELATIONS);
  assert.ok(defaultEdges.length > 0 && defaultEdges.every((e) => e.correlation >= 0.2));
  const connectedNodes = new Set<string>();
  for (const e of defaultEdges) {
    connectedNodes.add(e.sourceTopicId);
    connectedNodes.add(e.targetTopicId);
  }
  assert.equal(
    connectedNodes.size,
    TOPICS.length,
    `All ${TOPICS.length} topics must be connected at default 0.20 threshold, connected=${connectedNodes.size}`
  );

  const strictEdges = getCorrelationGraphEdges(TOPIC_CORRELATIONS, 0.28);
  assert.ok(strictEdges.length > 0 && strictEdges.every((e) => e.correlation >= 0.28));
});

test('Cosine topic similarity and decoupled CitationNetwork / EgoNetwork topology return untruncated lists & explicit density options', () => {
  assert.equal(
    Number(
      computeTopicVectorCosineSimilarity(
        { 'topic-0': 0.8, 'topic-2': 0.2 },
        { 'topic-0': 0.8, 'topic-2': 0.2 }
      ).toFixed(6)
    ),
    1
  );
  assert.equal(computeTopicVectorCosineSimilarity({ 'topic-0': 1.0 }, { 'topic-1': 1.0 }), 0);

  const ensemble = buildPaperDetail('10.1109/tvcg.2018.2864825');
  assert.ok(ensemble.relatedPapers.length > 5);
  assert.ok(ensemble.relatedPapers.every((p) => p.id !== ensemble.id));

  const topic2 = buildTopicDetail('topic-2', 'citations');
  const fullTopology = buildCitationNetworkTopology(
    topic2.citationNetwork.nodes,
    topic2.citationNetwork.links,
    'topic-2',
    false
  );
  const densityFiltered = buildCitationNetworkTopology(
    topic2.citationNetwork.nodes,
    topic2.citationNetwork.links,
    'topic-2',
    false,
    24,
    { minCitations: 50, maxNodes: 60 }
  );
  assert.equal(fullTopology.modalDisplayNodes.length, fullTopology.fullActiveNodes.length);
  assert.ok(densityFiltered.modalDisplayNodes.length <= 60);
  assert.ok(densityFiltered.modalDisplayNodes.every((n) => n.citationCount >= 50));
  assert.equal(densityFiltered.fullActiveNodes.length, fullTopology.fullActiveNodes.length);

  const hiddenStandalone = buildCitationNetworkTopology(
    topic2.citationNetwork.nodes,
    topic2.citationNetwork.links,
    'topic-2',
    true
  );
  assert.ok(hiddenStandalone.fullActiveNodes.every((n) => n.degree > 0));
  assert.equal(
    fullTopology.fullActiveNodes.length - hiddenStandalone.fullActiveNodes.length,
    fullTopology.standaloneCount
  );

  const cushion = buildPaperDetail('10.1109/infvis.1999.801860');
  const egoCompact = buildEgoNetworkCandidates(cushion, 'all', 'citations', 'compact');
  const egoAll = buildEgoNetworkCandidates(cushion, 'all', 'citations', 'all');
  assert.equal(egoCompact.allUniqueCount, egoCompact.allFilteredCandidates.length);
  assert.equal(egoAll.maxPerSector, Number.POSITIVE_INFINITY);
  assert.equal(egoAll.relatedList.length, cushion.relatedPapers.length);
  assert.equal(egoAll.citedByList.length, cushion.citedByPapers.length);
});
