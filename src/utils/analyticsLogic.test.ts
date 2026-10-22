import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorDetail,
  buildFieldOverview,
  buildPaperDetail,
  buildTopicDetail,
  cleanAuthorDisplayName,
  computeTopicHIndex,
  filterAuthorsByQuery,
  listAllAuthors,
  listAllPapers,
  sortAndFilterPapers,
  toPaperSummary,
} from './analyticsLogic';
import { RAW_PAPERS } from '../data/vispubCorpus';

test('buildFieldOverview returns 8 beginner-friendly VIS topics, 35 years of normalized streamData, and consistent 1990-2024 corpus paper counts', () => {
  const field = buildFieldOverview();
  assert.equal(field.topics.length, 8);
  assert.equal(field.streamData.length, 35);
  assert.equal(field.yearRange[0], 1990);
  assert.equal(field.yearRange[1], 2024);

  // Total corpus papers across 1990-2024 must reflect full Vispubdata scale (> 3,500 papers, never 104)
  assert.ok(
    field.totalPapers >= 3500,
    `Expected >= 3,500 total IEEE VIS corpus papers (1990-2024), got ${field.totalPapers}`
  );

  // Every subfield's paperCount must equal the exact 35-year sum of its annual counts in streamData
  for (const topic of field.topics) {
    const streamSum = field.streamData.reduce(
      (sum, yrRow) => sum + (yrRow.counts[topic.id] ?? 0),
      0
    );
    assert.equal(
      topic.paperCount,
      streamSum,
      `Subfield ${topic.id} paperCount (${topic.paperCount}) must equal its 1990-2024 streamData sum (${streamSum})`
    );
  }

  // Visual Analytics & Machine Learning / XAI (topic-2) must have > 400 corpus papers and >= 30 indexed landmark papers
  const xaiTopic = field.topics.find((t) => t.id === 'topic-2');
  assert.ok(xaiTopic, 'XAI subfield (topic-2) must exist');
  assert.ok(
    xaiTopic.paperCount >= 400,
    `Expected >= 400 corpus papers in XAI across 1990-2024, got ${xaiTopic.paperCount}`
  );
  assert.ok(
    (xaiTopic.indexedPaperCount ?? 0) >= 30,
    `Expected >= 30 verified indexed landmark papers in XAI, got ${xaiTopic.indexedPaperCount}`
  );

  const expectedNames = [
    'Graph & Network Visualization',
    'Scientific & Volume Visualization (SciVis)',
    'Visual Analytics & Machine Learning / XAI',
    'High-Dimensional & Multivariate Data',
    'Perception & Color / Evaluation',
    'Interaction Techniques & Human-in-the-Loop',
    'Geospatial & Spatial Data',
    'Text & Document Analytics',
  ];
  for (const name of expectedNames) {
    assert.ok(
      field.topics.some((t) => t.name === name),
      `Missing expected topic name: ${name}`
    );
  }
});

test('DBLP disambiguation cleanup and flexible author/paper search (Meng Xia, Xia Meng, xia, Meng Xia 0002)', () => {
  assert.equal(cleanAuthorDisplayName('Meng Xia 0002'), 'Meng Xia');
  assert.equal(cleanAuthorDisplayName('Huamin Qu 0001'), 'Huamin Qu');
  assert.equal(cleanAuthorDisplayName('Jeffrey Heer'), 'Jeffrey Heer');

  const allAuthors = listAllAuthors();
  const mengProfile = allAuthors.find((a) => a.id === 'meng-xia-0002');
  assert.ok(mengProfile, 'Meng Xia should be indexed in listAllAuthors');
  assert.equal(mengProfile.name, 'Meng Xia');
  assert.equal(mengProfile.rawName, 'Meng Xia 0002');

  // Verify flexible reordered and case-insensitive author search
  for (const q of ['Meng Xia', 'Xia Meng', 'xia', 'meng xia 0002', 'XIA MENG']) {
    const matches = filterAuthorsByQuery(allAuthors, q);
    assert.ok(
      matches.some((a) => a.id === 'meng-xia-0002'),
      `Query "${q}" must return Meng Xia's author profile`
    );
  }

  // Verify flexible paper search by author name in any order
  const allPapers = listAllPapers('citations');
  for (const q of ['Meng Xia', 'Xia Meng', 'xia']) {
    const matchedPapers = sortAndFilterPapers(allPapers, 'citations', q);
    assert.ok(
      matchedPapers.length >= 3,
      `Paper search for "${q}" should return Meng Xia's papers`
    );
    assert.ok(
      matchedPapers.every((p) => p.authors.every((a) => !/\d{4}$/.test(a.name))),
      'Displayed author names on papers must have DBLP digits stripped'
    );
  }
});

test('Strict author-paper attribution: Meng Xia only has her real verified publications and corpus has zero synthetic papers', () => {
  // Ensure zero procedurally fabricated papers exist anywhere in the corpus
  assert.ok(
    RAW_PAPERS.every((p) => !p.id.includes('-proc-')),
    'Corpus must not contain any procedurally generated fake papers'
  );

  const mengDetail = buildAuthorDetail('meng-xia-0002');
  const expectedMengPaperIds = new Set([
    'vis-2018-ensemblelens',
    'vis-2018-peerlens',
    'vis-2019-k12-learning',
    'vis-2020-qlens',
    'vis-2022-printed-ar',
    'vis-2022-persua',
    'vis-2022-rlens',
    'vis-2024-stugptviz',
    'vis-2024-vistellar',
  ]);

  assert.equal(mengDetail.papers.length, expectedMengPaperIds.size);
  for (const p of mengDetail.papers) {
    assert.ok(
      expectedMengPaperIds.has(p.id),
      `Unexpected paper ${p.id} ("${p.title}") found in Meng Xia's profile`
    );
  }

  // Verify GNNLens, DECE, and DeepDrawing are not attributed to Meng Xia
  const forbiddenIds = ['vis-2021-gnnlens', 'vis-2021-dece', 'vis-2020-deepdrawing'];
  for (const fid of forbiddenIds) {
    assert.ok(
      !mengDetail.papers.some((p) => p.id === fid),
      `Paper ${fid} does not belong to Meng Xia and must not appear in her profile`
    );
  }
});

