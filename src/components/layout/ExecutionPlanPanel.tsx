'use client';

import React from 'react';
import { ExecutionPlan } from '@/components/visualization/ExecutionPlan';
import { ExecutionStep } from '@/engine/types';

interface ExecutionPlanPanelProps {
    steps: ExecutionStep[];
    currentStepIndex: number;
    onSelectStep: (idx: number) => void;
}

export function ExecutionPlanPanel({ steps, currentStepIndex, onSelectStep }: ExecutionPlanPanelProps) {
    return (
        <div style={{
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-surface)',
        }}>
            <div className="panel-header">
                <span className="icon">📋</span>
                <span className="title">Execution Plan</span>
                {steps.length > 0 && (
                    <span className="badge badge-violet" style={{ marginLeft: 'auto' }}>{steps.length}</span>
                )}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <ExecutionPlan steps={steps} currentIndex={currentStepIndex} onSelectStep={onSelectStep} />
            </div>
        </div>
    );
}
