import { SchemaManager } from './schema';
import { TableStorage } from './storage';
import { Row, SqlValue, ExecutionStep, StepType, PipelineStage, StageName, JoinPair, WhereEval } from './types';
import {
    ASTNode, InsertStmt, UpdateStmt, DeleteStmt, SelectStmt,
    CreateTableStmt, DropTableStmt, AlterTableStmt,
    CreateIndexStmt, DropIndexStmt, Expression, WhereClause,
    SelectColumn, AggregateExpr,
} from './sql/ast';

type StepEmitter = (step: Omit<ExecutionStep, 'id'>) => ExecutionStep;

// ── Aggregate helpers ─────────────────────────────────────────────────────────
function computeAggregate(fn: string, col: string, rows: Row[]): SqlValue {
    if (rows.length === 0) return fn === 'COUNT' ? 0 : null;
    if (fn === 'COUNT') return rows.length;
    const vals = rows.map(r => r[col] as number).filter(v => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    switch (fn) {
        case 'SUM': return vals.reduce((a, b) => a + b, 0);
        case 'AVG': return vals.reduce((a, b) => a + b, 0) / vals.length;
        case 'MIN': return Math.min(...vals);
        case 'MAX': return Math.max(...vals);
    }
    return null;
}

function aggKey(agg: AggregateExpr): string {
    return agg.alias ?? `${agg.fn}(${agg.col})`;
}

function makePipelineStage(name: StageName, clauseText: string, rows: Row[], allCols: string[]): PipelineStage {
    return { name, clauseText, rowCount: rows.length, sampleRows: rows, columns: allCols };
}

function makeJoinPipelineStage(
    clauseText: string,
    joinedRows: Row[],
    joinCols: string[],
    leftTableName: string,
    leftRows: Row[],
    leftColumns: string[],
    rightTableName: string,
    rightRows: Row[],
    rightColumns: string[],
    joinType: string,
    joinPairs: JoinPair[],
): PipelineStage {
    return {
        name: 'JOIN',
        clauseText,
        rowCount: joinedRows.length,
        sampleRows: joinedRows,
        columns: joinCols,
        leftTableName,
        leftRows,
        leftColumns,
        rightTableName,
        rightRows,
        rightColumns,
        joinType,
        joinPairs,
    };
}

// Resolve qualified col refs like "t.col" → "col" using alias mapping
function resolveCol(col: string, aliasMap: Record<string, string>): string {
    if (col.includes('.')) {
        const [tbl, c] = col.split('.');
        return aliasMap[tbl] ? c : col;
    }
    return col;
}

export class QueryExecutor {
    private schema: SchemaManager;
    private storages: Map<string, TableStorage>;
    private steps: ExecutionStep[] = [];
    private stepId = 0;
    private pipelineStages: PipelineStage[] = [];

    constructor(schema: SchemaManager, storages: Map<string, TableStorage>) {
        this.schema = schema;
        this.storages = storages;
    }

    async execute(ast: ASTNode): Promise<{ steps: ExecutionStep[]; rows: Row[]; columns: string[]; rowsAffected: number; pipelineStages?: PipelineStage[] }> {
        this.steps = [];
        this.stepId = 0;
        this.pipelineStages = [];

        let rows: Row[] = [];
        let columns: string[] = [];
        let rowsAffected = 0;

        const emit = this.makeEmitter();

        switch (ast.kind) {
            case 'CREATE_TABLE': this.execCreateTable(ast as CreateTableStmt, emit); break;
            case 'DROP_TABLE': this.execDropTable(ast as DropTableStmt, emit); break;
            case 'ALTER_TABLE': this.execAlterTable(ast as AlterTableStmt, emit); break;
            case 'CREATE_INDEX': await this.execCreateIndex(ast as CreateIndexStmt, emit); break;
            case 'DROP_INDEX': this.execDropIndex(ast as DropIndexStmt, emit); break;
            case 'INSERT': { rowsAffected = await this.execInsert(ast as InsertStmt, emit); break; }
            case 'UPDATE': { rowsAffected = await this.execUpdate(ast as UpdateStmt, emit); break; }
            case 'DELETE': { rowsAffected = await this.execDelete(ast as DeleteStmt, emit); break; }
            case 'SELECT': {
                const r = await this.execSelect(ast as SelectStmt, emit);
                rows = r.rows; columns = r.columns; rowsAffected = r.rows.length;
                break;
            }
        }

        return { steps: this.steps, rows, columns, rowsAffected, pipelineStages: this.pipelineStages };
    }

    // ── DDL ───────────────────────────────────────────────────────────────────
    private execCreateTable(ast: CreateTableStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning CREATE TABLE ${ast.table}` });
        const def = this.schema.createTable(ast.table, ast.columns);
        // Use the normalized name from the schema definition as the storage key
        this.storages.set(def.name, new TableStorage(def.name, def.primaryKey, 4));
        emit({ type: 'SCHEMA_CREATE', description: `Created table '${def.name}' with ${ast.columns.length} column(s). PK: '${def.primaryKey}'.`, tableName: def.name, treeSnapshot: this.storages.get(def.name)!.getPrimaryTreeSnapshot() });
    }

    private execDropTable(ast: DropTableStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning DROP TABLE ${ast.table}` });
        const normName = ast.table.toLowerCase();
        this.schema.dropTable(normName, ast.ifExists);
        this.storages.delete(normName);
        emit({ type: 'SCHEMA_DROP', description: `Dropped table '${normName}'.`, tableName: normName });
    }

    private execAlterTable(ast: AlterTableStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning ALTER TABLE ${ast.table}` });
        const action = ast.action;
        switch (action.type) {
            case 'ADD_COLUMN': this.schema.addColumn(ast.table, action.column);
                emit({ type: 'SCHEMA_ALTER', description: `Added column '${action.column.name}' to '${ast.table}'.`, tableName: ast.table }); break;
            case 'DROP_COLUMN': this.schema.dropColumn(ast.table, action.column);
                emit({ type: 'SCHEMA_ALTER', description: `Dropped column '${action.column}' from '${ast.table}'.`, tableName: ast.table }); break;
            case 'RENAME_COLUMN': this.schema.renameColumn(ast.table, action.from, action.to);
                emit({ type: 'SCHEMA_ALTER', description: `Renamed '${action.from}' → '${action.to}' in '${ast.table}'.`, tableName: ast.table }); break;
        }
    }

    private async execCreateIndex(ast: CreateIndexStmt, emit: StepEmitter): Promise<void> {
        emit({ type: 'PLAN', description: `Planning CREATE INDEX ${ast.index}` });
        this.schema.createIndex({ name: ast.index, tableName: ast.table, columns: ast.columns, unique: ast.unique });
        const storage = this.getStorage(ast.table);
        storage.addIndex(ast.index, ast.columns[0]);
        emit({ type: 'INDEX_CREATE', description: `Created index '${ast.index}' on '${ast.table}(${ast.columns.join(',')})'.`, tableName: ast.table, indexName: ast.index, treeSnapshot: storage.getIndexSnapshot(ast.index) });
    }

    private execDropIndex(ast: DropIndexStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning DROP INDEX ${ast.index}` });
        const { tableName } = this.schema.dropIndex(ast.index);
        this.storages.get(tableName)?.dropIndex(ast.index);
        emit({ type: 'INDEX_DROP', description: `Dropped index '${ast.index}'.`, tableName, indexName: ast.index });
    }

    // ── DML ───────────────────────────────────────────────────────────────────
    private async execInsert(ast: InsertStmt, emit: StepEmitter): Promise<number> {
        emit({ type: 'PLAN', description: `Planning INSERT INTO ${ast.table}` });
        const tableDef = this.schema.getTable(ast.table);
        const storage = this.getStorage(ast.table);
        const cols = ast.columns ?? tableDef.columns.map(c => c.name);
        const row: Row = {};
        cols.forEach((col, i) => { row[col] = ast.values[i] ? this.literalToValue(ast.values[i]) : null; });
        tableDef.columns.forEach(col => { if (col.name in row) row[col.name] = TableStorage.coerce(row[col.name], col.type); });
        const pk = row[tableDef.primaryKey] as string | number;
        emit({ type: 'TREE_TRAVERSE', description: `Traversing B+Tree for key=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });
        await storage.insertRow(row, {
            onVisit: async (nodeId) => { emit({ type: 'TREE_TRAVERSE', description: `Visiting node ${nodeId.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId }); },
            onSplit: async (oldId, newId) => { emit({ type: 'TREE_SPLIT', description: `Splitting node ${oldId.slice(0, 6)} → ${newId.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: oldId, newNodeId: newId }); },
        });
        emit({ type: 'TABLE_INSERT', description: `Inserted ${tableDef.primaryKey}=${pk} into '${ast.table}'.`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), affectedRowKeys: [pk] });
        return 1;
    }

    private async execUpdate(ast: UpdateStmt, emit: StepEmitter): Promise<number> {
        emit({ type: 'PLAN', description: `Planning UPDATE ${ast.table}` });
        const tableDef = this.schema.getTable(ast.table);
        const storage = this.getStorage(ast.table);
        emit({ type: 'TABLE_SCAN', description: `Scanning '${ast.table}'`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });
        const allRows = storage.scanAll();
        const matching = ast.where ? allRows.filter(r => this.evalWhere(ast.where!, r)) : allRows;
        emit({ type: 'FILTER', description: `Found ${matching.length} row(s) to update`, tableName: ast.table, affectedRowKeys: matching.map(r => r[tableDef.primaryKey] as string | number) });
        let count = 0;
        for (const row of matching) {
            const updates: Partial<Row> = {};
            for (const a of ast.assignments) updates[a.column] = this.evalExpr(a.value, row, {});
            const pk = row[tableDef.primaryKey] as string | number;
            await storage.updateRow(pk, updates, {
                onVisit: async (nodeId) => { emit({ type: 'TREE_TRAVERSE', description: `Traversing to update key=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId }); },
                onSplit: async (oldId, newId) => { emit({ type: 'TREE_SPLIT', description: `Split during update`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: oldId, newNodeId: newId }); },
            });
            emit({ type: 'TABLE_UPDATE', description: `Updated ${tableDef.primaryKey}=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), affectedRowKeys: [pk] });
            count++;
        }
        return count;
    }

    private async execDelete(ast: DeleteStmt, emit: StepEmitter): Promise<number> {
        emit({ type: 'PLAN', description: `Planning DELETE FROM ${ast.table}` });
        const tableDef = this.schema.getTable(ast.table);
        const storage = this.getStorage(ast.table);
        emit({ type: 'TABLE_SCAN', description: `Scanning '${ast.table}'`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });
        const allRows = storage.scanAll();
        const matching = ast.where ? allRows.filter(r => this.evalWhere(ast.where!, r)) : allRows;
        emit({ type: 'FILTER', description: `${matching.length} row(s) to delete`, tableName: ast.table, affectedRowKeys: matching.map(r => r[tableDef.primaryKey] as string | number) });
        let count = 0;
        for (const row of matching) {
            const pk = row[tableDef.primaryKey] as string | number;
            await storage.deleteRow(pk, {
                onVisit: async (id) => { emit({ type: 'TREE_TRAVERSE', description: `Traversing to delete ${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: id }); },
                onDelete: async (id) => { emit({ type: 'TREE_DELETE', description: `Deleted key ${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: id }); },
                onMerge: async (l, r) => { emit({ type: 'TREE_MERGE', description: `Merging ${l.slice(0, 6)} ← ${r.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: l, newNodeId: r }); },
            });
            emit({ type: 'TABLE_DELETE', description: `Deleted ${tableDef.primaryKey}=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), affectedRowKeys: [pk] });
            count++;
        }
        return count;
    }

    // ── SELECT  ──────────────────────────────────────────────────────────────
    private async execSelect(ast: SelectStmt, emit: StepEmitter): Promise<{ rows: Row[]; columns: string[] }> {
        emit({ type: 'PLAN', description: `Planning SELECT from ${ast.from}` });
        this.pipelineStages = [];

        const tableDef = this.schema.getTable(ast.from);
        const storage = this.getStorage(ast.from);

        // Build alias → tableName map for qualified column resolution
        const aliasMap: Record<string, string> = { [ast.from]: ast.from };
        if (ast.fromAlias) aliasMap[ast.fromAlias] = ast.from;
        (ast.joins ?? []).forEach(j => { aliasMap[j.alias ?? j.table] = j.table; });

        // ── STAGE 1: FROM ────────────────────────────────────────────────────
        emit({ type: 'TABLE_SCAN', description: `Reading all rows from '${ast.from}'`, tableName: ast.from, treeSnapshot: storage.getPrimaryTreeSnapshot(), activeStageName: 'FROM' });
        let rows = storage.scanAll();
        const fromCols = tableDef.columns.map(c => c.name);
        this.pipelineStages.push(makePipelineStage('FROM', `FROM ${ast.from}${ast.fromAlias ? ' ' + ast.fromAlias : ''}`, rows, fromCols));

        // ── STAGE 2: JOINs ───────────────────────────────────────────────────
        if (ast.joins && ast.joins.length > 0) {
            for (const join of ast.joins) {
                const rightStorage = this.getStorage(join.table);
                const rightRows = rightStorage.scanAll();
                const rightDef = this.schema.getTable(join.table);
                const rightAlias = join.alias ?? join.table;

                const joined: Row[] = [];
                const joinPairs: JoinPair[] = [];

                for (const left of rows) {
                    let leftMatched = false;
                    for (const right of rightRows) {
                        // Prefix right columns to avoid collision with alias
                        const prefixedRight: Row = {};
                        Object.keys(right).forEach(k => {
                            prefixedRight[`${rightAlias}.${k}`] = right[k];
                            prefixedRight[k] = right[k]; // also bare name
                        });
                        const combined = { ...left, ...prefixedRight };
                        const cond = join.on ? this.evalWhere(join.on, combined) : true;
                        if (cond) {
                            joined.push(combined);
                            leftMatched = true;
                            joinPairs.push({ leftRow: left, rightRow: right, matched: true, resultRow: combined });
                        } else {
                            joinPairs.push({ leftRow: left, rightRow: right, matched: false });
                        }
                    }
                    if (join.type === 'LEFT' && !leftMatched) {
                        // LEFT JOIN: add left row with nulls for right
                        const nullRight: Row = {};
                        rightDef.columns.forEach(c => { nullRight[c.name] = null; nullRight[`${rightAlias}.${c.name}`] = null; });
                        const nullRow = { ...left, ...nullRight };
                        joined.push(nullRow);
                        joinPairs.push({ leftRow: left, rightRow: null, matched: true, resultRow: nullRow });
                    }
                    if (join.type === 'LEFT' && rightRows.length === 0) {
                        const nullRight: Row = {};
                        rightDef.columns.forEach(c => { nullRight[c.name] = null; });
                        const nullRow = { ...left, ...nullRight };
                        joined.push(nullRow);
                        joinPairs.push({ leftRow: left, rightRow: null, matched: true, resultRow: nullRow });
                    }
                }
                rows = joined;
                const joinCols = [...fromCols, ...rightDef.columns.map(c => c.name)];
                // Capture left rows (before join) from current `rows` snapshot
                const leftRowsSnapshot = storage.scanAll();
                const leftColsSnapshot = tableDef.columns.map(c => c.name);
                const rightColsSnapshot = rightDef.columns.map(c => c.name);
                this.pipelineStages.push(makeJoinPipelineStage(
                    `${join.type} JOIN ${join.table}${join.alias ? ' ' + join.alias : ''} ON ...`,
                    rows,
                    joinCols,
                    ast.from,
                    leftRowsSnapshot,
                    leftColsSnapshot,
                    join.table,
                    rightRows,
                    rightColsSnapshot,
                    join.type,
                    joinPairs,
                ));
                emit({ type: 'TABLE_SCAN', description: `${join.type} JOIN '${join.table}': ${rows.length} rows after join`, tableName: join.table, activeStageName: 'JOIN' });
            }
        }

        const workingCols = rows.length > 0 ? Object.keys(rows[0]) : fromCols;

        // ── STAGE 3: WHERE ───────────────────────────────────────────────────
        if (ast.where) {
            const condText = this.clauseText(ast.where);
            const allWhereRows = [...rows];
            const whereEvals: WhereEval[] = allWhereRows.map(r => ({
                row: r,
                passed: this.evalWhere(ast.where!, r),
                conditionText: condText,
            }));
            const before = rows.length;
            rows = rows.filter(r => this.evalWhere(ast.where!, r));
            const stage = makePipelineStage('WHERE', condText, rows, workingCols);
            stage.whereEvals = whereEvals;
            this.pipelineStages.push(stage);
            emit({ type: 'FILTER', description: `WHERE filter: ${before} → ${rows.length} row(s)`, tableName: ast.from, affectedRowKeys: rows.map(r => r[tableDef.primaryKey] as string | number).filter(Boolean), activeStageName: 'WHERE' });
        }

        // ── STAGE 4: GROUP BY ────────────────────────────────────────────────
        // Extract aggregate columns from SELECT
        const aggCols = ast.columns.filter((c): c is AggregateExpr => c.kind === 'aggregate');
        const hasAggregates = aggCols.length > 0 || !!ast.groupBy;

        let groupedRows: Row[] = rows;
        let outputCols: string[] = workingCols;

        if (hasAggregates) {
            const groupKeys = ast.groupBy ?? [];
            const groups = new Map<string, Row[]>();

            if (groupKeys.length === 0) {
                // single group for aggregating everything
                groups.set('__all__', rows);
            } else {
                for (const row of rows) {
                    const key = groupKeys.map(k => String(row[resolveCol(k, aliasMap)] ?? 'null')).join('|~|');
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(row);
                }
            }

            // Build output rows: one per group
            groupedRows = [];
            groups.forEach((groupRows) => {
                const out: Row = {};
                // Keep group-by column values
                groupKeys.forEach(k => { const rk = resolveCol(k, aliasMap); out[rk] = groupRows[0][rk] ?? null; });
                // Compute aggregates
                aggCols.forEach(agg => {
                    const colName = agg.col === '*' ? '' : resolveCol(agg.col, aliasMap);
                    out[aggKey(agg)] = computeAggregate(agg.fn, colName, groupRows);
                });
                groupedRows.push(out);
            });

            outputCols = [...groupKeys.map(k => resolveCol(k, aliasMap)), ...aggCols.map(aggKey)];
            this.pipelineStages.push(makePipelineStage('GROUP BY', ast.groupBy ? `GROUP BY ${ast.groupBy.join(', ')}` : 'Aggregate (no GROUP BY)', groupedRows, outputCols));
            emit({ type: 'GROUP_BY', description: `GROUP BY ${groupKeys.join(', ') || '(all)'}: ${groups.size} group(s)`, tableName: ast.from, activeStageName: 'GROUP BY' });
            rows = groupedRows;
        }

        // ── STAGE 5: HAVING ──────────────────────────────────────────────────
        if (ast.having) {
            const havingText = this.clauseText(ast.having);
            const allHavingRows = [...rows];
            const havingEvals: WhereEval[] = allHavingRows.map(r => ({
                row: r,
                passed: this.evalWhere(ast.having!, r),
                conditionText: havingText,
            }));
            const before = rows.length;
            // Re-evaluate aggregate expressions in HAVING by substituting column values
            rows = rows.filter(r => this.evalWhere(ast.having!, r));
            const havingStage = makePipelineStage('HAVING', havingText, rows, outputCols);
            havingStage.whereEvals = havingEvals;
            this.pipelineStages.push(havingStage);
            emit({ type: 'HAVING', description: `HAVING filter: ${before} → ${rows.length} row(s)`, tableName: ast.from, activeStageName: 'HAVING' });
        }

        // ── STAGE 6: SELECT (project) ────────────────────────────────────────
        let finalCols: string[];
        if (ast.columns.some(c => c.kind === 'star')) {
            finalCols = outputCols.length > 0 ? outputCols : (tableDef.columns.map(c => c.name));
        } else {
            finalCols = (ast.columns as SelectColumn[]).map(c => {
                if (c.kind === 'aggregate') return aggKey(c);
                // Strip table alias qualifier (u.name → name) when no explicit alias given,
                // matching standard SQL output behaviour.
                if (c.kind === 'column') return c.alias ?? resolveCol(c.name, aliasMap);
                return '*';
            }).filter(c => c !== '*');
        }

        const projected = rows.map(r => {
            if (ast.columns.some(c => c.kind === 'star')) return r;
            const out: Row = {};
            (ast.columns as SelectColumn[]).forEach(c => {
                if (c.kind === 'aggregate') { const k = aggKey(c); out[k] = r[k]; }
                else if (c.kind === 'column') {
                    const resolved = resolveCol(c.name, aliasMap);
                    // Use alias if provided, otherwise the resolved (bare) column name
                    const key = c.alias ?? resolved;
                    out[key] = r[resolved] ?? r[c.name] ?? null;
                }
            });
            return out;
        });

        this.pipelineStages.push(makePipelineStage('SELECT', ast.columns.some(c => c.kind === 'star') ? 'SELECT *' : `SELECT ${finalCols.join(', ')}`, projected, finalCols));
        emit({ type: 'RESULT', description: `SELECT projects ${finalCols.length} column(s).`, tableName: ast.from, activeStageName: 'SELECT' });

        rows = projected;

        // ── STAGE 7: ORDER BY ────────────────────────────────────────────────
        if (ast.orderBy && ast.orderBy.length > 0) {
            rows = [...rows].sort((a, b) => {
                for (const o of ast.orderBy!) {
                    // Resolve table-qualified refs (e.g. u.name → name) before lookup;
                    // after SELECT the rows use projected column names / aliases.
                    const col = resolveCol(o.column, aliasMap);
                    const aVal = a[col] ?? a[o.column];
                    const bVal = b[col] ?? b[o.column];
                    const cmp = aVal == null ? -1 : bVal == null ? 1 : aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                    if (cmp !== 0) return o.direction === 'ASC' ? cmp : -cmp;
                }
                return 0;
            });
            this.pipelineStages.push(makePipelineStage('ORDER BY', `ORDER BY ${ast.orderBy.map(o => `${resolveCol(o.column, aliasMap)} ${o.direction}`).join(', ')}`, rows, finalCols));
            emit({ type: 'SORT', description: `Sorted by ${ast.orderBy.map(o => `${resolveCol(o.column, aliasMap)} ${o.direction}`).join(', ')}`, tableName: ast.from, activeStageName: 'ORDER BY' });
        }

        // ── STAGE 8: LIMIT ───────────────────────────────────────────────────
        if (ast.limit !== undefined) {
            rows = rows.slice(0, ast.limit);
            this.pipelineStages.push(makePipelineStage('LIMIT', `LIMIT ${ast.limit}`, rows, finalCols));
            emit({ type: 'FILTER', description: `LIMIT ${ast.limit}: returning ${rows.length} row(s)`, tableName: ast.from, activeStageName: 'LIMIT' });
        }

        emit({ type: 'RESULT', description: `Query complete. ${rows.length} row(s) returned.`, tableName: ast.from, resultRows: rows, resultColumns: finalCols, treeSnapshot: storage.getPrimaryTreeSnapshot(), activeStageName: 'SELECT', pipelineStages: [...this.pipelineStages] });

        return { rows, columns: finalCols };
    }

    // ── Expression evaluation ─────────────────────────────────────────────────
    private evalWhere(expr: WhereClause, row: Row): boolean {
        return Boolean(this.evalExpr(expr, row, {}));
    }

    private evalExpr(expr: Expression, row: Row, _ctx: Record<string, unknown>): SqlValue {
        switch (expr.kind) {
            case 'literal': return expr.value;
            case 'column_ref': {
                // Try table.col (qualified), then bare col, then case-insensitive fallback
                const qualified = expr.table ? `${expr.table}.${expr.column}` : expr.column;
                const colLower = expr.column.toLowerCase();
                if (qualified in row) return row[qualified];
                if (expr.column in row) return row[expr.column];
                // case-insensitive scan
                const key = Object.keys(row).find(k => k.toLowerCase() === colLower || k.toLowerCase() === qualified.toLowerCase());
                return key !== undefined ? row[key] : null;
            }
            case 'aggregate': {
                // In HAVING/ORDER BY, the aggregate result is already in the row
                const k = aggKey(expr);
                return row[k] ?? null;
            }
            case 'binary': {
                const left = this.evalExpr(expr.left, row, _ctx);
                const right = this.evalExpr(expr.right, row, _ctx);
                switch (expr.op) {
                    case '=': return left === right ? 1 : 0;
                    case '!=': return left !== right ? 1 : 0;
                    case '<': return (left as number) < (right as number) ? 1 : 0;
                    case '>': return (left as number) > (right as number) ? 1 : 0;
                    case '<=': return (left as number) <= (right as number) ? 1 : 0;
                    case '>=': return (left as number) >= (right as number) ? 1 : 0;
                    case 'AND': return (left && right) ? 1 : 0;
                    case 'OR': return (left || right) ? 1 : 0;
                    case 'LIKE': {
                        const pattern = String(right).replace(/%/g, '.*').replace(/_/g, '.');
                        return new RegExp(`^${pattern}$`, 'i').test(String(left)) ? 1 : 0;
                    }
                }
                break;
            }
            case 'unary': {
                const val = this.evalExpr(expr.operand, row, _ctx);
                switch (expr.op) {
                    case 'NOT': return val ? 0 : 1;
                    case 'IS NULL': return val === null ? 1 : 0;
                    case 'IS NOT NULL': return val !== null ? 1 : 0;
                }
                break;
            }
        }
        return null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private clauseText(expr: Expression): string {
        switch (expr.kind) {
            case 'literal': return String(expr.value);
            case 'column_ref': return expr.table ? `${expr.table}.${expr.column}` : expr.column;
            case 'aggregate': return `${expr.fn}(${expr.col})`;
            case 'binary': return `${this.clauseText(expr.left)} ${expr.op} ${this.clauseText(expr.right)}`;
            case 'unary': return `${this.clauseText(expr.operand)} ${expr.op}`;
        }
        return '';
    }

    private literalToValue(lit: { kind: string; value?: string | number }): SqlValue {
        if (lit.kind === 'null') return null;
        return lit.value as SqlValue;
    }

    private getStorage(tableName: string): TableStorage {
        const normName = tableName.toLowerCase();
        const s = this.storages.get(normName);
        if (!s) throw new Error(`No storage for table '${normName}'`);
        return s;
    }

    private makeEmitter(): StepEmitter {
        return (step) => {
            const full: ExecutionStep = { id: this.stepId++, ...step } as ExecutionStep;
            this.steps.push(full);
            return full;
        };
    }
}

export type { StepType };
