'use client';

import React, { useMemo } from 'react';
import { PipelineStage, StageName } from '@/engine/types';

interface Props {
    stages: PipelineStage[];
    activeStageName?: StageName;
    sourceTableNames: string[];
    sql?: string;
}

// Stage color config matching the reference image
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

// Draw a mini grid of cells representing rows/cols of a stage
function MiniGrid({ rowCount, cols, color, active }: { rowCount: number; cols: number; color: string; active: boolean }) {
    const displayRows = Math.min(rowCount, 8);
    const displayCols = Math.min(cols, 5);
    const opacity = active ? 1 : 0.7;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            opacity,
            transition: 'opacity 0.3s',
        }}>
            {Array.from({ length: displayRows }).map((_, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: displayCols }).map((_, ci) => (
                        <div key={ci} style={{
                            width: 14, height: 11,
                            borderRadius: 2,
                            background: active
                                ? `${color}dd`
                                : `${color}66`,
                            border: `1px solid ${color}44`,
                            transition: 'background 0.4s ease',
                            boxShadow: active ? `0 0 4px ${color}66` : 'none',
                        }} />
                    ))}
                </div>
            ))}
            {rowCount > 8 && (
                <div style={{ fontSize: 9, color: '#94a3b8', paddingLeft: 1 }}>+{rowCount - 8} more</div>
            )}
        </div>
    );
}

