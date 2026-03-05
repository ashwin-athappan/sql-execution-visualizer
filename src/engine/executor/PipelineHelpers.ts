import { Row, StageName, PipelineStage, JoinPair } from '../types';

/**
 * Helper to generate PipelineStage objects, decoupling construction from the execution flow.
 * 
 * DESIGN PATTERN: Factory Method / Helper
 * Provides a standardized way to instantiate PipelineStage representations.
 */
export function makePipelineStage(name: StageName, clauseText: string, rows: Row[], allCols: string[]): PipelineStage {
    return { name, clauseText, rowCount: rows.length, sampleRows: rows, columns: allCols };
}

export function makeJoinPipelineStage(
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
