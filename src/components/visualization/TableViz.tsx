'use client';

import React from 'react';
import { Row } from '@/engine/types';

interface Props {
    rows: Row[];
    columns: string[];
    affectedKeys?: (string | number)[];
    pkColumn?: string;
    stepType?: string;
}

export function TableViz({ rows, columns, affectedKeys = [], pkColumn, stepType }: Props) {
    if (columns.length === 0 && rows.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">📋</div>
                <div className="empty-title">No Data</div>
                <div className="empty-sub">Insert rows to see table contents</div>
            </div>
        );
    }

    const getRowClass = (row: Row): string => {
        const pk = pkColumn ? row[pkColumn] : undefined;
        if (pk !== undefined && affectedKeys.includes(pk as string | number)) {
            if (stepType === 'TABLE_INSERT') return 'row-inserted';
            if (stepType === 'TABLE_UPDATE') return 'row-updated';
            if (stepType === 'TABLE_DELETE') return 'row-deleted';
            if (stepType === 'FILTER' || stepType === 'RESULT') return 'row-selected';
        }
        return '';
    };

    return (
        <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{ width: 36, textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
                        {columns.map(col => (
                            <th key={col}>
                                <span style={{ color: 'var(--text-primary)' }}>{col}</span>
                                {col === pkColumn && <span className="badge badge-cyan" style={{ marginLeft: 6 }}>PK</span>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className={getRowClass(row)}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>{i + 1}</td>
                            {columns.map(col => (
                                <td key={col}>
                                    {row[col] === null || row[col] === undefined
                                        ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span>
                                        : <span>{String(row[col])}</span>
                                    }
                                </td>
                            ))}
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + 1} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontStyle: 'italic' }}>
                                Empty table
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
