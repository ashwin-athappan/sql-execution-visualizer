/**
 * Facade Pattern — `BPlusTree` is the single public entry point for all tree
 * operations.  Internally it delegates to four specialist classes:
 *
 *   BPlusTreeSearcher  — point lookup, range scan, full scan
 *   BPlusTreeInserter  — insert + leaf / internal splits
 *   BPlusTreeDeleter   — delete + borrow / merge rebalancing
 *   createSnapshot()   — immutable snapshot for the visualisation layer
 *
 * All four share a `TreeContext` object (Context Object Pattern) that holds
 * the mutable tree state (rootId, size, order) and the `NodeStore` repository.
 */

import { BTreeKey, NodeID } from './types';
import { TreeContext } from './context';
import { NodeStore } from './node-store';
import { BPlusTreeSearcher } from './search';
import { BPlusTreeInserter } from './insert';
import { BPlusTreeDeleter } from './delete';
import { createSnapshot } from './snapshot';
import { VisitHook, InsertHooks, DeleteHooks } from './hooks';
import { TreeSnapshot } from '../types';

// Re-export hook types so existing consumers (storage.ts) need no import changes
export type { InsertHooks, DeleteHooks, VisitHook };

export class BPlusTree {
    private ctx: TreeContext;
    private searcher: BPlusTreeSearcher;
    private inserter: BPlusTreeInserter;
    private deleter: BPlusTreeDeleter;

    constructor(order: number = 4) {
        const store = new NodeStore();
        const root = store.create(true);
        this.ctx = { store, rootId: root.id, order, size: 0 };
        this.searcher = new BPlusTreeSearcher(this.ctx);
        this.inserter = new BPlusTreeInserter(this.ctx);
        this.deleter = new BPlusTreeDeleter(this.ctx);
    }

    get size(): number { return this.ctx.size; }
    get root(): NodeID { return this.ctx.rootId; }

    // ── Reads ─────────────────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async search(key: BTreeKey, onVisit?: VisitHook): Promise<any> {
        return this.searcher.search(key, onVisit);
    }

    async rangeSearch(
        lo: BTreeKey,
        hi: BTreeKey,
        onVisit?: VisitHook,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ key: BTreeKey; value: any }[]> {
        return this.searcher.rangeSearch(lo, hi, onVisit);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scanAll(): { key: BTreeKey; value: any }[] {
        return this.searcher.scanAll();
    }

    // ── Writes ────────────────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async insert(key: BTreeKey, value: any, hooks?: InsertHooks): Promise<void> {
        return this.inserter.insert(key, value, hooks);
    }

    async delete(key: BTreeKey, hooks?: DeleteHooks): Promise<boolean> {
        return this.deleter.delete(key, hooks);
    }

    // ── Visualisation ─────────────────────────────────────────────────────────

    getSnapshot(): TreeSnapshot {
        return createSnapshot(this.ctx);
    }
}