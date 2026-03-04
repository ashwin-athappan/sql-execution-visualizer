import React from 'react';
import { Row } from '@/engine/types';

interface SidebarQuickPreviewProps {
    focusedTable: string | null;
    tableData: { rows: Row[]; columns: string[]; pkColumn: string | undefined };
}

export function SidebarQuickPreview({ focusedTable, tableData }: SidebarQuickPreviewProps) {
    if (!focusedTable || tableData.rows.length === 0) return null;

    return (
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
    );
}
