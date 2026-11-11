import pg from 'pg';
import { cypherSql, returnShape } from './cypher.js';

export type GraphNode = {
  id: string;
  label: string;
  properties: Record<string, unknown>;
};
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  properties: Record<string, unknown>;
};

export type QueryResult = {
  columns: string[];
  rows: unknown[][];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  durationMs: number;
};

function removeAgtypeAnnotations(input: string): string {
  let quote = false;
  let output = '';
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"' && input[i - 1] !== '\\') quote = !quote;
    if (!quote && input.slice(i).match(/^::(?:vertex|edge|path|numeric)\b/)) {
      i += input.slice(i).match(/^::(?:vertex|edge|path|numeric)\b/)![0].length - 1;
    } else output += char;
  }
  return output;
}

function decodeAgtype(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(removeAgtypeAnnotations(value));
  } catch {
    return value;
  }
}

function graphFromRows(rows: unknown[][]): QueryResult['graph'] {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if (item.id != null && typeof item.label === 'string' && item.properties && typeof item.properties === 'object') {
      const id = String(item.id);
      const properties = item.properties as Record<string, unknown>;
      const source = item.start_id ?? item.startid;
      const target = item.end_id ?? item.endid;
      if (source != null && target != null) {
        edges.set(id, { id, source: String(source), target: String(target), label: item.label, properties });
      } else nodes.set(id, { id, label: item.label, properties });
      return;
    }
    Object.values(item).forEach(visit);
  };
  rows.flat().forEach(visit);
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export class AgeStore {
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    this.pool = new pg.Pool({ ...(connectionString ? { connectionString } : {}), max: 5 });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async graphs(): Promise<string[]> {
    const result = await this.pool.query<{ name: string }>('SELECT name::text AS name FROM ag_catalog.ag_graph ORDER BY name');
    return result.rows.map((row) => row.name);
  }

  async execute(graph: string, rawCypher: string): Promise<QueryResult> {
    const cypher = rawCypher.trim().replace(/;+\s*$/, '');
    if (!cypher || cypher.length > 20000) throw new Error('Enter a Cypher query up to 20,000 characters.');
    if (!(await this.graphs()).includes(graph)) throw new Error(`Graph ${graph} does not exist.`);
    const shape = returnShape(cypher);
    const client = await this.pool.connect();
    const start = performance.now();
    try {
      await client.query('BEGIN');
      await client.query("LOAD 'age'");
      await client.query("SET LOCAL search_path = ag_catalog, public");
      await client.query("SET LOCAL statement_timeout = '15s'");
      const result = await client.query<Record<string, unknown>>(cypherSql(graph, cypher, shape.sqlColumns));
      await client.query('COMMIT');
      const rows = result.rows.map((row) => Object.values(row).map(decodeAgtype));
      return {
        columns: shape.labels,
        rows,
        graph: graphFromRows(rows),
        durationMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
