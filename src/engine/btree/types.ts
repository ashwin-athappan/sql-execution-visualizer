export type NodeID = string;
export type BTreeKey = number | string;

export interface BPlusTreeNode {
    id: NodeID;
    isLeaf: boolean;
    keys: BTreeKey[];
    children: NodeID[] | undefined;     // internal only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values?: any[];                      // leaf only (parallel array to keys)
    nextLeaf?: NodeID | null;
    parentId: NodeID | null;
}

export interface TreeMetadata {
    order: number;
    rootId: NodeID;
}
