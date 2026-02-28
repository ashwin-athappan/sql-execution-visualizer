import { SchemaManager } from './schema';
import { TableStorage } from './storage';
import { QueryExecutor } from './executor';
import { SQLParser, ParseError } from './sql/parser';
import { ExecutionResult, Row } from './types';

export class MiniDatabase {
    private schema: SchemaManager = new SchemaManager();
    private storages: Map<string, TableStorage> = new Map();
    private parser: SQLParser = new SQLParser();

    /** Execute a single SQL statement. */
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

    /**
     * Execute multiple semicolon-separated SQL statements.
     * All steps are concatenated; the result rows/columns come from the
     * last SELECT. rowsAffected is the sum across all statements.
     */
    async executeScript(script: string): Promise<ExecutionResult> {
        const statements = script
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (statements.length === 0) {
            return { steps: [], resultRows: [], resultColumns: [], rowsAffected: 0 };
        }

        // Single statement — delegate directly for clean error messages
        if (statements.length === 1) {
            return this.execute(statements[0]);
        }

        const allSteps: ExecutionResult['steps'] = [];
        let lastResultRows: Row[] = [];
        let lastResultColumns: string[] = [];
        let lastPipelineStages = undefined;
        let totalAffected = 0;
        let stepIdOffset = 0;

        for (let i = 0; i < statements.length; i++) {
            const result = await this.execute(statements[i]);

            if (result.error) {
                return {
                    steps: allSteps,
                    resultRows: [],
                    resultColumns: [],
                    rowsAffected: totalAffected,
                    error: `Statement ${i + 1}: ${result.error}`,
                };
            }

            // Re-number step IDs to keep them unique across the combined list
            const shifted = result.steps.map(s => ({ ...s, id: s.id + stepIdOffset }));
            allSteps.push(...shifted);
            stepIdOffset += result.steps.length;
            totalAffected += result.rowsAffected;

            if (result.resultColumns.length > 0) {
                lastResultRows = result.resultRows;
                lastResultColumns = result.resultColumns;
                lastPipelineStages = result.pipelineStages;
            }
        }

        return {
            steps: allSteps,
            resultRows: lastResultRows,
            resultColumns: lastResultColumns,
            rowsAffected: totalAffected,
            pipelineStages: lastPipelineStages,
        };
    }

    getSchema() { return this.schema; }
    getStorages() { return this.storages; }
}
