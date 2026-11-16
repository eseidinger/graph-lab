import { AgeStore } from './age.js';
import { createApp } from './app.js';
import { initializeGraph } from './migrations/001-initialize-graph.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && !process.env.PGPASSWORD) {
  throw new Error('Set DATABASE_URL or PostgreSQL PG* variables. See the README for local setup.');
}

await initializeGraph(databaseUrl);
const app = createApp(new AgeStore(databaseUrl));
await app.listen({ host, port });
