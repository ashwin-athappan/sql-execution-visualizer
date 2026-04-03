'use client';

import React, { useState, useEffect } from 'react';
import { useDbStore } from '@/store/dbStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { VizPanel, VizTabId } from '@/components/layout/VizPanel';
import { ExecutionPlanPanel } from '@/components/layout/ExecutionPlanPanel';
import { BottomPanel } from '@/components/layout/BottomPanel';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { useTableData } from '@/hooks/useTableData';
import { useSourceTableNames } from '@/hooks/useSourceTableNames';
import { useResizable } from '@/hooks/useResizable';
import { Row } from '@/engine/types';

export default function SqlVisualizerApp() {
  const {
    db, steps, currentStepIndex, isPlaying, speed,
    resultRows, resultColumns, rowsAffected, error,
    schemaTables, focusedTable, isExecuting,
    pipelineStages, activeStageName, lastSQL,
    isRestored,
    executeQuery, stepForward, stepBackward, play, pause, reset,
    setSpeed, setFocusedTable, setCurrentStepIndex,
    initFromStorage, clearAll,
  } = useDbStore();

  // ── One-time hydration from localStorage ──────────────────────────────────
  useEffect(() => { initFromStorage(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local UI state ────────────────────────────────────────────────────────
  const [sql, setSql] = useState('');
  const [vizTab, setVizTab] = useState<VizTabId>('pipeline');

  // ── Resizable panel state ─────────────────────────────────────────────────
  const sidebar = useResizable({ initialSize: 220, minSize: 140, maxSize: 400, direction: 'horizontal' });
  const execPlan = useResizable({ initialSize: 280, minSize: 160, maxSize: 500, direction: 'horizontal', reverse: true });
  const bottomPanel = useResizable({ initialSize: 290, minSize: 150, maxSize: 600, direction: 'vertical', reverse: true });
  const resultsPanel = useResizable({ initialSize: 360, minSize: 180, maxSize: 600, direction: 'horizontal', reverse: true });

  // ── Derived data (custom hooks) ───────────────────────────────────────────
  const currentStep = steps[currentStepIndex] ?? null;
  const sourceTableNames = useSourceTableNames(lastSQL, schemaTables);
  const tableData = useTableData(db, schemaTables, focusedTable, currentStepIndex);

  // Snapshot for B+Tree viz: prefer the step snapshot, fall back to live storage
  const treeSnapshot = currentStep?.treeSnapshot
    ?? (focusedTable ? db.getStorages().get(focusedTable)?.getPrimaryTreeSnapshot() : undefined);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExecute = () => { if (!sql.trim() || isExecuting) return; executeQuery(sql); };

  const handleSelectTable = (name: string) => {
    setFocusedTable(name);
    if (vizTab === 'pipeline') setVizTab('table');
  };

  const handleClearDb = () => {
    if (confirm('Clear all tables and data? This cannot be undone.')) clearAll();
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="app-root" style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* ── Left sidebar ──────────────────────────────────────────────── */}
      <div style={{ width: sidebar.size, flexShrink: 0, overflow: 'hidden' }}>
        <Sidebar
          schemaTables={schemaTables}
          focusedTable={focusedTable}
          isRestored={isRestored}
          tableData={tableData}
          onSelectTable={handleSelectTable}
          onClearDb={handleClearDb}
        />
      </div>

      <ResizeHandle direction="horizontal" onMouseDown={sidebar.onMouseDown} />

      {/* ── Main content area ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top: visualization + execution plan */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <VizPanel
              vizTab={vizTab}
              onVizTabChange={setVizTab}
              steps={steps}
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
              currentSnapshot={currentStep?.treeSnapshot}
              isPlaying={isPlaying}
              speed={speed}
              onPlay={play}
              onPause={pause}
              onStepForward={stepForward}
              onStepBack={stepBackward}
              onReset={reset}
              onSpeedChange={setSpeed}
              pipelineStages={pipelineStages}
              activeStageName={activeStageName}
              sourceTableNames={sourceTableNames}
              lastSQL={lastSQL}
              tableData={tableData}
              schemaTables={schemaTables}
              focusedTable={focusedTable}
              onFocusedTableChange={setFocusedTable}
              treeSnapshot={treeSnapshot}
            />
          </div>

          <ResizeHandle direction="horizontal" onMouseDown={execPlan.onMouseDown} />

          <div style={{ width: execPlan.size, flexShrink: 0, overflow: 'hidden' }}>
            <ExecutionPlanPanel
              steps={steps}
              currentStepIndex={currentStepIndex}
              onSelectStep={setCurrentStepIndex}
            />
          </div>
        </div>

        {/* Horizontal resize handle between top and bottom */}
        <ResizeHandle direction="vertical" onMouseDown={bottomPanel.onMouseDown} />

        {/* Bottom: editor + results */}
        <div style={{ height: bottomPanel.size, flexShrink: 0, overflow: 'hidden' }}>
          <BottomPanel
            sql={sql}
            onSqlChange={setSql}
            onExecute={handleExecute}
            isExecuting={isExecuting}
            error={error}
            schemaTables={schemaTables}
            resultRows={resultRows as Row[]}
            resultColumns={resultColumns}
            rowsAffected={rowsAffected}
            resultsWidth={resultsPanel.size}
            onResultsResize={resultsPanel.onMouseDown}
          />
        </div>
      </div>
    </div>
  );
}
