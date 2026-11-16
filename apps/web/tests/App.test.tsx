import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Cypher query" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock('../src/GraphView', () => ({ default: () => <div aria-label="Query result graph" /> }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

it('loads a graph and shows the result of a submitted query', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ graphs: ['graph_lab'] }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        columns: ['value'], rows: [[1]], graph: { nodes: [], edges: [] }, durationMs: 3,
      }),
    });

  const user = userEvent.setup();
  render(<MantineProvider><App /></MantineProvider>);
  expect(await screen.findByRole('combobox', { name: 'Graph' })).toHaveValue('graph_lab');

  const editor = screen.getByRole('textbox', { name: 'Cypher query' });
  await user.clear(editor);
  await user.type(editor, 'RETURN 1');
  await user.click(screen.getByRole('button', { name: 'Run query' }));

  expect(await screen.findByText('1')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith('/api/query', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ graph: 'graph_lab', cypher: 'RETURN 1' }),
  }));
});

it('reports API connection failures', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  render(<MantineProvider><App /></MantineProvider>);
  expect(await screen.findByText('offline')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run query' })).toBeDisabled();
});
