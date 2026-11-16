# Graph Lab

Graph Lab is a playground for experimenting with graph algorithms and graph data stores. It is also the development home for **graph-lab**, a web console for exploring graph data across different backends.

The first console target is **Apache AGE** with **Cypher** queries. The longer-term goal is to support additional graph data stores and query languages, including **Gremlin**, through the same web interface.

> **Project status:** A local Apache AGE/Cypher console MVP is available. Docker Compose provides AGE, Neo4j, HugeGraph, and their reference consoles. The [graph tutorial](docs/use-cases/graph-tutorial.md) provides the first reproducible use cases.

## Goals

- Provide a repeatable local environment for trying graph models, queries, and algorithms against real data stores.
- Build a web console that lets users connect to a supported store, run queries, and inspect results.
- Start with Apache AGE and Cypher, while keeping the console extensible for other stores and query languages.
- Run Neo4j and HugeGraph alongside Apache AGE, with access to their respective consoles, so their workflows can serve as references during development.
- Document practical use cases with sample data, queries, expected results, and notes on differences between stores.

## Development environment

| Component | Purpose |
| --- | --- |
| Apache AGE | Primary backend for the first version of the graph-lab console. |
| pgAdmin | SQL web console for Apache AGE while the graph-lab console is being built. |
| Neo4j Browser | Reference console for Neo4j and Cypher workflows. |
| HugeGraph Hubble | Reference console for HugeGraph and Gremlin workflows. |
| graph-lab web console | MVP interface for selecting an AGE graph, running Cypher, and viewing tabular and graph results. |

Docker Compose starts these services together with separate persistent volumes. The reference consoles are for comparison and experimentation; they are not part of the graph-lab application.

## Technology stack

The API and web UI stack is recorded in [ADR 0001](docs/adr/0001-api-and-web-ui-stack.md). In short, the API will use Node.js, TypeScript, Fastify, and `pg`; the web UI will use React, TypeScript, Vite, Mantine, Monaco Editor, and Cytoscape.js. The first store adapter will target Apache AGE and Cypher.

## Run the graph-lab MVP

For deployment on an existing Developer Platform installation, follow the
[Developer Platform bootstrap guide](docs/developer-platform-bootstrap.md).

Start the [Docker environment](#getting-started) first. With Node.js 24 and npm installed, run from the repository root:

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. The dev script reads `docker/.env`, configures the API connection to AGE, and starts the API on `127.0.0.1:3001` and the web UI on `127.0.0.1:5173`. The UI proxies `/api` requests to the API. Use the [graph tutorial](docs/use-cases/graph-tutorial.md) to load sample data, then try the built-in query examples.

The MVP supports Cypher `RETURN` queries with explicit projections and write queries without `RETURN`. It detects the number of projected columns for AGE, displays values in a table, and extracts returned vertices, edges, and paths into a graph view. `RETURN *` is not supported yet. Queries have a 15-second database timeout. The API uses one AGE connection configured at startup and is intended for local development; it has no user authentication.

Run `npm run lint` to lint the API and web TypeScript code, `npm run check` for lint and TypeScript checks, and `npm run build` for production bundles. The web build also generates dependency license notices in `apps/web/dist/.vite/license.md`.

Run `npm test` for API route and web component tests. `npm run test:e2e` runs a Chromium browser flow against the local web UI with mocked API responses; install the browser once with `npx playwright install chromium`. For the real Apache AGE integration test, start a disposable AGE database and set `AGE_TEST_DATABASE_URL` to its PostgreSQL URL before running `npm run test:age`. CI starts AGE and runs all three test suites.

## Console direction

The MVP uses one locally configured AGE connection. Later milestones can add connection profiles, saved queries, and additional backends. Store-specific connection and query behavior should stay isolated so support for Gremlin and other data stores can be added without redesigning the user interface.

## Use case documentation

Each use case should explain the question being explored and provide enough detail to reproduce it:

1. **Scenario and graph model:** the entities, relationships, and question.
2. **Data setup:** a small dataset or an import procedure.
3. **Queries or algorithm:** commands for each supported store and language.
4. **Expected outcome:** results and how to interpret them.
5. **Comparison notes:** syntax, capabilities, or behavior that differs across stores.

Start with the [graph tutorial](docs/use-cases/graph-tutorial.md), which loads the same small social network into Neo4j, Apache AGE, and HugeGraph and compares four query use cases. Add further examples under `docs/use-cases/`.

## Getting started

Install Docker with the Compose plugin. Copy the example environment file, then start the services:

```bash
cd docker
cp .env.example .env
docker compose up -d --wait
docker compose ps
```

The example credentials are for local development. Edit `.env` before startup if you want different passwords. All published ports bind to `127.0.0.1` and can be changed in `.env`.

| Service | Local address | Login |
| --- | --- | --- |
| Apache AGE / PostgreSQL | `localhost:5432` | Database `graphlab`, user `graphlab`, password `AGE_PASSWORD` from `.env` |
| pgAdmin | <http://localhost:5050> | `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` from `.env` |
| Neo4j Browser | <http://localhost:7474/browser/> | `neo4j` / `NEO4J_PASSWORD` from `.env` |
| Neo4j Bolt | `bolt://localhost:7687` | Same Neo4j credentials |
| HugeGraph API | <http://localhost:8080> | `admin` / `HUGEGRAPH_ADMIN_PASSWORD` from `.env` |
| HugeGraph Hubble | <http://localhost:8088> | `admin` / `HUGEGRAPH_ADMIN_PASSWORD` from `.env` |

In pgAdmin, the **Apache AGE** server is pre-registered. Enter `AGE_PASSWORD` when connecting. The `graph_lab` graph is created when the AGE data volume is initialized. In its Query Tool, run:

```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('graph_lab', $$ RETURN 1 $$) AS (value agtype);
```

The AGE extension must be loaded and its catalog added to the search path for each new database session. For applications running in the Compose network, connect to AGE at `age:5432` and HugeGraph at `hugegraph:8080`; `localhost` inside a container points to that container.

From the `docker/` directory, stop the services with `docker compose down`. Their named volumes persist across restarts. To deliberately remove all local lab data, use `docker compose down -v`.

## Roadmap

1. Add connection profiles and richer Cypher completion and query history.
2. Add more reproducible data sets and use case guides.
3. Expand the console to other data stores and Gremlin.