test('Missing abstract and keyword fields fall back gracefully to paper title without dropping records', () => {
  const summary = toPaperSummary({
    id: 'test-empty-fields',
    title: 'Interactive Visual Analytics of Multivariate Networks',
    year: 2021,
    venue: 'VIS',
    doi: '10.1109/TVCG.2021.0000000',
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

test('buildTopicDetail returns >=40% topic network topology, cross-topic bridges, and composite leadingAuthors ranking', () => {
  const detail = buildTopicDetail('topic-2', 'citations');
  assert.equal(detail.topic.id, 'topic-2');
  assert.ok(
    detail.seminalPapers.length >= 3 && detail.seminalPapers.length <= 6,
    'Topic detail should provide 3-6 seminal papers for the topic'
  );

  // Full topology check: all papers in topic-2 with >= 40% relevance score must be in citationNetwork.nodes
  const highFitPapers = detail.papers.filter((p) => p.relevanceScore >= 0.4);
  assert.ok(
    highFitPapers.length >= 10,
    `Expected >=10 high-fit papers in topic-2, got ${highFitPapers.length}`
  );
  for (const hp of highFitPapers) {
    assert.ok(
      detail.citationNetwork.nodes.some((n) => n.id === hp.id),
      `High-fit paper ${hp.id} must be included in topic citation network nodes`
    );
  }

  // Cross-topic citation bridge check
  assert.ok(
    detail.citationNetwork.nodes.some((n) => n.isCrossTopic === true),
    'Citation network should include cross-topic nodes linked by citations'
  );

  // Composite Leading Researchers ranking: top-ranked authors must have multi-paper sustained contribution
  assert.ok(detail.leadingAuthors.length >= 4);
  assert.ok(
    detail.leadingAuthors[0].topicPaperCount >= 3,
    `Top-ranked leading researcher in topic-2 should have >= 3 topic papers, got ${detail.leadingAuthors[0].topicPaperCount}`
  );
  assert.equal(computeTopicHIndex([500, 300, 120, 2]), 3);
});

test('buildAuthorDetail strictly aggregates standoutPaper per specific year and returns null on 0-paper years', () => {
  const heer = buildAuthorDetail('jeffrey-heer');
  assert.equal(heer.name, 'Jeffrey Heer');
  assert.ok(heer.yearlyStats.length > 10);

  for (const yrStat of heer.yearlyStats) {
    if (yrStat.paperCount === 0) {
      assert.equal(
        yrStat.standoutPaper,
        null,
        `Year ${yrStat.year} has 0 papers and must have standoutPaper === null`
      );
      assert.equal(yrStat.citationSum, 0);
    } else {
      assert.ok(
        yrStat.standoutPaper !== null,
        `Year ${yrStat.year} has ${yrStat.paperCount} papers and must have a non-null standoutPaper`
      );
      assert.equal(
        yrStat.standoutPaper.year,
        yrStat.year,
        `Standout paper in ${yrStat.year} must actually be published in ${yrStat.year}`
      );
    }
  }

  // Ensure Jeffrey Heer has distinct standout papers in different active years (e.g. 2007 vs 2008 gap year vs 2011 vs 2017)
  const stat2007 = heer.yearlyStats.find((s) => s.year === 2007);
  const stat2008 = heer.yearlyStats.find((s) => s.year === 2008);
  const stat2011 = heer.yearlyStats.find((s) => s.year === 2011);
  const stat2017 = heer.yearlyStats.find((s) => s.year === 2017);
  assert.equal(stat2007?.standoutPaper?.id, 'vis-2007-dynaquery');
  assert.equal(stat2008?.standoutPaper, null);
  assert.equal(stat2011?.standoutPaper?.id, 'vis-2011-d3');
  assert.equal(stat2017?.standoutPaper?.id, 'vis-2017-vegalite');
});

test('EnsembleLens paper profile lists all 5 real co-authors in exact publication order and yearlyStats includes all yearPapers', () => {
  const ensembleLens = buildPaperDetail('vis-2018-ensemblelens');
  assert.deepEqual(
    ensembleLens.authors.map((a) => a.name),
    ['Ke Xu', 'Meng Xia', 'Xing Mu', 'Yun Wang', 'Nan Cao']
  );

  // Every co-author on EnsembleLens must have a valid author detail profile containing EnsembleLens
  for (const coAuthor of ensembleLens.authors) {
    const profile = buildAuthorDetail(coAuthor.id);
    assert.equal(profile.name, coAuthor.name);
    assert.ok(
      profile.papers.some((p) => p.id === 'vis-2018-ensemblelens'),
      `Co-author ${coAuthor.name} must list EnsembleLens in their publications`
    );
  }

  // Meng Xia's 2022 yearlyStat must list all 3 of her 2022 publications in yearPapers
  const meng = buildAuthorDetail('meng-xia-0002');
  const stat2022 = meng.yearlyStats.find((s) => s.year === 2022);
  assert.ok(stat2022, '2022 yearly stat must exist for Meng Xia');
  assert.equal(stat2022.paperCount, 3);
  assert.equal(stat2022.yearPapers?.length, 3);
  assert.deepEqual(
    stat2022.yearPapers?.map((p) => p.id),
    ['vis-2022-printed-ar', 'vis-2022-persua', 'vis-2022-rlens']
  );
});

