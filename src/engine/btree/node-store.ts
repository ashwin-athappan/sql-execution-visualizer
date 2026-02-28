import { BPlusTreeNode, NodeID } from './types';

/**
 * Repository Pattern — owns the in-memory node map.
 * All node lifecycle operations (create / read / delete) go through here,
 * keeping raw Map manipulation out of the operation classes.
 */
export class NodeStore {
    private nodes: Map<NodeID, BPlusTreeNode> = new Map();

    /** Allocate and register a new node. */
    create(isLeaf: boolean): BPlusTreeNode {
        const node: BPlusTreeNode = {
            id: Math.random().toString(36).slice(2, 9),
            isLeaf,
            keys: [],
            children: isLeaf ? undefined : [],
            values: isLeaf ? [] : undefined,
            parentId: null,
            nextLeaf: null,
        };
        this.nodes.set(node.id, node);
        return node;
    }

    /** Retrieve a node by ID — throws if missing. */
    get(id: NodeID): BPlusTreeNode {
        const n = this.nodes.get(id);
        if (!n) throw new Error(`BPlusTree: node ${id} not found`);
        return n;
    }

    /** Remove a node (used during merge/collapse). */
    remove(id: NodeID): void {
        this.nodes.delete(id);
    }

    /** Expose the raw map for snapshotting. */
    all(): Map<NodeID, BPlusTreeNode> {
        return this.nodes;
    }
}
