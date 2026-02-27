'use client';

import React from 'react';
import { ExecutionStep, StepType } from '@/engine/types';

interface Props {
    steps: ExecutionStep[];
    currentIndex: number;
    onSelectStep: (idx: number) => void;
}

const STEP_META: Record<StepType, { icon: string; color: string; label: string }> = {
    PARSE: { icon: '📝', color: 'var(--accent-violet)', label: 'Parse' },
    PLAN: { icon: '🗺️', color: 'var(--accent-cyan)', label: 'Plan' },
    SCHEMA_CREATE: { icon: '🏗️', color: 'var(--accent-green)', label: 'Schema Create' },
    SCHEMA_DROP: { icon: '🗑️', color: 'var(--accent-red)', label: 'Schema Drop' },
    SCHEMA_ALTER: { icon: '✏️', color: 'var(--accent-amber)', label: 'Schema Alter' },
    INDEX_CREATE: { icon: '📇', color: 'var(--accent-green)', label: 'Index Create' },
    INDEX_DROP: { icon: '📭', color: 'var(--accent-red)', label: 'Index Drop' },
    TREE_TRAVERSE: { icon: '🔍', color: 'var(--accent-cyan)', label: 'Traverse' },
    TREE_INSERT: { icon: '➕', color: 'var(--accent-green)', label: 'Insert' },
    TREE_SPLIT: { icon: '⚡', color: 'var(--accent-violet)', label: 'Split' },
    TREE_DELETE: { icon: '✂️', color: 'var(--accent-red)', label: 'Delete' },
    TREE_MERGE: { icon: '🔀', color: 'var(--accent-amber)', label: 'Merge' },
    TABLE_SCAN: { icon: '⬇️', color: 'var(--accent-cyan)', label: 'Table Scan' },
    TABLE_INSERT: { icon: '📥', color: 'var(--accent-green)', label: 'Table Insert' },
    TABLE_UPDATE: { icon: '🔄', color: 'var(--accent-amber)', label: 'Table Update' },
    TABLE_DELETE: { icon: '🗑️', color: 'var(--accent-red)', label: 'Table Delete' },
    FILTER: { icon: '🔧', color: 'var(--accent-violet)', label: 'Filter' },
    GROUP_BY: { icon: '📊', color: '#14b8a6', label: 'Group By' },
    HAVING: { icon: '🎯', color: '#6366f1', label: 'Having' },
    SORT: { icon: '↕️', color: 'var(--accent-amber)', label: 'Sort' },
    RESULT: { icon: '✅', color: 'var(--accent-green)', label: 'Result' },
};

export function ExecutionPlan({ steps, currentIndex, onSelectStep }: Props) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (containerRef.current) {
            const active = containerRef.current.querySelector('.step-item.active');
            active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [currentIndex]);

    if (steps.length === 0) {
        return (
            <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-icon">📋</div>
                <div className="empty-title">No Execution Plan</div>
                <div className="empty-sub">Run a query to see the execution steps</div>
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ overflowY: 'auto', height: '100%', padding: '4px 0' }}>
            {steps.map((step, idx) => {
                const meta = STEP_META[step.type] ?? { icon: '•', color: 'var(--text-muted)', label: step.type };
                const isActive = idx === currentIndex;
                const isPast = idx < currentIndex;

                return (
                    <div
                        key={step.id}
                        className={`step-item ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                        onClick={() => onSelectStep(idx)}
                        style={{ animationDelay: `${idx * 0.02}s` }}
                    >
                        {/* Step icon circle */}
                        <div
                            className="step-icon"
                            style={{
                                background: isActive ? `${meta.color}22` : 'var(--bg-elevated)',
                                border: `1px solid ${isActive ? meta.color : 'var(--border)'}`,
                            }}
                        >
                            <span>{meta.icon}</span>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                    color: isActive ? meta.color : 'var(--text-muted)',
                                }}>
                                    {meta.label}
                                </span>
                                {step.tableName && (
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                        {step.tableName}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {step.description}
                            </div>
                        </div>

                        {/* Step number */}
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                            {idx + 1}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
