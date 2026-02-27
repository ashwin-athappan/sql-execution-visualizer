'use client';

import React from 'react';
import { TableDef } from '@/engine/types';

interface Props {
    tables: TableDef[];
    focusedTable: string | null;
    onSelectTable: (name: string) => void;
}

export function SchemaBrowser({ tables, focusedTable, onSelectTable }: Props) {
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

    const toggle = (name: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    React.useEffect(() => {
        if (tables.length > 0) {
            setExpanded(new Set(tables.map(t => t.name)));
        }
    }, [tables.length]); // eslint-disable-line react-hooks/exhaustive-deps

    if (tables.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">📂</div>
                <div className="empty-title">No Tables</div>
                <div className="empty-sub">CREATE TABLE to get started</div>
            </div>
        );
    }

    return (
        <div style={{ padding: '6px 0', overflowY: 'auto', flex: 1 }}>
            {tables.map(table => {
                const isExpanded = expanded.has(table.name);
                const isFocused = focusedTable === table.name;
                return (
                    <div key={table.name} style={{ marginBottom: 2 }}>
                        {/* Table row */}
                        <div
                            className={`schema-item ${isFocused ? 'active' : ''}`}
                            onClick={() => { onSelectTable(table.name); toggle(table.name); }}
                        >
                            <span style={{ fontSize: 12, transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)' }}>›</span>
                            <span style={{ fontSize: 13 }}>🗄️</span>
                            <span className="schema-table-name">{table.name}</span>
                            <span style={{ flex: 1 }} />
                            <span className="badge badge-cyan" style={{ fontSize: 9 }}>{table.columns.length}c</span>
                        </div>

                        {/* Columns */}
                        {isExpanded && (
                            <div style={{ paddingLeft: 24 }}>
                                {/* Columns header */}
                                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 8px', fontWeight: 600 }}>
                                    Columns
                                </div>
                                {table.columns.map(col => (
                                    <div key={col.name} className="schema-item" style={{ padding: '3px 8px', gap: 6 }}>
                                        <span style={{ fontSize: 11 }}>{col.primaryKey ? '🔑' : col.nullable ? '◦' : '●'}</span>
                                        <span className="schema-col-name">{col.name}</span>
                                        <span style={{ flex: 1 }} />
                                        <span className="schema-col-type">{col.type}</span>
                                    </div>
                                ))}

                                {/* Indexes */}
                                {table.indexes.length > 0 && (
                                    <>
                                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px 3px', fontWeight: 600 }}>
                                            Indexes
                                        </div>
                                        {table.indexes.map(idx => (
                                            <div key={idx.name} className="schema-item" style={{ padding: '3px 8px', gap: 6 }}>
                                                <span style={{ fontSize: 11 }}>📇</span>
                                                <span className="schema-col-name" style={{ fontSize: 11 }}>{idx.name}</span>
                                                <span style={{ flex: 1 }} />
                                                <span className="schema-col-type">{idx.columns.join(', ')}</span>
                                                {idx.unique && <span className="badge badge-violet" style={{ fontSize: 8 }}>UNI</span>}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