export function QueryPipelineViz({ stages, activeStageName, sourceTableNames, sql }: Props) {
    // Parse the SQL to show clause text annotations on the right side
    const clauseAnnotations = useMemo(() => {
        if (!sql) return [];
        const lines = [
            { kw: 'SELECT', color: '#8b5cf6' },
            { kw: 'FROM', color: '#8b5cf6' },
            { kw: 'JOIN', color: '#8b5cf6' },
            { kw: 'ON', color: '#6b7280' },
            { kw: 'WHERE', color: '#8b5cf6' },
            { kw: 'GROUP BY', color: '#8b5cf6' },
            { kw: 'HAVING', color: '#8b5cf6' },
            { kw: 'ORDER BY', color: '#8b5cf6' },
            { kw: 'LIMIT', color: '#8b5cf6' },
        ];
        const upper = sql.toUpperCase();
        return lines.filter(l => upper.includes(l.kw.toUpperCase()));
    }, [sql]);

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

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'auto', padding: '16px 12px' }}>
            {/* ── Left: flow diagram ──────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0, minWidth: 220 }}>

                {/* Source table chips */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, paddingLeft: 8 }}>
                    {sourceTableNames.map(t => (
                        <div key={t} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                        }}>
                            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{t}</span>
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

                {/* Pipeline stages */}
                {stages.map((stage, idx) => {
                    const cfg = STAGE_CONFIG[stage.name];
                    const isActive = stage.name === activeStageName;
                    const cols = Math.max(stage.columns.length, 1);

                    return (
                        <div key={stage.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            {/* Arrow */}
                            {idx > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 20, gap: 0 }}>
                                    <div style={{ width: 2, height: 18, background: isActive ? cfg.border : '#334155', transition: 'background 0.3s', marginLeft: 24 }} />
                                    <div style={{ fontSize: 10, color: isActive ? cfg.border : '#475569', marginLeft: 19, lineHeight: 1 }}>▼</div>
                                </div>
                            )}

                            {/* Stage block */}
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '8px 12px',
                                borderRadius: 10,
                                background: isActive ? cfg.bg : 'var(--bg-elevated)',
                                border: `1px solid ${isActive ? cfg.border : 'var(--border)'}`,
                                boxShadow: isActive ? `0 0 12px ${cfg.border}44` : 'none',
                                transition: 'all 0.3s ease',
                                minWidth: 180,
                            }}>
                                <MiniGrid
                                    rowCount={stage.rowCount}
                                    cols={cols}
                                    color={cfg.cellColor}
                                    active={isActive}
                                />
                                <div>
                                    <div style={{
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                                        color: isActive ? cfg.border : '#94a3b8',
                                        textTransform: 'uppercase', marginBottom: 2,
                                    }}>
                                        {cfg.icon} {cfg.label}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'var(--font-mono)', maxWidth: 130, lineHeight: 1.4, wordBreak: 'break-all' }}>
                                        {stage.clauseText.length > 40 ? stage.clauseText.slice(0, 40) + '…' : stage.clauseText}
                                    </div>
                                    <div style={{
                                        fontSize: 10, marginTop: 4,
                                        color: isActive ? cfg.border : '#475569',
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 600,
                                    }}>
                                        {stage.rowCount} row{stage.rowCount !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Right: SQL clause annotations ───────────────────────── */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                paddingLeft: 32,
                gap: 4,
                minWidth: 280,
            }}>
                {/* SQL text breakdown */}
                <div style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    lineHeight: 2,
                }}>
                    {/* Show the full parsed query with highlighted keywords */}
                    {sql ? formatSQLAnnotation(sql, stages, activeStageName) : (
                        <span style={{ color: '#475569', fontStyle: 'italic' }}>Run a SELECT query…</span>
                    )}
                </div>

                {/* Stage sample data preview */}
                {activeStageName && (() => {
                    const activeStage = stages.find(s => s.name === activeStageName);
                    if (!activeStage || activeStage.sampleRows.length === 0) return null;
                    const cfg = STAGE_CONFIG[activeStageName];
                    return (
                        <div style={{
                            marginTop: 10,
                            background: 'var(--bg-elevated)',
                            border: `1px solid ${cfg.border}55`,
                            borderRadius: 10,
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '6px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                                textTransform: 'uppercase', color: cfg.border,
                                background: `${cfg.cellColor}11`,
                                borderBottom: `1px solid ${cfg.border}33`,
                            }}>
                                {cfg.icon} {activeStage.name} — {activeStage.rowCount} rows
                            </div>
                            <div style={{ overflowX: 'auto', maxHeight: 180 }}>
                                <table className="data-table" style={{ fontSize: 11 }}>
                                    <thead>
                                        <tr>
                                            {activeStage.columns.slice(0, 6).map(c => <th key={c}>{c}</th>)}
                                            {activeStage.columns.length > 6 && <th>…</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeStage.sampleRows.slice(0, 5).map((row, i) => (
                                            <tr key={i}>
                                                {activeStage.columns.slice(0, 6).map(c => (
                                                    <td key={c} style={{ color: `${cfg.border}cc` }}>
                                                        {row[c] === null ? <span style={{ color: '#475569', fontStyle: 'italic' }}>NULL</span> : String(row[c])}
                                                    </td>
                                                ))}
                                                {activeStage.columns.length > 6 && <td style={{ color: '#475569' }}>…</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}

                {/* Execution legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {Object.entries(STAGE_CONFIG).map(([name, cfg]) => {
                        const hasStage = stages.some(s => s.name === name);
                        return (
                            <div key={name} style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '3px 8px',
                                borderRadius: 99,
                                background: hasStage ? cfg.bg : 'transparent',
                                border: `1px solid ${hasStage ? cfg.border : 'var(--border)'}`,
                                opacity: hasStage ? 1 : 0.35,
                                fontSize: 10,
                                color: hasStage ? cfg.border : '#475569',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}>
                                <span>{cfg.icon}</span>
                                <span>{cfg.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Format the SQL with colored keyword spans and arrows to stages
function formatSQLAnnotation(sql: string, stages: PipelineStage[], active?: StageName): React.ReactNode {
    const lines = sql.split(/\n/).filter(l => l.trim());
    if (lines.length <= 1) {
        // single line — split on keywords
        const keywords = ['SELECT', 'FROM', 'JOIN', 'ON', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'];
        let parts: Array<{ keyword: string; rest: string }> = [];
        let remaining = sql.trim();
        const matched: string[] = [];

        for (const kw of keywords) {
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            const match = regex.exec(remaining);
            if (match && match.index !== undefined) {
                if (match.index > 0) matched.push(remaining.slice(0, match.index).trim());
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
                {parts.map((p) => {
                    const stageName = p.keyword.toUpperCase() === 'FROM' ? 'FROM' :
                        p.keyword.toUpperCase() === 'JOIN' ? 'JOIN' :
                            p.keyword.toUpperCase() === 'WHERE' ? 'WHERE' :
                                p.keyword.toUpperCase() === 'GROUP BY' ? 'GROUP BY' :
                                    p.keyword.toUpperCase() === 'HAVING' ? 'HAVING' :
                                        p.keyword.toUpperCase() === 'ORDER BY' ? 'ORDER BY' :
                                            p.keyword.toUpperCase() === 'LIMIT' ? 'LIMIT' :
                                                p.keyword.toUpperCase() === 'SELECT' ? 'SELECT' : undefined;
                    const cfg = stageName ? STAGE_CONFIG[stageName as StageName] : undefined;
                    const isAct = stageName === active;
                    const hasStage = stages.some(s => s.name === stageName);
                    return (
                        <div key={p.keyword} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '1px 0' }}>
                            <span style={{
                                fontWeight: 700, minWidth: 72, textAlign: 'right',
                                color: isAct ? cfg?.border ?? '#8b5cf6' : hasStage ? cfg?.border ?? '#6366f1' : '#6b7280',
                                fontSize: 12,
                                transition: 'color 0.3s',
                                textShadow: isAct ? `0 0 8px ${cfg?.border}` : 'none',
                            }}>
                                {p.keyword}
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>{p.rest}</span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return <span style={{ color: '#94a3b8' }}>{sql}</span>;
}
