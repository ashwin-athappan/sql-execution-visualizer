import { create } from 'zustand';
import { MiniDatabase } from '@/engine/database';
import { ExecutionStep, PipelineStage, StageName, TableDef } from '@/engine/types';

interface DbStore {
    db: MiniDatabase;

    // Execution state
    steps: ExecutionStep[];
    currentStepIndex: number;
    isPlaying: boolean;
    speed: number;
    isExecuting: boolean;

    // Last SQL run
    lastSQL: string;

    // Pipeline
    pipelineStages: PipelineStage[];
    activeStageName: StageName | undefined;

    // Results
    resultRows: Record<string, unknown>[];
    resultColumns: string[];
    rowsAffected: number;
    error: string | null;

    // Schema
    schemaTables: TableDef[];
    focusedTable: string | null;

    // Actions
    executeQuery: (sql: string) => Promise<void>;
    stepForward: () => void;
    stepBackward: () => void;
    play: () => void;
    pause: () => void;
    reset: () => void;
    setSpeed: (ms: number) => void;
    setFocusedTable: (name: string | null) => void;
    setCurrentStepIndex: (idx: number) => void;
    refreshSchema: () => void;
}

let playInterval: ReturnType<typeof setInterval> | null = null;

function stopPlayback() {
    if (playInterval !== null) { clearInterval(playInterval); playInterval = null; }
}

export const useDbStore = create<DbStore>((set, get) => ({
    db: new MiniDatabase(),
    steps: [],
    currentStepIndex: -1,
    isPlaying: false,
    speed: 800,
    isExecuting: false,
    lastSQL: '',
    pipelineStages: [],
    activeStageName: undefined,
    resultRows: [],
    resultColumns: [],
    rowsAffected: 0,
    error: null,
    schemaTables: [],
    focusedTable: null,

    refreshSchema: () => {
        const { db } = get();
        const tables: TableDef[] = db.getSchema().listTables();
        set({ schemaTables: tables });
        if (!get().focusedTable && tables.length > 0) set({ focusedTable: tables[0].name });
    },

    setFocusedTable: (name) => set({ focusedTable: name }),
    setCurrentStepIndex: (idx) => {
        const { steps } = get();
        const step = steps[idx];
        set({
            currentStepIndex: idx,
            activeStageName: step?.activeStageName,
            pipelineStages: step?.pipelineStages ?? get().pipelineStages,
        });
    },

    executeQuery: async (sql: string) => {
        stopPlayback();
        set({ isExecuting: true, error: null, steps: [], currentStepIndex: -1, pipelineStages: [], activeStageName: undefined, resultRows: [], resultColumns: [], rowsAffected: 0, lastSQL: sql });
        const { db } = get();
        const result = await db.executeScript(sql);
        get().refreshSchema();
        if (result.error) {
            set({ error: result.error, isExecuting: false });
            return;
        }
        // Find focused table from result or keep current
        let focused = get().focusedTable;
        if (!focused && get().schemaTables.length > 0) focused = get().schemaTables[0].name;

        set({
            steps: result.steps,
            currentStepIndex: result.steps.length > 0 ? 0 : -1,
            pipelineStages: result.pipelineStages ?? [],
            activeStageName: result.steps[0]?.activeStageName,
            resultRows: result.resultRows as Record<string, unknown>[],
            resultColumns: result.resultColumns,
            rowsAffected: result.rowsAffected,
            isExecuting: false,
            focusedTable: focused,
        });
    },

    stepForward: () => {
        const { steps, currentStepIndex } = get();
        const next = Math.min(currentStepIndex + 1, steps.length - 1);
        get().setCurrentStepIndex(next);
    },

    stepBackward: () => {
        const { currentStepIndex } = get();
        get().setCurrentStepIndex(Math.max(currentStepIndex - 1, 0));
    },

    play: () => {
        const { speed } = get();
        stopPlayback();
        set({ isPlaying: true });
        playInterval = setInterval(() => {
            const { steps, currentStepIndex, pause } = get();
            if (currentStepIndex >= steps.length - 1) { pause(); return; }
            get().stepForward();
        }, speed);
    },

    pause: () => {
        stopPlayback();
        set({ isPlaying: false });
    },

    reset: () => {
        stopPlayback();
        set({ currentStepIndex: 0, isPlaying: false, activeStageName: undefined });
        get().setCurrentStepIndex(0);
    },

    setSpeed: (ms: number) => {
        const { isPlaying } = get();
        set({ speed: ms });
        if (isPlaying) { get().pause(); get().play(); }
    },
}));
