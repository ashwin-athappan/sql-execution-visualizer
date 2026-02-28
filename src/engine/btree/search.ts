import { BTreeKey } from './types';
import { TreeContext } from './context';
import { VisitHook } from './hooks';
import { findChildIndex } from './utils';

/**
 * Handles all read-only B+Tree operations: point lookup, range scan,
 * and full ordered scan.  Reads `ctx.rootId` on every call so it always
 * uses the current root, even after a root split caused by an insert.
 */
export class BPlusTreeSearcher {
    constructor(private ctx: TreeContext) { }

    // ── Point lookup ──────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async search(key: BTreeKey, onVisit?: VisitHook): Promise<any> {
        const { store } = this.ctx;
        let curr = store.get(this.ctx.rootId);
        while (!curr.isLeaf) {
            if (onVisit) await onVisit(curr.id);
            curr = store.get(curr.children![findChildIndex(curr.keys, key)]);
        }
        if (onVisit) await onVisit(curr.id);
        const idx = curr.keys.indexOf(key);
        return idx !== -1 ? curr.values![idx] : null;
    }

    // ── Range scan ────────────────────────────────────────────────────────────
    async rangeSearch(
        lo: BTreeKey,
        hi: BTreeKey,
        onVisit?: VisitHook,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ key: BTreeKey; value: any }[]> {
        const { store } = this.ctx;

        // Navigate to the starting leaf
        let curr = store.get(this.ctx.rootId);
        while (!curr.isLeaf) {
            if (onVisit) await onVisit(curr.id);
            curr = store.get(curr.children![findChildIndex(curr.keys, lo)]);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: { key: BTreeKey; value: any }[] = [];
        let leaf = curr;
        while (leaf) {
            if (onVisit) await onVisit(leaf.id);
            for (let i = 0; i < leaf.keys.length; i++) {
                if (leaf.keys[i] > hi) return results;
                if (leaf.keys[i] >= lo) results.push({ key: leaf.keys[i], value: leaf.values![i] });
            }
            if (leaf.nextLeaf) {
                leaf = store.get(leaf.nextLeaf);
            } else {
                break;
            }
        }
        return results;
    }

    // ── Full ordered scan (walks the leaf chain) ──────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scanAll(): { key: BTreeKey; value: any }[] {
        const { store } = this.ctx;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: { key: BTreeKey; value: any }[] = [];

        // Jump to leftmost leaf
        let curr = store.get(this.ctx.rootId);
        while (!curr.isLeaf) curr = store.get(curr.children![0]);

        // Walk the leaf chain
        let leaf = curr;
        while (leaf) {
            for (let i = 0; i < leaf.keys.length; i++) {
                results.push({ key: leaf.keys[i], value: leaf.values![i] });
            }
            leaf = leaf.nextLeaf ? store.get(leaf.nextLeaf) : null!;
        }
        return results;
    }
}
