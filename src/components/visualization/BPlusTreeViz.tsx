'use client';

import React, { useMemo } from 'react';
import { TreeSnapshot } from '@/engine/types';

interface Props {
    snapshot: TreeSnapshot | undefined;
    highlightedNodeId?: string;
    newNodeId?: string;
    deletedNodeId?: string;
    tableName?: string;
}

// Layout parameters
const NODE_HEIGHT = 36;
const KEY_WIDTH = 36;
const NODE_MIN_W = 70;
const V_GAP = 70;  // vertical gap between levels
const H_PAD = 20;  // horizontal padding within node

interface LayoutNode {
    id: string;
    x: number;
    y: number;
    width: number;
    keys: (string | number)[];
    isLeaf: boolean;
    nextLeaf: string | null;
}

function useTreeLayout(snapshot: TreeSnapshot | undefined): { nodes: LayoutNode[]; edges: { x1: number; y1: number; x2: number; y2: number }[]; width: number; height: number } {
    return useMemo(() => {
        if (!snapshot || !snapshot.nodes[snapshot.rootId]) {
            return { nodes: [], edges: [], width: 300, height: 100 };
        }

        const { nodes: raw, rootId } = snapshot;

        // BFS to get level ordering
        const levels: string[][] = [];
        let frontier = [rootId];
        const visited = new Set<string>();

        while (frontier.length > 0) {
            levels.push(frontier);
            const next: string[] = [];
            for (const id of frontier) {
                if (visited.has(id)) continue;
                visited.add(id);
                const n = raw[id];
                if (n && !n.isLeaf && n.children) {
                    for (const cid of n.children) {
                        if (raw[cid] && !visited.has(cid)) next.push(cid);
                    }
                }
            }
            frontier = next;
        }

        // Calculate widths
        const nodeWidth = (id: string) => {
            const n = raw[id];
            if (!n) return NODE_MIN_W;
            return Math.max(NODE_MIN_W, n.keys.length * KEY_WIDTH + H_PAD * 2);
        };

        // Position nodes bottom-up
        const positions: Record<string, { x: number; y: number; width: number }> = {};
        const H_GAP = 24;

        // Position leaf level first
        const leafLevel = levels[levels.length - 1];
        let cursor = 0;
        for (const id of leafLevel) {
            const w = nodeWidth(id);
            positions[id] = { x: cursor + w / 2, y: (levels.length - 1) * (NODE_HEIGHT + V_GAP), width: w };
            cursor += w + H_GAP;
        }

        // Position internal levels above
        for (let lvl = levels.length - 2; lvl >= 0; lvl--) {
            for (const id of levels[lvl]) {
                const n = raw[id];
                const children = n?.children ?? [];
                let minX = Infinity, maxX = -Infinity;
                for (const cid of children) {
                    if (positions[cid]) {
                        minX = Math.min(minX, positions[cid].x);
                        maxX = Math.max(maxX, positions[cid].x);
                    }
                }
                const cx = children.length > 0 && isFinite(minX) ? (minX + maxX) / 2 : cursor;
                const w = nodeWidth(id);
                positions[id] = { x: cx, y: lvl * (NODE_HEIGHT + V_GAP), width: w };
            }
        }

        // Build edges
        const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
        for (const id of Object.keys(raw)) {
            const n = raw[id];
            if (!n.isLeaf && n.children) {
                const parentPos = positions[id];
                if (!parentPos) continue;
                for (const cid of n.children) {
                    const childPos = positions[cid];
                    if (!childPos) continue;
                    edges.push({
                        x1: parentPos.x,
                        y1: parentPos.y + NODE_HEIGHT,
                        x2: childPos.x,
                        y2: childPos.y,
                    });
                }
            }
        }

        // Build final layout nodes
        const layoutNodes: LayoutNode[] = Object.values(raw).map(n => ({
            id: n.id,
            x: (positions[n.id]?.x ?? 0) - (positions[n.id]?.width ?? NODE_MIN_W) / 2,
            y: positions[n.id]?.y ?? 0,
            width: positions[n.id]?.width ?? NODE_MIN_W,
            keys: n.keys,
            isLeaf: n.isLeaf,
            nextLeaf: n.nextLeaf,
        }));

        const maxX = Math.max(...layoutNodes.map(n => n.x + n.width), 300);
        const maxY = Math.max(...layoutNodes.map(n => n.y + NODE_HEIGHT), 100);

        return { nodes: layoutNodes, edges, width: maxX + 40, height: maxY + 40 };
    }, [snapshot]);
}

