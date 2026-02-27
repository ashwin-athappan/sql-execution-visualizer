import {BPlusTreeNode} from "@/engine/btree/types";

export function generateGraphElements(nodes: Record<string, BPlusTreeNode>, rootId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowNodes: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowEdges: any[] = [];

    // Simple Level-Order Traversal to assign coordinates
    const queue = [{ id: rootId, level: 0, pos: 0 }];

    while (queue.length > 0) {
        const { id, level, pos } = queue.shift()!;
        const node = nodes[id];

        flowNodes.push({
            id,
            type: 'btreeNode', // Custom component
            data: { label: node.keys.join(' | '), isLeaf: node.isLeaf },
            position: { x: pos * 250, y: level * 150 },
        });

        if (!node.isLeaf && node.children) {
            node.children.forEach((childId, index) => {
                flowEdges.push({
                    id: `e-${id}-${childId}`,
                    source: id,
                    target: childId,
                    animated: true,
                });
                queue.push({ id: childId, level: level + 1, pos: pos + index });
            });
        }
    }

    return { flowNodes, flowEdges };
}