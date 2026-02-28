import { TreeContext } from './context';
import { TreeSnapshot, TreeNodeSnapshot } from '../types';

/**
 * Produces an immutable `TreeSnapshot` from the current tree state.
 * Used by the visualization layer to render the B+Tree without exposing
 * internal node objects.
 */
export function createSnapshot(ctx: TreeContext): TreeSnapshot {
    const nodes: Record<string, TreeNodeSnapshot> = {};
    ctx.store.all().forEach((n, id) => {
        nodes[id] = {
            id,
            isLeaf: n.isLeaf,
            keys: [...n.keys],
            children: n.children ? [...n.children] : [],
            nextLeaf: n.nextLeaf ?? null,
            parentId: n.parentId,
        };
    });
    return { rootId: ctx.rootId, order: ctx.order, nodes };
}
