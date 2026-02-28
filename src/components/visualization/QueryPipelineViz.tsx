'use client';

import React, { useMemo } from 'react';
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

// ── Scrollable data table ────────────────────────────────────────────────────
function DataTable({ rows, columns, accentColor, title, subtitle }: {
    rows: Row[];
    columns: string[];
    accentColor: string;
    title?: string;
    subtitle?: string;
}) {
    if (columns.length === 0 && rows.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
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
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 1} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                                    Empty
                                </td>
                            </tr>
                        ) : rows.map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>{i + 1}</td>
                                {columns.map((c, ci) => (
                                    <td key={`${c}-${ci}`} style={{ ...tdStyle, color: row[c] === null ? 'var(--text-muted)' : `${accentColor}cc` }}>
                                        {row[c] === null || row[c] === undefined
                                            ? <em style={{ fontStyle: 'italic', opacity: 0.6 }}>NULL</em>
                                            : String(row[c])}
                                    </td>
                                ))}
                            </tr>
                        ))}
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

// ── JOIN three‑panel view ─────────────────────────────────────────────────────
function JoinStageView({ stage, isActive }: { stage: PipelineStage; isActive: boolean }) {
    const cfg = STAGE_CONFIG['JOIN'];
    const leftCols = stage.leftColumns ?? [];
    const rightCols = stage.rightColumns ?? [];
    const joinedCols = stage.columns;

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
                <span>{cfg.icon} JOIN Operation</span>
                <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                    {stage.clauseText}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10 }}>
                    {stage.leftRows?.length ?? 0} × {stage.rightRows?.length ?? 0} → {stage.rowCount} rows
                </span>
            </div>

            {/* Three-panel body */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr auto 1fr',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
            }}>
                {/* Left table */}
                <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${cfg.border}33`, borderRadius: 0, overflow: 'hidden' }}>
                    <DataTable
                        rows={stage.leftRows ?? []}
                        columns={leftCols}
                        accentColor='#8b5cf6'
                        title={`📥 ${stage.leftTableName ?? 'Left Table'}`}
                        subtitle={`${stage.leftRows?.length ?? 0} rows`}
                    />
                </div>

                {/* Arrow divider */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '0 8px', color: cfg.border, fontSize: 18, gap: 4, flexShrink: 0,
                }}>
                    <div style={{ fontSize: 11, color: cfg.border, fontWeight: 700, letterSpacing: '0.04em', writingMode: 'vertical-rl', textTransform: 'uppercase', opacity: 0.7 }}>
                        {stage.clauseText.split(' ')[0]} JOIN
                    </div>
                    <div style={{ fontSize: 20 }}>⟶</div>
                </div>

                {/* Right table */}
                <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${cfg.border}33`, overflow: 'hidden' }}>
                    <DataTable
                        rows={stage.rightRows ?? []}
                        columns={rightCols}
                        accentColor='#ec4899'
                        title={`📥 ${stage.rightTableName ?? 'Right Table'}`}
                        subtitle={`${stage.rightRows?.length ?? 0} rows`}
                    />
                </div>

                {/* Arrow divider 2 */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '0 8px', color: cfg.border, fontSize: 18, flexShrink: 0,
                }}>
                    <div style={{ fontSize: 20 }}>⟶</div>
                </div>

                {/* Combined result */}
                <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${cfg.border}55`, overflow: 'hidden' }}>
                    <DataTable
                        rows={stage.sampleRows}
                        columns={joinedCols}
                        accentColor={cfg.border}
                        title={`🔗 Combined Result`}
                        subtitle={`${stage.rowCount} rows`}
                    />
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export function QueryPipelineViz({ stages, activeStageName, sourceTableNames, sql }: Props) {
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
    const isJoinActive = activeStageName === 'JOIN' && !!activeStage;

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>

            {/* ── Top: pipeline flow strip + SQL ──────────────────────── */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto', overflowY: 'hidden', minHeight: 0, padding: '10px 14px', gap: 0, alignItems: 'flex-start' }}>

                {/* Source table chips */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginRight: 8 }}>
                    {sourceTableNames.map(t => (
                        <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
                                        <div style={{ width: 16, height: 2, background: isActive ? cfg.border : '#334155', transition: 'background 0.3s' }} />
                                        <div style={{ fontSize: 10, color: isActive ? cfg.border : '#475569', lineHeight: 1 }}>▶</div>
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
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: isActive ? cfg.border : '#94a3b8', textTransform: 'uppercase', marginBottom: 1 }}>
                                            {cfg.icon} {cfg.label}
                                        </div>
                                        <div style={{ fontSize: 9, color: isActive ? cfg.border : '#475569', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                            {stage.rowCount} row{stage.rowCount !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* SQL annotation (right side) */}
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
                            <span style={{ color: '#475569', fontStyle: 'italic' }}>Run a SELECT query…</span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Bottom: active stage data view ─────────────────────────── */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {activeStage ? (
                    isJoinActive ? (
                        /* Special JOIN view: 3 panels side by side */
                        <div style={{
                            display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
                            border: `1px solid ${STAGE_CONFIG['JOIN'].border}44`,
                            borderRadius: 0, overflow: 'hidden',
                            margin: 0,
                        }}>
                            <JoinStageView stage={activeStage} isActive={true} />
                        </div>
                    ) : (
                        /* Normal stage view: full scrollable table */
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
                    )
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
                                        fontSize: 10, color: hasStage ? cfg.border : '#475569', fontWeight: 600,
                                    }}>
                                        <span>{cfg.icon}</span><span>{cfg.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
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
            if (match.index > 0) { /* leading text ignored */ }
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
                            color: isAct ? cfg?.border ?? '#8b5cf6' : hasStage ? cfg?.border ?? '#6366f1' : '#6b7280',
                            fontSize: 11,
                            transition: 'color 0.3s',
                            textShadow: isAct ? `0 0 8px ${cfg?.border}` : 'none',
                        }}>
                            {p.keyword}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>{p.rest.length > 30 ? p.rest.slice(0, 30) + '…' : p.rest}</span>
                    </div>
                );
            })}
        </div>
    );
}