export function BPlusTreeViz({ snapshot, highlightedNodeId, newNodeId, deletedNodeId }: Props) {
    const { nodes, edges, width, height } = useTreeLayout(snapshot);

    if (!snapshot || nodes.length === 0) {
        return (
            <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-icon">🌳</div>
                <div className="empty-title">Empty B+Tree</div>
                <div className="empty-sub">Execute a query to see the tree structure</div>
            </div>
        );
    }

    return (
        <svg
            className="btree-svg"
            viewBox={`-20 -20 ${width + 40} ${height + 40}`}
            style={{ overflow: 'visible' }}
        >
            <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="var(--border-bright)" />
                </marker>
                <filter id="glow-cyan">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-violet">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => (
                <path
                    key={i}
                    className="btree-edge"
                    d={`M ${e.x1} ${e.y1} C ${e.x1} ${(e.y1 + e.y2) / 2}, ${e.x2} ${(e.y1 + e.y2) / 2}, ${e.x2} ${e.y2}`}
                    markerEnd="url(#arrowhead)"
                />
            ))}

            {/* Leaf chain links */}
            {nodes.filter(n => n.isLeaf && n.nextLeaf).map(n => {
                const sibling = nodes.find(s => s.id === n.nextLeaf);
                if (!sibling) return null;
                const x1 = n.x + n.width;
                const y1 = n.y + NODE_HEIGHT / 2;
                const x2 = sibling.x;
                const y2 = sibling.y + NODE_HEIGHT / 2;
                return (
                    <path key={`chain-${n.id}`} className="leaf-chain-link"
                        d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1 + 14}, ${(x1 + x2) / 2} ${y2 + 14}, ${x2} ${y2}`} />
                );
            })}

            {/* Nodes */}
            {nodes.map(n => {
                const isHighlighted = n.id === highlightedNodeId;
                const isSplit = n.id === newNodeId;
                const isDeleted = n.id === deletedNodeId;

                let rectClass = 'btree-node-rect default';
                if (isHighlighted) rectClass = 'btree-node-rect highlighted';
                else if (isSplit) rectClass = 'btree-node-rect split';
                else if (isDeleted) rectClass = 'btree-node-rect deleted';

                const f = isHighlighted ? 'url(#glow-cyan)' : isSplit ? 'url(#glow-violet)' : undefined;

                // Divide node into key cells
                const cellW = n.width / Math.max(n.keys.length, 1);

                return (
                    <g key={n.id} style={{ animation: isSplit ? 'nodeAppear 0.35s cubic-bezier(0.34,1.56,0.64,1) both' : undefined }}>
                        {/* Node background */}
                        <rect
                            x={n.x} y={n.y}
                            width={n.width} height={NODE_HEIGHT}
                            className={rectClass}
                            rx={6} ry={6}
                            filter={f}
                        />

                        {/* Leaf / Internal indicator */}
                        <text
                            x={n.x + 4} y={n.y + 8}
                            className="btree-type-badge"
                            fill={n.isLeaf ? 'var(--accent-cyan)' : 'var(--accent-violet)'}
                            opacity={0.7}
                        >
                            {n.isLeaf ? 'L' : 'I'}
                        </text>

                        {/* Key dividers and labels */}
                        {n.keys.map((key, ki) => (
                            <g key={ki}>
                                {ki > 0 && (
                                    <line
                                        x1={n.x + ki * cellW} y1={n.y + 4}
                                        x2={n.x + ki * cellW} y2={n.y + NODE_HEIGHT - 4}
                                        stroke="var(--border-bright)" strokeWidth={1}
                                    />
                                )}
                                <text
                                    x={n.x + (ki + 0.5) * cellW}
                                    y={n.y + NODE_HEIGHT / 2}
                                    className={n.isLeaf ? 'btree-leaf-text' : 'btree-key-text'}
                                    fill={isHighlighted ? 'var(--accent-cyan)' : isSplit ? 'var(--accent-violet)' : 'var(--text-primary)'}
                                >
                                    {String(key).length > 5 ? String(key).slice(0, 5) + '…' : String(key)}
                                </text>
                            </g>
                        ))}

                        {/* Empty node */}
                        {n.keys.length === 0 && (
                            <text x={n.x + n.width / 2} y={n.y + NODE_HEIGHT / 2} className="btree-key-text" fill="var(--text-muted)" fontSize={10}>∅</text>
                        )}

                        {/* Node ID tooltip ghost */}
                        <title>{`Node: ${n.id} | ${n.isLeaf ? 'Leaf' : 'Internal'} | Keys: [${n.keys.join(', ')}]`}</title>
                    </g>
                );
            })}
        </svg>
    );
}
