import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

export type GraphData = {
  nodes: { id: string; label: string; properties: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; label: string; properties: Record<string, unknown> }[];
};

export default function GraphView({ graph }: { graph: GraphData }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const known = new Set(graph.nodes.map((node) => node.id));
    const missing = graph.edges.flatMap((edge) => [edge.source, edge.target])
      .filter((id) => !known.has(id) && known.add(id));
    const elements = [
      ...graph.nodes.map((node) => ({ data: {
        id: node.id,
        caption: String(node.properties.name ?? node.label),
        detail: `${node.label}\n${JSON.stringify(node.properties)}`,
      } })),
      ...missing.map((id) => ({ data: { id, caption: id, detail: id } })),
      ...graph.edges.map((edge) => ({ data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        caption: edge.label,
        detail: `${edge.label}\n${JSON.stringify(edge.properties)}`,
      } })),
    ];
    const instance = cytoscape({
      container: container.current,
      elements,
      layout: { name: 'cose', animate: false, padding: 36 },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#6ea8fe',
            'border-color': '#d8e7ff',
            'border-width': 1.5,
            color: '#e8efff',
            label: 'data(caption)',
            'font-size': 11,
            'text-valign': 'bottom',
            'text-margin-y': 9,
            'text-outline-color': '#101827',
            'text-outline-width': 2,
            width: 40,
            height: 40,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#8291ab',
            'target-arrow-color': '#8291ab',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            color: '#b8c7df',
            label: 'data(caption)',
            'font-size': 9,
            'text-outline-color': '#101827',
            'text-outline-width': 2,
          },
        },
      ],
    });
    instance.on('tap', 'node, edge', (event) => {
      const detail = event.target.data('detail');
      container.current?.setAttribute('title', detail);
    });
    return () => instance.destroy();
  }, [graph]);

  return <div className="graph-canvas" ref={container} aria-label="Query result graph" />;
}
