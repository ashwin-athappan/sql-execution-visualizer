'use client';

import React from 'react';
import { BPlusTreeViz } from '@/components/visualization/BPlusTreeViz';
import { TableViz } from '@/components/visualization/TableViz';
import { AnimationControls } from '@/components/controls/AnimationControls';
import { QueryPipelineViz } from '@/components/visualization/QueryPipelineViz';
import { TutorialView } from '@/components/visualization/TutorialView';
import { ExecutionStep, PipelineStage, StageName, TableDef, Row } from '@/engine/types';
import { TreeSnapshot } from '@/engine/types';

export type VizTabId = 'pipeline' | 'tree' | 'table' | 'tutorial';

interface VizPanelProps {
    // Tab state
    vizTab: VizTabId;
    onVizTabChange: (tab: VizTabId) => void;

    // Step / playback
    steps: ExecutionStep[];
    currentStep: ExecutionStep | null;
    currentStepIndex: number;
    currentSnapshot: TreeSnapshot | undefined;
    isPlaying: boolean;
    speed: number;
    onPlay: () => void;
    onPause: () => void;
    onStepForward: () => void;
    onStepBack: () => void;
    onReset: () => void;
    onSpeedChange: (ms: number) => void;

    // Pipeline
    pipelineStages: PipelineStage[];
    activeStageName: StageName | undefined;
    sourceTableNames: string[];
    lastSQL: string;

    // Table data
    tableData: { rows: Row[]; columns: string[]; pkColumn: string | undefined };
    schemaTables: TableDef[];
    focusedTable: string | null;
    onFocusedTableChange: (name: string | null) => void;

    // Tree
    treeSnapshot: TreeSnapshot | undefined;
}

export function VizPanel({
    vizTab, onVizTabChange,
    steps, currentStep, currentStepIndex, currentSnapshot,
    isPlaying, speed,
    onPlay, onPause, onStepForward, onStepBack, onReset, onSpeedChange,
    pipelineStages, activeStageName, sourceTableNames, lastSQL,
    tableData, schemaTables, focusedTable, onFocusedTableChange,
    treeSnapshot,
}: VizPanelProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* ── Chrome-style tab bar ─────────────────────────────────── */}
            <div className="chrome-tab-bar">
                <button className={`chrome-tab ${vizTab === 'pipeline' ? 'active' : ''}`} onClick={() => onVizTabChange('pipeline')}>
                    <span className="chrome-tab-label">🔀 Pipeline Flow</span>
                </button>
                <button className={`chrome-tab ${vizTab === 'tree' ? 'active' : ''}`} onClick={() => onVizTabChange('tree')}>
                    <span className="chrome-tab-label">🌳 B+Tree</span>
                </button>
                <button className={`chrome-tab ${vizTab === 'table' ? 'active' : ''}`} onClick={() => onVizTabChange('table')}>
                    <span className="chrome-tab-label">📋 Table Data</span>
                </button>
                <button className={`chrome-tab ${vizTab === 'tutorial' ? 'active' : ''}`} onClick={() => onVizTabChange('tutorial')}>
                    <span className="chrome-tab-label">❓ How To Use?</span>
                </button>

                {/* Table selector dropdown */}
                {schemaTables.length > 0 && (
                    <select
                        value={focusedTable ?? ''}
                        onChange={e => onFocusedTableChange(e.target.value || null)}
                        style={{
                            background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            padding: '3px 8px', fontSize: 12, fontFamily: 'var(--font-mono)',
                            marginLeft: 'auto',
                        }}
                    >
                        <option value="">Table…</option>
                        {schemaTables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                )}

                {/* Step badge */}
                {currentStep && (
                    <div className="badge badge-cyan" style={{ fontSize: 9, marginLeft: schemaTables.length > 0 ? 0 : 'auto' }}>
                        Step {currentStepIndex + 1}/{steps.length}
                    </div>
                )}
            </div>

            {/* ── Active step description ───────────────────────────────── */}
            {currentStep && (
                <div style={{
                    padding: '5px 12px', fontSize: 11,
                    background: 'rgba(0,212,255,0.04)',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    flexShrink: 0, display: 'flex', gap: 8,
                }}>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {currentStep.type}
                    </span>
                    <span>{currentStep.description}</span>
                </div>
            )}

            {/* ── Visualisation content ─────────────────────────────────── */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {vizTab === 'pipeline' && (
                    <QueryPipelineViz
                        stages={pipelineStages}
                        activeStageName={activeStageName}
                        sourceTableNames={sourceTableNames}
                        sql={lastSQL}
                    />
                )}
                {vizTab === 'tree' && (
                    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box' }}>
                        <BPlusTreeViz
                            snapshot={treeSnapshot}
                            highlightedNodeId={currentStep?.highlightedNodeId}
                            newNodeId={currentStep?.newNodeId}
                            tableName={focusedTable ?? undefined}
                        />
                    </div>
                )}
                {vizTab === 'table' && (
                    <TableViz
                        rows={tableData.rows}
                        columns={tableData.columns}
                        affectedKeys={currentStep?.affectedRowKeys ?? []}
                        pkColumn={tableData.pkColumn}
                        stepType={currentStep?.type}
                    />
                )}
                {vizTab === 'tutorial' && (
                    <TutorialView />
                )}
            </div>

            {/* ── Animation controls ────────────────────────────────────── */}
            <AnimationControls
                currentIndex={currentStepIndex}
                totalSteps={steps.length}
                isPlaying={isPlaying}
                speed={speed}
                onPlay={onPlay}
                onPause={onPause}
                onStepBack={onStepBack}
                onStepForward={onStepForward}
                onReset={onReset}
                onSpeedChange={onSpeedChange}
            />
        </div>
    );
}
