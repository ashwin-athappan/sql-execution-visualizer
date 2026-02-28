import { BPlusTreeNode, BTreeKey, NodeID } from './types';
import { TreeContext, maxKeys } from './context';
import { InsertHooks } from './hooks';
import { lowerBound, findChildIndex } from './utils';

/**
 * Handles B+Tree insert, leaf-split, internal-split, and parent promotion.
 * Mutates `ctx.rootId` when a root split occurs and increments `ctx.size`
 * on each new key insertion.
 */
export class BPlusTreeInserter {
    constructor(private ctx: TreeContext) { }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async insert(key: BTreeKey, value: any, hooks?: InsertHooks): Promise<void> {
        const { store } = this.ctx;
        const path: NodeID[] = [];
        let curr = store.get(this.ctx.rootId);

        // Traverse to the target leaf, collecting the ancestor path
        while (!curr.isLeaf) {
            path.push(curr.id);
            if (hooks) await hooks.onVisit(curr.id);
            curr = store.get(curr.children![findChildIndex(curr.keys, key)]);
        }
        if (hooks) await hooks.onVisit(curr.id);

        // Insert or update in the leaf
        const idx = lowerBound(curr.keys, key);
        if (curr.keys[idx] === key) {
            // Key already exists — update value in-place (no size change)
            curr.values![idx] = value;
        } else {
            curr.keys.splice(idx, 0, key);
            curr.values!.splice(idx, 0, value);
            this.ctx.size++;
        }

        // Split if the leaf is now over-full
        if (curr.keys.length > maxKeys(this.ctx.order)) {
            await this.splitLeaf(curr, path, hooks);
        }
    }

    // ── Private split helpers ─────────────────────────────────────────────────

    private async splitLeaf(
        node: BPlusTreeNode,
        path: NodeID[],
        hooks?: InsertHooks,
    ): Promise<void> {
        const { store } = this.ctx;
        const mid = Math.ceil(node.keys.length / 2);
        const sibling = store.create(true);
        sibling.parentId = node.parentId;

        if (hooks) await hooks.onSplit(node.id, sibling.id);

        sibling.keys = node.keys.splice(mid);
        sibling.values = node.values!.splice(mid);
        sibling.nextLeaf = node.nextLeaf;
        node.nextLeaf = sibling.id;

        await this.insertInParent(node, sibling.keys[0], sibling, path, hooks);
    }

    private async splitInternal(
        node: BPlusTreeNode,
        path: NodeID[],
        hooks?: InsertHooks,
    ): Promise<void> {
        const { store } = this.ctx;
        const mid = Math.floor(node.keys.length / 2);
        const pushUpKey = node.keys[mid];
        const sibling = store.create(false);
        sibling.parentId = node.parentId;

        if (hooks) await hooks.onSplit(node.id, sibling.id);

        sibling.keys = node.keys.splice(mid + 1);
        sibling.children = node.children!.splice(mid + 1);
        node.keys.splice(mid, 1);   // the median key rises up

        sibling.children.forEach(cid => { store.get(cid).parentId = sibling.id; });
        await this.insertInParent(node, pushUpKey, sibling, path, hooks);
    }

    private async insertInParent(
        left: BPlusTreeNode,
        key: BTreeKey,
        right: BPlusTreeNode,
        path: NodeID[],
        hooks?: InsertHooks,
    ): Promise<void> {
        const { store } = this.ctx;

        // Root split — create a new root
        if (left.id === this.ctx.rootId) {
            const newRoot = store.create(false);
            newRoot.keys = [key];
            newRoot.children = [left.id, right.id];
            this.ctx.rootId = newRoot.id;
            left.parentId = newRoot.id;
            right.parentId = newRoot.id;
            return;
        }

        const parentId = path.pop()!;
        const parent = store.get(parentId);
        right.parentId = parentId;

        const idx = findChildIndex(parent.keys, key);
        parent.keys.splice(idx, 0, key);
        parent.children!.splice(idx + 1, 0, right.id);

        if (parent.keys.length > maxKeys(this.ctx.order)) {
            await this.splitInternal(parent, path, hooks);
        }
    }
}
