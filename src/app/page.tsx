'use client';

import React, { useState, useEffect } from 'react';
import { useDbStore } from '@/store/dbStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { VizPanel, VizTabId } from '@/components/layout/VizPanel';
import { ExecutionPlanPanel } from '@/components/layout/ExecutionPlanPanel';
import { BottomPanel } from '@/components/layout/BottomPanel';
import { useTableData } from '@/hooks/useTableData';
import { useSourceTableNames } from '@/hooks/useSourceTableNames';
import { Row } from '@/engine/types';

export default function Home() {
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
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* Left sidebar */}
      <Sidebar
        schemaTables={schemaTables}
        focusedTable={focusedTable}
        isRestored={isRestored}
        tableData={tableData}
        onSelectTable={handleSelectTable}
        onClearDb={handleClearDb}
      />

      {/* Main content area */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr 290px', overflow: 'hidden', minWidth: 0 }}>

        {/* Top: visualization + execution plan */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', overflow: 'hidden', minHeight: 0 }}>
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
          <ExecutionPlanPanel
            steps={steps}
            currentStepIndex={currentStepIndex}
            onSelectStep={setCurrentStepIndex}
          />
        </div>

        {/* Bottom: editor + results */}
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
        />
      </div>
    </div>
  );
}
