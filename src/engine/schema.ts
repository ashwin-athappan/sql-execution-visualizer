import { ColumnDef, TableDef, IndexDef, SqlType } from './types';
import { ColumnDefAST } from './sql/ast';

export class SchemaError extends Error { }

export class SchemaManager {
    private tables: Map<string, TableDef> = new Map();

    /** Normalize any identifier to lowercase for case-insensitive comparisons. */
    private norm(name: string): string { return name.toLowerCase(); }

    // ── Tables ────────────────────────────────────────────────────────────────
    createTable(name: string, columns: ColumnDefAST[]): TableDef {
        const normName = this.norm(name);
        if (this.tables.has(normName)) throw new SchemaError(`Table '${normName}' already exists`);

        // Normalize column names
        const normCols = columns.map(c => ({ ...c, name: this.norm(c.name) }));

        // Find primary key column
        let pk = normCols.find(c => c.primaryKey)?.name;
        if (!pk) {
            // Default: first INT column, or first column
            pk = normCols.find(c => c.type === 'INT')?.name ?? normCols[0]?.name;
            if (!pk) throw new SchemaError(`Table '${normName}' must have at least one column`);
        }

        const def: TableDef = {
            name: normName,
            columns: normCols.map(c => ({
                name: c.name,
                type: c.type as SqlType,
                primaryKey: c.primaryKey,
                nullable: c.nullable,
            })),
            primaryKey: pk,
            indexes: [],
        };
        this.tables.set(normName, def);
        return def;
    }

    dropTable(name: string, ifExists = false): void {
        const normName = this.norm(name);
        if (!this.tables.has(normName)) {
            if (ifExists) return;
            throw new SchemaError(`Table '${normName}' does not exist`);
        }
        this.tables.delete(normName);
    }

    getTable(name: string): TableDef {
        const normName = this.norm(name);
        const t = this.tables.get(normName);
        if (!t) throw new SchemaError(`Table '${normName}' does not exist`);
        return t;
    }

    listTables(): TableDef[] {
        return Array.from(this.tables.values());
    }

    hasTable(name: string): boolean {
        return this.tables.has(this.norm(name));
    }

    // ── Alter ─────────────────────────────────────────────────────────────────
    addColumn(tableName: string, col: ColumnDefAST): void {
        const t = this.getTable(tableName);
        const normColName = this.norm(col.name);
        if (t.columns.find(c => c.name === normColName)) {
            throw new SchemaError(`Column '${normColName}' already exists in '${t.name}'`);
        }
        t.columns.push({ name: normColName, type: col.type as SqlType, primaryKey: false, nullable: col.nullable });
    }

    dropColumn(tableName: string, colName: string): void {
        const t = this.getTable(tableName);
        const normColName = this.norm(colName);
        const idx = t.columns.findIndex(c => c.name === normColName);
        if (idx === -1) throw new SchemaError(`Column '${normColName}' not found in '${t.name}'`);
        if (t.primaryKey === normColName) throw new SchemaError(`Cannot drop primary key column`);
        t.columns.splice(idx, 1);
    }

    renameColumn(tableName: string, from: string, to: string): void {
        const t = this.getTable(tableName);
        const normFrom = this.norm(from);
        const normTo = this.norm(to);
        const col = t.columns.find(c => c.name === normFrom);
        if (!col) throw new SchemaError(`Column '${normFrom}' not found in '${t.name}'`);
        if (t.primaryKey === normFrom) t.primaryKey = normTo;
        col.name = normTo;
    }

    // ── Indexes ───────────────────────────────────────────────────────────────
    createIndex(def: Omit<IndexDef, 'tableName'> & { tableName: string }): IndexDef {
        const t = this.getTable(def.tableName);
        const normIndexName = this.norm(def.name);
        if (t.indexes.find(i => i.name === normIndexName)) {
            throw new SchemaError(`Index '${normIndexName}' already exists`);
        }
        const idx: IndexDef = { ...def, name: normIndexName, tableName: t.name, columns: def.columns.map(c => this.norm(c)) };
        t.indexes.push(idx);
        return idx;
    }

    dropIndex(indexName: string): { tableName: string } {
        const normIndexName = this.norm(indexName);
        for (const t of this.tables.values()) {
            const idx = t.indexes.findIndex(i => i.name === normIndexName);
            if (idx !== -1) {
                t.indexes.splice(idx, 1);
                return { tableName: t.name };
            }
        }
        throw new SchemaError(`Index '${normIndexName}' does not exist`);
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
