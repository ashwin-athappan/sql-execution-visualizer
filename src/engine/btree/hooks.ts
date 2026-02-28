import { NodeID } from './types';

// ── Callback hooks for observing tree operations ──────────────────────────────
// NOTE: these are NOT React hooks — they are async callbacks injected into
// B+Tree operations so callers can emit animation steps for each traversal,
// split, delete or merge event.

export type VisitHook = (nodeId: NodeID) => Promise<void>;
export type SplitHook = (oldId: NodeID, newId: NodeID) => Promise<void>;
export type DeleteHook = (nodeId: NodeID) => Promise<void>;
export type MergeHook = (leftId: NodeID, rightId: NodeID) => Promise<void>;

/** Hooks provided to `BPlusTree.insert()` */
export interface InsertHooks {
    onVisit: VisitHook;
    onSplit: SplitHook;
}

/** Hooks provided to `BPlusTree.delete()` */
export interface DeleteHooks {
    onVisit: VisitHook;
    onDelete: DeleteHook;
    onMerge: MergeHook;
}
