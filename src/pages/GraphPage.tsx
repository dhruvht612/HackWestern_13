import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useGraph } from "@/hooks/useGraph";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { DetailPanel } from "@/components/DetailPanel";
import { SeverityBadge } from "@/components/SeverityBadge";
import { severityColors } from "@/lib/severity";
import type { GraphNode as GNode, Severity } from "@/lib/types";

type NodeData = { label: string; nodeType: GNode["type"]; severity?: Severity; dimmed?: boolean };

function tone(severity?: Severity) {
  if (!severity) return "#22D3EE";
  return severityColors[severity];
}

function BaseNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const color = tone(data.severity);
  return (
    <div
      className={`min-w-[180px] rounded-lg border bg-panel px-3 py-2 text-xs shadow-panel transition ${data.dimmed ? "opacity-25" : "opacity-100"}`}
      style={{ borderColor: selected ? "#22D3EE" : color, boxShadow: selected ? `0 0 0 1px ${color}` : undefined }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{data.nodeType}</div>
      <div className="font-medium text-slate-100">{data.label}</div>
      {data.severity ? <div className="mt-1" style={{ color }}>{data.severity}</div> : null}
      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </div>
  );
}

const nodeTypes = { custom: BaseNode };

function layout(nodes: GNode[]): Node<NodeData>[] {
  const columns: Record<GNode["type"], GNode[]> = { root: [], asset: [], finding: [], fix: [] };
  nodes.forEach((n) => columns[n.type].push(n));
  const x: Record<GNode["type"], number> = { root: 0, asset: 320, finding: 660, fix: 1000 };
  return nodes.map((n) => {
    const col = columns[n.type];
    const idx = col.indexOf(n);
    const y = idx * 110 - ((col.length - 1) * 110) / 2 + 220;
    return {
      id: n.id,
      type: "custom",
      position: { x: x[n.type], y },
      data: { label: n.label, nodeType: n.type, severity: n.severity },
    };
  });
}

function connectedSet(nodeId: string, edges: Edge[]) {
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  edges.forEach((e) => {
    out.set(e.source, [...(out.get(e.source) || []), e.target]);
    inc.set(e.target, [...(inc.get(e.target) || []), e.source]);
  });
  const visited = new Set<string>([nodeId]);
  const walk = (start: string, map: Map<string, string[]>) => {
    const q = [start];
    while (q.length) {
      const cur = q.shift()!;
      for (const next of map.get(cur) || []) {
        if (!visited.has(next)) { visited.add(next); q.push(next); }
      }
    }
  };
  walk(nodeId, out);
  walk(nodeId, inc);
  return visited;
}

export function GraphPage() {
  const { data, isLoading, error } = useGraph(DEMO_SCAN_ID);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [highlight, setHighlight] = useState<Set<string> | null>(null);

  const initialNodes = useMemo(() => (data ? layout(data.nodes) : []), [data]);
  const initialEdges: Edge[] = useMemo(
    () =>
      (data?.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "#334155", strokeWidth: 1.5 },
      })),
    [data],
  );

  const nodes = useMemo(() => {
    if (!highlight) return initialNodes;
    return initialNodes.map((n) => ({ ...n, data: { ...n.data, dimmed: !highlight.has(n.id) } }));
  }, [initialNodes, highlight]);

  const edges = useMemo(() => {
    if (!highlight) return initialEdges;
    return initialEdges.map((e) => {
      const onPath = highlight.has(e.source) && highlight.has(e.target);
      return { ...e, style: { stroke: onPath ? "#22D3EE" : "#1F2A37", strokeWidth: onPath ? 2 : 1 } };
    });
  }, [initialEdges, highlight]);

  const onNodeClick = useCallback((_: unknown, node: Node<NodeData>) => {
    const raw = data?.nodes.find((n) => n.id === node.id) || null;
    setSelected(raw);
    setHighlight(connectedSet(node.id, initialEdges));
  }, [data, initialEdges]);

  const onPaneClick = useCallback(() => { setSelected(null); setHighlight(null); }, []);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <div className="panel p-6 text-severity-critical">Failed to load graph.</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Attack Paths</h1>
        <p className="mt-1 text-sm text-slate-400">Potential exposure relationships between assets, findings, and fixes.</p>
      </div>

      <div className="rounded-lg border border-severity-medium/30 bg-severity-medium/10 px-4 py-3 text-sm text-severity-medium">
        Potential exposure paths, not confirmed attack chains.
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="panel h-[70vh] min-h-[520px] overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
          >
            <Background color="#1F2A37" gap={20} />
            <MiniMap
              nodeColor={(n) => tone((n.data as NodeData).severity)}
              maskColor="rgba(11,15,20,0.75)"
            />
            <Controls />
          </ReactFlow>
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <div className="text-sm font-semibold text-slate-200">Legend</div>
            <div className="mt-3 space-y-2 text-xs text-slate-300">
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: severityColors[s] }} />
                  <span className="capitalize">{s}</span>
                </div>
              ))}
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> root/fix</div>
            </div>
          </div>
          <DetailPanel title="Node detail" open={Boolean(selected)} onClose={() => { setSelected(null); setHighlight(null); }}>
            {selected ? (
              <div className="space-y-3 text-sm">
                <div><div className="text-slate-400">Type</div><div className="capitalize text-slate-200">{selected.type}</div></div>
                <div><div className="text-slate-400">Label</div><div className="mono text-slate-200">{selected.label}</div></div>
                {selected.severity ? <div><div className="mb-1 text-slate-400">Severity</div><SeverityBadge severity={selected.severity} /></div> : null}
                <p className="text-xs text-slate-500">Click a node to highlight its connected exposure path. Click the canvas to clear.</p>
              </div>
            ) : null}
          </DetailPanel>
        </div>
      </div>
    </div>
  );
}
