import { SchemaManager } from './schema';
import { TableStorage } from './storage';
import { Row, SqlValue, ExecutionStep, StepType } from './types';
import {
    ASTNode, InsertStmt, UpdateStmt, DeleteStmt, SelectStmt,
    CreateTableStmt, DropTableStmt, AlterTableStmt,
    CreateIndexStmt, DropIndexStmt, Expression, WhereClause,
} from './sql/ast';

type StepEmitter = (step: Omit<ExecutionStep, 'id'>) => ExecutionStep;

export class QueryExecutor {
    private schema: SchemaManager;
    private storages: Map<string, TableStorage>;
    private steps: ExecutionStep[] = [];
    private stepId = 0;

    constructor(schema: SchemaManager, storages: Map<string, TableStorage>) {
        this.schema = schema;
        this.storages = storages;
    }

    // ── Execute ────────────────────────────────────────────────────────────────
    async execute(ast: ASTNode): Promise<{ steps: ExecutionStep[]; rows: Row[]; columns: string[]; rowsAffected: number }> {
        this.steps = [];
        this.stepId = 0;

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
            case 'INSERT': {
                const r = await this.execInsert(ast as InsertStmt, emit);
                rowsAffected = r;
                break;
            }
            case 'UPDATE': {
                const r = await this.execUpdate(ast as UpdateStmt, emit);
                rowsAffected = r;
                break;
            }
            case 'DELETE': {
                const r = await this.execDelete(ast as DeleteStmt, emit);
                rowsAffected = r;
                break;
            }
            case 'SELECT': {
                const r = await this.execSelect(ast as SelectStmt, emit);
                rows = r.rows;
                columns = r.columns;
                rowsAffected = r.rows.length;
                break;
            }
        }

