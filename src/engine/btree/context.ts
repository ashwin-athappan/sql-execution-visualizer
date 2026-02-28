import { NodeID } from './types';
import { NodeStore } from './node-store';

/**
 * Context Object Pattern — a single shared, mutable bag of state that all
 * B+Tree operation classes read from and write to.  Passing this object by
 * reference means that when `BPlusTreeInserter` updates `rootId` after a root
 * split, `BPlusTreeSearcher` immediately sees the new root on the next call.
 */
export interface TreeContext {
    store: NodeStore;
    rootId: NodeID;
    order: number;
    size: number;
}

/** Minimum number of keys a non-root node must hold. */
export function minKeys(order: number): number {
    return Math.ceil(order / 2) - 1;
}

/** Maximum number of keys any node may hold before splitting. */
export function maxKeys(order: number): number {
    return order - 1;
}
