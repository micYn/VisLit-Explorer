import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorDetail,
  buildFieldOverview,
  buildPaperDetail,
  buildTopicDetail,
  getCorrelationBetween,
  sortAndFilterPapers,
  listAllPapers,
} from './analyticsLogic';

test('buildFieldOverview returns 8 LDA topics, 35 years of normalized streamData, and correlation edges', () => {
  const overview = buildFieldOverview();
  assert.equal(overview.topics.length, 8);
  assert.equal(overview.streamData.length, 35);
  assert.deepEqual(overview.yearRange, [1990, 2024]);

  // Verify each year's prevalence sums to ~1.0
  for (const yrRow of overview.streamData) {
    const sum = Object.values(yrRow.values).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.01, `Year ${yrRow.year} sum was ${sum}`);
  }
});

test('buildTopicDetail returns ranked papers and intra-topic citation network nodes and links', () => {
  const topicDetail = buildTopicDetail('topic-5', 'citations');
  assert.equal(topicDetail.topic.id, 'topic-5');
  assert.ok(topicDetail.papers.length >= 5);
  assert.equal(topicDetail.citationNetwork.nodes.length, topicDetail.papers.length);
  assert.ok(topicDetail.citationNetwork.links.length > 0);

  // Verify citation sorting is descending
  for (let i = 1; i < topicDetail.papers.length; i++) {
    assert.ok(topicDetail.papers[i - 1].citationCount >= topicDetail.papers[i].citationCount);
  }
});

test('sortAndFilterPapers sorts by LDA relevanceScore and filters by search query and venue', () => {
  const allPapers = listAllPapers('relevance');
  for (let i = 1; i < allPapers.length; i++) {
    assert.ok(allPapers[i - 1].relevanceScore >= allPapers[i].relevanceScore);
  }

  const d3Query = sortAndFilterPapers(allPapers, 'citations', 'Data-Driven Documents');
  assert.equal(d3Query.length, 1);
  assert.equal(d3Query[0].id, 'vis-2011-d3');

  const vastOnly = sortAndFilterPapers(allPapers, 'citations', '', 'IEEE VAST');
  assert.ok(vastOnly.length > 0);
  assert.ok(vastOnly.every((p) => p.venue === 'IEEE VAST'));
});

test('buildAuthorDetail computes yearly throughput, topic distribution shares summing to 1, and co-authors', () => {
  const heer = buildAuthorDetail('jeffrey-heer');
  assert.equal(heer.id, 'jeffrey-heer');
  assert.ok(heer.yearlyStats.length > 15);
  assert.ok(heer.papers.length >= 4);

  const shareSum = heer.topicDistribution.reduce((acc, item) => acc + item.share, 0);
  assert.ok(Math.abs(shareSum - 1.0) < 0.02);
});

test('buildPaperDetail returns full abstract, topic breakdown, references, citedBy, and related papers', () => {
  const vegalite = buildPaperDetail('vis-2017-vegalite');
  assert.equal(vegalite.id, 'vis-2017-vegalite');
  assert.ok(vegalite.abstract.includes('Vega-Lite'));
  assert.ok(vegalite.referencesPapers.some((p) => p.id === 'vis-2011-d3'));
  assert.ok(vegalite.citedByPapers.length > 0);
  assert.ok(vegalite.relatedPapers.length > 0);
  assert.equal( getCorrelationBetween('topic-5', 'topic-5'), 1.0);
});
