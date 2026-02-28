import { useMemo } from 'react';
import { MiniDatabase } from '@/engine/database';
import { TableDef } from '@/engine/types';

/**
 * Derives the live row data for the currently focused table.
 * Re-runs whenever the focused table, schema, or current step changes
 * so the Table Data view always reflects the latest B+Tree state.
 */
export function useTableData(
    db: MiniDatabase,
    schemaTables: TableDef[],
    focusedTable: string | null,
    currentStepIndex: number,
) {
    return useMemo(() => {
        const empty = { rows: [], columns: [] as string[], pkColumn: undefined as string | undefined };
        if (!focusedTable) return empty;

        const tableDef = schemaTables.find(t => t.name === focusedTable);
        if (!tableDef) return empty;

        const storage = db.getStorages().get(focusedTable);
        const rows = storage ? storage.scanAll() : [];
        return {
            rows,
            columns: tableDef.columns.map(c => c.name),
            pkColumn: tableDef.primaryKey,
        };
        // currentStepIndex is intentionally a dep so the view refreshes on each step
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusedTable, schemaTables, db, currentStepIndex]);
}
