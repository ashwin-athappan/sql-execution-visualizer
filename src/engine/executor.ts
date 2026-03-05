import { SchemaManager } from './schema';
import { TableStorage } from './storage';
import { Row, ExecutionStep, PipelineStage, StepType } from './types';
import { ASTNode } from './sql/ast';
import { ExecutionContext } from './executor/ExecutionContext';
import { IExecutorStrategy } from './executor/strategies/IExecutorStrategy';
import {
    CreateTableStrategy, DropTableStrategy, AlterTableStrategy,
    CreateIndexStrategy, DropIndexStrategy
} from './executor/strategies/DDLStrategy';
import {
    InsertStrategy, UpdateStrategy, DeleteStrategy
} from './executor/strategies/DMLStrategy';
import { SelectStrategy } from './executor/strategies/SelectStrategy';

/**
 * QueryExecutor serves as the main entry point to execute SQL queries.
 * 
 * DESIGN PATTERN: Facade & Strategy
 * It acts as a Facade for the rest of the application, hiding the complexity of the
 * execution process, while using the Strategy pattern to delegate the actual work
 * of executing different statement types to specific handler classes.
 */
export class QueryExecutor {
    private ctx: ExecutionContext;

    // Registry of strategies mapped by AST node kind
    private strategies: Record<string, IExecutorStrategy<any>> = {
        'CREATE_TABLE': new CreateTableStrategy(),
        'DROP_TABLE': new DropTableStrategy(),
        'ALTER_TABLE': new AlterTableStrategy(),
        'CREATE_INDEX': new CreateIndexStrategy(),
        'DROP_INDEX': new DropIndexStrategy(),
        'INSERT': new InsertStrategy(),
        'UPDATE': new UpdateStrategy(),
        'DELETE': new DeleteStrategy(),
        'SELECT': new SelectStrategy(),
    };

    constructor(schema: SchemaManager, storages: Map<string, TableStorage>) {
        // Initialize the Context object for the execution session
        this.ctx = new ExecutionContext(schema, storages);
    }

    async execute(ast: ASTNode): Promise<{ steps: ExecutionStep[]; rows: Row[]; columns: string[]; rowsAffected: number; pipelineStages?: PipelineStage[] }> {
        // Reset execution state for the new query
        this.ctx.reset();

        let rows: Row[] = [];
        let columns: string[] = [];
        let rowsAffected = 0;

        // Route to the appropriate strategy based on the AST kind
        const strategy = this.strategies[ast.kind];
        if (!strategy) {
            throw new Error(`Execution strategy not found for AST kind: ${ast.kind}`);
        }

        const result = await strategy.execute(ast, this.ctx);

        if (result.rows) rows = result.rows;
        if (result.columns) columns = result.columns;
        rowsAffected = result.rowsAffected;

        return {
            steps: this.ctx.steps,
            rows,
            columns,
            rowsAffected,
            pipelineStages: this.ctx.pipelineStages
        };
    }
}

export type { StepType };
