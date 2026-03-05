import { IExecutorStrategy, ExecutionResult } from './IExecutorStrategy';
import { ExecutionContext } from '../ExecutionContext';
import { SelectStmt, AggregateExpr, SelectColumn } from '../../sql/ast';
import { Row, JoinPair, WhereEval } from '../../types';
import { ExpressionEvaluator } from '../ExpressionEvaluator';
import { makePipelineStage, makeJoinPipelineStage } from '../PipelineHelpers';

export class SelectStrategy implements IExecutorStrategy<SelectStmt> {
    async execute(ast: SelectStmt, ctx: ExecutionContext): Promise<ExecutionResult> {
        ctx.emit({ type: 'PLAN', description: `Planning SELECT from ${ast.from}` });

        const tableDef = ctx.schema.getTable(ast.from);
        const storage = ctx.getStorage(ast.from);

        // Build alias → tableName map for qualified column resolution
        const aliasMap: Record<string, string> = { [ast.from]: ast.from };
        if (ast.fromAlias) aliasMap[ast.fromAlias] = ast.from;
        (ast.joins ?? []).forEach(j => { aliasMap[j.alias ?? j.table] = j.table; });

        // ── STAGE 1: FROM ────────────────────────────────────────────────────
        ctx.emit({ type: 'TABLE_SCAN', description: `Reading all rows from '${ast.from}'`, tableName: ast.from, treeSnapshot: storage.getPrimaryTreeSnapshot(), activeStageName: 'FROM' });
        let rows = storage.scanAll();
        const fromCols = tableDef.columns.map(c => c.name);
        ctx.pipelineStages.push(makePipelineStage('FROM', `FROM ${ast.from}${ast.fromAlias ? ' ' + ast.fromAlias : ''}`, rows, fromCols));

        // ── STAGE 2: JOINs ───────────────────────────────────────────────────
        if (ast.joins && ast.joins.length > 0) {
            for (const join of ast.joins) {
                const rightStorage = ctx.getStorage(join.table);
                const rightRows = rightStorage.scanAll();
                const rightDef = ctx.schema.getTable(join.table);
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
                        const cond = join.on ? ExpressionEvaluator.evalWhere(join.on, combined) : true;
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

                ctx.pipelineStages.push(makeJoinPipelineStage(
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
                ctx.emit({ type: 'TABLE_SCAN', description: `${join.type} JOIN '${join.table}': ${rows.length} rows after join`, tableName: join.table, activeStageName: 'JOIN' });
            }
        }

        const workingCols = rows.length > 0 ? Object.keys(rows[0]) : fromCols;

        // ── STAGE 3: WHERE ───────────────────────────────────────────────────
        if (ast.where) {
            const condText = ExpressionEvaluator.clauseText(ast.where);
            const allWhereRows = [...rows];
            const whereEvals: WhereEval[] = allWhereRows.map(r => ({
                row: r,
                passed: ExpressionEvaluator.evalWhere(ast.where!, r),
                conditionText: condText,
            }));
            const before = rows.length;
            rows = rows.filter(r => ExpressionEvaluator.evalWhere(ast.where!, r));

            const stage = makePipelineStage('WHERE', condText, rows, workingCols);
            stage.whereEvals = whereEvals;
            ctx.pipelineStages.push(stage);

            ctx.emit({
                type: 'FILTER',
                description: `WHERE filter: ${before} → ${rows.length} row(s)`,
                tableName: ast.from,
                affectedRowKeys: rows.map(r => r[tableDef.primaryKey] as string | number).filter(Boolean),
                activeStageName: 'WHERE'
            });
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
                    const key = groupKeys.map(k => String(row[ExpressionEvaluator.resolveCol(k, aliasMap)] ?? 'null')).join('|~|');
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(row);
                }
            }

            // Build output rows: one per group
            groupedRows = [];
            groups.forEach((groupRows) => {
                const out: Row = {};
                // Keep group-by column values
                groupKeys.forEach(k => {
                    const rk = ExpressionEvaluator.resolveCol(k, aliasMap);
                    out[rk] = groupRows[0][rk] ?? null;
                });
                // Compute aggregates
                aggCols.forEach(agg => {
                    const colName = agg.col === '*' ? '' : ExpressionEvaluator.resolveCol(agg.col, aliasMap);
                    out[ExpressionEvaluator.aggKey(agg)] = ExpressionEvaluator.computeAggregate(agg.fn, colName, groupRows);
                });
                groupedRows.push(out);
            });

            outputCols = [...groupKeys.map(k => ExpressionEvaluator.resolveCol(k, aliasMap)), ...aggCols.map(ExecutionStrategy_aggKey => ExpressionEvaluator.aggKey(ExecutionStrategy_aggKey))];
            ctx.pipelineStages.push(makePipelineStage('GROUP BY', ast.groupBy ? `GROUP BY ${ast.groupBy.join(', ')}` : 'Aggregate (no GROUP BY)', groupedRows, outputCols));
            ctx.emit({ type: 'GROUP_BY', description: `GROUP BY ${groupKeys.join(', ') || '(all)'}: ${groups.size} group(s)`, tableName: ast.from, activeStageName: 'GROUP BY' });
            rows = groupedRows;
        }

        // ── STAGE 5: HAVING ──────────────────────────────────────────────────
        if (ast.having) {
            const havingText = ExpressionEvaluator.clauseText(ast.having);
            const allHavingRows = [...rows];
            const havingEvals: WhereEval[] = allHavingRows.map(r => ({
                row: r,
                passed: ExpressionEvaluator.evalWhere(ast.having!, r),
                conditionText: havingText,
            }));
            const before = rows.length;
            rows = rows.filter(r => ExpressionEvaluator.evalWhere(ast.having!, r));

            const havingStage = makePipelineStage('HAVING', havingText, rows, outputCols);
            havingStage.whereEvals = havingEvals;
            ctx.pipelineStages.push(havingStage);

            ctx.emit({ type: 'HAVING', description: `HAVING filter: ${before} → ${rows.length} row(s)`, tableName: ast.from, activeStageName: 'HAVING' });
        }

        // ── STAGE 6: SELECT (project) ────────────────────────────────────────
        let finalCols: string[];
        if (ast.columns.some(c => c.kind === 'star')) {
            finalCols = outputCols.length > 0 ? outputCols : (tableDef.columns.map(c => c.name));
        } else {
            finalCols = (ast.columns as SelectColumn[]).map(c => {
                if (c.kind === 'aggregate') return ExpressionEvaluator.aggKey(c);
                if (c.kind === 'column') return c.alias ?? ExpressionEvaluator.resolveCol(c.name, aliasMap);
                return '*';
            }).filter(c => c !== '*');
        }

        const projected = rows.map(r => {
            if (ast.columns.some(c => c.kind === 'star')) return r;
            const out: Row = {};
            (ast.columns as SelectColumn[]).forEach(c => {
                if (c.kind === 'aggregate') {
                    const k = ExpressionEvaluator.aggKey(c);
                    out[k] = r[k];
                }
                else if (c.kind === 'column') {
                    const resolved = ExpressionEvaluator.resolveCol(c.name, aliasMap);
                    const key = c.alias ?? resolved;
                    out[key] = r[resolved] ?? r[c.name] ?? null;
                }
            });
            return out;
        });

        ctx.pipelineStages.push(makePipelineStage('SELECT', ast.columns.some(c => c.kind === 'star') ? 'SELECT *' : `SELECT ${finalCols.join(', ')}`, projected, finalCols));
        ctx.emit({ type: 'RESULT', description: `SELECT projects ${finalCols.length} column(s).`, tableName: ast.from, activeStageName: 'SELECT' });

        rows = projected;

        // ── STAGE 7: ORDER BY ────────────────────────────────────────────────
        if (ast.orderBy && ast.orderBy.length > 0) {
            rows = [...rows].sort((a, b) => {
                for (const o of ast.orderBy!) {
                    const col = ExpressionEvaluator.resolveCol(o.column, aliasMap);
                    const aVal = a[col] ?? a[o.column];
                    const bVal = b[col] ?? b[o.column];
                    const cmp = aVal == null ? -1 : bVal == null ? 1 : aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                    if (cmp !== 0) return o.direction === 'ASC' ? cmp : -cmp;
                }
                return 0;
            });
            ctx.pipelineStages.push(makePipelineStage('ORDER BY', `ORDER BY ${ast.orderBy.map(o => `${ExpressionEvaluator.resolveCol(o.column, aliasMap)} ${o.direction}`).join(', ')}`, rows, finalCols));
            ctx.emit({ type: 'SORT', description: `Sorted by ${ast.orderBy.map(o => `${ExpressionEvaluator.resolveCol(o.column, aliasMap)} ${o.direction}`).join(', ')}`, tableName: ast.from, activeStageName: 'ORDER BY' });
        }

        // ── STAGE 8: LIMIT ───────────────────────────────────────────────────
        if (ast.limit !== undefined) {
            rows = rows.slice(0, ast.limit);
            ctx.pipelineStages.push(makePipelineStage('LIMIT', `LIMIT ${ast.limit}`, rows, finalCols));
            ctx.emit({ type: 'FILTER', description: `LIMIT ${ast.limit}: returning ${rows.length} row(s)`, tableName: ast.from, activeStageName: 'LIMIT' });
        }

        ctx.emit({
            type: 'RESULT',
            description: `Query complete. ${rows.length} row(s) returned.`,
            tableName: ast.from,
            resultRows: rows,
            resultColumns: finalCols,
            treeSnapshot: storage.getPrimaryTreeSnapshot(),
            activeStageName: 'SELECT',
            pipelineStages: [...ctx.pipelineStages]
        });

        return { rows, columns: finalCols, rowsAffected: rows.length };
    }
}
