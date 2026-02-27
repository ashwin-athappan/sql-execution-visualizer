import { ColumnDef, TableDef, IndexDef, SqlType } from './types';
import { ColumnDefAST } from './sql/ast';

export class SchemaError extends Error { }

export class SchemaManager {
    private tables: Map<string, TableDef> = new Map();

    // ── Tables ────────────────────────────────────────────────────────────────
    createTable(name: string, columns: ColumnDefAST[]): TableDef {
        if (this.tables.has(name)) throw new SchemaError(`Table '${name}' already exists`);

        // Find primary key column
        let pk = columns.find(c => c.primaryKey)?.name;
        if (!pk) {
            // Default: first INT column, or first column
            pk = columns.find(c => c.type === 'INT')?.name ?? columns[0]?.name;
            if (!pk) throw new SchemaError(`Table '${name}' must have at least one column`);
        }

        const def: TableDef = {
            name,
            columns: columns.map(c => ({
                name: c.name,
                type: c.type as SqlType,
                primaryKey: c.primaryKey,
                nullable: c.nullable,
            })),
            primaryKey: pk,
            indexes: [],
        };
        this.tables.set(name, def);
        return def;
    }

    dropTable(name: string, ifExists = false): void {
        if (!this.tables.has(name)) {
            if (ifExists) return;
            throw new SchemaError(`Table '${name}' does not exist`);
        }
        this.tables.delete(name);
    }

    getTable(name: string): TableDef {
        const t = this.tables.get(name);
        if (!t) throw new SchemaError(`Table '${name}' does not exist`);
        return t;
    }

    listTables(): TableDef[] {
        return Array.from(this.tables.values());
    }

    hasTable(name: string): boolean {
        return this.tables.has(name);
    }

    // ── Alter ─────────────────────────────────────────────────────────────────
    addColumn(tableName: string, col: ColumnDefAST): void {
        const t = this.getTable(tableName);
        if (t.columns.find(c => c.name === col.name)) {
            throw new SchemaError(`Column '${col.name}' already exists in '${tableName}'`);
        }
        t.columns.push({ name: col.name, type: col.type as SqlType, primaryKey: false, nullable: col.nullable });
    }

    dropColumn(tableName: string, colName: string): void {
        const t = this.getTable(tableName);
        const idx = t.columns.findIndex(c => c.name === colName);
        if (idx === -1) throw new SchemaError(`Column '${colName}' not found in '${tableName}'`);
        if (t.primaryKey === colName) throw new SchemaError(`Cannot drop primary key column`);
        t.columns.splice(idx, 1);
    }

    renameColumn(tableName: string, from: string, to: string): void {
        const t = this.getTable(tableName);
        const col = t.columns.find(c => c.name === from);
        if (!col) throw new SchemaError(`Column '${from}' not found in '${tableName}'`);
        if (t.primaryKey === from) t.primaryKey = to;
        col.name = to;
    }

    // ── Indexes ───────────────────────────────────────────────────────────────
    createIndex(def: Omit<IndexDef, 'tableName'> & { tableName: string }): IndexDef {
        const t = this.getTable(def.tableName);
        if (t.indexes.find(i => i.name === def.name)) {
            throw new SchemaError(`Index '${def.name}' already exists`);
        }
        const idx: IndexDef = { ...def };
        t.indexes.push(idx);
        return idx;
    }

    dropIndex(indexName: string): { tableName: string } {
        for (const t of this.tables.values()) {
            const idx = t.indexes.findIndex(i => i.name === indexName);
            if (idx !== -1) {
                t.indexes.splice(idx, 1);
                return { tableName: t.name };
            }
        }
        throw new SchemaError(`Index '${indexName}' does not exist`);
    }

    // ── Validation ────────────────────────────────────────────────────────────
    validateRow(tableName: string, row: Record<string, unknown>): void {
        const t = this.getTable(tableName);
        for (const col of t.columns) {
            if (!(col.name in row) && !col.nullable && col.defaultValue === undefined) {
                // Only error if no default
                // Allow missing nullable columns
            }
        }
        const pkVal = row[t.primaryKey];
        if (pkVal === null || pkVal === undefined) {
            throw new SchemaError(`Primary key column '${t.primaryKey}' cannot be null`);
        }
    }

    // ── Clone (for snapshot) ─────────────────────────────────────────────────
    snapshot(): TableDef[] {
        return JSON.parse(JSON.stringify(this.listTables()));
    }
}
