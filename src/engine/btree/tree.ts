import { BPlusTreeNode, NodeID, BTreeKey } from './types';
import { TreeSnapshot, TreeNodeSnapshot } from '../types';
import { insertSorted, lowerBound } from './utils';

export type VisitHook = (nodeId: NodeID) => Promise<void>;
export type SplitHook = (oldId: NodeID, newId: NodeID) => Promise<void>;
export type DeleteHook = (nodeId: NodeID) => Promise<void>;
export type MergeHook = (leftId: NodeID, rightId: NodeID) => Promise<void>;

export interface InsertHooks {
    onVisit: VisitHook;
    onSplit: SplitHook;
}

export interface DeleteHooks {
    onVisit: VisitHook;
    onDelete: DeleteHook;
    onMerge: MergeHook;
}

export class BPlusTree {
    private nodes: Map<NodeID, BPlusTreeNode> = new Map();
    private rootId: NodeID;
    private order: number;          // max keys per node (= order - 1)
    private _size: number = 0;

    constructor(order: number = 4) {
        this.order = order;
        const root = this.createNode(true);
        this.rootId = root.id;
    }

    get size(): number { return this._size; }
    get root(): NodeID { return this.rootId; }

    // ── Node helpers ────────────────────────────────────────────────────────────
    private createNode(isLeaf: boolean): BPlusTreeNode {
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

    private getNode(id: NodeID): BPlusTreeNode {
        const n = this.nodes.get(id);
        if (!n) throw new Error(`BPlusTree: node ${id} not found`);
        return n;
    }

    private minKeys(): number { return Math.ceil(this.order / 2) - 1; }
    private maxKeys(): number { return this.order - 1; }

    // ── Search ──────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async search(key: BTreeKey, onVisit?: VisitHook): Promise<any> {
        let curr = this.getNode(this.rootId);
        while (!curr.isLeaf) {
            if (onVisit) await onVisit(curr.id);
            const i = this.findChildIndex(curr.keys, key);
            curr = this.getNode(curr.children![i]);
        }
        if (onVisit) await onVisit(curr.id);
        const idx = curr.keys.indexOf(key);
        return idx !== -1 ? curr.values![idx] : null;
    }

    // ── Range Scan ──────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async rangeSearch(lo: BTreeKey, hi: BTreeKey, onVisit?: VisitHook): Promise<{ key: BTreeKey; value: any }[]> {
        // Navigate to starting leaf
        let curr = this.getNode(this.rootId);
        while (!curr.isLeaf) {
            if (onVisit) await onVisit(curr.id);
            const i = this.findChildIndex(curr.keys, lo);
            curr = this.getNode(curr.children![i]);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: { key: BTreeKey; value: any }[] = [];
        // Walk the leaf chain
        let leaf: BPlusTreeNode | null = curr;
        while (leaf) {
            if (onVisit) await onVisit(leaf.id);
            for (let i = 0; i < leaf.keys.length; i++) {
                if (leaf.keys[i] > hi) { leaf = null; break; }
                if (leaf.keys[i] >= lo) results.push({ key: leaf.keys[i], value: leaf.values![i] });
            }
            if (leaf && leaf.nextLeaf) {
                leaf = this.getNode(leaf.nextLeaf);
            } else {
                leaf = null;
            }
        }
        return results;
    }

    // ── Insert ──────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async insert(key: BTreeKey, value: any, hooks?: InsertHooks): Promise<void> {
        const path: NodeID[] = [];
        let curr = this.getNode(this.rootId);

        while (!curr.isLeaf) {
            path.push(curr.id);
            if (hooks) await hooks.onVisit(curr.id);
            const i = this.findChildIndex(curr.keys, key);
            curr = this.getNode(curr.children![i]);
        }

        if (hooks) await hooks.onVisit(curr.id);

        // Insert or update
        const idx = lowerBound(curr.keys, key);
        if (curr.keys[idx] === key) {
            // Key already exists — update value
            curr.values![idx] = value;
        } else {
            curr.keys.splice(idx, 0, key);
            curr.values!.splice(idx, 0, value);
            this._size++;
        }

