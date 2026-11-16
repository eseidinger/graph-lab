import assert from 'node:assert/strict';
import test from 'node:test';
import { AgeStore } from '../dist/age.js';
import { createApp } from '../dist/app.js';
import { initializeGraph } from '../dist/migrations/001-initialize-graph.js';

test('initializes AGE idempotently and serves a real Cypher query', async (t) => {
  const databaseUrl = process.env.AGE_TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'Set AGE_TEST_DATABASE_URL to a disposable AGE database.');

  await initializeGraph(databaseUrl);
  await initializeGraph(databaseUrl);

  const app = createApp(new AgeStore(databaseUrl));
  t.after(() => app.close());

  const graphs = await app.inject({ method: 'GET', url: '/api/graphs' });
  assert.equal(graphs.statusCode, 200);
  assert.ok(graphs.json().graphs.includes('graph_lab'));

  const query = await app.inject({
    method: 'POST',
    url: '/api/query',
    payload: { graph: 'graph_lab', cypher: 'RETURN 1 AS value' },
  });
  assert.equal(query.statusCode, 200, query.body);
  assert.deepEqual(query.json().rows, [[1]]);
});
