'use client';

import React from 'react';
import { SchemaBrowser } from '@/components/schema/SchemaBrowser';
import { TableDef } from '@/engine/types';
import { Row } from '@/engine/types';

interface SidebarProps {
    schemaTables: TableDef[];
    focusedTable: string | null;
    isRestored: boolean;
    tableData: { rows: Row[]; columns: string[]; pkColumn: string | undefined };
    onSelectTable: (name: string) => void;
    onClearDb: () => void;
}

export function Sidebar({
    schemaTables,
    focusedTable,
    isRestored,
    tableData,
    onSelectTable,
    onClearDb,
}: SidebarProps) {
    const totalIndexes = schemaTables.reduce((a, t) => a + t.indexes.length, 0);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            overflow: 'hidden',
        }}>
            {/* ── Logo ──────────────────────────────────────────────────── */}
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-violet))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>
                        🔷
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            SQL Visualizer
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>B+Tree Engine · v2</div>
                    </div>
                </div>
            </div>

            {/* ── Schema header ─────────────────────────────────────────── */}
            <div className="panel-header">
                <span className="icon">📂</span>
                <span className="title">Schema</span>
                <span style={{ marginLeft: 'auto' }} className="badge badge-cyan">{schemaTables.length}</span>
            </div>

            {/* ── Schema browser ────────────────────────────────────────── */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <SchemaBrowser
                    tables={schemaTables}
                    focusedTable={focusedTable}
                    onSelectTable={onSelectTable}
                />
            </div>

            {/* ── Quick table preview ───────────────────────────────────── */}
            {focusedTable && tableData.rows.length > 0 && (
                <div style={{
                    flexShrink: 0, borderTop: '1px solid var(--border)',
                    maxHeight: 180, overflow: 'auto',
                    background: 'var(--bg-elevated)',
                }}>
                    <div style={{
                        padding: '4px 10px', fontSize: 9, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <span>{focusedTable}</span>
                        <span className="badge badge-cyan" style={{ fontSize: 8 }}>{tableData.rows.length} rows</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: 10 }}>
                            <thead>
                                <tr>
                                    {tableData.columns.slice(0, 4).map((c: string) => <th key={c}>{c}</th>)}
                                    {tableData.columns.length > 4 && <th>…</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.rows.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        {tableData.columns.slice(0, 4).map((c: string) => (
                                            <td key={c}>
                                                {row[c] === null
                                                    ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span>
                                                    : String(row[c])}
                                            </td>
                                        ))}
                                        {tableData.columns.length > 4 && <td style={{ color: 'var(--text-muted)' }}>…</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Stats footer + Clear DB ───────────────────────────────── */}
            <div style={{
                padding: '6px 12px', borderTop: '1px solid var(--border)',
                flexShrink: 0, fontSize: 10, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <span>
                    {isRestored ? '💾' : '⏳'}&nbsp;
                    {schemaTables.length} table{schemaTables.length !== 1 ? 's' : ''} · {totalIndexes} index{totalIndexes !== 1 ? 'es' : ''}
                </span>
                {schemaTables.length > 0 && (
                    <button
                        onClick={onClearDb}
                        style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', borderRadius: 4, padding: '2px 7px',
                            fontSize: 9, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
                        }}
                        title="Clear all tables from storage"
                    >
                        Clear DB
                    </button>
                )}
            </div>
        </div>
    );
}
