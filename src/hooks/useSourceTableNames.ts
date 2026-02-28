import { useMemo } from 'react';
import { TableDef } from '@/engine/types';

/**
 * Derives the list of table names referenced by the last SQL string.
 * Used by the pipeline visualizer to render the source-table chips.
 */
export function useSourceTableNames(lastSQL: string, schemaTables: TableDef[]): string[] {
    return useMemo(() => {
        if (!lastSQL) return [];
        const upper = lastSQL.toUpperCase();
        const names: string[] = [];
        schemaTables.forEach(t => { if (upper.includes(t.name.toUpperCase())) names.push(t.name); });
        return names;
    }, [lastSQL, schemaTables]);
}
