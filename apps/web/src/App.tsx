import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import {
  Alert, Badge, Button, Container, Group, Loader, Paper, Select,
  Stack, Table, Tabs, Text, Title,
} from '@mantine/core';
import GraphView, { type GraphData } from './GraphView';
import { platformCsrfToken } from './platformCsrf';

type Result = {
  columns: string[];
  rows: unknown[][];
  graph: GraphData;
  durationMs: number;
};

const examples = [
  { label: 'Graph elements', query: 'MATCH p = (a)-[]->(b)\nRETURN p\nLIMIT 50' },
  { label: 'All vertices', query: 'MATCH (n)\nRETURN n\nLIMIT 50' },
  { label: 'Two-hop suggestions', query: "MATCH (:TutorialPerson {name: 'Alice'})-[:FOLLOWS]->(via)-[:FOLLOWS]->(candidate)\nRETURN candidate.name AS name, count(*) AS routes\nORDER BY routes DESC, name" },
  { label: 'Follower counts', query: 'MATCH (source:TutorialPerson)-[:FOLLOWS]->(target:TutorialPerson)\nRETURN target.name AS name, count(source) AS followers\nORDER BY followers DESC, name' },
];

function display(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export default function App() {
  const [graphs, setGraphs] = useState<string[]>([]);
  const [graph, setGraph] = useState<string | null>(null);
  const [query, setQuery] = useState(examples[0].query);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [tab, setTab] = useState<string | null>('table');
  const runRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    fetch('/api/graphs')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not connect to the API. Start it with npm run dev.');
        return response.json() as Promise<{ graphs: string[] }>;
      })
      .then((data) => {
        setGraphs(data.graphs);
        setGraph((current) => current ?? data.graphs[0] ?? null);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load graphs.'))
      .finally(() => setConnecting(false));
  }, []);

  const run = useCallback(async () => {
    if (!graph || !query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const csrfToken = platformCsrfToken(document.cookie);
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-Platform-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ graph, cypher: query }),
      });
      const data = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Query failed.');
      setResult(data);
      setTab(data.graph.nodes.length || data.graph.edges.length ? 'graph' : 'table');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Query failed.');
    } finally {
      setLoading(false);
    }
  }, [graph, query, loading]);
  useEffect(() => {
    runRef.current = () => void run();
  }, [run]);

  const onEditorMount: OnMount = (editor, monaco) => {
    if (!monaco.languages.getLanguages().some((language: { id: string }) => language.id === 'cypher')) {
      monaco.languages.register({ id: 'cypher' });
      monaco.languages.setMonarchTokensProvider('cypher', {
        ignoreCase: true,
        keywords: [
          'MATCH', 'OPTIONAL', 'WHERE', 'RETURN', 'WITH', 'CREATE', 'MERGE',
          'SET', 'DELETE', 'DETACH', 'REMOVE', 'UNWIND', 'AS', 'ORDER', 'BY',
          'LIMIT', 'SKIP', 'DISTINCT', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL',
          'TRUE', 'FALSE', 'COUNT', 'ASC', 'DESC',
        ],
        tokenizer: {
          root: [
            [/\/\/.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            [/'([^'\\]|\\.)*'/, 'string'],
            [/"([^"\\]|\\.)*"/, 'string'],
            [/\b\d+(?:\.\d+)?\b/, 'number'],
            [/[A-Za-z_][\w]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
          ],
          comment: [[/[^*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/\*/, 'comment']],
        },
      });
    }
    if (editor.getModel()) monaco.editor.setModelLanguage(editor.getModel()!, 'cypher');
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  return (
    <div className="app-shell">
      <Container size="xl" py="xl">
        <header className="topbar">
          <div>
            <Text className="eyebrow">GRAPH DATA PLAYGROUND</Text>
            <Title order={1}>Graph Lab</Title>
            <Text c="dimmed" mt={4}>Explore Apache AGE with Cypher.</Text>
          </div>
          <Badge variant="light" color="blue" size="lg">AGE · Cypher</Badge>
        </header>

        <div className="workspace">
          <Paper className="panel editor-panel" radius="lg" p="lg">
            <Stack gap="md" h="100%">
              <Group justify="space-between" align="end">
                <div>
                  <Text fw={700} size="lg">Query</Text>
                  <Text c="dimmed" size="sm">Run against a local AGE graph</Text>
                </div>
                {connecting && <Loader size="sm" />}
              </Group>
              <Select
                label="Graph"
                placeholder="Select a graph"
                data={graphs}
                value={graph}
                onChange={setGraph}
                disabled={connecting || graphs.length === 0}
                searchable
              />
              <Select
                label="Example query"
                placeholder="Choose an example"
                data={examples.map((example) => example.label)}
                onChange={(label) => {
                  const example = examples.find((item) => item.label === label);
                  if (example) setQuery(example.query);
                }}
              />
              <Text c="dimmed" size="xs">Load the tutorial social network before using the suggestion and follower examples.</Text>
              <div className="editor-frame">
                <Editor
                  height="100%"
                  theme="vs-dark"
                  defaultLanguage="cypher"
                  value={query}
                  onChange={(value) => setQuery(value ?? '')}
                  onMount={onEditorMount}
                  options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', scrollBeyondLastLine: false, automaticLayout: true, lineNumbers: 'on', tabSize: 2 }}
                />
              </div>
              <Group justify="space-between">
                <Text c="dimmed" size="xs">Ctrl/⌘ + Enter to run</Text>
                <Button onClick={() => void run()} loading={loading} disabled={!graph || !query.trim()}>
                  Run query
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Paper className="panel result-panel" radius="lg" p="lg">
            <Group justify="space-between" mb="md">
              <div>
                <Text fw={700} size="lg">Results</Text>
                <Text c="dimmed" size="sm">Table and graph views</Text>
              </div>
              {result && <Badge variant="outline" color="gray">{result.rows.length} rows · {result.durationMs} ms</Badge>}
            </Group>
            {error && <Alert color="red" title="Query error" mb="md">{error}</Alert>}
            {!result ? (
              <div className="empty-state">
                <Text fw={600}>Your results will appear here</Text>
                <Text c="dimmed" size="sm">Choose a graph and run a Cypher query.</Text>
              </div>
            ) : (
              <Tabs value={tab} onChange={setTab} keepMounted={false}>
                <Tabs.List>
                  <Tabs.Tab value="table">Table</Tabs.Tab>
                  <Tabs.Tab value="graph">Graph ({result.graph.nodes.length} nodes, {result.graph.edges.length} edges)</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="table" pt="md">
                  {result.columns.length === 0 ? <Text c="dimmed">Query executed. No rows returned.</Text> : (
                    <div className="table-scroll">
                      <Table striped highlightOnHover withTableBorder>
                        <Table.Thead><Table.Tr>{result.columns.map((column, index) => <Table.Th key={`${column}-${index}`}>{column}</Table.Th>)}</Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {result.rows.map((row, rowIndex) => (
                            <Table.Tr key={rowIndex}>{row.map((value, columnIndex) => <Table.Td key={columnIndex}><code>{display(value)}</code></Table.Td>)}</Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                      {result.rows.length === 0 && <Text c="dimmed" p="md">No matching rows.</Text>}
                    </div>
                  )}
                </Tabs.Panel>
                <Tabs.Panel value="graph" pt="md">
                  {result.graph.nodes.length || result.graph.edges.length
                    ? <GraphView graph={result.graph} />
                    : <div className="empty-state"><Text c="dimmed">This result contains no vertices or edges. Try returning a node, edge, or path.</Text></div>}
                </Tabs.Panel>
              </Tabs>
            )}
          </Paper>
        </div>
        <Text c="dimmed" size="xs" mt="lg">Local development console · Apache AGE adapter</Text>
      </Container>
    </div>
  );
}
