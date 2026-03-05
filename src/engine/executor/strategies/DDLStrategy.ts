import { IExecutorStrategy, ExecutionResult } from './IExecutorStrategy';
import { ExecutionContext } from '../ExecutionContext';
import {
    CreateTableStmt,
    DropTableStmt,
    AlterTableStmt,
    CreateIndexStmt,
    DropIndexStmt
} from '../../sql/ast';
import { TableStorage } from '../../storage';

export class CreateTableStrategy implements IExecutorStrategy<CreateTableStmt> {
    execute(ast: CreateTableStmt, ctx: ExecutionContext): ExecutionResult {
        ctx.emit({ type: 'PLAN', description: `Planning CREATE TABLE ${ast.table}` });
        const def = ctx.schema.createTable(ast.table, ast.columns);
        // Use the normalized name from the schema definition as the storage key
        ctx.storages.set(def.name, new TableStorage(def.name, def.primaryKey, 4));
        ctx.emit({
            type: 'SCHEMA_CREATE',
            description: `Created table '${def.name}' with ${ast.columns.length} column(s). PK: '${def.primaryKey}'.`,
            tableName: def.name,
            treeSnapshot: ctx.storages.get(def.name)!.getPrimaryTreeSnapshot()
        });
        return { rowsAffected: 0 };
    }
}

export class DropTableStrategy implements IExecutorStrategy<DropTableStmt> {
    execute(ast: DropTableStmt, ctx: ExecutionContext): ExecutionResult {
        ctx.emit({ type: 'PLAN', description: `Planning DROP TABLE ${ast.table}` });
        const normName = ast.table.toLowerCase();
        ctx.schema.dropTable(normName, ast.ifExists);
        ctx.storages.delete(normName);
        ctx.emit({ type: 'SCHEMA_DROP', description: `Dropped table '${normName}'.`, tableName: normName });
        return { rowsAffected: 0 };
    }
}

export class AlterTableStrategy implements IExecutorStrategy<AlterTableStmt> {
    execute(ast: AlterTableStmt, ctx: ExecutionContext): ExecutionResult {
        ctx.emit({ type: 'PLAN', description: `Planning ALTER TABLE ${ast.table}` });
        const action = ast.action;
        switch (action.type) {
            case 'ADD_COLUMN':
                ctx.schema.addColumn(ast.table, action.column);
                ctx.emit({ type: 'SCHEMA_ALTER', description: `Added column '${action.column.name}' to '${ast.table}'.`, tableName: ast.table });
                break;
            case 'DROP_COLUMN':
                ctx.schema.dropColumn(ast.table, action.column);
                ctx.emit({ type: 'SCHEMA_ALTER', description: `Dropped column '${action.column}' from '${ast.table}'.`, tableName: ast.table });
                break;
            case 'RENAME_COLUMN':
                ctx.schema.renameColumn(ast.table, action.from, action.to);
                ctx.emit({ type: 'SCHEMA_ALTER', description: `Renamed '${action.from}' → '${action.to}' in '${ast.table}'.`, tableName: ast.table });
                break;
        }
        return { rowsAffected: 0 };
    }
}

export class CreateIndexStrategy implements IExecutorStrategy<CreateIndexStmt> {
    async execute(ast: CreateIndexStmt, ctx: ExecutionContext): Promise<ExecutionResult> {
        ctx.emit({ type: 'PLAN', description: `Planning CREATE INDEX ${ast.index}` });
        ctx.schema.createIndex({ name: ast.index, tableName: ast.table, columns: ast.columns, unique: ast.unique });
        const storage = ctx.getStorage(ast.table);
        storage.addIndex(ast.index, ast.columns[0]);
        ctx.emit({
            type: 'INDEX_CREATE',
            description: `Created index '${ast.index}' on '${ast.table}(${ast.columns.join(',')})'.`,
            tableName: ast.table,
            indexName: ast.index,
            treeSnapshot: storage.getIndexSnapshot(ast.index)
        });
        return { rowsAffected: 0 };
    }
}

export class DropIndexStrategy implements IExecutorStrategy<DropIndexStmt> {
    execute(ast: DropIndexStmt, ctx: ExecutionContext): ExecutionResult {
        ctx.emit({ type: 'PLAN', description: `Planning DROP INDEX ${ast.index}` });
        const { tableName } = ctx.schema.dropIndex(ast.index);
        ctx.storages.get(tableName)?.dropIndex(ast.index);
        ctx.emit({ type: 'INDEX_DROP', description: `Dropped index '${ast.index}'.`, tableName, indexName: ast.index });
        return { rowsAffected: 0 };
    }
}
