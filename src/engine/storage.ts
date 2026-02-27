import { BPlusTree, InsertHooks, DeleteHooks } from './btree/tree';
import { BTreeKey } from './btree/types';
import { Row, SqlValue } from './types';

/** One row-store: primary B+Tree keyed by PK + secondary index trees */
export class TableStorage {
    readonly tableName: string;
    readonly primaryKey: string;
    private primaryTree: BPlusTree;
    private indexes: Map<string, BPlusTree> = new Map();

    constructor(tableName: string, primaryKey: string, order = 4) {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.primaryTree = new BPlusTree(order);
    }

    get size(): number { return this.primaryTree.size; }

    // ── Primary tree ──────────────────────────────────────────────────────────
    async insertRow(row: Row, hooks?: InsertHooks): Promise<void> {
        const pk = row[this.primaryKey] as BTreeKey;
        if (pk === null || pk === undefined) throw new Error(`Primary key cannot be null`);
        await this.primaryTree.insert(pk, row, hooks);

        // Insert into secondary indexes (synchronously, no hooks for indexes)
        for (const [indexName, tree] of this.indexes) {
            const _ = indexName;
            // index key = the indexed column value, value = PK
            const colVal = row[this.getIndexColumn(indexName)] as BTreeKey;
            if (colVal !== null && colVal !== undefined) {
                await tree.insert(colVal, pk);
            }
        }
    }

    async updateRow(pk: BTreeKey, updates: Partial<Row>, hooks?: InsertHooks): Promise<Row | null> {
        const existing = await this.primaryTree.search(pk) as Row | null;
        if (!existing) return null;
        const updated: Row = { ...existing, ...(updates as Row) };
        await this.primaryTree.insert(pk, updated, hooks);
        // Rebuild index entries if indexed columns changed
        for (const [indexName, tree] of this.indexes) {
            const col = this.getIndexColumn(indexName);
            if (col in updates) {
                const oldVal = existing[col] as BTreeKey;
                const newVal = updated[col] as BTreeKey;
                if (oldVal !== null && oldVal !== undefined) await tree.delete(oldVal);
                if (newVal !== null && newVal !== undefined) await tree.insert(newVal, pk);
            }
        }
        return updated;
    }

    async deleteRow(pk: BTreeKey, hooks?: DeleteHooks): Promise<boolean> {
        const existing = await this.primaryTree.search(pk) as Row | null;
        if (!existing) return false;
        const ok = await this.primaryTree.delete(pk, hooks);
        for (const [indexName, tree] of this.indexes) {
            const colVal = existing[this.getIndexColumn(indexName)] as BTreeKey;
            if (colVal !== null && colVal !== undefined) await tree.delete(colVal);
        }
        return ok;
    }

    async getRow(pk: BTreeKey): Promise<Row | null> {
        return await this.primaryTree.search(pk) as Row | null;
    }

    scanAll(): Row[] {
        return this.primaryTree.scanAll().map(e => e.value as Row);
    }

    async rangeByPK(lo: BTreeKey, hi: BTreeKey): Promise<Row[]> {
        const entries = await this.primaryTree.rangeSearch(lo, hi);
        return entries.map(e => e.value as Row);
    }

    getPrimaryTreeSnapshot() { return this.primaryTree.getSnapshot(); }

    // ── Secondary indexes ─────────────────────────────────────────────────────
    private indexColumnMap: Map<string, string> = new Map();

    addIndex(indexName: string, column: string): void {
        this.indexColumnMap.set(indexName, column);
        const tree = new BPlusTree(4);
        this.indexes.set(indexName, tree);
        // Populate from existing rows
        for (const row of this.scanAll()) {
            const colVal = row[column] as BTreeKey;
            const pk = row[this.primaryKey] as BTreeKey;
            if (colVal !== null && colVal !== undefined) {
                tree.insert(colVal, pk);
            }
        }
    }

    dropIndex(indexName: string): void {
        this.indexes.delete(indexName);
        this.indexColumnMap.delete(indexName);
    }

    getIndexSnapshot(indexName: string) {
        return this.indexes.get(indexName)?.getSnapshot();
    }

    getIndexTree(indexName: string): BPlusTree | undefined {
        return this.indexes.get(indexName);
    }

    listIndexNames(): string[] { return Array.from(this.indexes.keys()); }

    private getIndexColumn(indexName: string): string {
        return this.indexColumnMap.get(indexName) ?? indexName;
    }

    // ── Coerce values to proper types ─────────────────────────────────────────
    static coerce(val: SqlValue, type: string): SqlValue {
        if (val === null || val === undefined) return null;
        switch (type) {
            case 'INT': return typeof val === 'string' ? parseInt(val, 10) : Math.trunc(Number(val));
            case 'FLOAT': return typeof val === 'string' ? parseFloat(val) : Number(val);
            case 'BOOLEAN': return (val === 'true' || val === 'TRUE' || val === 1) ? 1 : 0;
            default: return String(val);
        }
    }
}