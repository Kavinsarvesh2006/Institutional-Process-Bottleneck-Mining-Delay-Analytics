import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType, Position, ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowRight, GitFork, Info } from 'lucide-react';
import { useAnalysis, useApp, number, hours, severity } from '../api';
import { Guard, PageTitle, Panel, Badge } from '../components/ui';
import { Bars } from '../components/charts';
import { DetailDrawer } from './analytics';
import type { Analysis, Distribution } from '../types';
export default function ProcessMap() {
  const query = useAnalysis();
  return (
    <Guard query={query}>
      {(data) => (
        <ReactFlowProvider>
          <MapContent data={data} />
        </ReactFlowProvider>
      )}
    </Guard>
  );
}
function MapContent({ data }: { data: Analysis }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setCanvasSize({ width: rect.width, height: rect.height });
    });
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  const [frequency, setFrequency] = useState(0);
  const [ideal, setIdeal] = useState(false);
  const { settings, filters } = useApp();
  const [detail, setDetail] = useState<({ title: string; count: number } & Distribution) | null>(null);
  const graph = useMemo(() => {
    const order = [
      'Submission',
      'Staff Verification',
      'HOD Approval',
      'Office Processing',
      'Principal Approval',
      'Issued',
    ].filter((name) => data.graph.nodes.some((node) => node.id === name));
    data.graph.nodes.forEach((node) => {
      if (!order.includes(node.id) && node.id !== 'Student Correction') order.push(node.id);
    });
    const maxVolume = Math.max(...data.graph.nodes.map((n) => n.count), 1);
    const nodes: Node[] = data.graph.nodes.map((node, index) => {
      const column = order.includes(node.id) ? order.indexOf(node.id) : index;
      const extra = !order.includes(node.id);
      return {
        id: node.id,
        position: {
          x: extra ? Math.max(order.indexOf('Office Processing'), 1) * 235 : column * 235,
          y: extra ? 300 : 95 + (column % 2) * 22,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: { width: 175 + (node.count / maxVolume) * 20, borderTop: `3px solid ${severity(node.wait)}` },
        data: {
          label: (
            <div className="flow-label">
              <span>{node.id === 'Submission' ? 'START' : node.id === 'Issued' ? 'END' : 'ACTIVITY'}</span>
              <strong>{node.id}</strong>
              <div>
                <b>{number(node.count)}</b> events <i /> {hours(node.wait)} wait
              </div>
            </div>
          ),
        },
      };
    });
    const maximum = Math.max(...data.graph.edges.map((e) => e.count), 1);
    const edges: Edge[] = data.graph.edges
      .filter((e) => e.count >= (maximum * frequency) / 100)
      .map((edge) => ({
        id: edge.source + '→' + edge.target,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        label: `${number(edge.count)} · ${hours(edge.mean)}`,
        style: { stroke: severity(edge.mean), strokeWidth: 1 + (edge.count / maximum) * 4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: severity(edge.mean) },
        labelStyle: { fill: 'var(--text)', fontSize: 10 },
        labelBgStyle: { fill: 'var(--surface)', fillOpacity: 0.96 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 4,
      }));
    if (ideal) {
      const process = filters.process_type || data.variants.variants[0]?.process_type;
      const path = settings?.ideal_paths[process] ?? [];
      path.slice(1).forEach((target, index) => {
        if (nodes.some((n) => n.id === target) && nodes.some((n) => n.id === path[index]))
          edges.push({
            id: 'ideal' + index,
            source: path[index],
            target,
            type: 'smoothstep',
            style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6 5' },
            label: 'Ideal path',
            labelStyle: { fontSize: 9, fill: '#6366f1' },
            labelBgStyle: { fill: 'var(--surface)' },
            zIndex: 3,
          });
      });
    }
    return { nodes, edges };
  }, [data, frequency, ideal, settings, filters.process_type]);
  return (
    <>
      <PageTitle
        index="02"
        title="See the actual flow"
        description="Discover the paths hidden inside your event log."
      />
      <div className="map-toolbar">
        <div className="frequency-control">
          <GitFork size={17} />
          <label htmlFor="frequency">Minimum path frequency</label>
          <input
            id="frequency"
            type="range"
            min="0"
            max="100"
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
          />
          <b>{frequency}%</b>
        </div>
        <label className="check-label">
          <input type="checkbox" checked={ideal} onChange={(e) => setIdeal(e.target.checked)} />
          Overlay ideal path
        </label>
        <Badge>{graph.edges.filter((e) => !e.id.startsWith('ideal')).length} transitions</Badge>
      </div>
      <div className="process-canvas" ref={canvas}>
        {canvasSize.width > 0 && canvasSize.height > 0 && (
          <ReactFlow
            style={{ width: canvasSize.width, height: canvasSize.height }}
            nodes={graph.nodes}
            edges={graph.edges}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={1.8}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) => {
              const b = data.bottlenecks.find((b) => b.name === node.id);
              if (b) setDetail({ ...b, title: node.id });
            }}
            onEdgeClick={(_, edge) => {
              const e = data.graph.edges.find((e) => e.source === edge.source && e.target === edge.target);
              if (e) setDetail({ ...e, title: e.source + ' → ' + e.target });
            }}
          >
            <Background color="var(--map-dot)" gap={22} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => String(node.style?.borderTop?.toString().split(' ').pop() ?? '#3730a3')}
              maskColor="rgba(148,163,184,.1)"
            />
          </ReactFlow>
        )}
        <div className="map-label">
          DIRECTLY-FOLLOWS GRAPH <span>Click a step or transition to inspect</span>
        </div>
      </div>
      <div className="map-legend">
        <span>AVERAGE QUEUE TIME</span>
        {[
          { color: '#14b8a6', label: 'Under 12h' },
          { color: '#f59e0b', label: '12–24h' },
          { color: '#ea580c', label: '24–48h' },
          { color: '#dc2626', label: 'Over 48h' },
        ].map((item) => (
          <span key={item.color}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="legend-end">
          Thicker edge = more events <ArrowRight size={14} />
        </span>
      </div>
      <div className="two-col">
        <Panel title="How to read this map" eyebrow="FROM LOG TO PROCESS">
          <p className="body-copy">
            Each node is an observed activity. Connections show consecutive activities within the same
            request. Labels show transition volume and average waiting hours; queues belong to the next step.
          </p>
          <div className="method-note">
            <Info size={17} />
            <p>
              The frequency slider hides edges below a percentage of the busiest edge. It does not remove
              cases from other analytics.
            </p>
          </div>
        </Panel>
        <Panel
          title="What counts as the ideal path?"
          eyebrow={filters.process_type || 'BONAFIDE CERTIFICATE DEFAULT'}
        >
          <div className="path-chips">
            {(settings?.ideal_paths[filters.process_type || data.variants.variants[0]?.process_type] ?? []).map(
              (step, i) => (
                <span className="chip-pair" key={step}>
                  <span className="path-chip">{step}</span>
                  {i < 4 && <ArrowRight size={12} />}
                </span>
              ),
            )}
          </div>
          <p className="panel-note">
            Select one workflow for a precise comparison. Edit the ideal sequence in Data & settings.
          </p>
        </Panel>
      </div>
      {detail && (
        <DetailDrawer title={detail.title} onClose={() => setDetail(null)}>
          <div className="drawer-stats">
            <div>
              <small>MEAN QUEUE</small>
              <strong>{hours(detail.mean)}</strong>
            </div>
            <div>
              <small>P90 QUEUE</small>
              <strong>{hours(detail.p90)}</strong>
            </div>
          </div>
          <Badge>{number(detail.count)} observed transitions / events</Badge>
          <h4>Queue distribution · hours</h4>
          <Bars data={detail.histogram} nameKey="range" valueKey="count" unit="" />
          <div className="box-summary">
            {detail.box.map((n, i) => (
              <div key={i}>
                <small>{['Min', 'Q1', 'Median', 'Q3', 'Max'][i]}</small>
                <b>{number(n, 1)}</b>
              </div>
            ))}
          </div>
          {data.bottlenecks.find((b) => b.name === detail.title) && (
            <>
              <h4>Resources · mean queue hours</h4>
              <Bars
                horizontal
                data={data.bottlenecks.find((b) => b.name === detail.title)?.resources ?? []}
                nameKey="resource"
                valueKey="wait"
                unit="h"
              />
            </>
          )}
        </DetailDrawer>
      )}
    </>
  );
}
