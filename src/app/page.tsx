'use client';

import React, { useState, useMemo } from 'react';
import { useDbStore } from '@/store/dbStore';
import { SchemaBrowser } from '@/components/schema/SchemaBrowser';
import { BPlusTreeViz } from '@/components/visualization/BPlusTreeViz';
import { ExecutionPlan } from '@/components/visualization/ExecutionPlan';
import { TableViz } from '@/components/visualization/TableViz';
import { AnimationControls } from '@/components/controls/AnimationControls';
import { SQLEditor } from '@/components/editor/SQLEditor';
import { ResultsGrid } from '@/components/results/ResultsGrid';
import { QueryPipelineViz } from '@/components/visualization/QueryPipelineViz';
import { Row } from '@/engine/types';

export default function Home() {
  const {
    db, steps, currentStepIndex, isPlaying, speed,
    resultRows, resultColumns, rowsAffected, error,
    schemaTables, focusedTable, isExecuting,
    pipelineStages, activeStageName, lastSQL,
    executeQuery, stepForward, stepBackward, play, pause, reset,
    setSpeed, setFocusedTable, setCurrentStepIndex,
  } = useDbStore();

  const [sql, setSql] = useState('');
  const [vizTab, setVizTab] = useState<'pipeline' | 'tree' | 'table'>('pipeline');

  const currentStep = steps[currentStepIndex] ?? null;
  const currentSnapshot = currentStep?.treeSnapshot;

  // Derive source table names from lastSQL for pipeline viz
  const sourceTableNames = useMemo(() => {
    if (!lastSQL) return [];
    const upper = lastSQL.toUpperCase();
    const names: string[] = [];
    schemaTables.forEach(t => { if (upper.includes(t.name.toUpperCase())) names.push(t.name); });
    return names.length > 0 ? names : [];
  }, [lastSQL, schemaTables]);

  // Live table data for focused table
  const tableData = useMemo(() => {
    if (!focusedTable) return { rows: [], columns: [], pkColumn: undefined as string | undefined };
    const tableDef = schemaTables.find(t => t.name === focusedTable);
    if (!tableDef) return { rows: [], columns: [] as string[], pkColumn: undefined as string | undefined };
    const storage = db.getStorages().get(focusedTable);
    const rows = storage ? storage.scanAll() : [];
    return { rows, columns: tableDef.columns.map(c => c.name), pkColumn: tableDef.primaryKey };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTable, schemaTables, db, currentStepIndex]);

  const handleExecute = () => { if (!sql.trim() || isExecuting) return; executeQuery(sql); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── LEFT SIDEBAR: Schema + Tables ────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-violet))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔷</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>SQL Visualizer</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>B+Tree Engine · v2</div>
            </div>
          </div>
        </div>

        {/* Schema browser */}
        <div className="panel-header">
          <span className="icon">📂</span>
          <span className="title">Schema</span>
          <span style={{ marginLeft: 'auto' }} className="badge badge-cyan">{schemaTables.length}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <SchemaBrowser tables={schemaTables} focusedTable={focusedTable} onSelectTable={name => { setFocusedTable(name); if (vizTab === 'pipeline') setVizTab('table'); }} />
        </div>

        {/* Quick table data preview */}
        {focusedTable && tableData.rows.length > 0 && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', maxHeight: 180, overflow: 'auto', background: 'var(--bg-elevated)' }}>
            <div style={{ padding: '4px 10px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{focusedTable}</span>
              <span className="badge badge-cyan" style={{ fontSize: 8 }}>{tableData.rows.length} rows</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 10 }}>
                <thead><tr>{tableData.columns.slice(0, 4).map((c: string) => <th key={c}>{c}</th>)}{tableData.columns.length > 4 && <th>…</th>}</tr></thead>
                <tbody>
                  {tableData.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {tableData.columns.slice(0, 4).map((c: string) => <td key={c}>{row[c] === null ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span> : String(row[c])}</td>)}
                      {tableData.columns.length > 4 && <td style={{ color: 'var(--text-muted)' }}>…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats footer */}
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, fontSize: 10, color: 'var(--text-muted)' }}>
          {schemaTables.length} tables · {schemaTables.reduce((a, t) => a + t.indexes.length, 0)} indexes
        </div>
      </div>

      {/* ── MAIN AREA ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr 290px', overflow: 'hidden', minWidth: 0 }}>

        {/* ── TOP: Visualization ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', overflow: 'hidden', minHeight: 0 }}>

          {/* Primary viz panel */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderBottom: '1px solid var(--border)', gap: 8, flexShrink: 0 }}>
              <div className="tabs">
                <button className={`tab ${vizTab === 'pipeline' ? 'active' : ''}`} onClick={() => setVizTab('pipeline')}>🔀 Pipeline Flow</button>
                <button className={`tab ${vizTab === 'tree' ? 'active' : ''}`} onClick={() => setVizTab('tree')}>🌳 B+Tree</button>
                <button className={`tab ${vizTab === 'table' ? 'active' : ''}`} onClick={() => setVizTab('table')}>📋 Table Data</button>
              </div>

              {schemaTables.length > 0 && (
                <select
                  value={focusedTable ?? ''}
                  onChange={e => setFocusedTable(e.target.value || null)}
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}
                >
                  <option value="">Table…</option>
                  {schemaTables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              )}
              {currentStep && <div className="badge badge-cyan" style={{ fontSize: 9 }}>Step {currentStepIndex + 1}/{steps.length}</div>}
            </div>

            {/* Step description */}
            {currentStep && (
              <div style={{ padding: '5px 12px', fontSize: 11, background: 'rgba(0,212,255,0.04)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', flexShrink: 0, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{currentStep.type}</span>
                <span>{currentStep.description}</span>
              </div>
            )}

            {/* Viz content */}
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
                    snapshot={currentSnapshot ?? (focusedTable ? db.getStorages().get(focusedTable)?.getPrimaryTreeSnapshot() : undefined)}
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
            </div>

            {/* Animation controls */}
            <AnimationControls
              currentIndex={currentStepIndex}
              totalSteps={steps.length}
              isPlaying={isPlaying}
              speed={speed}
              onPlay={play}
              onPause={pause}
              onStepBack={stepBackward}
              onStepForward={stepForward}
              onReset={reset}
              onSpeedChange={setSpeed}
            />
          </div>

          {/* Execution plan sidebar */}
          <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)' }}>
            <div className="panel-header">
              <span className="icon">📋</span>
              <span className="title">Execution Plan</span>
              {steps.length > 0 && <span className="badge badge-violet" style={{ marginLeft: 'auto' }}>{steps.length}</span>}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <ExecutionPlan steps={steps} currentIndex={currentStepIndex} onSelectStep={setCurrentStepIndex} />
            </div>
          </div>
        </div>

        {/* ── BOTTOM: Editor + Results ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', borderTop: '1px solid var(--border)', minHeight: 0 }}>
          {/* SQL Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)' }}>
            <SQLEditor
              value={sql}
              onChange={setSql}
              onExecute={handleExecute}
              isExecuting={isExecuting}
              error={error}
              schema={schemaTables}
            />
          </div>

          {/* Results */}
          <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)' }}>
            <div className="panel-header">
              <span className="icon">📊</span>
              <span className="title">Query Results</span>
              {resultRows.length > 0 && <span className="badge badge-green" style={{ marginLeft: 'auto' }}>{resultRows.length} rows</span>}
              {error && <span className="badge badge-red" style={{ marginLeft: 'auto' }}>Error</span>}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <ResultsGrid
                rows={resultRows as Row[]}
                columns={resultColumns}
                rowsAffected={rowsAffected}
                error={error}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
