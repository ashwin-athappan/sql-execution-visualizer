/**
 * Persistence layer — serialises / deserialises the full MiniDatabase state
 * to localStorage so the schema and all row data survive a page refresh.
 *
 * Storage key: "sql_viz_db_v1"
 *
 * Serialised shape:
 * {
 *   version: 1,
 *   tables: Array<{
 *     name:       string,
 *     primaryKey: string,
 *     columns:    ColumnDef[],
 *     indexes:    Array<{ name, columns, unique }>,
 *     rows:       Row[],          // all rows from scanAll()
 *   }>
 * }
 *
 * On load the schema is reconstructed first, then each table's rows are bulk
 * inserted directly into the B+Tree (bypassing the SQL parser for speed).
 */

import { SchemaManager } from './schema';
import { TableStorage } from './storage';
import { ColumnDef, IndexDef, Row, TableDef } from './types';

const STORAGE_KEY = 'sql_viz_db_v1';

// ── Serialised types ─────────────────────────────────────────────────────────

interface PersistedIndex {
    name: string;
    columns: string[];
    unique: boolean;
}

interface PersistedTable {
    name: string;
    primaryKey: string;
    columns: ColumnDef[];
    indexes: PersistedIndex[];
    rows: Row[];
}

interface PersistedDB {
    version: 1;
    tables: PersistedTable[];
}

// ── Save ─────────────────────────────────────────────────────────────────────

export function saveDatabase(
    schema: SchemaManager,
    storages: Map<string, TableStorage>,
): void {
    try {
        const tables: PersistedTable[] = schema.listTables().map((def: TableDef) => ({
            name: def.name,
            primaryKey: def.primaryKey,
            columns: def.columns,
            indexes: def.indexes.map((ix: IndexDef) => ({
                name: ix.name,
                columns: ix.columns,
                unique: ix.unique,
            })),
            rows: storages.get(def.name)?.scanAll() ?? [],
        }));

        const payload: PersistedDB = { version: 1, tables };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        // Quota exceeded or private-browsing restrictions — fail silently.
        console.warn('[persistence] save failed:', e);
    }
}

// ── Load ─────────────────────────────────────────────────────────────────────

/**
 * Hydrates `schema` and `storages` from localStorage.
 * Returns `true` if data was found and successfully loaded.
 */
export async function loadDatabase(
    schema: SchemaManager,
    storages: Map<string, TableStorage>,
): Promise<boolean> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        const payload: PersistedDB = JSON.parse(raw);
        if (payload.version !== 1 || !Array.isArray(payload.tables)) return false;

        for (const pt of payload.tables) {
            // Recreate schema entry using the low-level SchemaManager API so we
            // bypass the SQL parser and avoid duplicate-table errors.
            if (schema.hasTable(pt.name)) continue;   // already exists (shouldn't happen on fresh load)

            // Build a minimal ColumnDefAST-compatible object for createTable
            schema.createTable(
                pt.name,
                pt.columns.map(c => ({
                    name: c.name,
                    type: c.type,
                    primaryKey: c.primaryKey,
                    nullable: c.nullable,
                    defaultValue: c.defaultValue,
                })),
            );

            // Restore the storage (B+Tree)
            const storage = new TableStorage(pt.name, pt.primaryKey, 4);
            storages.set(pt.name, storage);

            // Bulk-insert all rows (no animation hooks needed here)
            for (const row of pt.rows) {
                await storage.insertRow(row);
            }

            // Restore secondary indexes
            for (const ix of pt.indexes) {
                schema.createIndex({
                    name: ix.name,
                    tableName: pt.name,
                    columns: ix.columns,
                    unique: ix.unique,
                });
                storage.addIndex(ix.name, ix.columns[0]);
            }
        }

        return payload.tables.length > 0;
    } catch (e) {
        console.warn('[persistence] load failed:', e);
        return false;
    }
}

/** Wipe the persisted snapshot (used when the user explicitly clears the DB). */
export function clearDatabase(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