        return { steps: this.steps, rows, columns, rowsAffected };
    }

    // ── DDL ───────────────────────────────────────────────────────────────────
    private execCreateTable(ast: CreateTableStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning CREATE TABLE ${ast.table}` });
        const def = this.schema.createTable(ast.table, ast.columns);
        this.storages.set(ast.table, new TableStorage(ast.table, def.primaryKey, 4));
        emit({
            type: 'SCHEMA_CREATE',
            description: `Created table '${ast.table}' with ${ast.columns.length} column(s). Primary key: '${def.primaryKey}'.`,
            tableName: ast.table,
            treeSnapshot: this.storages.get(ast.table)!.getPrimaryTreeSnapshot(),
        });
    }

    private execDropTable(ast: DropTableStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning DROP TABLE ${ast.table}` });
        this.schema.dropTable(ast.table, ast.ifExists);
        this.storages.delete(ast.table);
        emit({ type: 'SCHEMA_DROP', description: `Dropped table '${ast.table}'.`, tableName: ast.table });
    }

    private execAlterTable(ast: AlterTableStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning ALTER TABLE ${ast.table}` });
        const action = ast.action;
        switch (action.type) {
            case 'ADD_COLUMN':
                this.schema.addColumn(ast.table, action.column);
                emit({ type: 'SCHEMA_ALTER', description: `Added column '${action.column.name}' (${action.column.type}) to '${ast.table}'.`, tableName: ast.table });
                break;
            case 'DROP_COLUMN':
                this.schema.dropColumn(ast.table, action.column);
                emit({ type: 'SCHEMA_ALTER', description: `Dropped column '${action.column}' from '${ast.table}'.`, tableName: ast.table });
                break;
            case 'RENAME_COLUMN':
                this.schema.renameColumn(ast.table, action.from, action.to);
                emit({ type: 'SCHEMA_ALTER', description: `Renamed column '${action.from}' to '${action.to}' in '${ast.table}'.`, tableName: ast.table });
                break;
        }
    }

    private async execCreateIndex(ast: CreateIndexStmt, emit: StepEmitter): Promise<void> {
        emit({ type: 'PLAN', description: `Planning CREATE INDEX ${ast.index} on ${ast.table}(${ast.columns.join(', ')})` });
        const def = this.schema.createIndex({ name: ast.index, tableName: ast.table, columns: ast.columns, unique: ast.unique });
        const storage = this.getStorage(ast.table);
        storage.addIndex(ast.index, ast.columns[0]);
        emit({
            type: 'INDEX_CREATE',
            description: `Created ${ast.unique ? 'unique ' : ''}index '${ast.index}' on '${ast.table}(${ast.columns.join(',')})'. Populated ${storage.size} existing rows.`,
            tableName: ast.table,
            indexName: ast.index,
            treeSnapshot: storage.getIndexSnapshot(ast.index),
        });
        void def;
    }

    private execDropIndex(ast: DropIndexStmt, emit: StepEmitter): void {
        emit({ type: 'PLAN', description: `Planning DROP INDEX ${ast.index}` });
        const { tableName } = this.schema.dropIndex(ast.index);
        const storage = this.storages.get(tableName);
        storage?.dropIndex(ast.index);
        emit({ type: 'INDEX_DROP', description: `Dropped index '${ast.index}'.`, tableName, indexName: ast.index });
    }

    // ── DML ───────────────────────────────────────────────────────────────────
    private async execInsert(ast: InsertStmt, emit: StepEmitter): Promise<number> {
        emit({ type: 'PLAN', description: `Planning INSERT INTO ${ast.table}` });
        const tableDef = this.schema.getTable(ast.table);
        const storage = this.getStorage(ast.table);
        const cols = ast.columns ?? tableDef.columns.map(c => c.name);

        const row: Row = {};
        cols.forEach((col, i) => {
            const litNode = ast.values[i];
            row[col] = litNode ? this.literalToValue(litNode) : null;
        });

        // Coerce types
        tableDef.columns.forEach(col => {
            if (col.name in row) row[col.name] = TableStorage.coerce(row[col.name], col.type);
        });

        const pk = row[tableDef.primaryKey] as string | number;

        emit({ type: 'TREE_TRAVERSE', description: `Traversing B+Tree to find insert position for key=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });

        const visitedNodes: string[] = [];
        let lastSplit: { oldId: string; newId: string } | null = null;

        await storage.insertRow(row, {
            onVisit: async (nodeId) => {
                visitedNodes.push(nodeId);
                emit({ type: 'TREE_TRAVERSE', description: `Visiting node ${nodeId.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId });
            },
            onSplit: async (oldId, newId) => {
                lastSplit = { oldId, newId };
                emit({ type: 'TREE_SPLIT', description: `Node overflow — splitting node ${oldId.slice(0, 6)} → ${newId.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: oldId, newNodeId: newId });
            },
        });

        emit({
            type: 'TABLE_INSERT',
            description: `Inserted row with ${tableDef.primaryKey}=${pk} into '${ast.table}'.`,
            tableName: ast.table,
            treeSnapshot: storage.getPrimaryTreeSnapshot(),
            affectedRowKeys: [pk],
        });

        void lastSplit;
        return 1;
    }

    private async execUpdate(ast: UpdateStmt, emit: StepEmitter): Promise<number> {
        emit({ type: 'PLAN', description: `Planning UPDATE ${ast.table}` });
        const tableDef = this.schema.getTable(ast.table);
        const storage = this.getStorage(ast.table);

        emit({ type: 'TABLE_SCAN', description: `Full scan of '${ast.table}' to find rows matching WHERE clause`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });

        const allRows = storage.scanAll();
        const matching = ast.where ? allRows.filter(r => this.evalWhere(ast.where!, r)) : allRows;

        emit({ type: 'FILTER', description: `Found ${matching.length} row(s) matching WHERE clause`, tableName: ast.table, affectedRowKeys: matching.map(r => r[tableDef.primaryKey] as string | number) });

        let count = 0;
        for (const row of matching) {
            const updates: Partial<Row> = {};
            for (const a of ast.assignments) {
                updates[a.column] = this.evalExpr(a.value, row);
            }
            const pk = row[tableDef.primaryKey] as string | number;
            await storage.updateRow(pk, updates, {
                onVisit: async (nodeId) => {
                    emit({ type: 'TREE_TRAVERSE', description: `Traversing to update key=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId });
                },
                onSplit: async (oldId, newId) => {
                    emit({ type: 'TREE_SPLIT', description: `Split during update`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: oldId, newNodeId: newId });
                },
            });
            emit({ type: 'TABLE_UPDATE', description: `Updated row ${tableDef.primaryKey}=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), affectedRowKeys: [pk] });
            count++;
        }
        return count;
    }

    private async execDelete(ast: DeleteStmt, emit: StepEmitter): Promise<number> {
        emit({ type: 'PLAN', description: `Planning DELETE FROM ${ast.table}` });
        const tableDef = this.schema.getTable(ast.table);
        const storage = this.getStorage(ast.table);

        emit({ type: 'TABLE_SCAN', description: `Scanning '${ast.table}' to find rows to delete`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });

        const allRows = storage.scanAll();
        const matching = ast.where ? allRows.filter(r => this.evalWhere(ast.where!, r)) : allRows;

        emit({ type: 'FILTER', description: `${matching.length} row(s) to delete`, tableName: ast.table, affectedRowKeys: matching.map(r => r[tableDef.primaryKey] as string | number) });

        let count = 0;
        for (const row of matching) {
            const pk = row[tableDef.primaryKey] as string | number;
            await storage.deleteRow(pk, {
                onVisit: async (nodeId) => {
                    emit({ type: 'TREE_TRAVERSE', description: `Traversing to delete key=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId });
                },
                onDelete: async (nodeId) => {
                    emit({ type: 'TREE_DELETE', description: `Deleted key ${pk} from node ${nodeId.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId });
                },
                onMerge: async (leftId, rightId) => {
                    emit({ type: 'TREE_MERGE', description: `Merging node ${leftId.slice(0, 6)} with ${rightId.slice(0, 6)} after underflow`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: leftId, newNodeId: rightId });
                },
            });
            emit({ type: 'TABLE_DELETE', description: `Deleted row ${tableDef.primaryKey}=${pk} from '${ast.table}'.`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), affectedRowKeys: [pk] });
            count++;
        }
        return count;
    }

    private async execSelect(ast: SelectStmt, emit: StepEmitter): Promise<{ rows: Row[]; columns: string[] }> {
        emit({ type: 'PLAN', description: `Planning SELECT from ${ast.from}` });
        const tableDef = this.schema.getTable(ast.from);
        const storage = this.getStorage(ast.from);

        emit({ type: 'TABLE_SCAN', description: `Sequential scan of '${ast.from}'`, tableName: ast.from, treeSnapshot: storage.getPrimaryTreeSnapshot() });

        let rows = storage.scanAll();

        // JOIN (nested loop)
        if (ast.join) {
            const rightStorage = this.getStorage(ast.join.table);
            const rightRows = rightStorage.scanAll();
            const joined: Row[] = [];
            for (const left of rows) {
                for (const right of rightRows) {
                    const combined = { ...left, ...right };
                    if (this.evalWhere(ast.join.on, combined)) joined.push(combined);
                }
            }
            rows = joined;
            emit({ type: 'TABLE_SCAN', description: `Nested loop join with '${ast.join.table}': ${rows.length} combined rows`, tableName: ast.join.table });
        }

        // WHERE
        if (ast.where) {
            const before = rows.length;
            rows = rows.filter(r => this.evalWhere(ast.where!, r));
            emit({ type: 'FILTER', description: `WHERE filter: ${before} → ${rows.length} row(s)`, tableName: ast.from, affectedRowKeys: rows.map(r => r[tableDef.primaryKey] as string | number) });
        }

        // ORDER BY
        if (ast.orderBy && ast.orderBy.length > 0) {
            rows = rows.slice().sort((a, b) => {
                for (const o of ast.orderBy!) {
                    const aVal = a[o.column];
                    const bVal = b[o.column];
                    const cmp = aVal == null ? -1 : bVal == null ? 1 : aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                    if (cmp !== 0) return o.direction === 'ASC' ? cmp : -cmp;
                }
                return 0;
            });
            emit({ type: 'SORT', description: `Sorted by ${ast.orderBy.map(o => `${o.column} ${o.direction}`).join(', ')}`, tableName: ast.from });
        }

        // LIMIT
        if (ast.limit !== undefined) {
            rows = rows.slice(0, ast.limit);
            emit({ type: 'FILTER', description: `LIMIT ${ast.limit}: returning first ${rows.length} row(s)`, tableName: ast.from });
        }

        // Project columns
        let columns: string[];
        if (ast.columns.some(c => c.kind === 'star')) {
            columns = tableDef.columns.map(c => c.name);
        } else {
            columns = ast.columns.filter(c => c.kind === 'column').map(c => (c as { kind: 'column'; name: string; alias?: string }).alias ?? (c as { kind: 'column'; name: string }).name);
        }
        const projected = rows.map(r => {
            if (ast.columns.some(c => c.kind === 'star')) return r;
            const out: Row = {};
            ast.columns.forEach(c => {
                if (c.kind === 'column') {
                    const alias = (c as { kind: 'column'; name: string; alias?: string }).alias;
                    const name = (c as { kind: 'column'; name: string }).name;
                    out[alias ?? name] = r[name];
                }
            });
            return out;
        });

        emit({ type: 'RESULT', description: `Query complete. Returning ${projected.length} row(s).`, tableName: ast.from, resultRows: projected, resultColumns: columns, treeSnapshot: storage.getPrimaryTreeSnapshot() });

        return { rows: projected, columns };
    }

    // ── WHERE evaluation ──────────────────────────────────────────────────────
    private evalWhere(expr: WhereClause, row: Row): boolean {
        return Boolean(this.evalExpr(expr, row));
    }

    private evalExpr(expr: Expression, row: Row): SqlValue {
        switch (expr.kind) {
            case 'literal':
                return expr.value;
            case 'column_ref':
                return row[expr.column] ?? null;
            case 'binary': {
                const left = this.evalExpr(expr.left, row);
                const right = this.evalExpr(expr.right, row);
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
                const operand = this.evalExpr(expr.operand, row);
                switch (expr.op) {
                    case 'NOT': return operand ? 0 : 1;
                    case 'IS NULL': return operand === null ? 1 : 0;
                    case 'IS NOT NULL': return operand !== null ? 1 : 0;
                }
                break;
            }
        }
        return null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private literalToValue(lit: { kind: string; value?: string | number }): SqlValue {
        if (lit.kind === 'null') return null;
        return lit.value as SqlValue;
    }

    private getStorage(tableName: string): TableStorage {
        const s = this.storages.get(tableName);
        if (!s) throw new Error(`No storage for table '${tableName}'`);
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

// Re-export StepType for convenience
export type { StepType };
