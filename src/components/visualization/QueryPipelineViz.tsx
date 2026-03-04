'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { PipelineStage, StageName, Row } from '@/engine/types';

interface Props {
    stages: PipelineStage[];
    activeStageName?: StageName;
    sourceTableNames: string[];
    sql?: string;
}

// Stage color config
const STAGE_CONFIG: Record<StageName, { bg: string; border: string; cellColor: string; label: string; icon: string }> = {
    'FROM': { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6', cellColor: '#8b5cf6', label: 'FROM', icon: '🗄️' },
    'JOIN': { bg: 'rgba(236,72,153,0.12)', border: '#ec4899', cellColor: '#ec4899', label: 'JOIN', icon: '🔗' },
    'WHERE': { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', cellColor: '#ef4444', label: 'WHERE', icon: '🔍' },
    'GROUP BY': { bg: 'rgba(20,184,166,0.12)', border: '#14b8a6', cellColor: '#14b8a6', label: 'GROUP BY', icon: '📊' },
    'HAVING': { bg: 'rgba(99,102,241,0.12)', border: '#6366f1', cellColor: '#6366f1', label: 'HAVING', icon: '🔧' },
    'ORDER BY': { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', cellColor: '#3b82f6', label: 'ORDER BY', icon: '↕️' },
    'LIMIT': { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', cellColor: '#f59e0b', label: 'LIMIT', icon: '✂️' },
    'SELECT': { bg: 'rgba(107,114,128,0.12)', border: '#6b7280', cellColor: '#6b7280', label: 'SELECT', icon: '📤' },
};

// ── Mini grid (pipeline flow diagram representation) ──────────────────────────
function MiniGrid({ rowCount, cols, color, active }: { rowCount: number; cols: number; color: string; active: boolean }) {
    const displayRows = Math.min(rowCount, 8);
    const displayCols = Math.min(cols, 5);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: active ? 1 : 0.7, transition: 'opacity 0.3s' }}>
            {Array.from({ length: displayRows }).map((_, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: displayCols }).map((_, ci) => (
                        <div key={ci} style={{
                            width: 14, height: 11, borderRadius: 2,
                            background: active ? `${color}dd` : `${color}66`,
                            border: `1px solid ${color}44`,
                            transition: 'background 0.4s ease',
                            boxShadow: active ? `0 0 4px ${color}66` : 'none',
                        }} />
                    ))}
                </div>
            ))}
            {rowCount > 8 && <div style={{ fontSize: 9, color: '#94a3b8', paddingLeft: 1 }}>+{rowCount - 8} more</div>}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '4px 10px',
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 700,
    position: 'sticky',
    top: 0,
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
    zIndex: 1,
};

const tdStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
};

