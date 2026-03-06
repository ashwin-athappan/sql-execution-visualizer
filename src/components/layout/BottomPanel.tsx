'use client';

import React from 'react';
import { SQLEditor } from '@/components/editor/SQLEditor';
import { ResultsGrid } from '@/components/results/ResultsGrid';
import { TableDef, Row } from '@/engine/types';

interface BottomPanelProps {
    sql: string;
    onSqlChange: (val: string) => void;
    onExecute: () => void;
    isExecuting: boolean;
    error: string | null;
    schemaTables: TableDef[];
    resultRows: Row[];
    resultColumns: string[];
    rowsAffected: number;
}

export function BottomPanel({
    sql, onSqlChange, onExecute, isExecuting, error,
    schemaTables, resultRows, resultColumns, rowsAffected,
}: BottomPanelProps) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr var(--results-w)',
            borderTop: '1px solid var(--border)',
            minHeight: 0,
        }}>
            {/* SQL Editor */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                <SQLEditor
                    value={sql}
                    onChange={onSqlChange}
                    onExecute={onExecute}
                    isExecuting={isExecuting}
                    error={error}
                    schema={schemaTables}
                />
            </div>

            {/* Query Results */}
            <div style={{
                borderLeft: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                background: 'var(--bg-surface)',
            }}>
                <div className="panel-header">
                    <span className="icon">📊</span>
                    <span className="title">Query Results</span>
                    {resultRows.length > 0 && (
                        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>{resultRows.length} rows</span>
                    )}
                    {error && (
                        <span className="badge badge-red" style={{ marginLeft: 'auto' }}>Error</span>
                    )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <ResultsGrid
                        rows={resultRows}
                        columns={resultColumns}
                        rowsAffected={rowsAffected}
                        error={error}
                    />
                </div>
            </div>
        </div>
    );
}
