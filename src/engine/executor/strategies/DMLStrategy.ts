import { IExecutorStrategy, ExecutionResult } from './IExecutorStrategy';
import { ExecutionContext } from '../ExecutionContext';
import { InsertStmt, UpdateStmt, DeleteStmt } from '../../sql/ast';
import { Row } from '../../types';
import { TableStorage } from '../../storage';
import { ExpressionEvaluator } from '../ExpressionEvaluator';

export class InsertStrategy implements IExecutorStrategy<InsertStmt> {
    async execute(ast: InsertStmt, ctx: ExecutionContext): Promise<ExecutionResult> {
        ctx.emit({ type: 'PLAN', description: `Planning INSERT INTO ${ast.table}` });
        const tableDef = ctx.schema.getTable(ast.table);
        const storage = ctx.getStorage(ast.table);
        const cols = ast.columns ?? tableDef.columns.map(c => c.name);

        const row: Row = {};
        cols.forEach((col, i) => {
            row[col] = ast.values[i] ? ExpressionEvaluator.literalToValue(ast.values[i]) : null;
        });

        tableDef.columns.forEach(col => {
            if (col.name in row) row[col.name] = TableStorage.coerce(row[col.name], col.type);
        });

        const pk = row[tableDef.primaryKey] as string | number;
        ctx.emit({
            type: 'TREE_TRAVERSE',
            description: `Traversing B+Tree for key=${pk}`,
            tableName: ast.table,
            treeSnapshot: storage.getPrimaryTreeSnapshot()
        });

        await storage.insertRow(row, {
            onVisit: async (nodeId) => {
                ctx.emit({ type: 'TREE_TRAVERSE', description: `Visiting node ${nodeId.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId });
            },
            onSplit: async (oldId, newId) => {
                ctx.emit({ type: 'TREE_SPLIT', description: `Splitting node ${oldId.slice(0, 6)} → ${newId.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: oldId, newNodeId: newId });
            },
        });

        ctx.emit({
            type: 'TABLE_INSERT',
            description: `Inserted ${tableDef.primaryKey}=${pk} into '${ast.table}'.`,
            tableName: ast.table,
            treeSnapshot: storage.getPrimaryTreeSnapshot(),
            affectedRowKeys: [pk]
        });

        return { rowsAffected: 1 };
    }
}

export class UpdateStrategy implements IExecutorStrategy<UpdateStmt> {
    async execute(ast: UpdateStmt, ctx: ExecutionContext): Promise<ExecutionResult> {
        ctx.emit({ type: 'PLAN', description: `Planning UPDATE ${ast.table}` });
        const tableDef = ctx.schema.getTable(ast.table);
        const storage = ctx.getStorage(ast.table);

        ctx.emit({ type: 'TABLE_SCAN', description: `Scanning '${ast.table}'`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });
        const allRows = storage.scanAll();
        const matching = ast.where ? allRows.filter(r => ExpressionEvaluator.evalWhere(ast.where!, r)) : allRows;

        ctx.emit({
            type: 'FILTER',
            description: `Found ${matching.length} row(s) to update`,
            tableName: ast.table,
            affectedRowKeys: matching.map(r => r[tableDef.primaryKey] as string | number)
        });

        let count = 0;
        for (const row of matching) {
            const updates: Partial<Row> = {};
            for (const a of ast.assignments) {
                updates[a.column] = ExpressionEvaluator.evalExpr(a.value, row, {});
            }
            const pk = row[tableDef.primaryKey] as string | number;
            await storage.updateRow(pk, updates, {
                onVisit: async (nodeId) => { ctx.emit({ type: 'TREE_TRAVERSE', description: `Traversing to update key=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: nodeId }); },
                onSplit: async (oldId, newId) => { ctx.emit({ type: 'TREE_SPLIT', description: `Split during update`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: oldId, newNodeId: newId }); },
            });
            ctx.emit({
                type: 'TABLE_UPDATE',
                description: `Updated ${tableDef.primaryKey}=${pk}`,
                tableName: ast.table,
                treeSnapshot: storage.getPrimaryTreeSnapshot(),
                affectedRowKeys: [pk]
            });
            count++;
        }

        return { rowsAffected: count };
    }
}

export class DeleteStrategy implements IExecutorStrategy<DeleteStmt> {
    async execute(ast: DeleteStmt, ctx: ExecutionContext): Promise<ExecutionResult> {
        ctx.emit({ type: 'PLAN', description: `Planning DELETE FROM ${ast.table}` });
        const tableDef = ctx.schema.getTable(ast.table);
        const storage = ctx.getStorage(ast.table);

        ctx.emit({ type: 'TABLE_SCAN', description: `Scanning '${ast.table}'`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot() });
        const allRows = storage.scanAll();
        const matching = ast.where ? allRows.filter(r => ExpressionEvaluator.evalWhere(ast.where!, r)) : allRows;

        ctx.emit({
            type: 'FILTER',
            description: `${matching.length} row(s) to delete`,
            tableName: ast.table,
            affectedRowKeys: matching.map(r => r[tableDef.primaryKey] as string | number)
        });

        let count = 0;
        for (const row of matching) {
            const pk = row[tableDef.primaryKey] as string | number;
            await storage.deleteRow(pk, {
                onVisit: async (id) => { ctx.emit({ type: 'TREE_TRAVERSE', description: `Traversing to delete ${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: id }); },
                onDelete: async (id) => { ctx.emit({ type: 'TREE_DELETE', description: `Deleted key ${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: id }); },
                onMerge: async (l, r) => { ctx.emit({ type: 'TREE_MERGE', description: `Merging ${l.slice(0, 6)} ← ${r.slice(0, 6)}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), highlightedNodeId: l, newNodeId: r }); },
            });
            ctx.emit({ type: 'TABLE_DELETE', description: `Deleted ${tableDef.primaryKey}=${pk}`, tableName: ast.table, treeSnapshot: storage.getPrimaryTreeSnapshot(), affectedRowKeys: [pk] });
            count++;
        }

        return { rowsAffected: count };
    }
}
