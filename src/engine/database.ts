import { SchemaManager } from './schema';
import { TableStorage } from './storage';
import { QueryExecutor } from './executor';
import { SQLParser, ParseError } from './sql/parser';
import { ExecutionResult, Row } from './types';

export class MiniDatabase {
    private schema: SchemaManager = new SchemaManager();
    private storages: Map<string, TableStorage> = new Map();
    private parser: SQLParser = new SQLParser();

    async execute(sql: string): Promise<ExecutionResult> {
        const trimmed = sql.trim().replace(/;+$/, '');
        try {
            const ast = this.parser.parse(trimmed);
            const executor = new QueryExecutor(this.schema, this.storages);
            const { steps, rows, columns, rowsAffected, pipelineStages } = await executor.execute(ast);
            return { steps, resultRows: rows as Row[], resultColumns: columns, rowsAffected, pipelineStages };
        } catch (err) {
            const message = err instanceof ParseError || err instanceof Error ? err.message : String(err);
            return { steps: [], resultRows: [], resultColumns: [], rowsAffected: 0, error: message };
        }
    }

    getSchema() { return this.schema; }
    getStorages() { return this.storages; }
}
