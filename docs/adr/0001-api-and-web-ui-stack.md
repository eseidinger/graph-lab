# ADR 0001: API and web UI technology stack

- **Status:** Accepted
- **Date:** 2026-11-11

## Context

Graph Lab needs a web console for Apache AGE and Cypher first, with room for additional graph stores and query languages such as Gremlin. The console must show query results as both rows and graph elements. Neo4j and HugeGraph will run as reference environments with their own consoles.

Apache AGE executes Cypher through PostgreSQL and returns `agtype` values. The API therefore needs to handle AGE-specific query execution and translate results before sending them to the browser.

## Decision

| Layer | Technology | Role |
| --- | --- | --- |
| API runtime | Node.js and TypeScript | Run the backend with a shared language and type system across the project. |
| API framework | Fastify | Expose connection, graph, and query endpoints. |
| AGE client | `pg` (node-postgres) | Connect to PostgreSQL with the AGE extension. |
| Web UI | React and TypeScript | Build the interactive console. |
| Web build | Vite | Develop and bundle the browser application. |
| UI components | Mantine | Provide the layout, forms, dialogs, tabs, notifications, and theme. |
| Query editor | Monaco Editor | Edit Cypher queries; add language support incrementally. |
| Graph view | Cytoscape.js | Display returned vertices and edges interactively. |
| Initial result table | Mantine `Table` | Render tabular query results without a separate table engine. |
| Initial API calls | Browser `fetch` | Make API requests without an additional data-fetching library. |

The API will expose store adapters. Each adapter owns connection handling, query execution, error translation, and conversion into a common result model. The UI will send a connection choice, graph choice, query language, and query text, then render the returned rows and graph elements. The common model will cover actual results from supported stores; it will not assume that all stores have identical query semantics.

The first implemented adapter will support Apache AGE and Cypher. Gremlin and other stores are later additions. Neo4j Community Edition and HugeGraph will initially run as separate reference services, not as components embedded in graph-lab.

If result tables need richer sorting, filtering, column controls, or large-data handling, add TanStack Table. If server state needs shared caching or automatic refresh, add TanStack Query. Neither is required for the first version.

## Licensing and distribution

The selected API and UI libraries use permissive licenses. Apache AGE and HugeGraph use Apache 2.0. Neo4j Community Edition uses GPLv3 and will remain a separate reference service. If a future distribution bundles Neo4j or incorporates its code, review that distribution before release. Preserve required license and copyright notices for shipped dependencies and generate a dependency license inventory for release builds.

## Consequences

- AGE-specific PostgreSQL details stay in the backend rather than leaking into the UI.
- A single TypeScript toolchain covers the application, while the adapter boundary allows different client libraries for future stores.
- Graph visualization and tabular results can evolve independently of store-specific query execution.
- Mantine provides consistent UI components while the result table and API calls remain simple until their requirements grow.
- The first milestone stays limited to AGE/Cypher; support for Neo4j, HugeGraph, and Gremlin in the graph-lab console is not implied by their presence in the development environment.
