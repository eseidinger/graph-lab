import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';

function testApp(options = {}) {
  const calls = [];
  const store = {
    async graphs() { return ['graph_lab']; },
    async execute(graph, cypher) {
      calls.push({ graph, cypher });
      if (options.failQuery) throw new Error('AGE rejected query');
      return { columns: ['value'], rows: [[1]], graph: { nodes: [], edges: [] }, durationMs: 1 };
    },
    async close() {},
  };
  return { app: createApp(store), calls };
}

test('exposes the configured graph through the API', async (t) => {
  const { app } = testApp();
  t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/api/graphs' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { graphs: ['graph_lab'] });
});

test('validates query input before calling the store', async (t) => {
  const { app, calls } = testApp();
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/query', payload: { graph: 123, cypher: 'RETURN 1' } });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(calls, []);
});

test('returns query results and reports AGE errors', async (t) => {
  const { app, calls } = testApp();
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST', url: '/api/query', payload: { graph: 'graph_lab', cypher: 'RETURN 1' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().rows, [[1]]);
  assert.deepEqual(calls, [{ graph: 'graph_lab', cypher: 'RETURN 1' }]);

  const failing = testApp({ failQuery: true });
  t.after(() => failing.app.close());
  const error = await failing.app.inject({
    method: 'POST', url: '/api/query', payload: { graph: 'graph_lab', cypher: 'invalid' },
  });
  assert.equal(error.statusCode, 400);
  assert.deepEqual(error.json(), { error: 'AGE rejected query' });
});
