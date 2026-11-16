import { initializeGraph } from './migrations/001-initialize-graph.js';

await initializeGraph(process.env.DATABASE_URL);
