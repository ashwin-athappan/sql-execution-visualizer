import { Row, SqlValue } from '../types';
import { AggregateExpr, Expression, WhereClause } from '../sql/ast';

/**
 * ExpressionEvaluator encapsulates the logic for evaluating SQL expressions,
 * aggregates, and WHERE clauses against a specific row.
 * 
 * DESIGN PATTERN: Utility/Helper (Pure Functions)
 * This separates the stateless evaluation logic from the stateful executor.
 */
export class ExpressionEvaluator {

    // ── Evaluate row expressions ─────────────────────────────────────────────

    static evalWhere(expr: WhereClause, row: Row): boolean {
        return Boolean(ExpressionEvaluator.evalExpr(expr, row, {}));
    }

    static evalExpr(expr: Expression, row: Row, _ctx: Record<string, unknown>): SqlValue {
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
                const k = ExpressionEvaluator.aggKey(expr);
                return row[k] ?? null;
            }
            case 'binary': {
                const left = ExpressionEvaluator.evalExpr(expr.left, row, _ctx);
                const right = ExpressionEvaluator.evalExpr(expr.right, row, _ctx);
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
                const val = ExpressionEvaluator.evalExpr(expr.operand, row, _ctx);
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

    // ── Evaluator Helpers ────────────────────────────────────────────────────

    static computeAggregate(fn: string, col: string, rows: Row[]): SqlValue {
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

    static aggKey(agg: AggregateExpr): string {
        return agg.alias ?? `${agg.fn}(${agg.col})`;
    }

    static resolveCol(col: string, aliasMap: Record<string, string>): string {
        if (col.includes('.')) {
            const [tbl, c] = col.split('.');
            return aliasMap[tbl] ? c : col;
        }
        return col;
    }

    static clauseText(expr: Expression): string {
        switch (expr.kind) {
            case 'literal': return String(expr.value);
            case 'column_ref': return expr.table ? `${expr.table}.${expr.column}` : expr.column;
            case 'aggregate': return `${expr.fn}(${expr.col})`;
            case 'binary': return `${ExpressionEvaluator.clauseText(expr.left)} ${expr.op} ${ExpressionEvaluator.clauseText(expr.right)}`;
            case 'unary': return `${ExpressionEvaluator.clauseText(expr.operand)} ${expr.op}`;
        }
        return '';
    }

    static literalToValue(lit: { kind: string; value?: string | number }): SqlValue {
        if (lit.kind === 'null') return null;
        return lit.value as SqlValue;
    }
}
