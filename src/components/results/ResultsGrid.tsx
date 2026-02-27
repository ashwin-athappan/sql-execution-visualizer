'use client';

import React from 'react';
import { Row } from '@/engine/types';

interface Props {
    rows: Row[];
    columns: string[];
    rowsAffected: number;
    error: string | null;
}

export function ResultsGrid({ rows, columns, rowsAffected, error }: Props) {
    if (error) {
        return (
            <div style={{ padding: '10px 14px', height: '100%', overflowY: 'auto' }}>
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⛔</span>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent-red)', marginBottom: 4 }}>Query Error</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {error}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (columns.length === 0) {
        return (
            <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                {rowsAffected > 0
                    ? <span style={{ color: 'var(--accent-green)' }}>✅ {rowsAffected} row(s) affected</span>
                    : <span>No results yet. Run a query.</span>
                }
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Summary bar */}
            <div style={{
                padding: '4px 14px', fontSize: 11,
                color: 'var(--accent-green)', fontFamily: 'var(--font-mono)',
                borderBottom: '1px solid var(--border)', flexShrink: 0,
                background: 'rgba(16, 185, 129, 0.04)',
            }}>
                ✓ {rows.length} row{rows.length !== 1 ? 's' : ''} returned
            </div>
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map(col => <th key={col}>{col}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="row-selected">
                                {columns.map(col => (
                                    <td key={col}>
                                        {row[col] === null || row[col] === undefined
                                            ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span>
                                            : String(row[col])
                                        }
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
