import { BPlusTreeNode, BTreeKey, NodeID } from './types';
import { TreeContext, minKeys } from './context';
import { DeleteHooks } from './hooks';
import { findChildIndex } from './utils';

/**
 * Handles B+Tree deletion and post-delete rebalancing (borrow / merge).
 * Mutates `ctx.rootId` when the root collapses and decrements `ctx.size`.
 */
export class BPlusTreeDeleter {
    constructor(private ctx: TreeContext) { }

    async delete(key: BTreeKey, hooks?: DeleteHooks): Promise<boolean> {
        const { store } = this.ctx;
        const path: NodeID[] = [];
        let curr = store.get(this.ctx.rootId);

        // Traverse to the target leaf
        while (!curr.isLeaf) {
            path.push(curr.id);
            if (hooks) await hooks.onVisit(curr.id);
            curr = store.get(curr.children![findChildIndex(curr.keys, key)]);
        }
        if (hooks) await hooks.onVisit(curr.id);

        const idx = curr.keys.indexOf(key);
        if (idx === -1) return false;   // key not present

        curr.keys.splice(idx, 1);
        curr.values!.splice(idx, 1);
        this.ctx.size--;
        if (hooks) await hooks.onDelete(curr.id);

        // Update the separator key in ancestors if the first leaf key changed
        if (curr.parentId && idx === 0 && curr.keys.length > 0) {
            this.updateSeparator(curr, key, curr.keys[0]);
        }

        // Fix underflow (only if curr is not the root)
        if (curr.id !== this.ctx.rootId && curr.keys.length < minKeys(this.ctx.order)) {
            await this.fixUnderflow(curr, path, hooks);
        }

        return true;
    }

    // ── Rebalancing ───────────────────────────────────────────────────────────

    private async fixUnderflow(
        node: BPlusTreeNode,
        path: NodeID[],
        hooks?: DeleteHooks,
    ): Promise<void> {
        const { store } = this.ctx;
        if (!node.parentId) return;

        const parent = store.get(node.parentId);
        const myIdx = parent.children!.indexOf(node.id);

        // 1. Try borrowing from the left sibling
        if (myIdx > 0) {
            const leftSib = store.get(parent.children![myIdx - 1]);
            if (leftSib.keys.length > minKeys(this.ctx.order)) {
                this.borrowFromLeft(node, leftSib, parent, myIdx);
                return;
            }
        }

        // 2. Try borrowing from the right sibling
        if (myIdx < parent.children!.length - 1) {
            const rightSib = store.get(parent.children![myIdx + 1]);
            if (rightSib.keys.length > minKeys(this.ctx.order)) {
                this.borrowFromRight(node, rightSib, parent, myIdx);
                return;
            }
        }

        // 3. Merge with a sibling
        const mergeWithLeft = myIdx > 0;
        const sibId = mergeWithLeft
            ? parent.children![myIdx - 1]
            : parent.children![myIdx + 1];
        const sib = store.get(sibId);

        if (hooks) await hooks.onMerge(
            mergeWithLeft ? sibId : node.id,
            mergeWithLeft ? node.id : sibId,
        );

        if (mergeWithLeft) {
            this.mergeNodes(sib, node, parent, myIdx - 1);
        } else {
            this.mergeNodes(node, sib, parent, myIdx);
        }

        // Propagate underflow up the tree if needed
        if (parent.id !== this.ctx.rootId && parent.keys.length < minKeys(this.ctx.order)) {
            const parentPath = path.slice(0, -1);
            await this.fixUnderflow(parent, parentPath, hooks);
        } else if (parent.id === this.ctx.rootId && parent.keys.length === 0) {
            // Root is now empty — collapse one level
            this.ctx.rootId = parent.children![0];
            store.get(this.ctx.rootId).parentId = null;
            store.remove(parent.id);
        }
    }

    private borrowFromLeft(
        node: BPlusTreeNode,
        leftSib: BPlusTreeNode,
        parent: BPlusTreeNode,
        myIdx: number,
    ): void {
        const { store } = this.ctx;
        if (node.isLeaf) {
            const borrowedKey = leftSib.keys.pop()!;
            const borrowedVal = leftSib.values!.pop();
            node.keys.unshift(borrowedKey);
            node.values!.unshift(borrowedVal);
            parent.keys[myIdx - 1] = borrowedKey;
        } else {
            const downKey = parent.keys[myIdx - 1];
            const borrowedKey = leftSib.keys.pop()!;
            const borrowedChild = leftSib.children!.pop()!;
            node.keys.unshift(downKey);
            node.children!.unshift(borrowedChild);
            store.get(borrowedChild).parentId = node.id;
            parent.keys[myIdx - 1] = borrowedKey;
        }
    }

    private borrowFromRight(
        node: BPlusTreeNode,
        rightSib: BPlusTreeNode,
        parent: BPlusTreeNode,
        myIdx: number,
    ): void {
        const { store } = this.ctx;
        if (node.isLeaf) {
            const borrowedKey = rightSib.keys.shift()!;
            const borrowedVal = rightSib.values!.shift();
            node.keys.push(borrowedKey);
            node.values!.push(borrowedVal);
            parent.keys[myIdx] = rightSib.keys[0];
        } else {
            const downKey = parent.keys[myIdx];
            const borrowedKey = rightSib.keys.shift()!;
            const borrowedChild = rightSib.children!.shift()!;
            node.keys.push(downKey);
            node.children!.push(borrowedChild);
            store.get(borrowedChild).parentId = node.id;
            parent.keys[myIdx] = borrowedKey;
        }
    }

    private mergeNodes(
        left: BPlusTreeNode,
        right: BPlusTreeNode,
        parent: BPlusTreeNode,
        sepIdx: number,
    ): void {
        const { store } = this.ctx;
        if (left.isLeaf) {
            left.keys.push(...right.keys);
            left.values!.push(...right.values!);
            left.nextLeaf = right.nextLeaf;
        } else {
            left.keys.push(parent.keys[sepIdx]);
            left.keys.push(...right.keys);
            left.children!.push(...right.children!);
            right.children!.forEach(cid => { store.get(cid).parentId = left.id; });
        }
        parent.keys.splice(sepIdx, 1);
        parent.children!.splice(sepIdx + 1, 1);
        store.remove(right.id);
    }

    private updateSeparator(node: BPlusTreeNode, oldKey: BTreeKey, newKey: BTreeKey): void {
        if (!node.parentId) return;
        const parent = this.ctx.store.get(node.parentId);
        const idx = parent.keys.indexOf(oldKey);
        if (idx !== -1) parent.keys[idx] = newKey;
    }
}