// ── Scrollable data table ────────────────────────────────────────────────────
function DataTable({ rows, columns, accentColor, title, subtitle, highlightedRowIdx, statusForRow }: {
    rows: Row[];
    columns: string[];
    accentColor: string;
    title?: string;
    subtitle?: string;
    highlightedRowIdx?: number;
    statusForRow?: (idx: number) => 'passed' | 'rejected' | 'pending';
}) {
    if (columns.length === 0 && rows.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, minHeight: 0 }}>
            {title && (
                <div style={{
                    padding: '5px 10px',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: accentColor,
                    background: `${accentColor}11`,
                    borderBottom: `1px solid ${accentColor}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                }}>
                    <span>{title}</span>
                    {subtitle && <span style={{ fontSize: 9, opacity: 0.7, textTransform: 'none', fontWeight: 400 }}>{subtitle}</span>}
                </div>
            )}
            {/* Scroll container: both X and Y scroll */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <table style={{
                    borderCollapse: 'collapse',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    width: '100%',
                    minWidth: 'max-content',
                }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, color: 'var(--text-muted)', width: 32, textAlign: 'center' }}>#</th>
                            {columns.map((c, i) => (
                                <th key={`${c}-${i}`} style={{ ...thStyle, color: accentColor }}>{c}</th>
                            ))}
                            {statusForRow && <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>Status</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (statusForRow ? 2 : 1)} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                                    Empty
                                </td>
                            </tr>
                        ) : rows.map((row, i) => {
                            const isHi = highlightedRowIdx === i;
                            const status = statusForRow ? statusForRow(i) : undefined;
                            const bg = isHi ? `${accentColor}33` :
                                status === 'rejected' ? 'rgba(239,68,68,0.05)' :
                                    status === 'passed' ? 'rgba(34,197,94,0.05)' :
                                        i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
                            const opacity = (status === 'rejected' && !isHi) ? 0.4 : 1;
                            return (
                                <tr key={i} style={{ background: bg, opacity, transition: 'all 0.2s', position: 'relative' }}>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: isHi ? accentColor : 'var(--text-muted)', fontSize: 10 }}>{i + 1}</td>
                                    {columns.map((c, ci) => (
                                        <td key={`${c}-${ci}`} style={{ ...tdStyle, color: row[c] === null ? 'var(--text-muted)' : (isHi ? '#fff' : `${accentColor}cc`) }}>
                                            {row[c] === null || row[c] === undefined
                                                ? <em style={{ fontStyle: 'italic', opacity: 0.6 }}>NULL</em>
                                                : String(row[c])}
                                        </td>
                                    ))}
                                    {status && (
                                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12 }}>
                                            {status === 'passed' ? '✅' : status === 'rejected' ? '❌' : '⏳'}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={{
                padding: '3px 10px', fontSize: 9, color: 'var(--text-muted)',
                borderTop: `1px solid ${accentColor}22`, flexShrink: 0,
                fontFamily: 'var(--font-mono)',
            }}>
                {rows.length} row{rows.length !== 1 ? 's' : ''} · {columns.length} col{columns.length !== 1 ? 's' : ''}
            </div>
        </div>
    );
}

// ── JOIN Evaluation Animation View ─────────────────────────────────────────────
function AnimatedJoinView({ stage, isActive }: { stage: PipelineStage; isActive: boolean }) {
    const pairs = stage.joinPairs ?? [];
    const cfg = STAGE_CONFIG['JOIN'];
    const leftCols = stage.leftColumns ?? [];
    const rightCols = stage.rightColumns ?? [];
    const joinedCols = stage.columns;

    const [currentIndex, setCurrentIndex] = useState(0);

    const speedOptions = [0.25, 0.5, 1, 2, 5];
    const [speedMultiplier, setSpeedMultiplier] = useState(2);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (!isActive) return;
        setCurrentIndex(0);
        setIsPlaying(false);
    }, [stage, isActive]);

    useEffect(() => {
        if (!isPlaying || currentIndex >= pairs.length) return;
        const tickRate = 800 / speedMultiplier;
        const timer = setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
        }, tickRate);
        return () => clearTimeout(timer);
    }, [isPlaying, currentIndex, pairs.length, speedMultiplier]);

    // Derived states for tables
    const leftRows = stage.leftRows ?? [];
    const rightRows = stage.rightRows ?? [];
    const resultRows = pairs.slice(0, currentIndex).filter(p => !!p.resultRow).map(p => p.resultRow!);

    const currentPair = pairs[currentIndex] ?? pairs[pairs.length - 1]; // lock at last pair when done
    const isDone = currentIndex >= pairs.length;

    // We want to highlight the left and right rows currently being evaluated
    const activeLeftIdx = !isDone && currentPair ? leftRows.indexOf(currentPair.leftRow) : -1;
    const activeRightIdx = !isDone && currentPair && currentPair.rightRow ? rightRows.indexOf(currentPair.rightRow) : -1;

    // Status logic for right table scanning
    const rightStatus = (idx: number) => {
        if (isDone) return 'pending'; // Don't dim right rows after finish
        if (activeLeftIdx === -1) return 'pending';
        // Has this right row been checked against CURRENT left row previously?
        const checkedPairsForLeft = pairs.slice(0, currentIndex).filter(p => p.leftRow === leftRows[activeLeftIdx]);
        if (checkedPairsForLeft.some(p => p.rightRow === rightRows[idx])) {
            return checkedPairsForLeft.find(p => p.rightRow === rightRows[idx])?.matched ? 'passed' : 'rejected';
        }
        return idx === activeRightIdx ? 'pending' : 'pending';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Header / Controls */}
            <div style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: cfg.border,
                background: `${cfg.cellColor}11`,
                borderBottom: `1px solid ${cfg.border}33`,
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <span>{cfg.icon} JOIN Evaluation</span>
                <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', fontFamily: 'var(--font-mono)', opacity: 0.8, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>
                    {stage.clauseText}
                </span>

                {/* Sub-controls */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 9, opacity: 0.8, marginRight: 4 }}>Compare {Math.min(currentIndex, pairs.length)} / {pairs.length}</div>

                    <button
                        onClick={() => setCurrentIndex(0)}
                        disabled={currentIndex === 0}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: currentIndex === 0 ? 'default' : 'pointer', fontSize: 10 }}
                    >
                        ⏮ Restart
                    </button>

                    <button
                        onClick={() => { setIsPlaying(false); setCurrentIndex(prev => Math.max(0, prev - 1)); }}
                        disabled={currentIndex === 0}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: currentIndex === 0 ? 'default' : 'pointer', fontSize: 10 }}
                    >
                        ◀ Prev
                    </button>
                    <button
                        onClick={() => { setIsPlaying(false); setCurrentIndex(prev => Math.min(pairs.length, prev + 1)); }}
                        disabled={isDone}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: isDone ? 'default' : 'pointer', fontSize: 10 }}
                    >
                        Next ▶
                    </button>

                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        style={{ background: isPlaying ? 'rgba(239,68,68,0.2)' : 'var(--bg-elevated)', border: `1px solid ${isPlaying ? '#ef4444' : 'var(--border)'}`, color: 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10, minWidth: 60 }}
                    >
                        {isPlaying ? '⏸ Stop Auto' : '▶ Auto Run'}
                    </button>

                    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        {speedOptions.map(m => (
                            <button
                                key={m}
                                onClick={() => setSpeedMultiplier(m)}
                                style={{
                                    background: speedMultiplier === m ? cfg.border : 'transparent',
                                    color: speedMultiplier === m ? '#fff' : 'var(--text-muted)',
                                    border: 'none', padding: '2px 6px', fontSize: 9, cursor: 'pointer'
                                }}
                            >
                                {m}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Three-panel body */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr minmax(140px, auto) 1fr 40px 1.2fr',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.1)',
            }}>
                {/* Left table */}
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${cfg.border}33`, overflow: 'hidden' }}>
                    <DataTable
                        rows={leftRows}
                        columns={leftCols}
                        accentColor='#8b5cf6'
                        title={`📥 ${stage.leftTableName ?? 'Left Table'}`}
                        highlightedRowIdx={activeLeftIdx}
                    />
                </div>

                {/* Join evaluator middle */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px',
                    borderRight: `1px solid ${cfg.border}33`, background: `${cfg.cellColor}08`
                }}>
                    <div style={{ fontSize: 10, color: cfg.border, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 'auto' }}>
                        {stage.joinType ?? 'INNER'} JOIN
                    </div>

                    {!isDone && currentPair ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
                            <div style={{ fontSize: 20, animation: 'bounce 1s infinite' }}>⚖️</div>
                            <div style={{ fontSize: 10, color: 'var(--text-primary)', textAlign: 'center' }}>Evaluating Condition</div>
                            <div style={{ background: 'var(--bg-surface)', border: `1px solid ${currentPair.matched ? '#22c55e' : '#ef4444'}`, borderRadius: 4, padding: '4px 8px', width: '100%', textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', transition: 'border-color 0.3s' }}>
                                {currentPair.matched ? '✅ MATCH' : '❌ NO MATCH'}
                            </div>
                        </div>
                    ) : isDone ? (
                        <div style={{ margin: 'auto', fontSize: 11, color: 'var(--text-primary)', opacity: 0.6, textAlign: 'center' }}>
                            Evaluation<br />Complete
                        </div>
                    ) : null}

                    <div style={{ marginTop: 'auto', fontSize: 20, color: cfg.border, opacity: 0.8 }}>⟶</div>
                </div>

                {/* Right table */}
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${cfg.border}33`, overflow: 'hidden' }}>
                    <DataTable
                        rows={rightRows}
                        columns={rightCols}
                        accentColor='#ec4899'
                        title={`📥 ${stage.rightTableName ?? 'Right Table'}`}
                        highlightedRowIdx={activeRightIdx}
                        statusForRow={rightStatus}
                    />
                </div>

                {/* Arrow to result */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '0 8px', color: cfg.border, fontSize: 18, borderRight: `1px solid ${cfg.border}33`,
                }}>
                    ⟶
                </div>

                {/* Combined result */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <DataTable
                        rows={resultRows}
                        columns={joinedCols}
                        accentColor={cfg.border}
                        title={`🔗 Combined Result`}
                        subtitle={`${resultRows.length} rows`}
                    />
                </div>
            </div>
        </div>
    );
}

// ── WHERE / HAVING Evaluation Animation View ──────────────────────────────────
function AnimatedWhereView({ stage, isActive }: { stage: PipelineStage; isActive: boolean }) {
    const evals = stage.whereEvals ?? [];
    const cfg = STAGE_CONFIG[stage.name];
    const cols = stage.columns;

    const [currentIndex, setCurrentIndex] = useState(0);

    const speedOptions = [0.25, 0.5, 1, 2, 5];
    const [speedMultiplier, setSpeedMultiplier] = useState(2);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (!isActive) return;
        setCurrentIndex(0);
        setIsPlaying(false);
    }, [stage, isActive]);

    useEffect(() => {
        if (!isPlaying || currentIndex >= evals.length) return;
        const tickRate = 800 / speedMultiplier;
        const timer = setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
        }, tickRate);
        return () => clearTimeout(timer);
    }, [isPlaying, currentIndex, evals.length, speedMultiplier]);

    const isDone = currentIndex >= evals.length;
    const currentEval = evals[currentIndex] ?? evals[evals.length - 1];

    // Status for left table
    const leftStatus = (idx: number) => {
        if (idx < currentIndex) return evals[idx].passed ? 'passed' : 'rejected';
        if (idx === currentIndex && !isDone) return 'pending';
        return 'pending';
    };

    const sourceRows = evals.map(e => e.row);
    const passedRows = evals.slice(0, currentIndex).filter(e => e.passed).map(e => e.row);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Header */}
            <div style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: cfg.border,
                background: `${cfg.cellColor}11`,
                borderBottom: `1px solid ${cfg.border}33`,
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <span>{cfg.icon} {stage.name} Evaluation</span>
                <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', fontFamily: 'var(--font-mono)', opacity: 0.8, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>
                    {stage.clauseText}
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 9, opacity: 0.8, marginRight: 4 }}>Eval {Math.min(currentIndex, evals.length)} / {evals.length}</div>

                    <button
                        onClick={() => setCurrentIndex(0)}
                        disabled={currentIndex === 0}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: currentIndex === 0 ? 'default' : 'pointer', fontSize: 10 }}
                    >
                        ⏮ Restart
                    </button>

                    <button
                        onClick={() => { setIsPlaying(false); setCurrentIndex(prev => Math.max(0, prev - 1)); }}
                        disabled={currentIndex === 0}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: currentIndex === 0 ? 'default' : 'pointer', fontSize: 10 }}
                    >
                        ◀ Prev
                    </button>
                    <button
                        onClick={() => { setIsPlaying(false); setCurrentIndex(prev => Math.min(evals.length, prev + 1)); }}
                        disabled={isDone}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: isDone ? 'default' : 'pointer', fontSize: 10 }}
                    >
                        Next ▶
                    </button>

                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        style={{ background: isPlaying ? 'rgba(239,68,68,0.2)' : 'var(--bg-elevated)', border: `1px solid ${isPlaying ? '#ef4444' : 'var(--border)'}`, color: 'var(--text-primary)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10, minWidth: 60 }}
                    >
                        {isPlaying ? '⏸ Stop Auto' : '▶ Auto Run'}
                    </button>

                    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        {speedOptions.map(m => (
                            <button
                                key={m}
                                onClick={() => setSpeedMultiplier(m)}
                                style={{
                                    background: speedMultiplier === m ? cfg.border : 'transparent',
                                    color: speedMultiplier === m ? '#fff' : 'var(--text-muted)',
                                    border: 'none', padding: '2px 6px', fontSize: 9, cursor: 'pointer'
                                }}
                            >
                                {m}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr minmax(140px, auto) 1fr',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.1)',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${cfg.border}33`, overflow: 'hidden' }}>
                    <DataTable
                        rows={sourceRows}
                        columns={cols}
                        accentColor='#94a3b8'
                        title={`📥 Source Rows`}
                        highlightedRowIdx={!isDone ? currentIndex : -1}
                        statusForRow={leftStatus}
                    />
                </div>

                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px',
                    borderRight: `1px solid ${cfg.border}33`, background: `${cfg.cellColor}08`
                }}>
                    <div style={{ fontSize: 10, color: cfg.border, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 'auto' }}>
                        FILTER
                    </div>

                    {!isDone && currentEval ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
                            <div style={{ fontSize: 24, animation: 'pulse 1s infinite' }}>{cfg.icon}</div>
                            <div style={{ background: 'var(--bg-surface)', border: `1px solid ${currentEval.passed ? '#22c55e' : '#ef4444'}`, borderRadius: 4, padding: '6px 12px', width: '100%', textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', transition: 'all 0.3s' }}>
                                {currentEval.passed ? '✅ KEEP' : '❌ DISCARD'}
                            </div>
                        </div>
                    ) : isDone ? (
                        <div style={{ margin: 'auto', fontSize: 11, color: 'var(--text-primary)', opacity: 0.6, textAlign: 'center' }}>
                            Complete
                        </div>
                    ) : null}

                    <div style={{ marginTop: 'auto', fontSize: 20, color: cfg.border, opacity: 0.8 }}>⟶</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <DataTable
                        rows={passedRows}
                        columns={cols}
                        accentColor={cfg.border}
                        title={`✅ Accepted Rows`}
                        subtitle={`${passedRows.length} passed`}
                    />
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export function QueryPipelineViz({ stages, activeStageName, sourceTableNames, sql }: Props) {
    // ── Hooks must always be called before any early return (Rules of Hooks) ──
    const pipelineStripRef = useRef<HTMLDivElement>(null);

    // Redirect vertical wheel events to horizontal scroll on the pipeline strip.
    useEffect(() => {
        const el = pipelineStripRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (e.deltaY === 0) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    if (stages.length === 0) {
        return (
            <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-icon">🔀</div>
                <div className="empty-title">Query Execution Pipeline</div>
                <div className="empty-sub">
                    Run a SELECT query to see the execution order flow.<br />
                    FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT → SELECT
                </div>
            </div>
        );
    }

    const activeStage = stages.find(s => s.name === activeStageName);

    const renderActiveView = () => {
        if (!activeStage) return null;

        if (activeStage.name === 'JOIN') {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
                    border: `1px solid ${STAGE_CONFIG['JOIN'].border}44`,
                    margin: 0, overflow: 'hidden'
                }}>
                    <AnimatedJoinView stage={activeStage} isActive={true} />
                </div>
            );
        }

        if (activeStage.name === 'WHERE' || activeStage.name === 'HAVING') {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
                    border: `1px solid ${STAGE_CONFIG[activeStage.name].border}44`,
                    margin: 0, overflow: 'hidden'
                }}>
                    <AnimatedWhereView stage={activeStage} isActive={true} />
                </div>
            );
        }

        // Default Normal stage view
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
                border: `1px solid ${STAGE_CONFIG[activeStage.name].border}44`,
                overflow: 'hidden',
            }}>
                <DataTable
                    rows={activeStage.sampleRows}
                    columns={activeStage.columns}
                    accentColor={STAGE_CONFIG[activeStage.name].border}
                    title={`${STAGE_CONFIG[activeStage.name].icon} ${activeStage.name} — ${activeStage.clauseText.length > 60 ? activeStage.clauseText.slice(0, 60) + '…' : activeStage.clauseText}`}
                    subtitle={`${activeStage.rowCount} rows`}
                />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>

            {/* ── Top: pipeline flow strip + SQL ──────────────────────── */}
            <div
                ref={pipelineStripRef}
                style={{
                    display: 'flex', flexShrink: 0,
                    borderBottom: '1px solid var(--border)',
                    overflowX: 'auto', overflowY: 'hidden',
                    minHeight: 0, padding: '10px 14px', gap: 0,
                    alignItems: 'flex-start',
                    scrollbarWidth: 'none',
                }}
            >
                {/* Source table chips */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginRight: 8 }}>
                    {sourceTableNames.map(t => (
                        <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{t}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {Array.from({ length: 3 }).map((_, ri) => (
                                    <div key={ri} style={{ display: 'flex', gap: 2 }}>
                                        {Array.from({ length: 3 }).map((_, ci) => (
                                            <div key={ci} style={{ width: 12, height: 10, borderRadius: 2, background: '#6366f1aa', border: '1px solid #6366f133' }} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pipeline stage chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    {stages.map((stage, idx) => {
                        const cfg = STAGE_CONFIG[stage.name];
                        const isActive = stage.name === activeStageName;
                        const cols = Math.max(stage.columns.length, 1);
                        return (
                            <div key={`${stage.name}-${idx}`} style={{ display: 'flex', alignItems: 'center' }}>
                                {/* Arrow connector */}
                                {idx > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                        <div style={{ width: 16, height: 2, background: isActive ? cfg.border : 'var(--border-bright)', transition: 'background 0.3s' }} />
                                        <div style={{ fontSize: 10, color: isActive ? cfg.border : 'var(--text-muted)', lineHeight: 1 }}>▶</div>
                                    </div>
                                )}
                                {/* Stage chip */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    background: isActive ? cfg.bg : 'var(--bg-elevated)',
                                    border: `1px solid ${isActive ? cfg.border : 'var(--border)'}`,
                                    boxShadow: isActive ? `0 0 10px ${cfg.border}44` : 'none',
                                    transition: 'all 0.3s ease',
                                    cursor: 'default',
                                }}>
                                    <MiniGrid rowCount={stage.rowCount} cols={cols} color={cfg.cellColor} active={isActive} />
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: isActive ? cfg.border : 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 1 }}>
                                            {cfg.icon} {cfg.label}
                                        </div>
                                        <div style={{ fontSize: 9, color: isActive ? cfg.border : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                            {stage.rowCount} row{stage.rowCount !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* SQL annotation */}
                <div style={{ marginLeft: 'auto', paddingLeft: 20, flexShrink: 0 }}>
                    <div style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        lineHeight: 1.8,
                        maxWidth: 280,
                    }}>
                        {sql ? formatSQLAnnotation(sql, stages, activeStageName) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Run a SELECT query…</span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Bottom: active stage data view ─────────────────────────── */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {activeStage ? (
                    renderActiveView()
                ) : (
                    /* No active stage yet */
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: 32, opacity: 0.4 }}>🔀</div>
                        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.6 }}>Step through the query to see stage data</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 500, justifyContent: 'center', marginTop: 8 }}>
                            {Object.entries(STAGE_CONFIG).map(([name, cfg]) => {
                                const hasStage = stages.some(s => s.name === name);
                                return (
                                    <div key={name} style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '3px 8px', borderRadius: 99,
                                        background: hasStage ? cfg.bg : 'transparent',
                                        border: `1px solid ${hasStage ? cfg.border : 'var(--border)'}`,
                                        opacity: hasStage ? 1 : 0.35,
                                        fontSize: 10, color: hasStage ? cfg.border : 'var(--text-muted)', fontWeight: 600,
                                    }}>
                                        <span>{cfg.icon}</span><span>{cfg.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Global Styles for Animations */}
            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(0.95); }
                }
            `}</style>
        </div>
    );
}

// ── SQL annotation formatter ──────────────────────────────────────────────────
function formatSQLAnnotation(sql: string, stages: PipelineStage[], active?: StageName): React.ReactNode {
    const keywords = ['SELECT', 'FROM', 'JOIN', 'ON', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'];
    const parts: Array<{ keyword: string; rest: string }> = [];
    let remaining = sql.trim();

    for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        const match = regex.exec(remaining);
        if (match && match.index !== undefined) {
            remaining = remaining.slice(match.index + kw.length);
            const nextKwMatch = keywords.map(k => {
                const r = new RegExp(`\\b${k}\\b`, 'i').exec(remaining);
                return r ? r.index : Infinity;
            });
            const nextIdx = Math.min(...nextKwMatch);
            const rest = isFinite(nextIdx) ? remaining.slice(0, nextIdx).trim() : remaining.trim();
            parts.push({ keyword: kw, rest });
            remaining = remaining.slice(isFinite(nextIdx) ? nextIdx : remaining.length);
        }
    }

    return (
        <div>
            {parts.map(p => {
                const stageName = (['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'SELECT'] as StageName[])
                    .find(s => s === p.keyword.toUpperCase());
                const cfg = stageName ? STAGE_CONFIG[stageName] : undefined;
                const isAct = stageName === active;
                const hasStage = stages.some(s => s.name === stageName);
                return (
                    <div key={p.keyword} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '1px 0' }}>
                        <span style={{
                            fontWeight: 700, minWidth: 66, textAlign: 'right',
                            color: isAct ? cfg?.border ?? '#8b5cf6' : hasStage ? cfg?.border ?? '#6366f1' : 'var(--text-muted)',
                            fontSize: 11,
                            transition: 'color 0.3s',
                            textShadow: isAct ? `0 0 8px ${cfg?.border}` : 'none',
                        }}>
                            {p.keyword}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.rest.length > 30 ? p.rest.slice(0, 30) + '…' : p.rest}</span>
                    </div>
                );
            })}
        </div>
    );
}
