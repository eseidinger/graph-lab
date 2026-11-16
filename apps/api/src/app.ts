import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgeStore } from './age.js';

type Store = Pick<AgeStore, 'graphs' | 'execute' | 'close'>;

const webRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url));
const assetTypes: Record<string, string> = {
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

export function createApp(store: Store) {
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

  app.get('/', async (_request, reply) => {
    try {
      return reply.type('text/html; charset=utf-8').send(await readFile(resolve(webRoot, 'index.html')));
    } catch {
      return reply.code(404).send({ error: 'Web build is unavailable.' });
    }
  });

  app.get<{ Params: { '*': string } }>('/assets/*', async (request, reply) => {
    const assetPath = resolve(webRoot, 'assets', request.params['*']);
    if (!assetPath.startsWith(resolve(webRoot, 'assets') + sep)) {
      return reply.code(404).send({ error: 'Asset not found.' });
    }
    try {
      const asset = await readFile(assetPath);
      return reply
        .type(assetTypes[extname(assetPath)] ?? 'application/octet-stream')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(asset);
    } catch {
      return reply.code(404).send({ error: 'Asset not found.' });
    }
  });

  app.addHook('onClose', async () => store.close());
  return app;
}
