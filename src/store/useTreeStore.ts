import { create } from 'zustand';
import { BPlusTreeNode } from '../engine/btree/types';

interface TreeState {
    nodes: Record<string, BPlusTreeNode>; // Flat map of the tree
    rootId: string | null;
    activeNodeIds: string[]; // For highlighting
    executionLog: string[];

    // Actions
    setTree: (rootId: string, nodes: Map<string, BPlusTreeNode>) => void;
    highlightNode: (id: string) => void;
    clearHighlights: () => void;
    log: (message: string) => void;
}

export const useTreeStore = create<TreeState>((set) => ({
    nodes: {},
    rootId: null,
    activeNodeIds: [],
    executionLog: [],
    setTree: (rootId, nodesMap) => set({
        rootId,
        nodes: Object.fromEntries(nodesMap)
    }),
    highlightNode: (id) => set((state) => ({
        activeNodeIds: [...state.activeNodeIds, id]
    })),
    clearHighlights: () => set({ activeNodeIds: [] }),
    log: (msg) => set((state) => ({
        executionLog: [msg, ...state.executionLog].slice(0, 5)
    })),
}));