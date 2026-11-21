import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
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
import { PageHeader } from "@/components/PageHeader";
import { severityColors, severityOrder } from "@/lib/severity";
import type { GraphNode as GNode, Severity } from "@/lib/types";

type NodeData = { label: string; nodeType: GNode["type"]; severity?: Severity; dimmed?: boolean };

const INK = "#141414";
const kindLabel: Record<GNode["type"], string> = { root: "Root domain", asset: "Host", finding: "Finding", fix: "Fix" };

function tone(severity?: Severity) {
  return severity ? severityColors[severity] : INK;
}

/** Each node is an index card: kind on the top rule, value typed below, severity on the edge band. */
function CardNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const color = tone(data.severity);
  const root = data.nodeType === "root";
  return (
    <div
      className={`min-w-[210px] border-[1.5px] px-3 py-2.5 text-sm transition-opacity duration-200 ${root ? "bg-ink text-bond" : "bg-bond text-ink"} ${data.dimmed ? "opacity-20" : "opacity-100"}`}
      style={{
        borderColor: selected ? INK : data.severity ? color : INK,
        borderTopWidth: data.severity ? 5 : 1.5,
        boxShadow: selected ? "0 0 0 2px #1F3A93" : "0 1px 2px rgba(74,52,16,0.25)",
      }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !rounded-none !border-0 !bg-ink" />
      <div className={`mb-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] ${root ? "text-bond/70" : "text-ink-soft"}`}>
        {kindLabel[data.nodeType]}
      </div>
      <div className="font-mono text-[14px] font-bold">{data.label}</div>
      {data.severity ? <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em]">{data.severity}</div> : null}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !rounded-none !border-0 !bg-ink" />
    </div>
  );
}

const nodeTypes = { custom: CardNode };

function layout(nodes: GNode[]): Node<NodeData>[] {
  const columns: Record<GNode["type"], GNode[]> = { root: [], asset: [], finding: [], fix: [] };
  nodes.forEach((n) => columns[n.type].push(n));
  const x: Record<GNode["type"], number> = { root: 0, asset: 300, finding: 620, fix: 960 };
  return nodes.map((n) => {
    const col = columns[n.type];
    const idx = col.indexOf(n);
    const y = idx * 96 - ((col.length - 1) * 96) / 2 + 220;
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
        if (!visited.has(next)) {
          visited.add(next);
          q.push(next);
        }
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
  // Size the board to the whole graph at a legible zoom so nothing opens clipped; the page scrolls, not the board.
  const boardHeight = useMemo(() => {
    const tallest = Math.max(1, ...["root", "asset", "finding", "fix"].map((t) => (data?.nodes ?? []).filter((n) => n.type === t).length));
    return Math.max(520, Math.round(((tallest - 1) * 96 + 90) * 0.86 + 60));
  }, [data]);
  const initialEdges: Edge[] = useMemo(
    () =>
      (data?.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "rgba(20,20,20,0.45)", strokeWidth: 1.5 },
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
      return { ...e, style: { stroke: onPath ? INK : "rgba(20,20,20,0.1)", strokeWidth: onPath ? 2.5 : 1 } };
    });
  }, [initialEdges, highlight]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node<NodeData>) => {
      setSelected(data?.nodes.find((n) => n.id === node.id) || null);
      setHighlight(connectedSet(node.id, initialEdges));
    },
    [data, initialEdges],
  );

  const clear = useCallback(() => {
    setSelected(null);
    setHighlight(null);
  }, []);

  if (isLoading) return <PageSkeleton />;
  if (error || !data)
    return (
      <div className="border-2 border-severity-critical p-6 text-sm">
        <div className="font-semibold text-severity-critical">Couldn’t load the attack path graph.</div>
        <p className="mt-1 text-ink-soft">Reload the page. Findings and assets are still available in their own tabs.</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attack paths"
        description="How each host connects to its findings and their fixes. Select a card to trace its path; select the background to clear."
      />

      <p className="inline-flex border-[1.5px] border-ink px-3 py-1.5 text-[13px] font-semibold">
        Potential exposure paths, not confirmed attack chains.
      </p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden border border-ink/30 bg-bond" style={{ height: boardHeight }}>
          <ReactFlow
            zoomOnScroll={false}
            preventScrolling={false}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={clear}
            fitView
            fitViewOptions={{ padding: 0.04, maxZoom: 1 }}
            minZoom={0.2}
          >
            <Background variant={BackgroundVariant.Lines} color="rgba(31,58,147,0.08)" gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="space-y-5">
          <section className="border border-ink/25 p-4">
            <h2 className="field-label border-b border-ink/20 pb-2 !text-ink">Legend</h2>
            <ul className="mt-3 space-y-2 text-[13px]">
              {severityOrder.map((s) => (
                <li key={s} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-6" style={{ background: severityColors[s] }} aria-hidden="true" />
                  <span className="capitalize">{s}</span>
                </li>
              ))}
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-6 bg-ink" aria-hidden="true" />
                Root domain, host, or fix
              </li>
            </ul>
          </section>
          <DetailPanel title={selected?.label ?? ""} open={Boolean(selected)} onClose={clear}>
            {selected ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="field-label">Kind</dt>
                  <dd className="mt-0.5">{kindLabel[selected.type]}</dd>
                </div>
                {selected.severity ? (
                  <div>
                    <dt className="field-label mb-1">Severity</dt>
                    <dd>
                      <SeverityBadge severity={selected.severity} />
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </DetailPanel>
        </div>
      </div>
    </div>
  );
}
