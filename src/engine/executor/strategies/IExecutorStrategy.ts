import { ASTNode } from '../../sql/ast';
import { ExecutionContext } from '../ExecutionContext';
import { Row } from '../../types';

export interface ExecutionResult {
    rowsAffected: number;
    rows?: Row[];
    columns?: string[];
}

/**
 * Base Strategy interface for executing different SQL commands.
 * 
 * DESIGN PATTERN: Strategy Pattern
 * Encapsulates specific AST executions (e.g., SELECT, UPDATE, etc.) 
 * so they can be extended or swapped easily without bloating a single file.
 */
export interface IExecutorStrategy<T extends ASTNode> {
    /**
     * Executes the given AST node logic against the provided context.
     * @param ast The typed AST node to run.
     * @param ctx ExecutionContext holding storage, schema, and step emitter.
     */
    execute(ast: T, ctx: ExecutionContext): Promise<ExecutionResult> | ExecutionResult;
}
