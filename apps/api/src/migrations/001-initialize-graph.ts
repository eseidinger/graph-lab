import pg from 'pg';

const graphName = 'graph_lab';

export async function initializeGraph(connectionString?: string): Promise<void> {
  const client = new pg.Client(connectionString ? { connectionString } : {});
  await client.connect();
  try {
    await client.query('BEGIN');
    // Serialize startup across replicas so only one process creates the graph.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`graph-lab:${graphName}`]);
    if (process.env.AGE_LOAD_LIBRARY !== 'false') await client.query("LOAD 'age'");
    await client.query('SET LOCAL search_path = ag_catalog, public');
    const existing = await client.query('SELECT 1 FROM ag_catalog.ag_graph WHERE name::text = $1', [graphName]);
    if (existing.rowCount === 0) {
      await client.query('SELECT ag_catalog.create_graph($1)', [graphName]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