        if (curr.keys.length > this.maxKeys()) {
            await this.splitLeaf(curr, path, hooks);
        }
    }

    // ── Delete ──────────────────────────────────────────────────────────────────
    async delete(key: BTreeKey, hooks?: DeleteHooks): Promise<boolean> {
        const path: NodeID[] = [];
        let curr = this.getNode(this.rootId);

        while (!curr.isLeaf) {
            path.push(curr.id);
            if (hooks) await hooks.onVisit(curr.id);
            const i = this.findChildIndex(curr.keys, key);
            curr = this.getNode(curr.children![i]);
        }

        if (hooks) await hooks.onVisit(curr.id);

        const idx = curr.keys.indexOf(key);
        if (idx === -1) return false;

        curr.keys.splice(idx, 1);
        curr.values!.splice(idx, 1);
        this._size--;
        if (hooks) await hooks.onDelete(curr.id);

        // Update separator key in ancestors if needed
        if (curr.parentId && idx === 0 && curr.keys.length > 0) {
            this.updateSeparator(curr, key, curr.keys[0]);
        }

        if (curr.id !== this.rootId && curr.keys.length < this.minKeys()) {
            await this.fixUnderflow(curr, path, hooks);
        }

        return true;
    }

    // ── Scan All ─────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scanAll(): { key: BTreeKey; value: any }[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: { key: BTreeKey; value: any }[] = [];
        // find leftmost leaf
        let curr = this.getNode(this.rootId);
        while (!curr.isLeaf) curr = this.getNode(curr.children![0]);
        // walk chain
        let leaf: BPlusTreeNode | null = curr;
        while (leaf) {
            for (let i = 0; i < leaf.keys.length; i++) {
                results.push({ key: leaf.keys[i], value: leaf.values![i] });
            }
            leaf = leaf.nextLeaf ? this.getNode(leaf.nextLeaf) : null;
        }
        return results;
    }

    // ── Snapshot for visualization ───────────────────────────────────────────────
    getSnapshot(): TreeSnapshot {
        const nodes: Record<string, TreeNodeSnapshot> = {};
        this.nodes.forEach((n, id) => {
            nodes[id] = {
                id,
                isLeaf: n.isLeaf,
                keys: [...n.keys],
                children: n.children ? [...n.children] : [],
                nextLeaf: n.nextLeaf ?? null,
                parentId: n.parentId,
            };
        });
        return { rootId: this.rootId, order: this.order, nodes };
    }

    // ── Internal helpers ─────────────────────────────────────────────────────────
    private findChildIndex(keys: BTreeKey[], key: BTreeKey): number {
        let i = 0;
        while (i < keys.length && key >= keys[i]) i++;
        return i;
    }

    private async splitLeaf(node: BPlusTreeNode, path: NodeID[], hooks?: InsertHooks): Promise<void> {
        const mid = Math.ceil(node.keys.length / 2);
        const sibling = this.createNode(true);
        sibling.parentId = node.parentId;
        if (hooks) await hooks.onSplit(node.id, sibling.id);

        sibling.keys = node.keys.splice(mid);
        sibling.values = node.values!.splice(mid);
        sibling.nextLeaf = node.nextLeaf;
        node.nextLeaf = sibling.id;

        const pushUpKey = sibling.keys[0];
        await this.insertInParent(node, pushUpKey, sibling, path, hooks);
    }

    private async splitInternal(node: BPlusTreeNode, path: NodeID[], hooks?: InsertHooks): Promise<void> {
        const mid = Math.floor(node.keys.length / 2);
        const pushUpKey = node.keys[mid];
        const sibling = this.createNode(false);
        sibling.parentId = node.parentId;
        if (hooks) await hooks.onSplit(node.id, sibling.id);

        sibling.keys = node.keys.splice(mid + 1);
        sibling.children = node.children!.splice(mid + 1);
        node.keys.splice(mid, 1); // remove mid-key (it goes up)

        sibling.children.forEach(cid => { this.getNode(cid).parentId = sibling.id; });
        await this.insertInParent(node, pushUpKey, sibling, path, hooks);
    }

    private async insertInParent(left: BPlusTreeNode, key: BTreeKey, right: BPlusTreeNode, path: NodeID[], hooks?: InsertHooks): Promise<void> {
        if (left.id === this.rootId) {
            const newRoot = this.createNode(false);
            newRoot.keys = [key];
            newRoot.children = [left.id, right.id];
            this.rootId = newRoot.id;
            left.parentId = newRoot.id;
            right.parentId = newRoot.id;
            return;
        }

        const parentId = path.pop()!;
        const parent = this.getNode(parentId);
        right.parentId = parentId;

        const idx = this.findChildIndex(parent.keys, key);
        parent.keys.splice(idx, 0, key);
        parent.children!.splice(idx + 1, 0, right.id);

        if (parent.keys.length > this.maxKeys()) {
            await this.splitInternal(parent, path, hooks);
        }
    }

    private async fixUnderflow(node: BPlusTreeNode, path: NodeID[], hooks?: DeleteHooks): Promise<void> {
        if (!node.parentId) return;
        const parent = this.getNode(node.parentId);
        const myIdx = parent.children!.indexOf(node.id);

        // Try borrow from left sibling
        if (myIdx > 0) {
            const leftSibId = parent.children![myIdx - 1];
            const leftSib = this.getNode(leftSibId);
            if (leftSib.keys.length > this.minKeys()) {
                this.borrowFromLeft(node, leftSib, parent, myIdx);
                return;
            }
        }

        // Try borrow from right sibling
        if (myIdx < parent.children!.length - 1) {
            const rightSibId = parent.children![myIdx + 1];
            const rightSib = this.getNode(rightSibId);
            if (rightSib.keys.length > this.minKeys()) {
                this.borrowFromRight(node, rightSib, parent, myIdx);
                return;
            }
        }

        // Merge
        const mergeWithLeft = myIdx > 0;
        const sibId = mergeWithLeft ? parent.children![myIdx - 1] : parent.children![myIdx + 1];
        const sib = this.getNode(sibId);

        if (hooks) await hooks.onMerge(mergeWithLeft ? sibId : node.id, mergeWithLeft ? node.id : sibId);

        if (mergeWithLeft) {
            this.mergeNodes(sib, node, parent, myIdx - 1);
        } else {
            this.mergeNodes(node, sib, parent, myIdx);
        }

        if (parent.id !== this.rootId && parent.keys.length < this.minKeys()) {
            const parentPath = [...path];
            parentPath.pop();
            await this.fixUnderflow(parent, parentPath, hooks);
        } else if (parent.id === this.rootId && parent.keys.length === 0) {
            // Root is empty; shrink
            this.rootId = parent.children![0];
            this.getNode(this.rootId).parentId = null;
            this.nodes.delete(parent.id);
        }
    }

    private borrowFromLeft(node: BPlusTreeNode, leftSib: BPlusTreeNode, parent: BPlusTreeNode, myIdx: number): void {
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
            this.getNode(borrowedChild).parentId = node.id;
            parent.keys[myIdx - 1] = borrowedKey;
        }
    }

    private borrowFromRight(node: BPlusTreeNode, rightSib: BPlusTreeNode, parent: BPlusTreeNode, myIdx: number): void {
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
            this.getNode(borrowedChild).parentId = node.id;
            parent.keys[myIdx] = borrowedKey;
        }
    }

    private mergeNodes(left: BPlusTreeNode, right: BPlusTreeNode, parent: BPlusTreeNode, sepIdx: number): void {
        if (left.isLeaf) {
            left.keys.push(...right.keys);
            left.values!.push(...right.values!);
            left.nextLeaf = right.nextLeaf;
        } else {
            left.keys.push(parent.keys[sepIdx]);
            left.keys.push(...right.keys);
            left.children!.push(...right.children!);
            right.children!.forEach(cid => { this.getNode(cid).parentId = left.id; });
        }
        parent.keys.splice(sepIdx, 1);
        parent.children!.splice(sepIdx + 1, 1);
        this.nodes.delete(right.id);
    }

    private updateSeparator(node: BPlusTreeNode, oldKey: BTreeKey, newKey: BTreeKey): void {
        if (!node.parentId) return;
        const parent = this.getNode(node.parentId);
        const idx = parent.keys.indexOf(oldKey);
        if (idx !== -1) parent.keys[idx] = newKey;
    }
}