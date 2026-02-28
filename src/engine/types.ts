// ─── Primitive SQL Values ───────────────────────────────────────────────────
export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

// ─── Schema Types ────────────────────────────────────────────────────────────
export type SqlType = 'INT' | 'TEXT' | 'FLOAT' | 'BOOLEAN';

export interface ColumnDef {
  name: string;
  type: SqlType;
  primaryKey: boolean;
  nullable: boolean;
  defaultValue?: SqlValue;
}

export interface IndexDef {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  primaryKey: string;
  indexes: IndexDef[];
}

// ─── B+Tree Snapshot ─────────────────────────────────────────────────────────
export interface TreeNodeSnapshot {
  id: string;
  isLeaf: boolean;
  keys: (string | number)[];
  children: string[];
  nextLeaf: string | null;
  parentId: string | null;
}

export interface TreeSnapshot {
  rootId: string;
  order: number;
  nodes: Record<string, TreeNodeSnapshot>;
}

// ─── Pipeline Stage (for execution flow visualization) ───────────────────────
export type StageName = 'FROM' | 'JOIN' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'ORDER BY' | 'LIMIT' | 'SELECT';

export interface PipelineStage {
  name: StageName;
  clauseText: string;           // the SQL fragment e.g. "age > 27"
  rowCount: number;
  sampleRows: Row[];            // all rows for this stage
  columns: string[];
  active?: boolean;             // is this the currently executing stage?
  // For JOIN stages: individual table data shown side by side
  leftTableName?: string;
  leftRows?: Row[];
  leftColumns?: string[];
  rightTableName?: string;
  rightRows?: Row[];
  rightColumns?: string[];
}

// ─── Execution Step Types ────────────────────────────────────────────────────
export type StepType =
  | 'PARSE'
  | 'PLAN'
  | 'SCHEMA_CREATE'
  | 'SCHEMA_DROP'
  | 'SCHEMA_ALTER'
  | 'INDEX_CREATE'
  | 'INDEX_DROP'
  | 'TREE_TRAVERSE'
  | 'TREE_INSERT'
  | 'TREE_SPLIT'
  | 'TREE_DELETE'
  | 'TREE_MERGE'
  | 'TABLE_SCAN'
  | 'TABLE_INSERT'
  | 'TABLE_UPDATE'
  | 'TABLE_DELETE'
  | 'FILTER'
  | 'GROUP_BY'
  | 'HAVING'
  | 'SORT'
  | 'RESULT';

export interface ExecutionStep {
  id: number;
  type: StepType;
  description: string;
  tableName?: string;
  indexName?: string;
  treeSnapshot?: TreeSnapshot;
  highlightedNodeId?: string;
  newNodeId?: string;
  affectedRowKeys?: (string | number)[];
  resultRows?: Row[];
  resultColumns?: string[];
  sql?: string;
  // Pipeline stage snapshot at this step
  activeStageName?: StageName;
  pipelineStages?: PipelineStage[];
}

export interface ExecutionResult {
  steps: ExecutionStep[];
  resultRows: Row[];
  resultColumns: string[];
  rowsAffected: number;
  pipelineStages?: PipelineStage[];   // final pipeline for SELECT queries
  error?: string;
}
