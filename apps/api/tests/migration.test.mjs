import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateGraph } from '../src/migrations/001-initialize-graph.ts';

function fakeClient({ graphExists = false, failOn } = {}) {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === failOn) throw new Error('database failure');
      return { rowCount: sql.startsWith('SELECT 1 FROM ag_catalog.ag_graph') && graphExists ? 1 : 0 };
    },
  };
  return { client, calls };
}

test('creates a missing graph once under a transaction lock', async () => {
  const { client, calls } = fakeClient();
  await migrateGraph(client, false);
  assert.deepEqual(calls.map(({ sql }) => sql), [
    'BEGIN',
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    'SET LOCAL search_path = ag_catalog, public',
    'SELECT 1 FROM ag_catalog.ag_graph WHERE name::text = $1',
    'SELECT ag_catalog.create_graph($1)',
    'COMMIT',
  ]);
  assert.deepEqual(calls.find(({ sql }) => sql === 'SELECT ag_catalog.create_graph($1)').values, ['graph_lab']);
});

test('keeps an existing graph and loads the local AGE library when configured', async () => {
  const { client, calls } = fakeClient({ graphExists: true });
  await migrateGraph(client, true);
  assert.ok(calls.some(({ sql }) => sql === "LOAD 'age'"));
  assert.ok(!calls.some(({ sql }) => sql === 'SELECT ag_catalog.create_graph($1)'));
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('rolls back a failed graph creation', async () => {
  const { client, calls } = fakeClient({ failOn: 'SELECT ag_catalog.create_graph($1)' });
  await assert.rejects(migrateGraph(client, false), /database failure/);
  assert.equal(calls.at(-1).sql, 'ROLLBACK');
});
