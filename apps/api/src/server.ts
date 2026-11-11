import Fastify from 'fastify';
import { AgeStore } from './age.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && !process.env.PGPASSWORD) {
  throw new Error('Set DATABASE_URL or PostgreSQL PG* variables. See the README for local setup.');
}

const store = new AgeStore(databaseUrl);
const app = Fastify({ logger: true, bodyLimit: 100_000 });

app.get('/api/health', async () => ({ status: 'ok' }));
app.get('/api/graphs', async () => ({ graphs: await store.graphs() }));
app.post<{ Body: { graph?: unknown; cypher?: unknown } }>('/api/query', async (request, reply) => {
  const { graph, cypher } = request.body ?? {};
  if (typeof graph !== 'string' || typeof cypher !== 'string') {
    return reply.code(400).send({ error: 'graph and cypher must be strings.' });
  }
  try {
    return await store.execute(graph, cypher);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed.';
    request.log.warn({ error }, 'query failed');
    return reply.code(400).send({ error: message });
  }
});

app.addHook('onClose', async () => store.close());
await app.listen({ host, port });
